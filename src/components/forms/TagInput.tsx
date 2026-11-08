/**
 * Free-text list input (tags, people, events): the current values are chips
 * with a remove button named "Remove {value}"; a new value is added with
 * Enter, comma, the "Add" button or when the box loses focus. Values are
 * trimmed and de-duplicated. Suggestions are offered through a <datalist>.
 * Additions and removals are announced to screen readers.
 */
import { useState, type KeyboardEvent } from 'react';
import { useAnnouncer } from '@/context/AnnouncerContext';
import { subscribe, tr } from '@/i18n/runtime';
import { cx } from '@/components/ui/cx';
import { fieldIds } from '@/components/ui/Field';

export interface TagInputProps {
  /** Id of the text box. */
  id: string;
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
  /** Known values offered as autocomplete suggestions. */
  suggestions?: string[];
  hint?: string;
  error?: string | null;
  placeholder?: string;
  /** Label of the add button, default "Add". */
  addLabel?: string;
  /** Maximum number of values (extra additions are ignored). */
  maxItems?: number;
  disabled?: boolean;
  className?: string;
}

/** "Add" in the current language (live ES-module binding). */
export let ADD_LABEL = tr('shell.tagInput.add');
subscribe(() => {
  ADD_LABEL = tr('shell.tagInput.add');
});
/** Accessible name of a chip's remove button: "Remove {tag}". */
export const REMOVE_LABEL = (tag: string) => tr('shell.tagInput.remove', { tag });
const ADDED = (tag: string) => tr('shell.tagInput.added', { tag });
const REMOVED = (tag: string) => tr('shell.tagInput.removed', { tag });

/** Splits pasted text such as "work, friends" into separate values. */
function splitValues(raw: string): string[] {
  return raw
    .split(/[,;\n،]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function TagInput({
  id,
  label,
  value,
  onChange,
  suggestions = [],
  hint,
  error,
  placeholder,
  addLabel = ADD_LABEL,
  maxItems,
  disabled = false,
  className,
}: TagInputProps) {
  const { hintId, errorId } = fieldIds(id);
  const listId = `${id}-suggestions`;
  const chipsId = `${id}-chips`;
  const [text, setText] = useState('');
  const { announce } = useAnnouncer();
  const describedBy = [hint ? hintId : null, error ? errorId : null, chipsId].filter(Boolean).join(' ') || undefined;

  const addFromText = (raw: string = text) => {
    const parts = splitValues(raw);
    if (parts.length === 0) {
      setText('');
      return;
    }
    const next = [...value];
    const added: string[] = [];
    for (const part of parts) {
      if (maxItems !== undefined && next.length >= maxItems) break;
      if (next.includes(part)) continue;
      next.push(part);
      added.push(part);
    }
    setText('');
    if (added.length > 0) {
      onChange(next);
      announce(added.map(ADDED).join('. '));
    }
  };

  const remove = (tag: string) => {
    onChange(value.filter((t) => t !== tag));
    announce(REMOVED(tag));
    // The removed chip's button disappears - keep focus in the component.
    document.getElementById(id)?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addFromText();
    } else if (e.key === 'Backspace' && text === '' && value.length > 0) {
      // Backspace in an empty box removes the last chip (common chips convention).
      e.preventDefault();
      remove(value[value.length - 1]);
    }
  };

  const unusedSuggestions = suggestions.filter((s) => !value.includes(s));

  return (
    <div className={cx('field', 'tag-input', className)}>
      <label htmlFor={id} className="field__label">
        {label}
      </label>
      {hint && (
        <p id={hintId} className="field__hint">
          {hint}
        </p>
      )}
      {value.length > 0 ? (
        <ul className="chips" id={chipsId} aria-label={tr('shell.tagInput.selected', { label })}>
          {value.map((tag) => (
            <li className="chip" key={tag}>
              <bdi>{tag}</bdi>
              {!disabled && (
                <button type="button" className="chip__remove" onClick={() => remove(tag)} aria-label={REMOVE_LABEL(tag)}>
                  <span aria-hidden="true">✕</span>
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <span id={chipsId} className="visually-hidden">
          {tr('shell.tagInput.empty')}
        </span>
      )}
      <div className="tag-input__row">
        <input
          type="text"
          id={id}
          className="input"
          value={text}
          list={unusedSuggestions.length > 0 ? listId : undefined}
          placeholder={placeholder}
          autoComplete="off"
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          disabled={disabled}
          onChange={(e) => setText(e.currentTarget.value)}
          onKeyDown={onKeyDown}
          onBlur={() => addFromText()}
        />
        <button
          type="button"
          className="btn btn--secondary"
          onClick={() => addFromText()}
          disabled={disabled}
          aria-label={tr('shell.tagInput.addTo', { action: addLabel, label })}
        >
          {addLabel}
        </button>
      </div>
      {unusedSuggestions.length > 0 && (
        <datalist id={listId}>
          {unusedSuggestions.map((s) => (
            <option value={s} key={s} />
          ))}
        </datalist>
      )}
      {error && (
        <p id={errorId} className="field__error">
          {error}
        </p>
      )}
    </div>
  );
}
