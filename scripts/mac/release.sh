#!/usr/bin/env bash
# scripts/mac/release.sh - the one command that builds the Mac release of "Your Personal Diary":
# universal app (Apple silicon + Intel), Developer ID signature with the hardened runtime,
# notarization, stapling, DMG, Gatekeeper assessment. Owner's guide: docs/MAC-RELEASE.he.md.
#
# Usage:  bash scripts/mac/release.sh [<output folder for the DMG>]
#   default output folder: src-tauri/target/universal-apple-darwin/release/bundle/dmg
#
# Environment (all optional):
#   APPLE_SIGNING_IDENTITY   "Developer ID Application: <name> (<TEAMID>)" - the certificate that is in
#                            the login keychain of the Mac running this script (Tauri reads it too).
#                            WITHOUT it the script builds the same app ad-hoc signed ("-"), packs the DMG,
#                            prints a loud warning and exits with code 2: such a DMG is for the owner's
#                            own tests only and cannot be distributed.
#   NOTARY_PROFILE           notarytool keychain profile, default "ypd-notary". The owner creates it ONCE,
#                            typing his Apple ID, Team ID and an app-specific password himself:
#                              xcrun notarytool store-credentials ypd-notary --apple-id <Apple ID> --team-id <TEAMID>
#                            This script never asks for, reads or prints any credential.
#   YPD_MIN_FREE_GIB         free disk space required before building: default 6 for the first universal
#                            build, 2 when src-tauri/target/universal-apple-darwin already exists.
#   RELEASE_LOG              log file; default ~/Developer/release-<date>.log (everything is also shown).
#   APPLE_CERTIFICATE / APPLE_CERTIFICATE_PASSWORD (CI only) are passed through to Tauri, which imports the
#   .p12 into a temporary keychain; APPLE_ID / APPLE_PASSWORD / APPLE_TEAM_ID / APPLE_API_* are UNSET for
#   the build on purpose, so that notarization happens exactly once, here, through NOTARY_PROFILE.
#
# Steps: 1 checks (macOS, node, cargo, both Rust targets, tools, disk) -> 2 npm ci only when node_modules
# is missing -> 3 npx tauri build --bundles app --target universal-apple-darwin (signed: hardened runtime +
# src-tauri/entitlements/developer-id.plist) -> 4 verification (lipo, codesign --verify --deep --strict,
# Info.plist keys, Developer ID authority, secure timestamp - re-signed with explicit flags if Tauri left
# it out) -> 5 [signed] notarize the .app (zip, notarytool submit --wait, Apple's log printed always) and
# staple it -> 6 make-dmg.sh -> 7 [signed] codesign the DMG with the same identity (Apple: "sign the disk
# image", docs/apple-tasks/APPSTORE-FACTS.md 9.4), notarize + staple the DMG, spctl --assess of DMG and
# app, SHA-256, summary.
# Exit codes: 0 = signed, notarized, stapled, distributable. 2 = finished but UNSIGNED (test only).
# 1 = a step failed; the last "release: ERROR" line says which.
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
ROOT=$(cd "$SCRIPT_DIR/../.." && pwd)
PLISTBUDDY=/usr/libexec/PlistBuddy
CONF="$ROOT/src-tauri/tauri.conf.json"
MAC_CONF="$ROOT/src-tauri/tauri.macos.conf.json"
ENTITLEMENTS="$ROOT/src-tauri/entitlements/developer-id.plist"
TARGET_DIR="$ROOT/src-tauri/target/universal-apple-darwin"

case "${1:-}" in
  -h|--help) sed -n '2,35p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
esac
OUT_DIR=${1:-"$TARGET_DIR/release/bundle/dmg"}
NOTARY_PROFILE=${NOTARY_PROFILE:-ypd-notary}
IDENTITY=${APPLE_SIGNING_IDENTITY:-}
STAMP=$(date +%Y%m%d-%H%M%S)
RELEASE_LOG=${RELEASE_LOG:-"$HOME/Developer/release-$STAMP.log"}

