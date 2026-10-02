"use client";
import { statusPembayaran, hitungKelebihan, hitungBiaya, labelPembayaran } from "./utils";

import { hitungDibayar, tanggalHariIni } from "./utils";

import React, { forwardRef } from "react";
import "./invoice.css";
import { COMPANY } from "./constants";
import { InvoiceData } from "./types";
import {
  formatTanggal,
  formatDicetak,
  rupiah,
  rekening,
  statusInvoice,
  terbilang,
} from "./utils";

type Props = {
  data: InvoiceData;
};

const Invoice = forwardRef<HTMLDivElement, Props>(({ data }, ref) => {
  const {subtotal, diskon, tax, serviceFee, total} = hitungBiaya(data);

  // Hitung total dibayar dari riwayat cicilan (jika ada)
  const dibayar = hitungDibayar(data);

  const sisa = Math.max(total - dibayar, 0);
  const status = statusPembayaran(data);

  const badgeClass =
    status === "LUNAS"
      ? "status-badge paid"
      : status === "SEBAGIAN"
      ? "status-badge partial"
      : "status-badge unpaid";

  const badgeText =
    status === "LUNAS"
      ? "Lunas"
      : status === "SEBAGIAN"
      ? "Sebagian"
      : "Belum Dibayar";

  return (
    <div className="invoice-page" ref={ref}>
      <div className="sheet">
        {/* HEADER */}
        <header className="head">
          <div className="head-row">
            <img 
              src="/logo_header.png" 
              alt="Logo" 
              className="header-logo"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            <div className={badgeClass}>{badgeText}</div>
          </div>

          <h1 className="invoice-title">Invoice</h1>

          <div className="invoice-meta">
            <div>
              <span>No. Invoice</span>
              <b className="mono">{data.nomorInvoice}</b>
            </div>
            <div>
              <span>Tanggal</span>
              <b>{formatTanggal(data.tanggal)}</b>
            </div>
            <div>
              <span>Referensi</span>
              <b>{data.referensi || "—"}</b>
            </div>
          </div>
        </header>

        {/* BILLED TO */}
        <section className="billed">
          <div>
            <div className="label">Ditagihkan kepada</div>
            <div className="name">{data.namaCustomer || "Nama Customer"}</div>
          </div>
          <div className="billed-right">
            <div className="label">Dicetak</div>
            <div className="printed-at">{formatDicetak(data.dicetakPada)}</div>
          </div>
        </section>

        {/* ITEMS TABLE */}
        <section className="items">
          <table>
            <thead>
              <tr>
                <th>Deskripsi</th>
                <th>Qty</th>
                <th>Harga</th>
                <th>Jumlah</th>
              </tr>
            </thead>
            <tbody>
              {data.items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="empty-row">Belum ada item.</td>
                </tr>
              ) : (
                data.items.map((item) => (
                  <tr key={item.id}>
                    <td className="item-name">
                      {item.deskripsi || "-"}
                      {item.subDeskripsi && (
                        <span className="item-sub">{item.subDeskripsi}</span>
                      )}
                    </td>
                    <td>{item.qty ?? "—"}</td>
                    <td>
                      {item.hargaSatuan != null
                        ? rupiah(item.hargaSatuan)
                        : "—"}
                    </td>
                    <td>{rupiah(item.jumlah)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        {/* TOTALS & TERBILANG — SIDE BY SIDE */}
        <section className="summary-section">
          <div className="terbilang-col">
            <div className="title">Terbilang</div>
            <div className="text">{terbilang(total)}</div>
          </div>

          <div className="totals-box">
            <div className="totals-row">
              <span>Subtotal</span>
              <span>{rupiah(subtotal)}</span>
            </div>

            {(data.diskon ?? 0) > 0 && (
              <div className="totals-row">
                <span>Diskon{data.diskonMode === "percent" ? ` (${data.diskon}%)` : ""}</span>
                <span>- {rupiah(diskon)}</span>
              </div>
            )}

            {(data.pajak ?? 0) > 0 && (
              <div className="totals-row">
                <span>Tax{data.pajakMode === "percent" ? ` (${data.pajak}%)` : ""}</span>
                <span>{rupiah(tax)}</span>
              </div>
            )}

            {(data.biayaAdmin ?? 0) > 0 && (
              <div className="totals-row">
                <span>Service Fee{data.biayaAdminMode === "percent" ? ` (${data.biayaAdmin}%)` : ""}</span>
                <span>{rupiah(serviceFee)}</span>
              </div>
            )}

            <div className="totals-row grand">
              <span>Total</span>
              <span>{rupiah(hitungBiaya({...data, deposit: 0}).total)}</span>
            </div>
            {(data.deposit ?? 0) > 0 && <>
              <div className="totals-row"><span>Deposit dari {data.depositInvoice}</span><span>- {rupiah(data.deposit ?? 0)}</span></div>
              <div className="totals-row grand"><span>Tagihan Setelah Deposit</span><span>{rupiah(total)}</span></div>
            </>}

            <div className="totals-row paid-summary">
              <span>Sudah Dibayar</span>
              <span>{rupiah(dibayar)}</span>
            </div>

            {/* Looping data riwayat pembayaran jika ada */}
            {data.riwayatPembayaran && data.riwayatPembayaran.length > 0 && (
              <div className="payment-history">
                {data.riwayatPembayaran.map((bayar, index) => (
                  <div 
                    key={index} 
                    className="totals-row payment-history-item"
                  >
                    <span>↳ {formatTanggal(bayar.tanggal as string)} — {labelPembayaran(bayar)}</span>
                    <span>{rupiah(bayar.jumlah)}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="totals-row due">
              <span>Sisa Tagihan</span>
              <span>{rupiah(sisa)}</span>
            </div>
            {hitungKelebihan(total, dibayar) > 0 && (
              <div className="totals-row overpayment">
                <span>Kelebihan Pembayaran</span>
                <span>{rupiah(hitungKelebihan(total, dibayar))}</span>
              </div>
            )}
          </div>
        </section>

        {/* BANK ACCOUNTS */}
        <section className="banks">
          {data.rekeningBank.length === 0 ? (
            <div className="bank-card empty-bank">
              <span>Rekening Tujuan</span>
              <b>Belum ada rekening.</b>
            </div>
          ) : (
            data.rekeningBank.map((bank) => (
              <div key={bank.id} className="bank-card">
                <span>{bank.bank} a/n</span>
                <b>{bank.atasNama}</b>
                <div className="acc mono">{rekening(bank.nomorRekening)}</div>
              </div>
            ))
          )}
        </section>

        <section className="invoice-note">
          <div className="note-left">
            <div className="note-title">Catatan</div>
            <p>
              DP minimal 30% dari total pesanan; tiket pesawat wajib dibayar lunas; sisa tagihan dilunasi paling lambat 30 hari sebelum keberangkatan. Simpan dan kirim bukti pembayaran ke admin easyUmroh untuk verifikasi.
            </p>
          </div>
          <img 
            src="/qreasyumroh.png" 
            alt="QR Code" 
            className="qr-image"
            onError={(e) => { 
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              target.parentElement?.querySelector('.qr-fallback')?.classList.remove('qr-fallback');
            }}
          />
          <div className="qr-fallback" style={{display:'none'}}>QR</div>
        </section>

        <footer className="footer">
          <div className="footer-contact">
            <img 
              src="/logo_footer.png" 
              alt="Logo" 
              className="footer-logo"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            {COMPANY.alamat}
            <br />
            <a href={COMPANY.website} target="_blank" rel="noreferrer">
              {COMPANY.website.replace("https://", "")}
            </a>
            {" · "}
            <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
            {" · "}
            <a href={`tel:${COMPANY.telepon.replace(/\s/g, "")}`}>
              {COMPANY.telepon}
            </a>
          </div>

          <div className="sign">
            <div className="sign-name">Anas Basuki</div>
            <img 
              src="/ttdanas.png" 
              alt="Tanda Tangan" 
              className="sign-image"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            <div className="sign-line" />
            <span>Accounting</span>
          </div>
        </footer>
      </div>
    </div>
  );
});

Invoice.displayName = "Invoice";

export default Invoice;
