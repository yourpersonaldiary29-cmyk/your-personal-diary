/**
 * "Server" card of the Settings page (docs/android-tasks/SERVER-CARD.md, docs/HOSTED-PLAN.md 2.5 / 3.3):
 * the state of the hosted Your Personal Diary server and its encrypted server archive, for the server's
 * owner only.
 *
 * Who sees it - the same owner rule as the Mail card, on the hosted server only:
 *   - `ServerInfo.mode === 'hosted'` and `ServerSettings.isServerOwner === true` (the configured owner,
 *     `DIARY_OWNER_ID`). The flag is absent on local servers and on older hosted servers, so it is
 *     tested with `=== true`: everywhere else the card is not rendered and asks nothing.
 *   - The read behind the decision is the Mail card's (`useOwnerAccess('isMailOwner')`, shared while
 *     mounted - the Account card's ID row rides on it too): the Settings page still asks the server's
 *     info and settings once per owner card, as before this card existed.
 *   - The routes themselves answer 403 to everyone else; a 403 of `GET /api/server/status` hides the card.
 *
 * Status: version, uptime, accounts (with the ceiling), registrations in the last 24 hours, disk used /
 * free with a clear warning under 15 % free (`diskLow`), whether saving works (`storageOk`), the last
 * successful save, memory in use and the last archive, with a reminder when there is none or it is
 * older than 30 days (`archiveDue`). Read when the card opens and with "Refresh" - never polled.
 *
 * Archive: "Prepare server archive" opens a small form - the account password (checked by the server
 * under the same confirmation lockout as the Mail card) and a passphrase of at least 12 characters typed
 * twice; `POST /api/server/archive` writes the encrypted archive to the server's volume. The archive is
 * never downloadable through the API: the card lists the archives on the volume (at most 2) with the
 * exact `flyctl ssh sftp get` command for the owner's own PowerShell window and the `Get-FileHash` line
 * that checks the SHA-256, each with a Copy button, plus the steps and the one-line warning that the
 * passphrase is needed to restore and cannot be recovered. Passwords live in this component's state only
 * while the form is open; locking the app (Ctrl+L), Cancel, success or leaving the page forgets them.
 *
 * Deletion request by e-mail (DeletionRequest.tsx, docs/android-tasks/ADMIN-TOOL.md item 3): the last
 * part of the card builds the two commands of the operator tool (find, then delete --confirm) for the
 * owner's PowerShell from the address he types - no server call; nothing in the app lists or deletes
 * other accounts (that needs his Fly login, docs/HOSTED-RUNBOOK.he.md chapter 9).
 */
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import {
  SERVER_ARCHIVE_DUE_DAYS,
  SERVER_ARCHIVE_PASSPHRASE_MAX,
  SERVER_ARCHIVE_PASSPHRASE_MIN,
  type ServerArchiveInfo,
  type ServerArchiveResult,
} from '@shared/types';
import { server as serverApi, ApiClientError } from '@/api';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DefinitionList, type DefinitionItem } from '@/components/ui/DefinitionList';
import { Field } from '@/components/ui/Field';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { Spinner } from '@/components/ui/Spinner';
import { T } from '@/constants/texts';
import { useAnnouncer } from '@/context/AnnouncerContext';
import { useHostedServer } from '@/context/ConnectionContext';
import { useLock } from '@/context/LockContext';
import { useApi } from '@/hooks/useApi';
import { formatClock, formatTimestamp, nowHHMM } from '@/utils/dates';
import { errorCode, errorField, errorMessage } from '@/utils/errors';
import { formatNumber, formatPercent } from '@/utils/format';
import { CommandBlock } from './CommandBlock';
import { DeletionRequest } from './DeletionRequest';
import { SVT, formatServerBytes, formatUptime } from './serverTexts';
import { ST } from './texts';
import { useOwnerAccess } from './useOwnerCard';
import './server-card.css';

