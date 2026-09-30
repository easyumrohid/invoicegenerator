# EasyUmroh Invoice Generator — perbaikan

Paket ini dirakit dari 18 source yang dilampirkan. Konfigurasi package/TypeScript/PostCSS/Next disediakan agar bisa dijalankan mandiri. Jika memasukkan patch ke proyek lama, pertahankan konfigurasi khusus proyek yang masih diperlukan.

## Menjalankan

Gunakan Node.js 22+ (sesuai dukungan SDK Supabase yang disertakan).

```bash
npm ci
npm run dev
```

Buka http://localhost:3000. Pemeriksaan: `npm run typecheck`, `npm test`, dan `npm run build`.

Semua source komponen dan CSS berada dalam `app/`; gunakan seluruh paket terbaru termasuk modul database/Auth dan `supabase/schema.sql`. Nama file sudah dinormalisasi tanpa `(1)` agar cocok dengan impor.

## Aset dan data perusahaan

Buat folder `public/` dan tambahkan aset asli berikut:

- `logo_header.png`
- `logo_footer.png`
- `qreasyumroh.png`
- `ttdanas.png`

Aset ini tidak disertakan dalam lampiran. Jangan menganggap QR atau tanda tangan sudah tersedia. Aplikasi menyembunyikan gambar gagal dimuat; ekspor menghapus gambar yang tidak bisa dibaca. Favicon asli tersedia di `app/favicon.ico`.

Periksa `app/constants.ts`, khususnya nama perusahaan, kontak, dan rekening. Nomor Mandiri bawaan mengandung huruf A dan belum diverifikasi; ganti dengan nomor rekening asli. Sesuaikan nama penandatangan pada komponen Invoice/Kwitansi.

## Penyimpanan database

Ikuti **PANDUAN_DATABASE.md** sebelum menjalankan aplikasi. Riwayat invoice sekarang memakai Supabase dengan login admin. Draft masih lokal per akun/browser. Tidak ada fallback riwayat lokal jika koneksi database gagal.

Tabel `invoices` menyimpan data JSON invoice, sedangkan `invoice_numbers` mencatat nomor permanen. Menghapus riwayat tidak menghapus catatan nomor. Tombol Simpan INV menyimpan tanpa PDF; Download PDF menyimpan data lebih dahulu kemudian mengunduh ke komputer.

Nomor yang sama tidak dapat dipakai untuk invoice baru, termasuk setelah riwayat dihapus. Impor CSV dapat memulihkan arsip yang telah dihapus; impor tidak menimpa invoice aktif yang nomor sama. Semua perubahan batch dilakukan dalam satu transaksi.

Nomor baru memakai urutan terkecil yang belum pernah tercatat untuk tanggal terpilih. Pemeriksaan atomik di database mencegah bentrok antarperangkat. Invoice yang diedit memiliki pemeriksaan versi untuk mencegah penimpaan perubahan perangkat lain.

Pemindahan riwayat localStorage tersedia setelah login, atau gunakan ekspor/impor CSV untuk domain berbeda. PDF tidak disimpan di database.

## Biaya, pembayaran, dan rekap

Diskon, Tax, dan Service Fee masing-masing memiliki pilihan input Nominal (Rp) atau Persentase (%). Kombinasi antarbiaya diperbolehkan: misalnya Diskon 10%, Tax 11%, dan Service Fee Rp20.000. Diskon persen memakai subtotal; Tax dan Service Fee persen memakai subtotal setelah diskon. Nominal hasil persen dibulatkan ke rupiah terdekat. Mengganti jenis input mereset nilai field tersebut ke nol untuk menghindari penafsiran nominal sebagai persen.

Pilihan pembayaran setiap cicilan: Mandiri, BNI, Cash. Memilih Cash menghapus bank tujuan cicilan. Pembayaran tunggal format lama tetap dipertahankan ketika menambahkan cicilan baru.

Riwayat memiliki filter Dari/Sampai tanggal invoice (inklusif), bisa digabungkan dengan pencarian dan status. Kartu total Mandiri, BNI, Cash mengikuti invoice yang lolos filter; setiap cicilan dihitung menurut metodenya. Kategori Lainnya/Belum ditentukan menampung pembayaran lama tanpa bank, agar tidak dianggap Mandiri atau BNI tanpa bukti. Filter berdasarkan tanggal invoice, bukan tanggal setiap cicilan.

Ekspor CSV mengikuti filter yang aktif; menyimpan mode biaya, rekening, cicilan, total, status, dan total dibayar. Kolom lama pajak/biaya_admin masih diterima saat impor; ekspor baru memakai tax/service_fee. Field internal lama tetap dipertahankan untuk kompatibilitas JSON/localStorage.

## Perbaikan scroll Riwayat Invoice

Isi modal (ringkasan, filter, dan daftar) memakai satu area scroll vertikal dengan tinggi minimum nol dalam layout flex. Judul/tombol tutup dan footer tetap di luar area scroll. Tinggi modal mengikuti viewport; tabel bisa digulir horizontal pada layar sempit. Tidak perlu mengganti data atau membersihkan localStorage. Untuk menerapkan hanya perbaikan ini pada versi revisi biaya sebelumnya, ganti `app/InvoiceHistory.tsx`.

## Catatan invoice terbaru

Catatan menjadi satu paragraf tanpa nomor dan tanpa huruf tebal. Ketentuan membayar sesuai nominal invoice dihapus; empat ketentuan lainnya dipisahkan dengan tanda baca. Header invoice polos biru tanpa motif bulan sabit. Untuk menerapkan hanya perubahan ini, salin `app/Invoice.tsx` dan `app/invoice.css` dari paket terbaru.

## Template CSV terbaru

Tombol Download Template CSV menggunakan kolom dan serializer yang sama dengan ekspor riwayat. Template menyertakan beberapa item untuk satu invoice, cicilan Mandiri/BNI, contoh Cash, array rekening, dan biaya campuran Rp/%. Kolom `total` serta `status` adalah informasi; keduanya dihitung ulang saat impor. `diskon_mode`, `tax_mode`, `service_fee_mode` berisi `nominal` atau `percent`; persentase ditulis angka tanpa tanda %. Nilai tanggal contoh perlu diganti. Nama/nomor rekening bertanda `ISI_...` adalah placeholder dan wajib diganti sebelum digunakan. Jika tidak ada cicilan/rekening, gunakan array `[]` pada kolom JSON. Nominal angka tanpa pemisah ribuan, desimal memakai titik.

File contoh tersedia sebagai `template-invoice.csv`. Header kolom di modal upload bisa membungkus ke baris berikutnya agar tidak terpotong. Untuk menerapkan revisi ini saja, ganti `app/CSVUpload.tsx`, `app/storage.ts`, `app/Invoice.tsx`, dan `app/invoice.css`.

## Download saja

Tombol Cetak Invoice dan handler window.print dihapus. Keluaran invoice/kwitansi melalui Download PDF. Paket database terbaru harus diterapkan lengkap sesuai panduan.
