/**
 * Google Play kit (WP-17, docs/play-tasks/PLAY-LISTING.md): the store-listing texts in play/listing/
 * and their checker scripts/play/check-listing.mjs.
 *
 *   - the real play/listing/ passes the checker (exit code 0): 20 locales x {title, short, full};
 *   - the Play locale codes cover exactly the 20 UI languages of the app (Hebrew is Play's "iw-IL");
 *   - the length is counted the way Play's form counts (CRLF as one break, the final break dropped,
 *     never fewer than the code points);
 *   - every rule of the checker catches a broken fixture: limits, missing files / folders, web
 *     addresses, emoji, repeated punctuation, ALL CAPS, store-performance / price claims, keyword
 *     stuffing, an untranslated or wrongly-scripted text, the old "stored only on your device" claim
 *     and an end-to-end / zero-knowledge claim - and the command line exits 1 on each.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { LOCALE_CODES } from '@shared/i18n/locales';
import {
  BRAND,
  DEFAULT_LISTING_DIR,
  FILES,
  LIMITS,
  PLAY_LOCALES,
  checkListing,
  normalise,
  playLength,
  textProblems,
} from '../../scripts/play/check-listing.mjs';

const ROOT = path.resolve(__dirname, '..', '..');
const SCRIPT = path.join(ROOT, 'scripts', 'play', 'check-listing.mjs');

const tempDirs: string[] = [];
afterAll(() => {
  for (const d of tempDirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

function runCli(args: string[] = []) {
  const r = spawnSync(process.execPath, [SCRIPT, ...args], { cwd: ROOT, encoding: 'utf8', timeout: 60_000 });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

/** A copy of the real play/listing/ in a temp folder, for one mutation. */
function fixture(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mpd-play-listing-'));
  tempDirs.push(dir);
  fs.cpSync(DEFAULT_LISTING_DIR, dir, { recursive: true });
  return dir;
}

function read(dir: string, locale: string, file: string): string {
  return fs.readFileSync(path.join(dir, locale, file), 'utf8');
}

function write(dir: string, locale: string, file: string, text: string): void {
  fs.writeFileSync(path.join(dir, locale, file), text);
}

/** The problems the checker reports for one file of a fixture folder. */
function problemsOf(dir: string, locale: string, file: string): string[] {
  const row = checkListing(dir).rows.find((r) => r.locale === locale && r.file === file);
  return row?.problems ?? [];
}

describe('play/listing (the real texts)', () => {
  it('passes scripts/play/check-listing.mjs: 20 locales, 60 files', () => {
    const r = runCli();
    expect(r.stderr).toBe('');
    expect(r.stdout).toContain("check-listing: 20 locales, 60 files, all within Play's limits and rules");
    expect(r.status).toBe(0);
  });

  it('has the three files in every Play locale folder, and nothing else', () => {
    const folders = fs.readdirSync(DEFAULT_LISTING_DIR).sort();
    expect(folders).toEqual(Object.keys(PLAY_LOCALES).sort());
    for (const locale of folders) expect(fs.readdirSync(path.join(DEFAULT_LISTING_DIR, locale)).sort()).toEqual([...FILES].sort());
  });

  it('keeps the brand in English as the title of every locale and names it in every full description', () => {
    for (const locale of Object.keys(PLAY_LOCALES)) {
      expect(normalise(read(DEFAULT_LISTING_DIR, locale, 'title.txt'))).toBe(BRAND);
      expect(read(DEFAULT_LISTING_DIR, locale, 'full.txt')).toContain(BRAND);
    }
  });

  it('is a translation in every locale: no two locales share a short or a full description', () => {
    for (const file of ['short.txt', 'full.txt']) {
      const texts = Object.keys(PLAY_LOCALES).map((l) => normalise(read(DEFAULT_LISTING_DIR, l, file)));
      expect(new Set(texts).size).toBe(texts.length);
    }
  });
});

