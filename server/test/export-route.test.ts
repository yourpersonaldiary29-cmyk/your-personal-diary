import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ExportResult } from '@shared/types';
import { APP_NAME } from '@shared/constants';
import { seedHebrewEntries, seedWalkingHabit } from './export-fixtures.test';
import { cleanupTempDirs, makeTestApp, tempDataDir, type TestApp } from './helpers';

const HEBREW = /[֐-׿]/;

/** superagent parser that keeps the raw bytes (for application/pdf). */
function binaryParser(res: unknown, cb: (err: Error | null, body: Buffer) => void): void {
  const stream = res as NodeJS.ReadableStream;
  const chunks: Buffer[] = [];
  stream.on('data', (c: Buffer) => chunks.push(c));
  stream.on('end', () => cb(null, Buffer.concat(chunks)));
}

describe('POST /api/export', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await makeTestApp();
    seedHebrewEntries(t.db);
    seedWalkingHabit(t.db);
  });
  afterAll(() => {
    t.db.close();
    cleanupTempDirs();
  });

  it('downloads a TXT file with UTF-8 content type and an RFC 5987 file name', async () => {
    const res = await t.post('/api/export', { format: 'txt' });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/plain');
    expect(res.headers['content-type'].toLowerCase()).toContain('charset=utf-8');
    const cd = res.headers['content-disposition'];
    expect(cd).toMatch(/^attachment; filename="your-personal-diary-tester-2026-09-05_\d{4}-\d{2}-\d{2}\.txt"; filename\*=UTF-8''your-personal-diary-tester-2026-09-05_\d{4}-\d{2}-\d{2}\.txt$/);
    expect(res.headers['x-entries-exported']).toBe('4');
    expect(res.headers['cache-control']).toBe('no-store');
    expect(Number(res.headers['content-length'])).toBe(Buffer.byteLength(res.text, 'utf8'));
    expect(res.text).toContain(APP_NAME);
    expect(res.text).toContain('כותרת: יום רגיל');
    expect(res.text).toContain('מצב רוח: 7/10');
  });

  it('downloads a CSV file that starts with a BOM', async () => {
    const res = await t.post('/api/export', { format: 'csv', includeHabits: true });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('.csv');
    expect(res.text.charCodeAt(0)).toBe(0xfeff);
    expect(res.text.slice(1).startsWith('תאריך,שעה,כותרת,')).toBe(true);
    expect(res.text.split('\r\n').filter(Boolean)).toHaveLength(5);
  });

  it('downloads JSON with the user and the entries in the requested range', async () => {
    const res = await t.post('/api/export', { format: 'json', from: '2026-09-06', to: '2026-09-06', includeHabits: true });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/json');
    expect(res.headers['content-disposition']).toContain("filename*=UTF-8''your-personal-diary-tester-2026-09-06_2026-09-06.json");
    expect(res.body.app).toBe(APP_NAME);
    expect(res.body.user).toEqual({ username: 'tester', firstName: 'דנה', lastName: 'כהן' });
    expect(res.body.entries).toHaveLength(2);
    expect(res.body.habits).toHaveLength(1);
    expect(res.body.habitLogs).toHaveLength(1);
  });

  it('downloads a PDF as binary', async () => {
    const res = await t.post('/api/export', { format: 'pdf' }).buffer(true).parse(binaryParser);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toMatch(/filename\*=UTF-8''your-personal-diary-tester-2026-09-05_\d{4}-\d{2}-\d{2}\.pdf$/);
    const pdf = res.body as Buffer;
    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(pdf.length).toBe(Number(res.headers['content-length']));
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(pdf.toString('latin1').trimEnd().endsWith('%%EOF')).toBe(true);
    expect(pdf.toString('latin1')).toContain('DejaVu');
  });

  it('writes the file to destPath and returns an ExportResult', async () => {
    const dir = tempDataDir();
    const destPath = path.join(dir, 'ייצוא', 'היומן שלי.txt');
    const res = await t.post('/api/export', { format: 'txt', destPath, includeHabits: true });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/json');
    const result = res.body as ExportResult;
    expect(result.path).toBe(destPath);
    expect(result.fileName).toBe('היומן שלי.txt');
    expect(result.entriesExported).toBe(4);
    expect(fs.existsSync(destPath)).toBe(true);
    expect(fs.statSync(destPath).size).toBe(result.sizeBytes);
    expect(fs.existsSync(`${destPath}.tmp`)).toBe(false);
    const text = fs.readFileSync(destPath, 'utf8');
    expect(text).toContain('הרגלים');
    expect(text).toContain('הליכה (יעד: 30 דקות ביום)');
  });

  it('writes a PDF to destPath', async () => {
    const destPath = path.join(tempDataDir(), 'diary.pdf');
    const res = await t.post('/api/export', { format: 'pdf', destPath, from: '2026-09-07' });
    expect(res.status).toBe(200);
    expect(res.body.entriesExported).toBe(1);
    expect(fs.readFileSync(destPath).subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  it('rejects an unknown format with 400 and a Hebrew message', async () => {
    const res = await t.post('/api/export', { format: 'docx' });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: 'VALIDATION', field: 'format' });
    expect(res.body.message).toMatch(HEBREW);
  });

  it('rejects invalid dates and reversed ranges', async () => {
    const bad = await t.post('/api/export', { format: 'txt', from: '2026-02-30' });
    expect(bad.status).toBe(400);
    expect(bad.body).toMatchObject({ code: 'VALIDATION', field: 'from' });
    expect(bad.body.message).toMatch(HEBREW);
    const reversed = await t.post('/api/export', { format: 'txt', from: '2026-09-07', to: '2026-09-01' });
    expect(reversed.status).toBe(400);
    expect(reversed.body.field).toBe('from');
    const badTo = await t.post('/api/export', { format: 'csv', to: 'yesterday' });
    expect(badTo.status).toBe(400);
    expect(badTo.body.field).toBe('to');
  });

  it('rejects a relative destPath and a missing body', async () => {
    const rel = await t.post('/api/export', { format: 'txt', destPath: 'exports/diary.txt' });
    expect(rel.status).toBe(400);
    expect(rel.body).toMatchObject({ code: 'VALIDATION', field: 'destPath' });
    const empty = await t.post('/api/export');
    expect(empty.status).toBe(400);
    expect(empty.body.code).toBe('VALIDATION');
    expect(empty.body.message).toMatch(HEBREW);
  });

  it('answers with an IO error when the destination cannot be written', async () => {
    const file = path.join(tempDataDir(), 'not-a-dir');
    fs.writeFileSync(file, 'x');
    // A path *inside* a regular file can never be created.
    const res = await t.post('/api/export', { format: 'txt', destPath: path.join(file, 'diary.txt') });
    expect(res.status).toBe(500);
    expect(res.body.code).toBe('IO');
    expect(res.body.message).toMatch(HEBREW);
  });

  it('requires authentication', async () => {
    const res = await t.anon().post('/api/export').send({ format: 'txt' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });
});
