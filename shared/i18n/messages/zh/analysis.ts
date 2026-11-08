/**
 * zh - analysis messages (server-side insight templates, notes and labels). Keys are prefixed
 * 'analysis.'; see shared/i18n/index.ts for the template syntax and en/analysis.ts for the conventions.
 *
 * Chinese has no grammatical gender: every metric is 'n' and the `{gender, select, other {...}}`
 * wrappers are kept only so the placeholders match the English reference. Sentences stay hedged
 * ("从您的数据来看……似乎……", "可能存在关联") and never causal.
 */
const messages: Record<string, string> = {
  // Engine / provider -----------------------------------------------------------------
  'analysis.engine.providerFailed': '规律分析未能完成（内部错误）。请稍后再试。',
  'analysis.engine.detectorFailed': '对{label}的检查未能完成（内部错误）；其他洞察不受影响。',

  // Strength --------------------------------------------------------------------------
  'analysis.strength.weak': '弱',
  'analysis.strength.moderate': '中等',
  'analysis.strength.strong': '强',

  // Metrics: label (short, standalone), defined (subject inside a sentence), gender -----
  'analysis.metric.mood.label': '心情',
  'analysis.metric.mood.defined': '心情',
  'analysis.metric.mood.gender': 'n',
  'analysis.metric.energy.label': '精力水平',
  'analysis.metric.energy.defined': '精力水平',
  'analysis.metric.energy.gender': 'n',
  'analysis.metric.stress.label': '压力水平',
  'analysis.metric.stress.defined': '压力水平',
  'analysis.metric.stress.gender': 'n',
  'analysis.metric.sleepHours.label': '睡眠时长',
  'analysis.metric.sleepHours.defined': '睡眠时长',
  'analysis.metric.sleepHours.gender': 'n',
  'analysis.metric.sleepQuality.label': '睡眠质量',
  'analysis.metric.sleepQuality.defined': '睡眠质量',
  'analysis.metric.sleepQuality.gender': 'n',
  'analysis.metric.exerciseMinutes.label': '运动分钟数',
  'analysis.metric.exerciseMinutes.defined': '运动分钟数',
  'analysis.metric.exerciseMinutes.gender': 'n',
  'analysis.metric.entries.label': '日记记录',
  'analysis.metric.entries.defined': '记录数',
  'analysis.metric.entries.gender': 'n',

  // Counts and dates ------------------------------------------------------------------
  'analysis.count.days': '{count, plural, other {# 天}}',
  'analysis.count.weeks': '{count, plural, other {# 周}}',
  'analysis.date.dayWithDate': '{date} {weekday}',

  // Weekdays (index 0 = Sunday) --------------------------------------------------------
  'analysis.weekday.plural.0': '星期日',
  'analysis.weekday.plural.1': '星期一',
  'analysis.weekday.plural.2': '星期二',
  'analysis.weekday.plural.3': '星期三',
  'analysis.weekday.plural.4': '星期四',
  'analysis.weekday.plural.5': '星期五',
  'analysis.weekday.plural.6': '星期六',
  'analysis.weekday.on.0': '在星期日',
  'analysis.weekday.on.1': '在星期一',
  'analysis.weekday.on.2': '在星期二',
  'analysis.weekday.on.3': '在星期三',
  'analysis.weekday.on.4': '在星期四',
  'analysis.weekday.on.5': '在星期五',
  'analysis.weekday.on.6': '在星期六',

  // Notes shared by the detectors -------------------------------------------------------
  'analysis.note.insufficient': '数据不足，暂时无法检查{what}（至少需要{required}；目前：{have}）。',
  'analysis.note.insufficientWhether': '数据不足，暂时无法判断{what}（至少需要{required}；目前：{have}）。',
  'analysis.note.nothingNotable': '我在 {count, plural, other {# 天}}的数据中检查了{what}，没有发现明显差异。',

  // Requirement / availability phrases used inside the notes above ----------------------
  'analysis.req.daysBothValues': '{count, plural, other {# 天同时记录了两项数值}}',
  'analysis.req.daysPerGroup': '{count, plural, other {每组 # 天}}',
  'analysis.req.daysWithReport': '{count, plural, other {# 天有记录}}',
  'analysis.req.daysWithRatings': '{count, plural, other {# 天有评分}}',
  'analysis.req.daysPerMonth': '{count, plural, other {每个月 # 天有记录}}',
  'analysis.req.recentDays': '{count, plural, other {最近两周内 # 天有记录}}',
  'analysis.req.fullWeeks': '{count, plural, other {# 个有记录的完整周}}',
  'analysis.req.weeksOfLogs': '{count, plural, other {# 周的记录}}',
  'analysis.req.weekPerGroup': '每组一周，且每组 {count, plural, other {# 天}}有记录',
  'analysis.req.moodReports': '{count, plural, other {# 条心情记录}}',
  'analysis.req.reportsInWindow': '{count, plural, other {同一时段内 # 条记录}}',
  'analysis.req.emotionRepeated': '同一种情绪出现在 {count, plural, other {# 天}}',
  'analysis.have.twoGroups': '{groupA}：{countA, plural, other {# 天}}；{groupB}：{countB, plural, other {# 天}}',
  'analysis.have.weeksTwoGroups':
    '达标的周：{metWeeks, plural, other {# 周}}（{metDays, plural, other {# 天}}）；未达标的周：{belowWeeks, plural, other {# 周}}（{belowDays, plural, other {# 天}}）',
  'analysis.have.twoMonths': '{cur} {countA, plural, other {# 天}}，{prev} {countB, plural, other {# 天}}',
  'analysis.have.noData': '没有数据',
  'analysis.have.noSuchEmotion': '暂无',
  'analysis.have.fewerInEveryWindow': '每个时段都少于此数',

  // Sentences shared by the group-comparison detectors ----------------------------------
  'analysis.relation.text':
    '从您的数据来看，{condition}，您的{metricDefined}似乎{gender, select, other {{direction, select, higher {平均较高} other {平均较低}}}}（{meanA} 对比 {meanB}）。',
  'analysis.correlation.text':
    '从您的数据来看，{x}与{y}之间可能存在关联：{xGender, select, other {当您的{x}较高时}}，{yGender, select, other {{y}{direction, select, higher {往往也较高} other {往往较低}}}}（相关系数 {r}）。',
  'analysis.explain.checkedDays': '我检查了 {count, plural, other {# 天}}的数据。',
  'analysis.explain.onDaysCondition': '其中有 {count, plural, other {# 天}}您{conditionPast}。',
  'analysis.explain.groupMeans':
    '这些日子里，您的平均{metricDefined}{gender, select, other {为 {meanA}}}，其他日子为 {meanB}。',
  'analysis.explain.correlation': '相关系数：{r}。',
  'analysis.explain.correlationBetween': '相关系数（{predictor}与{outcome}）：{r}。',
  'analysis.explain.diffAndStrength': '平均值之差：{diff} 分。规律强度：{strength}。',
  'analysis.explain.diffStrength': '差值：{diff} 分。规律强度：{strength}。',
  'analysis.split.corrExplainChecked': '我检查了同时记录了{x}和{y}的 {count, plural, other {# 天}}。',
  'analysis.split.corrExplainPearson': '皮尔逊相关系数：{r}（强度：{strength}）。',
  'analysis.split.corrExplainGroups':
    '每组的天数不足以比较平均值（{groupA}：{countA, plural, other {# 天}}；{groupB}：{countB, plural, other {# 天}}；每组至少需要 {min} 天）。',

  // Evidence table keys ---------------------------------------------------------------
  'analysis.extra.predictor': '预测变量',
  'analysis.extra.strength': '强度',
  'analysis.extra.meanDiff': '平均值之差（A 减 B）',
  'analysis.extra.cohenD': '效应量（Cohen’s d）',
  'analysis.extra.weeksChecked': '检查的周数',
  'analysis.extra.weeklyTarget': '每周目标',
  'analysis.extra.target': '目标',
  'analysis.extra.frequency': '频率',
  'analysis.extra.periodMean': '期间平均值',
  'analysis.extra.overallMean': '总体平均值',
  'analysis.extra.stddev': '标准差',
  'analysis.extra.slopePerDay': '每日斜率',
  'analysis.extra.daysInWindow': '窗口内天数',
  'analysis.extra.movingWindow': '移动平均窗口',
  'analysis.extra.relativeChange': '相对变化',
  'analysis.extra.longestStreak': '期间内最长连续天数',
  'analysis.extra.shareOfEmotionDays': '在该情绪出现的日子中所占比例',
  'analysis.frequency.daily': '每天',
  'analysis.frequency.weekly': '每周',
  'analysis.groupB.otherDays': '其他日子',

  // Sleep detectors -------------------------------------------------------------------
  'analysis.sleep.groupA': '睡眠不足 {hours} 小时的日子',
  'analysis.sleep.groupB': '睡眠 {hours} 小时及以上的日子',
  'analysis.sleep.condition': '在睡眠不足 {hours} 小时的日子里',
  'analysis.sleep.conditionPast': '睡眠不足 {hours} 小时',
  'analysis.sleepMood.label': '睡眠与心情之间的关联',
  'analysis.sleepMood.title': '{direction, select, lower {睡眠较少与心情较差} other {睡眠较少与心情较好}}',
  'analysis.sleepMood.corrTitle': '睡眠时长与心情之间可能存在的关联',
  'analysis.sleepEnergy.label': '睡眠与精力水平之间的关联',
  'analysis.sleepEnergy.title': '{direction, select, lower {睡眠较少与精力较低} other {睡眠较少与精力较高}}',
  'analysis.sleepEnergy.corrTitle': '睡眠时长与精力水平之间可能存在的关联',

  // Exercise detectors ----------------------------------------------------------------
  'analysis.exercise.groupA': '有运动的日子',
  'analysis.exercise.groupB': '没有运动的日子',
  'analysis.exercise.condition': '在有运动的日子里',
  'analysis.exercise.conditionPast': '做了运动',
  'analysis.exerciseMood.label': '运动与心情之间的关联',
  'analysis.exerciseMood.title': '{direction, select, higher {运动与心情较好} other {运动与心情较差}}',
  'analysis.exerciseMood.corrTitle': '运动分钟数与心情之间可能存在的关联',
  'analysis.exerciseEnergy.label': '运动与精力水平之间的关联',
  'analysis.exerciseEnergy.title': '{direction, select, higher {运动与精力较高} other {运动与精力较低}}',
  'analysis.exerciseEnergy.corrTitle': '运动分钟数与精力水平之间可能存在的关联',

  // Habit - mood / energy / stress ------------------------------------------------------
  'analysis.habit.detectorLabel': '习惯与心情之间的关联',
  'analysis.habit.noHabits': '目前没有进行中的习惯，所以没有检查习惯与心情之间的关联。',
  'analysis.habit.noLogs': '习惯“{habit}”在这段时间内还没有记录，所以没有检查它与心情之间的关联。',
  'analysis.habit.noFullWeeks': '习惯“{habit}”还没有记录完整的一周，所以没有检查它与心情之间的关联。',
  'analysis.habit.label': '习惯“{habit}”与{metric}之间的关联',
  'analysis.habit.groupA': '完成习惯“{habit}”的日子',
  'analysis.habit.groupB': '未完成习惯“{habit}”的日子',
  'analysis.habit.condition': '在完成习惯“{habit}”的日子里',
  'analysis.habit.conditionPast': '完成了习惯“{habit}”',
  'analysis.habit.title':
    '习惯“{habit}”与{gender, select, other {{direction, select, higher {较高的{metric}} other {较低的{metric}}}}}',
  'analysis.habit.corrTitle': '习惯“{habit}”与{metric}之间可能存在的关联',
  'analysis.habit.weeklyCondition': '在达成习惯“{habit}”目标的那些周里',
  'analysis.habit.weeklyTarget': '每周 {target} {unit}',
  'analysis.habit.targetValue': '{target} {unit}',
  'analysis.habit.weeklyExplainChecked':
    '我检查了 {weeks, plural, other {# 个完整周}}（其中 {days, plural, other {# 天}}有{metric}记录）。',
  'analysis.habit.weeklyExplainMet': '其中有 {count, plural, other {# 周}}您达成了该习惯的目标（{target}）。',
  'analysis.habit.weeklyExplainMeans':
    '在这些周的日子里，您的平均{metricDefined}{gender, select, other {为 {meanA}}}；而在未达标的 {count, plural, other {# 周}}里，平均为 {meanB}。',
  'analysis.habit.groupAWeeks': '达标周的日子（{count, plural, other {# 周}}）',
  'analysis.habit.groupBWeeks': '未达标周的日子（{count, plural, other {# 周}}）',

  // Weekday differences -----------------------------------------------------------------
  'analysis.weekday.label': '一周中各天之间的差异',
  'analysis.weekday.text':
    '从您的数据来看，{onWeekday}您的{metricDefined}似乎{gender, select, other {{direction, select, higher {平均高于} other {平均低于}}}}一周中的其他日子（{meanA} 对比 {meanB}）。',
  'analysis.weekday.explainChecked': '我检查了有{metric}记录的 {count, plural, other {# 天}}，其中 {countA} 天是{weekdays}。',
  'analysis.weekday.explainMeans':
    '您{onWeekday}的平均{metricDefined}{gender, select, other {为 {meanA}}}，其他日子为 {meanB}。',
  'analysis.weekday.title':
    '{weekdays}：{gender, select, other {{direction, select, higher {{metric}较高} other {{metric}较低}}}}',
  'analysis.weekday.groupB': '一周中的其他日子',
  'analysis.weekday.tableValue': '{mean}（{count, plural, other {# 天}}）',
  'analysis.weekday.nothing': '我在 {count, plural, other {# 天}}的数据中检查了一周各天之间的差异，没有发现明显差异。',

  // Time of day -------------------------------------------------------------------------
  'analysis.timeOfDay.label': '写作时间与心情之间的关联',
  'analysis.timeOfDay.morning.label': '早上',
  'analysis.timeOfDay.morning.phrase': '早上',
  'analysis.timeOfDay.late_morning.label': '上午',
  'analysis.timeOfDay.late_morning.phrase': '上午',
  'analysis.timeOfDay.afternoon.label': '下午',
  'analysis.timeOfDay.afternoon.phrase': '下午',
  'analysis.timeOfDay.evening.label': '傍晚',
  'analysis.timeOfDay.evening.phrase': '傍晚',
  'analysis.timeOfDay.night.label': '夜间',
  'analysis.timeOfDay.night.phrase': '夜间',
  'analysis.timeOfDay.tableKey': '{label}（{hours}）',
  'analysis.timeOfDay.tableValue': '平均 {mean}，{count, plural, other {# 条记录}}',
  'analysis.timeOfDay.tableRow': '{key}：{value}',
  'analysis.timeOfDay.nothing': '我在 {count, plural, other {# 条记录}}中检查了{label}，没有发现明显高于平均值的时段。',
  'analysis.timeOfDay.text':
    '从您的数据来看，您在{phrase}（{hours}）记录的心情似乎最高：平均 {mean}，而所有记录的平均值为 {overall}。',
  'analysis.timeOfDay.explainChecked':
    '我按记录的书写时间，检查了来自 {days, plural, other {# 天}}的 {count, plural, other {# 条心情记录}}。',
  'analysis.timeOfDay.explainTable': '{table}。总体平均值：{overall}。',
  'analysis.timeOfDay.explainDiff': '最高时段与总体平均值之差：{diff} 分。规律强度：{strength}。',
  'analysis.timeOfDay.title': '{phrase}心情较好',
  'analysis.timeOfDay.groupA': '{phrase}（{hours}）的记录',
  'analysis.timeOfDay.groupB': '其他记录',

  // Trends ------------------------------------------------------------------------------
  'analysis.trends.label': '心情、压力和睡眠的趋势',
  'analysis.trends.text':
    '从您的数据来看，{horizon, select, period {在整个期间} monthly {最近一个月} other {最近两周}}，您的{metricDefined}{gender, select, other {似乎{direction, select, up {呈上升趋势} other {呈下降趋势}}}}：移动平均的趋势线从 {fromValue} {direction, select, up {上升到} other {下降到}} {toValue}。',
  'analysis.trends.explainChecked':
    '在{horizon, select, period {期间的 {len} 天} other {最近的 {len} 天}}（{from}-{to}）中，我检查了有{metric}记录的 {count, plural, other {# 天}}。',
  'analysis.trends.explainFit':
    '我计算了 {window} 天的移动平均，并据此拟合了一条趋势线（线性回归）：{direction, select, up {上升斜率} other {下降斜率}}为每天 {unit, select, hours {{slope} 小时} other {{slope} 分}}，也就是在整个窗口内变化约 {unit, select, hours {{change} 小时} other {{change} 分}}（沿趋势线从 {fromValue} 到 {toValue}）。趋势强度：{strength}。',
  'analysis.trends.title':
    '{horizon, select, period {整个期间} monthly {最近一个月} other {最近两周}}{metric, select, mood {您的心情} energy {您的精力水平} stress {您的压力水平} sleepHours {您的睡眠时长} sleepQuality {您的睡眠质量} exerciseMinutes {您的运动分钟数} other {记录数}}{direction, select, up {呈上升趋势} other {呈下降趋势}}',
  'analysis.trends.groupA': '窗口起点（趋势线）',
  'analysis.trends.groupB': '窗口终点（趋势线）',
  'analysis.trends.slopeValue': '{unit, select, hours {{slope} 小时} other {{slope} 分}}',
  'analysis.trends.nothingSince': '我检查了自 {from} 以来心情、压力和睡眠的趋势，没有发现明显趋势。',
  'analysis.trends.nothingAll': '我检查了整个期间内心情、压力和睡眠的趋势，没有发现明显趋势。',

  // Month comparison --------------------------------------------------------------------
  'analysis.periodCompare.label': '本月与上月的比较',
  'analysis.periodCompare.text':
    '从您的数据来看，{cur}您的{metricDefined}似乎{gender, select, other {{direction, select, higher {平均高于} other {平均低于}}}}{prev}（{meanA} 对比 {meanB}）。',
  'analysis.periodCompare.explain':
    '我将{cur}有{metric}记录的日子（{countA, plural, other {# 天}}，截至今天）与{prev}的日子（{countB, plural, other {# 天}}）进行了比较。{cur}平均值：{meanA}；{prev}：{meanB}。差值：{unit, select, hours {{diff} 小时} other {{diff} 分}}。差异强度：{strength}。',
  'analysis.periodCompare.title':
    '{cur}：{gender, select, other {{direction, select, higher {{metric}高于} other {{metric}低于}}}}{prev}',
  'analysis.periodCompare.entriesText':
    '看起来您在{cur}的前 {window} 天写了 {countA, plural, other {# 条记录}}，{direction, select, more {多于} other {少于}}{prev}前 {window} 天的 {countB, plural, other {# 条记录}}。',
  'analysis.periodCompare.entriesExplain':
    '为了比较相同长度的时间段，我统计了每个月前 {window} 天的记录：{cur} - {countA, plural, other {# 条记录}}，{prev} - {countB, plural, other {# 条记录}}。差值：{diff, plural, other {# 条记录}}（{percent}）。差异强度：{strength}。',
  'analysis.periodCompare.entriesTitle': '{cur}的记录{direction, select, more {多于} other {少于}}{prev}',
  'analysis.periodCompare.monthWindow': '{month}（前 {window} 天）',
  'analysis.periodCompare.insufficientWhat': '{cur}与{prev}之间的比较',
  'analysis.periodCompare.nothing': '我将{cur}与{prev}进行了比较，在心情、压力、睡眠和记录数方面都没有发现明显差异。',

  // Habit trend (improved / declined) -----------------------------------------------------
  'analysis.habitsTrend.label': '有所改善或有所下滑的习惯',
  'analysis.habitsTrend.whether': '习惯“{habit}”是有所改善还是有所下滑',
  'analysis.habitsTrend.textDaily':
    '看起来习惯“{habit}”{direction, select, improved {有所改善} other {有所下滑}}：最近两周的 {window} 天中您完成了 {recent} 天，而之前两周为 {window} 天中的 {previous} 天。',
  'analysis.habitsTrend.textWeekly':
    '看起来习惯“{habit}”{direction, select, improved {有所改善} other {有所下滑}}：最近两周您记录了 {recent} {unit}，而之前两周为 {previous}（目标：每周 {target} {unit}）。',
  'analysis.habitsTrend.explain':
    '我将该习惯最近两周（{recentFrom}-{recentTo}）的完成率与之前两周（{previousFrom}-{previousTo}）进行了比较：{recentRate} 对比 {previousRate}。差值：{diff} 个百分点。变化强度：{strength}。',
  'analysis.habitsTrend.title': '最近两周习惯“{habit}”{direction, select, improved {有所改善} other {有所下滑}}',
  'analysis.habitsTrend.metric': '完成率 - {habit}',
  'analysis.habitsTrend.groupA': '最近两周',
  'analysis.habitsTrend.groupB': '之前两周',

  // Best / hardest days ------------------------------------------------------------------
  'analysis.bestWorst.label': '最好和最艰难的日子',
  'analysis.bestWorst.describedDay': '{day}（“{title}”）',
  'analysis.bestWorst.noTitle': '无标题',
  'analysis.bestWorst.extraValue': '{titles} - 得分 {score}',
  'analysis.bestWorst.text':
    '按心情、精力和压力的综合得分，这段时间内{kind, select, best {最好的日子} other {最艰难的日子}}是：{days}。',
  'analysis.bestWorst.explainScore':
    '我为这 {count, plural, other {# 天}}中的每一天计算了综合得分：当天所记录的心情、精力水平以及（11 减压力水平）的平均值。',
  'analysis.bestWorst.explainMeans':
    '这段时间的平均得分：{overall}。{kind, select, best {{count, plural, =1 {最好的一天} =3 {最好的三天} other {最好的几天}}} other {{count, plural, =1 {最艰难的一天} =3 {最艰难的三天} other {最艰难的几天}}}}平均得分为 {mean}。',
  'analysis.bestWorst.explainDiff': '与平均值之差：{diff} 分。差异强度：{strength}。',
  'analysis.bestWorst.title': '{kind, select, best {这段时间内最好的日子} other {这段时间内最艰难的日子}}',
  'analysis.bestWorst.metric': '综合得分（心情 + 精力 + 反向压力）',
  'analysis.bestWorst.groupA': '{kind, select, best {最好的日子} other {最艰难的日子}}',
  'analysis.bestWorst.nothing': '我在 {count, plural, other {# 天}}的数据中检查了{label}；各天得分相近，没有特别突出的日子。',

  // Streaks -------------------------------------------------------------------------------
  'analysis.streaks.label': '写作和习惯的连续天数',
  'analysis.streaks.entriesTitle': '连续写作 {count, plural, other {# 天}}',
  'analysis.streaks.entriesText': '做得好！您已经连续 {count, plural, other {# 天}}写日记了（{from}-{to}）。',
  'analysis.streaks.entriesExplain':
    '我统计了截至今天或昨天、每天至少有一条记录的连续天数。当前连续：{count, plural, other {# 天}}，从 {from} 到 {to}。期间内最长连续：{best, plural, other {# 天}}。',
  'analysis.streaks.entriesMetric': '写作天数',
  'analysis.streaks.currentDays': '当前连续天数',
  'analysis.streaks.daysWithEntry': '期间内有记录的天数',
  'analysis.streaks.habitTitle': '习惯“{habit}”已连续 {count, plural, other {# 天}}',
  'analysis.streaks.habitText': '您已经连续 {count, plural, other {# 天}}完成了习惯“{habit}”（{from}-{to}）。',
  'analysis.streaks.habitExplain':
    '我统计了截至今天或昨天、习惯“{habit}”被标记为完成的连续天数。当前连续：{count, plural, other {# 天}}。期间内最长连续：{best, plural, other {# 天}}。',
  'analysis.streaks.habitMetric': '习惯完成情况：{habit}',
  'analysis.streaks.daysCompleted': '期间内完成该习惯的天数',
  'analysis.streaks.weeklyTitle': '习惯“{habit}”已连续 {count, plural, other {# 周}}达标',
  'analysis.streaks.weeklyText': '您已经连续 {count, plural, other {# 周}}达成了习惯“{habit}”的目标（{from}-{to}）。',
  'analysis.streaks.weeklyExplain':
    '我把习惯“{habit}”每周记录的总量与每周目标（{target}）进行了比较。当前连续达标：{count, plural, other {# 周}}。',
  'analysis.streaks.weeklyMetric': '每周目标达成 - {habit}',
  'analysis.streaks.currentWeeks': '当前连续周数',
  'analysis.streaks.weeksWithLogs': '期间内有记录的周数',
  'analysis.streaks.none':
    '没有发现正在进行的连续记录（连续写作 {entryMin} 天及以上，或习惯连续 {habitMin} 天或 {habitMin} 周及以上）。',

  // Anomalies -----------------------------------------------------------------------------
  'analysis.anomalies.label': '心情或压力与平时不同的日子',
  'analysis.anomalies.textOne':
    '从您的数据来看，{day}您的{metricDefined}与这段时间的其他日子相比{gender, select, other {似乎{side, select, high {格外高} other {格外低}}}}（{value}，平均值为 {mean}）。',
  'analysis.anomalies.textMany':
    '从您的数据来看，有 {count, plural, other {# 天}}您的{metricDefined}与这段时间的其他日子相比{gender, select, other {似乎{side, select, high {格外高} other {格外低}}}}：{days}；期间平均值：{mean}。',
  'analysis.anomalies.textManyMore':
    '从您的数据来看，有 {count, plural, other {# 天}}您的{metricDefined}与这段时间的其他日子相比{gender, select, other {似乎{side, select, high {格外高} other {格外低}}}}：{days} 等；期间平均值：{mean}。',
  'analysis.anomalies.dayItem': '{day}（{value}）',
  'analysis.anomalies.detail': '{date}：{value}（{side, select, above {高于平均值} other {低于平均值}} {z} 个标准差）',
  'analysis.anomalies.explain':
    '我检查了有{metric}记录的 {count, plural, other {# 天}}。平均值：{mean}，标准差：{sd}。当某天的数值与平均值相差 {z} 个标准差或以上时，就视为与平时不同。{details}。偏离强度：{strength}。',
  'analysis.anomalies.title':
    '{gender, select, other {{side, select, high {{metric}格外高} other {{metric}格外低}}}}的{count, plural, other {日子}}',
  'analysis.anomalies.groupA': '与平时不同的日子',
  'analysis.anomalies.zValue': '{value}（z {z}）',
  'analysis.anomalies.nothing':
    '我在 {count, plural, other {# 天}}的数据中检查了与平时不同的日子，没有发现与平均值相差 {z} 个标准差或以上的日子。',

  // Emotion patterns ----------------------------------------------------------------------
  'analysis.emotion.label': '按日期、人物和地点划分的情绪规律',
  'analysis.emotion.metric': '情绪：{emotion}',
  'analysis.emotion.groupA': '出现“{emotion}”情绪的日子',
  'analysis.emotion.weekdayTitle': '情绪“{emotion}”大多出现{onWeekday}',
  'analysis.emotion.weekdayText': '从您的数据来看，情绪“{emotion}”似乎大多出现{onWeekday}（{total} 次中有 {top} 次）。',
  'analysis.emotion.weekdayExplain':
    '我检查了 {count, plural, other {# 天}}。情绪“{emotion}”出现在 {total, plural, other {# 天}}中，其中 {top} 天是{weekdays}（{share}），而{weekdays}在所有检查的日子中占 {baseline}。规律强度：{strength}。',
  'analysis.emotion.groupBWeekday': '其中是{weekdays}的',
  'analysis.emotion.weekdayShareKey': '{weekdays}在所有日子中所占比例',
  'analysis.emotion.personTitle': '情绪“{emotion}”与{name}',
  'analysis.emotion.placeTitle': '情绪“{emotion}”与“{place}”',
  'analysis.emotion.personText':
    '从您的数据来看，在您见到{name}的日子里，情绪“{emotion}”似乎经常出现（{total} 次中有 {with} 次）。',
  'analysis.emotion.placeText':
    '从您的数据来看，在地点为“{place}”的日子里，情绪“{emotion}”似乎经常出现（{total} 次中有 {with} 次）。',
  'analysis.emotion.personExplain':
    '我检查了 {count, plural, other {# 天}}。情绪“{emotion}”出现在 {total} 天中；其中 {with} 天（{share}）的记录里也出现了{name}。在全部 {count} 天中，{name}出现在 {baselineCount} 天（{baseline}）。规律强度：{strength}。',
  'analysis.emotion.placeExplain':
    '我检查了 {count, plural, other {# 天}}。情绪“{emotion}”出现在 {total} 天中；其中 {with} 天（{share}）的记录里也出现了地点“{place}”。在全部 {count} 天中，地点“{place}”出现在 {baselineCount} 天（{baseline}）。规律强度：{strength}。',
  'analysis.emotion.groupBPerson': '其中与{name}相关的',
  'analysis.emotion.groupBPlace': '其中在“{place}”的',
  'analysis.emotion.personShareKey': '{name}在所有日子中所占比例',
  'analysis.emotion.placeShareKey': '地点“{place}”在所有日子中所占比例',
  'analysis.emotion.nothing':
    '我检查了至少重复出现 {min} 次的 {count, plural, other {# 种情绪}}，没有发现它们明显集中在特定的日子、人物或地点。',
};
export default messages;
