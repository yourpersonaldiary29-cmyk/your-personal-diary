/** pl - holidays messages. Keys are prefixed 'holidays.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Traditions (legend, settings, screen-reader text) - shared/calendars/types.ts -------
  'holidays.tradition.jewish': 'Święta żydowskie i dni szczególne',
  'holidays.tradition.muslim': 'Święta muzułmańskie i dni szczególne',
  'holidays.tradition.christian': 'Święta chrześcijańskie i dni szczególne',
  'holidays.tradition.druze': 'Święta druzyjskie i dni szczególne',
  'holidays.traditionShort.jewish': 'Żydowskie',
  'holidays.traditionShort.muslim': 'Muzułmańskie',
  'holidays.traditionShort.christian': 'Chrześcijańskie',
  'holidays.traditionShort.druze': 'Druzyjskie',

  // Kinds ---------------------------------------------------------------------------
  'holidays.kind.major': 'Święto',
  'holidays.kind.minor': 'Dzień szczególny',
  'holidays.kind.fast': 'Post',
  'holidays.kind.memorial': 'Dzień pamięci',
  'holidays.kind.national': 'Święto państwowe',

  // Sentences (describeHoliday / describeHolidayAmong) -------------------------------
  'holidays.dayOf': '{name} (dzień {index} z {count})',
  'holidays.withTradition': '{label} ({tradition})',

  // Notes attached to moved or approximate dates ---------------------------------------
  'holidays.note.postponedFromShabbat': 'Przełożone z szabatu',
  'holidays.note.advancedFromShabbat': 'Przeniesione na wcześniejszy dzień z powodu szabatu',
  'holidays.note.advancedFromFriday': 'Przeniesione na wcześniejszy dzień z piątku',
  'holidays.note.postponedFromSunday': 'Przełożone z niedzieli',
  'holidays.note.postponedFromMonday': 'Przełożone z poniedziałku',
  'holidays.note.movedWithYomHaatzmaut': 'Przeniesione razem z Dniem Niepodległości',
  'holidays.note.roshChodeshTwoDays': 'Dwudniowy Rosz Chodesz',
  'holidays.note.ummAlQura':
    'Według kalendarza Umm al-Kura; faktyczną datę wyznacza obserwacja księżyca, więc może się ona przesunąć o jeden dzień',
  'holidays.note.civilHijri':
    'Według arytmetycznego kalendarza hidżry; faktyczną datę wyznacza obserwacja księżyca, więc może się ona przesunąć o jeden lub dwa dni',
  'holidays.note.officialHoliday': 'Święto oficjalne',

  // Jewish holidays (key = 'holidays.' + id with dots replaced by dashes) --------------
  'holidays.jewish-rosh-hashana': 'Rosz ha-Szana',
  'holidays.jewish-tzom-gedaliah': 'Post Gedaliasza',
  'holidays.jewish-yom-kippur': 'Jom Kipur',
  'holidays.jewish-sukkot': 'Sukot',
  'holidays.jewish-sukkot.cholHamoed': 'Chol ha-Moed Sukot',
  'holidays.jewish-hoshana-rabba': 'Hoszana Raba',
  'holidays.jewish-shemini-atzeret': 'Szemini Aceret i Simchat Tora',
  'holidays.jewish-sigd': 'Sigd',
  'holidays.jewish-hanukkah': 'Chanuka',
  'holidays.jewish-asara-btevet': 'Post 10 Tewet',
  'holidays.jewish-tu-bishvat': 'Tu bi-Szwat',
  'holidays.jewish-taanit-esther': 'Post Estery',
  'holidays.jewish-purim': 'Purim',
  'holidays.jewish-shushan-purim': 'Szuszan Purim',
  'holidays.jewish-pesach': 'Pesach',
  'holidays.jewish-pesach.cholHamoed': 'Chol ha-Moed Pesach',
  'holidays.jewish-pesach.seventh': 'Siódmy dzień Pesach',
  'holidays.jewish-yom-hashoah': 'Dzień Pamięci o Holokauście',
  'holidays.jewish-yom-haatzmaut': 'Dzień Niepodległości',
  'holidays.jewish-yom-hazikaron': 'Dzień Pamięci',
  'holidays.jewish-lag-baomer': 'Lag ba-Omer',
  'holidays.jewish-yom-yerushalayim': 'Dzień Jerozolimy',
  'holidays.jewish-shavuot': 'Szawuot',
  'holidays.jewish-tzom-tammuz': 'Post 17 Tamuz',
  'holidays.jewish-tisha-bav': 'Tisza be-Aw',
  'holidays.jewish-tu-bav': 'Tu be-Aw',
  'holidays.jewish-rosh-chodesh': 'Rosz Chodesz {month}',

  // Muslim holidays -----------------------------------------------------------------
  'holidays.muslim-hijri-new-year': 'Nowy Rok Islamski',
  'holidays.muslim-ashura': 'Aszura',
  'holidays.muslim-mawlid': 'Maulid an-Nabi',
  'holidays.muslim-isra-miraj': 'Isra i Miradż',
  'holidays.muslim-ramadan-start': 'Początek ramadanu',
  'holidays.muslim-laylat-al-qadr': 'Lajlat al-Kadr',
  'holidays.muslim-eid-al-fitr': 'Id al-Fitr',
  'holidays.muslim-arafah': 'Dzień Arafat',
  'holidays.muslim-eid-al-adha': 'Id al-Adha',

  // Christian holidays ----------------------------------------------------------------
  'holidays.christian-epiphany-western': 'Objawienie Pańskie (zachodnie)',
  'holidays.christian-annunciation': 'Zwiastowanie Pańskie',
  'holidays.christian-assumption': 'Wniebowzięcie Najświętszej Maryi Panny',
  'holidays.christian-all-saints': 'Wszystkich Świętych',
  'holidays.christian-christmas-western': 'Boże Narodzenie (zachodnie)',
  'holidays.christian-ash-wednesday': 'Środa Popielcowa',
  'holidays.christian-palm-sunday-western': 'Niedziela Palmowa (zachodnia)',
  'holidays.christian-maundy-thursday': 'Wielki Czwartek',
  'holidays.christian-good-friday-western': 'Wielki Piątek (zachodni)',
  'holidays.christian-easter-western': 'Wielkanoc (zachodnia)',
  'holidays.christian-easter-monday': 'Poniedziałek Wielkanocny',
  'holidays.christian-ascension-western': 'Wniebowstąpienie (zachodnie)',
  'holidays.christian-pentecost-western': 'Zesłanie Ducha Świętego (zachodnie)',
  'holidays.christian-christmas-orthodox': 'Prawosławne Boże Narodzenie',
  'holidays.christian-epiphany-orthodox': 'Prawosławne Objawienie Pańskie',
  'holidays.christian-lazarus-saturday': 'Sobota Łazarza',
  'holidays.christian-palm-sunday-orthodox': 'Niedziela Palmowa (prawosławna)',
  'holidays.christian-good-friday-orthodox': 'Wielki Piątek (prawosławny)',
  'holidays.christian-easter-orthodox': 'Prawosławna Wielkanoc',
  'holidays.christian-ascension-orthodox': 'Wniebowstąpienie (prawosławne)',
  'holidays.christian-pentecost-orthodox': 'Zesłanie Ducha Świętego (prawosławne)',

  // Druze holidays --------------------------------------------------------------------
  'holidays.druze-eid-al-adha': 'Id al-Adha',
  'holidays.druze-nabi-shuayb': 'Zijarat Nabi Szuajb',
  'holidays.druze-al-khadr': 'Zijarat al-Chidr',
  'holidays.druze-nabi-sablan': 'Zijarat Nabi Sablan',
};
export default messages;
