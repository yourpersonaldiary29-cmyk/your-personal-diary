/**
 * FocusHeading must move focus to the page title after an in-app navigation
 * to another path, but never when a page merely rewrites its query string
 * (search "?q=", diary "?tag=", calendar "?year=&month=") - that would steal
 * focus from the control the keyboard user just operated.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useNavigate, useSearchParams } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { FocusHeading } from './FocusHeading';

function Page({ title }: { title: string }) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  return (
    <div>
      <FocusHeading>{title}</FocusHeading>
      <p data-testid="query">{params.get('q') ?? ''}</p>
      <button type="button" onClick={() => setParams({ q: 'work' }, { replace: true })}>
        סנן
      </button>
      <button type="button" onClick={() => navigate('/other')}>
        עבור
      </button>
    </div>
  );
}

function renderApp(initialEntries: string[] = ['/']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/" element={<Page title="ראשי" />} />
        <Route path="/other" element={<Page title="אחר" />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('FocusHeading', () => {
  it('does not steal focus on the very first page load', () => {
    renderApp();
    const heading = screen.getByRole('heading', { name: 'ראשי' });
    expect(heading).toHaveAttribute('tabindex', '-1');
    expect(document.activeElement).not.toBe(heading);
  });

  it('keeps focus on the control when only the query string changes', async () => {
    const user = userEvent.setup();
    renderApp();
    const filter = screen.getByRole('button', { name: 'סנן' });
    await user.click(filter);
    expect(screen.getByTestId('query')).toHaveTextContent('work');
    expect(document.activeElement).toBe(filter);
  });

  it('focuses the new page title after navigating to another path', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: 'עבור' }));
    const heading = screen.getByRole('heading', { name: 'אחר' });
    expect(document.activeElement).toBe(heading);
  });

  it('does not refocus the title when the query string changes after a navigation', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: 'עבור' }));
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'אחר' }));
    const filter = screen.getByRole('button', { name: 'סנן' });
    await user.click(filter);
    expect(screen.getByTestId('query')).toHaveTextContent('work');
    expect(document.activeElement).toBe(filter);
  });

  it('never moves focus with focus="never"', () => {
    render(
      <MemoryRouter initialEntries={['/x']}>
        <FocusHeading focus="never">כותרת</FocusHeading>
      </MemoryRouter>,
    );
    expect(document.activeElement).not.toBe(screen.getByRole('heading', { name: 'כותרת' }));
  });
});
