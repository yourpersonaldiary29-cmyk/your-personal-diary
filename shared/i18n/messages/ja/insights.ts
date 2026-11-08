/** ja - insights messages. Keys are prefixed 'insights.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Insights page (src/pages/InsightsPage.tsx) ---------------------------------------
  'insights.title': '気づき',
  'insights.period': '期間',
  'insights.refresh': '更新',
  'insights.notesTitle': '未確認／データ不足',
  'insights.disclaimer': 'ここに表示される気づきは、あなたのデータに見られる関係の可能性を示すものです。因果関係を示すものではなく、医学的な助言でもありません。',
  'insights.empty.title': 'この期間の気づきはまだありません',
  'insights.empty.text':
    'パターンを見つけるには、期間内にデータのある日が{minDays}日以上、比較する各グループ（たとえば運動した日としなかった日）に{minGroupSize}日以上必要です。日記を書き続け、気分、睡眠、活動を記録していきましょう。',
  'insights.newEntry': '新しい記録',
  // {inPeriod} is 'stats.period.in' ("in the last 30 days"), {start}/{end} are short dates.
  'insights.summary': '{inPeriod}にデータのある日：{count, plural, other {#日}}（{start}〜{end}）',
  'insights.found': '{count, plural, =0 {気づきは見つかりませんでした} other {#件の気づきが見つかりました}}',

  // Section headings (src/pages/insights/insight-groups.ts) --------------------------
  'insights.group.trends': '傾向',
  'insights.group.habits': '習慣',
  'insights.group.sleepActivity': '睡眠と活動',
  'insights.group.daysHours': '曜日と時間帯',
  'insights.group.emotionsPeople': '感情と人',
  'insights.group.anomalies': 'いつもと違う点',
  'insights.group.other': 'その他の気づき',

  // Strength and direction badges ---------------------------------------------------
  'insights.strength.strong': 'はっきりしたパターン',
  'insights.strength.moderate': 'ある程度のパターン',
  'insights.strength.weak': 'かすかなパターン',
  'insights.positive': '前向きな傾向',
  'insights.attention': '注目したい点',

  // Insight card (src/pages/insights/InsightCard.tsx) --------------------------------
  'insights.card.why': 'なぜこの気づき？',
  'insights.card.evidenceCaption': 'この気づきの根拠となるデータ',
  'insights.card.relatedDays': '関連する日',
  'insights.card.period': '期間：{start}〜{end}',
  'insights.card.detail': '項目',
  'insights.card.value': '値',
  'insights.card.daysExamined': '分析した日数',
  'insights.card.metric': '指標',
  'insights.card.correlation': '相関係数（r）',
  'insights.card.effectSize': '差の大きさ',
  'insights.card.groupRow': '{count, plural, other {#日}}、平均{mean}',
  'insights.card.groupRowNoMean': '{count, plural, other {#日}}',

  // Home page (src/pages/HomePage.tsx, GET /api/home) --------------------------------
  'insights.home.title': 'ホーム',
  'insights.home.newEntry': '新しい記録',
  'insights.home.greetingLabel': 'あいさつ',
  'insights.home.today': '今日',
  'insights.home.weekAverages': '過去7日間の平均',
  'insights.home.habitsToday': '今日の習慣',
  'insights.home.insightOfDay': '今日の気づき',
  'insights.home.lastEntry': '最新の記録',
  'insights.home.noData': 'データなし',
  'insights.home.noHabits': '取り組み中の習慣はありません。',
  'insights.home.manageHabits': '習慣を管理',
  'insights.home.allHabits': 'すべての習慣',
  'insights.home.allInsights': 'すべての気づき',
  'insights.home.noInsight': 'まだ気づきはありません。日記を書き続け、睡眠、気分、活動を記録すると、パターンが見えてきます。',
  'insights.home.noEntriesTitle': 'まだ日記の記録がありません',
  'insights.home.noEntriesText': 'すべての気づきは最初の記録から始まります。今日のことを数行書くだけで十分です。',
  'insights.home.firstEntry': '最初の記録を書く',
  'insights.home.untitled': '無題',
  'insights.home.streak': '連続記録：{count, plural, other {#日}}',
  'insights.home.entriesToday': '{count, plural, =0 {今日はまだ記録がありません} other {今日の記録：#件}}',
  'insights.home.totalEntries': '{count, plural, other {日記の記録は全部で#件}}',
  'insights.home.ratingOf10': '{value}/10',
  'insights.home.sleepHours': '{value}時間',
  'insights.home.lastEntryMood': '気分：{value}',
};
export default messages;
