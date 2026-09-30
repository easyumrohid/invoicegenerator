# Mengaktifkan database easyUmroh

Kode sudah mendukung Supabase, tetapi belum terhubung ke proyek sungguhan. Buat proyek Supabase terlebih dahulu. Tidak ada kredensial akun atau service-role key di paket ini.

## 1. Buat proyek dan tabel

1. Masuk ke https://supabase.com/dashboard dan buat proyek.
2. Di SQL Editor, jalankan isi `supabase/schema.sql` satu kali. Script boleh dijalankan ulang.
3. Di Authentication → Users, buat akun admin dengan email dan password (konfirmasi email saat membuat akun jika diperlukan). Tidak ada pendaftaran publik di aplikasi. Matikan **Allow new users to sign up** pada konfigurasi Auth jika hanya memakai akun yang dibuat admin.
4. Salin UUID pengguna tersebut. Di SQL Editor jalankan:

```sql
insert into public.invoice_admins (user_id)
values ('GANTI_DENGAN_UUID_USER_ADMIN')
on conflict do nothing;
```

Tambah baris UUID untuk admin lain yang diizinkan. Semua admin dalam proyek ini mengakses riwayat easyUmroh yang sama. Pengguna tanpa baris admin tidak dapat membaca atau mengubah invoice, sekalipun berhasil login.

## 2. Konfigurasi aplikasi

Ambil Project URL dan **Publishable key** dari pengaturan/API proyek Supabase. Legacy **anon key** juga didukung. Jangan pakai **Secret key/service_role key** di variabel NEXT_PUBLIC atau kode browser.

Untuk lokal, salin `.env.example` menjadi `.env.local`, lalu isi:

```env
NEXT_PUBLIC_SUPABASE_URL=https://PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=KEY_PUBLISHABLE_PROYEK_ANDA
```

```bash
npm ci
npm run dev
```

Untuk Vercel, tambahkan dua variabel dengan nama yang sama di Settings → Environment Variables. Pilih lingkungan yang digunakan, kemudian redeploy. Variabel NEXT_PUBLIC dibaca pada saat build. Gunakan paket hosting yang mengizinkan penggunaan bisnis.

## 3. Pindahkan riwayat lama

Buka aplikasi pada **browser dan alamat website yang masih menyimpan riwayat lama**, lalu login. Tombol **Pindahkan … INV dari browser** akan muncul jika riwayat ditemukan. Pemindahan tidak menghapus cadangan lokal.

Jika aplikasi berada di domain berbeda, ekspor CSV dari aplikasi lama lalu gunakan **Upload CSV** pada aplikasi baru. Data localStorage tidak berpindah otomatis antar domain/perangkat. Draft lama juga tidak otomatis dimigrasikan; masukkan ke riwayat/ekspor dahulu.

Impor adalah satu transaksi: jika satu nomor bentrok dengan invoice aktif, seluruh batch ditolak dan tidak ada perubahan sebagian. Keluarkan invoice yang sudah ada dari CSV sebelum mencoba lagi. Impor CSV dapat memulihkan invoice yang riwayatnya telah dihapus dengan nomor yang sama; ini merupakan pemulihan arsip secara sengaja, bukan penerbitan invoice baru.

Nomor dari invoice yang sudah dihapus **sebelum migrasi** tidak dapat diketahui tanpa arsip lama. Impor arsip CSV lama terlebih dahulu agar nomor tersebut tercatat; setelah memeriksa hasilnya, riwayat yang tidak diperlukan boleh dihapus lagi. Nomor yang tercatat akan tetap dilindungi.

## 4. Pemakaian harian

- Preview dan perubahan form masih berupa draft lokal, terpisah per akun/browser.
- **Simpan INV** menyimpan invoice ke database tanpa membuat PDF. Isi deskripsi setiap item sebelum menyimpan.
- **Download PDF** menyimpan data invoice ke database terlebih dahulu, lalu mengunduh PDF ke komputer. Tidak ada PDF yang diunggah ke database.
- Jika PDF gagal setelah data tersimpan, invoice tetap ada di riwayat. Buka/unduh ulang menggunakan record yang sama.
- Nomor awal adalah saran berdasarkan tanggal dan catatan nomor. Draft yang belum disimpan belum memakai nomor. Jika dua perangkat menyimpan nomor yang sama, hanya penyimpanan pertama yang diterima. Perangkat kedua harus membuat invoice baru/menyesuaikan nomor, bukan menimpa invoice pertama.
- Nomor invoice tersimpan tidak dapat diubah. Untuk invoice baru, gunakan **Buat INV Baru**. Membuka invoice lama lalu mengedit nama customer tetap berarti mengedit invoice tersebut.
- Perubahan dari perangkat lain diperiksa menggunakan versi. Jika ada konflik, buka ulang invoice melalui Riwayat. Tidak ada penimpaan otomatis.
- Riwayat mengambil seluruh halaman data, termasuk jika jumlahnya lebih dari 1.000. Gunakan **Muat ulang** untuk melihat perubahan terbaru dari perangkat lain; tidak ada langganan realtime.

## 5. Arsip bulanan

1. Buka Riwayat dan tentukan Dari/Sampai tanggal invoice.
2. Klik **Export CSV**, simpan di komputer dan periksa isi serta kelengkapannya.
3. Klik **Hapus hasil filter** untuk menghapus invoice sesuai filter; atau Hapus Semua Riwayat untuk seluruh data yang sedang dimuat.
4. Penghapusan dicegah jika invoice berubah di database setelah riwayat dimuat. Muat ulang, ekspor ulang, lalu coba lagi.
5. Tabel `invoice_numbers` **tidak ikut dihapus**. Nomor, ID, dan waktu pemakaian tetap ada; data pelanggan/item/pembayaran ada di `invoices`, bukan di tabel nomor.

CSV adalah arsip data dan dapat diimpor kembali, bukan salinan PDF. Simpan CSV dan PDF pada tempat cadangan yang sesuai. Catatan nomor tetap bertambah sedikit setiap invoice diterbitkan, jadi ukuran database tidak benar-benar kembali nol.

## Struktur dan akses

- `invoice_admins`: akun yang diberi akses oleh pemilik proyek.
- `invoice_numbers`: ledger nomor permanen; nomor unik dan ID invoice.
- `invoices`: JSON pelanggan, item, biaya dan pembayaran untuk riwayat aktif.
- RLS membatasi pembacaan untuk admin. Perubahan lewat RPC dengan pemeriksaan admin, transaksi, dan lock untuk mencegah perebutan nomor.
- Ledger tidak memiliki jalur hapus pada aplikasi. Pemilik database masih bisa mengubahnya lewat SQL Editor; jangan hapus tabel ini saat arsip bulanan.
- Draft menggunakan localStorage per akun. Logout tidak menghapus draft; gunakan perangkat tepercaya atau hapus data situs setelah selesai pada perangkat bersama.
- Paket Supabase gratis memiliki kuota dan kebijakan jeda proyek; periksa pemakaian di dashboard. Tidak ada backup otomatis yang disiapkan oleh kode ini.

## Pemeriksaan

```bash
npm run typecheck
npm test
npm run build
```

Pengujian SQL dijalankan pada PostgreSQL lokal melalui PGlite, dengan simulasi role/Auth Supabase. Pengujian koneksi proyek Supabase sungguhan harus dilakukan setelah konfigurasi: login admin/non-admin, simpan INV, buka dari perangkat lain, ekspor CSV, hapus riwayat, dan pastikan nomor lama tetap ditolak.
