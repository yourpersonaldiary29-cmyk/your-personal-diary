/**
 * "Required update" - the part of the owner's Server card (ServerSection.tsx) where he decides, per platform,
 * the OLDEST version of the app that may still be used (app version 1.1.0; the routes GET / POST
 * /api/server/app-update, shared/types.ts `ServerAppUpdate` / `ServerAppUpdateChange`). An app whose own
 * version is lower shows the "Update needed" screen (src/pages/UpdateRequiredPage.tsx); versions before 1.1.0
 * get the server's message at their next start or sign-in.
 *
 * Above the rows: what the section does, the warning to turn a rule on only once the store offers the new
 * version to everyone (a rule that comes too early locks people out with nothing to install), and that an app
 * without a connection keeps working. One row per platform (Android, iPhone, Windows, Mac): its state ("No
 * update is required" / "Versions older than {version} must update"), the field "Oldest version that may
 * still be used" - the rule, or this app's own version as a suggestion while there is none - with the newest
 * version of the Downloads page as a hint where the server knows one, and Save / Turn off. Save with an
 * empty field turns the rule off too.
 *
 * Like the files of the Downloads page (ServerDownloads.tsx): the account password confirms every change
 * (one password field for the rows; it is forgotten after every change and when the app locks), the form is
 * checked as the server checks it (a version `a.b.c`, not above the server's own version) and the server
 * checks everything again - its own message is shown when it refuses (at the field, at the password, or
 * above the rows). Before a change the card says when no e-mail would be sent about it. A server without
 * these routes (404) shows nothing of it; one that refuses them (403) shows the server's sentence.
 */
import { useEffect, useId, useRef, useState } from 'react';
import { APP_VERSION } from '@shared/constants';
import { APP_PLATFORMS, type AppPlatform } from '@shared/types';
import { isApiClientError, server as serverApi } from '@/api';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { Spinner } from '@/components/ui/Spinner';
import { TextInput } from '@/components/ui/TextInput';
import { useAnnouncer } from '@/context/AnnouncerContext';
import { useLock } from '@/context/LockContext';
import { useApi } from '@/hooks/useApi';
import { compareVersions, parseVersion } from '@/utils/appUpdate';
import { errorCode, errorField, errorMessage } from '@/utils/errors';
import { SVT, UPT } from './serverTexts';

export const UPDATE_PASSWORD_ID = 'settings-server-update-password';
export const UPDATE_RESULT_ID = 'settings-server-update-result';
/** The version field of a platform's row. */
export const updateVersionId = (platform: AppPlatform) => `settings-server-update-${platform}-version`;
/** The Save button of a platform's row. */
export const updateSaveId = (platform: AppPlatform) => `settings-server-update-${platform}-save`;

/**
 * Checks a version as the server will (it checks again): empty turns the rule off (null), otherwise a version
 * `a.b.c` not above the server's own version. Returns the version to send, or the error to show.
 */
export function checkMinVersion(value: string, serverVersion: string): { minVersion: string | null } | { error: string } {
  const wanted = value.trim();
  if (!wanted) return { minVersion: null };
  if (!parseVersion(wanted)) return { error: UPT.invalidVersion };
  const order = compareVersions(wanted, serverVersion);
  if (order !== null && order > 0) return { error: UPT.tooNew(serverVersion) };
  return { minVersion: wanted };
}

/** The field's text for a rule: the rule itself, or this app's own version as a suggestion while there is none. */
function fieldValue(rule: string | null | undefined): string {
  return rule ?? APP_VERSION;
}

type Errors = Partial<Record<AppPlatform | 'password', string>>;

export interface ServerAppUpdateProps {
  /** Bumped by the card's Refresh: the rules are read again. */
  refresh?: number;
}

