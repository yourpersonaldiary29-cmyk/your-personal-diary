/**
 * The diary entry form (new + edit). Field order is the product spec:
 * date, time, title, body, mood, emotions, energy, stress, sleep quality,
 * sleep hours, exercise (duration + type), events, people, location, notes,
 * tags. State and validation come from `useEntryForm`; this component only
 * renders controls and wires errors to them (aria-describedby / aria-invalid
 * via the shared inputs). Ctrl+S submits from anywhere on the page.
 */
import { useEffect, useId, useRef, type FormEvent, type ReactNode } from 'react';
import { DateInput } from '@/components/forms/DateInput';
import { DurationInput } from '@/components/forms/DurationInput';
import { EmotionPicker } from '@/components/forms/EmotionPicker';
import { RatingInput } from '@/components/forms/RatingInput';
import { TagInput } from '@/components/forms/TagInput';
import { TimeInput } from '@/components/forms/TimeInput';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { NumberInput } from '@/components/ui/NumberInput';
import { TextArea } from '@/components/ui/TextArea';
import { TextInput } from '@/components/ui/TextInput';
import { cx } from '@/components/ui/cx';
import { platformizeHint } from '@/utils/platform-keys';
import { ET } from './texts';
import { ENTRY_LIMITS, entryFieldId, type UseEntryFormResult } from './useEntryForm';

export interface EntrySuggestions {
  tags: string[];
  people: string[];
  locations: string[];
}

export interface EntryFormProps {
  form: UseEntryFormResult;
  /** Called on submit (button, Enter in a single-line field, Ctrl+S). */
  onSubmit: () => void | Promise<void>;
  onCancel: () => void;
  /** Shows the spinner on the save button and ignores further submits. */
  busy?: boolean;
  /** Non-field server error shown in an Alert above the form. */
  serverError?: string | null;
  /** Autocomplete values from api.entries.tags / people / locations. */
  suggestions?: Partial<EntrySuggestions>;
  /** Default "שמירה". */
  submitLabel?: string;
  /** Extra buttons rendered after "ביטול" (e.g. delete in edit mode). */
  extraActions?: ReactNode;
  id?: string;
  className?: string;
}

