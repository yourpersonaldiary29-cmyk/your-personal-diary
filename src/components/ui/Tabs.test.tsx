import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tabs } from './Tabs';

const tabs = [
  { id: 'week', label: 'שבוע', panel: <p>תוכן שבוע</p> },
  { id: 'month', label: 'חודש', panel: <p>תוכן חודש</p> },
  { id: 'year', label: 'שנה', panel: <p>תוכן שנה</p> },
];

function Controlled({ onChange = vi.fn(), dir }: { onChange?: (id: string) => void; dir?: 'rtl' | 'ltr' }) {
  const [value, setValue] = useState('week');
  return (
    <div dir={dir}>
      <Tabs
        tabs={tabs}
        value={value}
        label="תקופה"
        onChange={(id) => {
          setValue(id);
          onChange(id);
        }}
      />
    </div>
  );
}

describe('Tabs', () => {
  it('renders a tablist with aria-selected, aria-controls and a roving tabindex', () => {
    render(<Controlled />);
    const list = screen.getByRole('tablist', { name: 'תקופה' });
    const all = screen.getAllByRole('tab');
    expect(all).toHaveLength(3);
    expect(list).toContainElement(all[0]);
    expect(all[0]).toHaveAttribute('aria-selected', 'true');
    expect(all[0]).toHaveAttribute('tabindex', '0');
    expect(all[1]).toHaveAttribute('aria-selected', 'false');
    expect(all[1]).toHaveAttribute('tabindex', '-1');
    const panel = screen.getByRole('tabpanel', { name: 'שבוע' });
    expect(panel).toHaveTextContent('תוכן שבוע');
    expect(all[0]).toHaveAttribute('aria-controls', panel.id);
  });

  it('click selects a tab and shows its panel', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Controlled onChange={onChange} />);
    await user.click(screen.getByRole('tab', { name: 'חודש' }));
    expect(onChange).toHaveBeenCalledWith('month');
    expect(screen.getByRole('tabpanel', { name: 'חודש' })).toHaveTextContent('תוכן חודש');
    expect(screen.queryByText('תוכן שבוע')).not.toBeInTheDocument();
  });

  it('LTR: ArrowRight moves to the next tab, Home/End jump, and focus follows', async () => {
    const user = userEvent.setup();
    render(<Controlled dir="ltr" />);
    const [week, month, year] = screen.getAllByRole('tab');
    week.focus();
    await user.keyboard('{ArrowRight}');
    expect(month).toHaveFocus();
    expect(month).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{End}');
    expect(year).toHaveFocus();
    await user.keyboard('{ArrowRight}'); // wraps
    expect(week).toHaveFocus();
    await user.keyboard('{Home}');
    expect(week).toHaveFocus();
  });

  it('RTL: ArrowLeft moves to the next tab (direction-aware)', async () => {
    const user = userEvent.setup();
    render(<Controlled dir="rtl" />);
    const [week, month] = screen.getAllByRole('tab');
    week.focus();
    await user.keyboard('{ArrowLeft}');
    expect(month).toHaveFocus();
    expect(month).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowRight}');
    expect(week).toHaveFocus();
  });
});
