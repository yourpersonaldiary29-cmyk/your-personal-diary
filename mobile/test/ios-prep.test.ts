// @vitest-environment node
/**
 * The iPhone app as prepared on Windows (docs/APPLE-PLAN.md WP-A2, docs/android-tasks/APPLE-PREP.md
 * item 3). The Swift drafts (mobile/plugins/<name>/ios/*.swift, mobile/ios-app/*.swift) and the
 * property lists of mobile/ios-app/ are plain source files that no compiler reads on Windows - the
 * first Mac build compiles them (scripts/ios/README.he.md). What CAN be proven here:
 *  - each Swift plugin answers to the JavaScript name and has exactly the methods of its TypeScript
 *    contract (mobile/plugins/<name>/index.ts) and of the Java plugin it mirrors, and the view
 *    controller registers all four;
 *  - the constants that make a blob, an error code or a chunk mean the same thing on both phones
 *    are the same numbers and words in Swift, Java and TypeScript;
 *  - none of the Swift files opens a network connection (scripts/check-no-network.mjs does not read
 *    Swift), and every "required reason" API they use is declared in the privacy manifest;
 *  - the Info.plist additions and the privacy manifest say what the plan says;
 *  - scripts/ios/README.he.md names files that exist and the iOS package version that matches the
 *    rest of Capacitor, and the iOS minimum that it and docs/APPLE-PLAN.md give for a test iPhone
 *    is the deployment target its step 5.4 sets.
 * Once `npx cap add ios` has run ON A MAC, the last block also checks that the generated project
 * builds these files (it is skipped while there is no ios/ project, as on Windows).
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { APP_NAME } from '@shared/constants';
import capacitorConfig from '../../capacitor.config';
import { DEFAULT_FILE_CHUNK_BYTES } from '../platform/files';
import { MAX_KEY_BYTES, MIRROR_BASE, MIRROR_DIRECTORY } from '../platform/offline';

const projectRoot = process.cwd();
const read = (relative: string): string => readFileSync(path.join(projectRoot, relative), 'utf8').replace(/\r\n/g, '\n');
const exists = (relative: string): boolean => existsSync(path.join(projectRoot, relative));

/** The four local plugins: JavaScript name and folder below mobile/plugins. */
const PLUGINS = [
  { name: 'DiaryFiles', dir: 'diary-files' },
  { name: 'DiaryOffline', dir: 'diary-offline' },
  { name: 'DiaryPrivacyScreen', dir: 'diary-privacy-screen' },
  { name: 'DiaryBiometric', dir: 'diary-biometric' },
] as const;

const swiftFileOf = (p: (typeof PLUGINS)[number]) => `mobile/plugins/${p.dir}/ios/${p.name}Plugin.swift`;
const javaFileOf = (p: (typeof PLUGINS)[number]) => `android/app/src/main/java/com/mydiary/app/plugins/${p.name}Plugin.java`;
const tsFileOf = (p: (typeof PLUGINS)[number]) => `mobile/plugins/${p.dir}/index.ts`;

const VIEW_CONTROLLER = 'mobile/ios-app/DiaryBridgeViewController.swift';
const INFO_ADDITIONS = 'mobile/ios-app/InfoAdditions.plist';
const PRIVACY_MANIFEST = 'mobile/ios-app/PrivacyInfo.xcprivacy';
const IOS_README = 'scripts/ios/README.he.md';
const APPLE_PLAN = 'docs/APPLE-PLAN.md';

/** Every native iOS source file of the project (the network scan and the Mac copy check use the list). */
const SWIFT_FILES = [VIEW_CONTROLLER, ...PLUGINS.map(swiftFileOf)];

// --- small readers -------------------------------------------------------------------------------

/**
 * Swift source without comments, line breaks kept (findings keep their line numbers). String
 * literals survive - a URL inside one is exactly what the scan must see - and `//` inside a string
 * is not a comment. Enough for these files: no multi-line string literals, no quotes inside
 * interpolations.
 */
function stripSwiftComments(source: string): string {
  let out = '';
  let inString = false;
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    const next = source[i + 1];
    if (inString) {
      out += c;
      if (c === '\\' && next !== undefined) {
        out += next;
        i++;
      } else if (c === '"' || c === '\n') {
        inString = false;
      }
      continue;
    }
    if (c === '"') {
      inString = true;
      out += c;
    } else if (c === '/' && next === '/') {
      while (i + 1 < source.length && source[i + 1] !== '\n') i++;
    } else if (c === '/' && next === '*') {
      const end = source.indexOf('*/', i + 2);
      const stop = end < 0 ? source.length : end + 2;
      out += source.slice(i, stop).replace(/[^\n]/g, ' ');
      i = stop - 1;
    } else {
      out += c;
    }
  }
  return out;
}

