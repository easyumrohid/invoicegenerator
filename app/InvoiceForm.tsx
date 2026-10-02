"use client";
import { hitungBiaya, labelPembayaran, pembayaranUntukCicilan } from "./utils";

import { hitungDibayar, tanggalHariIni } from "./utils";

import React, { useState, useLayoutEffect } from "react";
import "@/app/invoice-form.css";
import { exportPDF, exportKwitansiPDF } from "./pdf";
import { BANK_OPTIONS } from "./constants";
import { generateKwitansiNumber } from "./utils";
import { exportJSON } from "./storage";
import { suggestCloudNumber, saveCloudInvoice, importCloudInvoices, databaseError } from "./database";
import { useRef } from "react";
import type { InvoiceData } from "./types";
import { statusInvoice } from "./utils";
import CSVUpload from "./CSVUpload";
import InvoiceHistory from "./InvoiceHistory";
import type { InvoiceHistoryItem } from "./storage";

type Props = {
  data: InvoiceData;
  setData: (data: InvoiceData) => void;
  invoiceRef: React.RefObject<HTMLDivElement | null>;
  kwitansiRef?: React.RefObject<HTMLDivElement | null>;
  isLunas?: boolean;
};

export default function InvoiceForm({ data, setData, invoiceRef, kwitansiRef, isLunas }: Props) {
  const [showCSV, setShowCSV] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const pendingScroll = useRef<{panel: number; window: number} | null>(null);
  const rememberScroll = () => {
    pendingScroll.current = {panel: panelRef.current?.scrollTop ?? 0, window: window.scrollY};
  };
  useLayoutEffect(() => {
    const position = pendingScroll.current;
    if (!position) return;
    pendingScroll.current = null;
    if (panelRef.current) panelRef.current.scrollTop = position.panel;
    window.scrollTo({top: position.window, behavior: "instant"});
  }, [data]);
  const numberRequest = useRef(0);
  const dataRef = useRef(data);
  dataRef.current = data;
  const [isResetting, setIsResetting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  // --- HANDLER INPUT DASAR ---
  const handleChange = (field: keyof InvoiceData, value: string | number) => {
    if (field === "nomorInvoice") numberRequest.current++;
    if (field === "tanggal" && !data.recordId) {
      const request = ++numberRequest.current;
      setData({...data, tanggal: String(value), nomorInvoice: ""});
      if (!value) return;
      void suggestCloudNumber(String(value)).then(number => {
        if (request === numberRequest.current) setData({...dataRef.current, nomorInvoice: number});
      }).catch(e => alert(databaseError(e)));
      return;
    }
    setData({ ...data, [field]: value });
  };

  // --- HELPER INPUT ANGKA ---
  // Hanya izinkan digit 0-9: karakter "-", ".", "e" tidak bisa masuk,
  // sehingga nilai negatif/desimal/NaN tidak pernah tercipta saat mengedit.
  const onlyDigits = (v: string) => v.replace(/[^\d]/g, "");
  const parseAngka = (v: string) => {
    const digits = onlyDigits(v);
    return digits === "" ? 0 : Math.min(Number(digits), 1_000_000_000_000);
  };

  // --- HANDLER ITEMS ---
  const tambahItem = () => {
    const newItem = {
      id: crypto.randomUUID(),
      deskripsi: "",
      qty: 1,
      hargaSatuan: 0,
      jumlah: 0,
    };
    setData({ ...data, items: [...data.items, newItem] });
  };

  const updateItem = (index: number, field: string, value: string | number) => {
    const newItems = [...data.items];
    const item = { ...newItems[index], [field]: value };
    if (field === "qty" || field === "hargaSatuan") {
      item.jumlah = (Number(item.qty) || 0) * (Number(item.hargaSatuan) || 0);
      if (item.jumlah > 1e12) { alert("Jumlah item maksimal Rp1 triliun."); return; }
    }
    newItems[index] = item;
    setData({ ...data, items: newItems });
  };

  const hapusItem = (index: number) => {
    const newItems = [...data.items];
    newItems.splice(index, 1);
    setData({ ...data, items: newItems });
  };

  // --- HANDLER RIWAYAT PEMBAYARAN (CICILAN) ---
  const tambahPembayaran = () => {
    rememberScroll();
    const newItem = {
      tanggal: tanggalHariIni(),
      metode: "Transfer Bank",
      bank: "Mandiri",
      jumlah: 0,
    };
    setData({ ...data, jumlahDibayar: 0, riwayatPembayaran: [...pembayaranUntukCicilan(data), newItem] });
  };

  const updatePembayaran = (index: number, field: string, value: string | number) => {
    const newRiwayat = [...(data.riwayatPembayaran || [])];
    if (field === "jenisPembayaran") {
      newRiwayat[index] = {...newRiwayat[index], metode: value === "Cash" ? "Cash" : "Transfer Bank", bank: value === "Cash" ? undefined : String(value)};
    } else newRiwayat[index] = { ...newRiwayat[index], [field]: value };
    setData({ ...data, riwayatPembayaran: newRiwayat });
  };

  const hapusPembayaran = (index: number) => {
    rememberScroll();
    const newRiwayat = [...(data.riwayatPembayaran || [])];
    newRiwayat.splice(index, 1);
    setData({ ...data, riwayatPembayaran: newRiwayat });
  };

  const persistInvoice = async () => {
    if (!data.nomorInvoice.trim() || !data.tanggal || !data.namaCustomer.trim() || data.items.length === 0 || data.items.some(item => !item.deskripsi.trim())) {
      throw new Error("Isi nomor invoice, tanggal, nama customer, dan minimal satu item dengan deskripsi.");
    }
    const saved = await saveCloudInvoice({...data, dicetakPada: new Date().toISOString()});
    setData(saved);
    return saved;
  };
  const handleSave = async () => {
    if (isSaving || isDownloading) return;
    setIsSaving(true); setSaveMessage("");
    try { await persistInvoice(); setSaveMessage("INV berhasil tersimpan di database."); }
    catch(e) {alert(e instanceof Error ? e.message : databaseError(e));}
    finally {setIsSaving(false);}
  };
  // Data disimpan lebih dulu agar PDF tidak beredar dengan nomor yang bertabrakan.
  const handleDownloadPDF = async () => {
    if (!invoiceRef.current || isDownloading || isSaving) return;
    setIsDownloading(true); setSaveMessage("");
    let stored = false;
    try {
      const saved = await persistInvoice(); stored = true;
      await new Promise(resolve => setTimeout(resolve, 200));
      await exportPDF(invoiceRef, `${saved.nomorInvoice}.pdf`);
      if (isLunas && kwitansiRef?.current) await exportKwitansiPDF(kwitansiRef, `${generateKwitansiNumber(saved.nomorInvoice)}.pdf`);
      setSaveMessage("INV tersimpan di database. PDF diunduh ke komputer.");
    } catch(e) {
      alert((stored ? "INV sudah tersimpan, tetapi unduhan PDF gagal. Coba unduh ulang. " : "INV belum tersimpan. ") + (e instanceof Error ? e.message : databaseError(e)));
    } finally {setIsDownloading(false);}
  };

  // --- HANDLER CLEAR ALL ---
  const handleClearAll = async () => {
    if (confirm("Kosongkan form untuk membuat INV baru? Riwayat dan catatan nomor tetap disimpan.")) {
      const tgl = tanggalHariIni();
      let nextNumber = "";
      numberRequest.current++;
      setIsResetting(true);
      try { nextNumber = await suggestCloudNumber(tgl); } catch(e) { alert(databaseError(e)); return; }
      finally {setIsResetting(false);}
      setSaveMessage("");
      setData({
        ...dataRef.current,
        recordId: undefined,
        recordVersion: undefined,
        nomorInvoice: nextNumber,
        tanggal: tgl,
        namaCustomer: "",
        referensi: "",
        dicetakPada: "",
        jumlahDibayar: 0,
        tanggalBayar: "",
        items: [{
          id: crypto.randomUUID(),
          deskripsi: "",
          subDeskripsi: "",
          qty: 1,
          hargaSatuan: 0,
          jumlah: 0,
        }],
        riwayatPembayaran: [],
        diskon: 0,
        pajak: 0,
        biayaAdmin: 0,
        diskonMode: "nominal",
        pajakMode: "nominal",
        biayaAdminMode: "nominal",
      });
    }
  };

  // --- HANDLER CSV IMPORT ---
  const handleCSVImport = async (invoices: InvoiceData[]) => {
    if (invoices.length > 0) {
      const saved = await importCloudInvoices(invoices);
      setData(saved[0].data);
      if (invoices.length > 1) {
        alert(`Berhasil import ${invoices.length} invoice. Menampilkan invoice pertama.`);
      }
    }
  };

  // --- HANDLER LOAD FROM HISTORY ---
  const handleLoadFromHistory = (historyItem: InvoiceHistoryItem) => {
    numberRequest.current++;
    setSaveMessage("");
    setData(historyItem.data);
    setShowHistory(false);
  };

  return (
    <div ref={panelRef} className="form-panel no-print">
    <fieldset disabled={isSaving || isDownloading || isResetting} style={{border:0, margin:0, padding:0, minWidth:0}}>
      <h1>Pengaturan Invoice</h1>
      <button type="button" disabled={isSaving || isDownloading} onClick={handleSave}>{isSaving ? "Menyimpan…" : "Simpan INV"}</button>
      {saveMessage && <p role="status">{saveMessage}</p>}
      <button type="button" onClick={() => exportJSON(data)}>Unduh Cadangan JSON</button>
      <p className="hint">Silakan ubah detail form di bawah, preview akan terupdate otomatis.</p>

      {/* ── AKSI CEPAT ───────────────────────────── */}
      <div className="section-title">Aksi Cepat</div>
      <div className="btn-group" style={{ marginBottom: "12px" }}>
        <button
          type="button"
          className="print-btn"
          onClick={() => setShowCSV(true)}
          style={{ background: "#f0f4ff", color: "#0d5bd7" }}
        >
          📁 Upload CSV
        </button>
        <button
          type="button"
          className="print-btn"
          onClick={() => setShowHistory(true)}
          style={{ background: "#e8f8ef", color: "#0f8a4d", borderColor: "#b8e6c8" }}
        >
          📋 Riwayat
        </button>
      </div>

      {/* ── INFO UTAMA ────────────────────────────── */}
      <div className="section-title">Info Invoice</div>

      <div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
        <label style={{ flex: 1 }}>
          Nomor Invoice
          <input
            type="text"
            readOnly={Boolean(data.recordId)}
            value={data.nomorInvoice}
            onChange={(e) => handleChange("nomorInvoice", e.target.value)}
          />
        </label>

      </div>

      <p className="hint">Nomor baru mengikuti daftar nomor yang belum pernah digunakan. Catatan nomor tetap ada setelah riwayat dihapus.</p>
      <div className="item-row-grid">
        <label>
          Tanggal
          <input
            type="date"
            value={data.tanggal}
            onChange={(e) => handleChange("tanggal", e.target.value)}
          />
        </label>
        <label>
          Referensi (Opsional)
          <input
            type="text"
            value={data.referensi || ""}
            onChange={(e) => handleChange("referensi", e.target.value)}
          />
        </label>
      </div>

      <div className="section-title">Pelanggan</div>
      <label>
        Ditagihkan Kepada (Nama Customer)
        <input
          type="text"
          value={data.namaCustomer}
          onChange={(e) => handleChange("namaCustomer", e.target.value)}
        />
      </label>

      {/* ── DAFTAR ITEM ───────────────────────────── */}
      <div className="section-title">Daftar Item</div>
      {data.items.map((item, index) => (
        <div key={item.id} className="item-row">
          <label>
            Deskripsi
            <input
              type="text"
              value={item.deskripsi}
              onChange={(e) => updateItem(index, "deskripsi", e.target.value)}
            />
          </label>

          <label>
            Sub-Deskripsi (Opsional)
            <textarea
              rows={4}
              value={item.subDeskripsi || ""}
              onChange={(e) => updateItem(index, "subDeskripsi", e.target.value)}
            />
          </label>

          <div className="item-row-grid">
            <label>
              Qty
              <input
                type="number"
                min="0"
                max="1000000000000"
                step="any"
                inputMode="decimal"
                value={item.qty ?? ""}
                onChange={(e) => {
                  const value = e.target.value.replace(",", ".");
                  if (/^\d*(?:\.\d*)?$/.test(value) && Number(value) <= 1e12) updateItem(index, "qty", Number(value));
                }}
              />
            </label>
            <label>
              Harga Satuan
              <input
                type="text"
                inputMode="numeric"
                value={item.hargaSatuan || ""}
                onChange={(e) => updateItem(index, "hargaSatuan", parseAngka(e.target.value))}
              />
            </label>
          </div>

          <button type="button" className="remove-btn" onClick={() => hapusItem(index)}>
            Hapus Item
          </button>
        </div>
      ))}
      <button type="button" className="add-btn" onClick={tambahItem}>
        + Tambah Item
      </button>

      {/* ── RIWAYAT PEMBAYARAN (CICILAN) ──────────── */}
      <div className="section-title">Riwayat Pembayaran (Cicilan)</div>

      {(data.riwayatPembayaran || []).map((bayar, index) => (
        <div key={index} className="item-row">
          <div className="item-row-grid">
            <label>
              Tanggal Pembayaran
              <input
                type="date"
                value={bayar.tanggal as string}
                onChange={(e) => updatePembayaran(index, "tanggal", e.target.value)}
              />
            </label>

            <label>
              Metode Pembayaran
              <select
                value={labelPembayaran(bayar)}
                onChange={(e) => updatePembayaran(index, "jenisPembayaran", e.target.value)}
              >
                {!["Mandiri", "BNI", "Cash"].includes(labelPembayaran(bayar)) && <option value={labelPembayaran(bayar)}>{labelPembayaran(bayar)}</option>}
                {[...BANK_OPTIONS, "Cash"].map((bank) => (
                  <option key={bank} value={bank}>{bank}</option>
                ))}
              </select>
            </label>

            <label>
              Jumlah (Rp)
              <input
                type="text"
                inputMode="numeric"
                placeholder="0"
                value={bayar.jumlah || ""}
                onChange={(e) => updatePembayaran(index, "jumlah", parseAngka(e.target.value))}
              />
            </label>
          </div>

          <button type="button" className="remove-btn" onClick={() => hapusPembayaran(index)}>
            Hapus Cicilan
          </button>
        </div>
      ))}
      <button type="button" className="add-btn" onClick={tambahPembayaran}>
        + Tambah Cicilan
      </button>

      {/* ── PENGATURAN BIAYA ──────────────────────── */}
      <div className="section-title">Pengaturan Biaya</div>
      <div className="item-row-grid">
        {([
          ["diskon", "diskonMode", "Diskon"],
          ["pajak", "pajakMode", "Tax"],
          ["biayaAdmin", "biayaAdminMode", "Service Fee"],
        ] as const).map(([field, modeField, label]) => (
          <div key={field}>
            <label>
              {label} — Jenis Input
              <select value={data[modeField] ?? "nominal"} onChange={(e) => setData({...data, [modeField]: e.target.value as "nominal" | "percent", [field]: 0})}>
                <option value="nominal">Nominal (Rp)</option>
                <option value="percent">Persentase (%)</option>
              </select>
            </label>
            <label>
              {label} ({data[modeField] === "percent" ? "%" : "Rp"})
              <input type="number" min="0" max={data[modeField] === "percent" ? 100 : 1e12} step={data[modeField] === "percent" ? "0.01" : "1"}
                value={data[field] ?? 0} onChange={(e) => {
                  const value = Number(e.target.value);
                  if (Number.isFinite(value) && value >= 0 && value <= (data[modeField] === "percent" ? 100 : 1e12)) handleChange(field, value);
                }} />
            </label>
          </div>
        ))}
      </div>
      <p className="hint">Diskon % dihitung dari subtotal. Tax % dan Service Fee % dihitung dari subtotal setelah diskon. Nominal dibulatkan ke rupiah terdekat. Mengganti jenis input mengosongkan nilainya.</p>

      <hr style={{ margin: '24px 0', border: 'none', borderTop: '1px solid #e3e7f3' }} />

      {/* ── AKSI UTAMA ────────────────────────────── */}
      <div className="action-bar">
        <div className="btn-group">
          <button
            type="button"
            className="download-btn"
            onClick={handleDownloadPDF}
            disabled={isDownloading}
            style={{ opacity: isDownloading ? 0.7 : 1, cursor: isDownloading ? 'wait' : 'pointer' }}
          >
            {isDownloading
              ? '⏳ Membuat PDF...'
              : isLunas
                ? '⬇️ Download Invoice + Kwitansi'
                : '⬇️ Download PDF'
            }
          </button>
        </div>
        <button type="button" className="clear-btn" onClick={handleClearAll} title="Kosongkan semua item dan pembayaran">
          Buat INV Baru
        </button>
      </div>

      {/* ── MODALS ────────────────────────────────── */}
      {showCSV && <CSVUpload onImport={handleCSVImport} onClose={() => setShowCSV(false)} />}
      {showHistory && <InvoiceHistory onLoadInvoice={handleLoadFromHistory} onClose={() => setShowHistory(false)} />}
    </fieldset>
    </div>
  );
}
