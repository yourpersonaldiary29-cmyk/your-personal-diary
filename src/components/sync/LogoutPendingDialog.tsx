/**
 * The sign-out question when changes are still on this device (docs/android-tasks/OFFLINE-DESIGN.md
 * section 4.8): "{n} changes on this device have not been uploaded yet. If you sign out now they will be
 * deleted from this device." [Stay signed in] (default, also Escape) [Review] [Delete them and sign out].
 * The lock screen's "Log out" asks the same, without "Review" (it would show the diary behind the lock).
 */
import { useId, useRef } from 'react';
import { Dialog } from '@/components/a11y/Dialog';
import { Button } from '@/components/ui/Button';
import { tr } from '@/i18n/runtime';
import type { LogoutPrompt } from './syncGate';
import './sync.css';

export type LogoutDialogChoice = 'stay' | 'review' | 'delete';

export interface LogoutPendingDialogProps {
  /** The open question, or null (closed). */
  prompt: LogoutPrompt | null;
  onChoose: (choice: LogoutDialogChoice) => void;
}

export function LogoutPendingDialog({ prompt, onChoose }: LogoutPendingDialogProps) {
  const textId = `logout-pending-${useId()}`;
  const stayRef = useRef<HTMLButtonElement>(null);
  // The text stays while the dialog closes.
  const last = useRef<LogoutPrompt>({ count: 0, allowReview: false });
  if (prompt) last.current = prompt;
  const shown = prompt ?? last.current;

  return (
    <Dialog
      open={prompt !== null}
      onClose={() => onChoose('stay')}
      title={tr('shell.sync.logout.title')}
      size="sm"
      describedBy={textId}
      initialFocusRef={stayRef}
      footer={
        <>
          <Button ref={stayRef} onClick={() => onChoose('stay')}>
            {tr('shell.sync.logout.stay')}
          </Button>
          {shown.allowReview && (
            <Button variant="secondary" onClick={() => onChoose('review')}>
              {tr('shell.sync.review')}
            </Button>
          )}
          <Button variant="danger" onClick={() => onChoose('delete')}>
            {tr('shell.sync.logout.delete')}
          </Button>
        </>
      }
    >
      <p id={textId} data-testid="logout-pending-text">
        {tr('shell.sync.logout.text', { count: shown.count })}
      </p>
    </Dialog>
  );
}
