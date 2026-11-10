/**
 * Global keyboard shortcuts. The list is rendered by ShortcutsDialog and
 * implemented by useKeyboardShortcuts (navigation ones come from NAV_ITEMS).
 * Descriptions are resolved in the current language when read, and `label` in
 * the wording of the running platform: the Mac app shows "⌘N" / "⌥1" for the
 * same "Ctrl+N" / "Alt+1" (src/utils/platform-keys.ts); `keys` never changes.
 */
import { NAV_ITEMS } from '@shared/constants';
import { tr } from '@/i18n/runtime';
import { shortcutLabel } from '@/utils/platform-keys';
import { navItemLabel } from './routes';

export type ShortcutGroup = 'navigation' | 'actions' | 'forms';

export interface ShortcutDef {
  /** Key combination in the words the hook documents, e.g. "Alt+1" (the data; a stable row key). */
  keys: string;
  /** `keys` as the running platform writes it: "Alt+1" everywhere but the Mac app, "⌥1" there (read at render). */
  readonly label: string;
  /** Description in the current language. */
  readonly description: string;
  /** Group of the dialog table the shortcut is listed in. */
  group: ShortcutGroup;
}

function shortcut(keys: string, descriptionKey: string, group: ShortcutGroup): ShortcutDef {
  return {
    keys,
    group,
    get label() {
      return shortcutLabel(keys);
    },
    get description() {
      return tr(descriptionKey);
    },
  };
}

export const SHORTCUTS: ShortcutDef[] = [
  ...NAV_ITEMS.map((item): ShortcutDef => {
    const keys = `Alt+${item.key}`;
    return {
      keys,
      group: 'navigation',
      get label() {
        return shortcutLabel(keys);
      },
      get description() {
        return navItemLabel(item);
      },
    };
  }),
  shortcut('Alt+←', 'shell.shortcuts.back', 'navigation'),
  shortcut('Ctrl+N', 'shell.shortcuts.newEntry', 'actions'),
  shortcut('Ctrl+K', 'shell.shortcuts.search', 'actions'),
  shortcut('Ctrl+L', 'shell.shortcuts.lock', 'actions'),
  shortcut('Shift+?', 'shell.shortcuts.list', 'actions'),
  shortcut('Ctrl+S', 'shell.shortcuts.save', 'forms'),
  shortcut('Esc', 'shell.shortcuts.escape', 'forms'),
];

/** Groups in display order. */
export const SHORTCUT_GROUPS: ShortcutGroup[] = ['navigation', 'actions', 'forms'];

/** Heading of a shortcut group in the current language. */
export function shortcutGroupLabel(group: ShortcutGroup): string {
  return tr(`shell.shortcuts.group.${group}`);
}
