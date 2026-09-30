-- Jalankan pada SQL Editor Supabase. Jangan jalankan sebagai user aplikasi.
-- Tabel nomor tidak menyimpan data pelanggan/PDF dan tidak ikut penghapusan riwayat.
begin;
create table if not exists public.invoice_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
create table if not exists public.invoice_numbers (
  number text primary key check (length(number) between 1 and 100),
  invoice_id uuid not null unique default gen_random_uuid(),
  used_at timestamptz not null default now()
);
create table if not exists public.invoices (
  id uuid primary key,
  number text not null unique references public.invoice_numbers(number),
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default clock_timestamp()
);
create index if not exists invoices_created_idx on public.invoices(created_at desc, id);
alter table public.invoice_admins enable row level security;
alter table public.invoice_numbers enable row level security;
alter table public.invoices enable row level security;

create or replace function public.is_invoice_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.invoice_admins where user_id = auth.uid());
$$;
revoke all on function public.is_invoice_admin() from public, anon;
grant execute on function public.is_invoice_admin() to authenticated;

drop policy if exists own_admin_access on public.invoice_admins;
create policy own_admin_access on public.invoice_admins for select to authenticated using (user_id = auth.uid());
drop policy if exists admins_read_invoices on public.invoices;
create policy admins_read_invoices on public.invoices for select to authenticated using (public.is_invoice_admin());
drop policy if exists admins_read_numbers on public.invoice_numbers;
create policy admins_read_numbers on public.invoice_numbers for select to authenticated using (public.is_invoice_admin());
-- Semua perubahan wajib melalui RPC; klien tidak dapat menghapus/mengubah ledger nomor.
revoke all on public.invoice_admins, public.invoice_numbers, public.invoices from anon, authenticated;
grant select on public.invoice_admins, public.invoice_numbers, public.invoices to authenticated;

create or replace function public.next_invoice_number(p_date date) returns text
language plpgsql security definer set search_path = '' as $$
declare prefix text; seq bigint := 1;
begin
  if not public.is_invoice_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if p_date is null or p_date < date '1900-01-01' or p_date > date '9999-12-31' then raise exception 'INVALID_DATE'; end if;
  prefix := 'INV-' || to_char(p_date, 'DDMMYYYY') || '-';
  while exists (select 1 from public.invoice_numbers where number = prefix || lpad(seq::text, greatest(4, length(seq::text)), '0')) loop
    seq := seq + 1;
  end loop;
  return prefix || lpad(seq::text, greatest(4, length(seq::text)), '0');
end;
$$;

create or replace function public.save_invoice_batch(p_invoices jsonb, p_restore boolean default false)
returns setof public.invoices
language plpgsql security definer set search_path = '' as $$
declare d jsonb; n text; registered uuid; current_row public.invoices; stamp timestamptz; saved public.invoices;
begin
  if not public.is_invoice_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if jsonb_typeof(p_invoices) is distinct from 'array' or jsonb_array_length(p_invoices) = 0 or jsonb_array_length(p_invoices) > 10000 then raise exception 'INVALID_BATCH'; end if;
  -- Serialisasi transaksi: pengecekan nomor dan penyimpanan tidak dapat berlomba antar perangkat.
  perform pg_advisory_xact_lock(78321041);
  for d in select value from jsonb_array_elements(p_invoices) loop
    n := btrim(d->>'nomorInvoice');
    if n is null or n = '' or length(n) > 100 or jsonb_typeof(d->'items') is distinct from 'array'
      or jsonb_typeof(d->'rekeningBank') is distinct from 'array' or coalesce(btrim(d->>'namaCustomer'), '') = ''
      or coalesce(d->>'tanggal', '') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'INVALID_INVOICE'; end if;
    if jsonb_array_length(d->'items') = 0 or exists (select 1 from jsonb_array_elements(d->'items') item where jsonb_typeof(item->'deskripsi') is distinct from 'string' or coalesce(btrim(item->>'deskripsi'), '') = '') then raise exception 'INVALID_INVOICE'; end if;
    perform (d->>'tanggal')::date;
    if exists (select 1 from public.invoice_numbers where invoice_id::text = d->>'recordId' and number <> n) then raise exception 'NUMBER_IMMUTABLE'; end if;
    select invoice_id into registered from public.invoice_numbers where number = n;
    if registered is not null then
      select * into current_row from public.invoices where id = registered;
      if found then
        if d->>'recordId' is distinct from registered::text or d->>'recordVersion' is distinct from current_row.updated_at::text
        then
          -- Compare timestamps as values: PostgREST emits ISO format, postgres uses a space.
          if d->>'recordId' is distinct from registered::text then raise exception 'NUMBER_USED'; end if;
          if nullif(d->>'recordVersion', '') is null or (d->>'recordVersion')::timestamptz <> current_row.updated_at then raise exception 'EDIT_CONFLICT'; end if;
        end if;
      elsif not p_restore then
        raise exception 'NUMBER_USED';
      end if;
    else
      if nullif(d->>'recordId', '') is not null then raise exception 'NUMBER_IMMUTABLE'; end if;
      insert into public.invoice_numbers(number) values(n) returning invoice_id into registered;
    end if;
    stamp := clock_timestamp();
    insert into public.invoices(id, number, data, updated_at)
      values(registered, n, (d - 'recordId' - 'recordVersion') || jsonb_build_object('nomorInvoice', n), stamp)
      on conflict(id) do update set data = excluded.data, updated_at = excluded.updated_at
      returning * into saved;
    return next saved;
  end loop;
end;
$$;

create or replace function public.delete_invoice_history(p_records jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare r jsonb; actual timestamptz;
begin
  if not public.is_invoice_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if jsonb_typeof(p_records) is distinct from 'array' then raise exception 'INVALID_BATCH'; end if;
  perform pg_advisory_xact_lock(78321041);
  for r in select value from jsonb_array_elements(p_records) loop
    select updated_at into actual from public.invoices where id = (r->>'id')::uuid;
    if found then
      if nullif(r->>'version', '') is null or actual <> (r->>'version')::timestamptz then raise exception 'EDIT_CONFLICT'; end if;
      delete from public.invoices where id = (r->>'id')::uuid;
    end if;
  end loop;
  -- public.invoice_numbers tetap disimpan, tanpa data pribadi pelanggan.
end;
$$;
revoke all on function public.next_invoice_number(date), public.save_invoice_batch(jsonb,boolean), public.delete_invoice_history(jsonb) from public, anon;
grant execute on function public.next_invoice_number(date), public.save_invoice_batch(jsonb,boolean), public.delete_invoice_history(jsonb) to authenticated;
commit;
