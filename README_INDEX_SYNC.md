# Sinkronisasi Index SIM-SPPG

`index.html` adalah bootstrap kecil yang memuat `app-source.html`, lalu menormalisasi konfigurasi deployment sebelum aplikasi dijalankan.

Normalisasi yang diterapkan:

- path manifest relatif terhadap folder deployment
- registrasi service worker relatif terhadap `document.baseURI`
- pemuatan eksplisit `supabase-config.js`
- pemuatan langsung `notification-enhancement.js`
- penghapusan blok pembaruan profil yang terduplikasi

`app-source.html` mempertahankan source aplikasi monolitik sebelumnya tanpa kehilangan fitur. Untuk perubahan fitur aplikasi besar, edit `app-source.html`; untuk perubahan bootstrap/deployment, edit `index.html`.
