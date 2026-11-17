/**
 * Tests of site/site.js, the one script of the public site (docs/site-tasks/SITE.md sections 2, 3 and 8):
 *
 *   node --test scripts/site/site-js.test.mjs
 *
 * The real file runs here, unchanged, against a small DOM double (no browser and no DOM library: the script
 * uses a dozen members of the DOM, and the double has exactly those). Its two behaviours:
 *   1. the language chooser - shown by the script in place of the list of language links (which the markup shows),
 *      and only the "Change" button opens the same page in the chosen language (picking an option alone changes
 *      nothing);
 *   2. the Downloads tabs - the three platform sections become a WAI-ARIA tab list (roles, aria-selected,
 *      aria-controls, roving tabindex; Left / Right / Home / End, the arrows mirrored in a right-to-left page), and
 *      the visitor's own platform is selected first when the browser tells it.
 * One test builds the double from the Downloads page the builder really writes, so that the hooks of the script
 * (ids, classes, the label attribute) and the markup cannot drift apart. That the file holds no network call,
 * no storage and no address is checked by build-site.test.mjs and by the builder itself (scriptProblems).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { LOCALES } from '../legal/build-pages.mjs';
import { buildSite, pageFile, PLATFORMS, ROOT, SCRIPT_FILE } from './build-site.mjs';
import { FILLED } from './fixture-tree.mjs';

const SOURCE = readFileSync(path.join(ROOT, SCRIPT_FILE), 'utf8');

const UA = {
  windows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  linux: 'Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0',
};

// ---------------------------------------------------------------------------------------------
// The DOM double: exactly what site.js uses
// ---------------------------------------------------------------------------------------------

class FakeElement {
  constructor(tag, doc) {
    this.tagName = tag.toUpperCase();
    this.ownerDocument = doc;
    this.attributes = new Map();
    this.children = [];
    this.parent = null;
    this.listeners = new Map();
    this.id = '';
    this.className = '';
    this.textContent = '';
    this.hidden = false;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  appendChild(child) {
    child.parent = this;
    this.children.push(child);
    return child;
  }

  insertBefore(child, reference) {
    const at = this.children.indexOf(reference);
    assert.ok(at >= 0, 'insertBefore: the reference is a child');
    child.parent = this;
    this.children.splice(at, 0, child);
    return child;
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }

  /** Calls the listeners of an event; returns the event, so that a test can see whether it was prevented. */
  dispatch(type, init = {}) {
    const event = { type, target: this, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...init };
    for (const listener of this.listeners.get(type) ?? []) listener(event);
    return event;
  }

  focus() {
    this.ownerDocument.activeElement = this;
  }

  /** Descendants in document order. */
  descendants() {
    return this.children.flatMap((child) => [child, ...child.descendants()]);
  }

  /** '.class' or 'tag': the two forms the script uses. */
  querySelectorAll(selector) {
    const match = selector.startsWith('.') ? (el) => el.className.split(' ').includes(selector.slice(1)) : (el) => el.tagName === selector.toUpperCase();
    return this.descendants().filter(match);
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null;
  }
}

/**
 * A page as the builder writes it, reduced to what the script touches.
 *   languages  [{ value, selected }] - the options of the language list, or null for a page without the chooser
 *   panels     [{ id, name }] - the platform sections of the Downloads page, or null for any other page
 */
