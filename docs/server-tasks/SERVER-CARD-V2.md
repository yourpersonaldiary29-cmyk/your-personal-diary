# Server card v2: publishing installer files and enlarging the disk from the app

Decisions of the main session, 2026-11-18. The owner asked (Hebrew, his words):

* Upload button, after being offered "if you want to upload files yourself, without my help, an upload button can
  be built in the Server card": "ולגבי הכפתור העלעת קבצים כן שימי לי כפתור" (2026-11-16).
* Disk: "ולגבי שינוי דיסק. יכולה לשים לי בבקשה גם אפשרות לשנות את זה בקרטיס שרת?" (2026-11-16). He was told that
  this needs a Fly.io key stored on the server - a key that, if the server were ever broken into, could be used to
  delete the disk with every diary or to run up his bill - and was offered (א) a double-click tool on his PC or (ב) a
  button in the Server card with limits: password every time, at most 100 GB, an e-mail on every change. He chose
  "לגבי הכפתור בקרטיס שרת של הגדלת הדיסק אפשרות ב." (2026-11-17). The main session also told him that it would try
  to limit the key so that it can only back up and enlarge the disk, not delete anything.

Both features are owner-only blocks of the Server card (`src/pages/settings/ServerSection.tsx`), hosted mode only.
The browser gets them with the next deploy; the Windows, Mac, Android and iPhone apps with their next installers.

## Part A - the Downloads page, managed from the Server card

### A1. Where the list lives

Two sources, merged by the hosted server at run time:

1. **The image** - what the release routine adds with `scripts/site/add-download.mjs` and the build stages into
   `ui/about/files/` (today the three files of 1.0.0). The staged tree must also carry the list itself in a
   machine-readable form the server can read (for example `ui/about/files/downloads.json`, or a file next to the
   bundle - decide, and keep `siteTreeProblems` / the staging tests right).
2. **The volume** - files the owner uploads in the Server card: `/data/site/files/<name>`, listed in
   `/data/site/downloads.json` (same row shape as `site/downloads.json`), and `/data/site/removed.json`: the rows the
   owner removed (platform, version, SHA-256). A removed image row is never shown again, also after later deploys.

The merged list of a platform = the image rows that were not removed + the volume rows, newest version first
(compare versions numerically, x.y.z); the same version in both: the volume row wins. File names follow the public
pattern of `add-download.mjs` (`YourPersonalDiary-<version>-windows-x64-setup.exe`, `-android.apk`,
`-mac-universal.dmg`); the server builds the name, the uploaded file's own name is ignored.

### A2. Serving

* `GET /about/files/<name>`: from the volume when the volume holds that name, otherwise from the image, with the same
  headers as today (content type, `no-cache`, ranges). A name that is in neither: 404.
* The 20 Downloads pages show the merged list. The builder marks, in each platform panel, the regions that depend on
  the list (the table rows, the checksum list, and an empty-state text) with HTML comments; the server replaces only
  what is between the markers, with the SAME markup and the SAME formatting the builder uses (size, date, relative
  link depth) - share the formatting code or prove equality in a test. Cache the rendered page per locale and drop
  the cache when the list changes. An empty platform shows a new content text, `downloads.empty` ("No installation
  file for this system yet."), translated in the 20 site languages.
* The static tree stays complete on its own (the builder renders the image list into it, as today), so every test
  and preview of the static site keeps working; the server's replacement is the only difference on the live site.

### A3. The owner's API (hosted only, owner only, HTTPS - like the other owner routes of `server-status.ts`)

* `GET /api/server/downloads` -> the merged list per platform (version, date, file, bytes, sha256, source
  `image` | `uploaded`) and the limits.
* `POST /api/server/downloads/upload-intent` `{ platform, version, password, removeOlder }` -> the password is
  checked exactly as the other password-confirmed actions check it (the same function, the same lockout); version
  `^\d+\.\d+\.\d+$`; platform one of windows / android / mac; the same platform and version already listed -> refused
  (remove it first). Answer: a one-time upload token, valid 15 minutes, bound to the session.
* `PUT /api/server/downloads/upload/<token>` with the file as the raw body (`application/octet-stream`), at most
  300 MB: streamed to a temporary file under `/data/site/tmp/` (never held in memory), SHA-256 computed while it
  streams; then checked - at least 1 MB; the platform's signature (windows: `MZ` and a `PE\0\0` header at the offset
  in `e_lfanew`; android: a ZIP whose central directory holds `AndroidManifest.xml` and `classes.dex`; mac: a UDIF
  disk image, `koly` at the start of the last 512 bytes); enough free disk for the file plus the server's low-disk
  margin - and only then renamed into `/data/site/files/` and added to the list (with `removeOlder`, the older rows
  of that platform are removed as in the next item). Any failure deletes the temporary file. One upload at a time;
  at most 10 per day.
