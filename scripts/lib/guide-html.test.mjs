import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { flattenLinks, guidePage, guideToHtml } from './guide-html.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

test('a fenced block becomes one <pre> with its lines, escaped, and the text around it stays Markdown', () => {
  const md = ['# Title', '', 'Run this:', '', '```bash', 'export PATH="$HOME/x:$PATH"', 'cd ~/Developer && ls <dir>', '```', '', 'Then **done**.'].join('\n');
  const { title, body } = guideToHtml(md);
  assert.equal(title, 'Title');
  assert.ok(body.includes('<pre dir="ltr"><code>export PATH=&quot;$HOME/x:$PATH&quot;\ncd ~/Developer &amp;&amp; ls &lt;dir&gt;</code></pre>'));
  assert.ok(body.includes('<p>Then <strong>done</strong>.</p>'));
  assert.ok(!body.includes('```'));
  assert.ok(!body.includes('<code dir="ltr"></code>'));
});

test('an indented fence inside a list item loses only its own indentation, and the list numbering continues after it', () => {
  const md = ['1. First step:', '', '   ```', '   npm run build', '     nested', '   ```', '', '2. Second step', '3. Third step'].join('\n');
  const { body } = guideToHtml(md);
  assert.ok(body.includes('<code>npm run build\n  nested</code>'));
  assert.ok(body.includes('<ol start="2">'));
});

test('"* " bullets become list items and [text](url) links keep both the text and the address', () => {
  const { body } = guideToHtml(['* one', '* two [the guide](docs/MAC-RELEASE.he.md)', '  * nested'].join('\n'));
  assert.ok(body.startsWith('<ul>'));
  assert.ok(body.includes('<li>one</li>'));
  assert.ok(body.includes('two the guide (docs/MAC-RELEASE.he.md)'));
  assert.ok(!/<p>\* /.test(body));
  assert.equal(flattenLinks('[https://a.example/x](https://a.example/x)'), 'https://a.example/x');
});

test('the real guides of the kit folders render without joined code lines, literal bullets or raw links', () => {
  for (const rel of ['scripts/ios/README.he.md', 'docs/PLAY-RELEASE.he.md', 'appstore/CHECKLIST.he.md', 'appstore/ANSWERS.he.md', 'appstore/README.he.md', 'appstore/screenshots/README.he.md', 'docs/MAC-RELEASE.he.md']) {
    const md = readFileSync(path.join(root, rel), 'utf8');
    const { title, body } = guideToHtml(md);
    assert.ok(title, `${rel}: a title`);
    assert.ok(!body.includes('```'), `${rel}: no fence left`);
    assert.ok(!body.includes('<code dir="ltr"></code>'), `${rel}: no empty inline code`);
    assert.ok(!/<p>\* /.test(body), `${rel}: no literal "* " paragraph`);
    assert.ok(!/\]\(/.test(body), `${rel}: no raw Markdown link`);
    const fences = (md.match(/^\s*(```|~~~)/gm) ?? []).length;
    assert.equal((body.match(/<pre dir="ltr">/g) ?? []).length, fences / 2, `${rel}: one <pre> per fenced block`);
  }
});

test('the page is RTL Hebrew with the title escaped', () => {
  const html = guidePage('A <b> title', '<p>x</p>');
  assert.ok(html.startsWith('<!DOCTYPE html>\n<html lang="he" dir="rtl">'));
  assert.ok(html.includes('<title>A &lt;b&gt; title</title>'));
  assert.ok(html.includes('<main>\n<p>x</p>\n</main>'));
});
