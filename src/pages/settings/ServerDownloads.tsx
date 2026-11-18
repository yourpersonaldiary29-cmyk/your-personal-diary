/**
 * "Files on the Downloads page" - the part of the owner's Server card (ServerSection.tsx) that manages
 * the installation files of the public site's Downloads page (docs/server-tasks/SERVER-CARD-V2.md A4;
 * the routes of Part A: GET /api/server/downloads, POST .../upload-intent, PUT .../upload/<token>,
 * POST .../remove).
 *
 * The list: for each system (Windows, Android, Mac) the files the page offers, the newest version
 * first - version, size, date and where the file came from (a server update, or uploaded here) - each
 * with Remove, which says in a dialog what removing does and asks for the account password.
 *
 * "Publish a new version": the system, the version (filled in with the version of this app), the file
 * (`<input type="file">` accepting the system's extension), "Remove the older versions of this system"
 * (ticked), the account password and Upload. The form is checked as the server checks it; then the
 * upload takes two requests. The intent carries the password and the file's size, so a file that is
 * too large or does not fit on the disk is refused before a byte is sent, and answers a one-time
 * token; the PUT sends the file as the raw body (XMLHttpRequest): a progress bar with the percentage,
 * announced in steps of 10 %, and "Cancel the upload" while it is sent, then "Checking the file..."
 * while the server checks it. The token is single-use, so after a refused, cut-off or cancelled upload
 * the password is needed again - the card says so.
 *
 * The e-mail: the card warns beforehand when no e-mail would be sent (sending e-mail not set up, no
 * address on the account), and after every action says what happened to it.
 *
 * Passwords live in this component's state only until the action ends; locking the app (Ctrl+L) or
 * leaving the page forgets them, and leaving the page stops a running upload. A server without these
 * routes (404: older than this part) shows nothing of it; one built without them (403
 * 'server.downloads.unavailable') shows the server's sentence.
 */
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { APP_VERSION } from '@shared/constants';
import {
  SERVER_DOWNLOAD_EXTENSIONS,
  SERVER_DOWNLOAD_PLATFORMS,
  type ServerDownloadPlatform,
  type ServerDownloadResult,
  type ServerDownloadRow,
  type ServerDownloads as DownloadsList,
  type ServerDownloadUploadTicket,
} from '@shared/types';
import { isApiClientError, server as serverApi } from '@/api';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Field } from '@/components/ui/Field';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Select } from '@/components/ui/Select';
import { Spinner } from '@/components/ui/Spinner';
import { TextInput } from '@/components/ui/TextInput';
import { T } from '@/constants/texts';
import { useAnnouncer } from '@/context/AnnouncerContext';
import { useLock } from '@/context/LockContext';
import { useApi } from '@/hooks/useApi';
import { formatLongDate, isValidIsoDate } from '@/utils/dates';
import { errorCode, errorField, errorMessage, isAbortError } from '@/utils/errors';
import { formatNumber, formatPercent, joinList } from '@/utils/format';
import { DLT, SVT, emailOutcome, formatServerBytes } from './serverTexts';
import { ST } from './texts';

export const DOWNLOADS_PLATFORM_ID = 'settings-server-downloads-platform';
export const DOWNLOADS_VERSION_ID = 'settings-server-downloads-version';
export const DOWNLOADS_FILE_ID = 'settings-server-downloads-file';
export const DOWNLOADS_REMOVE_OLDER_ID = 'settings-server-downloads-remove-older';
export const DOWNLOADS_PASSWORD_ID = 'settings-server-downloads-password';
export const DOWNLOADS_UPLOAD_ID = 'settings-server-downloads-upload';
export const DOWNLOADS_CANCEL_ID = 'settings-server-downloads-cancel';
export const DOWNLOADS_PROGRESS_ID = 'settings-server-downloads-progress';
export const DOWNLOADS_RESULT_ID = 'settings-server-downloads-result';

