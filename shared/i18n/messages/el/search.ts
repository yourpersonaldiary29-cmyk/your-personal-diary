/** el - search messages. Keys are prefixed 'search.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Search page (src/pages/SearchPage.tsx) -------------------------------------------
  'search.title': 'Αναζήτηση',
  'search.label': 'Ρώτα το ημερολόγιό σου',
  'search.hint': 'Μια ερώτηση σε ελεύθερη μορφή, για παράδειγμα για ημέρες, διάθεση, ύπνο ή λέξεις που έγραψες.',
  'search.submit': 'Αναζήτηση',
  'search.searching': 'Αναζήτηση…',
  'search.examplesTitle': 'Παραδείγματα ερωτήσεων',
  'search.recentTitle': 'Πρόσφατες ερωτήσεις',
  'search.clearRecent': 'Εκκαθάριση',
  'search.resultsTitle': 'Αποτελέσματα',
  'search.understood': 'Πώς κατάλαβα την ερώτηση',
  'search.answer': 'Απάντηση',
  'search.days': 'Ημέρες',
  'search.entries': 'Καταχωρίσεις',
  'search.emptyQuestion': 'Γράψε μια ερώτηση',
  'search.untitled': 'Χωρίς τίτλο',
  'search.noRatings': 'Χωρίς βαθμολογίες',
  'search.period': 'Διάστημα: {label}',
  'search.matches': '{count, plural, one {Βρέθηκε # αποτέλεσμα} other {Βρέθηκαν # αποτελέσματα}}',

  // Per-day metrics line under a matching day ("mood 8, energy 7, sleep 7.5 hours, 1 entry")
  'search.day.mood': 'διάθεση {value}',
  'search.day.energy': 'ενέργεια {value}',
  'search.day.stress': 'άγχος {value}',
  'search.day.sleep': 'ύπνος {hours}',
  'search.day.entries': '{count, plural, one {# καταχώριση} other {# καταχωρίσεις}}',
  'search.day.separator': ', ',

  // Example questions. The server-side parser must understand these in every language
  // (keys 'search.example.1'..'search.example.6' are the contract with the search module).
  'search.example.1': 'Ποιες μέρες τον τελευταίο μήνα ένιωσα καλύτερα;',
  'search.example.2': 'Πότε έγραψα για κούραση;',
  'search.example.3': 'Ποιες μέρες κοιμήθηκα λιγότερο από πέντε ώρες;',
  'search.example.4': 'Πώς άλλαξε η διάθεσή μου τους τελευταίους τρεις μήνες;',
  'search.example.5': 'Ποιες μέρες είχα άγχος;',
  'search.example.6': 'Καταχωρίσεις με την ετικέτα δουλειά',
};
export default messages;
