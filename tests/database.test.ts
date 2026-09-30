import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

const ADMIN='00000000-0000-0000-0000-000000000001', OTHER='00000000-0000-0000-0000-000000000002';
const invoice = (n='INV-30092026-0001') => ({nomorInvoice:n,tanggal:'2026-09-30',namaCustomer:'Customer',items:[{id:'1',deskripsi:'Paket',qty:1,hargaSatuan:100,jumlah:100}],rekeningBank:[],metodePembayaran:'Cash',tanggalBayar:'2026-09-30',jumlahDibayar:30});

test('PostgreSQL: admin access, permanent ledger, conflicts, CSV restoration and atomic batches', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
      insert into auth.users values ('${ADMIN}'),('${OTHER}');`);
    const schema = await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
    await db.exec(schema);
    await db.exec(schema); // repeat installation must be safe
    await db.query('insert into public.invoice_admins values($1)',[ADMIN]);
    await db.exec(`set role authenticated; set request.jwt.claim.sub='${ADMIN}';`);
    const call = async (docs: unknown[], restore=false) => (await db.query<{id:string;updated_at:Date;data:unknown}>('select * from public.save_invoice_batch($1::jsonb,$2)',[JSON.stringify(docs),restore])).rows;
    const number = async () => (await db.query<{n:string}>("select public.next_invoice_number('2026-09-30') n")).rows[0].n;
    const all = async () => (await db.query<{n:number}>('select count(*)::int n from public.invoices')).rows[0].n;
    const versions = (row: {id:string;updated_at:Date}) => ({recordId:row.id,recordVersion:row.updated_at.toISOString()});
    const del = async (row: {id:string;updated_at:Date}) => db.query('select public.delete_invoice_history($1::jsonb)',[JSON.stringify([{id:row.id,version:row.updated_at.toISOString()}])]);
    assert.equal(await number(),'INV-30092026-0001');
    await assert.rejects(call([{...invoice(),items:[{id:'1',deskripsi:'',jumlah:0}]}]),/INVALID_INVOICE/);
    const first=(await call([invoice()]))[0];
    assert.equal(await number(),'INV-30092026-0002');
    await assert.rejects(call([invoice()]),/NUMBER_USED/);
    await assert.rejects(db.query('delete from public.invoice_numbers'),/permission denied/);
    await assert.rejects(db.query('insert into public.invoices(id,number,data) values($1,$2,$3)',[first.id,'OTHER',{}]),/permission denied/);
    const edit=(await call([{...invoice(),...versions(first),jumlahDibayar:50}]))[0];
    await assert.rejects(call([{...invoice(),...versions(first)}]),/EDIT_CONFLICT/);
    await assert.rejects(del(first),/EDIT_CONFLICT/);
    await assert.rejects(call([{...invoice('INV-30092026-0008'),...versions(edit)}]),/NUMBER_IMMUTABLE/);
    await del(edit);
    assert.equal(await all(),0);
    assert.equal(await number(),'INV-30092026-0002');
    await assert.rejects(call([{...invoice(),...versions(edit)}]),/NUMBER_USED/);
    const restored=(await call([invoice()],true))[0];
    assert.equal(restored.id,first.id);
    await assert.rejects(call([invoice()],true),/NUMBER_USED/); // cannot overwrite live invoice by importing CSV
    await assert.rejects(call([invoice('INV-30092026-0002'),invoice()],true),/NUMBER_USED/);
    assert.equal(await all(),1);
    assert.equal(await number(),'INV-30092026-0002'); // rolled-back batch does not consume numbers
    await call([invoice('INV-30092026-0003')]);
    assert.equal(await number(),'INV-30092026-0002'); // first unused gap
    await call([invoice('INV-30092026-0002')]);
    assert.equal(await number(),'INV-30092026-0004');
    await db.exec(`set request.jwt.claim.sub='${OTHER}';`);
    assert.equal(await all(),0); // RLS excludes non-admins
    await assert.rejects(number(),/ADMIN_REQUIRED/);
    await assert.rejects(call([invoice('NEW')]),/ADMIN_REQUIRED/);
    await assert.rejects(del(restored),/ADMIN_REQUIRED/);
    await db.exec('reset role; set role anon;');
    await assert.rejects(db.query("select public.next_invoice_number('2026-09-30')"),/permission denied/);
  } finally {await db.close();}
});
