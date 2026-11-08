/**
 * The commands of the Server card's "Deletion request by e-mail" helper (adminCommands.ts,
 * docs/android-tasks/ADMIN-TOOL.md item 3) against the operator tool itself (scripts/hosted/admin.ts,
 * /app/admin.cjs): the exact lines of the tool's contract, the same `b64:` rule, the same PowerShell
 * line, and every command the card builds read back by the tool's own argument parser - so what the
 * owner copies is exactly what the tool understands. Fictional addresses only.
 *
 * The tool is loaded through a computed specifier: it is Node code (node:fs, node:http), and the root
 * tsconfig deliberately has no Node types (the convention of the other root tests that need Node).
 */
import { beforeAll, describe, expect, it } from 'vitest';
import {
  ADMIN_TOOL,
  DEFAULT_FLY_APP,
  FLYCTL_WINDOWS_PATH,
  addressArgument,
  confirmOption,
  deleteCommand,
  encodeValue,
  findCommand,
  flyAppOf,
  isPlainValue,
  isUsername,
  powershellLine,
} from './adminCommands';

/** The parts of scripts/hosted/admin.ts this test uses. */
interface AdminCli {
  ADMIN_HOST: string;
  B64_PREFIX: string;
  DEFAULT_FLY_APP: string;
  FLYCTL_WINDOWS_PATH: string;
  TOOL: string;
  isPlainValue(value: string): boolean;
  encodeValue(value: string): string;
  decodeValue(raw: string): string;
  powershellLine(env: Record<string, string | undefined>, command: string): string;
  parseArgs(argv: readonly string[]): {
    command:
      | { kind: 'find'; query: string }
      | { kind: 'delete'; select: { by: 'username' | 'email'; value: string }; confirm: string | null }
      | { kind: string };
  };
}

let cli: AdminCli;
beforeAll(async () => {
  const specifier = '../../../scripts/hosted/admin.ts';
  cli = (await import(/* @vite-ignore */ specifier)) as AdminCli;
});

/** The command inside `-C '...'` of a PowerShell line, as the machine receives it. */
function insideOf(line: string): string {
  const start = line.indexOf(" -C '");
  expect(start).toBeGreaterThan(0);
  expect(line.endsWith("'")).toBe(true);
  return line.slice(start + 5, -1).replace(/''/g, "'");
}

/** The words the tool gets: the inner command has no quotes and no blanks inside a value. */
function argvOf(line: string): string[] {
  const words = insideOf(line).split(' ');
  expect(words.slice(0, 2)).toEqual(['node', '/app/admin.cjs']);
  return words.slice(2);
}

const PLAIN = ['dana@example.com', 'Dana.Cohen+diary@sub.example.co.il', 'a_b%c=d@example.org', 'דנה@example.co.il', 'müller@example.de', '張偉@example.cn', 'x-y@example.com'];
const UNUSUAL = [
  "o'brien@example.com",
  'pay$day@example.com',
  'a"b@example.com',
  'back`tick@example.com',
  'semi;colon@example.com',
  'pipe|amp&@example.com',
  'star*q?@example.com',
  'brace{x}@example.com',
  'tilde~hash#bang!@example.com',
  'slash/back\\@example.com',
  '-lead@example.com',
  '--double@example.com',
  'smile😀@example.com',
  'in side@example.com',
];

