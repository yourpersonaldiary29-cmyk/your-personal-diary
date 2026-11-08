/**
 * Smart search: a natural-language question ("When did I write that I was
 * tired?") is sent to POST /api/search. The page shows how the question was
 * understood, the answer (announced politely), matching days and entries
 * (matched terms wrapped in <mark>) and a line chart when the server returns
 * a series. Recent questions are kept in localStorage (max 10). `?q=` in the
 * URL runs a search on arrival. Texts: 'search.*'; the example questions are
 * 'search.example.1'..'search.example.6' and exist in every language.
 *
 * A text search answers with the first entries only (the server default is 10): the entries card
 * then says how many of the matches are shown and offers "Load more" (the timeline's texts), and
 * every entry shows its tags, so "entries with the tag work" visibly matches.
 */
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { CalendarDay, Metric, SearchIntent, SearchResult, StatsSeries } from '@shared/types';
import { emotionLabel } from '@shared/constants';
import * as api from '@/api';
import { LineChart } from '@/components/charts/LineChart';
import type { ChartSeries } from '@/components/charts/chart-utils';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { NeedsConnectionPage } from '@/components/sync/NeedsConnection';
import { useOfflineNow } from '@/components/sync/hooks';
import { PageTitle } from '@/components/ui/PageTitle';
import { Spinner } from '@/components/ui/Spinner';
import { TextInput } from '@/components/ui/TextInput';
import { PATHS } from '@/constants/routes';
import { useAnnouncer } from '@/context/AnnouncerContext';
import { useAuth } from '@/context/AuthContext';
import { useLocalStorageState } from '@/hooks/useLocalStorageState';
import { getCurrentLocale, tr } from '@/i18n/runtime';
import { formatDateTime, formatHebrewDate } from '@/utils/dates';
import { recentQuestionsKey } from '@/utils/deviceData';
import { errorMessage } from '@/utils/errors';
import { formatHours, formatNumber } from '@/utils/format';
import { ET } from './entries/texts';

export const SEARCH_TEXTS = {
  get title() {
    return tr('search.title');
  },
  get label() {
    return tr('search.label');
  },
  get hint() {
    return tr('search.hint');
  },
  get submit() {
    return tr('search.submit');
  },
  get searching() {
    return tr('search.searching');
  },
  get examplesTitle() {
    return tr('search.examplesTitle');
  },
  get recentTitle() {
    return tr('search.recentTitle');
  },
  get clearRecent() {
    return tr('search.clearRecent');
  },
  get resultsTitle() {
    return tr('search.resultsTitle');
  },
  get understood() {
    return tr('search.understood');
  },
  get answer() {
    return tr('search.answer');
  },
  get days() {
    return tr('search.days');
  },
  get entries() {
    return tr('search.entries');
  },
  get emptyQuestion() {
    return tr('search.emptyQuestion');
  },
  get untitled() {
    return tr('search.untitled');
  },
  get noRatings() {
    return tr('search.noRatings');
  },
  period: (label: string) => tr('search.period', { label }),
  matches: (n: number) => tr('search.matches', { count: n }),
} as const;

/** Catalogue keys of the example questions (the server parser understands them in every language). */
export const SEARCH_EXAMPLE_KEYS = ['search.example.1', 'search.example.2', 'search.example.3', 'search.example.4', 'search.example.5', 'search.example.6'] as const;

/** The example questions in the current language. */
export function searchExamples(): string[] {
  return SEARCH_EXAMPLE_KEYS.map((key) => tr(key));
}

export const MAX_RECENT_QUESTIONS = 10;

/** Intents whose answer is a list of matching entries, cut at the request's `limit`. */
const ENTRY_LIST_INTENTS: ReadonlySet<SearchIntent> = new Set<SearchIntent>(['text_mention', 'list_entries', 'unknown']);
/** How many more entries one "Load more" asks for. */
export const MORE_ENTRIES_STEP = 50;
/** The server refuses a larger `limit` (search/executor.ts MAX_LIMIT). */
export const MAX_SEARCH_LIMIT = 200;

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string');
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const HEBREW_FINAL_TO_REGULAR: Record<string, string> = { ך: 'כ', ם: 'מ', ן: 'נ', ף: 'פ', ץ: 'צ' };

/**
 * A Hebrew word ending in a final letter also appears with the regular letter inside longer words
 * (עייף -> עייפה). Words of 4+ letters only, like the server search ("הים" must not mark "הימים").
 */
