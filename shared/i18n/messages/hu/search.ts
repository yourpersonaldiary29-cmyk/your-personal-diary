/** hu - search messages. Keys are prefixed 'search.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Search page (src/pages/SearchPage.tsx) -------------------------------------------
  'search.title': 'Keresés',
  'search.label': 'Kérdezd a naplódat',
  'search.hint': 'Bármilyen kérdés, például napokról, hangulatról, alvásról vagy olyan szavakról, amelyeket leírtál.',
  'search.submit': 'Keresés',
  'search.searching': 'Keresés…',
  'search.examplesTitle': 'Példakérdések',
  'search.recentTitle': 'Legutóbbi kérdések',
  'search.clearRecent': 'Törlés',
  'search.resultsTitle': 'Találatok',
  'search.understood': 'Így értettem a kérdést',
  'search.answer': 'Válasz',
  'search.days': 'Napok',
  'search.entries': 'Bejegyzések',
  'search.emptyQuestion': 'Írj be egy kérdést',
  'search.untitled': 'Cím nélkül',
  'search.noRatings': 'Nincs értékelés',
  'search.period': 'Időszak: {label}',
  'search.matches': '{count, plural, one {# találat} other {# találat}}',

  // Per-day metrics line under a matching day ("hangulat: 8, energia: 7, alvás: 7,5 óra, 1 bejegyzés")
  'search.day.mood': 'hangulat: {value}',
  'search.day.energy': 'energia: {value}',
  'search.day.stress': 'stressz: {value}',
  'search.day.sleep': 'alvás: {hours}',
  'search.day.entries': '{count, plural, one {# bejegyzés} other {# bejegyzés}}',
  'search.day.separator': ', ',

  // Example questions. The server-side parser must understand these (shared/i18n/search/hu.ts).
  'search.example.1': 'Az elmúlt hónapban mely napokon éreztem magam a legjobban?',
  'search.example.2': 'Mikor írtam, hogy fáradt vagyok?',
  'search.example.3': 'Mely napokon aludtam kevesebb, mint öt órát?',
  'search.example.4': 'Hogyan változott a hangulatom az elmúlt három hónapban?',
  'search.example.5': 'Mely napokon voltam stresszes?',
  'search.example.6': 'Bejegyzések a munka címkével',
};
export default messages;
