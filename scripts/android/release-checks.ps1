<#
.SYNOPSIS
    Read-only checks that scripts/android/build-aab.ps1 runs before a release build. Dot-source it:

        . "$PSScriptRoot\release-checks.ps1"

    Get-GradleReleaseChecks -Gradle <text of android/app/build.gradle> -AppId <id>
        -> one @{ Name; Ok } per check: the identity, the version sources, and the RELEASE build type
           (R8, resource shrinking, proguard-rules.pro, the upload-key signing config).
    Read-LastUploadVersionCode -Path <play/last-upload.json>
        -> @{ Code = <int> or $null; Error = $null or why the file cannot be used }

    No side effects (no env.ps1, no files written), so scripts/android/release-checks.test.mjs runs both
    against mutated copies of the real build.gradle and against hand-written last-upload.json files.
#>

# The body of the first "<Name> {" block in $Text, found by counting braces - so a nested block
# (if (...) { ... }) stays inside and the NEXT block (debug / bundle / ...) never leaks in.
# Returns $null when there is no such block or its braces do not close.
function Get-GradleBlockBody([string] $Text, [string] $Name) {
    $open = [regex]::Match($Text, "(?<![\w.])$([regex]::Escape($Name))\s*\{")
    if (-not $open.Success) { return $null }
    $start = $open.Index + $open.Length
    $depth = 1
    for ($i = $start; $i -lt $Text.Length; $i++) {
        $c = $Text[$i]
        if ($c -eq [char]'{') { $depth++ }
        elseif ($c -eq [char]'}') {
            $depth--
            if ($depth -eq 0) { return $Text.Substring($start, $i - $start) }
        }
    }
    return $null
}

function Get-GradleReleaseChecks {
    param([Parameter(Mandatory = $true)] [string] $Gradle, [Parameter(Mandatory = $true)] [string] $AppId)
    # Comments out first: /* ... */ blocks and // line comments (not the // of "https://").
    $code = [regex]::Replace($Gradle, '(?s)/\*.*?\*/', '')
    $code = [regex]::Replace($code, '(?m)(^|[ \t])//.*$', '$1')
    # The release build TYPE: "release {" inside android { buildTypes { ... } } - not signingConfigs.release,
    # which comes first in the file, and not the debug build type next to it.
    $android = Get-GradleBlockBody $code 'android'
    $buildTypes = if ($null -ne $android) { Get-GradleBlockBody $android 'buildTypes' } else { $null }
    $release = if ($null -ne $buildTypes) { Get-GradleBlockBody $buildTypes 'release' } else { $null }
    if ($null -eq $release) { $release = '' }
    return @(
        @{ Name = "applicationId $AppId (def appId)"; Ok = ($code -match "def\s+appId\s*=\s*'$([regex]::Escape($AppId))'" -and $code -match '\bapplicationId\s+appId\b') },
        @{ Name = 'versionCode from version.properties'; Ok = ($code -match 'version\.properties' -and $code -match '\bversionCode\s+appVersionCode\b') },
        @{ Name = 'versionName from package.json'; Ok = ($code -match 'package\.json' -and $code -match '\bversionName\s+appVersionName\b') },
        @{ Name = 'release: minifyEnabled true (R8)'; Ok = ($release -match '\bminifyEnabled\s*(=\s*)?true\b') },
        @{ Name = 'release: shrinkResources true'; Ok = ($release -match '\bshrinkResources\s*(=\s*)?true\b') },
        @{ Name = 'release: proguard-rules.pro'; Ok = ($release -match 'proguard-rules\.pro') },
        @{ Name = 'release: signingConfig signingConfigs.release when keystore.properties exists'; Ok = ($release -match '\bsigningConfig\s*(=\s*)?signingConfigs\.release\b' -and $code -match '(?s)storeFile.*storePassword.*keyAlias.*keyPassword') },
        @{ Name = 'signing file: DIARY_ANDROID_SIGNING or C:/Users/AVI/Projects/android-signing/keystore.properties'; Ok = ($code -match 'DIARY_ANDROID_SIGNING' -and $code -match 'android-signing/keystore\.properties') }
    )
}

# play/last-upload.json -> the versionCode the owner recorded. Accepts a JSON integer (or a string of
# digits) from 0 to 2100000000 (Play's maximum); null, a missing field, "", true, 1.5 ... are an Error,
# never a silent 0. scripts/play/preflight.mjs reads the file by the same rules.
function Read-LastUploadVersionCode([string] $Path) {
    try {
        $json = [System.IO.File]::ReadAllText($Path) | ConvertFrom-Json -ErrorAction Stop
    } catch {
        return @{ Code = $null; Error = "not valid JSON ($($_.Exception.Message.Trim()))" }
    }
    $raw = $null
    $has = $false
    if ($json -is [System.Management.Automation.PSCustomObject]) {
        $property = $json.PSObject.Properties['versionCode']
        if ($property) { $has = $true; $raw = $property.Value }
    }
    $text = if ($raw -is [int] -or $raw -is [long]) { "$raw" } elseif ($raw -is [string]) { $raw.Trim() } else { $null }
    if ($null -eq $text -or $text -notmatch '^\d{1,10}$' -or [long]$text -gt 2100000000) {
        $shown = if (-not $has) { 'missing' } elseif ($null -eq $raw) { 'null' } else { "'$raw'" }
        return @{ Code = $null; Error = "versionCode is $shown - it must be {`"versionCode`": <integer>, ...}" }
    }
    return @{ Code = [int]$text; Error = $null }
}
