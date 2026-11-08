/** ro - search messages. Keys are prefixed 'search.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Search page (src/pages/SearchPage.tsx) -------------------------------------------
  'search.title': 'Căutare',
  'search.label': 'Întreabă-ți jurnalul',
  'search.hint': 'O întrebare liberă, de exemplu despre zile, dispoziție, somn sau cuvinte pe care le-ai scris.',
  'search.submit': 'Caută',
  'search.searching': 'Se caută…',
  'search.examplesTitle': 'Exemple de întrebări',
  'search.recentTitle': 'Întrebări recente',
  'search.clearRecent': 'Golește',
  'search.resultsTitle': 'Rezultate',
  'search.understood': 'Cum am înțeles întrebarea',
  'search.answer': 'Răspuns',
  'search.days': 'Zile',
  'search.entries': 'Însemnări',
  'search.emptyQuestion': 'Scrie o întrebare',
  'search.untitled': 'Fără titlu',
  'search.noRatings': 'Fără evaluări',
  'search.period': 'Perioada: {label}',
  'search.matches': '{count, plural, one {A fost găsit un rezultat} few {Au fost găsite # rezultate} other {Au fost găsite # de rezultate}}',

  // Per-day metrics line under a matching day ("mood 8, energy 7, sleep 7.5 hours, 1 entry")
  'search.day.mood': 'dispoziție {value}',
  'search.day.energy': 'energie {value}',
  'search.day.stress': 'stres {value}',
  'search.day.sleep': 'somn {hours}',
  'search.day.entries': '{count, plural, one {# însemnare} few {# însemnări} other {# de însemnări}}',
  'search.day.separator': ', ',

  // Example questions. The server-side parser must understand these in every language
  // (keys 'search.example.1'..'search.example.6' are the contract with the search module).
  'search.example.1': 'În ce zile din ultima lună m-am simțit cel mai bine?',
  'search.example.2': 'Când am scris că eram obosit?',
  'search.example.3': 'În ce zile am dormit mai puțin de cinci ore?',
  'search.example.4': 'Cum s-a schimbat dispoziția mea în ultimele trei luni?',
  'search.example.5': 'În ce zile am fost stresat?',
  'search.example.6': 'Însemnări cu eticheta muncă',
};
export default messages;
