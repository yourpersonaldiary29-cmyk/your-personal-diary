/**
 * The operator tool may address 127.0.0.1 and nothing else (docs/HOSTED-PLAN.md 5.8 rule 4b,
 * docs/android-tasks/ADMIN-TOOL.md items 2 and 5):
 *   - scripts/hosted/bundle-audit.mjs `adminBundleProblems` finds every other host, IP, host option,
 *     network module and fetch() in a built admin.cjs - and nothing in the real one;
 *   - scripts/build-hosted.mjs writes admin.cjs next to server-hosted.cjs; scripts/hosted/stage-image.mjs
 *     stages it as /app/admin.cjs (the Dockerfile copies dist/ to /app/), refuses a doctored one and an
 *     image without one;
 *   - scripts/check-no-network.mjs keeps its source rule for scripts/hosted/admin.ts: the real file passes
 *     in a throw-away tree, a copy that names another host or the loopback name fails.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ADMIN_TOOL_FILE, ADMIN_TOOL_HOST, adminBundleProblems } from '../../scripts/hosted/bundle-audit.mjs';
import { cleanupTempDirs, tempDataDir } from './helpers';

const ROOT = path.resolve(__dirname, '..', '..');
/** The loopback host name, spelled in pieces so this file itself never names it. */
const LOOPBACK_NAME = ['local', 'host'].join('');

afterAll(cleanupTempDirs);

