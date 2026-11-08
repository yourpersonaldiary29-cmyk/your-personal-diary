/**
 * exercise-energy: days with physical activity versus days without, compared on energy,
 * plus Pearson r of exercise minutes against energy.
 * `didExercise === null` (not reported) days are skipped - never treated as "no exercise".
 */
import { tr } from '../phrasing';
import { makeSplitDetector } from './common';

export const exerciseEnergyDetector = makeSplitDetector({
  id: 'exercise_energy',
  variant: 'days',
  label: (l) => tr(l, 'analysis.exerciseEnergy.label'),
  category: 'exercise_energy',
  metric: 'energy',
  outcome: (d) => d.energy,
  inGroupA: (d) => d.didExercise,
  groupALabel: (l) => tr(l, 'analysis.exercise.groupA'),
  groupBLabel: (l) => tr(l, 'analysis.exercise.groupB'),
  condition: (l) => tr(l, 'analysis.exercise.condition'),
  conditionPast: (l) => tr(l, 'analysis.exercise.conditionPast'),
  predictor: { metric: 'exerciseMinutes', value: (d) => d.exerciseMinutes },
  titleFor: (l, direction) => tr(l, 'analysis.exerciseEnergy.title', { direction }),
  correlationTitle: (l) => tr(l, 'analysis.exerciseEnergy.corrTitle'),
  // Higher energy on active days is an encouraging pattern; the opposite is just informative.
  positiveWhen: (diff) => (diff > 0 ? true : null),
});
