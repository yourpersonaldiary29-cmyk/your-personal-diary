<#
.SYNOPSIS
  Sets the hosted server's secrets on Fly.io - run by the OWNER in his own PowerShell window.

.DESCRIPTION
  Your Personal Diary, hosted mode (docs/HOSTED-PLAN.md 3.2, 5.7; docs/android-tasks/HOSTED-IMPL.md item 1).

  DIARY_DEVICE_KEY  32 random bytes from RNGCryptoServiceProvider, base64 (44 characters) - or, for the
                    data migration (HOSTED-IMPL item 4), the 32 bytes of the PC's existing device.key
                    (-FromDeviceKeyFile), so every migrated account keeps password reset and "remember me".
                    A copy is written to -KeyCopyFile FIRST (the script refuses to overwrite an existing
                    file). Keep that copy in your password manager / offline: losing the key loses password
                    reset and remember-me (never the diaries); together with the volume it opens every diary.
  DIARY_INVITE_CODE the launch-window invite code (letters, digits, - _ . ; 8-64 characters). Typed hidden
                    unless -InviteCode or -NoInviteCode is given.

  Both values go to Fly on STDIN of `fly secrets import` - never on a command line, never in the console,
  never in a log. Nothing is printed except the names of the secrets and where the key copy went.
  Agents never run this script without -DryRun; -DryRun prints the commands with the values hidden and
  calls nothing.

.PARAMETER App              Fly app name (yourpersonaldiary / yourpersonaldiary-staging).
.PARAMETER KeyCopyFile      Where the key copy is written. Default: Documents\yourpersonaldiary-device-key-<app>.txt
.PARAMETER FromDeviceKeyFile Use the bytes of this device.key (exactly 32 bytes) instead of a new random key.
.PARAMETER InviteCode       The invite code as a SecureString (skips the prompt).
.PARAMETER NoInviteCode     Do not set DIARY_INVITE_CODE (e.g. staging, or after the launch window).
.PARAMETER Stage            `fly secrets import --stage`: store the secrets without restarting machines
                            (use before the first deploy; the next deploy picks them up).
.PARAMETER DryRun           Print what would run (values hidden); write the key copy only when -KeyCopyFile was given.
.PARAMETER FlyctlPath       flyctl executable. Default: %USERPROFILE%\.fly\bin\flyctl.exe

.EXAMPLE
  .\scripts\hosted\set-secrets.ps1 -Stage
  .\scripts\hosted\set-secrets.ps1 -App yourpersonaldiary-staging -NoInviteCode -Stage
  .\scripts\hosted\set-secrets.ps1 -FromDeviceKeyFile "$env:APPDATA\com.mydiary.app\device.key" -Stage
  .\scripts\hosted\set-secrets.ps1 -DryRun -NoInviteCode
#>
[CmdletBinding()]
param(
  [string]$App = 'yourpersonaldiary',
  [string]$KeyCopyFile = '',
  [string]$FromDeviceKeyFile = '',
  [System.Security.SecureString]$InviteCode,
  [switch]$NoInviteCode,
  [switch]$Stage,
  [switch]$DryRun,
  [string]$FlyctlPath = (Join-Path $env:USERPROFILE '.fly\bin\flyctl.exe')
)

Set-StrictMode -Version 2
$ErrorActionPreference = 'Stop'

function Say([string]$Message) { Write-Host "[set-secrets] $Message" }
function Fail([string]$Message) { Write-Host "[set-secrets] ERROR: $Message" -ForegroundColor Red; exit 1 }

if ($App -notmatch '^[a-z0-9-]{3,63}$') { Fail "app name '$App' is not a valid Fly app name" }
if ($KeyCopyFile -eq '') {
  $KeyCopyFile = Join-Path ([Environment]::GetFolderPath('MyDocuments')) ("yourpersonaldiary-device-key-$App.txt")
}
if (Test-Path -LiteralPath $KeyCopyFile) {
  Fail "refusing to overwrite the existing key copy $KeyCopyFile - move it away (it may be the key of a running server!) or pass -KeyCopyFile <other path>"
}

# 1. The device key bytes -----------------------------------------------------------------------------
$keyBytes = $null
$keySource = ''
if ($FromDeviceKeyFile -ne '') {
  if (-not (Test-Path -LiteralPath $FromDeviceKeyFile -PathType Leaf)) { Fail "device key file not found: $FromDeviceKeyFile" }
  $keyBytes = [System.IO.File]::ReadAllBytes($FromDeviceKeyFile)
  if ($keyBytes.Length -ne 32) { Fail "a device.key of Your Personal Diary is exactly 32 bytes; this file has $($keyBytes.Length) - not using it" }
  $keySource = 'the existing device.key of this PC (data migration, HOSTED-IMPL item 4)'
} else {
  $keyBytes = New-Object byte[] 32
  $rng = New-Object System.Security.Cryptography.RNGCryptoServiceProvider
  try { $rng.GetBytes($keyBytes) } finally { $rng.Dispose() }
  $keySource = 'new random bytes (RNGCryptoServiceProvider)'
}
$keyB64 = [Convert]::ToBase64String($keyBytes)
if ($keyB64.Length -ne 44) { Fail 'internal error: the base64 key is not 44 characters' }

