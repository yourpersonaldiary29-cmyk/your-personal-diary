/**
 * The web app manifest (public/manifest.webmanifest, WP-H4) is only useful when index.html links it -
 * without the <link rel="manifest"> browsers never load it, so the hosted site could not be installed
 * as a PWA (stage-A finding "dead PWA manifest"). This test keeps the link, the file and its icons together.
 * Files are read through Vite (`?raw`, `import.meta.glob`) - the root tsconfig has no Node types.
 */
import { describe, expect, it } from 'vitest';
import indexHtml from '../../index.html?raw';
import manifestRaw from '../../public/manifest.webmanifest?raw';

/** Every file under public/ (copied verbatim into dist/ by Vite), keyed by its served path. */
const PUBLIC_FILES = new Set(Object.keys(import.meta.glob('/public/**', { eager: false })).map((k) => k.replace(/^\/public/, '')));

interface WebManifest {
  name: string;
  short_name: string;
  start_url: string;
  scope: string;
  display: string;
  theme_color: string;
  background_color: string;
  icons: { src: string; sizes: string; type: string }[];
}

describe('index.html links the web app manifest', () => {
  const doc = new DOMParser().parseFromString(indexHtml, 'text/html');

  it('has exactly one <link rel="manifest"> pointing at /manifest.webmanifest, which exists in public/', () => {
    const links = Array.from(doc.querySelectorAll('link[rel="manifest"]'));
    expect(links.map((l) => l.getAttribute('href'))).toEqual(['/manifest.webmanifest']);
    expect(PUBLIC_FILES.has('/manifest.webmanifest')).toBe(true);
  });

  it('keeps the favicon it already had', () => {
    const icon = doc.querySelector('link[rel="icon"]');
    expect(icon?.getAttribute('href')).toBe('/favicon.svg');
    expect(PUBLIC_FILES.has('/favicon.svg')).toBe(true);
  });

  it('the manifest is valid JSON, names the brand in English, and its icons and colours exist / match', () => {
    const manifest = JSON.parse(manifestRaw) as WebManifest;
    expect(manifest.name).toBe('Your Personal Diary');
    expect(manifest.short_name.length).toBeGreaterThan(0);
    expect(manifest.start_url.startsWith('/')).toBe(true);
    expect(manifest.scope).toBe('/');
    expect(manifest.display).toBe('standalone');
    expect(manifest.theme_color).toBe(doc.querySelector('meta[name="theme-color"]')?.getAttribute('content'));
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
    for (const icon of manifest.icons) {
      expect({ src: icon.src, exists: PUBLIC_FILES.has(icon.src) }).toEqual({ src: icon.src, exists: true });
    }
    expect(manifest.icons.some((i) => i.sizes === '512x512')).toBe(true);
  });
});
