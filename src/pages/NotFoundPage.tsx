/**
 * 404 page for unknown routes.
 */
import { LinkButton } from '@/components/ui/LinkButton';
import { PageTitle } from '@/components/ui/PageTitle';
import { PATHS } from '@/constants/routes';
import { T } from '@/constants/texts';

export default function NotFoundPage() {
  return (
    <div className="centered-page">
      <PageTitle title={T.notFoundTitle} />
      <p>{T.notFoundText}</p>
      <LinkButton to={PATHS.home} variant="primary">
        {T.goHome}
      </LinkButton>
    </div>
  );
}
