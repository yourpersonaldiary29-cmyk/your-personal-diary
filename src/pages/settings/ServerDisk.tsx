/**
 * "Disk size" - the part of the owner's Server card (ServerSection.tsx) that enlarges the server's
 * disk (docs/server-tasks/SERVER-CARD-V2.md B3; the routes of Part B: GET /api/server/disk,
 * POST /api/server/disk/extend, POST /api/server/disk/restart).
 *
 * Set up (`available`): the size now, how much of it is used, its monthly cost and the changes left
 * today; "New size (GB)" - whole numbers from the size now + 1 to the maximum - with the monthly cost
 * of the typed size (`pricePerGbMonth`, 0.15 US dollars per GB) as it is typed, the sentence that the
 * disk can only grow, the account password and Enlarge. The change then runs on the server, and the
 * card reads its state every DISK_POLL_MS while it is open: the backup copy (snapshot), enlarging,
 * the server using the new size - done, or failed with the server's reason (`errorKey`) - and what
 * happened to the e-mail (the server sends it after it published the end, so the card reads on, at
 * most DISK_EMAIL_POLLS times, until it knows). When the server can use the new size only after a restart (`needs-restart`),
 * "Restart the server now" asks for the password (and says why an earlier restart did not do it);
 * while the server restarts the card keeps asking through the failed requests until it answers again.
 * Every change of state is announced.
 *
 * Not set up: the reason in the server's words and - when the key is missing, not valid or refused -
 * the one PowerShell line that sets the button up (scripts/hosted/set-disk-key.ps1) with a Copy
 * button. Not on Fly.io: the reason only. The last changes (at most 10) are listed at the end.
 *
 * Passwords live in this component's state only until the action ends; locking the app (Ctrl+L) or
 * leaving the page forgets them. A server without these routes (404: older than this part) shows
 * nothing of it; one built without them (403 'server.disk.unavailable') shows the server's sentence.
 */
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import {
  SERVER_DISK_HISTORY_KEEP,
  type ServerDiskChange,
  type ServerDiskInfo,
  type ServerDiskReason,
  type ServerDiskState,
} from '@shared/types';
import { isApiClientError, server as serverApi } from '@/api';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { DefinitionList, type DefinitionItem } from '@/components/ui/DefinitionList';
import { Field } from '@/components/ui/Field';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { Spinner } from '@/components/ui/Spinner';
import { T } from '@/constants/texts';
import { useAnnouncer } from '@/context/AnnouncerContext';
import { useLock } from '@/context/LockContext';
import { useApi } from '@/hooks/useApi';
import { formatTimestamp } from '@/utils/dates';
import { errorCode, errorField, errorMessage } from '@/utils/errors';
import { formatNumber, formatPercent } from '@/utils/format';
import { CommandBlock } from './CommandBlock';
import { DKT, SVT, emailOutcome, formatServerBytes, formatUsd, type DiskStep, type DiskStepState } from './serverTexts';

export const DISK_SIZE_ID = 'settings-server-disk-size';
export const DISK_PASSWORD_ID = 'settings-server-disk-password';
export const DISK_ENLARGE_ID = 'settings-server-disk-enlarge';
export const DISK_JOB_ID = 'settings-server-disk-job';
export const DISK_RESTART_PASSWORD_ID = 'settings-server-disk-restart-password';
export const DISK_RESTART_ID = 'settings-server-disk-restart';
export const DISK_COPY_SETUP_ID = 'settings-server-disk-copy-setup';

/** How often the state is read while a change is open (the server suggests every 2 to 3 seconds). */
export const DISK_POLL_MS = 2500;
/**
 * A change the card watched has ended (done or failed) while the e-mail about it is still being sent
 * (`email` null): the state is read on, at most this many more times, until the e-mail line can be shown.
 */
export const DISK_EMAIL_POLLS = 24;

