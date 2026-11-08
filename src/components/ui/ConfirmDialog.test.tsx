import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { T } from '@/constants/texts';
import { ConfirmDialog } from './ConfirmDialog';

function Harness({ onConfirm = vi.fn(), requirePassword = false, error }: { onConfirm?: (p?: string) => void; requirePassword?: boolean; error?: string | null }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        פתח
      </button>
      <ConfirmDialog
        open={open}
        title="למחוק את הרשומה?"
        message="הפעולה אינה הפיכה."
        confirmLabel={T.delete}
        danger
        requirePassword={requirePassword}
        error={error}
        onConfirm={(p) => {
          onConfirm(p);
          setOpen(false);
        }}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}

describe('ConfirmDialog (Dialog focus management)', () => {
  it('moves focus into the dialog on open and returns it to the opener on cancel', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'פתח' });
    await user.click(opener);

    const dialog = screen.getByRole('dialog', { name: 'למחוק את הרשומה?' });
    expect(dialog).toHaveAttribute('open');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog.contains(document.activeElement)).toBe(true);

    await user.click(screen.getByRole('button', { name: T.cancel }));
    await waitFor(() => expect(dialog).not.toHaveAttribute('open'));
    expect(opener).toHaveFocus();
  });

  it('calls onConfirm and returns focus after confirming', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} />);
    const opener = screen.getByRole('button', { name: 'פתח' });
    await user.click(opener);
    await user.click(screen.getByRole('button', { name: T.delete }));
    expect(onConfirm).toHaveBeenCalledWith(undefined);
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it('with requirePassword: focuses the password field and passes the value to onConfirm', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} requirePassword />);
    await user.click(screen.getByRole('button', { name: 'פתח' }));
    const password = screen.getByLabelText(new RegExp(`^${T.password}`));
    expect(password).toHaveFocus();
    await user.type(password, 'secret123{Enter}');
    expect(onConfirm).toHaveBeenCalledWith('secret123');
  });

  it('shows the error at the field and announces it inside the dialog', async () => {
    const user = userEvent.setup();
    render(<Harness requirePassword error="הסיסמה שגויה" />);
    await user.click(screen.getByRole('button', { name: 'פתח' }));
    const password = screen.getByLabelText(new RegExp(`^${T.password}`));
    expect(password).toHaveAttribute('aria-invalid', 'true');
    expect(password).toHaveAccessibleDescription('הסיסמה שגויה');
    const dialog = screen.getByRole('dialog');
    expect(dialog.querySelector('[data-testid="live-region-assertive"]')).toHaveTextContent('הסיסמה שגויה');
  });
});