describe('the Play locale codes', () => {
  it('cover exactly the 20 UI languages of the app, one Play code each', () => {
    const apps = Object.values(PLAY_LOCALES).map((d) => d.app);
    expect([...apps].sort()).toEqual([...LOCALE_CODES].sort());
    expect(Object.keys(PLAY_LOCALES)).toHaveLength(20);
  });

  it('use the codes of the Play Console list (Hebrew is iw-IL there, not he-IL)', () => {
    expect(Object.keys(PLAY_LOCALES).sort()).toEqual(
      ['en-US', 'iw-IL', 'ar', 'zh-CN', 'ja-JP', 'hi-IN', 'th', 'es-ES', 'pt-BR', 'fr-FR', 'it-IT', 'de-DE', 'ro', 'el-GR', 'pl-PL', 'cs-CZ', 'hu-HU', 'ru-RU', 'bg', 'tr-TR'].sort(),
    );
    expect(PLAY_LOCALES['iw-IL'].app).toBe('he');
    expect(PLAY_LOCALES['he-IL']).toBeUndefined();
  });

  it('use the limits of the Play Console: title 30, short 80, full 4000', () => {
    expect(LIMITS).toEqual({ 'title.txt': 30, 'short.txt': 80, 'full.txt': 4000 });
  });
});

describe('playLength (how Play counts)', () => {
  it('counts a CRLF break as one character and ignores the final line break', () => {
    expect(playLength('abc\n')).toBe(3);
    expect(playLength('abc\r\n')).toBe(3);
    expect(playLength('a\r\nb\n')).toBe(3);
    expect(playLength('a\nb')).toBe(3);
  });

  it('counts accents, CJK and right-to-left letters one each, and never fewer than the code points', () => {
    expect(playLength('é日本ש\n')).toBe(4);
    const astral = '\u{20B9F}'; // a CJK ideograph outside the BMP: 1 code point, 2 UTF-16 units
    expect(playLength(astral)).toBe(2);
    expect(playLength(astral)).toBeGreaterThanOrEqual([...astral].length);
  });

  it('lets a text of exactly the limit pass and one character more fail', () => {
    const at = `${BRAND}${' x'.repeat(5)}\n`; // 19 + 10 = 29 characters
    expect(playLength(at)).toBe(29);
    const short80 = `${'Ab cd. '.repeat(11)}Abc\n`; // 77 + 3 = 80
    expect(playLength(short80)).toBe(80);
    expect(textProblems('en-US', 'short.txt', short80).some((p) => p.includes('limit'))).toBe(false);
    expect(textProblems('en-US', 'short.txt', `${short80.trimEnd()}d\n`).some((p) => p.includes('81 characters long, the limit is 80'))).toBe(true);
  });
});

