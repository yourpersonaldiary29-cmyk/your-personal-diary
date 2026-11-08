/** el - insights messages. Keys are prefixed 'insights.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Insights page (src/pages/InsightsPage.tsx) ---------------------------------------
  'insights.title': 'Παρατηρήσεις',
  'insights.period': 'Διάστημα',
  'insights.refresh': 'Ανανέωση',
  'insights.notesTitle': 'Δεν ελέγχθηκαν / ανεπαρκή δεδομένα',
  'insights.disclaimer':
    'Οι παρατηρήσεις περιγράφουν πιθανές συσχετίσεις στα δεδομένα σου. Δεν αποδεικνύουν σχέση αιτίου και αποτελέσματος και δεν αποτελούν ιατρική συμβουλή.',
  'insights.empty.title': 'Δεν υπάρχουν ακόμη παρατηρήσεις για αυτό το διάστημα',
  'insights.empty.text':
    'Για να εντοπιστούν μοτίβα, χρειάζονται στο διάστημα τουλάχιστον {minDays} ημέρες με δεδομένα και τουλάχιστον {minGroupSize} ημέρες σε κάθε ομάδα σύγκρισης (για παράδειγμα ημέρες με και χωρίς άσκηση). Συνέχισε να γράφεις στο ημερολόγιο και να καταγράφεις διάθεση, ύπνο και δραστηριότητα.',
  'insights.newEntry': 'Νέα καταχώριση',
  // {inPeriod} is 'stats.period.in' ("in the last 30 days"), {start}/{end} are short dates.
  'insights.summary': '{count, plural, one {# ημέρα} other {# ημέρες}} με δεδομένα {inPeriod} ({start} – {end})',
  'insights.found': '{count, plural, =0 {Δεν βρέθηκαν παρατηρήσεις} one {Βρέθηκε # παρατήρηση} other {Βρέθηκαν # παρατηρήσεις}}',

  // Section headings (src/pages/insights/insight-groups.ts) --------------------------
  'insights.group.trends': 'Τάσεις',
  'insights.group.habits': 'Συνήθειες',
  'insights.group.sleepActivity': 'Ύπνος και δραστηριότητα',
  'insights.group.daysHours': 'Ημέρες και ώρες',
  'insights.group.emotionsPeople': 'Συναισθήματα και άνθρωποι',
  'insights.group.anomalies': 'Ασυνήθιστες ημέρες',
  'insights.group.other': 'Άλλες παρατηρήσεις',

  // Strength and direction badges ---------------------------------------------------
  'insights.strength.strong': 'Ισχυρό μοτίβο',
  'insights.strength.moderate': 'Μέτριο μοτίβο',
  'insights.strength.weak': 'Ασθενές μοτίβο',
  'insights.positive': 'Ενθαρρυντικό',
  'insights.attention': 'Αξίζει προσοχής',

  // Insight card (src/pages/insights/InsightCard.tsx) --------------------------------
  'insights.card.why': 'Γιατί βλέπω αυτή την παρατήρηση;',
  'insights.card.evidenceCaption': 'Τα δεδομένα πίσω από την παρατήρηση',
  'insights.card.relatedDays': 'Σχετικές ημέρες',
  'insights.card.period': 'Διάστημα: {start} – {end}',
  'insights.card.detail': 'Λεπτομέρεια',
  'insights.card.value': 'Τιμή',
  'insights.card.daysExamined': 'Ημέρες που εξετάστηκαν',
  'insights.card.metric': 'Δείκτης',
  'insights.card.correlation': 'Συσχέτιση (r)',
  'insights.card.effectSize': 'Μέγεθος διαφοράς',
  'insights.card.groupRow': '{count, plural, one {# ημέρα} other {# ημέρες}}, μέσος όρος {mean}',
  'insights.card.groupRowNoMean': '{count, plural, one {# ημέρα} other {# ημέρες}}',

  // Home page (src/pages/HomePage.tsx, GET /api/home) --------------------------------
  'insights.home.title': 'Αρχική',
  'insights.home.newEntry': 'Νέα καταχώριση',
  'insights.home.greetingLabel': 'Χαιρετισμός',
  'insights.home.today': 'Σήμερα',
  'insights.home.weekAverages': 'Μέσοι όροι των τελευταίων 7 ημερών',
  'insights.home.habitsToday': 'Οι σημερινές συνήθειες',
  'insights.home.insightOfDay': 'Η παρατήρηση της ημέρας',
  'insights.home.lastEntry': 'Τελευταία καταχώριση',
  'insights.home.noData': 'Χωρίς δεδομένα',
  'insights.home.noHabits': 'Δεν υπάρχουν ενεργές συνήθειες.',
  'insights.home.manageHabits': 'Διαχείριση συνηθειών',
  'insights.home.allHabits': 'Όλες οι συνήθειες',
  'insights.home.allInsights': 'Όλες οι παρατηρήσεις',
  'insights.home.noInsight':
    'Δεν υπάρχουν ακόμη παρατηρήσεις. Συνέχισε να γράφεις στο ημερολόγιο και να καταγράφεις ύπνο, διάθεση και δραστηριότητα για να ανακαλύψεις μοτίβα.',
  'insights.home.noEntriesTitle': 'Δεν υπάρχουν ακόμη καταχωρίσεις στο ημερολόγιο',
  'insights.home.noEntriesText': 'Η πρώτη καταχώριση είναι η αρχή κάθε παρατήρησης. Αρκούν λίγες προτάσεις για τη μέρα σου.',
  'insights.home.firstEntry': 'Γράψε την πρώτη καταχώριση',
  'insights.home.untitled': 'Χωρίς τίτλο',
  'insights.home.streak': 'Σερί γραψίματος: {count, plural, one {# ημέρα} other {# ημέρες}}',
  'insights.home.entriesToday':
    '{count, plural, =0 {Δεν έχεις γράψει ακόμη σήμερα} one {# καταχώριση σήμερα} other {# καταχωρίσεις σήμερα}}',
  'insights.home.totalEntries':
    '{count, plural, one {# καταχώριση συνολικά στο ημερολόγιο} other {# καταχωρίσεις συνολικά στο ημερολόγιο}}',
  'insights.home.ratingOf10': '{value} από 10',
  'insights.home.sleepHours': '{value} ώρες',
  'insights.home.lastEntryMood': 'Διάθεση: {value}',
};
export default messages;
