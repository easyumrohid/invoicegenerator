"use client";

import domtoimage from "dom-to-image-more";
import jsPDF from "jspdf";
import { paginatePDF } from "./pdf-pagination";

// A4 at 96 DPI
const A4_WIDTH_PX = 794;

async function elementToPDF(
  element: HTMLDivElement,
  fileName: string
) {
  // ── Buat wrapper dengan class & innerHTML dari elemen original ──
  const wrapper = document.createElement("div");
  wrapper.className = `${element.className} pdf-export`;
  wrapper.innerHTML = element.innerHTML;

  // Isolate wrapper dari parent flexbox
  wrapper.style.cssText = `
    width: ${A4_WIDTH_PX}px !important;
    min-width: ${A4_WIDTH_PX}px !important;
    max-width: ${A4_WIDTH_PX}px !important;
    height: auto !important;
    min-height: 0 !important;
    -webkit-text-size-adjust: none !important;
    text-size-adjust: none !important;
    background: #ffffff !important;
    position: fixed !important;
    top: -9999px !important;
    left: -9999px !important;
    overflow: hidden !important;
    margin: 0 !important;
    padding: 0 !important;
    box-sizing: border-box !important;
    display: block !important;
  `;

  // ── Hanya force width pada .sheet dan .head ──
  // Jangan sentuh margin pada content sections
  const sheet = wrapper.querySelector(".sheet");
  if (sheet instanceof HTMLElement) {
    sheet.style.cssText += `
      width: 100% !important;
      min-width: 100% !important;
      max-width: 100% !important;
      box-sizing: border-box !important;
    `;
  }

  const head = wrapper.querySelector(".head");
  if (head instanceof HTMLElement) {
    head.style.cssText += `
      width: 100% !important;
      min-width: 100% !important;
      max-width: 100% !important;
      box-sizing: border-box !important;
      margin: 0 !important;
    `;
  }

  document.body.appendChild(wrapper);

  try {
  // Force layout + tunggu gambar load
  void wrapper.offsetHeight;
  await document.fonts.ready;
  await Promise.all(Array.from(wrapper.querySelectorAll("img")).map(async (image) => {
    try { await image.decode(); }
    catch { image.remove(); }
  }));

  const width = A4_WIDTH_PX;
  const height = Math.ceil(wrapper.scrollHeight);
  const origin = wrapper.getBoundingClientRect().top;
  const blocks = Array.from(wrapper.querySelectorAll("tr, .head, .billed, .summary-section, .terbilang-section, .footer, .invoice-note, .banks, .signature-section, .sign, .combined-row, .terbilang-kwitansi, .amount-section"))
    .map(node => { const rect = node.getBoundingClientRect(); return {top: rect.top - origin, bottom: rect.bottom - origin}; });

    // Range menghasilkan kotak per baris, termasuk Enter pada subdeskripsi.
    // Blok yang terlalu tinggi boleh dilanjutkan, tetapi teks tetap dipisah antarbaris.
    const walker = document.createTreeWalker(wrapper, NodeFilter.SHOW_TEXT);
    let textNode: Node | null;
    while ((textNode = walker.nextNode())) {
      if (!textNode.textContent?.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(textNode);
      for (const rect of Array.from(range.getClientRects())) {
        if (rect.height > 0) blocks.push({top: rect.top - origin, bottom: rect.bottom - origin});
      }
      range.detach();
    }
    for (const node of Array.from(wrapper.querySelectorAll("img, thead"))) {
      const rect = node.getBoundingClientRect();
      blocks.push({top: rect.top - origin, bottom: rect.bottom - origin});
    }

    const dataUrl = await domtoimage.toPng(wrapper, {
      width: width,
      height: height,
      bgcolor: "#ffffff",
      style: {
        margin: "0",
        padding: "0",
        transform: "none",
        boxShadow: "none",
        overflow: "visible",
        position: "relative",
        left: "0",
        top: "0",
      },
      scale: 2,
    });

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true,
    });

    const pdfWidth = 210;
    const pdfHeight = 297;

    const img = new Image();
    img.src = dataUrl;
    await img.decode();


    const margin = 8;
    // Halaman pertama dimulai dari tepi atas agar header tetap penuh.
    // Kapasitas bersama mengikuti halaman lanjutan yang memiliki margin atas.
    const contentHeight = pdfHeight - margin * 2;
    const scale = img.height / height;
    const capacity = Math.floor(img.width * contentHeight / pdfWidth);
    const pages = paginatePDF(img.height, capacity, blocks.map(b => ({
      top: Math.floor(b.top * scale), bottom: Math.ceil(b.bottom * scale),
    })));
    for (const [index, page] of pages.entries()) {
      if (index > 0) pdf.addPage();
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = page.bottom - page.top;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas tidak tersedia");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, page.top, img.width, canvas.height, 0, 0, canvas.width, canvas.height);
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, index === 0 ? 0 : margin, pdfWidth, canvas.height * pdfWidth / img.width);
      if (pages.length > 1) {
        pdf.setFontSize(8);
        pdf.setTextColor(100);
        pdf.text(`${index + 1} / ${pages.length}`, pdfWidth - 8, pdfHeight - 3, {align: "right"});
      }
      canvas.width = 0;
      canvas.height = 0;
    }

    pdf.save(fileName);
  } finally {
    document.body.removeChild(wrapper);
  }
}

export async function exportPDF(
  invoiceRef: React.RefObject<HTMLDivElement | null>,
  fileName = "invoice.pdf"
) {
  if (!invoiceRef.current) return;
  await elementToPDF(invoiceRef.current, fileName);
}

export async function exportKwitansiPDF(
  kwitansiRef: React.RefObject<HTMLDivElement | null>,
  fileName = "kwitansi.pdf"
) {
  if (!kwitansiRef.current) return;
  await elementToPDF(kwitansiRef.current, fileName);
}
