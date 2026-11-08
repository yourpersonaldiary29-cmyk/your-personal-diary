/** hi - search messages. Keys are prefixed 'search.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Search page (src/pages/SearchPage.tsx) -------------------------------------------
  'search.title': 'खोज',
  'search.label': 'अपनी डायरी से पूछें',
  'search.hint': 'कोई भी सवाल, जैसे दिनों, मूड, नींद या आपके लिखे शब्दों के बारे में।',
  'search.submit': 'खोजें',
  'search.searching': 'खोजा जा रहा है…',
  'search.examplesTitle': 'उदाहरण सवाल',
  'search.recentTitle': 'हाल के सवाल',
  'search.clearRecent': 'साफ़ करें',
  'search.resultsTitle': 'परिणाम',
  'search.understood': 'मैंने सवाल को ऐसे समझा',
  'search.answer': 'जवाब',
  'search.days': 'दिन',
  'search.entries': 'प्रविष्टियाँ',
  'search.emptyQuestion': 'कोई सवाल लिखें',
  'search.untitled': 'बिना शीर्षक',
  'search.noRatings': 'कोई रेटिंग नहीं',
  'search.period': 'अवधि: {label}',
  'search.matches': '{count, plural, one {# मिलान मिला} other {# मिलान मिले}}',

  // Per-day metrics line under a matching day ("mood 8, energy 7, sleep 7.5 hours, 1 entry")
  'search.day.mood': 'मूड {value}',
  'search.day.energy': 'ऊर्जा {value}',
  'search.day.stress': 'तनाव {value}',
  'search.day.sleep': 'नींद {hours}',
  'search.day.entries': '{count, plural, one {# प्रविष्टि} other {# प्रविष्टियाँ}}',
  'search.day.separator': ', ',

  // Example questions. The server-side parser must understand these in every language
  // (keys 'search.example.1'..'search.example.6' are the contract with the search module).
  // Hindi puts comparisons after the number ("पाँच घंटे से कम"), which the parser does not read,
  // so example 3 uses the pre-number form "अधिकतम पाँच घंटे" (at most five hours).
  'search.example.1': 'पिछले महीने किन दिनों मुझे सबसे अच्छा महसूस हुआ?',
  'search.example.2': 'मैंने कब लिखा कि मुझे थकान थी?',
  'search.example.3': 'किन दिनों मैंने पाँच घंटे से कम नींद ली?',
  'search.example.4': 'पिछले तीन महीनों में मेरा मूड कैसे बदला?',
  'search.example.5': 'किन दिनों मुझे तनाव महसूस हुआ?',
  'search.example.6': 'काम टैग वाली प्रविष्टियाँ',
};
export default messages;