export const SERVER_PREPARE_BUTTON_ID = 'settings-server-prepare';
export const SERVER_PASSWORD_ID = 'settings-server-password';
export const SERVER_PASSPHRASE_ID = 'settings-server-passphrase';
export const SERVER_PASSPHRASE_REPEAT_ID = 'settings-server-passphrase-repeat';
export const SERVER_READY_ID = 'settings-server-ready';

/** The server lets one archive start per 10 minutes (the window after a successful archive). */
const ARCHIVE_WINDOW_SEC = 10 * 60;

/** Characters of a passphrase as the server counts them: code points after NFKC normalisation. */
export function passphraseLength(passphrase: string): number {
  return [...passphrase.normalize('NFKC')].length;
}

type FieldName = 'password' | 'passphrase' | 'repeat';
type FormErrors = Partial<Record<FieldName, string>>;
const FIELD_ORDER: FieldName[] = ['password', 'passphrase', 'repeat'];
const FIELD_IDS: Record<FieldName, string> = {
  password: SERVER_PASSWORD_ID,
  passphrase: SERVER_PASSPHRASE_ID,
  repeat: SERVER_PASSPHRASE_REPEAT_ID,
};

/** Checks the form as the server will; returns the errors to show (empty when fine). */
export function archiveFormErrors(password: string, passphrase: string, repeat: string): FormErrors {
  const found: FormErrors = {};
  if (!password) found.password = SVT.passwordMissing;
  const length = passphraseLength(passphrase);
  if (length < SERVER_ARCHIVE_PASSPHRASE_MIN) found.passphrase = SVT.passphraseShort(SERVER_ARCHIVE_PASSPHRASE_MIN);
  else if (length > SERVER_ARCHIVE_PASSPHRASE_MAX) found.passphrase = SVT.passphraseLong(SERVER_ARCHIVE_PASSPHRASE_MAX);
  else if (repeat !== passphrase) found.repeat = SVT.passphraseMismatch;
  return found;
}

/** The archive info of a POST answer (without the counts) - how it appears in the status list. */
function archiveInfoOf(result: ServerArchiveResult): ServerArchiveInfo {
  const { fileName, path, sizeBytes, sha256, createdAt, downloadCommand, hashCommand } = result;
  return { fileName, path, sizeBytes, sha256, createdAt, downloadCommand, hashCommand };
}

/** One archive on the volume: name, time, size, SHA-256 and the two commands. */
function ArchiveItem({ archive, first }: { archive: ServerArchiveInfo; first: boolean }) {
  const items: DefinitionItem[] = [
    { term: SVT.created, value: formatTimestamp(archive.createdAt) },
    { term: SVT.size, value: formatServerBytes(archive.sizeBytes) },
    {
      term: 'SHA-256',
      value: archive.sha256 ? (
        <span className="server-card__hash" dir="ltr" translate="no">
          {archive.sha256}
        </span>
      ) : null,
    },
  ];
  return (
    <li className="server-card__archive stack-sm">
      <p className="server-card__file" dir="ltr" translate="no">
        {archive.fileName}
      </p>
      <DefinitionList items={items} />
      <CommandBlock
        label={SVT.downloadCommand}
        command={archive.downloadCommand}
        copyLabel={SVT.copyDownload}
        buttonId={first ? 'settings-server-copy-download' : undefined}
      />
      {archive.hashCommand && <CommandBlock label={SVT.checkCommand} command={archive.hashCommand} copyLabel={SVT.copyCheck} />}
    </li>
  );
}

