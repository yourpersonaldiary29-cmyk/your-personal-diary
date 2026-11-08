/** fr - stats messages. Keys are prefixed 'stats.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Statistics page (src/pages/StatsPage.tsx) ----------------------------------------
  'stats.title': 'Statistiques',
  'stats.period': 'Période',
  'stats.movingAvg': 'Moyenne mobile (7 jours)',
  'stats.overTime': '{label} au fil du temps',
  'stats.weekday.section': 'Par jour de la semaine',
  'stats.weekday.chart': 'Moyennes par jour de la semaine',
  'stats.weekday.axis': 'Jour de la semaine',
  'stats.habits.section': 'Habitudes',
  'stats.habits.chart': '{name} - valeurs quotidiennes',
  'stats.habits.empty': 'Aucune habitude renseignée sur cette période.',
  // {frequency} is 'daily' | 'weekly'; {current}/{best} are formatted streaks ("5 days").
  'stats.habits.summary':
    'Réalisation : {percent} ({completed} sur {frequency, select, weekly {{total, plural, one {# semaine} other {# semaines}}} other {{total, plural, one {# jour} other {# jours}}}}), série en cours : {current}, record : {best}',
  'stats.empty.title': 'Pas encore de données pour cette période',
  'stats.empty.text': 'Écrivez des entrées et renseignez vos habitudes pour voir ici des graphiques et des tendances.',
  'stats.newEntry': 'Nouvelle entrée',
  'stats.noValues': 'Aucune donnée sur cette période.',
  'stats.overview': '{entries, plural, one {# entrée} other {# entrées}} sur {days, plural, one {# jour} other {# jours}} ({from} – {to})',

  // Series summary under every chart -------------------------------------------------
  'stats.summary.base': 'Moyenne {mean} ({sample}, minimum {min}, maximum {max}).',
  'stats.summary.sampleDays': '{count, plural, one {# jour} other {# jours}}',
  'stats.summary.sampleValues': '{count, plural, one {# valeur} other {# valeurs}}',
  'stats.summary.noChange': 'Aucun changement par rapport à la période précédente ({previous}).',
  'stats.summary.change': 'Par rapport à {previous} sur la période précédente ({diff}).',
  'stats.summary.sentences': '{summary} {comparison}',
  'stats.summary.entriesPerDay': 'entrées par jour',

  // Metric titles (chart sections; also the home page tiles) -------------------------
  'stats.metric.mood': 'Humeur',
  'stats.metric.energy': 'Niveau d’énergie',
  'stats.metric.stress': 'Niveau de stress',
  'stats.metric.sleepHours': 'Heures de sommeil',
  'stats.metric.sleepQuality': 'Qualité du sommeil',
  'stats.metric.exerciseMinutes': 'Activité physique',
  'stats.metric.entriesPerDay': 'Entrées du journal',

  // Periods (pickers on the statistics and insights pages) ---------------------------
  'stats.period.7d': '7 jours',
  'stats.period.30d': '30 jours',
  'stats.period.3m': '3 mois',
  'stats.period.6m': '6 mois',
  'stats.period.1y': '1 an',
  'stats.period.all': 'Toute la période',
  'stats.period.in':
    '{period, select, 7d {sur les 7 derniers jours} 30d {sur les 30 derniers jours} 3m {sur les 3 derniers mois} 6m {sur les 6 derniers mois} 1y {sur la dernière année} all {sur toute la période} other {sur la période}}',

  // Charts (src/components/charts/chart-utils.ts) ------------------------------------
  'stats.chart.noData': 'Aucune donnée à afficher',
  'stats.chart.xAxisDate': 'Date',
  'stats.chart.valueWithUnit': '{value} {unit}',
  // Tooltip of one bar / marker: series label, x label (a date or a weekday), value with unit.
  'stats.chart.pointTooltip': '{label}, {x} : {value}',
  'stats.chart.summary': '{label} : {count, plural, one {# valeur} other {# valeurs}}, minimum {min}, maximum {max}, moyenne {mean}.',
  'stats.chart.summaryEmpty': '{label} : aucune donnée.',
  'stats.chart.range': '{count, plural, =1 {Un seul point dans le temps : {from}.} one {# point dans le temps, du {from} au {to}.} other {# points dans le temps, du {from} au {to}.}}',
};
export default messages;
