/**
 * ru - emotions messages. Keys are prefixed 'emotions.'; see shared/i18n/index.ts for the syntax.
 *
 * 'emotions.<key>.label'   - the label shown in the UI (emotion picker, badges, exports).
 *                            Russian labels are nouns ("Радость", "Усталость") so they read the
 *                            same for every user, whatever their grammatical gender.
 * 'emotions.<key>.aliases' - comma-separated words the search parser also resolves to the
 *                            key (synonyms, other forms, nouns). Lowercase; matching is
 *                            case-insensitive. More inflected forms live in shared/i18n/search/ru.ts.
 */
const messages: Record<string, string> = {
  'emotions.happy.label': 'Радость',
  'emotions.happy.aliases': 'радость,счастье,счастлив,счастлива,рад,рада,радостный,радостная,весёлый,весёлая,веселье',
  'emotions.calm.label': 'Спокойствие',
  'emotions.calm.aliases': 'спокоен,спокойна,спокойный,спокойная,расслаблен,расслаблена,умиротворение,безмятежность',
  'emotions.sad.label': 'Грусть',
  'emotions.sad.aliases': 'грусть,грустно,грустный,грустная,печаль,печально,тоска,уныние',
  'emotions.angry.label': 'Злость',
  'emotions.angry.aliases': 'злость,злой,злая,зол,зла,гнев,раздражение,раздражён,раздражена,сердитый,сердитая',
  'emotions.stressed.label': 'Стресс',
  'emotions.stressed.aliases': 'напряжение,напряжён,напряжена,под давлением,в стрессе',
  'emotions.excited.label': 'Воодушевление',
  'emotions.excited.aliases': 'воодушевление,воодушевлён,воодушевлена,взволнован,взволнована,предвкушение,азарт',
  'emotions.tired.label': 'Усталость',
  'emotions.tired.aliases': 'усталость,устал,устала,уставший,уставшая,утомление,утомлён,утомлена,измотан,измотана,сонливость',
  'emotions.satisfied.label': 'Удовлетворение',
  'emotions.satisfied.aliases': 'удовлетворение,доволен,довольна,довольный,довольная,удовлетворённость',
  'emotions.frustrated.label': 'Досада',
  'emotions.frustrated.aliases': 'досада,фрустрация,разочарование,разочарован,разочарована',
  'emotions.anxious.label': 'Тревога',
  'emotions.anxious.aliases': 'тревога,тревожность,тревожно,тревожный,тревожная,беспокойство,волнение,нервничал,нервничала',
  'emotions.energetic.label': 'Бодрость',
  'emotions.energetic.aliases': 'бодрость,бодрый,бодрая,энергичный,энергичная,полон сил,полна сил,прилив сил',
  'emotions.grateful.label': 'Благодарность',
  'emotions.grateful.aliases': 'благодарность,благодарен,благодарна,признательность',
  'emotions.lonely.label': 'Одиночество',
  'emotions.lonely.aliases': 'одиночество,одиноко,одинокий,одинокая',
  'emotions.hopeful.label': 'Надежда',
  'emotions.hopeful.aliases': 'надежда,оптимизм,с надеждой,полон надежды,полна надежды',
  'emotions.bored.label': 'Скука',
  'emotions.bored.aliases': 'скука,скучно,скучный,скучная',
  'emotions.proud.label': 'Гордость',
  'emotions.proud.aliases': 'гордость,горжусь,горд,горда,гордый,гордая',
  'emotions.focused.label': 'Сосредоточенность',
  'emotions.focused.aliases': 'сосредоточенность,сосредоточен,сосредоточена,концентрация,собранность',
  'emotions.overwhelmed.label': 'Перегруженность',
  'emotions.overwhelmed.aliases': 'перегруженность,перегружен,перегружена,перегрузка,завал',
};
export default messages;
