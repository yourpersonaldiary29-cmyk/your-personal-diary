/**
 * "New habit" / "Edit habit" dialog. A template (shared habitTemplates(locale),
 * in the current UI language) pre-fills the form; the user can change every field. Client-side validation marks the fields (aria-invalid +
 * aria-describedby), announces the error count and focuses the first invalid
 * field. Saves through `POST /api/habits` or `PUT /api/habits/:id`. Messages go to a live region
 * INSIDE the dialog: everything outside a modal <dialog> is inert, so the global announcer would
 * never be heard while the dialog is open.
 * Texts: 'habits.form.*'.
 */
import { useEffect, useState, type FormEvent } from 'react';
import type { Habit, HabitFrequency, HabitInput } from '@shared/types';
import { habitTemplates } from '@shared/constants';
import * as api from '@/api';
import { Dialog } from '@/components/a11y/Dialog';
import { LiveRegion } from '@/components/a11y/LiveRegion';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Field } from '@/components/ui/Field';
import { NumberInput } from '@/components/ui/NumberInput';
import { RadioGroup, type RadioOption } from '@/components/ui/RadioGroup';
import { Select, type SelectOption } from '@/components/ui/Select';
import { TextArea } from '@/components/ui/TextArea';
import { TextInput } from '@/components/ui/TextInput';
import { TimeInput } from '@/components/forms/TimeInput';
import { T } from '@/constants/texts';
import { getCurrentLocale, tr } from '@/i18n/runtime';
import { isValidTime } from '@/utils/dates';
import { errorField, errorMessage } from '@/utils/errors';

export const HABIT_FORM_TEXTS = {
  get newTitle() {
    return tr('habits.form.newTitle');
  },
  editTitle: (name: string) => tr('habits.form.editTitle', { name }),
  get noTemplate() {
    return tr('habits.form.noTemplate');
  },
} as const;

export const HABIT_FORM_LABELS = {
  get template() {
    return tr('habits.form.template');
  },
  get templateHint() {
    return tr('habits.form.templateHint');
  },
  get name() {
    return tr('habits.form.name');
  },
  get description() {
    return tr('habits.form.description');
  },
  get target() {
    return tr('habits.form.target');
  },
  get unit() {
    return tr('habits.form.unit');
  },
  get unitHint() {
    return tr('habits.form.unitHint');
  },
  get frequency() {
    return tr('habits.form.frequency');
  },
  get daily() {
    return tr('habits.frequency.daily');
  },
  get weekly() {
    return tr('habits.frequency.weekly');
  },
  get reminder() {
    return tr('habits.form.reminder');
  },
  get reminderHint() {
    return tr('habits.form.reminderHint');
  },
  get reminderTime() {
    return tr('habits.form.reminderTime');
  },
} as const;

export const HABIT_FORM_ERRORS = {
  get name() {
    return tr('habits.form.error.name');
  },
  get target() {
    return tr('habits.form.error.target');
  },
  get unit() {
    return tr('habits.form.error.unit');
  },
  get reminderTime() {
    return tr('habits.form.error.reminderTime');
  },
} as const;

/** Radio options in the current language (built per render). */
function frequencyOptions(): RadioOption<HabitFrequency>[] {
  return [
    { value: 'daily', label: HABIT_FORM_LABELS.daily },
    { value: 'weekly', label: HABIT_FORM_LABELS.weekly },
  ];
}

interface FormState {
  template: string;
  name: string;
  description: string;
  target: number | null;
  unit: string;
  frequency: HabitFrequency;
  reminderEnabled: boolean;
  reminderTime: string;
}

type FieldKey = 'name' | 'target' | 'unit' | 'reminderTime';
type FormErrors = Partial<Record<FieldKey, string>>;

