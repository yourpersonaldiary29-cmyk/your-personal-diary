<#
.SYNOPSIS
    Static verification of an APK - no device, no emulator (aapt2, zipalign, apkanalyzer and the zip
    directory): identity (the application id $AppId everywhere it is derived - package, resource
    table, FileProvider authorities, own permissions, the packaged capacitor.config.json, no custom
    URL scheme - and the activity in the Java namespace $AppNamespace; the old id $LegacyAppId only as
    names of classes that exist in the dex), versions, label, permissions (exactly the expected set), the hardened
    manifest (allowBackup=false, extraction rules, cleartext off, locale config, single exported
    activity), the 20 locales, the web assets, no native libraries, no source maps, no test fixtures,
    sizes, and the 16 KB page-size note.

    The web assets depend on the build (mobile/vite.config.mobile.ts):
      server build (the DEFAULT - the published app, a thin client of the Your Personal Diary server,
        docs/android-tasks/HOSTED-IMPL.md item 8): index.html, exactly one server-mode chunk, NO boot
        chunk and NO core-assets/ (the in-process core is not in the APK), and a CSP whose connect-src
        is exactly 'self' plus the origin of src/config/server-default.json, without 'wasm-unsafe-eval'
        and without blob: workers;
      -LocalCore (the developer / test build made with MOBILE_LOCAL_CORE=1): index.html, the boot chunk
        with the inline core worker, the SQLite wasm and the 8 PDF fonts.

    npm run android:verify                              (the debug APK, server build)
    powershell -NoProfile -ExecutionPolicy Bypass -File scripts/android/verify-apk.ps1 [-Apk <path>] [-Release] [-LocalCore] [-ExpectedPermissions android.permission.INTERNET,...]

    Exit code 1 when a check fails. build-apk.ps1 runs this at the end (with -LocalCore when MOBILE_LOCAL_CORE=1).
#>
param(
    [string] $Apk,
    [switch] $Release,
    # The local-core developer build (MOBILE_LOCAL_CORE=1): check the core's assets instead of the server build's.
    [switch] $LocalCore,
    # WP-7/8/9: notifications (asked at runtime), the boot receiver of the reminders, the biometric prompt of the lock screen.
    [string[]] $ExpectedPermissions = @('android.permission.INTERNET', 'android.permission.POST_NOTIFICATIONS', 'android.permission.RECEIVE_BOOT_COMPLETED', 'android.permission.USE_BIOMETRIC')
)

. "$PSScriptRoot\env.ps1"
Add-Type -AssemblyName System.IO.Compression.FileSystem

if (-not $Apk) { $Apk = $DebugApk }
if (-not (Test-Path -LiteralPath $Apk)) { throw "APK not found: $Apk (build it with npm run android:apk)" }
$Apk = (Resolve-Path -LiteralPath $Apk).Path