function makePage({ dir = 'ltr', languages = [{ value: './', selected: true }, { value: './he/', selected: false }, { value: './ar/', selected: false }], panels = null, tabsLabel = 'Operating system', userAgent = UA.linux, maxTouchPoints = 0, hash = '' } = {}) {
  const document = { activeElement: null };
  const create = (tag, props = {}) => Object.assign(new FakeElement(tag, document), props);
  const root = create('html');
  root.setAttribute('dir', dir);
  const body = root.appendChild(create('body'));
  document.documentElement = root;
  document.createElement = (tag) => create(tag);
  document.getElementById = (id) => root.descendants().find((el) => el.id === id) ?? null;

  let select = null;
  if (languages) {
    const chooser = body.appendChild(create('div', { id: 'lang-chooser', className: 'chooser', hidden: true }));
    select = chooser.appendChild(create('select', { id: 'lang-select' }));
    select.options = languages.map(({ value, selected }) => select.appendChild(create('option', { value, selected, defaultSelected: selected })));
    Object.defineProperty(select, 'selectedIndex', { get: () => select.options.findIndex((option) => option.selected) });
    chooser.appendChild(create('button', { id: 'lang-change' }));
    // The list of language links, shown in the markup.
    body.appendChild(create('nav', { id: 'lang-list', className: 'langs' }));
  }
  if (panels) {
    const box = body.appendChild(create('div', { id: 'platforms', className: 'tabs' }));
    box.setAttribute('data-tabs-label', tabsLabel);
    for (const { id, name } of panels) {
      const panel = box.appendChild(create('section', { id, className: 'panel' }));
      panel.appendChild(create('h2', { textContent: name }));
      panel.appendChild(create('table'));
    }
  }

  const opened = [];
  const windowListeners = new Map();
  const window = {
    location: { hash, assign: (address) => opened.push(address) },
    addEventListener: (type, listener) => windowListeners.set(type, [...(windowListeners.get(type) ?? []), listener]),
  };
  const fire = (type) => (windowListeners.get(type) ?? []).forEach((listener) => listener({ type }));
  /** Picks a language as a visitor does with the arrow keys: the list changes, nothing else happens. */
  const pick = (index) => select.options.forEach((option, i) => { option.selected = i === index; });
  return { document, window, navigator: { userAgent, maxTouchPoints }, opened, fire, pick, byId: document.getElementById, root };
}

/** Runs the real site.js against a page double. */
function runScript(page) {
  vm.runInNewContext(SOURCE, { document: page.document, window: page.window, navigator: page.navigator }, { filename: 'site.js' });
  return page;
}

const THREE = [{ id: 'windows', name: 'Windows' }, { id: 'android', name: 'Android' }, { id: 'mac', name: 'Mac' }];
/** The state of the tabs of a page: which tab is selected, which can be reached with Tab, which panel is shown. */
function tabsOf(page) {
  const tabs = page.root.querySelectorAll('.tab');
  const panels = page.root.querySelectorAll('.panel');
  return {
    tabs,
    panels,
    selected: tabs.filter((tab) => tab.getAttribute('aria-selected') === 'true').map((tab) => tab.getAttribute('aria-controls')),
    reachable: tabs.filter((tab) => tab.getAttribute('tabindex') === '0').map((tab) => tab.getAttribute('aria-controls')),
    shown: panels.filter((panel) => !panel.hidden).map((panel) => panel.id),
    focused: page.document.activeElement?.id ?? null,
  };
}
const only = (id) => ({ selected: [id], reachable: [id], shown: [id] });
const stateOf = (page) => {
  const { selected, reachable, shown } = tabsOf(page);
  return { selected, reachable, shown };
};

// ---------------------------------------------------------------------------------------------
// 1. The language chooser
// ---------------------------------------------------------------------------------------------

test('language chooser: the script shows it; only the Change button opens the chosen language', () => {
  const page = runScript(makePage());
  const chooser = page.byId('lang-chooser');
  const change = page.byId('lang-change');
  assert.equal(chooser.hidden, false, 'hidden in the markup, shown once the script runs');
  assert.equal(page.byId('lang-list').hidden, true, 'the list of language links, shown in the markup, makes way for it');
  // The language of the page is chosen: the button does nothing.
  change.dispatch('click');
  assert.deepEqual(page.opened, []);
  // Picking another language changes nothing by itself (WCAG 3.2.2): no listener waits for it.
  page.pick(1);
  assert.deepEqual([...page.byId('lang-select').listeners.keys()], [], 'nothing listens to the list');
  assert.deepEqual(page.opened, []);
  // The button opens the same page in that language: the address is the value of the option, as the builder wrote it.
  change.dispatch('click');
  assert.deepEqual(page.opened, ['./he/']);
  page.pick(2);
  change.dispatch('click');
  assert.deepEqual(page.opened, ['./he/', './ar/']);
});