function withHebrewInflections(terms: string[]): string[] {
  const out = [...terms];
  for (const term of terms) {
    const regular = HEBREW_FINAL_TO_REGULAR[term.slice(-1)];
    if (regular && [...term].length >= 4) {
      const inflected = term.slice(0, -1) + regular;
      if (!out.includes(inflected)) out.push(inflected);
    }
  }
  return out;
}

/** A one- or two-letter Hebrew word ("ים") is found by the server only as a whole word (after prefix letters). */
const SHORT_HEBREW_WORD = /^[א-ת]{1,2}$/u;

function termPattern(term: string): string {
  if (!SHORT_HEBREW_WORD.test(term)) return escapeRegExp(term);
  return `(?<=(?:^|[^\\p{L}\\p{M}])[ובהכלמש]{0,3})${term}(?=$|[^\\p{L}\\p{M}])`;
}

/** Wraps every occurrence of the terms in <mark> (case-insensitive). Exported for tests. */
export function highlightTerms(text: string, terms: string[]): ReactNode {
  const clean = withHebrewInflections(terms.map((t) => t.trim()).filter((t) => t.length > 0));
  if (!text || clean.length === 0) return text;
  const pattern = new RegExp(`(${clean.map(termPattern).join('|')})`, 'giu');
  // split() with one capturing group puts the matches at the odd indexes.
  const parts = text.split(pattern);
  return parts.map((part, i) => (i % 2 === 1 ? <mark key={i}>{part}</mark> : part));
}

const METRIC_TEXT: Record<Metric, (d: CalendarDay) => string | null> = {
  mood: (d) => (d.mood === null ? null : tr('search.day.mood', { value: formatNumber(d.mood) })),
  energy: (d) => (d.energy === null ? null : tr('search.day.energy', { value: formatNumber(d.energy) })),
  stress: (d) => (d.stress === null ? null : tr('search.day.stress', { value: formatNumber(d.stress) })),
  sleepHours: (d) => (d.sleepHours === null ? null : tr('search.day.sleep', { hours: formatHours(d.sleepHours) })),
  sleepQuality: () => null,
  exerciseMinutes: () => null,
};
const METRIC_ORDER: Metric[] = ['mood', 'energy', 'stress', 'sleepHours'];

/** "mood 8, energy 7, sleep 7.5 hours, 1 entry" - the asked metric first. Exported for tests. */
export function dayMetricsText(day: CalendarDay, metric: Metric | null): string {
  const order = metric && METRIC_ORDER.includes(metric) ? [metric, ...METRIC_ORDER.filter((m) => m !== metric)] : METRIC_ORDER;
  const parts = order.map((m) => METRIC_TEXT[m](day)).filter((p): p is string => p !== null);
  if (day.entryCount > 0) parts.push(tr('search.day.entries', { count: day.entryCount }));
  return parts.length > 0 ? parts.join(tr('search.day.separator')) : SEARCH_TEXTS.noRatings;
}

function resultChartSeries(series: StatsSeries): ChartSeries[] {
  const out: ChartSeries[] = [{ label: series.label, points: series.points.map((p) => ({ x: p.date, y: p.value })), dash: '' }];
  if (series.movingAvg.some((p) => p.value !== null)) {
    out.push({ label: tr('stats.movingAvg'), points: series.movingAvg.map((p) => ({ x: p.date, y: p.value })), shape: 'square', dash: '7 4' });
  }
  return out;
}

const RATING_METRICS = new Set(['mood', 'energy', 'stress', 'sleepQuality']);

/**
 * Online only (docs/android-tasks/OFFLINE-DESIGN.md section 6.2): while the automatic offline mode runs
 * without a connection the page says "This needs a connection to the diary server." [Try again];
 * otherwise (and always while offline mode is off) it is the page as it was.
 */
export default function SearchPage() {
  const offlineNow = useOfflineNow();
  if (offlineNow) return <NeedsConnectionPage title={SEARCH_TEXTS.title} />;
  return <SearchPageContent />;
}

