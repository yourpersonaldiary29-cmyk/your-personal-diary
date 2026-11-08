/**
 * One command of the owner's "Server" card for his own PowerShell window (ServerSection.tsx: the
 * archive's download and check commands; DeletionRequest.tsx: the find and delete commands): a named
 * group with the label, an optional hint, the command itself (left-to-right inside right-to-left
 * pages, wrapping at phone width, selectable as a whole) and a Copy button.
 */
import { useId, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { useAnnouncer } from '@/context/AnnouncerContext';
import { useToast } from '@/context/ToastContext';
import { copyText } from './clipboard';
import { SVT } from './serverTexts';

export interface CommandBlockProps {
  /** Names the group (label, hint, command, Copy). */
  label: string;
  command: string;
  copyLabel: string;
  /** Id of the Copy button (focus targets, tests). */
  buttonId?: string;
  /** A sentence under the label, linked to the group as its description. */
  hint?: ReactNode;
}

export function CommandBlock({ label, command, copyLabel, buttonId, hint }: CommandBlockProps) {
  const { announce } = useAnnouncer();
  const toast = useToast();
  const labelId = useId();
  const hintId = useId();
  const onCopy = async () => {
    let ok: boolean;
    try {
      ok = await copyText(command);
    } catch {
      ok = false;
    }
    if (ok) {
      announce(SVT.copied, 'polite');
      toast.success(SVT.copied, { announced: true });
    } else {
      toast.error(SVT.copyFailed);
    }
  };
  // The label names the group (label, command, Copy); a <pre> is a generic element and may not carry a name itself.
  return (
    <div className="server-card__command" role="group" aria-labelledby={labelId} aria-describedby={hint ? hintId : undefined}>
      <span id={labelId} className="server-card__command-label">
        {label}
      </span>
      {hint && (
        <p id={hintId} className="server-card__command-hint">
          {hint}
        </p>
      )}
      <pre className="server-card__code" dir="ltr" translate="no">
        <code>{command}</code>
      </pre>
      <div>
        <Button id={buttonId} variant="secondary" size="sm" onClick={() => void onCopy()}>
          {copyLabel}
        </Button>
      </div>
    </div>
  );
}