test('language chooser: a page that comes back from the history shows its own language again', () => {
  const page = runScript(makePage());
  const select = page.byId('lang-select');
  page.pick(2);
  assert.equal(select.selectedIndex, 2);
  page.fire('pageshow');
  assert.equal(select.selectedIndex, 0, 'the option the page was written with');
  page.byId('lang-change').dispatch('click');
  assert.deepEqual(page.opened, [], 'and Change does nothing again');
});

test('language chooser: a page without it, or with a part of it missing, is left alone', () => {
  assert.doesNotThrow(() => runScript(makePage({ languages: null })));
  const page = makePage();
  page.byId('lang-change').id = 'something-else';
  assert.doesNotThrow(() => runScript(page));
  assert.equal(page.byId('lang-chooser').hidden, true, 'a chooser that cannot work stays hidden');
  assert.equal(page.byId('lang-list').hidden, false, 'and the list of language links stays');
  // Without the list, the chooser still works.
  const listless = makePage();
  listless.byId('lang-list').id = '';
  runScript(listless);
  assert.equal(listless.byId('lang-chooser').hidden, false);
});

// ---------------------------------------------------------------------------------------------
// 2. The Downloads tabs
// ---------------------------------------------------------------------------------------------

test('tabs: the three sections become a tab list with the roles, names and relations of the WAI-ARIA pattern', () => {
  const page = runScript(makePage({ panels: THREE, tabsLabel: 'Operating system' }));
  const box = page.byId('platforms');
  const [tablist, ...rest] = box.children;
  assert.deepEqual([tablist.tagName, tablist.className, tablist.getAttribute('role'), tablist.getAttribute('aria-label')], ['DIV', 'tablist', 'tablist', 'Operating system'], 'the tab list stands before the first panel, named by the label of the page');
  assert.deepEqual(rest.map((el) => el.id), ['windows', 'android', 'mac'], 'the panels keep their order');
  assert.deepEqual(box.className.split(' '), ['tabs', 'tabs-on']);
  const { tabs, panels } = tabsOf(page);
  assert.equal(tabs.length, 3);
  tabs.forEach((tab, i) => {
    assert.equal(tab.parent, tablist);
    assert.deepEqual(
      [tab.tagName, tab.getAttribute('type'), tab.getAttribute('role'), tab.id, tab.getAttribute('aria-controls'), tab.className],
      ['BUTTON', 'button', 'tab', `tab-${THREE[i].id}`, THREE[i].id, 'tab'],
      `tab ${i}`,
    );
    // The name of the tab is the heading of its section, in one isolated element (a flex item).
    assert.deepEqual(tab.children.map((el) => [el.tagName, el.textContent]), [['BDI', THREE[i].name]]);
    assert.deepEqual([panels[i].getAttribute('role'), panels[i].getAttribute('aria-labelledby'), panels[i].getAttribute('tabindex')], ['tabpanel', tab.id, '0'], `panel ${i}`);
    assert.ok(['true', 'false'].includes(tab.getAttribute('aria-selected')) && ['0', '-1'].includes(tab.getAttribute('tabindex')));
  });
  // Exactly one tab is selected, only that one is in the Tab order, only its panel is shown.
  assert.deepEqual(stateOf(page), only('windows'));
  assert.equal(page.document.activeElement, null, 'building the tabs does not move the focus');
});

