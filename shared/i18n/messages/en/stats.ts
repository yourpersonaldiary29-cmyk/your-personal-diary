/** en - stats messages. Keys are prefixed 'stats.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Statistics page (src/pages/StatsPage.tsx) ----------------------------------------
  'stats.title': 'Statistics',
  'stats.period': 'Period',
  'stats.movingAvg': 'Moving average (7 days)',
  'stats.overTime': '{label} over time',
  'stats.weekday.section': 'By weekday',
  'stats.weekday.chart': 'Averages by weekday',
  'stats.weekday.axis': 'Weekday',
  'stats.habits.section': 'Habits',
  'stats.habits.chart': '{name} - daily values',
  'stats.habits.empty': 'No habits with logs in this period.',
  // {frequency} is 'daily' | 'weekly'; {current}/{best} are formatted streaks ("5 days").
  'stats.habits.summary':
    'Completion: {percent} ({completed} of {frequency, select, weekly {{total, plural, one {# week} other {# weeks}}} other {{total, plural, one {# day} other {# days}}}}), current streak: {current}, best: {best}',
  'stats.empty.title': 'No data for this period yet',
  'stats.empty.text': 'Write entries and log habits to see charts and trends here.',
  'stats.newEntry': 'New entry',
  'stats.noValues': 'No data in this period.',
  'stats.overview': '{entries, plural, one {# entry} other {# entries}} on {days, plural, one {# day} other {# days}} ({from} – {to})',

  // Series summary under every chart -------------------------------------------------
  'stats.summary.base': 'Mean {mean} ({sample}, minimum {min}, maximum {max}).',
  'stats.summary.sampleDays': '{count, plural, one {# day} other {# days}}',
  'stats.summary.sampleValues': '{count, plural, one {# value} other {# values}}',
  'stats.summary.noChange': 'No change from the previous period ({previous}).',
  'stats.summary.change': 'Compared with {previous} in the previous period ({diff}).',
  'stats.summary.sentences': '{summary} {comparison}',
  'stats.summary.entriesPerDay': 'entries per day',

  // Metric titles (chart sections; also the home page tiles) -------------------------
  'stats.metric.mood': 'Mood',
  'stats.metric.energy': 'Energy level',
  'stats.metric.stress': 'Stress level',
  'stats.metric.sleepHours': 'Sleep hours',
  'stats.metric.sleepQuality': 'Sleep quality',
  'stats.metric.exerciseMinutes': 'Exercise',
  'stats.metric.entriesPerDay': 'Diary entries',

  // Periods (pickers on the statistics and insights pages) ---------------------------
  'stats.period.7d': '7 days',
  'stats.period.30d': '30 days',
  'stats.period.3m': '3 months',
  'stats.period.6m': '6 months',
  'stats.period.1y': '1 year',
  'stats.period.all': 'All time',
  'stats.period.in':
    '{period, select, 7d {in the last 7 days} 30d {in the last 30 days} 3m {in the last 3 months} 6m {in the last 6 months} 1y {in the last year} all {over the whole period} other {in the period}}',

  // Charts (src/components/charts/chart-utils.ts) ------------------------------------
  'stats.chart.noData': 'No data to display',
  'stats.chart.xAxisDate': 'Date',
  'stats.chart.valueWithUnit': '{value} {unit}',
  // Tooltip of one bar / marker: series label, x label (a date or a weekday), value with unit.
  'stats.chart.pointTooltip': '{label}, {x}: {value}',
  'stats.chart.summary': '{label}: {count, plural, one {# value} other {# values}}, minimum {min}, maximum {max}, mean {mean}.',
  'stats.chart.summaryEmpty': '{label}: no data.',
  'stats.chart.range': '{count, plural, one {One time point: {from}.} other {# time points, from {from} to {to}.}}',
};
export default messages;
