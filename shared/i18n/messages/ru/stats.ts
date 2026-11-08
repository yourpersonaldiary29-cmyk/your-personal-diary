/** ru - stats messages. Keys are prefixed 'stats.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Statistics page (src/pages/StatsPage.tsx) ----------------------------------------
  'stats.title': 'Статистика',
  'stats.period': 'Период',
  'stats.movingAvg': 'Скользящее среднее (7 дней)',
  'stats.overTime': '{label}: динамика',
  'stats.weekday.section': 'По дням недели',
  'stats.weekday.chart': 'Средние по дням недели',
  'stats.weekday.axis': 'День недели',
  'stats.habits.section': 'Привычки',
  'stats.habits.chart': '{name} - значения по дням',
  'stats.habits.empty': 'В этом периоде нет отмеченных привычек.',
  // {frequency} is 'daily' | 'weekly'; {current}/{best} are formatted streaks ("5 days").
  // After "из" the counted noun is in the genitive: "из 1 недели", "из 3 недель", "из 21 дня".
  'stats.habits.summary':
    'Выполнение: {percent} ({completed} из {frequency, select, weekly {{total, plural, one {# недели} few {# недель} many {# недель} other {# недели}}} other {{total, plural, one {# дня} few {# дней} many {# дней} other {# дня}}}}), текущая серия: {current}, лучшая: {best}',
  'stats.empty.title': 'Для этого периода данных пока нет',
  'stats.empty.text': 'Пишите записи и отмечайте привычки, чтобы увидеть здесь графики и тенденции.',
  'stats.newEntry': 'Новая запись',
  'stats.noValues': 'В этом периоде нет данных.',
  'stats.overview':
    '{entries, plural, one {# запись} few {# записи} many {# записей} other {# записи}} за {days, plural, one {# день} few {# дня} many {# дней} other {# дня}} ({from} – {to})',

  // Series summary under every chart -------------------------------------------------
  'stats.summary.base': 'Среднее {mean} ({sample}, минимум {min}, максимум {max}).',
  'stats.summary.sampleDays': '{count, plural, one {# день} few {# дня} many {# дней} other {# дня}}',
  'stats.summary.sampleValues': '{count, plural, one {# значение} few {# значения} many {# значений} other {# значения}}',
  'stats.summary.noChange': 'Без изменений по сравнению с предыдущим периодом ({previous}).',
  'stats.summary.change': 'В предыдущем периоде: {previous} ({diff}).',
  'stats.summary.sentences': '{summary} {comparison}',
  // Unit after a (usually fractional) mean: "1,5 записи в день"
  'stats.summary.entriesPerDay': 'записи в день',

  // Metric titles (chart sections; also the home page tiles) -------------------------
  'stats.metric.mood': 'Настроение',
  'stats.metric.energy': 'Уровень энергии',
  'stats.metric.stress': 'Уровень стресса',
  'stats.metric.sleepHours': 'Часы сна',
  'stats.metric.sleepQuality': 'Качество сна',
  'stats.metric.exerciseMinutes': 'Физическая активность',
  'stats.metric.entriesPerDay': 'Записи в дневнике',

  // Periods (pickers on the statistics and insights pages) ---------------------------
  'stats.period.7d': '7 дней',
  'stats.period.30d': '30 дней',
  'stats.period.3m': '3 месяца',
  'stats.period.6m': '6 месяцев',
  'stats.period.1y': '1 год',
  'stats.period.all': 'За всё время',
  'stats.period.in':
    '{period, select, 7d {за последние 7 дней} 30d {за последние 30 дней} 3m {за последние 3 месяца} 6m {за последние 6 месяцев} 1y {за последний год} all {за всё время} other {за период}}',

  // Charts (src/components/charts/chart-utils.ts) ------------------------------------
  'stats.chart.noData': 'Нет данных для отображения',
  'stats.chart.xAxisDate': 'Дата',
  'stats.chart.valueWithUnit': '{value} {unit}',
  // Tooltip of one bar / marker: series label, x label (a date or a weekday), value with unit.
  'stats.chart.pointTooltip': '{label}, {x}: {value}',
  'stats.chart.summary':
    '{label}: {count, plural, one {# значение} few {# значения} many {# значений} other {# значения}}, минимум {min}, максимум {max}, среднее {mean}.',
  'stats.chart.summaryEmpty': '{label}: нет данных.',
  'stats.chart.range':
    '{count, plural, =1 {Одна точка: {from}.} one {# точка, с {from} по {to}.} few {# точки, с {from} по {to}.} many {# точек, с {from} по {to}.} other {# точки, с {from} по {to}.}}',
};
export default messages;
