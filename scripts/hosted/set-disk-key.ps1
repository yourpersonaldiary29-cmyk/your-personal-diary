<#
.SYNOPSIS
  Sets up the "Enlarge the disk" button of the Server card - run by the OWNER, once, in his own PowerShell window.

.DESCRIPTION
  Your Personal Diary, hosted mode (docs/server-tasks/SERVER-CARD-V2.md B1).

  The Server card can enlarge the server's disk only with a Fly.io key that is stored on the server as
  the secret DIARY_FLY_API_TOKEN. This script makes that key, limits it, checks it and stores it:

    1. It finds the server machine and its disk (flyctl machines list / volumes list, with your own sign-in).
    2. It creates a deploy token for the app, valid 5 years, named "Server card disk button" with the time
       it was made (UTC), for example "Server card disk button 2026-11-18 14:03 UTC".
    3. It limits that token (flyctl tokens attenuate, macaroon caveats) so that it can only read the app;
       read the one disk, make backup copies (snapshots) of it, enlarge it and change its settings ("write");
       and read the one machine and start, stop or restart it ("control"). It cannot delete anything, and it
       cannot create a machine or another disk.
    4. It checks the limited key against the Fly Machines API (https://api.machines.dev) with safe requests
       only: it reads the disk, its snapshots and the machine; it asks to "enlarge" the disk to the size it
       already has - Fly must refuse that as invalid, not as unauthorized, which proves the permission
       without changing anything; and it makes one snapshot (harmless). It never sends a delete. Which
       letters Fly needs for enlarging and for snapshots is not documented: the checks start with the
       narrowest disk permission and widen it once. When Fly refuses a permission, the script says which
       one and stops - then nothing is stored.
    5. It stores the key with "flyctl secrets import" (on standard input): for the next update of the
       server (staged), or at once - then the server restarts and the diary is away for about a minute.

  The key is never shown on the screen, never written to a file, never put on a command line and never
  logged: it lives only in variables of this script, and reaches flyctl in the child process's own
  environment (FLY_API_TOKEN) or on its standard input, and Fly in the Authorization header of the checks.

  The risk that remains: whoever got hold of the key - for example by breaking into the server - could,
  without your password, the limits of the Server card or an e-mail, enlarge the disk at Fly up to Fly's
  largest size (500 GB, about 75 US dollars a month; a disk cannot be made smaller again), make backup
  copies, change the disk's settings, and stop or restart the server. The key cannot delete the disk or
  any diary. If you suspect that, cancel the key at once (below).

  To turn the button off:   flyctl secrets unset DIARY_FLY_API_TOKEN --app yourpersonaldiary
                            (the server restarts, about a minute)
  To cancel the key itself: flyctl tokens list --app yourpersonaldiary, then flyctl tokens revoke <ID>
                            for every token whose name starts with "Server card disk button". Each run of
                            this script makes a new one, also a run that stopped; the newest stored one is
                            the key in use.

.PARAMETER App            Fly app name. Default: yourpersonaldiary
.PARAMETER Now            Store the key and apply it at once (the server restarts, about a minute).
.PARAMETER Stage          Store the key for the next update of the server, without a restart now.
                          Without -Now or -Stage the script asks.
.PARAMETER DryRun         Print what would run. Calls nothing, creates nothing, stores nothing.
.PARAMETER FlyctlPath     flyctl executable. Default: %USERPROFILE%\.fly\bin\flyctl.exe
.PARAMETER FunctionsOnly  For the tests (scripts/hosted/set-disk-key.test.mjs): when the script is
                          dot-sourced, it defines its functions and stops.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Users\AVI\Projects\my-personal-diary\scripts\hosted\set-disk-key.ps1"
  .\scripts\hosted\set-disk-key.ps1 -Now
  .\scripts\hosted\set-disk-key.ps1 -DryRun
#>
[CmdletBinding()]
param(
  [string]$App = 'yourpersonaldiary',
  [switch]$Now,
  [switch]$Stage,
  [switch]$DryRun,
  [string]$FlyctlPath = (Join-Path $env:USERPROFILE '.fly\bin\flyctl.exe'),
  [switch]$FunctionsOnly
)

Set-StrictMode -Version 2
$ErrorActionPreference = 'Stop'

# The one endpoint of the checks - the same the server uses (server/src/hosted/fly-volume.ts).
$ApiBase = 'https://api.machines.dev/v1'
# The name of every key this script makes starts with this; each one also carries the time it was made, so the
# owner can tell them apart in "flyctl tokens list".
$TokenPrefix = 'Server card disk button'
$TokenName = "$TokenPrefix $([DateTime]::UtcNow.ToString('yyyy-MM-dd HH:mm', [System.Globalization.CultureInfo]::InvariantCulture)) UTC"
# Set once the deploy token exists at Fly: every stop after that says how to remove it.
$MadeToken = ''
# 5 years.
$TokenExpiry = '43800h'
# The permissions, as macaroon caveat masks: r read, w write, c create, C control (start, stop, restart).
# Never d (delete).
$AppMask = 'rwcC'
$MachineMask = 'rC'
# Every operation that names neither the disk nor the machine: read only.
$ElseMask = 'r'
# The one disk, narrowest first: the checks keep the first one that passes.
$VolumeMasks = @('rw', 'rwc')
$Http = $null

function Say([string]$Message) { Write-Host "[disk-key] $Message" }

function Stop-Setup([string]$Message) {
  Write-Host "[disk-key] STOPPED: $Message" -ForegroundColor Red
  Write-Host '[disk-key] Nothing was stored on the server: the disk button stays as it was.' -ForegroundColor Red
  if ($script:MadeToken) {
    Write-Host "[disk-key] The deploy token '$($script:MadeToken)' was already made at Fly and is stored nowhere. Remove it: flyctl tokens list --app $App, then flyctl tokens revoke <its ID>." -ForegroundColor Red
  }
  exit 1
}

# The value of the first of $Names that a parsed JSON object has, or $null (strict mode forbids reading a missing one).
function Get-Prop($Object, [string[]]$Names) {
  if ($null -eq $Object -or $Object -isnot [System.Management.Automation.PSCustomObject]) { return $null }
  foreach ($name in $Names) {
    $property = $Object.PSObject.Properties[$name]
    if ($null -ne $property) { return $property.Value }
  }
  return $null
}

# Whatever ConvertFrom-Json gave (nothing, one object, an array) as an array.
function ConvertTo-List($Value) {
  if ($null -eq $Value) { return , @() }
  if ($Value -is [System.Array]) { return , $Value }
  return , @($Value)
}

# The Authorization header value: a "FlyV1 " token as it is, any other one with "Bearer " - as the server does it.
function Get-FlyAuthorization([string]$Token) {
  $t = $Token.Trim()
  if ($t.StartsWith('FlyV1 ', [System.StringComparison]::Ordinal)) { return $t }
  return "Bearer $t"
}

# Refuses a permission that could delete (d) or means everything (*): only r, w, c and C are ever given.
function Assert-NoDelete([string]$Mask) {
  if ($Mask -cnotmatch '^[rwcC]+$') { throw "the permission '$Mask' is not one this script gives (only r, w, c and C - never d)" }
}

# The caveats of the limited key as JSON (a superfly/macaroon caveat set): the app (when its number is known),
# then - for every operation that names a volume or a machine - only this disk and this machine; every other
# operation may only read.
function New-DiskKeyCaveats {
  param([string]$AppId = '', [Parameter(Mandatory = $true)][string]$VolumeId, [Parameter(Mandatory = $true)][string]$MachineId, [Parameter(Mandatory = $true)][string]$VolumeMask)
  foreach ($mask in @($AppMask, $MachineMask, $ElseMask, $VolumeMask)) { Assert-NoDelete $mask }
  if ($VolumeId -notmatch '^[A-Za-z0-9_]{1,64}$') { throw 'the disk id is not valid' }
  if ($MachineId -notmatch '^[A-Za-z0-9_]{1,64}$') { throw 'the machine id is not valid' }
  $caveats = New-Object System.Collections.ArrayList
  if ($AppId) {
    if ($AppId -notmatch '^[1-9][0-9]{0,19}$') { throw 'the app number is not valid' }
    [void]$caveats.Add([ordered]@{ 'type' = 'Apps'; 'body' = [ordered]@{ 'apps' = [ordered]@{ $AppId = $AppMask } } })
  }
  $ifs = @(
    [ordered]@{ 'type' = 'Volumes'; 'body' = [ordered]@{ 'volumes' = [ordered]@{ $VolumeId = $VolumeMask } } },
    [ordered]@{ 'type' = 'Machines'; 'body' = [ordered]@{ 'machines' = [ordered]@{ $MachineId = $MachineMask } } }
  )
  [void]$caveats.Add([ordered]@{ 'type' = 'IfPresent'; 'body' = [ordered]@{ 'ifs' = $ifs; 'else' = $ElseMask } })
  return (ConvertTo-Json -InputObject @($caveats.ToArray()) -Depth 10 -Compress)
}

# What the answer to one check means: 'ok'; 'unauthorized' (Fly refused the key for it); 'invalid' (Fly refused
# the request itself - the expected answer to enlarging the disk to the size it already has); 'not-found';
# 'unreachable' (no answer); 'server-error'.
function Get-ProbeVerdict([int]$Status, [string]$Body = '') {
  if ($Status -eq 0) { return 'unreachable' }
  if ($Status -eq 401 -or $Status -eq 403) { return 'unauthorized' }
  if ($Status -ge 200 -and $Status -lt 300) { return 'ok' }
  if ($Status -eq 404) { return 'not-found' }
  if ($Status -ge 500) { return 'server-error' }
  if ($Body -match '\bunauthori[sz]ed\b|\bnot authori[sz]ed\b|\bpermission denied\b') { return 'unauthorized' }
  return 'invalid'
}

# The server machine and its disk from the JSON of "flyctl machines list --json" and "flyctl volumes list --json":
# exactly one machine (the app runs one), and the one disk attached to it.
function Find-DiskTarget([string]$MachinesJson, [string]$VolumesJson) {
  # Into a variable first: piped straight from the function, the list would arrive as one object.
  $allMachines = ConvertTo-List (ConvertFrom-Json -InputObject $MachinesJson)
  $machines = @($allMachines | Where-Object { (Get-Prop $_ @('state')) -notin @('destroyed', 'destroying') })
  if ($machines.Count -ne 1) { throw "the app should run exactly one machine, Fly lists $($machines.Count)" }
  $machineId = [string](Get-Prop $machines[0] @('id'))
  if ($machineId -notmatch '^[A-Za-z0-9_]{1,64}$') { throw 'the machine has no valid id' }
  $allVolumes = ConvertTo-List (ConvertFrom-Json -InputObject $VolumesJson)
  $volumes = @($allVolumes | Where-Object { (Get-Prop $_ @('state')) -notin @('destroyed', 'destroying', 'pending_destroy') })
  $attached = @($volumes | Where-Object { [string](Get-Prop $_ @('attached_machine_id', 'AttachedMachineID')) -eq $machineId })
  if ($attached.Count -eq 0) {
    # Otherwise the disk the machine mounts, by its configuration.
    $mounts = ConvertTo-List (Get-Prop (Get-Prop $machines[0] @('config')) @('mounts'))
    if ($mounts.Count -gt 0) {
      $mounted = [string](Get-Prop $mounts[0] @('volume'))
      $attached = @($volumes | Where-Object { [string](Get-Prop $_ @('id')) -eq $mounted })
    }
  }
  if ($attached.Count -ne 1) { throw "the machine should have exactly one disk attached, Fly lists $($attached.Count)" }
  $volumeId = [string](Get-Prop $attached[0] @('id'))
  if ($volumeId -notmatch '^[A-Za-z0-9_]{1,64}$') { throw 'the disk has no valid id' }
  $size = Get-Prop $attached[0] @('size_gb', 'SizeGb')
  return [pscustomobject]@{ MachineId = $machineId; VolumeId = $volumeId; SizeGb = $size }
}

# The app's internal number for the Apps caveat: from "flyctl apps list --json" when it says it, otherwise from the
# deploy token's own caveats (the text of "flyctl tokens debug", read in memory only). '' when neither says it.
function Find-AppNumericId([string]$AppsJson = '', [string]$App, [string]$TokenDebugText = '') {
  if ($AppsJson) {
    try {
      $apps = ConvertTo-List (ConvertFrom-Json -InputObject $AppsJson)
      foreach ($entry in $apps) {
        if ([string](Get-Prop $entry @('Name', 'name')) -ceq $App) {
          $id = [string](Get-Prop $entry @('InternalNumericID', 'internal_numeric_id'))
          if ($id -match '^[1-9][0-9]{0,19}$') { return $id }
        }
      }
    } catch { }
  }
  if ($TokenDebugText) {
    $ids = @([regex]::Matches($TokenDebugText, '"apps"\s*:\s*\{\s*"([0-9]{1,20})"\s*:') | ForEach-Object { $_.Groups[1].Value } | Select-Object -Unique)
    if ($ids.Count -eq 1 -and $ids[0] -match '^[1-9]') { return [string]$ids[0] }
  }
  return ''
}

# The first token line flyctl printed, as an Authorization value ("FlyV1 fm2_..."); $null when there is none.
function Find-TokenLine([string]$Text) {
  foreach ($line in ($Text -split "`r?`n")) {
    $l = $line.Trim()
    if ($l -cmatch '^FlyV1 \S+$') { return $l }
    if ($l -cmatch '^fm\d_\S+$') { return "FlyV1 $l" }
  }
  return $null
}

# A message of flyctl, safe to show: every value in $Secrets and anything that looks like a token is hidden.
function Protect-Text([string]$Text, [string[]]$Secrets = @()) {
  if (-not $Text) { return '' }
  $out = $Text
  foreach ($secret in $Secrets) { if ($secret) { $out = $out.Replace($secret, '<hidden>') } }
  $out = [regex]::Replace($out, 'FlyV1\s+\S+', 'FlyV1 <hidden>')
  $out = [regex]::Replace($out, '\b(?:fm|fo|fa)\d_[A-Za-z0-9+/=_,-]+', '<hidden>')
  return $out.Trim()
}

# Runs flyctl with $Arguments - never a secret on that line - and returns ExitCode, StdOut and StdErr; nothing is
# shown. $Token, when given, goes into the CHILD's own environment only (FLY_API_TOKEN); $StdinText to its input.
function Invoke-Flyctl {
  param([Parameter(Mandatory = $true)][string]$Arguments, [string]$Token = '', [string]$StdinText = $null)
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $FlyctlPath
  $psi.Arguments = $Arguments
  $psi.UseShellExecute = $false
  $psi.CreateNoWindow = $true
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.RedirectStandardInput = $true
  $psi.StandardOutputEncoding = New-Object System.Text.UTF8Encoding $false
  $psi.StandardErrorEncoding = New-Object System.Text.UTF8Encoding $false
  # Your own sign-in unless this call is about the new key: no token left in the environment by chance.
  foreach ($name in @('FLY_API_TOKEN', 'FLY_ACCESS_TOKEN')) {
    if ($psi.EnvironmentVariables.ContainsKey($name)) { $psi.EnvironmentVariables.Remove($name) }
  }
  if ($Token) { $psi.EnvironmentVariables['FLY_API_TOKEN'] = $Token }
  $previousInputEncoding = [Console]::InputEncoding
  try {
    # As in set-secrets.ps1: Windows PowerShell 5.1 builds the child's standard input from the console encoding,
    # and a UTF-8 console with a byte-order mark would send one before the first line.
    [Console]::InputEncoding = New-Object System.Text.UTF8Encoding $false
    $proc = [System.Diagnostics.Process]::Start($psi)
    $outTask = $proc.StandardOutput.ReadToEndAsync()
    $errTask = $proc.StandardError.ReadToEndAsync()
    if ($null -ne $StdinText) { $proc.StandardInput.Write($StdinText) }
    $proc.StandardInput.Close()
    $proc.WaitForExit()
    return [pscustomobject]@{ ExitCode = $proc.ExitCode; StdOut = [string]$outTask.Result; StdErr = [string]$errTask.Result }
  } finally {
    [Console]::InputEncoding = $previousInputEncoding
  }
}

# One check against the Fly Machines API with $Token in the Authorization header: only GET, POST and PUT, only the
# app's volumes and machines - this script never sends a delete and never restarts anything. Status 0 = no answer.
function Invoke-FlyApi {
  param([Parameter(Mandatory = $true)][string]$Method, [Parameter(Mandatory = $true)][string]$Path, [Parameter(Mandatory = $true)][string]$Token, [string]$Body = '')
  if ($Method -cnotin @('GET', 'POST', 'PUT')) { throw "refused: this script sends only GET, POST and PUT, never $Method" }
  if ($Path -notmatch '^/apps/[a-z0-9-]+/(volumes|machines)(/[A-Za-z0-9_]+(/(snapshots|extend))?)?$') { throw "refused: $Path is not one of the checks" }
  if ($null -eq $script:Http) {
    Add-Type -AssemblyName System.Net.Http
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
    $script:Http = New-Object System.Net.Http.HttpClient
    $script:Http.Timeout = [TimeSpan]::FromSeconds(30)
  }
  $request = New-Object System.Net.Http.HttpRequestMessage -ArgumentList (New-Object System.Net.Http.HttpMethod -ArgumentList $Method), ($ApiBase + $Path)
  try {
    [void]$request.Headers.TryAddWithoutValidation('Authorization', (Get-FlyAuthorization $Token))
    if ($Body) { $request.Content = New-Object System.Net.Http.StringContent -ArgumentList $Body, ([System.Text.Encoding]::UTF8), 'application/json' }
    $response = $script:Http.SendAsync($request).GetAwaiter().GetResult()
    $text = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
    return [pscustomobject]@{ Status = [int]$response.StatusCode; Body = [string]$text }
  } catch {
    return [pscustomobject]@{ Status = 0; Body = '' }
  } finally {
    $request.Dispose()
  }
}

# The limited key: the deploy token with the caveats, by "flyctl tokens attenuate". The caveats go through a
# temporary file (ids and permission letters only - no secret); the token through flyctl's own environment.
function New-AttenuatedToken([string]$DeployToken, [string]$CaveatsJson) {
  $file = Join-Path ([System.IO.Path]::GetTempPath()) ('diary-disk-key-caveats-' + [guid]::NewGuid().ToString('N') + '.json')
  [System.IO.File]::WriteAllText($file, $CaveatsJson, (New-Object System.Text.UTF8Encoding $false))
  try {
    $result = Invoke-Flyctl -Arguments "tokens attenuate --file `"$file`"" -Token $DeployToken
  } finally {
    Remove-Item -LiteralPath $file -Force -ErrorAction SilentlyContinue
  }
  $token = $null
  if ($result.ExitCode -eq 0) { $token = Find-TokenLine $result.StdOut }
  if (-not $token) { throw ('flyctl could not limit the key: ' + (Protect-Text $result.StdErr @($DeployToken))) }
  return $token
}

# The safe checks of a limited key (see the description above). Returns Ok and, when one fails, its step,
# verdict and HTTP status.
function Test-DiskKey([string]$Token, [string]$App, $Target) {
  $volumePath = "/apps/$App/volumes/$($Target.VolumeId)"
  $reads = @(
    @{ Step = 'list-disks'; Path = "/apps/$App/volumes" },
    @{ Step = 'read-disk'; Path = $volumePath },
    @{ Step = 'list-snapshots'; Path = "$volumePath/snapshots" },
    @{ Step = 'read-machine'; Path = "/apps/$App/machines/$($Target.MachineId)" }
  )
  $size = $null
  foreach ($read in $reads) {
    $answer = Invoke-FlyApi -Method 'GET' -Path $read.Path -Token $Token
    $verdict = Get-ProbeVerdict $answer.Status $answer.Body
    if ($verdict -ne 'ok') { return [pscustomobject]@{ Ok = $false; Step = $read.Step; Verdict = $verdict; Status = $answer.Status } }
    if ($read.Step -eq 'read-disk') {
      try { $size = Get-Prop (ConvertFrom-Json -InputObject $answer.Body) @('size_gb') } catch { $size = $null }
    }
  }
  # The size the disk has now, exactly as Fly said it - never anything larger.
  if (-not ($size -is [int] -or $size -is [long]) -or $size -lt 1) { return [pscustomobject]@{ Ok = $false; Step = 'read-disk'; Verdict = 'no-size'; Status = 200 } }
  $answer = Invoke-FlyApi -Method 'PUT' -Path "$volumePath/extend" -Token $Token -Body ('{"size_gb":' + [string]$size + '}')
  $verdict = Get-ProbeVerdict $answer.Status $answer.Body
  if ($verdict -ne 'invalid' -and $verdict -ne 'ok') { return [pscustomobject]@{ Ok = $false; Step = 'extend'; Verdict = $verdict; Status = $answer.Status } }
  $sameSizeAccepted = ($verdict -eq 'ok')
  # One snapshot: harmless, and it is what the button makes before every change.
  $answer = Invoke-FlyApi -Method 'POST' -Path "$volumePath/snapshots" -Token $Token
  $verdict = Get-ProbeVerdict $answer.Status $answer.Body
  if ($verdict -ne 'ok') { return [pscustomobject]@{ Ok = $false; Step = 'snapshot'; Verdict = $verdict; Status = $answer.Status } }
  return [pscustomobject]@{ Ok = $true; Step = ''; Verdict = 'ok'; Status = $answer.Status; SameSizeAccepted = $sameSizeAccepted }
}

function Get-StepText([string]$Step) {
  switch ($Step) {
    'list-disks' { return "reading the list of the app's disks" }
    'read-disk' { return 'reading the disk' }
    'list-snapshots' { return 'reading the backup copies (snapshots) of the disk' }
    'read-machine' { return 'reading the server machine' }
    'extend' { return 'enlarging the disk' }
    'snapshot' { return 'making a backup copy (snapshot) of the disk' }
    default { return $Step }
  }
}

# What a failed check means, in plain words.
function Get-VerdictText($Result) {
  $what = Get-StepText $Result.Step
  switch ($Result.Verdict) {
    'unauthorized' { return "Fly refused the limited key for $what - that permission is missing (HTTP $($Result.Status))." }
    'not-found' { return "Fly did not find what the key is meant for while $what (HTTP 404). Check that the app runs one machine with one disk, then run this script again." }
    'unreachable' { return "Fly did not answer while $what. Check the internet connection, then run this script again." }
    'server-error' { return "Fly answered with an error while $what (HTTP $($Result.Status)). Try again in a few minutes." }
    'no-size' { return 'Fly did not say how large the disk is, so the safe check of enlarging cannot be made.' }
    default { return "Fly answered unexpectedly while $what (HTTP $($Result.Status))." }
  }
}

if ($FunctionsOnly) { return }

# ------------------------------------------------------------------------------------------------------------------
if ($App -notmatch '^[a-z0-9][a-z0-9-]{0,62}$') { Stop-Setup "'$App' is not a valid Fly app name" }
if ($Now -and $Stage) { Stop-Setup 'use either -Now or -Stage, not both' }

Say "The disk button of the Server card, for the Fly app '$App'."
if ($DryRun) {
  Say 'DRY RUN - nothing is called, created or stored. This is what the script would do:'
  Say "  1. `"$FlyctlPath`" machines list --app $App --json  and  volumes list --app $App --json  (your own sign-in)"
  Say "  2. `"$FlyctlPath`" tokens create deploy --app $App --name `"$TokenName`" --expiry $TokenExpiry  (kept in memory, never shown)"
  Say "  3. `"$FlyctlPath`" tokens attenuate --file <caveats file>  (the token only in that program's FLY_API_TOKEN)"
  Say "     caveats: Apps <app number> '$AppMask'; IfPresent [Volumes <disk id> '$($VolumeMasks[0])' (then '$($VolumeMasks[-1])' if Fly needs it), Machines <machine id> '$MachineMask'], else '$ElseMask' - never d"
  Say "  4. checks at $ApiBase with the limited key: GET the disks, the disk, its snapshots and the machine;"
  Say '     PUT .../extend with the size the disk already has (must be refused as invalid, not as unauthorized);'
  Say '     POST one snapshot. Never a delete. A refused permission stops the script before anything is stored.'
  Say "  5. `"$FlyctlPath`" secrets import --app $App [--stage]  (DIARY_FLY_API_TOKEN=<hidden> on standard input)"
  Say 'Dry run finished: nothing was called.'
  exit 0
}

if (-not (Test-Path -LiteralPath $FlyctlPath -PathType Leaf)) { Stop-Setup "flyctl was not found at $FlyctlPath (install it, or pass -FlyctlPath <path>)" }

# 0. Your own sign-in --------------------------------------------------------------------------------------------
$result = Invoke-Flyctl -Arguments 'auth whoami'
if ($result.ExitCode -ne 0) { Stop-Setup 'you are not signed in to Fly.io in this window. Run: flyctl auth login - then this script again.' }

# 1. The machine and its disk -------------------------------------------------------------------------------------
Say 'Looking for the server machine and its disk...'
$machinesList = Invoke-Flyctl -Arguments "machines list --app $App --json"
if ($machinesList.ExitCode -ne 0) { Stop-Setup "flyctl could not list the machines of '$App': $(Protect-Text $machinesList.StdErr)" }
$volumesList = Invoke-Flyctl -Arguments "volumes list --app $App --json"
if ($volumesList.ExitCode -ne 0) { Stop-Setup "flyctl could not list the disks of '$App': $(Protect-Text $volumesList.StdErr)" }
$target = $null
try { $target = Find-DiskTarget -MachinesJson $machinesList.StdOut -VolumesJson $volumesList.StdOut } catch { Stop-Setup "$($_.Exception.Message)." }
Say "Found machine $($target.MachineId) with disk $($target.VolumeId) ($($target.SizeGb) GB)."

# The app's number for the Apps caveat.
$appId = ''
$appsList = Invoke-Flyctl -Arguments 'apps list --json'
if ($appsList.ExitCode -eq 0) { $appId = Find-AppNumericId -AppsJson $appsList.StdOut -App $App }

# 2. The deploy token (in memory only) ----------------------------------------------------------------------------
Say "Creating the deploy token '$TokenName' (valid 5 years)..."
$created = Invoke-Flyctl -Arguments "tokens create deploy --app $App --name `"$TokenName`" --expiry $TokenExpiry"
$deployToken = $null
if ($created.ExitCode -eq 0) { $deployToken = Find-TokenLine $created.StdOut }
$createdError = Protect-Text $created.StdErr
$created = $null
if (-not $deployToken) {
  Stop-Setup "flyctl could not create the deploy token: $createdError"
}
$script:MadeToken = $TokenName

if (-not $appId) {
  # The deploy token's own caveats name the app's number; the decoded text is as secret as the token: memory only.
  $decoded = Invoke-Flyctl -Arguments 'tokens debug' -Token $deployToken
  if ($decoded.ExitCode -eq 0) { $appId = Find-AppNumericId -App $App -TokenDebugText $decoded.StdOut }
  $decoded = $null
}
if ($appId) { Say "The app's number at Fly is ${appId} - the key is limited to it." }
else { Say "Fly did not say the app's number: the deploy token itself is limited to this app, and the caveats limit it to the disk and the machine." }

# 3 + 4. Limit and check: the narrowest disk permission that passes every check is kept -------------------------
$finalToken = $null
$candidate = $null
$usedMask = ''
$sameSize = $false
$lastCheck = $null
foreach ($mask in $VolumeMasks) {
  $caveats = New-DiskKeyCaveats -AppId $appId -VolumeId $target.VolumeId -MachineId $target.MachineId -VolumeMask $mask
  Say "Limiting the key (disk permission '$mask') and checking it at Fly..."
  try {
    $candidate = New-AttenuatedToken -DeployToken $deployToken -CaveatsJson $caveats
  } catch {
    $deployToken = $null
    Stop-Setup $_.Exception.Message
  }
  $lastCheck = Test-DiskKey -Token $candidate -App $App -Target $target
  if ($lastCheck.Ok) {
    $finalToken = $candidate
    $usedMask = $mask
    $sameSize = $lastCheck.SameSizeAccepted
    break
  }
  $candidate = $null
  if ($lastCheck.Verdict -eq 'unauthorized' -and ($lastCheck.Step -eq 'extend' -or $lastCheck.Step -eq 'snapshot')) {
    Say "Fly needs a wider disk permission for $(Get-StepText $lastCheck.Step)."
    continue
  }
  break
}
$deployToken = $null
$candidate = $null
if (-not $finalToken) {
  Stop-Setup (Get-VerdictText $lastCheck)
}
Say 'The key passed every check: it can read the disk and the machine, make a backup copy and enlarge the disk.'
Say 'One backup copy (snapshot) of the disk was made by the check - it is harmless, and Fly removes it by itself after some days.'
if ($sameSize) { Say 'Note: Fly accepted the check request to keep the disk at its size - nothing changed.' }

# 5. Store it -----------------------------------------------------------------------------------------------------
$applyNow = [bool]$Now
if (-not $Now -and -not $Stage -and [Environment]::UserInteractive) {
  Say 'When should the server start using the key?'
  Say '  Just press Enter: with the next update of the server - no interruption now.'
  Say '  Type NOW and press Enter: now - the server restarts, and the diary is away for about a minute.'
  $answer = Read-Host '[disk-key] Your choice'
  $applyNow = ($null -ne $answer -and $answer.Trim().ToUpperInvariant() -eq 'NOW')
}
$importArguments = "secrets import --app $App"
if (-not $applyNow) { $importArguments += ' --stage' }
if ($applyNow) { Say 'Storing the key and restarting the server (about a minute)...' } else { Say 'Storing the key for the next update of the server...' }
$stored = Invoke-Flyctl -Arguments $importArguments -StdinText ("DIARY_FLY_API_TOKEN=$finalToken`n")
$storedOk = ($stored.ExitCode -eq 0)
$storedError = Protect-Text $stored.StdErr @($finalToken)
$finalToken = $null
$stored = $null
[GC]::Collect()
if (-not $storedOk) { Stop-Setup "flyctl secrets import failed: $storedError" }

Say 'Done. The key is stored on the server as the secret DIARY_FLY_API_TOKEN.'
if ($applyNow) { Say 'Fly is restarting the server now; in about a minute the Server card shows the disk button.' }
else { Say 'It takes effect with the next update of the server; until then the Server card says the button is not set up.' }
Say "The key is the deploy token '$TokenName'. It can: read the app; read disk $($target.VolumeId), make backup copies of it, enlarge it and change its settings (permission '$usedMask'); read machine $($target.MachineId) and start, stop or restart it. It can delete nothing."
Say "The risk that remains: whoever got hold of the key - for example by breaking into the server - could enlarge the disk at Fly up to 500 GB (about 75 US dollars a month; a disk cannot be made smaller again), make backup copies and stop or restart the server, without your password, the limits of the Server card or an e-mail. If you suspect that, cancel the key at once."
Say "To turn the button off: flyctl secrets unset DIARY_FLY_API_TOKEN --app $App (the server restarts, about a minute)"
Say "To cancel the key itself: flyctl tokens list --app $App, then flyctl tokens revoke <the ID of '$TokenName'>"
Say "Every run of this script makes a new key. Once this one is in use, revoke the earlier ones: every token in that list whose name starts with '$TokenPrefix', except '$TokenName'."
exit 0