/** Open: still running, or waiting for the owner's restart - every state but done and failed. */
export function isOpenDiskState(state: ServerDiskState): boolean {
  return state !== 'done' && state !== 'failed';
}

/** The reasons the set-up line helps with: the key is missing, not valid, or refused by Fly.io. */
const SETUP_REASONS: ReadonlySet<ServerDiskReason> = new Set<ServerDiskReason>(['no-token', 'bad-token', 'unauthorized']);

const STEPS: readonly DiskStep[] = ['snapshot', 'extend', 'use'];
const STEP_MARKS: Record<DiskStepState, string> = { done: '✓', current: '→', pending: '○', restart: '↻' };

/** Where each of the three steps stands in `state`; null for a failed change (its reason says it all). */
export function stepsOf(state: ServerDiskState): DiskStepState[] | null {
  switch (state) {
    case 'snapshot':
      return ['current', 'pending', 'pending'];
    case 'extending':
      return ['done', 'current', 'pending'];
    case 'waiting':
    case 'restarting':
      return ['done', 'done', 'current'];
    case 'needs-restart':
      return ['done', 'done', 'restart'];
    case 'done':
      return ['done', 'done', 'done'];
    default:
      return null;
  }
}

/** A whole number of GB as typed into "New size (GB)", or null. */
export function parseSizeGb(text: string): number | null {
  const trimmed = text.trim();
  return /^\d{1,6}$/.test(trimmed) ? Number(trimmed) : null;
}

/** "New size (GB)": a whole number larger than the size now and at most the maximum; the error, or null. */
export function newSizeError(text: string, sizeGb: number, maxGb: number): string | null {
  const size = parseSizeGb(text);
  return size === null || size <= sizeGb || size > maxGb ? DKT.newSizeInvalid(formatNumber(sizeGb + 1), formatNumber(maxGb)) : null;
}

/** Everything the card says about a change, as one text for the live region. */
export function changeAnnouncement(change: ServerDiskChange): string {
  const parts = [DKT.state(change.state, formatNumber(change.fromGb), formatNumber(change.toGb))];
  if (change.errorKey && (change.state === 'failed' || change.state === 'needs-restart')) parts.push(DKT.errorText(change.errorKey));
  if (change.email) parts.push(emailOutcome(change.email));
  return parts.join(' ');
}

/** The info after the server answered `change`: the job of this process, first in the history. */
function withChange(info: ServerDiskInfo, change: ServerDiskChange, started: boolean): ServerDiskInfo {
  return {
    ...info,
    job: change,
    history: [change, ...info.history.filter((c) => c.id !== change.id)].slice(0, SERVER_DISK_HISTORY_KEEP),
    changesLeftToday: started ? Math.max(0, info.changesLeftToday - 1) : info.changesLeftToday,
  };
}

type DiskField = 'size' | 'password' | 'restartPassword';
type DiskErrors = Partial<Record<DiskField, string>>;
const FIELD_ORDER: DiskField[] = ['size', 'password', 'restartPassword'];
const FIELD_IDS: Record<DiskField, string> = { size: DISK_SIZE_ID, password: DISK_PASSWORD_ID, restartPassword: DISK_RESTART_PASSWORD_ID };

export interface ServerDiskProps {
  /** Bumped by the card's Refresh: the state is read again. */
  refresh?: number;
}

