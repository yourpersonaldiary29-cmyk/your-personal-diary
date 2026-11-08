/**
 * Regression (DOCS-CONSISTENCY fixer, finding "The runbook's 'possible today' advice offers
 * DIARY_REGISTRATION=invite without saying it needs DIARY_INVITE_CODE, and following it after the
 * deploy guide's step ט crash-loops production"): docs/HOSTED-DEPLOY.he.md step ט removes
 * DIARY_INVITE_CODE from production, and a hosted server in invite mode without a code never starts
 * (`loadHostedEnv` throws -> hosted-index.ts `fatal` -> exit 1, and Fly restarts it again and again).
 *
 *   - every `flyctl secrets set` command in the owner guides, applied to production as step ט leaves
 *     it (deploy/hosted/fly.toml [env] + the DIARY_REGISTRATION=open secret, no DIARY_INVITE_CODE),
 *     gives an environment `loadHostedEnv` accepts - so a command that switches to invite must set
 *     the code in the same command;
 *   - a paragraph (or table row) that offers `invite` also names the invite code.
 * Fictional values only; nothing contacts Fly.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadHostedEnv } from '../src/config';

const ROOT = path.resolve(__dirname, '..', '..');
const GUIDES = ['docs/HOSTED-RUNBOOK.he.md', 'docs/HOSTED-DEPLOY.he.md'];
const STAGING_APP = 'yourpersonaldiary-staging';

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
}

/** The `[env]` table of a fly.toml (`NAME = "value"` lines; comments ignored). */
function flyEnv(rel: string): Record<string, string> {
  const env: Record<string, string> = {};
  let inEnv = false;
  for (const raw of read(rel).split('\n')) {
    const line = raw.trim();
    if (line.startsWith('[')) {
      inEnv = line === '[env]';
      continue;
    }
    const m = inEnv ? /^([A-Z][A-Z0-9_]*)\s*=\s*"([^"]*)"/.exec(line) : null;
    if (m) env[m[1]] = m[2];
  }
  return env;
}

/** Production after HOSTED-DEPLOY step ט: registration open (secret), the invite code unset. */
function productionAfterStepTet(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...flyEnv('deploy/hosted/fly.toml'), DIARY_REGISTRATION: 'open' };
  delete env.DIARY_INVITE_CODE;
  return env;
}

/** Staging keeps the code set-secrets.ps1 gave it (HOSTED-DEPLOY step ב.3). */
function staging(): NodeJS.ProcessEnv {
  return { ...flyEnv('deploy/hosted/fly.staging.toml'), DIARY_INVITE_CODE: 'fictional-staging-2026' };
}

/** Values for the placeholders the guides print (`<קוד-חדש>`, `<מספר>`, `<הדומיין>`...). */
const FICTIONAL: Record<string, string> = {
  DIARY_INVITE_CODE: 'fictional-invite-2026',
  DIARY_MAX_ACCOUNTS: '100',
  DIARY_EXTRA_HOSTS: 'diary.example.test,www.diary.example.test',
  DIARY_OWNER_ID: 'u_0123456789abcdef',
};

interface SecretsCommand {
  guide: string;
  text: string;
  app: string;
  values: Record<string, string>;
}

/** Every `flyctl secrets set ...` of a guide - inline code or a line of a code block. */
function secretsCommands(guide: string): SecretsCommand[] {
  const out: SecretsCommand[] = [];
  for (const m of read(guide).matchAll(/\b(?:flyctl|fly)(?:\.exe)? secrets set ([^`\n]*)/g)) {
    const tokens = m[1].trim().split(/\s+/);
    const values: Record<string, string> = {};
    let app = '';
    tokens.forEach((token, i) => {
      if (token === '-a' || token === '--app') app = tokens[i + 1] ?? '';
      const pair = /^"?([A-Za-z_][A-Za-z0-9_]*)=([^"]*)"?$/.exec(token);
      if (!pair) return;
      const [, name, value] = pair;
      values[name] = /[<>$]/.test(value) ? (FICTIONAL[name] ?? 'fictional') : value;
    });
    out.push({ guide, text: m[0].trim(), app, values });
  }
  return out;
}

/** Paragraphs (blank-line separated); each table row is a unit of its own. */
function paragraphs(text: string): string[] {
  return text.split(/\n\s*\n/).flatMap((block) => (block.split('\n').some((line) => line.trim().startsWith('|')) ? block.split('\n') : [block]));
}

const commands = GUIDES.flatMap(secretsCommands);

describe('owner guides: switching registration never leaves the hosted server unable to start', () => {
  it('the hazard is real: production after step ט refuses invite mode without a code, and accepts its own state', () => {
    expect(() => loadHostedEnv(productionAfterStepTet())).not.toThrow();
    expect(() => loadHostedEnv({ ...productionAfterStepTet(), DIARY_REGISTRATION: 'invite' })).toThrow(/DIARY_INVITE_CODE/);
    expect(() => loadHostedEnv(staging())).not.toThrow();
  });

  it('finds the guides\' commands (stop registrations, reopen them)', () => {
    expect(commands.length).toBeGreaterThanOrEqual(6);
    expect(commands.some((c) => c.guide.includes('RUNBOOK') && c.values.DIARY_REGISTRATION === 'closed')).toBe(true);
    expect(commands.some((c) => c.values.DIARY_REGISTRATION === 'open')).toBe(true);
  });

  it('every `flyctl secrets set` command, run on production as step ט leaves it, gives an environment the server starts with', () => {
    for (const c of commands) {
      const base = c.app === STAGING_APP ? staging() : productionAfterStepTet();
      let error: string | null = null;
      try {
        loadHostedEnv({ ...base, ...c.values });
      } catch (e) {
        error = (e as Error).message;
      }
      expect({ guide: c.guide, command: c.text, error }).toEqual({ guide: c.guide, command: c.text, error: null });
    }
  });

  it('a command that switches to invite sets the code in the same command', () => {
    for (const c of commands.filter((x) => x.values.DIARY_REGISTRATION === 'invite')) {
      expect({ command: c.text, setsCode: 'DIARY_INVITE_CODE' in c.values }).toEqual({ command: c.text, setsCode: true });
    }
  });

  it('a paragraph that offers `invite` names the invite code too', () => {
    for (const guide of GUIDES) {
      for (const p of paragraphs(read(guide)).filter((x) => /`[^`\n]*\binvite\b[^`\n]*`/.test(x))) {
        expect({ guide, paragraph: p.slice(0, 160), namesCode: /DIARY_INVITE_CODE|קוד ה?הזמנה/.test(p) }).toEqual({
          guide,
          paragraph: p.slice(0, 160),
          namesCode: true,
        });
      }
    }
  });
});
