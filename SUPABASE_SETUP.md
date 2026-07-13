# Integrasi Supabase SIM-SPPG

Repository ini terhubung ke project Supabase **sim-sppg**.

## Konfigurasi aktif

- Project ref: `dmjsgtichrfxhyywstrt`
- Region: `ap-southeast-1`
- Edge Function: `dynamic-action`
- Frontend API endpoint: `https://dmjsgtichrfxhyywstrt.supabase.co/functions/v1/dynamic-action`
- Konfigurasi frontend: `supabase-config.js`

## Arsitektur

Frontend GitHub Pages tidak mengakses database menggunakan secret key. Semua operasi sensitif diteruskan ke Edge Function `dynamic-action`.

Edge Function menangani:

- Supabase Auth dan validasi access token
- Query database dan pembatasan akses berdasarkan role
- Upload dan signed URL Supabase Storage
- Audit log
- Notifikasi dan push subscription

## Aturan keamanan

- Hanya publishable key yang boleh berada di repository publik.
- Jangan menyimpan `service_role`, database password, JWT secret, SMTP password, atau VAPID private key di GitHub.
- Secret backend harus disimpan sebagai Supabase Edge Function secrets.
- Semua tabel pada schema yang terekspos harus menggunakan RLS.

## Pemeriksaan koneksi

Buka `supabase-healthcheck.html` melalui GitHub Pages. Halaman tersebut akan memanggil endpoint GET Edge Function dan menampilkan status koneksi.

Dari JavaScript aplikasi, pemeriksaan dapat dilakukan dengan:

```js
SIM_SPPG_SUPABASE.healthCheck()
  .then(console.log)
  .catch(console.error);
```

## Pengembangan backend

Source Edge Function aktif saat ini dikelola di Supabase dengan slug `dynamic-action`. Saat source disinkronkan ke repository, gunakan struktur standar:

```text
supabase/
  functions/
    dynamic-action/
      index.ts
```

Deploy hanya menggunakan Supabase CLI atau integrasi resmi, dan jangan menaruh secret langsung di source code.