step() { printf '\n==> %s\n' "$*"; }
say()  { printf 'release: %s\n' "$*"; }
die()  { printf '\nrelease: ERROR: %s\n' "$*" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || die "$2"; }
json_escape() { printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'; }
# keeps the Mac awake during the build when caffeinate exists (it always does on macOS)
awake() { if command -v caffeinate >/dev/null 2>&1; then caffeinate -i "$@"; else "$@"; fi; }

mkdir -p "$(dirname "$RELEASE_LOG")"
exec > >(tee -a "$RELEASE_LOG") 2>&1
say "log: $RELEASE_LOG"

# --- 1. checks ----------------------------------------------------------------------------------
step "1/7 checks"
[ "$(uname -s)" = Darwin ] || die "this script runs on macOS only"
say "macOS $(sw_vers -productVersion) on $(uname -m)"
need node   "node is missing - install Node.js 22 or newer (on the owner's Mac: ~/Developer/tools/node/bin must be on PATH)"
need npm    "npm is missing (comes with Node.js)"
need cargo  "cargo is missing - install Rust with rustup (https://rustup.rs); on the owner's Mac ~/.cargo/bin must be on PATH"
need rustup "rustup is missing - install Rust with rustup (https://rustup.rs)"
need xcrun  "xcrun is missing - install the Xcode Command Line Tools: xcode-select --install"
need codesign "codesign is missing - install the Xcode Command Line Tools: xcode-select --install"
need lipo   "lipo is missing - install the Xcode Command Line Tools: xcode-select --install"
need hdiutil "hdiutil is missing (part of macOS)"
need plutil "plutil is missing (part of macOS)"
need shasum "shasum is missing (part of macOS)"
[ -x "$PLISTBUDDY" ] || die "missing $PLISTBUDDY (part of macOS)"
say "node $(node --version), npm $(npm --version), $(cargo --version)"
for t in aarch64-apple-darwin x86_64-apple-darwin; do
  rustup target list --installed | grep -qx "$t" || die "Rust target $t is not installed - run:  rustup target add $t"
done
say "Rust targets: aarch64-apple-darwin, x86_64-apple-darwin"
[ -f "$CONF" ] || die "missing $CONF - run the script from a copy of the project"
[ -f "$MAC_CONF" ] || die "missing $MAC_CONF"
[ -f "$ENTITLEMENTS" ] || die "missing $ENTITLEMENTS"
plutil -lint "$ENTITLEMENTS" >/dev/null || die "invalid plist: $ENTITLEMENTS"
[ -f "$SCRIPT_DIR/make-dmg.sh" ] || die "missing $SCRIPT_DIR/make-dmg.sh"
VERSION=$(plutil -extract version raw -o - "$CONF") || die "cannot read \"version\" from $CONF"
PRODUCT=$(plutil -extract productName raw -o - "$CONF") || die "cannot read \"productName\" from $CONF"
IDENTIFIER=$(plutil -extract identifier raw -o - "$MAC_CONF") || die "cannot read \"identifier\" from $MAC_CONF"
say "product \"$PRODUCT\" version $VERSION, bundle identifier $IDENTIFIER"

if [ -d "$TARGET_DIR" ]; then DEFAULT_MIN=2; else DEFAULT_MIN=6; fi
MIN_FREE_GIB=${YPD_MIN_FREE_GIB:-$DEFAULT_MIN}
FREE_KIB=$(df -k "$ROOT" | awk 'NR==2 {print $4}')
say "free disk space: $((FREE_KIB / 1024 / 1024)) GiB (required: $MIN_FREE_GIB GiB$([ -d "$TARGET_DIR" ] && printf ', the universal target folder exists already' || printf ', first universal build'))"
[ "$FREE_KIB" -ge $((MIN_FREE_GIB * 1024 * 1024)) ] || die "not enough free disk space - free some and run again (or set YPD_MIN_FREE_GIB)"

if [ -n "$IDENTITY" ]; then
  SIGNED=1
  xcrun --find notarytool >/dev/null 2>&1 || die "notarytool not found - install the Xcode Command Line Tools (xcode-select --install) or Xcode"
  xcrun --find stapler >/dev/null 2>&1 || die "stapler not found - install the Xcode Command Line Tools (xcode-select --install) or Xcode"
  need spctl "spctl is missing (part of macOS)"
  say "signing identity: $IDENTITY"
  say "notarization: keychain profile \"$NOTARY_PROFILE\" (xcrun notarytool store-credentials $NOTARY_PROFILE ... must have been run once on this Mac)"
  case "$IDENTITY" in
    "Developer ID Application:"*) ;;
    *) say "WARNING: the identity does not start with \"Developer ID Application:\" - only that certificate type can be notarized for distribution outside the Mac App Store" ;;
  esac
