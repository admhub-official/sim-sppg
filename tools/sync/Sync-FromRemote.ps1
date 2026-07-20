param(
  [string]$RepositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path,
  [string]$Branch = 'main',
  [string]$ProjectRef = 'dmjsgtichrfxhyywstrt',
  [switch]$PullDatabase
)

$ErrorActionPreference = 'Stop'
Set-Location $RepositoryRoot

function Write-SyncLog([string]$Text) {
  $logDir = Join-Path $RepositoryRoot '.sync-logs'
  New-Item -ItemType Directory -Force -Path $logDir | Out-Null
  Add-Content -Path (Join-Path $logDir 'sync.log') -Value "$(Get-Date -Format s) $Text"
}

if (git status --porcelain) {
  throw 'Ada perubahan lokal. Jalankan Sync-ToGitHub.ps1 lebih dahulu agar pull tidak menimpa pekerjaan.'
}

git fetch origin $Branch
$behind = git rev-list --count "HEAD..origin/$Branch"
if ([int]$behind -gt 0) {
  git pull --rebase origin $Branch
  Write-SyncLog "Menarik $behind commit dari GitHub."
}

# Mengambil source Edge Functions yang mungkin diubah dari Supabase Dashboard.
& npx supabase functions download --project-ref $ProjectRef --use-api
if ($LASTEXITCODE -ne 0) { throw 'Gagal mengunduh Edge Functions dari Supabase.' }

if ($PullDatabase) {
  if (-not $env:SUPABASE_DB_PASSWORD) {
    throw 'SUPABASE_DB_PASSWORD belum tersedia pada Windows Environment Variables.'
  }
  & npx supabase link --project-ref $ProjectRef --password $env:SUPABASE_DB_PASSWORD
  if ($LASTEXITCODE -ne 0) { throw 'Gagal menghubungkan project Supabase.' }
  & npx supabase db pull --password $env:SUPABASE_DB_PASSWORD
  if ($LASTEXITCODE -ne 0) { throw 'Gagal menarik perubahan schema database.' }
}

if (git status --porcelain) {
  & (Join-Path $PSScriptRoot 'Sync-ToGitHub.ps1') -RepositoryRoot $RepositoryRoot -Branch $Branch -Message "sync(remote): tarik perubahan GitHub dan Supabase $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
}

Write-SyncLog 'Sinkronisasi dari remote selesai.'
