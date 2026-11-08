/** tr - holidays messages. Keys are prefixed 'holidays.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Traditions (legend, settings, screen-reader text) - shared/calendars/types.ts -------
  'holidays.tradition.jewish': 'Yahudi bayramları ve özel günleri',
  'holidays.tradition.muslim': 'İslami bayramlar ve özel günler',
  'holidays.tradition.christian': 'Hristiyan bayramları ve özel günleri',
  'holidays.tradition.druze': 'Dürzi bayramları ve özel günleri',
  'holidays.traditionShort.jewish': 'Yahudi',
  'holidays.traditionShort.muslim': 'İslami',
  'holidays.traditionShort.christian': 'Hristiyan',
  'holidays.traditionShort.druze': 'Dürzi',

  // Kinds ---------------------------------------------------------------------------
  'holidays.kind.major': 'Bayram',
  'holidays.kind.minor': 'Özel gün',
  'holidays.kind.fast': 'Oruç',
  'holidays.kind.memorial': 'Anma günü',
  'holidays.kind.national': 'Ulusal gün',

  // Sentences (describeHoliday / describeHolidayAmong) -------------------------------
  'holidays.dayOf': '{name} ({count} günün {index}. günü)',
  'holidays.withTradition': '{label} ({tradition})',

  // Notes attached to moved or approximate dates ---------------------------------------
  'holidays.note.postponedFromShabbat': 'Şabat nedeniyle ertelendi',
  'holidays.note.advancedFromShabbat': 'Şabat nedeniyle öne alındı',
  'holidays.note.advancedFromFriday': 'Cuma gününden öne alındı',
  'holidays.note.postponedFromSunday': 'Pazar gününden ertelendi',
  'holidays.note.postponedFromMonday': 'Pazartesi gününden ertelendi',
  'holidays.note.movedWithYomHaatzmaut': 'Bağımsızlık Günü ile birlikte taşındı',
  'holidays.note.roshChodeshTwoDays': 'İki günlük Roş Hodeş',
  'holidays.note.ummAlQura':
    'Ümmü’l-Kurâ takvimine göre; kesin tarih hilalin görülmesine göre belirlenir ve bir gün kayabilir',
  'holidays.note.civilHijri':
    'Aritmetik Hicri takvime göre; kesin tarih hilalin görülmesine göre belirlenir ve bir veya iki gün kayabilir',
  'holidays.note.officialHoliday': 'Resmî tatil',

  // Jewish holidays (key = 'holidays.' + id with dots replaced by dashes) --------------
  'holidays.jewish-rosh-hashana': 'Roş Aşana',
  'holidays.jewish-tzom-gedaliah': 'Gedalya Orucu',
  'holidays.jewish-yom-kippur': 'Yom Kipur',
  'holidays.jewish-sukkot': 'Sukot',
  'holidays.jewish-sukkot.cholHamoed': 'Sukot Hol Hamoed',
  'holidays.jewish-hoshana-rabba': 'Hoşana Raba',
  'holidays.jewish-shemini-atzeret': 'Şemini Atzeret ve Simhat Tora',
  'holidays.jewish-sigd': 'Sigd',
  'holidays.jewish-hanukkah': 'Hanuka',
  'holidays.jewish-asara-btevet': 'Tevet’in Onu',
  'holidays.jewish-tu-bishvat': 'Tu Bişvat',
  'holidays.jewish-taanit-esther': 'Ester Orucu',
  'holidays.jewish-purim': 'Purim',
  'holidays.jewish-shushan-purim': 'Şuşan Purim',
  'holidays.jewish-pesach': 'Pesah',
  'holidays.jewish-pesach.cholHamoed': 'Pesah Hol Hamoed',
  'holidays.jewish-pesach.seventh': 'Pesah’ın yedinci günü',
  'holidays.jewish-yom-hashoah': 'Holokost Anma Günü',
  'holidays.jewish-yom-haatzmaut': 'Bağımsızlık Günü',
  'holidays.jewish-yom-hazikaron': 'Anma Günü',
  'holidays.jewish-lag-baomer': 'Lag Baomer',
  'holidays.jewish-yom-yerushalayim': 'Kudüs Günü',
  'holidays.jewish-shavuot': 'Şavuot',
  'holidays.jewish-tzom-tammuz': 'Tamuz’un On Yedisi',
  'holidays.jewish-tisha-bav': 'Tişa Beav',
  'holidays.jewish-tu-bav': 'Tu Beav',
  'holidays.jewish-rosh-chodesh': 'Roş Hodeş {month}',

  // Muslim holidays -----------------------------------------------------------------
  'holidays.muslim-hijri-new-year': 'Hicri Yılbaşı',
  'holidays.muslim-ashura': 'Aşure Günü',
  'holidays.muslim-mawlid': 'Mevlid Kandili',
  'holidays.muslim-isra-miraj': 'Miraç Kandili',
  'holidays.muslim-ramadan-start': 'Ramazan’ın başlangıcı',
  'holidays.muslim-laylat-al-qadr': 'Kadir Gecesi',
  'holidays.muslim-eid-al-fitr': 'Ramazan Bayramı',
  'holidays.muslim-arafah': 'Arefe Günü',
  'holidays.muslim-eid-al-adha': 'Kurban Bayramı',

  // Christian holidays ----------------------------------------------------------------
  'holidays.christian-epiphany-western': 'Epifani (Batı)',
  'holidays.christian-annunciation': 'Müjde Bayramı',
  'holidays.christian-assumption': 'Meryem’in Göğe Kabulü',
  'holidays.christian-all-saints': 'Azizler Günü',
  'holidays.christian-christmas-western': 'Noel (Batı)',
  'holidays.christian-ash-wednesday': 'Kül Çarşambası',
  'holidays.christian-palm-sunday-western': 'Palmiye Pazarı (Batı)',
  'holidays.christian-maundy-thursday': 'Kutsal Perşembe',
  'holidays.christian-good-friday-western': 'Kutsal Cuma (Batı)',
  'holidays.christian-easter-western': 'Paskalya (Batı)',
  'holidays.christian-easter-monday': 'Paskalya Pazartesisi',
  'holidays.christian-ascension-western': 'Göğe Yükseliş (Batı)',
  'holidays.christian-pentecost-western': 'Pentekost (Batı)',
  'holidays.christian-christmas-orthodox': 'Ortodoks Noeli',
  'holidays.christian-epiphany-orthodox': 'Ortodoks Epifani',
  'holidays.christian-lazarus-saturday': 'Lazarus Cumartesisi',
  'holidays.christian-palm-sunday-orthodox': 'Palmiye Pazarı (Ortodoks)',
  'holidays.christian-good-friday-orthodox': 'Kutsal Cuma (Ortodoks)',
  'holidays.christian-easter-orthodox': 'Ortodoks Paskalyası',
  'holidays.christian-ascension-orthodox': 'Göğe Yükseliş (Ortodoks)',
  'holidays.christian-pentecost-orthodox': 'Pentekost (Ortodoks)',

  // Druze holidays --------------------------------------------------------------------
  'holidays.druze-eid-al-adha': 'Kurban Bayramı',
  'holidays.druze-nabi-shuayb': 'Nebi Şuayb Ziyareti',
  'holidays.druze-al-khadr': 'Hızır Ziyareti',
  'holidays.druze-nabi-sablan': 'Nebi Sablan Ziyareti',
};
export default messages;
