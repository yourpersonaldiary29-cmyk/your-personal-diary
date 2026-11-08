<#
.SYNOPSIS
    Builds the release Android App Bundle (what Google Play takes), signed with the owner's upload key:
    [bump-version.mjs] -> npm run mobile:build -> npx cap sync android -> gradlew bundleRelease (R8, resource shrinking)
    -> bundle facts (app id, versionCode / versionName, signer SHA-256) -> bundletool validate + universal APK -> verify-apk.ps1 -Release

    npm run android:aab                         (the full chain, no version bump)
    npm run android:aab -- -Bump                (bump the versionCode first - before EVERY Play upload)
    npm run android:aab -- -SkipWeb -SkipSync   (Gradle only; reuse mobile-dist/ and the synced assets)
    powershell -NoProfile -ExecutionPolicy Bypass -File scripts/android/build-aab.ps1 [-Bump] [-SkipWeb] [-SkipSync] [-Offline] [-KeepDaemon] [-SkipApk] [-SignUniversalApk] [-NoVerify]

    Signing: android/app/build.gradle reads C:\Users\AVI\Projects\android-signing\keystore.properties (or the file
    named by DIARY_ANDROID_SIGNING) with storeFile, storePassword, keyAlias, keyPassword. The OWNER creates it once
    with scripts/android/create-upload-key.ps1 and backs it up. This script only checks that the four keys are present
    and that the keystore file exists - the values are never read into its output. Without the file the bundle is
    built UNSIGNED: good for checking the configuration, useless for Play (it rejects a debug-signed or unsigned bundle).

    Versions: versionName is "version" of package.json (shared with the desktop app); versionCode is
    android/app/version.properties and must be higher than every code uploaded before (Play's rule; the last one is
    recorded in play/last-upload.json by the owner). -Bump runs node scripts/android/bump-version.mjs first.

    bundletool (Google's app-bundle tool, NOT part of the SDK) is used when $BundletoolJar (env.ps1; override with
    DIARY_BUNDLETOOL) exists: `validate` (the bundle is well-formed), `dump manifest` (the exact package / versionCode /
    versionName Play will see) and `build-apks --mode=universal` (one APK with everything, for a local install test on a
    phone). Without -SignUniversalApk bundletool signs that APK with a debug key: fine for a test install on a phone that
    does not have the Play version, never for distribution - Play signs its own APKs from the bundle. With
    -SignUniversalApk bundletool signs with the upload key and asks for the keystore password ITSELF, in the console;
    nothing of it passes through this script. When the jar is missing the script says where the owner gets it and skips
    these steps: no script here downloads anything.

    The bundle claims the application id app.yourpersonaldiary ($AppId, env.ps1) on Play - for good with the first
    upload; the summary says whether the bundle's manifest carries it.
#>
param(
    [switch] $Bump,
    [switch] $SkipWeb,
    [switch] $SkipSync,
    [switch] $Offline,
    [switch] $KeepDaemon,
    # Do not build the universal APK (bundletool validate / dump manifest still run when the jar exists).
    [switch] $SkipApk,
    # Sign the universal APK with the upload key (bundletool prompts for the password); default: bundletool's debug key.
    [switch] $SignUniversalApk,
    # Do not run verify-apk.ps1 -Release on the universal APK.
    [switch] $NoVerify
)

. "$PSScriptRoot\env.ps1"
. "$PSScriptRoot\release-checks.ps1"    # Get-GradleReleaseChecks, Read-LastUploadVersionCode (read-only)
Add-Type -AssemblyName System.IO.Compression.FileSystem

$total = [System.Diagnostics.Stopwatch]::StartNew()
$script:warnings = 0

