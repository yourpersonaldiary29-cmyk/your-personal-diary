/**
 * "Restore from backup" card: pick a backup file (a file input in the Windows app
 * and the browser - the file is uploaded to the server; the system "open" dialog in
 * the Android app; the native dialog and a path only in the desktop's local-mode
 * developer build, whose server on this computer reads the file itself),
 * inspect it, enter its password and confirm that the current diary will be
 * replaced. Settings are reloaded afterwards because the restored database
 * carries its own.
 *
 * Phone (Android app): the file is chosen through the phone file bridge (`pick`: the plugin's own
 * open dialog - the WebView's <input type="file"> chooser cannot be told apart from leaving the
 * app, so "lock when I leave the app" would lock the diary under it), and a backup the app was
 * opened with ("Open with Your Personal Diary" on a .mpd file) arrives through the same bridge
 * and is inspected like a picked file - the password and the confirmation stay exactly the same;
 * nothing is restored by opening a file.
 */
import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react';
import type { BackupFileInfo } from '@shared/types';
import { backup as backupApi } from '@/api';
import { Alert } from '@/components/ui/Alert';
import { drainBeforeOnlineWrite } from '@/components/sync/syncGate';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DefinitionList } from '@/components/ui/DefinitionList';
import { Field } from '@/components/ui/Field';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { Spinner } from '@/components/ui/Spinner';
import { T } from '@/constants/texts';
import { useAnnouncer } from '@/context/AnnouncerContext';
import { useSettings } from '@/context/SettingsContext';
import { useToast } from '@/context/ToastContext';
import { tr } from '@/i18n/runtime';
import { getPhoneFiles } from '@/utils/download';
import { errorCode, errorField, errorMessage } from '@/utils/errors';
import { formatBytes } from '@/utils/format';
import { pickOpenPath, usesLocalFilePaths } from '@/utils/platform';
import { backupFileFilter } from './BackupCreateSection';
import { ST } from './texts';

/** The chosen backup: an absolute path (local-mode developer build only) or a File (Windows app, browser, phone). */
export type BackupSource = { kind: 'path'; path: string } | { kind: 'file'; file: File };

/** File name shown for a source. */
export function sourceName(source: BackupSource): string {
  if (source.kind === 'file') return source.file.name;
  const parts = source.path.split(/[\\/]/);
  return parts[parts.length - 1] || source.path;
}

