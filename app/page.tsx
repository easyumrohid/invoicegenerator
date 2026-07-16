"use client";

import { useEffect, useRef, useState } from "react";
import Invoice from "./Invoice";
import Kwitansi from "./Kwitansi";
import InvoiceForm from "./InvoiceForm";
import { DEFAULT_BANKS, DEFAULT_ITEMS } from "./constants";
import { generateInvoiceNumber } from "./utils";
import { loadInvoice, saveInvoice } from "./storage";
import type { InvoiceData } from "./types";
import "./globals.css";

const today = () => new Date().toISOString().slice(0, 10);
const now = () => new Date().toISOString();

const createDefaultInvoice = (): InvoiceData => ({
  nomorInvoice: "",
  tanggal: "",
  referensi: "",
  namaCustomer: "Shukron Fauzi",
  dicetakPada: "",
  items: DEFAULT_ITEMS.map((item) => ({ ...item })),
  rekeningBank: DEFAULT_BANKS.map((bank) => ({ ...bank })),
  metodePembayaran: "Transfer Bank",
  tanggalBayar: "",
  jumlahDibayar: 0,
  diskon: 0,
  pajak: 0,
  biayaAdmin: 0,
  riwayatPembayaran: [
    {
      tanggal: "2026-07-08",
      metode: "Transfer Bank",
      bank: "Mandiri",
      jumlah: 1000000,
    },
    {
      tanggal: "2026-07-09",
      metode: "Transfer Bank",
      bank: "BNI",
      jumlah: 500000,
    },
  ],
});

export default function Home() {
  const invoiceRef = useRef<HTMLDivElement>(null!);
  const kwitansiRef = useRef<HTMLDivElement>(null!);
  const [data, setData] = useState<InvoiceData>(createDefaultInvoice);
  const [loaded, setLoaded] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  /* ── INIT & LOAD ─────────────────────────── */

  useEffect(() => {
    try {
      const saved = loadInvoice();
      if (saved) {
        const defaultData = createDefaultInvoice();
        setData({
          ...saved,
          riwayatPembayaran: saved.riwayatPembayaran || defaultData.riwayatPembayaran,
          rekeningBank: saved.rekeningBank?.length >= 2
            ? saved.rekeningBank
            : defaultData.rekeningBank,
        });
      } else {
        const tgl = today();
        setData({
          ...createDefaultInvoice(),
          nomorInvoice: generateInvoiceNumber(tgl),
          tanggal: tgl,
          tanggalBayar: tgl,
          dicetakPada: now(),
        });
      }
    } catch {
      console.warn("Gagal memuat data tersimpan.");
      const tgl = today();
      const defaultData = createDefaultInvoice();
      setData({
        ...defaultData,
        nomorInvoice: generateInvoiceNumber(tgl),
        tanggal: tgl,
        tanggalBayar: tgl,
        dicetakPada: now(),
      });
    }
    setLoaded(true);
  }, []);

  /* ── AUTO SAVE ───────────────────────────── */

  useEffect(() => {
    if (!loaded) return;
    saveInvoice(data);
  }, [data, loaded]);

  /* ── AUTO REGENERATE INVOICE NUMBER ON DATE CHANGE ── */
  useEffect(() => {
    if (!loaded || !data.tanggal) return;
    // If nomorInvoice is empty or doesn't match the current date, regenerate
    // Format nomor: INV-DDMMYYYY-XXXX (sesuai generateInvoiceNumber)
    const d = new Date(data.tanggal);
    const expectedPrefix = `INV-${String(d.getDate()).padStart(2, "0")}${String(
      d.getMonth() + 1
    ).padStart(2, "0")}${d.getFullYear()}`;
    if (!data.nomorInvoice || !data.nomorInvoice.startsWith(expectedPrefix)) {
      setData((prev) => ({
        ...prev,
        nomorInvoice: generateInvoiceNumber(prev.tanggal),
      }));
    }
  }, [data.tanggal, loaded]);

  if (!mounted) {
    return (
      <div className="page-shell">
        <aside className="form-panel no-print" />
        <main className="preview-panel" />
      </div>
    );
  }

  // Calculate status for conditional kwitansi display
  const subtotal = data.items.reduce((t, i) => t + i.jumlah, 0);
  const total = subtotal - (data.diskon ?? 0) + (data.pajak ?? 0) + (data.biayaAdmin ?? 0);
  const dibayar = data.riwayatPembayaran
    ? data.riwayatPembayaran.reduce((acc, curr) => acc + (Number(curr.jumlah) || 0), 0)
    : (Number(data.jumlahDibayar) || 0);
  const isLunas = dibayar >= total && total > 0;

  return (
    <div className="page-shell">
      <aside className="form-panel no-print">
        <InvoiceForm
          data={data}
          setData={setData}
          invoiceRef={invoiceRef}
          kwitansiRef={kwitansiRef}
          isLunas={isLunas}
        />
      </aside>

      <main className="preview-panel">
        <div className="preview-stack">
          <Invoice ref={invoiceRef} data={data} />
          <div className={`kwitansi-wrapper ${isLunas ? "" : "kwitansi-hidden"}`}>
            <Kwitansi ref={kwitansiRef} data={data} />
          </div>
        </div>
      </main>
    </div>
  );
}
