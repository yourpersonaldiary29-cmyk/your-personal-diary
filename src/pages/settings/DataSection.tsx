/**
 * "Data" card: demo data, offered only while the diary is empty. The card
 * stays away otherwise (it keeps its result message after loading). Deleting
 * the account lives in its own card at the very bottom of the page
 * (DeleteAccountSection); the privacy sentence and the phone-access switch
 * live in the Privacy card (PrivacySection).
 */
import { useState } from 'react';
import { entries as entriesApi, habits as habitsApi, settings as settingsApi } from '@/api';
import { Alert } from '@/components/ui/Alert';
import { NeedsConnectionHint } from '@/components/sync/NeedsConnection';
import { useOfflineNow } from '@/components/sync/hooks';
import { drainBeforeOnlineWrite } from '@/components/sync/syncGate';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useAnnouncer } from '@/context/AnnouncerContext';
import { useToast } from '@/context/ToastContext';
import { useApi } from '@/hooks/useApi';
import { errorMessage } from '@/utils/errors';
import { ST } from './texts';

/** True when the diary has neither entries nor habits (archived ones included). */
export async function diaryIsEmpty(): Promise<boolean> {
  const [page, habits] = await Promise.all([entriesApi.list({ limit: 1 }), habitsApi.list(true)]);
  return (page?.total ?? 0) === 0 && (Array.isArray(habits) ? habits.length : 0) === 0;
}

export function DataSection() {
  const toast = useToast();
  const { announce } = useAnnouncer();
  const empty = useApi(() => diaryIsEmpty(), []);

  const [seedOpen, setSeedOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedMessage, setSeedMessage] = useState<string | null>(null);
  const [seedError, setSeedError] = useState<string | null>(null);
  // Demo data needs the server (offline mode, section 6.2) and goes only after what waits on this device.
  const offlineNow = useOfflineNow();

  const seed = async () => {
    if (seeding || offlineNow) return;
    setSeeding(true);
    setSeedError(null);
    try {
      if (!(await drainBeforeOnlineWrite({ onDraining: (m) => toast.info(m), onLeft: (m) => toast.error(m) }))) {
        setSeedOpen(false);
        return;
      }
      const result = await settingsApi.seedDemo();
      const message = ST.seedDemoDone(result.entries, result.habits, result.habitLogs);
      setSeedOpen(false);
      empty.setData(false);
      setSeedMessage(message);
      announce(message, 'polite');
      toast.success(message, { announced: true });
    } catch (e) {
      const message = errorMessage(e);
      setSeedOpen(false);
      setSeedError(message);
      announce(message, 'assertive');
    } finally {
      setSeeding(false);
    }
  };

  if (empty.data !== true && !seedMessage && !seedError) return null;

  return (
    <Card title={ST.data}>
      <div className="stack">
        {seedMessage && <Alert kind="success">{seedMessage}</Alert>}
        {seedError && <Alert kind="error" role="none">{seedError}</Alert>}
        {empty.data === true && (
          <div className="stack-sm">
            <p className="text-muted">{ST.seedDemoMessage}</p>
            <div>
              <Button variant="secondary" disabled={offlineNow} aria-describedby={offlineNow ? 'settings-seed-needs-connection' : undefined} onClick={() => setSeedOpen(true)}>
                {ST.seedDemo}
              </Button>
              <NeedsConnectionHint id="settings-seed-needs-connection" />
            </div>
          </div>
        )}
      </div>
      <ConfirmDialog
        open={seedOpen}
        title={ST.seedDemoTitle}
        message={ST.seedDemoMessage}
        confirmLabel={ST.seedDemoConfirm}
        loading={seeding}
        onConfirm={seed}
        onCancel={() => setSeedOpen(false)}
      />
    </Card>
  );
}
