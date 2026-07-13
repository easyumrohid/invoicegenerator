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

  pajak?: number;

  biayaAdmin?: number;

  // 2. Tambahkan properti array cicilan (opsional agar tidak error pada data lama)
  riwayatPembayaran?: RiwayatPembayaran[];
}