function SearchPageContent() {
  const { announce } = useAnnouncer();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get('q') ?? '');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useLocalStorageState<string[]>(
    // Per account (diary-derived text): the next account on this computer never sees these.
    recentQuestionsKey(user?.id ?? 'anonymous'),
    [],
    isStringArray,
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLHeadingElement>(null);
  const focusResultsPending = useRef(false);
  const lastRun = useRef<string | null>(null);
  const runId = useRef(0);
  const [loadingMore, setLoadingMore] = useState(false);
  /** The question the shown result answers ("Load more" asks it again with a larger limit). */
  const shownQuestion = useRef<string | null>(null);
  /** Entry whose link takes focus once "Load more" has rendered it. */
  const focusEntryAfterLoad = useRef<number | null>(null);

  // After a search completes, move keyboard focus to the "Results" heading so
  // screen-reader users land on the answer. Runs after React has rendered the
  // results (a requestAnimationFrame right after setResult could fire before
  // the first commit, when the heading does not exist yet).
  useEffect(() => {
    if (!result || !focusResultsPending.current) return;
    focusResultsPending.current = false;
    resultsRef.current?.focus();
  }, [result]);

  // After "Load more": continue at the first entry that was added (the button may be gone).
  useEffect(() => {
    const id = focusEntryAfterLoad.current;
    if (id === null) return;
    focusEntryAfterLoad.current = null;
    document.getElementById(`search-entry-${id}`)?.focus();
  }, [result]);

  const runSearch = useCallback(
    async (question: string) => {
      const id = ++runId.current;
      setBusy(true);
      setError(null);
      try {
        const res = await api.search.run({ query: question });
        if (id !== runId.current) return;
        shownQuestion.current = question;
        setResult(res);
        setRecent((prev) => [question, ...prev.filter((q) => q !== question)].slice(0, MAX_RECENT_QUESTIONS));
        announce(res.answer, 'polite');
        // The results heading is rendered only once `result` is set, so focus
        // it from an effect after the commit (see below) rather than right now.
        focusResultsPending.current = true;
      } catch (e) {
        if (id !== runId.current) return;
        const message = errorMessage(e);
        setError(message);
        announce(message, 'assertive');
      } finally {
        if (id === runId.current) setBusy(false);
      }
    },
    [announce, setRecent],
  );

  // A question in the URL (?q=…) runs once on arrival or when the URL changes.
  useEffect(() => {
    const q = (searchParams.get('q') ?? '').trim();
    if (!q || q === lastRun.current) return;
    lastRun.current = q;
    setQuery(q);
    void runSearch(q);
  }, [searchParams, runSearch]);

  const loadMore = async () => {
    const question = shownQuestion.current;
    if (!result || !question || loadingMore || busy) return;
    const id = runId.current;
    const shown = result.entries.length;
    setLoadingMore(true);
    try {
      const res = await api.search.run({ query: question, limit: Math.min(MAX_SEARCH_LIMIT, shown + MORE_ENTRIES_STEP) });
      // A new search started meanwhile: its result wins.
      if (id !== runId.current) return;
      focusEntryAfterLoad.current = res.entries[shown]?.id ?? null;
      setResult(res);
      announce(ET.loadedMore(Math.max(0, res.entries.length - shown)), 'polite');
    } catch (e) {
      if (id !== runId.current) return;
      const message = errorMessage(e);
      setError(message);
      announce(message, 'assertive');
    } finally {
      setLoadingMore(false);
    }
  };

  const submit = (question: string) => {
    const trimmed = question.trim();
    if (!trimmed) {
      setFieldError(SEARCH_TEXTS.emptyQuestion);
      announce(SEARCH_TEXTS.emptyQuestion, 'assertive');
      inputRef.current?.focus();
      return;
    }
    setFieldError(null);
    lastRun.current = trimmed;
    setSearchParams({ q: trimmed }, { replace: true });
    void runSearch(trimmed);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit(query);
  };

  const fillInput = (text: string) => {
    setQuery(text);
    setFieldError(null);
    inputRef.current?.focus();
  };

  // Emotion labels in the UI language so the highlighted words match the question as asked.
  const terms = result ? [...result.parsed.textTerms, ...result.parsed.emotions.map((key) => emotionLabel(key, getCurrentLocale()))] : [];
  // A text search shows the first matches only; the days of the other intents come complete.
  const entryList = result !== null && ENTRY_LIST_INTENTS.has(result.parsed.intent);
  const entriesPartial = entryList && result.entries.length < result.totalMatches;
  const canLoadMore = entriesPartial && result.entries.length < MAX_SEARCH_LIMIT;

  return (
    <div className="stack">
      <PageTitle title={SEARCH_TEXTS.title} />

      <form className="form" role="search" onSubmit={onSubmit} noValidate>
        <Field id="search-query" label={SEARCH_TEXTS.label} hint={SEARCH_TEXTS.hint} error={fieldError}>
          {(a11y) => (
            <TextInput
              {...a11y}
              ref={inputRef}
              type="search"
              value={query}
              autoComplete="off"
              enterKeyHint="search"
              onChange={(e) => {
                setQuery(e.currentTarget.value);
                if (fieldError) setFieldError(null);
              }}
            />
          )}
        </Field>
        <div className="form__actions">
          <Button type="submit" loading={busy}>
            {SEARCH_TEXTS.submit}
          </Button>
        </div>
      </form>

      <section aria-labelledby="search-examples-title">
        <h2 id="search-examples-title" className="text-small text-muted">
          {SEARCH_TEXTS.examplesTitle}
        </h2>
        <ul className="cluster search-chips">
          {searchExamples().map((example) => (
            <li key={example}>
              <Button variant="ghost" size="sm" onClick={() => fillInput(example)}>
                {example}
              </Button>
            </li>
          ))}
        </ul>
      </section>

      {recent.length > 0 && (
        <section aria-labelledby="search-recent-title">
          <div className="cluster cluster--between">
            <h2 id="search-recent-title" className="text-small text-muted">
              {SEARCH_TEXTS.recentTitle}
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setRecent([]);
                // The whole section (and this button) disappears: keep keyboard focus on the page.
                inputRef.current?.focus();
              }}
            >
              {SEARCH_TEXTS.clearRecent}
            </Button>
          </div>
          <ul className="cluster search-chips">
            {recent.map((question) => (
              <li key={question}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setQuery(question);
                    submit(question);
                  }}
                >
                  <bdi>{question}</bdi>
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {busy && <Spinner block label={SEARCH_TEXTS.searching} />}
      {error && <Alert kind="error" role="none">{error}</Alert>}

      {result && (
        <section aria-labelledby="search-results-title" className="stack" aria-busy={busy || undefined}>
          <h2 id="search-results-title" tabIndex={-1} ref={resultsRef}>
            {SEARCH_TEXTS.resultsTitle}
          </h2>
          <Card title={SEARCH_TEXTS.understood} headingLevel="h3">
            <p>{result.parsed.explanation}</p>
            {result.parsed.periodLabel && <p className="text-muted text-small">{SEARCH_TEXTS.period(result.parsed.periodLabel)}</p>}
          </Card>
          <Card title={SEARCH_TEXTS.answer} headingLevel="h3" highlight>
            <p className="search-answer">{result.answer}</p>
            {result.totalMatches > 0 && <p className="text-muted text-small">{SEARCH_TEXTS.matches(result.totalMatches)}</p>}
          </Card>
          {result.days.length > 0 && (
            <Card title={SEARCH_TEXTS.days} headingLevel="h3">
              <ul className="stack-sm">
                {result.days.map((day) => (
                  <li key={day.date}>
                    <Link to={PATHS.day(day.date)}>{formatHebrewDate(day.date)}</Link> – {dayMetricsText(day, result.parsed.metric)}
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {result.entries.length > 0 && (
            <Card title={SEARCH_TEXTS.entries} headingLevel="h3">
              {entriesPartial && <p className="text-muted text-small">{ET.resultsCount(result.entries.length, result.totalMatches)}</p>}
              <ul className="stack-sm">
                {result.entries.map((entry) => (
                  <li key={entry.id}>
                    <Link id={`search-entry-${entry.id}`} to={PATHS.entry(entry.id)}>
                      {highlightTerms(entry.title.trim() || SEARCH_TEXTS.untitled, terms)}
                    </Link>{' '}
                    <span className="text-muted text-small">({formatDateTime(entry.date, entry.time)})</span>
                    {entry.excerpt && (
                      <p className="user-text" dir="auto">
                        {highlightTerms(entry.excerpt, terms)}
                      </p>
                    )}
                    {entryList && entry.tags.length > 0 && (
                      <ul className="chips search-tags" aria-label={ET.tags}>
                        {entry.tags.map((tag) => (
                          <li className="chip" key={tag}>
                            #<bdi>{highlightTerms(tag, terms)}</bdi>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
              {canLoadMore && (
                <div className="cluster search-more">
                  <Button variant="secondary" loading={loadingMore} onClick={() => void loadMore()}>
                    {ET.loadMore}
                  </Button>
                </div>
              )}
            </Card>
          )}
          {result.series && (
            <LineChart
              title={result.series.label}
              series={resultChartSeries(result.series)}
              unit={result.series.unit || undefined}
              yMin={RATING_METRICS.has(result.series.metric) ? 1 : 0}
              yMax={RATING_METRICS.has(result.series.metric) ? 10 : undefined}
            />
          )}
        </section>
      )}
    </div>
  );
}
