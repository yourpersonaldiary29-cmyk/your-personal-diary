/**
 * Downloads for the Windows app (a cross-origin client: Origin http://tauri.localhost) from the Your
 * Personal Diary server (docs/android-tasks/HOSTED-IMPL.md item 8). The published Windows app never sends
 * a disk path - the server is not on that computer and refuses one - it downloads the backup / export and
 * saves it itself. For that the browser must let it read two answer headers across origins:
 * Content-Disposition (the file name) and X-Entries-Exported (the entry count of an export).
 */
import { afterAll, describe, expect, it } from 'vitest';
import { cleanupTempDirs, makeTestApp, sampleEntry, testHostedOptions } from './helpers';

afterAll(cleanupTempDirs);

const HOST = 'diary.example';
const SHELL_ORIGIN = 'http://tauri.localhost';

/** The comma-separated header as a list of lower-case names. */
function exposed(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean);
}

describe('hosted mode: the Windows app downloads instead of sending a path', () => {
  it('an export download answers the count and exposes it (and the file name) to the shell origin', async () => {
    const app = await makeTestApp({ hosted: testHostedOptions() });
    expect((await app.post('/api/entries', sampleEntry()).set('Host', HOST)).status).toBe(201);
    const res = await app.post('/api/export', { format: 'txt', includeHabits: true }).set('Host', HOST).set('Origin', SHELL_ORIGIN);
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe(SHELL_ORIGIN);
    expect(res.headers['x-entries-exported']).toBe('1');
    expect(res.headers['content-disposition']).toMatch(/^attachment; filename=/);
    expect(exposed(res.headers['access-control-expose-headers'])).toEqual(expect.arrayContaining(['content-disposition', 'x-entries-exported']));
    // The preflight of the same request names them too (Max-Age: the browser caches it).
    const preflight = await app.anon().options('/api/export').set('Host', HOST).set('Origin', SHELL_ORIGIN);
    expect(preflight.status).toBe(204);
    expect(exposed(preflight.headers['access-control-expose-headers'])).toEqual(expect.arrayContaining(['content-disposition', 'x-entries-exported']));
  });

  it('a disk path is refused for export, backup and restore - what the old desktop flow sent', async () => {
    const app = await makeTestApp({ hosted: testHostedOptions() });
    const exportToPath = await app
      .post('/api/export', { format: 'txt', includeHabits: true, destPath: 'C:/Users/someone/Documents/export.txt' })
      .set('Host', HOST)
      .set('Origin', SHELL_ORIGIN);
    expect(exportToPath.status).toBe(400);
    expect(exportToPath.body).toMatchObject({ code: 'VALIDATION', field: 'destPath' });
    const backupToPath = await app.post('/api/backup/create', { destPath: 'C:/Users/someone/Documents/b.mpd' }).set('Host', HOST).set('Origin', SHELL_ORIGIN);
    expect(backupToPath.status).toBe(400);
    expect(backupToPath.body).toMatchObject({ code: 'VALIDATION', field: 'destPath' });
    const inspectPath = await app.post('/api/backup/inspect', { srcPath: 'C:/Users/someone/Documents/b.mpd' }).set('Host', HOST).set('Origin', SHELL_ORIGIN);
    expect(inspectPath.status).toBe(400);
    expect(inspectPath.body).toMatchObject({ code: 'VALIDATION', field: 'srcPath' });
  });
});

describe('local mode', () => {
  it('exposes the same two headers to the shell origin (the local developer build reads neither, nothing else changes)', async () => {
    const app = await makeTestApp();
    const res = await app.post('/api/export', { format: 'txt', includeHabits: true }).set('Origin', SHELL_ORIGIN);
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe(SHELL_ORIGIN);
    expect(exposed(res.headers['access-control-expose-headers'])).toEqual(['content-disposition', 'x-entries-exported']);
  });
});
