/**
 * bg - emotions messages. Keys are prefixed 'emotions.'; see shared/i18n/index.ts for the syntax.
 *
 * 'emotions.<key>.label'   - the label shown in the UI (emotion picker, badges, exports).
 *                            Bulgarian labels are nouns ("Радост", "Умора") so they read the
 *                            same for every user, whatever their grammatical gender.
 * 'emotions.<key>.aliases' - comma-separated words the search parser also resolves to the
 *                            key (synonyms, other forms, nouns). Lowercase; matching is
 *                            case-insensitive. More inflected forms live in shared/i18n/search/bg.ts.
 */
const messages: Record<string, string> = {
  'emotions.happy.label': 'Радост',
  'emotions.happy.aliases': 'радост,щастие,щастлив,щастлива,радостен,радостна,весел,весела',
  'emotions.calm.label': 'Спокойствие',
  'emotions.calm.aliases': 'спокоен,спокойна,отпуснат,отпусната,умиротворение,ведрина',
  'emotions.sad.label': 'Тъга',
  'emotions.sad.aliases': 'тъга,тъжен,тъжна,тъжно,печал,униние',
  'emotions.angry.label': 'Гняв',
  'emotions.angry.aliases': 'гняв,ядосан,ядосана,яд,сърдит,сърдита,раздразнение,раздразнен,раздразнена',
  'emotions.stressed.label': 'Стрес',
  'emotions.stressed.aliases': 'стресиран,стресирана,напрежение,напрегнат,напрегната,под напрежение',
  'emotions.excited.label': 'Вълнение',
  'emotions.excited.aliases': 'вълнение,развълнуван,развълнувана,въодушевление,въодушевен,въодушевена,ентусиазъм',
  'emotions.tired.label': 'Умора',
  'emotions.tired.aliases': 'умора,уморен,уморена,изморен,изморена,изтощен,изтощена,изтощение,сънлив,сънлива',
  'emotions.satisfied.label': 'Удовлетвореност',
  'emotions.satisfied.aliases': 'удовлетвореност,доволен,доволна,удовлетворен,удовлетворена,удовлетворение',
  'emotions.frustrated.label': 'Фрустрация',
  'emotions.frustrated.aliases': 'фрустрация,фрустриран,фрустрирана,разочарование,разочарован,разочарована',
  'emotions.anxious.label': 'Тревожност',
  'emotions.anxious.aliases': 'тревожност,тревога,тревожен,тревожна,притеснение,притеснен,притеснена,безпокойство',
  'emotions.energetic.label': 'Енергичност',
  'emotions.energetic.aliases': 'енергичност,енергичен,енергична,бодър,бодра,пълен с енергия,пълна с енергия,жизненост',
  'emotions.grateful.label': 'Благодарност',
  'emotions.grateful.aliases': 'благодарност,благодарен,благодарна,признателност,признателен,признателна',
  'emotions.lonely.label': 'Самота',
  'emotions.lonely.aliases': 'самота,самотен,самотна,самотно',
  'emotions.hopeful.label': 'Надежда',
  'emotions.hopeful.aliases': 'надежда,оптимизъм,оптимистичен,оптимистична,изпълнен с надежда,изпълнена с надежда',
  'emotions.bored.label': 'Скука',
  'emotions.bored.aliases': 'скука,скучно,отегчен,отегчена,отегчение',
  'emotions.proud.label': 'Гордост',
  'emotions.proud.aliases': 'гордост,горд,горда',
  'emotions.focused.label': 'Съсредоточеност',
  'emotions.focused.aliases': 'съсредоточеност,съсредоточен,съсредоточена,концентрация,концентриран,концентрирана,фокус',
  'emotions.overwhelmed.label': 'Претовареност',
  'emotions.overwhelmed.aliases': 'претовареност,претоварен,претоварена,претоварване,затрупан,затрупана',
};
export default messages;
