"use client";

import domtoimage from "dom-to-image-more";
import jsPDF from "jspdf";

// A4 at 96 DPI
const A4_WIDTH_PX = 794;
const A4_HEIGHT_PX = 1123;

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
  const blocks = Array.from(wrapper.querySelectorAll("tr, .footer, .invoice-note, .banks, .sign"))
    .map(node => { const rect = node.getBoundingClientRect(); return {top: rect.top - origin, bottom: rect.bottom - origin}; });

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


    // Invoice normal dipertahankan utuh, termasuk footer. Sedikit kelebihan tinggi
    // diperkecil secara proporsional; invoice panjang memakai batas antarblok.
    if (height <= A4_HEIGHT_PX * 1.15) {
      const imageWidth = Math.min(pdfWidth, pdfHeight * img.width / img.height);
      pdf.addImage(dataUrl, "PNG", (pdfWidth - imageWidth) / 2, 0, imageWidth, img.height * imageWidth / img.width);
    } else {
      const scale = img.height / height;
      const pagePixels = Math.ceil(img.width * pdfHeight / pdfWidth);
      let top = 0;
      while (top < img.height) {
        let bottom = Math.min(top + pagePixels, img.height);
        // Hindari memotong baris, catatan, rekening, dan footer/tanda tangan.
        for (let pass = 0; pass < blocks.length; pass++) {
          const crossing = blocks.filter(block => block.top * scale > top + 1 && block.top * scale < bottom && block.bottom * scale > bottom);
          if (!crossing.length) break;
          bottom = Math.floor(Math.min(...crossing.map(block => block.top * scale)));
        }
        if (top > 0) pdf.addPage();
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = bottom - top;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas tidak tersedia");
        ctx.drawImage(img, 0, top, img.width, canvas.height, 0, 0, canvas.width, canvas.height);
        pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, pdfWidth, Math.min(pdfHeight, canvas.height * pdfWidth / img.width));
        top = bottom;
      }
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
