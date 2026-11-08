/**
 * "Export" card: format (TXT/CSV/JSON/PDF), optional date range and whether to
 * include habits. Windows app: the server sends the file and the native "save as"
 * dialog of the shell saves it (`saveFileWithDialog`); browser: download; phone
 * (Android app): "Save to device" or "Share". Only the desktop's local-mode
 * developer build (`usesLocalFilePaths`) sends a path and lets its local server
 * write the file - the Your Personal Diary server refuses a path.
 */
import { useState } from 'react';
import type { ExportFormat, ExportRequest } from '@shared/types';
import { exportApi } from '@/api';
import { DateInput } from '@/components/forms/DateInput';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import { RadioGroup, type RadioOption } from '@/components/ui/RadioGroup';
import { useAnnouncer } from '@/context/AnnouncerContext';
import { tr } from '@/i18n/runtime';
import { todayIso } from '@/utils/dates';
import { getPhoneFiles, saveBlob, type PhoneFileTarget } from '@/utils/download';
import { errorMessage } from '@/utils/errors';
import { isTauri, pickSavePath, saveFileWithDialog, usesLocalFilePaths, type FileFilter } from '@/utils/platform';
import { ST } from './texts';

/** The offered formats, in display order. */
export const EXPORT_FORMATS: ExportFormat[] = ['txt', 'csv', 'json', 'pdf'];

/** Format radio options with labels and hints in the current UI language. */
export function exportFormatOptions(): RadioOption<ExportFormat>[] {
  return EXPORT_FORMATS.map((format) => ({ value: format, label: ST.exportFormatLabel(format), hint: ST.exportFormatHint(format) }));
}

/** Suggested export file name: your-personal-diary-export-<YYYY-MM-DD>.<ext> */
export function exportFileName(format: ExportFormat, isoDate: string = todayIso()): string {
  return `your-personal-diary-export-${isoDate}.${format}`;
}

/** Native dialog filter for an export format. */
export function exportFileFilter(format: ExportFormat): FileFilter {
  return { name: ST.exportFilterName(format), extensions: [format] };
}

/** The entry count the server reports on a download (`X-Entries-Exported`), or null when it is not readable. */
export function exportedCount(headers: Headers | undefined): number | null {
  const raw = headers?.get?.('X-Entries-Exported');
  if (raw === null || raw === undefined || raw.trim() === '') return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

/** Builds the request body; empty dates are omitted (exported for tests). */
export function buildExportRequest(format: ExportFormat, from: string, to: string, includeHabits: boolean): Omit<ExportRequest, 'destPath'> {
  const req: Omit<ExportRequest, 'destPath'> = { format, includeHabits };
  if (from) req.from = from;
  if (to) req.to = to;
  return req;
}

export function ExportSection() {
  const { announce } = useAnnouncer();
  const [format, setFormat] = useState<ExportFormat>('txt');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [includeHabits, setIncludeHabits] = useState(true);
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  // The CSV is one table of entries - the server never adds habits to it - so the habits box is
  // shown off and disabled, with a hint, while CSV is chosen (the choice returns with another format).
  const csvChosen = format === 'csv';
  // Phone: the file goes to the system dialog or the share sheet. `__MOBILE__` is a build-time
  // constant: false on the desktop (this folds to `null`), not defined under the root vitest config.
  const phoneFiles = typeof __MOBILE__ !== 'undefined' && __MOBILE__ ? getPhoneFiles() : null;
  const [target, setTarget] = useState<PhoneFileTarget | null>(null);

  const run = async (phoneTarget: PhoneFileTarget | null = null) => {
    if (busy) return;
    setError(null);
    setResult(null);
    setTarget(phoneTarget);
    if (from && to && from > to) {
      setRangeError(ST.exportRangeError);
      announce(ST.exportRangeError, 'assertive');
      document.getElementById('export-to')?.focus();
      return;
    }
    setRangeError(null);
    setBusy(true);
    try {
      const request = buildExportRequest(format, from, to, includeHabits && !csvChosen);
      let message: string;
      if (usesLocalFilePaths()) {
        // Local-mode developer build: the server on this computer writes the file at the chosen path.
        const destPath = await pickSavePath(exportFileName(format), [exportFileFilter(format)]);
        if (!destPath) {
          announce(ST.cancelled, 'polite');
          return;
        }
        const out = await exportApi.toPath({ ...request, destPath });
        message = ST.exportDoneWithFile(out.entriesExported, out.fileName);
      } else if (phoneFiles && phoneTarget) {
        const { blob, fileName } = await exportApi.download(request);
        const outcome = phoneTarget === 'save' ? await phoneFiles.save(blob, fileName) : await phoneFiles.share(blob, fileName);
        if (outcome === 'cancelled') {
          announce(ST.cancelled, 'polite');
          return;
        }
        message = tr(phoneTarget === 'save' ? 'mobile.files.saved' : 'mobile.files.shared', { fileName });
      } else {
        const { blob, fileName, headers } = await exportApi.download(request);
        let savedName = fileName;
        if (isTauri()) {
          // Windows app: the shell's "save as" dialog; the server never gets a path.
          let saved: string | null;
          try {
            saved = await saveFileWithDialog(blob, fileName, exportFileFilter(format));
          } catch {
            throw new Error(tr('server.export.saveFailed'));
          }
          if (saved === null) {
            announce(ST.cancelled, 'polite');
            return;
          }
          savedName = saved;
        } else {
          saveBlob(blob, fileName);
        }
        // The server reports the count in a header on downloads (exposed to the Windows app by CORS).
        const exported = exportedCount(headers);
        message = exported !== null ? ST.exportDoneWithFile(exported, savedName) : ST.exportDownloaded(savedName);
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
    <Card title={ST.exportSection}>
      <div className="stack">
        <p>{ST.exportExplanation}</p>
        {result && <Alert kind="success" role="none">{result}</Alert>}
        {error && <Alert kind="error" role="none">{error}</Alert>}
        <RadioGroup<ExportFormat> legend={ST.exportFormat} name="exportFormat" options={exportFormatOptions()} value={format} onChange={setFormat} />
        <div className="settings-grid">
          <DateInput id="export-from" label={ST.exportFrom} value={from} onChange={setFrom} max={to || undefined} hint={ST.exportRangeHint} />
          <DateInput id="export-to" label={ST.exportTo} value={to} onChange={setTo} min={from || undefined} error={rangeError} />
        </div>
        <Checkbox
          id="export-include-habits"
          label={ST.includeHabits}
          hint={csvChosen ? ST.includeHabitsCsv : undefined}
          checked={includeHabits && !csvChosen}
          disabled={csvChosen}
          onChange={setIncludeHabits}
        />
        <div className="form__actions">
          {phoneFiles ? (
            <>
              <Button loading={busy && target === 'save'} disabled={busy} onClick={() => void run('save')}>
                {tr('mobile.files.saveToDevice')}
              </Button>
              <Button variant="secondary" loading={busy && target === 'share'} disabled={busy} onClick={() => void run('share')}>
                {tr('mobile.files.share')}
              </Button>
            </>
          ) : (
            <Button loading={busy} onClick={() => void run()}>
              {ST.exportAction}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