export function ServerDisk({ refresh = 0 }: ServerDiskProps) {
  const { announce } = useAnnouncer();
  const { locked: appLocked } = useLock();
  const titleId = useId();
  const formTitleId = useId();
  const jobTitleId = useId();
  const historyId = useId();
  const costId = useId();
  const onlyGrowId = useId();
  const restartHintId = useId();

  /** 404: a server from before this part - nothing of it is shown. */
  const [absent, setAbsent] = useState(false);
  /** 403 (a server built without it): the server's sentence. */
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const load = useApi((signal) => serverApi.disk.get(signal), [refresh], {
    onSuccess: () => setUnavailable(null),
    onError: (e) => {
      if (!isApiClientError(e)) return;
      if (e.status === 404) setAbsent(true);
      else if (e.status === 403) setUnavailable(e.message);
    },
  });
  const info = load.data;
  const { setData, reload } = load;
  const job = info?.job ?? null;
  const open = job !== null && isOpenDiskState(job.state);

  const [sizeText, setSizeText] = useState('');
  const [password, setPassword] = useState('');
  const [restartPassword, setRestartPassword] = useState('');
  const [errors, setErrors] = useState<DiskErrors>({});
  const [pending, setPending] = useState<'extend' | 'restart' | null>(null);
  const pendingRef = useRef(false);
  /** Refusals that belong to no field: of Enlarge, and of the restart. */
  const [extendError, setExtendError] = useState<string | null>(null);
  const [restartError, setRestartError] = useState<string | null>(null);
  const [pollTick, setPollTick] = useState(0);
  /** The last read while a change is open failed (a restart, a lost connection): the card says it keeps asking. */
  const [notAnswering, setNotAnswering] = useState(false);
  /** The change and state last seen (`id:state`): a new one is announced. */
  const seen = useRef<string | null>(null);
  /** The same with the e-mail outcome (`id:state:email`): an outcome that arrives after its state is announced too. */
  const seenEmail = useRef<string | null>(null);
  /** The change the card saw open: once it has ended, the card also waits for the outcome of its e-mail. */
  const [watched, setWatched] = useState<string | null>(null);
  /** The reads made since that change ended (at most DISK_EMAIL_POLLS). */
  const [emailPolls, setEmailPolls] = useState(0);
  if (job && open && watched !== job.id) setWatched(job.id);
  /** Bumped by every answer of Enlarge and of the restart: a read that was asked before is out of date. */
  const actions = useRef(0);
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

  // Locking the app (Ctrl+L) forgets the passwords.
  useEffect(() => {
    if (!appLocked) return;
    setPassword('');
    setRestartPassword('');
  }, [appLocked]);

  // The server publishes done / failed first and sends the e-mail about it afterwards.
  const awaitingEmail = job !== null && !open && job.email === null && watched === job.id && emailPolls < DISK_EMAIL_POLLS;

  // While a change is open the state is read again and again - through failed requests too: during a
  // restart the server is away for a moment, and the change goes on on the server meanwhile.
  useEffect(() => {
    if ((!open && !awaitingEmail) || absent || unavailable !== null) return;
    const timer = window.setTimeout(() => {
      const asked = actions.current;
      if (!open) setEmailPolls((n) => n + 1);
      serverApi.disk.get().then(
        (next) => {
          // An answer asked before Enlarge or the restart answered would bring the old state back.
          if (!alive.current || asked !== actions.current) return;
          setNotAnswering(false);
          setData(next);
        },
        (e) => {
          if (!alive.current || asked !== actions.current) return;
          if (isApiClientError(e) && e.status === 404) setAbsent(true);
          else if (isApiClientError(e) && e.status === 403) setUnavailable(e.message);
          else if (!(isApiClientError(e) && e.status === 401)) {
            // 401: the session is gone (the app shows the sign-in); anything else: ask again.
            setNotAnswering(true);
            setPollTick((t) => t + 1);
          }
        },
      );
    }, DISK_POLL_MS);
    return () => window.clearTimeout(timer);
  }, [info, pollTick, open, awaitingEmail, absent, unavailable, setData]);

  // Announce every new state of a change (not the one found when the card opened), and the outcome of
  // its e-mail when that arrives later than the state.
  useEffect(() => {
    if (!job) return;
    const key = `${job.id}:${job.state}`;
    const emailKey = `${key}:${job.email ?? ''}`;
    const before = seen.current;
    const emailBefore = seenEmail.current;
    seen.current = key;
    seenEmail.current = emailKey;
    if (before === null) return;
    if (before !== key) announce(changeAnnouncement(job), job.state === 'failed' ? 'assertive' : 'polite');
    else if (job.email && emailBefore !== emailKey) announce(emailOutcome(job.email), 'polite');
  }, [job, announce]);

  /** Shows `found` at the fields, announces the count and focuses the first one; false when there is nothing. */
  const showErrors = (found: DiskErrors): boolean => {
    setErrors(found);
    const invalid = FIELD_ORDER.filter((k) => found[k]);
    if (!invalid.length) return false;
    announce(T.fixErrors(invalid.length), 'assertive');
    document.getElementById(FIELD_IDS[invalid[0]])?.focus();
    return true;
  };

  /** The change the server answered: shown, announced and focused. */
  const started = (change: ServerDiskChange, isNew: boolean) => {
    actions.current += 1;
    seen.current = `${change.id}:${change.state}`;
    seenEmail.current = `${seen.current}:${change.email ?? ''}`;
    setEmailPolls(0);
    setNotAnswering(false);
    setData((prev) => (prev ? withChange(prev, change, isNew) : prev));
    focusNext.current = DISK_JOB_ID;
    announce(changeAnnouncement(change), 'polite');
  };

  const onEnlarge = async (event: FormEvent) => {
    event.preventDefault();
    if (pendingRef.current || !info || info.sizeGb === null) return;
    const found: DiskErrors = {};
    const sizeProblem = newSizeError(sizeText, info.sizeGb, info.maxGb);
    if (sizeProblem) found.size = sizeProblem;
    if (!password) found.password = SVT.passwordMissing;
    if (showErrors(found)) return;
    pendingRef.current = true;
    setPending('extend');
    setExtendError(null);
    try {
      const change = await serverApi.disk.extend({ sizeGb: parseSizeGb(sizeText) as number, password });
      if (!alive.current) return;
      setPassword('');
      setSizeText('');
      setErrors({});
      started(change, true);
    } catch (e) {
      if (!alive.current) return;
      const message = errorMessage(e);
      const field = errorField(e);
      if (errorCode(e) === 'WRONG_PASSWORD' || field === 'password') {
        setPassword('');
        showErrors({ password: message });
      } else if (field === 'sizeGb') {
        showErrors({ size: message });
      } else {
        // Busy, waiting for a restart, the daily limit, not set up, Fly.io unreachable, the lockout.
        setExtendError(message);
        announce(message, 'assertive');
        // A change or a limit the card did not know about: the state on the server says more.
        if (isApiClientError(e) && (e.status === 409 || e.status === 429)) void reload();
      }
    } finally {
      pendingRef.current = false;
      if (alive.current) setPending(null);
    }
  };

  const onRestart = async (event: FormEvent) => {
    event.preventDefault();
    if (pendingRef.current) return;
    if (!restartPassword) {
      showErrors({ restartPassword: SVT.passwordMissing });
      return;
    }
    pendingRef.current = true;
    setPending('restart');
    setRestartError(null);
    try {
      const change = await serverApi.disk.restart({ password: restartPassword });
      if (!alive.current) return;
      setRestartPassword('');
      setErrors({});
      started(change, false);
    } catch (e) {
      if (!alive.current) return;
      const message = errorMessage(e);
      if (errorCode(e) === 'WRONG_PASSWORD' || errorField(e) === 'password') {
        setRestartPassword('');
        showErrors({ restartPassword: message });
      } else {
        setRestartError(message);
        announce(message, 'assertive');
        // No restart needed any more (done meanwhile, or asked from another device): read the state.
        if (isApiClientError(e) && e.status === 409) void reload();
      }
    } finally {
      pendingRef.current = false;
      if (alive.current) setPending(null);
    }
  };

  if (absent) return null;

  const header = (
    <>
      <h3 id={titleId}>{DKT.title}</h3>
      <p>{DKT.intro}</p>
    </>
  );

  if (!info) {
    return (
      <section aria-labelledby={titleId} className="stack-sm server-card__part">
        {header}
        {unavailable ? <p className="text-muted">{unavailable}</p> : load.error ? <Alert kind="error">{load.error}</Alert> : <Spinner />}
      </section>
    );
  }

  const items: DefinitionItem[] = [];
  if (info.sizeGb !== null) items.push({ term: DKT.sizeNow, value: DKT.gigabytes(info.sizeGb) });
  if (info.usedBytes !== null && info.totalBytes !== null) {
    const share = info.totalBytes > 0 ? info.usedBytes / info.totalBytes : 0;
    items.push({ term: DKT.used, value: DKT.usedValue(formatServerBytes(info.usedBytes), formatServerBytes(info.totalBytes), formatPercent(share)) });
  }
  if (info.sizeGb !== null) items.push({ term: DKT.costNow, value: formatUsd(info.sizeGb * info.pricePerGbMonth) });
  if (info.available) items.push({ term: DKT.changesLeft, value: DKT.changesLeftValue(formatNumber(info.changesLeftToday), formatNumber(info.changesPerDay)) });

  const sizeNow = info.sizeGb;
  const canChange = info.available && sizeNow !== null && !open;
  const typed = parseSizeGb(sizeText);
  const costText =
    sizeNow !== null && typed !== null && typed > sizeNow && typed <= info.maxGb ? DKT.cost(formatNumber(typed), formatUsd(typed * info.pricePerGbMonth)) : '';
  const steps = job ? stepsOf(job.state) : null;

  return (
    <section aria-labelledby={titleId} className="stack-sm server-card__part">
      {header}
      {unavailable && <p className="text-muted">{unavailable}</p>}
      {/* A failed second read keeps the state on screen. */}
      {load.error && <Alert kind="error">{load.error}</Alert>}
      {!info.available && (
        <Alert kind="info" role="none">
          {DKT.reason(info.reason)}
        </Alert>
      )}
      {!info.available && info.reason && SETUP_REASONS.has(info.reason) && info.setupCommand && (
        <CommandBlock label={DKT.setupCommand} hint={DKT.setupHint} command={info.setupCommand} copyLabel={DKT.copySetup} buttonId={DISK_COPY_SETUP_ID} />
      )}
      {items.length > 0 && <DefinitionList aria-label={DKT.title} items={items} />}

      {job && (
        // Focused after Enlarge and after the restart; every new state is announced through the live region.
        <div id={DISK_JOB_ID} tabIndex={-1} role="group" aria-labelledby={jobTitleId} className="server-card__job stack-sm">
          <h4 id={jobTitleId}>{DKT.changeTitle(formatNumber(job.fromGb), formatNumber(job.toGb))}</h4>
          <p className="text-muted">{DKT.changeStarted(formatTimestamp(job.startedAt))}</p>
          {steps && (
            <ol className="server-card__steps">
              {STEPS.map((step, i) => (
                <li key={step} className={`server-card__step server-card__step--${steps[i]}`}>
                  <span className="server-card__step-mark" aria-hidden="true">
                    {STEP_MARKS[steps[i]]}
                  </span>
                  {DKT.stepLine(DKT.step(step), DKT.stepState(steps[i]))}
                </li>
              ))}
            </ol>
          )}
          <p className={job.state === 'done' ? 'server-card__ok' : undefined}>{DKT.state(job.state, formatNumber(job.fromGb), formatNumber(job.toGb))}</p>
          {job.errorKey && (job.state === 'failed' || job.state === 'needs-restart') && (
            <Alert kind={job.state === 'failed' ? 'error' : 'warning'} role="none">
              {DKT.errorText(job.errorKey)}
            </Alert>
          )}
          {job.email && <p>{emailOutcome(job.email)}</p>}
          {open && notAnswering && <p className="text-muted">{DKT.notAnswering}</p>}
          {job.state === 'needs-restart' && (
            <form className="form stack-sm" onSubmit={(e) => void onRestart(e)} noValidate aria-labelledby={jobTitleId}>
              <p id={restartHintId}>{DKT.restartHint}</p>
              {restartError && (
                <Alert kind="error" role="none">
                  {restartError}
                </Alert>
              )}
              <Field id={DISK_RESTART_PASSWORD_ID} label={SVT.password} error={errors.restartPassword ?? null} required>
                {(a11y) => (
                  <PasswordInput
                    {...a11y}
                    value={restartPassword}
                    autoComplete="current-password"
                    onChange={(e) => {
                      setRestartPassword(e.currentTarget.value);
                      if (errors.restartPassword) setErrors((prev) => ({ ...prev, restartPassword: undefined }));
                    }}
                  />
                )}
              </Field>
              <div>
                <Button type="submit" id={DISK_RESTART_ID} aria-describedby={restartHintId} loading={pending === 'restart'}>
                  {DKT.restart}
                </Button>
              </div>
            </form>
          )}
        </div>
      )}

      {canChange && sizeNow >= info.maxGb && <p>{DKT.atMax(formatNumber(info.maxGb))}</p>}
      {canChange && sizeNow < info.maxGb && info.changesLeftToday <= 0 && (
        <p>
          {DKT.noChangesLeft(info.changesPerDay)}
          {info.nextChangeAt && ` ${DKT.nextChangeAt(formatTimestamp(info.nextChangeAt))}`}
        </p>
      )}
      {canChange && sizeNow < info.maxGb && info.changesLeftToday > 0 && (
        <form className="form stack-sm server-card__form" onSubmit={(e) => void onEnlarge(e)} noValidate aria-labelledby={formTitleId}>
          <h4 id={formTitleId}>{DKT.formTitle}</h4>
          {extendError && (
            <Alert kind="error" role="none">
              {extendError}
            </Alert>
          )}
          <Field
            id={DISK_SIZE_ID}
            label={DKT.newSize}
            hint={DKT.newSizeHint(formatNumber(sizeNow + 1), formatNumber(info.maxGb))}
            error={errors.size ?? null}
            required
          >
            {(a11y) => (
              <>
                <input
                  {...a11y}
                  // The cost of a size the disk can take is part of the description too.
                  aria-describedby={[a11y['aria-describedby'], costText ? costId : null].filter(Boolean).join(' ') || undefined}
                  type="number"
                  inputMode="numeric"
                  className="input input--number"
                  min={sizeNow + 1}
                  max={info.maxGb}
                  step={1}
                  value={sizeText}
                  onChange={(e) => {
                    setSizeText(e.currentTarget.value);
                    if (errors.size) setErrors((prev) => ({ ...prev, size: undefined }));
                  }}
                />
                {/* The cost of the typed size, read out as it changes. */}
                <p id={costId} className="server-card__cost" aria-live="polite">
                  {costText}
                </p>
              </>
            )}
          </Field>
          <p id={onlyGrowId} className="server-card__warning">
            {DKT.onlyGrow}
          </p>
          <Field id={DISK_PASSWORD_ID} label={SVT.password} error={errors.password ?? null} required>
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
          <div>
            <Button type="submit" id={DISK_ENLARGE_ID} aria-describedby={onlyGrowId} loading={pending === 'extend'}>
              {DKT.enlarge}
            </Button>
          </div>
        </form>
      )}

      {info.history.length > 0 && (
        <>
          <h4 id={historyId}>{DKT.historyTitle}</h4>
          <ul className="server-card__history" aria-labelledby={historyId}>
            {info.history.map((change) => (
              <li key={change.id}>
                {DKT.historyItem(formatNumber(change.fromGb), formatNumber(change.toGb), DKT.status(change.state), formatTimestamp(change.startedAt))}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
