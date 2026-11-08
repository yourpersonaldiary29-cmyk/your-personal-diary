/** it - insights messages. Keys are prefixed 'insights.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Insights page (src/pages/InsightsPage.tsx) ---------------------------------------
  'insights.title': 'Osservazioni',
  'insights.period': 'Periodo',
  'insights.refresh': 'Aggiorna',
  'insights.notesTitle': 'Non verificato / dati insufficienti',
  'insights.disclaimer': 'Le osservazioni descrivono possibili relazioni nei tuoi dati. Non stabiliscono un rapporto di causa ed effetto e non sono consigli medici.',
  'insights.empty.title': 'Ancora nessuna osservazione per questo periodo',
  'insights.empty.text':
    'Per individuare delle tendenze servono almeno {minDays} giorni con dati nel periodo e almeno {minGroupSize} giorni in ciascun gruppo di confronto (per esempio giorni con e senza attività fisica). Continua a scrivere nel diario e a registrare umore, sonno e attività.',
  'insights.newEntry': 'Nuova voce',
  // {inPeriod} is 'stats.period.in' ("in the last 30 days"), {start}/{end} are short dates.
  'insights.summary': '{count, plural, one {# giorno} other {# giorni}} con dati {inPeriod} ({start} – {end})',
  'insights.found': '{count, plural, =0 {Nessuna osservazione trovata} one {# osservazione trovata} other {# osservazioni trovate}}',

  // Section headings (src/pages/insights/insight-groups.ts) --------------------------
  'insights.group.trends': 'Tendenze',
  'insights.group.habits': 'Abitudini',
  'insights.group.sleepActivity': 'Sonno e attività',
  'insights.group.daysHours': 'Giorni e orari',
  'insights.group.emotionsPeople': 'Emozioni e persone',
  'insights.group.anomalies': 'Valori insoliti',
  'insights.group.other': 'Altre osservazioni',

  // Strength and direction badges ---------------------------------------------------
  'insights.strength.strong': 'Tendenza forte',
  'insights.strength.moderate': 'Tendenza moderata',
  'insights.strength.weak': 'Tendenza debole',
  'insights.positive': 'Incoraggiante',
  'insights.attention': 'Merita attenzione',

  // Insight card (src/pages/insights/InsightCard.tsx) --------------------------------
  'insights.card.why': 'Perché vedo questa osservazione?',
  'insights.card.evidenceCaption': 'I dati alla base dell’osservazione',
  'insights.card.relatedDays': 'Giorni collegati',
  'insights.card.period': 'Periodo: {start} – {end}',
  'insights.card.detail': 'Dettaglio',
  'insights.card.value': 'Valore',
  'insights.card.daysExamined': 'Giorni esaminati',
  'insights.card.metric': 'Indicatore',
  'insights.card.correlation': 'Correlazione (r)',
  'insights.card.effectSize': 'Entità della differenza',
  'insights.card.groupRow': '{count, plural, one {# giorno} other {# giorni}}, media {mean}',
  'insights.card.groupRowNoMean': '{count, plural, one {# giorno} other {# giorni}}',

  // Home page (src/pages/HomePage.tsx, GET /api/home) --------------------------------
  'insights.home.title': 'Home',
  'insights.home.newEntry': 'Nuova voce',
  'insights.home.greetingLabel': 'Saluto',
  'insights.home.today': 'Oggi',
  'insights.home.weekAverages': 'Medie degli ultimi 7 giorni',
  'insights.home.habitsToday': 'Abitudini di oggi',
  'insights.home.insightOfDay': 'Osservazione del giorno',
  'insights.home.lastEntry': 'Ultima voce',
  'insights.home.noData': 'Nessun dato',
  'insights.home.noHabits': 'Nessuna abitudine attiva.',
  'insights.home.manageHabits': 'Gestisci le abitudini',
  'insights.home.allHabits': 'Tutte le abitudini',
  'insights.home.allInsights': 'Tutte le osservazioni',
  'insights.home.noInsight': 'Ancora nessuna osservazione. Continua a scrivere nel diario e a registrare sonno, umore e attività per scoprire delle tendenze.',
  'insights.home.noEntriesTitle': 'Ancora nessuna voce nel diario',
  'insights.home.noEntriesText': 'Ogni osservazione nasce dalla prima voce. Bastano poche frasi sulla tua giornata.',
  'insights.home.firstEntry': 'Scrivi la prima voce',
  'insights.home.untitled': 'Senza titolo',
  'insights.home.streak': 'Serie di scrittura: {count, plural, one {# giorno} other {# giorni}}',
  'insights.home.entriesToday': '{count, plural, =0 {Nessuna voce scritta oggi} one {# voce oggi} other {# voci oggi}}',
  'insights.home.totalEntries': '{count, plural, one {# voce nel diario in totale} other {# voci nel diario in totale}}',
  'insights.home.ratingOf10': '{value} su 10',
  'insights.home.sleepHours': '{value} h',
  'insights.home.lastEntryMood': 'Umore: {value}',
};
export default messages;
