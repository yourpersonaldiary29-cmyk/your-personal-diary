/**
 * el - analysis messages (server-side insight templates, notes and labels). Keys are prefixed
 * 'analysis.'; see shared/i18n/index.ts for the template syntax and en/analysis.ts for the conventions.
 *
 * Greek notes:
 *  - Hedged, never causal ("Φαίνεται ότι…", "μπορεί να υπάρχει σχέση"); no "προκαλεί",
 *    "εξαιτίας", "οδηγεί σε", "σε κάνει".
 *  - `gender` classes of the metric nouns ('analysis.metric.<metric>.gender'), with the article
 *    and the comparative the templates write for them:
 *      f  = η …, υψηλότερη / χαμηλότερη     (διάθεση, ποιότητα ύπνου)
 *      fd = η …, μεγαλύτερη / μικρότερη     (διάρκεια ύπνου, διάρκεια άσκησης)
 *      n  = το …, υψηλότερο / χαμηλότερο    (επίπεδο ενέργειας, επίπεδο άγχους)
 *      nn = το …, μεγαλύτερο / μικρότερο    (πλήθος καταχωρίσεων)
 *    Only feminine and neuter nouns are used, so nominative = accusative and a label fits after
 *    "στη/στο" as well as in subject position. Labels equal the defined forms.
 *  - Detector labels ('*.label') are written in the accusative with the article, because every
 *    template uses them as an object ("για να ελέγξω {what}", "Έλεγξα {label}").
 *  - `{cur}` / `{prev}` are month names from Intl (genitive "Σεπτεμβρίου" in current ICU): they
 *    always follow "τον μήνα" / "του μήνα" / "μήνας", which reads correctly with the genitive.
 */
