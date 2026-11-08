/**
 * en - emotions messages. Keys are prefixed 'emotions.'; see shared/i18n/index.ts for the syntax.
 *
 * 'emotions.<key>.label'   - the label shown in the UI (emotion picker, badges, exports).
 * 'emotions.<key>.aliases' - comma-separated words the search parser also resolves to the
 *                            key (synonyms, other forms, nouns). Lowercase; matching is
 *                            case-insensitive. Keep the list in this language's own words.
 */
const messages: Record<string, string> = {
  'emotions.happy.label': 'Happy',
  'emotions.happy.aliases': 'happiness,joyful,joy,glad,cheerful,delighted',
  'emotions.calm.label': 'Calm',
  'emotions.calm.aliases': 'relaxed,peaceful,serene,at ease,tranquil',
  'emotions.sad.label': 'Sad',
  'emotions.sad.aliases': 'sadness,unhappy,down,blue,gloomy',
  'emotions.angry.label': 'Angry',
  'emotions.angry.aliases': 'anger,mad,furious,irritated,annoyed',
  'emotions.stressed.label': 'Stressed',
  'emotions.stressed.aliases': 'stress,tense,under pressure,pressured',
  'emotions.excited.label': 'Excited',
  'emotions.excited.aliases': 'excitement,thrilled,eager',
  'emotions.tired.label': 'Tired',
  'emotions.tired.aliases': 'tiredness,exhausted,exhaustion,weary,drained,sleepy',
  'emotions.satisfied.label': 'Satisfied',
  'emotions.satisfied.aliases': 'satisfaction,content,contented,fulfilled,pleased',
  'emotions.frustrated.label': 'Frustrated',
  'emotions.frustrated.aliases': 'frustration',
  'emotions.anxious.label': 'Anxious',
  'emotions.anxious.aliases': 'anxiety,worried,worry,nervous,uneasy',
  'emotions.energetic.label': 'Energetic',
  'emotions.energetic.aliases': 'energy,full of energy,lively,vigorous',
  'emotions.grateful.label': 'Grateful',
  'emotions.grateful.aliases': 'gratitude,thankful,appreciative',
  'emotions.lonely.label': 'Lonely',
  'emotions.lonely.aliases': 'loneliness,alone,isolated',
  'emotions.hopeful.label': 'Hopeful',
  'emotions.hopeful.aliases': 'hope,optimistic,optimism',
  'emotions.bored.label': 'Bored',
  'emotions.bored.aliases': 'boredom,dull',
  'emotions.proud.label': 'Proud',
  'emotions.proud.aliases': 'pride',
  'emotions.focused.label': 'Focused',
  'emotions.focused.aliases': 'focus,concentrated,concentration',
  'emotions.overwhelmed.label': 'Overwhelmed',
  'emotions.overwhelmed.aliases': 'swamped,overloaded,flooded',
};
export default messages;
