/**
 * exercise-mood: days with physical activity versus days without, compared on mood,
 * plus Pearson r of exercise minutes against mood.
 */
import { tr } from '../phrasing';
import { makeSplitDetector } from './common';

export const exerciseMoodDetector = makeSplitDetector({
  id: 'exercise_mood',
  variant: 'days',
  label: (l) => tr(l, 'analysis.exerciseMood.label'),
  category: 'exercise_mood',
  metric: 'mood',
  outcome: (d) => d.mood,
  inGroupA: (d) => d.didExercise,
  groupALabel: (l) => tr(l, 'analysis.exercise.groupA'),
  groupBLabel: (l) => tr(l, 'analysis.exercise.groupB'),
  condition: (l) => tr(l, 'analysis.exercise.condition'),
  conditionPast: (l) => tr(l, 'analysis.exercise.conditionPast'),
  predictor: { metric: 'exerciseMinutes', value: (d) => d.exerciseMinutes },
  titleFor: (l, direction) => tr(l, 'analysis.exerciseMood.title', { direction }),
  correlationTitle: (l) => tr(l, 'analysis.exerciseMood.corrTitle'),
  positiveWhen: (diff) => (diff > 0 ? true : null),
});
