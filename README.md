# SIM-SPPG

Sistem Informasi Manajemen SPPG berbasis frontend statis, GitHub Pages, dan Supabase Edge Function.

## Struktur inti

- `index.html` — bootstrap aplikasi dan normalisasi deployment
- `app-source.html` — source utama antarmuka dan logika aplikasi
- `sw.js` — service worker, cache offline, dan push notification
- `manifest.json` — konfigurasi PWA
- `notification-enhancement.js` — penyempurnaan tampilan pusat notifikasi
- `supabase-config.js` — konfigurasi publik frontend dan health check Edge Function

## Pengembangan

Untuk perubahan fitur aplikasi, edit `app-source.html`. Untuk startup dan deployment, edit `index.html`. Untuk cache offline dan push notification, edit `sw.js`.

Frontend mengakses backend melalui Edge Function Supabase `dynamic-action`. Jangan menyimpan `service_role`, password database, JWT secret, SMTP password, atau VAPID private key di repository. Hanya publishable key yang boleh berada di frontend.