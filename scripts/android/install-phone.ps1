<#
.SYNOPSIS
    Installs the debug APK on the owner's phone over Wireless debugging (Android 11+; USB works too),
    starts the app and collects the logcat lines of our process (WebView console, crashes) in a file.
    The owner's steps are in docs/ANDROID-PHONE-TEST.he.md.

    First time (pair + connect; the two addresses and the code come from the phone's
    "Wireless debugging" screen and are only valid for a short while on the home Wi-Fi):
      npm run android:install -- -PairAddress 192.168.1.23:41234 -PairCode 123456 -ConnectAddress 192.168.1.23:37521
    Already paired (the phone remembers this computer):
      npm run android:install -- -ConnectAddress 192.168.1.23:37521
    One device already connected (USB or an earlier adb connect):
      npm run android:install

    Options: -Apk <path> (default: the debug APK), -LogSeconds <n> (default 45), -LogFile <path>
             (default android\build\logs\phone-logcat-<timestamp>.txt), -NoLaunch, -Disconnect,
             -RemoveOldApp

    The application id is app.yourpersonaldiary since 2026-10-25 ($AppId in env.ps1). A phone that has
    a test build from before (com.mydiary.app, $LegacyAppId) gets a SECOND, separate app - the script
    says so and never removes the old one by itself. -RemoveOldApp runs "adb uninstall com.mydiary.app"
    (that app and its local data only) - pass it only after the owner checked the old app holds nothing
    that is not on the server and asked for it (docs/ANDROID-PHONE-TEST.he.md).
#>
param(
    [string] $PairAddress,
    [string] $PairCode,
    [string] $ConnectAddress,
    [string] $Apk,
    [int] $LogSeconds = 45,
    [string] $LogFile,
    [switch] $NoLaunch,
    [switch] $Disconnect,
    [switch] $RemoveOldApp
)

. "$PSScriptRoot\env.ps1"

if (-not $Apk) { $Apk = $DebugApk }
if (-not (Test-Path -LiteralPath $Apk)) { throw "APK not found: $Apk - build it first (npm run android:apk)" }
$Apk = (Resolve-Path -LiteralPath $Apk).Path
if (-not $LogFile) {
    $logDir = Join-Path $AndroidDir 'build\logs'
    New-Item -ItemType Directory -Force -Path $logDir | Out-Null
    $LogFile = Join-Path $logDir ("phone-logcat-{0:yyyyMMdd-HHmmss}.txt" -f (Get-Date))
}

