param(
  [string]$RepositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path,
  [string]$Branch = 'main',
  [string]$Message = ''
)

$ErrorActionPreference = 'Stop'
Set-Location $RepositoryRoot

function Write-SyncLog([string]$Text) {
  $logDir = Join-Path $RepositoryRoot '.sync-logs'
  New-Item -ItemType Directory -Force -Path $logDir | Out-Null
  Add-Content -Path (Join-Path $logDir 'sync.log') -Value "$(Get-Date -Format s) $Text"
}

if (-not (Test-Path '.git')) { throw 'Folder ini bukan repository Git.' }

$changes = git status --porcelain
if (-not $changes) {
  Write-SyncLog 'Tidak ada perubahan lokal untuk dikirim.'
  exit 0
}

# Jangan pernah mengirim file rahasia.
$blocked = $changes | Select-String -Pattern '(^|\s)(\.env($|\.)|.*\.pem$|.*\.key$|credentials\.json$|service-account\.json$|secrets\.json$)'
if ($blocked) {
  Write-SyncLog 'Push dihentikan karena ada file yang tampak berisi rahasia.'
  throw 'Ditemukan file rahasia. Hapus dari staging atau pindahkan ke file yang di-ignore.'
}

if (-not $Message) {
  $Message = "sync(local): perubahan otomatis $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
}

git add -A
$staged = git diff --cached --name-only
if (-not $staged) { exit 0 }

git commit -m $Message | Out-Null

try {
  git pull --rebase origin $Branch
  git push origin "HEAD:$Branch"
  Write-SyncLog "Berhasil push ke origin/$Branch."
} catch {
  Write-SyncLog "Push gagal: $($_.Exception.Message)"
  try { git rebase --abort 2>$null | Out-Null } catch {}
  throw 'Push otomatis gagal. Periksa konflik Git pada terminal atau VS Code. Tidak ada force-push yang dilakukan.'
}
