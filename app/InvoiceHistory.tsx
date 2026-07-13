"use client";

import React, { useState, useEffect } from "react";
import { loadHistory, deleteFromHistory, clearHistory, exportCSV, downloadCSV } from "./storage";
import type { InvoiceHistoryItem } from "./storage";
import { rupiah } from "./utils";

interface Props {
  onLoadInvoice: (data: InvoiceHistoryItem) => void;
  onClose: () => void;
}

export default function InvoiceHistory({ onLoadInvoice, onClose }: Props) {
  const [history, setHistory] = useState<InvoiceHistoryItem[]>([]);
  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "LUNAS" | "SEBAGIAN" | "BELUM_DIBAYAR">("ALL");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const filtered = history.filter((h) => {
    const matchText =
      !filter ||
      h.nomorInvoice.toLowerCase().includes(filter.toLowerCase()) ||
      h.namaCustomer.toLowerCase().includes(filter.toLowerCase());
    const matchStatus = statusFilter === "ALL" || h.status === statusFilter;
    return matchText && matchStatus;
  });

  const totalRevenue = filtered.reduce((sum, h) => sum + h.dibayar, 0);
  const totalOutstanding = filtered.reduce((sum, h) => sum + (h.total - h.dibayar), 0);

  const handleDelete = (id: string) => {
    if (confirm("Yakin hapus invoice ini dari riwayat?")) {
      deleteFromHistory(id);
      setHistory(loadHistory());
    }
  };

  const handleExportCSV = () => {
    const csv = exportCSV(filtered);
    downloadCSV(csv, `rekap-invoice-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      LUNAS: "#e8f8ef; color: #0f8a4d;",
      SEBAGIAN: "#eef5ff; color: #0d5bd7;",
      BELUM_DIBAYAR: "#fff0f0; color: #c0392b;",
    };
    return (
      <span
        style={{
          display: "inline-block",
          padding: "4px 10px",
          borderRadius: "12px",
          fontSize: "11px",
          fontWeight: 700,
          textTransform: "uppercase",
          background: styles[status]?.split("; ")[0] || "#f0f0f0",
          color: styles[status]?.split("color: ")[1]?.replace(";", "") || "#666",
        }}
      >
        {status === "LUNAS" ? "Lunas" : status === "SEBAGIAN" ? "Sebagian" : "Belum Dibayar"}
      </span>
    );
  };

  const paymentProgress = (item: InvoiceHistoryItem) => {
    const pct = item.total > 0 ? Math.round((item.dibayar / item.total) * 100) : 0;
    return (
      <div style={{ marginTop: "6px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#7783a8", marginBottom: "2px" }}>
          <span>Progress Pembayaran</span>
          <span>{pct}%</span>
        </div>
        <div style={{ width: "100%", height: "6px", background: "#e3e7f3", borderRadius: "3px", overflow: "hidden" }}>
          <div
            style={{
              width: `${pct}%`,
              height: "100%",
              background: pct === 100 ? "#0f8a4d" : pct > 0 ? "#0d5bd7" : "#c0392b",
              borderRadius: "3px",
              transition: "width 0.3s",
            }}
          />
        </div>
        <div style={{ fontSize: "11px", color: "#4a5568", marginTop: "2px" }}>
          {rupiah(item.dibayar)} / {rupiah(item.total)}
        </div>
      </div>
    );
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
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "16px",
          width: "100%",
          maxWidth: "900px",
          maxHeight: "90vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #e3e7f3", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "18px", color: "#051d76" }}>📋 Riwayat Invoice</h2>
            <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#7783a8" }}>Klik invoice untuk edit & tambah cicilan</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "#7783a8" }}>✕</button>
        </div>

        {/* Summary Cards */}
        <div style={{ padding: "16px 24px", display: "flex", gap: "12px", background: "#f8f9fc" }}>
          <div style={{ flex: 1, background: "#fff", padding: "14px", borderRadius: "10px", border: "1px solid #e3e7f3" }}>
            <div style={{ fontSize: "11px", color: "#7783a8", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em" }}>Total Invoice</div>
            <div style={{ fontSize: "20px", fontWeight: 800, color: "#051d76", marginTop: "4px" }}>{filtered.length}</div>
          </div>
          <div style={{ flex: 1, background: "#fff", padding: "14px", borderRadius: "10px", border: "1px solid #e3e7f3" }}>
            <div style={{ fontSize: "11px", color: "#7783a8", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em" }}>Total Diterima</div>
            <div style={{ fontSize: "20px", fontWeight: 800, color: "#0f8a4d", marginTop: "4px" }}>{rupiah(totalRevenue)}</div>
          </div>
          <div style={{ flex: 1, background: "#fff", padding: "14px", borderRadius: "10px", border: "1px solid #e3e7f3" }}>
            <div style={{ fontSize: "11px", color: "#7783a8", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em" }}>Sisa Tagihan</div>
            <div style={{ fontSize: "20px", fontWeight: 800, color: "#c0392b", marginTop: "4px" }}>{rupiah(totalOutstanding)}</div>
          </div>
        </div>

        {/* Filters */}
        <div style={{ padding: "12px 24px", display: "flex", gap: "10px", borderBottom: "1px solid #e3e7f3" }}>
          <input
            type="text"
            placeholder="Cari nomor invoice atau customer..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{ flex: 1, padding: "8px 12px", borderRadius: "8px", border: "1px solid #d0d5e4", fontSize: "13px", outline: "none" }}
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #d0d5e4", fontSize: "13px", outline: "none" }}
          >
            <option value="ALL">Semua Status</option>
            <option value="LUNAS">Lunas</option>
            <option value="SEBAGIAN">Sebagian</option>
            <option value="BELUM_DIBAYAR">Belum Dibayar</option>
          </select>
          <button
            onClick={handleExportCSV}
            style={{ padding: "8px 14px", borderRadius: "8px", border: "1px solid #0d5bd7", background: "#f0f4ff", color: "#0d5bd7", fontSize: "12px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}
          >
            ⬇️ Export CSV
          </button>
        </div>

        {/* Table */}
        <div style={{ flex: 1, overflow: "auto", padding: "0 24px" }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", color: "#7783a8" }}>
              <div style={{ fontSize: "32px", marginBottom: "8px" }}>📭</div>
              <div>Belum ada riwayat invoice</div>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead style={{ position: "sticky", top: 0, background: "#fff" }}>
                <tr style={{ borderBottom: "2px solid #051d76" }}>
                  <th style={{ textAlign: "left", padding: "10px 8px", fontSize: "10px", textTransform: "uppercase", color: "#7783a8" }}>Invoice</th>
                  <th style={{ textAlign: "left", padding: "10px 8px", fontSize: "10px", textTransform: "uppercase", color: "#7783a8" }}>Customer</th>
                  <th style={{ textAlign: "right", padding: "10px 8px", fontSize: "10px", textTransform: "uppercase", color: "#7783a8" }}>Total</th>
                  <th style={{ textAlign: "center", padding: "10px 8px", fontSize: "10px", textTransform: "uppercase", color: "#7783a8" }}>Status</th>
                  <th style={{ textAlign: "center", padding: "10px 8px", fontSize: "10px", textTransform: "uppercase", color: "#7783a8" }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((h) => (
                  <React.Fragment key={h.id}>
                    <tr style={{ borderBottom: "1px solid #e3e7f3", cursor: "pointer" }} onClick={() => setExpandedId(expandedId === h.id ? null : h.id)}>
                      <td style={{ padding: "10px 8px" }}>
                        <div style={{ fontWeight: 700, color: "#051d76", fontSize: "13px" }}>{h.nomorInvoice}</div>
                        <div style={{ fontSize: "11px", color: "#7783a8" }}>{h.tanggal}</div>
                      </td>
                      <td style={{ padding: "10px 8px" }}>{h.namaCustomer}</td>
                      <td style={{ padding: "10px 8px", textAlign: "right", fontWeight: 600 }}>
                        <div>{rupiah(h.total)}</div>
                        <div style={{ fontSize: "11px", color: "#0f8a4d" }}>{rupiah(h.dibayar)}</div>
                      </td>
                      <td style={{ padding: "10px 8px", textAlign: "center" }}>{statusBadge(h.status)}</td>
                      <td style={{ padding: "10px 8px", textAlign: "center" }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); onLoadInvoice(h); }}
                          style={{ background: "#0d5bd7", color: "#fff", border: "none", borderRadius: "6px", padding: "6px 12px", fontSize: "11px", fontWeight: 600, cursor: "pointer", marginRight: "4px" }}
                        >
                          Buka
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(h.id); }}
                          style={{ background: "#fff0f0", color: "#c0392b", border: "1px solid #f5c6cb", borderRadius: "6px", padding: "6px 10px", fontSize: "11px", fontWeight: 600, cursor: "pointer" }}
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                    {expandedId === h.id && (
                      <tr>
                        <td colSpan={5} style={{ padding: "0 8px 12px", background: "#fafbfd" }}>
                          {paymentProgress(h)}
                          {h.data.riwayatPembayaran && h.data.riwayatPembayaran.length > 0 && (
                            <div style={{ marginTop: "8px" }}>
                              <div style={{ fontSize: "11px", fontWeight: 700, color: "#7783a8", textTransform: "uppercase", marginBottom: "4px" }}>Riwayat Cicilan:</div>
                              {h.data.riwayatPembayaran.map((p, i) => (
                                <div key={i} style={{ fontSize: "12px", color: "#4a5568", padding: "2px 0" }}>
                                  {i + 1}. {p.tanggal} — {p.bank} — {rupiah(p.jumlah)}
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 24px", borderTop: "1px solid #e3e7f3", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: "12px", color: "#7783a8" }}>
            Menampilkan {filtered.length} dari {history.length} invoice
          </div>
          {history.length > 0 && (
            <button
              onClick={() => {
                if (confirm("Yakin hapus SEMUA riwayat?")) {
                  clearHistory();
                  setHistory([]);
                }
              }}
              style={{ background: "none", border: "none", color: "#c0392b", fontSize: "12px", cursor: "pointer", textDecoration: "underline" }}
            >
              Hapus Semua Riwayat
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