export function RestoreSection() {
  const { announce } = useAnnouncer();
  const toast = useToast();
  const { reload: reloadSettings } = useSettings();
  const base = useId();
  const passwordId = `restore-password-${base}`;
  const fileId = `restore-file-${base}`;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [source, setSource] = useState<BackupSource | null>(null);
  const [info, setInfo] = useState<BackupFileInfo | null>(null);
  const [inspecting, setInspecting] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const focusPasswordAfterClose = useRef(false);

  // A wrong backup password closes the confirm dialog, which returns focus to
  // its opener; this effect runs after that and moves focus to the field with
  // the error (child effects run before the parent's).
  useEffect(() => {
    if (!confirmOpen && focusPasswordAfterClose.current) {
      focusPasswordAfterClose.current = false;
      document.getElementById(passwordId)?.focus();
    }
  }, [confirmOpen, passwordId]);

  const inspect = async (next: BackupSource) => {
    setSource(next);
    setInfo(null);
    setFileError(null);
    setError(null);
    setResult(null);
    setInspecting(true);
    try {
      const found = next.kind === 'path' ? await backupApi.inspectPath(next.path) : await backupApi.inspectFile(next.file);
      setInfo(found);
      announce(found.description, found.valid ? 'polite' : 'assertive');
    } catch (e) {
      const message = errorMessage(e);
      setFileError(message);
      announce(message, 'assertive');
    } finally {
      setInspecting(false);
    }
  };

  // Phone: the file the app was opened with. `__MOBILE__` is a build-time constant: false on the
  // desktop (this folds to `null`), not defined under the root vitest config.
  const phoneFiles = typeof __MOBILE__ !== 'undefined' && __MOBILE__ ? getPhoneFiles() : null;
  // A path only for a server on this computer (local-mode developer build); the Your Personal Diary server refuses one.
  const byPath = usesLocalFilePaths();
  const inspectRef = useRef(inspect);
  inspectRef.current = inspect;
  const toastRef = useRef(toast);
  toastRef.current = toast;
  useEffect(() => {
    if (!phoneFiles) return;
    const opened = (file: File) => {
      toastRef.current.info(tr('mobile.files.openedBackup', { fileName: file.name }));
      void inspectRef.current({ kind: 'file', file }).then(() => document.getElementById(passwordId)?.focus());
    };
    const pending = phoneFiles.takeOpenedFile();
    if (pending) opened(pending);
    return phoneFiles.onOpenedFile(opened);
  }, [phoneFiles, passwordId]);

  const pickPath = async () => {
    if (inspecting) return;
    const path = await pickOpenPath([backupFileFilter()]);
    if (!path) {
      announce(ST.cancelled, 'polite');
      return;
    }
    await inspect({ kind: 'path', path });
  };

  // Phone: the system "open" dialog through the bridge; a failure to read the file is shown at the field.
  const pickPhoneFile = async () => {
    if (inspecting || !phoneFiles) return;
    let file: File | null;
    try {
      file = await phoneFiles.pick();
    } catch (e) {
      const message = errorMessage(e) || tr('mobile.files.readFailed');
      setFileError(message);
      announce(message, 'assertive');
      return;
    }
    if (!file) {
      announce(ST.cancelled, 'polite');
      return;
    }
    await inspect({ kind: 'file', file });
  };

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0] ?? null;
    if (!file) {
      setSource(null);
      setInfo(null);
      return;
    }
    void inspect({ kind: 'file', file });
  };

  const askRestore = () => {
    setError(null);
    setResult(null);
    if (!source || !info) {
      setFileError(ST.needBackupFile);
      announce(ST.needBackupFile, 'assertive');
      return;
    }
    if (!info.valid) {
      setFileError(ST.invalidBackupFile);
      announce(ST.invalidBackupFile, 'assertive');
      return;
    }
    if (!password) {
      setPasswordError(T.fieldRequired(ST.backupPassword));
      announce(T.fieldRequired(ST.backupPassword), 'assertive');
      document.getElementById(passwordId)?.focus();
      return;
    }
    setConfirmOpen(true);
  };

  const restore = async () => {
    if (restoring || !source) return;
    setRestoring(true);
    try {
      // A restore replaces the diary: what waits on this device is uploaded first (offline mode, section 4.3).
      const left = (m: string) => {
        setConfirmOpen(false);
        setError(m);
        announce(m, 'assertive');
      };
      if (!(await drainBeforeOnlineWrite({ onDraining: (m) => announce(m, 'polite'), onLeft: left }))) return;
      const restored =
        source.kind === 'path' ? await backupApi.restoreFromPath(source.path, password) : await backupApi.restoreFromFile(source.file, password);
      const message = ST.restored(restored.entries, restored.habits);
      setConfirmOpen(false);
      setResult(message);
      setPassword('');
      setSource(null);
      setInfo(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      announce(message, 'polite');
      toast.success(message, { announced: true });
      try {
        await reloadSettings();
      } catch {
        /* the restored settings will load on the next visit */
      }
    } catch (e) {
      const message = errorMessage(e);
      setConfirmOpen(false);
      if (errorCode(e) === 'WRONG_PASSWORD' || errorField(e) === 'password') {
        setPasswordError(message);
        focusPasswordAfterClose.current = true;
      } else {
        setError(message);
      }
      announce(message, 'assertive');
    } finally {
      setRestoring(false);
    }
  };

  return (
    <Card title={ST.restore}>
      <div className="stack">
        <p>{ST.restoreExplanation}</p>
        {result && <Alert kind="success" role="none">{result}</Alert>}
        {error && <Alert kind="error" role="none">{error}</Alert>}
        {byPath || phoneFiles ? (
          <div className="stack-sm">
            <div className="cluster">
              <Button variant="secondary" loading={inspecting} onClick={() => void (phoneFiles ? pickPhoneFile() : pickPath())}>
                {ST.pickBackupFile}
              </Button>
            </div>
            {fileError && (
              <p className="field__error" role="alert">
                {fileError}
              </p>
            )}
          </div>
        ) : (
          <Field id={fileId} label={ST.backupFileField} hint={ST.backupFileHint} error={fileError}>
            {(a11y) => <input {...a11y} ref={fileInputRef} type="file" accept=".mpd" className="input" onChange={onFileChange} />}
          </Field>
        )}
        {inspecting && <Spinner label={ST.inspecting} />}
        {source && info && (
          <Alert kind={info.valid ? 'success' : 'warning'} role="none">
            <DefinitionList
              items={[
                { term: ST.chosenFile, value: <span className="path-text">{sourceName(source)}</span> },
                { term: ST.fileSize, value: formatBytes(info.sizeBytes) },
                { term: ST.fileStatus, value: info.description },
              ]}
            />
          </Alert>
        )}
        <Field id={passwordId} label={ST.backupPassword} error={passwordError} required>
          {(a11y) => (
            <PasswordInput
              {...a11y}
              autoComplete="off"
              value={password}
              onChange={(e) => {
                setPassword(e.currentTarget.value);
                if (passwordError) setPasswordError(null);
              }}
            />
          )}
        </Field>
        <div className="form__actions">
          <Button variant="danger" loading={restoring} onClick={askRestore}>
            {ST.restoreAction}
          </Button>
        </div>
      </div>
      <ConfirmDialog
        open={confirmOpen}
        title={ST.restoreTitle}
        message={ST.restoreWarning}
        confirmLabel={ST.restoreConfirm}
        danger
        loading={restoring}
        onConfirm={restore}
        onCancel={() => setConfirmOpen(false)}
      />
    </Card>
  );
}
