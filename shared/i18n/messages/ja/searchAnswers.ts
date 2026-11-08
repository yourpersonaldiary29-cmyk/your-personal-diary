/**
 * ja - searchAnswers messages (server/src/search: parser explanations, period labels,
 * executor answers). Keys are prefixed 'searchAnswers.'; see shared/i18n/index.ts for the syntax.
 *
 * `{period}` is a time phrase ("過去1か月", "日記全体で") that opens the sentence and is
 * followed by "、" (or by の where it modifies a noun).
 */
const messages: Record<string, string> = {
  // Period labels (ParsedQuery.periodLabel and the {period} of every sentence) --------
  'searchAnswers.period.all': '全期間',
  'searchAnswers.period.allPhrase': '日記全体で',
  'searchAnswers.period.today': '今日',
  'searchAnswers.period.yesterday': '昨日',
  'searchAnswers.period.twoDaysAgo': '一昨日',
  'searchAnswers.period.week': '過去1週間',
  'searchAnswers.period.month': '過去1か月',
  'searchAnswers.period.halfYear': '過去半年',
  'searchAnswers.period.year': '過去1年間',
  'searchAnswers.period.startYear': '今年の初めから',
  'searchAnswers.period.startMonth': '今月の初めから',
  'searchAnswers.period.recent': 'ここ数日',
  'searchAnswers.period.lastDays': '{count, plural, =1 {今日} other {過去#日間}}',
  'searchAnswers.period.lastWeeks': '{count, plural, other {過去#週間}}',
  'searchAnswers.period.lastMonths': '{count, plural, other {過去#か月}}',
  'searchAnswers.period.lastYears': '{count, plural, other {過去#年間}}',
  'searchAnswers.period.agoDays': '{count, plural, other {#日前}}',
  'searchAnswers.period.agoWeeks': '{count, plural, other {#週間前}}',
  'searchAnswers.period.agoMonths': '{count, plural, other {#か月前}}',
  'searchAnswers.period.agoYears': '{count, plural, other {#年前}}',
  'searchAnswers.period.calendarMonth': '{year}年{month}',
  'searchAnswers.period.onDate': '{date}',
  'searchAnswers.period.between': '{from}〜{to}',

  // Comparators ("less than 5") ------------------------------------------------------
  'searchAnswers.comparator.lt': '{value}未満',
  'searchAnswers.comparator.lte': '{value}以下',
  'searchAnswers.comparator.gt': '{value}超',
  'searchAnswers.comparator.gte': '{value}以上',
  'searchAnswers.comparator.eq': 'ちょうど{value}',

  // Lists and quoting ----------------------------------------------------------------
  'searchAnswers.quoted': '「{term}」',
  'searchAnswers.listSeparator': '、',
  'searchAnswers.dayWithValues': '{day}（{values}）',
  'searchAnswers.value.mood': '気分 {value}',
  'searchAnswers.value.energy': 'エネルギー {value}',
  'searchAnswers.value.stress': 'ストレス {value}',
  'searchAnswers.value.sleepHours': '睡眠時間 {value}',
  'searchAnswers.value.sleepQuality': '睡眠の質 {value}',
  'searchAnswers.value.exerciseMinutes': '運動時間 {value}分',
  'searchAnswers.mention.something': '何か',

  // "How I understood the question" (ParsedQuery.explanation) ------------------------
  'searchAnswers.explain.best': 'こう理解しました：{period}、いちばん気分が良かった日。',
  'searchAnswers.explain.bestByMetric':
    'こう理解しました：{period}、{metric, select, mood {気分} energy {エネルギーレベル} stress {ストレスレベル} sleepHours {睡眠時間} sleepQuality {睡眠の質} exerciseMinutes {運動時間} other {値}}で見ていちばん調子が良かった日。',
  'searchAnswers.explain.worst': 'こう理解しました：{period}、いちばんつらかった日。',
  'searchAnswers.explain.worstByMetric':
    'こう理解しました：{period}、{metric, select, mood {気分} energy {エネルギーレベル} stress {ストレスレベル} sleepHours {睡眠時間} sleepQuality {睡眠の質} exerciseMinutes {運動時間} other {値}}で見ていちばんつらかった日。',
  'searchAnswers.explain.filter':
    'こう理解しました：{period}、{metric, select, mood {気分} energy {エネルギーレベル} stress {ストレスレベル} sleepHours {睡眠時間} sleepQuality {睡眠の質} exerciseMinutes {運動時間} other {値}}が{comparison}の日。',
  'searchAnswers.explain.trend':
    'こう理解しました：{period}の{metric, select, mood {気分} energy {エネルギーレベル} stress {ストレスレベル} sleepHours {睡眠時間} sleepQuality {睡眠の質} exerciseMinutes {運動時間} other {各値}}の変化。',
  'searchAnswers.explain.mention': 'こう理解しました：{period}、{terms}と書いた記録。',
  'searchAnswers.explain.mentionAny': 'こう理解しました：{period}、書いた記録。',
  'searchAnswers.explain.emotion': 'こう理解しました：{period}、{emotions}という気持ちだった日。',
  'searchAnswers.explain.list': 'こう理解しました：{period}、{terms}を含む記録。',
  'searchAnswers.explain.listAll': 'こう理解しました：{period}、すべての記録。',
  'searchAnswers.explain.unknown': '質問を理解できませんでした。たとえば「過去1か月で、いちばん気分が良かった日は？」のように聞いてみてください。',

  // Answers ---------------------------------------------------------------------------
  'searchAnswers.noResults': '質問に合う記録は見つかりませんでした。',
  'searchAnswers.noResultsPeriod': '{period}、質問に合う記録は見つかりませんでした。',
  'searchAnswers.rank.best': '{period}、いちばん気分が良かった日：{days}。',
  'searchAnswers.rank.bestByMetric':
    '{period}、{metric, select, mood {気分} energy {エネルギーレベル} stress {ストレスレベル} sleepHours {睡眠時間} sleepQuality {睡眠の質} exerciseMinutes {運動時間} other {値}}で見ていちばん調子が良かった日：{days}。',
  'searchAnswers.rank.worst': '{period}、いちばんつらかった日：{days}。',
  'searchAnswers.rank.worstByMetric':
    '{period}、{metric, select, mood {気分} energy {エネルギーレベル} stress {ストレスレベル} sleepHours {睡眠時間} sleepQuality {睡眠の質} exerciseMinutes {運動時間} other {値}}で見ていちばんつらかった日：{days}。',
  'searchAnswers.filter.found':
    '{period}、{metric, select, mood {気分} energy {エネルギーレベル} stress {ストレスレベル} sleepHours {睡眠時間} sleepQuality {睡眠の質} exerciseMinutes {運動時間} other {値}}が{comparison}の日が{count, plural, other {#日}}見つかりました：{days}{more, plural, =0 {} other {、ほか#日}}。',
  'searchAnswers.emotion.found':
    '{period}、{emotions}という気持ちだった日は{count, plural, other {#日}}ありました：{days}{more, plural, =0 {} other {、ほか#日}}。',
  'searchAnswers.mention.found':
    '{period}、{terms}と書いた記録は{count, plural, =1 {1件です（{first}）} other {#件です。最初は{first}、最後は{last}}}。',
  'searchAnswers.list.found': '{period}、{count, plural, other {#件の記録}}が見つかりました。最新は{last}です。',
  'searchAnswers.list.foundTerms':
    '{period}、{terms}を含む記録が{count, plural, other {#件}}見つかりました。最新は{last}です。',
  'searchAnswers.unknown.fallback':
    '質問の意図がはっきりわからなかったため、全{total}件のうち最新の{count, plural, other {#件}}を表示しています。{explanation}',
  'searchAnswers.trend.insufficient':
    '{period}の{metric, select, mood {気分} energy {エネルギーレベル} stress {ストレスレベル} sleepHours {睡眠時間} sleepQuality {睡眠の質} exerciseMinutes {運動時間} other {各値}}の傾向を見るには、データが足りません。',
  'searchAnswers.trend.evidence':
    '（期間の初めの{first, plural, other {#日分}}と終わりの{last, plural, other {#日分}}を比較）',
  'searchAnswers.trend.stable':
    '{period}、{metric, select, mood {気分} energy {エネルギーレベル} stress {ストレスレベル} sleepHours {睡眠時間} sleepQuality {睡眠の質} exerciseMinutes {運動時間} other {値}}の平均は安定していました：{from}と{to}{evidence}。',
  'searchAnswers.trend.up':
    '{period}、{metric, select, mood {気分} energy {エネルギーレベル} stress {ストレスレベル} sleepHours {睡眠時間} sleepQuality {睡眠の質} exerciseMinutes {運動時間} other {値}}の平均は{from}から{to}に上がりました{evidence}。',
  'searchAnswers.trend.down':
    '{period}、{metric, select, mood {気分} energy {エネルギーレベル} stress {ストレスレベル} sleepHours {睡眠時間} sleepQuality {睡眠の質} exerciseMinutes {運動時間} other {値}}の平均は{from}から{to}に下がりました{evidence}。',

  // Request validation (POST /api/search) ----------------------------------------------
  'searchAnswers.validation.body': 'リクエスト本文には質問（query）を含める必要があります',
  'searchAnswers.validation.query': '質問を入力してください',
  'searchAnswers.validation.queryTooLong': '質問が長すぎます（{max}文字まで）',
  'searchAnswers.validation.limit': '結果の件数は1〜{max}の整数で指定してください',
};
export default messages;
