YOUR PACKAGE: WP-3 (Node platform shims for the mobile core + byte-compatibility suite).

Read docs/ANDROID-PLAN.md (sections 1-2 and the WP table) and the "NOTES" below first. Stage 1 is done: mobile/ scaffold, transport seam, worker stub (mobile/core/worker-stub.ts), host client (mobile/host/*), server refactors (mail transport injection, guest mode, schema guard).

FILE OWNERSHIP: package.json + package-lock.json (root; you are the ONLY agent allowed to change them in this stage), mobile/core/shims/** EXCEPT mobile/core/shims/fs.ts (owned by WP-4), mobile/core/alias-plugin.ts, mobile/test/compat/**, mobile/test/fixtures/**, scripts/mobile/make-fixtures.mjs, mobile/vitest.config.ts (only to add what your tests need). Do NOT touch server/src/**, src/**, mobile/core/vfs/**, mobile/host/**.

GOAL: the server code in server/src must run UNCHANGED inside a Web Worker. A Vite/vitest resolve plugin (mobile/core/alias-plugin.ts), active only for importers under server/src (and shared/), redirects Node built-ins and Node-only packages to shims.

INVENTORY (grep of server/src outside remote/**, mail/node-transport.ts, middleware/host-check.ts, server.ts, index.ts - re-check it yourself):
- node:crypto: randomBytes, scrypt (callback API with {N, r, p, maxmem}), createCipheriv / createDecipheriv ('aes-256-gcm' with setAAD, update, final, getAuthTag, setAuthTag, authTagLength 16), timingSafeEqual, randomInt, createHash('sha256') (update/digest hex|buffer|base64).
- node:fs: owned by WP-4 (mobile/core/shims/fs.ts re-exports the VFS facade). Your alias plugin maps 'node:fs' and 'fs' to that file.
- node:path -> path-browserify (posix; the mobile ServerConfig uses virtual posix paths like /data/users/<id>.mpd).
- node:os, node:net, node:http, node:tls, node:url, node:module, node:string_decoder: stubs that throw a clear "not available on mobile" error when CALLED but can be imported (some are only reachable from modules the mobile core never mounts; find out which are reachable from routes/*.ts + app.ts-equivalent and make those work or prove them unreachable; util/paths.ts needs a mobile replacement - shims/paths.ts).
- Buffer and process globals (npm 'buffer' polyfill; a minimal process with env, platform 'android', nextTick, argv).
- sql.js: the browser build with a wasmBinary supplied by the host (shims/sqljs.ts exposing the same initSqlJs call shape the server uses in db/database.ts).
- pdfkit: a wrapper that makes the server's export/pdf.ts work in a worker - fonts arrive as bytes from the host (export/fonts.ts resolves font files by path and reads them with fs; decide with evidence whether pdfkit's standalone browser build + font Buffers is enough, and what the VFS must provide - write it down in notesForOthers for WP-5).

DO:
1. Dependencies (exact pins, devDependencies): @noble/hashes, @noble/ciphers, buffer, path-browserify (+ @types if needed). Nothing else without stating why.
2. shims/crypto.ts: a faithful subset of node:crypto. scrypt via @noble/hashes scryptAsync (must not block; same outputs), AES-256-GCM via @noble/ciphers (Cipheriv/Decipheriv facade that buffers update() and produces ciphertext + 16-byte tag exactly like Node; Decipher.final() throws on a bad tag), sha256, randomBytes/randomInt on crypto.getRandomValues (randomInt unbiased), timingSafeEqual constant-time (throws on length mismatch like Node). Return real Buffer instances (the polyfill) where Node returns Buffers.
3. Byte-compatibility suite (mobile/test/compat, run by npm run mobile:test under Node where BOTH node:crypto and the shim are available):
   - RFC 7914 scrypt test vectors through the shim.
   - shim scrypt === node:crypto scrypt for 60 passwords incl. empty-ish, long, NFKC-sensitive, Hebrew, Arabic, CJK, emoji, with the app's real parameters (N=2^15, r=8, p=1) and the app's own deriveSecret (server/src/security/kdf.ts) executed once with node:crypto and once with the shim (use the alias plugin or vi.mock to swap the module).
   - AES-GCM: random keys/nonces/AAD/plaintexts (sizes 0, 1, 15, 16, 17, 1 MB): shim-encrypt -> node-decrypt and node-encrypt -> shim-decrypt, tag failures, AAD mismatch.
   - Containers: scripts/mobile/make-fixtures.mjs runs the REAL server modules under Node (security/container.ts, backup/backup.ts, device-key wrap/unwrap for remember-me and recovery keys) and writes fixtures (a diary .mpd, a backup with the account password, a backup with a separate password; fictional data) to mobile/test/fixtures; tests open them through the shimmed modules byte-exactly, and the reverse (shim-made containers opened by node:crypto).
   - timingSafeEqual, randomInt range/bias sanity, sha256 vectors.
4. alias-plugin.ts: exported function used by mobile/vite.config.mobile.ts later (WP-5 wires it) and by vitest; unit-test the resolution rules (importer under server/src -> shim; importer under src/ or node_modules -> untouched).
5. A "core import probe": a test that bundles (vite build in lib mode to a temp dir, or esbuild if already available through vite) a tiny entry importing server/src/security/kdf.ts, security/container.ts, db/schema.ts and export/csv.ts with the alias plugin and asserts the output contains no unresolved 'node:' import and no require of a Node built-in. (The full-core bundle is WP-5.)
6. Performance note: measure shim scrypt time under Node for the real parameters (3 runs) and report it; the phone will be slower - say what the hash-wasm fallback would require.

GATES: root tsc, root vitest, vite build, check-no-network, npm run mobile:typecheck, npm run mobile:test, npm run mobile:build; server tsc + vitest unchanged (you do not edit server code). Desktop dist must still contain no '@capacitor' and none of the new shim code.

NOTES FROM STAGE 1:
- mobile tests that need Node's FormData/Response start with "// @vitest-environment node".
- MailService needs a transport: WP-5 passes a stub; never import server/src/mail/node-transport.ts or middleware/host-check.ts in the worker (the only modules with node:net/node:tls/node:os).
- check:all already runs mobile:typecheck and mobile:test.
