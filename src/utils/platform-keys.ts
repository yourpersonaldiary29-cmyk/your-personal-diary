/**
 * Keyboard shortcut wording per platform (docs/apple-tasks/MAC-UI.md).
 *
 * The shortcuts are the same keys everywhere: useKeyboardShortcuts treats the Command key like Ctrl
 * (`e.metaKey`) and reads Option+digit from `e.code`; only in the Mac app does it leave Option+digit and
 * Option+← to macOS while the focus is in a text field. What this module changes is the TEXT. The Mac app shows
 * the key glyphs Mac users know - "⌘N", "⌥1", "⇧?", "⌥←" - while the Windows app and the web UI (also
 * in a browser on a Mac) keep the words "Ctrl+N", "Alt+1", "Shift+?", "Alt+←"; "Esc" is the same on
 * both. Nothing in the 20 catalogues changes: the two hints that spell "Ctrl+S" / "Ctrl+L" ("Strg+S" /
 * "Strg+L" in German) are rewritten at render time by `platformizeHint`.
 *
 * Both functions take the platform as an explicit boolean, so tests pass it and mock nothing; when it
 * is left out it is `isMacApp()` of src/offline/session.ts (the Tauri shell AND a Macintosh user
 * agent - never a browser, whatever its user agent). This module imports nothing from
 * src/offline/native/tauri.ts (src/main.test.tsx), so the web bundle keeps the adapter out.
 */
import { isMacApp } from '@/offline/session';

/** U+2318 PLACE OF INTEREST SIGN: the Command key. */
export const MAC_COMMAND = '⌘';
/** U+2325 OPTION KEY. */
export const MAC_OPTION = '⌥';
/** U+21E7 UPWARDS WHITE ARROW: the Shift key. */
export const MAC_SHIFT = '⇧';
/**
 * U+200E LEFT-TO-RIGHT MARK, put before a glyph in a sentence. The glyphs have no direction of their
 * own: in a Hebrew or Arabic sentence "⌘S" would otherwise split, the "⌘" staying with the Hebrew
 * words and the "S" alone at the left end. The mark makes "⌘S" one left-to-right unit, as "Ctrl+S"
 * already is; it is invisible and has no effect in a left-to-right sentence.
 */
const LRM = '‎';

/** The modifier words of constants/shortcuts.ts and their Mac glyphs ("Strg" is the German catalogue's Ctrl). */
const MAC_MODIFIERS: readonly (readonly [RegExp, string])[] = [
  [/\b(?:Ctrl|Strg)\+/g, MAC_COMMAND],
  [/\bAlt\+/g, MAC_OPTION],
  [/\bShift\+/g, MAC_SHIFT],
];

/** "Ctrl+" followed by one capital letter inside a sentence ("Ctrl+S", "Strg+L"); the letter is kept. */
const CTRL_LETTER_IN_TEXT = /\b(?:Ctrl|Strg)\+([A-Z])\b/g;

/**
 * The key combination of a shortcut as the running platform writes it: in the Mac app "Ctrl+" becomes
 * "⌘", "Alt+" becomes "⌥" and "Shift+" becomes "⇧" ("Alt+1" -> "⌥1", "Ctrl+N" -> "⌘N", "Shift+?" ->
 * "⇧?", "Alt+←" -> "⌥←", "Esc" stays "Esc"); everywhere else `keys` is returned unchanged. Applying it
 * twice changes nothing more.
 */
export function shortcutLabel(keys: string, isMac: boolean = isMacApp()): string {
  if (!isMac) return keys;
  let label = keys;
  for (const [word, glyph] of MAC_MODIFIERS) label = label.replace(word, glyph);
  return label;
}

/**
 * A translated hint that spells a Ctrl shortcut ("You can also press Ctrl+S"): in the Mac app every
 * "Ctrl+<letter>" becomes "⌘<letter>" (preceded by an invisible left-to-right mark, see `LRM`), the
 * rest of the sentence - in any language - is kept as it is; everywhere else `text` is returned
 * unchanged. A translation that does not spell the shortcut this way is never touched.
 */
export function platformizeHint(text: string, isMac: boolean = isMacApp()): string {
  if (!isMac) return text;
  return text.replace(CTRL_LETTER_IN_TEXT, `${LRM}${MAC_COMMAND}$1`);
}
