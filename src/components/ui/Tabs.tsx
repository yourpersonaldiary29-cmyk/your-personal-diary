/**
 * WAI-ARIA tabs with automatic activation: a roving tabindex on the tab
 * buttons, arrow keys (direction-aware for RTL), Home/End, and a single
 * tabpanel that is labelled by the active tab.
 */
import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cx } from './cx';

export interface TabDef {
  id: string;
  label: ReactNode;
  panel: ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  tabs: TabDef[];
  /** Id of the selected tab. */
  value: string;
  onChange: (id: string) => void;
  /** Accessible name of the tab list, e.g. "Period". */
  label: string;
  className?: string;
}

function isRtl(el: HTMLElement | null): boolean {
  const dirEl = el?.closest('[dir]');
  const dir = dirEl?.getAttribute('dir') ?? document.documentElement.dir;
  return dir === 'rtl';
}

export function Tabs({ tabs, value, onChange, label, className }: TabsProps) {
  const base = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const tabId = (id: string) => `${base}-tab-${id}`;
  const panelId = (id: string) => `${base}-panel-${id}`;
  const active = tabs.find((t) => t.id === value) ?? tabs[0];

  const focusAndSelect = (index: number) => {
    const enabled = tabs.filter((t) => !t.disabled);
    if (enabled.length === 0) return;
    const wrapped = ((index % enabled.length) + enabled.length) % enabled.length;
    const target = enabled[wrapped];
    onChange(target.id);
    // getElementById copes with the special characters useId produces.
    document.getElementById(tabId(target.id))?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const enabled = tabs.filter((t) => !t.disabled);
    const current = enabled.findIndex((t) => t.id === value);
    const rtl = isRtl(listRef.current);
    const next = rtl ? 'ArrowLeft' : 'ArrowRight';
    const prev = rtl ? 'ArrowRight' : 'ArrowLeft';
    switch (e.key) {
      case next:
        e.preventDefault();
        focusAndSelect(current + 1);
        break;
      case prev:
        e.preventDefault();
        focusAndSelect(current - 1);
        break;
      case 'Home':
        e.preventDefault();
        focusAndSelect(0);
        break;
      case 'End':
        e.preventDefault();
        focusAndSelect(enabled.length - 1);
        break;
      default:
        break;
    }
  };

  return (
    <div className={cx('tabs', className)}>
      <div ref={listRef} role="tablist" aria-label={label} className="tabs__list" onKeyDown={onKeyDown}>
        {tabs.map((t) => {
          const selected = active?.id === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={tabId(t.id)}
              className="tabs__tab"
              aria-selected={selected}
              aria-controls={panelId(t.id)}
              tabIndex={selected ? 0 : -1}
              disabled={t.disabled}
              onClick={() => onChange(t.id)}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      {active && (
        <div role="tabpanel" id={panelId(active.id)} aria-labelledby={tabId(active.id)} className="tabs__panel" tabIndex={0}>
          {active.panel}
        </div>
      )}
    </div>
  );
}
