/**
 * scripts/hosted/set-disk-key.ps1 - what can be checked without Fly.io (docs/server-tasks/SERVER-CARD-V2.md B1):
 *   - the caveats it gives the key: a superfly/macaroon caveat set for the one app, its disks (never the id of one
 *     disk: Fly refused such a key on 2026-11-22) and the one machine - and no "d" (delete) or "*" anywhere; a
 *     mask with "d" is refused;
 *   - the checks of the limited key against a fake Fly: what stops them, and that a snapshot which is already
 *     being made counts as a passed snapshot check;
 *   - how it reads flyctl's JSON (the machine and its disk, the app's number) and Fly's answers;
 *   - the Authorization header rule, the token line of flyctl, and the hiding of tokens in flyctl's messages;
 *   - its own guard: only GET / POST / PUT to the app's volumes and machines - no delete, no restart;
 *   - -DryRun calls nothing (flyctl does not even exist here) and exits 0;
 *   - every key has its own name (the time it was made), and a stop after the deploy token exists says how to revoke it;
 *   - the source: ASCII only (Windows PowerShell 5.1 reads a file without a byte-order mark as ANSI), no
 *     delete, the token never on a command line, never shown, never in this process's environment.
 *
 *   node --test scripts/hosted/set-disk-key.test.mjs
 *
 * The PowerShell checks run on Windows only (powershell.exe); the source checks run everywhere. Nothing here
 * talks to the internet: the script is dot-sourced with -FunctionsOnly or run with -DryRun. Fictional ids only.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const script = path.join(here, 'set-disk-key.ps1');
const source = readFileSync(script, 'utf8');
const canRun = process.platform === 'win32';
const skip = !canRun && 'Windows PowerShell only';

/** A string as PowerShell code that yields it (base64, so no quoting can go wrong). */
const psString = (text) => `([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${Buffer.from(text, 'utf8').toString('base64')}')))`;

/** Dot-sources the script with -FunctionsOnly, then runs `body`; returns its standard output. */
function ps(body) {
  const command = `$ErrorActionPreference = 'Stop'; . '${script.replace(/'/g, "''")}' -FunctionsOnly; ${body}`;
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', command], { encoding: 'utf8', timeout: 120000 });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  return result.stdout.trim();
}

const VOLUME = 'vol_fictional0123';
const MACHINE = '0123456789abcd';

/** Every permission letter string of a caveat set. */
function masksOf(caveats) {
  const out = [];
  for (const caveat of caveats) {
    const body = caveat.body;
    if (caveat.type === 'IfPresent') {
      out.push(body.else, ...masksOf(body.ifs));
      continue;
    }
    for (const key of ['apps', 'volumes', 'machines']) if (body[key]) out.push(...Object.values(body[key]));
  }
  return out;
}

/** The last caveat: no command in the machine and no GraphQL change (empty lists allow none), anything else but d. */
const NO_COMMAND = {
  type: 'IfPresent',
  body: {
    ifs: [
      { type: 'Commands', body: [] },
      { type: 'Mutations', body: { mutations: [] } },
    ],
    else: 'rwcC',
  },
};

