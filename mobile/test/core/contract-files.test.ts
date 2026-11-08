// @vitest-environment node
/**
 * Contract of the mobile core with the desktop server, part 3: the files - exports (TXT, CSV,
 * JSON, PDF as downloads) and backups (create as a download, inspect, restore from base64), and
 * the byte compatibility of the .mpd format end to end:
 *
 *   - a backup the desktop made (the fixture of scripts/mobile/make-fixtures.mjs) restored in the
 *     core and on the desktop gives the same diary;
 *   - a backup the core made is restored by the desktop server, and a desktop-made one by the core;
 *   - a core-made backup restored into a fresh core gives the same diary.
 *
 * "Save to a folder" requests (`destPath` / `srcPath`) are refused by the core with 400 - the
 * desktop-only behaviour is covered by boot.test.ts.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { BackupFileInfo, Entry, EntryPage, Habit, RestoreInfo } from '@shared/types';
import { fixtureBytes, loadManifest } from '../compat/fixtures';
import { bodyBytes, closeNative, containsAscii, DANA, entryInput, habitInput, PASSWORD, registerBoth, startContract, toBase64, type ContractRig } from './contract-rig';
import { bootTestCore, type CoreRig } from './helpers';

let rig: ContractRig;
const BACKUP_PASSWORD = 'Backup-Only-Passw0rd!';
const EXPORT_RANGE = { from: '2026-09-01', to: '2026-09-30' };

/** The entry pages of both sides (they agree; the ids may differ). */
async function pages(url = '/api/entries?limit=200'): Promise<{ core: EntryPage; desktop: EntryPage }> {
  const list = await rig.authed(url);
  return { core: list.core.json as EntryPage, desktop: list.desktop.json as EntryPage };
}

async function entriesOf(url = '/api/entries?limit=200'): Promise<EntryPage> {
  return (await pages(url)).core;
}

beforeAll(async () => {
  rig = await startContract();
  await registerBoth(rig, DANA, 'he');
  for (let n = 0; n < 6; n++) {
    const created = await rig.authed('/api/entries', { method: 'POST', body: entryInput(n) });
    expect(created.core.status, JSON.stringify(created.core.json)).toBe(201);
  }
  const walk = await rig.authed('/api/habits', { method: 'POST', body: habitInput('Walk', { target: 30, unit: 'minutes' }) });
  const read = await rig.authed('/api/habits', { method: 'POST', body: habitInput('קריאה', { frequency: 'weekly', target: 3 }) });
  for (const [answer, date, value] of [
    [walk, '2026-09-02', 40],
    [walk, '2026-09-03', 10],
    [read, '2026-09-04', 1],
  ] as const) {
    await rig.authed('/api/habits/logs', (side) => ({ method: 'PUT', body: { habitId: ((side.name === 'core' ? answer.core : answer.desktop).json as Habit).id, date, value } }));
  }
}, 120_000);

afterAll(async () => {
  await rig?.close();
  await closeNative();
});

describe('contract: export', () => {
  it('TXT, CSV and JSON downloads are the same bytes, with the same headers, in three languages', async () => {
    const headers = ['content-disposition', 'x-entries-exported', 'cache-control'];
    const txtHe = await rig.authed('/api/export', { method: 'POST', locale: 'he', body: { format: 'txt', ...EXPORT_RANGE, includeHabits: true } }, { headers });
    expect(txtHe.core.status, String(txtHe.core.body)).toBe(200);
    expect(txtHe.core.headers['content-type']).toMatch(/^text\/plain/);
    expect(txtHe.core.headers['content-disposition']).toContain('your-personal-diary-dana-2026-09-01_2026-09-30.txt');
    expect(txtHe.core.body).toContain('יום רגוע #0');
    await rig.authed('/api/export', { method: 'POST', locale: 'ar', body: { format: 'txt', ...EXPORT_RANGE } }, { headers });
    const csv = await rig.authed('/api/export', { method: 'POST', locale: 'en', body: { format: 'csv', ...EXPORT_RANGE, includeHabits: true } }, { headers });
    expect(csv.core.headers['content-type']).toMatch(/^text\/csv/);
    const json = await rig.authed('/api/export', { method: 'POST', locale: 'he', body: { format: 'json', includeHabits: true } }, { headers });
    expect(json.core.headers['content-type']).toMatch(/^application\/json/);
    expect(json.core.json).toBeDefined();
    const everything = await rig.authed('/api/export', { method: 'POST', locale: 'en', body: { format: 'txt' } }, { headers });
    expect(everything.core.headers['x-entries-exported']).toBe('6');
    const unknown = await rig.authed('/api/export', { method: 'POST', locale: 'he', body: { format: 'docx' } });
    expect(unknown.core.status).toBe(400);
    expect(unknown.core.json).toMatchObject({ code: 'VALIDATION', field: 'format' });
  }, 60_000);

  it('the PDF download starts with %PDF, embeds the bundled fonts and matches the desktop in size and headers', async () => {
    const pdf = await rig.authed(
      '/api/export',
      { method: 'POST', locale: 'he', body: { format: 'pdf', ...EXPORT_RANGE, includeHabits: true } },
      { headers: ['content-disposition', 'x-entries-exported'], body: 'skip' },
    );
    expect(pdf.core.status).toBe(200);
    expect(pdf.core.headers['content-type']).toBe('application/pdf');
    const core = bodyBytes(pdf.core);
    const desktop = bodyBytes(pdf.desktop);
    expect(new TextDecoder().decode(core.subarray(0, 5))).toBe('%PDF-');
    expect(new TextDecoder().decode(desktop.subarray(0, 5))).toBe('%PDF-');
    for (const font of ['DejaVuSans', 'NotoSansArabic']) {
      expect(containsAscii(core, font), `core PDF embeds ${font}`).toBe(true);
      expect(containsAscii(desktop, font), `desktop PDF embeds ${font}`).toBe(true);
    }
    expect(containsAscii(core, '%%EOF')).toBe(true);
    // Same content, same fonts: the sizes differ only by metadata (dates, ids).
    expect(Math.abs(core.byteLength - desktop.byteLength) / desktop.byteLength).toBeLessThan(0.02);
  }, 60_000);
});

