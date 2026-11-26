/**
 * src/styles/mobile.css: the rules whose effect the component tests cannot see (jsdom has no layout
 * and the root vitest config has `css: false`), checked as text against the real markup they target.
 *
 * - The keyboard hint "You can also press Ctrl+S" under the buttons of the entry form is hidden on
 *   the phone (nothing on a touch screen hints at shortcuts) and kept where a hardware keyboard and
 *   a pointer are in use (a tablet with a keyboard), the same condition as `shortcutHintsAvailable`.
 * - Owner's decision of 2026-11-25: the menu is at the top. No rule of the old bottom navigation or
 *   its "More" sheet is left; the page keeps room for the gesture bar and, where the floating button is
 *   shown, for the button and a message of up to three lines above it;
 *   the "Menu" button of the app bar never cuts its word (the title beside it takes the ellipsis);
 *   the menu dialog is a panel from the top, under the status bar, while every other dialog stays a
 *   bottom sheet; the menu's rules use logical properties only - checked as text and as jsdom's
 *   computed style of the real markup.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { MobileShell } from '@/components/layout/MobileShell';
import { LocationDisplay, renderWithProviders } from '@/test/render';
import { EntryForm } from '@/pages/entries/EntryForm';
import { ET } from '@/pages/entries/texts';
import { emptyEntryValues, useEntryForm } from '@/pages/entries/useEntryForm';

/**
 * A stylesheet of this folder as text. Read from disk: with `css: false` even `?inline` / `?raw` CSS
 * imports come back empty. The Node modules are loaded through a computed specifier because the root
 * tsconfig deliberately has no Node types (it checks browser code).
 */
async function readStylesheet(name: string): Promise<string> {
  const load = (specifier: string) => import(/* @vite-ignore */ specifier);
  const { readFileSync } = (await load('node:fs')) as { readFileSync(file: string, encoding: 'utf8'): string };
  const { fileURLToPath } = (await load('node:url')) as { fileURLToPath(url: string): string };
  const { dirname, join } = (await load('node:path')) as { dirname(p: string): string; join(...parts: string[]): string };
  return readFileSync(join(dirname(fileURLToPath(import.meta.url)), name), 'utf8');
}

let mobileCss = '';
let baseCss = '';
beforeAll(async () => {
  mobileCss = (await readStylesheet('mobile.css')).replace(/\/\*[\s\S]*?\*\//g, '');
  baseCss = (await readStylesheet('base.css')).replace(/\/\*[\s\S]*?\*\//g, '');
});

/** The text between the braces of the first `@media <query> { ... }` block (nested braces balanced). */
function mediaBlock(query: string, css = mobileCss): string {
  const start = css.indexOf(`@media ${query}`);
  expect(start, `@media ${query}`).toBeGreaterThanOrEqual(0);
  const open = css.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}' && --depth === 0) return css.slice(open + 1, i);
  }
  throw new Error(`unbalanced @media ${query}`);
}