describe('scripts/play/check-listing.mjs catches a broken listing', () => {
  it('reports a missing locale folder, a missing file, an unexpected folder and an unexpected file', () => {
    const dir = fixture();
    fs.rmSync(path.join(dir, 'ro'), { recursive: true });
    fs.rmSync(path.join(dir, 'de-DE', 'short.txt'));
    fs.mkdirSync(path.join(dir, 'he-IL'));
    fs.writeFileSync(path.join(dir, 'fr-FR', 'notes.txt'), 'x\n');
    const result = checkListing(dir);
    expect(result.ok).toBe(false);
    expect(result.problems).toEqual(
      expect.arrayContaining([
        expect.stringContaining('locale folder missing: ro'),
        expect.stringContaining('unexpected folder: he-IL'),
        expect.stringContaining('fr-FR: unexpected file(s): notes.txt'),
      ]),
    );
    expect(problemsOf(dir, 'de-DE', 'short.txt')).toEqual(['missing']);
    const cli = runCli(['--dir', dir]);
    expect(cli.status).toBe(1);
    expect(cli.stdout).toContain('check-listing: problems found');
  });

  it('reports a title that is too long or is not the brand', () => {
    const dir = fixture();
    write(dir, 'en-US', 'title.txt', 'Your Personal Diary - Journal App\n');
    write(dir, 'it-IT', 'title.txt', 'Il mio diario\n');
    expect(problemsOf(dir, 'en-US', 'title.txt')).toEqual(expect.arrayContaining([expect.stringContaining('the limit is 30')]));
    expect(problemsOf(dir, 'it-IT', 'title.txt')).toEqual([expect.stringContaining(`must be exactly the brand "${BRAND}"`)]);
  });

  it('reports a short description over 80 characters or with a line break, and a full description over 4000', () => {
    const dir = fixture();
    write(dir, 'es-ES', 'short.txt', `${normalise(read(dir, 'es-ES', 'short.txt'))} Más texto.\n`);
    write(dir, 'pl-PL', 'short.txt', 'Prywatny dziennik.\nSzyfrowany.\n');
    const full = normalise(read(dir, 'cs-CZ', 'full.txt'));
    write(dir, 'cs-CZ', 'full.txt', `${full}\n\n${full}\n`);
    expect(problemsOf(dir, 'es-ES', 'short.txt')).toEqual(expect.arrayContaining([expect.stringMatching(/is \d+ characters long, the limit is 80/)]));
    expect(problemsOf(dir, 'pl-PL', 'short.txt')).toContain('the short description may not contain line breaks');
    expect(problemsOf(dir, 'cs-CZ', 'full.txt')).toEqual(expect.arrayContaining([expect.stringMatching(/is \d+ characters long, the limit is 4000/)]));
  });

  it('reports web addresses, emoji, repeated punctuation and words in ALL CAPS', () => {
    const dir = fixture();
    const en = normalise(read(dir, 'en-US', 'full.txt'));
    write(dir, 'en-US', 'full.txt', `${en}\nMore at https://yourpersonaldiary.fly.dev\n`);
    write(dir, 'en-US', 'short.txt', 'Private diary with mood and habits \u{1F512} Encrypted, works offline.\n');
    write(dir, 'de-DE', 'short.txt', 'Privates Tagebuch!!! Verschlüsselt, auch offline.\n');
    write(dir, 'fr-FR', 'short.txt', 'Journal TRÈS privé : humeur, habitudes, observations.\n');
    expect(problemsOf(dir, 'en-US', 'full.txt')).toEqual(expect.arrayContaining([expect.stringContaining('contains a web address')]));
    expect(problemsOf(dir, 'en-US', 'short.txt')).toEqual(expect.arrayContaining([expect.stringContaining('contains an emoji')]));
    expect(problemsOf(dir, 'de-DE', 'short.txt')).toEqual(expect.arrayContaining([expect.stringContaining('repeats punctuation')]));
    expect(problemsOf(dir, 'fr-FR', 'short.txt')).toEqual(expect.arrayContaining([expect.stringContaining('ALL CAPS (TRÈS)')]));
  });

  it('finds ALL CAPS and claims in any alphabet (word edges are Unicode-aware, not ASCII-only)', () => {
    expect(textProblems('ru-RU', 'short.txt', 'Личный дневник ОЧЕНЬ удобный.\n')).toContain('has a word in ALL CAPS (ОЧЕНЬ)');
    expect(textProblems('el-GR', 'short.txt', 'Ένα ΠΟΛΥ ιδιωτικό ημερολόγιο.\n')).toContain('has a word in ALL CAPS (ΠΟΛΥ)');
    expect(textProblems('ru-RU', 'short.txt', 'Дневник номер 1 для вас.\n').some((p) => p.includes('metadata policy forbids'))).toBe(true);
    expect(textProblems('cs-CZ', 'short.txt', 'Deník číslo 1 pro tebe.\n').some((p) => p.includes('metadata policy forbids'))).toBe(true);
  });

  it('accepts the file-format acronyms and the brand, which are not ALL CAPS shouting', () => {
    expect(textProblems('en-US', 'short.txt', 'Export your diary to TXT, CSV, JSON or PDF.\n')).toEqual([]);
  });

  it('reports store-performance, price and call-to-action claims in the language of the text', () => {
    const cases: Array<[string, string]> = [
      ['en-US', 'The best private diary. Free download now.\n'],
      ['en-US', 'The #1 diary for your mood and habits.\n'],
      ['de-DE', 'Das beste Tagebuch, kostenlos und verschlüsselt.\n'],
      ['iw-IL', 'היומן הטוב ביותר, בחינם ומוצפן.\n'],
      ['ru-RU', 'Лучший личный дневник, бесплатно.\n'],
      ['zh-CN', '第一私密日记，免费。\n'],
    ];
    for (const [locale, text] of cases) {
      expect(textProblems(locale, 'short.txt', text).some((p) => p.includes('metadata policy forbids')), `${locale}: ${text}`).toBe(true);
    }
    // An English word inside another language is not a claim there ("sale" is just a word in Romanian).
    expect(textProblems('ro', 'short.txt', 'Jurnal privat pentru zilele sale bune.\n').some((p) => p.includes('metadata policy'))).toBe(false);
  });

  it('reports keyword stuffing (one word repeated over and over in the full description)', () => {
    const dir = fixture();
    const en = normalise(read(dir, 'en-US', 'full.txt'));
    write(dir, 'en-US', 'full.txt', `${en}\nJournal ${'journal diary journal mood journal '.repeat(5)}journal.\n`);
    expect(problemsOf(dir, 'en-US', 'full.txt')).toEqual(expect.arrayContaining([expect.stringContaining('repeats the word "journal"')]));
  });

  it('reports a text that is the English one, or not written in the script of its language', () => {
    const dir = fixture();
    write(dir, 'it-IT', 'full.txt', read(dir, 'en-US', 'full.txt'));
    write(dir, 'ru-RU', 'short.txt', 'Lichnyj dnevnik: nastroenie, privychki. Shifrovanie, rabotaet oflajn.\n');
    write(dir, 'ja-JP', 'short.txt', 'Private diary with mood, habits and insights.\n');
    expect(problemsOf(dir, 'it-IT', 'full.txt')).toContain('is the English text, not a translation');
    expect(problemsOf(dir, 'ru-RU', 'short.txt')).toEqual(expect.arrayContaining([expect.stringContaining('is not written in Cyrillic')]));
    expect(problemsOf(dir, 'ja-JP', 'short.txt')).toEqual(expect.arrayContaining([expect.stringContaining('is not written in Hiragana / Katakana / Han')]));
  });

  it('reports the old local-only claims: stored only on the device, no cloud, no server', () => {
    const cases: Array<[string, string]> = [
      ['en-US', 'Your diary is stored only on your device.\n'],
      ['en-US', 'A private diary that stays on your phone. No cloud.\n'],
      ['en-US', 'Your entries never leave your device.\n'],
      ['iw-IL', 'היומן נשמר רק בטלפון שלכם, בלי ענן.\n'],
      ['de-DE', 'Dein Tagebuch bleibt nur auf deinem Gerät, ohne Cloud.\n'],
      ['fr-FR', 'Votre journal reste uniquement sur votre appareil.\n'],
      ['es-ES', 'Tu diario se guarda solo en tu teléfono, sin nube.\n'],
      ['ru-RU', 'Дневник хранится только на вашем устройстве.\n'],
      ['zh-CN', '日记仅保存在您的手机上。\n'],
      ['tr-TR', 'Günlüğünüz yalnızca cihazınızda saklanır.\n'],
    ];
    for (const [locale, text] of cases) {
      expect(textProblems(locale, 'short.txt', text).some((p) => p.includes('the apps are server-based')), `${locale}: ${text}`).toBe(true);
    }
  });

  it('reports end-to-end and zero-knowledge claims (the server decrypts the diary while you are signed in)', () => {
    const cases: Array<[string, string]> = [
      ['en-US', 'End-to-end encrypted: only you can read your diary.\n'],
      ['en-US', 'Zero-knowledge encryption, not even we can open it.\n'],
      ['de-DE', 'Ende-zu-Ende-verschlüsseltes Tagebuch.\n'],
      ['fr-FR', 'Journal chiffré de bout en bout.\n'],
      ['zh-CN', '端到端加密的私密日记。\n'],
      ['iw-IL', 'יומן מוצפן מקצה לקצה.\n'],
    ];
    for (const [locale, text] of cases) {
      expect(textProblems(locale, 'short.txt', text).some((p) => p.includes('end-to-end / zero-knowledge')), `${locale}: ${text}`).toBe(true);
    }
  });

  it('reports layout faults: byte-order mark, missing final line break, spaces at the ends of lines, double spaces, tabs', () => {
    const faults: Array<[string, string]> = [
      ['﻿Private diary with mood and habits.\n', 'starts with a byte-order mark'],
      ['Private diary with mood and habits.', 'does not end with a line break'],
      ['Private diary with mood and habits. \n', 'has a space at the end of a line'],
      ['Private diary  with mood and habits.\n', 'has two spaces in a row'],
      ['Private diary\twith mood and habits.\n', 'contains a tab'],
      ['Private diary with mood and habits.\n\n', 'ends with an empty line'],
    ];
    for (const [text, problem] of faults) expect(textProblems('en-US', 'short.txt', text), JSON.stringify(text)).toContain(problem);
  });

  it('a fixture copy of the real listing is clean (the mutations above are what fails)', () => {
    const dir = fixture();
    const result = checkListing(dir);
    expect(result.problems).toEqual([]);
    expect(result.rows.filter((r) => r.problems.length)).toEqual([]);
    expect(result.ok).toBe(true);
  });
});