test('the caveats: the app, then the disks of the app and only this machine, everything else read only, no command - never a delete', { skip }, () => {
  const withAppText = ps(`New-DiskKeyCaveats -AppId '1234567' -MachineId '${MACHINE}' -VolumeMask 'rw'`);
  const withApp = JSON.parse(withAppText);
  assert.deepEqual(withApp, [
    { type: 'Apps', body: { apps: { 1234567: 'rwcC' } } },
    {
      type: 'IfPresent',
      body: {
        ifs: [
          // The empty id: every disk - of the one app the token is limited to. Fly's Machines API names the disk
          // by its own id only when it reads or enlarges it: a key limited to that id was refused (HTTP 403) for
          // "list the disks" and "list the snapshots" on 2026-11-22, and the owner's runs stopped at the first check.
          { type: 'Volumes', body: { volumes: { '': 'rw' } } },
          { type: 'Machines', body: { machines: { [MACHINE]: 'rC' } } },
        ],
        else: 'r',
      },
    },
    NO_COMMAND,
  ]);
  // Without the app's number: the two IfPresent caveats alone (the deploy token itself is limited to the app).
  const withoutApp = JSON.parse(ps(`New-DiskKeyCaveats -MachineId '${MACHINE}' -VolumeMask 'rw'`));
  assert.equal(Array.isArray(withoutApp), true);
  assert.deepEqual(withoutApp.map((c) => c.type), ['IfPresent', 'IfPresent']);
  assert.deepEqual(withoutApp[0].body.ifs[0], { type: 'Volumes', body: { volumes: { '': 'rw' } } });
  assert.deepEqual(withoutApp[1], NO_COMMAND);
  // No disk id anywhere in the caveats, and the function takes none any more: an old call fails, it is not ignored.
  assert.equal(withAppText.includes('vol_'), false);
  assert.equal(ps(`try { [void](New-DiskKeyCaveats -VolumeId '${VOLUME}' -MachineId '${MACHINE}' -VolumeMask 'rw'); 'given' } catch { 'refused' }`), 'refused');
  for (const caveats of [withApp, withoutApp]) {
    const masks = masksOf(caveats);
    assert.ok(masks.length >= 3);
    for (const mask of masks) assert.match(mask, /^[rwcC]+$/, `mask ${mask}`);
  }
  // Every mask the script may ever use, and a refusal for d and *.
  assert.deepEqual(
    JSON.parse(ps('ConvertTo-Json -Compress -InputObject @($VolumeMasks + @($AppMask, $MachineMask, $ElseMask, $NoCommandElseMask))')),
    // The disks get read and write only - never c: with the permission for every disk of the app, "create" could
    // mean a new disk. The script does not widen the key by itself when Fly refuses a check.
    ['rw', 'rwcC', 'rC', 'r', 'rwcC'],
  );
  const refused = ps(
    ["'rwd'", "'d'", "'*'", "'rwcdC'", "'R'", "''"]
      .map((mask) => `try { [void](New-DiskKeyCaveats -MachineId '${MACHINE}' -VolumeMask ${mask}); 'given' } catch { 'refused' }`)
      .join('; '),
  );
  assert.deepEqual(refused.split(/\r?\n/), ['refused', 'refused', 'refused', 'refused', 'refused', 'refused']);
  // Ids that could change the meaning of the caveats are refused too.
  const badIds = ps(
    ["-MachineId 'm/1'", "-MachineId '../m'", `-AppId '12a' -MachineId '${MACHINE}'`]
      .map((args) => `try { [void](New-DiskKeyCaveats ${args} -VolumeMask 'rw'); 'given' } catch { 'refused' }`)
      .join('; '),
  );
  assert.deepEqual(badIds.split(/\r?\n/), ['refused', 'refused', 'refused']);
});

