# SIM-SPPG Transaction Action

Modul pendamping untuk hardening endpoint transaksi sebelum digabungkan ke `dynamic-action`.

Target implementasi:

- authorization terpusat melalui `canAccessTransactionRow`, `requireTransactionAccess`, dan `requireAssignedPair`;
- `SUPER_ADMIN` dapat mengakses semua transaksi;
- `ADMIN` hanya dapat mengakses pasangan `SPPG + YAYASAN` yang sama persis dengan row `ADMIN_ASSIGNMENT`;
- user biasa hanya dapat mengakses transaksi dengan kolom `User` yang sama dengan email caller;
- mapping bucket eksplisit untuk seluruh kolom dokumen transaksi;
- detail transaksi mengembalikan `fileBuktiFoto`, `fileBuktiFile`, `fileBuktiApproval`, `fileNota`, `fileTtdUser`, `fileTtdVerif`, dan `paymentProofs`;
- `TRANSAKSI_PAYMENT_PROOFS` menjadi sumber utama riwayat pembayaran;
- verifikasi pembayaran tidak menghapus proof lama;
- cleanup storage pada delete bersifat best effort dan hasilnya dicatat ke audit log;
- status dokumen menggunakan definisi yang sama dengan trigger database.

Catatan deployment:

- fungsi utama aktif saat dokumentasi ini dibuat adalah `dynamic-action` version 89;
- fungsi utama memakai custom `supabase.auth.getUser`, sehingga `verify_jwt` dipertahankan `false`;
- `app.js` tidak boleh ditimpa dengan versi lama; blob yang terakhir diverifikasi adalah `5d1b749950dde3cefb3ce0f78d51220242a27b37`.
