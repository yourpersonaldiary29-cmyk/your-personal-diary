// @vitest-environment node
/**
 * The privacy policy and account-deletion pages (docs/play-tasks/PLAY-LEGAL.md item 3): legal/**.md ->
 * scripts/legal/build-pages.mjs -> public/privacy/** and public/delete-account/** (Vite copies public/ into
 * dist/, the hosted server serves it). Proves:
 *  - every page exists for all 20 app languages plus the English default at the folder itself, and public/
 *    is exactly what the sources give (a text change is one edit plus one run of the script);
 *  - the placeholders are filled from the ONE settings place (legal/settings.json): with values set, none is
 *    left and the values appear (escaped) in every page; while a value is null its {{PLACEHOLDER}} stays
 *    visible - nothing else can fill it;
 *  - every translation has the structure of the English text (sections, list items, links, placeholders);
 *  - the pages are self-contained (no script, no external stylesheet, font or image), name no host but the
 *    fixed diary server, are right-to-left for Hebrew and Arabic, open in English with links to the 19 other
 *    languages, link back to English, stay small, and name the app as the store listing does.
 * The Node modules are loaded through a computed specifier: the root tsconfig has no Node types.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { LOCALES as APP_LOCALES } from '@shared/i18n';
import serverDefault from '@/config/server-default.json';
import {
  BRAND,
  buildAll,
  DEFAULT_LOCALE,
  diffWithDisk,
  existingPages,
  fillPlaceholders,
  inline,
  LOCALES,
  markdownToHtml,
  PAGES,
  parseSource,
  PLACEHOLDERS,
  readSettings,
  readSiteUrl,
  ROOT,
  settingsProblems,
  sourceFile,
  unsetSettings,
  type LegalSettings,
} from '../../../scripts/legal/build-pages.mjs';

interface NodeFs {
  readFileSync(p: string, encoding: 'utf8'): string;
}
const load = (specifier: string) => import(/* @vite-ignore */ specifier);
let fs: NodeFs;

beforeAll(async () => {
  fs = (await load('node:fs')) as NodeFs;
});

const SITE = new URL(serverDefault.url).origin;
/** Fictional values (the owner's real name and address are never in a test). */
const FILLED: LegalSettings = { publisherName: 'Example & Sons Publishing', contactEmail: 'privacy@example.test', effectiveDate: '2026-11-01', minimumAge: 16 };

