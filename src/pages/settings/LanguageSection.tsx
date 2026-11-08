/**
 * "Language" card of the settings page. Works before login too: the choice is
 * kept on this device and, once signed in, saved to the account.
 *
 * The card title and the select label are in the CURRENT language; every
 * option shows its language in its own script (nativeName) with a matching
 * `lang` / `dir` attribute so screen readers pronounce it correctly. The
 * LanguageProvider applies the change, updates <html lang>/<html dir>,
 * announces it in the new language, and reports a failed account save
 * (`saveFailed`, announced by the provider). The page is rebuilt in the new
 * language; App.tsx puts the focus back on this select.
 *
 * The select is never disabled while the account save runs (a disabled
 * control loses the keyboard focus): it is marked aria-busy instead.
 */
import { type ChangeEvent } from 'react';
import { isLocale, LOCALES } from '@shared/i18n';
import { Alert } from '@/components/ui/Alert';
import { Card } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { useLanguage } from '@/context/LanguageContext';

export const LANGUAGE_SELECT_ID = 'settings-language';

export function LanguageSection() {
  const { locale, setLocale, t, saving, saveFailed } = useLanguage();

  const onChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const next = e.currentTarget.value;
    if (!isLocale(next) || next === locale) return;
    // The device switches at once; a failed account save is reported by the provider (saveFailed).
    setLocale(next).catch(() => undefined);
  };

  return (
    <Card title={t('settings.language.title')} className="settings-language">
      <div className="stack">
        {/* Announced by the LanguageProvider; shown here without a second live role. */}
        {saveFailed && (
          <Alert kind="error" role="none">
            {t('settings.language.saveFailed')}
          </Alert>
        )}
        <Field id={LANGUAGE_SELECT_ID} label={t('settings.language.label')} hint={t('settings.language.hint')}>
          {(a11y) => (
            <select {...a11y} name="language" className="select" value={locale} aria-busy={saving || undefined} onChange={onChange}>
              {LOCALES.map((l) => (
                <option key={l.code} value={l.code} lang={l.code} dir={l.dir}>
                  {l.nativeName}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>
    </Card>
  );
}
