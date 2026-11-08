// @vitest-environment node
/**
 * The Android identity (owner decision 2026-10-25, docs/android-tasks/ANDROID-APP-ID.md): the
 * application id is app.yourpersonaldiary (com.mydiary.app is taken on Google Play), the Java
 * namespace stays com.mydiary.app. The application id can never change after the first Play upload,
 * so every copy of it must agree with android/app/build.gradle - the one place the build reads - and
 * nothing may still carry the old id as an application id. The Windows app keeps com.mydiary.app.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import capacitorConfig from '../../capacitor.config';

const projectRoot = process.cwd();
const read = (relative: string): string => readFileSync(path.join(projectRoot, relative), 'utf8');

const APP_ID = 'app.yourpersonaldiary';
const NAMESPACE = 'com.mydiary.app';

const gradle = read('android/app/build.gradle');
const manifest = read('android/app/src/main/AndroidManifest.xml');
const envPs1 = read('scripts/android/env.ps1');

function single(text: string, re: RegExp, what: string): string {
  const all = [...text.matchAll(new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`))];
  expect(all.length, what).toBe(1);
  return all[0][1];
}

describe('android/app/build.gradle: application id and namespace, split', () => {
  it('appId is app.yourpersonaldiary, appNamespace com.mydiary.app', () => {
    expect(single(gradle, /^def appId = '([^']+)'$/m, 'def appId')).toBe(APP_ID);
    expect(single(gradle, /^def appNamespace = '([^']+)'$/m, 'def appNamespace')).toBe(NAMESPACE);
  });

  it('applicationId reads appId and namespace reads appNamespace - nothing else sets or suffixes them', () => {
    expect(single(gradle, /^\s*applicationId\s+(\S+)\s*$/m, 'applicationId')).toBe('appId');
    expect(single(gradle, /^\s*namespace\s*=\s*(\S+)\s*$/m, 'namespace')).toBe('appNamespace');
    // A suffix or a flavor would make the installed package differ from the id checked everywhere.
    expect(gradle).not.toMatch(/applicationIdSuffix|productFlavors/);
  });

  it('is a valid package name for Android and Capacitor (two or more segments, each starting with a letter)', () => {
    // Capacitor CLI checkAppId; Android additionally wants lower case for a Play package name.
    expect(APP_ID).toMatch(/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/);
    expect(APP_ID).not.toBe(NAMESPACE);
  });
});

describe('every copy of the application id agrees with build.gradle', () => {
  it('capacitor.config.ts appId', () => {
    expect(capacitorConfig.appId).toBe(APP_ID);
  });

  it('the packaged copy android/app/src/main/assets/capacitor.config.json (written by cap sync)', () => {
    const file = 'android/app/src/main/assets/capacitor.config.json';
    if (!existsSync(path.join(projectRoot, file))) return;
    expect((JSON.parse(read(file)) as { appId?: string }).appId).toBe(APP_ID);
  });

  it('strings.xml package_name and custom_url_scheme', () => {
    const strings = read('android/app/src/main/res/values/strings.xml');
    expect(single(strings, /<string name="package_name">([^<]*)<\/string>/, 'package_name')).toBe(APP_ID);
    expect(single(strings, /<string name="custom_url_scheme">([^<]*)<\/string>/, 'custom_url_scheme')).toBe(APP_ID);
  });

  it('scripts/android/env.ps1: $AppId, $AppNamespace (and the old id only as $LegacyAppId)', () => {
    expect(single(envPs1, /^\$AppId = '([^']+)'$/m, '$AppId')).toBe(APP_ID);
    expect(single(envPs1, /^\$AppNamespace = '([^']+)'$/m, '$AppNamespace')).toBe(NAMESPACE);
    expect(single(envPs1, /^\$LegacyAppId = '([^']+)'$/m, '$LegacyAppId')).toBe('com.mydiary.app');
  });
});

describe('the namespace: the Java package of the code, not the identity', () => {
  it('MainActivity (and the plugins) are in com.mydiary.app, where build.gradle says the namespace is', () => {
    const dir = `android/app/src/main/java/${NAMESPACE.split('.').join('/')}`;
    expect(read(`${dir}/MainActivity.java`)).toMatch(new RegExp(`^package ${NAMESPACE.replace(/\./g, '\\.')};`, 'm'));
    for (const plugin of ['DiaryFilesPlugin', 'DiaryPrivacyScreenPlugin', 'DiaryBiometricPlugin']) {
      expect(read(`${dir}/plugins/${plugin}.java`), plugin).toMatch(new RegExp(`^package ${NAMESPACE.replace(/\./g, '\\.')}\\.plugins;`, 'm'));
    }
  });

  it('the manifest names the activity relative to the namespace and derives authorities from ${applicationId}', () => {
    expect(manifest).toContain('android:name=".MainActivity"');
    expect(manifest).toContain('android:authorities="${applicationId}.fileprovider"');
    // No id written out literally: neither the new one nor the old one (as an authority, scheme, ...).
    expect(manifest).not.toContain(APP_ID);
    expect(manifest).not.toContain('com.mydiary.app');
    // Deep links: files only (content: / file:), no custom URL scheme.
    const schemes = [...manifest.matchAll(/android:scheme="([^"]+)"/g)].map((m) => m[1]);
    expect([...new Set(schemes)].sort()).toEqual(['content', 'file']);
  });

  it('the scripts start and verify the activity as <namespace>.MainActivity inside the package <appId>', () => {
    const install = read('scripts/android/install-phone.ps1');
    expect(install).toContain('"$AppId/$AppNamespace.MainActivity"');
    expect(install).not.toContain('$AppId/.MainActivity');
    const verify = read('scripts/android/verify-apk.ps1');
    expect(verify).toContain('$mainActivityName = "$AppNamespace.MainActivity"');
    expect(verify).not.toContain('"$AppId.MainActivity"');
  });
});

describe('what keeps com.mydiary.app', () => {
  it('the Windows app identifier (data folder %APPDATA%\\com.mydiary.app) is unchanged', () => {
    const tauri = JSON.parse(read('src-tauri/tauri.conf.json')) as { identifier?: string };
    expect(tauri.identifier).toBe('com.mydiary.app');
  });
});
