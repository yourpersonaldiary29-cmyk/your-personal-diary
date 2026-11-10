/**
 * Tests of scripts/legal/build-pages.mjs (Node's own test runner - no vitest project covers scripts/):
 *
 *   node --test scripts/legal/build-pages.test.mjs
 *
 * Two kinds of checks. Against a fixture tree in a temp folder (its own settings, server address and 4 x 20
 * sources): the four documents give 4 x 21 pages, the footer of every document leads where PAGES says, every
 * placeholder is filled with the same-language address, public/ round-trips through writeAll / diffWithDisk,
 * and a source still marked TODO-TRANSLATE is reported. Against the real tree (fictional settings - the owner's
 * values are never written into a test): the support page carries the contact details before the first
 * question in every language (App Store "Support URL" rule, docs/apple-tasks/APPSTORE-FACTS.md 2.10), and the
 * policy names all five ways in, and the Terms of Use carry the one-account rule and the owner's other promises. src/components/legal/legal-pages.test.ts covers the rest (vitest).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  buildAll,
  DEFAULT_LOCALE,
  diffWithDisk,
  existingPages,
  LOCALES,
  PAGES,
  pagePath,
  PLACEHOLDERS,
  readSettings,
  readSiteUrl,
  renderPage,
  settingsProblems,
  sourceFile,
  UNTRANSLATED_MARKER,
  untranslatedSources,
  writeAll,
} from './build-pages.mjs';

const FILLED = { publisherName: 'Example Publisher', contactEmail: 'help@example.test', effectiveDate: '2026-11-08', termsEffectiveDate: '2026-11-12', minimumAge: 16 };
const FIXTURE_HOST = 'https://diary.example';

/** A complete fixture tree: settings, server address and one small source per document and locale. */
function fixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'legal-pages-'));
  mkdirSync(path.join(root, 'legal'), { recursive: true });
  mkdirSync(path.join(root, 'src', 'config'), { recursive: true });
  writeFileSync(path.join(root, 'legal', 'settings.json'), JSON.stringify(FILLED));
  writeFileSync(path.join(root, 'src', 'config', 'server-default.json'), JSON.stringify({ url: FIXTURE_HOST }));
  for (const page of PAGES) {
    mkdirSync(path.join(root, page.sourceDir), { recursive: true });
    for (const l of LOCALES) {
      writeFileSync(
        sourceFile(root, page, l.code),
        [
          '---',
          `title: ${page.id} ${l.code} - Your Personal Diary`,
          `description: ${page.id} in ${l.code}`,
          `languages: Languages-${l.code}`,
          `otherPage: Other-${l.code}`,
          '---',
          '',
          `# ${page.id} ${l.code} - Your Personal Diary`,
          '',
          `Operator {{PUBLISHER_NAME}}, contact [{{CONTACT_EMAIL}}](mailto:{{CONTACT_EMAIL}}), since {{EFFECTIVE_DATE}}, terms since {{TERMS_EFFECTIVE_DATE}}, age {{MINIMUM_AGE}}.`,
          '',
          '- Site [{{SITE_URL}}]({{SITE_URL}})',
          '- Policy [{{PRIVACY_URL}}]({{PRIVACY_URL}})',
          '- Deletion [{{DELETE_URL}}]({{DELETE_URL}})',
          '- Support [{{SUPPORT_URL}}]({{SUPPORT_URL}})',
          '- Terms [{{TERMS_URL}}]({{TERMS_URL}})',
          '',
        ].join('\n'),
      );
    }
  }
  return root;
}

test('the four documents: ids, footers and every placeholder name', () => {
  assert.deepEqual(PAGES.map((p) => p.id), ['privacy', 'delete-account', 'support', 'terms']);
  assert.deepEqual(PAGES.map((p) => p.footer), ['delete-account', 'privacy', 'privacy', 'privacy']);
  for (const p of PAGES) assert.ok(PAGES.some((q) => q.id === p.footer), `${p.id}: footer ${p.footer} is a document`);
  assert.deepEqual([...PLACEHOLDERS].sort(), ['CONTACT_EMAIL', 'DELETE_URL', 'EFFECTIVE_DATE', 'MINIMUM_AGE', 'PRIVACY_URL', 'PUBLISHER_NAME', 'SITE_URL', 'SUPPORT_URL', 'TERMS_EFFECTIVE_DATE', 'TERMS_URL']);
  assert.equal(pagePath('support', DEFAULT_LOCALE), '/support/');
  assert.equal(pagePath('support', 'he'), '/support/he/');
  assert.equal(pagePath('terms', DEFAULT_LOCALE), '/terms/');
  assert.equal(pagePath('terms', 'he'), '/terms/he/');
});