export function ServerAppUpdate({ refresh = 0 }: ServerAppUpdateProps) {
  const { announce } = useAnnouncer();
  const { locked: appLocked } = useLock();
  const titleId = useId();

  /** 404: a server from before this part - nothing of it is shown. */
  const [absent, setAbsent] = useState(false);
  /** 403: the server's sentence. */
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [values, setValues] = useState<Partial<Record<AppPlatform, string>>>({});
  const load = useApi((signal) => serverApi.appUpdate.get(signal), [refresh], {
    onSuccess: (data) => {
      setUnavailable(null);
      // The fields follow what the server says (a change from another device, Refresh).
      setValues(Object.fromEntries(APP_PLATFORMS.map((p) => [p, fieldValue(data.rules[p])])));
    },
    onError: (e) => {
      if (!isApiClientError(e)) return;
      if (e.status === 404) setAbsent(true);
      else if (e.status === 403) setUnavailable(e.message);
    },
  });
  const state = load.data;

  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  /** The platform whose change is on its way to the server. */
  const [busy, setBusy] = useState<AppPlatform | null>(null);
  const busyRef = useRef(false);
  const [opError, setOpError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<string | null>(null);
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

  // Locking the app (Ctrl+L) forgets the password.
  useEffect(() => {
    if (appLocked) setPassword('');
  }, [appLocked]);

  const showError = (field: AppPlatform | 'password', message: string) => {
    setErrors({ [field]: message });
    announce(message, 'assertive');
    focusNext.current = field === 'password' ? UPDATE_PASSWORD_ID : updateVersionId(field);
  };

  const change = async (platform: AppPlatform, turnOff: boolean) => {
    if (busyRef.current || !state) return;
    setOutcome(null);
    setOpError(null);
    const checked = turnOff ? { minVersion: null } : checkMinVersion(values[platform] ?? '', state.serverVersion);
    if ('error' in checked) {
      showError(platform, checked.error);
      return;
    }
    if (!password) {
      showError('password', SVT.passwordMissing);
      return;
    }
    busyRef.current = true;
    setBusy(platform);
    setErrors({});
    try {
      const next = await serverApi.appUpdate.set({ platform, minVersion: checked.minVersion, password });
      if (!alive.current) return;
      load.setData(next);
      setValues((prev) => ({ ...prev, [platform]: fieldValue(next.rules[platform]) }));
      setPassword('');
      const text = next.rules[platform] === null ? UPT.turnedOff : UPT.saved;
      setOutcome(`${UPT.platformName(platform)}: ${text}`);
      focusNext.current = UPDATE_RESULT_ID;
      announce(`${UPT.platformName(platform)}: ${text}`, 'polite');
    } catch (e) {
      if (!alive.current) return;
      const message = errorMessage(e);
      const field = errorField(e);
      if (errorCode(e) === 'WRONG_PASSWORD' || field === 'password') {
        setPassword('');
        showError('password', message);
      } else if (field === 'minVersion' || field === 'version') {
        showError(platform, message);
      } else {
        // The lockout, a refusal, no connection: above the rows, the fields kept.
        setOpError(message);
        announce(message, 'assertive');
      }
    } finally {
      busyRef.current = false;
      if (alive.current) setBusy(null);
    }
  };

  if (absent) return null;

  return (
    <section aria-labelledby={titleId} className="stack-sm server-card__part" data-testid="server-app-update">
      <h3 id={titleId}>{UPT.title}</h3>
      <p>{UPT.intro}</p>
      <p className="server-card__warning">{UPT.warning}</p>
      <p className="text-muted">{UPT.offline}</p>
      {!state &&
        (unavailable ? (
          <p className="text-muted">{unavailable}</p>
        ) : load.error ? (
          <Alert kind="error">{load.error}</Alert>
        ) : (
          <Spinner />
        ))}
      {state && (
        <>
          {load.error && <Alert kind="error">{load.error}</Alert>}
          {state.email !== 'ready' && (
            <Alert kind="info" role="none">
              {UPT.emailWarning(state.email)}
            </Alert>
          )}
          {outcome && (
            <Alert kind="success" role="none" id={UPDATE_RESULT_ID} tabIndex={-1}>
              {outcome}
            </Alert>
          )}
          {opError && (
            <Alert kind="error" role="none">
              {opError}
            </Alert>
          )}
          <Field id={UPDATE_PASSWORD_ID} label={SVT.password} error={errors.password ?? null} required>
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
          {APP_PLATFORMS.map((platform) => {
            const rule = state.rules[platform];
            const name = UPT.platformName(platform);
            const newest = state.newestDownload[platform];
            const hint = newest ? `${UPT.versionHint} ${UPT.newestHint(newest)}` : UPT.versionHint;
            return (
              <fieldset key={platform} className="server-card__update-row stack-sm" data-platform={platform}>
                <legend className="server-card__update-name">{name}</legend>
                <p className={rule ? 'server-card__update-state server-card__update-state--on' : 'server-card__update-state'}>
                  {rule ? UPT.stateOn(rule) : UPT.stateOff}
                </p>
                <Field id={updateVersionId(platform)} label={UPT.versionLabel} hint={hint} error={errors[platform] ?? null}>
                  {(a11y) => (
                    <TextInput
                      {...a11y}
                      dir="ltr"
                      inputMode="decimal"
                      value={values[platform] ?? fieldValue(rule)}
                      autoComplete="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      onChange={(e) => {
                        const next = e.currentTarget.value;
                        setValues((prev) => ({ ...prev, [platform]: next }));
                        if (errors[platform]) setErrors((prev) => ({ ...prev, [platform]: undefined }));
                      }}
                    />
                  )}
                </Field>
                <div className="cluster">
                  <Button id={updateSaveId(platform)} aria-label={UPT.saveFor(name)} loading={busy === platform} onClick={() => void change(platform, false)}>
                    {UPT.save}
                  </Button>
                  {rule && (
                    <Button variant="secondary" aria-label={UPT.turnOffFor(name)} disabled={busy !== null && busy !== platform} onClick={() => void change(platform, true)}>
                      {UPT.turnOff}
                    </Button>
                  )}
                </div>
              </fieldset>
            );
          })}
        </>
      )}
    </section>
  );
}
