import { statusPembayaran, hitungBiaya } from "./utils";
import { validateInvoice } from "./validation";
import { tanggalHariIni, hitungDibayar, statusInvoice } from "./utils";
import { InvoiceData } from "./types";

const STORAGE_KEY = "easyumroh_invoice";
const HISTORY_KEY = "easyumroh_invoices_history";

// ── SINGLE INVOICE (current behavior, for draft/editing) ──

export function saveInvoice(data: InvoiceData, userId?: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(userId ? `${STORAGE_KEY}:${userId}` : STORAGE_KEY, JSON.stringify(data));
}

export function loadInvoice(userId?: string): InvoiceData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(userId ? `${STORAGE_KEY}:${userId}` : STORAGE_KEY);
    if (!raw) return null;
    return validateInvoice(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function clearInvoice() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

// ── INVOICE HISTORY (save completed/generated invoices) ──

export interface InvoiceHistoryItem {
  id: string;
  nomorInvoice: string;
  namaCustomer: string;
  tanggal: string;
  total: number;
  dibayar: number;
  status: "LUNAS" | "SEBAGIAN" | "BELUM_DIBAYAR";
  dicetakPada: string;
  data: InvoiceData; // full invoice data for re-download
}

export function saveToHistory(data: InvoiceData, total: number, dibayar: number, status: string) {
  if (typeof window === "undefined") return;

  const history = loadHistory();
  const existingIndex = history.findIndex((h) => h.nomorInvoice === data.nomorInvoice);

  const item: InvoiceHistoryItem = {
    id: existingIndex >= 0 ? history[existingIndex].id : crypto.randomUUID(),
    nomorInvoice: data.nomorInvoice,
    namaCustomer: data.namaCustomer || "Tanpa Nama",
    tanggal: data.tanggal,
    total,
    dibayar,
    status: status as "LUNAS" | "SEBAGIAN" | "BELUM_DIBAYAR",
    dicetakPada: data.dicetakPada || new Date().toISOString(),
    data,
  };

  if (existingIndex >= 0) {
    history[existingIndex] = item; // update existing
  } else {
    history.unshift(item); // add to top
  }

  localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); // Preserve all saved invoices; quota errors are shown to the user.
}

// Commit CSV imports in a single write: quota failures cannot leave a partial batch.
export function saveImportedInvoices(invoices: InvoiceData[]) {
  if (typeof window === "undefined") return;
  const history = loadHistory();
  for (const input of invoices) {
    const data = validateInvoice(input);
    const total = hitungBiaya(data).total;
    const dibayar = hitungDibayar(data);
    const index = history.findIndex(h => h.nomorInvoice === data.nomorInvoice);
    const item: InvoiceHistoryItem = {id:index < 0 ? crypto.randomUUID() : history[index].id, nomorInvoice:data.nomorInvoice, namaCustomer:data.namaCustomer, tanggal:data.tanggal, total, dibayar, status:statusPembayaran(data), dicetakPada:data.dicetakPada || new Date().toISOString(), data};
    if (index < 0) history.unshift(item); else history[index] = item;
  }
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

export function loadHistory(): InvoiceHistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((h) => {
      try {
        if (!h || typeof h.id !== "string") return [];
        const data = validateInvoice(h.data);
        const total = hitungBiaya(data).total;
        const dibayar = hitungDibayar(data);
        return [{...h, data, nomorInvoice: data.nomorInvoice, namaCustomer: data.namaCustomer, tanggal: data.tanggal, total, dibayar, status: statusPembayaran(data)}];
      } catch { return []; }
    });
  } catch {
    return [];
  }
}

export function deleteFromHistory(id: string) {
  if (typeof window === "undefined") return;
  const history = loadHistory().filter((h) => h.id !== id);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

export function clearHistory() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(HISTORY_KEY);
}

export function getHistoryById(id: string): InvoiceHistoryItem | null {
  return loadHistory().find((h) => h.id === id) || null;
}

// ── CSV IMPORT / EXPORT ──

