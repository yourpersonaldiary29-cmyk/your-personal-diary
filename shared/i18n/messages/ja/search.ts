/** ja - search messages. Keys are prefixed 'search.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Search page (src/pages/SearchPage.tsx) -------------------------------------------
  'search.title': '検索',
  'search.label': '日記に質問する',
  'search.hint': '日にち、気分、睡眠、書いた言葉などについて、自由に質問してください。',
  'search.submit': '検索',
  'search.searching': '検索中…',
  'search.examplesTitle': '質問の例',
  'search.recentTitle': '最近の質問',
  'search.clearRecent': 'クリア',
  'search.resultsTitle': '結果',
  'search.understood': '質問の理解',
  'search.answer': '回答',
  'search.days': '日',
  'search.entries': '記録',
  'search.emptyQuestion': '質問を入力してください',
  'search.untitled': '無題',
  'search.noRatings': '評価なし',
  'search.period': '期間：{label}',
  'search.matches': '{count, plural, other {#件見つかりました}}',

  // Per-day metrics line under a matching day ("mood 8, energy 7, sleep 7.5 hours, 1 entry")
  'search.day.mood': '気分 {value}',
  'search.day.energy': 'エネルギー {value}',
  'search.day.stress': 'ストレス {value}',
  'search.day.sleep': '睡眠 {hours}',
  'search.day.entries': '{count, plural, other {記録#件}}',
  'search.day.separator': '、',

  // Example questions. The server-side parser must understand these in every language
  // (keys 'search.example.1'..'search.example.6' are the contract with the search module).
  'search.example.1': '過去1か月で、いちばん気分が良かった日は？',
  'search.example.2': '「疲れた」と書いたのはいつ？',
  'search.example.3': '睡眠が5時間未満だった日は？',
  'search.example.4': '過去3か月で、気分はどのように変わりましたか？',
  'search.example.5': 'ストレスを感じた日はいつ？',
  'search.example.6': '「仕事」タグが付いた記録',
};
export default messages;
