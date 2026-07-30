# Audit UI Supplier Transaksi

Implementasi aktif:

- `transaction-category-supplier-rules.js` menangani daftar kategori dan validasi supplier.
- `supplier-inline-create.js` menangani penyembunyian field rekening pada transaksi, opsi tambah supplier di dropdown, modal supplier, dan pemilihan otomatis setelah simpan.
- `_worker.js` hanya memuat kedua runtime tersebut; tidak ada generator patch supplier yang berjalan setelah merge.
- `sw.js` menggunakan network-first untuk JavaScript dan memasukkan kedua runtime ke app shell.

Komponen usang yang dihapus:

- `.github/workflows/apply-inline-supplier-form.yml`
- `scripts/apply-inline-supplier-form.mjs`
- hint lama yang mengarahkan pengguna keluar dari transaksi menuju menu Data Supplier.
