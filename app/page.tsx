"use client";
import { hitungBiaya, labelPembayaran } from "./utils";

import { hitungDibayar, tanggalHariIni } from "./utils";

import { useEffect, useRef, useState } from "react";
import Invoice from "./Invoice";
import Kwitansi from "./Kwitansi";
import InvoiceForm from "./InvoiceForm";
import { DEFAULT_BANKS, DEFAULT_ITEMS } from "./constants";
import { suggestCloudNumber, databaseError } from "./database";
import DatabaseAccess from "./DatabaseAccess";
import { loadInvoice, saveInvoice } from "./storage";
import type { InvoiceData } from "./types";
import "./globals.css";

const today = () => tanggalHariIni();
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
  riwayatPembayaran: [],
});

export default function Home() {
  return <DatabaseAccess>{userId => <InvoiceWorkspace key={userId} userId={userId} />}</DatabaseAccess>;
}

function InvoiceWorkspace({userId}: {userId: string}) {
  const invoiceRef = useRef<HTMLDivElement>(null!);
  const kwitansiRef = useRef<HTMLDivElement>(null!);
  const [data, setData] = useState<InvoiceData>(createDefaultInvoice);
  const [storageError, setStorageError] = useState("");
  const [draftError, setDraftError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  /* ── INIT & LOAD ─────────────────────────── */

  useEffect(() => {
    let active = true;
    const initialize = async () => {
      try {
        const saved = loadInvoice(userId);
        const tgl = saved?.tanggal || today();
        const number = saved?.nomorInvoice.trim() || await suggestCloudNumber(tgl);
        if (!active) return;
        setData(saved ? {...saved, nomorInvoice: number} : {
          ...createDefaultInvoice(), nomorInvoice: number, tanggal: tgl, tanggalBayar: tgl, dicetakPada: now(),
        });
      } catch(e) {
        if (!active) return;
        setStorageError(databaseError(e));
        const tgl = today();
        setData({...createDefaultInvoice(), tanggal: tgl, tanggalBayar: tgl});
      }
      if (active) setLoaded(true);
    };
    void initialize();
    return () => {active = false;};
  }, [userId]);

  /* ── AUTO SAVE ───────────────────────────── */

  useEffect(() => {
    if (!loaded) return;
    try { saveInvoice(data, userId); setDraftError(""); }
    catch { setDraftError("Draft belum tersimpan. Penyimpanan browser penuh atau tidak tersedia; unduh cadangan JSON."); }
  }, [data, loaded, userId]);

  if (!mounted) {
    return (
      <div className="page-shell">
        <aside className="form-panel no-print" />
        <main className="preview-panel" />
      </div>
    );
  }

  // Calculate status for conditional kwitansi display
  const {total} = hitungBiaya(data);
  const dibayar = hitungDibayar(data);
  const isLunas = dibayar >= total && total > 0;

  return (
    <div className="page-shell">
      <aside className="form-container no-print">
        {storageError && <p role="alert">{storageError}</p>}
        {draftError && <p role="alert">{draftError}</p>}
        <p className="hint">Draft tersimpan di browser. Gunakan Simpan INV atau Download PDF untuk menyimpan ke database.</p>
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
