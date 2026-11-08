// @vitest-environment node
/**
 * The mobile scaffold (WP-1): pinned Capacitor packages, npm scripts, the Capacitor configuration
 * and the docs that describe them: the Android build commands of README.md section 5.5 ("בנייה",
 * part "Android") and the state of WP-1 / WP-6 in docs/ANDROID-PLAN.md.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import capacitorConfig from '../../capacitor.config';

const projectRoot = process.cwd();

function readText(relative: string): string {
  return readFileSync(path.join(projectRoot, relative), 'utf8');
}

function readJson<T>(relative: string): T {
  return JSON.parse(readText(relative)) as T;
}

interface PackageJson {
  version?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

const pkg = readJson<PackageJson>('package.json');

/** The Capacitor packages of the scaffold (WP-1); the plugins added later are pinned the same way. */
const CAPACITOR_PACKAGES = [
  '@capacitor/core',
  '@capacitor/cli',
  '@capacitor/android',
  '@capacitor/filesystem',
  '@capacitor/app',
  '@capacitor/preferences',
];

describe('mobile scaffold', () => {
  it('pins every Capacitor package to an exact 8.x version, as a devDependency', () => {
    for (const name of CAPACITOR_PACKAGES) {
      expect(pkg.devDependencies?.[name], name).toMatch(/^8\.\d+\.\d+$/);
      expect(pkg.dependencies?.[name], name).toBeUndefined();
    }
  });

  it('has exactly the pinned versions installed and locked', () => {
    const lock = readJson<{ packages: Record<string, { version?: string }> }>('package-lock.json');
    for (const name of CAPACITOR_PACKAGES) {
      const pinned = pkg.devDependencies?.[name];
      expect(readJson<PackageJson>(`node_modules/${name}/package.json`).version, `${name} installed`).toBe(pinned);
      expect(lock.packages[`node_modules/${name}`]?.version, `${name} locked`).toBe(pinned);
    }
  });

  it('keeps the core, the CLI and the Android platform on one version', () => {
    const dev = pkg.devDependencies ?? {};
    expect(dev['@capacitor/cli']).toBe(dev['@capacitor/core']);
    expect(dev['@capacitor/android']).toBe(dev['@capacitor/core']);
  });

  it('defines the mobile npm scripts', () => {
    expect(pkg.scripts).toMatchObject({
      'mobile:build': 'vite build -c mobile/vite.config.mobile.ts',
      'mobile:dev': 'vite -c mobile/vite.config.mobile.ts --port 1430 --strictPort',
      'mobile:typecheck': 'tsc --noEmit -p mobile/tsconfig.json',
      'mobile:test': 'vitest run -c mobile/vitest.config.ts',
      'android:sync': 'cap sync android',
    });
    // The desktop scripts are what they were.
    expect(pkg.scripts).toMatchObject({ build: 'tsc && vite build', test: 'vitest run', dev: 'vite' });
  });

  it('configures Capacitor for the bundled UI only (no server URL, no mixed content)', () => {
    expect(capacitorConfig).toEqual({
      // The Android application id (owner decision 2026-10-25, docs/android-tasks/ANDROID-APP-ID.md).
      appId: 'app.yourpersonaldiary',
      appName: 'Your Personal Diary',
      webDir: 'mobile-dist',
      server: { androidScheme: 'https' },
      android: { allowMixedContent: false },
      // The iPhone app's section (docs/APPLE-PLAN.md WP-A2; mobile/test/ios-prep.test.ts): read by
      // the iOS runtime only. Everything Android reads above is what it was.
      ios: { contentInset: 'never', preferredContentMode: 'mobile', allowsLinkPreview: false },
    });
  });

  it('README section 5.5 documents the Android build commands, and each one exists in package.json and scripts/android', () => {
    const readme = readText('README.md').replace(/\r\n/g, '\n');
    const build = readme.indexOf('\n### 5.5 ');
    expect(build, 'the README heading "### 5.5"').toBeGreaterThan(-1);
    const buildEnd = readme.indexOf('\n### ', build + 1);
    const section = readme.slice(build, buildEnd === -1 ? undefined : buildEnd);
    const start = section.indexOf('\n**Android**');
    expect(start, 'the **Android** part of README 5.5').toBeGreaterThan(-1);
    const end = section.indexOf('\n**', start + 1);
    const android = section.slice(start, end === -1 ? undefined : end);

    // Every Android command of package.json is documented there, and nothing that does not exist.
    const documented = [...new Set([...android.matchAll(/npm run (android:[a-z]+)/g)].map((m) => m[1]))].sort();
    const defined = Object.keys(pkg.scripts ?? {})
      .filter((name) => name.startsWith('android:'))
      .sort();
    expect(documented.length).toBeGreaterThan(0);
    expect(documented).toEqual(defined);
    // Each one is `cap sync android` or runs a file of scripts/android that exists.
    for (const name of documented) {
      const command = pkg.scripts?.[name] ?? '';
      const files = [...command.matchAll(/scripts\/android\/[\w.-]+\.(?:ps1|mjs)/g)].map((m) => m[0]);
      if (command !== 'cap sync android') expect(files, `${name}: ${command}`).not.toEqual([]);
      for (const file of files) expect(existsSync(path.join(projectRoot, file)), `${name} -> ${file}`).toBe(true);
    }
    // The native project's Capacitor version named there is the pinned one.
    expect(android).toContain(`Capacitor ${pkg.devDependencies?.['@capacitor/core']}`);
  });

  it('the plan records the state of WP-1 and WP-6', () => {
    const plan = readText('docs/ANDROID-PLAN.md');
    expect(plan).toMatch(/\*\*WP-1 – בוצע/);
    expect(plan).toMatch(/\*\*WP-6 – בוצע/);
  });
});
