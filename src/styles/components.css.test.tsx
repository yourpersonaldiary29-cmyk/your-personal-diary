/**
 * src/styles/components.css: the list-marker rule for lists whose items are self-contained blocks,
 * checked as text against the real markup it targets (jsdom has no layout and the root vitest config
 * has `css: false`, so a component test cannot see the effect itself).
 *
 * - The Habits page's active list (`ul.stack > li > .card`, POLISH item 3) and the Home page's
 *   "Today's habits" list (`ul.stack > li > article`) are both matched: no bullet hangs outside the
 *   card / next to the heading and the list is not indented. The Home list was the regression: the
 *   first version of the rule matched `li > .card` only, so the Home page kept its bullets.
 * - An ordinary `ul.stack` of text items is not matched and keeps its bullets.
 * - The marker is the empty string (Safari / VoiceOver keep announcing the list), `none` only as the
 *   fallback for engines without string markers.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Habit, HabitWithProgress, HomeSummary } from '@shared/types';
import * as api from '@/api';
import { renderWithProviders } from '@/test/render';
import HabitsPage, { HABITS_TEXTS } from '@/pages/HabitsPage';
import HomePage, { HOME_TEXTS } from '@/pages/HomePage';

vi.mock('@/api', async (importOriginal) => {
  const { createApiMock } = await import('@/test/api-mock');
  return createApiMock(await importOriginal());
});

/** The selector of the rule under test, exactly as written in components.css. */
const SELECTOR = ':is(ul, ol).stack:has(> li > :is(.card, article))';
/** The first version of the rule (POLISH item 3): matched the Habits page only. */
const OLD_SELECTOR = ':is(ul, ol).stack:has(> li > .card)';

/**
 * The stylesheet as text. Read from disk: with `css: false` even `?inline` / `?raw` CSS imports come
 * back empty. The Node modules are loaded through a computed specifier because the root tsconfig
 * deliberately has no Node types (it checks browser code).
 */
async function readComponentsCss(): Promise<string> {
  const load = (specifier: string) => import(/* @vite-ignore */ specifier);
  const { readFileSync } = (await load('node:fs')) as { readFileSync(file: string, encoding: 'utf8'): string };
  const { fileURLToPath } = (await load('node:url')) as { fileURLToPath(url: string): string };
  const { dirname, join } = (await load('node:path')) as { dirname(p: string): string; join(...parts: string[]): string };
  return readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'components.css'), 'utf8');
}

