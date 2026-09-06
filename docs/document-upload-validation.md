# Pemeriksaan upload Pusat Dokumen

Jalur signed upload dan Base64 memeriksa prefix isi file sebelum menyimpan metadata. PDF, PNG, JPEG, GIF, WebP, RTF, dokumen Office lama, serta container Office/OpenDocument memiliki pemeriksaan signature sesuai ekstensi; MIME PDF/gambar yang dikenal juga diperiksa. Program Windows/Linux/Wasm/Mach-O dan beberapa bentuk konten HTML, SVG, PHP atau shebang ditolak meskipun namanya diganti.

Direct upload membaca maksimal 4 KiB dengan permintaan Range dan menghentikan stream ketika batas tercapai, termasuk bila Storage mengabaikan Range. Pemeriksaan ini memiliki timeout 15 detik. Kegagalan koneksi tidak menghapus object sehingga finalisasi dapat dicoba ulang. Penolakan isi menghapus object upload tersebut dan tidak membuat metadata.

Ini pemeriksaan signature awal, bukan antivirus. Isi arsip, macro Office, struktur lengkap PDF, polyglot dan format di luar daftar signature belum diperiksa menyeluruh. Signature ZIP pada DOCX/XLSX/PPTX/OpenDocument hanya memastikan container ZIP, bukan keabsahan seluruh isinya. Pemindaian malware/arsip memerlukan tahap karantina dan scanner tersendiri.

UI mempertahankan antrean file gagal selama halaman tetap terbuka, mencegah upload/retry bersamaan, dan membatasi request prepare/finalize selama 45 detik. Refresh/logout tetap mengakhiri antrean file browser; retry bukan penyimpanan file permanen.
