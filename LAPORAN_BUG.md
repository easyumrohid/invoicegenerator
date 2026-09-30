# Hasil audit dan perbaikan

## Bug yang ditemukan dan diperbaiki

| Temuan pada source awal | Perbaikan |
| --- | --- |
| Invoice baru memuat dua pembayaran contoh; invoice lama tanpa riwayat diberi pembayaran contoh | Riwayat awal kosong; data lama dipertahankan; pembayaran tunggal lama masih dihitung |
| Rekening tersimpan yang berjumlah kurang dari dua diganti rekening default | Daftar rekening asli dipertahankan termasuk satu rekening atau kosong |
| Nomor invoice khusus/hasil impor ditimpa efek otomatis saat tanggal dimuat | Nomor hanya dibuat saat membuat invoice, mengganti tanggal melalui form, atau mengosongkan form |
| Counter hanya mengingat satu tanggal; reset mengabaikan nomor yang sudah dicadangkan | Membaca riwayat per tanggal dan memilih urutan terkecil yang belum ada; tanpa counter terpisah |
| Default tanggal menggunakan UTC; tampilan waktu mengikuti zona perangkat | Tanggal hari ini dan waktu cetak menggunakan Asia/Jakarta; tanggal kalender tidak bergeser |
| CSV banyak invoice hanya mengambil invoice pertama sehingga sisanya hilang | Seluruh invoice disimpan dalam riwayat secara atomik |
| CSV ekspor memakai header yang tidak dikenali importer | Header ekspor/import konsisten; header lama dengan spasi juga dikenali |
| Parser CSV gagal pada kutip ganda dan baris baru dalam satu sel; qty nol berubah menjadi satu | Parser mendukung BOM, CRLF, sel multiline, escaped quotes; nol dipertahankan |
| CSV mengizinkan nominal negatif atau salah format/tanggal tanpa validasi | Header wajib, angka, tanggal, konsistensi invoice, dan struktur data diperiksa |
| CSV rekap kehilangan pembayaran dan rekening saat diimpor kembali | Ekspor menyertakan pembayaran tunggal, riwayat cicilan, dan rekening |
| JSON/localStorage rusak atau strukturnya salah menyebabkan render gagal | Validator struktur, jenis data, nominal, dan jumlah item; pembacaan aman |
| Penulisan localStorage dapat gagal tanpa penanganan; riwayat terhapus diam-diam setelah 100 | Pesan gagal simpan/delete, batas 100 dihapus, cadangan JSON ditambahkan |
| CSS kwitansi menimpa CSS invoice melalui kelas global identik | Selector CSS dibatasi ke `.invoice-page` atau `.kwitansi-page` |
| Form-panel berlapis dengan ukuran tetap membuat layout sempit | Container dipisahkan, layout responsif dan aturan cetak diperbaiki |
| PDF hanya satu halaman sehingga bagian bawah dokumen panjang terpotong | Raster dibagi menjadi halaman A4; tunggu font/gambar dan bersihkan wrapper saat gagal |
| Total bisa negatif; sisa tagihan rekap negatif pada kelebihan bayar; status nol tidak konsisten | Total/sisa minimum nol; progress maksimum 100%; invoice nol tidak otomatis dianggap lunas |
| Reset menyisakan referensi dan pembayaran tunggal sebelumnya | Field transaksi terkait dibersihkan |
| Input qty mengubah desimal menjadi angka lain; nominal ekstrem berisiko | Qty menerima desimal; nominal dan jumlah item dibatasi |
| Deklarasi ambient `dom-to-image-more` memakai bentuk default export yang keliru | Default export deklaratif diperbaiki; cast `any` ekspor PDF dihapus |

## Verifikasi