const messages: Record<string, string> = {
  // Engine / provider -----------------------------------------------------------------
  'analysis.engine.providerFailed': 'Η ανάλυση μοτίβων δεν ολοκληρώθηκε (εσωτερικό σφάλμα). Δοκίμασε ξανά αργότερα.',
  'analysis.engine.detectorFailed':
    'Ο έλεγχος για {label} δεν ολοκληρώθηκε (εσωτερικό σφάλμα)· οι υπόλοιπες παρατηρήσεις δεν επηρεάζονται.',

  // Strength (agrees with "ισχύς": "Ισχύς μοτίβου: μέτρια") -------------------------------
  'analysis.strength.weak': 'ασθενής',
  'analysis.strength.moderate': 'μέτρια',
  'analysis.strength.strong': 'ισχυρή',

  // Metrics: label (short, standalone), defined (subject inside a sentence), gender -----
  'analysis.metric.mood.label': 'διάθεση',
  'analysis.metric.mood.defined': 'διάθεση',
  'analysis.metric.mood.gender': 'f',
  'analysis.metric.energy.label': 'επίπεδο ενέργειας',
  'analysis.metric.energy.defined': 'επίπεδο ενέργειας',
  'analysis.metric.energy.gender': 'n',
  'analysis.metric.stress.label': 'επίπεδο άγχους',
  'analysis.metric.stress.defined': 'επίπεδο άγχους',
  'analysis.metric.stress.gender': 'n',
  'analysis.metric.sleepHours.label': 'διάρκεια ύπνου',
  'analysis.metric.sleepHours.defined': 'διάρκεια ύπνου',
  'analysis.metric.sleepHours.gender': 'fd',
  'analysis.metric.sleepQuality.label': 'ποιότητα ύπνου',
  'analysis.metric.sleepQuality.defined': 'ποιότητα ύπνου',
  'analysis.metric.sleepQuality.gender': 'f',
  'analysis.metric.exerciseMinutes.label': 'διάρκεια άσκησης',
  'analysis.metric.exerciseMinutes.defined': 'διάρκεια άσκησης',
  'analysis.metric.exerciseMinutes.gender': 'fd',
  'analysis.metric.entries.label': 'πλήθος καταχωρίσεων',
  'analysis.metric.entries.defined': 'πλήθος καταχωρίσεων',
  'analysis.metric.entries.gender': 'nn',

  // Counts and dates ------------------------------------------------------------------
  'analysis.count.days': '{count, plural, one {# ημέρα} other {# ημέρες}}',
  'analysis.count.weeks': '{count, plural, one {# εβδομάδα} other {# εβδομάδες}}',
  'analysis.date.dayWithDate': '{weekday}, {date}',

  // Weekdays (index 0 = Sunday) --------------------------------------------------------
  'analysis.weekday.plural.0': 'Κυριακές',
  'analysis.weekday.plural.1': 'Δευτέρες',
  'analysis.weekday.plural.2': 'Τρίτες',
  'analysis.weekday.plural.3': 'Τετάρτες',
  'analysis.weekday.plural.4': 'Πέμπτες',
  'analysis.weekday.plural.5': 'Παρασκευές',
  'analysis.weekday.plural.6': 'Σάββατα',
  'analysis.weekday.on.0': 'τις Κυριακές',
  'analysis.weekday.on.1': 'τις Δευτέρες',
  'analysis.weekday.on.2': 'τις Τρίτες',
  'analysis.weekday.on.3': 'τις Τετάρτες',
  'analysis.weekday.on.4': 'τις Πέμπτες',
  'analysis.weekday.on.5': 'τις Παρασκευές',
  'analysis.weekday.on.6': 'τα Σάββατα',

  // Notes shared by the detectors -------------------------------------------------------
  'analysis.note.insufficient':
    'Δεν υπάρχουν αρκετά δεδομένα για να ελέγξω {what} (χρειάζονται τουλάχιστον: {required}· υπάρχουν: {have}).',
  'analysis.note.insufficientWhether':
    'Δεν υπάρχουν αρκετά δεδομένα για να ελέγξω {what} (χρειάζονται τουλάχιστον: {required}· υπάρχουν: {have}).',
  'analysis.note.nothingNotable':
    'Έλεγξα {what} σε διάστημα {count, plural, one {# ημέρας} other {# ημερών}} και δεν βρήκα αξιοσημείωτη διαφορά.',

  // Requirement / availability phrases used inside the notes above ----------------------
  'analysis.req.daysBothValues': '{count, plural, one {# ημέρα με τιμές και για τα δύο} other {# ημέρες με τιμές και για τα δύο}}',
  'analysis.req.daysPerGroup': '{count, plural, one {# ημέρα σε κάθε ομάδα} other {# ημέρες σε κάθε ομάδα}}',
  'analysis.req.daysWithReport': '{count, plural, one {# ημέρα με καταγραφή} other {# ημέρες με καταγραφές}}',
  'analysis.req.daysWithRatings': '{count, plural, one {# ημέρα με βαθμολογίες} other {# ημέρες με βαθμολογίες}}',
  'analysis.req.daysPerMonth':
    '{count, plural, one {# ημέρα με καταγραφή σε κάθε μήνα} other {# ημέρες με καταγραφές σε κάθε μήνα}}',
  'analysis.req.recentDays':
    '{count, plural, one {# ημέρα με καταγραφή τις τελευταίες δύο εβδομάδες} other {# ημέρες με καταγραφές τις τελευταίες δύο εβδομάδες}}',
  'analysis.req.fullWeeks': '{count, plural, one {# πλήρης εβδομάδα με καταγραφές} other {# πλήρεις εβδομάδες με καταγραφές}}',
  'analysis.req.weeksOfLogs': '{count, plural, one {# εβδομάδα καταγραφών} other {# εβδομάδες καταγραφών}}',
  'analysis.req.weekPerGroup':
    'μία εβδομάδα σε κάθε ομάδα και {count, plural, one {# ημέρα} other {# ημέρες}} με καταγραφή σε κάθε ομάδα',
  'analysis.req.moodReports': '{count, plural, one {# καταγραφή διάθεσης} other {# καταγραφές διάθεσης}}',
  'analysis.req.reportsInWindow':
    '{count, plural, one {# καταγραφή σε ένα χρονικό παράθυρο} other {# καταγραφές σε ένα χρονικό παράθυρο}}',
  'analysis.req.emotionRepeated': 'ένα συναίσθημα καταγεγραμμένο σε {count, plural, one {# ημέρα} other {# ημέρες}}',
  'analysis.have.twoGroups':
    '{groupA}: {countA, plural, one {# ημέρα} other {# ημέρες}}· {groupB}: {countB, plural, one {# ημέρα} other {# ημέρες}}',
  'analysis.have.weeksTwoGroups':
    'εβδομάδες με επίτευξη στόχου: {metWeeks, plural, one {# εβδομάδα} other {# εβδομάδες}} ({metDays, plural, one {# ημέρα} other {# ημέρες}})· εβδομάδες κάτω από τον στόχο: {belowWeeks, plural, one {# εβδομάδα} other {# εβδομάδες}} ({belowDays, plural, one {# ημέρα} other {# ημέρες}})',
  'analysis.have.twoMonths':
    '{countA, plural, one {# ημέρα} other {# ημέρες}} τον μήνα {cur} και {countB, plural, one {# ημέρα} other {# ημέρες}} τον μήνα {prev}',
  'analysis.have.noData': 'χωρίς δεδομένα',
  'analysis.have.noSuchEmotion': 'κανένα ακόμη',
  'analysis.have.fewerInEveryWindow': 'λιγότερες σε κάθε παράθυρο',

  // Sentences shared by the group-comparison detectors ----------------------------------
  'analysis.relation.text':
    'Φαίνεται ότι στα δεδομένα σου, {condition}, {gender, select, f {η {metricDefined} ήταν κατά μέσο όρο {direction, select, higher {υψηλότερη} other {χαμηλότερη}}} fd {η {metricDefined} ήταν κατά μέσο όρο {direction, select, higher {μεγαλύτερη} other {μικρότερη}}} n {το {metricDefined} ήταν κατά μέσο όρο {direction, select, higher {υψηλότερο} other {χαμηλότερο}}} nn {το {metricDefined} ήταν κατά μέσο όρο {direction, select, higher {μεγαλύτερο} other {μικρότερο}}} other {η τιμή «{metricDefined}» ήταν κατά μέσο όρο {direction, select, higher {υψηλότερη} other {χαμηλότερη}}}} ({meanA} έναντι {meanB}).',
  'analysis.correlation.text':
    'Φαίνεται ότι στα δεδομένα σου μπορεί να υπάρχει σχέση ανάμεσα {xGender, select, n {στο {x}} nn {στο {x}} other {στη {x}}} και {yGender, select, n {στο {y}} nn {στο {y}} other {στη {y}}}: {xGender, select, f {όταν η {x} ήταν υψηλότερη} fd {όταν η {x} ήταν μεγαλύτερη} n {όταν το {x} ήταν υψηλότερο} nn {όταν το {x} ήταν μεγαλύτερο} other {όταν η τιμή «{x}» ήταν υψηλότερη}}, {yGender, select, f {η {y} {direction, select, higher {έτεινε να είναι υψηλότερη} other {έτεινε να είναι χαμηλότερη}}} fd {η {y} {direction, select, higher {έτεινε να είναι μεγαλύτερη} other {έτεινε να είναι μικρότερη}}} n {το {y} {direction, select, higher {έτεινε να είναι υψηλότερο} other {έτεινε να είναι χαμηλότερο}}} nn {το {y} {direction, select, higher {έτεινε να είναι μεγαλύτερο} other {έτεινε να είναι μικρότερο}}} other {η τιμή «{y}» {direction, select, higher {έτεινε να είναι υψηλότερη} other {έτεινε να είναι χαμηλότερη}}}} (συσχέτιση {r}).',
  'analysis.explain.checkedDays': 'Έλεγξα {count, plural, one {# ημέρα} other {# ημέρες}}.',
  'analysis.explain.onDaysCondition': '{count, plural, one {Σε # ημέρα} other {Σε # ημέρες}} {conditionPast}.',
  'analysis.explain.groupMeans':
    '{gender, select, f {Η μέση {metricDefined} εκείνες τις ημέρες ήταν {meanA}} fd {Η μέση {metricDefined} εκείνες τις ημέρες ήταν {meanA}} n {Το μέσο {metricDefined} εκείνες τις ημέρες ήταν {meanA}} nn {Το μέσο {metricDefined} εκείνες τις ημέρες ήταν {meanA}} other {Η μέση τιμή «{metricDefined}» εκείνες τις ημέρες ήταν {meanA}}}, σε σύγκριση με {meanB} τις υπόλοιπες ημέρες.',
  'analysis.explain.correlation': 'Συσχέτιση: {r}.',
  'analysis.explain.correlationBetween': 'Συσχέτιση ({predictor} – {outcome}): {r}.',
  'analysis.explain.diffAndStrength': 'Διαφορά ανάμεσα στους μέσους όρους: {diff} μονάδες. Ισχύς μοτίβου: {strength}.',
  'analysis.explain.diffStrength': 'Διαφορά: {diff} μονάδες. Ισχύς μοτίβου: {strength}.',
  'analysis.split.corrExplainChecked':
    'Έλεγξα {count, plural, one {# ημέρα} other {# ημέρες}} με καταγεγραμμένες τιμές και για τα δύο: {x} και {y}.',
  'analysis.split.corrExplainPearson': 'Συσχέτιση Pearson: {r} (ισχύς: {strength}).',
  'analysis.split.corrExplainGroups':
    'Δεν υπήρχαν αρκετές ημέρες σε κάθε ομάδα για σύγκριση μέσων όρων ({groupA}: {countA, plural, one {# ημέρα} other {# ημέρες}}· {groupB}: {countB, plural, one {# ημέρα} other {# ημέρες}}· χρειάζονται τουλάχιστον {min} σε κάθε ομάδα).',

  // Evidence table keys ---------------------------------------------------------------
  'analysis.extra.predictor': 'Προβλεπτικός παράγοντας',
  'analysis.extra.strength': 'Ισχύς',
  'analysis.extra.meanDiff': 'Διαφορά μέσων όρων (Α μείον Β)',
  'analysis.extra.cohenD': 'Μέγεθος επίδρασης (d του Cohen)',
  'analysis.extra.weeksChecked': 'Εβδομάδες που ελέγχθηκαν',
  'analysis.extra.weeklyTarget': 'Εβδομαδιαίος στόχος',
  'analysis.extra.target': 'Στόχος',
  'analysis.extra.frequency': 'Συχνότητα',
  'analysis.extra.periodMean': 'Μέσος όρος διαστήματος',
  'analysis.extra.overallMean': 'Συνολικός μέσος όρος',
  'analysis.extra.stddev': 'Τυπική απόκλιση',
  'analysis.extra.slopePerDay': 'Κλίση ανά ημέρα',
  'analysis.extra.daysInWindow': 'Ημέρες στο παράθυρο',
  'analysis.extra.movingWindow': 'Παράθυρο κινητού μέσου όρου',
  'analysis.extra.relativeChange': 'Σχετική μεταβολή',
  'analysis.extra.longestStreak': 'Μεγαλύτερο σερί στο διάστημα',
  'analysis.extra.shareOfEmotionDays': 'Ποσοστό των ημερών με το συναίσθημα',
  'analysis.frequency.daily': 'καθημερινή',
  'analysis.frequency.weekly': 'εβδομαδιαία',
  'analysis.groupB.otherDays': 'Υπόλοιπες ημέρες',

  // Sleep detectors -------------------------------------------------------------------
  'analysis.sleep.groupA': 'Ημέρες με λιγότερες από {hours, plural, one {# ώρα} other {# ώρες}} ύπνου',
  'analysis.sleep.groupB': 'Ημέρες με {hours, plural, one {# ώρα} other {# ώρες}} ύπνου ή περισσότερο',
  'analysis.sleep.condition': 'τις ημέρες που κοιμήθηκες λιγότερο από {hours, plural, one {# ώρα} other {# ώρες}}',
  'analysis.sleep.conditionPast': 'κοιμήθηκες λιγότερο από {hours, plural, one {# ώρα} other {# ώρες}}',
  'analysis.sleepMood.label': 'τη σχέση ανάμεσα στον ύπνο και στη διάθεση',
  'analysis.sleepMood.title': '{direction, select, lower {Λίγος ύπνος και χαμηλότερη διάθεση} other {Λίγος ύπνος και υψηλότερη διάθεση}}',
  'analysis.sleepMood.corrTitle': 'Πιθανή σχέση ανάμεσα στις ώρες ύπνου και στη διάθεση',
  'analysis.sleepEnergy.label': 'τη σχέση ανάμεσα στον ύπνο και στο επίπεδο ενέργειας',
  'analysis.sleepEnergy.title':
    '{direction, select, lower {Λίγος ύπνος και χαμηλότερη ενέργεια} other {Λίγος ύπνος και υψηλότερη ενέργεια}}',
  'analysis.sleepEnergy.corrTitle': 'Πιθανή σχέση ανάμεσα στις ώρες ύπνου και στο επίπεδο ενέργειας',

  // Exercise detectors ----------------------------------------------------------------
  'analysis.exercise.groupA': 'Ημέρες με σωματική δραστηριότητα',
  'analysis.exercise.groupB': 'Ημέρες χωρίς σωματική δραστηριότητα',
  'analysis.exercise.condition': 'τις ημέρες που γυμνάστηκες',
  'analysis.exercise.conditionPast': 'γυμνάστηκες',
  'analysis.exerciseMood.label': 'τη σχέση ανάμεσα στη σωματική δραστηριότητα και στη διάθεση',
  'analysis.exerciseMood.title':
    '{direction, select, higher {Σωματική δραστηριότητα και υψηλότερη διάθεση} other {Σωματική δραστηριότητα και χαμηλότερη διάθεση}}',
  'analysis.exerciseMood.corrTitle': 'Πιθανή σχέση ανάμεσα στα λεπτά άσκησης και στη διάθεση',
  'analysis.exerciseEnergy.label': 'τη σχέση ανάμεσα στη σωματική δραστηριότητα και στο επίπεδο ενέργειας',
  'analysis.exerciseEnergy.title':
    '{direction, select, higher {Σωματική δραστηριότητα και υψηλότερη ενέργεια} other {Σωματική δραστηριότητα και χαμηλότερη ενέργεια}}',
  'analysis.exerciseEnergy.corrTitle': 'Πιθανή σχέση ανάμεσα στα λεπτά άσκησης και στο επίπεδο ενέργειας',

  // Habit - mood / energy / stress ------------------------------------------------------
  'analysis.habit.detectorLabel': 'τη σχέση ανάμεσα στις συνήθειες και στη διάθεση',
  'analysis.habit.noHabits': 'Δεν υπάρχουν ενεργές συνήθειες, γι’ αυτό δεν έλεγξα για σχέση ανάμεσα στις συνήθειες και στη διάθεση.',
  'analysis.habit.noLogs':
    'Η συνήθεια «{habit}» δεν έχει ακόμη καταγραφές σε αυτό το διάστημα, γι’ αυτό δεν έλεγξα για σχέση της με τη διάθεση.',
  'analysis.habit.noFullWeeks':
    'Η συνήθεια «{habit}» δεν έχει ακόμη πλήρεις εβδομάδες με καταγραφές, γι’ αυτό δεν έλεγξα για σχέση της με τη διάθεση.',
  'analysis.habit.label': 'τη σχέση ανάμεσα στη συνήθεια «{habit}» και στον δείκτη «{metric}»',
  'analysis.habit.groupA': 'Ημέρες που ολοκληρώθηκε η συνήθεια «{habit}»',
  'analysis.habit.groupB': 'Ημέρες που δεν ολοκληρώθηκε η συνήθεια «{habit}»',
  'analysis.habit.condition': 'τις ημέρες που ολοκλήρωσες τη συνήθεια «{habit}»',
  'analysis.habit.conditionPast': 'ολοκλήρωσες τη συνήθεια «{habit}»',
  'analysis.habit.title':
    'Συνήθεια «{habit}» και {gender, select, f {{direction, select, higher {υψηλότερη {metric}} other {χαμηλότερη {metric}}}} fd {{direction, select, higher {μεγαλύτερη {metric}} other {μικρότερη {metric}}}} n {{direction, select, higher {υψηλότερο {metric}} other {χαμηλότερο {metric}}}} nn {{direction, select, higher {μεγαλύτερο {metric}} other {μικρότερο {metric}}}} other {{direction, select, higher {υψηλότερες τιμές ({metric})} other {χαμηλότερες τιμές ({metric})}}}}',
  'analysis.habit.corrTitle': 'Πιθανή σχέση ανάμεσα στη συνήθεια «{habit}» και στον δείκτη «{metric}»',
  'analysis.habit.weeklyCondition': 'τις εβδομάδες που πέτυχες τον στόχο της συνήθειας «{habit}»',
  'analysis.habit.weeklyTarget': '{target} {unit} την εβδομάδα',
  'analysis.habit.targetValue': '{target} {unit}',
  'analysis.habit.weeklyExplainChecked':
    'Έλεγξα {weeks, plural, one {# πλήρη εβδομάδα} other {# πλήρεις εβδομάδες}} ({days, plural, one {# ημέρα} other {# ημέρες}} με καταγραφή για τον δείκτη «{metric}»).',
  'analysis.habit.weeklyExplainMet':
    '{count, plural, one {Σε # εβδομάδα} other {Σε # εβδομάδες}} πέτυχες τον στόχο της συνήθειας ({target}).',
  'analysis.habit.weeklyExplainMeans':
    '{gender, select, f {Η μέση {metricDefined} τις ημέρες εκείνων των εβδομάδων ήταν {meanA}} fd {Η μέση {metricDefined} τις ημέρες εκείνων των εβδομάδων ήταν {meanA}} n {Το μέσο {metricDefined} τις ημέρες εκείνων των εβδομάδων ήταν {meanA}} nn {Το μέσο {metricDefined} τις ημέρες εκείνων των εβδομάδων ήταν {meanA}} other {Η μέση τιμή «{metricDefined}» τις ημέρες εκείνων των εβδομάδων ήταν {meanA}}}, σε σύγκριση με {meanB} τις ημέρες {count, plural, one {της # εβδομάδας} other {των # εβδομάδων}} κάτω από τον στόχο.',
  'analysis.habit.groupAWeeks':
    'Ημέρες σε εβδομάδες με επίτευξη στόχου ({count, plural, one {# εβδομάδα} other {# εβδομάδες}})',
  'analysis.habit.groupBWeeks': 'Ημέρες σε εβδομάδες κάτω από τον στόχο ({count, plural, one {# εβδομάδα} other {# εβδομάδες}})',

  // Weekday differences -----------------------------------------------------------------
  'analysis.weekday.label': 'τις διαφορές ανάμεσα στις ημέρες της εβδομάδας',
  'analysis.weekday.text':
    'Φαίνεται ότι στα δεδομένα σου, {onWeekday} {gender, select, f {η {metricDefined} ήταν κατά μέσο όρο {direction, select, higher {υψηλότερη} other {χαμηλότερη}}} fd {η {metricDefined} ήταν κατά μέσο όρο {direction, select, higher {μεγαλύτερη} other {μικρότερη}}} n {το {metricDefined} ήταν κατά μέσο όρο {direction, select, higher {υψηλότερο} other {χαμηλότερο}}} nn {το {metricDefined} ήταν κατά μέσο όρο {direction, select, higher {μεγαλύτερο} other {μικρότερο}}} other {η τιμή «{metricDefined}» ήταν κατά μέσο όρο {direction, select, higher {υψηλότερη} other {χαμηλότερη}}}} από ό,τι τις υπόλοιπες ημέρες της εβδομάδας ({meanA} έναντι {meanB}).',
  'analysis.weekday.explainChecked':
    'Έλεγξα {count, plural, one {# ημέρα} other {# ημέρες}} με καταγραφή για τον δείκτη «{metric}», από τις οποίες {countA} ήταν {weekdays}.',
  'analysis.weekday.explainMeans':
    '{gender, select, f {Η μέση {metricDefined} {onWeekday} ήταν {meanA}} fd {Η μέση {metricDefined} {onWeekday} ήταν {meanA}} n {Το μέσο {metricDefined} {onWeekday} ήταν {meanA}} nn {Το μέσο {metricDefined} {onWeekday} ήταν {meanA}} other {Η μέση τιμή «{metricDefined}» {onWeekday} ήταν {meanA}}}, σε σύγκριση με {meanB} τις υπόλοιπες ημέρες.',
  'analysis.weekday.title':
    '{weekdays}: {gender, select, f {{direction, select, higher {υψηλότερη {metric}} other {χαμηλότερη {metric}}}} fd {{direction, select, higher {μεγαλύτερη {metric}} other {μικρότερη {metric}}}} n {{direction, select, higher {υψηλότερο {metric}} other {χαμηλότερο {metric}}}} nn {{direction, select, higher {μεγαλύτερο {metric}} other {μικρότερο {metric}}}} other {{direction, select, higher {υψηλότερες τιμές ({metric})} other {χαμηλότερες τιμές ({metric})}}}}',
  'analysis.weekday.groupB': 'Υπόλοιπες ημέρες της εβδομάδας',
  'analysis.weekday.tableValue': '{mean} ({count, plural, one {# ημέρα} other {# ημέρες}})',
  'analysis.weekday.nothing':
    'Έλεγξα για διαφορές ανάμεσα στις ημέρες της εβδομάδας σε διάστημα {count, plural, one {# ημέρας} other {# ημερών}} και δεν βρήκα αξιοσημείωτη διαφορά.',

  // Time of day -------------------------------------------------------------------------
  'analysis.timeOfDay.label': 'τη σχέση ανάμεσα στην ώρα γραφής και στη διάθεση',
  'analysis.timeOfDay.morning.label': 'Πρωί',
  'analysis.timeOfDay.morning.phrase': 'το πρωί',
  'analysis.timeOfDay.late_morning.label': 'Προμεσημέρι',
  'analysis.timeOfDay.late_morning.phrase': 'αργά το πρωί',
  'analysis.timeOfDay.afternoon.label': 'Απόγευμα',
  'analysis.timeOfDay.afternoon.phrase': 'το απόγευμα',
  'analysis.timeOfDay.evening.label': 'Βράδυ',
  'analysis.timeOfDay.evening.phrase': 'το βράδυ',
  'analysis.timeOfDay.night.label': 'Νύχτα',
  'analysis.timeOfDay.night.phrase': 'τη νύχτα',
  'analysis.timeOfDay.tableKey': '{label} ({hours})',
  'analysis.timeOfDay.tableValue': 'μέσος όρος {mean}, {count, plural, one {# καταγραφή} other {# καταγραφές}}',
  'analysis.timeOfDay.tableRow': '{key}: {value}',
  'analysis.timeOfDay.nothing':
    'Έλεγξα {label} σε {count, plural, one {# καταγραφή} other {# καταγραφές}} και δεν βρήκα χρονικό παράθυρο που να ξεχωρίζει πάνω από τον μέσο όρο.',
  'analysis.timeOfDay.text':
    'Φαίνεται ότι στα δεδομένα σου, η διάθεση που κατέγραφες {phrase} ({hours}) ήταν η υψηλότερη: κατά μέσο όρο {mean}, σε σύγκριση με {overall} σε όλες τις καταγραφές.',
  'analysis.timeOfDay.explainChecked':
    'Έλεγξα {count, plural, one {# καταγραφή διάθεσης} other {# καταγραφές διάθεσης}} από {days, plural, one {# ημέρα} other {# ημέρες}}, ανάλογα με την ώρα που γράφτηκε η καταχώριση.',
  'analysis.timeOfDay.explainTable': '{table}. Συνολικός μέσος όρος: {overall}.',
  'analysis.timeOfDay.explainDiff':
    'Διαφορά ανάμεσα στο υψηλότερο χρονικό παράθυρο και στον συνολικό μέσο όρο: {diff} μονάδες. Ισχύς μοτίβου: {strength}.',
  'analysis.timeOfDay.title': 'Υψηλότερη διάθεση {phrase}',
  'analysis.timeOfDay.groupA': 'Καταγραφές {phrase} ({hours})',
  'analysis.timeOfDay.groupB': 'Υπόλοιπες καταγραφές',

  // Trends ------------------------------------------------------------------------------
  'analysis.trends.label': 'τις τάσεις στη διάθεση, στο άγχος και στον ύπνο',
  'analysis.trends.text':
    'Φαίνεται ότι στα δεδομένα σου {gender, select, n {το {metricDefined}} nn {το {metricDefined}} f {η {metricDefined}} fd {η {metricDefined}} other {η τιμή «{metricDefined}»}} {direction, select, up {έχει ανοδική τάση} other {έχει καθοδική τάση}} {horizon, select, period {σε όλο το διάστημα} monthly {τον τελευταίο μήνα} other {τις τελευταίες δύο εβδομάδες}}: η γραμμή τάσης του κινητού μέσου όρου {direction, select, up {ανέβηκε από} other {κατέβηκε από}} {fromValue} σε {toValue}.',
  'analysis.trends.explainChecked':
    'Έλεγξα {count, plural, one {# ημέρα} other {# ημέρες}} με καταγραφή για τον δείκτη «{metric}» από τις {len} {horizon, select, period {ημέρες του διαστήματος} other {πιο πρόσφατες ημέρες}} ({from}-{to}).',
  'analysis.trends.explainFit':
    'Υπολόγισα κινητό μέσο όρο {window} ημερών και μια γραμμή τάσης (γραμμική παλινδρόμηση) πάνω του: {direction, select, up {ανοδική κλίση} other {καθοδική κλίση}} {unit, select, hours {{slope} ωρών} other {{slope} μονάδων}} ανά ημέρα, δηλαδή μεταβολή περίπου {unit, select, hours {{change} ωρών} other {{change} μονάδων}} μέσα στο παράθυρο (από {fromValue} σε {toValue} πάνω στη γραμμή τάσης). Ισχύς τάσης: {strength}.',
  'analysis.trends.title':
    '{direction, select, up {Ανοδική τάση} other {Καθοδική τάση}} {metric, select, mood {στη διάθεση} energy {στο επίπεδο ενέργειας} stress {στο επίπεδο άγχους} sleepHours {στη διάρκεια ύπνου} sleepQuality {στην ποιότητα ύπνου} exerciseMinutes {στη διάρκεια άσκησης} other {στο πλήθος καταχωρίσεων}} ({horizon, select, period {όλο το διάστημα} monthly {τελευταίος μήνας} other {τελευταίες 2 εβδομάδες}})',
  'analysis.trends.groupA': 'Αρχή του παραθύρου (γραμμή τάσης)',
  'analysis.trends.groupB': 'Τέλος του παραθύρου (γραμμή τάσης)',
  'analysis.trends.slopeValue': '{unit, select, hours {{slope} ώρες} other {{slope} μονάδες}}',
  'analysis.trends.nothingSince':
    'Έλεγξα για τάσεις στη διάθεση, στο άγχος και στον ύπνο από {from} και δεν βρήκα αξιοσημείωτη τάση.',
  'analysis.trends.nothingAll':
    'Έλεγξα για τάσεις στη διάθεση, στο άγχος και στον ύπνο σε όλο το διάστημα και δεν βρήκα αξιοσημείωτη τάση.',

  // Month comparison --------------------------------------------------------------------
  'analysis.periodCompare.label': 'τη σύγκριση του τρέχοντος μήνα με τον προηγούμενο',
  'analysis.periodCompare.text':
    'Φαίνεται ότι στα δεδομένα σου, τον μήνα {cur} {gender, select, f {η {metricDefined} ήταν κατά μέσο όρο {direction, select, higher {υψηλότερη} other {χαμηλότερη}}} fd {η {metricDefined} ήταν κατά μέσο όρο {direction, select, higher {μεγαλύτερη} other {μικρότερη}}} n {το {metricDefined} ήταν κατά μέσο όρο {direction, select, higher {υψηλότερο} other {χαμηλότερο}}} nn {το {metricDefined} ήταν κατά μέσο όρο {direction, select, higher {μεγαλύτερο} other {μικρότερο}}} other {η τιμή «{metricDefined}» ήταν κατά μέσο όρο {direction, select, higher {υψηλότερη} other {χαμηλότερη}}}} από ό,τι τον μήνα {prev} ({meanA} έναντι {meanB}).',
  'analysis.periodCompare.explain':
    'Σύγκρινα τις ημέρες με καταγραφή για τον δείκτη «{metric}» τον μήνα {cur} ({countA, plural, one {# ημέρα} other {# ημέρες}}, έως σήμερα) με τις ημέρες του μήνα {prev} ({countB, plural, one {# ημέρα} other {# ημέρες}}). Μέσος όρος τον μήνα {cur}: {meanA}· τον μήνα {prev}: {meanB}. Διαφορά: {unit, select, hours {{diff} ώρες} other {{diff} μονάδες}}. Ισχύς της διαφοράς: {strength}.',
  'analysis.periodCompare.title':
    '{gender, select, f {{direction, select, higher {Υψηλότερη {metric}} other {Χαμηλότερη {metric}}}} fd {{direction, select, higher {Μεγαλύτερη {metric}} other {Μικρότερη {metric}}}} n {{direction, select, higher {Υψηλότερο {metric}} other {Χαμηλότερο {metric}}}} nn {{direction, select, higher {Μεγαλύτερο {metric}} other {Μικρότερο {metric}}}} other {{direction, select, higher {Υψηλότερες τιμές ({metric})} other {Χαμηλότερες τιμές ({metric})}}}} τον μήνα {cur} έναντι {prev}',
  'analysis.periodCompare.entriesText':
    'Φαίνεται ότι έγραψες {direction, select, more {περισσότερο} other {λιγότερο}} τις πρώτες {window} ημέρες του μήνα {cur} ({countA, plural, one {# καταχώριση} other {# καταχωρίσεις}}) από ό,τι τις πρώτες {window} ημέρες του μήνα {prev} ({countB, plural, one {# καταχώριση} other {# καταχωρίσεις}}).',
  'analysis.periodCompare.entriesExplain':
    'Μέτρησα τις καταχωρίσεις των πρώτων {window} ημερών κάθε μήνα, για να συγκρίνω ίσα χρονικά διαστήματα: μήνας {cur} – {countA, plural, one {# καταχώριση} other {# καταχωρίσεις}}, μήνας {prev} – {countB, plural, one {# καταχώριση} other {# καταχωρίσεις}}. Διαφορά: {diff, plural, one {# καταχώριση} other {# καταχωρίσεις}} ({percent}). Ισχύς της διαφοράς: {strength}.',
  'analysis.periodCompare.entriesTitle':
    '{direction, select, more {Περισσότερο γράψιμο} other {Λιγότερο γράψιμο}} τον μήνα {cur} έναντι {prev}',
  'analysis.periodCompare.monthWindow': 'Μήνας {month} (πρώτες {window} ημέρες)',
  'analysis.periodCompare.insufficientWhat': 'τη σύγκριση του μήνα {cur} με τον μήνα {prev}',
  'analysis.periodCompare.nothing':
    'Σύγκρινα τον μήνα {cur} με τον μήνα {prev} και δεν βρήκα αξιοσημείωτη διαφορά στη διάθεση, στο άγχος, στον ύπνο ή στο πλήθος των καταχωρίσεων.',

  // Habit trend (improved / declined) -----------------------------------------------------
  'analysis.habitsTrend.label': 'τις συνήθειες που βελτιώθηκαν ή υποχώρησαν',
  'analysis.habitsTrend.whether': 'αν η συνήθεια «{habit}» βελτιώθηκε ή υποχώρησε',
  'analysis.habitsTrend.textDaily':
    'Φαίνεται ότι η συνήθεια «{habit}» {direction, select, improved {έχει βελτιωθεί} other {έχει υποχωρήσει}}: τις τελευταίες δύο εβδομάδες την ολοκλήρωσες σε {recent} από τις {window} ημέρες, σε σύγκριση με {previous} από τις {window} τις δύο προηγούμενες εβδομάδες.',
  'analysis.habitsTrend.textWeekly':
    'Φαίνεται ότι η συνήθεια «{habit}» {direction, select, improved {έχει βελτιωθεί} other {έχει υποχωρήσει}}: τις τελευταίες δύο εβδομάδες κατέγραψες {recent} {unit}, σε σύγκριση με {previous} τις δύο προηγούμενες εβδομάδες (στόχος: {target} {unit} την εβδομάδα).',
  'analysis.habitsTrend.explain':
    'Σύγκρινα το ποσοστό ολοκλήρωσης της συνήθειας τις τελευταίες δύο εβδομάδες ({recentFrom}-{recentTo}) με τις δύο προηγούμενες ({previousFrom}-{previousTo}): {recentRate} έναντι {previousRate}. Διαφορά: {diff} ποσοστιαίες μονάδες. Ισχύς της μεταβολής: {strength}.',
  'analysis.habitsTrend.title':
    '«{habit}»: {direction, select, improved {βελτίωση τις τελευταίες 2 εβδομάδες} other {υποχώρηση τις τελευταίες 2 εβδομάδες}}',
  'analysis.habitsTrend.metric': 'Ποσοστό ολοκλήρωσης – {habit}',
  'analysis.habitsTrend.groupA': 'Τελευταίες δύο εβδομάδες',
  'analysis.habitsTrend.groupB': 'Προηγούμενες δύο εβδομάδες',

  // Best / hardest days ------------------------------------------------------------------
  'analysis.bestWorst.label': 'τις καλύτερες και τις πιο δύσκολες ημέρες',
  'analysis.bestWorst.describedDay': '{day} («{title}»)',
  'analysis.bestWorst.noTitle': 'Χωρίς τίτλο',
  'analysis.bestWorst.extraValue': '{titles} – βαθμολογία {score}',
  'analysis.bestWorst.text':
    '{kind, select, best {Οι καλύτερες ημέρες} other {Οι πιο δύσκολες ημέρες}} του διαστήματος, με βάση μια συνδυαστική βαθμολογία διάθεσης, ενέργειας και άγχους: {days}.',
  'analysis.bestWorst.explainScore':
    '{count, plural, one {Για τη # ημέρα} other {Για καθεμία από τις # ημέρες}} υπολόγισα μια συνδυαστική βαθμολογία: τον μέσο όρο της διάθεσης, του επιπέδου ενέργειας και του (11 μείον το επίπεδο άγχους), από τις τιμές που καταγράφηκαν εκείνη την ημέρα.',
  'analysis.bestWorst.explainMeans':
    'Η μέση βαθμολογία στο διάστημα: {overall}. {kind, select, best {{count, plural, one {Η καλύτερη ημέρα είχε} =3 {Οι τρεις καλύτερες ημέρες είχαν} other {Οι καλύτερες ημέρες είχαν}}} other {{count, plural, one {Η πιο δύσκολη ημέρα είχε} =3 {Οι τρεις πιο δύσκολες ημέρες είχαν} other {Οι πιο δύσκολες ημέρες είχαν}}}} κατά μέσο όρο {mean}.',
  'analysis.bestWorst.explainDiff': 'Διαφορά από τον μέσο όρο: {diff} μονάδες. Ισχύς της διαφοράς: {strength}.',
  'analysis.bestWorst.title': '{kind, select, best {Οι καλύτερες ημέρες του διαστήματος} other {Οι πιο δύσκολες ημέρες του διαστήματος}}',
  'analysis.bestWorst.metric': 'Συνδυαστική βαθμολογία (διάθεση + ενέργεια + αντεστραμμένο άγχος)',
  'analysis.bestWorst.groupA': '{kind, select, best {Οι καλύτερες ημέρες} other {Οι πιο δύσκολες ημέρες}}',
  'analysis.bestWorst.nothing':
    'Έλεγξα {label} σε διάστημα {count, plural, one {# ημέρας} other {# ημερών}}· οι βαθμολογίες ήταν παρόμοιες και καμία ημέρα δεν ξεχώρισε ιδιαίτερα.',

  // Streaks -------------------------------------------------------------------------------
  'analysis.streaks.label': 'τα σερί γραψίματος και συνηθειών',
  'analysis.streaks.entriesTitle': 'Σερί γραψίματος: {count, plural, one {# ημέρα} other {# ημέρες}}',
  'analysis.streaks.entriesText':
    'Μπράβο! Έγραψες στο ημερολόγιό σου {count, plural, one {# ημέρα στη σειρά} other {# ημέρες στη σειρά}} ({from}-{to}).',
  'analysis.streaks.entriesExplain':
    'Μέτρησα τις συνεχόμενες ημέρες με τουλάχιστον μία καταχώριση, έως σήμερα ή χθες. Τρέχον σερί: {count, plural, one {# ημέρα} other {# ημέρες}}, από {from} έως {to}. Μεγαλύτερο σερί στο διάστημα: {best, plural, one {# ημέρα} other {# ημέρες}}.',
  'analysis.streaks.entriesMetric': 'Ημέρες γραψίματος',
  'analysis.streaks.currentDays': 'Ημέρες στο τρέχον σερί',
  'analysis.streaks.daysWithEntry': 'Ημέρες με καταχώριση στο διάστημα',
  'analysis.streaks.habitTitle': 'Σερί {count, plural, one {# ημέρας} other {# ημερών}} για τη συνήθεια «{habit}»',
  'analysis.streaks.habitText':
    'Ολοκλήρωσες τη συνήθεια «{habit}» {count, plural, one {# ημέρα στη σειρά} other {# ημέρες στη σειρά}} ({from}-{to}).',
  'analysis.streaks.habitExplain':
    'Μέτρησα τις συνεχόμενες ημέρες στις οποίες η συνήθεια «{habit}» σημειώθηκε ως ολοκληρωμένη, έως σήμερα ή χθες. Τρέχον σερί: {count, plural, one {# ημέρα} other {# ημέρες}}. Μεγαλύτερο σερί στο διάστημα: {best, plural, one {# ημέρα} other {# ημέρες}}.',
  'analysis.streaks.habitMetric': 'Ολοκλήρωση της συνήθειας «{habit}»',
  'analysis.streaks.daysCompleted': 'Ημέρες ολοκλήρωσης της συνήθειας στο διάστημα',
  'analysis.streaks.weeklyTitle': 'Σερί {count, plural, one {# εβδομάδας} other {# εβδομάδων}} για τη συνήθεια «{habit}»',
  'analysis.streaks.weeklyText':
    'Πέτυχες τον στόχο της συνήθειας «{habit}» {count, plural, one {# εβδομάδα στη σειρά} other {# εβδομάδες στη σειρά}} ({from}-{to}).',
  'analysis.streaks.weeklyExplain':
    'Άθροισα την ποσότητα που καταγράφηκε για τη συνήθεια «{habit}» κάθε εβδομάδα και τη σύγκρινα με τον εβδομαδιαίο στόχο ({target}). Τρέχον σερί εβδομάδων με επίτευξη στόχου: {count, plural, one {# εβδομάδα} other {# εβδομάδες}}.',
  'analysis.streaks.weeklyMetric': 'Επίτευξη εβδομαδιαίου στόχου – {habit}',
  'analysis.streaks.currentWeeks': 'Εβδομάδες στο τρέχον σερί',
  'analysis.streaks.weeksWithLogs': 'Εβδομάδες με καταγραφές στο διάστημα',
  'analysis.streaks.none':
    'Δεν βρέθηκαν ενεργά σερί (σερί γραψίματος {entryMin} ημερών ή περισσότερων, ή σερί συνήθειας {habitMin} ημερών ή εβδομάδων ή περισσότερων).',

  // Anomalies -----------------------------------------------------------------------------
  'analysis.anomalies.label': 'τις ασυνήθιστες ημέρες στη διάθεση ή στο άγχος',
  'analysis.anomalies.textOne':
    'Φαίνεται ότι μία ημέρα ({day}) {gender, select, f {η {metricDefined} ήταν {side, select, high {ασυνήθιστα υψηλή} other {ασυνήθιστα χαμηλή}}} fd {η {metricDefined} ήταν {side, select, high {ασυνήθιστα μεγάλη} other {ασυνήθιστα μικρή}}} n {το {metricDefined} ήταν {side, select, high {ασυνήθιστα υψηλό} other {ασυνήθιστα χαμηλό}}} nn {το {metricDefined} ήταν {side, select, high {ασυνήθιστα μεγάλο} other {ασυνήθιστα μικρό}}} other {η τιμή «{metricDefined}» ήταν {side, select, high {ασυνήθιστα υψηλή} other {ασυνήθιστα χαμηλή}}}} σε σύγκριση με το υπόλοιπο διάστημα ({value}, έναντι μέσου όρου {mean}).',
  'analysis.anomalies.textMany':
    'Φαίνεται ότι {count, plural, one {σε # ημέρα} other {σε # ημέρες}} {gender, select, f {η {metricDefined} ήταν {side, select, high {ασυνήθιστα υψηλή} other {ασυνήθιστα χαμηλή}}} fd {η {metricDefined} ήταν {side, select, high {ασυνήθιστα μεγάλη} other {ασυνήθιστα μικρή}}} n {το {metricDefined} ήταν {side, select, high {ασυνήθιστα υψηλό} other {ασυνήθιστα χαμηλό}}} nn {το {metricDefined} ήταν {side, select, high {ασυνήθιστα μεγάλο} other {ασυνήθιστα μικρό}}} other {η τιμή «{metricDefined}» ήταν {side, select, high {ασυνήθιστα υψηλή} other {ασυνήθιστα χαμηλή}}}} σε σύγκριση με το υπόλοιπο διάστημα: {days}· ο μέσος όρος του διαστήματος: {mean}.',
  'analysis.anomalies.textManyMore':
    'Φαίνεται ότι {count, plural, one {σε # ημέρα} other {σε # ημέρες}} {gender, select, f {η {metricDefined} ήταν {side, select, high {ασυνήθιστα υψηλή} other {ασυνήθιστα χαμηλή}}} fd {η {metricDefined} ήταν {side, select, high {ασυνήθιστα μεγάλη} other {ασυνήθιστα μικρή}}} n {το {metricDefined} ήταν {side, select, high {ασυνήθιστα υψηλό} other {ασυνήθιστα χαμηλό}}} nn {το {metricDefined} ήταν {side, select, high {ασυνήθιστα μεγάλο} other {ασυνήθιστα μικρό}}} other {η τιμή «{metricDefined}» ήταν {side, select, high {ασυνήθιστα υψηλή} other {ασυνήθιστα χαμηλή}}}} σε σύγκριση με το υπόλοιπο διάστημα: {days} και άλλες· ο μέσος όρος του διαστήματος: {mean}.',
  'analysis.anomalies.dayItem': '{day} ({value})',
  'analysis.anomalies.detail':
    '{date}: {value} ({z} τυπικές αποκλίσεις {side, select, above {πάνω από τον μέσο όρο} other {κάτω από τον μέσο όρο}})',
  'analysis.anomalies.explain':
    'Έλεγξα {count, plural, one {# ημέρα} other {# ημέρες}} με καταγραφή για τον δείκτη «{metric}». Μέσος όρος: {mean}, τυπική απόκλιση: {sd}. Μια ημέρα θεωρείται ασυνήθιστη όταν η τιμή της απέχει από τον μέσο όρο {z} τυπικές αποκλίσεις ή περισσότερο. {details}. Ισχύς της απόκλισης: {strength}.',
  'analysis.anomalies.title':
    '{count, plural, one {Ημέρα με} other {Ημέρες με}} {gender, select, f {{side, select, high {ασυνήθιστα υψηλή {metric}} other {ασυνήθιστα χαμηλή {metric}}}} fd {{side, select, high {ασυνήθιστα μεγάλη {metric}} other {ασυνήθιστα μικρή {metric}}}} n {{side, select, high {ασυνήθιστα υψηλό {metric}} other {ασυνήθιστα χαμηλό {metric}}}} nn {{side, select, high {ασυνήθιστα μεγάλο {metric}} other {ασυνήθιστα μικρό {metric}}}} other {{side, select, high {ασυνήθιστα υψηλές τιμές ({metric})} other {ασυνήθιστα χαμηλές τιμές ({metric})}}}}',
  'analysis.anomalies.groupA': 'Ασυνήθιστες ημέρες',
  'analysis.anomalies.zValue': '{value} (z {z})',
  'analysis.anomalies.nothing':
    'Έλεγξα για ασυνήθιστες ημέρες σε διάστημα {count, plural, one {# ημέρας} other {# ημερών}} και δεν βρήκα ημέρα που να απέχει από τον μέσο όρο {z} τυπικές αποκλίσεις ή περισσότερο.',

  // Emotion patterns ----------------------------------------------------------------------
  'analysis.emotion.label': 'τα μοτίβα συναισθημάτων ανά ημέρες, άτομα και μέρη',
  'analysis.emotion.metric': 'Το συναίσθημα «{emotion}»',
  'analysis.emotion.groupA': 'Ημέρες με το συναίσθημα «{emotion}»',
  'analysis.emotion.weekdayTitle': 'Το συναίσθημα «{emotion}» εμφανίζεται κυρίως {onWeekday}',
  'analysis.emotion.weekdayText':
    'Φαίνεται ότι στα δεδομένα σου το συναίσθημα «{emotion}» εμφανιζόταν κυρίως {onWeekday} ({top} από {total} φορές).',
  'analysis.emotion.weekdayExplain':
    'Έλεγξα {count, plural, one {# ημέρα} other {# ημέρες}}. Το συναίσθημα «{emotion}» καταγράφηκε σε {total, plural, one {# ημέρα} other {# ημέρες}}· {top} από αυτές ήταν {weekdays} ({share}), ενώ το ποσοστό τους ({weekdays}) σε όλες τις ημέρες που ελέγχθηκαν είναι {baseline}. Ισχύς μοτίβου: {strength}.',
  'analysis.emotion.groupBWeekday': 'Από αυτές: {weekdays}',
  'analysis.emotion.weekdayShareKey': 'Ποσοστό σε όλες τις ημέρες: {weekdays}',
  'analysis.emotion.personTitle': 'Το συναίσθημα «{emotion}» και {name}',
  'analysis.emotion.placeTitle': 'Το συναίσθημα «{emotion}» και «{place}»',
  'analysis.emotion.personText':
    'Φαίνεται ότι στα δεδομένα σου το συναίσθημα «{emotion}» εμφανιζόταν συχνά τις ημέρες που στην καταχώριση υπήρχε και το όνομα {name} ({with} από {total} φορές).',
  'analysis.emotion.placeText':
    'Φαίνεται ότι στα δεδομένα σου το συναίσθημα «{emotion}» εμφανιζόταν συχνά τις ημέρες που η τοποθεσία ήταν «{place}» ({with} από {total} φορές).',
  'analysis.emotion.personExplain':
    'Έλεγξα {count, plural, one {# ημέρα} other {# ημέρες}}. Το συναίσθημα «{emotion}» καταγράφηκε σε {total} ημέρες· σε {with} από αυτές ({share}) στην καταχώριση υπήρχε και το όνομα {name}. Το όνομα {name} εμφανίζεται συνολικά σε {baselineCount} από τις {count} ημέρες ({baseline}). Ισχύς μοτίβου: {strength}.',
  'analysis.emotion.placeExplain':
    'Έλεγξα {count, plural, one {# ημέρα} other {# ημέρες}}. Το συναίσθημα «{emotion}» καταγράφηκε σε {total} ημέρες· σε {with} από αυτές ({share}) στην καταχώριση υπήρχε και η τοποθεσία «{place}». Η τοποθεσία «{place}» εμφανίζεται συνολικά σε {baselineCount} από τις {count} ημέρες ({baseline}). Ισχύς μοτίβου: {strength}.',
  'analysis.emotion.groupBPerson': 'Από αυτές, με το όνομα {name}',
  'analysis.emotion.groupBPlace': 'Από αυτές, με τοποθεσία «{place}»',
  'analysis.emotion.personShareKey': 'Ποσοστό ημερών με το όνομα {name} σε όλες τις ημέρες',
  'analysis.emotion.placeShareKey': 'Ποσοστό ημερών με την τοποθεσία «{place}» σε όλες τις ημέρες',
  'analysis.emotion.nothing':
    'Έλεγξα {count, plural, one {# συναίσθημα που επανήλθε} other {# συναισθήματα που επανήλθαν}} τουλάχιστον {min} φορές και δεν βρήκα αξιοσημείωτη συγκέντρωση σε συγκεκριμένες ημέρες, άτομα ή μέρη.',
};
export default messages;
