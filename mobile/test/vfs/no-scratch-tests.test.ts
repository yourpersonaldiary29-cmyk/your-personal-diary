// @vitest-environment node
/**
 * The test tree of the storage layer holds permanent tests only.
 *
 * A verification or fix round works with scratch tests: repros of a finding, written for the code
 * as it was at that moment. One that stays behind fails as soon as the finding is fixed (it still
 * expects the defect) and turns `npm run mobile:test` red - so a scratch test left in
 * mobile/test/vfs is reported here by name, whether it happens to pass or not.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const directory = path.join(process.cwd(), 'mobile', 'test', 'vfs');

/** File names a scratch test is given. */
const SCRATCH_NAME = /^(zz-|scratch|probe|repro|tmp)/i;

/** What the header of a scratch test says about itself (put together here, so this file does not contain them). */
const SCRATCH_MARKS = [
  ['VERIFIER', 'SCRATCH'].join(' '),
  ['FIXER', 'SCRATCH'].join(' '),
  ['Not a permanent', 'test'].join(' '),
  ['VERIFIER', 'OUT'].join('_'),
];

describe('the test tree of the storage layer', () => {
  it('the marks are real: they are recognised in a name and in a header', () => {
    expect(SCRATCH_NAME.test('zz-fixer-repro.test.ts')).toBe(true);
    expect(SCRATCH_NAME.test('vfs.test.ts')).toBe(false);
    const header = `/** ${'VERIFIER'} ${'SCRATCH'} (WP-4) - deterministic repros of the findings. */`;
    expect(SCRATCH_MARKS.some((mark) => header.includes(mark))).toBe(true);
  });

  it('holds no scratch test of a verification or fix round', () => {
    const offenders: string[] = [];
    for (const name of readdirSync(directory)) {
      if (!/\.test\.ts$/.test(name)) continue;
      const content = readFileSync(path.join(directory, name), 'utf8');
      if (SCRATCH_NAME.test(name) || SCRATCH_MARKS.some((mark) => content.includes(mark))) offenders.push(name);
    }
    expect(offenders).toEqual([]);
  });
});
