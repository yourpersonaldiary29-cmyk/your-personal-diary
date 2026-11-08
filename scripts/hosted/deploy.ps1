<#
.SYNOPSIS
  Builds and deploys the hosted server of Your Personal Diary to Fly.io (production or -Staging).

.DESCRIPTION
  Runs the platform-independent steps (nothing of the Windows or Android apps):
    1. web UI build               npm run build                      (-SkipUiBuild to reuse dist\)
    2. hosted server bundle       node scripts\build-hosted.mjs      (server agent, WP-H3; -SkipBundleBuild to reuse)
    3. image tree                 node scripts\hosted\stage-image.mjs (deploy\hosted\dist + Dockerfile checks)
    4. config check               fly config validate --strict
    5. deploy                     fly deploy --ha=false --remote-only   (one machine, remote builder, no Docker here)
    6. exactly one machine        fly scale count 1
    7. health check               GET https://<app>.fly.dev/api/health = 200 {ok:true}, security headers listed
  Prerequisites (main session with the owner, once): `fly apps create <app> --org personal`; the owner ran
  scripts\hosted\set-secrets.ps1 (-Stage) for that app. The volume is created by the first deploy from
  [mounts] in fly.toml (initial_size). Never run two machines (plan 3.8).
  Agents may run this with -DryRun only; a real deploy is the main session's.

.PARAMETER Staging          Use deploy\hosted\fly.staging.toml (app yourpersonaldiary-staging).
.PARAMETER App              Override the app name from the TOML.
.PARAMETER SkipUiBuild      Reuse the existing dist\.
.PARAMETER SkipBundleBuild  Reuse the existing hosted bundle.
.PARAMETER DryRun           Print every command instead of running it (the local checks that read files still run).
.PARAMETER FlyctlPath       flyctl executable. Default %USERPROFILE%\.fly\bin\flyctl.exe

.EXAMPLE
  .\scripts\hosted\deploy.ps1 -Staging
  .\scripts\hosted\deploy.ps1
  .\scripts\hosted\deploy.ps1 -DryRun -SkipUiBuild -SkipBundleBuild
#>
[CmdletBinding()]
param(
  [switch]$Staging,
  [string]$App = '',
  [switch]$SkipUiBuild,
  [switch]$SkipBundleBuild,
  [switch]$DryRun,
  [string]$FlyctlPath = (Join-Path $env:USERPROFILE '.fly\bin\flyctl.exe')
)

Set-StrictMode -Version 2
$ErrorActionPreference = 'Stop'

function Say([string]$Message) { Write-Host "[deploy] $Message" }
function Fail([string]$Message) { Write-Host "[deploy] ERROR: $Message" -ForegroundColor Red; exit 1 }