- TypeScript: lulus.
- Build produksi Next.js: lulus.
- 18 uji regresi: lulus. Meliputi migrasi pembayaran lama, putaran ekspor/impor CSV kompleks, angka/tanggal salah, penomoran berbasis daftar, pengisian celah urutan, counter lama diabaikan, daftar rusak ditolak, struktur penyimpanan rusak, status/total nol, 105 riwayat, konflik antarbaris, dan penolakan akses penyimpanan.
- Uji browser Chromium: tanpa `pageerror`; nomor khusus `INV-CUSTOM-123` tetap utuh; pembayaran lama dikenali dan kwitansi tampil; form pada viewport 390 px berukuran 390 px.
- Invoice berisi 35 item berhasil diekspor sebagai PDF A4 dua halaman, diperiksa menggunakan metadata PDF.

## Batasan yang masih perlu diperhatikan

1. Pemeriksaan ini mengurangi bug yang ditemukan; tidak menjamin semua kondisi perangkat/browser bebas bug.
2. Logo, QR, dan tanda tangan tidak ada dalam lampiran. Favicon ada; pesan gagal membaca ICO sebelumnya bukan indikasi build gagal.
3. Nomor rekening bawaan belum diverifikasi (Mandiri mengandung huruf A). Isi rekening dan data perusahaan sebenarnya sebelum digunakan.
4. Versi database memakai ledger nomor unik dan transaksi dengan lock. Nomor pada draft tetap berupa saran; bentrok ditolak saat menyimpan, bukan dicadangkan saat membuka form.
5. Riwayat aktif dan nomor ada di Supabase; draft tetap lokal per akun. Koneksi nyata belum diuji karena proyek/kredensial Supabase belum tersedia. Riwayat harus dimuat ulang untuk melihat perubahan perangkat lain.
6. PDF berbasis raster: teks tidak dapat dicari sebagai teks asli; pemotongan halaman bisa melintasi baris/elemen. Pagination semantik membutuhkan implementasi ekspor terpisah. Uji cetak dan font di perangkat target tetap diperlukan.
7. Invoice lunas mengunduh invoice dan kwitansi sebagai dua berkas; pengaturan browser dapat meminta izin beberapa unduhan.
8. Tanggal kosong, data korup yang tidak valid, nominal negatif, dan item dengan jumlah tidak sesuai qty × harga ditolak. Tidak ada mekanisme pemulihan data korup.
9. Build dibuat dari konfigurasi mandiri, karena package.json dan konfigurasi proyek asli tidak ada pada 18 lampiran turn ini. Integrasi dengan konfigurasi atau backend lain belum diuji.
10. Biaya mendukung nominal/persen seperti dijelaskan pada revisi terbaru. Kwitansi tampil hanya ketika invoice bernilai positif dan lunas.

## Perubahan penomoran lanjutan

Tombol Generate dihapus. Nomor invoice baru otomatis mengikuti daftar riwayat: pilih nomor urut terkecil yang belum dipakai pada tanggal tersebut. Riwayat `0001, 0003` menghasilkan `0002`; riwayat `0001, 0002, 0003` menghasilkan `0004`. Membuka halaman berulang tidak lagi menaikkan nomor. Nomor invoice tersimpan yang sedang diedit tetap dipertahankan. Draft belum tersimpan ke riwayat tidak mencadangkan nomor.

## Revisi biaya dan riwayat pembayaran

- Diskon, Tax, Service Fee: mode Rp atau %, dapat dipadukan antarfield; nilai data lama tanpa mode dianggap nominal.
- Dasar perhitungan persen: diskon dari subtotal; Tax/Service Fee dari subtotal setelah diskon. Pembulatan rupiah terdekat.
- Pembayaran Cash didukung di form, invoice, kwitansi, rekap, dan CSV. Bank tidak dipertahankan ketika Cash dipilih.
- Filter rentang tanggal invoice inklusif dan reset tanggal. Rekap metode mengikuti invoice yang lolos seluruh filter; tanggal cicilan tidak difilter terpisah.
- Ringkasan metode menghitung setiap cicilan Mandiri/BNI/Cash secara terpisah. Bank yang tidak diketahui masuk Lainnya/Belum ditentukan.
- Pengujian tambahan: kombinasi persen/nominal, data biaya lama, ekspor/impor mode biaya, rekap cicilan campuran, Cash dengan bank lama, rentang tanggal inklusif, serta migrasi pembayaran tunggal Cash.

