/** zh - search messages. Keys are prefixed 'search.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Search page (src/pages/SearchPage.tsx) -------------------------------------------
  'search.title': '搜索',
  'search.label': '向日记提问',
  'search.hint': '可以自由提问，例如关于某些日子、心情、睡眠，或您写过的文字。',
  'search.submit': '搜索',
  'search.searching': '正在搜索…',
  'search.examplesTitle': '示例问题',
  'search.recentTitle': '最近的问题',
  'search.clearRecent': '清除',
  'search.resultsTitle': '结果',
  'search.understood': '我对问题的理解',
  'search.answer': '回答',
  'search.days': '日期',
  'search.entries': '记录',
  'search.emptyQuestion': '请输入问题',
  'search.untitled': '无标题',
  'search.noRatings': '没有评分',
  'search.period': '时间段：{label}',
  'search.matches': '{count, plural, other {找到 # 个结果}}',

  // Per-day metrics line under a matching day ("mood 8, energy 7, sleep 7.5 hours, 1 entry")
  'search.day.mood': '心情 {value}',
  'search.day.energy': '精力 {value}',
  'search.day.stress': '压力 {value}',
  'search.day.sleep': '睡眠 {hours}',
  'search.day.entries': '{count, plural, other {# 条记录}}',
  'search.day.separator': '，',

  // Example questions. The server-side parser must understand these in every language
  // (keys 'search.example.1'..'search.example.6' are the contract with the search module).
  'search.example.1': '最近一个月里，我哪几天感觉最好？',
  'search.example.2': '我什么时候写过我很累？',
  'search.example.3': '哪几天我睡了不到五个小时？',
  'search.example.4': '最近三个月我的心情有什么变化？',
  'search.example.5': '哪些天我感到压力很大？',
  'search.example.6': '带有“工作”标签的记录',
};
export default messages;
