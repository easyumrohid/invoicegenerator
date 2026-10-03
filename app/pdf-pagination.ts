export interface PDFBlock { top: number; bottom: number }

/** Batas halaman pada koordinat gambar. Blok sangat tinggi dipecah pada baris teksnya. */
export function paginatePDF(height: number, capacity: number, blocks: PDFBlock[]) {
  if (!Number.isFinite(height) || height <= 0 || !Number.isFinite(capacity) || capacity <= 0) throw new Error('Ukuran PDF tidak valid');
  const protectedBlocks = blocks.filter(b => Number.isFinite(b.top) && Number.isFinite(b.bottom) && b.bottom > b.top && b.bottom - b.top <= capacity);
  const pages: {top: number; bottom: number}[] = [];
  let top = 0;
  while (top < height) {
    let bottom = Math.min(height, top + capacity);
    for (let pass = 0; pass <= protectedBlocks.length; pass++) {
      const crossing = protectedBlocks.filter(b => b.top > top && b.top < bottom && b.bottom > bottom);
      if (!crossing.length) break;
      bottom = Math.floor(Math.min(...crossing.map(b => b.top)));
    }
    if (bottom <= top) throw new Error('Tidak menemukan batas halaman PDF yang aman');
    pages.push({top, bottom});
    top = bottom;
  }
  return pages;
}