else
  SIGNED=0
  printf '\n!!! APPLE_SIGNING_IDENTITY is not set: building an AD-HOC signed app for local tests only (exit code 2 at the end). !!!\n'
fi

# --- 2. dependencies ----------------------------------------------------------------------------
step "2/7 dependencies"
cd "$ROOT"
if [ -d node_modules ]; then
  say "node_modules present - npm ci skipped"
else
  say "node_modules missing - running npm ci"
  npm ci
fi

# --- 3. build -----------------------------------------------------------------------------------
step "3/7 universal build (aarch64 + x86_64; several minutes on the first run)"
if [ "$SIGNED" = 1 ]; then
  OVERLAY=$(printf '{"bundle":{"macOS":{"signingIdentity":"%s","hardenedRuntime":true,"entitlements":"%s"}}}' \
    "$(json_escape "$IDENTITY")" "$(json_escape "$ENTITLEMENTS")")
  say "Tauri config overlay: $OVERLAY"
  (
    export APPLE_SIGNING_IDENTITY="$IDENTITY"
    unset APPLE_ID APPLE_PASSWORD APPLE_TEAM_ID APPLE_API_ISSUER APPLE_API_KEY APPLE_API_KEY_PATH
    awake npx tauri build --bundles app --target universal-apple-darwin --config "$OVERLAY"
  )
else
  (
    unset APPLE_SIGNING_IDENTITY APPLE_ID APPLE_PASSWORD APPLE_TEAM_ID APPLE_API_ISSUER APPLE_API_KEY APPLE_API_KEY_PATH
    awake npx tauri build --bundles app --target universal-apple-darwin
  )
fi

# --- 4. verification ----------------------------------------------------------------------------
step "4/7 verifying the app bundle"
APP="$TARGET_DIR/release/bundle/macos/$PRODUCT.app"
[ -d "$APP" ] || die "the build did not produce $APP"
INFO="$APP/Contents/Info.plist"
EXE=$("$PLISTBUDDY" -c 'Print :CFBundleExecutable' "$INFO")
BIN="$APP/Contents/MacOS/$EXE"
[ -f "$BIN" ] || die "no binary at $BIN"
ARCHS=$(lipo -archs "$BIN")
say "architectures: $ARCHS"
case "$ARCHS" in *x86_64*arm64*|*arm64*x86_64*) ;; *) die "not a universal binary ($ARCHS)" ;; esac
codesign --verify --deep --strict --verbose=2 "$APP" || die "codesign verification failed"
for key in CFBundleIdentifier CFBundleShortVersionString CFBundleVersion LSMinimumSystemVersion LSApplicationCategoryType ITSAppUsesNonExemptEncryption NSHumanReadableCopyright; do
  printf '  %-32s %s\n' "$key" "$("$PLISTBUDDY" -c "Print :$key" "$INFO" 2>/dev/null || printf '<missing>')"
