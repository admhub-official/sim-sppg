# Audit UI Supplier Transaksi

Implementasi aktif:

- `transaction-category-supplier-rules.js` menangani daftar kategori dan validasi supplier.
- `assets/js/supplier/app-dropdowns.js` menangani dropdown dan opsi tambah supplier.
- `assets/js/transactions/edit-supplier-options-fix.js` menangani pilihan supplier pada form edit secara terpusat.
- `supplier-dropdown.js` memuat modul supplier dan transaksi secara berurutan untuk menjaga kompatibilitas bundle lama.
- `sw.js` menggunakan network-first untuk JavaScript dan hanya melakukan precache terhadap asset shell yang benar-benar tersedia.

Komponen usang yang dihapus:

- `.github/workflows/apply-inline-supplier-form.yml`
- `scripts/apply-inline-supplier-form.mjs`
- hint lama yang mengarahkan pengguna keluar dari transaksi menuju menu Data Supplier.
