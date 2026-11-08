/** ru - search messages. Keys are prefixed 'search.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Search page (src/pages/SearchPage.tsx) -------------------------------------------
  'search.title': 'Поиск',
  'search.label': 'Спросите свой дневник',
  'search.hint': 'Вопрос в свободной форме - например, о днях, настроении, сне или словах, которые вы писали.',
  'search.submit': 'Найти',
  'search.searching': 'Ищем…',
  'search.examplesTitle': 'Примеры вопросов',
  'search.recentTitle': 'Недавние вопросы',
  'search.clearRecent': 'Очистить',
  'search.resultsTitle': 'Результаты',
  'search.understood': 'Как был понят вопрос',
  'search.answer': 'Ответ',
  'search.days': 'Дни',
  'search.entries': 'Записи',
  'search.emptyQuestion': 'Введите вопрос',
  'search.untitled': 'Без названия',
  'search.noRatings': 'Нет оценок',
  'search.period': 'Период: {label}',
  'search.matches':
    '{count, plural, one {Найдено # совпадение} few {Найдено # совпадения} many {Найдено # совпадений} other {Найдено # совпадения}}',

  // Per-day metrics line under a matching day ("mood 8, energy 7, sleep 7.5 hours, 1 entry")
  'search.day.mood': 'настроение {value}',
  'search.day.energy': 'энергия {value}',
  'search.day.stress': 'стресс {value}',
  'search.day.sleep': 'сон {hours}',
  'search.day.entries': '{count, plural, one {# запись} few {# записи} many {# записей} other {# записи}}',
  'search.day.separator': ', ',

  // Example questions. The server-side parser must understand these in every language
  // (keys 'search.example.1'..'search.example.6' are the contract with the search module).
  // Phrased so that they read the same for every user (no gendered past-tense verbs where avoidable).
  'search.example.1': 'В какие дни за последний месяц мне было лучше всего?',
  'search.example.2': 'Когда я писал(а), что устал(а)?',
  'search.example.3': 'В какие дни у меня было меньше пяти часов сна?',
  'search.example.4': 'Как изменилось моё настроение за последние три месяца?',
  'search.example.5': 'В какие дни у меня был стресс?',
  'search.example.6': 'Записи с тегом «работа»',
};
export default messages;
