/** ar - search messages. Keys are prefixed 'search.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Search page (src/pages/SearchPage.tsx) -------------------------------------------
  'search.title': 'البحث',
  'search.label': 'سؤالك ليومياتك',
  'search.hint': 'سؤال بصياغة حرة، مثلًا عن الأيام أو المزاج أو النوم أو كلمات كتبتها.',
  'search.submit': 'بحث',
  'search.searching': 'جارٍ البحث…',
  'search.examplesTitle': 'أمثلة على الأسئلة',
  'search.recentTitle': 'الأسئلة الأخيرة',
  'search.clearRecent': 'مسح',
  'search.resultsTitle': 'النتائج',
  'search.understood': 'كيف فهمتُ السؤال',
  'search.answer': 'الإجابة',
  'search.days': 'الأيام',
  'search.entries': 'التدوينات',
  'search.emptyQuestion': 'يُرجى كتابة سؤال',
  'search.untitled': 'بلا عنوان',
  'search.noRatings': 'لا توجد تقييمات',
  'search.period': 'الفترة: {label}',
  'search.matches':
    '{count, plural, zero {لم يُعثر على نتائج} one {تم العثور على نتيجة واحدة} two {تم العثور على نتيجتين} few {تم العثور على # نتائج} many {تم العثور على # نتيجة} other {تم العثور على # نتيجة}}',

  // Per-day metrics line under a matching day ("mood 8, energy 7, sleep 7.5 hours, 1 entry")
  'search.day.mood': 'المزاج {value}',
  'search.day.energy': 'الطاقة {value}',
  'search.day.stress': 'التوتر {value}',
  'search.day.sleep': 'النوم {hours}',
  'search.day.entries': '{count, plural, zero {# تدوينة} one {تدوينة واحدة} two {تدوينتان} few {# تدوينات} many {# تدوينة} other {# تدوينة}}',
  'search.day.separator': '، ',

  // Example questions. The server-side parser must understand these in every language
  // (keys 'search.example.1'..'search.example.6' are the contract with the search module).
  'search.example.1': 'ما الأيام التي شعرت فيها بأفضل حال خلال الشهر الأخير؟',
  'search.example.2': 'متى كتبت أنني متعب؟',
  'search.example.3': 'في أي أيام نمت أقل من خمس ساعات؟',
  'search.example.4': 'كيف تغيّر مزاجي خلال آخر ثلاثة أشهر؟',
  'search.example.5': 'في أي أيام كنت متوترًا؟',
  'search.example.6': 'التدوينات التي تحمل الوسم «عمل»',
};
export default messages;
