/** zh - insights messages. Keys are prefixed 'insights.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Insights page (src/pages/InsightsPage.tsx) ---------------------------------------
  'insights.title': '洞察',
  'insights.period': '时间段',
  'insights.refresh': '刷新',
  'insights.notesTitle': '未检查 / 数据不足',
  'insights.disclaimer': '这些洞察描述的是您数据中可能存在的关联，并不能证明因果关系，也不构成医疗建议。',
  'insights.empty.title': '这段时间暂时还没有洞察',
  'insights.empty.text':
    '要发现规律，这段时间内至少需要 {minDays} 天有数据，并且每个对比组（例如有运动和没运动的日子）至少需要 {minGroupSize} 天。请继续写日记，并记录心情、睡眠和活动。',
  'insights.newEntry': '新建记录',
  // {inPeriod} is 'stats.period.in' ("in the last 30 days"), {start}/{end} are short dates.
  'insights.summary': '{inPeriod}内有数据的天数：{count, plural, other {# 天}}（{start} – {end}）',
  'insights.found': '{count, plural, =0 {未发现洞察} other {发现 # 条洞察}}',

  // Section headings (src/pages/insights/insight-groups.ts) --------------------------
  'insights.group.trends': '趋势',
  'insights.group.habits': '习惯',
  'insights.group.sleepActivity': '睡眠与活动',
  'insights.group.daysHours': '日期与时段',
  'insights.group.emotionsPeople': '情绪与人',
  'insights.group.anomalies': '异常情况',
  'insights.group.other': '其他洞察',

  // Strength and direction badges ---------------------------------------------------
  'insights.strength.strong': '明显的规律',
  'insights.strength.moderate': '中等的规律',
  'insights.strength.weak': '微弱的规律',
  'insights.positive': '令人鼓舞',
  'insights.attention': '值得关注',

  // Insight card (src/pages/insights/InsightCard.tsx) --------------------------------
  'insights.card.why': '为什么会看到这条洞察？',
  'insights.card.evidenceCaption': '这条洞察背后的数据',
  'insights.card.relatedDays': '相关日期',
  'insights.card.period': '时间段：{start} – {end}',
  'insights.card.detail': '详情',
  'insights.card.value': '数值',
  'insights.card.daysExamined': '分析的天数',
  'insights.card.metric': '指标',
  'insights.card.correlation': '相关系数（r）',
  'insights.card.effectSize': '差异大小',
  'insights.card.groupRow': '{count, plural, other {# 天}}，平均 {mean}',
  'insights.card.groupRowNoMean': '{count, plural, other {# 天}}',

  // Home page (src/pages/HomePage.tsx, GET /api/home) --------------------------------
  'insights.home.title': '首页',
  'insights.home.newEntry': '新建记录',
  'insights.home.greetingLabel': '问候',
  'insights.home.today': '今天',
  'insights.home.weekAverages': '最近 7 天的平均值',
  'insights.home.habitsToday': '今天的习惯',
  'insights.home.insightOfDay': '今日洞察',
  'insights.home.lastEntry': '最新记录',
  'insights.home.noData': '暂无数据',
  'insights.home.noHabits': '没有进行中的习惯。',
  'insights.home.manageHabits': '管理习惯',
  'insights.home.allHabits': '所有习惯',
  'insights.home.allInsights': '所有洞察',
  'insights.home.noInsight': '暂时还没有洞察。继续写日记，并记录睡眠、心情和活动，就能发现其中的规律。',
  'insights.home.noEntriesTitle': '还没有日记记录',
  'insights.home.noEntriesText': '每一条洞察都始于第一条记录。写几句关于今天的话就够了。',
  'insights.home.firstEntry': '写下第一条记录',
  'insights.home.untitled': '无标题',
  'insights.home.streak': '连续写作：{count, plural, other {# 天}}',
  'insights.home.entriesToday': '{count, plural, =0 {今天还没有写记录} other {今天写了 # 条记录}}',
  'insights.home.totalEntries': '{count, plural, other {日记中共有 # 条记录}}',
  'insights.home.ratingOf10': '{value}/10',
  'insights.home.sleepHours': '{value} 小时',
  'insights.home.lastEntryMood': '心情：{value}',
};
export default messages;
