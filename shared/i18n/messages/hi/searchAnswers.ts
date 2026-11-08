/**
 * hi - searchAnswers messages (server/src/search: parser explanations, period labels,
 * executor answers). Keys are prefixed 'searchAnswers.'; see shared/i18n/index.ts for the syntax.
 *
 * `{period}` is a ready phrase ("पिछले एक महीने में", "पूरी डायरी में"); Hindi puts it at the
 * start of the answers. Metric names are written per branch of `{metric, select, ...}`; where the
 * verb agrees with the metric (था / थी / थे) a second select on `metric` picks the form.
 * The zero-result answers start with the exact text of 'searchAnswers.noResults' (without the danda).
 */
const messages: Record<string, string> = {
  // Period labels (ParsedQuery.periodLabel and the {period} of every sentence) --------
  'searchAnswers.period.all': 'पूरी अवधि',
  'searchAnswers.period.allPhrase': 'पूरी डायरी में',
  'searchAnswers.period.today': 'आज',
  'searchAnswers.period.yesterday': 'कल',
  'searchAnswers.period.twoDaysAgo': 'परसों',
  'searchAnswers.period.week': 'पिछले एक सप्ताह में',
  'searchAnswers.period.month': 'पिछले एक महीने में',
  'searchAnswers.period.halfYear': 'पिछले छह महीनों में',
  'searchAnswers.period.year': 'पिछले एक साल में',
  'searchAnswers.period.startYear': 'साल की शुरुआत से',
  'searchAnswers.period.startMonth': 'महीने की शुरुआत से',
  'searchAnswers.period.recent': 'हाल के दिनों में',
  'searchAnswers.period.lastDays': '{count, plural, one {आज} other {पिछले # दिनों में}}',
  'searchAnswers.period.lastWeeks': '{count, plural, one {पिछले एक सप्ताह में} other {पिछले # सप्ताहों में}}',
  'searchAnswers.period.lastMonths': '{count, plural, one {पिछले एक महीने में} other {पिछले # महीनों में}}',
  'searchAnswers.period.lastYears': '{count, plural, one {पिछले एक साल में} other {पिछले # सालों में}}',
  'searchAnswers.period.agoDays': '{count, plural, one {एक दिन पहले} other {# दिन पहले}}',
  'searchAnswers.period.agoWeeks': '{count, plural, one {एक सप्ताह पहले} other {# सप्ताह पहले}}',
  'searchAnswers.period.agoMonths': '{count, plural, one {एक महीने पहले} other {# महीने पहले}}',
  'searchAnswers.period.agoYears': '{count, plural, one {एक साल पहले} other {# साल पहले}}',
  'searchAnswers.period.calendarMonth': '{month} {year} में',
  'searchAnswers.period.onDate': '{date} को',
  'searchAnswers.period.between': '{from} से {to} के बीच',

  // Comparators ("less than 5") ------------------------------------------------------
  'searchAnswers.comparator.lt': '{value} से कम',
  'searchAnswers.comparator.lte': 'अधिकतम {value}',
  'searchAnswers.comparator.gt': '{value} से अधिक',
  'searchAnswers.comparator.gte': 'कम से कम {value}',
  'searchAnswers.comparator.eq': 'ठीक {value}',

  // Lists and quoting ----------------------------------------------------------------
  'searchAnswers.quoted': '"{term}"',
  'searchAnswers.listSeparator': ', ',
  'searchAnswers.dayWithValues': '{day} ({values})',
  'searchAnswers.value.mood': 'मूड {value}',
  'searchAnswers.value.energy': 'ऊर्जा {value}',
  'searchAnswers.value.stress': 'तनाव {value}',
  'searchAnswers.value.sleepHours': 'नींद के घंटे {value}',
  'searchAnswers.value.sleepQuality': 'नींद की गुणवत्ता {value}',
  'searchAnswers.value.exerciseMinutes': 'व्यायाम के मिनट {value}',
  'searchAnswers.mention.something': 'कुछ',

  // "How I understood the question" (ParsedQuery.explanation) ------------------------
  'searchAnswers.explain.best': 'मैंने समझा: वे दिन जब आपको सबसे अच्छा महसूस हुआ, {period}।',
  'searchAnswers.explain.bestByMetric':
    'मैंने समझा: {metric, select, mood {मूड} energy {ऊर्जा स्तर} stress {तनाव स्तर} sleepHours {नींद के घंटों} sleepQuality {नींद की गुणवत्ता} exerciseMinutes {व्यायाम के मिनटों} other {मान}} के हिसाब से सबसे अच्छे दिन, {period}।',
  'searchAnswers.explain.worst': 'मैंने समझा: सबसे कठिन दिन, {period}।',
  'searchAnswers.explain.worstByMetric':
    'मैंने समझा: {metric, select, mood {मूड} energy {ऊर्जा स्तर} stress {तनाव स्तर} sleepHours {नींद के घंटों} sleepQuality {नींद की गुणवत्ता} exerciseMinutes {व्यायाम के मिनटों} other {मान}} के हिसाब से सबसे कठिन दिन, {period}।',
  'searchAnswers.explain.filter':
    'मैंने समझा: वे दिन जब {metric, select, mood {मूड} energy {ऊर्जा स्तर} stress {तनाव स्तर} sleepHours {नींद के घंटे} sleepQuality {नींद की गुणवत्ता} exerciseMinutes {व्यायाम के मिनट} other {मान}} {comparison} {metric, select, sleepQuality {थी} sleepHours {थे} exerciseMinutes {थे} other {था}}, {period}।',
  'searchAnswers.explain.trend':
    'मैंने समझा: {period} {metric, select, mood {आपका मूड कैसे बदला} energy {आपका ऊर्जा स्तर कैसे बदला} stress {आपका तनाव स्तर कैसे बदला} sleepHours {आपके नींद के घंटे कैसे बदले} sleepQuality {आपकी नींद की गुणवत्ता कैसे बदली} exerciseMinutes {आपके व्यायाम के मिनट कैसे बदले} other {आपके मान कैसे बदले}}।',
  'searchAnswers.explain.mention': 'मैंने समझा: वे प्रविष्टियाँ जिनमें आपने {terms} लिखा, {period}।',
  'searchAnswers.explain.mentionAny': 'मैंने समझा: आपकी लिखी प्रविष्टियाँ, {period}।',
  'searchAnswers.explain.emotion': 'मैंने समझा: वे दिन जब आपने {emotions} महसूस किया, {period}।',
  'searchAnswers.explain.list': 'मैंने समझा: {terms} वाली प्रविष्टियाँ, {period}।',
  'searchAnswers.explain.listAll': 'मैंने समझा: सभी प्रविष्टियाँ, {period}।',
  'searchAnswers.explain.unknown': 'सवाल समझ में नहीं आया। उदाहरण के लिए ऐसे पूछें: "पिछले महीने किन दिनों मुझे सबसे अच्छा महसूस हुआ?"',

  // Answers ---------------------------------------------------------------------------
  'searchAnswers.noResults': 'सवाल से मेल खाती कोई प्रविष्टि नहीं मिली।',
  'searchAnswers.noResultsPeriod': 'सवाल से मेल खाती कोई प्रविष्टि नहीं मिली ({period})।',
  'searchAnswers.rank.best': '{period} वे दिन जब आपको सबसे अच्छा महसूस हुआ: {days}।',
  'searchAnswers.rank.bestByMetric':
    '{period} {metric, select, mood {मूड} energy {ऊर्जा स्तर} stress {तनाव स्तर} sleepHours {नींद के घंटों} sleepQuality {नींद की गुणवत्ता} exerciseMinutes {व्यायाम के मिनटों} other {मान}} के हिसाब से सबसे अच्छे दिन: {days}।',
  'searchAnswers.rank.worst': '{period} सबसे कठिन दिन: {days}।',
  'searchAnswers.rank.worstByMetric':
    '{period} {metric, select, mood {मूड} energy {ऊर्जा स्तर} stress {तनाव स्तर} sleepHours {नींद के घंटों} sleepQuality {नींद की गुणवत्ता} exerciseMinutes {व्यायाम के मिनटों} other {मान}} के हिसाब से सबसे कठिन दिन: {days}।',
  'searchAnswers.filter.found':
    '{period} {count, plural, one {# ऐसा दिन मिला} other {# ऐसे दिन मिले}} जब {metric, select, mood {मूड} energy {ऊर्जा स्तर} stress {तनाव स्तर} sleepHours {नींद के घंटे} sleepQuality {नींद की गुणवत्ता} exerciseMinutes {व्यायाम के मिनट} other {मान}} {comparison} {metric, select, sleepQuality {थी} sleepHours {थे} exerciseMinutes {थे} other {था}}: {days}{more, plural, =0 {} one { और # अन्य दिन} other { और # अन्य दिन}}।',
  'searchAnswers.emotion.found':
    '{period} आपने {count, plural, one {# दिन} other {# दिन}} {emotions} महसूस किया: {days}{more, plural, =0 {} one { और # अन्य दिन} other { और # अन्य दिन}}।',
  'searchAnswers.mention.found':
    'आपने {terms} {count, plural, one {{period} # प्रविष्टि में लिखा, {first} को} other {{period} # प्रविष्टियों में लिखा; पहली बार {first} को और आख़िरी बार {last} को}}।',
  'searchAnswers.list.found': '{period} {count, plural, one {# प्रविष्टि मिली} other {# प्रविष्टियाँ मिलीं}}; सबसे नई {last} की है।',
  'searchAnswers.list.foundTerms':
    '{period} {terms} वाली {count, plural, one {# प्रविष्टि मिली} other {# प्रविष्टियाँ मिलीं}}; सबसे नई {last} की है।',
  'searchAnswers.unknown.fallback':
    'सवाल पूरी तरह स्पष्ट नहीं था, इसलिए यहाँ कुल {total} में से {count, plural, one {सबसे नई प्रविष्टि है} other {सबसे नई # प्रविष्टियाँ हैं}}। {explanation}',
  'searchAnswers.trend.insufficient':
    '{period} {metric, select, mood {आपके मूड} energy {आपके ऊर्जा स्तर} stress {आपके तनाव स्तर} sleepHours {आपके नींद के घंटों} sleepQuality {आपकी नींद की गुणवत्ता} exerciseMinutes {आपके व्यायाम के मिनटों} other {आपके मानों}} में रुझान पहचानने के लिए पर्याप्त डेटा नहीं है।',
  'searchAnswers.trend.evidence':
    '(अवधि की शुरुआत के {first, plural, one {# दिन} other {# दिनों}} बनाम अंत के {last, plural, one {# दिन} other {# दिनों}} के आधार पर)',
  'searchAnswers.trend.stable':
    '{period} {metric, select, mood {आपका औसत मूड स्थिर रहा} energy {आपका औसत ऊर्जा स्तर स्थिर रहा} stress {आपका औसत तनाव स्तर स्थिर रहा} sleepHours {आपके औसत नींद के घंटे स्थिर रहे} sleepQuality {आपकी औसत नींद की गुणवत्ता स्थिर रही} exerciseMinutes {आपके औसत व्यायाम के मिनट स्थिर रहे} other {आपका औसत मान स्थिर रहा}}: {from} बनाम {to} {evidence}।',
  'searchAnswers.trend.up':
    '{period} {metric, select, mood {आपका औसत मूड} energy {आपका औसत ऊर्जा स्तर} stress {आपका औसत तनाव स्तर} sleepHours {आपके औसत नींद के घंटे} sleepQuality {आपकी औसत नींद की गुणवत्ता} exerciseMinutes {आपके औसत व्यायाम के मिनट} other {आपका औसत मान}} {from} से {metric, select, sleepQuality {बढ़कर {to} हो गई} sleepHours {बढ़कर {to} हो गए} exerciseMinutes {बढ़कर {to} हो गए} other {बढ़कर {to} हो गया}} {evidence}।',
  'searchAnswers.trend.down':
    '{period} {metric, select, mood {आपका औसत मूड} energy {आपका औसत ऊर्जा स्तर} stress {आपका औसत तनाव स्तर} sleepHours {आपके औसत नींद के घंटे} sleepQuality {आपकी औसत नींद की गुणवत्ता} exerciseMinutes {आपके औसत व्यायाम के मिनट} other {आपका औसत मान}} {from} से {metric, select, sleepQuality {घटकर {to} हो गई} sleepHours {घटकर {to} हो गए} exerciseMinutes {घटकर {to} हो गए} other {घटकर {to} हो गया}} {evidence}।',

  // Request validation (POST /api/search) ----------------------------------------------
  'searchAnswers.validation.body': 'अनुरोध के मुख्य भाग में एक सवाल (query) होना चाहिए',
  'searchAnswers.validation.query': 'कोई सवाल लिखें',
  'searchAnswers.validation.queryTooLong': 'सवाल बहुत लंबा है (अधिकतम {max} वर्ण)',
  'searchAnswers.validation.limit': 'परिणामों की संख्या 1 से {max} के बीच की पूर्ण संख्या होनी चाहिए',
};
export default messages;
