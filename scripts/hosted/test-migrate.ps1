<#
.SYNOPSIS
  Fictional-data test of scripts\hosted\migrate-from-pc.ps1 (and of the in-container apply step).

.DESCRIPTION
  Builds a fake desktop data directory from the committed, FICTIONAL fixtures (mobile\test\fixtures\desktop-data:
  one account "fixture_noa"), adds everything a real data dir may hold (server-settings.json with remote + mail
  blocks, sessions.json, resets.json, tls\, server.log, .prev/.tmp files), runs the migration in -DryRun mode
  (every local step for real, no fly calls) and asserts what travelled and what stayed. Then, when Git's sh.exe
  is available, simulates the container's apply step (deploy\hosted\data-tools.sh apply-incoming) on a fake
  /data directory and checks that the previous registry was moved aside and the upload applied.
  Never touches %APPDATA%\com.mydiary.app. Exit code 0 = all assertions passed.

  Usage: powershell -NoProfile -ExecutionPolicy Bypass -File scripts\hosted\test-migrate.ps1
#>
[CmdletBinding()]
param()

Set-StrictMode -Version 2
$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$fixtures = Join-Path $root 'mobile\test\fixtures'
$script = Join-Path $root 'scripts\hosted\migrate-from-pc.ps1'
$work = Join-Path $env:TEMP ('mpd-migrate-test-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
$failures = New-Object System.Collections.ArrayList

function Assert([bool]$Condition, [string]$What) {
  if ($Condition) { Write-Host "  ok   $What" } else { Write-Host "  FAIL $What" -ForegroundColor Red; [void]$failures.Add($What) }
}
function Sha([string]$Path) { (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash }
function RunMigrate([string[]]$ExtraArgs, [string]$Source, [string]$Staging) {
  $argList = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $script, '-SourceDir', $Source, '-StagingDir', $Staging, '-App', 'yourpersonaldiary-staging', '-DryRun') + $ExtraArgs
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = 'powershell.exe'
  $psi.Arguments = ($argList | ForEach-Object { if ($_ -match '\s') { '"' + $_ + '"' } else { $_ } }) -join ' '
  $psi.UseShellExecute = $false
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $p = [System.Diagnostics.Process]::Start($psi)
  $out = $p.StandardOutput.ReadToEnd() + $p.StandardError.ReadToEnd()
  $p.WaitForExit()
  return @{ Code = $p.ExitCode; Out = $out }
}

# 1. A fictional desktop data directory -------------------------------------------------------------------
$manifest = Get-Content -LiteralPath (Join-Path $fixtures 'manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$username = $manifest.account.username
$dbFile = $manifest.account.dbFile
$source = Join-Path $work 'source'
New-Item -ItemType Directory -Path (Join-Path $source 'users') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $source 'tls') -Force | Out-Null
Copy-Item (Join-Path $fixtures 'desktop-data\accounts.json') (Join-Path $source 'accounts.json')
Copy-Item (Join-Path $fixtures 'desktop-data\sessions.json') (Join-Path $source 'sessions.json')
Copy-Item (Join-Path $fixtures 'desktop-data\device.key') (Join-Path $source 'device.key')
Copy-Item (Join-Path $fixtures ('desktop-data\users\' + $dbFile + '.fixture')) (Join-Path $source ('users\' + $dbFile))
Copy-Item (Join-Path $fixtures ('desktop-data\users\' + $dbFile + '.fixture')) (Join-Path $source ('users\' + $dbFile + '.prev'))
[System.IO.File]::WriteAllText((Join-Path $source ('users\' + $dbFile + '.tmp')), 'half-written', [System.Text.Encoding]::ASCII)
$settings = @{
  port = 47321; lanEnabled = $true
  remote = @{ enabled = $true; hostname = 'fictional.duckdns.org'; duckdnsTokenEnc = 'ZmljdGlvbmFs'; publicPort = 47471; upnp = $true; staging = $false }
  mail = @{ enabled = $true; host = 'smtp.gmail.com'; port = 465; security = 'tls'; username = 'fixture.owner@example.test'; passwordEnc = $manifest.mail.passwordEnc; fromAddress = ''; ownerUserId = $manifest.account.id }
} | ConvertTo-Json -Depth 6
[System.IO.File]::WriteAllText((Join-Path $source 'server-settings.json'), $settings, (New-Object System.Text.UTF8Encoding $false))
[System.IO.File]::WriteAllText((Join-Path $source 'resets.json'), '{"version":1,"resets":[]}', [System.Text.Encoding]::ASCII)
[System.IO.File]::WriteAllText((Join-Path $source 'tls\cert.pem'), 'fictional', [System.Text.Encoding]::ASCII)
[System.IO.File]::WriteAllText((Join-Path $source 'server.log'), 'fictional log', [System.Text.Encoding]::ASCII)
[System.IO.File]::WriteAllText((Join-Path $source 'client-location.json'), '{"mode":"local"}', [System.Text.Encoding]::ASCII)
Write-Host "[test-migrate] fictional source at $source"

# 2. Default run ------------------------------------------------------------------------------------------
Write-Host '[test-migrate] run 1: defaults (-DryRun)'
$staging1 = Join-Path $work 'staging1'
$r = RunMigrate @() $source $staging1
Assert ($r.Code -eq 0) "exit code 0 (got $($r.Code))"
$data1 = Join-Path $staging1 'data'
Assert (Test-Path (Join-Path $data1 'accounts.json')) 'accounts.json travels'
Assert ((Sha (Join-Path $data1 'accounts.json')) -eq (Sha (Join-Path $source 'accounts.json'))) 'accounts.json byte-identical'
Assert (Test-Path (Join-Path $data1 ('users\' + $dbFile))) 'users\<id>.mpd travels'
Assert ((Sha (Join-Path $data1 ('users\' + $dbFile))) -eq (Sha (Join-Path $source ('users\' + $dbFile)))) 'diary byte-identical'
Assert (-not (Test-Path (Join-Path $data1 ('users\' + $dbFile + '.prev')))) '.prev stays (default)'
Assert (-not (Test-Path (Join-Path $data1 ('users\' + $dbFile + '.tmp')))) '.tmp stays'
foreach ($name in @('sessions.json', 'resets.json', 'device.key', 'tls', 'server.log', 'client-location.json')) {
  Assert (-not (Test-Path (Join-Path $data1 $name))) "$name stays on the PC"
}
$settingsOut = Join-Path $data1 'server-settings.json'
Assert (Test-Path $settingsOut) 'server-settings.json travels (mail block)'
if (Test-Path $settingsOut) {
  $parsed = Get-Content -LiteralPath $settingsOut -Raw -Encoding UTF8 | ConvertFrom-Json
  Assert ($null -ne $parsed.PSObject.Properties['mail']) 'mail block present'
  Assert ($null -eq $parsed.PSObject.Properties['remote']) 'remote block stripped'
  Assert ($null -eq $parsed.PSObject.Properties['port'] -and $null -eq $parsed.PSObject.Properties['lanEnabled']) 'port / lanEnabled stripped'
  Assert ($parsed.mail.passwordEnc -eq $manifest.mail.passwordEnc) 'encrypted SMTP password unchanged'
  Assert ($parsed.mail.ownerUserId -eq $manifest.account.id) 'mail ownerUserId unchanged'
}
$tar1 = Join-Path $staging1 'pc-data.tar'
Assert (Test-Path $tar1) 'pc-data.tar created'
if (Test-Path $tar1) {
  $list = & (Join-Path $env:SystemRoot 'System32\tar.exe') -tf $tar1
  Assert (@($list) -contains './accounts.json') 'tar holds ./accounts.json'
  Assert (@($list) -contains ('./users/' + $dbFile)) 'tar holds ./users/<id>.mpd'
  Assert (@($list) -contains './server-settings.json') 'tar holds ./server-settings.json'
  Assert (-not (@($list) -like '*device.key*')) 'tar has no device.key'
  Assert (-not (@($list) -like '*sessions.json*')) 'tar has no sessions.json'
}
Assert (Test-Path (Join-Path $staging1 'manifest.txt')) 'manifest.txt written'
Assert ($r.Out -match 'accounts=1') 'output reports accounts=1'
Assert ($r.Out -notmatch [regex]::Escape($username)) 'output never prints the username'
Assert ($r.Out -notmatch 'example\.test') 'output never prints an e-mail address'
Assert ($r.Out -match 'DRY RUN - would run: .*ssh sftp put .*pc-data\.tar /data/incoming/pc-data\.tar --app yourpersonaldiary-staging') 'dry run prints the sftp upload'
Assert ($r.Out -match 'diary-data-tools arm /data') 'dry run prints the arm step'
Assert ($r.Out -match 'machine restart <machine-id> --app yourpersonaldiary-staging --signal SIGTERM') 'dry run prints the restart'
Assert ($r.Out -match 'diary-data-tools count /data') 'dry run prints the count verification'
Assert (Test-Path $staging1) 'dry run keeps the staging folder'

# 3. Fallback run: device key travels, mail excluded, .prev kept ------------------------------------------
Write-Host '[test-migrate] run 2: -IncludeDeviceKey -ExcludeMail -KeepPrevFiles'
$staging2 = Join-Path $work 'staging2'
$r2 = RunMigrate @('-IncludeDeviceKey', '-ExcludeMail', '-KeepPrevFiles') $source $staging2
Assert ($r2.Code -eq 0) "exit code 0 (got $($r2.Code))"
$data2 = Join-Path $staging2 'data'
Assert (Test-Path (Join-Path $data2 'device.key')) 'device.key travels with -IncludeDeviceKey'
Assert (-not (Test-Path (Join-Path $data2 'server-settings.json'))) 'no server-settings.json with -ExcludeMail'
Assert (Test-Path (Join-Path $data2 ('users\' + $dbFile + '.prev'))) '.prev travels with -KeepPrevFiles'
Assert (-not (Test-Path (Join-Path $data2 'sessions.json'))) 'sessions.json still stays'

# 4. Refusals -----------------------------------------------------------------------------------------------
Write-Host '[test-migrate] run 3: refusals'
$r3 = RunMigrate @() (Join-Path $work 'does-not-exist') (Join-Path $work 'staging3')
Assert ($r3.Code -ne 0 -and $r3.Out -match 'not found') 'missing source dir refused'
$r4 = RunMigrate @() $source $staging1
Assert ($r4.Code -ne 0 -and $r4.Out -match 'not empty') 'non-empty staging dir refused'

# 5. The container apply step (deploy\hosted\data-tools.sh) under Git's sh, if present --------------------------
$sh = @("$env:ProgramFiles\Git\usr\bin\sh.exe", "$env:ProgramFiles\Git\bin\sh.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
if ($sh) {
  Write-Host "[test-migrate] run 4: apply-incoming under $sh"
  $fakeData = Join-Path $work 'fake-volume'
  New-Item -ItemType Directory -Path (Join-Path $fakeData 'incoming') -Force | Out-Null
  New-Item -ItemType Directory -Path (Join-Path $fakeData 'users') -Force | Out-Null
  [System.IO.File]::WriteAllText((Join-Path $fakeData 'accounts.json'), '{"version":1,"accounts":[{"id":"u_00000000000000aa","dbFile":"u_00000000000000aa.mpd"},{"id":"u_00000000000000bb","dbFile":"u_00000000000000bb.mpd"}]}', [System.Text.Encoding]::ASCII)
  [System.IO.File]::WriteAllText((Join-Path $fakeData 'users\u_00000000000000aa.mpd'), 'old-a', [System.Text.Encoding]::ASCII)
  [System.IO.File]::WriteAllText((Join-Path $fakeData 'users\u_00000000000000bb.mpd'), 'old-b', [System.Text.Encoding]::ASCII)
  [System.IO.File]::WriteAllText((Join-Path $fakeData 'sessions.json'), '{"sessions":[]}', [System.Text.Encoding]::ASCII)
  Copy-Item $tar1 (Join-Path $fakeData 'incoming\pc-data.tar')
  $toolsPath = (Join-Path $root 'deploy\hosted\data-tools.sh') -replace '\\', '/'
  # MSYS path (/c/Users/...): GNU tar would read "C:" in a Windows path as a remote host name.
  $fakeDataSh = '/' + $fakeData.Substring(0, 1).ToLower() + ($fakeData.Substring(2) -replace '\\', '/')
  # sh.exe started from .NET inherits the Windows PATH only: put Git's coreutils (find, wc, tr, date, tar)
  # first, or Windows' own find.exe answers instead.
  $gitRoot = Split-Path -Parent (Split-Path -Parent $sh)
  if ($sh -match '^(.*\\Git)\\') { $gitRoot = $Matches[1] }
  $gitUsrBin = Join-Path $gitRoot 'usr\bin'
  function Sh([string[]]$Arguments) {
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $sh
    $psi.Arguments = ('"' + $toolsPath + '" ' + ($Arguments -join ' '))
    $psi.EnvironmentVariables['PATH'] = "$gitUsrBin;" + $env:PATH
    $psi.UseShellExecute = $false; $psi.RedirectStandardOutput = $true; $psi.RedirectStandardError = $true
    $p = [System.Diagnostics.Process]::Start($psi)
    $o = $p.StandardOutput.ReadToEnd() + $p.StandardError.ReadToEnd(); $p.WaitForExit()
    return @{ Code = $p.ExitCode; Out = $o }
  }
  $c0 = Sh @('count', "`"$fakeDataSh`"")
  Assert ($c0.Code -eq 0 -and $c0.Out -match 'accounts=2' -and $c0.Out -match 'diaries=2') "count before: accounts=2 diaries=2 ($($c0.Out.Trim() -replace '\s+', ' '))"
  $noMarker = Sh @('apply-incoming', "`"$fakeDataSh`"")
  Assert ($noMarker.Code -eq 0 -and (Test-Path (Join-Path $fakeData 'incoming\pc-data.tar')) -and ((Get-Content (Join-Path $fakeData 'accounts.json') -Raw) -match 'u_00000000000000aa')) 'without the APPLY marker nothing happens'
  $arm = Sh @('arm', "`"$fakeDataSh`"")
  Assert ($arm.Code -eq 0 -and (Test-Path (Join-Path $fakeData 'incoming\APPLY'))) 'arm creates the marker'
  $apply = Sh @('apply-incoming', "`"$fakeDataSh`"")
  Assert ($apply.Code -eq 0) "apply-incoming exits 0 ($($apply.Out.Trim() -replace '\s+', ' '))"
  Assert ((Sha (Join-Path $fakeData 'accounts.json')) -eq (Sha (Join-Path $source 'accounts.json'))) 'accounts.json replaced by the upload'
  Assert (Test-Path (Join-Path $fakeData ('users\' + $dbFile))) 'uploaded diary in place'
  Assert (-not (Test-Path (Join-Path $fakeData 'users\u_00000000000000aa.mpd'))) 'old diaries no longer in users\'
  $aside = @(Get-ChildItem -LiteralPath (Join-Path $fakeData 'incoming') -Directory | Where-Object { $_.Name -like 'replaced-*' })
  Assert ($aside.Count -eq 1) 'previous registry moved aside once'
  if ($aside.Count -eq 1) {
    Assert (Test-Path (Join-Path $aside[0].FullName 'accounts.json')) 'aside holds the old accounts.json'
    Assert (Test-Path (Join-Path $aside[0].FullName 'users\u_00000000000000bb.mpd')) 'aside holds the old diaries'
    Assert (Test-Path (Join-Path $aside[0].FullName 'sessions.json')) 'aside holds the old sessions.json'
  }
  Assert (-not (Test-Path (Join-Path $fakeData 'incoming\pc-data.tar')) -and -not (Test-Path (Join-Path $fakeData 'incoming\APPLY'))) 'tar and marker removed after apply'
  Assert (Test-Path (Join-Path $fakeData 'incoming\last-apply.txt')) 'last-apply.txt written'
  $c1 = Sh @('count', "`"$fakeDataSh`"")
  Assert ($c1.Code -eq 0 -and $c1.Out -match 'accounts=1' -and $c1.Out -match 'diaries=1') "count after: accounts=1 diaries=1 ($($c1.Out.Trim() -replace '\s+', ' '))"
  Assert ($apply.Out -notmatch [regex]::Escape($username)) 'apply log prints no username'
  $disarm = Sh @('disarm', "`"$fakeDataSh`"")
  Assert ($disarm.Code -eq 0) 'disarm on an empty incoming is fine'
} else {
  Write-Host '[test-migrate] run 4 skipped: Git sh.exe not found (the apply step is plain POSIX sh; verify it on staging)'
}

# 6. Clean up -----------------------------------------------------------------------------------------------
try { [System.IO.Directory]::Delete($work, $true) } catch { Write-Host "[test-migrate] (could not delete $work : $($_.Exception.Message))" }

if ($failures.Count -gt 0) {
  Write-Host "[test-migrate] FAILED: $($failures.Count) assertion(s)" -ForegroundColor Red
  exit 1
}
Write-Host '[test-migrate] all assertions passed'
exit 0
