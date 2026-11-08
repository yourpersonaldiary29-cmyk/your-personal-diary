/**
 * Test helpers for the UI language.
 *
 * The runtime defaults to English in vitest (jsdom reports English browser
 * languages and nothing is stored), so a test that asserts Hebrew wording pins
 * the language first:
 *
 *   import { pinLocaleForTests } from '@/i18n/test-utils';
 *   pinLocaleForTests('he');          // at the top of the file or inside a describe
 *
 * The pin is applied before each test and removed after it, so other files are
 * unaffected. Tests that verify the default language call `__resetLocaleForTests()`.
 */
import { afterEach, beforeEach } from 'vitest';
import type { Locale } from '@shared/i18n';
import { __resetLocaleForTests, setCurrentLocale } from './runtime';

export function pinLocaleForTests(locale: Locale): void {
  beforeEach(() => {
    setCurrentLocale(locale);
  });
  afterEach(() => {
    __resetLocaleForTests();
  });
}