test("reading flyctl: the one machine, the disk attached to it, the app's number", { skip }, () => {
  const machines = JSON.stringify([
    { id: MACHINE, name: 'fictional-sun-1', state: 'started', region: 'fra', config: { mounts: [{ volume: VOLUME, path: '/data' }] } },
    { id: '9999aaaa0000bb', state: 'destroyed' },
  ]);
  const volumes = JSON.stringify([
    { id: 'vol_otherdisk99', name: 'old_data', state: 'created', size_gb: 3, attached_machine_id: null },
    { id: VOLUME, name: 'diary_data', state: 'created', size_gb: 50, attached_machine_id: MACHINE },
  ]);
  assert.deepEqual(JSON.parse(ps(`Find-DiskTarget -MachinesJson ${psString(machines)} -VolumesJson ${psString(volumes)} | ConvertTo-Json -Compress`)), {
    MachineId: MACHINE,
    VolumeId: VOLUME,
    SizeGb: 50,
  });
  // Without attached_machine_id: the disk the machine mounts.
  const unattached = JSON.stringify([{ id: VOLUME, state: 'created', size_gb: 20, attached_machine_id: null }]);
  assert.equal(JSON.parse(ps(`Find-DiskTarget -MachinesJson ${psString(machines)} -VolumesJson ${psString(unattached)} | ConvertTo-Json -Compress`)).VolumeId, VOLUME);
  // Two machines, or no disk: the script stops with the reason.
  const two = JSON.stringify([
    { id: MACHINE, state: 'started' },
    { id: 'aaaa0000bbbb11', state: 'started' },
  ]);
  assert.match(ps(`try { Find-DiskTarget -MachinesJson ${psString(two)} -VolumesJson ${psString(volumes)} } catch { $_.Exception.Message }`), /exactly one machine, Fly lists 2/);
  assert.match(ps(`try { Find-DiskTarget -MachinesJson ${psString(JSON.stringify([{ id: MACHINE, state: 'started' }]))} -VolumesJson '[]' } catch { $_.Exception.Message }`), /exactly one disk attached, Fly lists 0/);

  const apps = JSON.stringify([
    { ID: 'other-app', Name: 'other-app', InternalNumericID: 99 },
    { ID: 'diary-test-app', Name: 'diary-test-app', InternalNumericID: 1234567 },
  ]);
  assert.equal(ps(`Find-AppNumericId -AppsJson ${psString(apps)} -App 'diary-test-app'`), '1234567');
  const noNumber = JSON.stringify([{ Name: 'diary-test-app', InternalNumericID: 0 }]);
  const debug = '[{"location":"https://api.fly.io/v1","caveats":[{"type":"Organization","body":{"id":424242,"mask":"rwcdC"}},{"type":"Apps","body":{"apps": {\n  "7654321": "rwcdC"\n}}}]}]';
  assert.equal(ps(`Find-AppNumericId -AppsJson ${psString(noNumber)} -App 'diary-test-app' -TokenDebugText ${psString(debug)}`), '7654321');
  assert.equal(ps(`Find-AppNumericId -AppsJson ${psString(noNumber)} -App 'diary-test-app'`), '');
  const twoApps = '{"apps":{"111":"r"}} {"apps":{"222":"r"}}';
  assert.equal(ps(`Find-AppNumericId -App 'diary-test-app' -TokenDebugText ${psString(twoApps)}`), '');
});

test("reading Fly's answers, the token line of flyctl, the Authorization header, hiding tokens", { skip }, () => {
  const answers = [
    [200, ''],
    [201, ''],
    [401, ''],
    [403, ''],
    [404, ''],
    [422, '{"error":"size_gb must be greater than 50"}'],
    [400, '{"error":"unauthorized for action"}'],
    [409, ''],
    [500, ''],
    [0, ''],
  ];
  const verdicts = ps(answers.map(([status, body]) => `Get-ProbeVerdict ${status} ${psString(body)}`).join('; '));
  assert.deepEqual(verdicts.split(/\r?\n/), ['ok', 'ok', 'unauthorized', 'unauthorized', 'not-found', 'invalid', 'unauthorized', 'invalid', 'server-error', 'unreachable']);
  assert.deepEqual(ps("Get-FlyAuthorization 'FlyV1 fm2_abc,fm2_def'; Get-FlyAuthorization ' fo1_plain '").split(/\r?\n/), ['FlyV1 fm2_abc,fm2_def', 'Bearer fo1_plain']);
  assert.deepEqual(
    ps(`Find-TokenLine ${psString('some notice\nFlyV1 fm2_abc,fm2_def\n')}; Find-TokenLine ${psString('fm2_bare==\r\n')}; if ($null -eq (Find-TokenLine 'Error: not signed in')) { 'none' }`).split(/\r?\n/),
    ['FlyV1 fm2_abc,fm2_def', 'FlyV1 fm2_bare==', 'none'],
  );
  assert.equal(ps(`Protect-Text ${psString('Error: bad token FlyV1 fm2_abc+/=,fm2_def here; also fo1_xyz and my-secret-value')} @('my-secret-value')`), 'Error: bad token FlyV1 <hidden> here; also <hidden> and <hidden>');
});