export interface CSVRow {
  nomorInvoice: string;
  tanggal: string;
  namaCustomer: string;
  referensi?: string;
  itemDeskripsi: string;
  itemSubDeskripsi?: string;
  itemQty: number;
  itemHargaSatuan: number;
  diskon?: number;
  diskonMode?: import("./types").FeeMode;
  pajakMode?: import("./types").FeeMode;
  biayaAdminMode?: import("./types").FeeMode;
  pajak?: number;
  biayaAdmin?: number;
  deposit?: number;
  depositInvoice?: string;
  bank?: string;
  nomorRekening?: string;
  atasNama?: string;
  jumlahDibayar?: number;
  metodePembayaran?: string;
  tanggalBayar?: string;
  riwayatJSON?: string;
  rekeningJSON?: string;
}

function csvRecords(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i=0; i<text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i+1] === '"') { cell += '"'; i++; }
      else if (quoted || cell === "") quoted = !quoted;
      else throw new Error("Tanda kutip CSV tidak valid");
    } else if (c === ',' && !quoted) { row.push(cell); cell = ""; }
    else if ((c === '\n' || c === '\r') && !quoted) {
      row.push(cell); if (row.some(v=>v.trim())) rows.push(row);
      row = []; cell = "";
      if (c === '\r' && text[i+1] === '\n') i++;
    } else cell += c;
  }
  if (quoted) throw new Error("Tanda kutip CSV belum ditutup");
  row.push(cell); if (row.some(v=>v.trim())) rows.push(row);
  return rows;
}

export function parseCSV(text: string): CSVRow[] {
  const records = csvRecords(text);
  if (records.length < 2) return [];
  const headers = records[0].map(h=>h.trim().toLowerCase().replace(/\s+/g, "_"));
  if (new Set(headers).size !== headers.length) throw new Error("Kolom CSV duplikat");
  const aliases: Record<string, string[]> = {
    nomor_invoice: ["nomor_invoice","no_invoice","invoice"], tanggal: ["tanggal","date"], nama_customer:["nama_customer","customer","nama"],
    item_deskripsi:["item_deskripsi","deskripsi","item"], item_qty:["item_qty","qty"], item_harga_satuan:["item_harga_satuan","harga","harga_satuan"]
  };
  for (const options of Object.values(aliases)) if (!options.some(h=>headers.includes(h))) throw new Error(`Kolom wajib tidak ada: ${options[0]}`);
  return records.slice(1).map((values, idx) => {
    if (values.length !== headers.length) throw new Error(`Baris ${idx+2}: jumlah kolom tidak sesuai`);
    const get = (...names: string[]) => { const i = headers.findIndex(h=>names.includes(h)); return i < 0 ? "" : values[i].trim(); };
    const num = (name: string, fallback = 0, ...extra: string[]) => {
      const raw = get(...(aliases[name] ?? [name]), ...extra);
      if (!raw) return fallback;
      if (!/^\d+(?:\.\d+)?$/.test(raw)) throw new Error(`Baris ${idx+2}: ${name} harus angka tanpa pemisah ribuan`);
      const value = Number(raw);
      if (!Number.isFinite(value) || value > 1e12) throw new Error(`Baris ${idx+2}: ${name} terlalu besar`);
      return value;
    };
    const nomorInvoice = get(...aliases.nomor_invoice), tanggal = get(...aliases.tanggal), namaCustomer = get(...aliases.nama_customer), itemDeskripsi = get(...aliases.item_deskripsi);
    if (!nomorInvoice || !namaCustomer || !itemDeskripsi || !/^\d{4}-\d{2}-\d{2}$/.test(tanggal) || !Number.isFinite(Date.parse(tanggal)) || new Date(tanggal).toISOString().slice(0,10) !== tanggal) throw new Error(`Baris ${idx+2}: identitas atau tanggal tidak valid`);
    return { nomorInvoice, tanggal, namaCustomer, itemDeskripsi, referensi:get("referensi","ref"), itemSubDeskripsi:get("item_sub_deskripsi","sub_deskripsi"),
      itemQty:num("item_qty",1), itemHargaSatuan:num("item_harga_satuan"), diskon:num("diskon"), pajak:num("pajak",0,"tax"), biayaAdmin:num("biaya_admin",0,"admin","service_fee"),
      diskonMode:(get("diskon_mode") || "nominal") as import("./types").FeeMode, pajakMode:(get("tax_mode", "pajak_mode") || "nominal") as import("./types").FeeMode, biayaAdminMode:(get("service_fee_mode", "biaya_admin_mode") || "nominal") as import("./types").FeeMode,
      bank:get("bank"), nomorRekening:get("nomor_rekening","rekening"), atasNama:get("atas_nama","an"),
      deposit:num("deposit"), depositInvoice:get("deposit_invoice"), jumlahDibayar:num("dibayar"), metodePembayaran:get("metode_pembayaran"), tanggalBayar:get("tanggal_bayar"), riwayatJSON:get("riwayat_pembayaran_json"), rekeningJSON:get("rekening_bank_json") };
  });
}

