import { getSupabase } from './supabase';
import { validateInvoice } from './validation';
import { hitungBiaya, hitungDibayar, statusInvoice, tanggalHariIni } from './utils';
import type { InvoiceData } from './types';
import type { InvoiceHistoryItem } from './storage';

export function databaseError(error: unknown): string {
  const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : String(error);
  if (message.includes('NUMBER_USED')) return 'Nomor INV sudah pernah digunakan. Buat invoice baru atau pulihkan arsip melalui Upload CSV.';
  if (message.includes('EDIT_CONFLICT')) return 'Invoice telah diubah di perangkat lain. Buka ulang dari riwayat sebelum menyimpan.';
  if (message.includes('ADMIN_REQUIRED')) return 'Akun belum diberi akses admin. Periksa daftar invoice_admins di Supabase.';
  if (message.includes('NUMBER_IMMUTABLE')) return 'Nomor invoice yang sudah tersimpan tidak dapat diubah.';
  return `Database belum berhasil diakses: ${message}`;
}

function historyItem(row: {id: string; number: string; updated_at: string; data: unknown}): InvoiceHistoryItem {
  const data = validateInvoice({...row.data as object, recordId: row.id, recordVersion: row.updated_at});
  const total = hitungBiaya(data).total, dibayar = hitungDibayar(data);
  return {id: row.id, nomorInvoice: row.number, namaCustomer: data.namaCustomer, tanggal: data.tanggal,
    total, dibayar, status: statusInvoice(total, dibayar), dicetakPada: data.dicetakPada || '', data};
}

export async function loadCloudHistory(): Promise<InvoiceHistoryItem[]> {
  // Supabase normally caps results at 1,000 rows. Fetch all pages for correct CSV/totals.
  const result: InvoiceHistoryItem[] = [];
  for (let start = 0; ; start += 500) {
    const {data, error} = await getSupabase().from('invoices').select('id,number,updated_at,data')
      .order('created_at', {ascending: false}).order('id').range(start, start + 499);
    if (error) throw new Error(databaseError(error));
    result.push(...(data ?? []).map(historyItem));
    if (!data || data.length < 500) return result;
  }
}

export async function suggestCloudNumber(date = tanggalHariIni()): Promise<string> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) throw new Error('Tanggal invoice tidak valid');
  const {data, error} = await getSupabase().rpc('next_invoice_number', {p_date: date});
  if (error) throw new Error(databaseError(error));
  if (typeof data !== 'string') throw new Error('Nomor invoice dari database tidak valid');
  return data;
}

async function saveBatch(invoices: InvoiceData[], restore: boolean): Promise<InvoiceHistoryItem[]> {
  const inputs = invoices.map(validateInvoice);
  const {data, error} = await getSupabase().rpc('save_invoice_batch', {p_invoices: inputs, p_restore: restore});
  if (error) throw new Error(databaseError(error));
  return (data ?? []).map(historyItem);
}
export async function saveCloudInvoice(data: InvoiceData): Promise<InvoiceData> {
  const saved = await saveBatch([data], false);
  if (!saved[0]) throw new Error('Database tidak mengembalikan invoice tersimpan');
  return saved[0].data;
}
export async function importCloudInvoices(data: InvoiceData[]): Promise<InvoiceHistoryItem[]> {
  // CSV import is an explicit restoration; never silently overwrite a current cloud invoice.
  return saveBatch(data.map(({recordId, recordVersion, ...invoice}) => invoice), true);
}
export async function deleteCloudInvoices(items: InvoiceHistoryItem[]): Promise<void> {
  const {error} = await getSupabase().rpc('delete_invoice_history', {p_records: items.map(item => ({id: item.id, version: item.data.recordVersion}))});
  if (error) throw new Error(databaseError(error));
}