function Step([string] $Name, [scriptblock] $Body) {
    $watch = [System.Diagnostics.Stopwatch]::StartNew()
    Write-Host ''
    Write-Host ">> $Name" -ForegroundColor Cyan
    & $Body
    Write-Host ('<< {0} ({1:N0} s)' -f $Name, $watch.Elapsed.TotalSeconds) -ForegroundColor DarkGray
}
function Ok([string] $Text) { Write-Host "[ok]   $Text" -ForegroundColor Green }
function Warn([string] $Text) { Write-Host "[warn] $Text" -ForegroundColor Yellow; $script:warnings++ }
# Native tools whose diagnostics go to stderr: merged by cmd so that Windows PowerShell 5.1 does not turn
# them into error records (verify-apk.ps1 does the same for aapt2). Returns the output lines; the exit code
# is in $LASTEXITCODE.
function Invoke-Captured([string] $Exe, [string[]] $Arguments) {
    $quoted = ($Arguments | ForEach-Object { if ($_ -match '[\s,]') { "`"$_`"" } else { $_ } }) -join ' '
    return @(& cmd /c "`"$Exe`" $quoted 2>&1")
}
function Invoke-Node {
    param([Parameter(ValueFromRemainingArguments = $true)] [string[]] $NodeArgs)
    Push-Location $ProjectRoot
    try {
        & node @NodeArgs
        if ($LASTEXITCODE -ne 0) { throw "node $($NodeArgs -join ' ') failed with exit code $LASTEXITCODE" }
    } finally {
        Pop-Location
    }
}

# --- 1. Versions ------------------------------------------------------------------------------------
$versionFile = Join-Path $AndroidDir 'app\version.properties'
$lastUploadFile = Join-Path $ProjectRoot 'play\last-upload.json'
function Read-VersionCode {
    $line = (Get-Content -LiteralPath $versionFile | Where-Object { $_ -match '^versionCode=\s*(\d+)\s*$' } | Select-Object -First 1)
    if (-not $line) { throw "$versionFile has no 'versionCode=<n>' line" }
    return [int]($line -replace '^versionCode=\s*', '')
}
if ($Bump) { Step 'node scripts/android/bump-version.mjs' { Invoke-Node 'scripts/android/bump-version.mjs' } }
$versionCode = Read-VersionCode
$versionName = (Get-Content -LiteralPath (Join-Path $ProjectRoot 'package.json') -Raw | ConvertFrom-Json).version
Write-Host ''
Write-Host "Version: versionName $versionName (package.json), versionCode $versionCode (android/app/version.properties)"
# This script only WARNS (a bundle with a stale code still builds, e.g. for a local test install);
# scripts/play/preflight.mjs FAILS on it before an upload.
if (Test-Path -LiteralPath $lastUploadFile) {
    $lastUpload = Read-LastUploadVersionCode $lastUploadFile
    if ($null -ne $lastUpload.Error) { Warn "play/last-upload.json is unreadable ($($lastUpload.Error)) - cannot compare the versionCode with the last upload; fix the file (docs/PLAY-RELEASE.he.md, closed testing step 7)" }
    elseif ($versionCode -gt $lastUpload.Code) { Ok "versionCode $versionCode is higher than the last upload recorded in play/last-upload.json ($($lastUpload.Code))" }
    else { Warn "versionCode $versionCode is NOT higher than the last upload recorded in play/last-upload.json ($($lastUpload.Code)) - Play will reject this bundle (scripts/play/preflight.mjs fails on it); rerun with -Bump (or node scripts/android/bump-version.mjs)" }
} else {
    Warn 'play/last-upload.json not found - cannot compare the versionCode with the last upload (scripts/play/preflight.mjs explains the file)'
}

# --- 2. The Gradle configuration this script relies on -----------------------------------------------
# release-checks.ps1 finds the release BUILD TYPE (android { buildTypes { release { ... } } }) by brace
# counting - not signingConfigs.release, not the debug build type; release-checks.test.mjs mutates copies of
# the real build.gradle against it.
$gradleFile = Join-Path $AndroidDir 'app\build.gradle'
$gradleChecks = Get-GradleReleaseChecks -Gradle (Get-Content -LiteralPath $gradleFile -Raw) -AppId $AppId
foreach ($check in $gradleChecks) {
    if ($check.Ok) { Ok "build.gradle: $($check.Name)" } else { Warn "build.gradle: $($check.Name) - NOT found; android/app/build.gradle changed, check it before uploading" }
}

# --- 3. Release signing (names and paths only - no value is printed) -----------------------------------
$signingKeystore = $null
$signingAlias = $null
if (Test-Path -LiteralPath $SigningPropertiesFile) {
    $present = @{}
    $storeFileValue = $null
    foreach ($raw in [System.IO.File]::ReadAllLines($SigningPropertiesFile)) {
        $line = $raw.Trim()
        if ($line -eq '' -or $line.StartsWith('#') -or $line.StartsWith('!')) { continue }
        $idx = $line.IndexOfAny([char[]]@('=', ':'))
        if ($idx -lt 1) { continue }
        $name = $line.Substring(0, $idx).Trim()
        $value = $line.Substring($idx + 1).Trim()
        $present[$name] = ($value.Length -gt 0)
        if ($name -eq 'storeFile') { $storeFileValue = $value }
        if ($name -eq 'keyAlias') { $signingAlias = $value }
        $value = $null
    }
    $missing = @('storeFile', 'storePassword', 'keyAlias', 'keyPassword' | Where-Object { -not $present[$_] })
    if ($missing.Count -gt 0) { throw "$SigningPropertiesFile lacks a value for: $($missing -join ', ') (build.gradle refuses it; recreate the file with scripts/android/create-upload-key.ps1 in another folder and move it here)" }
    $signingKeystore = if ([System.IO.Path]::IsPathRooted($storeFileValue)) { $storeFileValue } else { Join-Path (Split-Path -Parent $SigningPropertiesFile) $storeFileValue }
    if (-not (Test-Path -LiteralPath $signingKeystore -PathType Leaf)) { throw "$SigningPropertiesFile names the keystore $signingKeystore, which does not exist" }
    Ok "Release signing: $SigningPropertiesFile -> keystore $signingKeystore, alias '$signingAlias' (the four properties are present)"
} else {
    Warn "Release signing: no $SigningPropertiesFile - the bundle will be UNSIGNED (the owner creates the upload key once: scripts/android/create-upload-key.ps1)"
}

# --- 4. Build -----------------------------------------------------------------------------------------
if (-not $SkipWeb) { Step 'npm run mobile:build' { Invoke-Npm run mobile:build } }
if (-not $SkipSync) { Step 'npx cap sync android' { Invoke-Npx cap sync android } }

$gradleArgs = @('bundleRelease', '--console=plain')
if ($Offline) { $gradleArgs += '--offline' }
try {
    Step 'gradlew bundleRelease' { Invoke-Gradle @gradleArgs }
} finally {
    if (-not $KeepDaemon) { Stop-GradleDaemon }
}

$bundleDir = Join-Path $AndroidDir 'app\build\outputs\bundle\release'
$aab = Get-ChildItem -LiteralPath $bundleDir -Filter '*.aab' -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $aab) { throw "Gradle finished but no .aab was found in $bundleDir" }

# --- 5. Facts about the bundle ----------------------------------------------------------------------
# Signed or not: an AAB is signed like a jar (META-INF/*.RSA|*.DSA|*.EC).
$zip = [System.IO.Compression.ZipFile]::OpenRead($aab.FullName)
try {
    $signatures = @($zip.Entries | Where-Object { $_.FullName -match '^META-INF/.*\.(RSA|DSA|EC)$' } | ForEach-Object { $_.FullName })
    $nativeLibs = @($zip.Entries | Where-Object { $_.FullName -match '^base/lib/' } | ForEach-Object { $_.FullName })
    # R8's mapping, packed into the bundle by the Android Gradle plugin (4.1 and later): Play takes the
    # deobfuscation file from here - nothing to upload by hand (Play Console Help 9848633).
    $mapEntry = $zip.GetEntry('BUNDLE-METADATA/com.android.tools.build.obfuscation/proguard.map')
    $bundleMapping = if ($mapEntry) { @{ FullName = $mapEntry.FullName; Length = $mapEntry.Length } } else { $null }
    # The bundle's manifest is protobuf (aapt2 cannot dump it); its strings are plain UTF-8, so the
    # package name the upload will claim on Play - permanently - is found as bytes. bundletool, when
    # present, dumps the manifest properly below.
    $manifestHasAppId = $false
    $manifestEntry = $zip.GetEntry('base/manifest/AndroidManifest.xml')
    if ($manifestEntry) {
        $memory = New-Object System.IO.MemoryStream
        $stream = $manifestEntry.Open()
        try { $stream.CopyTo($memory) } finally { $stream.Dispose() }
        $manifestHasAppId = [System.Text.Encoding]::UTF8.GetString($memory.ToArray()).Contains($AppId)
    }
} finally {
    $zip.Dispose()
}

# The certificate the bundle is signed with: keytool reads it out of the jar signature. Play Console shows
# the same SHA-256 under Play app signing -> "Upload key certificate" after the first upload; a mismatch
# there means the wrong keystore signed this bundle.
$signerSha256 = $null
if ($signatures.Count -gt 0 -and (Test-Path -LiteralPath $Keytool)) {
    $cert = Invoke-Captured $Keytool @('-printcert', '-jarfile', $aab.FullName)
    $signerSha256 = ($cert | ForEach-Object { if ($_ -match 'SHA256:\s*([0-9A-Fa-f:]{95})') { $Matches[1] } } | Select-Object -First 1)
}

$mapping = Join-Path $AndroidDir 'app\build\outputs\mapping\release\mapping.txt'
Write-Host ''
Write-Host "AAB:     $($aab.FullName)" -ForegroundColor Green
Write-Host ("Size:    {0} ({1:N0} bytes)" -f (Format-Size $aab.Length), $aab.Length)
Write-Host "Version: versionCode $versionCode, versionName $versionName (what version.properties / package.json say; bundletool below confirms the manifest)"
if ($manifestHasAppId) { Write-Host "App id:  $AppId (permanent after the first Play upload; Java namespace $AppNamespace)" } else { Write-Host "App id:  $AppId NOT found in base/manifest/AndroidManifest.xml - check android/app/build.gradle before uploading" -ForegroundColor Red }
if ($signatures.Count -gt 0) {
    Write-Host "Signed:  yes ($($signatures -join ', '))"
    if ($signerSha256) { Write-Host "Signer:  SHA-256 $signerSha256  (upload key certificate - compare with Play Console > Play app signing)" } else { Write-Host 'Signer:  SHA-256 could not be read (keytool -printcert -jarfile gave no SHA256 line)' -ForegroundColor Yellow }
} else {
    Write-Host 'Signed:  NO (unsigned bundle - Play will not accept it; create keystore.properties with scripts/android/create-upload-key.ps1 and rebuild)' -ForegroundColor Yellow
}
Write-Host ("Native:  {0}" -f $(if ($nativeLibs.Count -eq 0) { 'no native libraries (nothing to align for the 16 KB page size)' } else { "$($nativeLibs.Count) files under base/lib/ - CHECK 16 KB alignment" }))
if ($bundleMapping) {
    Write-Host ("Mapping: inside the bundle ({0}, {1}) - Play reads it from there to de-obfuscate crash reports; nothing to upload. Local copy: {2}" -f $bundleMapping.FullName, (Format-Size $bundleMapping.Length), $(if (Test-Path -LiteralPath $mapping) { $mapping } else { 'not found' }))
} else {
    Write-Host ("Mapping: NOT inside the bundle - crash reports in Play stay obfuscated unless mapping.txt is uploaded by hand (App bundle explorer > Downloads). Local copy: {0}" -f $(if (Test-Path -LiteralPath $mapping) { $mapping } else { 'not found' })) -ForegroundColor Yellow
}

# --- 6. bundletool: validate, the real manifest, a universal APK for a local install test ---------------
$universalApk = Join-Path $bundleDir 'app-release-universal.apk'
$verifyExit = 0
if (Test-Path -LiteralPath $BundletoolJar -PathType Leaf) {
    Write-Host ''
    Write-Host "bundletool: $BundletoolJar"
    Step 'bundletool validate' {
        $out = Invoke-Captured $Java @('-jar', $BundletoolJar, 'validate', "--bundle=$($aab.FullName)")
        $out | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
        if ($LASTEXITCODE -ne 0) { throw "bundletool validate failed with exit code $LASTEXITCODE" }
    }
    Step 'bundletool dump manifest' {
        $xml = (Invoke-Captured $Java @('-jar', $BundletoolJar, 'dump', 'manifest', "--bundle=$($aab.FullName)")) -join "`n"
        if ($LASTEXITCODE -ne 0) { throw "bundletool dump manifest failed with exit code $LASTEXITCODE" }
        $pkg = if ($xml -match 'package="([^"]+)"') { $Matches[1] } else { '?' }
        $code = if ($xml -match 'android:versionCode="(\d+)"') { $Matches[1] } else { '?' }
        $name = if ($xml -match 'android:versionName="([^"]*)"') { $Matches[1] } else { '?' }
        Write-Host "    manifest: package $pkg, versionCode $code, versionName $name"
        if ($pkg -ne $AppId) { Warn "the bundle's manifest package is '$pkg', expected $AppId" } else { Ok "manifest package = $AppId" }
        if ($code -ne "$versionCode") { Warn "the bundle's manifest versionCode is $code, expected $versionCode" } else { Ok "manifest versionCode = $versionCode" }
        if ($name -ne "$versionName") { Warn "the bundle's manifest versionName is '$name', expected $versionName" } else { Ok "manifest versionName = $versionName" }
    }
    if (-not $SkipApk) {
        Step 'bundletool build-apks --mode=universal' {
            $apks = Join-Path $bundleDir 'app-release-universal.apks'
            $apkArgs = @('-jar', $BundletoolJar, 'build-apks', "--bundle=$($aab.FullName)", "--output=$apks", '--mode=universal', '--overwrite')
            if ($SignUniversalApk) {
                if (-not $signingKeystore) { throw '-SignUniversalApk needs keystore.properties (see above)' }
                # bundletool asks for the keystore password itself (no --ks-pass): nothing of it passes through here.
                $apkArgs += @("--ks=$signingKeystore", "--ks-key-alias=$signingAlias")
                Write-Host '    bundletool will ask for the keystore password (typed hidden, read by bundletool itself)' -ForegroundColor Cyan
            } else {
                Write-Host '    signed with a DEBUG key by bundletool: for a local install test only (Play signs its own APKs); -SignUniversalApk uses the upload key' -ForegroundColor DarkGray
            }
            & $Java @apkArgs
            if ($LASTEXITCODE -ne 0) { throw "bundletool build-apks failed with exit code $LASTEXITCODE" }
            # The .apks is a zip: universal.apk + toc.pb.
            if (Test-Path -LiteralPath $universalApk) { Remove-Item -LiteralPath $universalApk -Force }
            $apksZip = [System.IO.Compression.ZipFile]::OpenRead($apks)
            try {
                $entry = $apksZip.GetEntry('universal.apk')
                if (-not $entry) { throw "$apks contains no universal.apk" }
                [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $universalApk, $true)
            } finally {
                $apksZip.Dispose()
            }
            $apkItem = Get-Item -LiteralPath $universalApk
            Write-Host "    universal APK: $($apkItem.FullName) ($(Format-Size $apkItem.Length)) - install for a test with: adb install -r `"$($apkItem.FullName)`""
        }
        if (-not $NoVerify) {
            Step 'verify-apk.ps1 -Release (universal APK)' {
                & "$PSScriptRoot\verify-apk.ps1" -Apk $universalApk -Release
                $script:verifyExit = $LASTEXITCODE
            }
        }
    }
} else {
    Write-Host ''
    Write-Host "bundletool: not found at $BundletoolJar - skipped: validate, dump manifest, the universal APK and its verification." -ForegroundColor Yellow
    Write-Host '  To have them: download bundletool-all-<version>.jar from https://github.com/google/bundletool/releases (by hand -' -ForegroundColor Yellow
    Write-Host "  no script here downloads anything), save it as $BundletoolJar or set DIARY_BUNDLETOOL to the jar's path, and rerun" -ForegroundColor Yellow
    Write-Host '  with -SkipWeb -SkipSync. The bundle above is complete without it; bundletool only checks it the way Play will.' -ForegroundColor Yellow
}

Write-Host ''
Write-Host ("Total:   {0:N0} s, {1} warning(s)" -f $total.Elapsed.TotalSeconds, $script:warnings)
if ($signatures.Count -gt 0) {
    Write-Host "Next:    node scripts/play/preflight.mjs; upload $($aab.Name) in Play Console (it carries its R8 mapping); then record versionCode $versionCode in play/last-upload.json (docs/PLAY-RELEASE.he.md)."
}
if ($verifyExit -ne 0) { exit $verifyExit }
