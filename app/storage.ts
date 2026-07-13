import { InvoiceData } from "./types";

const STORAGE_KEY = "easyumroh_invoice";
const HISTORY_KEY = "easyumroh_invoices_history";

// ── SINGLE INVOICE (current behavior, for draft/editing) ──

export function saveInvoice(data: InvoiceData) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function loadInvoice(): InvoiceData | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
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

  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 100))); // max 100 records
}

export function loadHistory(): InvoiceHistoryItem[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(HISTORY_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
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
  pajak?: number;
  biayaAdmin?: number;
  bank?: string;
  nomorRekening?: string;
  atasNama?: string;
}

export function parseCSV(text: string): CSVRow[] {
  const lines = text.trim().split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/"/g, ""));
  const rows: CSVRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length < 6) continue;

    const get = (name: string) => {
      const idx = headers.indexOf(name.toLowerCase());
      return idx >= 0 ? values[idx]?.trim() || "" : "";
    };

    rows.push({
      nomorInvoice: get("nomor_invoice") || get("no_invoice") || get("invoice"),
      tanggal: get("tanggal") || get("date"),
      namaCustomer: get("nama_customer") || get("customer") || get("nama"),
      referensi: get("referensi") || get("ref"),
      itemDeskripsi: get("item_deskripsi") || get("deskripsi") || get("item"),
      itemSubDeskripsi: get("item_sub_deskripsi") || get("sub_deskripsi"),
      itemQty: parseFloat(get("item_qty") || get("qty")) || 1,
      itemHargaSatuan: parseFloat(get("item_harga_satuan") || get("harga") || get("harga_satuan")) || 0,
      diskon: parseFloat(get("diskon")) || 0,
      pajak: parseFloat(get("pajak")) || 0,
      biayaAdmin: parseFloat(get("biaya_admin") || get("admin")) || 0,
      bank: get("bank") || "Mandiri",
      nomorRekening: get("nomor_rekening") || get("rekening"),
      atasNama: get("atas_nama") || get("an"),
    });
  }

  return rows;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
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

    invoices.push({
      nomorInvoice,
      tanggal: first.tanggal || new Date().toISOString().slice(0, 10),
      referensi: first.referensi,
      namaCustomer: first.namaCustomer || "Customer",
      dicetakPada: "",
      items,
      rekeningBank: banks.length > 0 ? banks : [],
      metodePembayaran: "Transfer Bank",
      tanggalBayar: "",
      jumlahDibayar: 0,
      diskon: first.diskon || 0,
      pajak: first.pajak || 0,
      biayaAdmin: first.biayaAdmin || 0,
      riwayatPembayaran: [],
    });
  }

  return invoices;
}

export function exportCSV(invoices: InvoiceHistoryItem[]): string {
  const headers = [
    "Nomor Invoice", "Tanggal", "Nama Customer", "Referensi",
    "Item Deskripsi", "Item Sub Deskripsi", "Item Qty", "Item Harga Satuan",
    "Diskon", "Pajak", "Biaya Admin", "Total", "Dibayar", "Status"
  ];

  const rows: string[] = [headers.join(",")];

  for (const inv of invoices) {
    for (const item of inv.data.items) {
      rows.push([
        `"${inv.nomorInvoice}"`,
        `"${inv.tanggal}"`,
        `"${inv.namaCustomer}"`,
        `"${inv.data.referensi || ""}"`,
        `"${item.deskripsi}"`,
        `"${item.subDeskripsi || ""}"`,
        item.qty,
        item.hargaSatuan,
        inv.data.diskon || 0,
        inv.data.pajak || 0,
        inv.data.biayaAdmin || 0,
        inv.total,
        inv.dibayar,
        `"${inv.status}"`,
      ].join(","));
    }
  }

  return rows.join("\n");
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
        resolve(JSON.parse(reader.result as string));
      } catch {
        reject("JSON tidak valid");
      }
    };
    reader.readAsText(file);
  });
}
