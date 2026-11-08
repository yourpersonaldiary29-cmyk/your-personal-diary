# Your Personal Diary - hosted server image (Fly.io; docs/HOSTED-PLAN.md Part B 1.4, 3.1, 3.6, 3.8, 5.7).
#
# Nothing is built inside the image: scripts/hosted/stage-image.mjs assembles everything the server
# needs into ./dist (the hosted bundle, sql-wasm.wasm, fonts/, pdfkit-data/, ui/, the optional
# admin tool and the SMTP smoke test) and this file only copies that tree. The build context is this
# directory (deploy/hosted); .dockerignore keeps everything else out. No package manager runs except
# `apk add su-exec` from the base image's own repositories (plan 5.8 rule 4); no curl, no wget, no ADD <url>.
#
# Base image policy (plan 5.7): bump node:24-alpine to the current patch monthly, a Node LTS major yearly.
FROM node:24-alpine

# su-exec: drop from root to the app user in entrypoint.sh with exec semantics (node stays PID 1).
RUN apk add --no-cache su-exec \
 && addgroup -S diary \
 && adduser -S -G diary -H -s /sbin/nologin diary \
 && mkdir -p /app /data \
 && chown diary:diary /app /data \
 && chmod 0700 /data

# Runtime defaults. fly.toml [env] and `fly secrets` override them; the ones that must exist BEFORE
# node starts (UV_THREADPOOL_SIZE, NODE_OPTIONS) live here on purpose (plan 2.1, 5.4, 3.8).
#   UV_THREADPOOL_SIZE=8        scrypt + fs share the libuv pool (plan 5.4)
#   NODE_OPTIONS                512 MB machine - 128 MB: memory pressure fails a request, not the process
#   DIARY_STATIC_DIR/ASSETS_DIR the existing env contract of server/src/config.ts
ENV NODE_ENV=production \
    UV_THREADPOOL_SIZE=8 \
    NODE_OPTIONS=--max-old-space-size=384 \
    DIARY_MODE=hosted \
    DIARY_DATA_DIR=/data \
    DIARY_STATIC_DIR=/app/ui \
    DIARY_ASSETS_DIR=/app \
    PORT=8080

WORKDIR /app

# The staged tree (see stage-image.mjs for the exact list). Owned by the app user, read-only in practice.
COPY --chown=diary:diary dist/ /app/

# Entrypoint + data tools (both plain POSIX sh; CRLF is stripped in case they were edited on Windows).
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
COPY data-tools.sh /usr/local/bin/diary-data-tools
RUN sed -i 's/\r$//' /usr/local/bin/entrypoint.sh /usr/local/bin/diary-data-tools \
 && chmod 0755 /usr/local/bin/entrypoint.sh /usr/local/bin/diary-data-tools

EXPOSE 8080
STOPSIGNAL SIGTERM

# Starts as root (the volume is mounted root-owned), fixes /data ownership once, applies a pending
# data migration if one was uploaded, then `exec su-exec diary node ...` - PID 1 is node (plan 3.6).
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
# The entry file name is the single constant HOSTED_ENTRY_FILE in scripts/hosted/stage-image.mjs,
# which verifies that this CMD names the same file.
CMD ["node", "/app/server-hosted.cjs"]
