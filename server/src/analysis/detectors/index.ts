/**
 * The ordered list of rule-based detectors run by `RulesProvider`.
 * Order only affects the order of notes; insights are sorted by score afterwards.
 */
import type { Detector } from '../types';
import { anomaliesDetector } from './anomalies';
import { bestWorstDaysDetector } from './best-worst-days';
import { emotionPatternDetector } from './emotion-pattern';
import { exerciseEnergyDetector } from './exercise-energy';
import { exerciseMoodDetector } from './exercise-mood';
import { habitMoodDetector } from './habit-mood';
import { habitsTrendDetector } from './habits-trend';
import { periodCompareDetector } from './period-compare';
import { sleepEnergyDetector } from './sleep-energy';
import { sleepMoodDetector } from './sleep-mood';
import { streaksDetector } from './streaks';
import { timeOfDayDetector } from './time-of-day';
import { trendsDetector } from './trends';
import { weekdayDetector } from './weekday';

export const ALL_DETECTORS: Detector[] = [
  sleepMoodDetector,
  sleepEnergyDetector,
  exerciseEnergyDetector,
  exerciseMoodDetector,
  habitMoodDetector,
  weekdayDetector,
  timeOfDayDetector,
  trendsDetector,
  periodCompareDetector,
  habitsTrendDetector,
  bestWorstDaysDetector,
  streaksDetector,
  anomaliesDetector,
  emotionPatternDetector,
];

export {
  anomaliesDetector,
  bestWorstDaysDetector,
  emotionPatternDetector,
  exerciseEnergyDetector,
  exerciseMoodDetector,
  habitMoodDetector,
  habitsTrendDetector,
  periodCompareDetector,
  sleepEnergyDetector,
  sleepMoodDetector,
  streaksDetector,
  timeOfDayDetector,
  trendsDetector,
  weekdayDetector,
};
