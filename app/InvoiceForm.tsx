"use client";

import React, { useState } from "react";
import "@/app/invoice-form.css";
import { exportPDF, exportKwitansiPDF } from "./pdf";
import { BANK_OPTIONS } from "./constants";
import { generateInvoiceNumber, generateKwitansiNumber, resetInvoiceNumber } from "./utils";
import { saveToHistory } from "./storage";
import type { InvoiceData } from "./types";
import { hitungSubtotal, hitungTotal, statusInvoice } from "./utils";
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

  // --- HANDLER INPUT DASAR ---
  const handleChange = (field: keyof InvoiceData, value: string | number) => {
    setData({ ...data, [field]: value });
  };

  // --- HELPER INPUT ANGKA ---
  // Hanya izinkan digit 0-9: karakter "-", ".", "e" tidak bisa masuk,
  // sehingga nilai negatif/desimal/NaN tidak pernah tercipta saat mengedit.
  const onlyDigits = (v: string) => v.replace(/[^\d]/g, "");
  const parseAngka = (v: string) => {
    const digits = onlyDigits(v);
    return digits === "" ? 0 : Number(digits);
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
    const newItem = {
      tanggal: new Date().toISOString().slice(0, 10),
      metode: "Transfer Bank",
      bank: "Mandiri",
      jumlah: 0,
    };
    setData({ ...data, riwayatPembayaran: [...(data.riwayatPembayaran || []), newItem] });
  };

  const updatePembayaran = (index: number, field: string, value: string | number) => {
    const newRiwayat = [...(data.riwayatPembayaran || [])];
    newRiwayat[index] = { ...newRiwayat[index], [field]: value };
    setData({ ...data, riwayatPembayaran: newRiwayat });
  };

  const hapusPembayaran = (index: number) => {
    const newRiwayat = [...(data.riwayatPembayaran || [])];
    newRiwayat.splice(index, 1);
    setData({ ...data, riwayatPembayaran: newRiwayat });
  };

  // --- HANDLER CETAK ---
  const handlePrint = () => {
    setData({ ...data, dicetakPada: new Date().toISOString() });
    setTimeout(() => window.print(), 100);
  };

  // --- HANDLER DOWNLOAD PDF ---
  const handleDownloadPDF = async () => {
    if (!invoiceRef.current || isDownloading) return;
    setIsDownloading(true);

    try {
      const updatedData = { ...data, dicetakPada: new Date().toISOString() };
      setData(updatedData);
      await new Promise((resolve) => setTimeout(resolve, 200));
      await exportPDF(invoiceRef, `${updatedData.nomorInvoice || "invoice"}.pdf`);

      if (isLunas && kwitansiRef?.current) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        await exportKwitansiPDF(
          kwitansiRef,
          `${generateKwitansiNumber(updatedData.nomorInvoice) || "kwitansi"}.pdf`
        );
      }

      // Save to history after successful download
      const subtotal = updatedData.items.reduce((t, i) => t + i.jumlah, 0);
      const total = hitungTotal(subtotal, updatedData.diskon ?? 0, updatedData.pajak ?? 0, updatedData.biayaAdmin ?? 0);
      const dibayar = updatedData.riwayatPembayaran
        ? updatedData.riwayatPembayaran.reduce((acc, curr) => acc + (Number(curr.jumlah) || 0), 0)
        : (Number(updatedData.jumlahDibayar) || 0);
      const status = statusInvoice(total, dibayar);
      saveToHistory(updatedData, total, dibayar, status);
    } catch (err) {
      console.error("Download error:", err);
      alert("Gagal membuat PDF. Coba lagi.");
    } finally {
      setIsDownloading(false);
    }
  };

  // --- HANDLER CLEAR ALL ---
  const handleClearAll = () => {
    if (confirm("Yakin ingin mengosongkan semua data?")) {
      const tgl = new Date().toISOString().slice(0, 10);
      setData({
        ...data,
        nomorInvoice: resetInvoiceNumber(tgl),
        tanggal: tgl,
        namaCustomer: "",
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
      });
    }
  };

  // --- HANDLER CSV IMPORT ---
  const handleCSVImport = (invoices: InvoiceData[]) => {
    if (invoices.length > 0) {
      setData(invoices[0]);
      if (invoices.length > 1) {
        alert(`Berhasil import ${invoices.length} invoice. Menampilkan invoice pertama.`);
      }
    }
  };

  // --- HANDLER LOAD FROM HISTORY ---
  const handleLoadFromHistory = (historyItem: InvoiceHistoryItem) => {
    setData(historyItem.data);
    setShowHistory(false);
  };

  return (
    <div className="form-panel no-print">
      <h1>Pengaturan Invoice</h1>
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
            value={data.nomorInvoice}
            onChange={(e) => handleChange("nomorInvoice", e.target.value)}
          />
        </label>
        <button
          type="button"
          onClick={() => {
            const newNum = generateInvoiceNumber(data.tanggal);
            handleChange("nomorInvoice", newNum);
          }}
          title="Generate nomor invoice baru berdasarkan tanggal"
          style={{
            padding: "10px 12px",
            background: "#f0f4ff",
            color: "#0d5bd7",
            border: "1px solid #c7d5f9",
            borderRadius: "8px",
            fontSize: "12px",
            fontWeight: 600,
            cursor: "pointer",
            marginBottom: "14px",
            whiteSpace: "nowrap",
          }}
        >
          🔄 Generate
        </button>
      </div>

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
            <input
              type="text"
              value={item.subDeskripsi || ""}
              onChange={(e) => updateItem(index, "subDeskripsi", e.target.value)}
            />
          </label>

          <div className="item-row-grid">
            <label>
              Qty
              <input
                type="text"
                inputMode="numeric"
                value={item.qty || ""}
                onChange={(e) => updateItem(index, "qty", parseAngka(e.target.value))}
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
              Bank Tujuan
              <select
                value={bayar.bank || "Mandiri"}
                onChange={(e) => updatePembayaran(index, "bank", e.target.value)}
              >
                {BANK_OPTIONS.map((bank) => (
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
        <label>
          Diskon (Rp)
          <input
            type="text"
            inputMode="numeric"
            value={data.diskon || ""}
            onChange={(e) => handleChange("diskon", parseAngka(e.target.value))}
          />
        </label>
        <label>
          Pajak (Rp)
          <input
            type="text"
            inputMode="numeric"
            value={data.pajak || ""}
            onChange={(e) => handleChange("pajak", parseAngka(e.target.value))}
          />
        </label>
        <label>
          Biaya Admin (Rp)
          <input
            type="text"
            inputMode="numeric"
            value={data.biayaAdmin || ""}
            onChange={(e) => handleChange("biayaAdmin", parseAngka(e.target.value))}
          />
        </label>
      </div>

      <hr style={{ margin: '24px 0', border: 'none', borderTop: '1px solid #e3e7f3' }} />

      {/* ── AKSI UTAMA ────────────────────────────── */}
      <div className="action-bar">
        <div className="btn-group">
          <button type="button" className="print-btn" onClick={handlePrint}>
            🖨️ Cetak Invoice
          </button>
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
          🗑️ Kosongkan Semua
        </button>
      </div>

      {/* ── MODALS ────────────────────────────────── */}
      {showCSV && <CSVUpload onImport={handleCSVImport} onClose={() => setShowCSV(false)} />}
      {showHistory && <InvoiceHistory onLoadInvoice={handleLoadFromHistory} onClose={() => setShowHistory(false)} />}
    </div>
  );
}
