/** de - stats messages. Keys are prefixed 'stats.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Statistics page (src/pages/StatsPage.tsx) ----------------------------------------
  'stats.title': 'Statistiken',
  'stats.period': 'Zeitraum',
  'stats.movingAvg': 'Gleitender Durchschnitt (7 Tage)',
  'stats.overTime': '{label} im Zeitverlauf',
  'stats.weekday.section': 'Nach Wochentag',
  'stats.weekday.chart': 'Durchschnittswerte nach Wochentag',
  'stats.weekday.axis': 'Wochentag',
  'stats.habits.section': 'Gewohnheiten',
  'stats.habits.chart': '{name} – Tageswerte',
  'stats.habits.empty': 'Keine erfassten Gewohnheiten in diesem Zeitraum.',
  // {frequency} is 'daily' | 'weekly'; {current}/{best} are formatted streaks ("5 days").
  'stats.habits.summary':
    'Erfüllung: {percent} ({completed} von {frequency, select, weekly {{total, plural, one {# Woche} other {# Wochen}}} other {{total, plural, one {# Tag} other {# Tagen}}}}), aktuelle Serie: {current}, Rekord: {best}',
  'stats.empty.title': 'Für diesen Zeitraum gibt es noch keine Daten',
  'stats.empty.text': 'Schreib Einträge und erfasse Gewohnheiten, um hier Diagramme und Trends zu sehen.',
  'stats.newEntry': 'Neuer Eintrag',
  'stats.noValues': 'Keine Daten in diesem Zeitraum.',
  'stats.overview': '{entries, plural, one {# Eintrag} other {# Einträge}} an {days, plural, one {# Tag} other {# Tagen}} ({from} – {to})',

  // Series summary under every chart -------------------------------------------------
  'stats.summary.base': 'Durchschnitt {mean} ({sample}, Minimum {min}, Maximum {max}).',
  'stats.summary.sampleDays': '{count, plural, one {# Tag} other {# Tage}}',
  'stats.summary.sampleValues': '{count, plural, one {# Wert} other {# Werte}}',
  'stats.summary.noChange': 'Keine Veränderung gegenüber dem vorherigen Zeitraum ({previous}).',
  'stats.summary.change': 'Im Vergleich zu {previous} im vorherigen Zeitraum ({diff}).',
  'stats.summary.sentences': '{summary} {comparison}',
  'stats.summary.entriesPerDay': 'Einträge pro Tag',

  // Metric titles (chart sections; also the home page tiles) -------------------------
  'stats.metric.mood': 'Stimmung',
  'stats.metric.energy': 'Energielevel',
  'stats.metric.stress': 'Stresslevel',
  'stats.metric.sleepHours': 'Schlafstunden',
  'stats.metric.sleepQuality': 'Schlafqualität',
  'stats.metric.exerciseMinutes': 'Sport',
  'stats.metric.entriesPerDay': 'Tagebucheinträge',

  // Periods (pickers on the statistics and insights pages) ---------------------------
  'stats.period.7d': '7 Tage',
  'stats.period.30d': '30 Tage',
  'stats.period.3m': '3 Monate',
  'stats.period.6m': '6 Monate',
  'stats.period.1y': '1 Jahr',
  'stats.period.all': 'Gesamter Zeitraum',
  'stats.period.in':
    '{period, select, 7d {in den letzten 7 Tagen} 30d {in den letzten 30 Tagen} 3m {in den letzten 3 Monaten} 6m {in den letzten 6 Monaten} 1y {im letzten Jahr} all {im gesamten Zeitraum} other {im Zeitraum}}',

  // Charts (src/components/charts/chart-utils.ts) ------------------------------------
  'stats.chart.noData': 'Keine Daten zum Anzeigen',
  'stats.chart.xAxisDate': 'Datum',
  'stats.chart.valueWithUnit': '{value} {unit}',
  // Tooltip of one bar / marker: series label, x label (a date or a weekday), value with unit.
  'stats.chart.pointTooltip': '{label}, {x}: {value}',
  'stats.chart.summary': '{label}: {count, plural, one {# Wert} other {# Werte}}, Minimum {min}, Maximum {max}, Durchschnitt {mean}.',
  'stats.chart.summaryEmpty': '{label}: keine Daten.',
  'stats.chart.range': '{count, plural, one {Ein Zeitpunkt: {from}.} other {# Zeitpunkte, von {from} bis {to}.}}',
};
export default messages;
