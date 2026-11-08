/** el - stats messages. Keys are prefixed 'stats.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Statistics page (src/pages/StatsPage.tsx) ----------------------------------------
  'stats.title': 'Στατιστικά',
  'stats.period': 'Διάστημα',
  'stats.movingAvg': 'Κινητός μέσος όρος (7 ημέρες)',
  'stats.overTime': '{label} στην πορεία του χρόνου',
  'stats.weekday.section': 'Ανά ημέρα της εβδομάδας',
  'stats.weekday.chart': 'Μέσοι όροι ανά ημέρα της εβδομάδας',
  'stats.weekday.axis': 'Ημέρα της εβδομάδας',
  'stats.habits.section': 'Συνήθειες',
  'stats.habits.chart': '{name} – ημερήσιες τιμές',
  'stats.habits.empty': 'Δεν υπάρχουν συνήθειες με καταγραφές σε αυτό το διάστημα.',
  // {frequency} is 'daily' | 'weekly'; {current}/{best} are formatted streaks ("5 days").
  'stats.habits.summary':
    'Ολοκλήρωση: {percent} ({completed} από {frequency, select, weekly {{total, plural, one {# εβδομάδα} other {# εβδομάδες}}} other {{total, plural, one {# ημέρα} other {# ημέρες}}}}), τρέχον σερί: {current}, καλύτερο: {best}',
  'stats.empty.title': 'Δεν υπάρχουν ακόμη δεδομένα για αυτό το διάστημα',
  'stats.empty.text': 'Γράψε καταχωρίσεις και κατέγραψε συνήθειες για να δεις εδώ γραφήματα και τάσεις.',
  'stats.newEntry': 'Νέα καταχώριση',
  'stats.noValues': 'Δεν υπάρχουν δεδομένα σε αυτό το διάστημα.',
  'stats.overview':
    '{entries, plural, one {# καταχώριση} other {# καταχωρίσεις}} σε {days, plural, one {# ημέρα} other {# ημέρες}} ({from} – {to})',

  // Series summary under every chart -------------------------------------------------
  'stats.summary.base': 'Μέσος όρος {mean} ({sample}, ελάχιστο {min}, μέγιστο {max}).',
  'stats.summary.sampleDays': '{count, plural, one {# ημέρα} other {# ημέρες}}',
  'stats.summary.sampleValues': '{count, plural, one {# τιμή} other {# τιμές}}',
  'stats.summary.noChange': 'Καμία αλλαγή σε σχέση με το προηγούμενο διάστημα ({previous}).',
  'stats.summary.change': 'Σε σύγκριση με {previous} στο προηγούμενο διάστημα ({diff}).',
  'stats.summary.sentences': '{summary} {comparison}',
  'stats.summary.entriesPerDay': 'καταχωρίσεις ανά ημέρα',

  // Metric titles (chart sections; also the home page tiles) -------------------------
  'stats.metric.mood': 'Διάθεση',
  'stats.metric.energy': 'Επίπεδο ενέργειας',
  'stats.metric.stress': 'Επίπεδο άγχους',
  'stats.metric.sleepHours': 'Ώρες ύπνου',
  'stats.metric.sleepQuality': 'Ποιότητα ύπνου',
  'stats.metric.exerciseMinutes': 'Άσκηση',
  'stats.metric.entriesPerDay': 'Καταχωρίσεις ημερολογίου',

  // Periods (pickers on the statistics and insights pages) ---------------------------
  'stats.period.7d': '7 ημέρες',
  'stats.period.30d': '30 ημέρες',
  'stats.period.3m': '3 μήνες',
  'stats.period.6m': '6 μήνες',
  'stats.period.1y': '1 έτος',
  'stats.period.all': 'Όλο το διάστημα',
  'stats.period.in':
    '{period, select, 7d {τις τελευταίες 7 ημέρες} 30d {τις τελευταίες 30 ημέρες} 3m {τους τελευταίους 3 μήνες} 6m {τους τελευταίους 6 μήνες} 1y {τον τελευταίο χρόνο} all {σε όλο το διάστημα} other {στο επιλεγμένο διάστημα}}',

  // Charts (src/components/charts/chart-utils.ts) ------------------------------------
  'stats.chart.noData': 'Δεν υπάρχουν δεδομένα για εμφάνιση',
  'stats.chart.xAxisDate': 'Ημερομηνία',
  'stats.chart.valueWithUnit': '{value} {unit}',
  // Tooltip of one bar / marker: series label, x label (a date or a weekday), value with unit.
  'stats.chart.pointTooltip': '{label}, {x}: {value}',
  'stats.chart.summary': '{label}: {count, plural, one {# τιμή} other {# τιμές}}, ελάχιστο {min}, μέγιστο {max}, μέσος όρος {mean}.',
  'stats.chart.summaryEmpty': '{label}: χωρίς δεδομένα.',
  'stats.chart.range': '{count, plural, one {Ένα χρονικό σημείο: {from}.} other {# χρονικά σημεία, από {from} έως {to}.}}',
};
export default messages;