export function csvRowsToInvoiceData(rows: CSVRow[]): InvoiceData[] {
  // Group rows by nomorInvoice
  const grouped = new Map<string, CSVRow[]>();
  for (const row of rows) {
    if (!grouped.has(row.nomorInvoice)) {
      grouped.set(row.nomorInvoice, []);
    }
    grouped.get(row.nomorInvoice)!.push(row);
  }

  const invoices: InvoiceData[] = [];

  for (const [nomorInvoice, itemRows] of grouped) {
    const first = itemRows[0];
    for (const row of itemRows) {
      for (const field of ["deposit", "depositInvoice", "tanggal", "namaCustomer", "referensi", "diskon", "pajak", "biayaAdmin", "diskonMode", "pajakMode", "biayaAdminMode", "jumlahDibayar", "riwayatJSON", "rekeningJSON"] as const) {
        if (row[field] !== first[field]) throw new Error(`Data invoice ${nomorInvoice} tidak konsisten pada kolom ${field}`);
      }
    }
    const items = itemRows.map((row) => ({
      id: crypto.randomUUID(),
      deskripsi: row.itemDeskripsi,
      subDeskripsi: row.itemSubDeskripsi,
      qty: row.itemQty,
      hargaSatuan: row.itemHargaSatuan,
      jumlah: row.itemQty * row.itemHargaSatuan,
    }));

    const banks = [];
    if (first.bank && first.nomorRekening) {
      banks.push({
        id: crypto.randomUUID(),
        bank: first.bank,
        nomorRekening: first.nomorRekening,
        atasNama: first.atasNama || "PT BERANDA HARAMAIN DIGITAL",
      });
    }

    invoices.push(validateInvoice({
      nomorInvoice,
      tanggal: first.tanggal || tanggalHariIni(),
      referensi: first.referensi,
      namaCustomer: first.namaCustomer || "Customer",
      dicetakPada: "",
      items,
      rekeningBank: first.rekeningJSON ? JSON.parse(first.rekeningJSON) : banks,
      metodePembayaran: first.metodePembayaran || "Transfer Bank",
      tanggalBayar: first.tanggalBayar || "",
      deposit: first.deposit ?? 0,
      depositInvoice: first.depositInvoice || "",
      jumlahDibayar: first.jumlahDibayar ?? 0,
      diskon: first.diskon || 0,
      diskonMode: first.diskonMode,
      pajakMode: first.pajakMode,
      biayaAdminMode: first.biayaAdminMode,
      pajak: first.pajak || 0,
      biayaAdmin: first.biayaAdmin || 0,
      riwayatPembayaran: first.riwayatJSON ? JSON.parse(first.riwayatJSON) : undefined,
    }));
  }

  return invoices;
}

export const CSV_HEADERS = ["nomor_invoice","tanggal","nama_customer","referensi","item_deskripsi","item_sub_deskripsi","item_qty","item_harga_satuan","diskon","tax","service_fee","dibayar","metode_pembayaran","tanggal_bayar","riwayat_pembayaran_json","rekening_bank_json","diskon_mode","tax_mode","service_fee_mode","total","status","deposit","deposit_invoice"] as const;

