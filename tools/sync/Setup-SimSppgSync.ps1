param(
  [string]$RepositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path,
  [string]$ProjectRef = 'dmjsgtichrfxhyywstrt',
  [switch]$EnableAutomaticDatabasePull
)

$ErrorActionPreference = 'Stop'
Set-Location $RepositoryRoot

function Require-Command([string]$Name, [string]$InstallHint) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "$Name belum terpasang. $InstallHint"
  }
}

Require-Command git 'Instal Git for Windows dari situs resmi Git.'
Require-Command node 'Instal Node.js 20 LTS atau lebih baru.'
Require-Command npm 'Node.js harus menyertakan npm.'

if (-not (Test-Path '.git')) { throw 'Jalankan script ini dari hasil clone repository SIM-SPPG.' }

Write-Host '1/6 Menginstal dependency lokal...' -ForegroundColor Cyan
npm install
if ($LASTEXITCODE -ne 0) { throw 'npm install gagal.' }

Write-Host '2/6 Memastikan login Supabase CLI...' -ForegroundColor Cyan
npx supabase login
if ($LASTEXITCODE -ne 0) { throw 'Login Supabase gagal.' }

Write-Host '3/6 Menghubungkan repository ke project Supabase...' -ForegroundColor Cyan
if ($env:SUPABASE_DB_PASSWORD) {
  npx supabase link --project-ref $ProjectRef --password $env:SUPABASE_DB_PASSWORD
} else {
  npx supabase link --project-ref $ProjectRef
}
if ($LASTEXITCODE -ne 0) { throw 'Supabase link gagal.' }

Write-Host '4/6 Menarik Edge Functions terbaru...' -ForegroundColor Cyan
npx supabase functions download --project-ref $ProjectRef --use-api
if ($LASTEXITCODE -ne 0) { throw 'Download Edge Functions gagal.' }

if ($EnableAutomaticDatabasePull) {
  if (-not $env:SUPABASE_DB_PASSWORD) {
    throw 'Set SUPABASE_DB_PASSWORD pada Windows Environment Variables sebelum mengaktifkan auto database pull.'
  }
  [Environment]::SetEnvironmentVariable('SIM_SPPG_AUTO_DB_PULL', '1', 'User')
  $env:SIM_SPPG_AUTO_DB_PULL = '1'
  Write-Host '5/6 Menarik schema database terbaru...' -ForegroundColor Cyan
  npx supabase db pull --password $env:SUPABASE_DB_PASSWORD
  if ($LASTEXITCODE -ne 0) { throw 'Database pull gagal. Pastikan Docker Desktop aktif.' }
} else {
  Write-Host '5/6 Auto database pull tidak diaktifkan. Edge Functions dan GitHub tetap auto sinkron.' -ForegroundColor Yellow
}

Write-Host '6/6 Membuat Scheduled Task Windows...' -ForegroundColor Cyan
$watcher = Join-Path $RepositoryRoot 'tools\sync\Watch-SimSppgSync.ps1'
$arguments = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$watcher`" -RepositoryRoot `"$RepositoryRoot`""
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $arguments
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Days 3650)
Register-ScheduledTask -TaskName 'SIM-SPPG Auto Sync' -Action $action -Trigger $trigger -Settings $settings -Description 'Sinkronisasi otomatis SIM-SPPG antara lokal, GitHub, dan Supabase.' -Force | Out-Null

Start-ScheduledTask -TaskName 'SIM-SPPG Auto Sync'
Write-Host ''
Write-Host 'Setup selesai.' -ForegroundColor Green
Write-Host "Folder lokal: $RepositoryRoot"
Write-Host 'Log sinkronisasi: .sync-logs\sync.log'
Write-Host 'Scheduled Task: SIM-SPPG Auto Sync'
