#!/usr/bin/env node
/**
 * Bumps the Android versionCode (android/app/version.properties). Google Play rejects an upload
 * whose versionCode is not higher than every code uploaded before, so run this before each upload:
 *
 *   node scripts/android/bump-version.mjs            versionCode N -> N+1
 *   node scripts/android/bump-version.mjs --set 42   versionCode -> 42 (must be higher than now)
 *   node scripts/android/bump-version.mjs --dry-run  only prints what would change
 *
 * versionName is not touched here: it is the "version" of package.json (shared with the desktop app),
 * read by android/app/build.gradle at build time.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const versionFile = path.join(projectRoot, 'android', 'app', 'version.properties');
const packageJson = JSON.parse(readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const setIndex = args.indexOf('--set');
const explicit = setIndex >= 0 ? Number.parseInt(args[setIndex + 1] ?? '', 10) : null;
if (setIndex >= 0 && (!Number.isInteger(explicit) || explicit <= 0)) {
  console.error('usage: bump-version.mjs [--set <positive integer>] [--dry-run]');
  process.exit(2);
}

const text = readFileSync(versionFile, 'utf8');
const match = /^versionCode=(\d+)\s*$/m.exec(text);
if (!match) {
  console.error(`${versionFile}: no "versionCode=<n>" line found`);
  process.exit(1);
}
const current = Number.parseInt(match[1], 10);
const next = explicit ?? current + 1;
if (next <= current) {
  console.error(`versionCode must increase: current ${current}, requested ${next}`);
  process.exit(1);
}

if (!dryRun) {
  writeFileSync(versionFile, text.replace(match[0], `versionCode=${next}`));
}
console.log(`${dryRun ? '[dry-run] ' : ''}versionCode ${current} -> ${next} (versionName ${packageJson.version} from package.json)`);
