import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import { politeRegion, renderWithProviders } from '@/test/render';
import { ADD_LABEL, REMOVE_LABEL, TagInput } from './TagInput';

/** Controlled harness: keeps the value in state like a real form does. */
function Controlled({ initial = [], onChange = vi.fn(), suggestions }: { initial?: string[]; onChange?: (v: string[]) => void; suggestions?: string[] }) {
  const [value, setValue] = useState<string[]>(initial);
  return (
    <TagInput
      id="tags"
      label="תגיות"
      value={value}
      suggestions={suggestions}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

describe('TagInput', () => {
  it('renders the current values as chips with "הסר {תגית}" buttons', () => {
    renderWithProviders(<Controlled initial={['עבודה', 'חברים']} />);
    const list = screen.getByRole('list', { name: 'תגיות שנבחרו' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(within(list).getByRole('button', { name: REMOVE_LABEL('עבודה') })).toBeInTheDocument();
    expect(within(list).getByRole('button', { name: REMOVE_LABEL('חברים') })).toBeInTheDocument();
  });

  it('adds a trimmed value on Enter and announces it', async () => {
    const onChange = vi.fn();
    const { user } = renderWithProviders(<Controlled onChange={onChange} />);
    const box = screen.getByLabelText('תגיות');
    await user.type(box, '  ספורט  {Enter}');
    expect(onChange).toHaveBeenCalledWith(['ספורט']);
    expect(box).toHaveValue('');
    expect(screen.getByRole('button', { name: REMOVE_LABEL('ספורט') })).toBeInTheDocument();
    await waitFor(() => expect(politeRegion()).toHaveTextContent('ספורט נוסף לרשימה'));
  });

  it('adds on comma, splits pasted lists and ignores duplicates', async () => {
    const onChange = vi.fn();
    const { user } = renderWithProviders(<Controlled initial={['עבודה']} onChange={onChange} />);
    const box = screen.getByLabelText('תגיות');
    await user.type(box, 'עבודה,');
    expect(onChange).not.toHaveBeenCalled(); // duplicate
    expect(box).toHaveValue('');
    await user.type(box, 'משפחה, טיול{Enter}');
    expect(onChange).toHaveBeenLastCalledWith(['עבודה', 'משפחה', 'טיול']);
    const list = screen.getByRole('list', { name: 'תגיות שנבחרו' });
    // The first child of a chip is the tag text (the remove button follows it).
    expect(within(list).getAllByRole('listitem').map((li) => li.firstElementChild?.textContent)).toEqual(['עבודה', 'משפחה', 'טיול']);
  });

  it('adds on blur and with the add button', async () => {
    const onChange = vi.fn();
    const { user } = renderWithProviders(<Controlled onChange={onChange} />);
    const box = screen.getByLabelText('תגיות');
    await user.type(box, 'קריאה');
    await user.tab();
    expect(onChange).toHaveBeenLastCalledWith(['קריאה']);

    await user.type(box, 'שינה');
    await user.click(screen.getByRole('button', { name: `${ADD_LABEL} תגיות` }));
    expect(onChange).toHaveBeenLastCalledWith(['קריאה', 'שינה']);
  });

  it('removes a chip, announces it and keeps focus in the component', async () => {
    const onChange = vi.fn();
    const { user } = renderWithProviders(<Controlled initial={['עבודה', 'חברים']} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: REMOVE_LABEL('עבודה') }));
    expect(onChange).toHaveBeenCalledWith(['חברים']);
    expect(screen.queryByRole('button', { name: REMOVE_LABEL('עבודה') })).not.toBeInTheDocument();
    expect(screen.getByLabelText('תגיות')).toHaveFocus();
    await waitFor(() => expect(politeRegion()).toHaveTextContent('עבודה הוסר מהרשימה'));
  });

  it('Backspace in the empty box removes the last chip', async () => {
    const onChange = vi.fn();
    const { user } = renderWithProviders(<Controlled initial={['עבודה', 'חברים']} onChange={onChange} />);
    const box = screen.getByLabelText('תגיות');
    await user.click(box);
    await user.keyboard('{Backspace}');
    expect(onChange).toHaveBeenLastCalledWith(['עבודה']);
  });

  it('offers unused suggestions through a datalist', () => {
    renderWithProviders(<Controlled initial={['עבודה']} suggestions={['עבודה', 'ספורט']} />);
    const box = screen.getByLabelText('תגיות');
    expect(box).toHaveAttribute('list', 'tags-suggestions');
    const options = Array.from(document.querySelectorAll('#tags-suggestions option')).map((o) => (o as HTMLOptionElement).value);
    expect(options).toEqual(['ספורט']);
  });
});
