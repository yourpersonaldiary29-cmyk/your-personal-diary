/**
 * "Account" card: first name, last name, username and e-mail (with a "Set"
 * button while the address is missing), an inline "Edit details" form, the
 * change-password dialog, a confirmed logout, and the list of connected
 * devices. After a profile change the user is refreshed so the header greeting
 * and this card follow.
 *
 * With the Your Personal Diary server (`useHostedServer`) the card can also show
 * the account ID (read-only, LTR, selectable as a whole) with a Copy button: the
 * owner of the hosted server copies it into the server's configuration to turn
 * the owner cards on (docs/HOSTED-DEPLOY.he.md step ו). Regular users never see
 * it (docs/android-tasks/OWNER-ID-VISIBILITY.md): the row appears while the
 * server has no valid owner yet (`ServerInfo.ownerConfigured: false` - the
 * would-be owner must be able to read his id) and, afterwards, to the configured
 * owner only (`ServerSettings.isMailOwner`, the flag the Mail card reads). Both
 * come from the Mail card's own read of the server (useOwnerAccess), asked on
 * each visit of the Settings page - never from the start-up probe in the
 * connection store, which an app or a tab opened before the owner was set would
 * still hold. A local server does not show it and is not asked.
 */
import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DefinitionList } from '@/components/ui/DefinitionList';
import { T } from '@/constants/texts';
import { useAnnouncer } from '@/context/AnnouncerContext';
import { useAuth } from '@/context/AuthContext';
import { useHostedServer } from '@/context/ConnectionContext';
import { useToast } from '@/context/ToastContext';
import { ChangePasswordDialog } from './ChangePasswordDialog';
import { copyText } from './clipboard';
import { ProfileForm, SetEmailDialog } from './ProfileEditor';
import { SessionsList } from './SessionsList';
import { ST } from './texts';
import { useOwnerAccess } from './useOwnerCard';

export function AccountSection() {
  const { user, logout, refreshUser } = useAuth();
  const { announce } = useAnnouncer();
  const toast = useToast();
  const hosted = useHostedServer();
  // The account ID row: while the hosted server has no valid owner yet (`ownerConfigured: false`) it is
  // shown to everyone - the would-be owner must be able to read his id. Afterwards only the configured
  // owner sees it (`isMailOwner`). Both answers are the server's NOW, from the read the Mail card makes
  // anyway (no request of this card's own on the Settings page): the connection store's start-up probe
  // may predate the owner's restart. Nothing shows until they arrived; a refused or failed request keeps
  // the row hidden (unless the server just said it has no owner yet) - never an error in this card. A
  // local server is never asked.
  const access = useOwnerAccess('isMailOwner', hosted);
  const showAccountId =
    hosted && access?.info?.mode === 'hosted' && (access.info.ownerConfigured === false || access.settings?.isMailOwner === true);
  const formId = `profile-form-${useId()}`;
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  // Bumped after a password change: every other device was signed out, so the device list reloads.
  const [sessionsVersion, setSessionsVersion] = useState(0);
  const [editing, setEditing] = useState(false);
  // After the address was saved the "Set" button (the dialog's opener) disappears with the refresh, so focus
  // continues at the edit button. This effect runs after the Dialog's own focus restore (child effects first).
  const focusEditAfterClose = useRef(false);
  useEffect(() => {
    if (!emailOpen && focusEditAfterClose.current) {
      focusEditAfterClose.current = false;
      editButtonRef.current?.focus();
    }
  }, [emailOpen]);

  if (!user) return null;

  const confirmLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
      setLogoutOpen(false);
    }
  };

  /** Reloads the profile (header greeting, this card). A failed reload is not an error: the save succeeded. */
  const reloadUser = async () => {
    try {
      await refreshUser();
    } catch {
      /* the saved details show on the next load */
    }
  };

  const onEmailSaved = async () => {
    focusEditAfterClose.current = true;
    setEmailOpen(false);
    await reloadUser();
    announce(ST.emailSaved, 'polite');
    toast.success(ST.emailSaved, { announced: true });
    editButtonRef.current?.focus();
  };

  const onProfileSaved = async (changed: boolean) => {
    setEditing(false);
    if (changed) {
      await reloadUser();
      announce(ST.profileSaved, 'polite');
      toast.success(ST.profileSaved, { announced: true });
    } else {
      announce(ST.noChanges, 'polite');
    }
    editButtonRef.current?.focus();
  };

  const cancelEdit = () => {
    setEditing(false);
    editButtonRef.current?.focus();
  };

  /** Copies the account ID; never throws - a failed copy asks the user to select the text by hand. */
  const copyAccountId = async (id: string) => {
    let ok: boolean;
    try {
      ok = await copyText(id);
    } catch {
      ok = false;
    }
    if (ok) {
      announce(ST.accountIdCopied, 'polite');
      toast.success(ST.accountIdCopied, { announced: true });
    } else {
      toast.error(ST.accountIdCopyFailed);
    }
  };

  const accountIdValue = (
    <div className="account-id">
      <span className="account-id__line">
        <span className="account-id__value" data-testid="account-id">
          {user.id}
        </span>
        <Button variant="secondary" size="sm" aria-label={ST.copyAccountId} onClick={() => void copyAccountId(user.id)}>
          {ST.copy}
        </Button>
      </span>
      <p className="account-id__hint text-muted text-small">{ST.accountIdHint}</p>
    </div>
  );

  const emailValue = user.email ? (
    <span className="ltr">{user.email}</span>
  ) : (
    <span className="account-email-unset">
      <span>{T.emailNotSet}</span>
      <Button variant="secondary" size="sm" aria-label={ST.setEmailTitle} onClick={() => setEmailOpen(true)}>
        {ST.setEmail}
      </Button>
    </span>
  );

  return (
    <Card
      title={ST.account}
      actions={
        <>
          <Button variant="secondary" onClick={() => setPasswordOpen(true)}>
            {ST.changePassword}
          </Button>
          <Button variant="secondary" onClick={() => setLogoutOpen(true)}>
            {ST.logoutAction}
          </Button>
        </>
      }
    >
      <div className="stack">
        <DefinitionList
          aria-label={ST.account}
          items={[
            { term: T.firstName, value: user.firstName },
            { term: T.lastName, value: user.lastName },
            { term: T.username, value: <span className="ltr">{user.username}</span> },
            { term: T.email, value: emailValue },
            ...(showAccountId ? [{ term: ST.accountId, value: accountIdValue }] : []),
          ]}
        />
        <div>
          <Button
            ref={editButtonRef}
            variant="secondary"
            aria-expanded={editing}
            aria-controls={editing ? formId : undefined}
            onClick={() => (editing ? cancelEdit() : setEditing(true))}
          >
            {ST.editDetails}
          </Button>
        </div>
        {editing && <ProfileForm id={formId} user={user} onCancel={cancelEdit} onSaved={onProfileSaved} />}
        <SessionsList key={sessionsVersion} />
      </div>
      <ChangePasswordDialog open={passwordOpen} onClose={() => setPasswordOpen(false)} onChanged={() => setSessionsVersion((v) => v + 1)} />
      <SetEmailDialog open={emailOpen} onClose={() => setEmailOpen(false)} onSaved={onEmailSaved} />
      <ConfirmDialog
        open={logoutOpen}
        title={ST.logoutAction}
        message={ST.logoutQuestion}
        confirmLabel={ST.logoutAction}
        loading={loggingOut}
        onConfirm={confirmLogout}
        onCancel={() => setLogoutOpen(false)}
      />
    </Card>
  );
}
