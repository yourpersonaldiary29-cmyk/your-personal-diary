/**
 * ja - analysis messages (server-side insight templates, notes and labels). Keys are prefixed
 * 'analysis.'; see shared/i18n/index.ts for the template syntax and en/analysis.ts for the conventions.
 *
 * Japanese has no grammatical gender: every metric is 'n' and the `{gender, select, other {...}}`
 * wrappers are kept only so the placeholders match the English reference. Sentences stay hedged
 * ("あなたのデータでは、……ようです", "関連があるかもしれません") and never causal.
 */
const messages: Record<string, string> = {
  // Engine / provider -----------------------------------------------------------------
  'analysis.engine.providerFailed': 'パターン分析を完了できませんでした（内部エラー）。しばらくしてからもう一度お試しください。',
  'analysis.engine.detectorFailed': '「{label}」の確認を完了できませんでした（内部エラー）。ほかの気づきには影響ありません。',

  // Strength --------------------------------------------------------------------------
  'analysis.strength.weak': '弱い',
  'analysis.strength.moderate': '中程度',
  'analysis.strength.strong': '強い',

  // Metrics: label (short, standalone), defined (subject inside a sentence), gender -----
  'analysis.metric.mood.label': '気分',
  'analysis.metric.mood.defined': '気分',
  'analysis.metric.mood.gender': 'n',
  'analysis.metric.energy.label': 'エネルギーレベル',
  'analysis.metric.energy.defined': 'エネルギーレベル',
  'analysis.metric.energy.gender': 'n',
  'analysis.metric.stress.label': 'ストレスレベル',
  'analysis.metric.stress.defined': 'ストレスレベル',
  'analysis.metric.stress.gender': 'n',
  'analysis.metric.sleepHours.label': '睡眠時間',
  'analysis.metric.sleepHours.defined': '睡眠時間',
  'analysis.metric.sleepHours.gender': 'n',
  'analysis.metric.sleepQuality.label': '睡眠の質',
  'analysis.metric.sleepQuality.defined': '睡眠の質',
  'analysis.metric.sleepQuality.gender': 'n',
  'analysis.metric.exerciseMinutes.label': '運動時間',
  'analysis.metric.exerciseMinutes.defined': '運動時間（分）',
  'analysis.metric.exerciseMinutes.gender': 'n',
  'analysis.metric.entries.label': '日記の記録',
  'analysis.metric.entries.defined': '記録の数',
  'analysis.metric.entries.gender': 'n',

  // Counts and dates ------------------------------------------------------------------
  'analysis.count.days': '{count, plural, other {#日}}',
  'analysis.count.weeks': '{count, plural, other {#週間}}',
  'analysis.date.dayWithDate': '{date} {weekday}',

  // Weekdays (index 0 = Sunday) --------------------------------------------------------
  'analysis.weekday.plural.0': '日曜日',
  'analysis.weekday.plural.1': '月曜日',
  'analysis.weekday.plural.2': '火曜日',
  'analysis.weekday.plural.3': '水曜日',
  'analysis.weekday.plural.4': '木曜日',
  'analysis.weekday.plural.5': '金曜日',
  'analysis.weekday.plural.6': '土曜日',
  'analysis.weekday.on.0': '日曜日に',
  'analysis.weekday.on.1': '月曜日に',
  'analysis.weekday.on.2': '火曜日に',
  'analysis.weekday.on.3': '水曜日に',
  'analysis.weekday.on.4': '木曜日に',
  'analysis.weekday.on.5': '金曜日に',
  'analysis.weekday.on.6': '土曜日に',

  // Notes shared by the detectors -------------------------------------------------------
  'analysis.note.insufficient': '{what}を確認するには、まだデータが足りません（必要：{required}以上、現在：{have}）。',
  'analysis.note.insufficientWhether': '{what}を確認するには、まだデータが足りません（必要：{required}以上、現在：{have}）。',
  'analysis.note.nothingNotable': '{count, plural, other {#日分}}のデータで{what}を確認しましたが、目立った違いは見つかりませんでした。',

  // Requirement / availability phrases used inside the notes above ----------------------
  'analysis.req.daysBothValues': '両方の値がそろった日が{count, plural, other {#日}}',
  'analysis.req.daysPerGroup': '各グループに{count, plural, other {#日}}',
  'analysis.req.daysWithReport': '記録のある日が{count, plural, other {#日}}',
  'analysis.req.daysWithRatings': '評価のある日が{count, plural, other {#日}}',
  'analysis.req.daysPerMonth': '各月に記録のある日が{count, plural, other {#日}}',
  'analysis.req.recentDays': '直近2週間に記録のある日が{count, plural, other {#日}}',
  'analysis.req.fullWeeks': '記録のそろった週が{count, plural, other {#週}}',
  'analysis.req.weeksOfLogs': '{count, plural, other {#週間}}分の記録',
  'analysis.req.weekPerGroup': '各グループに1週間、かつ各グループに記録のある日が{count, plural, other {#日}}',
  'analysis.req.moodReports': '気分の記録が{count, plural, other {#件}}',
  'analysis.req.reportsInWindow': '1つの時間帯に記録が{count, plural, other {#件}}',
  'analysis.req.emotionRepeated': '同じ感情が記録された日が{count, plural, other {#日}}',
  'analysis.have.twoGroups': '{groupA}：{countA, plural, other {#日}}、{groupB}：{countB, plural, other {#日}}',
  'analysis.have.weeksTwoGroups':
    '目標を達成した週：{metWeeks, plural, other {#週}}（{metDays, plural, other {#日}}）、目標に届かなかった週：{belowWeeks, plural, other {#週}}（{belowDays, plural, other {#日}}）',
  'analysis.have.twoMonths': '{cur}に{countA, plural, other {#日}}、{prev}に{countB, plural, other {#日}}',
  'analysis.have.noData': 'データなし',
  'analysis.have.noSuchEmotion': 'まだありません',
  'analysis.have.fewerInEveryWindow': 'どの時間帯もそれ未満',

  // Sentences shared by the group-comparison detectors ----------------------------------
  'analysis.relation.text':
    'あなたのデータでは、{condition}、{metricDefined}が{gender, select, other {{direction, select, higher {平均して高かった} other {平均して低かった}}}}ようです（{meanA} 対 {meanB}）。',
  'analysis.correlation.text':
    'あなたのデータでは、{x}と{y}のあいだに関連があるかもしれません。{xGender, select, other {{x}が高いときほど}}、{yGender, select, other {{y}が{direction, select, higher {高くなる傾向がありました} other {低くなる傾向がありました}}}}（相関係数 {r}）。',
  'analysis.explain.checkedDays': '{count, plural, other {#日分}}のデータを確認しました。',
  'analysis.explain.onDaysCondition': 'そのうち{count, plural, other {#日}}は{conditionPast}。',
  'analysis.explain.groupMeans':
    'それらの日の{metricDefined}の平均は{gender, select, other {{meanA}で}}、ほかの日は{meanB}でした。',
  'analysis.explain.correlation': '相関係数：{r}。',
  'analysis.explain.correlationBetween': '相関係数（{predictor}と{outcome}）：{r}。',
  'analysis.explain.diffAndStrength': '平均の差：{diff}ポイント。パターンの強さ：{strength}。',
  'analysis.explain.diffStrength': '差：{diff}ポイント。パターンの強さ：{strength}。',
  'analysis.split.corrExplainChecked': '{x}と{y}の両方が記録された{count, plural, other {#日}}を確認しました。',
  'analysis.split.corrExplainPearson': 'ピアソンの相関係数：{r}（強さ：{strength}）。',
  'analysis.split.corrExplainGroups':
    '各グループの日数が足りないため、平均を比較できませんでした（{groupA}：{countA, plural, other {#日}}、{groupB}：{countB, plural, other {#日}}。各グループに{min}日以上必要です）。',

  // Evidence table keys ---------------------------------------------------------------
  'analysis.extra.predictor': '予測変数',
  'analysis.extra.strength': '強さ',
  'analysis.extra.meanDiff': '平均の差（A－B）',
  'analysis.extra.cohenD': '効果量（コーエンのd）',
  'analysis.extra.weeksChecked': '確認した週数',
  'analysis.extra.weeklyTarget': '週の目標',
  'analysis.extra.target': '目標',
  'analysis.extra.frequency': '頻度',
  'analysis.extra.periodMean': '期間の平均',
  'analysis.extra.overallMean': '全体の平均',
  'analysis.extra.stddev': '標準偏差',
  'analysis.extra.slopePerDay': '1日あたりの傾き',
  'analysis.extra.daysInWindow': 'ウィンドウ内の日数',
  'analysis.extra.movingWindow': '移動平均のウィンドウ',
  'analysis.extra.relativeChange': '相対的な変化',
  'analysis.extra.longestStreak': '期間中の最長連続日数',
  'analysis.extra.shareOfEmotionDays': 'その感情が記録された日に占める割合',
  'analysis.frequency.daily': '毎日',
  'analysis.frequency.weekly': '毎週',
  'analysis.groupB.otherDays': 'ほかの日',

  // Sleep detectors -------------------------------------------------------------------
  'analysis.sleep.groupA': '睡眠が{hours}時間未満の日',
  'analysis.sleep.groupB': '睡眠が{hours}時間以上の日',
  'analysis.sleep.condition': '睡眠が{hours}時間未満の日は',
  'analysis.sleep.conditionPast': '睡眠が{hours}時間未満でした',
  'analysis.sleepMood.label': '睡眠と気分の関係',
  'analysis.sleepMood.title': '{direction, select, lower {短い睡眠と低めの気分} other {短い睡眠と高めの気分}}',
  'analysis.sleepMood.corrTitle': '睡眠時間と気分に関係がある可能性',
  'analysis.sleepEnergy.label': '睡眠とエネルギーレベルの関係',
  'analysis.sleepEnergy.title': '{direction, select, lower {短い睡眠と低めのエネルギー} other {短い睡眠と高めのエネルギー}}',
  'analysis.sleepEnergy.corrTitle': '睡眠時間とエネルギーレベルに関係がある可能性',

  // Exercise detectors ----------------------------------------------------------------
  'analysis.exercise.groupA': '運動した日',
  'analysis.exercise.groupB': '運動しなかった日',
  'analysis.exercise.condition': '運動した日は',
  'analysis.exercise.conditionPast': '運動しました',
  'analysis.exerciseMood.label': '運動と気分の関係',
  'analysis.exerciseMood.title': '{direction, select, higher {運動と高めの気分} other {運動と低めの気分}}',
  'analysis.exerciseMood.corrTitle': '運動時間と気分に関係がある可能性',
  'analysis.exerciseEnergy.label': '運動とエネルギーレベルの関係',
  'analysis.exerciseEnergy.title': '{direction, select, higher {運動と高めのエネルギー} other {運動と低めのエネルギー}}',
  'analysis.exerciseEnergy.corrTitle': '運動時間とエネルギーレベルに関係がある可能性',

  // Habit - mood / energy / stress ------------------------------------------------------
  'analysis.habit.detectorLabel': '習慣と気分の関係',
  'analysis.habit.noHabits': '取り組み中の習慣がないため、習慣と気分の関係は確認していません。',
  'analysis.habit.noLogs': '習慣「{habit}」にはこの期間の記録がまだないため、気分との関係は確認していません。',
  'analysis.habit.noFullWeeks': '習慣「{habit}」にはまだ記録のそろった週がないため、気分との関係は確認していません。',
  'analysis.habit.label': '習慣「{habit}」と{metric}の関係',
  'analysis.habit.groupA': '習慣「{habit}」を達成した日',
  'analysis.habit.groupB': '習慣「{habit}」を達成しなかった日',
  'analysis.habit.condition': '習慣「{habit}」を達成した日は',
  'analysis.habit.conditionPast': '習慣「{habit}」を達成しました',
  'analysis.habit.title':
    '習慣「{habit}」と{gender, select, other {{direction, select, higher {高めの{metric}} other {低めの{metric}}}}}',
  'analysis.habit.corrTitle': '習慣「{habit}」と{metric}に関係がある可能性',
  'analysis.habit.weeklyCondition': '習慣「{habit}」の目標を達成した週は',
  'analysis.habit.weeklyTarget': '週に{target}{unit}',
  'analysis.habit.targetValue': '{target}{unit}',
  'analysis.habit.weeklyExplainChecked':
    '記録のそろった{weeks, plural, other {#週}}（{metric}の記録がある日は{days, plural, other {#日}}）を確認しました。',
  'analysis.habit.weeklyExplainMet': 'そのうち{count, plural, other {#週}}は習慣の目標（{target}）を達成しました。',
  'analysis.habit.weeklyExplainMeans':
    'それらの週の日の{metricDefined}の平均は{gender, select, other {{meanA}で}}、目標に届かなかった{count, plural, other {#週}}の日は{meanB}でした。',
  'analysis.habit.groupAWeeks': '目標を達成した週の日（{count, plural, other {#週}}）',
  'analysis.habit.groupBWeeks': '目標に届かなかった週の日（{count, plural, other {#週}}）',

  // Weekday differences -----------------------------------------------------------------
  'analysis.weekday.label': '曜日による違い',
  'analysis.weekday.text':
    'あなたのデータでは、{onWeekday}は{metricDefined}がほかの曜日より{gender, select, other {{direction, select, higher {平均して高い} other {平均して低い}}}}ようです（{meanA} 対 {meanB}）。',
  'analysis.weekday.explainChecked': '{metric}の記録がある{count, plural, other {#日}}を確認しました。そのうち{countA}日が{weekdays}です。',
  'analysis.weekday.explainMeans':
    '{onWeekday}おける{metricDefined}の平均は{gender, select, other {{meanA}で}}、ほかの日は{meanB}でした。',
  'analysis.weekday.title':
    '{weekdays}：{gender, select, other {{direction, select, higher {{metric}が高め} other {{metric}が低め}}}}',
  'analysis.weekday.groupB': 'ほかの曜日',
  'analysis.weekday.tableValue': '{mean}（{count, plural, other {#日}}）',
  'analysis.weekday.nothing': '{count, plural, other {#日分}}のデータで曜日による違いを確認しましたが、目立った違いは見つかりませんでした。',

  // Time of day -------------------------------------------------------------------------
  'analysis.timeOfDay.label': '記録した時間帯と気分の関係',
  'analysis.timeOfDay.morning.label': '朝',
  'analysis.timeOfDay.morning.phrase': '朝',
  'analysis.timeOfDay.late_morning.label': '午前中',
  'analysis.timeOfDay.late_morning.phrase': '午前中',
  'analysis.timeOfDay.afternoon.label': '午後',
  'analysis.timeOfDay.afternoon.phrase': '午後',
  'analysis.timeOfDay.evening.label': '夕方',
  'analysis.timeOfDay.evening.phrase': '夕方',
  'analysis.timeOfDay.night.label': '夜',
  'analysis.timeOfDay.night.phrase': '夜',
  'analysis.timeOfDay.tableKey': '{label}（{hours}）',
  'analysis.timeOfDay.tableValue': '平均{mean}、{count, plural, other {#件の記録}}',
  'analysis.timeOfDay.tableRow': '{key}：{value}',
  'analysis.timeOfDay.nothing': '{count, plural, other {#件の記録}}で{label}を確認しましたが、平均より目立って高い時間帯は見つかりませんでした。',
  'analysis.timeOfDay.text':
    'あなたのデータでは、{phrase}（{hours}）に記録した気分がいちばん高かったようです。平均は{mean}で、すべての記録の平均は{overall}でした。',
  'analysis.timeOfDay.explainChecked':
    '{days, plural, other {#日分}}の{count, plural, other {#件の気分の記録}}を、記録を書いた時刻ごとに確認しました。',
  'analysis.timeOfDay.explainTable': '{table}。全体の平均：{overall}。',
  'analysis.timeOfDay.explainDiff': 'いちばん高い時間帯と全体の平均の差：{diff}ポイント。パターンの強さ：{strength}。',
  'analysis.timeOfDay.title': '{phrase}は気分が高め',
  'analysis.timeOfDay.groupA': '{phrase}（{hours}）の記録',
  'analysis.timeOfDay.groupB': 'ほかの記録',

  // Trends ------------------------------------------------------------------------------
  'analysis.trends.label': '気分・ストレス・睡眠の傾向',
  'analysis.trends.text':
    'あなたのデータでは、{horizon, select, period {期間全体で} monthly {過去1か月で} other {過去2週間で}}{metricDefined}が{gender, select, other {{direction, select, up {上向きの傾向にある} other {下向きの傾向にある}}}}ようです。移動平均のトレンドラインは{fromValue}から{toValue}に{direction, select, up {上がりました} other {下がりました}}。',
  'analysis.trends.explainChecked':
    '{horizon, select, period {期間中の{len}日} other {直近の{len}日}}（{from}-{to}）のうち、{metric}の記録がある{count, plural, other {#日}}を確認しました。',
  'analysis.trends.explainFit':
    '{window}日間の移動平均を計算し、それにトレンドライン（線形回帰）を当てはめました。{direction, select, up {上向き} other {下向き}}の傾きは1日あたり{unit, select, hours {{slope}時間} other {{slope}ポイント}}で、ウィンドウ全体ではおよそ{unit, select, hours {{change}時間} other {{change}ポイント}}の変化です（トレンドライン上で{fromValue}から{toValue}）。傾向の強さ：{strength}。',
  'analysis.trends.title':
    '{horizon, select, period {期間全体で} monthly {過去1か月で} other {過去2週間で}}{metric, select, mood {気分} energy {エネルギーレベル} stress {ストレスレベル} sleepHours {睡眠時間} sleepQuality {睡眠の質} exerciseMinutes {運動時間} other {記録の数}}が{direction, select, up {上向き} other {下向き}}',
  'analysis.trends.groupA': 'ウィンドウの始まり（トレンドライン）',
  'analysis.trends.groupB': 'ウィンドウの終わり（トレンドライン）',
  'analysis.trends.slopeValue': '{unit, select, hours {{slope}時間} other {{slope}ポイント}}',
  'analysis.trends.nothingSince': '{from}以降の気分・ストレス・睡眠の傾向を確認しましたが、目立った傾向は見つかりませんでした。',
  'analysis.trends.nothingAll': '期間全体の気分・ストレス・睡眠の傾向を確認しましたが、目立った傾向は見つかりませんでした。',

  // Month comparison --------------------------------------------------------------------
  'analysis.periodCompare.label': '今月と先月の比較',
  'analysis.periodCompare.text':
    'あなたのデータでは、{cur}の{metricDefined}は{prev}より{gender, select, other {{direction, select, higher {平均して高かった} other {平均して低かった}}}}ようです（{meanA} 対 {meanB}）。',
  'analysis.periodCompare.explain':
    '{cur}に{metric}の記録がある日（{countA, plural, other {#日}}、今日まで）と、{prev}の日（{countB, plural, other {#日}}）を比較しました。{cur}の平均：{meanA}、{prev}：{meanB}。差：{unit, select, hours {{diff}時間} other {{diff}ポイント}}。差の強さ：{strength}。',
  'analysis.periodCompare.title':
    '{cur}は{prev}より{gender, select, other {{direction, select, higher {{metric}が高め} other {{metric}が低め}}}}',
  'analysis.periodCompare.entriesText':
    '{cur}の最初の{window}日間に書いた記録（{countA, plural, other {#件}}）は、{prev}の最初の{window}日間（{countB, plural, other {#件}}）より{direction, select, more {多かった} other {少なかった}}ようです。',
  'analysis.periodCompare.entriesExplain':
    '同じ長さの期間で比べるため、各月の最初の{window}日間の記録を数えました：{cur} - {countA, plural, other {#件}}、{prev} - {countB, plural, other {#件}}。差：{diff, plural, other {#件}}（{percent}）。差の強さ：{strength}。',
  'analysis.periodCompare.entriesTitle': '{cur}は{prev}より記録が{direction, select, more {多め} other {少なめ}}',
  'analysis.periodCompare.monthWindow': '{month}（最初の{window}日間）',
  'analysis.periodCompare.insufficientWhat': '{cur}と{prev}の比較',
  'analysis.periodCompare.nothing': '{cur}と{prev}を比較しましたが、気分、ストレス、睡眠、記録の数のいずれにも目立った違いは見つかりませんでした。',

  // Habit trend (improved / declined) -----------------------------------------------------
  'analysis.habitsTrend.label': '改善した習慣・低下した習慣',
  'analysis.habitsTrend.whether': '習慣「{habit}」が改善したか低下したか',
  'analysis.habitsTrend.textDaily':
    '習慣「{habit}」は{direction, select, improved {改善している} other {低下している}}ようです。直近2週間では{window}日中{recent}日達成し、その前の2週間は{window}日中{previous}日でした。',
  'analysis.habitsTrend.textWeekly':
    '習慣「{habit}」は{direction, select, improved {改善している} other {低下している}}ようです。直近2週間の記録は{recent}{unit}で、その前の2週間は{previous}でした（目標：週に{target}{unit}）。',
  'analysis.habitsTrend.explain':
    '直近2週間（{recentFrom}-{recentTo}）の達成率を、その前の2週間（{previousFrom}-{previousTo}）と比較しました：{recentRate} 対 {previousRate}。差：{diff}ポイント。変化の強さ：{strength}。',
  'analysis.habitsTrend.title': '習慣「{habit}」は直近2週間で{direction, select, improved {改善} other {低下}}',
  'analysis.habitsTrend.metric': '達成率 - {habit}',
  'analysis.habitsTrend.groupA': '直近2週間',
  'analysis.habitsTrend.groupB': 'その前の2週間',

  // Best / hardest days ------------------------------------------------------------------
  'analysis.bestWorst.label': 'いちばん良かった日とつらかった日',
  'analysis.bestWorst.describedDay': '{day}（「{title}」）',
  'analysis.bestWorst.noTitle': '無題',
  'analysis.bestWorst.extraValue': '{titles} - スコア{score}',
  'analysis.bestWorst.text':
    '気分・エネルギー・ストレスを合わせたスコアで見た、この期間の{kind, select, best {いちばん良かった日} other {いちばんつらかった日}}：{days}。',
  'analysis.bestWorst.explainScore':
    '{count, plural, other {#日}}それぞれについて、その日に記録された気分、エネルギーレベル、（11－ストレスレベル）の平均を合計スコアとして計算しました。',
  'analysis.bestWorst.explainMeans':
    'この期間の平均スコア：{overall}。{kind, select, best {{count, plural, =1 {いちばん良かった日} =3 {いちばん良かった3日間} other {いちばん良かった日々}}} other {{count, plural, =1 {いちばんつらかった日} =3 {いちばんつらかった3日間} other {いちばんつらかった日々}}}}の平均スコアは{mean}でした。',
  'analysis.bestWorst.explainDiff': '平均との差：{diff}ポイント。差の強さ：{strength}。',
  'analysis.bestWorst.title': '{kind, select, best {この期間でいちばん良かった日} other {この期間でいちばんつらかった日}}',
  'analysis.bestWorst.metric': '合計スコア（気分＋エネルギー＋反転したストレス）',
  'analysis.bestWorst.groupA': '{kind, select, best {いちばん良かった日} other {いちばんつらかった日}}',
  'analysis.bestWorst.nothing': '{count, plural, other {#日分}}のデータで{label}を確認しましたが、スコアは似通っていて、特に目立つ日はありませんでした。',

  // Streaks -------------------------------------------------------------------------------
  'analysis.streaks.label': '日記と習慣の連続記録',
  'analysis.streaks.entriesTitle': '{count, plural, other {#日}}連続で記録',
  'analysis.streaks.entriesText': 'すばらしいですね！{count, plural, other {#日}}連続で日記を書きました（{from}-{to}）。',
  'analysis.streaks.entriesExplain':
    '今日または昨日までで、記録が1件以上ある日が続いた日数を数えました。現在の連続：{count, plural, other {#日}}（{from}から{to}まで）。期間中の最長連続：{best, plural, other {#日}}。',
  'analysis.streaks.entriesMetric': '書いた日',
  'analysis.streaks.currentDays': '現在の連続日数',
  'analysis.streaks.daysWithEntry': '期間中に記録がある日',
  'analysis.streaks.habitTitle': '習慣「{habit}」が{count, plural, other {#日}}連続',
  'analysis.streaks.habitText': '習慣「{habit}」を{count, plural, other {#日}}連続で達成しました（{from}-{to}）。',
  'analysis.streaks.habitExplain':
    '今日または昨日までで、習慣「{habit}」が達成済みになっている日が続いた日数を数えました。現在の連続：{count, plural, other {#日}}。期間中の最長連続：{best, plural, other {#日}}。',
  'analysis.streaks.habitMetric': '習慣の達成：{habit}',
  'analysis.streaks.daysCompleted': '期間中に習慣を達成した日',
  'analysis.streaks.weeklyTitle': '習慣「{habit}」が{count, plural, other {#週}}連続で目標達成',
  'analysis.streaks.weeklyText': '習慣「{habit}」の目標を{count, plural, other {#週}}連続で達成しました（{from}-{to}）。',
  'analysis.streaks.weeklyExplain':
    '習慣「{habit}」について各週に記録した量を合計し、週の目標（{target}）と比べました。目標を達成した週の現在の連続：{count, plural, other {#週}}。',
  'analysis.streaks.weeklyMetric': '週の目標達成 - {habit}',
  'analysis.streaks.currentWeeks': '現在の連続週数',
  'analysis.streaks.weeksWithLogs': '期間中に記録がある週',
  'analysis.streaks.none':
    '進行中の連続記録は見つかりませんでした（対象は、日記を{entryMin}日以上続けて書いた場合、または習慣を{habitMin}日・{habitMin}週以上続けて達成した場合です）。',

  // Anomalies -----------------------------------------------------------------------------
  'analysis.anomalies.label': '気分やストレスがいつもと違った日',
  'analysis.anomalies.textOne':
    'あなたのデータでは、{day}は{metricDefined}が期間中のほかの日と比べて{gender, select, other {{side, select, high {いつになく高かった} other {いつになく低かった}}}}ようです（{value}、平均は{mean}）。',
  'analysis.anomalies.textMany':
    'あなたのデータでは、{count, plural, other {#日}}について、{metricDefined}が期間中のほかの日と比べて{gender, select, other {{side, select, high {いつになく高かった} other {いつになく低かった}}}}ようです：{days}。期間中の平均：{mean}。',
  'analysis.anomalies.textManyMore':
    'あなたのデータでは、{count, plural, other {#日}}について、{metricDefined}が期間中のほかの日と比べて{gender, select, other {{side, select, high {いつになく高かった} other {いつになく低かった}}}}ようです：{days}など。期間中の平均：{mean}。',
  'analysis.anomalies.dayItem': '{day}（{value}）',
  'analysis.anomalies.detail': '{date}：{value}（平均より{z}標準偏差{side, select, above {上} other {下}}）',
  'analysis.anomalies.explain':
    '{metric}の記録がある{count, plural, other {#日}}を確認しました。平均：{mean}、標準偏差：{sd}。平均から{z}標準偏差以上離れている日を「いつもと違う日」としています。{details}。ずれの強さ：{strength}。',
  'analysis.anomalies.title':
    '{gender, select, other {{side, select, high {{metric}がいつになく高かった} other {{metric}がいつになく低かった}}}}{count, plural, other {日}}',
  'analysis.anomalies.groupA': 'いつもと違った日',
  'analysis.anomalies.zValue': '{value}（z {z}）',
  'analysis.anomalies.nothing':
    '{count, plural, other {#日分}}のデータでいつもと違う日を確認しましたが、平均から{z}標準偏差以上離れた日は見つかりませんでした。',

  // Emotion patterns ----------------------------------------------------------------------
  'analysis.emotion.label': '日・人・場所ごとの感情のパターン',
  'analysis.emotion.metric': '感情：{emotion}',
  'analysis.emotion.groupA': '「{emotion}」を感じた日',
  'analysis.emotion.weekdayTitle': '「{emotion}」は主に{onWeekday}現れます',
  'analysis.emotion.weekdayText': 'あなたのデータでは、「{emotion}」という感情は主に{onWeekday}現れたようです（{total}回中{top}回）。',
  'analysis.emotion.weekdayExplain':
    '{count, plural, other {#日}}を確認しました。「{emotion}」が記録された日は{total, plural, other {#日}}で、そのうち{top}日が{weekdays}でした（{share}）。一方、確認したすべての日のうち{weekdays}が占める割合は{baseline}です。パターンの強さ：{strength}。',
  'analysis.emotion.groupBWeekday': 'そのうち{weekdays}',
  'analysis.emotion.weekdayShareKey': 'すべての日に占める{weekdays}の割合',
  'analysis.emotion.personTitle': '「{emotion}」と{name}',
  'analysis.emotion.placeTitle': '「{emotion}」と「{place}」',
  'analysis.emotion.personText':
    'あなたのデータでは、{name}に会った日に「{emotion}」という感情がよく現れたようです（{total}回中{with}回）。',
  'analysis.emotion.placeText':
    'あなたのデータでは、場所が「{place}」だった日に「{emotion}」という感情がよく現れたようです（{total}回中{with}回）。',
  'analysis.emotion.personExplain':
    '{count, plural, other {#日}}を確認しました。「{emotion}」が記録されたのは{total}日で、そのうち{with}日（{share}）は記録に{name}も登場していました。{name}は全{count}日のうち{baselineCount}日に登場しています（{baseline}）。パターンの強さ：{strength}。',
  'analysis.emotion.placeExplain':
    '{count, plural, other {#日}}を確認しました。「{emotion}」が記録されたのは{total}日で、そのうち{with}日（{share}）は記録に場所「{place}」も含まれていました。場所「{place}」は全{count}日のうち{baselineCount}日に登場しています（{baseline}）。パターンの強さ：{strength}。',
  'analysis.emotion.groupBPerson': 'そのうち{name}と一緒',
  'analysis.emotion.groupBPlace': 'そのうち「{place}」',
  'analysis.emotion.personShareKey': 'すべての日に占める{name}の割合',
  'analysis.emotion.placeShareKey': 'すべての日に占める場所「{place}」の割合',
  'analysis.emotion.nothing':
    '{min}回以上くり返し記録された{count, plural, other {#種類の感情}}を確認しましたが、特定の日・人・場所への目立った偏りは見つかりませんでした。',
};
export default messages;