/** The progress is announced in steps of this many percent (the bar itself follows every byte). */
export const UPLOAD_ANNOUNCE_STEP = 10;

/** x.y.z, each part 0..9999 without a leading zero: the server's rule (UPLOAD_VERSION_RE), checked again there. */
export const VERSION_PATTERN = /^(?:0|[1-9]\d{0,3})\.(?:0|[1-9]\d{0,3})\.(?:0|[1-9]\d{0,3})$/;

const MIB = 1024 * 1024;
/** A byte limit in whole MB, as the server words its limits (300 MB, 1 MB). */
const megabytes = (bytes: number) => Math.round(bytes / MIB);

/** The extension of a file name in lower case ('.exe'); '' when it has none. */
export function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot).toLowerCase() : '';
}

type PublishField = 'platform' | 'version' | 'file' | 'password';
export type PublishErrors = Partial<Record<PublishField, string>>;
const FIELD_ORDER: PublishField[] = ['platform', 'version', 'file', 'password'];
const FIELD_IDS: Record<PublishField, string> = {
  platform: DOWNLOADS_PLATFORM_ID,
  version: DOWNLOADS_VERSION_ID,
  file: DOWNLOADS_FILE_ID,
  password: DOWNLOADS_PASSWORD_ID,
};

export interface PublishInput {
  platform: ServerDownloadPlatform;
  version: string;
  file: File | null;
  password: string;
  /** The list on screen: the versions already listed and the size limits. */
  list: DownloadsList | null;
}

/**
 * Checks the publish form as the server will (the server checks everything again): a version x.y.z
 * not yet listed for the system, a file of the system's kind within the size limits, the password. A
 * file name without an extension is left to the server, which checks the file's signature anyway (a
 * phone may hand one over without it).
 */
export function publishErrors({ platform, version, file, password, list }: PublishInput): PublishErrors {
  const found: PublishErrors = {};
  const name = DLT.platformName(platform);
  const wanted = version.trim();
  if (!VERSION_PATTERN.test(wanted)) found.version = DLT.versionInvalid;
  else if (list?.platforms[platform]?.some((row) => row.version === wanted)) found.version = DLT.exists(name, wanted);
  if (!file) {
    found.file = DLT.fileMissing;
  } else {
    const extension = SERVER_DOWNLOAD_EXTENSIONS[platform];
    const own = extensionOf(file.name);
    if (own && own !== extension) found.file = DLT.fileWrongType(extension, name);
    else if (list && file.size > list.limits.maxBytes) found.file = DLT.tooLarge(megabytes(list.limits.maxBytes));
    else if (list && file.size < list.limits.minBytes) found.file = DLT.tooSmall(megabytes(list.limits.minBytes));
  }
  if (!password) found.password = SVT.passwordMissing;
  return found;
}

/** The result of a publication as one text: the file, the older versions removed with it, the e-mail. */
export function publishedText(platform: ServerDownloadPlatform, result: ServerDownloadResult): string {
  const parts = [DLT.published(result.row.version, DLT.platformName(platform))];
  if (result.removedOlder.length) parts.push(DLT.removedOlder(joinList(result.removedOlder.map((row) => row.version))));
  parts.push(emailOutcome(result.email));
  return parts.join(' ');
}

/** `text(value)` with the value isolated for bidirectional text (a file name inside Hebrew or Arabic). */
function withIsolated(text: (value: string) => string, value: string): ReactNode {
  const mark = '\u0000';
  const [before, after = ''] = text(mark).split(mark);
  return (
    <>
      {before}
      <bdi dir="ltr">{value}</bdi>
      {after}
    </>
  );
}

