/**
 * Global keyboard shortcuts. The list is rendered by ShortcutsDialog and
 * implemented by useKeyboardShortcuts (navigation ones come from NAV_ITEMS).
 * Descriptions are resolved in the current language when read.
 */
import { NAV_ITEMS } from '@shared/constants';
import { tr } from '@/i18n/runtime';
import { navItemLabel } from './routes';

export type ShortcutGroup = 'navigation' | 'actions' | 'forms';

export interface ShortcutDef {
  /** Human readable key combination, e.g. "Alt+1". */
  keys: string;
  /** Description in the current language. */
  readonly description: string;
  /** Group of the dialog table the shortcut is listed in. */
  group: ShortcutGroup;
}

function shortcut(keys: string, descriptionKey: string, group: ShortcutGroup): ShortcutDef {
  return {
    keys,
    group,
    get description() {
      return tr(descriptionKey);
    },
  };
}

export const SHORTCUTS: ShortcutDef[] = [
  ...NAV_ITEMS.map(
    (item): ShortcutDef => ({
      keys: `Alt+${item.key}`,
      group: 'navigation',
      get description() {
        return navItemLabel(item);
      },
    }),
  ),
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
