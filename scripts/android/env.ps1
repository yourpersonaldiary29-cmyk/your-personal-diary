<#
.SYNOPSIS
    Environment of the Android build. Dot-source it from every other script in this folder:

        . "$PSScriptRoot\env.ps1"

.DESCRIPTION
    Sets, for the current process only (never setx - the processes of the Claude desktop app run in an
    MSIX container whose AppData is redirected, so the tools live under C:\Users\AVI\Tools):

        JAVA_HOME          C:\Users\AVI\Tools\jdk-21            (Temurin 21)
        ANDROID_HOME       C:\Users\AVI\Tools\android-sdk       (also ANDROID_SDK_ROOT)
        GRADLE_USER_HOME   C:\Users\AVI\Tools\gradle-home       (created; short path, outside AppData)
        PATH               + jdk-21\bin, platform-tools, and the Node.js folder when npm is not on PATH

    checks that the tools exist, and writes android\local.properties (sdk.dir, escaped backslashes) -
    that file is generated here and is never committed. A caller that sets $AndroidEnvNoWrites = $true
    before dot-sourcing gets the same variables with NO writes (no gradle-home folder, no local.properties).

    Overrides (set before dot-sourcing, e.g. on another machine):
        DIARY_ANDROID_JDK, DIARY_ANDROID_SDK, DIARY_GRADLE_USER_HOME, DIARY_ANDROID_SIGNING (see build-aab.ps1),
        DIARY_BUNDLETOOL (the bundletool jar, see build-aab.ps1)

    The same variables for Git Bash are in scripts/android/env.sh.

    Variables and helpers exported to the calling script:
        $ProjectRoot, $AndroidDir, $JdkHome, $AndroidSdk, $GradleUserHome, $BuildToolsVersion, $PlatformVersion
        $Gradlew, $Adb, $Aapt2, $ApkAnalyzer, $AndroidCli, $DebugApk, $ReleaseAab, $SigningPropertiesFile
        $Keytool, $Java, $BundletoolJar (may not exist - build-aab.ps1 says what to do)
        $AppId, $AppNamespace, $LegacyAppId
        Invoke-Gradle <args>     runs gradlew.bat in android\ and throws on a non-zero exit code
        Invoke-Npm <args>        runs npm in the project root and throws on a non-zero exit code
        Invoke-Npx <args>        runs npx in the project root and throws on a non-zero exit code
        Stop-GradleDaemon        gradlew --stop (ignores failures)
        Format-Size <bytes>      "12.3 MB"
#>
$ErrorActionPreference = 'Stop'

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$AndroidDir = Join-Path $ProjectRoot 'android'

# --- Tool locations (overridable) ----------------------------------------------------------------
$JdkHome = if ($env:DIARY_ANDROID_JDK) { $env:DIARY_ANDROID_JDK } else { 'C:\Users\AVI\Tools\jdk-21' }
$AndroidSdk = if ($env:DIARY_ANDROID_SDK) { $env:DIARY_ANDROID_SDK } else { 'C:\Users\AVI\Tools\android-sdk' }
$GradleUserHome = if ($env:DIARY_GRADLE_USER_HOME) { $env:DIARY_GRADLE_USER_HOME } else { 'C:\Users\AVI\Tools\gradle-home' }
# The build-tools / platform revisions the project is built with (android/variables.gradle agrees).
$BuildToolsVersion = '36.1.0'
$PlatformVersion = 'android-36'
# The identity - the ONE place in the scripts; android/app/build.gradle is the one place in the build
# (mobile/test/android-app-id.test.ts keeps the two equal):
#   $AppId         the applicationId (package name on the phone and on Google Play, process name, adb
#                  install / am start / pidof) - owner decision 2026-10-25, permanent after the first upload;
#   $AppNamespace  the Java namespace: the package of MainActivity and the plugins, so the launcher
#                  activity is "$AppNamespace.MainActivity" inside the package $AppId;
#   $LegacyAppId   the id of the test builds before 2026-10-25 - a DIFFERENT app on a phone that had
#                  one installed (install-phone.ps1 only reports it; the owner removes it, see
#                  docs/ANDROID-PHONE-TEST.he.md).
$AppId = 'app.yourpersonaldiary'
$AppNamespace = 'com.mydiary.app'
$LegacyAppId = 'com.mydiary.app'
# Release signing (optional, external, never committed; the OWNER creates it once with
# scripts/android/create-upload-key.ps1 - see build-aab.ps1).
$SigningPropertiesFile = if ($env:DIARY_ANDROID_SIGNING) { $env:DIARY_ANDROID_SIGNING } else { 'C:\Users\AVI\Projects\android-signing\keystore.properties' }
# bundletool (Google's command-line tool for app bundles) is NOT part of the SDK: the owner downloads the
# jar by hand (build-aab.ps1 prints the instructions when it is missing; no script downloads anything).
$BundletoolJar = if ($env:DIARY_BUNDLETOOL) { $env:DIARY_BUNDLETOOL } else { 'C:\Users\AVI\Tools\bundletool\bundletool.jar' }

$Gradlew = Join-Path $AndroidDir 'gradlew.bat'
$Keytool = Join-Path $JdkHome 'bin\keytool.exe'
$Java = Join-Path $JdkHome 'bin\java.exe'
$Adb = Join-Path $AndroidSdk 'platform-tools\adb.exe'
$Aapt2 = Join-Path $AndroidSdk "build-tools\$BuildToolsVersion\aapt2.exe"
$ApkAnalyzer = Join-Path $AndroidSdk 'cmdline-tools\latest\bin\apkanalyzer.bat'
$AndroidCli = Join-Path $AndroidSdk 'cmdline-tools\latest\bin\android.exe'
$DebugApk = Join-Path $AndroidDir 'app\build\outputs\apk\debug\app-debug.apk'
$ReleaseAab = Join-Path $AndroidDir 'app\build\outputs\bundle\release\app-release.aab'

