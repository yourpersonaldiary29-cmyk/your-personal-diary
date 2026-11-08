import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { T } from '@/constants/texts';
import { canGoBack } from '@/utils/navigation';
import { LocationDisplay, currentPath, renderWithProviders } from '@/test/render';
import { BackButton } from './BackButton';

vi.mock('@/utils/navigation', () => ({ canGoBack: vi.fn(() => false) }));

function Page() {
  return (
    <>
      <BackButton />
      <LocationDisplay />
    </>
  );
}

const routes = (
  <Routes>
    <Route path="*" element={<Page />} />
  </Routes>
);

describe('BackButton', () => {
  beforeEach(() => {
    vi.mocked(canGoBack).mockReturnValue(false);
  });

  it('is hidden on the home page when there is nothing to go back to', () => {
    renderWithProviders(routes, { route: '/' });
    expect(screen.queryByRole('button', { name: T.back })).not.toBeInTheDocument();
  });

  it('navigates home from an inner page when there is no in-app history', async () => {
    const { user } = renderWithProviders(routes, { route: '/diary' });
    await user.click(screen.getByRole('button', { name: T.back }));
    await waitFor(() => expect(currentPath()).toBe('/'));
  });

  it('goes back one step when the previous entry is inside the app', async () => {
    vi.mocked(canGoBack).mockReturnValue(true);
    const { user } = renderWithProviders(routes, { initialEntries: ['/habits', '/diary'] });
    expect(currentPath()).toBe('/diary');
    await user.click(screen.getByRole('button', { name: T.back }));
    await waitFor(() => expect(currentPath()).toBe('/habits'));
  });

  it('its arrow points to the right in RTL and to the left in LTR', () => {
    const { unmount } = renderWithProviders(routes, { route: '/diary', locale: 'he' });
    expect(screen.getByRole('button', { name: T.back })).toHaveTextContent(/^→/);
    unmount();
    renderWithProviders(routes, { route: '/diary', locale: 'en' });
    expect(screen.getByRole('button', { name: 'Back' })).toHaveTextContent(/^←/);
  });

  it('is shown on the home page when history allows going back', () => {
    vi.mocked(canGoBack).mockReturnValue(true);
    renderWithProviders(routes, { initialEntries: ['/diary', '/'] });
    expect(screen.getByRole('button', { name: T.back })).toBeInTheDocument();
  });
});
