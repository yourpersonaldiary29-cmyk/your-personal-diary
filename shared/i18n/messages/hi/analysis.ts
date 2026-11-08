/**
 * hi - analysis messages (server-side insight templates, notes and labels). Keys are prefixed
 * 'analysis.'; see shared/i18n/index.ts for the template syntax and en/analysis.ts for the conventions.
 *
 * Hindi notes:
 *  - Every sentence is hedged ("ऐसा लगता है कि...", "संबंध हो सकता है") and never causal.
 *  - `gender` is the grammatical gender of the metric's `defined` form: 'm' (मूड, ऊर्जा स्तर,
 *    तनाव स्तर) or 'f' (नींद की गुणवत्ता, ... की संख्या). The possessive (आपका / आपकी) and the
 *    verb (था / थी) agree with it, so the templates select on it.
 *  - Sentences about the user avoid gendered verb forms (आपने ... किया, आपकी नींद ... रही), so they
 *    read correctly for every user.
 */
const messages: Record<string, string> = {
  // Engine / provider -----------------------------------------------------------------
  'analysis.engine.providerFailed': 'पैटर्न विश्लेषण पूरा नहीं हो सका (आंतरिक त्रुटि)। कृपया बाद में फिर से कोशिश करें।',
  'analysis.engine.detectorFailed': 'जाँच "{label}" पूरी नहीं हो सकी (आंतरिक त्रुटि); बाकी अंतर्दृष्टियाँ ठीक हैं।',

  // Strength --------------------------------------------------------------------------
  'analysis.strength.weak': 'कमज़ोर',
  'analysis.strength.moderate': 'मध्यम',
  'analysis.strength.strong': 'मज़बूत',

  // Metrics: label (short, standalone), defined (subject inside a sentence), gender -----
  'analysis.metric.mood.label': 'मूड',
  'analysis.metric.mood.defined': 'मूड',
  'analysis.metric.mood.gender': 'm',
  'analysis.metric.energy.label': 'ऊर्जा स्तर',
  'analysis.metric.energy.defined': 'ऊर्जा स्तर',
  'analysis.metric.energy.gender': 'm',
  'analysis.metric.stress.label': 'तनाव स्तर',
  'analysis.metric.stress.defined': 'तनाव स्तर',
  'analysis.metric.stress.gender': 'm',
  'analysis.metric.sleepHours.label': 'नींद के घंटे',
  'analysis.metric.sleepHours.defined': 'नींद के घंटों की संख्या',
  'analysis.metric.sleepHours.gender': 'f',
  'analysis.metric.sleepQuality.label': 'नींद की गुणवत्ता',
  'analysis.metric.sleepQuality.defined': 'नींद की गुणवत्ता',
  'analysis.metric.sleepQuality.gender': 'f',
  'analysis.metric.exerciseMinutes.label': 'व्यायाम के मिनट',
  'analysis.metric.exerciseMinutes.defined': 'व्यायाम के मिनटों की संख्या',
  'analysis.metric.exerciseMinutes.gender': 'f',
  'analysis.metric.entries.label': 'डायरी प्रविष्टियाँ',
  'analysis.metric.entries.defined': 'प्रविष्टियों की संख्या',
  'analysis.metric.entries.gender': 'f',

  // Counts and dates ------------------------------------------------------------------
  'analysis.count.days': '{count, plural, one {# दिन} other {# दिन}}',
  'analysis.count.weeks': '{count, plural, one {# सप्ताह} other {# सप्ताह}}',
  'analysis.date.dayWithDate': '{weekday}, {date}',

  // Weekdays (index 0 = Sunday) --------------------------------------------------------
  'analysis.weekday.plural.0': 'रविवार',
  'analysis.weekday.plural.1': 'सोमवार',
  'analysis.weekday.plural.2': 'मंगलवार',
  'analysis.weekday.plural.3': 'बुधवार',
  'analysis.weekday.plural.4': 'गुरुवार',
  'analysis.weekday.plural.5': 'शुक्रवार',
  'analysis.weekday.plural.6': 'शनिवार',
  'analysis.weekday.on.0': 'रविवार को',
  'analysis.weekday.on.1': 'सोमवार को',
  'analysis.weekday.on.2': 'मंगलवार को',
  'analysis.weekday.on.3': 'बुधवार को',
  'analysis.weekday.on.4': 'गुरुवार को',
  'analysis.weekday.on.5': 'शुक्रवार को',
  'analysis.weekday.on.6': 'शनिवार को',

  // Notes shared by the detectors -------------------------------------------------------
  'analysis.note.insufficient': '{what} की जाँच के लिए अभी पर्याप्त डेटा नहीं है (कम से कम {required} चाहिए; अभी: {have})।',
  'analysis.note.insufficientWhether': '{what}, यह जाँचने के लिए अभी पर्याप्त डेटा नहीं है (कम से कम {required} चाहिए; अभी: {have})।',
  'analysis.note.nothingNotable': 'मैंने {count, plural, one {# दिन} other {# दिनों}} में {what} की जाँच की और कोई उल्लेखनीय अंतर नहीं मिला।',

  // Requirement / availability phrases used inside the notes above ----------------------
  'analysis.req.daysBothValues': '{count, plural, one {दोनों मानों वाला # दिन} other {दोनों मानों वाले # दिन}}',
  'analysis.req.daysPerGroup': '{count, plural, one {हर समूह में # दिन} other {हर समूह में # दिन}}',
  'analysis.req.daysWithReport': '{count, plural, one {दर्ज डेटा वाला # दिन} other {दर्ज डेटा वाले # दिन}}',
  'analysis.req.daysWithRatings': '{count, plural, one {रेटिंग वाला # दिन} other {रेटिंग वाले # दिन}}',
  'analysis.req.daysPerMonth': '{count, plural, one {हर महीने दर्ज डेटा वाला # दिन} other {हर महीने दर्ज डेटा वाले # दिन}}',
  'analysis.req.recentDays': '{count, plural, one {पिछले दो सप्ताह में दर्ज डेटा वाला # दिन} other {पिछले दो सप्ताह में दर्ज डेटा वाले # दिन}}',
  'analysis.req.fullWeeks': '{count, plural, one {दर्ज डेटा वाला # पूरा सप्ताह} other {दर्ज डेटा वाले # पूरे सप्ताह}}',
  'analysis.req.weeksOfLogs': '{count, plural, one {# सप्ताह के रिकॉर्ड} other {# सप्ताहों के रिकॉर्ड}}',
  'analysis.req.weekPerGroup': 'हर समूह में एक सप्ताह और हर समूह में दर्ज डेटा वाले {count, plural, one {# दिन} other {# दिन}}',
  'analysis.req.moodReports': '{count, plural, one {मूड का # दर्ज मान} other {मूड के # दर्ज मान}}',
  'analysis.req.reportsInWindow': '{count, plural, one {एक ही समय-खंड में # दर्ज मान} other {एक ही समय-खंड में # दर्ज मान}}',
  'analysis.req.emotionRepeated': 'कोई एक भावना, जो {count, plural, one {# दिन} other {# दिनों}} में दर्ज हुई हो',
  'analysis.have.twoGroups': '{groupA}: {countA, plural, one {# दिन} other {# दिन}}; {groupB}: {countB, plural, one {# दिन} other {# दिन}}',
  'analysis.have.weeksTwoGroups':
    'लक्ष्य पूरा करने वाले सप्ताह: {metWeeks, plural, one {# सप्ताह} other {# सप्ताह}} ({metDays, plural, one {# दिन} other {# दिन}}); लक्ष्य से नीचे रहे सप्ताह: {belowWeeks, plural, one {# सप्ताह} other {# सप्ताह}} ({belowDays, plural, one {# दिन} other {# दिन}})',
  'analysis.have.twoMonths': '{cur} में {countA, plural, one {# दिन} other {# दिन}} और {prev} में {countB, plural, one {# दिन} other {# दिन}}',
  'analysis.have.noData': 'कोई डेटा नहीं',
  'analysis.have.noSuchEmotion': 'अभी कोई नहीं',
  'analysis.have.fewerInEveryWindow': 'हर समय-खंड में इससे कम',

  // Sentences shared by the group-comparison detectors ----------------------------------
  'analysis.relation.text':
    'ऐसा लगता है कि आपके डेटा में, {condition} {gender, select, f {आपकी {metricDefined} औसतन {direction, select, higher {अधिक थी} other {कम थी}}} other {आपका {metricDefined} औसतन {direction, select, higher {अधिक था} other {कम था}}}} ({meanA} बनाम {meanB})।',
  'analysis.correlation.text':
    'ऐसा लगता है कि आपके डेटा में {x} और {y} के बीच संबंध हो सकता है: {xGender, select, f {जब आपकी {x} अधिक थी} other {जब आपका {x} अधिक था}}, तब {yGender, select, f {आपकी {y} अक्सर {direction, select, higher {अधिक रही} other {कम रही}}} other {आपका {y} अक्सर {direction, select, higher {अधिक रहा} other {कम रहा}}}} (सहसंबंध {r})।',
  'analysis.explain.checkedDays': 'मैंने {count, plural, one {# दिन} other {# दिनों}} की जाँच की।',
  'analysis.explain.onDaysCondition': '{count, plural, one {# दिन} other {# दिन}} {conditionPast}।',
  'analysis.explain.groupMeans':
    'उन दिनों {gender, select, f {आपकी औसत {metricDefined} {meanA} थी} other {आपका औसत {metricDefined} {meanA} था}}, जबकि बाकी दिनों में {meanB}।',
  'analysis.explain.correlation': 'सहसंबंध: {r}।',
  'analysis.explain.correlationBetween': 'सहसंबंध ({predictor} बनाम {outcome}): {r}।',
  'analysis.explain.diffAndStrength': 'औसतों के बीच अंतर: {diff} अंक। पैटर्न की मज़बूती: {strength}।',
  'analysis.explain.diffStrength': 'अंतर: {diff} अंक। पैटर्न की मज़बूती: {strength}।',
  'analysis.split.corrExplainChecked': 'मैंने {count, plural, one {# दिन} other {# दिनों}} की जाँच की, जिनमें {x} और {y} दोनों दर्ज थे।',
  'analysis.split.corrExplainPearson': 'पियर्सन सहसंबंध: {r} (मज़बूती: {strength})।',
  'analysis.split.corrExplainGroups':
    'औसतों की तुलना के लिए हर समूह में पर्याप्त दिन नहीं थे ({groupA}: {countA, plural, one {# दिन} other {# दिन}}; {groupB}: {countB, plural, one {# दिन} other {# दिन}}; हर समूह में कम से कम {min} चाहिए)।',

  // Evidence table keys ---------------------------------------------------------------
  'analysis.extra.predictor': 'तुलना का आधार',
  'analysis.extra.strength': 'मज़बूती',
  'analysis.extra.meanDiff': 'औसत अंतर (A घटा B)',
  'analysis.extra.cohenD': 'अंतर का मानकीकृत आकार (Cohen का d)',
  'analysis.extra.weeksChecked': 'जाँचे गए सप्ताह',
  'analysis.extra.weeklyTarget': 'साप्ताहिक लक्ष्य',
  'analysis.extra.target': 'लक्ष्य',
  'analysis.extra.frequency': 'आवृत्ति',
  'analysis.extra.periodMean': 'अवधि का औसत',
  'analysis.extra.overallMean': 'कुल औसत',
  'analysis.extra.stddev': 'मानक विचलन',
  'analysis.extra.slopePerDay': 'प्रति दिन ढलान',
  'analysis.extra.daysInWindow': 'समय-खंड में दिन',
  'analysis.extra.movingWindow': 'चल औसत का समय-खंड',
  'analysis.extra.relativeChange': 'सापेक्ष बदलाव',
  'analysis.extra.longestStreak': 'अवधि का सबसे लंबा सिलसिला',
  'analysis.extra.shareOfEmotionDays': 'भावना वाले दिनों में हिस्सा',
  'analysis.frequency.daily': 'रोज़ाना',
  'analysis.frequency.weekly': 'साप्ताहिक',
  'analysis.groupB.otherDays': 'बाकी दिन',

  // Sleep detectors -------------------------------------------------------------------
  'analysis.sleep.groupA': '{hours} घंटे से कम नींद वाले दिन',
  'analysis.sleep.groupB': '{hours} घंटे या उससे अधिक नींद वाले दिन',
  'analysis.sleep.condition': 'जिन दिनों आपकी नींद {hours} घंटे से कम रही, उन दिनों',
  'analysis.sleep.conditionPast': 'आपकी नींद {hours} घंटे से कम रही',
  'analysis.sleepMood.label': 'नींद और मूड के बीच संबंध',
  'analysis.sleepMood.title': '{direction, select, lower {कम नींद और मूड का निचला स्तर} other {कम नींद और मूड का ऊँचा स्तर}}',
  'analysis.sleepMood.corrTitle': 'नींद के घंटों और मूड के बीच संभावित संबंध',
  'analysis.sleepEnergy.label': 'नींद और ऊर्जा स्तर के बीच संबंध',
  'analysis.sleepEnergy.title': '{direction, select, lower {कम नींद और ऊर्जा का निचला स्तर} other {कम नींद और ऊर्जा का ऊँचा स्तर}}',
  'analysis.sleepEnergy.corrTitle': 'नींद के घंटों और ऊर्जा स्तर के बीच संभावित संबंध',

  // Exercise detectors ----------------------------------------------------------------
  'analysis.exercise.groupA': 'शारीरिक गतिविधि वाले दिन',
  'analysis.exercise.groupB': 'बिना शारीरिक गतिविधि वाले दिन',
  'analysis.exercise.condition': 'जिन दिनों आपने व्यायाम किया, उन दिनों',
  'analysis.exercise.conditionPast': 'आपने व्यायाम किया',
  'analysis.exerciseMood.label': 'शारीरिक गतिविधि और मूड के बीच संबंध',
  'analysis.exerciseMood.title': '{direction, select, higher {शारीरिक गतिविधि और मूड का ऊँचा स्तर} other {शारीरिक गतिविधि और मूड का निचला स्तर}}',
  'analysis.exerciseMood.corrTitle': 'व्यायाम के मिनटों और मूड के बीच संभावित संबंध',
  'analysis.exerciseEnergy.label': 'शारीरिक गतिविधि और ऊर्जा स्तर के बीच संबंध',
  'analysis.exerciseEnergy.title': '{direction, select, higher {शारीरिक गतिविधि और ऊर्जा का ऊँचा स्तर} other {शारीरिक गतिविधि और ऊर्जा का निचला स्तर}}',
  'analysis.exerciseEnergy.corrTitle': 'व्यायाम के मिनटों और ऊर्जा स्तर के बीच संभावित संबंध',

  // Habit - mood / energy / stress ------------------------------------------------------
  'analysis.habit.detectorLabel': 'आदतों और मूड के बीच संबंध',
  'analysis.habit.noHabits': 'कोई सक्रिय आदत नहीं है, इसलिए मैंने आदतों और मूड के बीच संबंध की जाँच नहीं की।',
  'analysis.habit.noLogs': 'आदत "{habit}" का इस अवधि में अभी कोई रिकॉर्ड नहीं है, इसलिए मैंने इसके और मूड के बीच संबंध की जाँच नहीं की।',
  'analysis.habit.noFullWeeks': 'आदत "{habit}" के अभी तक किसी पूरे सप्ताह के रिकॉर्ड नहीं हैं, इसलिए मैंने इसके और मूड के बीच संबंध की जाँच नहीं की।',
  'analysis.habit.label': 'आदत "{habit}" और {metric} के बीच संबंध',
  'analysis.habit.groupA': 'वे दिन जब आदत "{habit}" पूरी हुई',
  'analysis.habit.groupB': 'वे दिन जब आदत "{habit}" पूरी नहीं हुई',
  'analysis.habit.condition': 'जिन दिनों आपने आदत "{habit}" पूरी की, उन दिनों',
  'analysis.habit.conditionPast': 'आपने आदत "{habit}" पूरी की',
  'analysis.habit.title':
    'आदत "{habit}" वाले दिनों में {gender, select, other {{direction, select, higher {{metric} अधिक} other {{metric} कम}}}}',
  'analysis.habit.corrTitle': 'आदत "{habit}" और {metric} के बीच संभावित संबंध',
  'analysis.habit.weeklyCondition': 'जिन सप्ताहों में आपने आदत "{habit}" का लक्ष्य पूरा किया, उनमें',
  'analysis.habit.weeklyTarget': 'प्रति सप्ताह {target} {unit}',
  'analysis.habit.targetValue': '{target} {unit}',
  'analysis.habit.weeklyExplainChecked':
    'मैंने {weeks, plural, one {# पूरे सप्ताह} other {# पूरे सप्ताहों}} की जाँच की ({days, plural, one {# दिन} other {# दिन}}, जिनमें {metric} दर्ज था)।',
  'analysis.habit.weeklyExplainMet': '{count, plural, one {# सप्ताह} other {# सप्ताहों}} में आपने आदत का लक्ष्य ({target}) पूरा किया।',
  'analysis.habit.weeklyExplainMeans':
    'उन सप्ताहों के दिनों में {gender, select, f {आपकी औसत {metricDefined} {meanA} थी} other {आपका औसत {metricDefined} {meanA} था}}, जबकि लक्ष्य से नीचे रहे {count, plural, one {# सप्ताह} other {# सप्ताहों}} के दिनों में {meanB}।',
  'analysis.habit.groupAWeeks': 'लक्ष्य पूरा करने वाले सप्ताहों के दिन ({count, plural, one {# सप्ताह} other {# सप्ताह}})',
  'analysis.habit.groupBWeeks': 'लक्ष्य से नीचे रहे सप्ताहों के दिन ({count, plural, one {# सप्ताह} other {# सप्ताह}})',

  // Weekday differences -----------------------------------------------------------------
  'analysis.weekday.label': 'सप्ताह के दिनों के बीच अंतर',
  'analysis.weekday.text':
    'ऐसा लगता है कि आपके डेटा में, {onWeekday} {gender, select, f {आपकी {metricDefined} सप्ताह के बाकी दिनों की तुलना में औसतन {direction, select, higher {अधिक थी} other {कम थी}}} other {आपका {metricDefined} सप्ताह के बाकी दिनों की तुलना में औसतन {direction, select, higher {अधिक था} other {कम था}}}} ({meanA} बनाम {meanB})।',
  'analysis.weekday.explainChecked': 'मैंने {count, plural, one {# दिन} other {# दिनों}} की जाँच की, जिनमें {metric} दर्ज था; उनमें से {countA} दिन {weekdays} थे।',
  'analysis.weekday.explainMeans':
    '{onWeekday} {gender, select, f {आपकी औसत {metricDefined} {meanA} थी} other {आपका औसत {metricDefined} {meanA} था}}, जबकि बाकी दिनों में {meanB}।',
  'analysis.weekday.title':
    '{weekdays}: {gender, select, other {{direction, select, higher {{metric} बाकी दिनों से अधिक} other {{metric} बाकी दिनों से कम}}}}',
  'analysis.weekday.groupB': 'सप्ताह के बाकी दिन',
  'analysis.weekday.tableValue': '{mean} ({count, plural, one {# दिन} other {# दिन}})',
  'analysis.weekday.nothing': 'मैंने {count, plural, one {# दिन} other {# दिनों}} में सप्ताह के दिनों के बीच अंतर की जाँच की और कोई उल्लेखनीय अंतर नहीं मिला।',

  // Time of day -------------------------------------------------------------------------
  'analysis.timeOfDay.label': 'लिखने के समय और मूड के बीच संबंध',
  'analysis.timeOfDay.morning.label': 'सुबह',
  'analysis.timeOfDay.morning.phrase': 'सुबह के समय',
  'analysis.timeOfDay.late_morning.label': 'देर सुबह',
  'analysis.timeOfDay.late_morning.phrase': 'देर सुबह के समय',
  'analysis.timeOfDay.afternoon.label': 'दोपहर',
  'analysis.timeOfDay.afternoon.phrase': 'दोपहर में',
  'analysis.timeOfDay.evening.label': 'शाम',
  'analysis.timeOfDay.evening.phrase': 'शाम को',
  'analysis.timeOfDay.night.label': 'रात',
  'analysis.timeOfDay.night.phrase': 'रात में',
  'analysis.timeOfDay.tableKey': '{label} ({hours})',
  'analysis.timeOfDay.tableValue': 'औसत {mean}, {count, plural, one {# बार दर्ज} other {# बार दर्ज}}',
  'analysis.timeOfDay.tableRow': '{key}: {value}',
  'analysis.timeOfDay.nothing': 'मैंने {count, plural, one {# दर्ज मूड} other {# दर्ज मूड}} में {label} की जाँच की और कोई ऐसा समय-खंड नहीं मिला जो औसत से ऊपर अलग दिखे।',
  'analysis.timeOfDay.text':
    'ऐसा लगता है कि आपके डेटा में {phrase} ({hours}) दर्ज किया गया मूड सबसे ऊँचा था: औसतन {mean}, जबकि सभी दर्ज मूड का औसत {overall} था।',
  'analysis.timeOfDay.explainChecked':
    'मैंने {days, plural, one {# दिन} other {# दिनों}} के {count, plural, one {# दर्ज मूड} other {# दर्ज मूड}} की जाँच की, इस आधार पर कि प्रविष्टि किस समय लिखी गई।',
  'analysis.timeOfDay.explainTable': '{table}। कुल औसत: {overall}।',
  'analysis.timeOfDay.explainDiff': 'सबसे ऊँचे समय-खंड और कुल औसत के बीच अंतर: {diff} अंक। पैटर्न की मज़बूती: {strength}।',
  'analysis.timeOfDay.title': '{phrase} मूड बेहतर',
  'analysis.timeOfDay.groupA': '{phrase} दर्ज मूड ({hours})',
  'analysis.timeOfDay.groupB': 'बाकी दर्ज मूड',

  // Trends ------------------------------------------------------------------------------
  'analysis.trends.label': 'मूड, तनाव और नींद के रुझान',
  'analysis.trends.text':
    'ऐसा लगता है कि आपके डेटा में {horizon, select, period {पूरी अवधि में} monthly {पिछले महीने में} other {पिछले दो सप्ताह में}} {gender, select, f {आपकी {metricDefined} का रुझान {direction, select, up {ऊपर की ओर} other {नीचे की ओर}} है} other {आपके {metricDefined} का रुझान {direction, select, up {ऊपर की ओर} other {नीचे की ओर}} है}}: चल औसत की रुझान रेखा {fromValue} से {direction, select, up {बढ़कर} other {घटकर}} {toValue} पर पहुँची।',
  'analysis.trends.explainChecked':
    'मैंने {horizon, select, period {अवधि के} other {सबसे हाल के}} {len} दिनों ({from}-{to}) में से {count, plural, one {# दिन} other {# दिनों}} की जाँच की, जिनमें {metric} दर्ज था।',
  'analysis.trends.explainFit':
    'मैंने {window} दिनों का चल औसत निकाला और उस पर एक रुझान रेखा (रैखिक प्रतिगमन) खींची: प्रति दिन {unit, select, hours {{slope} घंटे} other {{slope} अंक}} की {direction, select, up {ऊपर की ओर ढलान} other {नीचे की ओर ढलान}}, यानी पूरे समय-खंड में लगभग {unit, select, hours {{change} घंटे} other {{change} अंक}} का बदलाव (रुझान रेखा पर {fromValue} से {toValue} तक)। रुझान की मज़बूती: {strength}।',
  'analysis.trends.title':
    '{horizon, select, period {पूरी अवधि में} monthly {पिछले महीने में} other {पिछले दो सप्ताह में}} {metric, select, mood {आपके मूड} energy {आपके ऊर्जा स्तर} stress {आपके तनाव स्तर} sleepHours {आपके नींद के घंटों} sleepQuality {आपकी नींद की गुणवत्ता} exerciseMinutes {आपके व्यायाम के मिनटों} other {प्रविष्टियों की संख्या}} में {direction, select, up {बढ़ता रुझान} other {घटता रुझान}}',
  'analysis.trends.groupA': 'समय-खंड की शुरुआत (रुझान रेखा)',
  'analysis.trends.groupB': 'समय-खंड का अंत (रुझान रेखा)',
  'analysis.trends.slopeValue': '{unit, select, hours {{slope} घंटे} other {{slope} अंक}}',
  'analysis.trends.nothingSince': 'मैंने {from} से मूड, तनाव और नींद के रुझानों की जाँच की और कोई उल्लेखनीय रुझान नहीं मिला।',
  'analysis.trends.nothingAll': 'मैंने पूरी अवधि में मूड, तनाव और नींद के रुझानों की जाँच की और कोई उल्लेखनीय रुझान नहीं मिला।',

  // Month comparison --------------------------------------------------------------------
  'analysis.periodCompare.label': 'इस महीने और पिछले महीने की तुलना',
  'analysis.periodCompare.text':
    'ऐसा लगता है कि आपके डेटा में {cur} में {gender, select, f {आपकी {metricDefined} {prev} की तुलना में औसतन {direction, select, higher {अधिक थी} other {कम थी}}} other {आपका {metricDefined} {prev} की तुलना में औसतन {direction, select, higher {अधिक था} other {कम था}}}} ({meanA} बनाम {meanB})।',
  'analysis.periodCompare.explain':
    'मैंने {cur} में {metric} दर्ज वाले दिनों ({countA, plural, one {# दिन} other {# दिन}}, आज तक) की तुलना {prev} के दिनों ({countB, plural, one {# दिन} other {# दिन}}) से की। {cur} में औसत: {meanA}; {prev} में: {meanB}। अंतर: {unit, select, hours {{diff} घंटे} other {{diff} अंक}}। अंतर की मज़बूती: {strength}।',
  'analysis.periodCompare.title':
    '{cur} में {gender, select, other {{direction, select, higher {{metric} {prev} से अधिक} other {{metric} {prev} से कम}}}}',
  'analysis.periodCompare.entriesText':
    'ऐसा लगता है कि आपने {cur} के पहले {window} दिनों में ({countA, plural, one {# प्रविष्टि} other {# प्रविष्टियाँ}}) {prev} के पहले {window} दिनों ({countB, plural, one {# प्रविष्टि} other {# प्रविष्टियाँ}}) की तुलना में {direction, select, more {ज़्यादा लिखा} other {कम लिखा}}।',
  'analysis.periodCompare.entriesExplain':
    'बराबर समय-खंडों की तुलना के लिए मैंने हर महीने के पहले {window} दिनों की प्रविष्टियाँ गिनीं: {cur} - {countA, plural, one {# प्रविष्टि} other {# प्रविष्टियाँ}}, {prev} - {countB, plural, one {# प्रविष्टि} other {# प्रविष्टियाँ}}। अंतर: {diff, plural, one {# प्रविष्टि} other {# प्रविष्टियाँ}} ({percent})। अंतर की मज़बूती: {strength}।',
  'analysis.periodCompare.entriesTitle': '{prev} की तुलना में {cur} में {direction, select, more {ज़्यादा प्रविष्टियाँ} other {कम प्रविष्टियाँ}}',
  'analysis.periodCompare.monthWindow': '{month} (पहले {window} दिन)',
  'analysis.periodCompare.insufficientWhat': '{cur} और {prev} की तुलना',
  'analysis.periodCompare.nothing': 'मैंने {cur} की तुलना {prev} से की और मूड, तनाव, नींद या प्रविष्टियों की संख्या में कोई उल्लेखनीय अंतर नहीं मिला।',

  // Habit trend (improved / declined) -----------------------------------------------------
  'analysis.habitsTrend.label': 'वे आदतें जिनमें सुधार या गिरावट आई',
  'analysis.habitsTrend.whether': 'आदत "{habit}" में सुधार हुआ या गिरावट आई',
  'analysis.habitsTrend.textDaily':
    'ऐसा लगता है कि आदत "{habit}" में {direction, select, improved {सुधार हुआ है} other {गिरावट आई है}}: पिछले दो सप्ताह में आपने इसे {window} में से {recent} दिन पूरा किया, जबकि उससे पहले के दो सप्ताह में {window} में से {previous} दिन।',
  'analysis.habitsTrend.textWeekly':
    'ऐसा लगता है कि आदत "{habit}" में {direction, select, improved {सुधार हुआ है} other {गिरावट आई है}}: पिछले दो सप्ताह में आपने {recent} {unit} दर्ज किए, जबकि उससे पहले के दो सप्ताह में {previous} (लक्ष्य: प्रति सप्ताह {target} {unit})।',
  'analysis.habitsTrend.explain':
    'मैंने पिछले दो सप्ताह ({recentFrom}-{recentTo}) में आदत की पूर्णता दर की तुलना उससे पहले के दो सप्ताह ({previousFrom}-{previousTo}) से की: {recentRate} बनाम {previousRate}। अंतर: {diff} प्रतिशत अंक। बदलाव की मज़बूती: {strength}।',
  'analysis.habitsTrend.title': 'पिछले दो सप्ताह में आदत "{habit}" में {direction, select, improved {सुधार हुआ है} other {गिरावट आई है}}',
  'analysis.habitsTrend.metric': 'पूर्णता दर - {habit}',
  'analysis.habitsTrend.groupA': 'पिछले दो सप्ताह',
  'analysis.habitsTrend.groupB': 'उससे पहले के दो सप्ताह',

  // Best / hardest days ------------------------------------------------------------------
  'analysis.bestWorst.label': 'सबसे अच्छे और सबसे कठिन दिन',
  'analysis.bestWorst.describedDay': '{day} ("{title}")',
  'analysis.bestWorst.noTitle': 'बिना शीर्षक',
  'analysis.bestWorst.extraValue': '{titles} - स्कोर {score}',
  'analysis.bestWorst.text':
    'मूड, ऊर्जा और तनाव के संयुक्त स्कोर के अनुसार इस अवधि के {kind, select, best {सबसे अच्छे दिन} other {सबसे कठिन दिन}}: {days}।',
  'analysis.bestWorst.explainScore':
    'हर दिन के लिए ({count, plural, one {कुल # दिन} other {कुल # दिन}}) मैंने एक संयुक्त स्कोर निकाला: उस दिन दर्ज मानों से मूड, ऊर्जा स्तर और (11 घटा तनाव स्तर) का औसत।',
  'analysis.bestWorst.explainMeans':
    'इस अवधि का औसत स्कोर: {overall}। {kind, select, best {{count, plural, one {सबसे अच्छे दिन का स्कोर} =3 {तीन सबसे अच्छे दिनों का औसत स्कोर} other {सबसे अच्छे दिनों का औसत स्कोर}}} other {{count, plural, one {सबसे कठिन दिन का स्कोर} =3 {तीन सबसे कठिन दिनों का औसत स्कोर} other {सबसे कठिन दिनों का औसत स्कोर}}}} {mean} रहा।',
  'analysis.bestWorst.explainDiff': 'औसत से अंतर: {diff} अंक। अंतर की मज़बूती: {strength}।',
  'analysis.bestWorst.title': '{kind, select, best {इस अवधि के सबसे अच्छे दिन} other {इस अवधि के सबसे कठिन दिन}}',
  'analysis.bestWorst.metric': 'संयुक्त स्कोर (मूड + ऊर्जा + उलटा तनाव)',
  'analysis.bestWorst.groupA': '{kind, select, best {सबसे अच्छे दिन} other {सबसे कठिन दिन}}',
  'analysis.bestWorst.nothing': 'मैंने {count, plural, one {# दिन} other {# दिनों}} में {label} की जाँच की; स्कोर मिलते-जुलते थे और कोई खास दिन अलग नहीं दिखा।',

  // Streaks -------------------------------------------------------------------------------
  'analysis.streaks.label': 'लेखन और आदतों के सिलसिले',
  'analysis.streaks.entriesTitle': '{count, plural, one {# दिन} other {# दिनों}} का लेखन सिलसिला',
  'analysis.streaks.entriesText': 'बहुत बढ़िया! आपने लगातार {count, plural, one {# दिन} other {# दिन}} अपनी डायरी में लिखा ({from}-{to})।',
  'analysis.streaks.entriesExplain':
    'मैंने आज या कल तक के उन लगातार दिनों को गिना जिनमें कम से कम एक प्रविष्टि थी। मौजूदा सिलसिला: {count, plural, one {# दिन} other {# दिन}}, {from} से {to} तक। अवधि का सबसे लंबा सिलसिला: {best, plural, one {# दिन} other {# दिन}}।',
  'analysis.streaks.entriesMetric': 'लेखन के दिन',
  'analysis.streaks.currentDays': 'मौजूदा सिलसिले के दिन',
  'analysis.streaks.daysWithEntry': 'अवधि में प्रविष्टि वाले दिन',
  'analysis.streaks.habitTitle': 'आदत "{habit}" का {count, plural, one {# दिन} other {# दिनों}} का सिलसिला',
  'analysis.streaks.habitText': 'आपने आदत "{habit}" लगातार {count, plural, one {# दिन} other {# दिन}} पूरी की ({from}-{to})।',
  'analysis.streaks.habitExplain':
    'मैंने आज या कल तक के उन लगातार दिनों को गिना जिनमें आदत "{habit}" पूरी के रूप में चिह्नित थी। मौजूदा सिलसिला: {count, plural, one {# दिन} other {# दिन}}। अवधि का सबसे लंबा सिलसिला: {best, plural, one {# दिन} other {# दिन}}।',
  'analysis.streaks.habitMetric': 'आदत {habit} की पूर्णता',
  'analysis.streaks.daysCompleted': 'अवधि में आदत पूरी होने वाले दिन',
  'analysis.streaks.weeklyTitle': 'आदत "{habit}" का {count, plural, one {# सप्ताह} other {# सप्ताहों}} का सिलसिला',
  'analysis.streaks.weeklyText': 'आपने लगातार {count, plural, one {# सप्ताह} other {# सप्ताह}} आदत "{habit}" का लक्ष्य पूरा किया ({from}-{to})।',
  'analysis.streaks.weeklyExplain':
    'मैंने हर सप्ताह आदत "{habit}" के लिए दर्ज मात्रा जोड़ी और उसकी तुलना साप्ताहिक लक्ष्य ({target}) से की। लक्ष्य पूरा करने वाले सप्ताहों का मौजूदा सिलसिला: {count, plural, one {# सप्ताह} other {# सप्ताह}}।',
  'analysis.streaks.weeklyMetric': 'साप्ताहिक लक्ष्य पूरा हुआ - {habit}',
  'analysis.streaks.currentWeeks': 'मौजूदा सिलसिले के सप्ताह',
  'analysis.streaks.weeksWithLogs': 'अवधि में रिकॉर्ड वाले सप्ताह',
  'analysis.streaks.none':
    'कोई सक्रिय सिलसिला नहीं मिला ({entryMin} या उससे अधिक दिनों का लेखन सिलसिला, या {habitMin} या उससे अधिक दिनों या सप्ताहों का आदत सिलसिला)।',

  // Anomalies -----------------------------------------------------------------------------
  'analysis.anomalies.label': 'मूड या तनाव में असामान्य दिन',
  'analysis.anomalies.textOne':
    'ऐसा लगता है कि {day} को {gender, select, f {आपकी {metricDefined} बाकी अवधि की तुलना में {side, select, high {असामान्य रूप से अधिक थी} other {असामान्य रूप से कम थी}}} other {आपका {metricDefined} बाकी अवधि की तुलना में {side, select, high {असामान्य रूप से अधिक था} other {असामान्य रूप से कम था}}}} ({value}, जबकि औसत {mean})।',
  'analysis.anomalies.textMany':
    'ऐसा लगता है कि {count, plural, one {# दिन} other {# दिनों में}} {gender, select, f {आपकी {metricDefined} बाकी अवधि की तुलना में {side, select, high {असामान्य रूप से अधिक थी} other {असामान्य रूप से कम थी}}} other {आपका {metricDefined} बाकी अवधि की तुलना में {side, select, high {असामान्य रूप से अधिक था} other {असामान्य रूप से कम था}}}}: {days}; अवधि का औसत: {mean}।',
  'analysis.anomalies.textManyMore':
    'ऐसा लगता है कि {count, plural, one {# दिन} other {# दिनों में}} {gender, select, f {आपकी {metricDefined} बाकी अवधि की तुलना में {side, select, high {असामान्य रूप से अधिक थी} other {असामान्य रूप से कम थी}}} other {आपका {metricDefined} बाकी अवधि की तुलना में {side, select, high {असामान्य रूप से अधिक था} other {असामान्य रूप से कम था}}}}: {days} और कुछ अन्य दिन; अवधि का औसत: {mean}।',
  'analysis.anomalies.dayItem': '{day} ({value})',
  'analysis.anomalies.detail': '{date}: {value} ({side, select, above {औसत से {z} मानक विचलन ऊपर} other {औसत से {z} मानक विचलन नीचे}})',
  'analysis.anomalies.explain':
    'मैंने {count, plural, one {# दिन} other {# दिनों}} की जाँच की, जिनमें {metric} दर्ज था। औसत: {mean}, मानक विचलन: {sd}। किसी दिन को असामान्य तब माना जाता है जब उसका मान औसत से {z} या उससे अधिक मानक विचलन दूर हो। {details}। विचलन की मज़बूती: {strength}।',
  'analysis.anomalies.title':
    '{gender, select, other {{side, select, high {{metric} असामान्य रूप से अधिक} other {{metric} असामान्य रूप से कम}}}}: {count, plural, one {# दिन} other {# दिन}}',
  'analysis.anomalies.groupA': 'असामान्य दिन',
  'analysis.anomalies.zValue': '{value} (z {z})',
  'analysis.anomalies.nothing':
    'मैंने {count, plural, one {# दिन} other {# दिनों}} में असामान्य दिनों की जाँच की और कोई ऐसा दिन नहीं मिला जो औसत से {z} या उससे अधिक मानक विचलन दूर हो।',

  // Emotion patterns ----------------------------------------------------------------------
  'analysis.emotion.label': 'दिनों, लोगों और जगहों के अनुसार भावनाओं के पैटर्न',
  'analysis.emotion.metric': 'भावना {emotion}',
  'analysis.emotion.groupA': 'भावना "{emotion}" वाले दिन',
  'analysis.emotion.weekdayTitle': 'भावना "{emotion}" ज़्यादातर {onWeekday} दिखती है',
  'analysis.emotion.weekdayText': 'ऐसा लगता है कि आपके डेटा में भावना "{emotion}" ज़्यादातर {onWeekday} दिखी ({total} में से {top} बार)।',
  'analysis.emotion.weekdayExplain':
    'मैंने {count, plural, one {# दिन} other {# दिनों}} की जाँच की। भावना "{emotion}" {total, plural, one {# दिन} other {# दिनों}} में दर्ज हुई; उनमें से {top} दिन {weekdays} थे ({share}), जबकि जाँचे गए सभी दिनों में {weekdays} का हिस्सा {baseline} है। पैटर्न की मज़बूती: {strength}।',
  'analysis.emotion.groupBWeekday': 'उनमें से {weekdays}',
  'analysis.emotion.weekdayShareKey': 'सभी दिनों में {weekdays} का हिस्सा',
  'analysis.emotion.personTitle': 'भावना "{emotion}" और {name}',
  'analysis.emotion.placeTitle': 'भावना "{emotion}" और "{place}"',
  'analysis.emotion.personText':
    'ऐसा लगता है कि आपके डेटा में भावना "{emotion}" अक्सर उन दिनों दिखी जब आपकी मुलाक़ात {name} से हुई ({total} में से {with} बार)।',
  'analysis.emotion.placeText':
    'ऐसा लगता है कि आपके डेटा में भावना "{emotion}" अक्सर उन दिनों दिखी जब स्थान "{place}" था ({total} में से {with} बार)।',
  'analysis.emotion.personExplain':
    'मैंने {count, plural, one {# दिन} other {# दिनों}} की जाँच की। भावना "{emotion}" {total} दिनों में दर्ज हुई; उनमें से {with} दिनों ({share}) की प्रविष्टि में {name} का नाम भी था। कुल {count} दिनों में से {baselineCount} दिनों में {name} का नाम आता है ({baseline})। पैटर्न की मज़बूती: {strength}।',
  'analysis.emotion.placeExplain':
    'मैंने {count, plural, one {# दिन} other {# दिनों}} की जाँच की। भावना "{emotion}" {total} दिनों में दर्ज हुई; उनमें से {with} दिनों ({share}) की प्रविष्टि में स्थान "{place}" भी था। स्थान "{place}" कुल {count} दिनों में से {baselineCount} दिनों में आता है ({baseline})। पैटर्न की मज़बूती: {strength}।',
  'analysis.emotion.groupBPerson': 'उनमें से {name} के साथ',
  'analysis.emotion.groupBPlace': 'उनमें से "{place}" में',
  'analysis.emotion.personShareKey': 'सभी दिनों में {name} का हिस्सा',
  'analysis.emotion.placeShareKey': 'सभी दिनों में स्थान "{place}" का हिस्सा',
  'analysis.emotion.nothing':
    'मैंने ऐसी {count, plural, one {# भावना} other {# भावनाओं}} की जाँच की जो कम से कम {min} बार दोहराई गईं, और किसी खास दिन, व्यक्ति या जगह पर कोई उल्लेखनीय जमाव नहीं मिला।',
};
export default messages;
