#!/bin/sh
# Your Personal Diary - data tools inside the hosted container (installed as /usr/local/bin/diary-data-tools).
# Plain POSIX sh + the image's node. Never prints names or e-mail addresses: counts only.
#
#   diary-data-tools count [dataDir]            accounts / diary files / pending deletes in the data dir
#   diary-data-tools apply-incoming [dataDir]   (entrypoint, as root, before the server starts) if
#                                               <dataDir>/incoming/pc-data.tar AND <dataDir>/incoming/APPLY
#                                               exist: move the current registry + diaries aside into
#                                               incoming/replaced-<utc>/, extract the tar over the data dir,
#                                               delete the tar and the marker, log the counts
#   diary-data-tools incoming [dataDir]         what is waiting in incoming/ (sizes only)
#   diary-data-tools prepare-incoming [dataDir] create <dataDir>/incoming (target of `fly ssh sftp put`)
#   diary-data-tools arm [dataDir]              create the APPLY marker (only after the upload was verified)
#   diary-data-tools disarm [dataDir]           remove the marker and the uploaded tar (abort a migration)
#
# Used by scripts/hosted/migrate-from-pc.ps1 (HOSTED-IMPL item 4): the tar is uploaded with
# `fly ssh sftp put`, the marker is created last, and `fly machine restart` makes the entrypoint apply it.
set -eu

cmd="${1:-help}"
DATA_DIR="${2:-${DIARY_DATA_DIR:-/data}}"
INCOMING="$DATA_DIR/incoming"

count_dir() {
  dir="$1"
  if [ -f "$dir/accounts.json" ]; then
    node -e '
      const fs = require("fs");
      let n = 0, p = 0;
      try { const a = JSON.parse(fs.readFileSync(process.argv[1], "utf8")); n = (a.accounts || []).length; p = (a.pendingDeletes || []).length; } catch (e) { console.log("accounts=unreadable"); process.exit(3); }
      console.log("accounts=" + n + " pendingDeletes=" + p);
    ' "$dir/accounts.json"
  else
    echo "accounts=0 (no accounts.json)"
  fi
  diaries=0
  if [ -d "$dir/users" ]; then
    diaries=$(find "$dir/users" -maxdepth 1 -name '*.mpd' -type f | wc -l | tr -d ' ')
  fi
  echo "diaries=$diaries"
  if [ -f "$dir/device.key" ]; then echo "device.key=present (DIARY_DEVICE_KEY secret is the cleaner design; see HOSTED-DEPLOY.he.md)"; else echo "device.key=absent"; fi
  if [ -f "$dir/server-settings.json" ]; then echo "server-settings.json=present"; else echo "server-settings.json=absent"; fi
}

case "$cmd" in
  count)
    count_dir "$DATA_DIR"
    ;;

  incoming)
    if [ -d "$INCOMING" ]; then
      ls -la "$INCOMING" 2>/dev/null | awk 'NR>1 {print $5, $NF}'
    else
      echo "(no incoming directory)"
    fi
    ;;

  prepare-incoming)
    mkdir -p "$INCOMING"
    rm -f "$INCOMING/APPLY"
    echo "incoming=$INCOMING ready (marker cleared)"
    ;;

  arm)
    if [ ! -f "$INCOMING/pc-data.tar" ]; then
      echo "REFUSED: no incoming/pc-data.tar to apply"
      exit 2
    fi
    : > "$INCOMING/APPLY"
    echo "armed: the next start applies incoming/pc-data.tar ($(wc -c < "$INCOMING/pc-data.tar") bytes)"
    ;;

  disarm)
    rm -f "$INCOMING/APPLY" "$INCOMING/pc-data.tar"
    echo "disarmed: marker and upload removed"
    ;;

  apply-incoming)
    TAR="$INCOMING/pc-data.tar"
    MARK="$INCOMING/APPLY"
    if [ ! -f "$TAR" ] || [ ! -f "$MARK" ]; then
      exit 0
    fi
    stamp=$(date -u +%Y%m%dT%H%M%SZ)
    echo "[data-tools] applying uploaded data (incoming/pc-data.tar, $(wc -c < "$TAR") bytes)"
    # 1. Refuse an archive that is not a diary data directory.
    if ! tar -tf "$TAR" | grep -qx -e './accounts.json' -e 'accounts.json'; then
      echo "[data-tools] REFUSED: the archive holds no accounts.json at its root; marker removed, tar kept"
      rm -f "$MARK"
      exit 0
    fi
    # 2. Move what is there now aside (never delete: the owner removes incoming/replaced-* himself).
    ASIDE="$INCOMING/replaced-$stamp"
    moved=0
    for item in accounts.json server-settings.json resets.json sessions.json users; do
      if [ -e "$DATA_DIR/$item" ]; then
        mkdir -p "$ASIDE"
        mv "$DATA_DIR/$item" "$ASIDE/$item"
        moved=1
      fi
    done
    [ "$moved" = "1" ] && echo "[data-tools] previous registry/diaries moved to incoming/replaced-$stamp"
    # 3. Extract over the data dir.
    if tar -xf "$TAR" -C "$DATA_DIR"; then
      rm -f "$TAR" "$MARK"
      # busybox tar may extract with the archive's uid; the entrypoint chowns afterwards.
      echo "[data-tools] applied. now: $(count_dir "$DATA_DIR" | tr '\n' ' ')"
      echo "applied $stamp: $(count_dir "$DATA_DIR" | tr '\n' ' ')" >> "$INCOMING/last-apply.txt"
    else
      echo "[data-tools] FAILED to extract; restoring the previous files"
      if [ -d "$ASIDE" ]; then
        for item in accounts.json server-settings.json resets.json sessions.json users; do
          [ -e "$ASIDE/$item" ] && mv "$ASIDE/$item" "$DATA_DIR/$item"
        done
        rmdir "$ASIDE" 2>/dev/null || true
      fi
      rm -f "$MARK"
      exit 0
    fi
    ;;

  help|*)
    sed -n '2,15p' "$0"
    ;;
esac
