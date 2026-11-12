#!/usr/bin/env bash
# scripts/mac/make-dmg.sh - pack the built Mac app "Your Personal Diary" into a DMG with hdiutil only.
#
# Usage:  bash scripts/mac/make-dmg.sh [<path of the .app>] [<output folder>]
#   .app default:    src-tauri/target/universal-apple-darwin/release/bundle/macos/Your Personal Diary.app
#   output default:  src-tauri/target/universal-apple-darwin/release/bundle/dmg
#   result:          <output folder>/Your Personal Diary_<version>_<universal|aarch64|x64>.dmg (+ .sha256)
#
# No Finder, no AppleScript: the build Mac is driven over SSH without a GUI session, and the owner can
# run it from Terminal. Steps:
#   1. checks the .app: Info.plist, binary, code signature (codesign --verify --deep --strict), and that
#      its version equals "version" in src-tauri/tauri.conf.json (rebuild first when it does not)
#   2. stages a copy of the .app (ditto keeps the signature's extended attributes and symlinks) next to
#      a symlink "Applications" -> /Applications, so the user drags the app onto it
#   3. hdiutil create -volname "Your Personal Diary" -srcfolder <staging> -ov -format UDZO -fs HFS+
#   4. verifies the image: hdiutil verify (checksums), attach read-only without Finder, cmp of the app
#      binary against the source, codesign of the copy, the Applications link, detach
#   5. prints path, size and SHA-256 of the DMG and writes <dmg>.sha256 next to it
# Exit code 0 only when every check passed; any failure stops the script with a message.
#
# The DMG is exactly as trustworthy as the .app inside it: an ad-hoc signed app (no Apple account) gives
# a DMG for the owner's own tests on his Mac (other Macs block it; see docs/MAC-RELEASE.he.md section 5);
# an app signed with a Developer ID certificate, notarized and stapled by scripts/mac/release.sh gives
# the distributable DMG, which release.sh then notarizes and staples as well.
#
# Why UDZO on HFS+: UDZO is the zlib-compressed, read-only image format that Apple's packaging guide
# ("Packaging Mac software for distribution") and Tauri's own DMG bundler produce - it mounts on every
# macOS version and cannot be altered after creation. HFS+ as the image file system is what Tauri's
# bundler and the common create-dmg tool use: it mounts everywhere (APFS images need macOS 10.13 or
# later and some third-party tools cannot read them), keeps the symlink and the signed app intact, and
# the user copies the app onto an APFS disk anyway. Our app itself requires macOS 12.3, so both would
# work; HFS+ is simply the format with no known reader problem.
#
# macOS 27 prints "hdiutil: WARNING: '...' is deprecated. Please use 'diskutil image ...' instead." for
# hdiutil create, attach and detach. The verbs still work (verified on macOS 27.2.1, 2026-11-12); the script
# shows hdiutil's messages after each hdiutil step, on lines of their own, and one note that they are
# expected. Replacements for a future macOS that removes them: docs/MAC-RELEASE.he.md, appendix A.
set -euo pipefail

say() { printf 'make-dmg: %s\n' "$*"; }
die() { printf 'make-dmg: ERROR: %s\n' "$*" >&2; exit 1; }

[ "$(uname -s)" = Darwin ] || die "this script runs on macOS only (hdiutil, codesign, PlistBuddy)"

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
ROOT=$(cd "$SCRIPT_DIR/../.." && pwd)
CONF="$ROOT/src-tauri/tauri.conf.json"
PLISTBUDDY=/usr/libexec/PlistBuddy

case "${1:-}" in
  # --help prints the comment block at the top of this file (up to the first line that is not a comment)
  -h|--help) awk 'NR == 1 { next } /^#/ { sub(/^# ?/, ""); print; next } { exit }' "${BASH_SOURCE[0]}"; exit 0 ;;
esac

APP=${1:-"$ROOT/src-tauri/target/universal-apple-darwin/release/bundle/macos/Your Personal Diary.app"}
OUT_DIR=${2:-"$ROOT/src-tauri/target/universal-apple-darwin/release/bundle/dmg"}
VOLNAME="Your Personal Diary"

# --- 1. checks ----------------------------------------------------------------------------------
[ -f "$CONF" ] || die "missing $CONF - run the script from a copy of the project"
[ -x "$PLISTBUDDY" ] || die "missing $PLISTBUDDY"
for tool in hdiutil codesign ditto lipo cmp shasum plutil; do
  command -v "$tool" >/dev/null 2>&1 || die "missing tool: $tool"
done
[ -d "$APP" ] || die "no app bundle at: $APP
  build it first:  npx tauri build --bundles app --target universal-apple-darwin"
case "$APP" in *.app) ;; *) die "not an .app bundle: $APP" ;; esac
INFO="$APP/Contents/Info.plist"
[ -f "$INFO" ] || die "no Info.plist in $APP"

VERSION=$(plutil -extract version raw -o - "$CONF") || die "cannot read \"version\" from $CONF"
case "$VERSION" in ""|*[!0-9.]*) die "unexpected version \"$VERSION\" in $CONF" ;; esac
APP_VERSION=$("$PLISTBUDDY" -c 'Print :CFBundleShortVersionString' "$INFO")
[ "$APP_VERSION" = "$VERSION" ] || die "the app is version $APP_VERSION but $CONF says $VERSION - rebuild the app first"