# 2. The invite code ------------------------------------------------------------------------------------
$invitePlain = $null
if (-not $NoInviteCode) {
  if ($null -eq $InviteCode) {
    if (-not [Environment]::UserInteractive) { Fail 'no console to ask for the invite code: pass -InviteCode (SecureString) or -NoInviteCode' }
    $InviteCode = Read-Host -AsSecureString -Prompt 'Invite code for the launch window (typed hidden; letters, digits, - _ . ; 8-64 characters)'
  }
  $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($InviteCode)
  try { $invitePlain = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) } finally { [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
  if ($invitePlain -notmatch '^[A-Za-z0-9._-]{8,64}$') {
    $invitePlain = $null
    Fail 'the invite code must be 8-64 characters of letters, digits, "-", "_" or "." (ASCII only, no spaces - it has to survive every shell and the clipboard of a phone)'
  }
}

# 3. The key copy - written BEFORE anything is sent, so a failed import never loses the key -------------
$writeCopy = (-not $DryRun) -or $PSBoundParameters.ContainsKey('KeyCopyFile')
if ($writeCopy) {
  $copyDir = Split-Path -Parent $KeyCopyFile
  if ($copyDir -and -not (Test-Path -LiteralPath $copyDir)) { New-Item -ItemType Directory -Path $copyDir | Out-Null }
  $lines = @(
    "Your Personal Diary - DIARY_DEVICE_KEY of the Fly app '$App' (created $(Get-Date -Format s); source: $keySource)",
    'Keep this file in your password manager or offline and delete it from here afterwards.',
    'Whoever holds it together with a copy of the server volume can open every diary; without it a copy of the volume opens nothing.',
    "DIARY_DEVICE_KEY=$keyB64"
  )
  [System.IO.File]::WriteAllLines($KeyCopyFile, $lines, (New-Object System.Text.UTF8Encoding $false))
  try {
    $me = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
    & icacls $KeyCopyFile /inheritance:r /grant:r "${me}:(R,W)" | Out-Null
  } catch { }
  Say "key copy written: $KeyCopyFile (owner-only permissions)"
}

# 4. fly secrets import (stdin) ------------------------------------------------------------------------
$stdinText = "DIARY_DEVICE_KEY=$keyB64`n"
if ($null -ne $invitePlain) { $stdinText += "DIARY_INVITE_CODE=$invitePlain`n" }
$flyArgs = @('secrets', 'import', '--app', $App)
if ($Stage) { $flyArgs += '--stage' }

if ($DryRun) {
  Say "DRY RUN - would run: `"$FlyctlPath`" $($flyArgs -join ' ')   (secrets on stdin, one NAME=VALUE per line):"
  Say '    DIARY_DEVICE_KEY=<44 base64 characters, hidden>'
  if ($null -ne $invitePlain) { Say "    DIARY_INVITE_CODE=<$($invitePlain.Length) characters, hidden>" }
  if (-not $writeCopy) { Say "    (key copy would be written to $KeyCopyFile)" }
} else {
  if (-not (Test-Path -LiteralPath $FlyctlPath -PathType Leaf)) { Fail "flyctl not found at $FlyctlPath (pass -FlyctlPath)" }
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $FlyctlPath
  $psi.Arguments = ($flyArgs -join ' ')
  $psi.UseShellExecute = $false
  $psi.RedirectStandardInput = $true
  # Windows PowerShell 5.1 (.NET Framework) builds the child's StandardInput writer from [Console]::InputEncoding
  # and flushes it at start, so a UTF-8 console with a byte-order mark sends "﻿" before the first line and
  # Fly answers "﻿DIARY_DEVICE_KEY is not a valid secret name" (seen 2026-10-22). A BOM-less console
  # encoding for the duration of the call is the only fix that keeps the values off the disk and off the command line.
  $previousInputEncoding = [Console]::InputEncoding
  try {
    [Console]::InputEncoding = New-Object System.Text.UTF8Encoding $false
    $proc = [System.Diagnostics.Process]::Start($psi)
    $proc.StandardInput.Write($stdinText)
    $proc.StandardInput.Close()
    $proc.WaitForExit()
  } finally {
    [Console]::InputEncoding = $previousInputEncoding
  }
  if ($proc.ExitCode -ne 0) {
    Fail "fly secrets import exited with $($proc.ExitCode). The key copy is safe at $KeyCopyFile; fix the problem (fly auth login? app name?) and run the script again with -KeyCopyFile <new path>, or import by hand as docs/HOSTED-DEPLOY.he.md describes."
  }
}

# 5. Forget the values -----------------------------------------------------------------------------------
[Array]::Clear($keyBytes, 0, $keyBytes.Length)
$keyB64 = $null
$invitePlain = $null
$stdinText = $null

$what = 'DIARY_DEVICE_KEY'
if (-not $NoInviteCode) { $what += ' and DIARY_INVITE_CODE' }
if ($DryRun) { Say "dry run finished: would set $what on app '$App'" }
else {
  $when = ''
  if ($Stage) { $when = ' (staged: applied by the next deploy)' }
  Say "done: $what set on app '$App'$when. Next: scripts\hosted\deploy.ps1$(if ($App -like '*-staging') { ' -Staging' })"
}
exit 0