* `POST /api/server/downloads/remove` `{ platform, version, password }` -> a volume row: its file is deleted and the
  row removed; an image row: recorded in `removed.json`.
* Every publish and every removal: one e-mail to the owner's own account address through the existing mail service
  (what happened, platform, version, file, size, SHA-256, time, and "if this was not you, change your password and
  remove the file in the Server card"), and one log line without personal data. When mail is not set up, the action
  still works and the card says that no e-mail was sent.
* Server archives: decide whether `/data/site/` goes into the server's archives (it is small and can be uploaded
  again from the owner's installers folder) and document it; the capacity estimate of the Server card is not changed.

### A4. In the Server card

* "Files on the Downloads page": per platform the rows (version, size, date, and whether it came with a server update
  or was uploaded), each with Remove (asks for the password).
* "Publish a new version": platform, version (filled in with the version of the app that is running), the file
  (`<input type="file">` accepting `.exe`, `.apk` or `.dmg` for the chosen platform), "Remove the older versions of
  this system" (ticked by default), password, Upload; a progress bar with the percentage (XMLHttpRequest upload
  progress), then the result. It must work in the browser, in the Windows and Mac apps and in the phone apps.

## Part B - enlarging the disk from the Server card

### B1. The key - created only by the owner

* A Fly.io **deploy token** for the app `yourpersonaldiary`, **attenuated** with macaroon caveats so that it can read
  the app, read and write the app's volumes - it has one - (extend, snapshots) and control its one machine (restart) -
  and can delete nothing. (Until 2026-11-22 the Volumes caveat named the one volume's id. Fly refused such a key with
  HTTP 403 for "list volumes" and "list snapshots" of that very volume - the Machines API names the volume by its id
  only for reading and extending it - so the setup script stopped at its first check and stored nothing. Checked on
  2026-11-22 with temporary deploy tokens, revoked since: with the empty id - every volume of the app - all reads
  pass, "extend to the same size" is refused as invalid (400) with `rw` and as unauthorized (403) with `r`, and
  "create snapshot" passes the key check - Fly answered 412 "an on-demand snapshot is pending for this volume",
  because the snapshot made ten minutes earlier (answer 200, with a token limited to the app with `rw` and no Volumes
  caveat) was still being made; a limit to the volume's internal number or to `*` is refused everywhere.) A last caveat `IfPresent` `{"ifs": [Commands [], Mutations {"mutations": []}], "else": "rwcC"}` refuses every
  command run in the machine (the Machines API exec) and every GraphQL change (an SSH login's certificate and
  WireGuard peer are GraphQL mutations): in `flyio/caveats.go` an empty Commands list or Mutations list allows none, and
  an operation that names neither falls to `else`. This last caveat follows Fly's published source; it is not tested
  against Fly itself (the checks send no exec and no mutation; with it in place every read, the extend check and the
  snapshot request still pass). Caveat shapes (superfly/macaroon: `flyio/caveats.go`, `resset/action.go`, `resset/if_present.go`,
  `flyio/examples/README.md`): a JSON list of `{ "type": ..., "body": ... }`; `Apps` `{"apps":{"<numeric app id>":"<mask>"}}`;
  `Volumes` `{"volumes":{"":"<mask>"}}` (the empty id is the zero id of a resource set: every volume - of the one app
  the token is limited to); `Machines` `{"machines":{"<machine id>":"<mask>"}}`;
  `IfPresent` `{"ifs": <caveat set>, "else": "<mask>"}` (applies a resource caveat only to operations that name that
  kind of resource - without it, an operation that names no volume fails a Volumes caveat). Mask letters: `r` read,
  `w` write, `c` create, `d` delete, `C` control (start, stop, restart). Which letters extend and snapshot need is not
  documented - on 2026-11-22 `rw` was enough for both, and the setup script gives the volumes no more: with the
  permission for every volume of the app, `c` could mean a new volume. Should Fly need another letter one day, the
  script stops at the refused check and says so - it does not widen the key by itself. The numeric app ID is
  the app's internal database ID: flyctl 0.5.12 does not show it in `flyctl apps list --json`, so the script reads it
  from the deploy token's own caveats (`flyctl tokens debug`, in memory only).
* Stored as the Fly secret `DIARY_FLY_API_TOKEN`. **Only the owner creates and stores it**, by running
  `scripts/hosted/set-disk-key.ps1` in his own PowerShell window: it creates the deploy token (named "Server card disk
  button", valid 5 years), attenuates it with the caveats, imports it with `flyctl secrets import` (staged, so that
  the next deploy applies it - or applied at once, with the restart said plainly), and never prints it, never writes
  it to a file, never puts it in a command line that is logged. Then it probes the stored token safely and says what
  it found: GET the volume -> must succeed; PUT extend with the CURRENT size -> must be refused as invalid, not as
  unauthorized (that proves the extend permission without changing anything); a snapshot may be created (harmless).
  It never sends a delete. If a probe says unauthorized, the script explains which permission is missing and stops.
* The main session never runs this script, never sees the token and never creates one.
* Without the secret, the Server card says what is missing and shows the one PowerShell line to run.

### B2. The server

* A new module (for example `server/src/hosted/fly-volume.ts`, hosted only) talks to the Fly Machines API with the
  token - only these calls: read the volume, list its snapshots, create a snapshot, extend the volume, restart this
  machine. App: `FLY_APP_NAME`; machine: `FLY_MACHINE_ID` (Fly sets both in every machine); volume: the one attached
  to this machine (or `DIARY_FLY_VOLUME_ID`). Endpoint: `https://api.machines.dev/v1` (or the private
  `http://_api.internal:4280` - choose one, say why). The `Authorization` header: a token that starts with `FlyV1 `
  is sent as it is; another token gets `Bearer `. Timeouts on every call; never retry a call that changes something.
* `scripts/check-no-network.mjs`: one new, narrow exception, like the DuckDNS and SMTP ones - only this module, only
  that host - with tests. Nothing in the tests talks to the internet: the Fly API is a fake.
* Routes (hosted only, owner only, HTTPS):
  * `GET /api/server/disk` -> `{ available, reason?, sizeGb, usedBytes, maxGb, pricePerGbMonth: 0.15, job, history }`.
  * `POST /api/server/disk/extend` `{ sizeGb, password }` -> 202 and a job: (1) a snapshot, waited for until it is
    created (at most an hour: Fly took about 14 minutes for the 50 GB production disk); (2) extend; (3) wait until the file system shows the new size (at most 2 minutes)
    -> done; or, when Fly answers that a restart is needed, the state `needs-restart`.
  * `POST /api/server/disk/restart` `{ password }` -> only in the state `needs-restart`: restart this machine.
* Rules: a whole number of GB, larger than now, at most `DIARY_DISK_MAX_GB` (default 100, read like the other hosted
  settings and tested in `hosted-config.test.ts`); one job at a time; at most 3 changes per day; the password every
  time (same check and lockout as elsewhere); an e-mail to the owner's account address after every change, done or
  failed (from, to, the new monthly cost of the disk, the time); log lines without personal data; the last 10 changes
  kept in `/data/disk-changes.json` (no personal data).

### B3. In the Server card

* "Disk size": the size now and how much is used; "New size (GB)" (from the size now + 1 to the maximum, whole
  numbers); the monthly cost of that size (0.15 $ per GB); the sentence "The disk can only grow; it cannot be made
  smaller again."; password; Enlarge. Then the steps as they happen (backup, enlarging, done), and that an e-mail was
  sent. In the state `needs-restart`: "Restart the server now" (password).
* Not set up: the reason, and the one PowerShell line of B1.

## Part C - common

* All new texts of the app in its catalogue (`shared/i18n/messages/en/settings.ts` first; the other 19 languages are
  translated afterwards by translators, with the same keys - the catalogue's parity tests must pass).
* Accessibility as in the rest of the app: labels, a live region for progress and results, focus after an action,
  the keyboard, screen readers.
* Documents: `docs/API.md`; `docs/HOSTED-RUNBOOK.he.md` (Hebrew, the runbook's style: the two blocks, the limits,
  the key, how to revoke it - `flyctl tokens list` / `flyctl tokens revoke` - and how to turn the disk button off by
  removing the secret); `docs/HANDOVER.he.md` (plain Hebrew for the owner: how to publish a new version file from the
  Server card, how to enlarge the disk, the one-time key setup, the risk in one sentence).
* Tests for everything above; the whole project's gates stay green.
