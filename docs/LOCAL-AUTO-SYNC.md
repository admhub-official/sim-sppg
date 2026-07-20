# SIM-SPPG Local Auto Sync (Windows)

Dokumen ini menyiapkan sinkronisasi antara:

1. Folder lokal Windows (Notepad, VS Code, atau editor lain)
2. Repository GitHub `admhub-official/sim-sppg`
3. Supabase project `dmjsgtichrfxhyywstrt`

## Prinsip kerja

- GitHub `main` adalah sumber utama source code.
- Perubahan file lokal otomatis di-commit dan di-push tanpa force-push.
- Perubahan yang dibuat dari GitHub web otomatis ditarik ke komputer ketika folder lokal bersih.
- Edge Functions yang diubah langsung dari Supabase Dashboard otomatis di-download ke lokal, lalu di-commit ke GitHub.
- Perubahan Edge Functions yang masuk ke `main` otomatis dideploy ke Supabase oleh GitHub Actions.
- Migration database yang masuk ke `main` otomatis diterapkan setelah secret database disiapkan.
- Konflik tidak ditimpa. Sinkronisasi berhenti dan menulis error ke `.sync-logs/sync.log`.

## Kebutuhan Windows

- Git for Windows
- Node.js 20 LTS atau lebih baru
- Docker Desktop, khusus untuk `supabase db pull` dan local Supabase stack
- Akun GitHub yang mempunyai akses push
- Akses ke project Supabase

## Instalasi pertama

Buka PowerShell pada folder tempat repository akan disimpan:

```powershell
cd C:\
git clone https://github.com/admhub-official/sim-sppg.git SIM-SPPG
cd C:\SIM-SPPG
powershell -ExecutionPolicy Bypass -File .\tools\sync\Setup-SimSppgSync.ps1
```

Untuk sekaligus mengaktifkan penarikan schema database setiap 30 menit:

```powershell
[Environment]::SetEnvironmentVariable('SUPABASE_DB_PASSWORD', 'PASSWORD_DATABASE_ANDA', 'User')
$env:SUPABASE_DB_PASSWORD = 'PASSWORD_DATABASE_ANDA'
powershell -ExecutionPolicy Bypass -File .\tools\sync\Setup-SimSppgSync.ps1 -EnableAutomaticDatabasePull
```

Jangan menyimpan password pada file repository. Password hanya ditempatkan pada Windows Environment Variables.

## Sinkronisasi otomatis

Setup membuat Windows Scheduled Task bernama:

```text
SIM-SPPG Auto Sync
```

Task mulai otomatis setiap login Windows dan menjalankan:

```text
tools/sync/Watch-SimSppgSync.ps1
```

Interval default:

- GitHub pull/push: 30 detik
- Supabase Edge Functions download: 10 menit
- Database schema pull: 30 menit, hanya bila diaktifkan

## Mengedit lewat Notepad atau VS Code

Cukup edit dan simpan file di dalam `C:\SIM-SPPG`.

Watcher akan:

1. Menunggu perubahan stabil sekitar 8 detik
2. Menjalankan `git add -A`
3. Membuat commit otomatis
4. Menjalankan pull rebase
5. Push ke `main`
6. GitHub Actions akan mendeploy Edge Function atau migration yang berubah

## VS Code Tasks

Tekan `Ctrl+Shift+P`, pilih `Tasks: Run Task`, lalu pilih salah satu:

- `SIM-SPPG: Setup Auto Sync`
- `SIM-SPPG: Start Auto Sync`
- `SIM-SPPG: Pull GitHub + Supabase`
- `SIM-SPPG: Push Perubahan Lokal`
- `SIM-SPPG: Pull Database Supabase`

## Perubahan dari GitHub web

Ketika file diubah melalui GitHub web:

- Watcher menjalankan `git fetch`
- Bila folder lokal bersih, watcher menjalankan `git pull --rebase`
- File lokal diperbarui otomatis

Bila ada perubahan lokal yang belum terkirim, watcher mengirim perubahan lokal lebih dahulu. Jika terjadi konflik, proses berhenti tanpa force-push.

## Perubahan dari Supabase Dashboard

Edge Functions diambil dengan:

```powershell
npx supabase functions download --project-ref dmjsgtichrfxhyywstrt --use-api
```

Schema database diambil dengan:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\sync\Sync-FromRemote.ps1 -PullDatabase
```

`db pull` dapat menghasilkan migration baru. Periksa migration sebelum digunakan pada database production.

## GitHub Actions secrets

Repository harus mempunyai secrets berikut pada GitHub:

```text
SUPABASE_ACCESS_TOKEN
SUPABASE_DB_PASSWORD
```

`SUPABASE_ACCESS_TOKEN` digunakan untuk deploy Edge Functions.

`SUPABASE_DB_PASSWORD` digunakan untuk menjalankan migration database otomatis.

Buka repository GitHub, lalu:

```text
Settings → Secrets and variables → Actions → New repository secret
```

## Menonaktifkan auto database pull

```powershell
[Environment]::SetEnvironmentVariable('SIM_SPPG_AUTO_DB_PULL', $null, 'User')
Remove-Item Env:SIM_SPPG_AUTO_DB_PULL -ErrorAction SilentlyContinue
```

## Menghentikan seluruh auto sync

```powershell
Stop-ScheduledTask -TaskName 'SIM-SPPG Auto Sync'
Disable-ScheduledTask -TaskName 'SIM-SPPG Auto Sync'
```

Mengaktifkan kembali:

```powershell
Enable-ScheduledTask -TaskName 'SIM-SPPG Auto Sync'
Start-ScheduledTask -TaskName 'SIM-SPPG Auto Sync'
```

## Log dan troubleshooting

Log berada di:

```text
C:\SIM-SPPG\.sync-logs\sync.log
```

Periksa status Git:

```powershell
git status
git log --oneline -10
```

Periksa hubungan Supabase:

```powershell
npx supabase projects list
npx supabase migration list
npx supabase functions list --project-ref dmjsgtichrfxhyywstrt
```

## Aturan keamanan

- Script tidak pernah melakukan force-push.
- File `.env`, key, credential, dan secret tidak di-push.
- Database production hanya berubah melalui migration pada `main`.
- Data tabel production tidak otomatis di-download ke GitHub.
- Backup data sensitif harus disimpan terenkripsi di luar repository.