/** The files of one system: a table, or the sentence that there is none yet. */
function PlatformFiles({
  platform,
  rows,
  onRemove,
}: {
  platform: ServerDownloadPlatform;
  rows: ServerDownloadRow[];
  onRemove: (platform: ServerDownloadPlatform, row: ServerDownloadRow) => void;
}) {
  const headingId = useId();
  const name = DLT.platformName(platform);
  return (
    <div className="server-card__platform stack-sm">
      <h4 id={headingId}>{name}</h4>
      {rows.length === 0 ? (
        <p className="text-muted">{DLT.empty}</p>
      ) : (
        // At phone width the table scrolls sideways inside its own box, never the page.
        <div className="scroll-x">
          <table className="server-card__table" aria-labelledby={headingId}>
            <thead>
              <tr>
                <th scope="col">{DLT.version}</th>
                <th scope="col">{DLT.size}</th>
                <th scope="col">{DLT.date}</th>
                <th scope="col">{DLT.source}</th>
                <th scope="col">
                  <span className="visually-hidden">{DLT.remove}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.version}-${row.source}`}>
                  <th scope="row">
                    <span className="ltr">{row.version}</span>
                  </th>
                  <td className="nowrap">{formatServerBytes(row.bytes)}</td>
                  <td className="nowrap">{isValidIsoDate(row.date) ? formatLongDate(row.date) : row.date}</td>
                  <td>{DLT.sourceName(row.source)}</td>
                  <td>
                    <Button variant="secondary" size="sm" aria-label={DLT.removeName(row.version, name)} aria-haspopup="dialog" onClick={() => onRemove(platform, row)}>
                      {DLT.remove}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Where an upload stands: the password check (intent), the file going out, the server checking it. */
type Phase = 'idle' | 'intent' | 'sending' | 'checking';

export interface ServerDownloadsProps {
  /** Bumped by the card's Refresh: the list is read again. */
  refresh?: number;
}

export function ServerDownloads({ refresh = 0 }: ServerDownloadsProps) {
  const { announce } = useAnnouncer();
  const { locked: appLocked } = useLock();
  const titleId = useId();
  const formTitleId = useId();

  /** 404: a server from before this part - nothing of it is shown. */
  const [absent, setAbsent] = useState(false);
  /** 403 (a server built without it): the server's sentence. */
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const load = useApi((signal) => serverApi.downloads.list(signal), [refresh], {
    onSuccess: () => setUnavailable(null),
    onError: (e) => {
      if (!isApiClientError(e)) return;
      if (e.status === 404) setAbsent(true);
      else if (e.status === 403) setUnavailable(e.message);
    },
  });
  const list = load.data;
  const { setData, reload } = load;

  const [platform, setPlatform] = useState<ServerDownloadPlatform>('windows');
  const [version, setVersion] = useState(APP_VERSION);
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [removeOlder, setRemoveOlder] = useState(true);
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<PublishErrors>({});
  const [phase, setPhase] = useState<Phase>('idle');
  const [percent, setPercent] = useState(0);
  /** A refusal or failure that belongs to no field, shown above the form. */
  const [opError, setOpError] = useState<string | null>(null);
  /** The result of the last publication or removal. */
  const [outcome, setOutcome] = useState<string | null>(null);
  const busyRef = useRef(false);
  const uploadRef = useRef<AbortController | null>(null);
  const announcedStep = useRef(0);

  const [target, setTarget] = useState<{ platform: ServerDownloadPlatform; row: ServerDownloadRow } | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const removingRef = useRef(false);

  /** Where focus goes after the next render (the element it was on may have disappeared). */
  const focusNext = useRef<string | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      // Leaving the page stops the upload (the server drops the part it received).
      uploadRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const id = focusNext.current;
    if (!id) return;
    focusNext.current = null;
    document.getElementById(id)?.focus();
  });

  // Locking the app (Ctrl+L) forgets the password and closes the removal dialog. A running upload goes on.
  useEffect(() => {
    if (!appLocked) return;
    setPassword('');
    if (!removingRef.current) {
      setTarget(null);
      setRemoveError(null);
    }
  }, [appLocked]);

  const running = phase === 'sending' || phase === 'checking';

  /** Shows `found` at the fields, announces the count and focuses the first one; false when there is nothing. */
  const showErrors = (found: PublishErrors): boolean => {
    setErrors(found);
    const invalid = FIELD_ORDER.filter((k) => found[k]);
    if (!invalid.length) return false;
    announce(T.fixErrors(invalid.length), 'assertive');
    document.getElementById(FIELD_IDS[invalid[0]])?.focus();
    return true;
  };

  const clearFile = () => {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const onPlatform = (next: ServerDownloadPlatform) => {
    setPlatform(next);
    // A file of another system's kind belongs to the old choice.
    const own = file ? extensionOf(file.name) : '';
    if (own && own !== SERVER_DOWNLOAD_EXTENSIONS[next]) clearFile();
    setErrors((prev) => ({ ...prev, platform: undefined, version: undefined, file: undefined }));
  };

  const onUpload = async (event: FormEvent) => {
    event.preventDefault();
    if (busyRef.current || !list) return;
    const wanted = version.trim();
    if (showErrors(publishErrors({ platform, version: wanted, file, password, list }))) return;
    const chosen = file as File;
    busyRef.current = true;
    setPhase('intent');
    setOpError(null);
    setOutcome(null);

    let ticket: ServerDownloadUploadTicket;
    try {
      ticket = await serverApi.downloads.intent({ platform, version: wanted, password, removeOlder, bytes: chosen.size });
    } catch (e) {
      busyRef.current = false;
      if (!alive.current) return;
      setPhase('idle');
      const message = errorMessage(e);
      const field = errorField(e);
      if (errorCode(e) === 'WRONG_PASSWORD' || field === 'password') {
        setPassword('');
        showErrors({ password: message });
      } else if (field === 'version' || field === 'platform' || field === 'file') {
        const found: PublishErrors = {};
        found[field] = message;
        showErrors(found);
      } else {
        // Busy, the daily limit, no space, the lockout, no connection: above the form, the form kept.
        setOpError(message);
        announce(message, 'assertive');
      }
      return;
    }
    if (!alive.current) {
      busyRef.current = false;
      return;
    }

    // The token is single-use: whatever happens to this upload, the next one needs the password again.
    setPassword('');
    setErrors({});
    const controller = new AbortController();
    uploadRef.current = controller;
    announcedStep.current = 0;
    setPercent(0);
    setPhase('sending');
    focusNext.current = DOWNLOADS_CANCEL_ID;
    announce(DLT.uploading(formatPercent(0)), 'polite');
    try {
      const result = await serverApi.downloads.upload(ticket.token, chosen, {
        signal: controller.signal,
        onProgress: (sent, total) => {
          if (!alive.current) return;
          const now = total > 0 ? Math.min(100, Math.floor((sent / total) * 100)) : 0;
          setPercent(now);
          const step = now - (now % UPLOAD_ANNOUNCE_STEP);
          if (step > announcedStep.current && step < 100) {
            announcedStep.current = step;
            announce(DLT.uploading(formatPercent(step / 100)), 'polite');
          }
        },
        onSent: () => {
          if (!alive.current) return;
          // Everything is sent: nothing is left to cancel while the server checks the file.
          if (document.activeElement?.id === DOWNLOADS_CANCEL_ID) focusNext.current = DOWNLOADS_PROGRESS_ID;
          setPercent(100);
          setPhase('checking');
          announce(DLT.checking, 'polite');
        },
      });
      if (!alive.current) return;
      setData(result.downloads);
      const text = publishedText(ticket.platform, result);
      setOutcome(text);
      clearFile();
      focusNext.current = DOWNLOADS_RESULT_ID;
      announce(text, 'polite');
    } catch (e) {
      if (!alive.current) return;
      const cancelled = isAbortError(e);
      const message = cancelled ? DLT.cancelled : isApiClientError(e) && e.status === 0 ? DLT.interrupted : errorMessage(e);
      const text = `${message} ${DLT.passwordAgain}`;
      setOpError(text);
      if (!cancelled && errorField(e) === 'file') {
        // Not the system's kind, too small, cut off: said at the file too.
        setErrors({ file: message });
        focusNext.current = DOWNLOADS_FILE_ID;
      } else {
        focusNext.current = DOWNLOADS_PASSWORD_ID;
      }
      announce(text, cancelled ? 'polite' : 'assertive');
      // The daily count and `busy` changed on the server: read the list again (the rows stay meanwhile).
      void reload();
    } finally {
      uploadRef.current = null;
      busyRef.current = false;
      if (alive.current) setPhase('idle');
    }
  };

  const onCancelUpload = () => {
    uploadRef.current?.abort();
  };

  const askRemove = (rowPlatform: ServerDownloadPlatform, row: ServerDownloadRow) => {
    setRemoveError(null);
    setTarget({ platform: rowPlatform, row });
  };

  const closeRemove = () => {
    if (removingRef.current) return;
    setTarget(null);
    setRemoveError(null);
    announce(ST.cancelled, 'polite');
  };

  const onRemove = async (removePassword = '') => {
    if (!target || removingRef.current) return;
    if (!removePassword) {
      setRemoveError(SVT.passwordMissing);
      return;
    }
    const { platform: rowPlatform, row } = target;
    removingRef.current = true;
    setRemoving(true);
    setRemoveError(null);
    try {
      const result = await serverApi.downloads.remove({ platform: rowPlatform, version: row.version, password: removePassword });
      if (!alive.current) return;
      setData(result.downloads);
      const text = `${DLT.removed(row.version, DLT.platformName(rowPlatform))} ${emailOutcome(result.email)}`;
      setOutcome(text);
      setOpError(null);
      setTarget(null);
      // The row and its button are gone: the result takes the focus.
      focusNext.current = DOWNLOADS_RESULT_ID;
      announce(text, 'polite');
    } catch (e) {
      if (!alive.current) return;
      // A wrong password, the lockout, a failure: said in the dialog, at the password field.
      setRemoveError(errorMessage(e));
      // Already gone (removed from another device): the list behind the dialog is read again.
      if (isApiClientError(e) && e.status === 404) void reload();
    } finally {
      removingRef.current = false;
      if (alive.current) setRemoving(false);
    }
  };

  if (absent) return null;

  const extension = SERVER_DOWNLOAD_EXTENSIONS[platform];
  const limits = list?.limits;

  return (
    <section aria-labelledby={titleId} className="stack-sm server-card__part">
      <h3 id={titleId}>{DLT.title}</h3>
      <p>{DLT.intro}</p>
      {!list &&
        (unavailable ? (
          <p className="text-muted">{unavailable}</p>
        ) : load.error ? (
          <Alert kind="error">{load.error}</Alert>
        ) : (
          <Spinner />
        ))}
      {list && limits && (
        <>
          {/* A failed second read keeps the list on screen. */}
          {load.error && <Alert kind="error">{load.error}</Alert>}
          {list.email !== 'ready' && (
            <Alert kind="info" role="none">
              {DLT.emailWarning(list.email)}
            </Alert>
          )}
          {outcome && (
            // Focused after the action (announced through the live region; the box itself stays silent).
            <Alert kind="success" role="none" id={DOWNLOADS_RESULT_ID} tabIndex={-1}>
              {outcome}
            </Alert>
          )}
          {SERVER_DOWNLOAD_PLATFORMS.map((p) => (
            <PlatformFiles key={p} platform={p} rows={list.platforms[p] ?? []} onRemove={askRemove} />
          ))}

          <form className="form stack-sm server-card__form" onSubmit={(e) => void onUpload(e)} noValidate aria-labelledby={formTitleId}>
            <h4 id={formTitleId}>{DLT.publishTitle}</h4>
            <p>{DLT.publishIntro}</p>
            <p className="text-muted">
              {DLT.limits(
                formatNumber(megabytes(limits.minBytes)),
                formatNumber(megabytes(limits.maxBytes)),
                formatNumber(limits.usedToday),
                formatNumber(limits.perDay),
              )}
            </p>
            {list.busy && phase === 'idle' && <p>{DLT.busy}</p>}
            {opError && (
              <Alert kind="error" role="none">
                {opError}
              </Alert>
            )}
            <Select
              id={DOWNLOADS_PLATFORM_ID}
              label={DLT.platform}
              value={platform}
              onChange={onPlatform}
              options={SERVER_DOWNLOAD_PLATFORMS.map((p) => ({ value: p, label: DLT.platformName(p) }))}
              error={errors.platform ?? null}
              disabled={running}
              required
            />
            <Field id={DOWNLOADS_VERSION_ID} label={DLT.version} hint={DLT.versionHint(APP_VERSION)} error={errors.version ?? null} required>
              {(a11y) => (
                <TextInput
                  {...a11y}
                  dir="ltr"
                  value={version}
                  disabled={running}
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  onChange={(e) => {
                    setVersion(e.currentTarget.value);
                    if (errors.version) setErrors((prev) => ({ ...prev, version: undefined }));
                  }}
                />
              )}
            </Field>
            <Field id={DOWNLOADS_FILE_ID} label={DLT.file} hint={DLT.fileHint(extension)} error={errors.file ?? null} required>
              {(a11y) => (
                <input
                  {...a11y}
                  ref={fileInputRef}
                  type="file"
                  accept={extension}
                  className="input"
                  disabled={running}
                  onChange={(e) => {
                    setFile(e.currentTarget.files?.[0] ?? null);
                    if (errors.file) setErrors((prev) => ({ ...prev, file: undefined }));
                  }}
                />
              )}
            </Field>
            <Checkbox
              id={DOWNLOADS_REMOVE_OLDER_ID}
              label={DLT.removeOlder}
              hint={DLT.removeOlderHint}
              checked={removeOlder}
              onChange={setRemoveOlder}
              disabled={running}
            />
            <Field id={DOWNLOADS_PASSWORD_ID} label={SVT.password} error={errors.password ?? null} required>
              {(a11y) => (
                <PasswordInput
                  {...a11y}
                  value={password}
                  autoComplete="current-password"
                  disabled={running}
                  onChange={(e) => {
                    setPassword(e.currentTarget.value);
                    if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
                  }}
                />
              )}
            </Field>
            {running && (
              // Focused when the file is sent while focus was on Cancel (which then goes away).
              <div id={DOWNLOADS_PROGRESS_ID} tabIndex={-1} className="server-card__progress">
                <ProgressBar
                  value={percent}
                  max={100}
                  label={DLT.progress}
                  valueText={phase === 'checking' ? DLT.checking : DLT.uploading(formatPercent(percent / 100))}
                />
              </div>
            )}
            <div className="cluster">
              <Button type="submit" id={DOWNLOADS_UPLOAD_ID} loading={phase !== 'idle'}>
                {DLT.upload}
              </Button>
              {phase === 'sending' && (
                <Button variant="secondary" id={DOWNLOADS_CANCEL_ID} onClick={onCancelUpload}>
                  {DLT.cancel}
                </Button>
              )}
            </div>
          </form>
        </>
      )}
      <ConfirmDialog
        open={target !== null}
        title={target ? DLT.removeTitle(target.row.version, DLT.platformName(target.platform)) : ''}
        message={
          target ? (
            <>
              <p>{withIsolated(target.row.source === 'uploaded' ? DLT.removeUploaded : DLT.removeImage, target.row.file)}</p>
              <p>{DLT.removeAgain}</p>
              {list && list.email !== 'ready' && <p>{DLT.emailWarning(list.email)}</p>}
            </>
          ) : null
        }
        confirmLabel={DLT.remove}
        danger
        requirePassword
        loading={removing}
        error={removeError}
        onConfirm={(removePassword) => void onRemove(removePassword)}
        onCancel={closeRemove}
      />
    </section>
  );
}
