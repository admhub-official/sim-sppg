# Audit Teknis SIM-SPPG

Tanggal audit: 14 Juli 2026

## Ruang lingkup

- frontend `index.html`
- PWA dan service worker
- pusat notifikasi
- konfigurasi Supabase
- manifest aplikasi
- keamanan konfigurasi publik

## Bug yang diperbaiki

1. **Polling tanpa batas pada enhancement notifikasi**
   - Script sebelumnya terus menjalankan `setTimeout` pada halaman yang tidak memiliki panel notifikasi.
   - Dibatasi maksimal 40 percobaan dan dihentikan pada halaman non-aplikasi.

2. **Aksesibilitas item notifikasi**
   - Item sebelumnya hanya efektif diklik menggunakan pointer.
   - Ditambahkan dukungan tombol Enter dan Space serta fokus keyboard yang terlihat.

3. **Cache PWA tidak kompatibel dengan subfolder GitHub Pages**
   - Cache sebelumnya menggunakan root domain (`/`).
   - Aset sekarang dihitung dari `self.registration.scope`.

4. **URL notifikasi push dapat keluar dari scope aplikasi**
   - Fallback sebelumnya selalu `/`.
   - URL sekarang diselesaikan relatif terhadap scope aplikasi.

5. **Offline fallback tidak konsisten**
   - Navigasi offline sekarang menggunakan halaman utama dari scope aplikasi apabila URL spesifik tidak ada di cache.

6. **Manifest belum memiliki identitas dan scope eksplisit**
   - Ditambahkan `id`, `scope`, `lang`, dan ikon maskable.

7. **Health check Supabase dapat menggantung**
   - Ditambahkan timeout, `no-store`, validasi respons non-JSON, dan pesan error HTTP yang lebih informatif.

## Temuan lanjutan

- `index.html` masih merupakan satu file sangat besar. Pemisahan CSS dan JavaScript menjadi modul akan mengurangi risiko regresi dan mempermudah pengujian.
- Source Edge Function `dynamic-action` belum tersimpan di repository, sehingga audit backend penuh dan versioning perubahan backend belum dapat dilakukan dari GitHub.
- Registrasi service worker dan link manifest di `index.html` masih perlu dinormalisasi menjadi path relatif saat frontend mulai dipisahkan dari file monolitik.
- Belum terdapat automated test atau lint workflow untuk memeriksa syntax JavaScript, JSON, dan service worker pada setiap pull request.

## Rekomendasi prioritas berikutnya

1. Sinkronkan source Edge Function ke `supabase/functions/dynamic-action/index.ts`.
2. Pecah `index.html` menjadi `app.js`, `styles.css`, dan modul per fitur.
3. Tambahkan CI untuk syntax check, JSON validation, dan smoke test halaman.
4. Tambahkan pengujian role/RBAC dan RLS menggunakan akun uji terpisah.
