<#
.SYNOPSIS
    Builds the debug APK of Your Personal Diary and verifies it statically:
    npm run mobile:build  ->  npx cap sync android  ->  gradlew assembleDebug  ->  verify-apk.ps1

    The default is the published SERVER build (a thin client of the Your Personal Diary server); with
    MOBILE_LOCAL_CORE=1 in the environment the developer / test build with the in-process core is made
    and verified with verify-apk.ps1 -LocalCore.

    npm run android:apk
    npm run android:apk -- -SkipWeb            (reuse mobile-dist/)
    npm run android:apk -- -SkipWeb -SkipSync  (Gradle only)
    powershell -NoProfile -ExecutionPolicy Bypass -File scripts/android/build-apk.ps1 [-SkipWeb] [-SkipSync] [-NoVerify] [-Offline] [-KeepDaemon]

    The first build downloads the Gradle distribution and the Android dependencies (several hundred
    MB, into GRADLE_USER_HOME) and can take well over ten minutes; later builds take about a minute.
    From a tool with a time limit, start it detached and poll the log, e.g.
      Start-Process cmd -ArgumentList '/v:on','/c',"cd /d <android dir> && <android dir>\gradlew.bat assembleDebug --console=plain > <log> 2>&1 & echo EXIT !ERRORLEVEL! >> <log>" -WindowStyle Hidden
    The Gradle daemon is stopped at the end unless -KeepDaemon is given.
#>
param(
    [switch] $SkipWeb,
    [switch] $SkipSync,
    [switch] $NoVerify,
    [switch] $Offline,
    [switch] $KeepDaemon
)

. "$PSScriptRoot\env.ps1"

$total = [System.Diagnostics.Stopwatch]::StartNew()

function Step([string] $Name, [scriptblock] $Body) {
    $watch = [System.Diagnostics.Stopwatch]::StartNew()
    Write-Host ''
    Write-Host ">> $Name" -ForegroundColor Cyan
    & $Body
    Write-Host ('<< {0} ({1:N0} s)' -f $Name, $watch.Elapsed.TotalSeconds) -ForegroundColor DarkGray
}

if (-not $SkipWeb) { Step 'npm run mobile:build' { Invoke-Npm run mobile:build } }
if (-not $SkipSync) { Step 'npx cap sync android' { Invoke-Npx cap sync android } }

$gradleArgs = @('assembleDebug', '--console=plain')
if ($Offline) { $gradleArgs += '--offline' }
try {
    Step 'gradlew assembleDebug' { Invoke-Gradle @gradleArgs }
} finally {
    if (-not $KeepDaemon) { Stop-GradleDaemon }
}

if (-not (Test-Path -LiteralPath $DebugApk)) { throw "Gradle finished but the APK is missing: $DebugApk" }
$apk = Get-Item -LiteralPath $DebugApk
Write-Host ''
Write-Host "APK:   $($apk.FullName)" -ForegroundColor Green
Write-Host ("Size:  {0} ({1:N0} bytes)" -f (Format-Size $apk.Length), $apk.Length)
Write-Host ("Total: {0:N0} s" -f $total.Elapsed.TotalSeconds)

if (-not $NoVerify) {
    # The published app is the server build; MOBILE_LOCAL_CORE=1 (mobile/vite.config.mobile.ts) builds the
    # developer / test app with the in-process core, whose assets verify-apk then checks instead.
    if ($env:MOBILE_LOCAL_CORE -eq '1') {
        & "$PSScriptRoot\verify-apk.ps1" -Apk $apk.FullName -LocalCore
    } else {
        & "$PSScriptRoot\verify-apk.ps1" -Apk $apk.FullName
    }
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