# EVERY adb call goes through cmd with stderr merged: env.ps1 sets $ErrorActionPreference = 'Stop', and in
# Windows PowerShell 5.1 a native command whose stderr is redirected (2>&1, 2>$null) turns each stderr
# line into a terminating NativeCommandError - adb writes 'error: device offline', '* daemon started'
# and the like to stderr. Merged inside cmd, those lines are plain text in the result. Never invoke
# $Adb directly in this file (Start-Process below is a separate process and is unaffected).
function AdbLines([string[]] $Arguments) {
    $quoted = ($Arguments | ForEach-Object { if ($_ -match '\s') { "`"$_`"" } else { $_ } }) -join ' '
    return @(& cmd /c "`"$Adb`" $quoted 2>&1" | ForEach-Object { "$_" })
}
function AdbText([string[]] $Arguments) {
    return ((AdbLines $Arguments) -join "`n").Trim()
}

function Get-Devices {
    return @(AdbLines @('devices') | Select-Object -Skip 1 | Where-Object { $_ -match '^\S+\s+\S+' } | ForEach-Object {
            $parts = $_.Trim() -split '\s+'
            [pscustomobject]@{ Serial = $parts[0]; State = $parts[1] }
        })
}

AdbLines @('start-server') | Out-Null

if ($PairAddress) {
    if (-not $PairCode) { throw '-PairAddress needs -PairCode (the 6-digit code shown by the phone)' }
    Write-Host "Pairing with $PairAddress ..."
    $pairOutput = AdbText @('pair', $PairAddress, $PairCode)
    Write-Host $pairOutput
    if ($pairOutput -notmatch 'Successfully paired') { throw "Pairing failed. On the phone open Wireless debugging > 'Pair device with pairing code' again and send the new address and code." }
}

if ($ConnectAddress) {
    Write-Host "Connecting to $ConnectAddress ..."
    $connectOutput = AdbText @('connect', $ConnectAddress)
    Write-Host $connectOutput
    if ($connectOutput -notmatch 'connected to') { throw "Connection failed. Check the IP address and port shown on the Wireless debugging screen (they change when it is turned off and on)." }
    $serial = $ConnectAddress
} else {
    $online = @(Get-Devices | Where-Object { $_.State -eq 'device' })
    if ($online.Count -ne 1) {
        $list = (Get-Devices | ForEach-Object { "$($_.Serial) ($($_.State))" }) -join ', '
        throw "Expected exactly one connected device; found: [$list]. Pass -ConnectAddress (and -PairAddress/-PairCode the first time)."
    }
    $serial = $online[0].Serial
}

# Wait until the device is ready (state "device", not "offline"/"unauthorized").
$ready = $false
for ($i = 0; $i -lt 30 -and -not $ready; $i++) {
    $state = (Get-Devices | Where-Object { $_.Serial -eq $serial } | Select-Object -First 1).State
    if ($state -eq 'device') { $ready = $true } else { Start-Sleep -Seconds 1 }
}
if (-not $ready) { throw "Device $serial is not ready (state: $state). If it says 'unauthorized', accept the prompt on the phone." }

function Prop([string] $Name) { return (AdbText @('-s', $serial, 'shell', 'getprop', $Name)) }
Write-Host ''
Write-Host ("Device: {0} {1} - Android {2} (API {3})" -f (Prop 'ro.product.manufacturer'), (Prop 'ro.product.model'), (Prop 'ro.build.version.release'), (Prop 'ro.build.version.sdk'))
$webViewLine = (AdbLines @('-s', $serial, 'shell', 'dumpsys', 'webviewupdate') | Where-Object { $_ -match 'Current WebView package' } | Select-Object -First 1)
if ($webViewLine) { Write-Host "WebView: $($webViewLine.Trim())  (Capacitor passes the safe-area insets natively from WebView 140 on)" }

Write-Host ''
Write-Host "Installing $Apk ..."
$installOutput = AdbText @('-s', $serial, 'install', '-r', $Apk)
Write-Host $installOutput
if ($installOutput -notmatch 'Success') { throw 'Installation failed (see the output above; INSTALL_FAILED_UPDATE_INCOMPATIBLE means an app with the same id but another signature is installed - uninstall it first).' }

# The test builds before 2026-10-25 had another application id: on such a phone the old app stays next
# to the new one (two "Your Personal Diary" icons). Exact match on the pm line - never a prefix.
$legacyInstalled = [bool](AdbLines @('-s', $serial, 'shell', 'pm', 'list', 'packages', $LegacyAppId) | Where-Object { $_.Trim() -eq "package:$LegacyAppId" })
if ($legacyInstalled -and $RemoveOldApp) {
    Write-Host ''
    Write-Host "Removing the old app $LegacyAppId (-RemoveOldApp) ..."
    $uninstallOutput = AdbText @('-s', $serial, 'uninstall', $LegacyAppId)
    Write-Host $uninstallOutput
    if ($uninstallOutput -notmatch 'Success') { Write-Host "The old app $LegacyAppId was NOT removed (see above); it can be removed on the phone." -ForegroundColor Yellow }
} elseif ($legacyInstalled) {
    Write-Host ''
    Write-Host "Note: the old test app $LegacyAppId is still installed - a separate app next to $AppId. The owner checks it holds no entries that are not on the server, then removes it (docs/ANDROID-PHONE-TEST.he.md), or asks for -RemoveOldApp." -ForegroundColor Yellow
} elseif ($RemoveOldApp) {
    Write-Host "-RemoveOldApp: $LegacyAppId is not installed - nothing to remove."
}

AdbLines @('-s', $serial, 'logcat', '-c') | Out-Null
if (-not $NoLaunch) {
    # The activity class lives in the Java namespace, the package is the application id.
    Write-Host "Starting $AppId ..."
    $startOutput = AdbText @('-s', $serial, 'shell', 'am', 'start', '-W', '-n', "$AppId/$AppNamespace.MainActivity")
    Write-Host $startOutput
}

Write-Host ''
Write-Host "Collecting logcat for $LogSeconds s into $LogFile ..."
$logcat = Start-Process -FilePath $Adb -ArgumentList @('-s', $serial, 'logcat', '-v', 'time') -RedirectStandardOutput $LogFile -NoNewWindow -PassThru
try {
    for ($i = 0; $i -lt $LogSeconds; $i++) {
        Start-Sleep -Seconds 1
        if (($i + 1) % 5 -eq 0) { Write-Host -NoNewline '.' }
    }
} finally {
    if (-not $logcat.HasExited) { Stop-Process -Id $logcat.Id -Force -ErrorAction SilentlyContinue }
}
Write-Host ''

# pidof prints nothing (exit 1) when the process is gone; anything non-numeric is an adb message
# ('error: device offline', 'adb: device ... not found') and counts as "not running" - the summary
# below is printed in every case (the raw log file is already on disk).
$pid_ = (AdbText @('-s', $serial, 'shell', 'pidof', '-s', $AppId))
if ($pid_ -notmatch '^\d+$') {
    if ($pid_) { Write-Host "pidof: $pid_" }
    $pid_ = ''
    $psLine = (AdbLines @('-s', $serial, 'shell', 'ps', '-A') | Where-Object { $_ -match "\s$([regex]::Escape($AppId))\s*$" } | Select-Object -First 1)
    if ($psLine) { $candidate = ($psLine.Trim() -split '\s+')[1]; if ($candidate -match '^\d+$') { $pid_ = $candidate } }
}
Write-Host ("Process: {0}" -f $(if ($pid_) { "running, pid $pid_" } else { 'NOT RUNNING (crashed or not started) - see the AndroidRuntime lines below' }))

$lines = @(Get-Content -LiteralPath $LogFile -ErrorAction SilentlyContinue)
# The process / package name is $AppId; stack traces name the classes of $AppNamespace.
$pattern = 'AndroidRuntime|' + [regex]::Escape($AppId) + '|' + [regex]::Escape($AppNamespace) + '|Capacitor|chromium|cr_'
if ($pid_) { $pattern += '|\(\s*' + $pid_ + '\)' }
$ours = @($lines | Where-Object { $_ -match $pattern })
$errors = @($ours | Where-Object { $_ -match '^\S+\s+\S+\s+[EF]/' })
Write-Host ''
Write-Host ("Logcat: {0} lines, {1} from our app, {2} errors/fatals" -f $lines.Count, $ours.Count, $errors.Count)
$show = if ($ours.Count -gt 150) { $ours | Select-Object -Last 150 } else { $ours }
$show | ForEach-Object { Write-Host $_ }
Write-Host ''
Write-Host "Full log: $LogFile"

if ($Disconnect -and $ConnectAddress) {
    Write-Host (AdbText @('disconnect', $ConnectAddress))
}
Write-Host 'When done testing, turn Wireless debugging off on the phone (Developer options).'
