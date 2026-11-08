import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { holidayNote, holidaysOn, kindLabel, traditionLabel } from '@shared/calendars';
import { setCurrentLocale } from '@/i18n/runtime';
import { pinLocaleForTests } from '@/i18n/test-utils';
import { CalendarHolidayLegend, CX, DayHolidayList, HolidayBadge, HolidayBadges } from './CalendarExtras';

// The holiday names and labels below are asserted in Hebrew.
pinLocaleForTests('he');

describe('CalendarExtras subcomponents', () => {
  it('HolidayBadge shows the tradition mark and the name, with the full text as title when compact', () => {
    const [rosh] = holidaysOn('2026-09-12', ['jewish']);
    render(<HolidayBadge holiday={rosh} compact />);
    const badge = screen.getByText('ראש השנה').closest('.holiday-badge') as HTMLElement;
    expect(badge).toHaveAttribute('data-tradition', 'jewish');
    expect(badge).toHaveAttribute('title', 'ראש השנה (יום 1 מתוך 2) (יהודי)');
    expect(badge.querySelector('.holiday-badge__mark')).toHaveAttribute('aria-hidden', 'true');
    expect(badge).toHaveTextContent('✡');
  });

  it('HolidayBadges shows at most two badges plus "+N" naming the rest', () => {
    // 18 February 2026: ראש חודש אדר, תחילת רמדאן, יום רביעי של האפר.
    const holidays = holidaysOn('2026-02-18');
    expect(holidays).toHaveLength(3);
    const { container } = render(<HolidayBadges holidays={holidays} />);
    const badges = container.querySelectorAll('.holiday-badge--compact');
    expect(badges).toHaveLength(2);
    const more = screen.getByText(CX.more(1));
    expect(more).toHaveAttribute('title', CX.moreTitle(1, 'יום רביעי של האפר'));
    expect(more).toHaveAttribute('title', 'ועוד 1: יום רביעי של האפר');
    expect(container.querySelector('[data-tradition="jewish"]')).toBeInTheDocument();
    expect(container.querySelector('[data-tradition="muslim"]')).toBeInTheDocument();
  });

  it('HolidayBadges renders nothing for a day without holidays', () => {
    const { container } = render(<HolidayBadges holidays={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the names, the legend and the day list in English when the UI language is English', () => {
    setCurrentLocale('en');
    const [rosh] = holidaysOn('2026-09-12', ['jewish']);
    render(<HolidayBadge holiday={rosh} compact />);
    const badge = screen.getByText('Rosh Hashanah').closest('.holiday-badge') as HTMLElement;
    expect(badge).toHaveAttribute('title', 'Rosh Hashanah (day 1 of 2) (Jewish)');

    const { container } = render(<HolidayBadges holidays={holidaysOn('2026-02-18')} />);
    expect(container.querySelector('.holiday-badge--more')).toHaveAttribute('title', 'And 1 more: Ash Wednesday');

    render(<CalendarHolidayLegend system="hijri" traditions={['muslim', 'druze']} />);
    const legend = screen.getByRole('region', { name: 'Holiday legend' });
    expect(within(legend).getByText('Muslim holidays and observances')).toBeInTheDocument();
    expect(within(legend).getByText('Druze holidays and observances')).toBeInTheDocument();
    expect(within(legend).getByText(/Umm al-Qura/)).toBeInTheDocument();
    expect(CX.dayOf(1, 2)).toBe('Day 1 of 2');

    render(<DayHolidayList holidays={[rosh]} />);
    expect(screen.getByText('Jewish holidays and observances · Holiday · Day 1 of 2')).toBeInTheDocument();
  });

  it('CalendarHolidayLegend lists one sample badge per tradition of the system and the Umm al-Qura note for the Hijri calendar', () => {
    render(<CalendarHolidayLegend system="hijri" traditions={['muslim', 'druze']} />);
    const legend = screen.getByRole('region', { name: CX.legendTitle });
    for (const t of ['muslim', 'druze'] as const) {
      expect(within(legend).getByText(traditionLabel(t, 'he')).closest('.holiday-badge')).toHaveAttribute('data-tradition', t);
    }
    expect(within(legend).queryByText(traditionLabel('jewish', 'he'))).toBeNull();
    expect(within(legend).queryByText(traditionLabel('christian', 'he'))).toBeNull();
    expect(within(legend).getByText(CX.hijriNote)).toBeInTheDocument();
    expect(within(legend).queryByRole('note')).toBeNull();
  });

  it('CalendarHolidayLegend shows the notices, and no Umm al-Qura note outside the Hijri calendar', () => {
    render(<CalendarHolidayLegend system="gregorian" traditions={['christian']} notices={[CX.hebrewUnsupported]} />);
    const legend = screen.getByRole('region', { name: CX.legendTitle });
    expect(within(legend).getByText(traditionLabel('christian', 'he')).closest('.holiday-badge')).toHaveAttribute('data-tradition', 'christian');
    expect(within(legend).queryByText(CX.hijriNote)).toBeNull();
    expect(within(legend).getByRole('note')).toHaveTextContent(CX.hebrewUnsupported);
  });

  it('CalendarHolidayLegend renders nothing without traditions, notices or the Hijri note', () => {
    const { container } = render(<CalendarHolidayLegend system="gregorian" traditions={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('DayHolidayList shows the tradition, the kind, the day index and the note of each holiday', () => {
    const holidays = holidaysOn('2026-02-18');
    render(<DayHolidayList holidays={holidays} />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(3);
    const ramadanHoliday = holidays.find((h) => h.name === 'תחילת רמדאן')!;
    const ramadan = items.find((li) => li.textContent?.includes('תחילת רמדאן')) as HTMLElement;
    expect(ramadan).toHaveTextContent(`${traditionLabel('muslim', 'he')} · ${kindLabel(ramadanHoliday.kind, 'he')}`);
    expect(ramadan).toHaveTextContent(holidayNote(ramadanHoliday, 'he')!);

    const [rosh] = holidaysOn('2026-09-12', ['jewish']);
    render(<DayHolidayList holidays={[rosh]} />);
    expect(screen.getByText(`${traditionLabel('jewish', 'he')} · ${kindLabel('major', 'he')} · ${CX.dayOf(1, 2)}`)).toBeInTheDocument();
  });
});