test('fixture tree: 4 x 21 pages, same-language addresses, footer links, round trip through public/', () => {
  const root = fixture();
  try {
    const settings = readSettings(root);
    assert.deepEqual(settings, FILLED);
    assert.equal(readSiteUrl(root), FIXTURE_HOST);
    const files = buildAll({ root, settings, siteUrl: FIXTURE_HOST });
    assert.equal(files.size, 4 * 21);
    for (const page of PAGES) {
      assert.equal(files.get(`${page.id}/index.html`), files.get(`${page.id}/en/index.html`), `${page.id}: the default page is the English one`);
      for (const l of LOCALES) {
        const html = files.get(`${page.id}/${l.code}/index.html`);
        assert.ok(html, `${page.id}/${l.code}`);
        assert.ok(!html.includes('{{'), `${page.id}/${l.code}: every placeholder filled`);
        assert.ok(html.includes(`href="${FIXTURE_HOST}${pagePath('privacy', l.code)}"`), `${page.id}/${l.code}: PRIVACY_URL of the same language`);
        assert.ok(html.includes(`href="${FIXTURE_HOST}${pagePath('delete-account', l.code)}"`), `${page.id}/${l.code}: DELETE_URL of the same language`);
        assert.ok(html.includes(`href="${FIXTURE_HOST}${pagePath('support', l.code)}"`), `${page.id}/${l.code}: SUPPORT_URL of the same language`);
        assert.ok(html.includes(`href="${FIXTURE_HOST}${pagePath('terms', l.code)}"`), `${page.id}/${l.code}: TERMS_URL of the same language`);
        assert.ok(html.includes(`<a href="${pagePath(page.footer, l.code)}">Other-${l.code}</a>`), `${page.id}/${l.code}: footer leads to ${page.footer}`);
        assert.ok(html.includes(`<link rel="canonical" href="${FIXTURE_HOST}${pagePath(page.id, l.code)}">`), `${page.id}/${l.code}: canonical`);
        assert.ok(html.includes('Example Publisher') && html.includes('mailto:help@example.test'), `${page.id}/${l.code}: settings values`);
      }
    }
    // Nothing on disk yet, then everything, then one stale page and one stray file.
    assert.deepEqual(existingPages(root), []);
    assert.equal(diffWithDisk(files, root).length, 4 * 21);
    writeAll(files, root);
    assert.deepEqual(existingPages(root), [...files.keys()].sort());
    assert.deepEqual(diffWithDisk(files, root), []);
    writeFileSync(path.join(root, 'public', 'support', 'he', 'index.html'), 'old');
    writeFileSync(path.join(root, 'public', 'support', 'stray.html'), 'x');
    assert.deepEqual(diffWithDisk(files, root).sort(), ['public/support/he/index.html is out of date', 'public/support/stray.html is not produced by any source']);
    writeAll(files, root);
    assert.deepEqual(diffWithDisk(files, root), []);
    assert.ok(!existsSync(path.join(root, 'public', 'support', 'stray.html')), 'writeAll removes stray files');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('fixture tree: a source still marked TODO-TRANSLATE is listed; a missing source is an error', () => {
  const root = fixture();
  try {
    assert.deepEqual(untranslatedSources(root), []);
    const file = sourceFile(root, PAGES[2], 'de');
    writeFileSync(file, readFileSync(file, 'utf8').replace('title: support de', `title: ${UNTRANSLATED_MARKER} support de`));
    assert.deepEqual(untranslatedSources(root), ['legal/support/support-de.md']);
    rmSync(sourceFile(root, PAGES[2], 'fr'));
    assert.throws(() => buildAll({ root, settings: FILLED, siteUrl: FIXTURE_HOST }), /missing sources: legal\/support\/support-fr\.md/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('renderPage: a support source gets the privacy footer and the same-language support address', () => {
  const source = ['---', 'title: Support - Your Personal Diary', 'description: d', 'languages: Languages', 'otherPage: Privacy policy', '---', '', '# Support - Your Personal Diary', '', 'Here: [{{SUPPORT_URL}}]({{SUPPORT_URL}})', ''].join('\n');
  const html = renderPage({ page: PAGES[2], locale: 'fr', source, settings: FILLED, siteUrl: FIXTURE_HOST });
  assert.ok(html.includes('<html lang="fr" dir="ltr">'));
  assert.ok(html.includes(`<a href="${FIXTURE_HOST}/support/fr/" dir="ltr">${FIXTURE_HOST}/support/fr/</a>`));
  assert.ok(html.includes('<footer>\n<a href="/privacy/fr/">Privacy policy</a><a href="/support/" hreflang="en" lang="en" dir="ltr">English</a>'));
});

test('real tree: the support page shows the operator and the contact e-mail before the first question, in every language', () => {
  const files = buildAll({ settings: FILLED });
  assert.equal(files.size, 4 * 21);
  for (const l of LOCALES) {
    const html = files.get(`support/${l.code}/index.html`);
    const firstQuestion = html.indexOf('<h3>');
    assert.ok(firstQuestion > 0, `support/${l.code}: has questions`);
    const head = html.slice(html.indexOf('<main>'), firstQuestion);
    assert.ok(head.includes('Example Publisher'), `support/${l.code}: operator before the questions`);
    assert.ok(head.includes('href="mailto:help@example.test"'), `support/${l.code}: contact e-mail before the questions`);
    assert.ok(html.includes(`href="${readSiteUrl()}${pagePath('privacy', l.code)}"`), `support/${l.code}: links the policy of its language`);
    assert.ok(html.includes(`href="${readSiteUrl()}${pagePath('delete-account', l.code)}"`), `support/${l.code}: links the deletion page of its language`);
  }
  const english = files.get('support/index.html');
  assert.equal((english.match(/<h3>/g) ?? []).length, 9, 'nine frequent questions');
  assert.ok(english.includes('when it is published'), 'the iPhone app is named with its qualifier');
});

test('real tree: the English policy names the five ways in and the four key stores', () => {
  const html = buildAll({ settings: FILLED }).get('privacy/index.html');
  for (const needle of ['Android app', 'Windows app', 'Mac app', 'iPhone app', 'when it is published', 'Windows Data Protection', 'macOS Keychain', 'Android Keystore', 'iOS Keychain', 'Mac App Store', 'jailbroken']) {
    assert.ok(html.includes(needle), needle);
  }
});

test('settings: termsEffectiveDate is required and must be a date', () => {
  assert.deepEqual(settingsProblems(FILLED), []);
  const { termsEffectiveDate: _omit, ...without } = FILLED;
  assert.deepEqual(settingsProblems(without), ['"termsEffectiveDate" is missing']);
  assert.deepEqual(settingsProblems({ ...FILLED, termsEffectiveDate: '12.11.2026' }), ['"termsEffectiveDate" must look like 2026-10-26']);
});

test('fixture tree: the terms date and the policy date are printed separately', () => {
  const source = ['---', 'title: Terms - Your Personal Diary', 'description: d', 'languages: Languages', 'otherPage: Privacy Policy', '---', '', '# Terms', '', 'Terms: {{TERMS_EFFECTIVE_DATE}}. Policy: {{EFFECTIVE_DATE}}.', ''].join('\n');
  const html = renderPage({ page: PAGES[3], locale: 'en', source, settings: FILLED, siteUrl: FIXTURE_HOST });
  assert.ok(html.includes('Terms: 12 November 2026. Policy: 8 November 2026.'));
  assert.ok(html.includes('<footer>\n<a href="/privacy/">Privacy Policy</a>\n</footer>'));
});

test('real tree: the Terms of Use - fifteen numbered sections, the one-account rule, the 30-day notice, in every language', () => {
  const files = buildAll({ settings: FILLED });
  const english = files.get('terms/index.html');
  assert.equal(english, files.get('terms/en/index.html'));
  for (const needle of ['You may open and keep only one account.', 'prior written approval', 'at least 30 days', 'We never ask for your password', 'please write to us first', 'free of charge', 'when it is published', '12 November 2026']) {
    assert.ok(english.includes(needle), needle);
  }
  for (const l of LOCALES) {
    const html = files.get(`terms/${l.code}/index.html`);
    const sections = (html.match(/<h2>\d+\. /g) ?? []).length;
    assert.equal(sections, 15, `terms/${l.code}: fifteen numbered sections`);
    assert.ok(html.includes('href="mailto:help@example.test"'), `terms/${l.code}: the contact e-mail (one-account approval)`);
    assert.ok(html.includes(`href="${readSiteUrl()}${pagePath('privacy', l.code)}"`), `terms/${l.code}: links the policy of its language`);
    assert.ok(html.includes(`href="${readSiteUrl()}${pagePath('delete-account', l.code)}"`), `terms/${l.code}: links the deletion page of its language`);
    assert.ok(html.includes(`<a href="${pagePath('privacy', l.code)}">`), `terms/${l.code}: footer leads to the policy`);
  }
});