test('tabs: the visitor\'s own platform is selected first when the browser tells it, otherwise the first tab', () => {
  const first = (options) => stateOf(runScript(makePage({ panels: THREE, ...options })));
  assert.deepEqual(first({ userAgent: UA.windows }), only('windows'));
  assert.deepEqual(first({ userAgent: UA.android }), only('android'));
  assert.deepEqual(first({ userAgent: UA.mac }), only('mac'));
  // An iPhone, an iPad that calls itself a Mac, Linux, a browser that says nothing: no file is theirs.
  assert.deepEqual(first({ userAgent: UA.iphone }), only('windows'));
  assert.deepEqual(first({ userAgent: UA.mac, maxTouchPoints: 5 }), only('windows'));
  assert.deepEqual(first({ userAgent: UA.linux }), only('windows'));
  assert.deepEqual(first({ userAgent: '' }), only('windows'));
  // An address that names a section opens that tab on any device; another fragment leaves the choice to the platform.
  assert.deepEqual(first({ userAgent: UA.windows, hash: '#mac' }), only('mac'));
  assert.deepEqual(first({ userAgent: UA.android, hash: '#windows' }), only('windows'));
  assert.deepEqual(first({ userAgent: UA.android, hash: '#contact' }), only('android'));
  assert.deepEqual(first({ userAgent: UA.mac, hash: '#' }), only('mac'));
});

test('tabs: a click selects a tab; Left / Right / Home / End move the selection and the focus, and wrap', () => {
  const page = runScript(makePage({ panels: THREE, userAgent: UA.windows }));
  const { tabs } = tabsOf(page);
  const press = (key) => {
    const tab = tabs.find((t) => t.getAttribute('aria-selected') === 'true');
    const event = tab.dispatch('keydown', { key });
    return { ...stateOf(page), focused: page.document.activeElement?.id ?? null, prevented: event.defaultPrevented };
  };
  // A click selects without moving the focus (the browser has already focused the button).
  tabs[2].dispatch('click');
  assert.deepEqual(stateOf(page), only('mac'));
  assert.equal(page.document.activeElement, null);
  tabs[0].dispatch('click');
  assert.deepEqual(stateOf(page), only('windows'));
  // The arrow keys: the next and the previous tab, around the ends; the focus follows the selection.
  assert.deepEqual(press('ArrowRight'), { ...only('android'), focused: 'tab-android', prevented: true });
  assert.deepEqual(press('ArrowRight'), { ...only('mac'), focused: 'tab-mac', prevented: true });
  assert.deepEqual(press('ArrowRight'), { ...only('windows'), focused: 'tab-windows', prevented: true });
  assert.deepEqual(press('ArrowLeft'), { ...only('mac'), focused: 'tab-mac', prevented: true });
  assert.deepEqual(press('ArrowLeft'), { ...only('android'), focused: 'tab-android', prevented: true });
  assert.deepEqual(press('Home'), { ...only('windows'), focused: 'tab-windows', prevented: true });
  assert.deepEqual(press('End'), { ...only('mac'), focused: 'tab-mac', prevented: true });
  assert.deepEqual(press('End'), { ...only('mac'), focused: 'tab-mac', prevented: true });
  // Every other key is left to the browser: Tab leaves the list, Enter and Space press the button.
  for (const key of ['Tab', 'Enter', ' ', 'ArrowDown', 'ArrowUp', 'a', 'Escape']) {
    assert.deepEqual(press(key), { ...only('mac'), focused: 'tab-mac', prevented: false }, `the key ${JSON.stringify(key)}`);
  }
});

test('tabs: in a right-to-left page the arrows are mirrored - Left is the next tab', () => {
  const page = runScript(makePage({ dir: 'rtl', panels: THREE, userAgent: UA.windows }));
  const { tabs } = tabsOf(page);
  const press = (key) => {
    tabs.find((t) => t.getAttribute('aria-selected') === 'true').dispatch('keydown', { key });
    return stateOf(page);
  };
  assert.deepEqual(press('ArrowLeft'), only('android'));
  assert.deepEqual(press('ArrowLeft'), only('mac'));
  assert.deepEqual(press('ArrowLeft'), only('windows'));
  assert.deepEqual(press('ArrowRight'), only('mac'));
  assert.deepEqual(press('ArrowRight'), only('android'));
  // Home and End keep their meaning: the first and the last tab.
  assert.deepEqual(press('End'), only('mac'));
  assert.deepEqual(press('Home'), only('windows'));
});

