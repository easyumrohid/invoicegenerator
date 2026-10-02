"use client";
import { hitungBiaya, hitungKelebihan, labelPembayaran } from "./utils";

import { hitungDibayar, tanggalHariIni } from "./utils";

import React, { forwardRef } from "react";
import "./kwitansi.css";
import { COMPANY } from "./constants";
import { InvoiceData } from "./types";
import {
  formatTanggal,
  formatDicetak,
  rupiah,
  terbilang,
  generateKwitansiNumber,
} from "./utils";

type Props = {
  data: InvoiceData;
};

const Kwitansi = forwardRef<HTMLDivElement, Props>(({ data }, ref) => {
  const dibayar = hitungDibayar(data);
  const kelebihan = hitungKelebihan(hitungBiaya(data).total, dibayar);

  const nomorKwitansi = generateKwitansiNumber(data.nomorInvoice);

  return (
    <div className="kwitansi-page" ref={ref}>
      <div className="sheet">
        {/* HEADER */}
        <header className="head">
          <div className="head-row">
            <img
              src="/logo_header.png"
              alt="Logo"
              className="header-logo"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
            <div className="status-badge paid">Lunas</div>
          </div>

          <h1 className="kwitansi-title">Kwitansi</h1>

          <div className="invoice-meta">
            <div>
              <span>No. Kwitansi</span>
              <b className="mono">{nomorKwitansi}</b>
            </div>
            <div>
              <span>Tanggal</span>
              <b>{formatTanggal(data.tanggal)}</b>
            </div>
            <div>
              <span>Ref. Invoice</span>
              <b>{data.nomorInvoice}</b>
            </div>
          </div>
        </header>

        {/* RECEIVED FROM */}
        <section className="billed">
          <div>
            <div className="label">Telah diterima dari</div>
            <div className="name">{data.namaCustomer || "Nama Customer"}</div>
          </div>
          <div className="billed-right">
            <div className="label">Dicetak</div>
            <div className="printed-at">{formatDicetak(data.dicetakPada)}</div>
          </div>
        </section>

        {/* AMOUNT */}
        <section className="amount-section">
          <div className="amount-box">
            <div className="label">Uang sejumlah</div>
            <div className="amount-value">{rupiah(dibayar)}</div>
          </div>
        </section>

        {/* TERBILANG */}
        <section className="terbilang-kwitansi">
          <div className="title">Terbilang</div>
          <div className="text">{terbilang(dibayar)}</div>
        </section>

        {/* COMBINED ROW: Untuk pembayaran + Total Diterima */}
        <div className="combined-row">
          {/* FOR PAYMENT */}
          <section className="for-payment">
            <div className="label">Untuk pembayaran</div>
            <div className="payment-items">
              <div className="payment-ref">↳ Invoice {data.nomorInvoice}</div>
              {data.items.map((item) => (
                <div key={item.id} className="payment-item">
                  {item.deskripsi || "-"}
                  {item.subDeskripsi && (
                    <span className="payment-sub">{item.subDeskripsi}</span>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* PAID SUMMARY */}
          <section className="paid-summary-section">
            <div className="paid-box">
              <div className="paid-label">Total Diterima</div>
              <div className="paid-value">{rupiah(dibayar)}</div>
              {(data.deposit ?? 0) > 0 && <div className="overpayment">Deposit Digunakan: {rupiah(data.deposit ?? 0)}<br />Dari {data.depositInvoice}<br />Total Pelunasan: {rupiah(dibayar + (data.deposit ?? 0))}</div>}
              <div className="paid-status">LUNAS</div>
              {kelebihan > 0 && <div className="overpayment">Kelebihan Pembayaran<br /><strong>{rupiah(kelebihan)}</strong></div>}
            </div>
          </section>
        </div>

        {/* PAYMENT HISTORY */}
        {data.riwayatPembayaran && data.riwayatPembayaran.length > 0 && (
          <section className="payment-history-kwitansi">
            <div className="label">Rincian Pembayaran</div>
            <table>
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Metode Pembayaran</th>
                  <th>Jumlah</th>
                </tr>
              </thead>
              <tbody>
                {data.riwayatPembayaran.map((bayar, index) => (
                  <tr key={index}>
                    <td>{formatTanggal(bayar.tanggal as string)}</td>
                    <td>{labelPembayaran(bayar)}</td>
                    <td>{rupiah(bayar.jumlah)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* SIGNATURE */}
        <section className="signature-section">
          <div className="signature-left">
            <div className="label">Penerima,</div>
            <div className="sign">
              <div className="sign-name">Anas Basuki</div>
              <img
                src="/ttdanas.png"
                alt="Tanda Tangan"
                className="sign-image"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
              <div className="sign-line" />
              <span>Accounting</span>
            </div>
          </div>
          <div className="signature-right">
            <div className="label">Penyetor,</div>
            <div className="sign">
              <div className="sign-line" style={{ marginTop: "40px" }} />
              <span>{data.namaCustomer || "_________________"}</span>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="footer">
          <div className="footer-contact">
            <img
              src="/logo_footer.png"
              alt="Logo"
              className="footer-logo"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
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
        </footer>
      </div>
    </div>
  );
});

Kwitansi.displayName = "Kwitansi";

export default Kwitansi;
