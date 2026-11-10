/**
 * The manual half of the offline e2e (docs/android-tasks/OFFLINE-DESIGN.md section 9 "Manual"): the
 * owner's checklists docs/OFFLINE-TEST.he.md and docs/ANDROID-PHONE-TEST.he.md (section 6) tell him
 * which texts to look for on the screen. They must name the controls the app really shows, in the
 * Hebrew the app really renders (shared/i18n/messages/he/shell.ts), or he is sent looking for a label
 * that belongs to another control or never appears:
 *
 *  - the status bar's button is `shell.sync.tryNow` ("נסה עכשיו"); `shell.retry` ("נסה שוב") is the
 *    button of the NeedsConnection notice and of the full "no connection" page;
 *  - the counters are ICU plurals: with one change the bar shows the `one` form ("שינוי אחד ממתין",
 *    "מעלה שינוי אחד…"), never the `other` form with a 1 in it ("1 שינויים ממתינים").
 *
 * Regression test of a verified finding of the WP-H10d e2e review. It reads the shipped strings, so a
 * changed translation fails here until the checklist follows it - which is the point.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { t, type Params } from '@shared/i18n';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

const he = (key: string, params?: Params): string => t('he', key, params);
/** One line, single spaces: the checklists wrap long sentences over indented lines. */
const norm = (s: string): string => s.replace(/\s+/g, ' ').trim();
/** The checklists quote sentences without their final period. */
const sansPeriod = (s: string): string => s.replace(/\.$/, '');

/** The numbered steps of a checklist (a step and its indented continuation lines), whitespace-normalised. */
function stepsOf(markdown: string): string[] {
  const out: string[] = [];
  let current: string[] | null = null;
  const flush = () => {
    if (current) out.push(norm(current.join(' ')));
    current = null;
  };
  for (const line of markdown.split(/\r?\n/)) {
    if (/^\s{0,3}\d+\.\s/.test(line)) {
      flush();
      current = [line];
    } else if (current && /^\s+\S/.test(line)) {
      current.push(line);
    } else {
      flush();
    }
  }
  flush();
  return out;
}

interface Checklist {
  file: string;
  /** The keys whose Hebrew text the checklist quotes (compared without the final period). */
  labels: string[];
  /** Plural keys the checklist quotes with one change: the `one` form must be there. */
  oneForms: string[];
}

const CHECKLISTS: Checklist[] = [
  {
    file: 'docs/OFFLINE-TEST.he.md',
    labels: [
      'shell.sync.offline',
      'shell.sync.tryNow',
      'shell.sync.review',
      'shell.sync.savedOnDevice',
      'shell.sync.allSaved',
      'shell.sync.badgeWaiting',
      'shell.sync.needsConnection',
      'shell.retry',
      'shell.sync.lock.deviceUnlock',
      'shell.sync.lock.offline',
      // Offline unlock by password (2026-11-08): the note under the field and the wrong-password error.
      'shell.sync.lock.passwordOffline',
      'shell.lock.wrongPassword',
      'shell.sync.lock.passwordToUpload',
      'shell.sync.logout.title',
      'shell.sync.logout.stay',
      'shell.sync.logout.delete',
      'shell.sync.action.showMine',
      'shell.sync.action.saveAsNew',
      'shell.sync.action.copy',
      'shell.sync.action.ok',
    ],
    oneForms: ['shell.sync.waiting', 'shell.sync.attention', 'shell.sync.logout.text'],
  },
  {
    file: 'docs/ANDROID-PHONE-TEST.he.md',
    labels: ['shell.sync.offline', 'shell.sync.tryNow', 'shell.sync.savedOnDevice', 'shell.sync.allSaved', 'shell.sync.badgeWaiting', 'shell.sync.needsConnection', 'shell.sync.lock.deviceUnlock', 'shell.sync.lock.passwordToUpload'],
    oneForms: ['shell.sync.waiting', 'shell.sync.uploading'],
  },
];

/** Plural keys of the bar and its dialogs: their `other` form with a 1 in it is never rendered. */
const COUNTERS = ['shell.sync.waiting', 'shell.sync.uploading', 'shell.sync.attention', 'shell.sync.logout.text', 'shell.sync.login.waiting', 'shell.sync.deleteAccount.pending'];

describe.each(CHECKLISTS)('$file quotes the app as it renders it', ({ file, labels, oneForms }) => {
  const raw = fs.readFileSync(path.join(projectRoot, file), 'utf8');
  const text = norm(raw);
  const steps = stepsOf(raw);
  const bar = sansPeriod(he('shell.sync.offline'));
  const tryNow = he('shell.sync.tryNow');
  const retry = he('shell.retry');

  it('the steps that describe the status bar name its own button, never the "try again" of the connection notice', () => {
    expect(tryNow).not.toBe(retry);
    const barSteps = steps.filter((s) => s.includes(bar));
    expect(barSteps.length).toBeGreaterThan(0);
    for (const step of barSteps) expect(step).not.toContain(`"${retry}"`);
    expect(barSteps.some((s) => s.includes(`"${tryNow}"`))).toBe(true);
  });

  it('counters are quoted as the ICU plural renders one change, never as the many-form with a 1', () => {
    for (const key of COUNTERS) {
      const one = he(key, { count: 1 });
      const many = he(key, { count: 3 });
      expect(many).toContain('3');
      const neverRendered = many.replace('3', '1');
      expect(one, key).not.toBe(neverRendered);
      expect(text, key).not.toContain(neverRendered);
    }
    for (const key of oneForms) expect(text, key).toContain(sansPeriod(he(key, { count: 1 })));
  });

  it('every label the owner is told to look for is the shipped Hebrew string', () => {
    for (const key of labels) {
      const label = sansPeriod(he(key));
      expect(label, key).not.toBe(key);
      expect(text, key).toContain(label);
    }
  });

  it('the conflict line is the shipped sentence with the test entry as its title', () => {
    if (file !== 'docs/OFFLINE-TEST.he.md') return;
    expect(text).toContain(he('shell.sync.reason.lost', { title: 'בדיקה 3 – התנגשות' }));
  });

  it('the wait after three wrong passwords is quoted as the app renders two seconds', () => {
    if (file !== 'docs/OFFLINE-TEST.he.md') return;
    expect(text).toContain(sansPeriod(he('shell.sync.lock.wait', { seconds: 2 })));
  });
});