test('tabs: a page with one section, or with none, stays as it is', () => {
  const single = runScript(makePage({ panels: [THREE[0]] }));
  assert.deepEqual(single.root.querySelectorAll('.tablist'), []);
  assert.equal(single.byId('platforms').className, 'tabs');
  assert.equal(single.byId('windows').getAttribute('role'), null);
  const other = runScript(makePage({ panels: null }));
  assert.deepEqual(other.root.querySelectorAll('.tab'), []);
});

// ---------------------------------------------------------------------------------------------
// The script and the pages the builder writes
// ---------------------------------------------------------------------------------------------

test('the script fits the pages: the chooser and the tabs of the real Downloads page, English and Hebrew', () => {
  const site = buildSite({ settings: FILLED });
  for (const code of ['en', 'he']) {
    const html = site.pages.get(pageFile('downloads', code));
    // The hooks, read from the markup with plain expressions.
    assert.match(html, /<div class="chooser" id="lang-chooser" role="group" aria-labelledby="lang-label" hidden>/);
    assert.match(html, /<select id="lang-select" autocomplete="off">/);
    assert.match(html, /<button class="btn" id="lang-change" type="button">/);
    // The list of language links is ordinary markup, shown (no hidden attribute, no <noscript>).
    assert.match(html, /<nav class="langs" id="lang-list" aria-labelledby="lang-list-label">\n<p id="lang-list-label">[^<]+<\/p>\n<ul>/);
    assert.ok(!html.includes('<noscript'), `${code}: no <noscript>`);
    const languages = [...html.matchAll(/<option value="([^"]+)" lang="([a-z]+)"( selected)?>/g)].map((m) => ({ value: m[1], lang: m[2], selected: Boolean(m[3]) }));
    assert.deepEqual(languages.map((option) => option.lang), LOCALES.map((l) => l.code));
    const box = /<div class="tabs" id="platforms" data-tabs-label="([^"]+)">/.exec(html);
    assert.ok(box, `${code}: the box of the platform sections`);
    const panels = [...html.matchAll(/<section class="panel" id="([a-z]+)">\n<h2>(?:<bdi>)?([^<]+)(?:<\/bdi>)?<\/h2>/g)].map((m) => ({ id: m[1], name: m[2] }));
    assert.deepEqual(panels.map((panel) => panel.id), PLATFORMS);
    const dir = /<html lang="[a-z]+" dir="(ltr|rtl)">/.exec(html)[1];

    const page = runScript(makePage({ dir, languages, panels, tabsLabel: box[1], userAgent: UA.android }));
    assert.equal(page.byId('lang-chooser').hidden, false);
    assert.equal(page.byId('lang-list').hidden, true);
    assert.deepEqual(stateOf(page), only('android'));
    const { tabs } = tabsOf(page);
    assert.deepEqual(tabs.map((tab) => tab.children[0].textContent), panels.map((panel) => panel.name));
    assert.equal(page.byId('platforms').children[0].getAttribute('aria-label'), box[1]);
    // The next tab: Right in the English page, Left in the Hebrew one.
    tabs[1].dispatch('keydown', { key: dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight' });
    assert.deepEqual(stateOf(page), only('mac'));
    // The chooser: the other language of the pair, by the address the builder wrote into the option.
    const target = code === 'en' ? 'he' : 'en';
    page.pick(languages.findIndex((option) => option.lang === target));
    page.byId('lang-change').dispatch('click');
    assert.deepEqual(page.opened, [code === 'en' ? '../he/downloads/' : '../../downloads/']);
  }
});
