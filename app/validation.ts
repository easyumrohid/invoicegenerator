import type { InvoiceData } from './types';

export function validateInvoice(value: unknown): InvoiceData {
  if (!value || typeof value !== 'object') throw new Error('Data invoice harus berupa objek');
  const d = value as InvoiceData;
  const text = (v: unknown): v is string => typeof v === 'string';
  const number = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1e12;
  const date = (v: unknown): v is string => text(v) && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0,10) === v;
  if (!text(d.nomorInvoice) || !date(d.tanggal) || !text(d.namaCustomer) || !Array.isArray(d.items) || !Array.isArray(d.rekeningBank)) throw new Error('Struktur invoice tidak valid');
  const ids = new Set<string>();
  for (const i of d.items) {
    if (!i || !text(i.id) || ids.has(i.id) || !text(i.deskripsi) || !number(i.jumlah) || (i.qty !== undefined && !number(i.qty)) || (i.hargaSatuan !== undefined && !number(i.hargaSatuan)) || (i.subDeskripsi !== undefined && !text(i.subDeskripsi))) throw new Error('Item invoice tidak valid');
    ids.add(i.id);
    if (i.qty !== undefined && i.hargaSatuan !== undefined && Math.abs(i.jumlah - i.qty * i.hargaSatuan) > 0.001) throw new Error('Jumlah item tidak sesuai qty × harga');
  }
  for (const b of d.rekeningBank) if (!b || !text(b.id) || !text(b.bank) || !text(b.nomorRekening) || !text(b.atasNama)) throw new Error('Rekening tidak valid');
  for (const v of [d.diskon ?? 0, d.pajak ?? 0, d.biayaAdmin ?? 0, d.jumlahDibayar ?? 0]) if (!number(v)) throw new Error('Nominal tidak valid');
  for (const [value, mode] of [[d.diskon, d.diskonMode], [d.pajak, d.pajakMode], [d.biayaAdmin, d.biayaAdminMode]] as const) {
    if (mode !== undefined && mode !== 'nominal' && mode !== 'percent') throw new Error('Jenis biaya tidak valid');
    if (mode === 'percent' && (value ?? 0) > 100) throw new Error('Persentase maksimal 100%');
  }
  if (d.riwayatPembayaran !== undefined) {
    if (!Array.isArray(d.riwayatPembayaran)) throw new Error('Riwayat pembayaran tidak valid');
    for (const p of d.riwayatPembayaran) if (!p || !date(p.tanggal) || !text(p.metode) || !number(p.jumlah) || (p.bank !== undefined && !text(p.bank))) throw new Error('Pembayaran tidak valid');
  }
  for (const v of [d.referensi, d.dicetakPada, d.metodePembayaran, d.tanggalBayar]) if (v !== undefined && !text(v)) throw new Error('Teks invoice tidak valid');
  return {...d, jumlahDibayar: d.jumlahDibayar ?? 0, metodePembayaran: d.metodePembayaran ?? 'Transfer Bank', tanggalBayar: d.tanggalBayar ?? ''};
}