/** True for Ctrl+S / Cmd+S without other modifiers. */
export function isSaveShortcut(e: KeyboardEvent): boolean {
  return (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 's';
}

export function EntryForm({
  form,
  onSubmit,
  onCancel,
  busy = false,
  serverError,
  suggestions = {},
  submitLabel = ET.save,
  extraActions,
  id,
  className,
}: EntryFormProps) {
  const generated = useId();
  const formId = id ?? `entry-form-${generated}`;
  const serverErrorId = `${formId}-server-error`;
  const locationListId = `${entryFieldId('location')}-suggestions`;
  const { values, errors, setValue } = form;

  // Latest submit handler for the global Ctrl+S listener.
  const submitRef = useRef<() => void>(() => undefined);
  submitRef.current = () => {
    if (busy) return;
    void onSubmit();
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || !isSaveShortcut(e)) return;
      e.preventDefault();
      submitRef.current();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    submitRef.current();
  };

  const locationSuggestions = (suggestions.locations ?? []).filter((s) => s && s !== values.location);

  return (
    <form
      id={formId}
      className={cx('form', 'entry-form', className)}
      noValidate
      onSubmit={handleSubmit}
      aria-describedby={serverError ? serverErrorId : undefined}
    >
      {serverError && (
        <Alert kind="error" role="none" id={serverErrorId}>
          {serverError}
        </Alert>
      )}

      <div className="grid-2">
        <DateInput id={entryFieldId('date')} label={ET.date} value={values.date} onChange={(v) => setValue('date', v)} error={errors.date} required />
        <TimeInput id={entryFieldId('time')} label={ET.time} value={values.time} onChange={(v) => setValue('time', v)} error={errors.time} required />
      </div>

      <Field id={entryFieldId('title')} label={ET.title} error={errors.title}>
        {(a11y) => (
          <TextInput
            {...a11y}
            name="title"
            maxLength={ENTRY_LIMITS.titleMax}
            autoComplete="off"
            value={values.title}
            onChange={(e) => setValue('title', e.currentTarget.value)}
          />
        )}
      </Field>

      <Field id={entryFieldId('body')} label={ET.body} hint={ET.bodyHint} error={errors.body}>
        {(a11y) => <TextArea {...a11y} name="body" autosize minRows={6} value={values.body} onChange={(e) => setValue('body', e.currentTarget.value)} />}
      </Field>

      <RatingInput
        id={entryFieldId('mood')}
        label={ET.mood}
        value={values.mood}
        onChange={(v) => setValue('mood', v)}
        error={errors.mood}
        lowLabel={ET.ratingLow}
        highLabel={ET.ratingHigh}
      />

      <EmotionPicker id={entryFieldId('emotions')} value={values.emotions} onChange={(v) => setValue('emotions', v)} error={errors.emotions} />

      <div className="grid-2">
        <RatingInput
          id={entryFieldId('energy')}
          label={ET.energy}
          value={values.energy}
          onChange={(v) => setValue('energy', v)}
          error={errors.energy}
          lowLabel={ET.ratingLow}
          highLabel={ET.ratingHigh}
        />
        <RatingInput
          id={entryFieldId('stress')}
          label={ET.stress}
          value={values.stress}
          onChange={(v) => setValue('stress', v)}
          error={errors.stress}
          lowLabel={ET.stressLow}
          highLabel={ET.stressHigh}
        />
      </div>

      <div className="grid-2">
        <RatingInput
          id={entryFieldId('sleepQuality')}
          label={ET.sleepQuality}
          value={values.sleepQuality}
          onChange={(v) => setValue('sleepQuality', v)}
          error={errors.sleepQuality}
          lowLabel={ET.ratingLow}
          highLabel={ET.ratingHigh}
        />
        <NumberInput
          id={entryFieldId('sleepHours')}
          label={ET.sleepHours}
          value={values.sleepHours}
          onChange={(v) => setValue('sleepHours', v)}
          min={0}
          max={ENTRY_LIMITS.sleepHoursMax}
          step={0.5}
          unit={ET.hoursUnit}
          error={errors.sleepHours}
          inputMode="decimal"
        />
      </div>

      <div className="grid-2">
        <DurationInput
          id={entryFieldId('exerciseMinutes')}
          label={ET.exercise}
          value={values.exerciseMinutes}
          onChange={(v) => setValue('exerciseMinutes', v)}
          error={errors.exerciseMinutes}
        />
        <Field id={entryFieldId('exerciseType')} label={ET.exerciseType} hint={ET.exerciseTypeHint} error={errors.exerciseType}>
          {(a11y) => (
            <TextInput
              {...a11y}
              name="exerciseType"
              maxLength={ENTRY_LIMITS.exerciseTypeMax}
              autoComplete="off"
              value={values.exerciseType}
              onChange={(e) => setValue('exerciseType', e.currentTarget.value)}
            />
          )}
        </Field>
      </div>

      <TagInput
        id={entryFieldId('events')}
        label={ET.events}
        hint={ET.eventsHint}
        value={values.events}
        onChange={(v) => setValue('events', v)}
        error={errors.events}
        maxItems={ENTRY_LIMITS.itemsMax}
      />

      <TagInput
        id={entryFieldId('people')}
        label={ET.people}
        hint={ET.peopleHint}
        value={values.people}
        onChange={(v) => setValue('people', v)}
        suggestions={suggestions.people ?? []}
        error={errors.people}
        maxItems={ENTRY_LIMITS.itemsMax}
      />

      <Field id={entryFieldId('location')} label={ET.location} error={errors.location}>
        {(a11y) => (
          <>
            <TextInput
              {...a11y}
              name="location"
              maxLength={ENTRY_LIMITS.locationMax}
              autoComplete="off"
              list={locationSuggestions.length > 0 ? locationListId : undefined}
              value={values.location}
              onChange={(e) => setValue('location', e.currentTarget.value)}
            />
            {locationSuggestions.length > 0 && (
              <datalist id={locationListId}>
                {locationSuggestions.map((s) => (
                  <option value={s} key={s} />
                ))}
              </datalist>
            )}
          </>
        )}
      </Field>

      <Field id={entryFieldId('notes')} label={ET.notes} error={errors.notes}>
        {(a11y) => <TextArea {...a11y} name="notes" autosize minRows={3} value={values.notes} onChange={(e) => setValue('notes', e.currentTarget.value)} />}
      </Field>

      <TagInput
        id={entryFieldId('tags')}
        label={ET.tags}
        hint={ET.tagsHint}
        value={values.tags}
        onChange={(v) => setValue('tags', v)}
        suggestions={suggestions.tags ?? []}
        error={errors.tags}
        maxItems={ENTRY_LIMITS.itemsMax}
      />

      <div className="form__actions">
        <Button type="submit" loading={busy} size="lg">
          {submitLabel}
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          {ET.cancel}
        </Button>
        {extraActions}
        <span className="text-muted text-small">{platformizeHint(ET.saveHint)}</span>
      </div>
    </form>
  );
}
