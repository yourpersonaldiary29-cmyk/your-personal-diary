/** cs - holidays messages. Keys are prefixed 'holidays.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Traditions (legend, settings, screen-reader text) - shared/calendars/types.ts -------
  'holidays.tradition.jewish': 'Židovské svátky a významné dny',
  'holidays.tradition.muslim': 'Muslimské svátky a významné dny',
  'holidays.tradition.christian': 'Křesťanské svátky a významné dny',
  'holidays.tradition.druze': 'Drúzské svátky a významné dny',
  'holidays.traditionShort.jewish': 'Židovské',
  'holidays.traditionShort.muslim': 'Muslimské',
  'holidays.traditionShort.christian': 'Křesťanské',
  'holidays.traditionShort.druze': 'Drúzské',

  // Kinds ---------------------------------------------------------------------------
  'holidays.kind.major': 'Svátek',
  'holidays.kind.minor': 'Významný den',
  'holidays.kind.fast': 'Půst',
  'holidays.kind.memorial': 'Den památky',
  'holidays.kind.national': 'Národní den',

  // Sentences (describeHoliday / describeHolidayAmong) -------------------------------
  'holidays.dayOf': '{name} (den {index} z {count})',
  'holidays.withTradition': '{label} ({tradition})',

  // Notes attached to moved or approximate dates ---------------------------------------
  'holidays.note.postponedFromShabbat': 'Odloženo kvůli šabatu',
  'holidays.note.advancedFromShabbat': 'Přesunuto dříve kvůli šabatu',
  'holidays.note.advancedFromFriday': 'Přesunuto dříve kvůli pátku',
  'holidays.note.postponedFromSunday': 'Odloženo z neděle',
  'holidays.note.postponedFromMonday': 'Odloženo z pondělí',
  'holidays.note.movedWithYomHaatzmaut': 'Přesunuto spolu se Dnem nezávislosti',
  'holidays.note.roshChodeshTwoDays': 'Dvoudenní roš chodeš',
  'holidays.note.ummAlQura':
    'Podle kalendáře Umm al-Kurá; skutečné datum určuje pozorování měsíce a může se posunout o jeden den',
  'holidays.note.civilHijri':
    'Podle aritmetického islámského kalendáře; skutečné datum určuje pozorování měsíce a může se posunout o jeden až dva dny',
  'holidays.note.officialHoliday': 'Státní svátek',

  // Jewish holidays (key = 'holidays.' + id with dots replaced by dashes) --------------
  'holidays.jewish-rosh-hashana': 'Roš ha-šana',
  'holidays.jewish-tzom-gedaliah': 'Půst Gedaljáše',
  'holidays.jewish-yom-kippur': 'Jom kipur',
  'holidays.jewish-sukkot': 'Sukot',
  'holidays.jewish-sukkot.cholHamoed': 'Chol ha-moed Sukot',
  'holidays.jewish-hoshana-rabba': 'Hošana raba',
  'holidays.jewish-shemini-atzeret': 'Šmini aceret a Simchat Tora',
  'holidays.jewish-sigd': 'Sigd',
  'holidays.jewish-hanukkah': 'Chanuka',
  'holidays.jewish-asara-btevet': 'Desátý tevet',
  'holidays.jewish-tu-bishvat': 'Tu bi-švat',
  'holidays.jewish-taanit-esther': 'Esterin půst',
  'holidays.jewish-purim': 'Purim',
  'holidays.jewish-shushan-purim': 'Šušan purim',
  'holidays.jewish-pesach': 'Pesach',
  'holidays.jewish-pesach.cholHamoed': 'Chol ha-moed Pesach',
  'holidays.jewish-pesach.seventh': 'Sedmý den Pesachu',
  'holidays.jewish-yom-hashoah': 'Den památky obětí holocaustu',
  'holidays.jewish-yom-haatzmaut': 'Den nezávislosti',
  'holidays.jewish-yom-hazikaron': 'Den památky padlých',
  'holidays.jewish-lag-baomer': 'Lag ba-omer',
  'holidays.jewish-yom-yerushalayim': 'Den Jeruzaléma',
  'holidays.jewish-shavuot': 'Šavuot',
  'holidays.jewish-tzom-tammuz': 'Sedmnáctý tamuz',
  'holidays.jewish-tisha-bav': 'Tiš’a be-av',
  'holidays.jewish-tu-bav': 'Tu be-av',
  'holidays.jewish-rosh-chodesh': 'Roš chodeš {month}',

  // Muslim holidays -----------------------------------------------------------------
  'holidays.muslim-hijri-new-year': 'Islámský nový rok',
  'holidays.muslim-ashura': 'Ášúrá',
  'holidays.muslim-mawlid': 'Maulid an-Nabí',
  'holidays.muslim-isra-miraj': 'Isrá a Mi’rádž',
  'holidays.muslim-ramadan-start': 'Začátek ramadánu',
  'holidays.muslim-laylat-al-qadr': 'Lajlat al-kadr',
  'holidays.muslim-eid-al-fitr': 'Íd al-fitr',
  'holidays.muslim-arafah': 'Den Arafátu',
  'holidays.muslim-eid-al-adha': 'Íd al-adhá',

  // Christian holidays ----------------------------------------------------------------
  'holidays.christian-epiphany-western': 'Zjevení Páně (západní)',
  'holidays.christian-annunciation': 'Zvěstování Páně',
  'holidays.christian-assumption': 'Nanebevzetí Panny Marie',
  'holidays.christian-all-saints': 'Slavnost Všech svatých',
  'holidays.christian-christmas-western': 'Vánoce (západní)',
  'holidays.christian-ash-wednesday': 'Popeleční středa',
  'holidays.christian-palm-sunday-western': 'Květná neděle (západní)',
  'holidays.christian-maundy-thursday': 'Zelený čtvrtek',
  'holidays.christian-good-friday-western': 'Velký pátek (západní)',
  'holidays.christian-easter-western': 'Velikonoce (západní)',
  'holidays.christian-easter-monday': 'Velikonoční pondělí',
  'holidays.christian-ascension-western': 'Nanebevstoupení Páně (západní)',
  'holidays.christian-pentecost-western': 'Letnice (západní)',
  'holidays.christian-christmas-orthodox': 'Pravoslavné Vánoce',
  'holidays.christian-epiphany-orthodox': 'Pravoslavné Zjevení Páně',
  'holidays.christian-lazarus-saturday': 'Lazarova sobota',
  'holidays.christian-palm-sunday-orthodox': 'Květná neděle (pravoslavná)',
  'holidays.christian-good-friday-orthodox': 'Velký pátek (pravoslavný)',
  'holidays.christian-easter-orthodox': 'Pravoslavné Velikonoce',
  'holidays.christian-ascension-orthodox': 'Nanebevstoupení Páně (pravoslavné)',
  'holidays.christian-pentecost-orthodox': 'Letnice (pravoslavné)',

  // Druze holidays --------------------------------------------------------------------
  'holidays.druze-eid-al-adha': 'Íd al-adhá',
  'holidays.druze-nabi-shuayb': 'Zijárat Nabí Šuajb',
  'holidays.druze-al-khadr': 'Zijárat al-Chidr',
  'holidays.druze-nabi-sablan': 'Zijárat Nabí Sablán',
};
export default messages;