export function exportCSV(invoices: InvoiceHistoryItem[]): string {
  const headers = CSV_HEADERS;
  const escape = (value: unknown) => '"' + String(value ?? "").replace(/"/g, '""') + '"';
  const rows = [headers.join(",")];
  for (const inv of invoices) for (const item of inv.data.items) {
    const d = inv.data;
    rows.push([d.nomorInvoice,d.tanggal,d.namaCustomer,d.referensi,item.deskripsi,item.subDeskripsi,item.qty !== undefined && item.hargaSatuan !== undefined ? item.qty : 1,item.qty !== undefined && item.hargaSatuan !== undefined ? item.hargaSatuan : item.jumlah,d.diskon ?? 0,d.pajak ?? 0,d.biayaAdmin ?? 0,hitungDibayar(d),d.metodePembayaran,d.tanggalBayar,d.riwayatPembayaran === undefined ? "" : JSON.stringify(d.riwayatPembayaran),JSON.stringify(d.rekeningBank),d.diskonMode ?? "nominal",d.pajakMode ?? "nominal",d.biayaAdminMode ?? "nominal",hitungBiaya(d).total,statusPembayaran(d),d.deposit ?? 0,d.depositInvoice ?? ""].map(escape).join(","));
  }
  return "\uFEFF" + rows.join("\r\n");
}

// The downloadable template uses the same serializer and columns as history exports.
export function createCSVTemplate(): string {
  const example: InvoiceData = {
    nomorInvoice: "INV-30092026-0001", tanggal: "2026-09-30", namaCustomer: "Customer Contoh", referensi: "REF-CONTOH-001",
    items: [
      {id: "item-1", deskripsi: "Paket Umroh 9 Hari", subDeskripsi: "Hotel Bintang 4", qty: 1, hargaSatuan: 15000000, jumlah: 15000000},
      {id: "item-2", deskripsi: "City Tour Al-Ula", subDeskripsi: "Tiket Masuk", qty: 2, hargaSatuan: 690000, jumlah: 1380000},
    ],
    rekeningBank: [
      {id:"bank-mandiri", bank:"Mandiri", nomorRekening:"ISI_NOMOR_REKENING_MANDIRI", atasNama:"ISI_NAMA_PEMILIK_REKENING"},
      {id:"bank-bni", bank:"BNI", nomorRekening:"ISI_NOMOR_REKENING_BNI", atasNama:"ISI_NAMA_PEMILIK_REKENING"},
    ],
    metodePembayaran: "Transfer Bank", tanggalBayar: "2026-09-30", jumlahDibayar: 0,
    riwayatPembayaran: [
      {tanggal:"2026-09-30", metode:"Transfer Bank", bank:"Mandiri", jumlah:4500000},
      {tanggal:"2026-09-30", metode:"Transfer Bank", bank:"BNI", jumlah:500000},
    ],
    diskon:10, diskonMode:"percent", pajak:11, pajakMode:"percent", biayaAdmin:100000, biayaAdminMode:"nominal",
  };
  const cash: InvoiceData = {...example, nomorInvoice:"INV-30092026-0002", namaCustomer:"Customer Cash Contoh", referensi:"REF-CONTOH-002",
    items:[{id:"item-cash", deskripsi:"Handling Umroh", qty:1, hargaSatuan:1500000, jumlah:1500000}], rekeningBank:[],
    diskon:0, diskonMode:"nominal", pajak:0, pajakMode:"nominal", biayaAdmin:0, biayaAdminMode:"nominal",
    metodePembayaran:"Cash", riwayatPembayaran:[{tanggal:"2026-09-30", metode:"Cash", jumlah:500000}],
  };
  return exportCSV([example,cash].map((data,index) => {
    const total = hitungBiaya(data).total, dibayar = hitungDibayar(data);
    return {id:`template-${index}`, nomorInvoice:data.nomorInvoice, namaCustomer:data.namaCustomer, tanggal:data.tanggal, total, dibayar, status:statusPembayaran(data), dicetakPada:"", data};
  }));
}

export function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── JSON IMPORT / EXPORT (existing) ──

export function exportJSON(data: InvoiceData) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${data.nomorInvoice}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importJSON(file: File): Promise<InvoiceData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(validateInvoice(JSON.parse(reader.result as string)));
      } catch {
        reject(new Error("JSON atau struktur invoice tidak valid"));
      }
    };
    reader.onerror = () => reject(new Error("File tidak dapat dibaca"));
    reader.readAsText(file);
  });
}