let componentsCss = '';
beforeAll(async () => {
  componentsCss = (await readComponentsCss()).replace(/\/\*[\s\S]*?\*\//g, '');
});

/** Declarations of every rule in `css` whose selector list is exactly `selector`. */
function rules(css: string, selector: string): Record<string, string>[] {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(?:^|[{}])\\s*${escaped}\\s*\\{([^{}]*)\\}`, 'g');
  const found: Record<string, string>[] = [];
  for (const match of css.matchAll(re)) {
    const decls: Record<string, string> = {};
    for (const part of match[1].split(';')) {
      const i = part.indexOf(':');
      if (i > 0) decls[part.slice(0, i).trim()] = part.slice(i + 1).trim();
    }
    found.push(decls);
  }
  return found;
}

const waterHabit: Habit = {
  id: 1,
  name: 'שתיית מים',
  description: 'כוסות מים במהלך היום',
  target: 8,
  unit: 'כוסות',
  frequency: 'daily',
  reminderTime: null,
  reminderEnabled: false,
  isArchived: false,
  sortOrder: 0,
  createdAt: '2026-09-01T08:00:00.000Z',
};
const readingHabit: Habit = { ...waterHabit, id: 2, name: 'קריאה', target: 20, unit: 'דקות', isArchived: true, sortOrder: 1 };

const water: HabitWithProgress = {
  habit: waterHabit,
  today: { id: 10, habitId: 1, date: '2026-09-23', value: 5, completed: false, note: '' },
  currentStreak: 3,
  bestStreak: 7,
  weekTotal: 20,
  completedLast30: 21,
  completionRate30: 0.7,
  targetMet: false,
};

const summary: HomeSummary = {
  today: '2026-09-23',
  todayWeekday: 'רביעי',
  todayEntryCount: 0,
  entryStreak: 0,
  lastEntry: null,
  weekMoodAvg: null,
  weekEnergyAvg: null,
  weekStressAvg: null,
  weekSleepAvg: null,
  habitsToday: [water],
  topInsight: null,
  totalEntries: 0,
};

describe('components.css: lists whose items are cards or articles show no markers', () => {
  beforeEach(() => {
    vi.mocked(api.insights.home).mockReset().mockResolvedValue(summary);
    vi.mocked(api.habits.progress).mockReset().mockResolvedValue([water]);
    vi.mocked(api.habits.list).mockReset().mockResolvedValue([waterHabit, readingHabit]);
    vi.mocked(api.habits.status).mockReset().mockResolvedValue([]);
  });

  it('removes the marker with an empty-string marker (list semantics survive) and removes the indent', () => {
    const found = rules(componentsCss, SELECTOR);
    expect(found).toHaveLength(1);
    expect(found[0]['list-style-type']).toBe('""');
    expect(found[0]['list-style']).toBe('none');
    expect(found[0]['padding-inline-start']).toBe('0');
    // The old, narrower selector is gone: one rule covers both pages.
    expect(rules(componentsCss, OLD_SELECTOR)).toHaveLength(0);
  });

  it('matches the active list of the Habits page (items are cards) - POLISH item 3', async () => {
    const { container } = renderWithProviders(<HabitsPage />, { auth: 'authenticated', route: '/habits' });
    await screen.findByRole('article', { name: 'שתיית מים' });

    const active = screen.getByRole('list', { name: HABITS_TEXTS.activeList });
    expect(active).toHaveClass('stack');
    expect(active.querySelector(':scope > li > .card')).not.toBeNull();
    expect(active.matches(SELECTOR)).toBe(true);

    // The archived sub-list inside the <details> card is a `.stack-sm` list of plain rows: not this
    // rule's business (unchanged by it).
    const archived = container.querySelector('details ul');
    expect(archived).not.toBeNull();
    expect(archived!.matches(SELECTOR)).toBe(false);
  });

  it('matches the "Today\'s habits" list of the Home page (items are <article>s with a heading) - the regression', async () => {
    renderWithProviders(<HomePage />, { auth: 'authenticated', route: '/' });
    const heading = await screen.findByRole('heading', { level: 3, name: 'שתיית מים' });

    const article = heading.closest('article');
    expect(article).not.toBeNull();
    const list = article!.closest('ul');
    expect(list).not.toBeNull();
    expect(list).toHaveClass('stack');
    expect(article!.parentElement?.tagName).toBe('LI');
    expect(article!.parentElement?.parentElement).toBe(list);

    // This is the markup the first version of the rule missed (its items are articles, not cards)...
    expect(list!.matches(OLD_SELECTOR)).toBe(false);
    // ...and the current rule covers it.
    expect(list!.matches(SELECTOR)).toBe(true);
    // The list is still a list for assistive technology (no role was taken away).
    expect(screen.getAllByRole('list')).toContain(list);

    // The week-averages grid is a different list with its own rule in base.css (ul.grid-2).
    const tiles = screen.getByRole('list', { name: HOME_TEXTS.weekAverages });
    expect(tiles.matches(SELECTOR)).toBe(false);
  });

  it('does not match an ordinary ul.stack of text items (they keep their bullets)', () => {
    const { container } = render(
      <ul className="stack">
        <li>First</li>
        <li>
          <p>Second, with a card deeper down (not a direct child of the item)</p>
          <div>
            <div className="card">nested</div>
          </div>
        </li>
      </ul>,
    );
    const list = container.querySelector('ul')!;
    expect(list.matches(SELECTOR)).toBe(false);
  });
});
