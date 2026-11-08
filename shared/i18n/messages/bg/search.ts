/** bg - search messages. Keys are prefixed 'search.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Search page (src/pages/SearchPage.tsx) -------------------------------------------
  'search.title': 'Търсене',
  'search.label': 'Попитайте дневника си',
  'search.hint': 'Въпрос в свободна форма - например за дни, настроение, сън или думи, които сте писали.',
  'search.submit': 'Търси',
  'search.searching': 'Търсене…',
  'search.examplesTitle': 'Примерни въпроси',
  'search.recentTitle': 'Скорошни въпроси',
  'search.clearRecent': 'Изчисти',
  'search.resultsTitle': 'Резултати',
  'search.understood': 'Как разбрах въпроса',
  'search.answer': 'Отговор',
  'search.days': 'Дни',
  'search.entries': 'Записи',
  'search.emptyQuestion': 'Въведете въпрос',
  'search.untitled': 'Без заглавие',
  'search.noRatings': 'Няма оценки',
  'search.period': 'Период: {label}',
  'search.matches': '{count, plural, one {Намерено е # съвпадение} other {Намерени са # съвпадения}}',

  // Per-day metrics line under a matching day ("mood 8, energy 7, sleep 7.5 hours, 1 entry")
  'search.day.mood': 'настроение {value}',
  'search.day.energy': 'енергия {value}',
  'search.day.stress': 'стрес {value}',
  'search.day.sleep': 'сън {hours}',
  'search.day.entries': '{count, plural, one {# запис} other {# записа}}',
  'search.day.separator': ', ',

  // Example questions. The server-side parser must understand these in every language
  // (keys 'search.example.1'..'search.example.6' are the contract with the search module).
  // The aorist ("чувствах", "писах", "спах") is the same for every user; "уморен(а)" covers both genders.
  'search.example.1': 'В кои дни през последния месец се чувствах най-добре?',
  'search.example.2': 'Кога писах, че съм уморен(а)?',
  'search.example.3': 'В кои дни спах по-малко от пет часа?',
  'search.example.4': 'Как се промени настроението ми през последните три месеца?',
  'search.example.5': 'В кои дни бях под стрес?',
  'search.example.6': 'Записи с етикет „работа“',
};
export default messages;
