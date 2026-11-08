/**
 * Habits page: two tabs.
 * - "Today": every active habit as a card (target, streak, 30-day completion,
 *   quick log with a note), edit / archive / reorder buttons, a "New habit"
 *   dialog and an archived section with restore / delete.
 * - "History": the last 14 days as a habits x days table.
 * Texts: 'habits.*'.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Habit, HabitDayStatus, HabitWithProgress } from '@shared/types';
import { formatTime } from '@shared/i18n';
import * as api from '@/api';
import { VisuallyHidden } from '@/components/a11y/VisuallyHidden';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageTitle } from '@/components/ui/PageTitle';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Spinner } from '@/components/ui/Spinner';
import { Tabs } from '@/components/ui/Tabs';
import { T } from '@/constants/texts';
import { useAnnouncer } from '@/context/AnnouncerContext';
import { useToast } from '@/context/ToastContext';
import { NeedsConnectionHint } from '@/components/sync/NeedsConnection';
import { PartialViewHint } from '@/components/sync/PartialViewHint';
import { useOfflineNow } from '@/components/sync/hooks';
import { drainBeforeOnlineWrite, savedOnDevice, showSavedOnDevice } from '@/components/sync/syncGate';
import { useApi } from '@/hooks/useApi';
import { isPendingRecord, offline } from '@/offline';
import { getCurrentLocale, tr } from '@/i18n/runtime';
import { addDays, dateRange, formatDayMonth, isValidTime, todayIso, weekdayShort } from '@/utils/dates';
import { errorMessage } from '@/utils/errors';
import { formatNumber, formatPercent } from '@/utils/format';
import { HABIT_FORM_TEXTS, HabitFormDialog } from './habits/HabitFormDialog';
import { HabitQuickLog } from './habits/HabitQuickLog';
import { completionText, frequencyLabel, streakText, targetText } from './habits/habit-text';

export const HABITS_TEXTS = {
  get title() {
    return tr('habits.title');
  },
  get tabsLabel() {
    return tr('habits.tabsLabel');
  },
  get tabToday() {
    return tr('habits.tab.today');
  },
  get tabHistory() {
    return tr('habits.tab.history');
  },
  get edit() {
    return tr('habits.action.edit');
  },
  get archive() {
    return tr('habits.action.archive');
  },
  get restore() {
    return tr('habits.action.restore');
  },
  get delete() {
    return tr('habits.action.delete');
  },
  get moveUp() {
    return tr('habits.action.moveUp');
  },
  get moveDown() {
    return tr('habits.action.moveDown');
  },
  get activeList() {
    return tr('habits.activeList');
  },
  archivedSection: (n: number) => tr('habits.archivedSection', { count: n }),
  get noActiveTitle() {
    return tr('habits.empty.title');
  },
  get noActiveText() {
    return tr('habits.empty.text');
  },
  get historyCaption() {
    return tr('habits.history.caption');
  },
  get historyEmpty() {
    return tr('habits.history.empty');
  },
  get habitColumn() {
    return tr('habits.history.habitColumn');
  },
  /** "Reminder: 09:00" - the time is rendered in the language's clock format. */
  reminder: (time: string) => tr('habits.card.reminder', { time: isValidTime(time) ? formatTime(getCurrentLocale(), time) : time }),
  /** "Target: 8 glasses per day (daily)" + optional " · Reminder: 09:00". */
  targetLine: (habit: Habit) => {
    const params = { target: targetText(habit), frequency: frequencyLabel(habit.frequency) };
    return habit.reminderEnabled && habit.reminderTime
      ? tr('habits.card.targetLineWithReminder', { ...params, reminder: HABITS_TEXTS.reminder(habit.reminderTime) })
      : tr('habits.card.targetLine', params);
  },
  completionLabel: (name: string) => tr('habits.card.completionLabel', { name }),
  created: (name: string) => tr('habits.toast.created', { name }),
  updated: (name: string) => tr('habits.toast.updated', { name }),
  archived: (name: string) => tr('habits.toast.archived', { name }),
  restored: (name: string) => tr('habits.toast.restored', { name }),
  deleted: (name: string) => tr('habits.toast.deleted', { name }),
  reordered: (name: string, position: number) => tr('habits.reordered', { name, position }),
  deleteTitle: (name: string) => tr('habits.delete.title', { name }),
  get deleteMessage() {
    return tr('habits.delete.message');
  },
} as const;

type TabId = 'today' | 'history';
const HISTORY_DAYS = 14;
/** Ids used to move keyboard focus after an action removes the button that had it. */
const ARCHIVED_SUMMARY_ID = 'habits-archived-summary';
const PAGE_TITLE_ID = 'page-title';
const habitTitleId = (id: number) => `habit-${id}-title`;

