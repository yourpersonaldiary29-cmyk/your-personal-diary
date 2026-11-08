/**
 * The query parser of the express shim: Express 5's default `query parser` is 'simple', i.e.
 * node:querystring's `parse`. The same rules here, so `req.query` of the routers (entries.ts
 * `queryString` / `queryInt` / `queryBool`, calendar.ts `parseIntParam`, ...) sees what it sees
 * on the desktop:
 *
 *  - pairs are split on '&', a pair on its first '=' ('h=1=2' -> h: '1=2');
 *  - empty pairs are skipped ('a=1&&b=2'); a pair without '=' has the value '' ('c' -> c: '');
 *  - '+' is a space, then percent-decoding; a malformed sequence is kept as text ('%ZZ%41' -> '%ZZA');
 *  - a repeated key becomes an array, in order; the first 1000 pairs are read;
 *  - the result has a null prototype ('constructor' is a normal key).
 */

export type ParsedQuery = Record<string, string | string[]>;

/** node:querystring's maxKeys default. */
const MAX_PAIRS = 1000;

/** `querystring.unescape`: decodeURIComponent, falling back to a per-sequence decode on malformed input. */
export function unescapeQuery(text: string): string {
  if (!text.includes('%')) return text;
  try {
    return decodeURIComponent(text);
  } catch {
    // Decode every run of %XX sequences that is valid on its own; keep the rest as it is.
    return text.replace(/(?:%[0-9a-fA-F]{2})+/g, (run) => {
      try {
        return decodeURIComponent(run);
      } catch {
        let out = '';
        for (let i = 0; i < run.length; i += 3) {
          const one = run.slice(i, i + 3);
          try {
            out += decodeURIComponent(one);
          } catch {
            out += one;
          }
        }
        return out;
      }
    });
  }
}

export function parseQuery(queryString: string): ParsedQuery {
  const out: ParsedQuery = Object.create(null) as ParsedQuery;
  if (!queryString) return out;
  const raw = queryString.startsWith('?') ? queryString.slice(1) : queryString;
  let count = 0;
  for (const pair of raw.split('&')) {
    if (pair === '') continue;
    if (count++ >= MAX_PAIRS) break;
    const eq = pair.indexOf('=');
    const key = unescapeQuery((eq < 0 ? pair : pair.slice(0, eq)).replace(/\+/g, ' '));
    const value = unescapeQuery((eq < 0 ? '' : pair.slice(eq + 1)).replace(/\+/g, ' '));
    const existing = out[key];
    if (existing === undefined) out[key] = value;
    else if (Array.isArray(existing)) existing.push(value);
    else out[key] = [existing, value];
  }
  return out;
}