# --- Checks ---------------------------------------------------------------------------------------
function Test-AndroidTool {
    param([string] $Path, [string] $What, [string] $Hint)
    if (-not (Test-Path -LiteralPath $Path)) {
        throw "Android environment: $What not found at '$Path'. $Hint"
    }
}

Test-AndroidTool (Join-Path $JdkHome 'bin\java.exe') 'JDK 21 (java.exe)' 'Set DIARY_ANDROID_JDK to a JDK 21 folder.'
Test-AndroidTool $Adb 'platform-tools (adb.exe)' 'Install "platform-tools" with the SDK tool (see docs/ANDROID-PLAN.md section 6).'
Test-AndroidTool $Aapt2 "build-tools;$BuildToolsVersion (aapt2.exe)" "Install `"build-tools;$BuildToolsVersion`" with the SDK tool."
Test-AndroidTool (Join-Path $AndroidSdk "platforms\$PlatformVersion\android.jar") "platforms;$PlatformVersion" "Install `"platforms;$PlatformVersion`" with the SDK tool."
Test-AndroidTool $AndroidCli 'cmdline-tools;latest (android.exe)' 'Install the command-line tools into cmdline-tools\latest.'
Test-AndroidTool $Gradlew 'the Android project (android\gradlew.bat)' 'Run "npx cap add android" from the project root first (WP-14).'

# A caller that must write nothing (create-upload-key.ps1, which only needs $Keytool and the signing path)
# sets $AndroidEnvNoWrites = $true before dot-sourcing: then GRADLE_USER_HOME is not created and
# android\local.properties is not written - both exist only for Gradle. Every other caller is unaffected.
$androidEnvWrites = -not ((Test-Path -LiteralPath 'Variable:\AndroidEnvNoWrites') -and [bool](Get-Variable -Name AndroidEnvNoWrites -ValueOnly))

if ($androidEnvWrites -and -not (Test-Path -LiteralPath $GradleUserHome)) {
    New-Item -ItemType Directory -Path $GradleUserHome | Out-Null
}

# --- Process environment --------------------------------------------------------------------------
$env:JAVA_HOME = $JdkHome
$env:ANDROID_HOME = $AndroidSdk
$env:ANDROID_SDK_ROOT = $AndroidSdk
$env:GRADLE_USER_HOME = $GradleUserHome

$pathEntries = @((Join-Path $JdkHome 'bin'), (Join-Path $AndroidSdk 'platform-tools'))
if (-not (Get-Command 'npm.cmd' -ErrorAction SilentlyContinue)) {
    $nodeDir = Join-Path $env:LOCALAPPDATA 'Programs\nodejs'
    if (Test-Path -LiteralPath (Join-Path $nodeDir 'npm.cmd')) { $pathEntries += $nodeDir }
}
foreach ($entry in $pathEntries) {
    $current = $env:PATH -split ';'
    if ($current -notcontains $entry) { $env:PATH = "$entry;$env:PATH" }
}

# --- android\local.properties (generated, ignored by android\.gitignore) --------------------------
$localProperties = Join-Path $AndroidDir 'local.properties'
$sdkDirEscaped = $AndroidSdk.Replace('\', '\\').Replace(':', '\:')
$localContent = "## Generated by scripts/android/env.ps1 (not committed): the Android SDK used by Gradle.`nsdk.dir=$sdkDirEscaped`n"
$existing = if (Test-Path -LiteralPath $localProperties) { [System.IO.File]::ReadAllText($localProperties) } else { $null }
if ($androidEnvWrites -and $existing -ne $localContent) {
    [System.IO.File]::WriteAllText($localProperties, $localContent, (New-Object System.Text.UTF8Encoding $false))
}

# --- Helpers --------------------------------------------------------------------------------------
function Invoke-Gradle {
    param([Parameter(ValueFromRemainingArguments = $true)] [string[]] $GradleArgs)
    Push-Location $AndroidDir
    try {
        & $Gradlew @GradleArgs
        if ($LASTEXITCODE -ne 0) { throw "gradlew $($GradleArgs -join ' ') failed with exit code $LASTEXITCODE" }
    } finally {
        Pop-Location
    }
}

function Invoke-Npm {
    param([Parameter(ValueFromRemainingArguments = $true)] [string[]] $NpmArgs)
    Push-Location $ProjectRoot
    try {
        & npm.cmd @NpmArgs
        if ($LASTEXITCODE -ne 0) { throw "npm $($NpmArgs -join ' ') failed with exit code $LASTEXITCODE" }
    } finally {
        Pop-Location
    }
}

function Invoke-Npx {
    param([Parameter(ValueFromRemainingArguments = $true)] [string[]] $NpxArgs)
    Push-Location $ProjectRoot
    try {
        & npx.cmd @NpxArgs
        if ($LASTEXITCODE -ne 0) { throw "npx $($NpxArgs -join ' ') failed with exit code $LASTEXITCODE" }
    } finally {
        Pop-Location
    }
}

function Stop-GradleDaemon {
    Push-Location $AndroidDir
    try { & $Gradlew --stop --quiet 2>$null | Out-Null } catch { } finally { Pop-Location }
}

function Format-Size {
    param([long] $Bytes)
    if ($Bytes -ge 1MB) { return ('{0:N1} MB' -f ($Bytes / 1MB)) }
    if ($Bytes -ge 1KB) { return ('{0:N1} KB' -f ($Bytes / 1KB)) }
    return "$Bytes B"
}
