# SIM-SPPG

Sistem Informasi Manajemen SPPG berbasis frontend statis, GitHub Pages, dan Supabase Edge Function.

## Struktur inti

- `index.html` — seluruh antarmuka dan logika utama aplikasi
- `app.js` — satu-satunya file JavaScript eksternal untuk enhancement antarmuka
- `sw.js` — service worker, cache offline, injeksi `app.js`, dan push notification
- `manifest.json` — konfigurasi PWA

## Pengembangan

Untuk perubahan fitur utama aplikasi, edit `index.html`. Untuk enhancement JavaScript eksternal, edit `app.js`. Untuk cache offline dan push notification, edit `sw.js`.

Frontend mengakses backend melalui Edge Function Supabase `dynamic-action`. Jangan menyimpan `service_role`, password database, JWT secret, SMTP password, atau VAPID private key di repository.
