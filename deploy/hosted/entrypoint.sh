#!/bin/sh
# Your Personal Diary - hosted container entrypoint (docs/HOSTED-PLAN.md 3.1, 3.6; HOSTED-IMPL item 4).
#
# The container starts as root because Fly mounts the volume root-owned. This script:
#   1. applies a pending data migration, if scripts/hosted/migrate-from-pc.ps1 uploaded one
#      (/data/incoming/pc-data.tar + /data/incoming/APPLY) - done here, BEFORE the server runs,
#      so no process ever has the files open while they are replaced;
#   2. makes /data (and anything in it that is not ours yet) owned by the app user, mode 0700;
#   3. drops privileges with `exec su-exec` so that node is PID 1 and receives SIGTERM directly.
# When it is not root (local test, `docker run --user`), it simply execs the command.
set -eu

APP_USER="${DIARY_APP_USER:-diary}"
DATA_DIR="${DIARY_DATA_DIR:-/data}"

if [ "$(id -u)" = "0" ]; then
  mkdir -p "$DATA_DIR"

  if [ -x /usr/local/bin/diary-data-tools ]; then
    /usr/local/bin/diary-data-tools apply-incoming "$DATA_DIR"
  fi

  # Ownership: only paths that are not already the app user's (cheap on every start).
  chown "$APP_USER:$APP_USER" "$DATA_DIR" 2>/dev/null || true
  find "$DATA_DIR" ! -user "$APP_USER" -exec chown "$APP_USER:$APP_USER" {} + 2>/dev/null || true
  chmod 0700 "$DATA_DIR" 2>/dev/null || true

  echo "[entrypoint] data dir $DATA_DIR ready; starting as $APP_USER: $*"
  exec su-exec "$APP_USER:$APP_USER" "$@"
fi

exec "$@"
