/** bg - stats messages. Keys are prefixed 'stats.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Statistics page (src/pages/StatsPage.tsx) ----------------------------------------
  'stats.title': 'Статистика',
  'stats.period': 'Период',
  'stats.movingAvg': 'Плъзгаща средна (7 дни)',
  'stats.overTime': '{label} във времето',
  'stats.weekday.section': 'По дни от седмицата',
  'stats.weekday.chart': 'Средни стойности по дни от седмицата',
  'stats.weekday.axis': 'Ден от седмицата',
  'stats.habits.section': 'Навици',
  'stats.habits.chart': '{name} - дневни стойности',
  'stats.habits.empty': 'Няма навици с отбелязвания в този период.',
  // {frequency} is 'daily' | 'weekly'; {current}/{best} are formatted streaks ("5 days").
  'stats.habits.summary':
    'Изпълнение: {percent} ({completed} от {frequency, select, weekly {{total, plural, one {# седмица} other {# седмици}}} other {{total, plural, one {# ден} other {# дни}}}}), текуща серия: {current}, най-добра: {best}',
  'stats.empty.title': 'Все още няма данни за този период',
  'stats.empty.text': 'Пишете записи и отбелязвайте навици, за да видите тук графики и тенденции.',
  'stats.newEntry': 'Нов запис',
  'stats.noValues': 'Няма данни за този период.',
  'stats.overview':
    '{entries, plural, one {# запис} other {# записа}} за {days, plural, one {# ден} other {# дни}} ({from} – {to})',

  // Series summary under every chart -------------------------------------------------
  'stats.summary.base': 'Средно {mean} ({sample}, минимум {min}, максимум {max}).',
  'stats.summary.sampleDays': '{count, plural, one {# ден} other {# дни}}',
  'stats.summary.sampleValues': '{count, plural, one {# стойност} other {# стойности}}',
  'stats.summary.noChange': 'Без промяна спрямо предходния период ({previous}).',
  'stats.summary.change': 'Спрямо {previous} в предходния период ({diff}).',
  'stats.summary.sentences': '{summary} {comparison}',
  'stats.summary.entriesPerDay': 'записа на ден',

  // Metric titles (chart sections; also the home page tiles) -------------------------
  'stats.metric.mood': 'Настроение',
  'stats.metric.energy': 'Ниво на енергия',
  'stats.metric.stress': 'Ниво на стрес',
  'stats.metric.sleepHours': 'Часове сън',
  'stats.metric.sleepQuality': 'Качество на съня',
  'stats.metric.exerciseMinutes': 'Физическа активност',
  'stats.metric.entriesPerDay': 'Записи в дневника',

  // Periods (pickers on the statistics and insights pages) ---------------------------
  'stats.period.7d': '7 дни',
  'stats.period.30d': '30 дни',
  'stats.period.3m': '3 месеца',
  'stats.period.6m': '6 месеца',
  'stats.period.1y': '1 година',
  'stats.period.all': 'За целия период',
  'stats.period.in':
    '{period, select, 7d {през последните 7 дни} 30d {през последните 30 дни} 3m {през последните 3 месеца} 6m {през последните 6 месеца} 1y {през последната година} all {за целия период} other {за периода}}',

  // Charts (src/components/charts/chart-utils.ts) ------------------------------------
  'stats.chart.noData': 'Няма данни за показване',
  'stats.chart.xAxisDate': 'Дата',
  'stats.chart.valueWithUnit': '{value} {unit}',
  // Tooltip of one bar / marker: series label, x label (a date or a weekday), value with unit.
  'stats.chart.pointTooltip': '{label}, {x}: {value}',
  'stats.chart.summary':
    '{label}: {count, plural, one {# стойност} other {# стойности}}, минимум {min}, максимум {max}, средно {mean}.',
  'stats.chart.summaryEmpty': '{label}: няма данни.',
  // Dates in bg end in "г."; the parentheses keep "г." and the final period apart.
  'stats.chart.range': '{count, plural, one {Една времева точка ({from}).} other {# времеви точки ({from} – {to}).}}',
};
export default messages;
