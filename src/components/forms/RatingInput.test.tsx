import { pinLocaleForTests } from '@/i18n/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NOT_REPORTED } from '@/utils/format';
import { CLEAR_LABEL, RatingInput } from './RatingInput';

pinLocaleForTests('he');

describe('RatingInput', () => {
  it('null value: slider says "לא דווח", number box is empty and there is no clear button', () => {
    render(<RatingInput id="mood" label="מצב רוח" value={null} onChange={vi.fn()} />);
    const slider = screen.getByRole('slider', { name: 'מצב רוח' });
    expect(slider).toHaveAttribute('aria-valuetext', NOT_REPORTED);
    expect(slider).toHaveAttribute('min', '1');
    expect(slider).toHaveAttribute('max', '10');
    expect(screen.getByRole('spinbutton', { name: /מצב רוח/ })).toHaveValue(null);
    expect(screen.queryByRole('button', { name: new RegExp(CLEAR_LABEL) })).not.toBeInTheDocument();
  });

  it('reports "7 מתוך 10" as aria-valuetext and shows the clear button', () => {
    render(<RatingInput id="mood" label="מצב רוח" value={7} onChange={vi.fn()} />);
    const slider = screen.getByRole('slider', { name: 'מצב רוח' });
    expect(slider).toHaveAttribute('aria-valuetext', '7 מתוך 10');
    expect(slider).toHaveValue('7');
    expect(screen.getByRole('spinbutton', { name: /מצב רוח/ })).toHaveValue(7);
    expect(screen.getByRole('button', { name: `${CLEAR_LABEL} מצב רוח` })).toBeInTheDocument();
  });

  it('moving the slider and typing in the number box call onChange with numbers', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<RatingInput id="mood" label="מצב רוח" value={5} onChange={onChange} />);
    fireEvent.change(screen.getByRole('slider', { name: 'מצב רוח' }), { target: { value: '8' } });
    expect(onChange).toHaveBeenLastCalledWith(8);

    const box = screen.getByRole('spinbutton', { name: /מצב רוח/ });
    await user.clear(box);
    expect(onChange).toHaveBeenLastCalledWith(null);
    await user.type(box, '3');
    expect(onChange).toHaveBeenLastCalledWith(3);
  });

  it('from "not reported", a key toward the minimum (no native change) picks the minimum', () => {
    const onChange = vi.fn();
    const { rerender } = render(<RatingInput id="mood" label="מצב רוח" value={null} onChange={onChange} />);
    const slider = screen.getByRole('slider', { name: 'מצב רוח' });
    fireEvent.keyUp(slider, { key: 'Home' });
    expect(onChange).toHaveBeenLastCalledWith(1);

    // Unrelated keys and an already reported value are left alone.
    onChange.mockClear();
    fireEvent.keyUp(slider, { key: 'Tab' });
    rerender(<RatingInput id="mood" label="מצב רוח" value={4} onChange={onChange} />);
    fireEvent.keyUp(slider, { key: 'ArrowLeft' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('the clear button resets to null and moves focus to the slider', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<RatingInput id="mood" label="מצב רוח" value={7} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: `${CLEAR_LABEL} מצב רוח` }));
    expect(onChange).toHaveBeenCalledWith(null);
    expect(screen.getByRole('slider', { name: 'מצב רוח' })).toHaveFocus();
  });

  it('links hint and error to both controls', () => {
    render(<RatingInput id="mood" label="מצב רוח" value={null} onChange={vi.fn()} hint="1 = נמוך, 10 = גבוה" error="יש לבחור ערך" />);
    const slider = screen.getByRole('slider', { name: 'מצב רוח' });
    expect(slider).toHaveAccessibleDescription('1 = נמוך, 10 = גבוה יש לבחור ערך');
    expect(slider).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('spinbutton', { name: /מצב רוח/ })).toHaveAttribute('aria-invalid', 'true');
  });
});
