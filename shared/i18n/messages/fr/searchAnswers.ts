/**
 * fr - searchAnswers messages (server/src/search: parser explanations, period labels,
 * executor answers). Keys are prefixed 'searchAnswers.'; see shared/i18n/index.ts for the syntax.
 *
 * French notes: the comparator ("moins de 5", "au moins 8") is placed inside the metric
 * branches so each metric gets its natural construction ("les jours avec moins de 5 heures
 * de sommeil", "les jours où vous avez noté votre humeur à moins de 5"); the "à" also avoids
 * the de/d' elision problem in front of "au moins" / "exactement".
 */
const messages: Record<string, string> = {
  // Period labels (ParsedQuery.periodLabel and the {period} of every sentence) --------
  'searchAnswers.period.all': 'toute la période',
  'searchAnswers.period.allPhrase': 'sur l’ensemble du journal',
  'searchAnswers.period.today': 'aujourd’hui',
  'searchAnswers.period.yesterday': 'hier',
  'searchAnswers.period.twoDaysAgo': 'avant-hier',
  'searchAnswers.period.week': 'au cours de la dernière semaine',
  'searchAnswers.period.month': 'au cours du dernier mois',
  'searchAnswers.period.halfYear': 'au cours des six derniers mois',
  'searchAnswers.period.year': 'au cours de la dernière année',
  'searchAnswers.period.startYear': 'depuis le début de l’année',
  'searchAnswers.period.startMonth': 'depuis le début du mois',
  'searchAnswers.period.recent': 'ces derniers jours',
  'searchAnswers.period.lastDays': '{count, plural, one {aujourd’hui} other {au cours des # derniers jours}}',
  'searchAnswers.period.lastWeeks': '{count, plural, one {au cours de la dernière semaine} other {au cours des # dernières semaines}}',
  'searchAnswers.period.lastMonths': '{count, plural, one {au cours du dernier mois} other {au cours des # derniers mois}}',
  'searchAnswers.period.lastYears': '{count, plural, one {au cours de la dernière année} other {au cours des # dernières années}}',
  'searchAnswers.period.agoDays': '{count, plural, one {il y a un jour} other {il y a # jours}}',
  'searchAnswers.period.agoWeeks': '{count, plural, one {il y a une semaine} other {il y a # semaines}}',
  'searchAnswers.period.agoMonths': '{count, plural, one {il y a un mois} other {il y a # mois}}',
  'searchAnswers.period.agoYears': '{count, plural, one {il y a un an} other {il y a # ans}}',
  'searchAnswers.period.calendarMonth': 'en {month} {year}',
  'searchAnswers.period.onDate': 'le {date}',
  'searchAnswers.period.between': 'entre le {from} et le {to}',

  // Comparators ("less than 5") ------------------------------------------------------
  'searchAnswers.comparator.lt': 'moins de {value}',
  'searchAnswers.comparator.lte': 'au plus {value}',
  'searchAnswers.comparator.gt': 'plus de {value}',
  'searchAnswers.comparator.gte': 'au moins {value}',
  'searchAnswers.comparator.eq': 'exactement {value}',

  // Lists and quoting ----------------------------------------------------------------
  'searchAnswers.quoted': '« {term} »',
  'searchAnswers.listSeparator': ', ',
  'searchAnswers.dayWithValues': '{day} ({values})',
  'searchAnswers.value.mood': 'humeur {value}',
  'searchAnswers.value.energy': 'énergie {value}',
  'searchAnswers.value.stress': 'stress {value}',
  'searchAnswers.value.sleepHours': 'heures de sommeil {value}',
  'searchAnswers.value.sleepQuality': 'qualité du sommeil {value}',
  'searchAnswers.value.exerciseMinutes': 'minutes d’activité physique {value}',
  'searchAnswers.mention.something': 'quelque chose',

  // "How I understood the question" (ParsedQuery.explanation) ------------------------
  'searchAnswers.explain.best': 'Compris : les jours où vous vous sentiez le mieux, {period}.',
  'searchAnswers.explain.bestByMetric':
    'Compris : vos meilleurs jours selon {metric, select, mood {l’humeur} energy {le niveau d’énergie} stress {le niveau de stress} sleepHours {les heures de sommeil} sleepQuality {la qualité du sommeil} exerciseMinutes {les minutes d’activité physique} other {la valeur}}, {period}.',
  'searchAnswers.explain.worst': 'Compris : les jours les plus difficiles, {period}.',
  'searchAnswers.explain.worstByMetric':
    'Compris : les jours les plus difficiles selon {metric, select, mood {l’humeur} energy {le niveau d’énergie} stress {le niveau de stress} sleepHours {les heures de sommeil} sleepQuality {la qualité du sommeil} exerciseMinutes {les minutes d’activité physique} other {la valeur}}, {period}.',
  'searchAnswers.explain.filter':
    'Compris : {metric, select, mood {les jours où vous avez noté votre humeur à {comparison}} energy {les jours où vous avez noté votre énergie à {comparison}} stress {les jours où vous avez noté votre stress à {comparison}} sleepHours {les jours avec {comparison} heures de sommeil} sleepQuality {les jours où vous avez noté la qualité de votre sommeil à {comparison}} exerciseMinutes {les jours avec {comparison} minutes d’activité physique} other {les jours avec une valeur à {comparison}}}, {period}.',
  'searchAnswers.explain.trend':
    'Compris : l’évolution de {metric, select, mood {votre humeur} energy {votre niveau d’énergie} stress {votre niveau de stress} sleepHours {vos heures de sommeil} sleepQuality {la qualité de votre sommeil} exerciseMinutes {vos minutes d’activité physique} other {vos valeurs}}, {period}.',
  'searchAnswers.explain.mention': 'Compris : les entrées où vous avez écrit {terms}, {period}.',
  'searchAnswers.explain.mentionAny': 'Compris : les entrées que vous avez écrites, {period}.',
  'searchAnswers.explain.emotion': 'Compris : les jours avec l’émotion {emotions}, {period}.',
  'searchAnswers.explain.list': 'Compris : les entrées contenant {terms}, {period}.',
  'searchAnswers.explain.listAll': 'Compris : toutes les entrées, {period}.',
  'searchAnswers.explain.unknown': 'Je n’ai pas compris la question. Vous pouvez demander par exemple : « Quels jours du mois dernier est-ce que je me sentais le mieux ? »',

  // Answers ---------------------------------------------------------------------------
  'searchAnswers.noResults': 'Je n’ai trouvé aucune entrée correspondant à la question.',
  'searchAnswers.noResultsPeriod': 'Je n’ai trouvé aucune entrée correspondant à la question {period}.',
  'searchAnswers.rank.best': 'Les jours où vous vous sentiez le mieux {period} : {days}.',
  'searchAnswers.rank.bestByMetric':
    'Vos meilleurs jours selon {metric, select, mood {l’humeur} energy {le niveau d’énergie} stress {le niveau de stress} sleepHours {les heures de sommeil} sleepQuality {la qualité du sommeil} exerciseMinutes {les minutes d’activité physique} other {la valeur}} {period} : {days}.',
  'searchAnswers.rank.worst': 'Les jours les plus difficiles {period} : {days}.',
  'searchAnswers.rank.worstByMetric':
    'Les jours les plus difficiles selon {metric, select, mood {l’humeur} energy {le niveau d’énergie} stress {le niveau de stress} sleepHours {les heures de sommeil} sleepQuality {la qualité du sommeil} exerciseMinutes {les minutes d’activité physique} other {la valeur}} {period} : {days}.',
  'searchAnswers.filter.found':
    'J’ai trouvé {count, plural, one {# jour} other {# jours}} {metric, select, mood {où vous avez noté votre humeur à {comparison}} energy {où vous avez noté votre énergie à {comparison}} stress {où vous avez noté votre stress à {comparison}} sleepHours {avec {comparison} heures de sommeil} sleepQuality {où vous avez noté la qualité de votre sommeil à {comparison}} exerciseMinutes {avec {comparison} minutes d’activité physique} other {avec une valeur à {comparison}}} {period} : {days}{more, plural, =0 {} one { et # autre jour} other { et # autres jours}}.',
  'searchAnswers.emotion.found':
    'Vous avez noté l’émotion {emotions} sur {count, plural, one {# jour} other {# jours}} {period} : {days}{more, plural, =0 {} one { et # autre jour} other { et # autres jours}}.',
  'searchAnswers.mention.found':
    'Vous avez écrit {terms} dans {count, plural, one {# entrée {period}, le {first}} other {# entrées {period} ; la première le {first} et la dernière le {last}}}.',
  'searchAnswers.list.found': 'J’ai trouvé {count, plural, one {# entrée} other {# entrées}} {period} ; la plus récente date du {last}.',
  'searchAnswers.list.foundTerms':
    'J’ai trouvé {count, plural, one {# entrée contenant} other {# entrées contenant}} {terms} {period} ; la plus récente date du {last}.',
  'searchAnswers.unknown.fallback':
    'Je n’ai pas bien compris la question ; voici donc {count, plural, one {la dernière entrée} other {les # dernières entrées}} sur {total}. {explanation}',
  'searchAnswers.trend.insufficient':
    'Il n’y a pas assez de données pour dégager une tendance de {metric, select, mood {votre humeur} energy {votre niveau d’énergie} stress {votre niveau de stress} sleepHours {vos heures de sommeil} sleepQuality {la qualité de votre sommeil} exerciseMinutes {vos minutes d’activité physique} other {vos valeurs}} {period}.',
  'searchAnswers.trend.evidence':
    '(sur la base de {first, plural, one {# jour} other {# jours}} au début de la période et de {last, plural, one {# jour} other {# jours}} à la fin)',
  'searchAnswers.trend.stable':
    '{metric, select, mood {Votre humeur moyenne est restée stable} energy {Votre niveau d’énergie moyen est resté stable} stress {Votre niveau de stress moyen est resté stable} sleepHours {Votre temps de sommeil moyen est resté stable} sleepQuality {La qualité moyenne de votre sommeil est restée stable} exerciseMinutes {Votre temps d’activité physique moyen est resté stable} other {La valeur moyenne est restée stable}} {period} : {from} contre {to} {evidence}.',
  'searchAnswers.trend.up':
    '{metric, select, mood {Votre humeur moyenne a augmenté} energy {Votre niveau d’énergie moyen a augmenté} stress {Votre niveau de stress moyen a augmenté} sleepHours {Votre temps de sommeil moyen a augmenté} sleepQuality {La qualité moyenne de votre sommeil a augmenté} exerciseMinutes {Votre temps d’activité physique moyen a augmenté} other {La valeur moyenne a augmenté}}, passant de {from} à {to} {period} {evidence}.',
  'searchAnswers.trend.down':
    '{metric, select, mood {Votre humeur moyenne a baissé} energy {Votre niveau d’énergie moyen a baissé} stress {Votre niveau de stress moyen a baissé} sleepHours {Votre temps de sommeil moyen a baissé} sleepQuality {La qualité moyenne de votre sommeil a baissé} exerciseMinutes {Votre temps d’activité physique moyen a baissé} other {La valeur moyenne a baissé}}, passant de {from} à {to} {period} {evidence}.',

  // Request validation (POST /api/search) ----------------------------------------------
  'searchAnswers.validation.body': 'Le corps de la requête doit contenir une question (query)',
  'searchAnswers.validation.query': 'Saisissez une question',
  'searchAnswers.validation.queryTooLong': 'La question est trop longue ({max} caractères au maximum)',
  'searchAnswers.validation.limit': 'Le nombre de résultats doit être un nombre entier entre 1 et {max}',
};
export default messages;
