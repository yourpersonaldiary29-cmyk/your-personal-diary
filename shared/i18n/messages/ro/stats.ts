/** ro - stats messages. Keys are prefixed 'stats.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Statistics page (src/pages/StatsPage.tsx) ----------------------------------------
  'stats.title': 'Statistici',
  'stats.period': 'Perioadă',
  'stats.movingAvg': 'Medie mobilă (7 zile)',
  'stats.overTime': '{label} în timp',
  'stats.weekday.section': 'Pe zile ale săptămânii',
  'stats.weekday.chart': 'Medii pe zile ale săptămânii',
  'stats.weekday.axis': 'Ziua săptămânii',
  'stats.habits.section': 'Obiceiuri',
  'stats.habits.chart': '{name} – valori zilnice',
  'stats.habits.empty': 'Niciun obicei cu înregistrări în această perioadă.',
  // {frequency} is 'daily' | 'weekly'; {current}/{best} are formatted streaks ("5 days").
  'stats.habits.summary':
    'Îndeplinire: {percent} ({completed} din {frequency, select, weekly {{total, plural, one {# săptămână} few {# săptămâni} other {# de săptămâni}}} other {{total, plural, one {# zi} few {# zile} other {# de zile}}}}), seria curentă: {current}, record: {best}',
  'stats.empty.title': 'Încă nu există date pentru această perioadă',
  'stats.empty.text': 'Scrie însemnări și înregistrează obiceiuri ca să vezi aici grafice și tendințe.',
  'stats.newEntry': 'Însemnare nouă',
  'stats.noValues': 'Nu există date în această perioadă.',
  'stats.overview': '{entries, plural, one {# însemnare} few {# însemnări} other {# de însemnări}} în {days, plural, one {# zi} few {# zile} other {# de zile}} ({from} – {to})',

  // Series summary under every chart -------------------------------------------------
  'stats.summary.base': 'Media {mean} ({sample}, minim {min}, maxim {max}).',
  'stats.summary.sampleDays': '{count, plural, one {# zi} few {# zile} other {# de zile}}',
  'stats.summary.sampleValues': '{count, plural, one {# valoare} few {# valori} other {# de valori}}',
  'stats.summary.noChange': 'Nicio schimbare față de perioada anterioară ({previous}).',
  'stats.summary.change': 'Comparativ cu {previous} în perioada anterioară ({diff}).',
  'stats.summary.sentences': '{summary} {comparison}',
  'stats.summary.entriesPerDay': 'însemnări pe zi',

  // Metric titles (chart sections; also the home page tiles) -------------------------
  'stats.metric.mood': 'Dispoziție',
  'stats.metric.energy': 'Nivel de energie',
  'stats.metric.stress': 'Nivel de stres',
  'stats.metric.sleepHours': 'Ore de somn',
  'stats.metric.sleepQuality': 'Calitatea somnului',
  'stats.metric.exerciseMinutes': 'Sport',
  'stats.metric.entriesPerDay': 'Însemnări în jurnal',

  // Periods (pickers on the statistics and insights pages) ---------------------------
  'stats.period.7d': '7 zile',
  'stats.period.30d': '30 de zile',
  'stats.period.3m': '3 luni',
  'stats.period.6m': '6 luni',
  'stats.period.1y': '1 an',
  'stats.period.all': 'Toată perioada',
  'stats.period.in':
    '{period, select, 7d {în ultimele 7 zile} 30d {în ultimele 30 de zile} 3m {în ultimele 3 luni} 6m {în ultimele 6 luni} 1y {în ultimul an} all {în toată perioada} other {în perioada aleasă}}',

  // Charts (src/components/charts/chart-utils.ts) ------------------------------------
  'stats.chart.noData': 'Nu există date de afișat',
  'stats.chart.xAxisDate': 'Data',
  'stats.chart.valueWithUnit': '{value} {unit}',
  // Tooltip of one bar / marker: series label, x label (a date or a weekday), value with unit.
  'stats.chart.pointTooltip': '{label}, {x}: {value}',
  'stats.chart.summary': '{label}: {count, plural, one {# valoare} few {# valori} other {# de valori}}, minim {min}, maxim {max}, media {mean}.',
  'stats.chart.summaryEmpty': '{label}: nu există date.',
  'stats.chart.range': '{count, plural, one {Un singur moment: {from}.} few {# momente, de la {from} până la {to}.} other {# de momente, de la {from} până la {to}.}}',
};
export default messages;
