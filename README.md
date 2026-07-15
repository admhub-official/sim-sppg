# SIM-SPPG

Sistem Informasi Manajemen SPPG berbasis frontend statis, GitHub Pages, dan Supabase Edge Functions.

## Struktur inti

- `index.html` — markup aplikasi, komponen halaman/modal, dan CSS antarmuka.
- `app.js` — seluruh logika frontend, state, integrasi API, validasi, navigasi, laporan, dan event handler.
- `sw.js` — service worker PWA. Navigasi memakai strategi network-first agar deployment terbaru tidak tertahan cache lama.
- `manifest.json` — metadata instalasi PWA.

Frontend mengakses backend melalui Supabase Edge Function `dynamic-action` dan fungsi khusus pengguna yang diizinkan aplikasi.

## Aturan pengembangan

1. Jangan menambahkan JavaScript baru secara inline di `index.html`; tempatkan logika di `app.js`.
2. Jangan menduplikasi handler atau fungsi global. Cari nama fungsi yang sudah ada sebelum menambahkan implementasi baru.
3. Gunakan helper API dan helper sanitasi yang sudah tersedia.
4. Setelah mengubah `index.html`, `app.js`, `sw.js`, atau `manifest.json`, naikkan versi cache di `sw.js` dan query version pada asset utama bila diperlukan.
5. Uji minimal pada desktop, tablet, dan perangkat seluler sebelum deployment.
6. Jangan menyimpan `service_role`, password database, JWT secret, SMTP password, atau VAPID private key di repository.

## Pemeriksaan sebelum rilis

- Login, logout, pemulihan akun, dan pemeriksaan sesi.
- Navigasi seluruh menu berdasarkan role.
- Tambah/edit/hapus transaksi serta upload bukti.
- Approval dan pending payment.
- Master bahan baku dan supplier.
- Survey, serah terima, menu MBG, laporan, dan profil.
- Modal, toast, loading state, fokus keyboard, dan tampilan responsif.
- Instalasi PWA, refresh setelah deployment, serta mode offline untuk shell aplikasi.
