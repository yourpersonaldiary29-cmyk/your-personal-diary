/** it - search messages. Keys are prefixed 'search.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Search page (src/pages/SearchPage.tsx) -------------------------------------------
  'search.title': 'Ricerca',
  'search.label': 'Chiedi al tuo diario',
  'search.hint': 'Una domanda libera, per esempio su giorni, umore, sonno o parole che hai scritto.',
  'search.submit': 'Cerca',
  'search.searching': 'Ricerca in corso…',
  'search.examplesTitle': 'Esempi di domande',
  'search.recentTitle': 'Domande recenti',
  'search.clearRecent': 'Cancella',
  'search.resultsTitle': 'Risultati',
  'search.understood': 'Come ho capito la domanda',
  'search.answer': 'Risposta',
  'search.days': 'Giorni',
  'search.entries': 'Voci',
  'search.emptyQuestion': 'Scrivi una domanda',
  'search.untitled': 'Senza titolo',
  'search.noRatings': 'Nessuna valutazione',
  'search.period': 'Periodo: {label}',
  'search.matches': '{count, plural, one {# risultato trovato} other {# risultati trovati}}',

  // Per-day metrics line under a matching day ("mood 8, energy 7, sleep 7.5 hours, 1 entry")
  'search.day.mood': 'umore {value}',
  'search.day.energy': 'energia {value}',
  'search.day.stress': 'stress {value}',
  'search.day.sleep': 'sonno {hours}',
  'search.day.entries': '{count, plural, one {# voce} other {# voci}}',
  'search.day.separator': ', ',

  // Example questions. The server-side parser must understand these in every language
  // (keys 'search.example.1'..'search.example.6' are the contract with the search module).
  'search.example.1': 'In quali giorni del mese scorso stavo meglio?',
  'search.example.2': 'Quando ho scritto che ero stanco?',
  'search.example.3': 'In quali giorni ho dormito meno di cinque ore?',
  'search.example.4': 'Come è cambiato il mio umore negli ultimi tre mesi?',
  'search.example.5': 'In quali giorni ero sotto stress?',
  'search.example.6': 'Voci con il tag lavoro',
};
export default messages;
