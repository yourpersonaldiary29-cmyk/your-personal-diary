/**
 * src/styles/mobile.css: the rules whose effect the component tests cannot see (jsdom has no layout
 * and the root vitest config has `css: false`), checked as text against the real markup they target.
 *
 * - The keyboard hint "You can also press Ctrl+S" under the buttons of the entry form is hidden on
 *   the phone (nothing on a touch screen hints at shortcuts) and kept where a hardware keyboard and
 *   a pointer are in use (a tablet with a keyboard), the same condition as `shortcutHintsAvailable`.
 * - The bottom navigation marks the current destination without changing the width of its label
 *   (colour, the icon's pill and a paint-only text stroke - no bold), so the five labels wrap the
 *   same way on every screen and the bar keeps one height in all 20 languages (the bold label used
 *   to wrap to one more line in Greek, Polish and Bulgarian): checked as text and as jsdom's
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
 * The stylesheet as text. Read from disk: with `css: false` even `?inline` / `?raw` CSS imports come
 * back empty. The Node modules are loaded through a computed specifier because the root tsconfig
 * deliberately has no Node types (it checks browser code).
 */
async function readMobileCss(): Promise<string> {
  const load = (specifier: string) => import(/* @vite-ignore */ specifier);
  const { readFileSync } = (await load('node:fs')) as { readFileSync(file: string, encoding: 'utf8'): string };
  const { fileURLToPath } = (await load('node:url')) as { fileURLToPath(url: string): string };
  const { dirname, join } = (await load('node:path')) as { dirname(p: string): string; join(...parts: string[]): string };
  return readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'mobile.css'), 'utf8');
}

let mobileCss = '';
beforeAll(async () => {
  mobileCss = (await readMobileCss()).replace(/\/\*[\s\S]*?\*\//g, '');
});

/** The text between the braces of the first `@media <query> { ... }` block (nested braces balanced). */
function mediaBlock(query: string): string {
  const start = mobileCss.indexOf(`@media ${query}`);
  expect(start, `@media ${query}`).toBeGreaterThanOrEqual(0);
  const open = mobileCss.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < mobileCss.length; i++) {
    if (mobileCss[i] === '{') depth++;
    else if (mobileCss[i] === '}' && --depth === 0) return mobileCss.slice(open + 1, i);
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

/** The phone shell around an empty page, signed in, at `route` (signed in, the bottom navigation is rendered). */
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

describe('mobile.css: the bottom navigation keeps one height on every screen', () => {
  /** Properties that change the width of a text or of its box - what made the bold label wrap. */
  const METRIC_PROPERTIES = [
    'font',
    'font-weight',
    'font-size',
    'font-family',
    'font-style',
    'font-stretch',
    'font-variation-settings',
    'font-feature-settings',
    'font-synthesis',
    'letter-spacing',
    'word-spacing',
    'text-transform',
    'white-space',
    'line-height',
    'text-indent',
    'padding',
    'padding-inline',
    'padding-inline-start',
    'padding-inline-end',
    'padding-left',
    'padding-right',
    'margin',
    'margin-inline',
    'margin-left',
    'margin-right',
    'width',
    'min-width',
    'max-width',
    'gap',
    'column-gap',
    'border',
    'border-width',
    'border-inline',
    'display',
    'flex',
    'flex-basis',
  ];

  /** Every declaration block (inside or outside a media query) whose selector addresses the current destination. */
  function activeBlocks(): { selector: string; properties: string[] }[] {
    return [...mobileCss.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter((m) => m[1].includes('bottom-nav__link--active'))
      .map((m) => ({
        selector: m[1].trim().replace(/\s+/g, ' '),
        properties: m[2]
          .split(';')
          .filter((d) => d.includes(':'))
          .map((d) => d.slice(0, d.indexOf(':')).trim()),
      }));
  }

  it('the markup the rules target: five labels, one link in the current destination (the section of the page)', () => {
    const { container } = renderShellAt('/diary');
    const links = [...container.querySelectorAll('.bottom-nav .bottom-nav__link')];
    expect(links).toHaveLength(5);
    for (const link of links) expect([...link.children].filter((c) => c.matches('span.bottom-nav__label'))).toHaveLength(1);
    const active = container.querySelectorAll('.bottom-nav .bottom-nav__link--active');
    expect(active).toHaveLength(1);
    expect(active[0].querySelector('.bottom-nav__label')).toHaveTextContent('My diary');
  });

  it('the current destination is marked by colour, the icon pill and a paint-only stroke: no rule for it touches a text metric', () => {
    const blocks = activeBlocks();
    const selectors = blocks.map((b) => b.selector);
    expect(selectors).toContain('.platform-mobile .bottom-nav__link--active');
    expect(selectors).toContain('.platform-mobile .bottom-nav__link--active .bottom-nav__label');
    for (const block of blocks) {
      for (const property of block.properties) expect(METRIC_PROPERTIES, `${block.selector} sets ${property}`).not.toContain(property);
    }
    // The emphasis itself: a stroke in the text's own colour, painted under the glyphs.
    const emphasis = rules(mobileCss, '.platform-mobile .bottom-nav__link--active .bottom-nav__label');
    expect(emphasis).toHaveLength(1);
    expect(emphasis[0]['-webkit-text-stroke']).toMatch(/^0\.0[2-4]em currentColor$/);
    expect(emphasis[0]['paint-order']).toBe('stroke fill');
  });

  it('jsdom, the stylesheet applied to the real markup: the current link has the computed font of the other four (the bold rule it replaces would not)', () => {
    const { container } = renderShellAt('/diary');
    const links = [...container.querySelectorAll<HTMLElement>('.bottom-nav .bottom-nav__link')];
    const current = links.find((l) => l.classList.contains('bottom-nav__link--active'))!;
    const others = links.filter((l) => l !== current);
    expect(others).toHaveLength(4);
    const font = (el: HTMLElement) => {
      const cs = getComputedStyle(el);
      return { weight: cs.fontWeight, size: cs.fontSize, family: cs.fontFamily, spacing: cs.letterSpacing };
    };
    const uninstall = installStylesheet(mobileCss);
    try {
      expect(font(current).weight).toBe('500');
      for (const other of others) expect(font(other)).toEqual(font(current));
    } finally {
      uninstall();
    }
    // Control: the rule this replaces (font-weight 700 on the current destination) is what the check catches.
    const uninstallOld = installStylesheet(`${mobileCss}\n.platform-mobile .bottom-nav__link--active { font-weight: 700; }`);
    try {
      expect(font(current).weight).toBe('700');
      expect(font(others[0]).weight).toBe('500');
    } finally {
      uninstallOld();
    }
  });
});
