/**
 * Landing page for anonymous visitors ("/" without a session): what the
 * diary does, the privacy promise and two big buttons - Sign up / Log in.
 * A third, secondary button starts the tour mode ("Skip - just look around",
 * SkipTourButton) in the Android app only; it renders nothing in the Windows
 * app and the web UI.
 * With the Your Personal Diary server the encryption line names the server
 * instead of "your computer", and the privacy line says "encrypted with your
 * password" instead of "end to end" (the server decrypts while you are signed in).
 */
import { FocusHeading } from '@/components/a11y/FocusHeading';
import { LinkButton } from '@/components/ui/LinkButton';
import { PATHS, WELCOME_TITLE } from '@/constants/routes';
import { T } from '@/constants/texts';
import { useHostedServer } from '@/context/ConnectionContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { SkipTourButton } from '@/pages/onboarding/SkipTourButton';

export default function WelcomePage() {
  useDocumentTitle(WELCOME_TITLE);
  const hosted = useHostedServer();
  return (
    <section className="welcome">
      <FocusHeading id="page-title">{T.welcomeTitle}</FocusHeading>
      <p className="welcome__lead">{T.welcomeLead}</p>
      <div className="welcome__actions">
        <LinkButton to={PATHS.register} variant="primary" size="lg">
          {T.register}
        </LinkButton>
        <LinkButton to={PATHS.login} variant="secondary" size="lg">
          {T.login}
        </LinkButton>
      </div>
      {/* The Android app only (unless its server turned the tour off); nothing in the Windows app and the web UI. */}
      <SkipTourButton />
      <h2 className="visually-hidden">{T.welcomeFeaturesHeading}</h2>
      <ul className="welcome__features">
        {T.welcomeFeaturesFor(hosted).map((feature) => (
          <li key={feature}>{feature}</li>
        ))}
      </ul>
      <p className="text-muted">{T.privacySentenceFor(hosted)}</p>
    </section>
  );
}
