import { beforeEach, describe, expect, it } from 'vitest';
import { DiaryDb } from '../src/db/database';
import {
  countEntries,
  createEntry,
  deleteEntry,
  ENTRY_LIMITS,
  escapeLike,
  getDay,
  getEntry,
  listEntries,
  listEntriesFull,
  listLocations,
  listPeople,
  listTags,
  makeExcerpt,
  updateEntry,
  validateEntryInput,
} from '../src/db/entries-repo';
import { ApiError } from '../src/errors';
import { sampleEntry } from './helpers';

const HEBREW = /[א-ת]/;

/** Runs `fn` and returns the ApiError it throws (fails the test when nothing is thrown). */
function catchApi(fn: () => unknown): ApiError {
  try {
    fn();
  } catch (e) {
    if (e instanceof ApiError) return e;
    throw e;
  }
  throw new Error('expected an ApiError to be thrown');
}

describe('validateEntryInput', () => {
  it('accepts a valid entry and normalises lists', () => {
    const input = validateEntryInput(
      sampleEntry({
        title: '  כותרת  ',
        tags: ['#עבודה', ' עבודה ', '', '##משפחה', 'ספורט'],
        people: [' דנה', 'דנה', 'יוסי '],
        events: ['פגישה', '   '],
        emotions: ['calm', 'calm', 'happy'],
      }),
    );
    expect(input.title).toBe('כותרת');
    expect(input.tags).toEqual(['עבודה', 'משפחה', 'ספורט']);
    expect(input.people).toEqual(['דנה', 'יוסי']);
    expect(input.events).toEqual(['פגישה']);
    expect(input.emotions).toEqual(['calm', 'happy']);
    expect(input.sleepHours).toBe(7.5);
  });

  it('defaults optional fields when missing', () => {
    const input = validateEntryInput({ date: '2026-09-07', time: '08:00' });
    expect(input).toEqual({
      date: '2026-09-07',
      time: '08:00',
      title: '',
      body: '',
      mood: null,
      emotions: [],
      energy: null,
      stress: null,
      sleepQuality: null,
      sleepHours: null,
      exerciseMinutes: null,
      exerciseType: '',
      events: [],
      people: [],
      location: '',
      notes: '',
      tags: [],
    });
  });

  it('keeps explicit zero exercise minutes (0 is "none", null is "not reported")', () => {
    expect(validateEntryInput(sampleEntry({ exerciseMinutes: 0 })).exerciseMinutes).toBe(0);
    expect(validateEntryInput(sampleEntry({ exerciseMinutes: null })).exerciseMinutes).toBeNull();
  });

  it.each<[Record<string, unknown>, string]>([
    [{ date: '2026-13-01' }, 'date'],
    [{ date: '2026-02-30' }, 'date'],
    [{ date: '07/09/2026' }, 'date'],
    [{ time: '25:00' }, 'time'],
    [{ time: '9:30' }, 'time'],
    [{ mood: 0 }, 'mood'],
    [{ mood: 11 }, 'mood'],
    [{ mood: 5.5 }, 'mood'],
    [{ mood: '7' }, 'mood'],
    [{ energy: 11 }, 'energy'],
    [{ stress: -1 }, 'stress'],
    [{ sleepQuality: 0 }, 'sleepQuality'],
    [{ sleepHours: 25 }, 'sleepHours'],
    [{ sleepHours: -0.5 }, 'sleepHours'],
    [{ sleepHours: 'שבע' }, 'sleepHours'],
    [{ exerciseMinutes: 1441 }, 'exerciseMinutes'],
    [{ exerciseMinutes: 2.5 }, 'exerciseMinutes'],
    [{ exerciseMinutes: -10 }, 'exerciseMinutes'],
    [{ title: 'א'.repeat(ENTRY_LIMITS.titleMax + 1) }, 'title'],
    [{ title: 42 }, 'title'],
    [{ body: 'x'.repeat(ENTRY_LIMITS.bodyMax + 1) }, 'body'],
    [{ body: ['not', 'text'] }, 'body'],
    [{ emotions: ['nope'] }, 'emotions'],
    [{ emotions: 'calm' }, 'emotions'],
    [{ emotions: [1] }, 'emotions'],
    [{ tags: [1] }, 'tags'],
    [{ tags: 'עבודה' }, 'tags'],
    [{ events: 'x' }, 'events'],
    [{ people: { name: 'דנה' } }, 'people'],
    [{ location: 'ב'.repeat(ENTRY_LIMITS.locationMax + 1) }, 'location'],
    [{ exerciseType: 7 }, 'exerciseType'],
  ])('rejects %j with field %s', (override, field) => {
    const err = catchApi(() => validateEntryInput(sampleEntry(override)));
    expect(err.status).toBe(400);
    expect(err.code).toBe('VALIDATION');
    expect(err.field).toBe(field);
    // Validation messages are localised: the Hebrew rendering must be Hebrew text.
    expect(err.messageFor('he')).toMatch(HEBREW);
  });

  it('rejects a non-object body', () => {
    expect(catchApi(() => validateEntryInput(null)).code).toBe('VALIDATION');
    expect(catchApi(() => validateEntryInput([])).code).toBe('VALIDATION');
    expect(catchApi(() => validateEntryInput('text')).code).toBe('VALIDATION');
  });
});

