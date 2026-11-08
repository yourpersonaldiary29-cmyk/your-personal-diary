<#
.SYNOPSIS
    Creates the Google Play UPLOAD KEY of Your Personal Diary - run ONCE by the OWNER in his own
    PowerShell window (docs/PLAY-RELEASE.he.md, step 1).

    powershell -NoProfile -ExecutionPolicy Bypass -File scripts/android/create-upload-key.ps1 [-DryRun]

.DESCRIPTION
    What it makes, in C:\Users\AVI\Projects\android-signing (the folder android/app/build.gradle and
    scripts/android/env.ps1 read; override both with DIARY_ANDROID_SIGNING or -OutputDir):

      upload-keystore.jks    PKCS12 keystore, one RSA 2048-bit key pair, alias "upload", valid 10000 days
                             (about 27 years - Play App Signing wants an upload key that is RSA 2048 or
                             more and a validity of at least 25 years; 9125 days is the minimum accepted).
      keystore.properties    storeFile / storePassword / keyAlias / keyPassword for the Gradle release
                             build (build.gradle refuses a file that lacks one of them). Owner-only ACL.

    With Play App Signing (the default for every new app) this key signs ONLY what you upload to the
    Play Console; Google holds the key that signs what users install. Losing the upload key is not fatal
    (Play Console: "Request upload key reset", you prove you are the account owner) but it stops every
    upload until Google answers - so back the .jks and the password up in a password manager.

    The password is typed hidden (Read-Host -AsSecureString) and confirmed; it reaches keytool through an
    environment variable of this process only (-storepass:env - never on a command line, never printed,
    never logged). A PKCS12 keystore has ONE password for the store and the key (keytool ignores a
    different key password for PKCS12), so one password is asked and written as both properties.
    Password rules: 8-64 characters, printable ASCII without spaces or backslashes - Gradle reads the
    properties file as ISO-8859-1 and a backslash is an escape character there; bundletool, keytool and
    every shell must also pass it through unchanged.

    The script REFUSES to overwrite an existing upload-keystore.jks or keystore.properties (the existing
    key may be the one Play already knows). Nothing is downloaded. Agents never run it for real - only
    -DryRun (prints the plan, asks nothing, writes nothing), e.g. against a temp folder in a test.
    It loads env.ps1 with $AndroidEnvNoWrites, so not even the Gradle files env.ps1 normally writes
    (android\local.properties, the gradle-home folder) are touched - in the dry run or the real run; the
    real run writes only the keystore and keystore.properties.

.PARAMETER OutputDir          Where the keystore and keystore.properties are written.
                              Default: the folder of $SigningPropertiesFile (env.ps1), i.e. C:\Users\AVI\Projects\android-signing.
.PARAMETER KeystoreName       File name of the keystore. Default: upload-keystore.jks
.PARAMETER Alias              Key alias. Default: upload
.PARAMETER ValidityDays       Validity of the certificate in days (>= 9125 = 25 years). Default: 10000
.PARAMETER DistinguishedName  The X.500 name in the certificate (shown to nobody but Play Console). Default: CN=Your Personal Diary, OU=Android, O=Your Personal Diary, C=IL
.PARAMETER DryRun             Print what would be done; ask for no password; create nothing.
#>
[CmdletBinding()]
param(
    [string] $OutputDir = '',
    [string] $KeystoreName = 'upload-keystore.jks',
    [string] $Alias = 'upload',
    [int] $ValidityDays = 10000,
    [string] $DistinguishedName = 'CN=Your Personal Diary, OU=Android, O=Your Personal Diary, C=IL',
    [switch] $DryRun
)

Set-StrictMode -Version 2
# Paths only: env.ps1 must not write android\local.properties or create gradle-home for this script.
$AndroidEnvNoWrites = $true
. "$PSScriptRoot\env.ps1"    # $JdkHome, $Keytool, $SigningPropertiesFile; $ErrorActionPreference = 'Stop'

function Say([string] $Message) { Write-Host "[create-upload-key] $Message" }
function Fail([string] $Message) { Write-Host "[create-upload-key] ERROR: $Message" -ForegroundColor Red; exit 1 }

