/** de - insights messages. Keys are prefixed 'insights.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Insights page (src/pages/InsightsPage.tsx) ---------------------------------------
  'insights.title': 'Erkenntnisse',
  'insights.period': 'Zeitraum',
  'insights.refresh': 'Aktualisieren',
  'insights.notesTitle': 'Nicht geprüft / zu wenige Daten',
  'insights.disclaimer': 'Die Erkenntnisse beschreiben mögliche Zusammenhänge in deinen Daten. Sie belegen keinen Ursache-Wirkungs-Zusammenhang und sind keine medizinische Beratung.',
  'insights.empty.title': 'Für diesen Zeitraum gibt es noch keine Erkenntnisse',
  'insights.empty.text':
    'Um Muster zu erkennen, braucht es im Zeitraum mindestens {minDays} Tage mit Daten und in jeder Vergleichsgruppe mindestens {minGroupSize} Tage (zum Beispiel Tage mit und ohne Sport). Schreib weiter in dein Tagebuch und erfasse Stimmung, Schlaf und Aktivität.',
  'insights.newEntry': 'Neuer Eintrag',
  // {inPeriod} is 'stats.period.in' ("in the last 30 days"), {start}/{end} are short dates.
  'insights.summary': '{count, plural, one {# Tag} other {# Tage}} mit Daten {inPeriod} ({start} – {end})',
  'insights.found': '{count, plural, =0 {Keine Erkenntnisse gefunden} one {# Erkenntnis gefunden} other {# Erkenntnisse gefunden}}',

  // Section headings (src/pages/insights/insight-groups.ts) --------------------------
  'insights.group.trends': 'Trends',
  'insights.group.habits': 'Gewohnheiten',
  'insights.group.sleepActivity': 'Schlaf und Aktivität',
  'insights.group.daysHours': 'Tage und Uhrzeiten',
  'insights.group.emotionsPeople': 'Gefühle und Menschen',
  'insights.group.anomalies': 'Auffälligkeiten',
  'insights.group.other': 'Weitere Erkenntnisse',

  // Strength and direction badges ---------------------------------------------------
  'insights.strength.strong': 'Starkes Muster',
  'insights.strength.moderate': 'Mittleres Muster',
  'insights.strength.weak': 'Schwaches Muster',
  'insights.positive': 'Ermutigend',
  'insights.attention': 'Beachtenswert',

  // Insight card (src/pages/insights/InsightCard.tsx) --------------------------------
  'insights.card.why': 'Warum sehe ich diese Erkenntnis?',
  'insights.card.evidenceCaption': 'Die Daten hinter der Erkenntnis',
  'insights.card.relatedDays': 'Zugehörige Tage',
  'insights.card.period': 'Zeitraum: {start} – {end}',
  'insights.card.detail': 'Detail',
  'insights.card.value': 'Wert',
  'insights.card.daysExamined': 'Untersuchte Tage',
  'insights.card.metric': 'Messwert',
  'insights.card.correlation': 'Korrelation (r)',
  'insights.card.effectSize': 'Größe des Unterschieds',
  'insights.card.groupRow': '{count, plural, one {# Tag} other {# Tage}}, Durchschnitt {mean}',
  'insights.card.groupRowNoMean': '{count, plural, one {# Tag} other {# Tage}}',

  // Home page (src/pages/HomePage.tsx, GET /api/home) --------------------------------
  'insights.home.title': 'Startseite',
  'insights.home.newEntry': 'Neuer Eintrag',
  'insights.home.greetingLabel': 'Begrüßung',
  'insights.home.today': 'Heute',
  'insights.home.weekAverages': 'Durchschnittswerte der letzten 7 Tage',
  'insights.home.habitsToday': 'Heutige Gewohnheiten',
  'insights.home.insightOfDay': 'Erkenntnis des Tages',
  'insights.home.lastEntry': 'Letzter Eintrag',
  'insights.home.noData': 'Keine Daten',
  'insights.home.noHabits': 'Keine aktiven Gewohnheiten.',
  'insights.home.manageHabits': 'Gewohnheiten verwalten',
  'insights.home.allHabits': 'Alle Gewohnheiten',
  'insights.home.allInsights': 'Alle Erkenntnisse',
  'insights.home.noInsight': 'Noch keine Erkenntnisse. Schreib weiter in dein Tagebuch und erfasse Schlaf, Stimmung und Aktivität, um Muster zu entdecken.',
  'insights.home.noEntriesTitle': 'Noch keine Tagebucheinträge',
  'insights.home.noEntriesText': 'Mit dem ersten Eintrag beginnt jede Erkenntnis. Ein paar Sätze über deinen Tag genügen.',
  'insights.home.firstEntry': 'Den ersten Eintrag schreiben',
  'insights.home.untitled': 'Ohne Titel',
  'insights.home.streak': 'Schreibserie: {count, plural, one {# Tag} other {# Tage}}',
  'insights.home.entriesToday': '{count, plural, =0 {Heute noch kein Eintrag} one {# Eintrag heute} other {# Einträge heute}}',
  'insights.home.totalEntries': '{count, plural, one {Insgesamt # Eintrag im Tagebuch} other {Insgesamt # Einträge im Tagebuch}}',
  'insights.home.ratingOf10': '{value} von 10',
  'insights.home.sleepHours': '{value} Stunden',
  'insights.home.lastEntryMood': 'Stimmung: {value}',
};
export default messages;
