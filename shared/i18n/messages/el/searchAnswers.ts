/**
 * el - searchAnswers messages (server/src/search: parser explanations, period labels,
 * executor answers). Keys are prefixed 'searchAnswers.'; see shared/i18n/index.ts for the syntax.
 *
 * Greek notes: `{period}` is a ready adverbial phrase ("τον τελευταίο μήνα"). `{month}` in
 * 'period.calendarMonth' is the month name from Intl, which for Greek is the genitive
 * ("Ιουλίου") in current ICU and the nominative ("Ιούλιος") in some runtimes: the select maps
 * both to the accusative ("τον Ιούλιο") and falls back to "τον μήνα …" for any other spelling.
 */
const messages: Record<string, string> = {
  // Period labels (ParsedQuery.periodLabel and the {period} of every sentence) --------
  'searchAnswers.period.all': 'όλο το διάστημα',
  'searchAnswers.period.allPhrase': 'σε όλο το ημερολόγιο',
  'searchAnswers.period.today': 'σήμερα',
  'searchAnswers.period.yesterday': 'χθες',
  'searchAnswers.period.twoDaysAgo': 'προχθές',
  'searchAnswers.period.week': 'την τελευταία εβδομάδα',
  'searchAnswers.period.month': 'τον τελευταίο μήνα',
  'searchAnswers.period.halfYear': 'τους τελευταίους έξι μήνες',
  'searchAnswers.period.year': 'τον τελευταίο χρόνο',
  'searchAnswers.period.startYear': 'από την αρχή του έτους',
  'searchAnswers.period.startMonth': 'από την αρχή του μήνα',
  'searchAnswers.period.recent': 'τις τελευταίες ημέρες',
  'searchAnswers.period.lastDays': '{count, plural, one {σήμερα} other {τις τελευταίες # ημέρες}}',
  'searchAnswers.period.lastWeeks': '{count, plural, one {την τελευταία εβδομάδα} other {τις τελευταίες # εβδομάδες}}',
  'searchAnswers.period.lastMonths': '{count, plural, one {τον τελευταίο μήνα} other {τους τελευταίους # μήνες}}',
  'searchAnswers.period.lastYears': '{count, plural, one {τον τελευταίο χρόνο} other {τα τελευταία # χρόνια}}',
  'searchAnswers.period.agoDays': '{count, plural, one {πριν από μία ημέρα} other {πριν από # ημέρες}}',
  'searchAnswers.period.agoWeeks': '{count, plural, one {πριν από μία εβδομάδα} other {πριν από # εβδομάδες}}',
  'searchAnswers.period.agoMonths': '{count, plural, one {πριν από έναν μήνα} other {πριν από # μήνες}}',
  'searchAnswers.period.agoYears': '{count, plural, one {πριν από έναν χρόνο} other {πριν από # χρόνια}}',
  'searchAnswers.period.calendarMonth':
    '{month, select, Ιανουαρίου {τον Ιανουάριο} Ιανουάριος {τον Ιανουάριο} Φεβρουαρίου {τον Φεβρουάριο} Φεβρουάριος {τον Φεβρουάριο} Μαρτίου {τον Μάρτιο} Μάρτιος {τον Μάρτιο} Απριλίου {τον Απρίλιο} Απρίλιος {τον Απρίλιο} Μαΐου {τον Μάιο} Μάιος {τον Μάιο} Ιουνίου {τον Ιούνιο} Ιούνιος {τον Ιούνιο} Ιουλίου {τον Ιούλιο} Ιούλιος {τον Ιούλιο} Αυγούστου {τον Αύγουστο} Αύγουστος {τον Αύγουστο} Σεπτεμβρίου {τον Σεπτέμβριο} Σεπτέμβριος {τον Σεπτέμβριο} Οκτωβρίου {τον Οκτώβριο} Οκτώβριος {τον Οκτώβριο} Νοεμβρίου {τον Νοέμβριο} Νοέμβριος {τον Νοέμβριο} Δεκεμβρίου {τον Δεκέμβριο} Δεκέμβριος {τον Δεκέμβριο} other {τον μήνα {month}}} του {year}',
  'searchAnswers.period.onDate': 'στις {date}',
  'searchAnswers.period.between': 'μεταξύ {from} και {to}',

  // Comparators ("less than 5") ------------------------------------------------------
  'searchAnswers.comparator.lt': 'λιγότερο από {value}',
  'searchAnswers.comparator.lte': 'το πολύ {value}',
  'searchAnswers.comparator.gt': 'περισσότερο από {value}',
  'searchAnswers.comparator.gte': 'τουλάχιστον {value}',
  'searchAnswers.comparator.eq': 'ακριβώς {value}',

  // Lists and quoting ----------------------------------------------------------------
  'searchAnswers.quoted': '«{term}»',
  'searchAnswers.listSeparator': ', ',
  'searchAnswers.dayWithValues': '{day} ({values})',
  'searchAnswers.value.mood': 'διάθεση {value}',
  'searchAnswers.value.energy': 'ενέργεια {value}',
  'searchAnswers.value.stress': 'άγχος {value}',
  'searchAnswers.value.sleepHours': 'ώρες ύπνου {value}',
  'searchAnswers.value.sleepQuality': 'ποιότητα ύπνου {value}',
  'searchAnswers.value.exerciseMinutes': 'λεπτά άσκησης {value}',
  'searchAnswers.mention.something': 'κάτι',

  // "How I understood the question" (ParsedQuery.explanation) ------------------------
  'searchAnswers.explain.best': 'Κατάλαβα: οι ημέρες που ένιωσες καλύτερα, {period}.',
  'searchAnswers.explain.bestByMetric':
    'Κατάλαβα: οι ημέρες που ένιωσες καλύτερα ως προς {metric, select, mood {τη διάθεση} energy {το επίπεδο ενέργειας} stress {το επίπεδο άγχους} sleepHours {τις ώρες ύπνου} sleepQuality {την ποιότητα ύπνου} exerciseMinutes {τα λεπτά άσκησης} other {την τιμή}}, {period}.',
  'searchAnswers.explain.worst': 'Κατάλαβα: οι πιο δύσκολες ημέρες, {period}.',
  'searchAnswers.explain.worstByMetric':
    'Κατάλαβα: οι πιο δύσκολες ημέρες ως προς {metric, select, mood {τη διάθεση} energy {το επίπεδο ενέργειας} stress {το επίπεδο άγχους} sleepHours {τις ώρες ύπνου} sleepQuality {την ποιότητα ύπνου} exerciseMinutes {τα λεπτά άσκησης} other {την τιμή}}, {period}.',
  'searchAnswers.explain.filter':
    'Κατάλαβα: ημέρες με {metric, select, mood {διάθεση} energy {επίπεδο ενέργειας} stress {επίπεδο άγχους} sleepHours {ώρες ύπνου} sleepQuality {ποιότητα ύπνου} exerciseMinutes {λεπτά άσκησης} other {τιμή}} {comparison}, {period}.',
  'searchAnswers.explain.trend':
    'Κατάλαβα: {metric, select, mood {πώς άλλαξε η διάθεσή σου} energy {πώς άλλαξε το επίπεδο ενέργειάς σου} stress {πώς άλλαξε το επίπεδο άγχους σου} sleepHours {πώς άλλαξε η διάρκεια του ύπνου σου} sleepQuality {πώς άλλαξε η ποιότητα του ύπνου σου} exerciseMinutes {πώς άλλαξε ο χρόνος άσκησής σου} other {πώς άλλαξαν οι τιμές σου}}, {period}.',
  'searchAnswers.explain.mention': 'Κατάλαβα: καταχωρίσεις όπου έγραψες {terms}, {period}.',
  'searchAnswers.explain.mentionAny': 'Κατάλαβα: οι καταχωρίσεις που έγραψες, {period}.',
  'searchAnswers.explain.emotion': 'Κατάλαβα: ημέρες με το συναίσθημα {emotions}, {period}.',
  'searchAnswers.explain.list': 'Κατάλαβα: καταχωρίσεις που περιέχουν {terms}, {period}.',
  'searchAnswers.explain.listAll': 'Κατάλαβα: όλες οι καταχωρίσεις, {period}.',
  'searchAnswers.explain.unknown':
    'Δεν μπόρεσα να καταλάβω την ερώτηση. Μπορείς να ρωτήσεις, για παράδειγμα: «Ποιες μέρες τον τελευταίο μήνα ένιωσα καλύτερα;»',

  // Answers ---------------------------------------------------------------------------
  'searchAnswers.noResults': 'Δεν βρήκα καταχωρίσεις που να ταιριάζουν με την ερώτηση.',
  'searchAnswers.noResultsPeriod': 'Δεν βρήκα {period} καταχωρίσεις που να ταιριάζουν με την ερώτηση.',
  'searchAnswers.rank.best': 'Οι ημέρες που ένιωσες καλύτερα {period}: {days}.',
  'searchAnswers.rank.bestByMetric':
    'Οι ημέρες που ένιωσες καλύτερα ως προς {metric, select, mood {τη διάθεση} energy {το επίπεδο ενέργειας} stress {το επίπεδο άγχους} sleepHours {τις ώρες ύπνου} sleepQuality {την ποιότητα ύπνου} exerciseMinutes {τα λεπτά άσκησης} other {την τιμή}} {period}: {days}.',
  'searchAnswers.rank.worst': 'Οι πιο δύσκολες ημέρες {period}: {days}.',
  'searchAnswers.rank.worstByMetric':
    'Οι πιο δύσκολες ημέρες ως προς {metric, select, mood {τη διάθεση} energy {το επίπεδο ενέργειας} stress {το επίπεδο άγχους} sleepHours {τις ώρες ύπνου} sleepQuality {την ποιότητα ύπνου} exerciseMinutes {τα λεπτά άσκησης} other {την τιμή}} {period}: {days}.',
  'searchAnswers.filter.found':
    'Βρήκα {count, plural, one {# ημέρα} other {# ημέρες}} με {metric, select, mood {διάθεση} energy {επίπεδο ενέργειας} stress {επίπεδο άγχους} sleepHours {ώρες ύπνου} sleepQuality {ποιότητα ύπνου} exerciseMinutes {λεπτά άσκησης} other {τιμή}} {comparison} {period}: {days}{more, plural, =0 {} one { και # ακόμη ημέρα} other { και # ακόμη ημέρες}}.',
  'searchAnswers.emotion.found':
    'Το συναίσθημα {emotions} εμφανίστηκε σε {count, plural, one {# ημέρα} other {# ημέρες}} {period}: {days}{more, plural, =0 {} one { και # ακόμη ημέρα} other { και # ακόμη ημέρες}}.',
  'searchAnswers.mention.found':
    'Έγραψες {terms} σε {count, plural, one {# καταχώριση {period}, στις {first}} other {# καταχωρίσεις {period}· η πρώτη στις {first} και η τελευταία στις {last}}}.',
  'searchAnswers.list.found': 'Βρήκα {count, plural, one {# καταχώριση} other {# καταχωρίσεις}} {period}· η πιο πρόσφατη στις {last}.',
  'searchAnswers.list.foundTerms':
    'Βρήκα {count, plural, one {# καταχώριση που περιέχει} other {# καταχωρίσεις που περιέχουν}} {terms} {period}· η πιο πρόσφατη στις {last}.',
  'searchAnswers.unknown.fallback':
    'Δεν κατάλαβα με βεβαιότητα την ερώτηση, οπότε {count, plural, one {εδώ είναι η πιο πρόσφατη καταχώριση} other {εδώ είναι οι # πιο πρόσφατες καταχωρίσεις}} από {total}. {explanation}',
  'searchAnswers.trend.insufficient':
    'Δεν υπάρχουν αρκετά δεδομένα για να εντοπιστεί τάση {metric, select, mood {στη διάθεσή σου} energy {στο επίπεδο ενέργειάς σου} stress {στο επίπεδο άγχους σου} sleepHours {στη διάρκεια του ύπνου σου} sleepQuality {στην ποιότητα του ύπνου σου} exerciseMinutes {στον χρόνο άσκησής σου} other {στις τιμές σου}} {period}.',
  'searchAnswers.trend.evidence':
    '(με βάση {first, plural, one {# ημέρα} other {# ημέρες}} στην αρχή του διαστήματος έναντι {last, plural, one {# ημέρας} other {# ημερών}} στο τέλος)',
  'searchAnswers.trend.stable':
    '{metric, select, mood {Η μέση διάθεσή σου έμεινε σταθερή} energy {Το μέσο επίπεδο ενέργειάς σου έμεινε σταθερό} stress {Το μέσο επίπεδο άγχους σου έμεινε σταθερό} sleepHours {Η μέση διάρκεια του ύπνου σου έμεινε σταθερή} sleepQuality {Η μέση ποιότητα του ύπνου σου έμεινε σταθερή} exerciseMinutes {Ο μέσος χρόνος άσκησής σου έμεινε σταθερός} other {Η μέση τιμή έμεινε σταθερή}} {period}: {from} έναντι {to} {evidence}.',
  'searchAnswers.trend.up':
    '{metric, select, mood {Η μέση διάθεσή σου ανέβηκε} energy {Το μέσο επίπεδο ενέργειάς σου ανέβηκε} stress {Το μέσο επίπεδο άγχους σου ανέβηκε} sleepHours {Η μέση διάρκεια του ύπνου σου αυξήθηκε} sleepQuality {Η μέση ποιότητα του ύπνου σου ανέβηκε} exerciseMinutes {Ο μέσος χρόνος άσκησής σου αυξήθηκε} other {Η μέση τιμή ανέβηκε}} από {from} σε {to} {period} {evidence}.',
  'searchAnswers.trend.down':
    '{metric, select, mood {Η μέση διάθεσή σου έπεσε} energy {Το μέσο επίπεδο ενέργειάς σου έπεσε} stress {Το μέσο επίπεδο άγχους σου έπεσε} sleepHours {Η μέση διάρκεια του ύπνου σου μειώθηκε} sleepQuality {Η μέση ποιότητα του ύπνου σου έπεσε} exerciseMinutes {Ο μέσος χρόνος άσκησής σου μειώθηκε} other {Η μέση τιμή έπεσε}} από {from} σε {to} {period} {evidence}.',

  // Request validation (POST /api/search) ----------------------------------------------
  'searchAnswers.validation.body': 'Το σώμα του αιτήματος πρέπει να περιέχει ερώτηση (query)',
  'searchAnswers.validation.query': 'Γράψε μια ερώτηση',
  'searchAnswers.validation.queryTooLong': 'Η ερώτηση είναι πολύ μεγάλη (έως {max} χαρακτήρες)',
  'searchAnswers.validation.limit': 'Ο αριθμός των αποτελεσμάτων πρέπει να είναι ακέραιος από 1 έως {max}',
};
export default messages;
