/** ja - stats messages. Keys are prefixed 'stats.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Statistics page (src/pages/StatsPage.tsx) ----------------------------------------
  'stats.title': '統計',
  'stats.period': '期間',
  'stats.movingAvg': '移動平均（7日間）',
  'stats.overTime': '{label}の推移',
  'stats.weekday.section': '曜日別',
  'stats.weekday.chart': '曜日別の平均',
  'stats.weekday.axis': '曜日',
  'stats.habits.section': '習慣',
  'stats.habits.chart': '{name} - 日ごとの値',
  'stats.habits.empty': 'この期間に記録された習慣はありません。',
  // {frequency} is 'daily' | 'weekly'; {current}/{best} are formatted streaks ("5 days").
  'stats.habits.summary':
    '達成率：{percent}（{frequency, select, weekly {{total, plural, other {#週間}}中{completed}週} other {{total, plural, other {#日間}}中{completed}日}}）、現在の連続日数：{current}、最高：{best}',
  'stats.empty.title': 'この期間のデータはまだありません',
  'stats.empty.text': '記録を書いたり習慣を記録したりすると、ここにグラフや傾向が表示されます。',
  'stats.newEntry': '新しい記録',
  'stats.noValues': 'この期間のデータはありません。',
  'stats.overview': '{days, plural, other {#日}}で{entries, plural, other {#件の記録}}（{from}〜{to}）',

  // Series summary under every chart -------------------------------------------------
  'stats.summary.base': '平均{mean}（{sample}、最小{min}、最大{max}）。',
  'stats.summary.sampleDays': '{count, plural, other {#日分}}',
  'stats.summary.sampleValues': '{count, plural, other {#個の値}}',
  'stats.summary.noChange': '前の期間（{previous}）から変化はありません。',
  'stats.summary.change': '前の期間は{previous}でした（{diff}）。',
  'stats.summary.sentences': '{summary}{comparison}',
  'stats.summary.entriesPerDay': '件/日',

  // Metric titles (chart sections; also the home page tiles) -------------------------
  'stats.metric.mood': '気分',
  'stats.metric.energy': 'エネルギーレベル',
  'stats.metric.stress': 'ストレスレベル',
  'stats.metric.sleepHours': '睡眠時間',
  'stats.metric.sleepQuality': '睡眠の質',
  'stats.metric.exerciseMinutes': '運動',
  'stats.metric.entriesPerDay': '日記の記録',

  // Periods (pickers on the statistics and insights pages) ---------------------------
  'stats.period.7d': '7日間',
  'stats.period.30d': '30日間',
  'stats.period.3m': '3か月',
  'stats.period.6m': '6か月',
  'stats.period.1y': '1年',
  'stats.period.all': '全期間',
  'stats.period.in':
    '{period, select, 7d {過去7日間} 30d {過去30日間} 3m {過去3か月} 6m {過去6か月} 1y {過去1年間} all {全期間} other {この期間}}',

  // Charts (src/components/charts/chart-utils.ts) ------------------------------------
  'stats.chart.noData': '表示するデータがありません',
  'stats.chart.xAxisDate': '日付',
  'stats.chart.valueWithUnit': '{value}{unit}',
  // Tooltip of one bar / marker: series label, x label (a date or a weekday), value with unit.
  'stats.chart.pointTooltip': '{label}、{x}：{value}',
  'stats.chart.summary': '{label}：{count, plural, other {#個の値}}、最小{min}、最大{max}、平均{mean}。',
  'stats.chart.summaryEmpty': '{label}：データなし。',
  'stats.chart.range': '{count, plural, =1 {時点は1つ：{from}。} other {#時点、{from}から{to}まで。}}',
};
export default messages;
