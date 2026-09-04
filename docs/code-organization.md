# Struktur Kode SIM-SPPG

Dokumen ini menjadi panduan penempatan kode agar frontend dan backend tetap mudah dipahami tanpa mengubah perilaku aplikasi.

## Frontend

- `app.js`: bundle legacy utama. Jangan menambahkan fitur baru langsung ke file ini bila dapat dibuat sebagai modul terpisah.
- `assets/js/supplier/app-dropdowns.js`: komponen dropdown, autocomplete, dan combobox supplier.
- `assets/js/reports/`: modul ekspor, print, dan ringkasan laporan.
- `transaction-category-supplier-rules.js`: aturan kategori transaksi dan supplier.
- `_worker.js`: routing Cloudflare Worker/Pages.
- `sw.js`: service worker dan cache PWA.

Modul frontend baru harus:

1. Memiliki satu tanggung jawab utama.
2. Tidak mendeklarasikan ulang helper global yang sudah tersedia.
3. Mengekspos API global secara eksplisit melalui `window` hanya bila dibutuhkan oleh HTML legacy.
4. Lolos `node --check` sebelum digabung.

## Backend Supabase

- Setiap Edge Function berada di `supabase/functions/<nama-fungsi>/`.
- `index.ts` hanya menangani entry point, autentikasi awal, routing action, dan response HTTP.
- Query, validasi, mapping, serta helper bisnis ditempatkan di modul terpisah dalam folder fungsi yang sama.
- Shared helper lintas fungsi ditempatkan pada `supabase/functions/_shared/`.

## Migration

- Nama file wajib menggunakan format `<timestamp>_<nama_snake_case>.sql`.
- Timestamp tidak boleh dipakai lebih dari sekali.
- Migration yang sudah diterapkan tidak boleh diubah atau diganti nama.
- Perubahan schema baru selalu dibuat sebagai migration baru.
- Workflow tidak boleh menghapus folder migration atau mengubah history menjadi `reverted` secara massal.

## Aturan Refactor Aman

- Refactor struktur dilakukan terpisah dari perubahan fitur.
- Tidak mengubah nama action API, nama kolom database, ID elemen HTML, atau kontrak response.
- Satu PR refactor hanya menyentuh satu area agar mudah direview dan di-rollback.
- Pemecahan `app.js` dilakukan bertahap setelah fungsi target memiliki regression check.
