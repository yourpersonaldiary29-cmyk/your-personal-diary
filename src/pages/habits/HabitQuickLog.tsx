/**
 * Quick logging controls for one habit on a given date (used by the home page
 * and the habits page):
 * - progress text ("5 of 8 glasses") and a ProgressBar;
 * - "+1" button, a number box to set today's amount (optional note field) and
 *   an "Update" button; habits with a target of 1 get "Mark as done" instead.
 * Every action calls `PUT /api/habits/logs` and then `onChanged()` so the
 * parent reloads its data. Results are announced politely. Texts: 'habits.log.*'.
 * Automatic offline mode: a log kept on this device (no connection) also says
 * "Saved on this device..." (one toast per save).
 */
import { useEffect, useState, type FormEvent } from 'react';
import type { HabitWithProgress } from '@shared/types';
import * as api from '@/api';
import { VisuallyHidden } from '@/components/a11y/VisuallyHidden';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { NumberInput } from '@/components/ui/NumberInput';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { TextInput } from '@/components/ui/TextInput';
import { useAnnouncer } from '@/context/AnnouncerContext';
import { savedOnDevice, showSavedOnDevice } from '@/components/sync/syncGate';
import { useToast } from '@/context/ToastContext';
import { tr } from '@/i18n/runtime';
import { errorMessage } from '@/utils/errors';
import { formatNumber } from '@/utils/format';
import { progressText, progressValue, todayValue } from './habit-text';

export const QUICK_LOG_TEXTS = {
  get plusOne() {
    return tr('habits.log.plusOne');
  },
  get markDone() {
    return tr('habits.log.markDone');
  },
  get undoDone() {
    return tr('habits.log.undoDone');
  },
  get setValue() {
    return tr('habits.log.setValue');
  },
  get note() {
    return tr('habits.log.note');
  },
  get doneToday() {
    return tr('habits.log.doneToday');
  },
  get valueRequired() {
    return tr('habits.log.valueRequired');
  },
  formLabel: (name: string) => tr('habits.log.formLabel', { name }),
  amountLabel: (name: string) => tr('habits.log.amountLabel', { name }),
  /** Announcement after a log was saved: "Water: 6 glasses" (+ ", target reached"). */
  saved: (name: string, value: number, unit: string, targetMet: boolean) =>
    tr(targetMet ? 'habits.log.savedTargetMet' : 'habits.log.saved', { name, value: formatNumber(value), unit }),
  removed: (name: string) => tr('habits.log.removed', { name }),
} as const;

export interface HabitQuickLogProps {
  item: HabitWithProgress;
  /** ISO date the log belongs to (usually today). */
  date: string;
  /** Called after a log was saved or removed; the parent reloads its data. */
  onChanged: () => void | Promise<void>;
  /** Show the note field next to the amount (habits page). */
  withNote?: boolean;
  /** Prefix for the input ids (must be unique per habit on the page). */
  idPrefix: string;
}

export function HabitQuickLog({ item, date, onChanged, withNote = false, idPrefix }: HabitQuickLogProps) {
  const { habit } = item;
  const { announce } = useAnnouncer();
  const toast = useToast();
  const [draft, setDraft] = useState<number | null>(item.today?.value ?? null);
  const [note, setNote] = useState(item.today?.note ?? '');
  const [draftError, setDraftError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Keep the local draft in step with the server copy after a reload.
  useEffect(() => {
    setDraft(item.today?.value ?? null);
    setNote(item.today?.note ?? '');
  }, [item.today?.value, item.today?.note]);

  const save = async (value: number, noteText: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const logged = await api.habits.log({ habitId: habit.id, date, value, note: noteText });
      const met = habit.frequency === 'weekly' ? item.weekTotal - todayValue(item) + value >= habit.target : value >= habit.target;
      announce(QUICK_LOG_TEXTS.saved(habit.name, value, habit.unit, met), 'polite');
      if (savedOnDevice(logged, { kind: 'habit', id: habit.id })) showSavedOnDevice((message) => toast.info(message));
      await onChanged();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await api.habits.removeLog(habit.id, date);
      announce(QUICK_LOG_TEXTS.removed(habit.name), 'polite');
      if (savedOnDevice(undefined, { kind: 'habit', id: habit.id })) showSavedOnDevice((message) => toast.info(message));
      await onChanged();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const onSubmitValue = (e: FormEvent) => {
    e.preventDefault();
    if (draft === null || Number.isNaN(draft)) {
      setDraftError(QUICK_LOG_TEXTS.valueRequired);
      document.getElementById(`${idPrefix}-value`)?.focus();
      return;
    }
    setDraftError(null);
    void save(Math.max(0, draft), note);
  };

  const done = todayValue(item) > 0;
  const singleTarget = habit.target === 1;

  return (
    <div className="stack-sm">
      <p>{progressText(item)}</p>
      {/* The same amount is already in the paragraph above; the bar keeps it as aria-valuetext. */}
      <ProgressBar value={progressValue(item)} max={habit.target} label={habit.name} unit={habit.unit} hideText />
      {singleTarget ? (
        <div className="cluster">
          {done && <Badge kind="success">{QUICK_LOG_TEXTS.doneToday}</Badge>}
          {/* One button that changes its label, so keyboard focus stays on it after marking / unmarking. */}
          <Button variant={done ? 'ghost' : 'secondary'} size="sm" loading={busy} onClick={() => void (done ? remove() : save(1, note))}>
            {done ? QUICK_LOG_TEXTS.undoDone : QUICK_LOG_TEXTS.markDone}
            {' '}
            <VisuallyHidden>{habit.name}</VisuallyHidden>
          </Button>
        </div>
      ) : (
        <form className="cluster" onSubmit={onSubmitValue} noValidate aria-label={QUICK_LOG_TEXTS.formLabel(habit.name)}>
          <Button variant="secondary" size="sm" loading={busy} onClick={() => void save(todayValue(item) + 1, note)}>
            {/* A signed number: isolated left to right, or Hebrew / Arabic pages draw it "1+". */}
            <bdi dir="ltr">{QUICK_LOG_TEXTS.plusOne}</bdi>
            {' '}
            <VisuallyHidden>{habit.name}</VisuallyHidden>
          </Button>
          <NumberInput
            id={`${idPrefix}-value`}
            label={QUICK_LOG_TEXTS.amountLabel(habit.name)}
            value={draft}
            onChange={(v) => {
              setDraft(v);
              if (draftError) setDraftError(null);
            }}
            min={0}
            unit={habit.unit}
            error={draftError}
            inputMode="decimal"
          />
          {withNote && (
            <Field id={`${idPrefix}-note`} label={QUICK_LOG_TEXTS.note}>
              {(a11y) => <TextInput {...a11y} value={note} onChange={(e) => setNote(e.currentTarget.value)} maxLength={200} />}
            </Field>
          )}
          <Button type="submit" size="sm" loading={busy}>
            {QUICK_LOG_TEXTS.setValue}
            {' '}
            <VisuallyHidden>{habit.name}</VisuallyHidden>
          </Button>
        </form>
      )}
    </div>
  );
}