test('its own guard: only GET, POST and PUT to the volumes and machines of the app - never a delete, never a restart', { skip }, () => {
  const tries = [
    ['DELETE', `/apps/diary-test-app/volumes/${VOLUME}`],
    ['delete', `/apps/diary-test-app/volumes/${VOLUME}`],
    ['PATCH', `/apps/diary-test-app/volumes/${VOLUME}`],
    ['POST', `/apps/diary-test-app/machines/${MACHINE}/restart`],
    ['POST', `/apps/diary-test-app/machines/${MACHINE}/stop`],
    ['GET', '/apps/diary-test-app/secrets'],
    ['GET', '/orgs/personal'],
    // No update of the machine or the disk, nothing created but a snapshot, no check with the wrong method.
    ['POST', `/apps/diary-test-app/machines/${MACHINE}`],
    ['PUT', `/apps/diary-test-app/volumes/${VOLUME}`],
    ['POST', '/apps/diary-test-app/volumes'],
    ['POST', '/apps/diary-test-app/machines'],
    ['POST', `/apps/diary-test-app/volumes/${VOLUME}/extend`],
    ['PUT', `/apps/diary-test-app/volumes/${VOLUME}/snapshots`],
    ['GET', `/apps/diary-test-app/volumes/${VOLUME}/extend`],
    ['GET', '/apps/diary-test-app/machines'],
  ];
  // The guard is bound to this run's app: the checks below are made for 'diary-test-app'.
  tries.push(['GET', '/apps/other-app/volumes'], ['PUT', `/apps/other-app/volumes/${VOLUME}/extend`], ['POST', `/apps/other-app/volumes/${VOLUME}/snapshots`]);
  const forApp = "$App = 'diary-test-app'";
  const out = ps(`${forApp}; ${tries.map(([method, p]) => `try { [void](Invoke-FlyApi -Method '${method}' -Path '${p}' -Token 'FlyV1 fm2_fictional'); 'sent' } catch { 'refused' }`).join('; ')}`);
  assert.deepEqual(out.split(/\r?\n/), tries.map(() => 'refused'));
  // Exactly the six requests of the checks pass the guard (asked of the guard alone - nothing is sent).
  const checks = [
    ['GET', '/apps/diary-test-app/volumes'],
    ['GET', `/apps/diary-test-app/volumes/${VOLUME}`],
    ['GET', `/apps/diary-test-app/volumes/${VOLUME}/snapshots`],
    ['GET', `/apps/diary-test-app/machines/${MACHINE}`],
    ['PUT', `/apps/diary-test-app/volumes/${VOLUME}/extend`],
    ['POST', `/apps/diary-test-app/volumes/${VOLUME}/snapshots`],
  ];
  const allowed = ps(`${forApp}; ${[...checks, ...tries].map(([method, p]) => `if (Test-CheckRequest '${method}' '${p}') { 'yes' } else { 'no' }`).join('; ')}`);
  assert.deepEqual(allowed.split(/\r?\n/), [...checks.map(() => 'yes'), ...tries.map(() => 'no')]);
  // "Exactly" means to the very end: one newline after a check's path is refused too (a .NET $ would allow it).
  const newline = ps(`${forApp}; ${checks.map(([method, p]) => `if (Test-CheckRequest '${method}' "${p}\`n") { 'yes' } else { 'no' }`).join('; ')}`);
  assert.deepEqual(newline.split(/\r?\n/), checks.map(() => 'no'));
  // The extend check carries nothing but {"size_gb":<n>}, the others no body at all - refused before anything is sent.
  const bodies = [
    ['PUT', `/apps/diary-test-app/volumes/${VOLUME}/extend`, '{"size_gb":5000000}'],
    ['PUT', `/apps/diary-test-app/volumes/${VOLUME}/extend`, '{"size_gb":50,"x":1}'],
    ['PUT', `/apps/diary-test-app/volumes/${VOLUME}/extend`, ''],
    ['POST', `/apps/diary-test-app/volumes/${VOLUME}/snapshots`, '{"x":1}'],
    ['GET', '/apps/diary-test-app/volumes', '{"x":1}'],
  ];
  const sent = ps(`${forApp}; ${bodies.map(([method, p, body]) => `try { [void](Invoke-FlyApi -Method '${method}' -Path '${p}' -Token 'FlyV1 fm2_fictional' -Body ${psString(body)}); 'sent' } catch { 'refused' }`).join('; ')}`);
  assert.deepEqual(sent.split(/\r?\n/), bodies.map(() => 'refused'));
});

