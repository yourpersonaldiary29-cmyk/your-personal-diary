<#
.SYNOPSIS
    Prints the versions of everything the Android build uses (JDK, Gradle wrapper, AGP, SDK packages,
    Capacitor, Node) and the state of the project (app id, versions, signing file, devices).

    npm run android:doctor
    powershell -NoProfile -ExecutionPolicy Bypass -File scripts/android/doctor.ps1 [-Gradle]

    -Gradle also runs `gradlew --version` (downloads the Gradle distribution on first use).
#>
param([switch] $Gradle)

. "$PSScriptRoot\env.ps1"

function Section([string] $Title) {
    Write-Host ''
    Write-Host "== $Title" -ForegroundColor Cyan
}

function Row([string] $Label, [string] $Value) {
    Write-Host ('  {0,-26} {1}' -f $Label, $Value)
}

# stderr of native tools (java -version writes there) merged by cmd, so PowerShell 5.1 never wraps it in errors.
function Native([string] $CommandLine) {
    $lines = @(& cmd /c "$CommandLine 2>&1")
    return ($lines -join "`n").Trim()
}

function FirstLine([string] $Text) {
    return (($Text -split "`r?`n") | Where-Object { $_ -match '\S' } | Select-Object -First 1)
}

function SourceRevision([string] $Dir) {
    $file = Join-Path $Dir 'source.properties'
    if (-not (Test-Path -LiteralPath $file)) { return '(no source.properties)' }
    $line = Get-Content -LiteralPath $file | Where-Object { $_ -like 'Pkg.Revision=*' } | Select-Object -First 1
    if ($line) { return $line.Substring('Pkg.Revision='.Length) } else { return '?' }
}

Section 'Paths'
Row 'Project' $ProjectRoot
Row 'JAVA_HOME' $env:JAVA_HOME
Row 'ANDROID_HOME' $env:ANDROID_HOME
$gradleHomeBytes = (Get-ChildItem -LiteralPath $GradleUserHome -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
Row 'GRADLE_USER_HOME' ("{0} ({1})" -f $GradleUserHome, (Format-Size ([long]($gradleHomeBytes + 0))))
Row 'android\local.properties' ((Get-Content -LiteralPath (Join-Path $AndroidDir 'local.properties') | Where-Object { $_ -like 'sdk.dir=*' }) -join '')

Section 'Node / Capacitor'
Row 'node' (FirstLine (Native 'node -v'))
Row 'npm' (FirstLine (Native 'npm.cmd -v'))
$pkg = Get-Content -LiteralPath (Join-Path $ProjectRoot 'package.json') -Raw | ConvertFrom-Json
Row 'app version (versionName)' $pkg.version
foreach ($name in @('@capacitor/core', '@capacitor/cli', '@capacitor/android', '@capacitor/app', '@capacitor/filesystem', '@capacitor/preferences')) {
    $pinned = $pkg.devDependencies.$name
    $installedFile = Join-Path $ProjectRoot "node_modules\$name\package.json"
    $installed = if (Test-Path -LiteralPath $installedFile) { (Get-Content -LiteralPath $installedFile -Raw | ConvertFrom-Json).version } else { 'NOT INSTALLED' }
    $state = if ($pinned -eq $installed) { 'ok' } else { 'MISMATCH' }
    Row $name ("{0} (pinned {1}) {2}" -f $installed, $pinned, $state)
}

Section 'Java'
Row 'java -version' (FirstLine (Native "`"$(Join-Path $JdkHome 'bin\java.exe')`" -version"))

Section 'Gradle / Android Gradle Plugin'
$wrapperProps = Get-Content -LiteralPath (Join-Path $AndroidDir 'gradle\wrapper\gradle-wrapper.properties')
$distribution = ($wrapperProps | Where-Object { $_ -like 'distributionUrl=*' }) -join ''
Row 'wrapper distribution' ($distribution -replace '^distributionUrl=', '' -replace '\\:', ':')
$rootGradle = Get-Content -LiteralPath (Join-Path $AndroidDir 'build.gradle') -Raw
if ($rootGradle -match "com\.android\.tools\.build:gradle:([\d.]+)") { Row 'AGP' $Matches[1] }
$variables = Get-Content -LiteralPath (Join-Path $AndroidDir 'variables.gradle') -Raw
foreach ($key in @('minSdkVersion', 'compileSdkVersion', 'targetSdkVersion', 'buildToolsVersion')) {
    if ($variables -match "$key\s*=\s*'?([\w.]+)'?") { Row $key $Matches[1] }
}
if ($Gradle) {
    Write-Host ''
    Invoke-Gradle --version --quiet
}

Section 'Android SDK packages (installed)'
Row 'cmdline-tools;latest' (SourceRevision (Join-Path $AndroidSdk 'cmdline-tools\latest'))
Row 'platform-tools' (SourceRevision (Join-Path $AndroidSdk 'platform-tools'))
foreach ($dir in (Get-ChildItem -LiteralPath (Join-Path $AndroidSdk 'build-tools') -Directory -ErrorAction SilentlyContinue)) {
    Row "build-tools;$($dir.Name)" (SourceRevision $dir.FullName)
}
foreach ($dir in (Get-ChildItem -LiteralPath (Join-Path $AndroidSdk 'platforms') -Directory -ErrorAction SilentlyContinue)) {
    Row "platforms;$($dir.Name)" (SourceRevision $dir.FullName)
}
Row 'NDK' $(if (Test-Path -LiteralPath (Join-Path $AndroidSdk 'ndk')) { 'present (not needed)' } else { 'not installed (not needed)' })
Row 'install more with' "`"$AndroidCli`" --sdk=$AndroidSdk sdk install `"<package>`""

Section 'adb / devices'
Row 'adb' (FirstLine (Native "`"$Adb`" version"))
$devices = @(& $Adb devices) | Select-Object -Skip 1 | Where-Object { $_ -match '\S' }
if ($devices.Count -eq 0) { Row 'devices' 'none connected (see docs/ANDROID-PHONE-TEST.he.md)' } else { foreach ($d in $devices) { Row 'device' $d } }

Section 'Android project'
$appGradle = Get-Content -LiteralPath (Join-Path $AndroidDir 'app\build.gradle') -Raw
if ($appGradle -match "def appId = '([^']+)'") { Row 'applicationId' ('{0}{1}' -f $Matches[1], $(if ($Matches[1] -ne $AppId) { " - DIFFERS from env.ps1 `$AppId ($AppId)" } else { '' })) }
if ($appGradle -match "def appNamespace = '([^']+)'") { Row 'namespace (Java package)' $Matches[1] }
$versionCode = (Get-Content -LiteralPath (Join-Path $AndroidDir 'app\version.properties') | Where-Object { $_ -like 'versionCode=*' }) -join ''
Row 'versionCode' ($versionCode -replace '^versionCode=', '')
Row 'release signing file' $(if (Test-Path -LiteralPath $SigningPropertiesFile) { "present: $SigningPropertiesFile" } else { "absent ($SigningPropertiesFile) - release builds are unsigned" })
Row 'debug APK' $(if (Test-Path -LiteralPath $DebugApk) { "{0} ({1}, {2:yyyy-MM-dd HH:mm})" -f $DebugApk, (Format-Size (Get-Item -LiteralPath $DebugApk).Length), (Get-Item -LiteralPath $DebugApk).LastWriteTime } else { 'not built yet (npm run android:apk)' })
Write-Host ''
