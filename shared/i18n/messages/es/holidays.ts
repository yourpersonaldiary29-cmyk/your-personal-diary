/** es - holidays messages. Keys are prefixed 'holidays.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Traditions (legend, settings, screen-reader text) - shared/calendars/types.ts -------
  'holidays.tradition.jewish': 'Festividades y celebraciones judías',
  'holidays.tradition.muslim': 'Festividades y celebraciones musulmanas',
  'holidays.tradition.christian': 'Festividades y celebraciones cristianas',
  'holidays.tradition.druze': 'Festividades y celebraciones drusas',
  'holidays.traditionShort.jewish': 'Judaísmo',
  'holidays.traditionShort.muslim': 'Islam',
  'holidays.traditionShort.christian': 'Cristianismo',
  'holidays.traditionShort.druze': 'Drusos',

  // Kinds ---------------------------------------------------------------------------
  'holidays.kind.major': 'Festividad',
  'holidays.kind.minor': 'Día señalado',
  'holidays.kind.fast': 'Ayuno',
  'holidays.kind.memorial': 'Día conmemorativo',
  'holidays.kind.national': 'Día nacional',

  // Sentences (describeHoliday / describeHolidayAmong) -------------------------------
  'holidays.dayOf': '{name} (día {index} de {count})',
  'holidays.withTradition': '{label} ({tradition})',

  // Notes attached to moved or approximate dates ---------------------------------------
  'holidays.note.postponedFromShabbat': 'Aplazado por coincidir con el Shabat',
  'holidays.note.advancedFromShabbat': 'Adelantado por coincidir con el Shabat',
  'holidays.note.advancedFromFriday': 'Adelantado por coincidir con el viernes',
  'holidays.note.postponedFromSunday': 'Aplazado por coincidir con el domingo',
  'holidays.note.postponedFromMonday': 'Aplazado por coincidir con el lunes',
  'holidays.note.movedWithYomHaatzmaut': 'Trasladado junto con el Día de la Independencia',
  'holidays.note.roshChodeshTwoDays': 'Rosh Jódesh de dos días',
  'holidays.note.ummAlQura':
    'Según el calendario Umm al-Qura; la fecha real depende del avistamiento de la luna y puede variar en un día',
  'holidays.note.civilHijri':
    'Según el calendario aritmético de la Hégira; la fecha real depende del avistamiento de la luna y puede variar en uno o dos días',
  'holidays.note.officialHoliday': 'Festivo oficial',

  // Jewish holidays (key = 'holidays.' + id with dots replaced by dashes) --------------
  'holidays.jewish-rosh-hashana': 'Rosh Hashaná',
  'holidays.jewish-tzom-gedaliah': 'Ayuno de Guedalías',
  'holidays.jewish-yom-kippur': 'Yom Kipur',
  'holidays.jewish-sukkot': 'Sucot',
  'holidays.jewish-sukkot.cholHamoed': 'Jol HaMoed de Sucot',
  'holidays.jewish-hoshana-rabba': 'Hoshaná Rabá',
  'holidays.jewish-shemini-atzeret': 'Sheminí Atzéret y Simjat Torá',
  'holidays.jewish-sigd': 'Sigd',
  'holidays.jewish-hanukkah': 'Janucá',
  'holidays.jewish-asara-btevet': 'Diez de Tevet',
  'holidays.jewish-tu-bishvat': 'Tu BiShvat',
  'holidays.jewish-taanit-esther': 'Ayuno de Ester',
  'holidays.jewish-purim': 'Purim',
  'holidays.jewish-shushan-purim': 'Shushán Purim',
  'holidays.jewish-pesach': 'Pésaj',
  'holidays.jewish-pesach.cholHamoed': 'Jol HaMoed de Pésaj',
  'holidays.jewish-pesach.seventh': 'Séptimo día de Pésaj',
  'holidays.jewish-yom-hashoah': 'Día del Recuerdo del Holocausto',
  'holidays.jewish-yom-haatzmaut': 'Día de la Independencia',
  'holidays.jewish-yom-hazikaron': 'Día del Recuerdo de los Caídos',
  'holidays.jewish-lag-baomer': 'Lag BaÓmer',
  'holidays.jewish-yom-yerushalayim': 'Día de Jerusalén',
  'holidays.jewish-shavuot': 'Shavuot',
  'holidays.jewish-tzom-tammuz': 'Diecisiete de Tamuz',
  'holidays.jewish-tisha-bav': 'Tishá BeAv',
  'holidays.jewish-tu-bav': 'Tu BeAv',
  'holidays.jewish-rosh-chodesh': 'Rosh Jódesh {month}',

  // Muslim holidays -----------------------------------------------------------------
  'holidays.muslim-hijri-new-year': 'Año Nuevo islámico',
  'holidays.muslim-ashura': 'Ashura',
  'holidays.muslim-mawlid': 'Mawlid an-Nabi (nacimiento del Profeta)',
  'holidays.muslim-isra-miraj': 'Isra y Miraj',
  'holidays.muslim-ramadan-start': 'Inicio del Ramadán',
  'holidays.muslim-laylat-al-qadr': 'Laylat al-Qadr (Noche del Destino)',
  'holidays.muslim-eid-al-fitr': 'Eid al-Fitr',
  'holidays.muslim-arafah': 'Día de Arafat',
  'holidays.muslim-eid-al-adha': 'Eid al-Adha',

  // Christian holidays ----------------------------------------------------------------
  'holidays.christian-epiphany-western': 'Epifanía (occidental)',
  'holidays.christian-annunciation': 'Anunciación',
  'holidays.christian-assumption': 'Asunción de la Virgen',
  'holidays.christian-all-saints': 'Día de Todos los Santos',
  'holidays.christian-christmas-western': 'Navidad (occidental)',
  'holidays.christian-ash-wednesday': 'Miércoles de Ceniza',
  'holidays.christian-palm-sunday-western': 'Domingo de Ramos (occidental)',
  'holidays.christian-maundy-thursday': 'Jueves Santo',
  'holidays.christian-good-friday-western': 'Viernes Santo (occidental)',
  'holidays.christian-easter-western': 'Pascua (occidental)',
  'holidays.christian-easter-monday': 'Lunes de Pascua',
  'holidays.christian-ascension-western': 'Ascensión (occidental)',
  'holidays.christian-pentecost-western': 'Pentecostés (occidental)',
  'holidays.christian-christmas-orthodox': 'Navidad ortodoxa',
  'holidays.christian-epiphany-orthodox': 'Epifanía ortodoxa',
  'holidays.christian-lazarus-saturday': 'Sábado de Lázaro',
  'holidays.christian-palm-sunday-orthodox': 'Domingo de Ramos (ortodoxo)',
  'holidays.christian-good-friday-orthodox': 'Viernes Santo (ortodoxo)',
  'holidays.christian-easter-orthodox': 'Pascua ortodoxa',
  'holidays.christian-ascension-orthodox': 'Ascensión (ortodoxa)',
  'holidays.christian-pentecost-orthodox': 'Pentecostés (ortodoxo)',

  // Druze holidays --------------------------------------------------------------------
  'holidays.druze-eid-al-adha': 'Eid al-Adha',
  'holidays.druze-nabi-shuayb': 'Ziyarat Nabi Shuayb',
  'holidays.druze-al-khadr': 'Ziyarat al-Jidr',
  'holidays.druze-nabi-sablan': 'Ziyarat Nabi Sablán',
};
export default messages;
