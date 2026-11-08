/** tr - search messages. Keys are prefixed 'search.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Search page (src/pages/SearchPage.tsx) -------------------------------------------
  'search.title': 'Arama',
  'search.label': 'Günlüğünüze sorun',
  'search.hint': 'Serbest bir soru; örneğin günler, ruh hali, uyku veya yazdığınız sözcükler hakkında.',
  'search.submit': 'Ara',
  'search.searching': 'Aranıyor…',
  'search.examplesTitle': 'Örnek sorular',
  'search.recentTitle': 'Son sorular',
  'search.clearRecent': 'Temizle',
  'search.resultsTitle': 'Sonuçlar',
  'search.understood': 'Soruyu nasıl anladım',
  'search.answer': 'Yanıt',
  'search.days': 'Günler',
  'search.entries': 'Kayıtlar',
  'search.emptyQuestion': 'Bir soru yazın',
  'search.untitled': 'Başlıksız',
  'search.noRatings': 'Puan yok',
  'search.period': 'Dönem: {label}',
  'search.matches': '{count, plural, one {# eşleşme bulundu} other {# eşleşme bulundu}}',

  // Per-day metrics line under a matching day ("mood 8, energy 7, sleep 7.5 hours, 1 entry")
  'search.day.mood': 'ruh hali {value}',
  'search.day.energy': 'enerji {value}',
  'search.day.stress': 'stres {value}',
  'search.day.sleep': 'uyku {hours}',
  'search.day.entries': '{count, plural, one {# kayıt} other {# kayıt}}',
  'search.day.separator': ', ',

  // Example questions. The server-side parser must understand these in every language
  // (keys 'search.example.1'..'search.example.6' are the contract with the search module).
  // Example 3: Turkish puts "az / fazla" AFTER the number ("5 saatten az"), which the parser
  // cannot read; the example uses the pre-number form "en fazla 4 saat" instead.
  'search.example.1': 'Son bir ayda hangi günlerde kendimi en iyi hissettim?',
  'search.example.2': 'Ne zaman yorgun olduğumu yazdım?',
  'search.example.3': 'Hangi günlerde beş saatten az uyudum?',
  'search.example.4': 'Son üç ayda ruh halim nasıl değişti?',
  'search.example.5': 'Hangi günlerde stresliydim?',
  'search.example.6': 'Etiketi iş olan kayıtlar',
};
export default messages;