/** The card itself (rendered for the hosted server's owner only; see ServerSection). */
function ServerCard({ publicUrl }: { publicUrl?: string }) {
  const { announce } = useAnnouncer();
  const { locked: appLocked } = useLock();
  const [refused, setRefused] = useState(false);
  /** When the status on screen was read (Date.now), for the time the next archive is accepted. */
  const [readAt, setReadAt] = useState(() => Date.now());
  const announceRefresh = useRef(false);
  const load = useApi((signal) => serverApi.status(signal), [], {
    onSuccess: () => {
      setReadAt(Date.now());
      if (announceRefresh.current) announce(SVT.refreshed, 'polite');
      announceRefresh.current = false;
    },
    onError: (e) => {
      announceRefresh.current = false;
      // Not the owner (or no owner configured, or not HTTPS): the card goes away.
      if (e instanceof ApiClientError ? e.status === 403 : errorCode(e) === 'FORBIDDEN') setRefused(true);
    },
  });
  const status = load.data;

  const archiveId = useId();
  const listId = useId();
  const stepsId = useId();
  const formTitleId = useId();
  const formId = useId();

  const [formOpen, setFormOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [repeat, setRepeat] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const [opError, setOpError] = useState<string | null>(null);
  const [result, setResult] = useState<ServerArchiveResult | null>(null);
  /** Where focus goes after the next render (the element it was on may have disappeared). */
  const focusNext = useRef<string | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    const id = focusNext.current;
    if (!id) return;
    focusNext.current = null;
    document.getElementById(id)?.focus();
  });

  const clearSecrets = () => {
    setPassword('');
    setPassphrase('');
    setRepeat('');
  };

  // Locking the app (Ctrl+L) closes the form and forgets what was typed.
  useEffect(() => {
    if (!appLocked) return;
    setPassword('');
    setPassphrase('');
    setRepeat('');
    setErrors({});
    setFormOpen(false);
  }, [appLocked]);

  const onRefresh = () => {
    announceRefresh.current = true;
    void load.reload();
  };

  const openForm = () => {
    clearSecrets();
    setErrors({});
    setOpError(null);
    setFormOpen(true);
    focusNext.current = SERVER_PASSWORD_ID;
  };

  const closeForm = () => {
    if (pendingRef.current) return;
    clearSecrets();
    setErrors({});
    setFormOpen(false);
    focusNext.current = SERVER_PREPARE_BUTTON_ID;
    announce(ST.cancelled, 'polite');
  };

  /** Shows `found` at the fields, announces the count and focuses the first one; false when there is nothing. */
  const showErrors = (found: FormErrors): boolean => {
    setErrors(found);
    const invalid = FIELD_ORDER.filter((k) => found[k]);
    if (!invalid.length) return false;
    announce(T.fixErrors(invalid.length), 'assertive');
    document.getElementById(FIELD_IDS[invalid[0]])?.focus();
    return true;
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (pendingRef.current) return;
    if (showErrors(archiveFormErrors(password, passphrase, repeat))) return;
    pendingRef.current = true;
    setPending(true);
    setOpError(null);
    setResult(null);
    announce(SVT.preparing, 'polite');
    try {
      const made = await serverApi.archive({ password, passphrase });
      if (!alive.current) return;
      clearSecrets();
      setErrors({});
      setFormOpen(false);
      setResult(made);
      // The answer says everything the list needs: no second request (Refresh reads the rest).
      load.setData((prev) =>
        prev
          ? {
              ...prev,
              archives: [archiveInfoOf(made), ...prev.archives.filter((a) => a.fileName !== made.fileName && !made.removed.includes(a.fileName))].slice(0, 2),
              lastArchiveAt: made.createdAt,
              archiveDue: false,
              archiveBusy: false,
              archiveRetryAfterSec: ARCHIVE_WINDOW_SEC,
            }
          : prev,
      );
      setReadAt(Date.now());
      focusNext.current = SERVER_READY_ID;
      announce(SVT.ready(made.fileName, formatServerBytes(made.sizeBytes)), 'polite');
    } catch (e) {
      if (!alive.current) return;
      const message = errorMessage(e);
      const field = errorField(e);
      if (errorCode(e) === 'WRONG_PASSWORD' || field === 'password') {
        setPassword('');
        showErrors({ password: message });
      } else if (field === 'passphrase') {
        showErrors({ passphrase: message });
      } else {
        // Too soon (429 with Retry-After), no space (507), busy, lockout, failure: shown above the form.
        if (e instanceof ApiClientError && e.status === 429 && e.retryAfterSec !== undefined) {
          const wait = e.retryAfterSec;
          load.setData((prev) => (prev ? { ...prev, archiveRetryAfterSec: wait } : prev));
          setReadAt(Date.now());
        }
        setOpError(message);
        announce(message, 'assertive');
      }
    } finally {
      pendingRef.current = false;
      if (alive.current) setPending(false);
    }
  };

  if (refused) return null;

  const refreshButton = (
    <Button variant="secondary" loading={load.loading && !!status} onClick={onRefresh}>
      {SVT.refresh}
    </Button>
  );

  // The deletion helper needs nothing from the status: it is there while the status loads or failed to
  // load too, and keeps what was typed when the status arrives (same key in both renders).
  const deletionRequest = <DeletionRequest key="deletion-request" publicUrl={publicUrl} />;

  if (!status) {
    return (
      <Card title={SVT.title} className="server-card" actions={load.error ? refreshButton : undefined}>
        <div className="stack">
          <p>{SVT.intro}</p>
          {load.error ? <Alert kind="error">{load.error}</Alert> : <Spinner />}
          {deletionRequest}
        </div>
      </Card>
    );
  }

  const disk = status.disk;
  const freePercent = disk ? formatPercent(disk.freePct / 100) : '';
  const nextAt = status.archiveRetryAfterSec > 0 ? formatClock(nowHHMM(new Date(readAt + status.archiveRetryAfterSec * 1000))) : null;
  const items: DefinitionItem[] = [
    { term: SVT.version, value: <span className="ltr">{status.version}</span> },
    { term: SVT.uptime, value: formatUptime(status.uptimeSec) },
    { term: SVT.accounts, value: status.maxAccounts > 0 ? SVT.accountsValue(status.accounts, status.maxAccounts) : formatNumber(status.accounts) },
    { term: SVT.registrations, value: formatNumber(status.registrationsLast24h) },
    {
      term: SVT.disk,
      value: disk ? SVT.diskValue(formatServerBytes(Math.max(0, disk.totalBytes - disk.freeBytes)), formatServerBytes(disk.freeBytes), freePercent) : null,
    },
    {
      term: SVT.storage,
      value: status.storageOk ? (
        <span className="server-card__ok">
          <span aria-hidden="true">✓ </span>
          {SVT.storageOk}
        </span>
      ) : (
        <span className="server-card__bad">
          <span aria-hidden="true">✗ </span>
          {SVT.storageFailed}
        </span>
      ),
    },
    { term: SVT.lastSave, value: status.lastPersistAt ? formatTimestamp(status.lastPersistAt) : SVT.noSaveYet },
    { term: SVT.memory, value: formatServerBytes(status.rssBytes) },
    { term: SVT.lastArchive, value: status.lastArchiveAt ? formatTimestamp(status.lastArchiveAt) : SVT.noArchive },
  ];

  return (
    <Card title={SVT.title} className="server-card" actions={refreshButton}>
      <div className="stack">
        <p>{SVT.intro}</p>
        {load.error && <Alert kind="error">{load.error}</Alert>}
        {/* Standing facts of the status, not events: part of the card's text (role none), read in order. */}
        {!status.storageOk && (
          <Alert kind="error" role="none">
            {SVT.storageAlert}
          </Alert>
        )}
        {status.diskLow && disk && (
          <Alert kind="warning" role="none">
            {SVT.diskLow(freePercent)}
          </Alert>
        )}
        <DefinitionList aria-label={SVT.title} items={items} />
        {status.archiveDue && (
          <Alert kind="warning" role="none">
            {status.archives.length ? SVT.archiveDueOld(SERVER_ARCHIVE_DUE_DAYS) : SVT.archiveDueNone}
          </Alert>
        )}

        <section aria-labelledby={archiveId} className="stack-sm">
          <h3 id={archiveId}>{SVT.archiveTitle}</h3>
          <p>{SVT.archiveIntro}</p>
          <p className="server-card__warning">{SVT.passphraseWarning}</p>
          {result && (
            // Focused after success (announced through the live region; the box itself stays silent).
            <Alert kind="success" role="none" id={SERVER_READY_ID} tabIndex={-1}>
              {SVT.ready(result.fileName, formatServerBytes(result.sizeBytes))}
            </Alert>
          )}
          {opError && (
            <Alert kind="error" role="none">
              {opError}
            </Alert>
          )}
          {status.archiveBusy && <p>{SVT.busy}</p>}
          {nextAt && <p className="text-muted">{SVT.nextAt(nextAt)}</p>}

          {!formOpen && (
            <div>
              <Button id={SERVER_PREPARE_BUTTON_ID} onClick={openForm}>
                {SVT.prepare}
              </Button>
            </div>
          )}
          {formOpen && (
            <form id={formId} className="form stack-sm server-card__form" onSubmit={(e) => void onSubmit(e)} noValidate aria-labelledby={formTitleId}>
              <h4 id={formTitleId}>{SVT.formTitle}</h4>
              <Field id={SERVER_PASSWORD_ID} label={SVT.password} error={errors.password ?? null} required>
                {(a11y) => (
                  <PasswordInput
                    {...a11y}
                    value={password}
                    autoComplete="current-password"
                    onChange={(e) => {
                      setPassword(e.currentTarget.value);
                      if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
                    }}
                  />
                )}
              </Field>
              <Field
                id={SERVER_PASSPHRASE_ID}
                label={SVT.passphrase}
                hint={SVT.passphraseHint(SERVER_ARCHIVE_PASSPHRASE_MIN)}
                error={errors.passphrase ?? null}
                required
              >
                {(a11y) => (
                  <PasswordInput
                    {...a11y}
                    value={passphrase}
                    // Not this site's password: keep password managers from filling in or saving it.
                    autoComplete="off"
                    onChange={(e) => {
                      setPassphrase(e.currentTarget.value);
                      if (errors.passphrase) setErrors((prev) => ({ ...prev, passphrase: undefined }));
                    }}
                  />
                )}
              </Field>
              <Field id={SERVER_PASSPHRASE_REPEAT_ID} label={SVT.passphraseRepeat} error={errors.repeat ?? null} required>
                {(a11y) => (
                  <PasswordInput
                    {...a11y}
                    value={repeat}
                    autoComplete="off"
                    onChange={(e) => {
                      setRepeat(e.currentTarget.value);
                      if (errors.repeat) setErrors((prev) => ({ ...prev, repeat: undefined }));
                    }}
                  />
                )}
              </Field>
              {pending && <p className="text-muted">{SVT.preparing}</p>}
              <div className="cluster">
                <Button type="submit" loading={pending}>
                  {SVT.submit}
                </Button>
                <Button variant="secondary" onClick={closeForm} disabled={pending}>
                  {T.cancel}
                </Button>
              </div>
            </form>
          )}

          {status.archives.length > 0 && (
            <>
              <h4 id={listId}>{SVT.listTitle}</h4>
              <ul className="server-card__archives stack" aria-labelledby={listId}>
                {status.archives.map((archive, i) => (
                  <ArchiveItem key={archive.fileName} archive={archive} first={i === 0} />
                ))}
              </ul>
              <h4 id={stepsId}>{SVT.stepsTitle}</h4>
              <ol aria-labelledby={stepsId}>
                {SVT.steps().map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </>
          )}
        </section>

        {deletionRequest}
      </div>
    </Card>
  );
}

/**
 * The "Server" card, or nothing: rendered only when this UI talks to the hosted server and the server
 * says the signed-in account is its owner (`isServerOwner === true`; see the module comment).
 */
export function ServerSection() {
  const hosted = useHostedServer();
  const access = useOwnerAccess('isMailOwner', hosted);
  const allowed = hosted && access?.info?.mode === 'hosted' && access.settings?.isServerOwner === true;
  if (!allowed) return null;
  return <ServerCard publicUrl={access.info?.publicUrl} />;
}
