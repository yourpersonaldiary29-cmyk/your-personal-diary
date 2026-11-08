/**
 * Stage-A fixer (docs/HOSTED-PLAN.md 5.8 rule 2): the forbidden-string audit of the hosted bundle must
 * use CODE-ONLY markers of remote access and the Android shim - never the plan's bare `duckdns.org` /
 * `letsencrypt.org`, which the i18n help texts of every locale contain. With the bare strings
 * scripts/hosted/stage-image.mjs refused every real hosted bundle and deploy.ps1 stopped before
 * `fly deploy` (finding: "Deploy is blocked"). Both scripts now share scripts/hosted/bundle-audit.mjs.
 *
 *   - no marker occurs in the i18n catalogues (which ship in every bundle), while the catalogues DO
 *     contain `duckdns.org` - the reason bare markers are unusable;
 *   - every marker occurs in the source it stands for (server/src/remote/**, mobile/core/express-shim),
 *     so the audit still catches a bundle that pulls that code in;
 *   - end to end: a hosted bundle built with build-hosted.mjs into a temp dir passes stage-image.mjs
 *     (exit 0, sha256 recorded), and the same bundle with `www.duckdns.org` appended is refused (exit 1).
 */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { FORBIDDEN_BUNDLE_STRINGS, forbiddenStringsIn } from '../../scripts/hosted/bundle-audit.mjs';
import { cleanupTempDirs, tempDataDir } from './helpers';

const ROOT = path.resolve(__dirname, '..', '..');
const I18N_DIR = path.join(ROOT, 'shared', 'i18n', 'messages');

afterAll(cleanupTempDirs);

function readTree(dir: string, ext: RegExp): string {
  let out = '';
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) out += readTree(full, ext);
    else if (ext.test(name)) out += fs.readFileSync(full, 'utf8') + '\n';
  }
  return out;
}

function runNode(args: string[]) {
  const r = spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', timeout: 120_000 });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

describe('scripts/hosted/bundle-audit.mjs - the shared forbidden-string list', () => {
  it('uses code-only markers: none occurs in the i18n catalogues, which ship in every bundle', () => {
    const catalogues = readTree(I18N_DIR, /\.ts$/);
    expect(catalogues.length).toBeGreaterThan(100_000);
    // The reason the plan's literal `duckdns.org` is unusable: the remote-access help texts name the host
    // (e.g. yourpersonaldiary.duckdns.org) in every locale. (Boolean checks: a failed toContain on the
    // whole catalogue text would print megabytes.)
    expect(catalogues.includes('duckdns.org')).toBe(true);
    expect(catalogues.includes('www.duckdns.org')).toBe(false);
    // The regression: the audit never fires on the catalogues.
    expect(forbiddenStringsIn(catalogues)).toEqual([]);
    expect(FORBIDDEN_BUNDLE_STRINGS).not.toContain('duckdns.org');
    expect(FORBIDDEN_BUNDLE_STRINGS).not.toContain('letsencrypt.org');
  });

  it('every marker stands for real code: remote access (DuckDNS, ACME, SSDP) and the Android shim', () => {
    const remote = readTree(path.join(ROOT, 'server', 'src', 'remote'), /\.ts$/);
    for (const s of ['www.duckdns.org', 'acme-v02.api.letsencrypt.org', 'acme-staging-v02.api.letsencrypt.org', '239.255.255.250', 'ssdp:discover']) {
      expect(FORBIDDEN_BUNDLE_STRINGS).toContain(s);
      expect(remote).toContain(s);
    }
    expect(FORBIDDEN_BUNDLE_STRINGS).toContain('express-shim');
    expect(fs.existsSync(path.join(ROOT, 'mobile', 'core', 'express-shim', 'index.ts'))).toBe(true);
    expect(forbiddenStringsIn(remote)).toEqual(expect.arrayContaining(['www.duckdns.org', '239.255.255.250']));
    expect(forbiddenStringsIn('require("../mobile/core/express-shim/index.ts")')).toEqual(['express-shim']);
  });

  it('is the list both scripts use (no second copy to drift)', () => {
    const stage = fs.readFileSync(path.join(ROOT, 'scripts', 'hosted', 'stage-image.mjs'), 'utf8');
    const build = fs.readFileSync(path.join(ROOT, 'scripts', 'build-hosted.mjs'), 'utf8');
    expect(stage).toContain("from './bundle-audit.mjs'");
    expect(build).toContain("from './hosted/bundle-audit.mjs'");
    for (const script of [stage, build]) {
      expect(script).not.toMatch(/\[\s*'duckdns\.org'/);
      expect(script).not.toContain("'letsencrypt.org'");
    }
  });
});

describe('scripts/hosted/stage-image.mjs against a real hosted bundle', () => {
  it('stages the bundle build-hosted.mjs produces (exit 0) and refuses one that carries remote-access code (exit 1)', () => {
    const buildDir = path.join(tempDataDir(), 'build');
    const built = runNode(['scripts/build-hosted.mjs', '--no-ui', '--out', buildDir]);
    expect({ status: built.status, stderr: built.stderr }).toMatchObject({ status: 0 });
    const bundle = path.join(buildDir, 'server-hosted.cjs');
    const text = fs.readFileSync(bundle, 'latin1');
    // The catalogues are in the bundle - the exact situation that tripped the old marker list.
    expect(text).toContain('duckdns.org');
    expect(forbiddenStringsIn(text)).toEqual([]);

    const outDir = path.join(tempDataDir(), 'image');
    const staged = runNode(['scripts/hosted/stage-image.mjs', `--bundle=${bundle}`, `--out=${outDir}`, '--no-ui']);
    expect({ status: staged.status, stderr: staged.stderr, stdout: staged.stdout }).toMatchObject({ status: 0 });
    expect(staged.stdout).toContain('[stage-image] OK');
    const manifest = JSON.parse(fs.readFileSync(path.join(outDir, '.staged.json'), 'utf8')) as { entry: { sha256: string }; fallback: boolean; files: string[] };
    expect(manifest.fallback).toBe(false);
    expect(manifest.entry.sha256).toBe(createHash('sha256').update(fs.readFileSync(bundle)).digest('hex'));
    expect(manifest.files).toEqual(expect.arrayContaining(['server-hosted.cjs', 'sql-wasm.wasm', 'fonts/']));
    expect(fs.existsSync(path.join(outDir, 'STAGED-WITH-LOCAL-FALLBACK'))).toBe(false);

    const doctored = path.join(buildDir, 'server-hosted-with-remote.cjs');
    fs.writeFileSync(doctored, text + '\n// const DUCKDNS_HOST = "www.duckdns.org";\n', 'latin1');
    const refused = runNode(['scripts/hosted/stage-image.mjs', `--bundle=${doctored}`, `--out=${path.join(tempDataDir(), 'image-bad')}`, '--no-ui']);
    expect(refused.status).toBe(1);
    expect(refused.stderr).toContain('forbidden string "www.duckdns.org"');
    // A plain substring of a help text alone would not have been enough to refuse it.
    expect(refused.stderr).not.toContain('forbidden string "duckdns.org"');
  }, 120_000);

  it('refuses a --bundle that does not exist (usage error, exit 2) and never stages a tree for it', () => {
    const outDir = path.join(tempDataDir(), 'image-none');
    const r = runNode(['scripts/hosted/stage-image.mjs', `--bundle=${path.join(outDir, 'missing.cjs')}`, `--out=${outDir}`, '--no-ui']);
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('--bundle');
    expect(fs.existsSync(path.join(outDir, '.staged.json'))).toBe(false);
  });
});
