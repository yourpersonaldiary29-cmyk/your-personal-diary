import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { UserProfile } from '@shared/types';
import { DiaryDb } from '../src/db/database';
import { collectExportData, exportData } from '../src/export/index';
import type { ApiError } from '../src/errors';
import { exportPdf, resolvePdfFonts } from '../src/export/pdf';
import { toUserProfile } from '../src/security/session-types';
import { seedHebrewEntries, seedManyEntries, seedWalkingHabit } from './export-fixtures.test';
import { TEST_ACCOUNT, cleanupTempDirs, tempDataDir, testConfig } from './helpers';

const user: UserProfile = toUserProfile(TEST_ACCOUNT);
const HEBREW = /[֐-׿]/;

/** Number of page objects (excluding the /Pages tree node). */
function countPages(pdf: Buffer): number {
  const text = pdf.toString('latin1');
  return (text.match(/\/Type \/Page(?!s)/g) ?? []).length;
}

function isPdf(pdf: Buffer): void {
  const text = pdf.toString('latin1');
  expect(text.startsWith('%PDF-1')).toBe(true);
  expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
}

describe('PDF fonts', () => {
  afterAll(() => cleanupTempDirs());

  it('finds DejaVu Sans under <assetsDir>/fonts', () => {
    const fonts = resolvePdfFonts(testConfig().assetsDir);
    expect(fonts.regular.endsWith('DejaVuSans.ttf')).toBe(true);
    expect(fonts.bold.endsWith('DejaVuSans-Bold.ttf')).toBe(true);
    expect(fs.existsSync(fonts.regular)).toBe(true);
    expect(fs.existsSync(fonts.bold)).toBe(true);
  });

  it('falls back to the repository fonts when the assets dir has none', () => {
    const fonts = resolvePdfFonts(tempDataDir());
    expect(fs.existsSync(fonts.regular)).toBe(true);
    expect(fonts.regular.replace(/\\/g, '/')).toContain('src-tauri/resources/server/fonts/DejaVuSans.ttf');
  });

  it('uses the regular face for bold when only the regular file exists', () => {
    const dir = tempDataDir();
    fs.mkdirSync(path.join(dir, 'fonts'));
    fs.copyFileSync(resolvePdfFonts(testConfig().assetsDir).regular, path.join(dir, 'fonts', 'DejaVuSans.ttf'));
    const fonts = resolvePdfFonts(dir);
    expect(fonts.regular).toBe(path.join(dir, 'fonts', 'DejaVuSans.ttf'));
    expect(fonts.bold).toBe(fonts.regular);
  });
});

describe('PDF export', () => {
  let db: DiaryDb;
  const assetsDir = testConfig().assetsDir;
  beforeAll(async () => {
    db = await DiaryDb.create();
    seedHebrewEntries(db);
    seedWalkingHabit(db);
  });
  afterAll(() => {
    db.close();
    cleanupTempDirs();
  });

  it('produces a valid PDF that embeds the DejaVu fonts', async () => {
    const data = collectExportData(db, { format: 'pdf' }, user, 'he');
    const pdf = await exportPdf(data, assetsDir);
    isPdf(pdf);
    const text = pdf.toString('latin1');
    expect(text).toContain('DejaVu');
    expect(text).toContain('DejaVuSans-Bold');
    // No standard (Helvetica) font is referenced anywhere.
    expect(text).not.toContain('Helvetica');
    expect(countPages(pdf)).toBeGreaterThanOrEqual(1);
    expect(pdf.length).toBeGreaterThan(5000);
  });

  it('spans several pages for 60 entries', async () => {
    const big = await DiaryDb.create();
    seedManyEntries(big, 60);
    const data = collectExportData(big, { format: 'pdf' }, user, 'he');
    const pdf = await exportPdf(data, assetsDir);
    isPdf(pdf);
    expect(data.entries).toHaveLength(60);
    expect(countPages(pdf)).toBeGreaterThan(1);
    big.close();
  });

  it('adds the habits appendix on its own page when requested', async () => {
    const plain = await exportPdf(collectExportData(db, { format: 'pdf' }, user, 'he'), assetsDir);
    const withHabits = await exportPdf(collectExportData(db, { format: 'pdf', includeHabits: true }, user, 'he'), assetsDir);
    isPdf(withHabits);
    expect(countPages(withHabits)).toBe(countPages(plain) + 1);
  });

  it('handles an empty diary and entries without any reported values', async () => {
    const empty = await DiaryDb.create();
    const pdf = await exportPdf(collectExportData(empty, { format: 'pdf', includeHabits: true }, user, 'he'), assetsDir);
    isPdf(pdf);
    expect(countPages(pdf)).toBe(1);
    empty.close();
  });

  it('wraps very long words and paragraphs without throwing', async () => {
    const longDb = await DiaryDb.create();
    // A 300-letter title (broken by graphemes), a 1500-word paragraph and a single 2000-letter
    // "word": together far more than one A4 page, so page breaks happen inside a paragraph.
    longDb.run(
      `INSERT INTO entries (date, time, title, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
      ['2026-05-01', '10:00', 'א'.repeat(300), ('מילה '.repeat(1500) + '\n\n' + 'ב'.repeat(2000)).trim(), 'x', 'x'],
    );
    const pdf = await exportPdf(collectExportData(longDb, { format: 'pdf' }, user, 'he'), assetsDir);
    isPdf(pdf);
    expect(countPages(pdf)).toBeGreaterThanOrEqual(2);
    longDb.close();
  });

  it('is served through exportData with the pdf mime type and file name', async () => {
    const out = await exportData(db, { format: 'pdf', from: '2026-09-01', to: '2026-09-30' }, { user, assetsDir });
    expect(out.mime).toBe('application/pdf');
    expect(out.fileName).toBe('your-personal-diary-tester-2026-09-01_2026-09-30.pdf');
    expect(out.entriesExported).toBe(4);
    isPdf(out.bytes);
  });

  it('reports a Hebrew EXPORT error when the font file cannot be loaded', async () => {
    const data = collectExportData(db, { format: 'pdf' }, user, 'he');
    const missing = path.join(tempDataDir(), 'missing.ttf');
    const err = (await exportPdf(data, assetsDir, { fonts: { regular: missing, bold: missing } }).catch((e: unknown) => e)) as ApiError;
    expect(err).toMatchObject({ status: 500, code: 'EXPORT' });
    expect(err.messageFor('he')).toMatch(HEBREW);
  });
});