$script:failures = 0
function Check([string] $Name, [bool] $Ok, [string] $Detail) {
    if ($Ok) {
        Write-Host ('[PASS] {0}: {1}' -f $Name, $Detail) -ForegroundColor Green
    } else {
        Write-Host ('[FAIL] {0}: {1}' -f $Name, $Detail) -ForegroundColor Red
        $script:failures++
    }
}
function Info([string] $Name, [string] $Detail) {
    Write-Host ('[info] {0}: {1}' -f $Name, $Detail) -ForegroundColor DarkGray
}
# aapt2 writes diagnostics to stderr: merged by cmd so that PowerShell 5.1 does not turn them into error records.
function Aapt([string[]] $Arguments) {
    $quoted = ($Arguments | ForEach-Object { if ($_ -match '\s') { "`"$_`"" } else { $_ } }) -join ' '
    return @(& cmd /c "`"$Aapt2`" $quoted 2>&1")
}

$pkg = Get-Content -LiteralPath (Join-Path $ProjectRoot 'package.json') -Raw | ConvertFrom-Json
$expectedVersionCode = ((Get-Content -LiteralPath (Join-Path $AndroidDir 'app\version.properties') | Where-Object { $_ -like 'versionCode=*' }) -join '') -replace '^versionCode=', ''
$expectedLocales = @('en', 'he', 'zh-Hans', 'es', 'pl', 'ru', 'fr', 'ar', 'ja', 'tr', 'cs', 'hu', 'bg', 'el', 'pt', 'de', 'ro', 'it', 'th', 'hi')
$expectedFonts = @('DejaVuSans.ttf', 'DejaVuSans-Bold.ttf', 'NotoSansArabic-Regular.ttf', 'NotoSansArabic-Bold.ttf',
    'NotoSansDevanagari-Regular.ttf', 'NotoSansDevanagari-Bold.ttf', 'NotoSansThai-Regular.ttf', 'NotoSansThai-Bold.ttf')

Write-Host ''
Write-Host "== Static verification of $Apk" -ForegroundColor Cyan

# --- aapt2 dump badging ---------------------------------------------------------------------------
$badging = Aapt @('dump', 'badging', $Apk)
$badgingText = $badging -join "`n"
if ($badgingText -match "package: name='([^']+)' versionCode='(\d+)' versionName='([^']*)'") {
    Check 'applicationId' ($Matches[1] -eq $AppId) $Matches[1]
    Check 'versionCode' ($Matches[2] -eq $expectedVersionCode) ('{0} (version.properties: {1})' -f $Matches[2], $expectedVersionCode)
    Check 'versionName' ($Matches[3] -eq $pkg.version) ('{0} (package.json: {1})' -f $Matches[3], $pkg.version)
} else {
    Check 'badging' $false 'aapt2 dump badging gave no package line'
    Write-Host $badgingText
}
$minSdk = if ($badgingText -match "sdkVersion:'(\d+)'") { $Matches[1] } else { '?' }
$targetSdk = if ($badgingText -match "targetSdkVersion:'(\d+)'") { $Matches[1] } else { '?' }
Check 'minSdk 24 / targetSdk 36' ($minSdk -eq '24' -and $targetSdk -eq '36') "minSdk $minSdk, targetSdk $targetSdk"
$label = if ($badgingText -match "application-label:'([^']*)'") { $Matches[1] } else { '' }
Check 'label' ($label -eq 'Your Personal Diary') $label
$translatedLabels = @($badging | ForEach-Object { if ($_ -match "^application-label-[^:]+:'([^']*)'" -and $Matches[1] -ne 'Your Personal Diary') { $_ } })
Check 'label not translated' ($translatedLabels.Count -eq 0) "$($translatedLabels.Count) differing per-locale labels"
$debuggable = [bool]($badging | Where-Object { $_ -eq 'application-debuggable' })
if ($Release) {
    Check 'not debuggable (release)' (-not $debuggable) "application-debuggable present: $debuggable"
} else {
    Check 'debuggable (debug build only)' $debuggable "application-debuggable present: $debuggable"
}
# The application id ($AppId) is the package; the classes keep the Java namespace ($AppNamespace,
# android/app/build.gradle), so the activity is $AppNamespace.MainActivity inside the package $AppId.
$mainActivityName = "$AppNamespace.MainActivity"
$launchable = if ($badgingText -match "launchable-activity: name='([^']+)'") { $Matches[1] } else { '' }
Check 'launcher activity (Java namespace)' ($launchable -eq $mainActivityName) $launchable
$allPermissions = @($badging | ForEach-Object { if ($_ -match "^uses-permission: name='([^']+)'") { $Matches[1] } }) | Sort-Object -Unique
# The merged manifest (read below) also declares the app's OWN signature-level permissions: androidx.core
# adds "<applicationId>.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION" (protectionLevel=signature) to every
# targetSdk 33+ app. Only this app's signature can hold such a permission; it is no user-facing permission
# and is reported separately instead of counted against the expected set.
$manifest = Aapt @('dump', 'xmltree', '--file', 'AndroidManifest.xml', $Apk)
$ownSignaturePermissions = New-Object System.Collections.Generic.List[string]
$permissionBlock = $null
foreach ($line in $manifest) {
    if ($line -match '^\s*E: permission ') { $permissionBlock = @{ Name = ''; Signature = $false }; continue }
    if ($line -match '^\s*E: ') { if ($permissionBlock -and $permissionBlock.Name -and $permissionBlock.Signature) { $ownSignaturePermissions.Add($permissionBlock.Name) }; $permissionBlock = $null; continue }
    if ($null -ne $permissionBlock) {
        if ($line -match ':name\([^)]*\)="([^"]+)"') { $permissionBlock.Name = $Matches[1] }
        if ($line -match ':protectionLevel\([^)]*\)=(?:\(type 0x11\))?0x0*2\b') { $permissionBlock.Signature = $true }
    }
}
$ownUsed = @($allPermissions | Where-Object { $ownSignaturePermissions -contains $_ -and $_ -like "$AppId.*" })
$permissions = @($allPermissions | Where-Object { $ownUsed -notcontains $_ })
$expectedSorted = @($ExpectedPermissions | Sort-Object -Unique)
Check 'permissions (exact set)' (($permissions -join ',') -eq ($expectedSorted -join ',')) ('[{0}] expected [{1}]' -f ($permissions -join ', '), ($expectedSorted -join ', '))
Info "app's own signature-level permissions (not user permissions)" $(if ($ownUsed.Count -gt 0) { $ownUsed -join ', ' } else { 'none' })
$nativeCode = @($badging | Where-Object { $_ -like 'native-code:*' })
Check 'no native code (badging)' ($nativeCode.Count -eq 0) $(if ($nativeCode.Count -gt 0) { $nativeCode -join ' ' } else { 'no native-code line' })
$localesLine = ($badging | Where-Object { $_ -like 'locales:*' }) -join ''
$resourceLocales = @(($localesLine -replace '^locales:', '') -split "\s+" | Where-Object { $_ -match "^'.*'$" })
Info 'resource locales (AndroidX library strings, not the app languages)' "$($resourceLocales.Count) locales in the resource table"

# --- the merged manifest ---------------------------------------------------------------------------
$manifestText = $manifest -join "`n"
$false_ = '(?:false|\(type 0x12\)0x0)'
$true_ = '(?:true|\(type 0x12\)0xffffffff)'
Check 'allowBackup=false' ($manifestText -match "allowBackup\([^)]*\)=$false_") ''
Check 'dataExtractionRules set' ($manifestText -match 'dataExtractionRules\(') ''
Check 'fullBackupContent set' ($manifestText -match 'fullBackupContent\(') ''
Check 'usesCleartextTraffic=false' ($manifestText -match "usesCleartextTraffic\([^)]*\)=$false_") ''
Check 'networkSecurityConfig set' ($manifestText -match 'networkSecurityConfig\(') ''
Check 'supportsRtl=true' ($manifestText -match "supportsRtl\([^)]*\)=$true_") ''
Check 'localeConfig set' ($manifestText -match 'localeConfig\(') ''
Check 'launchMode=singleTask' ($manifestText -match 'launchMode\([^)]*\)=(?:\(type 0x10\))?(?:0x0*)?2\b') ''
Check 'windowSoftInputMode=adjustResize' ($manifestText -match 'windowSoftInputMode\([^)]*\)=(?:\(type 0x11\))?0x0*10\b') ''

# configChanges of the launcher activity: each listed change reaches the WebView as an event instead of
# recreating the activity (Capacitor reloads the page on recreation - unsaved text would be lost). The
# bit values are those of android.content.pm.ActivityInfo.CONFIG_*.
$configBits = [ordered]@{
    fontScale = 0x40000000; orientation = 0x80; screenSize = 0x400; smallestScreenSize = 0x800; screenLayout = 0x100
    keyboard = 0x10; keyboardHidden = 0x20; locale = 0x4; layoutDirection = 0x2000; uiMode = 0x200; density = 0x1000
    navigation = 0x40; colorMode = 0x4000; fontWeightAdjustment = 0x10000000; grammaticalGender = 0x8000
}
$activities = New-Object System.Collections.Generic.List[hashtable]
$activity = $null
foreach ($line in $manifest) {
    if ($line -match '^\s*E: activity ') { $activity = @{ Name = ''; Mask = $null }; $activities.Add($activity); continue }
    if ($line -match '^\s*E: ') { $activity = $null; continue }
    if ($null -ne $activity) {
        if ($line -match ':name\([^)]*\)="([^"]+)"') { $activity.Name = $Matches[1] }
        if ($line -match 'configChanges\([^)]*\)=(?:\(type 0x11\))?0x([0-9a-fA-F]+)') { $activity.Mask = [Convert]::ToInt64($Matches[1], 16) }
    }
}
$mainActivity = $activities | Where-Object { $_.Name -eq $mainActivityName } | Select-Object -First 1
$configMask = if ($mainActivity) { $mainActivity.Mask } else { $null }
$missingBits = @($configBits.Keys | Where-Object { $null -eq $configMask -or ($configMask -band [int64]$configBits[$_]) -eq 0 })
Check 'configChanges keeps the WebView alive (fontScale, rotation, keyboard, locale, density, dark mode, ...)' ($null -ne $configMask -and $missingBits.Count -eq 0) ('{0}; missing [{1}]' -f $(if ($null -ne $configMask) { '0x{0:x8}' -f $configMask } else { 'no configChanges on MainActivity' }), ($missingBits -join ' '))

$exported = New-Object System.Collections.Generic.List[string]
$component = $null
foreach ($line in $manifest) {
    if ($line -match '^\s*E: (activity|activity-alias|service|receiver|provider) ') {
        $component = @{ Kind = $Matches[1]; Name = '' }
        continue
    }
    if ($line -match '^\s*E: (application|manifest) ') { $component = $null; continue }
    if ($null -ne $component) {
        if ((-not $component.Name) -and $line -match ':name\([^)]*\)="([^"]+)"') { $component.Name = $Matches[1] }
        if ($line -match ":exported\([^)]*\)=$true_") { $exported.Add("$($component.Kind) $($component.Name)") }
    }
}
Check 'exported components' (($exported -join ',') -eq "activity $mainActivityName") ('[{0}]' -f ($exported -join ', '))

# --- identity: everything derived from the application id -------------------------------------
# ${applicationId} placeholders end up as plain strings in the merged manifest: the FileProvider
# authorities (ours, @capacitor/local-notifications', androidx.startup's) must all be "$AppId.<...>" -
# the bridge, the Share plugin and the notification plugin build them from the package name at run time.
$manifestPackage = if ($manifestText -match '(?m)^\s*A: package="([^"]+)"') { $Matches[1] } else { '' }
Check 'identity: manifest package = applicationId' ($manifestPackage -eq $AppId) $manifestPackage
$authorities = @($manifest | ForEach-Object { if ($_ -match ':authorities\([^)]*\)="([^"]+)"') { $Matches[1] -split ';' } } | Where-Object { $_ })
$foreignAuthorities = @($authorities | Where-Object { -not $_.StartsWith("$AppId.") })
Check 'identity: provider authorities use the applicationId' ($authorities.Count -gt 0 -and $foreignAuthorities.Count -eq 0) ('[{0}]{1}' -f ($authorities -join ', '), $(if ($foreignAuthorities.Count -gt 0) { " - not under ${AppId}: $($foreignAuthorities -join ', ')" } else { '' }))
Check 'identity: the FileProvider is <applicationId>.fileprovider' ($authorities -contains "$AppId.fileprovider") "$AppId.fileprovider"
$foreignOwnPermissions = @($ownSignaturePermissions | Where-Object { -not $_.StartsWith("$AppId.") })
Check "identity: the app's own permissions use the applicationId" ($foreignOwnPermissions.Count -eq 0) $(if ($ownSignaturePermissions.Count -gt 0) { $ownSignaturePermissions -join ', ' } else { 'none' })
# Deep links: the app opens files only (content: / file:); a custom URL scheme, if one is ever added,
# must be the applicationId (Capacitor's custom_url_scheme convention), never the old id.
$schemes = @($manifest | ForEach-Object { if ($_ -match ':scheme\([^)]*\)="([^"]+)"') { $Matches[1] } } | Sort-Object -Unique)
$customSchemes = @($schemes | Where-Object { @('content', 'file') -notcontains $_ })
Check 'identity: no deep-link scheme other than content/file (or the applicationId)' (@($customSchemes | Where-Object { $_ -ne $AppId }).Count -eq 0) ('[{0}]' -f ($schemes -join ', '))
# The old id may appear only as the Java namespace of class names (com.mydiary.app.MainActivity, ...).
# $LegacyAppId and $AppNamespace are the SAME string, so a prefix test cannot tell a class from any
# other string under it ("com.mydiary.app.fileprovider" would pass). A class name is a string that
# (a) sits in an attribute that holds class names - the android:name of a component or of a meta-data
# key (androidx.startup names its initializers that way), the application's backupAgent /
# appComponentFactory, an activity-alias's targetActivity - and (b) exists in the dex: its type
# descriptor ("Lcom/mydiary/app/MainActivity;") is in a classes*.dex of the APK. Any other string that
# carries the old id (an authority, a permission, an action, a scheme, a meta-data value) is a leak.
if ($LegacyAppId -ne $AppId) {
    $classAttributes = @{
        application = @('name', 'backupAgent', 'appComponentFactory'); activity = @('name'); 'activity-alias' = @('name', 'targetActivity')
        service = @('name'); receiver = @('name'); provider = @('name'); instrumentation = @('name'); 'meta-data' = @('name')
    }
    $legacyClasses = New-Object System.Collections.Generic.List[string]
    $legacyOther = New-Object System.Collections.Generic.List[string]
    $element = ''
    foreach ($line in $manifest) {
        # In the xmltree dump the attributes follow their element's "E:" line, before any child element.
        if ($line -match '^\s*E: (\S+)') { $element = $Matches[1]; continue }
        if ($line -match '^\s*A: (?:\S*[:/])?([\w-]+)(?:\(0x[0-9a-fA-F]+\))?="([^"]*)"') {
            $attribute = $Matches[1]
            $value = $Matches[2]
            if ($value -notlike "*$LegacyAppId*") { continue }
            $holdsClassNames = $classAttributes.ContainsKey($element) -and ($classAttributes[$element] -contains $attribute)
            if ($holdsClassNames -and $value.StartsWith("$AppNamespace.")) {
                if (-not $legacyClasses.Contains($value)) { $legacyClasses.Add($value) }
            } elseif (-not $legacyOther.Contains("$element ${attribute}=$value")) {
                $legacyOther.Add("$element ${attribute}=$value")
            }
        }
    }
    Check "identity: the old id $LegacyAppId only in class-name attributes" ($legacyOther.Count -eq 0) $(if ($legacyOther.Count -gt 0) { "also as: $($legacyOther -join ', ')" } else { "classes [$($legacyClasses -join ', ')]" })
    # Type descriptors are ASCII in the dex string table, so the dex bytes read as Latin-1 contain them verbatim.
    $dexText = ''
    $zip = [System.IO.Compression.ZipFile]::OpenRead($Apk)
    try {
        $latin1 = [System.Text.Encoding]::GetEncoding(28591)
        $dexBuilder = New-Object System.Text.StringBuilder
        foreach ($dexEntry in @($zip.Entries | Where-Object { $_.FullName -match '^classes\d*\.dex$' })) {
            $memory = New-Object System.IO.MemoryStream
            $stream = $dexEntry.Open()
            try { $stream.CopyTo($memory) } finally { $stream.Dispose() }
            [void]$dexBuilder.Append($latin1.GetString($memory.ToArray())).Append([char]0)
        }
        $dexText = $dexBuilder.ToString()
    } finally {
        $zip.Dispose()
    }
    $notInDex = @($legacyClasses | Where-Object { -not $dexText.Contains('L' + $_.Replace('.', '/') + ';') })
    Check "identity: every $AppNamespace.* name in the manifest is a class in the dex" ($legacyClasses.Count -gt 0 -and $notInDex.Count -eq 0) $(if ($notInDex.Count -gt 0) { "not in classes*.dex: $($notInDex -join ', ')" } elseif ($legacyClasses.Count -eq 0) { 'no class of the namespace is named' } else { "$($legacyClasses.Count) class(es), all in classes*.dex" })
}

# --- locales_config.xml ------------------------------------------------------------------------
$resources = Aapt @('dump', 'resources', $Apk)
# The resource table is named after the applicationId: plugins look resources up by the package name
# (getIdentifier(name, type, getPackageName()) - e.g. the notification icon of local-notifications).
$resourcePackage = (@($resources | ForEach-Object { if ($_ -match '^Package name=(\S+) id=7f\b') { $Matches[1] } }) | Select-Object -First 1)
Check 'identity: resource table package = applicationId' ($resourcePackage -eq $AppId) "$resourcePackage"
$localesFile = $null
for ($i = 0; $i -lt $resources.Count; $i++) {
    if ($resources[$i] -match 'resource 0x[0-9a-f]+ xml/locales_config\b') {
        for ($j = $i + 1; $j -lt [Math]::Min($i + 4, $resources.Count); $j++) {
            if ($resources[$j] -match '\(file\) (\S+)') { $localesFile = $Matches[1]; break }
        }
        break
    }
}
if ($localesFile) {
    $localesXml = Aapt @('dump', 'xmltree', '--file', $localesFile, $Apk)
    $found = @($localesXml | ForEach-Object { if ($_ -match ':name\([^)]*\)="([^"]+)"') { $Matches[1] } }) | Sort-Object
    $missing = @($expectedLocales | Where-Object { $found -notcontains $_ })
    $extra = @($found | Where-Object { $expectedLocales -notcontains $_ })
    Check '20 app languages in localeConfig' ($found.Count -eq 20 -and $missing.Count -eq 0 -and $extra.Count -eq 0) ('{0} in {1}; missing [{2}] extra [{3}]' -f $found.Count, $localesFile, ($missing -join ' '), ($extra -join ' '))
} else {
    Check 'locales_config.xml resource' $false 'not found in the resource table'
}

# --- the zip directory -------------------------------------------------------------------------
$zip = [System.IO.Compression.ZipFile]::OpenRead($Apk)
$capConfigAppId = $null
try {
    $entries = @($zip.Entries | ForEach-Object { [pscustomobject]@{ Name = $_.FullName; Length = $_.Length; Compressed = $_.CompressedLength } })
    # assets/capacitor.config.json is written by `cap sync` from capacitor.config.ts.
    $capEntry = $zip.GetEntry('assets/capacitor.config.json')
    if ($capEntry) {
        $capReader = New-Object System.IO.StreamReader($capEntry.Open(), [System.Text.Encoding]::UTF8)
        try { $capConfigAppId = ($capReader.ReadToEnd() | ConvertFrom-Json).appId } finally { $capReader.Dispose() }
    }
} finally {
    $zip.Dispose()
}
Check 'identity: packaged capacitor.config.json appId = applicationId' ($capConfigAppId -eq $AppId) $(if ($capConfigAppId) { $capConfigAppId } else { 'assets/capacitor.config.json missing or without appId' })
$names = @($entries | ForEach-Object { $_.Name })
Check 'web assets: index.html' ($names -contains 'assets/public/index.html') ''
$bootChunks = @($names | Where-Object { $_ -match '^assets/public/assets/boot-[^/]+\.js$' })
$coreAssets = @($names | Where-Object { $_ -like 'assets/public/core-assets/*' })
$serverModeChunks = @($names | Where-Object { $_ -match '^assets/public/assets/server-mode-[^/]+\.js$' })
if ($LocalCore) {
    Info 'build' 'local-core (MOBILE_LOCAL_CORE=1): the in-process diary core is expected in the APK'
    Check 'web assets: boot chunk (inline core worker)' ($bootChunks.Count -eq 1) ($bootChunks -join ', ')
    Check 'web assets: SQLite wasm' ($names -contains 'assets/public/core-assets/sql-wasm.wasm') ''
    $fontsMissing = @($expectedFonts | Where-Object { $names -notcontains "assets/public/core-assets/fonts/$_" })
    Check 'web assets: 8 PDF fonts' ($fontsMissing.Count -eq 0) $(if ($fontsMissing.Count -gt 0) { "missing: $($fontsMissing -join ', ')" } else { '8 present' })
} else {
    Info 'build' 'server (default): a thin client of the Your Personal Diary server - no in-process core'
    Check 'server build: no boot chunk (no in-process core)' ($bootChunks.Count -eq 0) $(if ($bootChunks.Count -gt 0) { $bootChunks -join ', ' } else { 'none' })
    Check 'server build: no core-assets/ (no SQLite wasm, no PDF fonts)' ($coreAssets.Count -eq 0) $(if ($coreAssets.Count -gt 0) { "$($coreAssets.Count) found, e.g. $($coreAssets[0])" } else { 'none' })
    Check 'server build: one server-mode chunk' ($serverModeChunks.Count -eq 1) $(if ($serverModeChunks.Count -gt 0) { $serverModeChunks -join ', ' } else { 'none' })

    # The CSP of the page: connect-src is exactly 'self' and the server's origin, read from
    # src/config/server-default.json (the one place of the address); the sources only the in-process
    # core needs ('wasm-unsafe-eval', blob: workers) are gone.
    $serverDefaultFile = Join-Path $ProjectRoot 'src\config\server-default.json'
    $serverOrigin = $null
    try {
        $serverUrl = (Get-Content -LiteralPath $serverDefaultFile -Raw -Encoding UTF8 | ConvertFrom-Json).url
        $serverOrigin = ([Uri]$serverUrl).GetLeftPart([UriPartial]::Authority)
    } catch {
        Check 'server build: default server address' $false "cannot read $serverDefaultFile ($($_.Exception.Message))"
    }
    $html = $null
    $zip = [System.IO.Compression.ZipFile]::OpenRead($Apk)
    try {
        $indexEntry = $zip.GetEntry('assets/public/index.html')
        if ($indexEntry) {
            $reader = New-Object System.IO.StreamReader($indexEntry.Open(), [System.Text.Encoding]::UTF8)
            try { $html = $reader.ReadToEnd() } finally { $reader.Dispose() }
        }
    } finally {
        $zip.Dispose()
    }
    $cspMatch = $null
    if ($html) { $cspMatch = [regex]::Match($html, '<meta\s[^>]*http-equiv="Content-Security-Policy"[^>]*?\scontent="([^"]*)"') }
    if ($cspMatch -and $cspMatch.Success -and $serverOrigin) {
        $directives = @{}
        foreach ($part in ($cspMatch.Groups[1].Value -split ';')) {
            $tokens = @(($part.Trim() -split '\s+') | Where-Object { $_ -ne '' })
            if ($tokens.Count -gt 0) { $directives[$tokens[0].ToLowerInvariant()] = @($tokens | Select-Object -Skip 1) }
        }
        $connect = @($directives['connect-src'])
        $expectedConnect = @("'self'", $serverOrigin)
        $connectOk = ($connect.Count -eq 2) -and ((@($connect | Sort-Object) -join ' ') -ceq (@($expectedConnect | Sort-Object) -join ' '))
        Check 'server build: CSP connect-src is exactly the page and the diary server' $connectOk ('connect-src [{0}], expected [{1}]' -f ($connect -join ' '), ($expectedConnect -join ' '))
        $scriptSrc = @($directives['script-src'])
        Check "server build: CSP script-src without 'wasm-unsafe-eval'" ($scriptSrc -notcontains "'wasm-unsafe-eval'") ('script-src [{0}]' -f ($scriptSrc -join ' '))
        $workerSrc = @($directives['worker-src'])
        Check 'server build: CSP worker-src without blob:' ($workerSrc -notcontains 'blob:') ('worker-src [{0}]' -f ($workerSrc -join ' '))
    } elseif ($serverOrigin) {
        Check 'server build: CSP <meta> in index.html' $false 'not found'
    }
}
$nativeLibs = @($names | Where-Object { $_ -like 'lib/*' -or $_ -like '*.so' })
Check 'no native libraries (lib/, *.so)' ($nativeLibs.Count -eq 0) "$($nativeLibs.Count) found"
$sourceMaps = @($names | Where-Object { $_ -like '*.map' })
Check 'no source maps' ($sourceMaps.Count -eq 0) ($sourceMaps -join ', ')
$fixtures = @($names | Where-Object { $_ -like 'assets/public/*' -and $_ -match '\.test\.|/test/|/tests/|fixtures?/|\.spec\.|node_modules/' })
Check 'no test fixtures in web assets' ($fixtures.Count -eq 0) ($fixtures -join ', ')
$dex = @($entries | Where-Object { $_.Name -match '^classes\d*\.dex$' })
Info 'dex' ('{0} file(s), {1}' -f $dex.Count, (Format-Size (($dex | Measure-Object -Property Length -Sum).Sum)))
$web = @($entries | Where-Object { $_.Name -like 'assets/public/*' })
Info 'web assets' ('{0} files, {1} uncompressed, {2} compressed' -f $web.Count, (Format-Size (($web | Measure-Object -Property Length -Sum).Sum)), (Format-Size (($web | Measure-Object -Property Compressed -Sum).Sum)))
$largest = ($entries | Sort-Object -Property Length -Descending | Select-Object -First 8 | ForEach-Object { '{0} ({1})' -f $_.Name, (Format-Size $_.Length) }) -join '; '
Info 'largest entries' $largest
$apkBytes = (Get-Item -LiteralPath $Apk).Length
Info 'APK size' ('{0} ({1:N0} bytes, {2} entries)' -f (Format-Size $apkBytes), $apkBytes, $entries.Count)
# The bytes of the file that are not entry data: the zip headers, the central directory and the signing
# block (about 85 KB here) - plus "virtual entries", the dead space that AGP's incremental packaging
# (zipflinger) leaves where a replaced entry (an older web bundle, an older dex) used to be. The entry
# list does not show it and the app does not care, but it inflates the file: the server APK of
# 2026-10-23 carried 3.0 MB of it (8.46 MB file, 5.33 MB of entries), the clean build of 2026-10-25 none.
$entryData = ($entries | Measure-Object -Property Compressed -Sum).Sum
$overhead = [long]($apkBytes - $entryData)
if ($overhead -gt 1MB) {
    Write-Host ('[warn] zip dead space: {0} of the file is not entry data - mostly dead space left by incremental packaging; run "gradlew clean" before a build that is handed out' -f (Format-Size $overhead)) -ForegroundColor Yellow
} else {
    Info 'zip overhead' ('{0} of the file is not entry data (headers, central directory, signing block; no dead space worth noting)' -f (Format-Size $overhead))
}

# --- 16 KB page size ---------------------------------------------------------------------------
$zipalign = Join-Path $AndroidSdk "build-tools\$BuildToolsVersion\zipalign.exe"
if (Test-Path -LiteralPath $zipalign) {
    $alignment = @(& cmd /c "`"$zipalign`" -c -P 16 4 `"$Apk`" 2>&1")
    $verdict = if ($LASTEXITCODE -eq 0) { 'zipalign -c -P 16 4: OK' } else { "zipalign -c -P 16 4: exit $LASTEXITCODE ($(($alignment | Select-Object -Last 1)))" }
    Info '16 KB page size' ("{0}; {1}" -f $(if ($nativeLibs.Count -eq 0) { 'no native libraries of our own or of a dependency - nothing to align' } else { 'native libraries present - alignment matters' }), $verdict)
}

# --- apkanalyzer (informational) ----------------------------------------------------------------
if (Test-Path -LiteralPath $ApkAnalyzer) {
    try {
        $fileSize = (@(& cmd /c "`"$ApkAnalyzer`" apk file-size `"$Apk`" 2>&1") | Select-Object -Last 1)
        $downloadSize = (@(& cmd /c "`"$ApkAnalyzer`" apk download-size `"$Apk`" 2>&1") | Select-Object -Last 1)
        Info 'apkanalyzer' ('file-size {0} bytes, estimated download-size {1} bytes' -f $fileSize, $downloadSize)
    } catch {
        Info 'apkanalyzer' "not available: $($_.Exception.Message)"
    }
}

Write-Host ''
if ($script:failures -eq 0) {
    Write-Host 'Static verification passed.' -ForegroundColor Green
    exit 0
}
Write-Host "$($script:failures) check(s) FAILED." -ForegroundColor Red
exit 1
