export type FeeMode = "nominal" | "percent";
export interface InvoiceItem {
  id: string;
  deskripsi: string;
  subDeskripsi?: string;
  qty?: number;
  hargaSatuan?: number;
  jumlah: number;
}

export interface BankAccount {
  id: string;
  bank: string;
  nomorRekening: string;
  atasNama: string;
}

export interface CompanyInfo {
  nama: string;
  tagline: string;
  alamat: string;
  website: string;
  email: string;
  telepon: string;
}

// 1. Tambahan baru untuk tipe data riwayat cicilan
export interface RiwayatPembayaran {
  tanggal: string | Date;
  metode: string;
  bank?: string; // Opsional, contoh: "Mandiri", "BNI"
  jumlah: number;
}

export interface InvoiceData {
  deposit?: number; // Kredit dari kelebihan pembayaran invoice sebelumnya.
  depositInvoice?: string; // Nomor invoice sumber deposit.
  recordId?: string; // ID database; tetap sama saat mengedit invoice.
  recordVersion?: string; // Mencegah perubahan perangkat lain tertimpa.
  nomorInvoice: string;
  tanggal: string;
  referensi?: string;

  namaCustomer: string;

  dicetakPada?: string;

  items: InvoiceItem[];

  rekeningBank: BankAccount[];

  metodePembayaran: string;

  tanggalBayar: string;

  jumlahDibayar: number;

  diskon?: number;
  diskonMode?: FeeMode;

  pajak?: number;
  pajakMode?: FeeMode;

  biayaAdmin?: number;
  biayaAdminMode?: FeeMode;

  // 2. Tambahkan properti array cicilan (opsional agar tidak error pada data lama)
  riwayatPembayaran?: RiwayatPembayaran[];
}