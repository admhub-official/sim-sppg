# SIM-SPPG

Sistem Informasi Manajemen SPPG berbasis frontend statis, GitHub Pages, dan Supabase Edge Function.

## Struktur inti

- `index.html` — seluruh HTML, CSS, dan JavaScript frontend aplikasi.
- `sw.js` — service worker untuk cache offline dan push notification.
- `manifest.json` — konfigurasi instalasi PWA.

## Pengembangan

Untuk perubahan tampilan maupun fungsi frontend, edit `index.html`.

Untuk perubahan PWA, cache offline, atau push notification, edit `sw.js`.

Frontend mengakses backend melalui Supabase Edge Function `dynamic-action`.

Jangan menyimpan `service_role`, password database, JWT secret, SMTP password, atau VAPID private key di repository.
