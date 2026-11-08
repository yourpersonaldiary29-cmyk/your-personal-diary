/**
 * en - analysis messages (server-side insight templates, notes and labels). This file is
 * the reference for every other language. Keys are prefixed 'analysis.'; see
 * shared/i18n/index.ts for the template syntax.
 *
 * Conventions:
 *  - Every sentence is hedged ("It looks like in your data...", "there may be a link") and
 *    never causal; the analysis tests scan the catalogue and the generated texts for
 *    "causes", "because of", "leads to", "makes you".
 *  - `gender` is the grammatical class of the metric noun, read from
 *    'analysis.metric.<metric>.gender' in the SAME language ('n' here). English has one form,
 *    so `{gender, select, other {was}}` marks the word that must agree with the noun in
 *    gendered languages: translators set the gender per metric below and add `m {...}`,
 *    `f {...}` branches wherever their grammar needs them. `direction` is 'higher' | 'lower'
 *    (or 'up' | 'down' for trends), `side` is 'high' | 'low'.
 *  - Numbers, dates, month and weekday names arrive already formatted for the locale;
 *    counts use `{count, plural, ...}` so every language can pick its own forms.
 *  - Labels ('*.label') are lowercase noun phrases because they are embedded in sentences
 *    ("I checked the link between sleep and mood over 30 days").
 *  - A select / plural branch body must never be one bare Latin word (`higher {higher}`):
 *    the parity test's placeholder scanner cannot tell it from a placeholder. Fold a
 *    neighbouring word into the branch instead (`higher {higher on average}`,
 *    `other {was {meanA}}`). This applies to every Latin-script translation too.
 */
