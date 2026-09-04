# SIM-SPPG

Sistem Informasi Manajemen SPPG berbasis frontend statis, Cloudflare Pages, dan Supabase Edge Functions.

## Struktur inti

- `index.html` — markup aplikasi, komponen halaman/modal, dan CSS antarmuka.
- `app.js` — logika utama aplikasi, state, integrasi API, validasi, dan navigasi.
- `assets/js/reports/` — modul ekspor dan ringkasan laporan yang melengkapi pusat laporan pada `app.js`.
- `_worker.js` — penyajian asset runtime Cloudflare Pages, style modern, dan proteksi Turnstile login.
- `sw.js` — service worker PWA dengan strategi network-first untuk navigasi dan JavaScript.
- `manifest.json` — metadata instalasi PWA.

Frontend mengakses backend melalui Supabase Edge Functions modular sesuai hak akses pengguna.

## Aturan pengembangan

1. Jangan menduplikasi handler atau generator laporan global.
2. Jangan menambahkan runtime laporan baru yang menimpa handler global; perluas pusat laporan pada `app.js` atau modul terkait di `assets/js/reports/`.
3. PDF harus dibuat langsung dengan jsPDF; mode PDF tidak boleh membuka raw HTML melalui `about:blank`.
4. Kolom teknis seperti path file, UUID internal, token, dan data mentah tidak boleh menjadi kolom utama laporan bisnis.
5. Setelah mengubah asset utama, naikkan versi cache pada `_worker.js` dan `sw.js`.
6. Jangan menyimpan `service_role`, password database, JWT secret, SMTP password, atau VAPID private key di repository.
7. Perubahan permanen harus diedit langsung pada source aktif. Hindari menambah workflow `apply-*` yang mengubah source lalu melakukan commit otomatis ke `main`.
8. Skrip migrasi atau patch satu kali harus dihapus setelah hasilnya sudah masuk ke source utama dan tervalidasi.

## Pemeriksaan sebelum rilis

- Login, logout, pemulihan akun, dan pemeriksaan sesi.
- Navigasi seluruh menu berdasarkan role.
- Transaksi, approval, pending payment, master data, survei, serah terima, menu MBG, dan profil.
- Menu Laporan hanya menampilkan pusat laporan profesional.
- PDF terunduh langsung dengan cover dan Ringkasan Eksekutif; tidak membuka template tabel mentah di `about:blank`.
- Excel memiliki sheet ringkasan, transaksi, dan approval sesuai section terpilih.
- Modal, toast, loading state, fokus keyboard, dan tampilan responsif.
- Instalasi PWA, refresh setelah deployment, dan mode offline untuk shell aplikasi.
