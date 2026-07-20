param(
  [string]$RepositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path,
  [string]$Branch = 'main',
  [int]$GitHubIntervalSeconds = 30,
  [int]$SupabaseIntervalMinutes = 10,
  [int]$DatabaseIntervalMinutes = 30
)

$ErrorActionPreference = 'Continue'
Set-Location $RepositoryRoot
$lockPath = Join-Path $RepositoryRoot '.sync-running.lock'
$logDir = Join-Path $RepositoryRoot '.sync-logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

function Log([string]$Text) {
  Add-Content -Path (Join-Path $logDir 'sync.log') -Value "$(Get-Date -Format s) $Text"
}

if (Test-Path $lockPath) {
  $oldPid = Get-Content $lockPath -ErrorAction SilentlyContinue
  if ($oldPid -and (Get-Process -Id $oldPid -ErrorAction SilentlyContinue)) {
    Log "Watcher sudah berjalan dengan PID $oldPid."
    exit 0
  }
}
$PID | Set-Content $lockPath

try {
  $lastSupabase = [datetime]::MinValue
  $lastDatabase = [datetime]::MinValue
  $lastLocalChange = [datetime]::MinValue

  Log 'Watcher sinkronisasi dimulai.'
  while ($true) {
    try {
      Set-Location $RepositoryRoot
      $dirty = [bool](git status --porcelain)

      if ($dirty) {
        if (((Get-Date) - $lastLocalChange).TotalSeconds -ge 8) {
          & (Join-Path $PSScriptRoot 'Sync-ToGitHub.ps1') -RepositoryRoot $RepositoryRoot -Branch $Branch
          $lastLocalChange = Get-Date
        }
      } else {
        git fetch origin $Branch 2>$null | Out-Null
        $behind = git rev-list --count "HEAD..origin/$Branch" 2>$null
        if ($behind -and [int]$behind -gt 0) {
          git pull --rebase origin $Branch | Out-Null
          Log "GitHub pull: $behind commit."
        }
      }

      if (((Get-Date) - $lastSupabase).TotalMinutes -ge $SupabaseIntervalMinutes -and -not (git status --porcelain)) {
        & npx supabase functions download --project-ref dmjsgtichrfxhyywstrt --use-api | Out-Null
        if ($LASTEXITCODE -eq 0 -and (git status --porcelain)) {
          & (Join-Path $PSScriptRoot 'Sync-ToGitHub.ps1') -RepositoryRoot $RepositoryRoot -Branch $Branch -Message "sync(supabase): source Edge Functions $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
        }
        $lastSupabase = Get-Date
      }

      $autoDbPull = $env:SIM_SPPG_AUTO_DB_PULL -eq '1'
      if ($autoDbPull -and $env:SUPABASE_DB_PASSWORD -and ((Get-Date) - $lastDatabase).TotalMinutes -ge $DatabaseIntervalMinutes -and -not (git status --porcelain)) {
        & (Join-Path $PSScriptRoot 'Sync-FromRemote.ps1') -RepositoryRoot $RepositoryRoot -Branch $Branch -PullDatabase
        $lastDatabase = Get-Date
      }
    } catch {
      Log "ERROR: $($_.Exception.Message)"
    }

    Start-Sleep -Seconds $GitHubIntervalSeconds
  }
} finally {
  Remove-Item $lockPath -Force -ErrorAction SilentlyContinue
  Log 'Watcher sinkronisasi berhenti.'
}
