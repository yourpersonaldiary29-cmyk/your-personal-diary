import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { pinLocaleForTests } from '@/i18n/test-utils';
import { DurationInput, HOURS_LABEL, MINUTES_LABEL } from './DurationInput';

pinLocaleForTests('en');

describe('DurationInput', () => {
  it('attaches an error to the group and to both boxes (focus lands on a box)', () => {
    render(<DurationInput id="exercise" label="Exercise" value={1800} onChange={vi.fn()} error="Too long" />);
    const group = screen.getByRole('group', { name: 'Exercise' });
    expect(group).toHaveAttribute('aria-invalid', 'true');
    for (const name of [HOURS_LABEL, MINUTES_LABEL]) {
      const box = screen.getByRole('spinbutton', { name });
      expect(box).toHaveAttribute('aria-invalid', 'true');
      expect(box).toHaveAccessibleDescription('Too long');
    }
  });

  it('has no error attributes while the value is valid', () => {
    render(<DurationInput id="exercise" label="Exercise" value={75} onChange={vi.fn()} />);
    expect(screen.getByRole('spinbutton', { name: HOURS_LABEL })).toHaveValue(1);
    expect(screen.getByRole('spinbutton', { name: MINUTES_LABEL })).toHaveValue(15);
    expect(screen.getByRole('spinbutton', { name: HOURS_LABEL })).not.toHaveAttribute('aria-invalid');
    expect(screen.getByRole('spinbutton', { name: HOURS_LABEL })).not.toHaveAttribute('aria-describedby');
  });
});
