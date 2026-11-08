/**
 * The `process` of the Android core: the few members server/src reads (env, platform, argv, cwd,
 * nextTick). `platform` is 'android' - export/fonts.ts picks the Android system-font table by it.
 * There is no Node here: `versions.node` is absent on purpose, so libraries that sniff for Node
 * (Emscripten's ENVIRONMENT_IS_NODE) take their browser path.
 */
import { unavailable } from './unavailable';

/** Virtual working directory: relative paths resolve against the root of the virtual file system. */
export const MOBILE_CWD = '/';

type AnyFunction = (...args: unknown[]) => void;

const mobileProcess = {
  title: 'diary-core',
  browser: true,
  platform: 'android',
  arch: 'wasm',
  pid: 1,
  env: {} as Record<string, string | undefined>,
  argv: ['diary-core'] as string[],
  execArgv: [] as string[],
  version: '',
  versions: {} as Record<string, string>,
  cwd(): string {
    return MOBILE_CWD;
  },
  chdir(): never {
    return unavailable('process', 'chdir()');
  },
  exit(): never {
    return unavailable('process', 'exit()');
  },
  /** Runs `callback` before the next macrotask (Node runs it even before promise jobs). */
  nextTick(callback: AnyFunction, ...args: unknown[]): void {
    queueMicrotask(() => callback(...args));
  },
  hrtime(previous?: [number, number]): [number, number] {
    const now = performance.now();
    let seconds = Math.floor(now / 1000);
    let nanos = Math.round((now % 1000) * 1e6);
    if (previous) {
      seconds -= previous[0];
      nanos -= previous[1];
      if (nanos < 0) {
        seconds -= 1;
        nanos += 1e9;
      }
    }
    return [seconds, nanos];
  },
  uptime(): number {
    return performance.now() / 1000;
  },
  emitWarning(warning: unknown): void {
    console.warn(warning);
  },
  // No process-level events in a worker: listeners are accepted and never called.
  on(): unknown {
    return mobileProcess;
  },
  once(): unknown {
    return mobileProcess;
  },
  off(): unknown {
    return mobileProcess;
  },
  removeListener(): unknown {
    return mobileProcess;
  },
};

/** Typed like Node's `process` for the server code; only the members above exist. */
export const process = mobileProcess as unknown as NodeJS.Process;

export default process;
