/**
 * sleep-energy: days with fewer than 6 hours of sleep versus the rest, compared on energy,
 * plus Pearson r of sleep hours against energy.
 */
import { tr } from '../phrasing';
import { makeSplitDetector, SHORT_SLEEP_HOURS } from './common';

export const sleepEnergyDetector = makeSplitDetector({
  id: 'sleep_energy',
  variant: 'lt6',
  label: (l) => tr(l, 'analysis.sleepEnergy.label'),
  category: 'sleep_energy',
  metric: 'energy',
  outcome: (d) => d.energy,
  inGroupA: (d) => (d.sleepHours == null ? null : d.sleepHours < SHORT_SLEEP_HOURS),
  groupALabel: (l) => tr(l, 'analysis.sleep.groupA', { hours: SHORT_SLEEP_HOURS }),
  groupBLabel: (l) => tr(l, 'analysis.sleep.groupB', { hours: SHORT_SLEEP_HOURS }),
  condition: (l) => tr(l, 'analysis.sleep.condition', { hours: SHORT_SLEEP_HOURS }),
  conditionPast: (l) => tr(l, 'analysis.sleep.conditionPast', { hours: SHORT_SLEEP_HOURS }),
  predictor: { metric: 'sleepHours', value: (d) => d.sleepHours },
  titleFor: (l, direction) => tr(l, 'analysis.sleepEnergy.title', { direction }),
  correlationTitle: (l) => tr(l, 'analysis.sleepEnergy.corrTitle'),
  positiveWhen: () => null,
});
