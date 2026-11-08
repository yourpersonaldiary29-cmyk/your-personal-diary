/**
 * en - demo texts ("Load sample data"). THE REFERENCE FILE: every other language file in this folder
 * has the same fields with pools of exactly these sizes, in this order of meaning (see README.md).
 */
import type { SeedContent } from './types';

/** "A", "A and B", "A, B and C". */
function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

const content: SeedContent = {
  // Only he/en carry their own habit texts; a new language leaves `habits` out (README.md).
  habits: {
    walk: { name: 'Walking', description: 'A daily walk in the open air', unit: 'minutes' },
    water: { name: 'Drinking water', description: 'Glasses of water during the day', unit: 'glasses' },
    reading: { name: 'Reading', description: 'Reading a book or an article', unit: 'minutes' },
    exercise: { name: 'Exercise', description: 'A workout, a run, a swim or any other activity', unit: 'times' },
    meditation: { name: 'Meditation', description: 'Breathing or a short meditation', unit: 'minutes' },
  },
  titles: {
    high: ['A wonderful morning', 'A day full of energy', 'A genuinely good day', 'Finally rested', 'A day of small wins', 'Sunshine and fresh air'],
    mid: ['An ordinary day', 'A work day', 'Errands and routine', 'Another day gone by', 'A day at my own pace', 'A pleasant routine'],
    low: ['A hard day', 'Deep tiredness', 'Today was not easy', 'An exhausting day', 'A heavy head', 'I wanted the day to end'],
  },
  openers: {
    high: ['I felt really good today.', 'I woke up smiling and the day kept going that way.', 'It was a day full of good energy.', 'I felt light and happy.'],
    mid: ['An ordinary day, no surprises.', 'I got through the day at my own pace.', 'Nothing special, but it was fine.', 'A routine day of work and errands.'],
    low: ['I had a hard day.', 'I felt heavy and tired most of the day.', 'I could not concentrate on anything.', 'The day got off on the wrong foot.'],
  },
  events: [
    'Meeting at work',
    'Family dinner',
    'Doctor visit',
    'Grocery shopping',
    'Call with an old friend',
    'Errands at the bank',
    'An interesting lecture',
    'Work-from-home day',
    'A short trip',
    'Cleaning the house',
    'Meeting friends',
    'Sports class',
    'Movie night',
    'Cooking a new dish',
  ],
  sundayEvents: ['Planning the week ahead', 'Weekly team meeting', 'Piles of e-mails to answer'],
  people: ['Dana', 'Yossi', 'Mom', 'Dad', 'Rotem', 'Noa', 'Amit', 'Shira', 'Alon', 'Michal'],
  locations: ['Home', 'Office', 'Park', 'Cafe', "My parents' place", 'Beach', 'Library'],
  tags: ['work', 'family', 'health', 'friends', 'sport', 'studies', 'rest', 'nature', 'creativity', 'money'],
  sportTag: 'sport',
  exerciseTypes: ['walking', 'running', 'strength training', 'swimming', 'cycling', 'yoga'],
  badDay: {
    title: 'A terrible day',
    body: 'A terrible day. Everything went wrong - I got up late, missed an important meeting and fought with a close friend. I felt completely overwhelmed and did not know where to start.',
  },
  goodDay: {
    title: 'A perfect day',
    body: 'A perfect day! I got happy news at work, we celebrated with the whole family in the evening, and I felt grateful for everything.',
  },
  sleep: (hours, low) => (low ? `I slept only ${hours} hours last night and I felt it.` : `I slept ${hours} hours, quite well.`),
  exercise: (type, minutes, slot) => `I did ${minutes} minutes of ${type} ${slot === 'midday' ? 'in the morning' : 'in the afternoon'}.`,
  secondEntry: (slot) =>
    slot === 'midday' ? 'A few words in the middle of the day, between one thing and the next.' : 'A short summary of the evening before sleep.',
  sundayNote: 'The start of the week is always a little stressful - so much piles up on the desk.',
  peopleSentence: (names, met) => `${met ? 'I met' : 'I talked with'} ${joinNames(names)}.`,
  note: 'Remember to write tomorrow about what went well.',
};

export default content;
