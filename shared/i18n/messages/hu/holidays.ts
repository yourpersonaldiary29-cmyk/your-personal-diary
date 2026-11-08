/** hu - holidays messages. Keys are prefixed 'holidays.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Traditions (legend, settings, screen-reader text) - shared/calendars/types.ts -------
  'holidays.tradition.jewish': 'Zsidó ünnepek és jeles napok',
  'holidays.tradition.muslim': 'Muszlim ünnepek és jeles napok',
  'holidays.tradition.christian': 'Keresztény ünnepek és jeles napok',
  'holidays.tradition.druze': 'Drúz ünnepek és jeles napok',
  'holidays.traditionShort.jewish': 'Zsidó',
  'holidays.traditionShort.muslim': 'Muszlim',
  'holidays.traditionShort.christian': 'Keresztény',
  'holidays.traditionShort.druze': 'Drúz',

  // Kinds ---------------------------------------------------------------------------
  'holidays.kind.major': 'Ünnep',
  'holidays.kind.minor': 'Jeles nap',
  'holidays.kind.fast': 'Böjtnap',
  'holidays.kind.memorial': 'Emléknap',
  'holidays.kind.national': 'Nemzeti ünnep',

  // Sentences (describeHoliday / describeHolidayAmong) -------------------------------
  'holidays.dayOf': '{name} ({index}. nap, összesen {count})',
  'holidays.withTradition': '{label} ({tradition})',

  // Notes attached to moved or approximate dates ---------------------------------------
  'holidays.note.postponedFromShabbat': 'A szombat (sábát) miatt elhalasztva',
  'holidays.note.advancedFromShabbat': 'A szombat (sábát) miatt előrehozva',
  'holidays.note.advancedFromFriday': 'A péntek miatt előrehozva',
  'holidays.note.postponedFromSunday': 'A vasárnap miatt elhalasztva',
  'holidays.note.postponedFromMonday': 'A hétfő miatt elhalasztva',
  'holidays.note.movedWithYomHaatzmaut': 'A függetlenség napjával együtt áthelyezve',
  'holidays.note.roshChodeshTwoDays': 'Kétnapos ros hódes',
  'holidays.note.ummAlQura':
    'Az Umm al-Kura naptár szerint; a tényleges dátumot az újhold megfigyelése határozza meg, és egy nappal eltolódhat',
  'holidays.note.civilHijri':
    'Az aritmetikai hidzsra naptár szerint; a tényleges dátumot az újhold megfigyelése határozza meg, és egy-két nappal eltolódhat',
  'holidays.note.officialHoliday': 'Hivatalos ünnepnap',

  // Jewish holidays (key = 'holidays.' + id with dots replaced by dashes) --------------
  'holidays.jewish-rosh-hashana': 'Ros hásána',
  'holidays.jewish-tzom-gedaliah': 'Gedalja böjtje',
  'holidays.jewish-yom-kippur': 'Jom kipur',
  'holidays.jewish-sukkot': 'Szukkot',
  'holidays.jewish-sukkot.cholHamoed': 'Szukkot félünnepnapjai',
  'holidays.jewish-hoshana-rabba': 'Hósána rabba',
  'holidays.jewish-shemini-atzeret': 'Smini aceret és szimhát tóra',
  'holidays.jewish-sigd': 'Szigd',
  'holidays.jewish-hanukkah': 'Hanuka',
  'holidays.jewish-asara-btevet': 'Tévét 10. napjának böjtje',
  'holidays.jewish-tu-bishvat': 'Tu bisvát',
  'holidays.jewish-taanit-esther': 'Eszter böjtje',
  'holidays.jewish-purim': 'Purim',
  'holidays.jewish-shushan-purim': 'Susán purim',
  'holidays.jewish-pesach': 'Pészah',
  'holidays.jewish-pesach.cholHamoed': 'Pészah félünnepnapjai',
  'holidays.jewish-pesach.seventh': 'Pészah hetedik napja',
  'holidays.jewish-yom-hashoah': 'A holokauszt emléknapja',
  'holidays.jewish-yom-haatzmaut': 'A függetlenség napja',
  'holidays.jewish-yom-hazikaron': 'Az elesettek emléknapja',
  'holidays.jewish-lag-baomer': 'Lag baómer',
  'holidays.jewish-yom-yerushalayim': 'Jeruzsálem napja',
  'holidays.jewish-shavuot': 'Sávuot',
  'holidays.jewish-tzom-tammuz': 'Tamuz 17. napjának böjtje',
  'holidays.jewish-tisha-bav': 'Tisá beáv',
  'holidays.jewish-tu-bav': 'Tu beáv',
  'holidays.jewish-rosh-chodesh': 'Ros hódes: {month}',

  // Muslim holidays -----------------------------------------------------------------
  'holidays.muslim-hijri-new-year': 'Iszlám újév',
  'holidays.muslim-ashura': 'Ásúrá',
  'holidays.muslim-mawlid': 'Mavlid an-Nabí',
  'holidays.muslim-isra-miraj': 'Iszrá és Mirádzs',
  'holidays.muslim-ramadan-start': 'A ramadán kezdete',
  'holidays.muslim-laylat-al-qadr': 'Lajlat al-Kadr',
  'holidays.muslim-eid-al-fitr': 'Íd al-Fitr',
  'holidays.muslim-arafah': 'Arafát napja',
  'holidays.muslim-eid-al-adha': 'Íd al-Adhá',

  // Christian holidays ----------------------------------------------------------------
  'holidays.christian-epiphany-western': 'Vízkereszt (nyugati)',
  'holidays.christian-annunciation': 'Gyümölcsoltó Boldogasszony',
  'holidays.christian-assumption': 'Nagyboldogasszony',
  'holidays.christian-all-saints': 'Mindenszentek',
  'holidays.christian-christmas-western': 'Karácsony (nyugati)',
  'holidays.christian-ash-wednesday': 'Hamvazószerda',
  'holidays.christian-palm-sunday-western': 'Virágvasárnap (nyugati)',
  'holidays.christian-maundy-thursday': 'Nagycsütörtök',
  'holidays.christian-good-friday-western': 'Nagypéntek (nyugati)',
  'holidays.christian-easter-western': 'Húsvét (nyugati)',
  'holidays.christian-easter-monday': 'Húsvéthétfő',
  'holidays.christian-ascension-western': 'Mennybemenetel (nyugati)',
  'holidays.christian-pentecost-western': 'Pünkösd (nyugati)',
  'holidays.christian-christmas-orthodox': 'Ortodox karácsony',
  'holidays.christian-epiphany-orthodox': 'Ortodox vízkereszt',
  'holidays.christian-lazarus-saturday': 'Lázár-szombat',
  'holidays.christian-palm-sunday-orthodox': 'Virágvasárnap (ortodox)',
  'holidays.christian-good-friday-orthodox': 'Nagypéntek (ortodox)',
  'holidays.christian-easter-orthodox': 'Ortodox húsvét',
  'holidays.christian-ascension-orthodox': 'Mennybemenetel (ortodox)',
  'holidays.christian-pentecost-orthodox': 'Pünkösd (ortodox)',

  // Druze holidays --------------------------------------------------------------------
  'holidays.druze-eid-al-adha': 'Íd al-Adhá',
  'holidays.druze-nabi-shuayb': 'Zijárat Nabí Suajb',
  'holidays.druze-al-khadr': 'Zijárat al-Hidr',
  'holidays.druze-nabi-sablan': 'Zijárat Nabí Szablán',
};
export default messages;
