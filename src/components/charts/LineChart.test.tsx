import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { T } from '@/constants/texts';
import { setCurrentLocale } from '@/i18n/runtime';
import { pinLocaleForTests } from '@/i18n/test-utils';
import { NOT_REPORTED } from '@/utils/format';
import { LineChart } from './LineChart';
import { DataTableToggle } from './DataTableToggle';
import { BarChart } from './BarChart';
import {
  CHART_MIN_WIDTH,
  CHART_WIDTH,
  chartWidthFor,
  labelIndices,
  maxXLabels,
  niceTicks,
  noDataText,
  rangeText,
  seriesStats,
  summaryText,
  withUnit,
  xAxisDefaultLabel,
  xDomain,
  yAxis,
} from './chart-utils';

// The expectations below assert the Hebrew wording; the UI defaults to English.
pinLocaleForTests('he');

const series = [
  {
    label: 'מצב רוח',
    points: [
      { x: '2026-09-01', y: 6 },
      { x: '2026-09-02', y: null },
      { x: '2026-09-03', y: 8 },
      { x: '2026-09-04', y: 7 },
    ],
  },
  {
    label: 'אנרגיה',
    points: [
      { x: '2026-09-01', y: 5 },
      { x: '2026-09-02', y: 4 },
      { x: '2026-09-03', y: null },
      { x: '2026-09-04', y: 9 },
    ],
  },
];

