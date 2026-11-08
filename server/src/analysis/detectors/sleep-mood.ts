/**
 * sleep-mood: days with fewer than 6 hours of sleep versus the rest, compared on mood,
 * plus Pearson r of sleep hours against mood.
 */
import { tr } from '../phrasing';
import { makeSplitDetector, SHORT_SLEEP_HOURS } from './common';

export const sleepMoodDetector = makeSplitDetector({
  id: 'sleep_mood',
  variant: 'lt6',
  label: (l) => tr(l, 'analysis.sleepMood.label'),
  category: 'sleep_mood',
  metric: 'mood',
  outcome: (d) => d.mood,
  inGroupA: (d) => (d.sleepHours == null ? null : d.sleepHours < SHORT_SLEEP_HOURS),
  groupALabel: (l) => tr(l, 'analysis.sleep.groupA', { hours: SHORT_SLEEP_HOURS }),
  groupBLabel: (l) => tr(l, 'analysis.sleep.groupB', { hours: SHORT_SLEEP_HOURS }),
  condition: (l) => tr(l, 'analysis.sleep.condition', { hours: SHORT_SLEEP_HOURS }),
  conditionPast: (l) => tr(l, 'analysis.sleep.conditionPast', { hours: SHORT_SLEEP_HOURS }),
  predictor: { metric: 'sleepHours', value: (d) => d.sleepHours },
  titleFor: (l, direction) => tr(l, 'analysis.sleepMood.title', { direction }),
  correlationTitle: (l) => tr(l, 'analysis.sleepMood.corrTitle'),
  // A short-sleep / low-mood pattern is informative rather than encouraging or discouraging.
  positiveWhen: () => null,
});
