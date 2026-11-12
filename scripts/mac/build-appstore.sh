#!/usr/bin/env bash
# scripts/mac/build-appstore.sh - route 2: the Mac App Store build of "Your Personal Diary" - sandboxed
# (src-tauri/entitlements/mac-appstore.plist + the team keys), signed with an App Store distribution
# certificate, the "Mac App Store" provisioning profile embedded, packed into a signed .pkg with
# productbuild, optionally validated and uploaded. Owner's guide: docs/MAC-RELEASE.he.md section 8.
#
# UNTESTED END TO END: the project had no Apple credentials, no provisioning profile and no Xcode when this
# was written (2026-11-08). Only `bash -n` and `--dry-run` ran on the build Mac (again on 2026-11-12, macOS
# 27.2.1 with the Command Line Tools 27.2). Apple's current upload rules are in
# docs/apple-tasks/APPSTORE-FACTS.md section 9 - read it before the first real run.
#
# Usage:  bash scripts/mac/build-appstore.sh [--dry-run] [--upload] [--out <folder>]
#   --dry-run   print every command with the values it would use (<PLACEHOLDERS> for missing variables)
#               and run nothing; exit 0 (the list of missing variables is printed at the end)
#   --upload    after the .pkg: `xcrun altool --validate-app` then `--upload-app` with an App Store
#               Connect API key. altool ships with Xcode.app, NOT with the Command Line Tools; without it
#               the script tells you to use the Transporter app (free, Mac App Store) instead. Apple's
#               "built with Xcode 26" SDK rule names iOS/iPadOS/tvOS/visionOS/watchOS, not macOS
#               (APPSTORE-FACTS.md 8.1, 9.6), so the build itself may be made with the Command Line Tools.
#   --out       output folder, default src-tauri/target/universal-apple-darwin/release/bundle/appstore
#
# Environment (required unless --dry-run):
#   APPLE_TEAM_ID                  the 10-character Team ID (developer.apple.com > Membership details)
#   APPSTORE_APP_IDENTITY          "Apple Distribution: <name> (<TEAMID>)"  - or the older certificate
#                                  type "3rd Party Mac Developer Application: <name> (<TEAMID>)"
#   APPSTORE_INSTALLER_IDENTITY    "3rd Party Mac Developer Installer: <name> (<TEAMID>)" - the "Mac
#                                  Installer Distribution" certificate; it signs the .pkg
#   APPSTORE_PROVISIONING_PROFILE  path of the "Mac App Store" provisioning profile (.provisionprofile)
#                                  created for the bundle id of src-tauri/tauri.macos.conf.json
# Optional:
#   APPSTORE_BUILD_NUMBER          CFBundleVersion of this upload (default: the version string). App Store
#                                  Connect needs a higher value for every new upload of the same version.
#   APPLE_API_KEY_ID, APPLE_API_ISSUER   App Store Connect API key for --upload; altool finds the key
#                                  file AuthKey_<ID>.p8 in ~/.appstoreconnect/private_keys/ or ~/private_keys/
#   DEVELOPER_DIR                  Apple's own variable: which developer tools to use. Unset = macOS's
#                                  choice (Xcode.app once it is installed - then altool exists - otherwise
#                                  the Command Line Tools). A newly installed Xcode must be opened once to
#                                  accept its license first (docs/MAC-RELEASE.he.md section 9).
#
# What Tauri does with the overlay this script passes (Tauri 2, "App Store" guide,
# https://v2.tauri.app/distribute/app-store/): bundle.macOS.entitlements = the generated entitlements
# file, bundle.macOS.files = {"embedded.provisionprofile": <profile>} copies the profile to
# Contents/embedded.provisionprofile, bundle.macOS.signingIdentity = the distribution certificate,
# bundle.macOS.bundleVersion = CFBundleVersion. The .pkg then comes from
#   xcrun productbuild --sign "<installer identity>" --component "<app>" /Applications "<pkg>"
# ("/Applications" here is the install location recorded inside the package, nothing is written there).
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
ROOT=$(cd "$SCRIPT_DIR/../.." && pwd)
PLISTBUDDY=/usr/libexec/PlistBuddy
CONF="$ROOT/src-tauri/tauri.conf.json"
MAC_CONF="$ROOT/src-tauri/tauri.macos.conf.json"
BASE_ENT="$ROOT/src-tauri/entitlements/mac-appstore.plist"
TARGET_DIR="$ROOT/src-tauri/target/universal-apple-darwin"

