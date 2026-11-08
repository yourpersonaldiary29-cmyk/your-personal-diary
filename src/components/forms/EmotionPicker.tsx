/**
 * Multi-select of emotions from the shared EMOTIONS catalogue, rendered as a
 * checkbox group inside <fieldset>/<legend>. The value holds emotion keys
 * (stored in the DB); labels come from the 'emotions.<key>.label' catalogue
 * entries (falling back to the shared Hebrew label).
 */
import { useId } from 'react';
import { EMOTIONS, type EmotionDef } from '@shared/constants';
import { subscribe, tr } from '@/i18n/runtime';
import { cx } from '@/components/ui/cx';

export interface EmotionPickerProps {
  /** Selected emotion keys. */
  value: string[];
  onChange: (value: string[]) => void;
  /** Group label, default "Emotions". */
  legend?: string;
  hint?: string;
  error?: string | null;
  disabled?: boolean;
  /** Optional id prefix for the checkboxes (defaults to a generated id). */
  id?: string;
  className?: string;
}

/** Default legend ("Emotions") in the current language (live ES-module binding). */
export let EMOTIONS_LEGEND = tr('shell.emotions.legend');
subscribe(() => {
  EMOTIONS_LEGEND = tr('shell.emotions.legend');
});

/** Label of an emotion in the current language ('emotions.<key>.label'), else the shared label. */
export function emotionText(emotion: EmotionDef): string {
  const key = `emotions.${emotion.key}.label`;
  const text = tr(key);
  return text === key ? emotion.label : text;
}

export function EmotionPicker({
  value,
  onChange,
  legend = EMOTIONS_LEGEND,
  hint,
  error,
  disabled = false,
  id,
  className,
}: EmotionPickerProps) {
  const generated = useId();
  const base = id ?? `emotions-${generated}`;
  const hintId = hint ? `${base}-hint` : undefined;
  const errorId = error ? `${base}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  const selected = new Set(value);

  const toggle = (key: string, checked: boolean) => {
    if (checked) {
      if (selected.has(key)) return;
      // Keep the catalogue order so the stored list is stable.
      const next = EMOTIONS.filter((e) => selected.has(e.key) || e.key === key).map((e) => e.key);
      onChange(next);
    } else {
      onChange(value.filter((k) => k !== key));
    }
  };

  return (
    <fieldset
      id={base}
      className={cx('fieldset', className)}
      aria-describedby={describedBy}
      aria-invalid={error ? true : undefined}
      disabled={disabled}
    >
      <legend className="fieldset__legend">{legend}</legend>
      {hint && (
        <p id={hintId} className="field__hint">
          {hint}
        </p>
      )}
      <div className="check-grid">
        {EMOTIONS.map((emotion) => {
          const inputId = `${base}-${emotion.key}`;
          return (
            <div className="check" key={emotion.key}>
              <input
                type="checkbox"
                id={inputId}
                className="check__input"
                name={base}
                value={emotion.key}
                checked={selected.has(emotion.key)}
                onChange={(e) => toggle(emotion.key, e.currentTarget.checked)}
              />
              <label htmlFor={inputId} className="check__label">
                {emotionText(emotion)}
              </label>
            </div>
          );
        })}
      </div>
      {error && (
        <p id={errorId} className="field__error">
          {error}
        </p>
      )}
    </fieldset>
  );
}