describe('contract: backup', () => {
  let coreBackup: Uint8Array;
  let desktopBackup: Uint8Array;
  const headers = ['content-disposition', 'cache-control'];

  it('create (download) answers alike; a backup of either side is readable by the other', async () => {
    const own = await rig.authed('/api/backup/create', { method: 'POST', locale: 'he', body: { password: BACKUP_PASSWORD } }, { headers, body: 'skip' });
    expect(own.core.status, String(own.core.body)).toBe(200);
    expect(own.core.headers['content-type']).toBe('application/octet-stream');
    expect(own.core.headers['content-disposition']).toMatch(/^attachment; filename="your-personal-diary-backup-dana-\d{4}-\d{2}-\d{2}\.mpd"/);
    coreBackup = bodyBytes(own.core);
    desktopBackup = bodyBytes(own.desktop);
    expect(coreBackup.byteLength).toBeGreaterThan(1000);
    expect(Math.abs(coreBackup.byteLength - desktopBackup.byteLength)).toBeLessThan(4096);
    const withAccountPassword = await rig.authed('/api/backup/create', { method: 'POST', body: {} }, { headers, body: 'skip' });
    expect(withAccountPassword.core.status).toBe(200);

    // Inspect: each side reads its own file and the other side's file.
    const inspectOwn = await rig.authed('/api/backup/inspect', (side) => ({ method: 'POST', locale: 'he', body: { fileBase64: toBase64(side.name === 'core' ? coreBackup : desktopBackup), fileName: 'diary.mpd' } }), { volatile: ['sizeBytes'] });
    expect(inspectOwn.core.json as BackupFileInfo).toMatchObject({ valid: true });
    const inspectOther = await rig.authed('/api/backup/inspect', (side) => ({ method: 'POST', locale: 'en', body: { fileBase64: toBase64(side.name === 'core' ? desktopBackup : coreBackup), fileName: 'diary.mpd' } }), { volatile: ['sizeBytes'] });
    expect(inspectOther.core.json as BackupFileInfo).toMatchObject({ valid: true });
    const garbage = await rig.authed('/api/backup/inspect', { method: 'POST', locale: 'he', body: { fileBase64: toBase64(new TextEncoder().encode('not a backup at all')), fileName: 'x.mpd' } });
    expect(garbage.core.status).toBe(200);
    expect(garbage.core.json as BackupFileInfo).toMatchObject({ valid: false });
  }, 60_000);

  it('restore: a wrong password changes nothing; the other side\'s backup restores the same diary', async () => {
    const before = await pages();
    const wrong = await rig.authed('/api/backup/restore', (side) => ({ method: 'POST', locale: 'he', body: { fileBase64: toBase64(side.name === 'core' ? desktopBackup : coreBackup), fileName: 'diary.mpd', password: 'wrong-Passw0rd!' } }));
    expect(wrong.core.status).toBe(400);
    expect(wrong.core.json).toMatchObject({ code: 'WRONG_PASSWORD' });
    expect((await entriesOf()).items.length).toBe(before.core.items.length);

    // Change the diary on both sides, then restore the OTHER side's backup: both are back to the
    // backed-up diary - the core reads a desktop-made file and the desktop reads a core-made one.
    const removed = await rig.authed((side) => `/api/entries/${before[side.name].items[0].id}`, { method: 'DELETE' });
    expect(removed.core.status).toBe(204);
    expect((await entriesOf()).items.length).toBe(before.core.items.length - 1);
    const restored = await rig.authed('/api/backup/restore', (side) => ({ method: 'POST', locale: 'he', body: { fileBase64: toBase64(side.name === 'core' ? desktopBackup : coreBackup), fileName: 'diary.mpd', password: BACKUP_PASSWORD } }));
    expect(restored.core.status, JSON.stringify(restored.core.json)).toBe(200);
    expect(restored.core.json as RestoreInfo).toMatchObject({ entries: 6, habits: 2 });
    const after = await entriesOf();
    expect(after.items.map((e) => e.title)).toEqual(before.core.items.map((e) => e.title));
    await rig.authed('/api/habits/status?from=2026-09-01&to=2026-09-07');
    await rig.authed('/api/entries/day/2026-09-02');
    // The restored diary is in the storage (drain barrier) and survives a restart of the core.
    await rig.restartCore();
    expect((await entriesOf()).items.length).toBe(6);
  }, 90_000);

  it('a core-made backup restored into a fresh core gives the same diary; the core refuses disk paths', async () => {
    const fresh: CoreRig = await bootTestCore();
    try {
      const auth = await fresh.call('/api/auth/register', { method: 'POST', locale: 'he', body: { ...DANA, password: PASSWORD, confirmPassword: PASSWORD } });
      expect(auth.status).toBe(201);
      const token = (auth.json as { token: string }).token;
      const restored = await fresh.call('/api/backup/restore', { token, method: 'POST', body: { fileBase64: toBase64(coreBackup), fileName: 'diary.mpd', password: BACKUP_PASSWORD } });
      expect(restored.status, JSON.stringify(restored.json)).toBe(200);
      expect(restored.json as RestoreInfo).toMatchObject({ entries: 6, habits: 2 });
      const list = (await fresh.call('/api/entries?limit=200', { token })).json as EntryPage;
      expect(list.items.map((e) => [e.title, e.date, e.mood])).toEqual((await entriesOf()).items.map((e) => [e.title, e.date, e.mood]));
      const disk = await fresh.call('/api/backup/restore', { token, method: 'POST', locale: 'en', body: { srcPath: 'C:\\diary.mpd', password: BACKUP_PASSWORD } });
      expect(disk.status).toBe(400);
      expect(disk.json).toMatchObject({ code: 'VALIDATION', field: 'srcPath' });
    } finally {
      await fresh.shutdown();
    }
  }, 60_000);

  it('the desktop-made fixture (50 entries, 5 habits, three scripts) restores identically on both sides', async () => {
    const manifest = loadManifest();
    const fixture = new Uint8Array(fixtureBytes(manifest.files.backupOwnPassword));
    const inspected = await rig.authed('/api/backup/inspect', { method: 'POST', locale: 'he', body: { fileBase64: toBase64(fixture), fileName: 'fixture.mpd' } });
    expect(inspected.core.json as BackupFileInfo).toMatchObject({ valid: true, sizeBytes: fixture.byteLength });
    const restored = await rig.authed('/api/backup/restore', { method: 'POST', locale: 'he', body: { fileBase64: toBase64(fixture), fileName: 'fixture.mpd', password: manifest.backups.ownPassword.password } });
    expect(restored.core.status, JSON.stringify(restored.core.json)).toBe(200);
    expect(restored.core.json as RestoreInfo).toMatchObject({ entries: manifest.content.entries, habits: manifest.content.habits });
    const entries = await pages('/api/entries?limit=200&sortDesc=true');
    expect(entries.core.items).toHaveLength(manifest.content.entries);
    const lastOf = (page: EntryPage) => page.items.find((e) => e.title === manifest.content.lastEntry!.title)!;
    expect(lastOf(entries.core)).toBeDefined();
    const last = await rig.authed((side) => `/api/entries/${lastOf(entries[side.name]).id}`);
    expect((last.core.json as Entry).body).toBe(manifest.content.lastEntry!.body);
    expect((last.core.json as Entry).tags).toEqual(manifest.content.lastEntry!.tags);
    await rig.authed('/api/habits?includeArchived=true');
    await rig.authed('/api/stats?period=all', { locale: 'en' });
    await rig.authed('/api/insights?period=3m', { locale: 'he' });
    // Exports of the restored fixture agree byte for byte (TXT / CSV / JSON) - three scripts, emoji, RTL marks.
    const headers = ['content-disposition', 'x-entries-exported'];
    await rig.authed('/api/export', { method: 'POST', locale: 'he', body: { format: 'txt', includeHabits: true } }, { headers });
    await rig.authed('/api/export', { method: 'POST', locale: 'ar', body: { format: 'csv', includeHabits: true } }, { headers });
    await rig.authed('/api/export', { method: 'POST', locale: 'en', body: { format: 'json', includeHabits: true } }, { headers });
  }, 120_000);
});
