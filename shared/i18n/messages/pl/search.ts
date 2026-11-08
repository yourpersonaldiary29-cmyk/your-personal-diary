/** pl - search messages. Keys are prefixed 'search.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Search page (src/pages/SearchPage.tsx) -------------------------------------------
  'search.title': 'Wyszukiwanie',
  'search.label': 'Zapytaj swój dziennik',
  'search.hint': 'Pytanie w dowolnej formie, na przykład o dni, nastrój, sen albo słowa z twoich wpisów.',
  'search.submit': 'Szukaj',
  'search.searching': 'Wyszukiwanie…',
  'search.examplesTitle': 'Przykładowe pytania',
  'search.recentTitle': 'Ostatnie pytania',
  'search.clearRecent': 'Wyczyść',
  'search.resultsTitle': 'Wyniki',
  'search.understood': 'Jak rozumiem pytanie',
  'search.answer': 'Odpowiedź',
  'search.days': 'Dni',
  'search.entries': 'Wpisy',
  'search.emptyQuestion': 'Wpisz pytanie',
  'search.untitled': 'Bez tytułu',
  'search.noRatings': 'Brak ocen',
  'search.period': 'Okres: {label}',
  'search.matches':
    '{count, plural, one {Znaleziono # wynik} few {Znaleziono # wyniki} many {Znaleziono # wyników} other {Znaleziono # wyniku}}',

  // Per-day metrics line under a matching day ("mood 8, energy 7, sleep 7.5 hours, 1 entry")
  'search.day.mood': 'nastrój {value}',
  'search.day.energy': 'energia {value}',
  'search.day.stress': 'stres {value}',
  'search.day.sleep': 'sen {hours}',
  'search.day.entries': '{count, plural, one {# wpis} few {# wpisy} many {# wpisów} other {# wpisu}}',
  'search.day.separator': ', ',

  // Example questions. The server-side parser must understand these in every language
  // (keys 'search.example.1'..'search.example.6' are the contract with the search module).
  // Phrased without masculine/feminine past-tense forms of the user.
  'search.example.1': 'Które dni w ostatnim miesiącu były dla mnie najlepsze?',
  'search.example.2': 'W których wpisach piszę o zmęczeniu?',
  'search.example.3': 'W które dni sen trwał krócej niż pięć godzin?',
  'search.example.4': 'Jak zmieniał się mój nastrój w ostatnich trzech miesiącach?',
  'search.example.5': 'W które dni dopadał mnie stres?',
  'search.example.6': 'Wpisy z tagiem praca',
};
export default messages;
