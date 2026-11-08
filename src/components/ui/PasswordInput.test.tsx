/**
 * PasswordInput: the show/hide toggle, and the layout rule that keeps its label inside the button
 * in every language (the Arabic "Show password" used to run past the button's border, e.g. in the
 * delete-account dialog). jsdom has no layout, so the stylesheet rules the markup relies on are
 * checked as text; the real widths were measured in a browser at 375 px and on the desktop.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { T } from '@/constants/texts';
import { PasswordInput } from './PasswordInput';

/**
 * src/styles/forms.css as text. Read from disk: with `css: false` (vitest.config) even `?raw` CSS
 * imports come back empty. The Node modules are loaded through a computed specifier because the
 * root tsconfig deliberately has no Node types (it checks browser code).
 */
async function readFormsCss(): Promise<string> {
  const load = (specifier: string) => import(/* @vite-ignore */ specifier);
  const { readFileSync } = (await load('node:fs')) as { readFileSync(file: string, encoding: 'utf8'): string };
  const { fileURLToPath } = (await load('node:url')) as { fileURLToPath(url: string): string };
  const { dirname, join } = (await load('node:path')) as { dirname(p: string): string; join(...parts: string[]): string };
  return readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'styles', 'forms.css'), 'utf8');
}

let formsCss = '';
beforeAll(async () => {
  formsCss = await readFormsCss();
});

/** Declarations of the first rule whose selector list is exactly `selector` (comments removed). */
function rule(selector: string): Record<string, string> {
  const css = formsCss.replace(/\/\*[\s\S]*?\*\//g, '');
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`(?:^|})\\s*${escaped}\\s*\\{([^}]*)\\}`).exec(css);
  expect(match, selector).not.toBeNull();
  const decls: Record<string, string> = {};
  for (const part of match![1].split(';')) {
    const i = part.indexOf(':');
    if (i > 0) decls[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return decls;
}

describe('PasswordInput', () => {
  it('renders the input and the toggle inside .password-field, the classes the stylesheet targets', () => {
    const { container } = render(<PasswordInput aria-label={T.password} />);
    const field = container.querySelector('.password-field');
    expect(field?.querySelector(':scope > input.input')).toBe(screen.getByLabelText(T.password));
    expect(field?.querySelector(':scope > button.btn')).toBe(screen.getByRole('button', { name: T.showPassword }));
  });

  it('toggles the visibility with a button named after the action, without a contradicting pressed state', async () => {
    const user = userEvent.setup();
    render(<PasswordInput aria-label={T.password} />);
    const input = screen.getByLabelText(T.password);
    expect(input).toHaveAttribute('type', 'password');
    const toggle = screen.getByRole('button', { name: T.showPassword });
    expect(toggle).not.toHaveAttribute('aria-pressed');
    await user.click(toggle);
    expect(input).toHaveAttribute('type', 'text');
    expect(toggle).toHaveAccessibleName(T.hidePassword);
    expect(toggle).not.toHaveAttribute('aria-pressed');
    await user.click(toggle);
    expect(input).toHaveAttribute('type', 'password');
    expect(toggle).toHaveAccessibleName(T.showPassword);
  });

  it('holds both labels in the button (the inactive one hidden), so its width does not change when toggled', async () => {
    const user = userEvent.setup();
    render(<PasswordInput aria-label={T.password} />);
    const toggle = screen.getByRole('button', { name: T.showPassword });
    const labels = () => [...toggle.querySelectorAll('.password-field__label')].map((el) => [el.textContent, el.getAttribute('aria-hidden')]);
    expect(toggle).toHaveClass('password-field__toggle');
    expect(labels()).toEqual([
      [T.showPassword, null],
      [T.hidePassword, 'true'],
    ]);
    await user.click(toggle);
    expect(labels()).toEqual([
      [T.showPassword, 'true'],
      [T.hidePassword, null],
    ]);
  });

  it('never squeezes the toggle under its label: it keeps its size, the input gives way, and the row may wrap', () => {
    // .btn sets min-width to the touch target, which let the flex item shrink below its text
    // (the Arabic label ran past the button's border).
    expect(rule('.password-field .btn')).toMatchObject({ flex: 'none', 'max-width': '100%', 'white-space': 'normal' });
    expect(rule('.password-field .input')).toMatchObject({ flex: '1 1 8rem', 'min-width': '0' });
    expect(rule('.password-field')).toMatchObject({ display: 'flex', 'flex-wrap': 'wrap' });
    // Both labels in one grid cell; the hidden one still takes its space.
    expect(rule('.password-field .password-field__toggle')).toMatchObject({ display: 'inline-grid' });
    expect(rule('.password-field__label')).toMatchObject({ 'grid-area': '1 / 1' });
    expect(rule('.password-field__label[aria-hidden="true"]')).toMatchObject({ visibility: 'hidden' });
  });
});
