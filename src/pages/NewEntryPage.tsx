/**
 * New entry ("/new", honours ?date= and ?time=) and edit entry
 * ("/entry/:id/edit"). The form itself is <EntryForm>; this page loads the
 * entry in edit mode, fetches autocomplete suggestions, validates (client
 * rules mirror the server), maps server VALIDATION errors to their field,
 * guards unsaved changes and, after a save, announces "הרשומה נשמרה", shows a
 * toast and opens the saved entry. Edit mode also offers deletion.
 *
 * Automatic offline mode (docs/android-tasks/OFFLINE-DESIGN.md sections 4.3, 4.9): a save that stays on
 * this device says "Saved on this device..." instead and opens the entry under its local (negative) id;
 * editing such an entry works the same way. "Open and fix" of a rejected change opens the form with the
 * user's version (router state `prefill`): "/new" for a new entry, the entry's edit page for a rejected
 * edit (the server's version is the baseline, the user's version is on top, unsaved); its note goes once
 * the entry is saved.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { entries as entriesApi } from '@/api';
import type { EntryPrefillState } from '@/components/sync/PendingChangesDialog';
import { savedOnDevice, showSavedOnDevice } from '@/components/sync/syncGate';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { LinkButton } from '@/components/ui/LinkButton';
import { PageTitle } from '@/components/ui/PageTitle';
import { Spinner } from '@/components/ui/Spinner';
import { PATHS } from '@/constants/routes';
import { T } from '@/constants/texts';
import { useAnnouncer } from '@/context/AnnouncerContext';
import { useToast } from '@/context/ToastContext';
import { useApi } from '@/hooks/useApi';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import {
  countErrors,
  emptyEntryValues,
  EntryForm,
  ET,
  useEntryForm,
  valuesFromEntry,
  type EntryFieldName,
  type EntryFormValues,
  type EntrySuggestions,
} from '@/pages/entries';
import { offline } from '@/offline';
import { formatDateTime, isValidIsoDate, isValidTime } from '@/utils/dates';
import { errorCode, errorMessage } from '@/utils/errors';

/** Defaults for a new entry from the query string (?date=YYYY-MM-DD&time=HH:MM). */
export function defaultsFromQuery(params: URLSearchParams): Partial<EntryFormValues> {
  const out: Partial<EntryFormValues> = {};
  const date = params.get('date');
  const time = params.get('time');
  if (date && isValidIsoDate(date)) out.date = date;
  if (time && isValidTime(time)) out.time = time;
  return out;
}

/** The entry id of the route; negative ids are entries written on this device that are not uploaded yet. */
function parseEntryId(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n !== 0 ? n : null;
}

/** The router state of "Open and fix" (a note of the review), or null. */
function prefillOf(state: unknown): EntryPrefillState | null {
  const s = state as Partial<EntryPrefillState> | null;
  return s && typeof s === 'object' && s.prefill && typeof s.prefill === 'object' ? (s as EntryPrefillState) : null;
}