done
[ "$("$PLISTBUDDY" -c 'Print :CFBundleIdentifier' "$INFO")" = "$IDENTIFIER" ] || die "CFBundleIdentifier is not $IDENTIFIER"
[ "$("$PLISTBUDDY" -c 'Print :CFBundleShortVersionString' "$INFO")" = "$VERSION" ] || die "CFBundleShortVersionString is not $VERSION"
SIGN_INFO=$(codesign -dvv "$APP" 2>&1 || true)
if [ "$SIGNED" = 1 ]; then
  printf '%s\n' "$SIGN_INFO" | grep -q '^Authority=Developer ID Application' \
    || die "the app is NOT signed with a Developer ID Application certificate (codesign -dvv shows no such Authority) - check APPLE_SIGNING_IDENTITY and the login keychain"
  printf '%s\n' "$SIGN_INFO" | grep -q 'runtime' || die "the hardened runtime flag is missing from the signature"
  if ! printf '%s\n' "$SIGN_INFO" | grep -q '^Timestamp='; then
    # notarization requires a secure timestamp (APPSTORE-FACTS.md 9.2); sign the bundle again with every
    # flag explicit - the bundle has one executable and no nested code, so no --deep is needed
    say "the signature has no secure timestamp - re-signing the bundle with explicit flags"
    codesign --force --options runtime --timestamp --entitlements "$ENTITLEMENTS" --sign "$IDENTITY" "$APP"
    codesign --verify --deep --strict --verbose=2 "$APP" || die "codesign verification failed after re-signing"
    SIGN_INFO=$(codesign -dvv "$APP" 2>&1 || true)
    printf '%s\n' "$SIGN_INFO" | grep -q '^Timestamp=' || die "still no secure timestamp after re-signing (is the Mac online? the timestamp comes from Apple's server)"
  fi
  printf '%s\n' "$SIGN_INFO" | grep -E '^(Authority|TeamIdentifier|Timestamp|CodeDirectory)' || true
else
  printf '%s\n' "$SIGN_INFO" | grep -E '^(Signature|CodeDirectory|TeamIdentifier)' || true
fi

# --- 5. notarization of the app -----------------------------------------------------------------
WORK=""
cleanup() {
  # only the folder mktemp created for us is removed, never anything else
  case "$WORK" in */ypd-release.*) if [ -d "$WORK" ]; then rm -rf "$WORK"; fi ;; esac
}
trap cleanup EXIT

# notarize <file> <label>: submits a .zip or .dmg, waits, then prints Apple's log - always, because Apple
# says to read it even when the status is Accepted (it may list warnings that become errors later)
notarize() {
  local file=$1 label=$2 out id status
  out=$(mktemp "${TMPDIR:-/tmp}/ypd-notary.XXXXXX")
  say "submitting $label to Apple's notary service and waiting for the verdict (usually 1-15 minutes)"
  xcrun notarytool submit "$file" --keychain-profile "$NOTARY_PROFILE" --wait 2>&1 | tee "$out" || true
  id=$(awk '/^ *id:/ {print $2; exit}' "$out")
  status=$(awk '/^ *status:/ {print $2}' "$out" | tail -1)
  rm -f "$out"
  if [ -n "$id" ]; then
    say "Apple's log for submission $id (read the \"issues\" list even when the status is Accepted):"
    xcrun notarytool log "$id" --keychain-profile "$NOTARY_PROFILE" || true
  else
    say "no submission id was returned - check the keychain profile: xcrun notarytool history --keychain-profile $NOTARY_PROFILE"
  fi
  if [ "$status" != Accepted ]; then
    say "notarization of $label did not end with status Accepted (got: ${status:-no status})"
    die "fix the reasons in the log above, then run the script again"
  fi
  say "$label: Accepted (submission id $id)"
}

if [ "$SIGNED" = 1 ]; then
  step "5/7 notarizing and stapling the app"
  WORK=$(mktemp -d "${TMPDIR:-/tmp}/ypd-release.XXXXXX")
  ZIP="$WORK/$PRODUCT.zip"
  ditto -c -k --keepParent "$APP" "$ZIP"
  notarize "$ZIP" "the app"
  xcrun stapler staple "$APP"
  xcrun stapler validate "$APP"
