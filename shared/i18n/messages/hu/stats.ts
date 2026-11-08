/** hu - stats messages. Keys are prefixed 'stats.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Statistics page (src/pages/StatsPage.tsx) ----------------------------------------
  'stats.title': 'Statisztika',
  'stats.period': 'Időszak',
  'stats.movingAvg': 'Mozgóátlag (7 nap)',
  'stats.overTime': '{label} időbeli alakulása',
  'stats.weekday.section': 'A hét napjai szerint',
  'stats.weekday.chart': 'Átlagok a hét napjai szerint',
  'stats.weekday.axis': 'A hét napja',
  'stats.habits.section': 'Szokások',
  'stats.habits.chart': '{name} – napi értékek',
  'stats.habits.empty': 'Ebben az időszakban nincs rögzített szokás.',
  'stats.habits.summary':
    'Teljesítés: {percent} ({completed}/{frequency, select, weekly {{total, plural, one {# hét} other {# hét}}} other {{total, plural, one {# nap} other {# nap}}}}), jelenlegi sorozat: {current}, legjobb: {best}',
  'stats.empty.title': 'Ehhez az időszakhoz még nincs adat',
  'stats.empty.text': 'Írj bejegyzéseket és rögzítsd a szokásaidat, hogy itt grafikonok és trendek jelenjenek meg.',
  'stats.newEntry': 'Új bejegyzés',
  'stats.noValues': 'Ebben az időszakban nincs adat.',
  'stats.overview':
    '{entries, plural, one {# bejegyzés} other {# bejegyzés}} {days, plural, one {# napon} other {# napon}} ({from} – {to})',

  // Series summary under every chart -------------------------------------------------
  'stats.summary.base': 'Átlag: {mean} ({sample}, minimum: {min}, maximum: {max}).',
  'stats.summary.sampleDays': '{count, plural, one {# nap} other {# nap}}',
  'stats.summary.sampleValues': '{count, plural, one {# érték} other {# érték}}',
  'stats.summary.noChange': 'Nincs változás az előző időszakhoz képest ({previous}).',
  'stats.summary.change': 'Az előző időszakban: {previous} ({diff}).',
  'stats.summary.sentences': '{summary} {comparison}',
  'stats.summary.entriesPerDay': 'bejegyzés naponta',

  // Metric titles (chart sections; also the home page tiles) -------------------------
  'stats.metric.mood': 'Hangulat',
  'stats.metric.energy': 'Energiaszint',
  'stats.metric.stress': 'Stresszszint',
  'stats.metric.sleepHours': 'Alvásidő',
  'stats.metric.sleepQuality': 'Alvásminőség',
  'stats.metric.exerciseMinutes': 'Testmozgás',
  'stats.metric.entriesPerDay': 'Naplóbejegyzések',

  // Periods (pickers on the statistics and insights pages) ---------------------------
  'stats.period.7d': '7 nap',
  'stats.period.30d': '30 nap',
  'stats.period.3m': '3 hónap',
  'stats.period.6m': '6 hónap',
  'stats.period.1y': '1 év',
  'stats.period.all': 'Teljes időszak',
  'stats.period.in':
    '{period, select, 7d {az elmúlt 7 napban} 30d {az elmúlt 30 napban} 3m {az elmúlt 3 hónapban} 6m {az elmúlt 6 hónapban} 1y {az elmúlt évben} all {a teljes időszakban} other {a kiválasztott időszakban}}',

  // Charts (src/components/charts/chart-utils.ts) ------------------------------------
  'stats.chart.noData': 'Nincs megjeleníthető adat',
  'stats.chart.xAxisDate': 'Dátum',
  'stats.chart.valueWithUnit': '{value} {unit}',
  'stats.chart.pointTooltip': '{label}, {x}: {value}',
  'stats.chart.summary': '{label}: {count, plural, one {# érték} other {# érték}}, minimum: {min}, maximum: {max}, átlag: {mean}.',
  'stats.chart.summaryEmpty': '{label}: nincs adat.',
  'stats.chart.range': '{count, plural, one {Egy időpont: {from}.} other {# időpont, {from} – {to}.}}',
};
export default messages;