# keytool writes its warnings to stderr; merged by cmd so that Windows PowerShell 5.1 does not turn them
# into error records (the same trick as scripts/android/verify-apk.ps1). The arguments never contain a
# password: passwords travel in the environment variable named below.
$PasswordVariable = 'DIARY_UPLOAD_KEY_PASSWORD'
function Format-Arguments([string[]] $Arguments) {
    return (($Arguments | ForEach-Object { if ($_ -match '[\s,]') { "`"$_`"" } else { $_ } }) -join ' ')
}
function Invoke-Keytool([string[]] $Arguments) {
    return @(& cmd /c "`"$Keytool`" $(Format-Arguments $Arguments) 2>&1")
}

# --- Plan -------------------------------------------------------------------------------------------
if ($OutputDir -eq '') { $OutputDir = Split-Path -Parent $SigningPropertiesFile }
$keystorePath = Join-Path $OutputDir $KeystoreName
$propertiesPath = Join-Path $OutputDir 'keystore.properties'
$minimumDays = 9125    # 25 years, Play App Signing's minimum for an upload key

if ($Alias -notmatch '^[A-Za-z0-9._-]{1,64}$') { Fail "alias '$Alias' must be 1-64 letters, digits, '.', '_' or '-'" }
if ($ValidityDays -lt $minimumDays) { Fail "validity $ValidityDays days is under the $minimumDays days (25 years) Google Play requires" }
if ($KeystoreName -notmatch '^[A-Za-z0-9._-]+\.(jks|keystore|p12)$') { Fail "keystore name '$KeystoreName' must end with .jks, .keystore or .p12 and contain no spaces" }
if (-not (Test-Path -LiteralPath $Keytool -PathType Leaf)) { Fail "keytool not found at $Keytool (the JDK of scripts/android/env.ps1; set DIARY_ANDROID_JDK)" }

$gradleReads = $SigningPropertiesFile
if ((Resolve-Path -LiteralPath $OutputDir -ErrorAction SilentlyContinue) -and
    ((Resolve-Path -LiteralPath $OutputDir).Path.TrimEnd('\') -ne (Split-Path -Parent $gradleReads).TrimEnd('\'))) {
    Say "NOTE: the Gradle release build reads $gradleReads - to use $propertiesPath set DIARY_ANDROID_SIGNING to it (or move the files)."
}

# Refusals happen in a dry run too: the point of the dry run is to show what the real run would do.
if (Test-Path -LiteralPath $keystorePath) {
    Fail "refusing to overwrite the existing keystore $keystorePath - it may be the upload key Google Play already knows. Move it away deliberately (after a backup) or pass -OutputDir <other folder>."
}
if (Test-Path -LiteralPath $propertiesPath) {
    Fail "refusing to overwrite the existing $propertiesPath - it points at the key the release build signs with. Move it away deliberately or pass -OutputDir <other folder>."
}

$genArgs = @('-genkeypair', '-v',
    '-keystore', $keystorePath, '-storetype', 'PKCS12',
    '-alias', $Alias, '-keyalg', 'RSA', '-keysize', '2048', '-validity', "$ValidityDays",
    '-dname', $DistinguishedName,
    '-storepass:env', $PasswordVariable, '-keypass:env', $PasswordVariable)
$listArgs = @('-list', '-v', '-keystore', $keystorePath, '-storetype', 'PKCS12', '-alias', $Alias, '-storepass:env', $PasswordVariable)

if ($DryRun) {
    Say 'DRY RUN - nothing is asked, created or changed. The real run would:'
    Say "  1. ask for ONE password (hidden, typed twice) - 8-64 printable ASCII characters, no spaces, no backslash;"
    Say "     a PKCS12 keystore has one password for the store and the key."
    Say "  2. create the folder $OutputDir if it is missing;"
    Say "  3. run (the password only in the process variable $PasswordVariable, never in the arguments):"
    Say "     `"$Keytool`" $(Format-Arguments $genArgs)"
    Say "     -> $keystorePath (RSA 2048, alias '$Alias', valid $ValidityDays days = $([math]::Round($ValidityDays / 365.25, 1)) years, PKCS12)"
    Say "  4. write $propertiesPath for android/app/build.gradle:"
    Say "     storeFile=$KeystoreName"
    Say "     storePassword=<hidden>"
    Say "     keyAlias=$Alias"
    Say "     keyPassword=<hidden>"
    Say "  5. give both files an owner-only ACL (icacls /inheritance:r /grant:r <you>:(R,W));"
    Say "  6. print the SHA-256 fingerprint of the upload certificate (keytool -list -v) and nothing else about the key;"
    Say "  7. remind you, in Hebrew, to back up the .jks and the password in a password manager."
    Say "dry run finished: would create $keystorePath and $propertiesPath"
    exit 0
}

# --- The password -----------------------------------------------------------------------------------
if (-not [Environment]::UserInteractive) { Fail 'no console to ask for the password: run this script yourself in a PowerShell window (agents only run it with -DryRun)' }

function ConvertFrom-Secure([System.Security.SecureString] $Secure) {
    $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secure)
    try { return [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) } finally { [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}

Write-Host ''
Write-Host 'Choose the password of the upload keystore. It protects the key on this PC; you will type it again' -ForegroundColor Cyan
Write-Host 'only if you ever recreate keystore.properties. 8-64 characters, letters / digits / punctuation, no spaces,' -ForegroundColor Cyan
Write-Host 'no backslash. Save it in your password manager together with the .jks file.' -ForegroundColor Cyan
$plain = $null
while ($true) {
    $first = ConvertFrom-Secure (Read-Host -AsSecureString -Prompt 'Keystore password (typed hidden)')
    if ($first -notmatch '^[\x21-\x7E]{8,64}$' -or $first.Contains('\')) {
        Write-Host 'Not accepted: 8-64 printable ASCII characters, no spaces, no backslash. Try again.' -ForegroundColor Yellow
        $first = $null
        continue
    }
    $second = ConvertFrom-Secure (Read-Host -AsSecureString -Prompt 'Repeat the password')
    if ($first -ceq $second) { $plain = $first; $first = $null; $second = $null; break }
    Write-Host 'The two entries differ. Try again.' -ForegroundColor Yellow
    $first = $null
    $second = $null
}

# --- Create -----------------------------------------------------------------------------------------
if (-not (Test-Path -LiteralPath $OutputDir)) { New-Item -ItemType Directory -Path $OutputDir | Out-Null }
$me = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name

Set-Item -Path "Env:$PasswordVariable" -Value $plain
try {
    Say "creating $keystorePath (RSA 2048, alias '$Alias', $ValidityDays days, PKCS12) ..."
    $output = Invoke-Keytool $genArgs
    $exit = $LASTEXITCODE
    # keytool's own lines (what it generated, where it stored it) - they never contain the password.
    $output | Where-Object { $_ -and $_ -notmatch '^\s*$' } | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
    if ($exit -ne 0 -or -not (Test-Path -LiteralPath $keystorePath)) { Fail "keytool -genkeypair exited with $exit - no keystore was created" }
    & icacls $keystorePath /inheritance:r /grant:r "${me}:(R,W)" | Out-Null

    # keystore.properties: the file is created empty and locked down BEFORE the secret lines are written.
    New-Item -ItemType File -Path $propertiesPath | Out-Null
    & icacls $propertiesPath /inheritance:r /grant:r "${me}:(R,W)" | Out-Null
    $lines = @(
        '# Your Personal Diary - Android release signing, read by android/app/build.gradle.',
        '# SECRET: never commit, never send, never paste anywhere. Back up with the keystore in a password manager.',
        "# Created $(Get-Date -Format s) by scripts/android/create-upload-key.ps1 (PKCS12: one password for store and key).",
        "storeFile=$KeystoreName",
        "storePassword=$plain",
        "keyAlias=$Alias",
        "keyPassword=$plain"
    )
    [System.IO.File]::WriteAllLines($propertiesPath, $lines, (New-Object System.Text.UTF8Encoding $false))

    # The only thing printed about the key: the SHA-256 fingerprint of its certificate (Play Console shows
    # the same value under Play app signing -> Upload key certificate once the first bundle is uploaded).
    $listing = Invoke-Keytool $listArgs
    $sha256 = ($listing | ForEach-Object { if ($_ -match 'SHA256:\s*([0-9A-Fa-f:]{95})') { $Matches[1] } } | Select-Object -First 1)
} finally {
    Remove-Item -Path "Env:$PasswordVariable" -ErrorAction SilentlyContinue
    $plain = $null
    $lines = $null
}

Write-Host ''
Say "keystore:   $keystorePath"
Say "properties: $propertiesPath (owner-only: $me)"
Say "alias:      $Alias   (RSA 2048, valid $ValidityDays days)"
if ($sha256) { Say "SHA-256 of the upload certificate: $sha256" } else { Say 'SHA-256 fingerprint: could not be read back (run keytool -list -v yourself)' }

# --- The reminder, in plain Hebrew ---------------------------------------------------------------------
$previousEncoding = [Console]::OutputEncoding
try {
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    Write-Host ''
    Write-Host 'חשוב - לעשות עכשיו, לפני שסוגרים את החלון:' -ForegroundColor Yellow
    Write-Host "1. לשמור עותק של הקובץ $KeystoreName ואת הסיסמה שבחרתם במנהל סיסמאות (או במקום מגובה אחר, לא במחשב הזה בלבד)." -ForegroundColor Yellow
    Write-Host '2. לא לשלוח את הקובץ ולא את הסיסמה לאף אחד, לא להעלות אותם ל-Git ולא לצ''אט.' -ForegroundColor Yellow
    Write-Host '3. אם הקובץ או הסיסמה יאבדו - כל העלאה ל-Google Play נעצרת עד שמבקשים מגוגל איפוס של מפתח ההעלאה (Request upload key reset) ומחכים לתשובה.' -ForegroundColor Yellow
    Write-Host '4. הסיסמה שמורה גם בתוך keystore.properties (כך Gradle חותם) - לכן גם הקובץ הזה סודי.' -ForegroundColor Yellow
    Write-Host 'השלב הבא: npm run android:aab -- -Bump   (בונה את קובץ ה-AAB החתום ומדפיס את טביעת האצבע)' -ForegroundColor Yellow
} finally {
    [Console]::OutputEncoding = $previousEncoding
}
exit 0
