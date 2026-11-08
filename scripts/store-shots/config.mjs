/**
 * Shared settings of the Store screenshot scripts (scripts/store-shots/*).
 *
 * Everything that is specific to this machine lives in the scratch TOOL folder outside the
 * repository (default C:\Users\AVI\Projects\mpd-store-tools, override with MPD_STORE_TOOLS):
 * the playwright-core node_modules, the UI build the screenshot server serves, the temporary
 * data directory of the two fictional accounts and the server logs. The repository only gets
 * the PNGs under store/screenshots/.
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
/** The tool folder: $MPD_STORE_TOOLS, else <project>/mpd-store-tools (as render-screenshots.mjs toolDir), else the round-one path. */
export const TOOL_DIR =
  process.env.MPD_STORE_TOOLS ||
  (fs.existsSync(path.join(REPO_ROOT, 'mpd-store-tools', 'node_modules', 'playwright-core')) ? path.join(REPO_ROOT, 'mpd-store-tools') : 'C:\\Users\\AVI\\Projects\\mpd-store-tools');
export const DIST_DIR = path.join(TOOL_DIR, 'dist');
export const DATA_DIR = path.join(TOOL_DIR, 'data');
export const LOG_DIR = path.join(TOOL_DIR, 'logs');
/** The made-up passwords of the fictional accounts (kept outside the repo, deleted with the data). */
export const ACCOUNTS_FILE = path.join(TOOL_DIR, 'accounts.local.json');

export const PORT = Number(process.env.MPD_SHOTS_PORT || 47641);
export const BASE_URL = `http://127.0.0.1:${PORT}`;

export const SCREENSHOTS_DIR = path.join(REPO_ROOT, 'store', 'screenshots');
export const LOGOS_DIR = path.join(SCREENSHOTS_DIR, 'logos');

/** Desktop screenshots: 1920x1080 (Microsoft: at least 1366x768, PNG). */
export const VIEWPORT = { width: 1920, height: 1080 };

/** Where the installed Microsoft Edge is (playwright-core launches it with channel 'msedge'). */
export const EDGE_EXE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

/**
 * Loads a module from the TOOL folder's node_modules (playwright-core is installed there only,
 * never in the project - see docs/store-tasks/SHOTS.md).
 */
export function requireFromTools(name) {
  const req = createRequire(path.join(TOOL_DIR, 'package.json'));
  try {
    return req(name);
  } catch (e) {
    throw new Error(
      `${name} is not installed in ${TOOL_DIR}. Run there: npm init -y && npm install playwright-core (${e.message})`,
    );
  }
}

/** The two fictional accounts of the listing screenshots: one per Store listing language. */
export const ACCOUNTS = [
  {
    key: 'en-US',
    locale: 'en',
    username: 'dana',
    firstName: 'Dana',
    lastName: 'Levi',
    email: 'dana@example.com',
    deviceName: 'Computer',
  },
  {
    key: 'he-IL',
    locale: 'he',
    username: 'dana_he',
    firstName: 'דנה',
    lastName: 'לוי',
    email: 'dana.he@example.com',
    deviceName: 'מחשב',
  },
];

/** Demo data: enough days back for the English calendar shot (April 2026, Easter) to carry mood data. */
export const SEED_DAYS = 240;
