import { CompanyInfo } from "./types";

export const COMPANY: CompanyInfo = {
  nama: "PT Beranda Haramain Digital",

  tagline: "Jalan Mudah Menuju Baitullah",

  alamat:
    "Jl. Hasanuddin No.44B, Kel. Celep, Kab. Sidoarjo, Jawa Timur",

  website: "https://easyumroh.id",

  email: "info@easyumroh.id",

  telepon: "+62 811-111-8455",
};

export const DEFAULT_BANKS = [
  {
    id: crypto.randomUUID(),
    bank: "Mandiri",
    nomorRekening: "1410042A111112",
    atasNama: "PT BERANDA HARAMAIN DIGITAL",
  },
  {
    id: crypto.randomUUID(),
    bank: "BNI",
    nomorRekening: "5111117474",
    atasNama: "PT BERANDA HARAMAIN DIGITAL",
  },
];

export const DEFAULT_ITEMS = [
  {
    id: crypto.randomUUID(),
    deskripsi: "",
    subDeskripsi: "",
    qty: 1,
    hargaSatuan: 0,
    jumlah: 0,
  },
];

export const BANK_OPTIONS = ["Mandiri", "BNI"] as const;
