/** hi - insights messages. Keys are prefixed 'insights.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Insights page (src/pages/InsightsPage.tsx) ---------------------------------------
  'insights.title': 'अंतर्दृष्टियाँ',
  'insights.period': 'अवधि',
  'insights.refresh': 'रीफ़्रेश करें',
  'insights.notesTitle': 'जाँचा नहीं गया / पर्याप्त डेटा नहीं',
  'insights.disclaimer': 'ये अंतर्दृष्टियाँ आपके डेटा में संभावित संबंधों का वर्णन करती हैं। ये कारण और परिणाम साबित नहीं करतीं और चिकित्सीय सलाह नहीं हैं।',
  'insights.empty.title': 'इस अवधि के लिए अभी कोई अंतर्दृष्टि नहीं',
  'insights.empty.text':
    'पैटर्न पहचानने के लिए इस अवधि में कम से कम {minDays} दिनों का डेटा चाहिए, और तुलना के हर समूह में कम से कम {minGroupSize} दिन (उदाहरण के लिए व्यायाम वाले और बिना व्यायाम वाले दिन)। अपनी डायरी में लिखते रहें और मूड, नींद व गतिविधि दर्ज करते रहें।',
  'insights.newEntry': 'नई प्रविष्टि',
  // {inPeriod} is 'stats.period.in' ("in the last 30 days"), {start}/{end} are short dates.
  'insights.summary': '{inPeriod} डेटा वाले {count, plural, one {# दिन} other {# दिन}} ({start} – {end})',
  'insights.found': '{count, plural, =0 {कोई अंतर्दृष्टि नहीं मिली} one {# अंतर्दृष्टि मिली} other {# अंतर्दृष्टियाँ मिलीं}}',

  // Section headings (src/pages/insights/insight-groups.ts) --------------------------
  'insights.group.trends': 'रुझान',
  'insights.group.habits': 'आदतें',
  'insights.group.sleepActivity': 'नींद और गतिविधि',
  'insights.group.daysHours': 'दिन और समय',
  'insights.group.emotionsPeople': 'भावनाएँ और लोग',
  'insights.group.anomalies': 'असामान्य बातें',
  'insights.group.other': 'अन्य अंतर्दृष्टियाँ',

  // Strength and direction badges ---------------------------------------------------
  'insights.strength.strong': 'मज़बूत पैटर्न',
  'insights.strength.moderate': 'मध्यम पैटर्न',
  'insights.strength.weak': 'कमज़ोर पैटर्न',
  'insights.positive': 'उत्साहजनक',
  'insights.attention': 'ध्यान देने योग्य',

  // Insight card (src/pages/insights/InsightCard.tsx) --------------------------------
  'insights.card.why': 'मुझे यह अंतर्दृष्टि क्यों मिली?',
  'insights.card.evidenceCaption': 'इस अंतर्दृष्टि के पीछे का डेटा',
  'insights.card.relatedDays': 'संबंधित दिन',
  'insights.card.period': 'अवधि: {start} – {end}',
  'insights.card.detail': 'विवरण',
  'insights.card.value': 'मान',
  'insights.card.daysExamined': 'जाँचे गए दिन',
  'insights.card.metric': 'माप',
  'insights.card.correlation': 'सहसंबंध (r)',
  'insights.card.effectSize': 'अंतर का आकार',
  'insights.card.groupRow': '{count, plural, one {# दिन} other {# दिन}}, औसत {mean}',
  'insights.card.groupRowNoMean': '{count, plural, one {# दिन} other {# दिन}}',

  // Home page (src/pages/HomePage.tsx, GET /api/home) --------------------------------
  'insights.home.title': 'होम',
  'insights.home.newEntry': 'नई प्रविष्टि',
  'insights.home.greetingLabel': 'अभिवादन',
  'insights.home.today': 'आज',
  'insights.home.weekAverages': 'पिछले 7 दिनों के औसत',
  'insights.home.habitsToday': 'आज की आदतें',
  'insights.home.insightOfDay': 'आज की अंतर्दृष्टि',
  'insights.home.lastEntry': 'नवीनतम प्रविष्टि',
  'insights.home.noData': 'कोई डेटा नहीं',
  'insights.home.noHabits': 'कोई सक्रिय आदत नहीं।',
  'insights.home.manageHabits': 'आदतें प्रबंधित करें',
  'insights.home.allHabits': 'सभी आदतें',
  'insights.home.allInsights': 'सभी अंतर्दृष्टियाँ',
  'insights.home.noInsight': 'अभी कोई अंतर्दृष्टि नहीं। पैटर्न खोजने के लिए अपनी डायरी में लिखते रहें और नींद, मूड व गतिविधि दर्ज करते रहें।',
  'insights.home.noEntriesTitle': 'अभी तक कोई डायरी प्रविष्टि नहीं',
  'insights.home.noEntriesText': 'हर अंतर्दृष्टि की शुरुआत पहली प्रविष्टि से होती है। अपने दिन के बारे में कुछ वाक्य ही काफ़ी हैं।',
  'insights.home.firstEntry': 'पहली प्रविष्टि लिखें',
  'insights.home.untitled': 'बिना शीर्षक',
  'insights.home.streak': 'लेखन का सिलसिला: {count, plural, one {# दिन} other {# दिन}}',
  'insights.home.entriesToday': '{count, plural, =0 {आज अभी तक कोई प्रविष्टि नहीं लिखी गई} one {आज # प्रविष्टि} other {आज # प्रविष्टियाँ}}',
  'insights.home.totalEntries': '{count, plural, =0 {डायरी में कुल # प्रविष्टियाँ} one {डायरी में कुल # प्रविष्टि} other {डायरी में कुल # प्रविष्टियाँ}}',
  'insights.home.ratingOf10': '10 में से {value}',
  'insights.home.sleepHours': '{value} घंटे',
  'insights.home.lastEntryMood': 'मूड: {value}',
};
export default messages;
