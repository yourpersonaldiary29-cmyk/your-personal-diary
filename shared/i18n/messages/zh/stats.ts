/** zh - stats messages. Keys are prefixed 'stats.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Statistics page (src/pages/StatsPage.tsx) ----------------------------------------
  'stats.title': '统计',
  'stats.period': '时间段',
  'stats.movingAvg': '移动平均（7 天）',
  'stats.overTime': '{label}随时间的变化',
  'stats.weekday.section': '按星期',
  'stats.weekday.chart': '按星期的平均值',
  'stats.weekday.axis': '星期',
  'stats.habits.section': '习惯',
  'stats.habits.chart': '{name} - 每日数值',
  'stats.habits.empty': '这段时间没有已记录的习惯。',
  // {frequency} is 'daily' | 'weekly'; {current}/{best} are formatted streaks ("5 days").
  'stats.habits.summary':
    '完成率：{percent}（{completed}/{frequency, select, weekly {{total, plural, other {# 周}}} other {{total, plural, other {# 天}}}}），当前连续：{current}，最佳：{best}',
  'stats.empty.title': '这段时间暂时还没有数据',
  'stats.empty.text': '写下记录并记录习惯，就能在这里看到图表和趋势。',
  'stats.newEntry': '新建记录',
  'stats.noValues': '这段时间没有数据。',
  'stats.overview': '{days, plural, other {# 天}}中共有 {entries, plural, other {# 条记录}}（{from} – {to}）',

  // Series summary under every chart -------------------------------------------------
  'stats.summary.base': '平均 {mean}（{sample}，最低 {min}，最高 {max}）。',
  'stats.summary.sampleDays': '{count, plural, other {# 天}}',
  'stats.summary.sampleValues': '{count, plural, other {# 个数值}}',
  'stats.summary.noChange': '与上一时间段（{previous}）相比没有变化。',
  'stats.summary.change': '上一时间段为 {previous}（{diff}）。',
  'stats.summary.sentences': '{summary}{comparison}',
  'stats.summary.entriesPerDay': '条记录/天',

  // Metric titles (chart sections; also the home page tiles) -------------------------
  'stats.metric.mood': '心情',
  'stats.metric.energy': '精力水平',
  'stats.metric.stress': '压力水平',
  'stats.metric.sleepHours': '睡眠时长',
  'stats.metric.sleepQuality': '睡眠质量',
  'stats.metric.exerciseMinutes': '运动',
  'stats.metric.entriesPerDay': '日记记录',

  // Periods (pickers on the statistics and insights pages) ---------------------------
  'stats.period.7d': '7 天',
  'stats.period.30d': '30 天',
  'stats.period.3m': '3 个月',
  'stats.period.6m': '6 个月',
  'stats.period.1y': '1 年',
  'stats.period.all': '全部时间',
  'stats.period.in':
    '{period, select, 7d {最近 7 天} 30d {最近 30 天} 3m {最近 3 个月} 6m {最近 6 个月} 1y {最近一年} all {在整个期间} other {在该时间段}}',

  // Charts (src/components/charts/chart-utils.ts) ------------------------------------
  'stats.chart.noData': '没有可显示的数据',
  'stats.chart.xAxisDate': '日期',
  'stats.chart.valueWithUnit': '{value} {unit}',
  // Tooltip of one bar / marker: series label, x label (a date or a weekday), value with unit.
  'stats.chart.pointTooltip': '{label}，{x}：{value}',
  'stats.chart.summary': '{label}：{count, plural, other {# 个数值}}，最低 {min}，最高 {max}，平均 {mean}。',
  'stats.chart.summaryEmpty': '{label}：无数据。',
  'stats.chart.range': '{count, plural, =1 {1 个时间点：{from}。} other {# 个时间点，从 {from} 到 {to}。}}',
};
export default messages;
