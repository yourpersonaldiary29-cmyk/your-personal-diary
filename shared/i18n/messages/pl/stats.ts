/** pl - stats messages. Keys are prefixed 'stats.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Statistics page (src/pages/StatsPage.tsx) ----------------------------------------
  'stats.title': 'Statystyki',
  'stats.period': 'Okres',
  'stats.movingAvg': 'Średnia krocząca (7 dni)',
  'stats.overTime': '{label} w czasie',
  'stats.weekday.section': 'Według dnia tygodnia',
  'stats.weekday.chart': 'Średnie według dnia tygodnia',
  'stats.weekday.axis': 'Dzień tygodnia',
  'stats.habits.section': 'Nawyki',
  'stats.habits.chart': '{name} – wartości dzienne',
  'stats.habits.empty': 'Brak nawyków z zapisami w tym okresie.',
  // {frequency} is 'daily' | 'weekly'; {current}/{best} are formatted streaks ("5 days").
  'stats.habits.summary':
    'Wykonanie: {percent} ({completed} z {frequency, select, weekly {{total, plural, one {# tygodnia} few {# tygodni} many {# tygodni} other {# tygodnia}}} other {{total, plural, one {# dnia} few {# dni} many {# dni} other {# dnia}}}}), obecna seria: {current}, najlepsza: {best}',
  'stats.empty.title': 'Brak danych dla tego okresu',
  'stats.empty.text': 'Dodawaj wpisy i zapisuj nawyki, aby zobaczyć tu wykresy i trendy.',
  'stats.newEntry': 'Nowy wpis',
  'stats.noValues': 'Brak danych w tym okresie.',
  'stats.overview':
    '{entries, plural, one {# wpis} few {# wpisy} many {# wpisów} other {# wpisu}} z {days, plural, one {# dnia} few {# dni} many {# dni} other {# dnia}} ({from} – {to})',

  // Series summary under every chart -------------------------------------------------
  'stats.summary.base': 'Średnia {mean} ({sample}, minimum {min}, maksimum {max}).',
  'stats.summary.sampleDays': '{count, plural, one {# dzień} few {# dni} many {# dni} other {# dnia}}',
  'stats.summary.sampleValues': '{count, plural, one {# wartość} few {# wartości} many {# wartości} other {# wartości}}',
  'stats.summary.noChange': 'Bez zmian względem poprzedniego okresu ({previous}).',
  'stats.summary.change': 'W porównaniu z {previous} w poprzednim okresie ({diff}).',
  'stats.summary.sentences': '{summary} {comparison}',
  'stats.summary.entriesPerDay': 'wpisy/dzień',

  // Metric titles (chart sections; also the home page tiles) -------------------------
  'stats.metric.mood': 'Nastrój',
  'stats.metric.energy': 'Poziom energii',
  'stats.metric.stress': 'Poziom stresu',
  'stats.metric.sleepHours': 'Godziny snu',
  'stats.metric.sleepQuality': 'Jakość snu',
  'stats.metric.exerciseMinutes': 'Aktywność fizyczna',
  'stats.metric.entriesPerDay': 'Wpisy w dzienniku',

  // Periods (pickers on the statistics and insights pages) ---------------------------
  'stats.period.7d': '7 dni',
  'stats.period.30d': '30 dni',
  'stats.period.3m': '3 miesiące',
  'stats.period.6m': '6 miesięcy',
  'stats.period.1y': '1 rok',
  'stats.period.all': 'Cały okres',
  'stats.period.in':
    '{period, select, 7d {w ostatnich 7 dniach} 30d {w ostatnich 30 dniach} 3m {w ostatnich 3 miesiącach} 6m {w ostatnich 6 miesiącach} 1y {w ostatnim roku} all {w całym okresie} other {w wybranym okresie}}',

  // Charts (src/components/charts/chart-utils.ts) ------------------------------------
  'stats.chart.noData': 'Brak danych do wyświetlenia',
  'stats.chart.xAxisDate': 'Data',
  'stats.chart.valueWithUnit': '{value} {unit}',
  // Tooltip of one bar / marker: series label, x label (a date or a weekday), value with unit.
  'stats.chart.pointTooltip': '{label}, {x}: {value}',
  'stats.chart.summary':
    '{label}: {count, plural, one {# wartość} few {# wartości} many {# wartości} other {# wartości}}, minimum {min}, maksimum {max}, średnia {mean}.',
  'stats.chart.summaryEmpty': '{label}: brak danych.',
  'stats.chart.range':
    '{count, plural, one {Jeden punkt w czasie: {from}.} few {# punkty w czasie, od {from} do {to}.} many {# punktów w czasie, od {from} do {to}.} other {# punktu w czasie, od {from} do {to}.}}',
};
export default messages;
