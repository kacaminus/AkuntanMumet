# Belanja Bahan Pangan SPPG

Satu input nota -> PO per nota, RAB harian, BPPP bulanan. Data di Supabase, bisa diunduh sebagai Excel.

## Struktur proyek
    index.html          halaman utama
    css/style.css       tampilan (Poppins, biru #5A81FA / #2C3D8F)
    js/config.js        URL+key Supabase, data SPPG, nama penanda tangan, kop PO   <- edit di sini
    js/master-data.js   daftar bahan, supplier, dan sekolah awal
    js/utils.js         format rupiah & tanggal
    js/store.js         state aplikasi + akses database
    js/reports.js       perhitungan PO / RAB / BPPP (dipakai tampilan dan Excel)
    js/views.js         tampilan tiap tab
    js/excel.js         penghubung data aplikasi -> Excel
    js/excel-builder.js pembuat file Excel yang menyalin format dari templates/
    templates/          3 file contoh asli (PO.xlsx, RAB.xlsx, BPPP.xlsx) - JANGAN dihapus
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