/**
 * Outbound network in Swift: the URL loading system, the Network framework, sockets and streams,
 * web views and browsers, handing a URL to another app, and any http(s) URL in the code.
 * The iOS counterpart of the JVM rules of scripts/check-no-network.mjs.
 */
const SWIFT_FORBIDDEN: Array<{ re: RegExp; why: string }> = [
  { re: /\bhttps?:\/\//, why: 'external URL' },
  { re: /\b(?:NS)?URLSession\w*|\bNSURLConnection\b|\b(?:NS|NSMutable)?URLRequest\b/, why: 'URL loading system' },
  { re: /^\s*(?:@\w+\s+)?import\s+(?:Network|CFNetwork|SystemConfiguration|WebKit|SafariServices|AuthenticationServices|MultipeerConnectivity)\b/, why: 'network framework' },
  { re: /\bNW(?:Connection|Listener|Browser|Endpoint|Parameters|PathMonitor|Protocol\w*)\b|\bnw_\w+\(/, why: 'Network framework' },
  { re: /\bCF(?:Stream|Socket|ReadStream|WriteStream|Host|HTTP|URLCreate)\w*|\bgetStreamsToHost\b|\bgetBoundStreams\b/, why: 'socket or stream' },
  { re: /\b(?:socket|connect|getaddrinfo|gethostbyname|sendto|recvfrom)\s*\(/, why: 'BSD socket call' },
  { re: /\bSCNetworkReachability\w*|\bWKWebView\b|\bSFSafariViewController\b|\bASWebAuthenticationSession\b|\bMCSession\b/, why: 'network object' },
  { re: /\bUIApplication\.shared\.open\b|\bopenURL\s*\(|\bopen\(\s*URL\(/, why: 'hands a URL to another app' },
  { re: /\b(?:Data|String|NSData|NSString)\(\s*contentsOf:\s*URL\(\s*string:/, why: 'download through contentsOf:' },
];

/** `file:line: why` for every forbidden construct in a Swift source. */
function swiftNetworkFindings(source: string, file = 'source.swift'): string[] {
  const findings: string[] = [];
  stripSwiftComments(source)
    .split('\n')
    .forEach((line, index) => {
      for (const rule of SWIFT_FORBIDDEN) {
        if (rule.re.test(line)) {
          findings.push(`${file}:${index + 1}: ${rule.why}`);
          break;
        }
      }
    });
  return findings;
}

type PlistValue = string | number | boolean | PlistValue[] | { [key: string]: PlistValue };
type PlistDict = { [key: string]: PlistValue };

/** A minimal XML property-list reader (dict, array, string, integer, real, true, false). */
function parsePlist(xml: string): PlistValue {
  const clean = xml
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\?xml[\s\S]*?\?>/, '')
    .replace(/<!DOCTYPE[\s\S]*?>/, '');
  type Token = { tag: string; close: boolean; empty: boolean } | { text: string };
  const tokens: Token[] = [];
  for (const m of clean.matchAll(/<(\/?)([A-Za-z]+)[^>]*?(\/?)>|([^<]+)/g)) {
    if (m[2]) tokens.push({ tag: m[2], close: m[1] === '/', empty: m[3] === '/' });
    else if (m[4].trim()) tokens.push({ text: m[4] });
  }
  const decode = (text: string) =>
    text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  let i = 0;
  const next = (): Token => {
    const token = tokens[i++];
    if (!token) throw new Error('plist: unexpected end');
    return token;
  };
  const closing = (tag: string) => {
    const token = next();
    if (!('tag' in token) || token.tag !== tag || !token.close) throw new Error(`plist: </${tag}> expected`);
  };
  const textOf = (tag: string): string => {
    const token = tokens[i];
    if (token && 'text' in token) {
      i++;
      closing(tag);
      return decode(token.text);
    }
    closing(tag);
    return '';
  };
  const value = (): PlistValue => {
    const token = next();
    if (!('tag' in token) || token.close) throw new Error('plist: a value expected');
    switch (token.tag) {
      case 'plist': {
        const inner = value();
        closing('plist');
        return inner;
      }
      case 'dict': {
        const dict: PlistDict = {};
        if (token.empty) return dict;
        for (;;) {
          const peek = tokens[i];
          if (peek && 'tag' in peek && peek.tag === 'dict' && peek.close) {
            i++;
            return dict;
          }
          const key = next();
          if (!('tag' in key) || key.tag !== 'key' || key.close) throw new Error('plist: <key> expected');
          const name = textOf('key');
          if (name in dict) throw new Error(`plist: duplicate key ${name}`);
          dict[name] = value();
        }
      }
      case 'array': {
        const list: PlistValue[] = [];
        if (token.empty) return list;
        for (;;) {
          const peek = tokens[i];
          if (peek && 'tag' in peek && peek.tag === 'array' && peek.close) {
            i++;
            return list;
          }
          list.push(value());
        }
      }
      case 'string':
        return token.empty ? '' : textOf('string');
      case 'integer':
      case 'real':
        return Number(textOf(token.tag));
      case 'true':
      case 'false':
        if (!token.empty) closing(token.tag);
        return token.tag === 'true';
      default:
        throw new Error(`plist: <${token.tag}> is not supported here`);
    }
  };
  const result = value();
  if (i !== tokens.length) throw new Error('plist: trailing content');
  return result;
}

const dictOf = (value: PlistValue | undefined): PlistDict => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('a <dict> expected');
  return value;
};
const listOf = (value: PlistValue | undefined): PlistValue[] => {
  if (!Array.isArray(value)) throw new Error('an <array> expected');
  return value;
};

/** Method names of `export interface <name> { ... }` (two-space indented signatures; listeners left out). */
function tsInterfaceMethods(source: string, iface: string): string[] {
  const start = source.indexOf(`export interface ${iface} {`);
  if (start < 0) throw new Error(`interface ${iface} not found`);
  const end = source.indexOf('\n}', start);
  const body = source.slice(start, end);
  return [...body.matchAll(/^ {2}(\w+)\(/gm)].map((m) => m[1]).filter((name) => name !== 'addListener');
}

interface SwiftPlugin {
  className: string | undefined;
  objcName: string | undefined;
  identifier: string | undefined;
  jsName: string | undefined;
  methods: string[];
  returnTypes: string[];
  objcFuncs: string[];
}

function swiftPlugin(source: string): SwiftPlugin {
  const code = stripSwiftComments(source);
  return {
    className: /\bpublic class (\w+)\s*:\s*CAPPlugin\s*,\s*CAPBridgedPlugin\b/.exec(code)?.[1],
    objcName: /@objc\((\w+)\)\s*public class/.exec(code)?.[1],
    identifier: /\bpublic let identifier = "(\w+)"/.exec(code)?.[1],
    jsName: /\bpublic let jsName = "(\w+)"/.exec(code)?.[1],
    methods: [...code.matchAll(/CAPPluginMethod\(name: "(\w+)", returnType: (\w+)\)/g)].map((m) => m[1]),
    returnTypes: [...code.matchAll(/CAPPluginMethod\(name: "\w+", returnType: (\w+)\)/g)].map((m) => m[1]),
    objcFuncs: [...code.matchAll(/@objc func (\w+)\(_ call: CAPPluginCall\)/g)].map((m) => m[1]),
  };
}

function javaPlugin(source: string): { name: string | undefined; methods: string[] } {
  return {
    name: /@CapacitorPlugin\(name = "(\w+)"\)/.exec(source)?.[1],
    methods: [...source.matchAll(/@PluginMethod[^\n]*\n\s*public void (\w+)\(/g)].map((m) => m[1]),
  };
}

/** `static let <name> = <literal>` of a Swift file (the literal as written). */
function swiftConstant(source: string, name: string): string {
  const match = new RegExp(`static let ${name}(?::\\s*\\w+)? = (.+)$`, 'm').exec(stripSwiftComments(source));
  if (!match) throw new Error(`Swift constant ${name} not found`);
  return match[1].trim();
}

/** `static final ... <NAME> = <literal>;` of a Java file. */
function javaConstant(source: string, name: string): string {
  const match = new RegExp(`static final \\w+ ${name} = ([^;]+);`).exec(source);
  if (!match) throw new Error(`Java constant ${name} not found`);
  return match[1].trim();
}

const unquote = (literal: string) => JSON.parse(literal) as string;
/** "768 * 1024" -> 786432 (products of integers only). */
const product = (literal: string) => literal.split('*').reduce((acc, part) => acc * Number(part.trim()), 1);

/** Files below `dir` (relative), node_modules and build outputs left out. */
function filesBelow(dir: string): string[] {
  const out: string[] = [];
  const walk = (relative: string) => {
    for (const entry of readdirSync(path.join(projectRoot, relative))) {
      if (entry === 'node_modules' || entry === 'dist' || entry === 'build') continue;
      const child = `${relative}/${entry}`;
      if (statSync(path.join(projectRoot, child)).isDirectory()) walk(child);
      else out.push(child);
    }
  };
  walk(dir);
  return out;
}

// --- the checks ----------------------------------------------------------------------------------

describe('the Swift plugins match their JavaScript contract and the Java plugins', () => {
  it('every Swift file of mobile/ is one of the known ones (so none escapes the checks below)', () => {
    const swift = filesBelow('mobile').filter((f) => f.endsWith('.swift')).sort();
    expect(swift).toEqual([...SWIFT_FILES].sort());
  });

  for (const plugin of PLUGINS) {
    it(`${plugin.name}: the same name and the same methods in Swift, TypeScript and Java`, () => {
      const swift = swiftPlugin(read(swiftFileOf(plugin)));
      const ts = read(tsFileOf(plugin));
      const java = javaPlugin(read(javaFileOf(plugin)));

      expect(ts).toContain(`registerPlugin<${plugin.name}Plugin>('${plugin.name}')`);
      expect(java.name).toBe(plugin.name);
      expect(swift.jsName).toBe(plugin.name);
      expect(swift.identifier).toBe(`${plugin.name}Plugin`);
      expect(swift.className).toBe(`${plugin.name}Plugin`);
      expect(swift.objcName).toBe(`${plugin.name}Plugin`);

      const contract = tsInterfaceMethods(ts, `${plugin.name}Plugin`).sort();
      expect(contract.length).toBeGreaterThan(0);
      expect([...swift.methods].sort()).toEqual(contract);
      expect([...java.methods].sort()).toEqual(contract);
      // Every listed method exists as an @objc entry point, and every one answers a promise.
      expect([...swift.objcFuncs].sort()).toEqual(contract);
      expect(new Set(swift.returnTypes)).toEqual(new Set(['CAPPluginReturnPromise']));
    });
  }

  it('the view controller is a CAPBridgeViewController that registers exactly the four plugins', () => {
    const code = stripSwiftComments(read(VIEW_CONTROLLER));
    expect(code).toMatch(/\bclass DiaryBridgeViewController: CAPBridgeViewController\b/);
    expect(code).toMatch(/override open func capacitorDidLoad\(\)/);
    const registered = [...code.matchAll(/bridge\?\.registerPluginInstance\((\w+)\(\)\)/g)].map((m) => m[1]).sort();
    expect(registered).toEqual(PLUGINS.map((p) => `${p.name}Plugin`).sort());
  });
});

describe('DiaryOffline: the same key, blob, error and answer words on both phones', () => {
  const swift = read(swiftFileOf(PLUGINS[1]));
  const java = read(javaFileOf(PLUGINS[1]));
  const ts = read(tsFileOf(PLUGINS[1]));

  it('Keychain service = Keystore alias, the same additional-data prefix and blob layout', () => {
    expect(unquote(swiftConstant(swift, 'keychainService'))).toBe(unquote(javaConstant(java, 'KEY_ALIAS')));
    expect(unquote(swiftConstant(swift, 'aadPrefix'))).toBe(unquote(javaConstant(java, 'AAD_PREFIX')));
    expect(Number(swiftConstant(swift, 'blobVersion'))).toBe(Number(javaConstant(java, 'BLOB_VERSION')));
    expect(Number(swiftConstant(swift, 'nonceBytes'))).toBe(Number(javaConstant(java, 'GCM_IV_BYTES')));
    expect(Number(swiftConstant(swift, 'tagBytes'))).toBe(Number(javaConstant(java, 'GCM_TAG_BITS')) / 8);
    expect(Number(swiftConstant(swift, 'deviceKeyBytes'))).toBe(32);
    // The bounds the TypeScript seam enforces first are the native ones.
    expect(Number(swiftConstant(swift, 'maxKeyBytes'))).toBe(MAX_KEY_BYTES);
    expect(Number(javaConstant(java, 'MAX_KEY_BYTES'))).toBe(MAX_KEY_BYTES);
    expect(Number(swiftConstant(swift, 'maxPromptText'))).toBe(Number(javaConstant(java, 'MAX_TEXT')));
    expect(unquote(swiftConstant(swift, 'defaultPromptText'))).toBe(APP_NAME);
    expect(unquote(javaConstant(java, 'DEFAULT_TITLE'))).toBe(APP_NAME);
  });

  it('the error codes are the four of DIARY_OFFLINE_ERROR, in Swift as in Java', () => {
    const block = /export const DIARY_OFFLINE_ERROR = \{([\s\S]*?)\} as const;/.exec(ts)?.[1] ?? '';
    const contract = [...block.matchAll(/^\s+\w+: '([A-Z_]+)',$/gm)].map((m) => m[1]).sort();
    expect(contract).toHaveLength(4);
    const swiftCodes = ['errInput', 'errKeyMissing', 'errUnwrap', 'errKeystore'].map((n) => unquote(swiftConstant(swift, n))).sort();
    const javaCodes = ['ERR_INPUT', 'ERR_KEY_MISSING', 'ERR_UNWRAP', 'ERR_KEYSTORE'].map((n) => unquote(javaConstant(java, n))).sort();
    expect(swiftCodes).toEqual(contract);
    expect(javaCodes).toEqual(contract);
  });

  it('the user check answers only the four words of DeviceCheckResult', () => {
    const words = /export type DeviceCheckResult = ([^;]+);/.exec(ts)?.[1].split('|').map((w) => w.trim().replace(/'/g, '')) ?? [];
    expect(words.sort()).toEqual(['cancelled', 'failed', 'ok', 'unavailable']);
    // verifyUser and result(for:) - every string literal there is an answer, except the three keys.
    const code = stripSwiftComments(swift);
    const verify = code.slice(code.indexOf('@objc func verifyUser'), code.indexOf('static func promptText'));
    const answered = new Set([...verify.matchAll(/"([^"\\]*)"/g)].map((m) => m[1]));
    for (const key of ['result', 'title', 'subtitle']) expect(answered.delete(key), key).toBe(true);
    expect([...answered].sort()).toEqual(words);
  });

  it('the account id is checked byte for byte like the Java pattern ^u_[0-9a-f]{16}$', () => {
    expect(java).toContain('Pattern.compile("^u_[0-9a-f]{16}$")');
    const code = stripSwiftComments(swift);
    expect(code).toContain('bytes.count == 18');
    expect(code).toContain('bytes[0] == UInt8(ascii: "u"), bytes[1] == UInt8(ascii: "_")');
    expect(code).toContain('($0 >= 48 && $0 <= 57) || ($0 >= 97 && $0 <= 102)');
  });

  it('the device key: this device only, not synchronised, never bound to a prompt', () => {
    const code = stripSwiftComments(swift);
    expect(code).toContain('kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly');
    expect(code).toContain('attributes[kSecAttrSynchronizable as String] = false');
    expect(code).not.toMatch(/SecAccessControlCreateWithFlags|kSecAttrAccessControl|biometry/);
    // A locked phone fails the call instead of replacing the key (other accounts' blobs survive).
    expect(code).toMatch(/catch DeviceKeyError\.keychain\(let status\) where status == errSecInteractionNotAllowed/);
  });

  it('the mirror folder it keeps out of backups is the one of Directory.LibraryNoCloud + MIRROR_BASE', () => {
    expect(MIRROR_DIRECTORY.ios).toBe('LIBRARY_NO_CLOUD');
    expect(swiftConstant(swift, 'mirrorPath')).toBe(JSON.stringify(['NoCloud', MIRROR_BASE]).replace(/,/g, ', '));
    expect(stripSwiftComments(swift)).toContain('values.isExcludedFromBackup = true');
  });
});

describe('DiaryFiles, DiaryPrivacyScreen, DiaryBiometric: the contract details', () => {
  it('DiaryFiles reads in the chunk size of files.ts and the bound of the Java plugin', () => {
    const swift = read(swiftFileOf(PLUGINS[0]));
    const java = read(javaFileOf(PLUGINS[0]));
    expect(product(swiftConstant(swift, 'defaultReadBytes'))).toBe(DEFAULT_FILE_CHUNK_BYTES);
    expect(java).toContain(`? ${swiftConstant(swift, 'defaultReadBytes')} :`);
    expect(product(swiftConstant(swift, 'maxReadBytes'))).toBe(product(javaConstant(java, 'MAX_READ_BYTES')));
  });

  it('DiaryFiles on iOS: the export sheet answers `cancelled` at closeWrite, the event is `openFile`', () => {
    const code = stripSwiftComments(read(swiftFileOf(PLUGINS[0])));
    const ts = read(tsFileOf(PLUGINS[0]));
    expect(ts).toMatch(/export interface CloseWriteResult \{[\s\S]*?cancelled\?: boolean;/);
    expect(ts).toContain("addListener(eventName: 'openFile'");
    expect(code).toContain('call.resolve(["cancelled": true])');
    expect(code).toContain('call.resolve(["cancelled": false])');
    expect(code).toContain('notifyListeners("openFile", data: file)');
    // Exports are copies (the user's file system is never written in place), picks too.
    expect(code).toContain('UIDocumentPickerViewController(forExporting: [file], asCopy: true)');
    expect(code).toContain('UIDocumentPickerViewController(forOpeningContentTypes: [UTType.data], asCopy: true)');
  });

  it('DiaryPrivacyScreen keeps its own copy of the setting, default on', () => {
    const code = stripSwiftComments(read(swiftFileOf(PLUGINS[2])));
    expect(code).toMatch(/if defaults\.object\(forKey: DiaryPrivacyScreenPlugin\.enabledKey\) == nil \{\s*return true\s*\}/);
    expect(code).toContain('UIApplication.willResignActiveNotification');
    expect(code).toContain('UIApplication.didBecomeActiveNotification');
  });

  it('DiaryBiometric answers "unsupported" / "unavailable" - words of its contract - and stores nothing', () => {
    const code = stripSwiftComments(read(swiftFileOf(PLUGINS[3])));
    const ts = read(tsFileOf(PLUGINS[3]));
    expect(ts).toMatch(/export type BiometricAvailability = [^;]*'unsupported'/);
    expect(ts).toMatch(/enroll\([^)]*\): Promise<\{ ok: boolean; reason\?: [^}]*'unavailable'/);
    expect(ts).toMatch(/unlock\([^)]*\): Promise<\{ token: string \| null; reason\?: [^}]*'unavailable'/);
    expect(code).toContain('call.resolve(["status": "unsupported", "enrolled": false])');
    expect(code).toContain('call.resolve(["ok": false, "reason": "unavailable"])');
    expect(code).toContain('call.resolve(["token": NSNull(), "reason": "unavailable"])');
    expect(code).not.toMatch(/SecItem|UserDefaults|FileManager/);
  });
});

describe('the iOS sources open no network connection', () => {
  it('the scan finds the constructs it is meant to find (and ignores comments)', () => {
    const sample = [
      'import Network',
      'let task = URLSession.shared.dataTask(with: request)',
      '// URLSession and https://example.com in a comment are fine',
      'let address = "https://example.com/collect"',
      'let half = "a // b" + URLRequest.description',
      'UIApplication.shared.open(link)',
      'let s = socket(AF_INET, SOCK_STREAM, 0)',
      '/* WKWebView */ let fine = 1',
    ].join('\n');
    expect(swiftNetworkFindings(sample)).toEqual([
      'source.swift:1: network framework',
      'source.swift:2: URL loading system',
      'source.swift:4: external URL',
      'source.swift:5: URL loading system',
      'source.swift:6: hands a URL to another app',
      'source.swift:7: BSD socket call',
    ]);
  });

  it('no Swift file of the app talks to the network', () => {
    const findings = SWIFT_FILES.flatMap((file) => swiftNetworkFindings(read(file), file));
    expect(findings).toEqual([]);
  });

  it('the property lists carry no URL except the DTD of the plist format', () => {
    for (const file of [INFO_ADDITIONS, PRIVACY_MANIFEST]) {
      const urls = [...read(file).matchAll(/\bhttps?:\/\/[^\s"<>]+/g)].map((m) => m[0]);
      expect(urls, file).toEqual(['http://www.apple.com/DTDs/PropertyList-1.0.dtd']);
    }
  });
});

describe('Info.plist additions (mobile/ios-app/InfoAdditions.plist)', () => {
  const xml = read(INFO_ADDITIONS);
  const info = dictOf(parsePlist(xml));

  it('has the Face ID text, the export-compliance answer and copies-only document opening', () => {
    expect(typeof info.NSFaceIDUsageDescription).toBe('string');
    expect(info.NSFaceIDUsageDescription as string).toMatch(/^Your Personal Diary .*Face ID/);
    expect(info.ITSAppUsesNonExemptEncryption).toBe(false);
    expect(info.LSSupportsOpeningDocumentsInPlace).toBe(false);
  });

  it('declares the same 20 languages as the Android per-app language list', () => {
    const android = [...read('android/app/src/main/res/xml/locales_config.xml').matchAll(/<locale android:name="([^"]+)" \/>/g)].map((m) => m[1]);
    expect(android).toHaveLength(20);
    expect(listOf(info.CFBundleLocalizations)).toEqual(android);
  });

  it('owns the .mpd backup type (read only) under the app id', () => {
    const uti = `${capacitorConfig.appId}.backup`;
    const [docType] = listOf(info.CFBundleDocumentTypes).map(dictOf);
    expect(docType.CFBundleTypeRole).toBe('Viewer');
    expect(docType.LSHandlerRank).toBe('Owner');
    expect(listOf(docType.LSItemContentTypes)).toEqual([uti]);
    const [exported] = listOf(info.UTExportedTypeDeclarations).map(dictOf);
    expect(exported.UTTypeIdentifier).toBe(uti);
    expect(listOf(exported.UTTypeConformsTo)).toEqual(['public.data']);
    expect(listOf(dictOf(exported.UTTypeTagSpecification)['public.filename-extension'])).toEqual(['mpd']);
  });

  it('adds nothing that weakens the app: no file sharing, no ATS exception, no background mode, no other permission', () => {
    expect(Object.keys(info).sort()).toEqual(
      ['CFBundleDocumentTypes', 'CFBundleLocalizations', 'ITSAppUsesNonExemptEncryption', 'LSSupportsOpeningDocumentsInPlace', 'NSFaceIDUsageDescription', 'UTExportedTypeDeclarations'].sort(),
    );
    const keysOnly = xml.replace(/<!--[\s\S]*?-->/g, '');
    for (const forbidden of ['UIFileSharingEnabled', 'NSAppTransportSecurity', 'NSAllowsArbitraryLoads', 'UIBackgroundModes', 'WKAppBoundDomains']) {
      expect(keysOnly, forbidden).not.toContain(forbidden);
    }
  });
});

describe('the privacy manifest (mobile/ios-app/PrivacyInfo.xcprivacy)', () => {
  const manifest = dictOf(parsePlist(read(PRIVACY_MANIFEST)));

  it('no tracking, no tracking domains', () => {
    expect(manifest.NSPrivacyTracking).toBe(false);
    expect(listOf(manifest.NSPrivacyTrackingDomains)).toEqual([]);
  });

  it('collects name, e-mail address, user id and the diary - linked to the user, not for tracking, for the app only', () => {
    const collected = listOf(manifest.NSPrivacyCollectedDataTypes).map(dictOf);
    expect(collected.map((c) => c.NSPrivacyCollectedDataType).sort()).toEqual(
      ['NSPrivacyCollectedDataTypeEmailAddress', 'NSPrivacyCollectedDataTypeName', 'NSPrivacyCollectedDataTypeOtherUserContent', 'NSPrivacyCollectedDataTypeUserID'].sort(),
    );
    for (const entry of collected) {
      expect(entry.NSPrivacyCollectedDataTypeLinked).toBe(true);
      expect(entry.NSPrivacyCollectedDataTypeTracking).toBe(false);
      expect(listOf(entry.NSPrivacyCollectedDataTypePurposes)).toEqual(['NSPrivacyCollectedDataTypePurposeAppFunctionality']);
    }
  });

  it('declares UserDefaults (CA92.1) and file timestamps (C617.1), and every required-reason API the Swift code uses', () => {
    const declared = new Map(
      listOf(manifest.NSPrivacyAccessedAPITypes)
        .map(dictOf)
        .map((d) => [d.NSPrivacyAccessedAPIType as string, listOf(d.NSPrivacyAccessedAPITypeReasons)]),
    );
    expect([...declared.keys()].sort()).toEqual(['NSPrivacyAccessedAPICategoryFileTimestamp', 'NSPrivacyAccessedAPICategoryUserDefaults']);
    expect(declared.get('NSPrivacyAccessedAPICategoryUserDefaults')).toEqual(['CA92.1']);
    expect(declared.get('NSPrivacyAccessedAPICategoryFileTimestamp')).toEqual(['C617.1']);

    // Apple's categories of required-reason APIs, as they would appear in this Swift code.
    const categories: Array<{ category: string; re: RegExp }> = [
      { category: 'NSPrivacyAccessedAPICategoryUserDefaults', re: /\bUserDefaults\b|\bNSUserDefaults\b/ },
      { category: 'NSPrivacyAccessedAPICategoryFileTimestamp', re: /\b(?:creationDate|modificationDate|contentModificationDate|fileModificationDate)\w*\b|\bgetattrlist\w*\(|\b(?:f|l)?stat(?:at)?\(/ },
      { category: 'NSPrivacyAccessedAPICategorySystemBootTime', re: /\bsystemUptime\b|\bmach_absolute_time\b/ },
      { category: 'NSPrivacyAccessedAPICategoryDiskSpace', re: /\bvolume\w*Capacity\w*\b|\bsystemFreeSize\b|\bsystemSize\b|\bstatv?fs\(/ },
      { category: 'NSPrivacyAccessedAPICategoryActiveKeyboards', re: /\bactiveInputModes\b/ },
    ];
    for (const file of SWIFT_FILES) {
      const code = stripSwiftComments(read(file));
      for (const { category, re } of categories) {
        if (re.test(code)) expect(declared.has(category), `${file} uses ${category}`).toBe(true);
      }
    }
  });
});

describe('the Capacitor side the iPhone app relies on', () => {
  it('keeps the iOS origin capacitor://localhost, which the hosted server already answers', () => {
    const server = capacitorConfig.server ?? {};
    for (const key of ['url', 'iosScheme', 'hostname', 'allowNavigation', 'cleartext'] as const) {
      expect(server, key).not.toHaveProperty(key);
    }
    expect(read('server/src/middleware/access.ts')).toMatch(/export const HOSTED_ORIGINS = new Set\(\[[^\]]*'capacitor:\/\/localhost'/);
  });

  it('the iOS settings stay on the release-safe defaults (no debugging switch, no app-bound domains)', () => {
    expect(capacitorConfig.ios).not.toHaveProperty('webContentsDebuggingEnabled');
    expect(capacitorConfig.ios).not.toHaveProperty('limitsNavigationsToAppBoundDomains');
    expect(capacitorConfig.ios?.contentInset).toBe('never');
  });
});

describe('scripts/ios/README.he.md - the steps on the Mac', () => {
  const readme = read(IOS_README);
  const pkg = JSON.parse(read('package.json')) as { devDependencies: Record<string, string> };

  it('adds the iOS platform package in the version of the other Capacitor packages, on the Mac', () => {
    const core = pkg.devDependencies['@capacitor/core'];
    expect(pkg.devDependencies['@capacitor/android']).toBe(core);
    expect(readme).toContain(`@capacitor/ios@${core}`);
    // Added on the Mac (step 2 of the README); once it is in package.json it must match too.
    const ios = pkg.devDependencies['@capacitor/ios'];
    if (ios !== undefined) expect(ios).toBe(core);
    expect(readme).toContain('npx cap add ios');
    expect(readme).toContain('npx cap sync ios');
  });

  it('names every native file of mobile/ that goes into the Xcode project', () => {
    for (const file of [...SWIFT_FILES, INFO_ADDITIONS, PRIVACY_MANIFEST]) expect(readme, file).toContain(file);
  });

  it('every project path it names exists (the generated ios/ folder aside), and so does every link target', () => {
    const paths = [...readme.matchAll(/`((?:mobile|scripts|docs|src|shared|android|server|play|legal)\/[^`\s]*)`/g)]
      .map((m) => m[1].replace(/[.,:;)]+$/, ''))
      .filter((p) => !/[<>*{}]/.test(p));
    expect(paths.length).toBeGreaterThan(5);
    for (const p of new Set(paths)) expect(exists(p), p).toBe(true);
    // Markdown links are relative to scripts/ios/.
    const links = [...readme.matchAll(/\]\(([^)\s]+)\)/g)].map((m) => m[1]).filter((l) => !/^[a-z]+:/i.test(l));
    expect(links.length).toBeGreaterThan(0);
    for (const link of new Set(links)) expect(existsSync(path.join(projectRoot, path.dirname(IOS_README), link.split('#')[0])), link).toBe(true);
  });

  it('raises the deployment target in step 5.4, and every test-iPhone minimum (here and in the plan) is that target', () => {
    // Capacitor generates 15.0; step 5.4 raises it, the same way in Xcode and in the Terminal.
    const raised = /'s\/IPHONEOS_DEPLOYMENT_TARGET = [\d.]+;\/IPHONEOS_DEPLOYMENT_TARGET = (\d+\.\d+);\/g'/.exec(readme);
    expect(raised, 'the sed command of step 5.4').not.toBeNull();
    const target = raised![1];
    expect(readme).toContain(`grep -c "IPHONEOS_DEPLOYMENT_TARGET = ${target};"`);
    expect(readme).toContain(`Minimum Deployments ← iOS ${target}`);
    // An iPhone on an older iOS cannot install the build, so the "iOS <n> or later" the owner is
    // given for a test iPhone (README step 1; the plan's owner summary item 3, sections 2.3 and 8)
    // must be the target itself - "iOS 15.4 or later" beside a 16.0 target told the owner a phone
    // stuck on iOS 15 would do. API availability notes ("iOS 13+") sit on other lines.
    const normal = (version: string): string => {
      const [major, minor = '0'] = version.split('.');
      return `${Number(major)}.${Number(minor)}`;
    };
    const minimums = [IOS_README, APPLE_PLAN].flatMap((file) =>
      read(file)
        .split('\n')
        .filter((line) => line.includes('iPhone') && /בדיקה|test/i.test(line))
        .flatMap((line) => [...line.matchAll(/iOS (\d+(?:\.\d+)?)(?:\+| ומעלה| or later)/g)].map((m) => ({ file, line, version: m[1] }))),
    );
    for (const file of [IOS_README, APPLE_PLAN]) {
      expect(minimums.some((m) => m.file === file), `${file} names the iOS minimum of a test iPhone`).toBe(true);
    }
    for (const { file, line, version } of minimums) expect(normal(version), `${file}: ${line}`).toBe(normal(target));
  });
});

/**
 * After `npx cap add ios` on a Mac (WP-I1): the generated project must actually build the files of
 * mobile/ - and a copy of one, if the files were copied instead of referenced, must not drift from
 * the source checked above. Skipped while no iOS project exists (Windows).
 */
const PBXPROJ = 'ios/App/App.xcodeproj/project.pbxproj';
describe.skipIf(!exists(PBXPROJ))('the generated iOS project (ios/, only after npx cap add ios on a Mac)', () => {
  it('compiles the five Swift files and bundles the privacy manifest', () => {
    const pbx = read(PBXPROJ);
    for (const file of SWIFT_FILES) expect(pbx, file).toContain(`${path.basename(file)} in Sources`);
    expect(pbx).toContain('PrivacyInfo.xcprivacy in Resources');
  });

  it('starts DiaryBridgeViewController', () => {
    const scene = stripSwiftComments(read('ios/App/App/SceneDelegate.swift'));
    expect(scene).toContain('window?.rootViewController = DiaryBridgeViewController()');
    expect(scene).not.toContain('window?.rootViewController = CAPBridgeViewController()');
  });

  it('carries the Info.plist additions unchanged, and copies (if any) equal their source in mobile/', () => {
    const info = dictOf(parsePlist(read('ios/App/App/Info.plist')));
    for (const [key, value] of Object.entries(dictOf(parsePlist(read(INFO_ADDITIONS))))) expect(info[key], key).toEqual(value);
    const copies = filesBelow('ios/App/App');
    for (const source of [...SWIFT_FILES, PRIVACY_MANIFEST]) {
      for (const copy of copies.filter((c) => path.basename(c) === path.basename(source))) expect(read(copy), copy).toBe(read(source));
    }
  });
});