else
  step "5/7 notarization skipped (no signing identity)"
fi

# --- 6. DMG -------------------------------------------------------------------------------------
step "6/7 DMG"
DMG_OUT=$(mktemp "${TMPDIR:-/tmp}/ypd-dmg-out.XXXXXX")
bash "$SCRIPT_DIR/make-dmg.sh" "$APP" "$OUT_DIR" | tee "$DMG_OUT"
DMG=$(sed -n 's/^DMG: //p' "$DMG_OUT" | tail -1)
rm -f "$DMG_OUT"
[ -n "$DMG" ] && [ -f "$DMG" ] || die "make-dmg.sh did not report a DMG"

# --- 7. notarization of the DMG, Gatekeeper, summary --------------------------------------------
if [ "$SIGNED" = 1 ]; then
  step "7/7 signing, notarizing and stapling the DMG, Gatekeeper assessment"
  # Apple: sign the disk image with the code-signing identity before notarizing it (APPSTORE-FACTS.md 9.4)
  codesign --sign "$IDENTITY" --timestamp --identifier "$IDENTIFIER" "$DMG"
  codesign --verify --verbose=2 "$DMG" || die "the DMG signature does not verify"
  notarize "$DMG" "the DMG"
  xcrun stapler staple "$DMG"
  xcrun stapler validate "$DMG"
  say "Gatekeeper assessment of the DMG (expected: accepted, source=Notarized Developer ID)"
  spctl --assess --type open --context context:primary-signature --verbose=2 "$DMG" || die "Gatekeeper rejects the DMG"
  say "Gatekeeper assessment of the app (expected: accepted, source=Notarized Developer ID)"
  spctl --assess --type execute --verbose=2 "$APP" || die "Gatekeeper rejects the app"
  # stapling changed the DMG: recompute the checksum make-dmg.sh wrote
  SHA=$(shasum -a 256 "$DMG" | awk '{print $1}')
  printf '%s  %s\n' "$SHA" "$(basename "$DMG")" > "$DMG.sha256"
  printf '\n==================== RELEASE READY ====================\n'
  printf 'app:     %s\n' "$APP"
  printf 'DMG:     %s\n' "$DMG"
  printf 'size:    %s\n' "$(du -h "$DMG" | cut -f1)"
  printf 'sha256:  %s\n' "$SHA"
  printf 'signed:  %s (hardened runtime), notarized and stapled: app and DMG\n' "$IDENTITY"
  printf 'log:     %s\n' "$RELEASE_LOG"
  printf 'next:    give users the DMG and the .sha256 file (docs/MAC-RELEASE.he.md section 6)\n'
  printf '=======================================================\n'
  exit 0
else
  step "7/7 summary"
  SHA=$(shasum -a 256 "$DMG" | awk '{print $1}')
  printf '\n'
  printf '############################################################################\n'
  printf '#  UNSIGNED BUILD - NOT FOR DISTRIBUTION                                   #\n'
  printf '#  APPLE_SIGNING_IDENTITY was not set, so the app is only ad-hoc signed.   #\n'
  printf '#  Other Macs block it ("cannot be opened" / "is damaged"). Use this DMG   #\n'
  printf '#  only for your own tests on this Mac (docs/MAC-RELEASE.he.md section 5). #\n'
  printf '#  For a distributable release set                                         #\n'
  printf '#    export APPLE_SIGNING_IDENTITY="Developer ID Application: <name> (<TEAMID>)"\n'
  printf '#  and run the script again (it then notarizes and staples too).           #\n'
  printf '############################################################################\n'
  printf 'app:     %s\n' "$APP"
  printf 'DMG:     %s\n' "$DMG"
  printf 'size:    %s\n' "$(du -h "$DMG" | cut -f1)"
  printf 'sha256:  %s\n' "$SHA"
  printf 'log:     %s\n' "$RELEASE_LOG"
  printf 'exit code 2 = finished, but unsigned\n'
  exit 2
fi