const messages: Record<string, string> = {
  // Engine / provider -----------------------------------------------------------------
  'analysis.engine.providerFailed': 'The pattern analysis did not complete (internal error). Please try again later.',
  'analysis.engine.detectorFailed': 'The check "{label}" did not complete (internal error); the other insights are fine.',

  // Strength --------------------------------------------------------------------------
  'analysis.strength.weak': 'weak',
  'analysis.strength.moderate': 'moderate',
  'analysis.strength.strong': 'strong',

  // Metrics: label (short, standalone), defined (subject inside a sentence), gender -----
  'analysis.metric.mood.label': 'mood',
  'analysis.metric.mood.defined': 'mood',
  'analysis.metric.mood.gender': 'n',
  'analysis.metric.energy.label': 'energy level',
  'analysis.metric.energy.defined': 'energy level',
  'analysis.metric.energy.gender': 'n',
  'analysis.metric.stress.label': 'stress level',
  'analysis.metric.stress.defined': 'stress level',
  'analysis.metric.stress.gender': 'n',
  'analysis.metric.sleepHours.label': 'sleep hours',
  'analysis.metric.sleepHours.defined': 'number of sleep hours',
  'analysis.metric.sleepHours.gender': 'n',
  'analysis.metric.sleepQuality.label': 'sleep quality',
  'analysis.metric.sleepQuality.defined': 'sleep quality',
  'analysis.metric.sleepQuality.gender': 'n',
  'analysis.metric.exerciseMinutes.label': 'exercise minutes',
  'analysis.metric.exerciseMinutes.defined': 'number of exercise minutes',
  'analysis.metric.exerciseMinutes.gender': 'n',
  'analysis.metric.entries.label': 'diary entries',
  'analysis.metric.entries.defined': 'number of entries',
  'analysis.metric.entries.gender': 'n',

  // Counts and dates ------------------------------------------------------------------
  'analysis.count.days': '{count, plural, one {# day} other {# days}}',
  'analysis.count.weeks': '{count, plural, one {# week} other {# weeks}}',
  'analysis.date.dayWithDate': '{weekday}, {date}',

  // Weekdays (index 0 = Sunday) --------------------------------------------------------
  'analysis.weekday.plural.0': 'Sundays',
  'analysis.weekday.plural.1': 'Mondays',
  'analysis.weekday.plural.2': 'Tuesdays',
  'analysis.weekday.plural.3': 'Wednesdays',
  'analysis.weekday.plural.4': 'Thursdays',
  'analysis.weekday.plural.5': 'Fridays',
  'analysis.weekday.plural.6': 'Saturdays',
  'analysis.weekday.on.0': 'on Sundays',
  'analysis.weekday.on.1': 'on Mondays',
  'analysis.weekday.on.2': 'on Tuesdays',
  'analysis.weekday.on.3': 'on Wednesdays',
  'analysis.weekday.on.4': 'on Thursdays',
  'analysis.weekday.on.5': 'on Fridays',
  'analysis.weekday.on.6': 'on Saturdays',

  // Notes shared by the detectors -------------------------------------------------------
  'analysis.note.insufficient': 'There is not enough data to check {what} (at least {required} needed; you have {have}).',
  'analysis.note.insufficientWhether': 'There is not enough data to check {what} (at least {required} needed; you have {have}).',
  'analysis.note.nothingNotable': 'I checked {what} over {count, plural, one {# day} other {# days}} and found no notable difference.',

  // Requirement / availability phrases used inside the notes above ----------------------
  'analysis.req.daysBothValues': '{count, plural, one {# day with both values} other {# days with both values}}',
  'analysis.req.daysPerGroup': '{count, plural, one {# day in each group} other {# days in each group}}',
  'analysis.req.daysWithReport': '{count, plural, one {# day with a report} other {# days with reports}}',
  'analysis.req.daysWithRatings': '{count, plural, one {# day with ratings} other {# days with ratings}}',
  'analysis.req.daysPerMonth': '{count, plural, one {# day with a report in each month} other {# days with reports in each month}}',
  'analysis.req.recentDays': '{count, plural, one {# day with a report in the last two weeks} other {# days with reports in the last two weeks}}',
  'analysis.req.fullWeeks': '{count, plural, one {# full week with reports} other {# full weeks with reports}}',
  'analysis.req.weeksOfLogs': '{count, plural, one {# week of logs} other {# weeks of logs}}',
  'analysis.req.weekPerGroup': 'one week in each group and {count, plural, one {# day} other {# days}} with a report in each group',
  'analysis.req.moodReports': '{count, plural, one {# mood report} other {# mood reports}}',
  'analysis.req.reportsInWindow': '{count, plural, one {# report in a single time window} other {# reports in a single time window}}',
  'analysis.req.emotionRepeated': 'one emotion reported on {count, plural, one {# day} other {# days}}',
  'analysis.have.twoGroups': '{groupA}: {countA, plural, one {# day} other {# days}}; {groupB}: {countB, plural, one {# day} other {# days}}',
  'analysis.have.weeksTwoGroups':
    'weeks at target: {metWeeks, plural, one {# week} other {# weeks}} ({metDays, plural, one {# day} other {# days}}); weeks below target: {belowWeeks, plural, one {# week} other {# weeks}} ({belowDays, plural, one {# day} other {# days}})',
  'analysis.have.twoMonths': '{countA, plural, one {# day} other {# days}} in {cur} and {countB, plural, one {# day} other {# days}} in {prev}',
  'analysis.have.noData': 'no data',
  'analysis.have.noSuchEmotion': 'none yet',
  'analysis.have.fewerInEveryWindow': 'fewer than that in every window',

  // Sentences shared by the group-comparison detectors ----------------------------------
  'analysis.relation.text':
    'It looks like in your data, {condition} your {metricDefined} {gender, select, other {was {direction, select, higher {higher on average} other {lower on average}}}} ({meanA} vs. {meanB}).',
  'analysis.correlation.text':
    'It looks like there may be a link in your data between {x} and {y}: {xGender, select, other {when your {x} was higher}}, {yGender, select, other {your {y} {direction, select, higher {tended to be higher} other {tended to be lower}}}} (correlation {r}).',
  'analysis.explain.checkedDays': 'I checked {count, plural, one {# day} other {# days}}.',
  'analysis.explain.onDaysCondition': 'On {count, plural, one {# day} other {# days}} you {conditionPast}.',
  'analysis.explain.groupMeans':
    'Your average {metricDefined} on those days {gender, select, other {was {meanA}}}, compared with {meanB} on the other days.',
  'analysis.explain.correlation': 'Correlation: {r}.',
  'analysis.explain.correlationBetween': 'Correlation ({predictor} vs. {outcome}): {r}.',
  'analysis.explain.diffAndStrength': 'Difference between the averages: {diff} points. Pattern strength: {strength}.',
  'analysis.explain.diffStrength': 'Difference: {diff} points. Pattern strength: {strength}.',
  'analysis.split.corrExplainChecked': 'I checked {count, plural, one {# day} other {# days}} on which both {x} and {y} were reported.',
  'analysis.split.corrExplainPearson': 'Pearson correlation: {r} (strength: {strength}).',
  'analysis.split.corrExplainGroups':
    'There were not enough days in each group to compare averages ({groupA}: {countA, plural, one {# day} other {# days}}; {groupB}: {countB, plural, one {# day} other {# days}}; at least {min} in each group are needed).',

  // Evidence table keys ---------------------------------------------------------------
  'analysis.extra.predictor': 'Predictor',
  'analysis.extra.strength': 'Strength',
  'analysis.extra.meanDiff': 'Mean difference (A minus B)',
  'analysis.extra.cohenD': "Effect size (Cohen's d)",
  'analysis.extra.weeksChecked': 'Weeks checked',
  'analysis.extra.weeklyTarget': 'Weekly target',
  'analysis.extra.target': 'Target',
  'analysis.extra.frequency': 'Frequency',
  'analysis.extra.periodMean': 'Period average',
  'analysis.extra.overallMean': 'Overall average',
  'analysis.extra.stddev': 'Standard deviation',
  'analysis.extra.slopePerDay': 'Slope per day',
  'analysis.extra.daysInWindow': 'Days in the window',
  'analysis.extra.movingWindow': 'Moving-average window',
  'analysis.extra.relativeChange': 'Relative change',
  'analysis.extra.longestStreak': 'Longest streak in the period',
  'analysis.extra.shareOfEmotionDays': "Share of the emotion's days",
  'analysis.frequency.daily': 'daily',
  'analysis.frequency.weekly': 'weekly',
  'analysis.groupB.otherDays': 'Other days',

  // Sleep detectors -------------------------------------------------------------------
  'analysis.sleep.groupA': 'Days with fewer than {hours} hours of sleep',
  'analysis.sleep.groupB': 'Days with {hours} hours of sleep or more',
  'analysis.sleep.condition': 'on days when you slept fewer than {hours} hours',
  'analysis.sleep.conditionPast': 'slept fewer than {hours} hours',
  'analysis.sleepMood.label': 'the link between sleep and mood',
  'analysis.sleepMood.title': '{direction, select, lower {Short sleep and lower mood} other {Short sleep and higher mood}}',
  'analysis.sleepMood.corrTitle': 'Possible link between sleep hours and mood',
  'analysis.sleepEnergy.label': 'the link between sleep and energy level',
  'analysis.sleepEnergy.title': '{direction, select, lower {Short sleep and lower energy} other {Short sleep and higher energy}}',
  'analysis.sleepEnergy.corrTitle': 'Possible link between sleep hours and energy level',

  // Exercise detectors ----------------------------------------------------------------
  'analysis.exercise.groupA': 'Days with physical activity',
  'analysis.exercise.groupB': 'Days without physical activity',
  'analysis.exercise.condition': 'on days when you exercised',
  'analysis.exercise.conditionPast': 'exercised',
  'analysis.exerciseMood.label': 'the link between physical activity and mood',
  'analysis.exerciseMood.title': '{direction, select, higher {Physical activity and higher mood} other {Physical activity and lower mood}}',
  'analysis.exerciseMood.corrTitle': 'Possible link between exercise minutes and mood',
  'analysis.exerciseEnergy.label': 'the link between physical activity and energy level',
  'analysis.exerciseEnergy.title': '{direction, select, higher {Physical activity and higher energy} other {Physical activity and lower energy}}',
  'analysis.exerciseEnergy.corrTitle': 'Possible link between exercise minutes and energy level',

  // Habit - mood / energy / stress ------------------------------------------------------
  'analysis.habit.detectorLabel': 'the link between habits and mood',
  'analysis.habit.noHabits': 'There are no active habits, so I did not check for a link between habits and mood.',
  'analysis.habit.noLogs': 'The habit "{habit}" has no logs in this period yet, so I did not check for a link between it and mood.',
  'analysis.habit.noFullWeeks': 'The habit "{habit}" has no full weeks with logs yet, so I did not check for a link between it and mood.',
  'analysis.habit.label': 'the link between the habit "{habit}" and {metric}',
  'analysis.habit.groupA': 'Days on which the habit "{habit}" was completed',
  'analysis.habit.groupB': 'Days on which the habit "{habit}" was not completed',
  'analysis.habit.condition': 'on days when you completed the habit "{habit}"',
  'analysis.habit.conditionPast': 'completed the habit "{habit}"',
  'analysis.habit.title':
    'Habit "{habit}" and {gender, select, other {{direction, select, higher {higher {metric}} other {lower {metric}}}}}',
  'analysis.habit.corrTitle': 'Possible link between the habit "{habit}" and {metric}',
  'analysis.habit.weeklyCondition': 'in weeks when you met the target of the habit "{habit}"',
  'analysis.habit.weeklyTarget': '{target} {unit} per week',
  'analysis.habit.targetValue': '{target} {unit}',
  'analysis.habit.weeklyExplainChecked':
    'I checked {weeks, plural, one {# full week} other {# full weeks}} ({days, plural, one {# day} other {# days}} with a {metric} report).',
  'analysis.habit.weeklyExplainMet': "In {count, plural, one {# week} other {# weeks}} you met the habit's target ({target}).",
  'analysis.habit.weeklyExplainMeans':
    'Your average {metricDefined} on the days of those weeks {gender, select, other {was {meanA}}}, compared with {meanB} on the days of the {count, plural, one {# week} other {# weeks}} below the target.',
  'analysis.habit.groupAWeeks': 'Days in weeks at target ({count, plural, one {# week} other {# weeks}})',
  'analysis.habit.groupBWeeks': 'Days in weeks below target ({count, plural, one {# week} other {# weeks}})',

  // Weekday differences -----------------------------------------------------------------
  'analysis.weekday.label': 'differences between the days of the week',
  'analysis.weekday.text':
    'It looks like in your data, {onWeekday} your {metricDefined} {gender, select, other {was {direction, select, higher {higher on average} other {lower on average}}}} than on the other days of the week ({meanA} vs. {meanB}).',
  'analysis.weekday.explainChecked': 'I checked {count, plural, one {# day} other {# days}} with a {metric} report, {countA} of them {weekdays}.',
  'analysis.weekday.explainMeans':
    'Your average {metricDefined} {onWeekday} {gender, select, other {was {meanA}}}, compared with {meanB} on the other days.',
  'analysis.weekday.title':
    '{weekdays}: {gender, select, other {{direction, select, higher {higher {metric}} other {lower {metric}}}}}',
  'analysis.weekday.groupB': 'Other days of the week',
  'analysis.weekday.tableValue': '{mean} ({count, plural, one {# day} other {# days}})',
  'analysis.weekday.nothing': 'I checked for differences between the days of the week over {count, plural, one {# day} other {# days}} and found no notable difference.',

  // Time of day -------------------------------------------------------------------------
  'analysis.timeOfDay.label': 'the link between the time of writing and mood',
  'analysis.timeOfDay.morning.label': 'Morning',
  'analysis.timeOfDay.morning.phrase': 'in the morning',
  'analysis.timeOfDay.late_morning.label': 'Late morning',
  'analysis.timeOfDay.late_morning.phrase': 'in the late morning',
  'analysis.timeOfDay.afternoon.label': 'Afternoon',
  'analysis.timeOfDay.afternoon.phrase': 'in the afternoon',
  'analysis.timeOfDay.evening.label': 'Evening',
  'analysis.timeOfDay.evening.phrase': 'in the evening',
  'analysis.timeOfDay.night.label': 'Night',
  'analysis.timeOfDay.night.phrase': 'at night',
  'analysis.timeOfDay.tableKey': '{label} ({hours})',
  'analysis.timeOfDay.tableValue': 'average {mean}, {count, plural, one {# report} other {# reports}}',
  'analysis.timeOfDay.tableRow': '{key}: {value}',
  'analysis.timeOfDay.nothing': 'I checked {label} over {count, plural, one {# report} other {# reports}} and found no time window that stands out above the average.',
  'analysis.timeOfDay.text':
    'It looks like in your data, the mood you reported {phrase} ({hours}) was the highest: {mean} on average, compared with {overall} across all reports.',
  'analysis.timeOfDay.explainChecked':
    'I checked {count, plural, one {# mood report} other {# mood reports}} from {days, plural, one {# day} other {# days}}, by the time the entry was written.',
  'analysis.timeOfDay.explainTable': '{table}. Overall average: {overall}.',
  'analysis.timeOfDay.explainDiff': 'Difference between the highest time window and the overall average: {diff} points. Pattern strength: {strength}.',
  'analysis.timeOfDay.title': 'Higher mood {phrase}',
  'analysis.timeOfDay.groupA': 'Reports {phrase} ({hours})',
  'analysis.timeOfDay.groupB': 'Other reports',

  // Trends ------------------------------------------------------------------------------
  'analysis.trends.label': 'trends in mood, stress and sleep',
  'analysis.trends.text':
    'It looks like in your data your {metricDefined} {gender, select, other {is {direction, select, up {trending upward} other {trending downward}}}} {horizon, select, period {over the period} monthly {in the last month} other {in the last two weeks}}: the trend line of the moving average {direction, select, up {rose from} other {fell from}} {fromValue} to {toValue}.',
  'analysis.trends.explainChecked':
    'I checked {count, plural, one {# day} other {# days}} with a {metric} report out of the {len} {horizon, select, period {days in the period} other {most recent days}} ({from}-{to}).',
  'analysis.trends.explainFit':
    'I computed a {window}-day moving average and a trend line (linear regression) through it: {direction, select, up {an upward slope} other {a downward slope}} of {unit, select, hours {{slope} hours} other {{slope} points}} per day, i.e. a change of about {unit, select, hours {{change} hours} other {{change} points}} over the window (from {fromValue} to {toValue} along the trend line). Trend strength: {strength}.',
  'analysis.trends.title':
    '{direction, select, up {Upward trend} other {Downward trend}} in {metric, select, mood {your mood} energy {your energy level} stress {your stress level} sleepHours {your sleep hours} sleepQuality {your sleep quality} exerciseMinutes {your exercise minutes} other {the number of entries}} {horizon, select, period {over the period} monthly {in the last month} other {in the last two weeks}}',
  'analysis.trends.groupA': 'Start of the window (trend line)',
  'analysis.trends.groupB': 'End of the window (trend line)',
  'analysis.trends.slopeValue': '{unit, select, hours {{slope} hours} other {{slope} points}}',
  'analysis.trends.nothingSince': 'I checked for trends in mood, stress and sleep since {from} and found no notable trend.',
  'analysis.trends.nothingAll': 'I checked for trends in mood, stress and sleep over the whole period and found no notable trend.',

  // Month comparison --------------------------------------------------------------------
  'analysis.periodCompare.label': 'the comparison between the current month and the previous month',
  'analysis.periodCompare.text':
    'It looks like in your data your {metricDefined} in {cur} {gender, select, other {was {direction, select, higher {higher on average} other {lower on average}}}} than in {prev} ({meanA} vs. {meanB}).',
  'analysis.periodCompare.explain':
    'I compared the days with a {metric} report in {cur} ({countA, plural, one {# day} other {# days}}, up to today) with the days in {prev} ({countB, plural, one {# day} other {# days}}). Average in {cur}: {meanA}; in {prev}: {meanB}. Difference: {unit, select, hours {{diff} hours} other {{diff} points}}. Strength of the difference: {strength}.',
  'analysis.periodCompare.title':
    'In {cur}: {gender, select, other {{direction, select, higher {higher {metric}} other {lower {metric}}}}} than in {prev}',
  'analysis.periodCompare.entriesText':
    'It looks like you {direction, select, more {wrote more} other {wrote less}} in the first {window} days of {cur} ({countA, plural, one {# entry} other {# entries}}) than in the first {window} days of {prev} ({countB, plural, one {# entry} other {# entries}}).',
  'analysis.periodCompare.entriesExplain':
    'I counted the entries in the first {window} days of each month, to compare equal time windows: {cur} - {countA, plural, one {# entry} other {# entries}}, {prev} - {countB, plural, one {# entry} other {# entries}}. Difference: {diff, plural, one {# entry} other {# entries}} ({percent}). Strength of the difference: {strength}.',
  'analysis.periodCompare.entriesTitle': '{direction, select, more {More entries} other {Fewer entries}} in {cur} than in {prev}',
  'analysis.periodCompare.monthWindow': '{month} (first {window} days)',
  'analysis.periodCompare.insufficientWhat': 'the comparison between {cur} and {prev}',
  'analysis.periodCompare.nothing': 'I compared {cur} with {prev} and found no notable difference in mood, stress, sleep or the number of entries.',

  // Habit trend (improved / declined) -----------------------------------------------------
  'analysis.habitsTrend.label': 'habits that improved or declined',
  'analysis.habitsTrend.whether': 'whether the habit "{habit}" improved or declined',
  'analysis.habitsTrend.textDaily':
    'It looks like the habit "{habit}" {direction, select, improved {has improved} other {has declined}}: in the last two weeks you completed it on {recent} of {window} days, compared with {previous} of {window} in the two weeks before.',
  'analysis.habitsTrend.textWeekly':
    'It looks like the habit "{habit}" {direction, select, improved {has improved} other {has declined}}: in the last two weeks you logged {recent} {unit}, compared with {previous} in the two weeks before (target: {target} {unit} per week).',
  'analysis.habitsTrend.explain':
    "I compared the habit's completion rate in the last two weeks ({recentFrom}-{recentTo}) with the two weeks before ({previousFrom}-{previousTo}): {recentRate} vs. {previousRate}. Difference: {diff} percentage points. Strength of the change: {strength}.",
  'analysis.habitsTrend.title': 'The habit "{habit}" {direction, select, improved {has improved} other {has declined}} in the last two weeks',
  'analysis.habitsTrend.metric': 'Completion rate - {habit}',
  'analysis.habitsTrend.groupA': 'Last two weeks',
  'analysis.habitsTrend.groupB': 'Previous two weeks',

  // Best / hardest days ------------------------------------------------------------------
  'analysis.bestWorst.label': 'the best and hardest days',
  'analysis.bestWorst.describedDay': '{day} ("{title}")',
  'analysis.bestWorst.noTitle': 'Untitled',
  'analysis.bestWorst.extraValue': '{titles} - score {score}',
  'analysis.bestWorst.text':
    '{kind, select, best {The best days} other {The hardest days}} in the period, by a combined score of mood, energy and stress: {days}.',
  'analysis.bestWorst.explainScore':
    'For each of the {count, plural, one {# day} other {# days}} I computed a combined score: the average of mood, energy level and (11 minus stress level), from the values reported that day.',
  'analysis.bestWorst.explainMeans':
    'The average score in the period: {overall}. {kind, select, best {{count, plural, one {The best day scored} =3 {The three best days scored} other {The best days scored}}} other {{count, plural, one {The hardest day scored} =3 {The three hardest days scored} other {The hardest days scored}}}} {mean} on average.',
  'analysis.bestWorst.explainDiff': 'Difference from the average: {diff} points. Strength of the difference: {strength}.',
  'analysis.bestWorst.title': '{kind, select, best {The best days in the period} other {The hardest days in the period}}',
  'analysis.bestWorst.metric': 'Combined score (mood + energy + inverted stress)',
  'analysis.bestWorst.groupA': '{kind, select, best {The best days} other {The hardest days}}',
  'analysis.bestWorst.nothing': 'I checked {label} over {count, plural, one {# day} other {# days}}; the scores were similar and no particular day stood out.',

  // Streaks -------------------------------------------------------------------------------
  'analysis.streaks.label': 'writing and habit streaks',
  'analysis.streaks.entriesTitle': 'Writing streak of {count, plural, one {# day} other {# days}}',
  'analysis.streaks.entriesText': 'Well done! You wrote in your diary {count, plural, one {# day} other {# days}} in a row ({from}-{to}).',
  'analysis.streaks.entriesExplain':
    'I counted the consecutive days with at least one entry, up to today or yesterday. Current streak: {count, plural, one {# day} other {# days}}, from {from} to {to}. Longest streak in the period: {best, plural, one {# day} other {# days}}.',
  'analysis.streaks.entriesMetric': 'Writing days',
  'analysis.streaks.currentDays': 'Days in the current streak',
  'analysis.streaks.daysWithEntry': 'Days with an entry in the period',
  'analysis.streaks.habitTitle': 'Streak of {count, plural, one {# day} other {# days}} for the habit "{habit}"',
  'analysis.streaks.habitText': 'You completed the habit "{habit}" {count, plural, one {# day} other {# days}} in a row ({from}-{to}).',
  'analysis.streaks.habitExplain':
    'I counted the consecutive days on which the habit "{habit}" was marked as completed, up to today or yesterday. Current streak: {count, plural, one {# day} other {# days}}. Longest streak in the period: {best, plural, one {# day} other {# days}}.',
  'analysis.streaks.habitMetric': 'Completion of the habit {habit}',
  'analysis.streaks.daysCompleted': 'Days on which the habit was completed in the period',
  'analysis.streaks.weeklyTitle': 'Streak of {count, plural, one {# week} other {# weeks}} for the habit "{habit}"',
  'analysis.streaks.weeklyText': 'You met the target of the habit "{habit}" {count, plural, one {# week} other {# weeks}} in a row ({from}-{to}).',
  'analysis.streaks.weeklyExplain':
    'I summed the amount logged for the habit "{habit}" in each week and compared it with the weekly target ({target}). Current streak of weeks at target: {count, plural, one {# week} other {# weeks}}.',
  'analysis.streaks.weeklyMetric': 'Weekly target met - {habit}',
  'analysis.streaks.currentWeeks': 'Weeks in the current streak',
  'analysis.streaks.weeksWithLogs': 'Weeks with logs in the period',
  'analysis.streaks.none':
    'No active streaks were found (a writing streak of {entryMin} days or more, or a habit streak of {habitMin} days or weeks or more).',

  // Anomalies -----------------------------------------------------------------------------
  'analysis.anomalies.label': 'unusual days in mood or stress',
  'analysis.anomalies.textOne':
    'It looks like on {day} your {metricDefined} {gender, select, other {was {side, select, high {unusually high} other {unusually low}}}} compared with the rest of the period ({value}, vs. an average of {mean}).',
  'analysis.anomalies.textMany':
    'It looks like on {count, plural, one {# day} other {# days}} your {metricDefined} {gender, select, other {was {side, select, high {unusually high} other {unusually low}}}} compared with the rest of the period: {days}; the average in the period: {mean}.',
  'analysis.anomalies.textManyMore':
    'It looks like on {count, plural, one {# day} other {# days}} your {metricDefined} {gender, select, other {was {side, select, high {unusually high} other {unusually low}}}} compared with the rest of the period: {days} and more; the average in the period: {mean}.',
  'analysis.anomalies.dayItem': '{day} ({value})',
  'analysis.anomalies.detail': '{date}: {value} ({z} standard deviations {side, select, above {above the average} other {below the average}})',
  'analysis.anomalies.explain':
    'I checked {count, plural, one {# day} other {# days}} with a {metric} report. Average: {mean}, standard deviation: {sd}. A day counts as unusual when its value is {z} standard deviations or more away from the average. {details}. Strength of the deviation: {strength}.',
  'analysis.anomalies.title':
    '{count, plural, one {A day with} other {Days with}} {gender, select, other {{side, select, high {unusually high {metric}} other {unusually low {metric}}}}}',
  'analysis.anomalies.groupA': 'Unusual days',
  'analysis.anomalies.zValue': '{value} (z {z})',
  'analysis.anomalies.nothing':
    'I checked for unusual days over {count, plural, one {# day} other {# days}} and found no day that deviates from the average by {z} standard deviations or more.',

  // Emotion patterns ----------------------------------------------------------------------
  'analysis.emotion.label': 'emotion patterns by days, people and places',
  'analysis.emotion.metric': 'The emotion {emotion}',
  'analysis.emotion.groupA': 'Days with the emotion "{emotion}"',
  'analysis.emotion.weekdayTitle': 'The emotion "{emotion}" appears mostly {onWeekday}',
  'analysis.emotion.weekdayText': 'It looks like in your data the emotion "{emotion}" appeared mostly {onWeekday} ({top} of {total} times).',
  'analysis.emotion.weekdayExplain':
    'I checked {count, plural, one {# day} other {# days}}. The emotion "{emotion}" was reported on {total, plural, one {# day} other {# days}}; {top} of them were {weekdays} ({share}), while {weekdays} make up {baseline} of all the days checked. Pattern strength: {strength}.',
  'analysis.emotion.groupBWeekday': 'Of them {weekdays}',
  'analysis.emotion.weekdayShareKey': 'Share of {weekdays} among all days',
  'analysis.emotion.personTitle': 'The emotion "{emotion}" and {name}',
  'analysis.emotion.placeTitle': 'The emotion "{emotion}" and "{place}"',
  'analysis.emotion.personText':
    'It looks like in your data the emotion "{emotion}" often appeared on days when you met {name} ({with} of {total} times).',
  'analysis.emotion.placeText':
    'It looks like in your data the emotion "{emotion}" often appeared on days when the location was "{place}" ({with} of {total} times).',
  'analysis.emotion.personExplain':
    'I checked {count, plural, one {# day} other {# days}}. The emotion "{emotion}" was reported on {total} days; on {with} of them ({share}) {name} also appeared in the entry. {name} appears on {baselineCount} of the {count} days in total ({baseline}). Pattern strength: {strength}.',
  'analysis.emotion.placeExplain':
    'I checked {count, plural, one {# day} other {# days}}. The emotion "{emotion}" was reported on {total} days; on {with} of them ({share}) the location "{place}" also appeared in the entry. The location "{place}" appears on {baselineCount} of the {count} days in total ({baseline}). Pattern strength: {strength}.',
  'analysis.emotion.groupBPerson': 'Of them with {name}',
  'analysis.emotion.groupBPlace': 'Of them at "{place}"',
  'analysis.emotion.personShareKey': 'Share of {name} among all days',
  'analysis.emotion.placeShareKey': 'Share of the location "{place}" among all days',
  'analysis.emotion.nothing':
    'I checked {count, plural, one {# emotion} other {# emotions}} that recurred at least {min} times and found no notable concentration on particular days, people or places.',
};
export default messages;
