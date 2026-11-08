/** el - holidays messages. Keys are prefixed 'holidays.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Traditions (legend, settings, screen-reader text) - shared/calendars/types.ts -------
  'holidays.tradition.jewish': 'Εβραϊκές γιορτές και ειδικές ημέρες',
  'holidays.tradition.muslim': 'Μουσουλμανικές γιορτές και ειδικές ημέρες',
  'holidays.tradition.christian': 'Χριστιανικές γιορτές και ειδικές ημέρες',
  'holidays.tradition.druze': 'Δρουζικές γιορτές και ειδικές ημέρες',
  'holidays.traditionShort.jewish': 'Εβραϊκές',
  'holidays.traditionShort.muslim': 'Μουσουλμανικές',
  'holidays.traditionShort.christian': 'Χριστιανικές',
  'holidays.traditionShort.druze': 'Δρουζικές',

  // Kinds ---------------------------------------------------------------------------
  'holidays.kind.major': 'Γιορτή',
  'holidays.kind.minor': 'Ειδική ημέρα',
  'holidays.kind.fast': 'Νηστεία',
  'holidays.kind.memorial': 'Ημέρα μνήμης',
  'holidays.kind.national': 'Εθνική ημέρα',

  // Sentences (describeHoliday / describeHolidayAmong) -------------------------------
  'holidays.dayOf': '{name} (ημέρα {index} από {count})',
  'holidays.withTradition': '{label} ({tradition})',

  // Notes attached to moved or approximate dates ---------------------------------------
  'holidays.note.postponedFromShabbat': 'Μετατέθηκε λόγω Σαμπάτ',
  'holidays.note.advancedFromShabbat': 'Μεταφέρθηκε νωρίτερα λόγω Σαμπάτ',
  'holidays.note.advancedFromFriday': 'Μεταφέρθηκε νωρίτερα από την Παρασκευή',
  'holidays.note.postponedFromSunday': 'Μετατέθηκε από την Κυριακή',
  'holidays.note.postponedFromMonday': 'Μετατέθηκε από τη Δευτέρα',
  'holidays.note.movedWithYomHaatzmaut': 'Μετακινήθηκε μαζί με την Ημέρα Ανεξαρτησίας',
  'holidays.note.roshChodeshTwoDays': 'Διήμερο Ρος Χόντες',
  'holidays.note.ummAlQura':
    'Σύμφωνα με το ημερολόγιο Umm al-Qura· η πραγματική ημερομηνία ορίζεται από την παρατήρηση της σελήνης και μπορεί να μετατοπιστεί κατά μία ημέρα',
  'holidays.note.civilHijri':
    'Σύμφωνα με το αριθμητικό ημερολόγιο της Εγίρας· η πραγματική ημερομηνία ορίζεται από την παρατήρηση της σελήνης και μπορεί να μετατοπιστεί κατά μία ή δύο ημέρες',
  'holidays.note.officialHoliday': 'Επίσημη αργία',

  // Jewish holidays (key = 'holidays.' + id with dots replaced by dashes) --------------
  'holidays.jewish-rosh-hashana': 'Ρος Χασανά',
  'holidays.jewish-tzom-gedaliah': 'Νηστεία του Γεδαλιά',
  'holidays.jewish-yom-kippur': 'Γιομ Κιπούρ',
  'holidays.jewish-sukkot': 'Σουκότ',
  'holidays.jewish-sukkot.cholHamoed': 'Χολ Χαμοέντ Σουκότ',
  'holidays.jewish-hoshana-rabba': 'Οσανά Ραμπά',
  'holidays.jewish-shemini-atzeret': 'Σεμινί Ατσέρετ και Σιμχάτ Τορά',
  'holidays.jewish-sigd': 'Σιγκντ',
  'holidays.jewish-hanukkah': 'Χανουκά',
  'holidays.jewish-asara-btevet': 'Νηστεία της 10ης Τεβέτ',
  'holidays.jewish-tu-bishvat': 'Του Μπισβάτ',
  'holidays.jewish-taanit-esther': 'Νηστεία της Εσθήρ',
  'holidays.jewish-purim': 'Πουρίμ',
  'holidays.jewish-shushan-purim': 'Σουσάν Πουρίμ',
  'holidays.jewish-pesach': 'Πέσαχ',
  'holidays.jewish-pesach.cholHamoed': 'Χολ Χαμοέντ Πέσαχ',
  'holidays.jewish-pesach.seventh': 'Έβδομη ημέρα του Πέσαχ',
  'holidays.jewish-yom-hashoah': 'Ημέρα Μνήμης του Ολοκαυτώματος',
  'holidays.jewish-yom-haatzmaut': 'Ημέρα Ανεξαρτησίας',
  'holidays.jewish-yom-hazikaron': 'Ημέρα Μνήμης',
  'holidays.jewish-lag-baomer': 'Λαγκ Μπαόμερ',
  'holidays.jewish-yom-yerushalayim': 'Ημέρα της Ιερουσαλήμ',
  'holidays.jewish-shavuot': 'Σαβουότ',
  'holidays.jewish-tzom-tammuz': 'Νηστεία της 17ης Ταμούζ',
  'holidays.jewish-tisha-bav': 'Τισά Μπεάβ',
  'holidays.jewish-tu-bav': 'Του Μπεάβ',
  'holidays.jewish-rosh-chodesh': 'Ρος Χόντες {month}',

  // Muslim holidays -----------------------------------------------------------------
  'holidays.muslim-hijri-new-year': 'Ισλαμική Πρωτοχρονιά',
  'holidays.muslim-ashura': 'Ασούρα',
  'holidays.muslim-mawlid': 'Μαουλίντ αν-Ναμπί',
  'holidays.muslim-isra-miraj': 'Ίσρα και Μιράτζ',
  'holidays.muslim-ramadan-start': 'Αρχή του Ραμαζανιού',
  'holidays.muslim-laylat-al-qadr': 'Λαϊλάτ αλ-Κάντρ',
  'holidays.muslim-eid-al-fitr': 'Ιντ αλ-Φιτρ',
  'holidays.muslim-arafah': 'Ημέρα του Αραφάτ',
  'holidays.muslim-eid-al-adha': 'Ιντ αλ-Άντχα',

  // Christian holidays ----------------------------------------------------------------
  'holidays.christian-epiphany-western': 'Θεοφάνεια (δυτικά)',
  'holidays.christian-annunciation': 'Ευαγγελισμός της Θεοτόκου',
  'holidays.christian-assumption': 'Κοίμηση της Θεοτόκου',
  'holidays.christian-all-saints': 'Αγίων Πάντων (δυτική εορτή)',
  'holidays.christian-christmas-western': 'Χριστούγεννα (δυτικά)',
  'holidays.christian-ash-wednesday': 'Τετάρτη της Τέφρας',
  'holidays.christian-palm-sunday-western': 'Κυριακή των Βαΐων (δυτική)',
  'holidays.christian-maundy-thursday': 'Μεγάλη Πέμπτη (δυτική)',
  'holidays.christian-good-friday-western': 'Μεγάλη Παρασκευή (δυτική)',
  'holidays.christian-easter-western': 'Πάσχα (δυτικό)',
  'holidays.christian-easter-monday': 'Δευτέρα του Πάσχα (δυτική)',
  'holidays.christian-ascension-western': 'Ανάληψη (δυτική)',
  'holidays.christian-pentecost-western': 'Πεντηκοστή (δυτική)',
  'holidays.christian-christmas-orthodox': 'Χριστούγεννα (Ιουλιανό ημερολόγιο)',
  'holidays.christian-epiphany-orthodox': 'Θεοφάνεια (Ιουλιανό ημερολόγιο)',
  'holidays.christian-lazarus-saturday': 'Σάββατο του Λαζάρου',
  'holidays.christian-palm-sunday-orthodox': 'Κυριακή των Βαΐων (ορθόδοξη)',
  'holidays.christian-good-friday-orthodox': 'Μεγάλη Παρασκευή (ορθόδοξη)',
  'holidays.christian-easter-orthodox': 'Ορθόδοξο Πάσχα',
  'holidays.christian-ascension-orthodox': 'Ανάληψη (ορθόδοξη)',
  'holidays.christian-pentecost-orthodox': 'Πεντηκοστή (ορθόδοξη)',

  // Druze holidays --------------------------------------------------------------------
  'holidays.druze-eid-al-adha': 'Ιντ αλ-Άντχα',
  'holidays.druze-nabi-shuayb': 'Ζιγιάρατ Νάμπι Σουάιμπ',
  'holidays.druze-al-khadr': 'Ζιγιάρατ αλ-Χιντρ',
  'holidays.druze-nabi-sablan': 'Ζιγιάρατ Νάμπι Σαμπλάν',
};
export default messages;
