<#
.SYNOPSIS
  Moves the existing PC data of Your Personal Diary to the hosted server on Fly.io (HOSTED-IMPL item 4).

.DESCRIPTION
  Stops nothing on the PC. Takes ONLY what must travel from the data directory into a staging folder
  (whitelist), packs it as a tar, uploads it to the server volume (/data/incoming) with `fly ssh sftp put`,
  verifies the uploaded size, arms the apply marker and restarts the machine. The container's entrypoint
  (deploy/hosted/entrypoint.sh -> data-tools.sh apply-incoming) applies the upload BEFORE the server starts,
  so no process ever has the files open while they are replaced - the server is down for the restart only.
  Afterwards the account count on the server is compared with the PC's (counts only; no names, no e-mails).

  What travels            accounts.json (byte-identical), users/*.mpd, the `mail` block of server-settings.json
                          (its SMTP password is encrypted with the same device key) unless -ExcludeMail.
  What never travels      sessions.json, resets.json, the `remote` block (DuckDNS), tls/, logs, *.tmp,
                          *.mpd.prev (unless -KeepPrevFiles), client-location.json.
  device.key              NOT copied by default. The cleaner design keeps the key OFF the volume as the
                          DIARY_DEVICE_KEY secret - run FIRST, in the owner's window:
                            scripts\hosted\set-secrets.ps1 -FromDeviceKeyFile <dataDir>\device.key -Stage
                          Then every migrated account keeps password reset and remember-me, and a copy of the
                          volume alone opens nothing (plan 3.2). -IncludeDeviceKey is the fallback (the file
                          travels; the server uses it when the secret is unset).
  Who runs it             The main session WITH the owner, against the real data directory (it asks you to
                          type MIGRATE). Agents only ever run it with -DryRun against a fictional directory
                          (scripts\hosted\test-migrate.ps1). After the owner has signed in on the server, the
                          main session deletes the local data (with a backup) - not this script.
  Before running          The server must be deployed and running (one machine), nobody should have
                          registered on it yet (an existing server registry is moved aside, not merged:
                          /data/incoming/replaced-<utc>/), and DIARY_DEVICE_KEY must already be the PC's key.

.PARAMETER SourceDir        The data directory to migrate (the real one: %APPDATA%\com.mydiary.app).
.PARAMETER App              Fly app name. Default yourpersonaldiary.
.PARAMETER StagingDir       Local staging folder (created; must be new or empty). Default %TEMP%\mpd-migrate-<stamp>.
.PARAMETER IncludeDeviceKey Copy device.key onto the volume (fallback design - see above).
.PARAMETER ExcludeMail      Leave the mail block behind (the owner re-enters the Gmail app password in the Mail card).
.PARAMETER KeepPrevFiles    Also copy users/*.mpd.prev.
.PARAMETER DryRun           Do every local step for real; print the fly commands instead of running them; keep the staging folder.
.PARAMETER KeepStaging      Keep the staging folder after a successful run (default: deleted - it is a copy of your data).
.PARAMETER Force            Skip the MIGRATE confirmation and the missing-diary-file stop.
.PARAMETER FlyctlPath       flyctl executable. Default %USERPROFILE%\.fly\bin\flyctl.exe

.EXAMPLE
  .\scripts\hosted\migrate-from-pc.ps1 -SourceDir "$env:APPDATA\com.mydiary.app" -DryRun
  .\scripts\hosted\migrate-from-pc.ps1 -SourceDir "$env:APPDATA\com.mydiary.app"
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$SourceDir,
  [string]$App = 'yourpersonaldiary',
  [string]$StagingDir = '',
  [switch]$IncludeDeviceKey,
  [switch]$ExcludeMail,
  [switch]$KeepPrevFiles,
  [switch]$DryRun,
  [switch]$KeepStaging,
  [switch]$Force,
  [string]$FlyctlPath = (Join-Path $env:USERPROFILE '.fly\bin\flyctl.exe')
)

Set-StrictMode -Version 2
$ErrorActionPreference = 'Stop'

function Say([string]$Message) { Write-Host "[migrate] $Message" }
function Fail([string]$Message) { Write-Host "[migrate] ERROR: $Message" -ForegroundColor Red; exit 1 }

<# Runs a native program with captured output (no 2>&1: PowerShell 5.1 turns native stderr into errors). #>
function Invoke-Native([string]$Exe, [string[]]$Arguments) {
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $Exe
  $quoted = @()
  foreach ($a in $Arguments) { if ($a -match '[\s"]') { $quoted += ('"' + ($a -replace '"', '\"') + '"') } else { $quoted += $a } }
  $psi.Arguments = ($quoted -join ' ')
  $psi.UseShellExecute = $false
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.StandardOutputEncoding = [System.Text.Encoding]::UTF8
  $psi.StandardErrorEncoding = [System.Text.Encoding]::UTF8
  $proc = [System.Diagnostics.Process]::Start($psi)
  $stdout = $proc.StandardOutput.ReadToEnd()
  $stderr = $proc.StandardError.ReadToEnd()
  $proc.WaitForExit()
  return @{ Code = $proc.ExitCode; Out = $stdout; Err = $stderr }
}

<# A fly command: printed in -DryRun, executed otherwise (fails the script on a non-zero exit). #>
function Invoke-Fly([string[]]$Arguments, [switch]$Quiet) {
  $display = "`"$FlyctlPath`" " + ($Arguments -join ' ')
  if ($DryRun) { Say "DRY RUN - would run: $display"; return '' }
  Say "running: $display"
  $r = Invoke-Native $FlyctlPath $Arguments
  if ($r.Code -ne 0) { Fail "flyctl exited with $($r.Code)`n$($r.Out)`n$($r.Err)" }
  if (-not $Quiet -and $r.Out.Trim() -ne '') { Write-Host ($r.Out.TrimEnd()) }
  return $r.Out
}

# 0. Source checks ---------------------------------------------------------------------------------------
if (-not (Test-Path -LiteralPath $SourceDir -PathType Container)) { Fail "source directory not found: $SourceDir" }
$SourceDir = (Resolve-Path -LiteralPath $SourceDir).Path
$accountsFile = Join-Path $SourceDir 'accounts.json'
$usersDir = Join-Path $SourceDir 'users'
if (-not (Test-Path -LiteralPath $accountsFile -PathType Leaf)) { Fail "no accounts.json in $SourceDir - this is not a data directory of Your Personal Diary" }
if (-not (Test-Path -LiteralPath $usersDir -PathType Container)) { Fail "no users\ directory in $SourceDir" }
if ($App -notmatch '^[a-z0-9-]{3,63}$') { Fail "app name '$App' is not a valid Fly app name" }
if ($StagingDir -eq '') { $StagingDir = Join-Path $env:TEMP ('mpd-migrate-' + (Get-Date -Format 'yyyyMMdd-HHmmss')) }
if ($StagingDir.TrimEnd('\') -ieq $SourceDir.TrimEnd('\')) { Fail 'the staging directory must not be the source directory' }

$looksReal = $SourceDir -match 'com\.mydiary\.app'
if ($looksReal -and -not $DryRun -and -not $Force) {
  Write-Host ''
  Write-Host "This is the REAL data directory ($SourceDir). The server's current registry and diaries (if any) will be moved aside and replaced by this PC's." -ForegroundColor Yellow
  $answer = Read-Host 'Type MIGRATE to continue'
  if ($answer -ne 'MIGRATE') { Fail 'cancelled' }
}

# 1. Count what the PC has (names are never printed) -------------------------------------------------------
$registry = Get-Content -LiteralPath $accountsFile -Raw -Encoding UTF8 | ConvertFrom-Json
$accounts = @()
if ($registry.PSObject.Properties['accounts'] -and $null -ne $registry.accounts) { $accounts = @($registry.accounts) }
$accountCount = $accounts.Count
$dbFiles = @($accounts | ForEach-Object { if ($_.PSObject.Properties['dbFile']) { $_.dbFile } } | Where-Object { $_ })
$missingDiaries = @($dbFiles | Where-Object { -not (Test-Path -LiteralPath (Join-Path $usersDir $_) -PathType Leaf) })
$pendingDeletes = 0
if ($registry.PSObject.Properties['pendingDeletes'] -and $null -ne $registry.pendingDeletes) { $pendingDeletes = @($registry.pendingDeletes).Count }
$diskDiaries = @(Get-ChildItem -LiteralPath $usersDir -File -Filter '*.mpd')
Say "source $SourceDir"
Say "  accounts=$accountCount diaryFilesReferenced=$($dbFiles.Count) diaryFilesOnDisk=$($diskDiaries.Count) missing=$($missingDiaries.Count) pendingDeletes=$pendingDeletes"
if ($accountCount -eq 0) { Fail 'the registry holds no accounts - nothing to migrate' }
if ($missingDiaries.Count -gt 0 -and -not $Force) { Fail "$($missingDiaries.Count) account(s) reference a diary file that is not in users\ - stop and look before migrating (or -Force to go on)" }

# 2. Stage (whitelist copy) -----------------------------------------------------------------------------------
if (Test-Path -LiteralPath $StagingDir) {
  if (@(Get-ChildItem -LiteralPath $StagingDir -Force).Count -gt 0) { Fail "staging directory exists and is not empty: $StagingDir" }
} else {
  New-Item -ItemType Directory -Path $StagingDir | Out-Null
}
$dataOut = Join-Path $StagingDir 'data'
New-Item -ItemType Directory -Path (Join-Path $dataOut 'users') -Force | Out-Null

Copy-Item -LiteralPath $accountsFile -Destination (Join-Path $dataOut 'accounts.json')
$copiedDiaries = 0
$copiedPrev = 0
foreach ($f in Get-ChildItem -LiteralPath $usersDir -File) {
  if ($f.Name -like '*.mpd') {
    Copy-Item -LiteralPath $f.FullName -Destination (Join-Path $dataOut ('users\' + $f.Name))
    $copiedDiaries++
  } elseif ($KeepPrevFiles -and $f.Name -like '*.mpd.prev') {
    Copy-Item -LiteralPath $f.FullName -Destination (Join-Path $dataOut ('users\' + $f.Name))
    $copiedPrev++
  }
}

$mailTravels = $false
$settingsFile = Join-Path $SourceDir 'server-settings.json'
if (-not $ExcludeMail -and (Test-Path -LiteralPath $settingsFile -PathType Leaf)) {
  $rawSettings = Get-Content -LiteralPath $settingsFile -Raw -Encoding UTF8 | ConvertFrom-Json
  if ($rawSettings.PSObject.Properties['mail'] -and $null -ne $rawSettings.mail) {
    $onlyMail = New-Object PSObject
    $onlyMail | Add-Member -MemberType NoteProperty -Name 'mail' -Value $rawSettings.mail
    $json = $onlyMail | ConvertTo-Json -Depth 8
    [System.IO.File]::WriteAllText((Join-Path $dataOut 'server-settings.json'), $json, (New-Object System.Text.UTF8Encoding $false))
    $mailTravels = $true
  }
}

$deviceKeyTravels = $false
$deviceKeyFile = Join-Path $SourceDir 'device.key'
if ($IncludeDeviceKey) {
  if (-not (Test-Path -LiteralPath $deviceKeyFile -PathType Leaf)) { Fail '-IncludeDeviceKey given but the source has no device.key' }
  if ((Get-Item -LiteralPath $deviceKeyFile).Length -ne 32) { Fail 'device.key is not 32 bytes' }
  Copy-Item -LiteralPath $deviceKeyFile -Destination (Join-Path $dataOut 'device.key')
  $deviceKeyTravels = $true
} elseif (Test-Path -LiteralPath $deviceKeyFile -PathType Leaf) {
  Say '  device.key stays on the PC: make sure DIARY_DEVICE_KEY on the server was set from it (set-secrets.ps1 -FromDeviceKeyFile), or pass -IncludeDeviceKey'
}

# What existed in the source and was deliberately left behind (file names only).
$taken = @('accounts.json', 'users')
if ($mailTravels) { $taken += 'server-settings.json' }
if ($deviceKeyTravels) { $taken += 'device.key' }
$leftBehind = @(Get-ChildItem -LiteralPath $SourceDir -Force | Where-Object { $taken -notcontains $_.Name } | ForEach-Object { $_.Name })
if (-not $KeepPrevFiles) { $prevCount = @(Get-ChildItem -LiteralPath $usersDir -File | Where-Object { $_.Name -like '*.mpd.prev' -or $_.Name -like '*.mpd.tmp' }).Count; if ($prevCount -gt 0) { $leftBehind += "users\*.mpd.prev/.tmp ($prevCount)" } }
Say "  staged: accounts.json, $copiedDiaries diary file(s)$(if ($copiedPrev) { ", $copiedPrev .prev file(s)" }), server-settings.json(mail)=$mailTravels, device.key=$deviceKeyTravels"
Say "  left behind: $(if ($leftBehind.Count) { $leftBehind -join ', ' } else { '(nothing else existed)' })"
if ($copiedDiaries -lt $dbFiles.Count -and -not $Force) { Fail 'fewer diary files staged than accounts reference' }

# 3. Pack ------------------------------------------------------------------------------------------------------
$tarExe = Join-Path $env:SystemRoot 'System32\tar.exe'
if (-not (Test-Path -LiteralPath $tarExe -PathType Leaf)) { Fail 'tar.exe not found in System32 (Windows 10 1803+ ships it)' }
$tarPath = Join-Path $StagingDir 'pc-data.tar'
$r = Invoke-Native $tarExe @('--format', 'ustar', '-cf', $tarPath, '-C', $dataOut, '.')
if ($r.Code -ne 0) { Fail "tar failed ($($r.Code)): $($r.Err)" }
$r = Invoke-Native $tarExe @('-tf', $tarPath)
if ($r.Code -ne 0) { Fail "tar -t failed: $($r.Err)" }
$entries = @($r.Out -split "`r?`n" | Where-Object { $_ -ne '' })
if (-not ($entries -contains './accounts.json' -or $entries -contains 'accounts.json')) { Fail 'the archive has no accounts.json at its root' }
$tarSize = (Get-Item -LiteralPath $tarPath).Length
$tarHash = (Get-FileHash -LiteralPath $tarPath -Algorithm SHA256).Hash
Say "  packed: $tarPath ($tarSize bytes, $($entries.Count) entries, sha256 $($tarHash.Substring(0, 12))...)"
$manifest = @(
  "Your Personal Diary - migration staging ($(Get-Date -Format s))",
  "source=$SourceDir",
  "app=$App",
  "accounts=$accountCount diaries=$copiedDiaries prev=$copiedPrev mail=$mailTravels deviceKey=$deviceKeyTravels",
  "tar=$tarPath bytes=$tarSize sha256=$tarHash entries=$($entries.Count)",
  "leftBehind=$($leftBehind -join ', ')"
)
[System.IO.File]::WriteAllLines((Join-Path $StagingDir 'manifest.txt'), $manifest, (New-Object System.Text.UTF8Encoding $false))

# 4. Upload and apply on the server -------------------------------------------------------------------------
$tools = '/usr/local/bin/diary-data-tools'
if (-not $DryRun -and -not (Test-Path -LiteralPath $FlyctlPath -PathType Leaf)) { Fail "flyctl not found at $FlyctlPath" }

# 4a. exactly one running machine
$machineId = '<machine-id>'
$statusOut = Invoke-Fly @('status', '--app', $App, '--json') -Quiet
if (-not $DryRun) {
  $status = $statusOut | ConvertFrom-Json
  $machinesProp = $status.PSObject.Properties | Where-Object { $_.Name -ieq 'machines' } | Select-Object -First 1
  $machines = @()
  if ($machinesProp -and $null -ne $machinesProp.Value) { $machines = @($machinesProp.Value) }
  if ($machines.Count -ne 1) { Fail "expected exactly one machine on '$App', found $($machines.Count) (run scripts\hosted\deploy.ps1 first / fly scale count 1)" }
  $machineId = $machines[0].id
  $state = ''
  if ($machines[0].PSObject.Properties['state']) { $state = $machines[0].state }
  if ($state -ne 'started') { Fail "the machine $machineId is '$state', not 'started'" }
  Say "  machine $machineId is running"
}

# 4b. before: what the server holds now (counts), and the incoming directory
$before = Invoke-Fly @('ssh', 'console', '--app', $App, '-C', "$tools count /data")
if (-not $DryRun -and $before -match 'accounts=(\d+)') {
  $serverAccounts = [int]$Matches[1]
  if ($serverAccounts -gt 0) { Say "  NOTE: the server already has $serverAccounts account(s); they will be moved aside to /data/incoming/replaced-<utc>/ (not merged)" }
}
Invoke-Fly @('ssh', 'console', '--app', $App, '-C', "$tools prepare-incoming /data") -Quiet | Out-Null

# 4c. upload
Invoke-Fly @('ssh', 'sftp', 'put', $tarPath, '/data/incoming/pc-data.tar', '--app', $App) | Out-Null

# 4d. verify the uploaded size before arming
$incoming = Invoke-Fly @('ssh', 'console', '--app', $App, '-C', "$tools incoming /data") -Quiet
if (-not $DryRun) {
  $line = @($incoming -split "`r?`n" | Where-Object { $_ -match 'pc-data\.tar$' }) | Select-Object -First 1
  if (-not $line -or -not ($line -match '^(\d+)\s')) { Fail "upload not found on the server (incoming listing: $incoming)" }
  if ([long]$Matches[1] -ne $tarSize) { Invoke-Fly @('ssh', 'console', '--app', $App, '-C', "$tools disarm /data") -Quiet | Out-Null; Fail "uploaded size $($Matches[1]) != local $tarSize - removed; run again" }
  Say "  upload verified ($tarSize bytes)"
}

# 4e. arm + restart (the entrypoint applies the archive before node starts)
Invoke-Fly @('ssh', 'console', '--app', $App, '-C', "$tools arm /data") | Out-Null
Invoke-Fly @('machine', 'restart', $machineId, '--app', $App, '--signal', 'SIGTERM', '--time', '25') | Out-Null

# 4f. wait for health, then compare counts
$healthUrl = "https://$App.fly.dev/api/health"
if ($DryRun) {
  Say "DRY RUN - would poll $healthUrl until 200, then compare `"$tools count /data`" with accounts=$accountCount"
} else {
  $healthy = $false
  for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Seconds 3
    try {
      $resp = Invoke-WebRequest -UseBasicParsing -Uri $healthUrl -TimeoutSec 5
      if ($resp.StatusCode -eq 200) { $healthy = $true; break }
    } catch { }
  }
  if (-not $healthy) { Fail "the server did not answer $healthUrl within 3 minutes - check `"$FlyctlPath`" logs --app $App" }
  $after = Invoke-Fly @('ssh', 'console', '--app', $App, '-C', "$tools count /data")
  if ($after -match 'accounts=(\d+)') {
    $serverNow = [int]$Matches[1]
    if ($serverNow -ne $accountCount) { Fail "the server reports accounts=$serverNow but the PC had $accountCount - look at `"$FlyctlPath`" logs --app $App (lines starting [data-tools])" }
    Say "  verified: the server reports accounts=$serverNow (PC: $accountCount)"
  } else {
    Fail "could not read the account count from the server: $after"
  }
}

# 5. Done ---------------------------------------------------------------------------------------------------
if ($DryRun -or $KeepStaging) {
  Say "staging kept at $StagingDir (it is a copy of the data - delete it when done)"
} else {
  [System.IO.Directory]::Delete($StagingDir, $true)
  Say 'staging folder deleted'
}
Say 'next: sign in on the server with an existing username and password; then "forgot password" from a second account must still work (proves the device key). The PC data stays untouched until the main session deletes it with a backup.'
exit 0
