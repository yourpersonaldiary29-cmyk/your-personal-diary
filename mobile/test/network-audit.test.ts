// @vitest-environment node
/**
 * scripts/check-no-network.mjs must audit mobile/** with the same rules as the frontend and no
 * allow-list entry. The script is run against small throw-away trees (`--root=<dir>`), never
 * against files planted in the project, and once against the project itself.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const projectRoot = process.cwd();
const script = path.join(projectRoot, 'scripts', 'check-no-network.mjs');

const trees: string[] = [];

/** A minimal project tree: the two package.json files the audit reads, plus `files`. */
function tree(files: Record<string, string>): string {
  const root = mkdtempSync(path.join(os.tmpdir(), 'mpd-network-audit-'));
  trees.push(root);
  const all: Record<string, string> = {
    'package.json': '{ "dependencies": {} }',
    'server/package.json': '{ "dependencies": {} }',
    ...files,
  };
  for (const [name, content] of Object.entries(all)) {
    const full = path.join(root, name);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
  return root;
}

function audit(root?: string): { status: number | null; output: string } {
  const result = spawnSync(process.execPath, root ? [script, `--root=${root}`] : [script], { encoding: 'utf8' });
  return { status: result.status, output: `${result.stdout}\n${result.stderr}` };
}

afterEach(() => {
  for (const root of trees.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('network audit covers mobile/**', () => {
  it('passes a mobile tree that only talks to the local core', () => {
    const result = audit(
      tree({
        'mobile/host/core-client.ts': "export const base = new URL('/api/health', 'http://localhost');\n",
        'mobile/vite.config.mobile.ts': "export const dev = 'ws://127.0.0.1:*';\n",
      }),
    );
    expect(result.output).toContain('Network audit passed');
    expect(result.status).toBe(0);
  });

  it('fails on an external URL anywhere under mobile/', () => {
    const result = audit(
      tree({
        'mobile/host/telemetry.ts': "export const send = () => fetch('https://example.com/collect');\n",
        'mobile/core/deep/sync.ts': "export const SYNC = 'http://sync.example.org/v1';\n",
      }),
    );
    expect(result.status).toBe(1);
    expect(result.output).toContain('mobile/host/telemetry.ts:1: external URL');
    expect(result.output).toContain('mobile/core/deep/sync.ts:1: external URL');
  });

  it('fails on outbound client modules and beacons under mobile/', () => {
    const result = audit(
      tree({
        'mobile/core/net.ts': "import https from 'node:https';\nexport default https;\n",
        'mobile/host/http.ts': "import axios from 'axios';\nexport default axios;\n",
        'mobile/host/beacon.ts': "export const ping = () => navigator.sendBeacon('/x');\n",
      }),
    );
    expect(result.status).toBe(1);
    expect(result.output).toContain('mobile/core/net.ts:1: network client module');
    expect(result.output).toContain('mobile/host/http.ts:1: outbound HTTP client');
    expect(result.output).toContain('mobile/host/beacon.ts:1: beacon');
  });

  it('does not scan tests or build outputs', () => {
    const leak = "export const leak = 'https://example.com/collect';\n";
    const result = audit(
      tree({
        'mobile/host/thing.test.ts': leak,
        'mobile/test/fixture.ts': leak,
        'mobile/node_modules/pkg/index.js': leak,
        'mobile-dist/assets/index.js': leak,
        'dist/assets/index.js': leak,
      }),
    );
    expect(result.output).toContain('Network audit passed');
    expect(result.status).toBe(0);
  });

  it('still audits the frontend in the same run', () => {
    const result = audit(tree({ 'src/api/leak.ts': "export const leak = 'https://example.com/collect';\n" }));
    expect(result.status).toBe(1);
    expect(result.output).toContain('src/api/leak.ts:1: external URL');
  });

  it('the project itself passes, mobile/ included', () => {
    const result = audit();
    expect(result.output).toContain('Network audit passed');
    expect(result.status).toBe(0);
  });
});

describe('network audit covers the Android native code (android/app/src/main/java|kotlin)', () => {
  const manifest = (permissions: string[]) =>
    '<manifest xmlns:android="http://schemas.android.com/apk/res/android">\n' +
    permissions.map((p) => `  <uses-permission android:name="${p}" />\n`).join('') +
    '  <application android:allowBackup="false"><activity android:name=".MainActivity" android:exported="true" /></application>\n</manifest>\n';

  it('passes a Capacitor-style activity, file plugins and a manifest with INTERNET only', () => {
    const result = audit(
      tree({
        'android/app/src/main/AndroidManifest.xml': manifest(['android.permission.INTERNET']),
        'android/app/src/main/java/com/example/MainActivity.java':
          'package com.example;\nimport android.os.Bundle;\nimport com.getcapacitor.BridgeActivity;\n' +
          'public class MainActivity extends BridgeActivity {\n  @Override public void onCreate(Bundle b) { super.onCreate(b); bridge.getWebView().setBackgroundColor(0); }\n}\n',
        'android/app/src/main/java/com/example/FilesPlugin.java':
          'package com.example;\nimport android.net.Uri;\nimport java.nio.channels.FileChannel;\nimport java.io.InputStream;\n' +
          'public class FilesPlugin {\n  String url = "file:///data";\n  InputStream open(android.content.ContentResolver r, Uri uri) throws Exception { return r.openInputStream(uri); }\n}\n',
      }),
    );
    expect(result.output).toContain('Network audit passed');
    expect(result.status).toBe(0);
  });

  it('fails on fully-qualified network classes and constructors', () => {
    const result = audit(
      tree({
        'android/app/src/main/java/x/Leak.java':
          'package x;\nimport java.net.Socket;\npublic class Leak {\n  void go() throws Exception { new Socket("example.org", 443).getOutputStream().write(1); }\n}\n',
      }),
    );
    expect(result.status).toBe(1);
    expect(result.output).toContain('android/app/src/main/java/x/Leak.java:2: Java network class');
    expect(result.output).toContain('android/app/src/main/java/x/Leak.java:4: network connection');
  });

  it('fails on wildcard imports and socket factories that never name the class', () => {
    const result = audit(
      tree({
        'android/app/src/main/java/x/Leak.java':
          'package x;\nimport java.net.*;\nimport javax.net.*;\npublic class Leak {\n  void go() throws Exception {\n' +
          '    Socket s = SocketFactory.getDefault().createSocket("example.org", 443);\n    s.getOutputStream().write(1);\n' +
          '    Object c = u.openConnection();\n  }\n}\n',
      }),
    );
    expect(result.status).toBe(1);
    expect(result.output).toContain('android/app/src/main/java/x/Leak.java:2: wildcard import of a network package');
    expect(result.output).toContain('android/app/src/main/java/x/Leak.java:3: wildcard import of a network package');
    expect(result.output).toContain('android/app/src/main/java/x/Leak.java:6: ');
    expect(result.output).toContain('android/app/src/main/java/x/Leak.java:8: socket factory / connection call');
  });

  it('fails on Kotlin sockets, TLS factories and address lookups', () => {
    const result = audit(
      tree({
        'android/app/src/main/kotlin/y/Leak.kt':
          'package y\nimport javax.net.ssl.*\nclass Leak {\n  fun go() {\n' +
          '    val s: Socket = SSLSocketFactory.getDefault().createSocket("example.org", 443)\n' +
          '    val a = InetAddress.getByName("example.org")\n    val c = URL("http://example.org/").openStream()\n  }\n}\n',
      }),
    );
    expect(result.status).toBe(1);
    expect(result.output).toContain('android/app/src/main/kotlin/y/Leak.kt:2: wildcard import of a network package');
    expect(result.output).toContain('android/app/src/main/kotlin/y/Leak.kt:5: ');
    expect(result.output).toContain('android/app/src/main/kotlin/y/Leak.kt:6: network class');
    expect(result.output).toContain('android/app/src/main/kotlin/y/Leak.kt:7: ');
  });

  it('fails on HTTP client libraries and a manifest permission outside the allow-list', () => {
    const result = audit(
      tree({
        'android/app/src/main/AndroidManifest.xml': manifest(['android.permission.INTERNET', 'android.permission.ACCESS_FINE_LOCATION']),
        'android/app/src/main/java/x/Http.java': 'package x;\nimport okhttp3.OkHttpClient;\npublic class Http { OkHttpClient c = new OkHttpClient(); }\n',
      }),
    );
    expect(result.status).toBe(1);
    expect(result.output).toContain('android/app/src/main/java/x/Http.java:2: HTTP client library');
    expect(result.output).toContain('permission android.permission.ACCESS_FINE_LOCATION is not on the allow-list');
  });

  it('does not scan Android build outputs or test sources', () => {
    const leak = 'package x;\nimport java.net.*;\nclass L { Object s = new java.net.Socket("example.org", 443); }\n';
    const result = audit(
      tree({
        'android/app/build/generated/x/L.java': leak,
        'android/app/src/test/java/x/L.java': leak,
        'android/app/src/androidTest/java/x/L.java': leak,
        'android/capacitor-cordova-android-plugins/src/main/java/x/L.java': leak,
      }),
    );
    expect(result.output).toContain('Network audit passed');
    expect(result.status).toBe(0);
  });
});