/** Declarations of every rule in `css` whose selector list is exactly `selector`. */
function rules(css: string, selector: string): Record<string, string>[] {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(?:^|[{}])\\s*${escaped}\\s*\\{([^{}]*)\\}`, 'g');
  const found: Record<string, string>[] = [];
  for (const match of css.matchAll(re)) {
    const decls: Record<string, string> = {};
    for (const part of match[1].split(';')) {
      const i = part.indexOf(':');
      if (i > 0) decls[part.slice(0, i).trim()] = part.slice(i + 1).trim();
    }
    found.push(decls);
  }
  return found;
}

/** Every declaration block of mobile.css (inside or outside a media query): its selector list, normalised, and its declarations. */
function allBlocks(): { selectors: string[]; decls: Record<string, string> }[] {
  return [...mobileCss.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => {
    const decls: Record<string, string> = {};
    for (const part of m[2].split(';')) {
      const i = part.indexOf(':');
      if (i > 0) decls[part.slice(0, i).trim()] = part.slice(i + 1).trim();
    }
    const selectors = m[1]
      .trim()
      .split(',')
      .map((s) => s.trim().replace(/\s+/g, ' '));
    return { selectors, decls };
  });
}

/** The blocks whose selector list contains `selector`. */
function blocksWith(selector: string) {
  return allBlocks().filter((b) => b.selectors.includes(selector));
}

/** The entry form with an empty new entry, as the "New entry" page renders it. */
function Form() {
  const form = useEntryForm(emptyEntryValues());
  return <EntryForm form={form} onSubmit={() => undefined} onCancel={() => undefined} />;
}

describe('mobile.css: the Ctrl+S hint of the entry form', () => {
  const selector = '.platform-mobile .form__actions > span.text-small';

  it('the hint is the small <span> right inside .form__actions - the markup the rule targets', () => {
    const { container } = render(<Form />);
    const hint = screen.getByText(ET.saveHint);
    expect(hint.tagName).toBe('SPAN');
    expect(hint).toHaveClass('text-small');
    expect(hint.parentElement).toHaveClass('form__actions');
    // The only such element in the form: the rule hides nothing else.
    expect(container.querySelectorAll('.form__actions > span.text-small')).toHaveLength(1);
    expect(container.querySelector(selector.replace('.platform-mobile ', ''))).toBe(hint);
  });

  it('is hidden on the phone and shown again only with a hardware keyboard and a pointer', () => {
    const pointerFine = mediaBlock('(hover: hover) and (pointer: fine)');
    const outside = mobileCss.replace(pointerFine, '');

    const hidden = rules(outside, selector);
    expect(hidden).toHaveLength(1);
    expect(hidden[0].display).toBe('none');

    const restored = rules(pointerFine, selector);
    expect(restored).toHaveLength(1);
    expect(restored[0].display).toBe('inline');
  });
});

/** Installs `css` as a stylesheet of the test document; returns the function that removes it again. */
function installStylesheet(css: string): () => void {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
  return () => style.remove();
}

/** The phone shell around an empty page, signed in, at `route` (signed in, the "Menu" button is rendered). */
function renderShellAt(route: string) {
  return renderWithProviders(
    <MobileShell>
      <Routes>
        <Route path="*" element={<LocationDisplay />} />
      </Routes>
    </MobileShell>,
    { auth: 'authenticated', locale: 'en', route },
  );
}

/** Physical box properties: the menu's rules use the logical ones, so right-to-left mirrors by itself. */
const PHYSICAL = /^(left|right|top|bottom|(margin|padding|border)-(left|right|top|bottom)(-.*)?|border-(top|bottom)-(left|right)-radius|float|clear)$/;

describe('mobile.css: no bottom bar and no "More" sheet any more (owner decision 2026-11-25)', () => {
  it('no rule, token or attribute of the bottom navigation or of the "More" sheet is left', () => {
    expect(mobileCss).not.toMatch(/bottom-nav/);
    expect(mobileCss).not.toMatch(/more-sheet/);
  });

  it('the page keeps room for the gesture bar and, where the floating button is shown, for the button (and a message above it: next test)', () => {
    const base = rules(mobileCss, '.platform-mobile .main');
    expect(base).toHaveLength(1);
    expect(base[0].padding).toContain('var(--safe-bottom)');
    const withFab = rules(mobileCss, '.platform-mobile .app-root[data-fab] .main');
    expect(withFab).toHaveLength(1);
    expect(withFab[0]['padding-block-end']).toMatch(/^calc\(var\(--safe-bottom\) \+ \d+(\.\d+)?rem\)$/);
    // The bottom block (the floating button) stands above the gesture bar and lets the page through.
    const bottom = rules(mobileCss, '.platform-mobile .mobile-shell__bottom');
    expect(bottom).toHaveLength(1);
    expect(bottom[0]['padding-block-end']).toBe('var(--safe-bottom)');
    expect(bottom[0]['pointer-events']).toBe('none');
  });

  it('a message stands above the floating button, and the end of a list keeps room for it', () => {
    const rem = (value: string | undefined) => Number(/^calc\(var\(--safe-bottom\) \+ (\d+(?:\.\d+)?)rem\)$/.exec(value ?? '')?.[1]);
    const room = rem(rules(mobileCss, '.platform-mobile .app-root[data-fab] .main')[0]['padding-block-end']);
    const toasts = rules(mobileCss, '.platform-mobile body:has(.app-root[data-fab]) .toast-region');
    expect(toasts).toHaveLength(1);
    const toast = rem(toasts[0]['inset-block-end']);
    // The floating button is 1rem above the gesture bar and at least 3.5rem high (.fab): the message is over it, not on it.
    const fab = rules(mobileCss, '.platform-mobile .fab')[0];
    expect(fab['min-height']).toBe('3.5rem');
    expect(fab.margin).toContain('var(--space-4)');
    expect(toast).toBeGreaterThanOrEqual(1 + 3.5);
    // A message is about 4.6rem high with one line (the 48 px close button, the box's padding and its border),
    // about 5.4rem with two and about 6.9rem with three - what the longer messages take on a phone in the
    // languages with long words. The list ends above that, so such a message does not lie over the last lines
    // or the "Open" button of the last entry. (With room only for the floating button it covered both; with
    // the room the list had above the old bottom navigation, 6.25rem, a message of three lines still reached
    // over the end of the list.)
    expect(room - toast).toBeGreaterThanOrEqual(6.9);
    // Without the floating button the message stands just above the gesture bar.
    expect(rules(mobileCss, '.platform-mobile .toast-region')[0]['inset-block-end']).toBe('calc(var(--space-4) + var(--safe-bottom))');
  });
});

describe('mobile.css: the "Menu" button of the top app bar', () => {
  it('the markup the rules target: the last child of the bar, with the icon and the word', () => {
    const { container } = renderShellAt('/diary');
    const button = container.querySelector('.top-bar__inner > .top-bar__menu');
    expect(button).not.toBeNull();
    expect(button?.parentElement?.lastElementChild).toBe(button);
    expect(button?.querySelector(':scope > svg.shell-icon')).not.toBeNull();
    expect(button?.querySelector(':scope > span.top-bar__menu-label')).toHaveTextContent('Menu');
  });

  it('the word is never cut - the title beside it takes the ellipsis; a 48 px target; visible focus; a border in forced colours', () => {
    const menu = rules(mobileCss, '.platform-mobile .top-bar__menu');
    expect(menu).toHaveLength(1);
    expect(menu[0].flex).toBe('0 0 auto');
    expect(menu[0]['white-space']).toBe('nowrap');
    expect(menu[0]['min-height']).toBe('var(--touch-target)');
    expect(menu[0]['min-width']).toBe('var(--touch-target)');
    expect(rules(mobileCss, '.platform-mobile .top-bar__menu-label')[0].flex).toBe('0 0 auto');
    const titles = rules(mobileCss, '.platform-mobile .top-bar__titles');
    expect(titles[0].flex).toBe('1 1 auto');
    expect(titles[0]['min-width']).toBe('0');
    const title = blocksWith('.platform-mobile .top-bar__title').find((b) => 'text-overflow' in b.decls);
    expect(title?.decls['text-overflow']).toBe('ellipsis');
    expect(title?.decls['white-space']).toBe('nowrap');

    const focus = blocksWith('.platform-mobile .top-bar__menu:focus-visible');
    expect(focus).toHaveLength(1);
    expect(focus[0].selectors).toContain('.platform-mobile .top-bar__back:focus-visible');
    expect(focus[0].selectors).toContain('.platform-mobile .main-menu__item:focus-visible');
    expect(focus[0].decls.outline).toBe('var(--focus-ring-width) solid var(--color-focus)');

    const forced = mediaBlock('(forced-colors: active)');
    const bordered = rules(forced.replace(/,\s+/g, ', '), '.platform-mobile .top-bar__menu, .platform-mobile .main-menu__item, .platform-mobile .fab');
    expect(bordered).toHaveLength(1);
    expect(bordered[0].border).toBe('1px solid CanvasText');
    // The current row keeps a mark of its own when forced colours drop its background.
    expect(rules(forced, '.platform-mobile .main-menu__item[aria-current="page"]')[0]['border-color']).toBe('Highlight');
  });

  it('a long word in a menu row wraps inside the row (200 % text size on a narrow phone), never scrolling the panel sideways', () => {
    const label = rules(mobileCss, '.platform-mobile .main-menu__item > span');
    expect(label).toHaveLength(1);
    expect(label[0]['min-width']).toBe('0');
    expect(label[0]['overflow-wrap']).toBe('anywhere');
  });
});

describe('mobile.css: the menu is a panel from the top; every other dialog stays a bottom sheet', () => {
  it('the bottom-sheet rules of every dialog are unchanged', () => {
    const sheet = blocksWith('.platform-mobile .dialog').find((b) => b.selectors.includes('.platform-mobile .dialog--lock'));
    expect(sheet?.decls.position).toBe('fixed');
    expect(sheet?.decls['inset-block']).toBe('auto 0');
    expect(sheet?.decls['border-radius']).toBe('var(--radius-lg) var(--radius-lg) 0 0');
    expect(rules(mobileCss, '.platform-mobile .dialog[open]')[0].animation).toBe('mobile-sheet-in 200ms ease-out');
    expect(rules(mobileCss, '.platform-mobile .dialog__content::before')[0].content).toBe('""');
  });

  it('the menu overrides them: from the top edge under the status bar, rounded at the bottom, sliding down, no grab handle', () => {
    const panel = rules(mobileCss, '.platform-mobile .dialog.dialog--menu');
    expect(panel).toHaveLength(1);
    expect(panel[0]['inset-block']).toBe('0 auto');
    expect(panel[0]['border-radius']).toBe('0 0 var(--radius-lg) var(--radius-lg)');
    expect(panel[0]['padding-block']).toBe('var(--safe-top) 0');
    expect(panel[0]['border-block-start-width']).toBe('0');
    expect(rules(mobileCss, '.platform-mobile .dialog.dialog--menu[open]')[0].animation).toBe('mobile-menu-in 200ms ease-out');
    const keyframes = mobileCss.slice(mobileCss.indexOf('@keyframes mobile-menu-in'));
    expect(keyframes).toMatch(/^@keyframes mobile-menu-in\s*\{\s*from\s*\{\s*transform: translateY\(-\d+%\)/);
    expect(rules(mobileCss, '.platform-mobile .dialog--menu .dialog__content::before')[0].content).toBe('none');
  });

  it('only the menu is touched: every rule that names it is scoped to it, and uses logical properties only', () => {
    const menuBlocks = allBlocks().filter((b) => b.selectors.some((s) => /dialog--menu|main-menu|top-bar__menu/.test(s)));
    expect(menuBlocks.length).toBeGreaterThan(8);
    for (const block of menuBlocks) {
      for (const selector of block.selectors) {
        // The one focus rule the menu shares with the back arrow and the floating button.
        if (/:focus-visible$/.test(selector)) continue;
        // The forced-colours border the menu shares with the floating button.
        if (selector === '.platform-mobile .fab') continue;
        expect(selector).toMatch(/\.dialog--menu|\.main-menu|\.top-bar__menu/);
      }
      for (const property of Object.keys(block.decls)) expect(property, `${block.selectors.join(', ')} sets ${property}`).not.toMatch(PHYSICAL);
    }
  });

  it("reduced motion: base.css stops every animation, the menu's slide included (as for the sheets)", () => {
    const reduced = mediaBlock('(prefers-reduced-motion: reduce)', baseCss);
    expect(rules(reduced.replace(/,\s+/g, ', '), '*, *::before, *::after')[0]['animation-duration']).toBe('0.001ms !important');
    expect(baseCss).toMatch(/\[data-reduce-motion="true"\] \*,[\s\S]*?animation-duration: 0\.001ms !important;/);
  });

  it('jsdom, the stylesheet applied to the real markup: the open menu is a top panel, the "Log out?" question still a bottom sheet', async () => {
    const { user } = renderShellAt('/settings');
    const uninstall = installStylesheet(mobileCss);
    try {
      await user.click(screen.getByRole('button', { name: 'Menu' }));
      const panel = screen.getByRole('dialog', { name: 'Menu' });
      expect(panel).toHaveClass('dialog', 'dialog--menu', 'main-menu');
      let cs = getComputedStyle(panel);
      expect(cs.position).toBe('fixed');
      expect(cs.getPropertyValue('inset-block')).toBe('0 auto');
      expect(cs.borderRadius).toBe('0 0 var(--radius-lg) var(--radius-lg)');
      expect(cs.animation).toBe('mobile-menu-in 200ms ease-out');

      // The rows: every destination a row of the same shape, the current section marked.
      const rows = [...panel.querySelectorAll<HTMLElement>('nav .main-menu__item')];
      expect(rows).toHaveLength(9);
      const current = rows.filter((r) => r.getAttribute('aria-current') === 'page');
      expect(current.map((r) => r.textContent)).toEqual(['Settings']);
      expect(getComputedStyle(current[0]).fontWeight).toBe('700');
      expect(getComputedStyle(rows[0]).fontWeight).toBe('500');
      // 3.25rem (52 px): above the 48 px target.
      for (const row of rows) expect(getComputedStyle(row).minHeight).toBe('52px');

      await user.click(screen.getByRole('button', { name: 'Log out' }));
      const question = await screen.findByRole('dialog', { name: 'Log out' });
      expect(question).not.toHaveClass('dialog--menu');
      cs = getComputedStyle(question);
      expect(cs.position).toBe('fixed');
      expect(cs.getPropertyValue('inset-block')).toBe('auto 0');
      expect(cs.borderRadius).toBe('var(--radius-lg) var(--radius-lg) 0 0');
      expect(cs.animation).toBe('mobile-sheet-in 200ms ease-out');
    } finally {
      uninstall();
    }
  });
});
