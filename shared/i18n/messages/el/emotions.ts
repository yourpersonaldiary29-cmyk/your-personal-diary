/**
 * el - emotions messages. Keys are prefixed 'emotions.'; see shared/i18n/index.ts for the syntax.
 *
 * 'emotions.<key>.label'   - the label shown in the UI (emotion picker, badges, exports).
 *                            Greek labels are nouns (Χαρά, Ηρεμία ...), so they never need
 *                            a masculine / feminine form of the user.
 * 'emotions.<key>.aliases' - comma-separated words the search parser also resolves to the
 *                            key (synonyms, masculine and feminine adjectives). Lowercase, with accents;
 *                            the search table adds the unaccented spellings.
 */
const messages: Record<string, string> = {
  'emotions.happy.label': 'Χαρά',
  'emotions.happy.aliases': 'χαρούμενος,χαρούμενη,ευτυχία,ευτυχισμένος,ευτυχισμένη,ευδιάθετος,ευδιάθετη',
  'emotions.calm.label': 'Ηρεμία',
  'emotions.calm.aliases': 'ήρεμος,ήρεμη,γαλήνη,γαλήνιος,γαλήνια,χαλαρός,χαλαρή,χαλάρωση',
  'emotions.sad.label': 'Λύπη',
  'emotions.sad.aliases': 'λυπημένος,λυπημένη,θλίψη,θλιμμένος,θλιμμένη,στενοχώρια,στεναχώρια,στενοχωρημένος,στενοχωρημένη,μελαγχολία',
  'emotions.angry.label': 'Θυμός',
  'emotions.angry.aliases': 'θυμωμένος,θυμωμένη,εκνευρισμός,εκνευρισμένος,εκνευρισμένη,οργή,νευριασμένος,νευριασμένη',
  'emotions.stressed.label': 'Άγχος',
  'emotions.stressed.aliases': 'αγχωμένος,αγχωμένη,στρες,στρεσαρισμένος,στρεσαρισμένη,πιεσμένος,πιεσμένη,υπό πίεση',
  'emotions.excited.label': 'Ενθουσιασμός',
  'emotions.excited.aliases': 'ενθουσιασμένος,ενθουσιασμένη,ανυπομονησία',
  'emotions.tired.label': 'Κούραση',
  'emotions.tired.aliases': 'κουρασμένος,κουρασμένη,εξάντληση,εξαντλημένος,εξαντλημένη,κόπωση,νυσταγμένος,νυσταγμένη',
  'emotions.satisfied.label': 'Ικανοποίηση',
  'emotions.satisfied.aliases': 'ικανοποιημένος,ικανοποιημένη,ευχαριστημένος,ευχαριστημένη',
  'emotions.frustrated.label': 'Απογοήτευση',
  'emotions.frustrated.aliases': 'απογοητευμένος,απογοητευμένη,ματαίωση',
  'emotions.anxious.label': 'Ανησυχία',
  'emotions.anxious.aliases': 'ανήσυχος,ανήσυχη,αγωνία,φόβος,φοβισμένος,φοβισμένη,νευρικότητα',
  'emotions.energetic.label': 'Ενεργητικότητα',
  'emotions.energetic.aliases': 'ενεργητικός,ενεργητική,γεμάτος ενέργεια,γεμάτη ενέργεια,ζωντάνια,ζωηρός,ζωηρή',
  'emotions.grateful.label': 'Ευγνωμοσύνη',
  'emotions.grateful.aliases': 'ευγνώμων,ευγνώμονας',
  'emotions.lonely.label': 'Μοναξιά',
  'emotions.lonely.aliases': 'μοναχικός,μοναχική,απομονωμένος,απομονωμένη',
  'emotions.hopeful.label': 'Ελπίδα',
  'emotions.hopeful.aliases': 'γεμάτος ελπίδα,γεμάτη ελπίδα,αισιοδοξία,αισιόδοξος,αισιόδοξη',
  'emotions.bored.label': 'Βαρεμάρα',
  'emotions.bored.aliases': 'πλήξη,βαριεστημένος,βαριεστημένη',
  'emotions.proud.label': 'Περηφάνια',
  'emotions.proud.aliases': 'υπερηφάνεια,περήφανος,περήφανη,υπερήφανος,υπερήφανη',
  'emotions.focused.label': 'Συγκέντρωση',
  'emotions.focused.aliases': 'συγκεντρωμένος,συγκεντρωμένη,προσήλωση,προσηλωμένος,προσηλωμένη',
  'emotions.overwhelmed.label': 'Υπερφόρτωση',
  'emotions.overwhelmed.aliases': 'πελαγωμένος,πελαγωμένη,υπερφορτωμένος,υπερφορτωμένη,πνιγμένος,πνιγμένη',
};
export default messages;
