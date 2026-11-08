/** fr - search messages. Keys are prefixed 'search.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Search page (src/pages/SearchPage.tsx) -------------------------------------------
  'search.title': 'Recherche',
  'search.label': 'Interrogez votre journal',
  'search.hint': 'Une question libre, par exemple sur vos journées, votre humeur, votre sommeil ou des mots que vous avez écrits.',
  'search.submit': 'Rechercher',
  'search.searching': 'Recherche…',
  'search.examplesTitle': 'Exemples de questions',
  'search.recentTitle': 'Questions récentes',
  'search.clearRecent': 'Effacer',
  'search.resultsTitle': 'Résultats',
  'search.understood': 'Ce que j’ai compris',
  'search.answer': 'Réponse',
  'search.days': 'Jours',
  'search.entries': 'Entrées',
  'search.emptyQuestion': 'Saisissez une question',
  'search.untitled': 'Sans titre',
  'search.noRatings': 'Aucune note',
  'search.period': 'Période : {label}',
  'search.matches': '{count, plural, one {# résultat trouvé} other {# résultats trouvés}}',

  // Per-day metrics line under a matching day ("mood 8, energy 7, sleep 7.5 hours, 1 entry")
  'search.day.mood': 'humeur {value}',
  'search.day.energy': 'énergie {value}',
  'search.day.stress': 'stress {value}',
  'search.day.sleep': 'sommeil {hours}',
  'search.day.entries': '{count, plural, one {# entrée} other {# entrées}}',
  'search.day.separator': ', ',

  // Example questions. The server-side parser must understand these in every language
  // (keys 'search.example.1'..'search.example.6' are the contract with the search module).
  'search.example.1': 'Quels jours du mois dernier est-ce que je me sentais le mieux ?',
  'search.example.2': 'Quand ai-je écrit que j’étais fatigué ?',
  'search.example.3': 'Quels jours ai-je dormi moins de cinq heures ?',
  'search.example.4': 'Comment mon humeur a-t-elle évolué depuis trois mois ?',
  'search.example.5': 'Quels jours ai-je ressenti du stress ?',
  'search.example.6': 'Entrées avec l’étiquette travail',
};
export default messages;
