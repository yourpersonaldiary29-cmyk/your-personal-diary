/** en - search messages. Keys are prefixed 'search.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Search page (src/pages/SearchPage.tsx) -------------------------------------------
  'search.title': 'Search',
  'search.label': 'Ask your diary',
  'search.hint': 'A free-form question, for example about days, mood, sleep or words you wrote.',
  'search.submit': 'Search',
  'search.searching': 'Searching…',
  'search.examplesTitle': 'Example questions',
  'search.recentTitle': 'Recent questions',
  'search.clearRecent': 'Clear',
  'search.resultsTitle': 'Results',
  'search.understood': 'How I understood the question',
  'search.answer': 'Answer',
  'search.days': 'Days',
  'search.entries': 'Entries',
  'search.emptyQuestion': 'Type a question',
  'search.untitled': 'Untitled',
  'search.noRatings': 'No ratings',
  'search.period': 'Period: {label}',
  'search.matches': '{count, plural, one {# match found} other {# matches found}}',

  // Per-day metrics line under a matching day ("mood 8, energy 7, sleep 7.5 hours, 1 entry")
  'search.day.mood': 'mood {value}',
  'search.day.energy': 'energy {value}',
  'search.day.stress': 'stress {value}',
  'search.day.sleep': 'sleep {hours}',
  'search.day.entries': '{count, plural, one {# entry} other {# entries}}',
  'search.day.separator': ', ',

  // Example questions. The server-side parser must understand these in every language
  // (keys 'search.example.1'..'search.example.6' are the contract with the search module).
  'search.example.1': 'Which days in the last month did I feel best?',
  'search.example.2': 'When did I write that I was tired?',
  'search.example.3': 'On which days did I sleep less than five hours?',
  'search.example.4': 'How did my mood change over the last three months?',
  'search.example.5': 'On which days was I stressed?',
  'search.example.6': 'Entries with the tag work',
};
export default messages;