function runNode(args: string[], cwd = ROOT) {
  const r = spawnSync(process.execPath, args, { cwd, encoding: 'utf8', timeout: 120_000 });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

describe('adminBundleProblems', () => {
  const clean = 'const http = require("node:http");\nconst fs = require("fs");\nhttp.request({ host: "127.0.0.1", port, path: "/api/admin/accounts" });\n';

  it('accepts a tool that talks to 127.0.0.1 only', () => {
    expect(ADMIN_TOOL_FILE).toBe('admin.cjs');
    expect(ADMIN_TOOL_HOST).toBe('127.0.0.1');
    expect(adminBundleProblems(clean)).toEqual([]);
    expect(adminBundleProblems(`${clean}const u = "http://127.0.0.1:8080/api/admin/status";`)).toEqual([]);
  });

  it('finds every other way out', () => {
    const cases: Array<[string, RegExp]> = [
      ['const u = "https://diary.example.org/api";', /addresses https:\/\/diary\.example\.org/],
      ['const u = "http://127.0.0.1.attacker.example/";', /addresses http:\/\/127\.0\.0\.1\.attacker\.example/],
      ['http.request({ host: "10.0.0.5", port: 80 });', /host option "10\.0\.0\.5"/],
      ['http.request({ hostname: "db.internal" });', /host option "db\.internal"/],
      ["const target = '192.168.1.20';", /IP address 192\.168\.1\.20/],
      [`http.request({ host: "${LOOPBACK_NAME}" });`, /names "/],
      ['const https = require("https");', /network module "https"/],
      ['const net = require("node:net");', /network module "net"/],
      ["const dns = require('dns');", /network module "dns"/],
      ['const tls = require(`node:tls`);', /network module "tls"/],
      ['await fetch("/x");', /fetch\(\)/],
      ['new WebSocket("ws://x");', /WebSocket/],
    ];
    for (const [extra, problem] of cases) {
      const found = adminBundleProblems(`${clean}${extra}\n`);
      expect({ extra, matched: found.some((p) => problem.test(p)) }).toEqual({ extra, matched: true });
    }
    expect(adminBundleProblems('const http = require("node:http");')).toEqual(['does not address 127.0.0.1 at all']);
  });
});

describe('build-hosted.mjs + stage-image.mjs: /app/admin.cjs', () => {
  let buildDir = '';
  let built: ReturnType<typeof runNode>;
  beforeAll(() => {
    buildDir = path.join(tempDataDir(), 'build');
    built = runNode(['scripts/build-hosted.mjs', '--no-ui', '--out', buildDir]);
  }, 120_000);

  it('builds admin.cjs next to the bundle, clean, runnable', () => {
    expect({ status: built.status, stderr: built.stderr }).toMatchObject({ status: 0 });
    expect(built.stdout).toContain('[build-hosted] admin.cjs');
    const admin = path.join(buildDir, 'admin.cjs');
    const text = fs.readFileSync(admin, 'utf8');
    expect(adminBundleProblems(text)).toEqual([]);
    // Only node:http, node:fs and node:path - no package, nothing of the server bundled in.
    const required = [...text.matchAll(/require\("([^"]+)"\)/g)].map((m) => m[1]).sort();
    expect([...new Set(required)]).toEqual(['node:fs', 'node:http', 'node:path']);
    expect(text).not.toContain('express');
    expect(fs.statSync(admin).size).toBeLessThan(100 * 1024);
    const help = runNode([admin, 'help'], buildDir);
    expect(help.status).toBe(0);
    expect(help.stdout).toContain('node /app/admin.cjs find <e-mail-or-username>');
    // Without a server: no token file -> exit 3, in both languages.
    const noServer = spawnSync(process.execPath, [admin, 'list', '--token-file', path.join(buildDir, 'none')], { encoding: 'utf8' });
    expect(noServer.status).toBe(3);
    expect(noServer.stderr).toMatch(/does not exist[\s\S]*לא קיים/);
  });

  it('stages it into the image tree (Dockerfile: COPY dist/ /app/), refuses a doctored or missing one', () => {
    const outDir = path.join(tempDataDir(), 'image');
    const staged = runNode(['scripts/hosted/stage-image.mjs', `--bundle=${path.join(buildDir, 'server-hosted.cjs')}`, `--out=${outDir}`, '--no-ui']);
    expect({ status: staged.status, stderr: staged.stderr }).toMatchObject({ status: 0 });
    expect(fs.readFileSync(path.join(outDir, 'admin.cjs'))).toEqual(fs.readFileSync(path.join(buildDir, 'admin.cjs')));
    const manifest = JSON.parse(fs.readFileSync(path.join(outDir, '.staged.json'), 'utf8')) as { files: string[] };
    expect(manifest.files).toContain('admin.cjs');
    expect(fs.readFileSync(path.join(ROOT, 'deploy', 'hosted', 'Dockerfile'), 'utf8')).toMatch(/^COPY --chown=diary:diary dist\/ \/app\/$/m);

    // A tool that learned to talk to somebody else is never staged.
    const doctoredDir = path.join(tempDataDir(), 'doctored');
    fs.mkdirSync(doctoredDir);
    fs.copyFileSync(path.join(buildDir, 'server-hosted.cjs'), path.join(doctoredDir, 'server-hosted.cjs'));
    fs.writeFileSync(path.join(doctoredDir, 'admin.cjs'), fs.readFileSync(path.join(buildDir, 'admin.cjs'), 'utf8') + '\nconst exfil = "https://collector.example/upload";\n');
    const refused = runNode(['scripts/hosted/stage-image.mjs', `--bundle=${path.join(doctoredDir, 'server-hosted.cjs')}`, `--out=${path.join(tempDataDir(), 'image-bad')}`, '--no-ui']);
    expect(refused.status).toBe(1);
    expect(refused.stderr).toContain('addresses https://collector.example - only 127.0.0.1 is allowed');

    // An image without the tool is refused (deletion on request is promised by the privacy policy).
    fs.rmSync(path.join(doctoredDir, 'admin.cjs'));
    const missing = runNode(['scripts/hosted/stage-image.mjs', `--bundle=${path.join(doctoredDir, 'server-hosted.cjs')}`, `--out=${path.join(tempDataDir(), 'image-none')}`, '--no-ui']);
    expect(missing.status).toBe(1);
    expect(missing.stderr).toContain('admin.cjs missing next to');
    // --verify-only on a tree whose admin.cjs went missing fails as well.
    fs.rmSync(path.join(outDir, 'admin.cjs'));
    const verify = runNode(['scripts/hosted/stage-image.mjs', `--out=${outDir}`, '--no-ui', '--verify-only']);
    expect(verify.status).toBe(1);
    expect(verify.stderr).toContain('admin.cjs missing from the staged tree');
  });
});

describe('the server side of the admin API opens nothing (plan 5.8 rule 1)', () => {
  it('routes/admin.ts and hosted/admin-token.ts name no host and make no outbound call', () => {
    for (const file of ['server/src/routes/admin.ts', 'server/src/hosted/admin-token.ts']) {
      const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
      const outbound = /https?:\/\/|\bfetch\(|https?\.request\(|net\.connect\(|tls\.connect\(|from ['"]node:(?:https?|net|dns|dgram|tls)['"]/.test(text);
      expect({ file, outbound }).toEqual({ file, outbound: false });
    }
  });
});

describe('check-no-network.mjs: the source rule of scripts/hosted/admin.ts', () => {
  /** A throw-away tree with the two package.json files the audit reads, the given admin.ts and further files. */
  function auditTree(adminSource: string, files: Record<string, string> = {}) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mpd-admin-audit-'));
    try {
      fs.writeFileSync(path.join(root, 'package.json'), '{ "dependencies": {} }');
      fs.mkdirSync(path.join(root, 'server'));
      fs.writeFileSync(path.join(root, 'server', 'package.json'), '{ "dependencies": {} }');
      fs.mkdirSync(path.join(root, 'scripts', 'hosted'), { recursive: true });
      fs.writeFileSync(path.join(root, 'scripts', 'hosted', 'admin.ts'), adminSource);
      for (const [rel, text] of Object.entries(files)) {
        fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
        fs.writeFileSync(path.join(root, rel), text);
      }
      const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'check-no-network.mjs'), `--root=${root}`], { encoding: 'utf8' });
      return { status: r.status, out: `${r.stdout}${r.stderr}` };
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }

  it('the real admin.ts passes; another host, an http URL elsewhere or the loopback name fails', () => {
    const real = fs.readFileSync(path.join(ROOT, 'scripts', 'hosted', 'admin.ts'), 'utf8');
    expect(real).toContain("host: '127.0.0.1'");
    expect(auditTree(real).status).toBe(0);
    for (const [line, message] of [
      ["http.request({ host: 'diary.example.org', port: 80 });", 'only 127.0.0.1 may be addressed here'],
      ["const url = 'http://203.0.113.5:8080/api/admin';", 'only 127.0.0.1 may be addressed here'],
      [`const h = '${LOOPBACK_NAME}';`, 'use the literal 127.0.0.1'],
    ] as const) {
      const r = auditTree(`${real}\n${line}\n`);
      expect({ line, status: r.status, reported: r.out.includes(message) }).toEqual({ line, status: 1, reported: true });
    }
  });

  it('audits the built admin.cjs in the hand-over directories too (build/ and the staged dist/)', () => {
    const real = fs.readFileSync(path.join(ROOT, 'scripts', 'hosted', 'admin.ts'), 'utf8');
    const clean = 'const http = require("node:http");\nhttp.request({ host: "127.0.0.1", port: 8080 });\n';
    expect(auditTree(real, { 'deploy/hosted/build/admin.cjs': clean, 'deploy/hosted/dist/admin.cjs': clean }).status).toBe(0);
    for (const rel of ['deploy/hosted/build/admin.cjs', 'deploy/hosted/dist/admin.cjs']) {
      const r = auditTree(real, { [rel]: `${clean}const u = "https://collector.example/upload";\n` });
      expect({ rel, status: r.status, reported: r.out.includes(`${rel}: the operator tool addresses https://collector.example`) }).toEqual({ rel, status: 1, reported: true });
    }
  });
});
