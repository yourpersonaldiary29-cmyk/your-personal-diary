/**
 * Freshness check of the built web client before it is copied into a hosted directory
 * (scripts/build-hosted.mjs -> deploy/hosted/build/ui, scripts/hosted/stage-image.mjs -> the image's ui/).
 *
 * `vite build` copies every file of public/ unchanged into dist/. A file of public/ that is missing
 * from dist/ or differs from its copy there therefore means: dist/ was built BEFORE the last change of
 * public/. The case that happened (docs/android-tasks/PRIVACY-HARDENING.md, fixer): the privacy policy
 * pages that scripts/legal/build-pages.mjs writes to public/privacy/** were updated, dist/ was not
 * rebuilt, and build-hosted.mjs copied the old policy into the hand-over directory without a word.
 * Both scripts now refuse such a dist/ ("run npx vite build first").
 *
 * Only the files of public/ are compared (byte for byte); the bundled assets of dist/ have no source to
 * compare with here, and extra files in dist/ are fine.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * Paths (relative, '/'-separated, sorted) of the files of `publicDir` whose copy in `distDir` is
 * missing or different. Empty when dist/ is current, or when there is no public/ directory at all.
 * @param {string} publicDir the Vite public directory (the project's public/)
 * @param {string} distDir the Vite output directory (the project's dist/)
 * @returns {string[]}
 */
export function staleUiFiles(publicDir, distDir) {
  if (!existsSync(publicDir)) return [];
  const stale = [];
  const walk = (rel) => {
    const dir = path.join(publicDir, rel);
    for (const name of readdirSync(dir).sort()) {
      const relPath = rel ? `${rel}/${name}` : name;
      const source = path.join(dir, name);
      if (statSync(source).isDirectory()) {
        walk(relPath);
        continue;
      }
      const copy = path.join(distDir, ...relPath.split('/'));
      if (!existsSync(copy) || !statSync(copy).isFile() || !readFileSync(copy).equals(readFileSync(source))) stale.push(relPath);
    }
  };
  walk('');
  return stale.sort();
}

/**
 * The refusal message for `stale` (non-empty), naming at most three of the files.
 * @param {string} tool the script's log prefix, e.g. 'build-hosted'
 * @param {string[]} stale the result of `staleUiFiles`
 * @returns {string}
 */
export function staleUiMessage(tool, stale) {
  const shown = stale.slice(0, 3).join(', ') + (stale.length > 3 ? `, ... (${stale.length} files)` : '');
  return `[${tool}] FAILED: dist/ is older than public/ (${shown} differ) - run "npx vite build" first, then run this again`;
}