DRY=0
UPLOAD=0
OUT_DIR="$TARGET_DIR/release/bundle/appstore"
while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY=1 ;;
    --upload) UPLOAD=1 ;;
    --out) shift; [ $# -gt 0 ] || { echo "build-appstore: --out needs a folder" >&2; exit 1; }; OUT_DIR=$1 ;;
    # --help prints the comment block at the top of this file (up to the first line that is not a comment)
    -h|--help) awk 'NR == 1 { next } /^#/ { sub(/^# ?/, ""); print; next } { exit }' "${BASH_SOURCE[0]}"; exit 0 ;;
    *) echo "build-appstore: unknown argument: $1 (see --help)" >&2; exit 1 ;;
  esac
  shift
done

say() { printf 'build-appstore: %s\n' "$*"; }
die() { printf '\nbuild-appstore: ERROR: %s\n' "$*" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || die "$2"; }
json_escape() { printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'; }
# run <command...>: print the command (shell-quoted, so it can be copied), then run it unless --dry-run
run() {
  printf '$'; printf ' %q' "$@"; printf '\n'
  if [ "$DRY" = 1 ]; then return 0; fi
  "$@"
}
MISSING=""
# require <VARIABLE>...: remembers the unset ones; a real run stops, a dry run prints <PLACEHOLDER>s
require() {
  local name
  for name in "$@"; do
    [ -n "${!name:-}" ] || MISSING="$MISSING $name"
  done
  if [ -n "$MISSING" ] && [ "$DRY" = 0 ]; then
    die "these environment variables are not set:$MISSING - see --help"
  fi
}
# val <VARIABLE> <what it is>: the variable's value, or <VARIABLE> as a placeholder in a dry run
val() {
  local v
  v=${!1:-}
  if [ -n "$v" ]; then printf '%s' "$v"; else printf '<%s>' "$1"; fi
}

# --- checks -------------------------------------------------------------------------------------
[ "$(uname -s)" = Darwin ] || die "this script runs on macOS only"
[ "$DRY" = 1 ] && say "DRY RUN - nothing below is executed"
say "macOS $(sw_vers -productVersion) on $(uname -m)"
need node "node is missing - install Node.js 22 or newer"
need npm "npm is missing"
need cargo "cargo is missing - install Rust with rustup"
need rustup "rustup is missing - install Rust with rustup"
need xcrun "xcrun is missing - install Xcode (the App Store build needs Xcode's SDK rules, see APPSTORE-FACTS.md section 9)"
need codesign "codesign is missing - install the Xcode Command Line Tools"
need plutil "plutil is missing (part of macOS)"
[ -x "$PLISTBUDDY" ] || die "missing $PLISTBUDDY"
xcrun --find productbuild >/dev/null 2>&1 || die "productbuild not found (part of the Command Line Tools / Xcode)"
for t in aarch64-apple-darwin x86_64-apple-darwin; do
  rustup target list --installed | grep -qx "$t" || die "Rust target $t is not installed - run:  rustup target add $t"
done
[ -f "$CONF" ] || die "missing $CONF"
[ -f "$MAC_CONF" ] || die "missing $MAC_CONF"
[ -f "$BASE_ENT" ] || die "missing $BASE_ENT"
plutil -lint "$BASE_ENT" >/dev/null || die "invalid plist: $BASE_ENT"
VERSION=$(plutil -extract version raw -o - "$CONF") || die "cannot read \"version\" from $CONF"
PRODUCT=$(plutil -extract productName raw -o - "$CONF") || die "cannot read \"productName\" from $CONF"
IDENTIFIER=$(plutil -extract identifier raw -o - "$MAC_CONF") || die "cannot read \"identifier\" from $MAC_CONF"
say "product \"$PRODUCT\" version $VERSION, bundle identifier $IDENTIFIER"
# the active developer directory: DEVELOPER_DIR when it is set, otherwise the system's choice
XCODE_PATH=${DEVELOPER_DIR:-$(xcode-select -p 2>/dev/null || true)}
case "$XCODE_PATH" in
  *CommandLineTools*) say "NOTE: only the Command Line Tools are selected ($XCODE_PATH). The build and the .pkg work with them; the upload then needs the Transporter app, because altool ships with Xcode.app only (APPSTORE-FACTS.md 8.4-8.5, 9.6)." ;;
  "") say "NOTE: no developer directory found - install the Command Line Tools (xcode-select --install) or Xcode" ;;
  *) say "developer directory: $XCODE_PATH (a newly installed Xcode must be opened once to accept its license; until then its tools stop with \"You have not agreed to the Xcode license agreements\" - docs/MAC-RELEASE.he.md section 9)" ;;
