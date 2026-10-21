# Belanja Bahan Pangan SPPG

Satu input nota -> PO per nota, RAB harian, BBBP bulanan. Data di Supabase, bisa diunduh sebagai Excel.

## Struktur proyek
    index.html          halaman utama
    css/style.css       tampilan (Poppins, biru #5A81FA / #2C3D8F)
    js/config.js        URL+key Supabase, data SPPG, nama penanda tangan, kop PO   <- edit di sini
    js/master-data.js   daftar bahan, supplier, dan sekolah awal
    js/utils.js         format rupiah & tanggal
    js/store.js         state aplikasi + akses database
    js/reports.js       perhitungan PO / RAB / BBBP (dipakai tampilan dan Excel)
    js/views.js         tampilan tiap tab
    js/excel.js         penghubung data aplikasi -> Excel dan cetak
    js/sheet-html.js    mengubah sheet Excel menjadi halaman cetak (format sama dengan contoh)
    js/excel-builder.js pembuat file Excel yang menyalin format dari templates/
    templates/          3 file contoh asli (PO.xlsx, RAB.xlsx, BBBP.xlsx) + logo.png (tampilan layar) - JANGAN dihapus
    js/main.js          penghubung: render + penanganan klik/ketik
    schema.sql          tabel + aturan keamanan Supabase

## Pasang
1. **Supabase**: buat project -> SQL Editor -> jalankan `schema.sql` -> Authentication > Users > Add user
   (email + kata sandi) -> matikan *Allow new users to sign up* -> Project Settings > API: salin URL dan anon key.
2. **Konfigurasi**: tempel URL dan anon key di `js/config.js`. Jangan pakai key `service_role`.
3. **GitHub Pages**: upload seluruh isi folder ke repository, lalu Settings > Pages > Deploy from a branch > main / root.

## Menjalankan di komputer
Aplikasi memakai ES modules, jadi tidak bisa dibuka dengan klik dua kali (file://). Jalankan server lokal:
    python -m http.server 8000     # lalu buka http://localhost:8000
atau pakai ekstensi Live Server di VS Code.

## Mengubah data tetap
- Nama pejabat, kode PO, pagu default: `js/config.js`
- Daftar bahan/supplier/sekolah awal: `js/master-data.js` (bahan & supplier baru otomatis tersimpan di database)

## BBBP (Buku Bantu Bahan Pangan)
- Tab **BBBP**: pilih rentang tanggal (Dari - Sampai) atau klik nama bulan untuk satu bulan penuh.
  Rentang yang sama dipakai untuk tampilan, **Cetak**, dan **Unduh Excel**.
- File hasil unduhan: `BBBP_SEP.xlsx` untuk satu bulan penuh, atau `BBBP_2026-09-01_sd_2026-09-15.xlsx` untuk rentang bebas.
- Logo instansi mengikuti file contoh `templates/BBBP.xlsx`; alamat kop diatur di `js/config.js` (`INSTANSI.alamat`).

## Memilih tanggal (tab Nota / PO dan RAB Harian)
Satu bilah navigasi: tombol panah (tanggal sebelumnya/berikutnya), pilihan bulan, dan pilihan tanggal.
Di tab Nota / PO, tombol di bawahnya hanya menampilkan nota pada tanggal yang dipilih (PO_01, PO_02, ...), jadi
tetap ringkas walaupun nota sudah ratusan.

## Anggaran Bahan Makanan (tab Anggaran)
- Ringkasan per tanggal yang **diturunkan dari RAB Harian**: jumlah paket KECIL (pagu 8.000) dan BESAR (pagu 10.000) dihitung
  dari jumlah siswa yang Anda isi di RAB; total anggaran = pagu RAB; realisasi = total belanja hari itu; selisih = anggaran - realisasi.
- Tanggal yang belum ada nota tetap tampil (sel realisasi/selisih berwarna kuning). Untuk mengisi jumlah siswa hari berikutnya,
  buka tab RAB Harian, lalu pakai "atau buka tanggal lain".
- Klik tanggal di tabel untuk membuka RAB Harian tanggal itu. Rentang tanggal sama dengan tab BBBP.
- Unduh: `ANGGARAN_SEP.xlsx` (satu bulan penuh) atau `ANGGARAN_2026-09-14_sd_2026-09-25.xlsx` (rentang bebas).
- Kop dan logo disalin dari `templates/BBBP.xlsx`; kop (alamat 2 baris) dan nama penanda tangan ada di `js/config.js` (`ANGGARAN`).
