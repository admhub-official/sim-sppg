# Audit Pembersihan Kode — 31 Juli 2026

Audit membedakan artefak repository menjadi:

1. **Source runtime canonical** — dipertahankan (`app.js`, `index.html`, `_worker.js`, `sw.js`, dan source Supabase Edge Functions).
2. **Workflow validasi/deployment** — dipertahankan (CI, security checks, smoke tests, deployment Edge Functions, dan migration).
3. **Generator patch satu kali** — dihapus setelah hasil patch sudah menjadi bagian source canonical.

## Artefak usang yang dibersihkan

- Patch refresh pagination terpusat untuk `app.js`.
- Patch pagination lama `transaction-action` yang masih menargetkan implementasi monolitik `index.ts` lama.
- Patch pagination frontend Menu MBG.
- Patch pagination frontend Manajemen Users.

Seluruh fitur terkait sudah tersedia pada source canonical saat ini. Generator lama berisiko menerapkan ulang pola lama, menimpa refactor terbaru, dan membuat commit otomatis dari GitHub Actions.

## Artefak yang sengaja dipertahankan

- Riwayat migration Supabase.
- Workflow deploy Edge Functions dan database migration.
- CI syntax, architecture, egress, security, dan smoke tests.
- Script regression check yang hanya membaca atau memvalidasi source tanpa menulis ulang source produksi.

## Aturan lanjutan

Perubahan fitur baru harus dilakukan langsung pada source canonical melalui pull request. Workflow tidak boleh memodifikasi source lalu melakukan commit otomatis ke `main`.
