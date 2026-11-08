/**
 * "Backup" card: creates the encrypted backup file, optionally with a password
 * that differs from the account password. The server streams the file; the
 * Windows app saves it through the shell's native "save as" dialog
 * (`saveFileWithDialog`), the browser as a download, the phone (Android app)
 * with "Save to device" (the system "save as" dialog) or "Share". Only the
 * desktop's local-mode developer build (`usesLocalFilePaths`) sends a path and
 * lets its local server write the file - the Your Personal Diary server refuses a path.
 */
import { useState } from 'react';
import { backupFileName } from '@shared/constants';
import { passwordProblem } from '@shared/constants';
import { getCurrentLocale, tr } from '@/i18n/runtime';
import { backup as backupApi } from '@/api';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import { Field } from '@/components/ui/Field';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { T } from '@/constants/texts';
import { useAnnouncer } from '@/context/AnnouncerContext';
import { useAuth } from '@/context/AuthContext';
import { todayIso } from '@/utils/dates';
import { getPhoneFiles, saveBlob, type PhoneFileTarget } from '@/utils/download';
import { errorMessage } from '@/utils/errors';
import { isTauri, pickSavePath, saveFileWithDialog, usesLocalFilePaths, type FileFilter } from '@/utils/platform';
import { ST } from './texts';

/** Native dialog filter for .mpd files (built per call: the name follows the UI language). */
export function backupFileFilter(): FileFilter {
  return { name: ST.backupFilter, extensions: ['mpd'] };
}

interface BackupPasswordErrors {
  password?: string;
  confirm?: string;
}

/** Validation of the optional backup password (exported for tests). */
export function validateBackupPassword(password: string, confirm: string): BackupPasswordErrors {
  const errors: BackupPasswordErrors = {};
  if (!password) errors.password = T.fieldRequired(ST.backupPassword);
  else {
    const problem = passwordProblem(password, getCurrentLocale());
    if (problem) errors.password = problem;
  }
  if (!confirm) errors.confirm = T.fieldRequired(ST.backupPasswordConfirm);
  else if (confirm !== password) errors.confirm = T.passwordsMismatch;
  return errors;
}

export function BackupCreateSection() {
  const { user } = useAuth();
  const { announce } = useAnnouncer();
  const [ownPassword, setOwnPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<BackupPasswordErrors>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  // Phone: the file goes to the system dialog or the share sheet. `__MOBILE__` is a build-time
  // constant: false on the desktop (this folds to `null`), not defined under the root vitest config.
  const phoneFiles = typeof __MOBILE__ !== 'undefined' && __MOBILE__ ? getPhoneFiles() : null;
  const [target, setTarget] = useState<PhoneFileTarget | null>(null);

  const create = async (phoneTarget: PhoneFileTarget | null = null) => {
    if (busy) return;
    setError(null);
    setResult(null);
    setTarget(phoneTarget);
    if (ownPassword) {
      const next = validateBackupPassword(password, confirm);
      setErrors(next);
      if (next.password || next.confirm) {
        announce(T.fixErrors(Object.keys(next).length), 'assertive');
        document.getElementById(next.password ? 'backup-password' : 'backup-password-confirm')?.focus();
        return;
      }
    }
    setBusy(true);
    try {
      const body = ownPassword ? { password } : {};
      let message: string;
      if (usesLocalFilePaths()) {
        // Local-mode developer build: the server on this computer writes the file at the chosen path.
        const destPath = await pickSavePath(backupFileName(user?.username ?? 'diary', todayIso()), [backupFileFilter()]);
        if (!destPath) {
          announce(ST.cancelled, 'polite');
          return;
        }
        const info = await backupApi.createToPath({ ...body, destPath });
        message = ST.backupCreated(info.fileName, info.sizeBytes);
      } else if (phoneFiles && phoneTarget) {
        const { blob, fileName } = await backupApi.download(body);
        const outcome = phoneTarget === 'save' ? await phoneFiles.save(blob, fileName) : await phoneFiles.share(blob, fileName);
        if (outcome === 'cancelled') {
          announce(ST.cancelled, 'polite');
          return;
        }
        message = tr(phoneTarget === 'save' ? 'mobile.files.saved' : 'mobile.files.shared', { fileName });
      } else if (isTauri()) {
        // Windows app: the server sends the file, the shell's "save as" dialog saves it (no path is sent).
        const { blob, fileName } = await backupApi.download(body);
        let saved: string | null;
        try {
          saved = await saveFileWithDialog(blob, fileName, backupFileFilter());
        } catch {
          throw new Error(tr('server.backup.writeFailed'));
        }
        if (saved === null) {
          announce(ST.cancelled, 'polite');
          return;
        }
        message = ST.backupCreated(saved, blob.size);
      } else {
        const { blob, fileName } = await backupApi.download(body);
        saveBlob(blob, fileName);
        message = ST.backupCreated(fileName, blob.size);
      }
      setResult(message);
      announce(message, 'polite');
    } catch (e) {
      const message = errorMessage(e);
      setError(message);
      announce(message, 'assertive');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title={ST.backup}>
      <div className="stack">
        <p>{ST.backupExplanation}</p>
        {result && <Alert kind="success" role="none">{result}</Alert>}
        {error && <Alert kind="error" role="none">{error}</Alert>}
        <Checkbox
          id="backup-own-password"
          label={ST.backupOwnPassword}
          hint={ST.backupOwnPasswordHint}
          checked={ownPassword}
          onChange={(v) => {
            setOwnPassword(v);
            if (!v) setErrors({});
          }}
        />
        {ownPassword && (
          <div className="settings-grid">
            <Field id="backup-password" label={ST.backupPassword} error={errors.password} hint={ST.newPasswordHint} required>
              {(a11y) => (
                <PasswordInput
                  {...a11y}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.currentTarget.value);
                    if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
                  }}
                />
              )}
            </Field>
            <Field id="backup-password-confirm" label={ST.backupPasswordConfirm} error={errors.confirm} required>
              {(a11y) => (
                <PasswordInput
                  {...a11y}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => {
                    setConfirm(e.currentTarget.value);
                    if (errors.confirm) setErrors((prev) => ({ ...prev, confirm: undefined }));
                  }}
                />
              )}
            </Field>
          </div>
        )}
        <div className="form__actions">
          {phoneFiles ? (
            <>
              <Button loading={busy && target === 'save'} disabled={busy} onClick={() => void create('save')}>
                {tr('mobile.files.saveToDevice')}
              </Button>
              <Button variant="secondary" loading={busy && target === 'share'} disabled={busy} onClick={() => void create('share')}>
                {tr('mobile.files.share')}
              </Button>
            </>
          ) : (
            <Button loading={busy} onClick={() => void create()}>
              {ST.createBackup}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