const FIELD_ORDER: FieldKey[] = ['name', 'target', 'unit', 'reminderTime'];
const FIELD_IDS: Record<FieldKey, string> = {
  name: 'habit-form-name',
  target: 'habit-form-target',
  unit: 'habit-form-unit',
  reminderTime: 'habit-form-reminder-time',
};

const EMPTY: FormState = {
  template: '',
  name: '',
  description: '',
  target: null,
  unit: '',
  frequency: 'daily',
  reminderEnabled: false,
  reminderTime: '',
};

function fromHabit(habit: Habit): FormState {
  return {
    template: '',
    name: habit.name,
    description: habit.description,
    target: habit.target,
    unit: habit.unit,
    frequency: habit.frequency,
    reminderEnabled: habit.reminderEnabled,
    reminderTime: habit.reminderTime ?? '',
  };
}

/** Validates the form; exported for tests. */
export function validateHabitForm(form: FormState): FormErrors {
  const errors: FormErrors = {};
  if (!form.name.trim()) errors.name = HABIT_FORM_ERRORS.name;
  if (form.target === null || !Number.isFinite(form.target) || form.target <= 0) errors.target = HABIT_FORM_ERRORS.target;
  if (!form.unit.trim()) errors.unit = HABIT_FORM_ERRORS.unit;
  if (form.reminderEnabled && !isValidTime(form.reminderTime)) errors.reminderTime = HABIT_FORM_ERRORS.reminderTime;
  return errors;
}

function toInput(form: FormState): HabitInput {
  return {
    name: form.name.trim(),
    description: form.description.trim(),
    target: form.target ?? 0,
    unit: form.unit.trim(),
    frequency: form.frequency,
    reminderTime: form.reminderEnabled ? form.reminderTime : null,
    reminderEnabled: form.reminderEnabled,
  };
}

export interface HabitFormDialogProps {
  open: boolean;
  /** Habit to edit; null creates a new one. */
  habit: Habit | null;
  onClose: () => void;
  /** Called with the saved habit after a successful create/update. */
  onSaved: (habit: Habit, mode: 'create' | 'edit') => void | Promise<void>;
}

