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
  wrapper.className = element.className;
  wrapper.innerHTML = element.innerHTML;

  // Isolate wrapper dari parent flexbox
  wrapper.style.cssText = `
    width: ${A4_WIDTH_PX}px !important;
    min-width: ${A4_WIDTH_PX}px !important;
    max-width: ${A4_WIDTH_PX}px !important;
    height: auto !important;
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

  // Force layout + tunggu gambar load
  void wrapper.offsetHeight;
  await new Promise((r) => setTimeout(r, 500));

  const width = A4_WIDTH_PX;
  const height = Math.max(Math.ceil(wrapper.scrollHeight), A4_HEIGHT_PX);

  try {
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
      disableEmbedFonts: true,
      filterUrls: (url: string) => {
        return !url.includes("Inter") && !url.includes("inter");
      },
      logger: {},
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

    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });

    const imgWidth = pdfWidth;
    const imgHeight = (img.height * imgWidth) / img.width;

    if (imgHeight <= pdfHeight) {
      pdf.addImage(dataUrl, "PNG", 0, 0, imgWidth, imgHeight);
    } else {
      const scale = pdfWidth / img.width;
      const scaledHeight = img.height * scale;
      pdf.addImage(dataUrl, "PNG", 0, 0, pdfWidth, scaledHeight);
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