describe('the one settings place', () => {
  it('legal/settings.json is valid; publisher and contact stay null until the owner fills them', () => {
    const settings = readSettings();
    expect(settingsProblems(JSON.parse(fs.readFileSync(`${ROOT}/legal/settings.json`, 'utf8')))).toEqual([]);
    expect(settings.effectiveDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(settings.minimumAge).toBeGreaterThanOrEqual(13);
    // No real personal data in the repository: either not set yet, or set by the owner himself.
    for (const placeholder of unsetSettings(settings)) expect(['PUBLISHER_NAME', 'CONTACT_EMAIL']).toContain(placeholder);
  });

  it('refuses broken values', () => {
    expect(settingsProblems({ publisherName: '', contactEmail: null, effectiveDate: '2026-10-26', minimumAge: 16 })).toHaveLength(1);
    expect(settingsProblems({ publisherName: null, contactEmail: 'not-an-address', effectiveDate: '2026-10-26', minimumAge: 16 })).toHaveLength(1);
    expect(settingsProblems({ publisherName: null, contactEmail: null, effectiveDate: '26.10.2026', minimumAge: 16 })).toHaveLength(1);
    expect(settingsProblems({ publisherName: null, contactEmail: null, effectiveDate: '2026-10-26', minimumAge: 9 })).toHaveLength(1);
    expect(settingsProblems({ publisherName: '<b>', contactEmail: null, effectiveDate: '2026-10-26', minimumAge: 16 })).toHaveLength(1);
    expect(settingsProblems({ publisherName: null, contactEmail: null, effectiveDate: '2026-10-26', minimumAge: 16, extra: 1 })).toHaveLength(1);
  });

  it('the site address is the fixed diary server of src/config/server-default.json', () => {
    expect(readSiteUrl()).toBe(SITE);
  });
});

describe('public/ pages', () => {
  it('exist for every page and all 20 locales plus the English default, and match the sources exactly', () => {
    const files = buildAll();
    const expected = PAGES.flatMap((page) => [`${page.id}/index.html`, ...LOCALES.map((l) => `${page.id}/${l.code}/index.html`)]).sort();
    expect([...files.keys()].sort()).toEqual(expected);
    expect(expected).toHaveLength(2 * 21);
    expect(existingPages()).toEqual(expected);
    // Run `node scripts/legal/build-pages.mjs` after editing legal/ when this fails.
    expect(diffWithDisk(files)).toEqual([]);
  });

  it('the locale list is the app\'s 20 locales (code, native name, direction)', () => {
    expect(LOCALES.map((l) => [l.code, l.name, l.dir])).toEqual(APP_LOCALES.map((l) => [l.code, l.nativeName, l.dir]));
    expect(DEFAULT_LOCALE).toBe('en');
  });
});

describe('placeholders come from legal/settings.json only', () => {
  it('filled: no placeholder is left and the escaped values appear in every page', () => {
    const files = buildAll({ settings: FILLED });
    for (const [name, html] of files) {
      expect(html, name).not.toMatch(/\{\{/);
      expect(html, name).toContain('Example &amp; Sons Publishing');
      expect(html, name).toContain('privacy@example.test');
      expect(html, name).not.toContain('Example & Sons');
    }
    expect(files.get('privacy/index.html')).toContain('href="mailto:privacy@example.test"');
    expect(files.get('privacy/index.html')).toContain('1 November 2026');
    expect(files.get('privacy/de/index.html')).toContain('1. November 2026');
  });

  it('unset: exactly the two owner placeholders stay visible, everything else is filled', () => {
    const files = buildAll({ settings: { ...FILLED, publisherName: null, contactEmail: null } });
    for (const [name, html] of files) {
      const left = new Set([...html.matchAll(/\{\{([A-Z_]+)\}\}/g)].map((m) => m[1]));
      expect([...left].sort(), name).toEqual(['CONTACT_EMAIL', 'PUBLISHER_NAME']);
    }
  });

  it('an unknown placeholder is an error, not a silent hole', () => {
    expect(() => fillPlaceholders('<p>{{PUBLISHER}}</p>', {})).toThrow(/unknown placeholder/);
    expect(PLACEHOLDERS).toContain('PUBLISHER_NAME');
  });
});

describe('translations', () => {
  const shape = (md: string) => ({
    h1: (md.match(/^# /gm) ?? []).length,
    h2: (md.match(/^## /gm) ?? []).length,
    items: (md.match(/^(?:- |\d+\. )/gm) ?? []).length,
    links: (md.match(/\]\(/g) ?? []).length,
    placeholders: [...md.matchAll(/\{\{([A-Z_]+)\}\}/g)].map((m) => m[1]).sort().join(','),
  });

  it('every locale has the structure of the English text, its own front matter and the brand in English', () => {
    for (const page of PAGES) {
      const english = parseSource(fs.readFileSync(sourceFile(ROOT, page, 'en'), 'utf8'));
      for (const l of LOCALES) {
        const source = parseSource(fs.readFileSync(sourceFile(ROOT, page, l.code), 'utf8'), `${page.id}-${l.code}`);
        expect(shape(source.body), `${page.id} ${l.code}`).toEqual(shape(english.body));
        expect(source.meta.title, `${page.id} ${l.code}`).toContain(BRAND);
        expect(source.body.split('\n').find((line) => line.startsWith('# ')), `${page.id} ${l.code}`).toContain(BRAND);
        if (l.code !== 'en') {
          // Translated, not copied: the title and the first section differ from the English ones.
          expect(source.meta.title, `${page.id} ${l.code}`).not.toBe(english.meta.title);
          expect(source.meta.languages, `${page.id} ${l.code}`).not.toBe(english.meta.languages);
        }
      }
    }
  });
});

describe('the rendered pages', () => {
  const files = () => buildAll({ settings: FILLED });

  it('are self-contained: no script, no external stylesheet, font, image or frame', () => {
    for (const [name, html] of files()) {
      expect(html, name).not.toMatch(/<script\b/i);
      expect(html, name).not.toMatch(/<link\b[^>]*rel="(?:stylesheet|preload|icon|manifest)"/i);
      expect(html, name).not.toMatch(/<(?:img|iframe|object|embed|video|audio|source)\b/i);
      expect(html, name).not.toMatch(/\bsrc=|url\(|@import/i);
      expect(html, name).toMatch(/^<!doctype html>/);
      expect(html, name).toContain('<meta name="viewport" content="width=device-width, initial-scale=1">');
    }
  });

  it('name no host on the internet but the fixed diary server (the Android bundle carries public/ too)', () => {
    const host = new URL(SITE).host;
    for (const [name, html] of files()) {
      const hosts = new Set([...html.matchAll(/https?:\/\/([\w.-]+(?::\d+)?)/g)].map((m) => m[1].toLowerCase()));
      expect([...hosts], name).toEqual([host]);
    }
  });

  it('are right-to-left for Hebrew and Arabic only, and carry their language', () => {
    const all = files();
    for (const page of PAGES) {
      for (const l of LOCALES) {
        const html = all.get(`${page.id}/${l.code}/index.html`) as string;
        expect(html, `${page.id} ${l.code}`).toContain(`<html lang="${l.code}" dir="${['he', 'ar'].includes(l.code) ? 'rtl' : 'ltr'}">`);
      }
      expect(all.get(`${page.id}/index.html`)).toContain('<html lang="en" dir="ltr">');
    }
  });

  it('open in English at the folder itself, list the 19 other languages, and every page links back to English', () => {
    const all = files();
    for (const page of PAGES) {
      const root = all.get(`${page.id}/index.html`) as string;
      expect(root).toBe(all.get(`${page.id}/en/index.html`));
      for (const l of LOCALES) {
        const href = l.code === 'en' ? `/${page.id}/` : `/${page.id}/${l.code}/`;
        expect(root, `${page.id} -> ${l.code}`).toContain(`<a href="${href}" hreflang="${l.code}"`);
      }
      for (const l of LOCALES.filter((x) => x.code !== 'en')) {
        const html = all.get(`${page.id}/${l.code}/index.html`) as string;
        expect(html, `${page.id} ${l.code}`).toContain(`href="/${page.id}/" hreflang="en"`);
        expect(html, `${page.id} ${l.code}`).toContain(`aria-current="page">${l.name}</a>`);
      }
    }
  });

  it('link the two documents to each other in the same language', () => {
    const all = files();
    expect(all.get('privacy/he/index.html')).toContain('<a href="/delete-account/he/">');
    expect(all.get('delete-account/he/index.html')).toContain('<a href="/privacy/he/">');
    expect(all.get('privacy/index.html')).toContain(`href="${SITE}/delete-account/"`);
    expect(all.get('delete-account/fr/index.html')).toContain(`href="${SITE}/privacy/fr/"`);
  });

  it('the deletion page names the app and the publisher, the steps, the e-mail route and the 30-day snapshot window', () => {
    const html = files().get('delete-account/index.html') as string;
    expect(html).toMatch(/<h1>[^<]*Your Personal Diary/);
    expect(html).toContain('Example &amp; Sons Publishing');
    expect(html).toContain('<strong>Settings</strong>');
    expect(html).toContain('<strong>Delete account</strong>');
    expect(html).toContain('href="mailto:privacy@example.test"');
    expect(html).toContain('<strong>30 days</strong>');
  });

  it('the policy names both apps, the hosting place, the operator\'s reset capability and the device copies', () => {
    const html = files().get('privacy/index.html') as string;
    for (const needle of ['Android app', 'Windows app', 'Frankfurt, Germany', 'AES-256-GCM', 'Windows Data Protection (DPAPI)', 'Android Keystore', 'The operator can technically reset any password', 'within 30 days', 'Fly.io, Inc.', 'Gmail']) {
      expect(html, needle).toContain(needle);
    }
    expect(html).toContain('at least 16 years old');
  });

  it('stay well under 100 KB each (the Android bundle test limits every file to 100 KB)', () => {
    for (const [name, html] of files()) expect(new TextEncoder().encode(html).length, name).toBeLessThan(80_000);
  });
});

describe('the small Markdown converter', () => {
  it('escapes text, keeps links and marks addresses left-to-right', () => {
    expect(inline('a < b & "c"')).toBe('a &lt; b &amp; &quot;c&quot;');
    expect(inline('**x** `y<z>`')).toBe('<strong>x</strong> <code dir="ltr">y&lt;z&gt;</code>');
    expect(inline('[mail](mailto:a@b.test) [page](/privacy/)')).toBe('<a href="mailto:a@b.test" dir="ltr">mail</a> <a href="/privacy/">page</a>');
  });

  it('builds headings, paragraphs and lists', () => {
    expect(markdownToHtml('# T\n\nOne\ntwo\n\n- a\n  more\n- b\n\n1. x\n2. y')).toBe('<h1>T</h1>\n<p>One two</p>\n<ul><li>a more</li><li>b</li></ul>\n<ol><li>x</li><li>y</li></ol>');
  });
});