esac

require APPLE_TEAM_ID APPSTORE_APP_IDENTITY APPSTORE_INSTALLER_IDENTITY APPSTORE_PROVISIONING_PROFILE
[ "$UPLOAD" = 1 ] && require APPLE_API_KEY_ID APPLE_API_ISSUER
TEAM=$(val APPLE_TEAM_ID "10-character Team ID")
APP_IDENTITY=$(val APPSTORE_APP_IDENTITY "the Apple Distribution / 3rd Party Mac Developer Application certificate name")
INSTALLER_IDENTITY=$(val APPSTORE_INSTALLER_IDENTITY "the 3rd Party Mac Developer Installer certificate name")
PROFILE=$(val APPSTORE_PROVISIONING_PROFILE "path of the Mac App Store .provisionprofile")
BUILD_NUMBER=${APPSTORE_BUILD_NUMBER:-$VERSION}
if [ "$DRY" = 0 ]; then
  case "$TEAM" in ??????????) ;; *) die "APPLE_TEAM_ID must be exactly 10 characters (got \"$TEAM\")" ;; esac
  [ -f "$PROFILE" ] || die "provisioning profile not found: $PROFILE"
fi
say "team $TEAM, app identity \"$APP_IDENTITY\", installer identity \"$INSTALLER_IDENTITY\""
say "provisioning profile: $PROFILE"
say "CFBundleVersion for this upload: $BUILD_NUMBER"

APP="$TARGET_DIR/release/bundle/macos/$PRODUCT.app"
ENT="$OUT_DIR/entitlements.appstore.plist"
PKG="$OUT_DIR/${PRODUCT}_${VERSION}_universal.pkg"

# --- dependencies -------------------------------------------------------------------------------
cd "$ROOT"
if [ -d node_modules ]; then say "node_modules present - npm ci skipped"; else run npm ci; fi

# --- entitlements with the team keys ------------------------------------------------------------
say "step 1: entitlements = $BASE_ENT + the two team keys -> $ENT"
run mkdir -p "$OUT_DIR"
run cp "$BASE_ENT" "$ENT"
run "$PLISTBUDDY" -c "Add :com.apple.application-identifier string $TEAM.$IDENTIFIER" \
  -c "Add :com.apple.developer.team-identifier string $TEAM" "$ENT"
run plutil -lint "$ENT"

# --- build --------------------------------------------------------------------------------------
say "step 2: universal build, sandboxed, signed for the store, profile embedded"
OVERLAY=$(printf '{"bundle":{"macOS":{"signingIdentity":"%s","entitlements":"%s","bundleVersion":"%s","files":{"embedded.provisionprofile":"%s"}}}}' \
  "$(json_escape "$APP_IDENTITY")" "$(json_escape "$ENT")" "$(json_escape "$BUILD_NUMBER")" "$(json_escape "$PROFILE")")
