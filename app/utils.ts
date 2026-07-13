const bulan = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

export function formatTanggal(
  iso?: string
) {
  if (!iso) return "-";

  const date = new Date(iso);

  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatDicetak(
  iso?: string
) {
  const date = iso
    ? new Date(iso)
    : new Date();

  return date.toLocaleString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function rupiah(
  value: number
) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function rekening(
  nomor: string
) {
  return nomor.replace(
    /(\d{4})(?=\d)/g,
    "$1 "
  );
}

export function hitungSubtotal(
  items: {
    jumlah: number;
  }[]
) {
  return items.reduce(
    (t, i) => t + i.jumlah,
    0
  );
}

export function hitungTotal(
  subtotal: number,
  diskon = 0,
  pajak = 0,
  admin = 0
) {
  return subtotal - diskon + pajak + admin;
}

export function statusInvoice(
  total: number,
  dibayar: number
) {
  if (dibayar <= 0)
    return "BELUM_DIBAYAR";

  if (dibayar < total)
    return "SEBAGIAN";

  return "LUNAS";
}

// ── INVOICE NUMBER GENERATOR ──
// Format: INV-DDMMYYYY-XXXX (sequential per day)

const INVOICE_COUNTER_KEY = "easyumroh_invoice_counter";

function getCounterForDate(dateStr: string): number {
  if (typeof window === "undefined") return 1;
  const stored = localStorage.getItem(INVOICE_COUNTER_KEY);
  if (!stored) return 1;
  try {
    const { date, count } = JSON.parse(stored);
    if (date === dateStr) return count + 1;
    return 1; // new day, reset counter
  } catch {
    return 1;
  }
}

function saveCounter(dateStr: string, count: number) {
  if (typeof window === "undefined") return;
  localStorage.setItem(INVOICE_COUNTER_KEY, JSON.stringify({ date: dateStr, count }));
}

export function generateInvoiceNumber(tanggal?: string) {
  const date = tanggal ? new Date(tanggal) : new Date();
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  const dateStr = `${d}${m}${y}`;

  const counter = getCounterForDate(dateStr);
  saveCounter(dateStr, counter);

  return `INV-${dateStr}-${String(counter).padStart(4, "0")}`;
}

export function generateKwitansiNumber(invoiceNumber: string): string {
  return invoiceNumber.replace("INV-", "KWT-");
}

const angka = [
  "",
  "Satu",
  "Dua",
  "Tiga",
  "Empat",
  "Lima",
  "Enam",
  "Tujuh",
  "Delapan",
  "Sembilan",
  "Sepuluh",
  "Sebelas",
];

function penyebut(n: number): string {
  if (n < 12) return angka[n];
  if (n < 20) return `${penyebut(n - 10)} Belas`;
  if (n < 100)
    return `${penyebut(Math.floor(n / 10))} Puluh ${penyebut(n % 10)}`;
  if (n < 200)
    return `Seratus ${penyebut(n - 100)}`;
  if (n < 1000)
    return `${penyebut(Math.floor(n / 100))} Ratus ${penyebut(n % 100)}`;
  if (n < 2000)
    return `Seribu ${penyebut(n - 1000)}`;
  if (n < 1000000)
    return `${penyebut(Math.floor(n / 1000))} Ribu ${penyebut(n % 1000)}`;
  if (n < 1000000000)
    return `${penyebut(Math.floor(n / 1000000))} Juta ${penyebut(
      n % 1000000
    )}`;
  if (n < 1000000000000)
    return `${penyebut(Math.floor(n / 1000000000))} Miliar ${penyebut(
      n % 1000000000
    )}`;

  return `${penyebut(Math.floor(n / 1000000000000))} Triliun ${penyebut(
    n % 1000000000000
  )}`;
}

export function terbilang(nilai: number) {
  if (nilai === 0) return "Nol Rupiah";

  return `${penyebut(nilai)
    .replace(/\s+/g, " ")
    .trim()} Rupiah`;
}
