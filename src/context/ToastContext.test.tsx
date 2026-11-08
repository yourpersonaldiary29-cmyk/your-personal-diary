import { describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { t } from '@shared/i18n';
import { setCurrentLocale } from '@/i18n/runtime';
import { pinLocaleForTests } from '@/i18n/test-utils';
import { ToastProvider, useToast } from './ToastContext';

pinLocaleForTests('he');

describe('ToastProvider', () => {
  it('names the toast region in the current UI language, also after the language changes', () => {
    render(
      <ToastProvider>
        <p>content</p>
      </ToastProvider>,
    );
    expect(screen.getByRole('region', { name: t('he', 'shell.toastRegion') })).toBeInTheDocument();

    // The provider lives outside the subtree that remounts on a language change.
    act(() => setCurrentLocale('en'));
    expect(screen.getByRole('region', { name: t('en', 'shell.toastRegion') })).toBeInTheDocument();
  });

  it('drops the toasts written in the previous language when the language changes, keeps new ones', () => {
    act(() => setCurrentLocale('ru'));
    const api: { current?: ReturnType<typeof useToast> } = {};
    function Grab() {
      api.current = useToast();
      return null;
    }
    render(
      <ToastProvider>
        <Grab />
      </ToastProvider>,
    );
    act(() => {
      api.current?.info(t('ru', 'auth.loggedOut'));
    });
    expect(screen.getByText(t('ru', 'auth.loggedOut'))).toBeInTheDocument();

    act(() => setCurrentLocale('he'));
    expect(screen.queryByText(t('ru', 'auth.loggedOut'))).not.toBeInTheDocument();
    act(() => {
      api.current?.info(t('he', 'auth.loggedOut'));
    });
    expect(screen.getByText(t('he', 'auth.loggedOut'))).toBeInTheDocument();
  });
});
