#!/usr/bin/env bash
# Copy the project's source (not node_modules, build output, store kits or key files) to the Mac
# over the home network, then mirror it into ~/Developer/my-personal-diary with rsync --delete
# (node_modules, dist and src-tauri/target on the Mac are kept). Run from Git Bash on the PC.
set -euo pipefail
ROOT=/c/Users/AVI/Projects/my-personal-diary
# Git Bash's ssh sometimes fails to resolve the Bonjour name; Windows' resolver (mDNS) is reliable.
if [ -z "${MAC_HOST:-}" ]; then
  MAC_HOST=$(powershell.exe -NoProfile -Command "(Resolve-DnsName -Name 'Shmuels-MacBook-Pro-2.local' -Type A -ErrorAction SilentlyContinue | Select-Object -First 1).IPAddress" 2>/dev/null | tr -d '\r\n ')
  MAC_HOST="${MAC_HOST:-192.168.68.103}"
fi
MAC="ssh -i $HOME/.ssh/diary_mac -o IdentitiesOnly=yes -o BatchMode=yes -o HostKeyAlias=192.168.68.103 -o ConnectTimeout=10 -o ServerAliveInterval=30 shmuelsebag@$MAC_HOST"
cd "$ROOT"
tar -cf - \
  --exclude=./.git \
  --exclude=./node_modules --exclude=node_modules \
  --exclude=./dist --exclude=./mobile-dist --exclude=./dist-ssr \
  --exclude=./src-tauri/target --exclude=./src-tauri/binaries --exclude=./src-tauri/resources/server \
  --exclude=./src-tauri/gen/schemas \
  --exclude=./server/.dev-data --exclude=./server/dist \
  --exclude=./android/app/build --exclude=./android/build --exclude=./android/.gradle \
  --exclude=./android/capacitor-cordova-android-plugins/build --exclude=./android/local.properties \
  --exclude=./mpd-store-tools --exclude=./store --exclude=./play --exclude=./deploy \
  --exclude='*.log' --exclude='*.mpd' --exclude='*.mpd.prev' --exclude='*.mpd.tmp' --exclude='*.mpda' \
  --exclude='.env*' --exclude='*.jks' --exclude='*.keystore' --exclude='*.p12' --exclude='*.pfx' \
  --exclude='*.pem' --exclude='*.p8' \
  . 2>/dev/null \
| $MAC 'set -e
S="$HOME/Developer/.diary-sync"; P="$HOME/Developer/my-personal-diary"
rm -rf "$S"; mkdir -p "$S" "$P"
tar -xf - -C "$S"
C="$HOME/Developer/.diary-sync-changes.txt"
rsync -a --delete --itemize-changes --exclude node_modules --exclude /dist --exclude /mobile-dist \
  --exclude /src-tauri/target --exclude /src-tauri/gen/schemas --exclude /ios "$S/" "$P/" > "$C"
rm -rf "$S"
echo "changed entries: $(grep -cv "^\.d" "$C" || true)"; grep -v "^\.d" "$C" | head -60 || true
echo "synced: $(find "$P" -path "$P/node_modules" -prune -o -path "$P/src-tauri/target" -prune -o -type f -print | wc -l | tr -d " ") files"'
