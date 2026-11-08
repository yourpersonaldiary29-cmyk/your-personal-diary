/** fr - insights messages. Keys are prefixed 'insights.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Insights page (src/pages/InsightsPage.tsx) ---------------------------------------
  'insights.title': 'Observations',
  'insights.period': 'Période',
  'insights.refresh': 'Actualiser',
  'insights.notesTitle': 'Non vérifié / données insuffisantes',
  'insights.disclaimer': 'Les observations décrivent des liens possibles dans vos données. Elles n’établissent pas de relation de cause à effet et ne constituent pas un avis médical.',
  'insights.empty.title': 'Pas encore d’observation pour cette période',
  'insights.empty.text':
    'Pour repérer des tendances, il faut au moins {minDays} jours avec des données sur la période, et au moins {minGroupSize} jours dans chaque groupe comparé (par exemple les jours avec et sans activité physique). Continuez à écrire dans votre journal et à noter votre humeur, votre sommeil et votre activité.',
  'insights.newEntry': 'Nouvelle entrée',
  // {inPeriod} is 'stats.period.in' ("in the last 30 days"), {start}/{end} are short dates.
  'insights.summary': '{count, plural, one {# jour} other {# jours}} avec des données {inPeriod} ({start} – {end})',
  'insights.found': '{count, plural, =0 {Aucune observation trouvée} one {# observation trouvée} other {# observations trouvées}}',

  // Section headings (src/pages/insights/insight-groups.ts) --------------------------
  'insights.group.trends': 'Tendances',
  'insights.group.habits': 'Habitudes',
  'insights.group.sleepActivity': 'Sommeil et activité',
  'insights.group.daysHours': 'Jours et moments',
  'insights.group.emotionsPeople': 'Émotions et personnes',
  'insights.group.anomalies': 'Valeurs inhabituelles',
  'insights.group.other': 'Autres observations',

  // Strength and direction badges ---------------------------------------------------
  'insights.strength.strong': 'Tendance forte',
  'insights.strength.moderate': 'Tendance modérée',
  'insights.strength.weak': 'Tendance faible',
  'insights.positive': 'Encourageant',
  'insights.attention': 'Point d’attention',

  // Insight card (src/pages/insights/InsightCard.tsx) --------------------------------
  'insights.card.why': 'Pourquoi cette observation ?',
  'insights.card.evidenceCaption': 'Les données derrière cette observation',
  'insights.card.relatedDays': 'Jours concernés',
  'insights.card.period': 'Période : {start} – {end}',
  'insights.card.detail': 'Détail',
  'insights.card.value': 'Valeur',
  'insights.card.daysExamined': 'Jours examinés',
  'insights.card.metric': 'Indicateur',
  'insights.card.correlation': 'Corrélation (r)',
  'insights.card.effectSize': 'Ampleur de l’écart',
  'insights.card.groupRow': '{count, plural, one {# jour} other {# jours}}, moyenne {mean}',
  'insights.card.groupRowNoMean': '{count, plural, one {# jour} other {# jours}}',

  // Home page (src/pages/HomePage.tsx, GET /api/home) --------------------------------
  'insights.home.title': 'Accueil',
  'insights.home.newEntry': 'Nouvelle entrée',
  'insights.home.greetingLabel': 'Message d’accueil',
  'insights.home.today': 'Aujourd’hui',
  'insights.home.weekAverages': 'Moyennes des 7 derniers jours',
  'insights.home.habitsToday': 'Habitudes du jour',
  'insights.home.insightOfDay': 'Observation du jour',
  'insights.home.lastEntry': 'Dernière entrée',
  'insights.home.noData': 'Aucune donnée',
  'insights.home.noHabits': 'Aucune habitude active.',
  'insights.home.manageHabits': 'Gérer les habitudes',
  'insights.home.allHabits': 'Toutes les habitudes',
  'insights.home.allInsights': 'Toutes les observations',
  'insights.home.noInsight': 'Pas encore d’observation. Continuez à écrire dans votre journal et à noter votre sommeil, votre humeur et votre activité pour découvrir des tendances.',
  'insights.home.noEntriesTitle': 'Aucune entrée pour l’instant',
  'insights.home.noEntriesText': 'Chaque observation commence par une première entrée. Quelques phrases sur votre journée suffisent.',
  'insights.home.firstEntry': 'Écrire la première entrée',
  'insights.home.untitled': 'Sans titre',
  'insights.home.streak': 'Série d’écriture : {count, plural, one {# jour} other {# jours}}',
  'insights.home.entriesToday': '{count, plural, =0 {Aucune entrée écrite aujourd’hui} one {# entrée aujourd’hui} other {# entrées aujourd’hui}}',
  'insights.home.totalEntries': '{count, plural, one {# entrée dans le journal au total} other {# entrées dans le journal au total}}',
  'insights.home.ratingOf10': '{value} sur 10',
  'insights.home.sleepHours': '{value} h',
  'insights.home.lastEntryMood': 'Humeur : {value}',
};
export default messages;
