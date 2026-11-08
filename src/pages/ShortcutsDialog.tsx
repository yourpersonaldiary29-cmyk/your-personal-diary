/**
 * "Keyboard shortcuts" dialog (Shift+?): one table per group from SHORTCUTS,
 * with <kbd> for the key combination. Every text is read in the current
 * language (group captions, column headers and descriptions).
 */
import { Dialog } from '@/components/a11y/Dialog';
import { Button } from '@/components/ui/Button';
import { SHORTCUTS, SHORTCUT_GROUPS, shortcutGroupLabel } from '@/constants/shortcuts';
import { T } from '@/constants/texts';

export interface ShortcutsDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function ShortcutsDialog({ open, onClose }: ShortcutsDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={T.shortcuts}
      size="md"
      id="shortcuts-dialog"
      footer={
        <Button variant="primary" onClick={onClose}>
          {T.close}
        </Button>
      }
    >
      {SHORTCUT_GROUPS.map((group) => {
        const items = SHORTCUTS.filter((s) => s.group === group);
        if (items.length === 0) return null;
        return (
          <table className="shortcuts-table" key={group}>
            <caption>{shortcutGroupLabel(group)}</caption>
            <thead>
              <tr>
                <th scope="col">{T.shortcutColumn}</th>
                <th scope="col">{T.actionColumn}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr key={`${group}-${s.keys}`}>
                  <td>
                    <kbd>{s.keys}</kbd>
                  </td>
                  <td>{s.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      })}
    </Dialog>
  );
}
