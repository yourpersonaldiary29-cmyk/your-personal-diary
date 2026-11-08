/**
 * Read view of one entry ("/entry/:id"): title + date/time, the shared
 * <EntryDetails>, creation/update times and the actions "edit", "delete" (with
 * a confirmation dialog) and a link to the day summary. Unknown ids show an
 * empty state instead of an error.
 *
 * Automatic offline mode (docs/android-tasks/OFFLINE-DESIGN.md sections 4.3, 4.6, 4.9): an entry written
 * without a connection has a negative id ("/entry/-1") until it is uploaded; the page then replaces its
 * address with the server's id. A change still on this device shows "Not uploaded yet", one with a note
 * "Needs attention"; a delete without a connection says "Saved on this device".
 */
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { entries as entriesApi } from '@/api';
import { PendingBadge } from '@/components/sync/PendingBadge';
import { useSyncStatus } from '@/components/sync/hooks';
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
import { useLocale } from '@/context/LanguageContext';
import { useToast } from '@/context/ToastContext';
import { useApi } from '@/hooks/useApi';
import { offline } from '@/offline';
import { EntryDetails, entryTitle, ET } from '@/pages/entries';
import { systemDateText, useCalendarSystem } from '@/utils/calendar-extras';
import { formatDateTime, formatTimestamp } from '@/utils/dates';
import { errorCode, errorMessage } from '@/utils/errors';

export default function EntryPage() {
  const { id } = useParams<{ id: string }>();
  const entryId = Number(id);
  // Negative ids are entries written on this device that are not uploaded yet (section 4.3 (c)).
  const validId = Number.isInteger(entryId) && entryId !== 0;
  const navigate = useNavigate();
  const toast = useToast();
  const { announce } = useAnnouncer();
  const [notFound, setNotFound] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const locale = useLocale();
  const system = useCalendarSystem();

  const { data: entry, loading, error, reload } = useApi(() => entriesApi.get(entryId), [entryId], {
    enabled: validId,
    offline: true,
    onError: (e) => {
      if (errorCode(e) === 'NOT_FOUND') setNotFound(true);
    },
  });

  // Once an entry written on this device is uploaded, its address becomes the server's id.
  const { dataVersion } = useSyncStatus();
  useEffect(() => {
    if (entryId >= 0) return;
    const serverId = offline.serverIdOf(entryId);
    if (serverId !== null && serverId > 0) navigate(PATHS.entry(serverId), { replace: true });
  }, [entryId, dataVersion, navigate]);

  const onDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await entriesApi.remove(entryId);
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

  if (!validId || notFound) {
    return (
      <>
        <PageTitle title={ET.notFoundTitle} />
        <EmptyState title={ET.notFoundTitle} text={ET.notFoundText} action={<LinkButton to={PATHS.diary}>{ET.toDiary}</LinkButton>} />
      </>
    );
  }

  const heading = entry ? entryTitle(entry.title) : ET.loadingTitle;
  // The entry's date in the calendar system selected on the calendar page (Hebrew / Hijri), appended to the date/time subtitle.
  const systemDate = entry && system !== 'gregorian' ? systemDateText(system, entry.date, locale) : null;

  return (
    <>
      <PageTitle
        // The entry title is the user's own text: isolated, so its punctuation stays where it belongs
        // in a Hebrew / Arabic page (an English title keeps its full stop at its end).
        title={entry ? <bdi>{heading}</bdi> : heading}
        documentTitle={heading}
        subtitle={
          entry ? (
            <>
              {formatDateTime(entry.date, entry.time)}
              {systemDate && <span className="entry-alt-date">{` · ${systemDate}`}</span>}
              <PendingBadge kind="entry" id={entry.id} record={entry} />
            </>
          ) : undefined
        }
        actions={
          entry ? (
            <>
              <LinkButton to={PATHS.editEntry(entry.id)} variant="secondary">
                {ET.edit}
              </LinkButton>
              <Button variant="danger" onClick={() => setDeleteOpen(true)}>
                {ET.delete}
              </Button>
              <LinkButton to={PATHS.day(entry.date)} variant="ghost">
                {ET.toDay}
              </LinkButton>
            </>
          ) : undefined
        }
      />
      {loading && !entry && <Spinner block />}
      {error && (
        <Alert kind="error">
          <p>{error}</p>
          <Button variant="secondary" size="sm" onClick={() => void reload()}>
            {T.retry}
          </Button>
        </Alert>
      )}
      {entry && (
        <div className="stack">
          <EntryDetails entry={entry} headingLevel="h2" />
          <p className="entry-meta">
            {ET.createdAt(formatTimestamp(entry.createdAt))}
            {entry.updatedAt !== entry.createdAt && ` · ${ET.updatedAt(formatTimestamp(entry.updatedAt))}`}
          </p>
        </div>
      )}
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
    </>
  );
}
