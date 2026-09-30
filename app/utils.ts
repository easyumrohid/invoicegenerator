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
  if (isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("id-ID", {
    timeZone: /^\d{4}-\d{2}-\d{2}$/.test(iso) ? "UTC" : "Asia/Jakarta",
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
    timeZone: "Asia/Jakarta",
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
  const n = Number(value);
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);
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
    (t, i) => t + (Number(i.jumlah) || 0),
    0
  );
}

export function hitungTotal(
  subtotal: number,
  diskon = 0,
  pajak = 0,
  admin = 0
) {
  return Math.max(0,
    (Number(subtotal) || 0) -
    (Number(diskon) || 0) +
    (Number(pajak) || 0) +
    (Number(admin) || 0)
  );
}

export function statusInvoice(
  total: number,
  dibayar: number
) {
  if (total <= 0 || dibayar <= 0)
    return "BELUM_DIBAYAR";

  if (dibayar < total)
    return "SEBAGIAN";

  return "LUNAS";
}

// Nomor invoice mengikuti daftar riwayat; tidak menggunakan counter terpisah.
// Format: INV-DDMMYYYY-XXXX, memilih urutan terkecil yang belum ada.

export function tanggalHariIni(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function hitungDibayar(data: import("./types").InvoiceData): number {
  return data.riwayatPembayaran !== undefined
    ? data.riwayatPembayaran.reduce((sum, p) => sum + p.jumlah, 0)
    : data.jumlahDibayar;
}

export function nextAvailableInvoiceNumber(tanggal = tanggalHariIni()): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal) || !Number.isFinite(Date.parse(tanggal)) || new Date(tanggal).toISOString().slice(0,10) !== tanggal) throw new Error("Tanggal invoice tidak valid");
  const [y, m, d] = tanggal.split("-");
  const prefix = `INV-${d}${m}${y}-`;
  const used = new Set<number>();
  if (typeof window !== "undefined") {
    // Jangan menebak nomor kosong saat riwayat tidak dapat dibaca.
    const history: unknown = JSON.parse(localStorage.getItem("easyumroh_invoices_history") || "[]");
    if (!Array.isArray(history)) throw new Error("Daftar invoice tidak valid");
    for (const entry of history) {
      const nomor = entry?.nomorInvoice;
      if (typeof nomor !== "string" || !nomor.startsWith(prefix)) continue;
      const suffix = nomor.slice(prefix.length);
      const sequence = Number(suffix);
      if (/^\d+$/.test(suffix) && Number.isSafeInteger(sequence) && sequence > 0) used.add(sequence);
    }
  }
  let next = 1;
  while (used.has(next)) next++;
  return `${prefix}${String(next).padStart(4, "0")}`;
}

// Alias untuk integrasi dengan pemanggil versi sebelumnya.
export const generateInvoiceNumber = nextAvailableInvoiceNumber;
export const resetInvoiceNumber = nextAvailableInvoiceNumber;

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
  if (n < 12) return angka[n] ?? "";
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
  const n = Number(nilai);

  // Guard: NaN / Infinity / undefined tidak boleh membunuh render
  if (!Number.isFinite(n)) return "Nol Rupiah";

  // Bulatkan agar nilai desimal (mis. 1.5) tidak menghasilkan undefined
  const bulat = Math.round(Math.abs(n));
  if (bulat === 0) return "Nol Rupiah";

  const hasil = `${penyebut(bulat) ?? ""}`
    .replace(/\s+/g, " ")
    .trim();

  return `${n < 0 ? "Minus " : ""}${hasil} Rupiah`;
}


export function hitungBiaya(data: import("./types").InvoiceData) {
  const subtotal = hitungSubtotal(data.items);
  const nominal = (value: number | undefined, mode: import("./types").FeeMode | undefined, base: number) => Math.round(mode === "percent" ? base * (value ?? 0) / 100 : (value ?? 0));
  const diskon = nominal(data.diskon, data.diskonMode, subtotal);
  const dasar = Math.max(0, subtotal - diskon);
  const tax = nominal(data.pajak, data.pajakMode, dasar);
  const serviceFee = nominal(data.biayaAdmin, data.biayaAdminMode, dasar);
  return {subtotal, diskon, tax, serviceFee, total: dasar + tax + serviceFee};
}

export function labelPembayaran(p: {metode: string; bank?: string}): string {
  if (/^(cash|tunai)$/i.test(p.metode.trim())) return "Cash";
  return p.bank?.trim() || p.metode?.trim() || "Belum ditentukan";
}

export function ringkasanPembayaran(invoices: import("./types").InvoiceData[]) {
  const totals = {Mandiri: 0, BNI: 0, Cash: 0, Lainnya: 0};
  for (const d of invoices) {
    const payments = d.riwayatPembayaran !== undefined ? d.riwayatPembayaran : [{metode:d.metodePembayaran, jumlah:d.jumlahDibayar}];
    for (const p of payments) {
      const label = labelPembayaran(p).toLowerCase();
      const key = label === "mandiri" ? "Mandiri" : label === "bni" ? "BNI" : label === "cash" ? "Cash" : "Lainnya";
      totals[key] += p.jumlah;
    }
  }
  return totals;
}

export function tanggalDalamRentang(tanggal: string, dari = "", sampai = "") {
  return (!dari || tanggal >= dari) && (!sampai || tanggal <= sampai);
}

export function pembayaranUntukCicilan(data: import("./types").InvoiceData): import("./types").RiwayatPembayaran[] {
  if (data.riwayatPembayaran !== undefined) return data.riwayatPembayaran;
  if (data.jumlahDibayar <= 0) return [];
  return [{tanggal: data.tanggalBayar || data.tanggal, metode: data.metodePembayaran, jumlah: data.jumlahDibayar}];
}
