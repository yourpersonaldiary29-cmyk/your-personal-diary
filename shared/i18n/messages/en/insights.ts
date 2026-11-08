/** en - insights messages. Keys are prefixed 'insights.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Insights page (src/pages/InsightsPage.tsx) ---------------------------------------
  'insights.title': 'Insights',
  'insights.period': 'Period',
  'insights.refresh': 'Refresh',
  'insights.notesTitle': 'Not checked / not enough data',
  'insights.disclaimer': 'The insights describe possible relationships in your data. They do not establish cause and effect and are not medical advice.',
  'insights.empty.title': 'No insights for this period yet',
  'insights.empty.text':
    'To detect patterns, at least {minDays} days with data are needed in the period, and at least {minGroupSize} days in each comparison group (for example days with and without exercise). Keep writing in your diary and logging mood, sleep and activity.',
  'insights.newEntry': 'New entry',
  // {inPeriod} is 'stats.period.in' ("in the last 30 days"), {start}/{end} are short dates.
  'insights.summary': '{count, plural, one {# day} other {# days}} with data {inPeriod} ({start} – {end})',
  'insights.found': '{count, plural, =0 {No insights found} one {# insight found} other {# insights found}}',

  // Section headings (src/pages/insights/insight-groups.ts) --------------------------
  'insights.group.trends': 'Trends',
  'insights.group.habits': 'Habits',
  'insights.group.sleepActivity': 'Sleep and activity',
  'insights.group.daysHours': 'Days and times',
  'insights.group.emotionsPeople': 'Emotions and people',
  'insights.group.anomalies': 'Anomalies',
  'insights.group.other': 'Other insights',

  // Strength and direction badges ---------------------------------------------------
  'insights.strength.strong': 'Strong pattern',
  'insights.strength.moderate': 'Moderate pattern',
  'insights.strength.weak': 'Weak pattern',
  'insights.positive': 'Encouraging',
  'insights.attention': 'Worth attention',

  // Insight card (src/pages/insights/InsightCard.tsx) --------------------------------
  'insights.card.why': 'Why did I get this insight?',
  'insights.card.evidenceCaption': 'The data behind the insight',
  'insights.card.relatedDays': 'Related days',
  'insights.card.period': 'Period: {start} – {end}',
  'insights.card.detail': 'Detail',
  'insights.card.value': 'Value',
  'insights.card.daysExamined': 'Days examined',
  'insights.card.metric': 'Metric',
  'insights.card.correlation': 'Correlation (r)',
  'insights.card.effectSize': 'Size of the difference',
  'insights.card.groupRow': '{count, plural, one {# day} other {# days}}, mean {mean}',
  'insights.card.groupRowNoMean': '{count, plural, one {# day} other {# days}}',

  // Home page (src/pages/HomePage.tsx, GET /api/home) --------------------------------
  'insights.home.title': 'Home',
  'insights.home.newEntry': 'New entry',
  'insights.home.greetingLabel': 'Greeting',
  'insights.home.today': 'Today',
  'insights.home.weekAverages': 'Averages of the last 7 days',
  'insights.home.habitsToday': "Today's habits",
  'insights.home.insightOfDay': "Today's insight",
  'insights.home.lastEntry': 'Latest entry',
  'insights.home.noData': 'No data',
  'insights.home.noHabits': 'No active habits.',
  'insights.home.manageHabits': 'Manage habits',
  'insights.home.allHabits': 'All habits',
  'insights.home.allInsights': 'All insights',
  'insights.home.noInsight': 'No insights yet. Keep writing in your diary and logging sleep, mood and activity to discover patterns.',
  'insights.home.noEntriesTitle': 'No diary entries yet',
  'insights.home.noEntriesText': 'The first entry is the beginning of every insight. A few sentences about your day are enough.',
  'insights.home.firstEntry': 'Write the first entry',
  'insights.home.untitled': 'Untitled',
  'insights.home.streak': 'Writing streak: {count, plural, one {# day} other {# days}}',
  'insights.home.entriesToday': '{count, plural, =0 {No entry written yet today} one {# entry today} other {# entries today}}',
  'insights.home.totalEntries': '{count, plural, one {# entry in the diary in total} other {# entries in the diary in total}}',
  'insights.home.ratingOf10': '{value} of 10',
  'insights.home.sleepHours': '{value} hours',
  'insights.home.lastEntryMood': 'Mood: {value}',
};
export default messages;