Verifikasi browser revisi biaya: input Diskon 10%, Tax 11%, Service Fee Rp20.000 pada subtotal Rp1.000.000 menghasilkan Rp1.019.000; memilih Cash menghapus bank; filter tanggal menyaring 2 invoice menjadi 1 dan mengubah total Cash dari Rp350.000 ke Rp300.000; Reset Tanggal menampilkan kembali keduanya. Tidak ada pageerror. Build final dan 18 pengujian lulus.

## Perbaikan scroll riwayat

Penyebab: kartu total dan filter memenuhi ruang, sedangkan tabel berada di flex child dengan tinggi menyusut hingga hanya header tabel yang terlihat. Perbaikan: satu body scroll dengan `minHeight: 0`, judul/footer tidak menyusut, dan tinggi modal dibatasi viewport dinamis. Tabel tidak lagi menjadi area flex yang kolaps.

Build lulus. Uji browser dengan 1/80 invoice pada viewport 1280×800, 390×700, serta 1280×480 memastikan invoice terakhir terlihat dan tombol Buka dapat digunakan. Tidak ada pageerror. Data tersimpan tidak perlu dihapus.

## Revisi template CSV, catatan, dan header

Template unduhan dan ekspor memakai satu daftar `CSV_HEADERS` serta serializer yang sama. Uji integrasi memeriksa template dapat diparse kembali, dua baris item menjadi satu invoice, array cicilan Mandiri/BNI/Cash, array rekening, serta mode biaya persen/nominal. Catatan kini satu paragraf biasa tanpa ketentuan "Bayar sesuai nominal pada invoice". SVG dekorasi bulan sabit dan CSS-nya dihapus; latar biru solid tetap dipertahankan. TypeScript, build, dan 18 pengujian lulus.

## Integrasi Supabase

Riwayat kini disimpan lewat RPC Supabase. Login email/password dan allowlist admin melindungi akses. RLS aktif dan hak perubahan tabel langsung dicabut dari role aplikasi. Ledger `invoice_numbers` tetap ada saat riwayat `invoices` dihapus. Tidak ada PDF yang diunggah.

Transaksi batch dan advisory lock melindungi keunikan nomor. Versi `updated_at` diperiksa sebelum update/penghapusan agar perubahan perangkat lain tidak tertimpa atau terhapus setelah CSV lama diekspor. Impor arsip dapat memulihkan invoice yang dihapus, tetapi tidak menimpa invoice aktif.

Pengujian SQL menggunakan PostgreSQL/PGlite dengan simulasi role authenticated/anon, auth.uid(), allowlist admin, RLS, konflik nomor, konflik versi, pemulihan arsip, nomor tetap ada setelah penghapusan, dan rollback batch. Pengujian menggunakan database lokal, bukan proyek Supabase sungguhan.

Konfigurasi dan migrasi dijelaskan di PANDUAN_DATABASE.md. Riwayat lama harus dipindahkan dari origin/browser asli atau CSV; nomor yang sudah terhapus sebelum migrasi hanya dapat dicatat kembali melalui arsip yang masih ada.

Verifikasi final integrasi: 18 uji regresi dan satu rangkaian pengujian PostgreSQL lulus; TypeScript/build lulus. Uji browser dengan API Supabase simulasi memverifikasi login, simpan cloud, nomor tersimpan tidak dapat diubah, ekspor CSV, penghapusan hasil filter, nomor berikutnya setelah penghapusan, pemulihan arsip CSV, serta riwayat pada layar mobile tanpa pageerror.

Kasus tambahan diperbaiki: invoice dengan item tanpa deskripsi sebelumnya dapat disimpan/diunduh tetapi CSV-nya ditolak saat impor. Form dan RPC kini menolak item kosong pada invoice yang disimpan. Draft tetap boleh berisi item kosong saat pengisian.
