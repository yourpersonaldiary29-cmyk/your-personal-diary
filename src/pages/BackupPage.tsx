/**
 * Backup page ("/backup"): create an encrypted backup, restore from one, and
 * export the diary to a readable file (TXT/CSV/JSON/PDF).
 */
import { NeedsConnectionPage } from '@/components/sync/NeedsConnection';
import { useOfflineNow } from '@/components/sync/hooks';
import { PageTitle } from '@/components/ui/PageTitle';
import { BackupCreateSection } from './settings/BackupCreateSection';
import { ExportSection } from './settings/ExportSection';
import { RestoreSection } from './settings/RestoreSection';
import { ST } from './settings/texts';
import './settings/settings.css';

/**
 * Online only (docs/android-tasks/OFFLINE-DESIGN.md section 6.2): while the automatic offline mode runs
 * without a connection the page says "This needs a connection to the diary server." [Try again];
 * otherwise (and always while offline mode is off) it is the page as it was.
 */
export default function BackupPage() {
  const offlineNow = useOfflineNow();
  if (offlineNow) return <NeedsConnectionPage title={ST.backupTitle} />;
  return <BackupPageContent />;
}

function BackupPageContent() {
  return (
    <div className="settings-page stack">
      <PageTitle title={ST.backupTitle} />
      <BackupCreateSection />
      <RestoreSection />
      <ExportSection />
    </div>
  );
}