export default function NewEntryPage() {
  const { id } = useParams<{ id: string }>();
  const editMode = id !== undefined;
  const entryId = parseEntryId(id);
  const validId = entryId !== null;
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const { announce } = useAnnouncer();
  const [prefill] = useState(() => prefillOf(location.state));

  // Query defaults (or the version of a note) are read once: the form owns the values afterwards.
  const initial = useMemo(
    () =>
      prefill && !editMode
        ? valuesFromEntry({ ...prefill.prefill, id: 0, createdAt: '', updatedAt: '' })
        : emptyEntryValues(editMode ? {} : defaultsFromQuery(searchParams)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const form = useEntryForm(initial);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const entryLoad = useApi(() => entriesApi.get(entryId as number), [entryId], {
    enabled: editMode && validId,
    onError: (e) => {
      if (errorCode(e) === 'NOT_FOUND') setNotFound(true);
    },
  });

  // Once the entry arrives the form takes its values as the clean baseline.
  const { reset, setValue } = form;
  const prefillApplied = useRef(false);
  useEffect(() => {
    if (!entryLoad.data) return;
    reset(valuesFromEntry(entryLoad.data));
    // "Open and fix" of a rejected edit: the entry as it is on the server is the baseline, the user's
    // version goes on top of it, unsaved (once - a later reload must not bring it back).
    if (editMode && prefill && !prefillApplied.current) {
      prefillApplied.current = true;
      const mine = valuesFromEntry({ ...prefill.prefill, id: entryLoad.data.id, createdAt: entryLoad.data.createdAt, updatedAt: entryLoad.data.updatedAt });
      for (const name of Object.keys(mine) as EntryFieldName[]) setValue(name, mine[name]);
    }
  }, [entryLoad.data, reset, setValue, editMode, prefill]);

  // Autocomplete lists; a failure of any list must never block writing.
  const suggestionsLoad = useApi<EntrySuggestions>(async () => {
    const [tags, people, locations] = await Promise.all([
      entriesApi.tags().catch(() => []),
      entriesApi.people().catch(() => []),
      entriesApi.locations().catch(() => []),
    ]);
    return {
      tags: tags.map((t) => t.name),
      people: people.map((t) => t.name),
      locations: locations.map((t) => t.name),
    };
  }, []);

  const { confirmLeave, dialog } = useUnsavedChangesGuard(form.dirty && !busy && !deleting);

  const onSubmit = async () => {
    if (busy) return;
    setServerError(null);
    const errors = form.validate();
    const count = countErrors(errors);
    if (count > 0) {
      announce(T.fixErrors(count), 'assertive');
      form.focusFirstInvalid(errors);
      return;
    }
    setBusy(true);
    try {
      const input = form.toInput();
      const saved = editMode ? await entriesApi.update(entryId as number, input) : await entriesApi.create(input);
      form.markClean();
      if (prefill?.fromNote !== undefined) void offline.notes.dismiss(prefill.fromNote).catch(() => undefined);
      if (savedOnDevice(saved, { kind: 'entry', id: saved.id })) {
        // Kept on this device until the connection returns (one toast for one save).
        showSavedOnDevice((message) => toast.info(message));
      } else {
        announce(ET.saved, 'polite');
        toast.success(ET.saved, { announced: true });
      }
      navigate(PATHS.entry(saved.id));
    } catch (err) {
      const field = form.applyServerError(err);
      if (field) {
        announce(T.fixErrors(1), 'assertive');
      } else {
        const message = errorMessage(err);
        setServerError(message);
        announce(message, 'assertive');
      }
    } finally {
      setBusy(false);
    }
  };

  const onCancel = async () => {
    if (!(await confirmLeave())) return;
    navigate(editMode && validId ? PATHS.entry(entryId) : PATHS.diary);
  };

  const onDelete = async () => {
    if (!validId || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await entriesApi.remove(entryId);
      form.markClean();
      setDeleteOpen(false);
      if (savedOnDevice(undefined, { kind: 'entry', id: entryId })) {
        showSavedOnDevice((message) => toast.info(message));
      } else {
        announce(ET.deleted, 'polite');
        toast.success(ET.deleted, { announced: true });
      }
      navigate(PATHS.diary);
    } catch (e) {
      setDeleteError(errorMessage(e));
    } finally {
      setDeleting(false);
    }
  };

  const title = editMode ? ET.editEntryTitle : ET.newEntryTitle;

  if (editMode && (!validId || notFound)) {
    return (
      <>
        <PageTitle title={title} />
        <EmptyState
          title={ET.notFoundTitle}
          text={ET.notFoundText}
          action={<LinkButton to={PATHS.diary}>{ET.toDiary}</LinkButton>}
        />
      </>
    );
  }

  const entryReady = !editMode || entryLoad.data !== null;

  return (
    <>
      <PageTitle title={title} subtitle={entryLoad.data ? formatDateTime(entryLoad.data.date, entryLoad.data.time) : undefined} />
      {editMode && entryLoad.loading && !entryLoad.data && <Spinner block />}
      {editMode && entryLoad.error && (
        <Alert kind="error">
          <p>{entryLoad.error}</p>
          <Button variant="secondary" size="sm" onClick={() => void entryLoad.reload()}>
            {T.retry}
          </Button>
        </Alert>
      )}
      {entryReady && (
        <EntryForm
          id="entry-form"
          form={form}
          onSubmit={onSubmit}
          onCancel={() => void onCancel()}
          busy={busy}
          serverError={serverError}
          suggestions={suggestionsLoad.data ?? undefined}
          extraActions={
            editMode ? (
              <Button variant="danger" onClick={() => setDeleteOpen(true)}>
                {ET.delete}
              </Button>
            ) : undefined
          }
        />
      )}
      {editMode && (
        <ConfirmDialog
          open={deleteOpen}
          title={ET.deleteTitle}
          message={ET.deleteMessage}
          confirmLabel={ET.delete}
          danger
          loading={deleting}
          error={deleteError}
          onConfirm={() => void onDelete()}
          onCancel={() => setDeleteOpen(false)}
        />
      )}
      {dialog}
    </>
  );
}