export function HabitFormDialog({ open, habit, onClose, onSaved }: HabitFormDialogProps) {
  const mode: 'create' | 'edit' = habit ? 'edit' : 'create';
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<FormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [liveMessage, setLiveMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const formId = 'habit-form';

  // Read per render so the picker follows the UI language (memoised per locale in shared/constants).
  const templates = habitTemplates(getCurrentLocale());

  // Reset the form every time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setForm(habit ? fromHabit(habit) : EMPTY);
    setErrors({});
    setServerError(null);
    setLiveMessage('');
    setBusy(false);
  }, [open, habit]);

  const templateOptions: SelectOption[] = [{ value: '', label: HABIT_FORM_TEXTS.noTemplate }, ...templates.map((t) => ({ value: t.name, label: t.name }))];

  const patch = (changes: Partial<FormState>) => setForm((prev) => ({ ...prev, ...changes }));
  const clearError = (key: FieldKey) => {
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const applyTemplate = (name: string) => {
    const template = templates.find((t) => t.name === name);
    if (!template) {
      patch({ template: name });
      return;
    }
    patch({
      template: name,
      name: template.name,
      description: template.description,
      target: template.target,
      unit: template.unit,
      frequency: template.frequency,
    });
    setErrors({});
  };

  const submit = async () => {
    if (busy) return;
    setServerError(null);
    setLiveMessage('');
    const next = validateHabitForm(form);
    setErrors(next);
    const invalid = FIELD_ORDER.filter((k) => next[k]);
    if (invalid.length > 0) {
      setLiveMessage(T.fixErrors(invalid.length));
      document.getElementById(FIELD_IDS[invalid[0]])?.focus();
      return;
    }
    setBusy(true);
    try {
      const input = toInput(form);
      const saved = habit ? await api.habits.update(habit.id, input) : await api.habits.create(input);
      await onSaved(saved, mode);
    } catch (e) {
      const field = errorField(e) as FieldKey | null;
      const message = errorMessage(e);
      if (field && FIELD_ORDER.includes(field)) {
        setErrors({ [field]: message });
        document.getElementById(FIELD_IDS[field])?.focus();
      } else {
        setServerError(message);
      }
      setLiveMessage(message);
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void submit();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={habit ? HABIT_FORM_TEXTS.editTitle(habit.name) : HABIT_FORM_TEXTS.newTitle}
      id="habit-form-dialog"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {T.cancel}
          </Button>
          <Button onClick={() => void submit()} loading={busy}>
            {T.save}
          </Button>
        </>
      }
    >
      {serverError && (
        <Alert kind="error" role="none" id="habit-form-server-error">
          {serverError}
        </Alert>
      )}
      <form id={formId} className="form" onSubmit={onSubmit} noValidate aria-describedby={serverError ? 'habit-form-server-error' : undefined}>
        {mode === 'create' && (
          <Select
            id="habit-form-template"
            label={HABIT_FORM_LABELS.template}
            hint={HABIT_FORM_LABELS.templateHint}
            options={templateOptions}
            value={form.template}
            onChange={applyTemplate}
          />
        )}
        <Field id={FIELD_IDS.name} label={HABIT_FORM_LABELS.name} error={errors.name} required>
          {(a11y) => (
            <TextInput
              {...a11y}
              value={form.name}
              maxLength={80}
              onChange={(e) => {
                patch({ name: e.currentTarget.value });
                clearError('name');
              }}
            />
          )}
        </Field>
        <Field id="habit-form-description" label={HABIT_FORM_LABELS.description}>
          {(a11y) => <TextArea {...a11y} value={form.description} minRows={2} maxLength={400} onChange={(e) => patch({ description: e.currentTarget.value })} />}
        </Field>
        <NumberInput
          id={FIELD_IDS.target}
          label={HABIT_FORM_LABELS.target}
          value={form.target}
          onChange={(v) => {
            patch({ target: v });
            clearError('target');
          }}
          min={0}
          unit={form.unit.trim() || undefined}
          error={errors.target}
          required
          inputMode="decimal"
        />
        <Field id={FIELD_IDS.unit} label={HABIT_FORM_LABELS.unit} hint={HABIT_FORM_LABELS.unitHint} error={errors.unit} required>
          {(a11y) => (
            <TextInput
              {...a11y}
              value={form.unit}
              maxLength={30}
              short
              onChange={(e) => {
                patch({ unit: e.currentTarget.value });
                clearError('unit');
              }}
            />
          )}
        </Field>
        <RadioGroup<HabitFrequency>
          legend={HABIT_FORM_LABELS.frequency}
          name="habit-form-frequency"
          options={frequencyOptions()}
          value={form.frequency}
          onChange={(v) => patch({ frequency: v })}
          inline
        />
        <Checkbox
          id="habit-form-reminder"
          label={HABIT_FORM_LABELS.reminder}
          hint={HABIT_FORM_LABELS.reminderHint}
          checked={form.reminderEnabled}
          onChange={(checked) => {
            patch({ reminderEnabled: checked });
            clearError('reminderTime');
          }}
        />
        {form.reminderEnabled && (
          <TimeInput
            id={FIELD_IDS.reminderTime}
            label={HABIT_FORM_LABELS.reminderTime}
            value={form.reminderTime}
            onChange={(v) => {
              patch({ reminderTime: v });
              clearError('reminderTime');
            }}
            error={errors.reminderTime}
            required
          />
        )}
        {/* Keeps Enter submitting the form from any field; the visible button lives in the footer. */}
        <button type="submit" className="visually-hidden" tabIndex={-1} aria-hidden="true">
          {T.save}
        </button>
      </form>
      <LiveRegion politeness="assertive" message={liveMessage} />
    </Dialog>
  );
}
