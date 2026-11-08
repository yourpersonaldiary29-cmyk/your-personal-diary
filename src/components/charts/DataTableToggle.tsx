/**
 * "Show as table" button that reveals the chart's data as a real <table> with a
 * <caption>, column headers (scope="col") and the first cell of every row as
 * a row header (scope="row"). null renders as "Not reported".
 */
import { useId, useState } from 'react';
import { T } from '@/constants/texts';
import { NOT_REPORTED, formatNumber } from '@/utils/format';
import { cx } from '@/components/ui/cx';

export interface DataTableToggleProps {
  /** Table caption (usually the chart title). */
  caption: string;
  /** Column headers; the first one describes the row header column. */
  columns: string[];
  /** One array per row; numbers are formatted, null -> "Not reported". */
  rows: (string | number | null)[][];
  /** Maximum decimals for numeric cells (default 1). */
  decimals?: number;
  /** Start expanded. */
  defaultOpen?: boolean;
  /** Called when the table is shown/hidden. */
  onToggle?: (open: boolean) => void;
  id?: string;
  className?: string;
}

function formatCell(cell: string | number | null, decimals: number): string {
  if (cell === null || cell === undefined) return NOT_REPORTED;
  if (typeof cell === 'number') return formatNumber(cell, decimals);
  return cell;
}

export function DataTableToggle({ caption, columns, rows, decimals = 1, defaultOpen = false, onToggle, id, className }: DataTableToggleProps) {
  const generated = useId();
  const tableId = id ?? `data-table-${generated}`;
  const [open, setOpen] = useState(defaultOpen);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    onToggle?.(next);
  };

  return (
    <div className={cx('chart__table-toggle', className)}>
      <button type="button" className="btn btn--secondary btn--sm" aria-expanded={open} aria-controls={tableId} onClick={toggle}>
        {open ? T.hideTable : T.showAsTable}
      </button>
      {open && (
        <div className="chart__table" id={tableId}>
          <table>
            <caption>{caption}</caption>
            <thead>
              <tr>
                {columns.map((c, i) => (
                  <th scope="col" key={i}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) =>
                    c === 0 ? (
                      <th scope="row" key={c}>
                        {formatCell(cell, decimals)}
                      </th>
                    ) : (
                      <td key={c}>{formatCell(cell, decimals)}</td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