describe('the lines of the tool\'s contract', () => {
  it('builds exactly the find and delete lines the tool prints, for the production app', () => {
    expect(findCommand('yourpersonaldiary', 'dana@example.com')).toBe(
      "C:\\Users\\AVI\\.fly\\bin\\flyctl.exe ssh console -a yourpersonaldiary -C 'node /app/admin.cjs find dana@example.com'",
    );
    expect(deleteCommand('yourpersonaldiary', 'dana@example.com', 'dana')).toBe(
      "C:\\Users\\AVI\\.fly\\bin\\flyctl.exe ssh console -a yourpersonaldiary -C 'node /app/admin.cjs delete --email dana@example.com --confirm dana'",
    );
  });

  it('encodes an unusual address as b64: (the example of the contract) and keeps a plain one', () => {
    expect(encodeValue("o'brien@example.com")).toBe('b64:bydicmllbkBleGFtcGxlLmNvbQ');
    expect(addressArgument("o'brien@example.com")).toEqual({ value: 'b64:bydicmllbkBleGFtcGxlLmNvbQ', encoded: true });
    // "$" would be expanded by PowerShell inside double quotes (pay$day arrived as pay@...): encoded.
    expect(addressArgument('pay$day@example.com').encoded).toBe(true);
    expect(addressArgument('dana@example.com')).toEqual({ value: 'dana@example.com', encoded: false });
    expect(findCommand(DEFAULT_FLY_APP, "o'brien@example.com")).toBe(
      "C:\\Users\\AVI\\.fly\\bin\\flyctl.exe ssh console -a yourpersonaldiary -C 'node /app/admin.cjs find b64:bydicmllbkBleGFtcGxlLmNvbQ'",
    );
  });

  it('names the app of the server it talks to: <app>.fly.dev, else the production app', () => {
    expect(flyAppOf('https://yourpersonaldiary.fly.dev')).toBe('yourpersonaldiary');
    expect(flyAppOf('https://yourpersonaldiary-staging.fly.dev')).toBe('yourpersonaldiary-staging');
    expect(flyAppOf('https://YourPersonalDiary.fly.dev/')).toBe('yourpersonaldiary');
    for (const other of ['https://diary.example.org', 'http://127.0.0.1:47950', 'https://evil.fly.dev.example.org', 'https://a.b.fly.dev', '', null, undefined, 'not a url']) {
      expect(flyAppOf(other), String(other)).toBe(DEFAULT_FLY_APP);
    }
    // Whatever the address, the app name is letters, digits and "-" only: nothing PowerShell could read.
    expect(findCommand(flyAppOf('https://x-1.fly.dev'), 'dana@example.com')).toContain(' -a x-1 -C ');
  });

  it('gives a username as it is, and one that starts with "--" in the = form', () => {
    expect(confirmOption('dana')).toBe('--confirm dana');
    expect(confirmOption('-dana')).toBe('--confirm -dana');
    expect(confirmOption('--dana')).toBe('--confirm=--dana');
    expect(isUsername('dana')).toBe(true);
    expect(isUsername('דנה_1')).toBe(true);
    expect(isUsername('a.b-c_d')).toBe(true);
    for (const bad of ['', 'ab', 'dana cohen', "o'brien", 'dana$', 'd@na', 'x'.repeat(33), 'дана']) expect(isUsername(bad), bad).toBe(false);
  });
});

describe('in step with the operator tool (scripts/hosted/admin.ts)', () => {
  it('uses the tool\'s constants', () => {
    expect(FLYCTL_WINDOWS_PATH).toBe(cli.FLYCTL_WINDOWS_PATH);
    expect(DEFAULT_FLY_APP).toBe(cli.DEFAULT_FLY_APP);
    expect(ADMIN_TOOL).toBe(cli.TOOL);
    expect(cli.B64_PREFIX).toBe('b64:');
    // The tool addresses 127.0.0.1 only; the card builds text and addresses nothing.
    expect(cli.ADMIN_HOST).toBe('127.0.0.1');
  });

  it('decides plain or b64: like the tool and encodes byte for byte like it', () => {
    const loneSurrogate = `x\ud800y@example.com`;
    for (const address of [...PLAIN, ...UNUSUAL, loneSurrogate]) {
      expect(isPlainValue(address), address).toBe(cli.isPlainValue(address));
      expect(encodeValue(address), address).toBe(cli.encodeValue(address));
    }
    for (const address of [...PLAIN, ...UNUSUAL]) expect(cli.decodeValue(encodeValue(address)), address).toBe(address);
    for (const address of PLAIN) expect(addressArgument(address).encoded, address).toBe(address.startsWith('-'));
    for (const address of UNUSUAL) expect(addressArgument(address).encoded, address).toBe(true);
  });

  it('writes the PowerShell line like the tool, for production and for staging', () => {
    const inside = `${ADMIN_TOOL} find dana@example.com`;
    expect(powershellLine(DEFAULT_FLY_APP, inside)).toBe(cli.powershellLine({}, inside));
    expect(powershellLine('yourpersonaldiary-staging', inside)).toBe(cli.powershellLine({ FLY_APP_NAME: 'yourpersonaldiary-staging' }, inside));
    // A quote is doubled the same way (the card never puts one in, but the rule is the same).
    expect(powershellLine(DEFAULT_FLY_APP, "it's")).toBe(cli.powershellLine({}, "it's"));
  });

  it('every find command is read back by the tool as exactly the typed address', () => {
    for (const address of [...PLAIN, ...UNUSUAL]) {
      const line = findCommand(DEFAULT_FLY_APP, address);
      // Nothing PowerShell (single quotes) or the machine's command line would touch.
      expect(insideOf(line), address).toMatch(/^[\p{L}\p{M}\p{N} ._%+=@/:-]+$/u);
      expect(cli.parseArgs(argvOf(line)).command, address).toEqual({ kind: 'find', query: address });
    }
  });

  it('every delete command is read back as a deletion by that address, confirmed with exactly that username', () => {
    for (const address of [...PLAIN, ...UNUSUAL]) {
      for (const username of ['dana', 'דנה_1', 'a.b-c_d', '-dana', '--dana']) {
        const line = deleteCommand(DEFAULT_FLY_APP, address, username);
        expect(insideOf(line), `${address} ${username}`).toMatch(/^[\p{L}\p{M}\p{N} ._%+=@/:-]+$/u);
        expect(cli.parseArgs(argvOf(line)).command, `${address} ${username}`).toEqual({
          kind: 'delete',
          select: { by: 'email', value: address },
          confirm: username,
        });
      }
    }
  });
});