describe('LineChart', () => {
  it('renders an SVG image named by the title and described by the summary', () => {
    render(<LineChart title="מצב רוח ואנרגיה" series={series} yMin={1} yMax={10} />);
    const img = screen.getByRole('img', { name: 'מצב רוח ואנרגיה' });
    expect(img.tagName.toLowerCase()).toBe('svg');
    expect(img).toHaveAccessibleDescription(/מצב רוח: 3 ערכים, מינימום 6, מקסימום 8, ממוצע 7\.0/);
    expect(img).toHaveAccessibleDescription(/אנרגיה: 3 ערכים, מינימום 4, מקסימום 9, ממוצע 6\.0/);
    expect(img).toHaveAccessibleDescription(/4 נקודות זמן, מ-1\.9 עד 4\.9/);
  });

  it('draws a marker per non-null point (nulls are gaps) and a legend with shape samples', () => {
    const { container } = render(<LineChart title="גרף" series={series} />);
    const svg = container.querySelector('svg.chart__svg') as SVGSVGElement;
    // Each marker carries a <title> tooltip: 3 + 3 non-null points.
    expect(svg.querySelectorAll('title')).toHaveLength(6);
    // The first series has one gap -> two line segments.
    const firstSeriesPaths = svg.querySelectorAll('[data-series="0"] path[fill="none"]');
    expect(firstSeriesPaths).toHaveLength(2);
    const legend = container.querySelector('.chart__legend') as HTMLElement;
    expect(within(legend).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['מצב רוח', 'אנרגיה']);
    expect(legend.querySelectorAll('svg')).toHaveLength(2);
  });

  it('shows the data as a table on demand, with caption, column headers and "לא דווח" for gaps', async () => {
    const user = userEvent.setup();
    render(<LineChart title="מצב רוח ואנרגיה" series={series} />);
    const toggle = screen.getByRole('button', { name: T.showAsTable });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveTextContent(T.hideTable);

    const table = screen.getByRole('table', { name: 'מצב רוח ואנרגיה' });
    const headers = within(table).getAllByRole('columnheader').map((th) => th.textContent);
    expect(headers).toEqual(['תאריך', 'מצב רוח', 'אנרגיה']);
    expect(within(table).getAllByRole('columnheader')[0]).toHaveAttribute('scope', 'col');
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(5);
    expect(within(rows[2]).getByRole('rowheader')).toHaveTextContent('2.9');
    expect(within(rows[2]).getAllByRole('cell').map((td) => td.textContent)).toEqual([NOT_REPORTED, '4']);

    await user.click(toggle);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('renders an empty state when there is no data', () => {
    render(<LineChart title="ריק" series={[{ label: 'מצב רוח', points: [{ x: '2026-09-01', y: null }] }]} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('אין נתונים להצגה')).toBeInTheDocument();
    expect(screen.getByText('מצב רוח: אין נתונים.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: T.showAsTable })).not.toBeInTheDocument();
  });
});

describe('DataTableToggle', () => {
  it('is collapsed by default and controls the table id', async () => {
    const user = userEvent.setup();
    render(<DataTableToggle caption="נתונים" columns={['יום', 'ערך']} rows={[['א', 1.25], ['ב', null]]} id="tbl" />);
    const button = screen.getByRole('button', { name: T.showAsTable });
    expect(button).toHaveAttribute('aria-controls', 'tbl');
    expect(document.getElementById('tbl')).toBeNull();
    await user.click(button);
    expect(document.getElementById('tbl')).not.toBeNull();
    expect(screen.getByText('1.3')).toBeInTheDocument();
    expect(screen.getByText(NOT_REPORTED)).toBeInTheDocument();
  });
});

describe('chart-utils', () => {
  it('xDomain keeps first-seen order across series', () => {
    expect(xDomain(series)).toEqual(['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04']);
  });

  it('seriesStats skips nulls', () => {
    expect(seriesStats(series[0].points)).toEqual({ count: 3, min: 6, max: 8, mean: 7 });
    expect(seriesStats([{ x: 'a', y: null }])).toEqual({ count: 0, min: null, max: null, mean: null });
    expect(summaryText('x', seriesStats([]), 'שעות')).toBe('x: אין נתונים.');
  });

  it('niceTicks produces sensible ticks', () => {
    expect(niceTicks(1, 10, 5, true)[0]).toBe(1);
    expect(niceTicks(1, 10, 5, true).at(-1)).toBe(10);
    const free = niceTicks(3.2, 7.9, 5, false);
    expect(free[0]).toBeLessThanOrEqual(3.2);
    expect(free.at(-1)).toBeGreaterThanOrEqual(7.9);
  });

  it('yAxis rounds a bound taken from the data out to a nice tick, so no label crowds the one below it', () => {
    const peak42 = [{ label: 'reading', points: [{ x: 'a', y: 9 }, { x: 'b', y: 42 }] }];
    // 0-based bars/lines (only yMin fixed): 0..50, never "40" with an extra "42" 2 units above it.
    expect(yAxis(peak42, 0)).toEqual({ ticks: [0, 10, 20, 30, 40, 50], lo: 0, hi: 50 });
    expect(yAxis(peak42, 0, undefined, true).ticks.at(-1)).toBe(50);
    // Both bounds fixed (ratings 1-10): the bounds stay exactly as given.
    const rating = yAxis([{ label: 'mood', points: [{ x: 'a', y: 3 }] }], 1, 10);
    expect([rating.lo, rating.hi, rating.ticks[0], rating.ticks.at(-1)]).toEqual([1, 10, 1, 10]);
    // No fixed bound: both ends come from the data, rounded out.
    const free = yAxis([{ label: 'x', points: [{ x: 'a', y: 3.2 }, { x: 'b', y: 7.9 }] }]);
    expect(free.lo).toBeLessThanOrEqual(3.2);
    expect(free.hi).toBeGreaterThanOrEqual(7.9);
    expect(free.ticks[0]).toBe(free.lo);
    expect(free.ticks.at(-1)).toBe(free.hi);
  });

  it('yAxis labels whole-number data (a habit done 0 or 1 times) with whole numbers only', () => {
    const doneOrNot = [{ label: 'exercise', points: [{ x: 'a', y: 0 }, { x: 'b', y: 1 }, { x: 'c', y: 1 }] }];
    expect(yAxis(doneOrNot, 0, undefined, true).ticks).toEqual([0, 1]);
    // Fractional data keeps its fine ticks.
    expect(yAxis([{ label: 'h', points: [{ x: 'a', y: 0 }, { x: 'b', y: 0.9 }] }], 0).ticks).toContain(0.2);
  });

  it('labelIndices always includes the first and last index', () => {
    const idx = labelIndices(30);
    expect(idx[0]).toBe(0);
    expect(idx.at(-1)).toBe(29);
    expect(idx.length).toBeLessThanOrEqual(9);
    expect(labelIndices(3)).toEqual([0, 1, 2]);
  });

  it('the chart texts follow the UI language', () => {
    expect(summaryText('מצב רוח', seriesStats(series[0].points))).toBe('מצב רוח: 3 ערכים, מינימום 6, מקסימום 8, ממוצע 7.0.');
    expect(rangeText(['a', 'b', 'c'], (x) => x)).toBe('3 נקודות זמן, מ-a עד c.');
    expect(rangeText(['a'], (x) => x)).toBe('נקודת זמן אחת: a.');

    setCurrentLocale('en');
    expect(summaryText('Mood', seriesStats(series[0].points))).toBe('Mood: 3 values, minimum 6, maximum 8, mean 7.0.');
    expect(summaryText('Sleep', seriesStats([{ x: 'a', y: 7.5 }]), 'hours')).toBe('Sleep: 1 value, minimum 7.5 hours, maximum 7.5 hours, mean 7.5 hours.');
    expect(summaryText('x', seriesStats([]))).toBe('x: no data.');
    expect(rangeText(['a', 'b', 'c'], (x) => x)).toBe('3 time points, from a to c.');
    expect(rangeText(['a'], (x) => x)).toBe('One time point: a.');
    expect(rangeText([], (x) => x)).toBe('');
    expect(withUnit('7.5', 'hours')).toBe('7.5 hours');
    expect(withUnit('7.5')).toBe('7.5');
    expect(noDataText()).toBe('No data to display');
    expect(xAxisDefaultLabel()).toBe('Date');
  });
});

describe('chart size on narrow screens', () => {
  it('draws at the box width (clamped) so the 12px labels are not shrunk on a phone', () => {
    expect(chartWidthFor(260)).toBe(260);
    expect(chartWidthFor(1000)).toBe(CHART_WIDTH);
    expect(chartWidthFor(100)).toBe(CHART_MIN_WIDTH);
    expect(chartWidthFor(0)).toBe(CHART_WIDTH);
    expect(chartWidthFor(Number.NaN)).toBe(CHART_WIDTH);
  });

  it('shows only as many x labels as fit, judged by the longest label', () => {
    // Desktop: 570 units of plot fit the usual 8 date labels.
    expect(maxXLabels(570, ['01/09', '30/09'])).toBe(8);
    // Phone: 190 units fit 4 dates, but all 7 short weekday names.
    expect(maxXLabels(190, ['01/09', '30/09'])).toBe(4);
    expect(maxXLabels(190, ['Sun', 'Mon', 'Wed'])).toBe(7);
    expect(maxXLabels(50, ['Wednesday'])).toBe(2);
  });

  describe('with a ResizeObserver', () => {
    const original = globalThis.ResizeObserver;
    let widthOf = 260;
    beforeEach(() => {
      globalThis.ResizeObserver = class {
        constructor(private readonly cb: ResizeObserverCallback) {}
        observe() {
          this.cb([], this as unknown as ResizeObserver);
        }
        unobserve() {}
        disconnect() {}
      } as unknown as typeof ResizeObserver;
      vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => widthOf);
    });
    afterEach(() => {
      globalThis.ResizeObserver = original;
      vi.restoreAllMocks();
    });

    it('uses the measured width for the viewBox and thins the date labels', () => {
      widthOf = 260;
      const month = Array.from({ length: 30 }, (_, i) => ({ x: `2026-09-${String(i + 1).padStart(2, '0')}`, y: (i % 9) + 1 }));
      const { container } = render(<LineChart title="מצב רוח" series={[{ label: 'מצב רוח', points: month }]} />);
      const svg = container.querySelector('svg.chart__svg') as SVGSVGElement;
      expect(svg.getAttribute('viewBox')).toBe('0 0 260 260');
      const xLabels = [...svg.querySelectorAll('text')].filter((t) => t.textContent?.includes('.9'));
      // Hebrew dates are short ("30.9"): five fit in the 190-unit plot, instead of the desktop eight.
      expect(xLabels.length).toBe(maxXLabels(260 - 54 - 16, ['30.9']));
      expect(xLabels.length).toBeLessThan(8);
      expect(xLabels.at(-1)?.textContent).toBe('30.9');
    });

    it('keeps the full x values in the table while the axis uses xTickFormatter', async () => {
      widthOf = 1000;
      const user = userEvent.setup();
      const week = ['ראשון', 'שני', 'שלישי'].map((x, i) => ({ x, y: i + 5 }));
      const { container } = render(
        <BarChart title="לפי יום" series={[{ label: 'מצב רוח', points: week }]} xLabelFormatter={(x) => x} xTickFormatter={(x) => x.slice(0, 1)} />,
      );
      const svg = container.querySelector('svg.chart__svg') as SVGSVGElement;
      expect(svg.getAttribute('viewBox')).toBe(`0 0 ${CHART_WIDTH} 260`);
      expect([...svg.querySelectorAll('text')].map((t) => t.textContent)).toEqual(expect.arrayContaining(['ר', 'ש']));
      await user.click(screen.getByRole('button', { name: T.showAsTable }));
      expect(screen.getByRole('rowheader', { name: 'שלישי' })).toBeInTheDocument();
    });
  });
});
