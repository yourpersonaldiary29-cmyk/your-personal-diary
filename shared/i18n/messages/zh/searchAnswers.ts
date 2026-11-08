/**
 * zh - searchAnswers messages (server/src/search: parser explanations, period labels,
 * executor answers). Keys are prefixed 'searchAnswers.'; see shared/i18n/index.ts for the syntax.
 *
 * `{period}` is a time phrase that opens the clause in Chinese ("最近一个月", "在整本日记中"),
 * so every sentence starts with it; `{comparison}` ends with a number, hence the space before 的.
 */
const messages: Record<string, string> = {
  // Period labels (ParsedQuery.periodLabel and the {period} of every sentence) --------
  'searchAnswers.period.all': '全部时间',
  'searchAnswers.period.allPhrase': '在整本日记中',
  'searchAnswers.period.today': '今天',
  'searchAnswers.period.yesterday': '昨天',
  'searchAnswers.period.twoDaysAgo': '前天',
  'searchAnswers.period.week': '最近一周',
  'searchAnswers.period.month': '最近一个月',
  'searchAnswers.period.halfYear': '最近半年',
  'searchAnswers.period.year': '最近一年',
  'searchAnswers.period.startYear': '今年年初以来',
  'searchAnswers.period.startMonth': '本月初以来',
  'searchAnswers.period.recent': '最近几天',
  'searchAnswers.period.lastDays': '{count, plural, =1 {今天} other {最近 # 天}}',
  'searchAnswers.period.lastWeeks': '{count, plural, =1 {最近一周} other {最近 # 周}}',
  'searchAnswers.period.lastMonths': '{count, plural, =1 {最近一个月} other {最近 # 个月}}',
  'searchAnswers.period.lastYears': '{count, plural, =1 {最近一年} other {最近 # 年}}',
  'searchAnswers.period.agoDays': '{count, plural, =1 {一天前} other {# 天前}}',
  'searchAnswers.period.agoWeeks': '{count, plural, =1 {一周前} other {# 周前}}',
  'searchAnswers.period.agoMonths': '{count, plural, =1 {一个月前} other {# 个月前}}',
  'searchAnswers.period.agoYears': '{count, plural, =1 {一年前} other {# 年前}}',
  'searchAnswers.period.calendarMonth': '{year} 年{month}',
  'searchAnswers.period.onDate': '{date} 当天',
  'searchAnswers.period.between': '{from} 至 {to} 期间',

  // Comparators ("less than 5") ------------------------------------------------------
  'searchAnswers.comparator.lt': '低于 {value}',
  'searchAnswers.comparator.lte': '不超过 {value}',
  'searchAnswers.comparator.gt': '高于 {value}',
  'searchAnswers.comparator.gte': '至少 {value}',
  'searchAnswers.comparator.eq': '正好为 {value}',

  // Lists and quoting ----------------------------------------------------------------
  'searchAnswers.quoted': '“{term}”',
  'searchAnswers.listSeparator': '、',
  'searchAnswers.dayWithValues': '{day}（{values}）',
  'searchAnswers.value.mood': '心情 {value}',
  'searchAnswers.value.energy': '精力 {value}',
  'searchAnswers.value.stress': '压力 {value}',
  'searchAnswers.value.sleepHours': '睡眠时长 {value}',
  'searchAnswers.value.sleepQuality': '睡眠质量 {value}',
  'searchAnswers.value.exerciseMinutes': '运动分钟数 {value}',
  'searchAnswers.mention.something': '某些内容',

  // "How I understood the question" (ParsedQuery.explanation) ------------------------
  'searchAnswers.explain.best': '我的理解：{period}您感觉最好的日子。',
  'searchAnswers.explain.bestByMetric':
    '我的理解：{period}按{metric, select, mood {心情} energy {精力水平} stress {压力水平} sleepHours {睡眠时长} sleepQuality {睡眠质量} exerciseMinutes {运动分钟数} other {数值}}来看状态最好的日子。',
  'searchAnswers.explain.worst': '我的理解：{period}最艰难的日子。',
  'searchAnswers.explain.worstByMetric':
    '我的理解：{period}按{metric, select, mood {心情} energy {精力水平} stress {压力水平} sleepHours {睡眠时长} sleepQuality {睡眠质量} exerciseMinutes {运动分钟数} other {数值}}来看最艰难的日子。',
  'searchAnswers.explain.filter':
    '我的理解：{period}{metric, select, mood {心情} energy {精力水平} stress {压力水平} sleepHours {睡眠时长} sleepQuality {睡眠质量} exerciseMinutes {运动分钟数} other {数值}}{comparison} 的日子。',
  'searchAnswers.explain.trend':
    '我的理解：{period}您的{metric, select, mood {心情} energy {精力水平} stress {压力水平} sleepHours {睡眠时长} sleepQuality {睡眠质量} exerciseMinutes {运动分钟数} other {各项数值}}有什么变化。',
  'searchAnswers.explain.mention': '我的理解：{period}您写到{terms}的记录。',
  'searchAnswers.explain.mentionAny': '我的理解：{period}您写下的记录。',
  'searchAnswers.explain.emotion': '我的理解：{period}您感到{emotions}的日子。',
  'searchAnswers.explain.list': '我的理解：{period}包含{terms}的记录。',
  'searchAnswers.explain.listAll': '我的理解：{period}的所有记录。',
  'searchAnswers.explain.unknown': '我没能理解这个问题。您可以这样问：“最近一个月里，我哪几天感觉最好？”',

  // Answers ---------------------------------------------------------------------------
  'searchAnswers.noResults': '没有找到符合问题的记录。',
  'searchAnswers.noResultsPeriod': '{period}没有找到符合问题的记录。',
  'searchAnswers.rank.best': '{period}您感觉最好的日子：{days}。',
  'searchAnswers.rank.bestByMetric':
    '{period}按{metric, select, mood {心情} energy {精力水平} stress {压力水平} sleepHours {睡眠时长} sleepQuality {睡眠质量} exerciseMinutes {运动分钟数} other {数值}}来看状态最好的日子：{days}。',
  'searchAnswers.rank.worst': '{period}最艰难的日子：{days}。',
  'searchAnswers.rank.worstByMetric':
    '{period}按{metric, select, mood {心情} energy {精力水平} stress {压力水平} sleepHours {睡眠时长} sleepQuality {睡眠质量} exerciseMinutes {运动分钟数} other {数值}}来看最艰难的日子：{days}。',
  'searchAnswers.filter.found':
    '{period}共找到 {count, plural, other {# 个}}{metric, select, mood {心情} energy {精力水平} stress {压力水平} sleepHours {睡眠时长} sleepQuality {睡眠质量} exerciseMinutes {运动分钟数} other {数值}}{comparison} 的日子：{days}{more, plural, =0 {} other {，另外还有 # 天}}。',
  'searchAnswers.emotion.found':
    '{period}您有 {count, plural, other {# 天}}感到{emotions}：{days}{more, plural, =0 {} other {，另外还有 # 天}}。',
  'searchAnswers.mention.found':
    '{period}您在 {count, plural, =1 {1 条记录中写到了{terms}，日期是 {first}} other {# 条记录中写到了{terms}；最早一条在 {first}，最近一条在 {last}}}。',
  'searchAnswers.list.found': '{period}找到 {count, plural, other {# 条记录}}；最近一条在 {last}。',
  'searchAnswers.list.foundTerms':
    '{period}找到 {count, plural, other {# 条}}包含{terms}的记录；最近一条在 {last}。',
  'searchAnswers.unknown.fallback':
    '我不太确定您想问什么，所以这里显示全部 {total} 条记录中最新的 {count, plural, other {# 条}}。{explanation}',
  'searchAnswers.trend.insufficient':
    '数据不足，无法判断{period}您{metric, select, mood {心情} energy {精力水平} stress {压力水平} sleepHours {睡眠时长} sleepQuality {睡眠质量} exerciseMinutes {运动分钟数} other {各项数值}}的变化趋势。',
  'searchAnswers.trend.evidence':
    '（依据期初 {first, plural, other {# 天}}与期末 {last, plural, other {# 天}}的数据对比）',
  'searchAnswers.trend.stable':
    '{period}您的平均{metric, select, mood {心情} energy {精力水平} stress {压力水平} sleepHours {睡眠时长} sleepQuality {睡眠质量} exerciseMinutes {运动分钟数} other {数值}}保持稳定：{from} 对比 {to}{evidence}。',
  'searchAnswers.trend.up':
    '{period}您的平均{metric, select, mood {心情} energy {精力水平} stress {压力水平} sleepHours {睡眠时长} sleepQuality {睡眠质量} exerciseMinutes {运动分钟数} other {数值}}从 {from} 上升到 {to}{evidence}。',
  'searchAnswers.trend.down':
    '{period}您的平均{metric, select, mood {心情} energy {精力水平} stress {压力水平} sleepHours {睡眠时长} sleepQuality {睡眠质量} exerciseMinutes {运动分钟数} other {数值}}从 {from} 下降到 {to}{evidence}。',

  // Request validation (POST /api/search) ----------------------------------------------
  'searchAnswers.validation.body': '请求正文必须包含问题（query）',
  'searchAnswers.validation.query': '请输入问题',
  'searchAnswers.validation.queryTooLong': '问题过长（最多 {max} 个字符）',
  'searchAnswers.validation.limit': '结果数量必须是 1 到 {max} 之间的整数',
};
export default messages;
