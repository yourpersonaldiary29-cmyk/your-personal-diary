/**
 * Review findings on languages and the brand: export validation errors in the request language
 * (they were Hebrew literals for everyone), the no-UI page and the server pages carry the brand
 * "Your Personal Diary", export / backup file names use it too.
 */
import supertest from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { backupFileName } from '@shared/constants';
import { t } from '@shared/i18n';
import { noUiPage } from '../src/app';
import { exportFileName, validateExportRequest } from '../src/export';
import { lanDisabledPage } from '../src/middleware/access';
import { cleanupTempDirs, makeTestApp, testConfig } from './helpers';

afterAll(cleanupTempDirs);

describe('export validation errors', () => {
  it('are catalogue keys, answered in the request language', async () => {
    const { app } = await makeTestApp();
    const cases: Array<[object, string]> = [
      [{ format: 'txt', from: '2026-13-45' }, 'server.export.error.fromInvalid'],
      [{ format: 'txt', to: 'soon' }, 'server.export.error.toInvalid'],
      [{ format: 'txt', from: '2026-09-30', to: '2026-09-01' }, 'server.export.error.fromAfterTo'],
      [{ format: 'txt', includeHabits: 'yes' }, 'server.export.error.includeHabitsBoolean'],
      [{ format: 'txt', destPath: 'relative/file.txt' }, 'server.export.error.destPathAbsolute'],
      [{ format: 'txt', from: 5 }, 'server.export.error.invalidValue'],
      [[1] as unknown as object, 'server.export.error.bodyMissing'],
    ];
    for (const lang of ['en', 'de'] as const) {
      for (const [body, key] of cases) {
        const res = await supertest(app).post('/api/export').set('Authorization', 'Bearer test-token').set('Accept-Language', lang).send(body);
        expect({ key, lang, status: res.status, message: res.body.message }).toEqual({ key, lang, status: 400, message: t(lang, key) });
      }
    }
  });

  it('validateExportRequest names the offending field', () => {
    expect(() => validateExportRequest({ format: 'txt', from: 'x' })).toThrow(expect.objectContaining({ field: 'from' }));
  });
});

describe('brand', () => {
  it('the no-UI page is in the request language with the brand as its title', async () => {
    const { app } = await makeTestApp({ config: { ...testConfig(), staticDir: null } });
    const res = await supertest(app).get('/').set('Accept-Language', 'de');
    expect(res.text).toContain('<title>Your Personal Diary</title>');
    expect(res.text).toContain('lang="de"');
    expect(res.text).toContain(t('de', 'server.noUi.heading'));
    expect(noUiPage('he')).toContain('dir="rtl"');
    expect(noUiPage('he')).not.toContain('היומן האישי שלי');
  });

  it('the phone-access page title carries the brand', () => {
    expect(lanDisabledPage('en')).toContain(`<title>${t('en', 'server.lan.pageTitle')} - Your Personal Diary</title>`);
  });

  it('export and backup file names use the brand', () => {
    expect(exportFileName('dana', 'pdf', '2026-09-01', '2026-09-30')).toBe('your-personal-diary-dana-2026-09-01_2026-09-30.pdf');
    expect(backupFileName('dana', '2026-09-30')).toBe('your-personal-diary-backup-dana-2026-09-30.mpd');
  });
});
