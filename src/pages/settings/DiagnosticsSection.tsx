/**
 * "Diagnostics" card (desktop only): versions, port and network status of the
 * local server, the tail of its log (Tauri command `get_server_log`) and a
 * confirmed restart (`restart_server`). After a restart the page reloads so
 * the API client re-discovers the port.
 */
import { useId, useState } from 'react';
import { APP_VERSION } from '@shared/constants';
import { server as serverApi } from '@/api';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DefinitionList } from '@/components/ui/DefinitionList';
import { Spinner } from '@/components/ui/Spinner';
import { useAnnouncer } from '@/context/AnnouncerContext';
import { useApi } from '@/hooks/useApi';
import { formatTimestamp } from '@/utils/dates';
import { errorMessage } from '@/utils/errors';
import { ST } from './texts';

/** Delay before reloading the UI after a restart (lets the sidecar spawn). */
export const RELOAD_AFTER_RESTART_MS = 1500;

async function tauriInvoke<R>(command: string): Promise<R> {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<R>(command);
}

export function DiagnosticsSection() {
  const { announce } = useAnnouncer();
  const logId = useId();
  const info = useApi(() => serverApi.info(), []);
  const [log, setLog] = useState<string[] | null>(null);
  const [logBusy, setLogBusy] = useState(false);
  const [restartOpen, setRestartOpen] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleLog = async () => {
    if (logBusy) return;
    if (log) {
      setLog(null);
      return;
    }
    setLogBusy(true);
    setError(null);
    try {
      const lines = await tauriInvoke<string[]>('get_server_log');
      const list = Array.isArray(lines) ? lines : [];
      setLog(list);
      announce(list.length ? ST.serverLogLoaded(list.length) : ST.serverLogEmpty, 'polite');
    } catch (e) {
      const message = errorMessage(e, ST.serverLogFailed);
      setError(message);
      announce(message, 'assertive');
    } finally {
      setLogBusy(false);
    }
  };

  const restart = async () => {
    if (restarting) return;
    setRestarting(true);
    setError(null);
    try {
      await tauriInvoke<void>('restart_server');
      announce(ST.restarting, 'assertive');
      window.setTimeout(() => window.location.reload(), RELOAD_AFTER_RESTART_MS);
    } catch (e) {
      const message = errorMessage(e, ST.restartFailed);
      setRestartOpen(false);
      setRestarting(false);
      setError(message);
      announce(message, 'assertive');
    }
  };

  const data = info.data;

  return (
    <Card
      title={ST.diagnostics}
      actions={
        <>
          <Button variant="secondary" loading={logBusy} aria-expanded={!!log} aria-controls={logId} onClick={() => void toggleLog()}>
            {log ? ST.hideServerLog : ST.showServerLog}
          </Button>
          <Button variant="secondary" onClick={() => setRestartOpen(true)}>
            {ST.restartServer}
          </Button>
        </>
      }
    >
      <div className="stack">
        <p className="text-muted">{ST.diagnosticsHint}</p>
        {error && <Alert kind="error" role="none">{error}</Alert>}
        {info.loading && <Spinner />}
        {info.error && <Alert kind="error">{info.error}</Alert>}
        {data && (
          <DefinitionList
            aria-label={ST.diagnostics}
            items={[
              { term: ST.uiVersion, value: <span className="ltr">{APP_VERSION}</span> },
              { term: ST.serverVersion, value: <span className="ltr">{data.version}</span> },
              { term: ST.serverPort, value: <span className="ltr">{String(data.port)}</span> },
              { term: ST.lanStatus, value: data.lanEnabled ? ST.lanOn : ST.lanOff },
              { term: ST.startedAt, value: data.startedAt ? formatTimestamp(data.startedAt) : null },
            ]}
          />
        )}
        {log && (
          <section id={logId} aria-label={ST.serverLog}>
            {log.length === 0 ? <p>{ST.serverLogEmpty}</p> : <pre className="server-log" tabIndex={0}>{log.join('\n')}</pre>}
          </section>
        )}
      </div>
      <ConfirmDialog
        open={restartOpen}
        title={ST.restartTitle}
        message={ST.restartMessage}
        confirmLabel={ST.restartConfirm}
        loading={restarting}
        onConfirm={restart}
        onCancel={() => setRestartOpen(false)}
      />
    </Card>
  );
}
