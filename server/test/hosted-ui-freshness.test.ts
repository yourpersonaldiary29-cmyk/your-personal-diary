/**
 * docs/android-tasks/PRIVACY-HARDENING.md, fixer finding "the hand-over build (deploy/hosted/build/ui)
 * and dist/ still serve the old privacy policy text": public/privacy/** had been rebuilt by
 * scripts/legal/build-pages.mjs, dist/ had not, and scripts/build-hosted.mjs copied the old dist/ (the
 * old policy) into the hand-over directory without a word. scripts/hosted/ui-freshness.mjs now finds
 * every public/ file whose copy in dist/ is missing or different, and both build-hosted.mjs and
 * stage-image.mjs refuse such a dist/.
 */
import fs from 'node:fs';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { staleUiFiles, staleUiMessage } from '../../scripts/hosted/ui-freshness.mjs';
import { cleanupTempDirs, tempDataDir } from './helpers';

const ROOT = path.resolve(__dirname, '..', '..');
afterAll(cleanupTempDirs);

function writeTree(dir: string, files: Record<string, string>): void {
  for (const [rel, text] of Object.entries(files)) {
    const file = path.join(dir, ...rel.split('/'));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
  }
}

const PUBLIC = {
  'favicon.svg': '<svg/>',
  'privacy/index.html': '<p>A password reset request does not open your diary.</p>',
  'privacy/de/index.html': '<p>Fiktiver Text</p>',
  'delete-account/index.html': '<p>Delete</p>',
};

describe('scripts/hosted/ui-freshness.mjs', () => {
  it('a dist/ built after the last change of public/ is current (extra build output is fine)', () => {
    const dir = tempDataDir();
    writeTree(path.join(dir, 'public'), PUBLIC);
    writeTree(path.join(dir, 'dist'), { ...PUBLIC, 'index.html': '<div id="root"></div>', 'assets/index-abc.js': 'console.log(1)' });
    expect(staleUiFiles(path.join(dir, 'public'), path.join(dir, 'dist'))).toEqual([]);
  });

  it('the case that happened: the policy page changed in public/ after the build - and a page missing from dist/', () => {
    const dir = tempDataDir();
    writeTree(path.join(dir, 'public'), PUBLIC);
    const { ['delete-account/index.html']: _missing, ...built } = PUBLIC;
    writeTree(path.join(dir, 'dist'), { ...built, 'privacy/index.html': '<p>The server opens your diary to read its language.</p>', 'index.html': '<div></div>' });
    const stale = staleUiFiles(path.join(dir, 'public'), path.join(dir, 'dist'));
    expect(stale).toEqual(['delete-account/index.html', 'privacy/index.html']);
    expect(staleUiMessage('build-hosted', stale)).toBe(
      '[build-hosted] FAILED: dist/ is older than public/ (delete-account/index.html, privacy/index.html differ) - run "npx vite build" first, then run this again',
    );
    expect(staleUiMessage('x', ['a', 'b', 'c', 'd', 'e'])).toContain('a, b, c, ... (5 files)');
  });

  it('a directory in dist/ where public/ has a file counts as stale; no public/ at all means nothing to compare', () => {
    const dir = tempDataDir();
    writeTree(path.join(dir, 'public'), { 'favicon.svg': '<svg/>' });
    fs.mkdirSync(path.join(dir, 'dist', 'favicon.svg'), { recursive: true });
    expect(staleUiFiles(path.join(dir, 'public'), path.join(dir, 'dist'))).toEqual(['favicon.svg']);
    expect(staleUiFiles(path.join(dir, 'nothing-here'), path.join(dir, 'dist'))).toEqual([]);
  });

  it('build-hosted.mjs refuses a stale dist/ before it writes anything; stage-image.mjs never stages one', () => {
    const build = fs.readFileSync(path.join(ROOT, 'scripts', 'build-hosted.mjs'), 'utf8');
    expect(build).toContain("from './hosted/ui-freshness.mjs'");
    const check = build.indexOf('staleUiFiles(');
    expect(check).toBeGreaterThan(0);
    // Before the output directory is created and before the bundle is built.
    expect(check).toBeLessThan(build.indexOf('mkdirSync(outDir'));
    expect(check).toBeLessThan(build.indexOf('await build('));
    expect(build.slice(check, check + 400)).toContain('process.exit(1)');

    const stage = fs.readFileSync(path.join(ROOT, 'scripts', 'hosted', 'stage-image.mjs'), 'utf8');
    expect(stage).toContain("from './ui-freshness.mjs'");
    const staleAt = stage.indexOf('staleUiFiles(');
    expect(staleAt).toBeGreaterThan(0);
    expect(staleAt).toBeLessThan(stage.indexOf("fs.cpSync(UI_DIR, path.join(outDir, 'ui')"));
  });
});
