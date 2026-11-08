/** hi - stats messages. Keys are prefixed 'stats.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Statistics page (src/pages/StatsPage.tsx) ----------------------------------------
  'stats.title': 'आँकड़े',
  'stats.period': 'अवधि',
  'stats.movingAvg': 'चल औसत (7 दिन)',
  'stats.overTime': 'समय के साथ {label}',
  'stats.weekday.section': 'सप्ताह के दिन के अनुसार',
  'stats.weekday.chart': 'सप्ताह के दिन के अनुसार औसत',
  'stats.weekday.axis': 'सप्ताह का दिन',
  'stats.habits.section': 'आदतें',
  'stats.habits.chart': '{name} - रोज़ के मान',
  'stats.habits.empty': 'इस अवधि में किसी आदत का कोई रिकॉर्ड नहीं।',
  // {frequency} is 'daily' | 'weekly'; {current}/{best} are formatted streaks ("5 days").
  'stats.habits.summary':
    'पूर्णता: {percent} ({frequency, select, weekly {{total, plural, one {# सप्ताह} other {# सप्ताह}}} other {{total, plural, one {# दिन} other {# दिनों}}}} में से {completed}), मौजूदा सिलसिला: {current}, सबसे लंबा: {best}',
  'stats.empty.title': 'इस अवधि के लिए अभी कोई डेटा नहीं',
  'stats.empty.text': 'यहाँ चार्ट और रुझान देखने के लिए प्रविष्टियाँ लिखें और आदतें दर्ज करें।',
  'stats.newEntry': 'नई प्रविष्टि',
  'stats.noValues': 'इस अवधि में कोई डेटा नहीं।',
  'stats.overview': '{days, plural, one {# दिन} other {# दिनों}} में {entries, plural, one {# प्रविष्टि} other {# प्रविष्टियाँ}} ({from} – {to})',

  // Series summary under every chart -------------------------------------------------
  'stats.summary.base': 'औसत {mean} ({sample}, न्यूनतम {min}, अधिकतम {max})।',
  'stats.summary.sampleDays': '{count, plural, one {# दिन} other {# दिन}}',
  'stats.summary.sampleValues': '{count, plural, one {# मान} other {# मान}}',
  'stats.summary.noChange': 'पिछली अवधि ({previous}) की तुलना में कोई बदलाव नहीं।',
  'stats.summary.change': 'पिछली अवधि के {previous} की तुलना में ({diff})।',
  'stats.summary.sentences': '{summary} {comparison}',
  'stats.summary.entriesPerDay': 'प्रति दिन प्रविष्टियाँ',

  // Metric titles (chart sections; also the home page tiles) -------------------------
  'stats.metric.mood': 'मूड',
  'stats.metric.energy': 'ऊर्जा स्तर',
  'stats.metric.stress': 'तनाव स्तर',
  'stats.metric.sleepHours': 'नींद के घंटे',
  'stats.metric.sleepQuality': 'नींद की गुणवत्ता',
  'stats.metric.exerciseMinutes': 'व्यायाम',
  'stats.metric.entriesPerDay': 'डायरी प्रविष्टियाँ',

  // Periods (pickers on the statistics and insights pages) ---------------------------
  'stats.period.7d': '7 दिन',
  'stats.period.30d': '30 दिन',
  'stats.period.3m': '3 महीने',
  'stats.period.6m': '6 महीने',
  'stats.period.1y': '1 साल',
  'stats.period.all': 'पूरी अवधि',
  'stats.period.in':
    '{period, select, 7d {पिछले 7 दिनों में} 30d {पिछले 30 दिनों में} 3m {पिछले 3 महीनों में} 6m {पिछले 6 महीनों में} 1y {पिछले एक साल में} all {पूरी अवधि में} other {इस अवधि में}}',

  // Charts (src/components/charts/chart-utils.ts) ------------------------------------
  'stats.chart.noData': 'दिखाने के लिए कोई डेटा नहीं',
  'stats.chart.xAxisDate': 'तारीख',
  'stats.chart.valueWithUnit': '{value} {unit}',
  // Tooltip of one bar / marker: series label, x label (a date or a weekday), value with unit.
  'stats.chart.pointTooltip': '{label}, {x}: {value}',
  'stats.chart.summary': '{label}: {count, plural, one {# मान} other {# मान}}, न्यूनतम {min}, अधिकतम {max}, औसत {mean}।',
  'stats.chart.summaryEmpty': '{label}: कोई डेटा नहीं।',
  'stats.chart.range': '{count, plural, =0 {कोई समय बिंदु नहीं।} one {एक समय बिंदु: {from}।} other {# समय बिंदु, {from} से {to} तक।}}',
};
export default messages;
