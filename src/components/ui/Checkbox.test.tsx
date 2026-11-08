/**
 * Checkbox and RadioGroup: the hint (and the error) sit inside the <label> - clicking them toggles
 * the control - but they must not become part of the accessible name, or screen readers read them
 * twice (once in the name, once as the description). E.g. Settings > Remote access, "Allow access
 * from the internet", and Settings > Privacy, "Offline privacy mode".
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Checkbox } from './Checkbox';
import { RadioGroup } from './RadioGroup';

describe('Checkbox accessible name and description', () => {
  it('is named by the label text only; the hint and the error are the description', () => {
    render(<Checkbox id="allow" label="Allow access" hint="Off by default." error="Required." checked={false} onChange={() => {}} />);
    const box = screen.getByRole('checkbox', { name: 'Allow access' });
    expect(box).toHaveAccessibleName('Allow access');
    expect(box).toHaveAccessibleDescription('Off by default. Required.');
    expect(box).toHaveAttribute('aria-invalid', 'true');
  });

  it('without a hint the name is still the label and there is no description', () => {
    render(<Checkbox label="Remember me" checked onChange={() => {}} />);
    const box = screen.getByRole('checkbox', { name: 'Remember me' });
    expect(box).not.toHaveAttribute('aria-describedby');
    expect(box).not.toHaveAttribute('aria-label');
    expect(box).toBeChecked();
  });

  it('clicking the hint still toggles the box', async () => {
    const onChange = vi.fn();
    render(<Checkbox id="upnp" label="Open the port" hint="Works with most routers." checked={false} onChange={onChange} />);
    await userEvent.setup().click(screen.getByText('Works with most routers.'));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe('RadioGroup option names', () => {
  it('names an option with a hint by its label only and describes it with the hint', () => {
    render(
      <RadioGroup
        legend="Theme"
        name="theme"
        value="system"
        onChange={() => {}}
        options={[
          { value: 'system', label: 'System', hint: 'Follows the computer.' },
          { value: 'dark', label: 'Dark' },
        ]}
      />,
    );
    const system = screen.getByRole('radio', { name: 'System' });
    expect(system).toHaveAccessibleDescription('Follows the computer.');
    // Without a hint the <label> alone names it.
    expect(screen.getByRole('radio', { name: 'Dark' })).not.toHaveAttribute('aria-label');
  });
});
