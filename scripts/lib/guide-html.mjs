/**
 * The owner's Hebrew guides as standalone web pages (the kit folders of scripts/{play,store,appstore}/
 * assemble-desktop-folder.mjs). store/render.mjs mdToHtml knows the Markdown of docs/STORE-RELEASE.he.md
 * only; the other guides also use ``` code blocks, "* " bullets and [text](url) links, which it would
 * print as one joined line with empty <code> elements, as literal "* " paragraphs and as raw brackets.
 * guideToHtml() splits the text at the code fences, renders every text part with mdToHtml (after
 * turning "* " bullets into "- " and [text](url) into "text (url)"), and every fenced block as
 * <pre dir="ltr"><code>. An ordered list that continues after a code block keeps its numbering.
 */
import { mdToHtml } from '../../store/render.mjs';

export function escapeHtml(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** [text](url) -> "text (url)", or just the URL when the text is the URL (mdToHtml links bare URLs). */
export function flattenLinks(md) {
  return md.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, text, url) => (text === url ? url : `${text} (${url})`));
}

/** Markdown of a guide -> { title, body } (body = HTML for inside <main>). */
export function guideToHtml(md) {
  const lines = String(md).replace(/\r\n?/g, '\n').split('\n');
  const parts = [];
  let text = [];
  let code = null;
  let fenceIndent = 0;
  for (const line of lines) {
    const fence = /^(\s*)(```|~~~)/.exec(line);
    if (fence) {
      if (code === null) {
        parts.push({ md: text.join('\n') });
        text = [];
        code = [];
        fenceIndent = fence[1].length;
      } else {
        parts.push({ code: code.join('\n') });
        code = null;
      }
      continue;
    }
    if (code !== null) {
      const lead = line.length - line.trimStart().length;
      code.push(line.slice(Math.min(fenceIndent, lead)));
    } else {
      text.push(line.replace(/^(\s*)\* /, '$1- '));
    }
  }
  if (code !== null) parts.push({ code: code.join('\n') });
  else parts.push({ md: text.join('\n') });

  let title = '';
  const body = [];
  for (const part of parts) {
    if ('code' in part) {
      const block = part.code.replace(/^\n+/, '').replace(/\s+$/, '');
      if (block) body.push(`<pre dir="ltr"><code>${escapeHtml(block)}</code></pre>`);
      continue;
    }
    if (!part.md.trim()) continue;
    const rendered = mdToHtml(flattenLinks(part.md));
    if (!title && rendered.title) title = rendered.title;
    let html = rendered.body;
    const first = /^\s*(\d+)\.\s/.exec(part.md.split('\n').find((l) => l.trim()) ?? '');
    if (first && Number(first[1]) > 1) html = html.replace(/^<ol>/, `<ol start="${Number(first[1])}">`);
    body.push(html);
  }
  return { title, body: body.join('\n') };
}

/** The page around a guide: RTL Hebrew, light and dark colours, readable code blocks. */
export function guidePage(title, body) {
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
:root{color-scheme:light dark;--bg:#fff;--text:#1c2430;--accent:#1f5fa8;--line:#d5dbe3;--box:#f3f6fa}
@media (prefers-color-scheme:dark){:root{--bg:#14181f;--text:#e8ecf2;--accent:#8fc1ff;--line:#3a4352;--box:#1d232d}}
body{margin:0;background:var(--bg);color:var(--text);font-family:"Segoe UI",system-ui,-apple-system,Arial,sans-serif;line-height:1.7}
main{max-width:52rem;margin:0 auto;padding:1.5rem 1.25rem 3rem}
h2{margin-top:2.2rem;padding-top:1rem;border-top:1px solid var(--line)}
li{margin:.35rem 0}
code{direction:ltr;unicode-bidi:isolate;background:var(--box);border:1px solid var(--line);border-radius:.25rem;padding:.05rem .3rem;font-family:Consolas,Menlo,monospace;overflow-wrap:anywhere;user-select:all}
pre{direction:ltr;text-align:left;background:var(--box);border:1px solid var(--line);border-radius:.4rem;padding:.75rem;overflow-x:auto;white-space:pre}
pre code{background:none;border:0;padding:0;overflow-wrap:normal}
blockquote{margin:1rem 0;padding:.5rem 1rem;background:var(--box);border-inline-start:4px solid var(--line)}
table{border-collapse:collapse;width:100%}td,th{border:1px solid var(--line);padding:.4rem .6rem;text-align:start;vertical-align:top}
a{color:var(--accent)}
</style>
</head>
<body><main>
${body}
</main></body>
</html>
`;
}