$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$deployDir = Join-Path $root 'deploy\hosted'
$configName = 'fly.toml'
if ($Staging) { $configName = 'fly.staging.toml' }
$configPath = Join-Path $deployDir $configName
if (-not (Test-Path -LiteralPath $configPath -PathType Leaf)) { Fail "config not found: $configPath" }
if ($App -eq '') {
  $m = [regex]::Match((Get-Content -LiteralPath $configPath -Raw), '(?m)^\s*app\s*=\s*"([^"]+)"')
  if (-not $m.Success) { Fail "no app = `"...`" line in $configName" }
  $App = $m.Groups[1].Value
}
$publicUrl = "https://$App.fly.dev"
Say "target: app '$App' ($configName) -> $publicUrl$(if ($DryRun) { '   [DRY RUN]' })"

# Tools ----------------------------------------------------------------------------------------------------
function Find-Tool([string]$Name, [string[]]$Fallbacks) {
  $cmd = Get-Command $Name -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  foreach ($f in $Fallbacks) { if (Test-Path -LiteralPath $f) { return $f } }
  return $null
}
$nodeExe = Find-Tool 'node.exe' @("$env:LOCALAPPDATA\Programs\nodejs\node.exe", "$env:ProgramFiles\nodejs\node.exe")
$npmCmd = Find-Tool 'npm.cmd' @("$env:LOCALAPPDATA\Programs\nodejs\npm.cmd", "$env:ProgramFiles\nodejs\npm.cmd")
if (-not $nodeExe) { Fail 'node.exe not found (portable Node: %LOCALAPPDATA%\Programs\nodejs)' }
if (-not $DryRun -and -not (Test-Path -LiteralPath $FlyctlPath -PathType Leaf)) { Fail "flyctl not found at $FlyctlPath" }

<# Runs a step: printed in -DryRun, executed otherwise; a non-zero exit stops the script. Output streams to the console. #>
function Step([string]$Title, [string]$Exe, [string[]]$Arguments, [string]$WorkingDir) {
  $display = "`"$Exe`" " + ($Arguments -join ' ')
  if ($DryRun) { Say "DRY RUN - $Title`: $display   (in $WorkingDir)"; return }
  Say "$Title`: $display"
  Push-Location $WorkingDir
  $previous = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'   # native stderr (progress bars) must not become PowerShell errors
  try {
    & $Exe @Arguments
    $code = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previous
    Pop-Location
  }
  if ($code -ne 0) { Fail "$Title failed with exit code $code" }
}

# 1. UI ------------------------------------------------------------------------------------------------------
if ($SkipUiBuild) {
  if (-not (Test-Path -LiteralPath (Join-Path $root 'dist\index.html'))) { Fail 'dist\index.html missing and -SkipUiBuild given' }
  Say 'UI build skipped (dist\ reused)'
} else {
  if (-not $npmCmd) { Fail 'npm.cmd not found' }
  Step 'UI build' $npmCmd @('run', 'build') $root
}

# 2. Hosted bundle ------------------------------------------------------------------------------------------
$buildHosted = Join-Path $root 'scripts\build-hosted.mjs'
if ($SkipBundleBuild) {
  Say 'bundle build skipped (existing hosted bundle reused)'
} elseif (-not (Test-Path -LiteralPath $buildHosted -PathType Leaf)) {
  if ($DryRun) { Say "DRY RUN - bundle build: scripts\build-hosted.mjs does not exist yet (server agent, WP-H3) - a real run stops here" }
  else { Fail 'scripts\build-hosted.mjs does not exist yet (server agent, WP-H3) - nothing to deploy. Use -SkipBundleBuild only when a hosted bundle already exists.' }
} else {
  Step 'bundle build' $nodeExe @('scripts/build-hosted.mjs') $root
}

# 3. Stage the image tree (always for real: it only reads files and writes deploy\hosted\dist) --------------
$stageScript = Join-Path $root 'scripts\hosted\stage-image.mjs'
if ($DryRun) {
  Say "DRY RUN - stage: `"$nodeExe`" scripts/hosted/stage-image.mjs   (in $root)"
  $existing = Join-Path $deployDir 'dist\.staged.json'
  if (Test-Path -LiteralPath $existing) {
    Push-Location $root
    try { & $nodeExe 'scripts/hosted/stage-image.mjs' '--verify-only'; $vcode = $LASTEXITCODE } finally { Pop-Location }
    if ($vcode -ne 0) { Fail 'the existing staged tree does not pass the Dockerfile checks' }
  }
} else {
  Step 'stage image tree' $nodeExe @('scripts/hosted/stage-image.mjs') $root
}
$fallbackMarker = Join-Path $deployDir 'dist\STAGED-WITH-LOCAL-FALLBACK'
if (Test-Path -LiteralPath $fallbackMarker) {
  if ($DryRun) { Say 'NOTE: deploy\hosted\dist was staged with the DESKTOP bundle (file-list check) - a real run refuses to deploy it' }
  else { Fail 'deploy\hosted\dist was staged with the desktop bundle (STAGED-WITH-LOCAL-FALLBACK) - build the hosted bundle first' }
}

# 4. Config check (offline) ------------------------------------------------------------------------------------
if (Test-Path -LiteralPath $FlyctlPath -PathType Leaf) {
  Push-Location $deployDir
  try {
    $previous = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
    & $FlyctlPath config validate --config $configName --strict
    $vcode = $LASTEXITCODE
    $ErrorActionPreference = $previous
  } finally { Pop-Location }
  if ($vcode -ne 0) { Fail "$configName is not valid" }
} else {
  Say "config validate skipped (flyctl not at $FlyctlPath)"
}

# 5. Deploy: one machine, remote builder, build context = deploy\hosted ----------------------------------------
Step 'fly deploy' $FlyctlPath @('deploy', '.', '--config', $configName, '--app', $App, '--ha=false', '--remote-only', '--yes') $deployDir

# 6. Exactly one machine (idempotent; defuses any spare machine) -------------------------------------------------
Step 'fly scale count 1' $FlyctlPath @('scale', 'count', '1', '--app', $App, '--yes') $deployDir

# 7. Health check through the public URL --------------------------------------------------------------------------
if ($DryRun) {
  Say "DRY RUN - health: GET $publicUrl/api/health (expect 200, ok:true) and GET $publicUrl/ (expect 200 text/html); list HSTS / CSP / X-Powered-By headers"
} else {
  $healthy = $false
  $resp = $null
  for ($i = 0; $i -lt 30; $i++) {
    try {
      $resp = Invoke-WebRequest -UseBasicParsing -Uri "$publicUrl/api/health" -TimeoutSec 10
      if ($resp.StatusCode -eq 200 -and $resp.Content -match '"ok"\s*:\s*true') { $healthy = $true; break }
    } catch { }
    Start-Sleep -Seconds 3
  }
  if (-not $healthy) { Fail "$publicUrl/api/health did not answer 200 {ok:true} within 90 s - run: `"$FlyctlPath`" logs --app $App" }
  Say "health: 200 $($resp.Content.Trim())"
  foreach ($h in @('Strict-Transport-Security', 'Content-Security-Policy', 'X-Content-Type-Options', 'Cache-Control', 'X-Powered-By', 'Server', 'Fly-Request-Id')) {
    $v = $resp.Headers[$h]
    if ($null -eq $v) { $v = '(absent)' }
    Say ("  {0,-28} {1}" -f $h, $v)
  }
  if ($null -ne $resp.Headers['X-Powered-By']) { Say '  WARNING: X-Powered-By is present (the server should disable it)' }
  if ($null -eq $resp.Headers['Strict-Transport-Security']) { Say '  WARNING: no HSTS header on the health answer (expected once the server treats fly-forwarded https as secure)' }
  try {
    $ui = Invoke-WebRequest -UseBasicParsing -Uri "$publicUrl/" -TimeoutSec 10
    Say "UI: $($ui.StatusCode) $($ui.Headers['Content-Type']) ($($ui.Content.Length) bytes)"
  } catch { Say "UI: FAILED $($_.Exception.Message)" }
}

Say "done. Public URL: $publicUrl   Logs: `"$FlyctlPath`" logs --app $App   Status: `"$FlyctlPath`" status --app $App"
exit 0