test("the checks of the limited key against a fake Fly: what stops them, and a snapshot that is already being made (Fly's answers of 2026-11-22)", { skip }, () => {
  const APP = 'diary-test-app';
  const DISK = `/apps/${APP}/volumes/${VOLUME}`;
  const UNAUTHORIZED = [403, '{"error":"unauthorized"}'];
  // What Fly answers to "make a snapshot" while the snapshot before it is still being made (word for word).
  const PENDING = [412, '{"error":"failed_precondition: An on-demand snapshot is pending for this volume. Retry the snapshot request after it finishes."}'];
  const cases = [
    ['every check passes', {}],
    ['the list of the disks is refused', { [`GET /apps/${APP}/volumes`]: UNAUTHORIZED }],
    ['the list of the snapshots is refused', { [`GET ${DISK}/snapshots`]: UNAUTHORIZED }],
    ['enlarging is refused', { [`PUT ${DISK}/extend`]: UNAUTHORIZED }],
    ['Fly accepts the same size', { [`PUT ${DISK}/extend`]: [200, '{"needs_restart":false}'] }],
    ['a snapshot is already being made', { [`POST ${DISK}/snapshots`]: PENDING }],
    ['412 for another reason', { [`POST ${DISK}/snapshots`]: [412, '{"error":"failed_precondition: the volume is not attached"}'] }],
    ['the snapshot is refused', { [`POST ${DISK}/snapshots`]: UNAUTHORIZED }],
    ['a pending text with another status', { [`POST ${DISK}/snapshots`]: [409, PENDING[1]] }],
  ];
  const answer = ([status, body]) => `[pscustomobject]@{ Status = ${status}; Body = ${psString(body)} }`;
  const table = (overrides) => `@{ ${Object.entries(overrides).map(([request, a]) => `'${request}' = ${answer(a)}`).join('; ')} }`;
  // The fake Fly: it records every request and answers from a table; the disk reports 50 GB, and "enlarge to 50"
  // is refused as invalid - as the real one does - unless a case says otherwise.
  const fake = [
    '$script:Calls = New-Object System.Collections.ArrayList',
    '$script:Canned = @{}',
    "function Invoke-FlyApi { param([string]$Method, [string]$Path, [string]$Token, [string]$Body = '') [void]$script:Calls.Add((\"$Method $Path $Body\").Trim()); $request = \"$Method $Path\"; if ($script:Canned.ContainsKey($request)) { return $script:Canned[$request] }; return [pscustomobject]@{ Status = 200; Body = '[]' } }",
    `function Invoke-Case($Overrides) { $script:Calls.Clear(); $script:Canned = @{ 'GET ${DISK}' = ${answer([200, `{"id":"${VOLUME}","size_gb":50}`])}; 'PUT ${DISK}/extend' = ${answer([400, '{"error":"Invalid volume size - Specified volume size must be greater than 50"}'])} }; foreach ($request in $Overrides.Keys) { $script:Canned[$request] = $Overrides[$request] }; $result = Test-DiskKey -Token 'FlyV1 fm2_fictional' -App '${APP}' -Target ([pscustomobject]@{ MachineId = '${MACHINE}'; VolumeId = '${VOLUME}'; SizeGb = 50 }); return [pscustomobject]@{ Result = $result; Calls = @($script:Calls.ToArray()) } }`,
  ].join('; ');
  const results = JSON.parse(ps(`${fake}; ConvertTo-Json -Compress -Depth 6 -InputObject @(${cases.map(([, overrides]) => `(Invoke-Case ${table(overrides)})`).join(', ')})`));
  const by = Object.fromEntries(cases.map(([name], i) => [name, results[i]]));
  const all = [`GET /apps/${APP}/volumes`, `GET ${DISK}`, `GET ${DISK}/snapshots`, `GET /apps/${APP}/machines/${MACHINE}`, `PUT ${DISK}/extend {"size_gb":50}`, `POST ${DISK}/snapshots`];

  // The six requests, in this order, and nothing else; the "enlarge" check carries the size the disk already has.
  assert.deepEqual(by['every check passes'].Calls, all);
  assert.deepEqual(by['every check passes'].Result, { Ok: true, Step: '', Verdict: 'ok', Status: 200, SameSizeAccepted: false, SnapshotPending: false });
  // What stopped the owner's runs of 2026-11-19: the very first check - and nothing is asked after a refusal.
  assert.deepEqual(by['the list of the disks is refused'], { Result: { Ok: false, Step: 'list-disks', Verdict: 'unauthorized', Status: 403 }, Calls: all.slice(0, 1) });
  assert.deepEqual(by['the list of the snapshots is refused'], { Result: { Ok: false, Step: 'list-snapshots', Verdict: 'unauthorized', Status: 403 }, Calls: all.slice(0, 3) });
  assert.deepEqual(by['enlarging is refused'], { Result: { Ok: false, Step: 'extend', Verdict: 'unauthorized', Status: 403 }, Calls: all.slice(0, 5) });
  assert.equal(by['Fly accepts the same size'].Result.Ok, true);
  assert.equal(by['Fly accepts the same size'].Result.SameSizeAccepted, true);
  // A snapshot that is already being made: Fly accepted the key and makes no second one - the check passes, and says so.
  assert.deepEqual(by['a snapshot is already being made'], { Result: { Ok: true, Step: '', Verdict: 'ok', Status: 412, SameSizeAccepted: false, SnapshotPending: true }, Calls: all });
  // Nothing else counts as that: not a 412 for another reason, not the same words with another status, not a refusal.
  assert.deepEqual(by['412 for another reason'].Result, { Ok: false, Step: 'snapshot', Verdict: 'invalid', Status: 412 });
  assert.deepEqual(by['a pending text with another status'].Result, { Ok: false, Step: 'snapshot', Verdict: 'invalid', Status: 409 });
  assert.deepEqual(by['the snapshot is refused'].Result, { Ok: false, Step: 'snapshot', Verdict: 'unauthorized', Status: 403 });
  assert.deepEqual(
    ps(`Test-SnapshotPending 412 ${psString(PENDING[1])}; Test-SnapshotPending 412 ''; Test-SnapshotPending 200 ${psString(PENDING[1])}; Test-SnapshotPending 403 ${psString(PENDING[1])}`).split(/\r?\n/),
    ['True', 'False', 'False', 'False'],
  );
  // The run tells the owner which of the two happened, and that the button needs the backup copy to finish first.
  assert.match(source, /if \(\$snapshotPending\) \{ Say 'A backup copy \(snapshot\) of the disk is being made at Fly right now, so the check started no second one/);
  assert.match(source, /Say 'Before you use the button for the first time, wait about 20 minutes: the backup copy of the check is still being made/);
});

test('-DryRun prints the plan, calls nothing and exits 0 (flyctl does not exist here)', { skip }, () => {
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script, '-DryRun', '-FlyctlPath', 'C:\\does-not-exist\\flyctl.exe'], { encoding: 'utf8', timeout: 120000 });
  const out = `${result.stdout}\n${result.stderr}`;
  assert.equal(result.status, 0, out);
  assert.match(out, /DRY RUN/);
  // Every run's key has its own name: the time it was made, so the owner can tell the keys apart when revoking.
  assert.match(out, /tokens create deploy --app yourpersonaldiary --name "Server card disk button \d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC" --expiry 43800h/);
  assert.match(out, /tokens attenuate --file/);
  assert.match(out, /IfPresent \[Volumes <every disk of the app> 'rw', Machines <machine id> 'rC'\], else 'r'/);
  assert.doesNotMatch(out, /if Fly needs it/);
  assert.match(out, /PUT \.\.\.\/extend with the size the disk already has/);
  assert.match(out, /Never a delete/);
  assert.match(out, /secrets import --app yourpersonaldiary \[--stage\]/);
  assert.match(out, /DIARY_FLY_API_TOKEN=<hidden>/);
  assert.match(out, /nothing was called/);
  assert.doesNotMatch(out, /STOPPED/);
});

test('a stop after the deploy token was made names that token and how to revoke it', { skip }, () => {
  const name = 'Server card disk button 2026-11-18 14:03 UTC';
  const command = `. '${script.replace(/'/g, "''")}' -FunctionsOnly; $script:MadeToken = '${name}'; Stop-Setup 'a fictional reason'`;
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', command], { encoding: 'utf8', timeout: 120000 });
  const out = `${result.stdout}\n${result.stderr}`;
  assert.equal(result.status, 1, out);
  assert.match(out, /STOPPED: a fictional reason/);
  assert.ok(
    out
      .replace(/\s+/g, ' ')
      .includes(`The deploy token '${name}' may already exist at Fly and is stored nowhere. If flyctl tokens list --app yourpersonaldiary shows it, remove it: flyctl tokens revoke <its ID>.`),
    out,
  );
});

test('a run that ends some other way after the deploy token was made (an unexpected error, Ctrl+C) still names it, once', { skip }, () => {
  const name = 'Server card disk button 2026-11-18 14:03 UTC';
  const advice = `The deploy token '${name}' may already exist at Fly. Unless this window said 'Done', remove it if flyctl tokens list --app yourpersonaldiary shows it: flyctl tokens revoke <its ID>.`;
  // Ctrl+C: only the finally block runs - its advice once, however often it is reached.
  // (The host wraps the redirected line at the console width: compared with the white space folded.)
  const once = ps(`$script:MadeToken = '${name}'; Write-StopAdvice 6>&1; Write-StopAdvice 6>&1`).replace(/\s+/g, ' ');
  assert.equal(once.split(advice).length - 1, 1, once);
  // No token made yet: nothing to say.
  assert.equal(ps("$script:MadeToken = ''; Write-StopAdvice 6>&1; 'end'"), 'end');
  // Stopped while flyctl stores the key (flyctl goes on): it may be stored and in use - run again, not revoke now.
  const storing = ps(`$script:MadeToken = '${name}'; $script:Storing = $true; Write-StopAdvice 6>&1; Write-StopAdvice 6>&1`).replace(/\s+/g, ' ');
  assert.equal(storing.split('STOPPED while the key was being stored: it may or may not be stored now. Run this script again to the end').length - 1, 1, storing);
  assert.ok(storing.includes(`(this one is '${name}')`), storing);
  assert.doesNotMatch(storing, /remove it if/);
  // After Stop-Setup has named the token, the finally block adds nothing.
  const command = `. '${script.replace(/'/g, "''")}' -FunctionsOnly; $script:MadeToken = '${name}'; try { Stop-Setup 'a fictional reason' } finally { Write-StopAdvice }`;
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', command], { encoding: 'utf8', timeout: 120000 });
  const out = `${result.stdout}\n${result.stderr}`;
  assert.equal(result.status, 1, out);
  assert.match(out.replace(/\s+/g, ' '), /stored nowhere\. If flyctl tokens list/);
  assert.doesNotMatch(out, /STOPPED before the end/);
  // In the script, everything from the deploy token to the stored key runs in that try / catch / finally.
  const code = source.replace(/<#[\s\S]*?#>/g, '');
  const tryAt = code.search(/\ntry \{\r?\n/);
  const catchAt = code.indexOf('\n} catch {', tryAt);
  const finallyAt = code.indexOf('\n} finally {', catchAt);
  assert.ok(tryAt > 0 && tryAt < code.indexOf('Invoke-Flyctl -Arguments "tokens create deploy') && catchAt > code.indexOf('secrets import failed') && finallyAt > catchAt, 'the try covers steps 2 to 5');
  assert.match(code.slice(catchAt, finallyAt), /Protect-Text \$_\.Exception\.Message @\(\$deployToken, \$candidate, \$finalToken\)[\s\S]*Stop-Setup "an unexpected error: \$unexpected"/);
  assert.match(code.slice(finallyAt, finallyAt + 80), /if \(-not \$finished\) \{ Write-StopAdvice \}/);
});

test('the source: ASCII only, a header, no delete, the token never on a command line, on the screen, in a file or in this process', () => {
  assert.match(source, /^<#\r?\n\.SYNOPSIS\r?\n/);
  // Windows PowerShell 5.1 reads a script without a byte-order mark as ANSI: only ASCII then.
  assert.equal(/[^\x00-\x7f]/.test(source), false);
  const code = source
    .replace(/<#[\s\S]*?#>/g, '')
    .split(/\r?\n/)
    .filter((line) => !/^\s*#/.test(line));
  const text = code.join('\n');
  // No delete of any kind is sent: not by the checks, not through flyctl.
  assert.doesNotMatch(text, /-Method\s+['"]?Delete|HttpMethod\]::Delete|'DELETE'\s*\)/i);
  for (const line of code.filter((l) => /Invoke-Flyctl\s+-Arguments/.test(l))) {
    assert.doesNotMatch(line, /revoke|unset|destroy|delete|remove|restart|--access-token|\s-t\s/i, line);
  }
  // The token variables never reach the screen, a file or a command line; FLY_API_TOKEN only in the child's environment.
  const secretVar = /\$(deployToken|candidate|finalToken|Token|DeployToken)\b/;
  for (const line of code) {
    if (/\b(Say|Write-Host|Write-Output|Write-Verbose|Out-File|Set-Content|Add-Content|Stop-Setup)\b/.test(line)) assert.doesNotMatch(line, secretVar, line);
    // The command line of flyctl: the text after -Arguments (a quoted string or one variable).
    const args = /-Arguments\s+("[^"]*"|'[^']*'|\$\w+)/.exec(line);
    if (args) assert.doesNotMatch(args[1], secretVar, line);
  }
  assert.doesNotMatch(text, /\$env:FLY_API_TOKEN\s*=/);
  assert.match(text, /\$psi\.EnvironmentVariables\['FLY_API_TOKEN'\] = \$Token/);
  // The key is stored through standard input only.
  assert.match(text, /-StdinText \("DIARY_FLY_API_TOKEN=\$finalToken`n"\)/);
  // The one endpoint of the checks is the server's.
  assert.match(text, /\$ApiBase = 'https:\/\/api\.machines\.dev\/v1'/);
  // Every key is named with the time it was made, and every stop after the deploy token exists names it.
  assert.match(text, /\$TokenName = "\$TokenPrefix \$\(\[DateTime\]::UtcNow\.ToString\('yyyy-MM-dd HH:mm'/);
  // ... named just BEFORE flyctl is asked to make it: a Ctrl+C does not stop flyctl, so the token may exist from then on.
  const made = text.indexOf('$script:MadeToken = $TokenName');
  assert.ok(made > text.indexOf('Creating the deploy token') && made < text.indexOf('Invoke-Flyctl -Arguments "tokens create deploy'), 'right before the deploy token is made');
  assert.equal(text.split('$script:MadeToken = $TokenName').length - 1, 1);
  // ... and while flyctl stores the key, a stop says it may be stored (run again), not "revoke it".
  const storing = text.indexOf('$script:Storing = $true');
  const importAt = text.indexOf('Invoke-Flyctl -Arguments $importArguments');
  assert.ok(storing > 0 && storing < importAt && text.indexOf('$script:Storing = $false', importAt) > importAt, 'the flag covers the import');
});
