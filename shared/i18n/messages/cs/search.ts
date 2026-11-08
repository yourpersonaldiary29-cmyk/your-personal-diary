/** cs - search messages. Keys are prefixed 'search.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Search page (src/pages/SearchPage.tsx) -------------------------------------------
  'search.title': 'Hledání',
  'search.label': 'Zeptej se svého deníku',
  'search.hint': 'Libovolná otázka, například na dny, náladu, spánek nebo slova z tvých záznamů.',
  'search.submit': 'Hledat',
  'search.searching': 'Hledá se…',
  'search.examplesTitle': 'Příklady otázek',
  'search.recentTitle': 'Nedávné otázky',
  'search.clearRecent': 'Vymazat',
  'search.resultsTitle': 'Výsledky',
  'search.understood': 'Jak rozumím otázce',
  'search.answer': 'Odpověď',
  'search.days': 'Dny',
  'search.entries': 'Záznamy',
  'search.emptyQuestion': 'Napiš otázku',
  'search.untitled': 'Bez názvu',
  'search.noRatings': 'Bez hodnocení',
  'search.period': 'Období: {label}',
  'search.matches': '{count, plural, one {Nalezena # shoda} few {Nalezeny # shody} many {Nalezeno # shody} other {Nalezeno # shod}}',

  // Per-day metrics line under a matching day ("nálada 8, energie 7, spánek 7,5 hodiny, 1 záznam")
  'search.day.mood': 'nálada {value}',
  'search.day.energy': 'energie {value}',
  'search.day.stress': 'stres {value}',
  'search.day.sleep': 'spánek {hours}',
  'search.day.entries': '{count, plural, one {# záznam} few {# záznamy} many {# záznamu} other {# záznamů}}',
  'search.day.separator': ', ',

  // Example questions. The server-side parser must understand these (shared/i18n/search/cs.ts).
  'search.example.1': 'Které dny za poslední měsíc byly nejlepší?',
  'search.example.2': 'Kdy jsem psal, že jsem unavený?',
  'search.example.3': 'Ve kterých dnech trval můj spánek méně než pět hodin?',
  'search.example.4': 'Jak se změnila moje nálada za poslední tři měsíce?',
  'search.example.5': 'Ve kterých dnech mě trápil stres?',
  'search.example.6': 'Záznamy se štítkem práce',
};
export default messages;
