/** de - search messages. Keys are prefixed 'search.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Search page (src/pages/SearchPage.tsx) -------------------------------------------
  'search.title': 'Suche',
  'search.label': 'Frag dein Tagebuch',
  'search.hint': 'Eine frei formulierte Frage, zum Beispiel zu Tagen, Stimmung, Schlaf oder Wörtern, die du geschrieben hast.',
  'search.submit': 'Suchen',
  'search.searching': 'Suche läuft…',
  'search.examplesTitle': 'Beispielfragen',
  'search.recentTitle': 'Letzte Fragen',
  'search.clearRecent': 'Leeren',
  'search.resultsTitle': 'Ergebnisse',
  'search.understood': 'So habe ich die Frage verstanden',
  'search.answer': 'Antwort',
  'search.days': 'Tage',
  'search.entries': 'Einträge',
  'search.emptyQuestion': 'Gib eine Frage ein',
  'search.untitled': 'Ohne Titel',
  'search.noRatings': 'Keine Bewertungen',
  'search.period': 'Zeitraum: {label}',
  'search.matches': '{count, plural, one {# Treffer gefunden} other {# Treffer gefunden}}',

  // Per-day metrics line under a matching day ("mood 8, energy 7, sleep 7.5 hours, 1 entry")
  'search.day.mood': 'Stimmung {value}',
  'search.day.energy': 'Energie {value}',
  'search.day.stress': 'Stress {value}',
  'search.day.sleep': 'Schlaf {hours}',
  'search.day.entries': '{count, plural, one {# Eintrag} other {# Einträge}}',
  'search.day.separator': ', ',

  // Example questions. The server-side parser must understand these in every language
  // (keys 'search.example.1'..'search.example.6' are the contract with the search module).
  'search.example.1': 'An welchen Tagen im letzten Monat habe ich mich am besten gefühlt?',
  'search.example.2': 'Wann habe ich geschrieben, dass ich müde war?',
  'search.example.3': 'An welchen Tagen habe ich weniger als fünf Stunden geschlafen?',
  'search.example.4': 'Wie hat sich meine Stimmung in den letzten drei Monaten verändert?',
  'search.example.5': 'An welchen Tagen war ich gestresst?',
  'search.example.6': 'Einträge mit dem Schlagwort Arbeit',
};
export default messages;