(
  export APPLE_SIGNING_IDENTITY="$APP_IDENTITY"
  # no notarization for the Mac App Store; Tauri would try it if these were set
  unset APPLE_ID APPLE_PASSWORD APPLE_TEAM_ID APPLE_API_ISSUER APPLE_API_KEY APPLE_API_KEY_PATH
  run npx tauri build --bundles app --target universal-apple-darwin --config "$OVERLAY"
)

# --- verification -------------------------------------------------------------------------------
say "step 3: verification of the signed, sandboxed app"
run codesign --verify --deep --strict --verbose=2 "$APP"
run codesign -d --entitlements - --xml "$APP"
run test -f "$APP/Contents/embedded.provisionprofile"
if [ "$DRY" = 0 ]; then
  codesign -d --entitlements - --xml "$APP" 2>/dev/null | grep -q 'com.apple.security.app-sandbox' || die "the app is not sandboxed - the entitlements were not applied"
  codesign -dvv "$APP" 2>&1 | grep -q '^TeamIdentifier=' || die "the signature carries no team identifier - wrong certificate?"
  [ -f "$APP/Contents/embedded.provisionprofile" ] || die "Contents/embedded.provisionprofile is missing"
fi
# Apple (since 2025-02-18): "you must remove this attribute [com.apple.quarantine] from all files within
# macOS apps in order to upload to App Store Connect" - clear the extended attributes of every file in the
# bundle (APPSTORE-FACTS.md 9.6); the code signature does not live in extended attributes, so it is unharmed
run xattr -cr "$APP"

# --- the installer package ----------------------------------------------------------------------
say "step 4: signed installer package (what App Store Connect takes for a Mac app; Apple's command form, APPSTORE-FACTS.md 9.6)"
run xcrun productbuild --sign "$INSTALLER_IDENTITY" --component "$APP" /Applications "$PKG"

# --- upload -------------------------------------------------------------------------------------
if [ "$UPLOAD" = 1 ]; then
  say "step 5: validation and upload to App Store Connect"
  KEY_ID=$(val APPLE_API_KEY_ID "App Store Connect API key id")
  ISSUER=$(val APPLE_API_ISSUER "App Store Connect API issuer id")
  if xcrun --find altool >/dev/null 2>&1; then
    run xcrun altool --validate-app --type macos --file "$PKG" --apiKey "$KEY_ID" --apiIssuer "$ISSUER"
    run xcrun altool --upload-app --type macos --file "$PKG" --apiKey "$KEY_ID" --apiIssuer "$ISSUER"
  else
    say "altool is not available on this Mac (it ships with Xcode.app, not with the Command Line Tools)."
    say "Upload the package with the Transporter app instead (Mac App Store, free): open Transporter, sign in with the Apple ID of the developer account, drag $PKG into the window, click Deliver."
    say "The commands that Xcode's altool would run:"
    printf '$ xcrun altool --validate-app --type macos --file %q --apiKey %q --apiIssuer %q\n' "$PKG" "$KEY_ID" "$ISSUER"
    printf '$ xcrun altool --upload-app --type macos --file %q --apiKey %q --apiIssuer %q\n' "$PKG" "$KEY_ID" "$ISSUER"
    [ "$DRY" = 1 ] || die "no altool - use Transporter (see above) or install Xcode and run again with --upload"
  fi
else
  say "step 5: upload skipped (run again with --upload, or use the Transporter app with the .pkg)"
fi

# --- summary ------------------------------------------------------------------------------------
printf '\n'
if [ "$DRY" = 1 ]; then
  say "dry run finished - nothing was built, signed or uploaded"
  [ -n "$MISSING" ] && say "variables you must set for a real run:$MISSING"
  say "then: bash scripts/mac/build-appstore.sh [--upload]"
else
  say "done"
  printf 'app:  %s\n' "$APP"
  printf 'pkg:  %s\n' "$PKG"
  printf 'sha256 of the pkg: %s\n' "$(shasum -a 256 "$PKG" | awk '{print $1}')"
  say "next: App Store Connect > the Mac app record > TestFlight / the build appears after processing (10-60 minutes)"
fi
exit 0