/**
 * Cell text for the history table: "✓ 8" when completed, the amount when partial, "–" otherwise.
 * A weekly habit is completed per week, not per day: its days show the amount only.
 */
export function historyCellText(status: HabitDayStatus | undefined, weekly = false): string {
  if (!status || (status.value === 0 && !status.completed)) return '–';
  return status.completed && !weekly ? `✓ ${formatNumber(status.value)}` : formatNumber(status.value);
}

export default function HabitsPage() {
  const toast = useToast();
  const { announce } = useAnnouncer();
  const [today] = useState(() => todayIso());
  const [tab, setTab] = useState<TabId>('today');
  const [dialog, setDialog] = useState<{ open: boolean; habit: Habit | null }>({ open: false, habit: null });
  const [deleteTarget, setDeleteTarget] = useState<Habit | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  // Archive / restore / delete remove the pressed button from the page; focus then moves here
  // (once the reloaded lists are rendered) instead of falling back to <body>.
  const [focusTarget, setFocusTarget] = useState<string | null>(null);

  const historyFrom = addDays(today, -(HISTORY_DAYS - 1));
  const progress = useApi(() => api.habits.progress(today), [today], { offline: true });
  const allHabits = useApi(() => api.habits.list(true), [], { offline: true });
  const history = useApi(() => api.habits.status(historyFrom, today), [historyFrom, today], { enabled: tab === 'history', offline: true });
  // Offline mode without a connection: deleting and reordering habits need the server (section 6.2).
  const offlineNow = useOfflineNow();
  const onlineOnlyHintId = 'habits-needs-connection';
  const drainNotify = { onDraining: (m: string) => toast.info(m), onLeft: (m: string) => toast.error(m) };

  const reloadAll = useCallback(async () => {
    await Promise.all([progress.reload(), allHabits.reload(), tab === 'history' ? history.reload() : Promise.resolve()]);
  }, [progress, allHabits, history, tab]);

  const active: HabitWithProgress[] = useMemo(() => progress.data ?? [], [progress.data]);
  const archived: Habit[] = useMemo(() => (allHabits.data ?? []).filter((h) => h.isArchived), [allHabits.data]);

  useEffect(() => {
    if (!focusTarget) return;
    const el = document.getElementById(focusTarget);
    if (!el) return;
    el.focus();
    setFocusTarget(null);
  }, [focusTarget, progress.data, allHabits.data]);

  /** Runs a mutation with a per-habit busy flag and a toast on success/failure; `focusAfter` is the id to focus afterwards. */
  const runAction = async (habitId: number, action: () => Promise<unknown>, successMessage: string, focusAfter: string) => {
    if (busyId !== null) return;
    setBusyId(habitId);
    try {
      const result = await action();
      if (savedOnDevice(result, { kind: 'habit', id: habitId })) showSavedOnDevice((message) => toast.info(message));
      else toast.success(successMessage);
      await reloadAll();
      setFocusTarget(focusAfter);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= active.length) return;
    const ids = active.map((p) => p.habit.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    const name = active[index].habit.name;
    if (busyId !== null || offlineNow) return;
    setBusyId(active[index].habit.id);
    try {
      // An online-only write: what waits on this device is uploaded first (section 4.3).
      if (!(await drainBeforeOnlineWrite(drainNotify))) return;
      // A habit created on this device is known to the server by its id from the upload.
      const serverIds = ids.map((id) => (id > 0 ? id : offline.serverIdOf(id)));
      if (serverIds.some((id) => id === null)) {
        toast.error(tr('shell.sync.drainFailed'));
        return;
      }
      await api.habits.reorder(serverIds as number[]);
      announce(HABITS_TEXTS.reordered(name, target + 1), 'polite');
      await reloadAll();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget || offlineNow) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      if (!(await drainBeforeOnlineWrite(drainNotify))) return;
      const serverId = deleteTarget.id > 0 ? deleteTarget.id : offline.serverIdOf(deleteTarget.id);
      if (serverId === null) {
        setDeleteError(tr('shell.sync.drainFailed'));
        return;
      }
      await api.habits.remove(serverId);
      toast.success(HABITS_TEXTS.deleted(deleteTarget.name));
      setDeleteTarget(null);
      await reloadAll();
      setFocusTarget(archived.length > 1 ? ARCHIVED_SUMMARY_ID : PAGE_TITLE_ID);
    } catch (e) {
      setDeleteError(errorMessage(e));
    } finally {
      setDeleteBusy(false);
    }
  };

  const todayPanel = (
    <div className="stack">
      {progress.loading && !progress.data && <Spinner block size="lg" />}
      {progress.error && (
        <Alert kind="error">
          <p>{progress.error}</p>
          <Button variant="secondary" size="sm" onClick={() => void progress.reload()}>
            {T.retry}
          </Button>
        </Alert>
      )}
      {/* Offline mode: a list put together from cached habits (never cached as such) says so (section 4.6). */}
      <PartialViewHint value={progress.data} />
      {progress.data && active.length === 0 && (
        <EmptyState
          title={HABITS_TEXTS.noActiveTitle}
          text={HABITS_TEXTS.noActiveText}
          action={<Button onClick={() => setDialog({ open: true, habit: null })}>{HABIT_FORM_TEXTS.newTitle}</Button>}
        />
      )}
      {active.length > 0 && <NeedsConnectionHint id={onlineOnlyHintId} />}
      {active.length > 0 && (
        <ul className="stack" aria-label={HABITS_TEXTS.activeList}>
          {active.map((item, index) => {
            const { habit } = item;
            const busy = busyId === habit.id;
            const first = index === 0;
            const last = index === active.length - 1;
            return (
              <li key={habit.id}>
                <Card
                  as="article"
                  aria-labelledby={habitTitleId(habit.id)}
                  title={
                    <span id={habitTitleId(habit.id)} tabIndex={-1}>
                      <bdi>{habit.name}</bdi>
                    </span>
                  }
                  actions={
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-disabled={first || offlineNow || undefined}
                        aria-describedby={offlineNow ? onlineOnlyHintId : undefined}
                        loading={busy}
                        onClick={() => void move(index, -1)}
                      >
                        {HABITS_TEXTS.moveUp}
                        {' '}
                        <VisuallyHidden>{habit.name}</VisuallyHidden>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-disabled={last || offlineNow || undefined}
                        aria-describedby={offlineNow ? onlineOnlyHintId : undefined}
                        loading={busy}
                        onClick={() => void move(index, 1)}
                      >
                        {HABITS_TEXTS.moveDown}
                        {' '}
                        <VisuallyHidden>{habit.name}</VisuallyHidden>
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => setDialog({ open: true, habit })}>
                        {HABITS_TEXTS.edit}
                        {' '}
                        <VisuallyHidden>{habit.name}</VisuallyHidden>
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        loading={busy}
                        onClick={() => void runAction(habit.id, () => api.habits.archive(habit.id, true), HABITS_TEXTS.archived(habit.name), ARCHIVED_SUMMARY_ID)}
                      >
                        {HABITS_TEXTS.archive}
                        {' '}
                        <VisuallyHidden>{habit.name}</VisuallyHidden>
                      </Button>
                    </>
                  }
                >
                  {habit.description && (
                    <p className="user-text" dir="auto">
                      {habit.description}
                    </p>
                  )}
                  <p>{HABITS_TEXTS.targetLine(habit)}</p>
                  <p>
                    {streakText(item)}
                    {(isPendingRecord(item.today) || isPendingRecord(habit) || offline.hasPending('habit', habit.id)) && (
                      <span className="text-muted"> · {tr('shell.sync.updatesWhenOnline')}</span>
                    )}
                  </p>
                  <p>{completionText(item)}</p>
                  <ProgressBar value={item.completionRate30 * 100} max={100} label={HABITS_TEXTS.completionLabel(habit.name)} valueText={formatPercent(item.completionRate30)} />
                  <HabitQuickLog item={item} date={today} onChanged={reloadAll} withNote idPrefix={`habit-${habit.id}`} />
                </Card>
              </li>
            );
          })}
        </ul>
      )}
      {archived.length > 0 && (
        <details className="card">
          <summary id={ARCHIVED_SUMMARY_ID}>{HABITS_TEXTS.archivedSection(archived.length)}</summary>
          <NeedsConnectionHint id={`${onlineOnlyHintId}-archived`} />
          <ul className="stack-sm">
            {archived.map((habit) => {
              const busy = busyId === habit.id;
              return (
                <li key={habit.id} className="cluster cluster--between">
                  <span>
                    <strong>
                      <bdi>{habit.name}</bdi>
                    </strong>{' '}
                    · {targetText(habit)}
                  </span>
                  <span className="cluster">
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={busy}
                      onClick={() => void runAction(habit.id, () => api.habits.archive(habit.id, false), HABITS_TEXTS.restored(habit.name), habitTitleId(habit.id))}
                    >
                      {HABITS_TEXTS.restore}
                      {' '}
                      <VisuallyHidden>{habit.name}</VisuallyHidden>
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={offlineNow}
                      aria-describedby={offlineNow ? onlineOnlyHintId : undefined}
                      onClick={() => {
                        setDeleteError(null);
                        setDeleteTarget(habit);
                      }}
                    >
                      {HABITS_TEXTS.delete}
                      {' '}
                      <VisuallyHidden>{habit.name}</VisuallyHidden>
                    </Button>
                  </span>
                </li>
              );
            })}
          </ul>
        </details>
      )}
    </div>
  );

  const historyPanel = <HistoryTable from={historyFrom} to={today} statuses={history.data} loading={history.loading} error={history.error} onRetry={() => void history.reload()} active={active} />;

  return (
    <div className="stack">
      <PageTitle id={PAGE_TITLE_ID} title={HABITS_TEXTS.title} actions={<Button onClick={() => setDialog({ open: true, habit: null })}>{HABIT_FORM_TEXTS.newTitle}</Button>} />
      <Tabs
        label={HABITS_TEXTS.tabsLabel}
        value={tab}
        onChange={(id) => setTab(id as TabId)}
        tabs={[
          { id: 'today', label: HABITS_TEXTS.tabToday, panel: todayPanel },
          { id: 'history', label: HABITS_TEXTS.tabHistory, panel: historyPanel },
        ]}
      />
      <HabitFormDialog
        open={dialog.open}
        habit={dialog.habit}
        onClose={() => setDialog((d) => ({ ...d, open: false }))}
        onSaved={async (saved, mode) => {
          setDialog({ open: false, habit: null });
          if (savedOnDevice(saved, { kind: 'habit', id: saved.id })) showSavedOnDevice((message) => toast.info(message));
          else toast.success(mode === 'create' ? HABITS_TEXTS.created(saved.name) : HABITS_TEXTS.updated(saved.name));
          await reloadAll();
        }}
      />
      <ConfirmDialog
        open={deleteTarget !== null}
        title={deleteTarget ? HABITS_TEXTS.deleteTitle(deleteTarget.name) : ''}
        message={HABITS_TEXTS.deleteMessage}
        confirmLabel={T.delete}
        danger
        loading={deleteBusy}
        error={deleteError}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

interface HistoryTableProps {
  from: string;
  to: string;
  statuses: HabitDayStatus[] | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  active: HabitWithProgress[];
}

function HistoryTable({ from, to, statuses, loading, error, onRetry, active }: HistoryTableProps) {
  const days = useMemo(() => dateRange(from, to), [from, to]);
  const { rows, byKey } = useMemo(() => {
    const rowMap = new Map<number, string>();
    const weekly = new Set<number>();
    for (const item of active) {
      rowMap.set(item.habit.id, item.habit.name);
      if (item.habit.frequency === 'weekly') weekly.add(item.habit.id);
    }
    const lookup = new Map<string, HabitDayStatus>();
    for (const s of statuses ?? []) {
      if (!rowMap.has(s.habitId)) rowMap.set(s.habitId, s.habitName);
      lookup.set(`${s.habitId}|${s.date}`, s);
    }
    return { rows: [...rowMap.entries()].map(([habitId, habitName]) => ({ habitId, habitName, weekly: weekly.has(habitId) })), byKey: lookup };
  }, [statuses, active]);

  if (loading && !statuses) return <Spinner block size="lg" />;
  if (error) {
    return (
      <Alert kind="error">
        <p>{error}</p>
        <Button variant="secondary" size="sm" onClick={onRetry}>
          {T.retry}
        </Button>
      </Alert>
    );
  }
  if (!statuses) return null;
  if (rows.length === 0) return <EmptyState title={HABITS_TEXTS.historyEmpty} />;

  // The 14 day columns scroll sideways on a phone: the scroll box is a named, focusable region so
  // keyboard users can scroll it with the arrow keys.
  return (
    <div className="scroll-x" role="region" aria-labelledby="habits-history-caption" tabIndex={0}>
      <table className="habits-history">
        <caption id="habits-history-caption">{HABITS_TEXTS.historyCaption}</caption>
        <thead>
          <tr>
            <th scope="col">{HABITS_TEXTS.habitColumn}</th>
            {days.map((d) => (
              <th scope="col" key={d}>
                <span aria-hidden="true">{weekdayShort(d)}</span> {formatDayMonth(d)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.habitId}>
              <th scope="row">{row.habitName}</th>
              {days.map((d) => (
                <td key={d}>{historyCellText(byKey.get(`${row.habitId}|${d}`), row.weekly)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