describe('entries CRUD', () => {
  let db: DiaryDb;
  beforeEach(async () => {
    db = await DiaryDb.create();
  });

  it('creates, reads, updates and deletes an entry', () => {
    const created = createEntry(db, validateEntryInput(sampleEntry()));
    expect(created.id).toBeGreaterThan(0);
    expect(created.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(created.updatedAt).toBe(created.createdAt);
    expect(created.tags).toEqual(['עבודה']);
    expect(created.emotions).toEqual(['calm', 'satisfied']);
    expect(getEntry(db, created.id)).toEqual(created);
    expect(countEntries(db)).toBe(1);

    const updated = updateEntry(db, created.id, validateEntryInput(sampleEntry({ title: 'שונה', mood: null, tags: ['#חדש'] })));
    expect(updated.id).toBe(created.id);
    expect(updated.title).toBe('שונה');
    expect(updated.mood).toBeNull();
    expect(updated.tags).toEqual(['חדש']);
    expect(updated.createdAt).toBe(created.createdAt);
    expect(updated.updatedAt >= created.updatedAt).toBe(true);

    deleteEntry(db, created.id);
    expect(countEntries(db)).toBe(0);
    const err = catchApi(() => getEntry(db, created.id));
    expect(err.status).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
  });

  it('throws NOT_FOUND for unknown ids on update and delete', () => {
    expect(catchApi(() => updateEntry(db, 999, validateEntryInput(sampleEntry()))).status).toBe(404);
    expect(catchApi(() => deleteEntry(db, 999)).status).toBe(404);
  });
});

describe('listEntries', () => {
  let db: DiaryDb;
  beforeEach(async () => {
    db = await DiaryDb.create();
    const rows: Record<string, unknown>[] = [
      { date: '2026-09-01', time: '08:00', title: 'ראשון', body: 'בוקר טוב', tags: ['עבודה'], emotions: ['happy'], people: ['דנה'], location: 'בית' },
      { date: '2026-09-01', time: '21:00', title: 'ראשון ערב', body: 'ערב רגוע', tags: ['משפחה'], emotions: ['calm'], people: [], location: 'בית' },
      { date: '2026-09-03', time: '12:00', title: 'שלישי', body: 'הלכתי לים 100% כיף', tags: ['עבודה קשה'], emotions: ['tired'], people: ['יוסי'], location: 'חוף' },
      { date: '2026-09-05', time: '09:00', title: 'Meeting Day', body: 'x_y', tags: ['עבודה', 'ספורט'], emotions: ['happy', 'stressed'], events: ['פגישה עם הבוס'], notes: 'הערה סודית', location: '' },
      { date: '2026-09-07', time: '18:30', title: 'שבת', body: 'מנוחה', tags: [], emotions: [], people: ['אמא'], location: 'בית של ההורים' },
    ];
    // Blank the list fields `sampleEntry` fills by default (events, people) so only the rows above are searchable.
    for (const r of rows) createEntry(db, validateEntryInput(sampleEntry({ events: [], notes: '', people: [], ...r })));
  });

  it('sorts newest first by default and oldest first with sortDesc=false', () => {
    const desc = listEntries(db);
    expect(desc.total).toBe(5);
    expect(desc.items.map((e) => `${e.date} ${e.time}`)).toEqual([
      '2026-09-07 18:30',
      '2026-09-05 09:00',
      '2026-09-03 12:00',
      '2026-09-01 21:00',
      '2026-09-01 08:00',
    ]);
    const asc = listEntries(db, { sortDesc: false });
    expect(asc.items.map((e) => `${e.date} ${e.time}`)).toEqual([
      '2026-09-01 08:00',
      '2026-09-01 21:00',
      '2026-09-03 12:00',
      '2026-09-05 09:00',
      '2026-09-07 18:30',
    ]);
  });

  it('filters by inclusive date range', () => {
    const page = listEntries(db, { from: '2026-09-01', to: '2026-09-03' });
    expect(page.total).toBe(3);
    expect(page.items.every((e) => e.date >= '2026-09-01' && e.date <= '2026-09-03')).toBe(true);
    expect(listEntries(db, { from: '2026-09-06' }).total).toBe(1);
    expect(listEntries(db, { to: '2026-09-01' }).total).toBe(2);
    expect(catchApi(() => listEntries(db, { from: 'bad' })).field).toBe('from');
    expect(catchApi(() => listEntries(db, { to: '2026-1-1' })).field).toBe('to');
  });

  it('filters by exact tag (leading # ignored)', () => {
    expect(listEntries(db, { tag: 'עבודה' }).total).toBe(2);
    expect(listEntries(db, { tag: '#עבודה' }).total).toBe(2);
    expect(listEntries(db, { tag: 'עבודה קשה' }).total).toBe(1);
    expect(listEntries(db, { tag: 'לא קיים' }).total).toBe(0);
  });

  it('filters by emotion', () => {
    expect(listEntries(db, { emotion: 'happy' }).total).toBe(2);
    expect(listEntries(db, { emotion: 'tired' }).items.map((e) => e.title)).toEqual(['שלישי']);
  });

  it('matches text across title, body, notes, location, events and people', () => {
    expect(listEntries(db, { text: 'ערב' }).items.map((e) => e.title)).toEqual(['ראשון ערב']);
    expect(listEntries(db, { text: 'דנה' }).total).toBe(1); // people
    expect(listEntries(db, { text: 'הבוס' }).total).toBe(1); // events
    expect(listEntries(db, { text: 'סודית' }).total).toBe(1); // notes
    expect(listEntries(db, { text: 'ההורים' }).total).toBe(1); // location
    expect(listEntries(db, { text: 'meeting' }).total).toBe(1); // case-insensitive latin
    expect(listEntries(db, { text: 'בית' }).total).toBe(3);
  });

  it('treats % and _ in the search text literally', () => {
    expect(listEntries(db, { text: '100%' }).total).toBe(1);
    expect(listEntries(db, { text: '%' }).total).toBe(1);
    expect(listEntries(db, { text: 'x_y' }).total).toBe(1);
    expect(listEntries(db, { text: '_' }).total).toBe(1);
    expect(listEntries(db, { text: 'xzy' }).total).toBe(0);
    expect(escapeLike('a%b_c\\d')).toBe('a\\%b\\_c\\\\d');
  });

  it('combines filters', () => {
    const page = listEntries(db, { tag: 'עבודה', emotion: 'happy', from: '2026-09-02' });
    expect(page.total).toBe(1);
    expect(page.items[0].title).toBe('Meeting Day');
  });

  it('paginates and reports the total of all matches', () => {
    const page = listEntries(db, { limit: 2, offset: 1, sortDesc: false });
    expect(page.total).toBe(5);
    expect(page.items.map((e) => e.title)).toEqual(['ראשון ערב', 'שלישי']);
    expect(listEntries(db, { limit: 2, offset: 4 }).items).toHaveLength(1);
    expect(listEntries(db, { limit: 2, offset: 10 }).items).toHaveLength(0);
    // limit is clamped to 1..500, offset to >= 0
    expect(listEntries(db, { limit: 0 }).items).toHaveLength(1);
    expect(listEntries(db, { limit: 9999, offset: -5 }).items).toHaveLength(5);
    expect(catchApi(() => listEntries(db, { limit: 1.5 })).field).toBe('limit');
  });

  it('returns summaries with a 160-character excerpt', () => {
    const long = 'א'.repeat(300) + '\n\nשורה נוספת';
    createEntry(db, validateEntryInput(sampleEntry({ date: '2026-09-08', body: long })));
    const first = listEntries(db).items[0];
    expect(first.date).toBe('2026-09-08');
    expect(first.excerpt).toHaveLength(160);
    expect(first.excerpt).toBe('א'.repeat(160));
    expect(Object.keys(first).sort()).toEqual(
      ['date', 'emotions', 'energy', 'excerpt', 'id', 'mood', 'sleepHours', 'stress', 'tags', 'time', 'title'].sort(),
    );
    expect(makeExcerpt('  שלום   עולם  \n שוב ')).toBe('שלום עולם שוב');
  });

  it('listEntriesFull returns full entries ascending by date and time', () => {
    const all = listEntriesFull(db, null, null);
    expect(all.map((e) => `${e.date} ${e.time}`)).toEqual([
      '2026-09-01 08:00',
      '2026-09-01 21:00',
      '2026-09-03 12:00',
      '2026-09-05 09:00',
      '2026-09-07 18:30',
    ]);
    expect(all[0].body).toBe('בוקר טוב');
    expect(listEntriesFull(db, '2026-09-03', '2026-09-05').map((e) => e.title)).toEqual(['שלישי', 'Meeting Day']);
    expect(listEntriesFull(db, null, '2026-09-01')).toHaveLength(2);
  });
});

describe('getDay', () => {
  let db: DiaryDb;
  beforeEach(async () => {
    db = await DiaryDb.create();
  });

  it('returns entries ascending by time with averages and habit logs', () => {
    createEntry(db, validateEntryInput(sampleEntry({ date: '2026-09-07', time: '21:00', mood: 8, energy: 4, stress: 2, sleepHours: 7 })));
    createEntry(db, validateEntryInput(sampleEntry({ date: '2026-09-07', time: '09:00', mood: 5, energy: null, stress: 5, sleepHours: 6.5 })));
    createEntry(db, validateEntryInput(sampleEntry({ date: '2026-09-06', time: '10:00', mood: 1 })));
    db.run(
      "INSERT INTO habits (id, name, description, target, unit, frequency, reminder_time, reminder_enabled, is_archived, sort_order, created_at) VALUES (1, 'שתיית מים', '', 8, 'כוסות', 'daily', NULL, 0, 0, 1, '2026-01-01T00:00:00.000Z')",
    );
    db.run(
      "INSERT INTO habits (id, name, description, target, unit, frequency, reminder_time, reminder_enabled, is_archived, sort_order, created_at) VALUES (2, 'פעילות', '', 3, 'פעמים', 'weekly', NULL, 0, 0, 0, '2026-01-01T00:00:00.000Z')",
    );
    db.run("INSERT INTO habit_logs (habit_id, date, value, completed, note) VALUES (1, '2026-09-07', 9, 1, 'הערה')");
    db.run("INSERT INTO habit_logs (habit_id, date, value, completed, note) VALUES (2, '2026-09-07', 1, 1, '')");
    db.run("INSERT INTO habit_logs (habit_id, date, value, completed, note) VALUES (1, '2026-09-06', 2, 0, '')");

    const day = getDay(db, '2026-09-07');
    expect(day.date).toBe('2026-09-07');
    expect(day.entries.map((e) => e.time)).toEqual(['09:00', '21:00']);
    expect(day.moodAvg).toBe(6.5);
    expect(day.energyAvg).toBe(4); // null is skipped, not treated as 0
    expect(day.stressAvg).toBe(3.5);
    expect(day.sleepHours).toBe(7);
    // Habit logs are ordered by the habit's sort order and carry the habit's name/unit/target.
    expect(day.habitLogs.map((l) => l.habitName)).toEqual(['פעילות', 'שתיית מים']);
    const water = day.habitLogs.find((l) => l.habitName === 'שתיית מים')!;
    expect(water).toMatchObject({ unit: 'כוסות', target: 8, frequency: 'daily' });
    expect(water.log).toMatchObject({ habitId: 1, date: '2026-09-07', value: 9, completed: true, note: 'הערה' });
  });

  it('returns nulls for an empty day', () => {
    const day = getDay(db, '2026-01-01');
    expect(day).toEqual({ date: '2026-01-01', entries: [], habitLogs: [], moodAvg: null, energyAvg: null, stressAvg: null, sleepHours: null });
  });

  it('rejects an invalid date', () => {
    expect(catchApi(() => getDay(db, '2026-99-99')).field).toBe('date');
  });
});

describe('tag / people / location counts', () => {
  it('counts distinct values sorted by count desc then name', async () => {
    const db = await DiaryDb.create();
    const mk = (over: Record<string, unknown>) => createEntry(db, validateEntryInput(sampleEntry(over)));
    mk({ tags: ['עבודה', 'ספורט'], people: ['דנה'], location: 'בית' });
    mk({ tags: ['עבודה'], people: ['דנה', 'יוסי'], location: 'משרד' });
    mk({ tags: ['אוכל', 'ספורט'], people: ['אמא'], location: '' });
    mk({ tags: [], people: [], location: 'בית' });

    // Ties are broken by name (Hebrew alphabet order: ס before ע).
    expect(listTags(db)).toEqual([
      { name: 'ספורט', count: 2 },
      { name: 'עבודה', count: 2 },
      { name: 'אוכל', count: 1 },
    ]);
    expect(listPeople(db)).toEqual([
      { name: 'דנה', count: 2 },
      { name: 'אמא', count: 1 },
      { name: 'יוסי', count: 1 },
    ]);
    expect(listLocations(db)).toEqual([
      { name: 'בית', count: 2 },
      { name: 'משרד', count: 1 },
    ]);
  });

  it('returns empty lists for an empty diary', async () => {
    const db = await DiaryDb.create();
    expect(listTags(db)).toEqual([]);
    expect(listPeople(db)).toEqual([]);
    expect(listLocations(db)).toEqual([]);
    expect(countEntries(db)).toBe(0);
  });
});
