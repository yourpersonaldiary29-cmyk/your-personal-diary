/**
 * hu - searchAnswers messages (server/src/search: parser explanations, period labels,
 * executor answers). Keys are prefixed 'searchAnswers.'; see shared/i18n/index.ts for the syntax.
 *
 * Hungarian notes: `{period}` is a ready adverbial ("az elmúlt hónapban", "a teljes naplóban");
 * placeholders never take a suffix, so values are introduced by "értékről / értékre", lists
 * follow a colon, and the month of 'period.calendarMonth' is selected by its name to get the
 * possessive + inessive form ("2026 júliusában").
 */
const messages: Record<string, string> = {
  // Period labels (ParsedQuery.periodLabel and the {period} of every sentence) --------
  'searchAnswers.period.all': 'teljes időszak',
  'searchAnswers.period.allPhrase': 'a teljes naplóban',
  'searchAnswers.period.today': 'ma',
  'searchAnswers.period.yesterday': 'tegnap',
  'searchAnswers.period.twoDaysAgo': 'tegnapelőtt',
  'searchAnswers.period.week': 'az elmúlt héten',
  'searchAnswers.period.month': 'az elmúlt hónapban',
  'searchAnswers.period.halfYear': 'az elmúlt hat hónapban',
  'searchAnswers.period.year': 'az elmúlt évben',
  'searchAnswers.period.startYear': 'az év eleje óta',
  'searchAnswers.period.startMonth': 'a hónap eleje óta',
  'searchAnswers.period.recent': 'az elmúlt napokban',
  'searchAnswers.period.lastDays': '{count, plural, one {ma} other {az elmúlt # napban}}',
  'searchAnswers.period.lastWeeks': '{count, plural, one {az elmúlt héten} other {az elmúlt # hétben}}',
  'searchAnswers.period.lastMonths': '{count, plural, one {az elmúlt hónapban} other {az elmúlt # hónapban}}',
  'searchAnswers.period.lastYears': '{count, plural, one {az elmúlt évben} other {az elmúlt # évben}}',
  'searchAnswers.period.agoDays': '{count, plural, one {egy napja} other {# napja}}',
  'searchAnswers.period.agoWeeks': '{count, plural, one {egy hete} other {# hete}}',
  'searchAnswers.period.agoMonths': '{count, plural, one {egy hónapja} other {# hónapja}}',
  'searchAnswers.period.agoYears': '{count, plural, one {egy éve} other {# éve}}',
  'searchAnswers.period.calendarMonth':
    '{month, select, január {{year} januárjában} február {{year} februárjában} március {{year} márciusában} április {{year} áprilisában} május {{year} májusában} június {{year} júniusában} július {{year} júliusában} augusztus {{year} augusztusában} szeptember {{year} szeptemberében} október {{year} októberében} november {{year} novemberében} december {{year} decemberében} other {{year}. {month} hónapban}}',
  'searchAnswers.period.onDate': '{date} napon',
  'searchAnswers.period.between': '{from} és {to} között',

  // Comparators ("kevesebb, mint 5") ---------------------------------------------------
  'searchAnswers.comparator.lt': 'kevesebb, mint {value}',
  'searchAnswers.comparator.lte': 'legfeljebb {value}',
  'searchAnswers.comparator.gt': 'több, mint {value}',
  'searchAnswers.comparator.gte': 'legalább {value}',
  'searchAnswers.comparator.eq': 'pontosan {value}',

  // Lists and quoting ----------------------------------------------------------------
  'searchAnswers.quoted': '„{term}”',
  'searchAnswers.listSeparator': ', ',
  'searchAnswers.dayWithValues': '{day} ({values})',
  'searchAnswers.value.mood': 'hangulat: {value}',
  'searchAnswers.value.energy': 'energia: {value}',
  'searchAnswers.value.stress': 'stressz: {value}',
  'searchAnswers.value.sleepHours': 'alvásidő: {value}',
  'searchAnswers.value.sleepQuality': 'alvásminőség: {value}',
  'searchAnswers.value.exerciseMinutes': 'testmozgás: {value} perc',
  'searchAnswers.mention.something': 'bármilyen szöveg',

  // "How I understood the question" (ParsedQuery.explanation) ------------------------
  'searchAnswers.explain.best': 'Így értettem: azok a napok, amikor a legjobban érezted magad, {period}.',
  'searchAnswers.explain.bestByMetric':
    'Így értettem: a legjobb napok {metric, select, mood {a hangulat alapján} energy {az energiaszint alapján} stress {a stresszszint alapján} sleepHours {az alvásidő alapján} sleepQuality {az alvásminőség alapján} exerciseMinutes {a mozgással töltött idő alapján} other {az érték alapján}}, {period}.',
  'searchAnswers.explain.worst': 'Így értettem: a legnehezebb napok, {period}.',
  'searchAnswers.explain.worstByMetric':
    'Így értettem: a legnehezebb napok {metric, select, mood {a hangulat alapján} energy {az energiaszint alapján} stress {a stresszszint alapján} sleepHours {az alvásidő alapján} sleepQuality {az alvásminőség alapján} exerciseMinutes {a mozgással töltött idő alapján} other {az érték alapján}}, {period}.',
  'searchAnswers.explain.filter':
    'Így értettem: azok a napok, amikor {metric, select, mood {a hangulat} energy {az energiaszint} stress {a stresszszint} sleepHours {az alvásidő} sleepQuality {az alvásminőség} exerciseMinutes {a mozgással töltött idő} other {az érték}} {comparison} volt, {period}.',
  'searchAnswers.explain.trend':
    'Így értettem: hogyan változott {metric, select, mood {a hangulatod} energy {az energiaszinted} stress {a stresszszinted} sleepHours {az alvásidőd} sleepQuality {az alvásod minősége} exerciseMinutes {a mozgással töltött időd} other {az érték}}, {period}.',
  'searchAnswers.explain.mention': 'Így értettem: bejegyzések, amelyekben ezt írtad: {terms}, {period}.',
  'searchAnswers.explain.mentionAny': 'Így értettem: a bejegyzéseid, {period}.',
  'searchAnswers.explain.emotion': 'Így értettem: azok a napok, amikor így érezted magad: {emotions}, {period}.',
  'searchAnswers.explain.list': 'Így értettem: bejegyzések, amelyekben ez szerepel: {terms}, {period}.',
  'searchAnswers.explain.listAll': 'Így értettem: az összes bejegyzés, {period}.',
  'searchAnswers.explain.unknown':
    'Nem sikerült megértenem a kérdést. Kérdezhetsz például így: „Az elmúlt hónapban mely napokon éreztem magam a legjobban?”',

  // Answers ---------------------------------------------------------------------------
  'searchAnswers.noResults': 'Nem találtam a kérdésnek megfelelő bejegyzést.',
  'searchAnswers.noResultsPeriod': 'Nem találtam a kérdésnek megfelelő bejegyzést {period}.',
  'searchAnswers.rank.best': 'Azok a napok, amikor a legjobban érezted magad {period}: {days}.',
  'searchAnswers.rank.bestByMetric':
    'A legjobb napok {metric, select, mood {a hangulat alapján} energy {az energiaszint alapján} stress {a stresszszint alapján} sleepHours {az alvásidő alapján} sleepQuality {az alvásminőség alapján} exerciseMinutes {a mozgással töltött idő alapján} other {az érték alapján}} {period}: {days}.',
  'searchAnswers.rank.worst': 'A legnehezebb napok {period}: {days}.',
  'searchAnswers.rank.worstByMetric':
    'A legnehezebb napok {metric, select, mood {a hangulat alapján} energy {az energiaszint alapján} stress {a stresszszint alapján} sleepHours {az alvásidő alapján} sleepQuality {az alvásminőség alapján} exerciseMinutes {a mozgással töltött idő alapján} other {az érték alapján}} {period}: {days}.',
  'searchAnswers.filter.found':
    '{count, plural, one {# olyan napot} other {# olyan napot}} találtam {period}, amikor {metric, select, mood {a hangulat} energy {az energiaszint} stress {a stresszszint} sleepHours {az alvásidő} sleepQuality {az alvásminőség} exerciseMinutes {a mozgással töltött idő} other {az érték}} {comparison} volt: {days}{more, plural, =0 {} one { és még # nap} other { és még # nap}}.',
  'searchAnswers.emotion.found':
    '{count, plural, one {# napon} other {# napon}} érezted így magad {period} ({emotions}): {days}{more, plural, =0 {} one { és még # nap} other { és még # nap}}.',
  'searchAnswers.mention.found':
    'Találatok a keresett szövegre ({terms}): {count, plural, one {# bejegyzés {period}, dátuma: {first}} other {# bejegyzés {period}; az első: {first}, az utolsó: {last}}}.',
  'searchAnswers.list.found': '{count, plural, one {# bejegyzést} other {# bejegyzést}} találtam {period}; a legutóbbi dátuma: {last}.',
  'searchAnswers.list.foundTerms':
    '{count, plural, one {# bejegyzést} other {# bejegyzést}} találtam {period}, amelyben ez szerepel: {terms}; a legutóbbi dátuma: {last}.',
  'searchAnswers.unknown.fallback':
    'Nem voltam biztos benne, mi a kérdés, ezért itt {count, plural, one {a legutóbbi bejegyzés látható} other {a legutóbbi # bejegyzés látható}}, összesen {total} bejegyzésből. {explanation}',
  'searchAnswers.trend.insufficient':
    'Nincs elég adat ahhoz, hogy trendet lássak {metric, select, mood {a hangulatodban} energy {az energiaszintedben} stress {a stresszszintedben} sleepHours {az alvásidődben} sleepQuality {az alvásod minőségében} exerciseMinutes {a mozgással töltött idődben} other {az értékeidben}} {period}.',
  'searchAnswers.trend.evidence':
    '(az időszak elejéről {first, plural, one {# nap} other {# nap}}, a végéről {last, plural, one {# nap} other {# nap}} adatai alapján)',
  'searchAnswers.trend.stable':
    '{metric, select, mood {Az átlagos hangulatod} energy {Az átlagos energiaszinted} stress {Az átlagos stresszszinted} sleepHours {Az átlagos alvásidőd} sleepQuality {Az alvásod átlagos minősége} exerciseMinutes {A mozgással töltött átlagos időd} other {Az átlagos érték}} {period} stabil maradt: {from}, illetve {to} {evidence}.',
  'searchAnswers.trend.up':
    '{metric, select, mood {Az átlagos hangulatod} energy {Az átlagos energiaszinted} stress {Az átlagos stresszszinted} sleepHours {Az átlagos alvásidőd} sleepQuality {Az alvásod átlagos minősége} exerciseMinutes {A mozgással töltött átlagos időd} other {Az átlagos érték}} {period} {from} értékről {to} értékre emelkedett {evidence}.',
  'searchAnswers.trend.down':
    '{metric, select, mood {Az átlagos hangulatod} energy {Az átlagos energiaszinted} stress {Az átlagos stresszszinted} sleepHours {Az átlagos alvásidőd} sleepQuality {Az alvásod átlagos minősége} exerciseMinutes {A mozgással töltött átlagos időd} other {Az átlagos érték}} {period} {from} értékről {to} értékre csökkent {evidence}.',

  // Request validation (POST /api/search) ----------------------------------------------
  'searchAnswers.validation.body': 'A kérés törzsének tartalmaznia kell egy kérdést (query)',
  'searchAnswers.validation.query': 'Írj be egy kérdést',
  'searchAnswers.validation.queryTooLong': 'A kérdés túl hosszú (legfeljebb {max} karakter)',
  'searchAnswers.validation.limit': 'A találatok számának 1 és {max} közötti egész számnak kell lennie',
};
export default messages;
