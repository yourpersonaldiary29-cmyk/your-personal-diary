/**
 * Duration in minutes entered as hours + minutes (two number boxes inside a
 * fieldset). Both boxes empty -> null ("not reported"); otherwise the total
 * number of minutes. A visible summary ("1 hour and 30 minutes") is read with the group.
 * An error is attached to both boxes too (focus lands on a box, not on the group).
 */
import { useEffect, useState, type ChangeEvent } from 'react';
import { subscribe, tr } from '@/i18n/runtime';
import { formatMinutes } from '@/utils/format';
import { cx } from '@/components/ui/cx';

export interface DurationInputProps {
  /** Id of the fieldset; the inputs get `${id}-hours` / `${id}-minutes`. */
  id: string;
  label: string;
  /** Total minutes or null. */
  value: number | null;
  onChange: (value: number | null) => void;
  hint?: string;
  error?: string | null;
  required?: boolean;
  disabled?: boolean;
  /** Upper bound in hours for the hours box (default 24). */
  maxHours?: number;
  className?: string;
}

/** Labels of the two boxes in the current language (live ES-module bindings). */
export let HOURS_LABEL = tr('shell.duration.hours');
export let MINUTES_LABEL = tr('shell.duration.minutes');
subscribe(() => {
  HOURS_LABEL = tr('shell.duration.hours');
  MINUTES_LABEL = tr('shell.duration.minutes');
});

function split(value: number | null): { h: string; m: string } {
  if (value === null || !Number.isFinite(value)) return { h: '', m: '' };
  const total = Math.max(0, Math.round(value));
  return { h: String(Math.floor(total / 60)), m: String(total % 60) };
}

export function DurationInput({
  id,
  label,
  value,
  onChange,
  hint,
  error,
  required = false,
  disabled = false,
  maxHours = 24,
  className,
}: DurationInputProps) {
  const [parts, setParts] = useState(() => split(value));
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const summaryId = `${id}-summary`;
  const describedBy = [hintId, errorId, summaryId].filter(Boolean).join(' ');

  // Reflect external changes (loading an entry, reset) without fighting typing.
  useEffect(() => {
    const current = toMinutes(parts);
    if (current !== value) setParts(split(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function toMinutes(p: { h: string; m: string }): number | null {
    const hEmpty = p.h.trim() === '';
    const mEmpty = p.m.trim() === '';
    if (hEmpty && mEmpty) return null;
    const h = hEmpty ? 0 : Number(p.h);
    const m = mEmpty ? 0 : Number(p.m);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    return Math.max(0, Math.round(h * 60 + m));
  }

  const update = (next: { h: string; m: string }) => {
    setParts(next);
    onChange(toMinutes(next));
  };

  const onHours = (e: ChangeEvent<HTMLInputElement>) => update({ ...parts, h: e.currentTarget.value });
  const onMinutes = (e: ChangeEvent<HTMLInputElement>) => update({ ...parts, m: e.currentTarget.value });

  const onBlur = () => {
    // Normalise: 90 minutes -> 1 hour 30 minutes; negative -> 0.
    const total = toMinutes(parts);
    const normalised = split(total);
    if (normalised.h !== parts.h || normalised.m !== parts.m) setParts(normalised);
  };

  return (
    <fieldset
      id={id}
      className={cx('fieldset', 'fieldset--plain', className)}
      aria-describedby={describedBy}
      aria-invalid={error ? true : undefined}
      aria-required={required || undefined}
      disabled={disabled}
    >
      <legend className="fieldset__legend">{label}</legend>
      {hint && (
        <p id={hintId} className="field__hint">
          {hint}
        </p>
      )}
      <div className="duration">
        <div className="duration__part">
          <label htmlFor={`${id}-hours`}>{HOURS_LABEL}</label>
          <input
            type="number"
            id={`${id}-hours`}
            className="input input--number"
            inputMode="numeric"
            min={0}
            max={maxHours}
            step={1}
            value={parts.h}
            aria-invalid={error ? true : undefined}
            aria-describedby={errorId}
            onChange={onHours}
            onBlur={onBlur}
          />
        </div>
        <div className="duration__part">
          <label htmlFor={`${id}-minutes`}>{MINUTES_LABEL}</label>
          <input
            type="number"
            id={`${id}-minutes`}
            className="input input--number"
            inputMode="numeric"
            min={0}
            max={59}
            step={1}
            value={parts.m}
            aria-invalid={error ? true : undefined}
            aria-describedby={errorId}
            onChange={onMinutes}
            onBlur={onBlur}
          />
        </div>
        <span id={summaryId} className="field__unit">
          {formatMinutes(value)}
        </span>
      </div>
      {error && (
        <p id={errorId} className="field__error">
          {error}
        </p>
      )}
    </fieldset>
  );
}
