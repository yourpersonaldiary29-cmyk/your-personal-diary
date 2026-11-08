/**
 * "Deletion request by e-mail" - the last part of the owner's Server card (ServerSection.tsx;
 * docs/android-tasks/ADMIN-TOOL.md item 3, docs/HOSTED-PLAN.md 3.10, docs/HOSTED-RUNBOOK.he.md chapter 9).
 *
 * The privacy policy promises that someone who cannot sign in can ask by e-mail, from the address
 * registered in the account, to have the account deleted. The deletion itself is done by the operator
 * tool /app/admin.cjs inside the server's machine, which needs the owner's Fly login: NOTHING in the
 * app can look up, list or delete another account, and this part makes no server call at all. The owner
 * types the requester's address and the card shows two ready commands for his own PowerShell, each with
 * a Copy button (adminCommands.ts builds them exactly as the tool prints them):
 *   1. find - shows the account's username, address, registration date and diary size, changes nothing;
 *   2. delete --email <address> --confirm <username> - the username as the find command showed it,
 *      typed into the second field (the tool refuses any other).
 * Plus the one line that matters most: check that the request came from the registered address.
 *
 * The address and the username live in this component's state only: never sent, never stored, typed
 * with autocomplete off, forgotten when the app locks (Ctrl+L), when the card unmounts and - the
 * username - whenever the address changes (a username belongs to the find of THAT address).
 */
import { useEffect, useId, useState } from 'react';
import { Field } from '@/components/ui/Field';
import { TextInput } from '@/components/ui/TextInput';
import { useLock } from '@/context/LockContext';
import { emailProblem } from '../RegisterPage';
import { addressArgument, deleteCommand, findCommand, flyAppOf, isUsername } from './adminCommands';
import { CommandBlock } from './CommandBlock';
import { DRT } from './serverTexts';

export const DELETION_EMAIL_ID = 'settings-server-deletion-email';
export const DELETION_USERNAME_ID = 'settings-server-deletion-username';
export const DELETION_COPY_FIND_ID = 'settings-server-copy-find';
export const DELETION_COPY_DELETE_ID = 'settings-server-copy-delete';

export interface DeletionRequestProps {
  /** The server's public address (`ServerInfo.publicUrl`): the commands name its Fly app. */
  publicUrl?: string | null;
}

export function DeletionRequest({ publicUrl }: DeletionRequestProps) {
  const titleId = useId();
  const { locked } = useLock();
  const [email, setEmail] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  const [username, setUsername] = useState('');
  const [usernameTouched, setUsernameTouched] = useState(false);

  // Locking the app forgets what was typed: it is somebody else's personal data.
  useEffect(() => {
    if (!locked) return;
    setEmail('');
    setEmailTouched(false);
    setUsername('');
    setUsernameTouched(false);
  }, [locked]);

  const address = email.trim();
  const addressError = address ? emailProblem(address) : null;
  const addressReady = address !== '' && addressError === null;
  const name = username.trim();
  const nameReady = isUsername(name);
  const app = flyAppOf(publicUrl);

  const onEmail = (next: string) => {
    if (next.trim() !== address) {
      setUsername('');
      setUsernameTouched(false);
    }
    setEmail(next);
  };

  return (
    <section aria-labelledby={titleId} className="stack-sm server-card__deletion">
      <h3 id={titleId}>{DRT.title}</h3>
      <p>{DRT.intro}</p>
      <p className="server-card__warning">{DRT.check}</p>
      <Field id={DELETION_EMAIL_ID} label={DRT.email} error={emailTouched ? addressError : null}>
        {(a11y) => (
          <TextInput
            {...a11y}
            type="email"
            inputMode="email"
            dir="ltr"
            value={email}
            onChange={(e) => onEmail(e.currentTarget.value)}
            onBlur={() => setEmailTouched(true)}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
          />
        )}
      </Field>
      {addressReady ? (
        <>
          {addressArgument(address).encoded && <p className="text-muted">{DRT.encoded}</p>}
          <CommandBlock label={DRT.find} hint={DRT.findHint} command={findCommand(app, address)} copyLabel={DRT.copyFind} buttonId={DELETION_COPY_FIND_ID} />
          <Field
            id={DELETION_USERNAME_ID}
            label={DRT.username}
            hint={DRT.usernameHint}
            error={usernameTouched && name !== '' && !nameReady ? DRT.usernameInvalid : null}
          >
            {(a11y) => (
              <TextInput
                {...a11y}
                dir="auto"
                value={username}
                onChange={(e) => setUsername(e.currentTarget.value)}
                onBlur={() => setUsernameTouched(true)}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
              />
            )}
          </Field>
          {nameReady && (
            <CommandBlock
              label={DRT.delete}
              hint={DRT.deleteHint}
              command={deleteCommand(app, address, name)}
              copyLabel={DRT.copyDelete}
              buttonId={DELETION_COPY_DELETE_ID}
            />
          )}
        </>
      ) : (
        <p className="text-muted">{DRT.waiting}</p>
      )}
    </section>
  );
}
