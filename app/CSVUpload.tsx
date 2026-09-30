"use client";

import React, { useState, useRef } from "react";
import { parseCSV, csvRowsToInvoiceData, CSV_HEADERS, createCSVTemplate, downloadCSV } from "./storage";
import type { InvoiceData } from "./types";

interface Props {
  onImport: (invoices: InvoiceData[]) => void | Promise<void>;
  onClose: () => void;
}

export default function CSVUpload({ onImport, onClose }: Props) {
  const [importing, setImporting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [preview, setPreview] = useState<InvoiceData[] | null>(null);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setPreview(null);
    if (file.size > 5 * 1024 * 1024) { setError("Ukuran file maksimal 5MB"); return; }
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("File harus berformat .csv");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = reader.result as string;
        const rows = parseCSV(text);
        if (rows.length === 0) {
          setError("CSV kosong atau format tidak valid");
          return;
        }
        const invoices = csvRowsToInvoiceData(rows);
        setPreview(invoices);
        setError("");
      } catch (err) {
        setError("Gagal memparse CSV: " + (err as Error).message);
      }
    };
    reader.onerror = () => setError("File tidak dapat dibaca");
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      handleFile(e.target.files[0]);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        background: "rgba(0,0,0,0.4)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
      onClick={() => {if (!importing) onClose();}}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "16px",
          width: "100%",
          maxWidth: "600px",
          maxHeight: "90vh",
          overflow: "auto",
          boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
          padding: "24px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h2 style={{ margin: 0, fontSize: "18px", color: "#051d76" }}>📁 Upload CSV</h2>
          <button disabled={importing} onClick={onClose} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "#7783a8" }}>✕</button>
        </div>

        {/* Template Download */}
        <div style={{ background: "#f0f4ff", borderRadius: "8px", padding: "12px 16px", marginBottom: "16px", fontSize: "12px", color: "#4a5568" }}>
          <b style={{ color: "#0d5bd7" }}>Format CSV yang didukung:</b>
          <div style={{ marginTop: "6px", fontFamily: "monospace", fontSize: "11px", lineHeight: 1.5, overflowWrap: "anywhere" }}>
            {CSV_HEADERS.join(",")}
          </div>
          <p style={{margin: "8px 0", lineHeight: 1.6}}>
            Mode biaya: <code>nominal</code> untuk Rp atau <code>percent</code> untuk % (contoh: 10, tanpa tanda %).
            Kolom <code>riwayat_pembayaran_json</code> dan <code>rekening_bank_json</code> berisi array JSON; isi <code>[]</code> jika kosong.
            Satu invoice boleh memakai beberapa baris item dengan nomor invoice yang sama.
            Total dan status dihitung ulang otomatis saat impor.
          </p>
          <p style={{margin: "8px 0", lineHeight: 1.6}}>Template berisi contoh Mandiri, BNI, Cash, beberapa item, serta biaya Rp/%. Ganti nomor invoice, tanggal, dan data contoh sebelum impor; isi rekening dengan data asli.</p>
          <button
            onClick={() => downloadCSV(createCSVTemplate(), "template-invoice.csv")}
            style={{ marginTop: "8px", background: "none", border: "none", color: "#0d5bd7", fontSize: "12px", cursor: "pointer", textDecoration: "underline", fontWeight: 600 }}
          >
            ⬇️ Download Template CSV
          </button>
        </div>

        {/* Drop Zone */}
        {!preview && (
          <div
            onDragEnter={() => setDragActive(true)}
            onDragLeave={() => setDragActive(false)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            style={{
              border: `2px dashed ${dragActive ? "#0d5bd7" : "#d0d5e4"}`,
              borderRadius: "12px",
              padding: "40px 20px",
              textAlign: "center",
              cursor: "pointer",
              background: dragActive ? "#f0f4ff" : "#f8f9fc",
              transition: "all 0.2s",
            }}
          >
            <div style={{ fontSize: "32px", marginBottom: "8px" }}>📄</div>
            <div style={{ fontSize: "14px", fontWeight: 600, color: "#1a1a2e" }}>
              {dragActive ? "Lepaskan file di sini" : "Drag & drop file CSV, atau klik untuk browse"}
            </div>
            <div style={{ fontSize: "12px", color: "#7783a8", marginTop: "6px" }}>Format: .csv (max 5MB)</div>
            <input ref={inputRef} type="file" accept=".csv" onChange={handleChange} style={{ display: "none" }} />
          </div>
        )}

        {error && (
          <div style={{ marginTop: "12px", padding: "10px 14px", background: "#fff0f0", color: "#c0392b", borderRadius: "8px", fontSize: "13px" }}>
            ⚠️ {error}
          </div>
        )}

        {/* Preview */}
        {preview && preview.length > 0 && (
          <div style={{ marginTop: "16px" }}>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "#051d76", marginBottom: "10px" }}>
              Preview: {preview.length} invoice ditemukan
            </div>
            <div style={{ maxHeight: "300px", overflow: "auto", border: "1px solid #e3e7f3", borderRadius: "10px" }}>
              {preview.map((inv, idx) => (
                <div key={idx} style={{ padding: "12px 16px", borderBottom: "1px solid #e3e7f3", background: idx % 2 === 0 ? "#fff" : "#fafbfd" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 700, color: "#051d76", fontSize: "13px" }}>{inv.nomorInvoice}</div>
                      <div style={{ fontSize: "12px", color: "#7783a8" }}>{inv.namaCustomer} • {inv.tanggal}</div>
                    </div>
                    <div style={{ fontSize: "12px", color: "#4a5568" }}>
                      {inv.items.length} item
                    </div>
                  </div>
                  <div style={{ marginTop: "6px", fontSize: "11px", color: "#7783a8" }}>
                    {inv.items.map((item) => item.deskripsi).join(", ")}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
              <button
                disabled={importing}
                onClick={async () => {
                  setImporting(true);
                  try { await onImport(preview); onClose(); }
                  catch (err) { setError("Impor gagal: " + (err as Error).message); }
                  finally {setImporting(false);}
                }}
                style={{ flex: 1, padding: "12px", background: "#0d5bd7", color: "#fff", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}
              >
                {importing ? "Menyimpan…" : `✅ Import ${preview.length} Invoice`}
              </button>
              <button
                disabled={importing}
                onClick={() => { setPreview(null); setError(""); }}
                style={{ padding: "12px 20px", background: "#f8f9fc", color: "#4a5568", border: "1px solid #d0d5e4", borderRadius: "8px", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}
              >
                Batal
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
