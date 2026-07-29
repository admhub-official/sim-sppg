# Supabase Egress Audit

## Scope

Audit ini mencakup pemanggilan Supabase dari frontend, Edge Functions, PostgREST,
dan Storage. Fokus perubahan adalah jalur baca yang paling sering dipanggil:
transaksi, approval, data operasional, master data, audit log, notifikasi, dan
dashboard reporting.

## Temuan utama

- Beberapa endpoint menerima `page` dan `pageSize`, tetapi mengambil seluruh
  tabel lalu melakukan `slice()` di Edge Function.
- Query transaksi mengambil seluruh kolom dan seluruh dokumen terkait sebelum
  pagination.
- Pemeriksaan kepemilikan data operasional menjalankan lookup user per baris
  (pola N+1).
- Polling notifikasi mengambil kolom audit besar seperti `OLD_VALUE` dan
  `NEW_VALUE`, padahal tidak dirender.
- Fetch identik akibat render ulang tidak memiliki cache baca di browser.
- Upload Storage belum memasang metadata `cacheControl`.

## Perubahan

- Proyeksi kolom eksplisit menggantikan `SELECT *` pada jalur daftar utama.
- Filter akses dan `.range()` dijalankan di PostgREST sebelum hasil keluar dari
  database.
- Dokumen, payment proof, dan detail menu diambil secara batch hanya untuk ID
  pada halaman aktif.
- Lookup pemilik per baris diganti satu lookup user terbatch.
- Cache memory-only per sesi diterapkan dengan TTL 5–300 detik sesuai jenis data
  dan dibersihkan hanya setelah fungsi yang terdaftar sebagai mutasi.
- Object Storage baru diberi `cacheControl: '3600'`; nama object bersifat unik
  sehingga cache tidak menyajikan replacement yang kedaluwarsa.

### Follow-up Approval

- Halaman Approval sekarang selalu mengirim `page` dan `pageSize`.
- Edge Function mengambil kandidat antrean dengan proyeksi kolom tipis untuk
  menghitung total, nominal KPI, opsi filter, dan ID halaman.
- Detail transaksi, dokumen, dan payment proof hanya diambil untuk ID halaman
  aktif. Pengambilan seluruh detail hanya diizinkan ketika pengguna secara
  eksplisit menjalankan export.

## Pengukuran representatif

Pengukuran dilakukan pada 29 Juli 2026 menggunakan ukuran JSON Postgres, tanpa
memasukkan overhead HTTP:

| Jalur | Sebelum | Sesudah (halaman 15 baris) |
| --- | ---: | ---: |
| Transaksi | 359 baris / 376.019 byte | 15 baris / 8.217 byte |
| Dokumen transaksi | 449 baris / 286.186 byte | 55 baris / 25.404 byte |
| Total representatif | 662.205 byte | 33.621 byte |

Reduksi representatifnya sekitar 95%. Penghematan aktual bergantung pada role,
filter, jumlah dokumen per transaksi, pola navigasi, dan cache hit rate.

## Verifikasi

- `node --check app.js`
- `node scripts/check-egress-regression.mjs`
- `deno check` untuk seluruh entrypoint Edge Function yang disentuh
- `git diff --check`
- Supabase performance dan security advisors

Tidak ada migration database yang ditambahkan karena index utama untuk filter
transaksi, dokumen, payment proof, menu, survei, dan serah-terima sudah tersedia.
Advisor keamanan masih melaporkan isu lama seperti view `SECURITY DEFINER` dan
fungsi privileged yang dapat dieksekusi role publik; isu tersebut berada di luar
scope optimasi egress dan perlu hardening terpisah.
