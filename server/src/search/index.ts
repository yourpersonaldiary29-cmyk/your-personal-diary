/**
 * Smart search: a natural-language question is parsed locally (no network, no
 * model) into a `ParsedQuery` and executed against the diary database.
 *
 * `parseQuery` / `smartSearch` take the request locale (req.locale) as their
 * trailing parameter: the answer / explanation texts are rendered in it.
 */
import { DEFAULT_LOCALE, type Locale } from '@shared/i18n';
import type { ParsedQuery, SearchRequest, SearchResult } from '@shared/types';
import type { DiaryDb } from '../db/database';
import { todayIso } from '../util/dates';
import { smartSearch as runSmartSearch } from './executor';
import { parseQuery as runParseQuery } from './parser';

export { analyseQuery, normaliseQuery } from './parser';
export { validateSearchRequest, DEFAULT_LIMIT, MAX_LIMIT, QUERY_MAX_LENGTH, NO_RESULTS_PREFIX, noResultsPrefix } from './executor';

/** Parses a question into a `ParsedQuery` ("how I understood the question"), texts in `locale`. */
export function parseQuery(query: string, today: string = todayIso(), locale: Locale = DEFAULT_LOCALE): ParsedQuery {
  return runParseQuery(query, today, locale);
}

/** Parses and executes a search request; the answer is rendered in `locale`. */
export function smartSearch(db: DiaryDb, req: SearchRequest, today: string = todayIso(), locale: Locale = DEFAULT_LOCALE): SearchResult {
  return runSmartSearch(db, req, today, locale);
}