EXE=$("$PLISTBUDDY" -c 'Print :CFBundleExecutable' "$INFO")
BIN="$APP/Contents/MacOS/$EXE"
[ -f "$BIN" ] || die "no binary at $BIN"
APP_NAME=$(basename "$APP" .app)
ARCHS=$(lipo -archs "$BIN")
case "$ARCHS" in
  *x86_64*arm64*|*arm64*x86_64*) ARCH_TAG=universal ;;
  arm64) ARCH_TAG=aarch64 ;;
  x86_64) ARCH_TAG=x64 ;;
  *) die "unexpected architectures \"$ARCHS\" in $BIN" ;;
esac
say "app: $APP"
say "version $VERSION, architectures: $ARCHS ($ARCH_TAG)"
say "checking the code signature"
codesign --verify --deep --strict --verbose=2 "$APP" || die "the app's code signature does not verify - rebuild it"

DMG="$OUT_DIR/${APP_NAME}_${VERSION}_${ARCH_TAG}.dmg"

# --- 2. staging folder --------------------------------------------------------------------------
STAGE=""
MNT=""
HD_ERR=""
cleanup() {
  if [ -n "$MNT" ] && [ -d "$MNT" ]; then
    hdiutil detach "$MNT" >/dev/null 2>&1 || hdiutil detach "$MNT" -force >/dev/null 2>&1 || true
    rmdir "$MNT" 2>/dev/null || true
  fi
  # only what mktemp created for us is removed, never anything else
  case "$STAGE" in
    */ypd-dmg-stage.*) if [ -d "$STAGE" ]; then rm -rf "$STAGE"; fi ;;
  esac
  case "$HD_ERR" in */ypd-dmg-err.*) rm -f "$HD_ERR" ;; esac
}
trap cleanup EXIT
STAGE=$(mktemp -d "${TMPDIR:-/tmp}/ypd-dmg-stage.XXXXXX")
HD_ERR=$(mktemp "${TMPDIR:-/tmp}/ypd-dmg-err.XXXXXX")

# hd <hdiutil arguments...>: runs hdiutil and shows what it printed on stderr only after it finished,
# so that a warning can never run into the middle of its "created: ..." line; returns hdiutil's exit code
HD_NOTED=0
hd() {
  local rc=0
  hdiutil "$@" 2>"$HD_ERR" || rc=$?
  if [ -s "$HD_ERR" ]; then
    cat "$HD_ERR" >&2
    if [ "$HD_NOTED" = 0 ] && grep -q 'is deprecated' "$HD_ERR"; then
      HD_NOTED=1
      say "note: this macOS calls some hdiutil commands \"deprecated\" (the WARNING lines) - they still work, nothing to do" >&2
    fi
  fi
  : > "$HD_ERR"
  return "$rc"
}

say "staging a copy of the app"
ditto "$APP" "$STAGE/$APP_NAME.app"
ln -s /Applications "$STAGE/Applications"

# --- 3. the image -------------------------------------------------------------------------------
mkdir -p "$OUT_DIR"
say "creating $DMG"
hd create -volname "$VOLNAME" -srcfolder "$STAGE" -ov -format UDZO -fs HFS+ -imagekey zlib-level=9 "$DMG" \
  || die "hdiutil create failed - its message is above (an older DMG of the same name still mounted? eject it in Finder)"

# --- 4. verification ----------------------------------------------------------------------------
say "verifying the image checksums"
hd verify "$DMG" || die "hdiutil verify rejects $DMG"
MNT=$(mktemp -d "${TMPDIR:-/tmp}/ypd-dmg-mnt.XXXXXX")
say "mounting read-only at $MNT (not shown in Finder)"
hd attach "$DMG" -nobrowse -readonly -mountpoint "$MNT" >/dev/null || die "cannot mount $DMG"
cmp "$BIN" "$MNT/$APP_NAME.app/Contents/MacOS/$EXE" || die "the binary inside the DMG differs from $BIN"
codesign --verify --deep --strict "$MNT/$APP_NAME.app" || die "the app inside the DMG does not verify"
if [ -L "$MNT/Applications" ] && [ "$(readlink "$MNT/Applications")" = /Applications ]; then
  :
else
  die "the Applications link is missing in the image"
fi
hd detach "$MNT" >/dev/null || { sleep 2; hd detach "$MNT" >/dev/null; } || die "cannot detach $MNT"
rmdir "$MNT" 2>/dev/null || true
MNT=""

# --- 5. result ----------------------------------------------------------------------------------
SHA=$(shasum -a 256 "$DMG" | awk '{print $1}')
printf '%s  %s\n' "$SHA" "$(basename "$DMG")" > "$DMG.sha256"
SIZE=$(du -h "$DMG" | cut -f1)
say "verified: binary identical, signature valid, Applications link present"
say "size: $SIZE"
say "sha256: $SHA  (also in $DMG.sha256)"
printf 'DMG: %s\n' "$DMG"
