/**
 * Page header (every page): back button (first in DOM = right edge in RTL),
 * today's date, the app title linking home, and - signed in - the greeting
 * sentence at the end of the row (Greeting.tsx).
 */
import { Link } from 'react-router-dom';
import { T } from '@/constants/texts';
import { PATHS } from '@/constants/routes';
import { BackButton } from './BackButton';
import { Greeting } from './Greeting';
import { TodayDate } from './TodayDate';

export function Header() {
  return (
    <header className="header">
      <div className="header__inner">
        <BackButton />
        <TodayDate />
        <p className="header__title">
          <Link to={PATHS.home} className="header__title-link">
            {T.appName}
          </Link>
        </p>
        <Greeting />
      </div>
    </header>
  );
}
