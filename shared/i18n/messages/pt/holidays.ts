/** pt - holidays messages. Keys are prefixed 'holidays.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Traditions (legend, settings, screen-reader text) - shared/calendars/types.ts -------
  'holidays.tradition.jewish': 'Festividades e celebrações judaicas',
  'holidays.tradition.muslim': 'Festividades e celebrações muçulmanas',
  'holidays.tradition.christian': 'Festividades e celebrações cristãs',
  'holidays.tradition.druze': 'Festividades e celebrações drusas',
  'holidays.traditionShort.jewish': 'Judaísmo',
  'holidays.traditionShort.muslim': 'Islão',
  'holidays.traditionShort.christian': 'Cristianismo',
  'holidays.traditionShort.druze': 'Drusos',

  // Kinds ---------------------------------------------------------------------------
  'holidays.kind.major': 'Festividade',
  'holidays.kind.minor': 'Data assinalada',
  'holidays.kind.fast': 'Jejum',
  'holidays.kind.memorial': 'Dia de memória',
  'holidays.kind.national': 'Dia nacional',

  // Sentences (describeHoliday / describeHolidayAmong) -------------------------------
  'holidays.dayOf': '{name} (dia {index} de {count})',
  'holidays.withTradition': '{label} ({tradition})',

  // Notes attached to moved or approximate dates ---------------------------------------
  'holidays.note.postponedFromShabbat': 'Adiado por coincidir com o Shabat',
  'holidays.note.advancedFromShabbat': 'Antecipado por coincidir com o Shabat',
  'holidays.note.advancedFromFriday': 'Antecipado por coincidir com a sexta-feira',
  'holidays.note.postponedFromSunday': 'Adiado por coincidir com o domingo',
  'holidays.note.postponedFromMonday': 'Adiado por coincidir com a segunda-feira',
  'holidays.note.movedWithYomHaatzmaut': 'Mudado juntamente com o Dia da Independência',
  'holidays.note.roshChodeshTwoDays': 'Rosh Chodesh de dois dias',
  'holidays.note.ummAlQura':
    'Segundo o calendário Umm al-Qura; a data efetiva depende da observação da lua e pode variar um dia',
  'holidays.note.civilHijri':
    'Segundo o calendário aritmético da Hégira; a data efetiva depende da observação da lua e pode variar um ou dois dias',
  'holidays.note.officialHoliday': 'Feriado oficial',

  // Jewish holidays (key = 'holidays.' + id with dots replaced by dashes) --------------
  'holidays.jewish-rosh-hashana': 'Rosh Hashaná',
  'holidays.jewish-tzom-gedaliah': 'Jejum de Guedalias',
  'holidays.jewish-yom-kippur': 'Yom Kipur',
  'holidays.jewish-sukkot': 'Sucot',
  'holidays.jewish-sukkot.cholHamoed': 'Chol HaMoed de Sucot',
  'holidays.jewish-hoshana-rabba': 'Hoshaná Rabá',
  'holidays.jewish-shemini-atzeret': 'Shemini Atzeret e Simchat Torá',
  'holidays.jewish-sigd': 'Sigd',
  'holidays.jewish-hanukkah': 'Chanucá',
  'holidays.jewish-asara-btevet': 'Dez de Tevet',
  'holidays.jewish-tu-bishvat': 'Tu BiShvat',
  'holidays.jewish-taanit-esther': 'Jejum de Ester',
  'holidays.jewish-purim': 'Purim',
  'holidays.jewish-shushan-purim': 'Shushan Purim',
  'holidays.jewish-pesach': 'Pessach',
  'holidays.jewish-pesach.cholHamoed': 'Chol HaMoed de Pessach',
  'holidays.jewish-pesach.seventh': 'Sétimo dia de Pessach',
  'holidays.jewish-yom-hashoah': 'Dia da Memória do Holocausto',
  'holidays.jewish-yom-haatzmaut': 'Dia da Independência',
  'holidays.jewish-yom-hazikaron': 'Dia da Memória dos Soldados Caídos',
  'holidays.jewish-lag-baomer': 'Lag BaÔmer',
  'holidays.jewish-yom-yerushalayim': 'Dia de Jerusalém',
  'holidays.jewish-shavuot': 'Shavuot',
  'holidays.jewish-tzom-tammuz': 'Dezassete de Tamuz',
  'holidays.jewish-tisha-bav': 'Tisha BeAv',
  'holidays.jewish-tu-bav': 'Tu BeAv',
  'holidays.jewish-rosh-chodesh': 'Rosh Chodesh {month}',

  // Muslim holidays -----------------------------------------------------------------
  'holidays.muslim-hijri-new-year': 'Ano Novo islâmico',
  'holidays.muslim-ashura': 'Ashura',
  'holidays.muslim-mawlid': 'Mawlid an-Nabi (nascimento do Profeta)',
  'holidays.muslim-isra-miraj': 'Isra e Miraj',
  'holidays.muslim-ramadan-start': 'Início do Ramadão',
  'holidays.muslim-laylat-al-qadr': 'Laylat al-Qadr (Noite do Destino)',
  'holidays.muslim-eid-al-fitr': 'Eid al-Fitr',
  'holidays.muslim-arafah': 'Dia de Arafat',
  'holidays.muslim-eid-al-adha': 'Eid al-Adha',

  // Christian holidays ----------------------------------------------------------------
  'holidays.christian-epiphany-western': 'Epifania (ocidental)',
  'holidays.christian-annunciation': 'Anunciação',
  'holidays.christian-assumption': 'Assunção de Nossa Senhora',
  'holidays.christian-all-saints': 'Dia de Todos os Santos',
  'holidays.christian-christmas-western': 'Natal (ocidental)',
  'holidays.christian-ash-wednesday': 'Quarta-feira de Cinzas',
  'holidays.christian-palm-sunday-western': 'Domingo de Ramos (ocidental)',
  'holidays.christian-maundy-thursday': 'Quinta-feira Santa',
  'holidays.christian-good-friday-western': 'Sexta-feira Santa (ocidental)',
  'holidays.christian-easter-western': 'Páscoa (ocidental)',
  'holidays.christian-easter-monday': 'Segunda-feira de Páscoa',
  'holidays.christian-ascension-western': 'Ascensão (ocidental)',
  'holidays.christian-pentecost-western': 'Pentecostes (ocidental)',
  'holidays.christian-christmas-orthodox': 'Natal ortodoxo',
  'holidays.christian-epiphany-orthodox': 'Epifania ortodoxa',
  'holidays.christian-lazarus-saturday': 'Sábado de Lázaro',
  'holidays.christian-palm-sunday-orthodox': 'Domingo de Ramos (ortodoxo)',
  'holidays.christian-good-friday-orthodox': 'Sexta-feira Santa (ortodoxa)',
  'holidays.christian-easter-orthodox': 'Páscoa ortodoxa',
  'holidays.christian-ascension-orthodox': 'Ascensão (ortodoxa)',
  'holidays.christian-pentecost-orthodox': 'Pentecostes (ortodoxo)',

  // Druze holidays --------------------------------------------------------------------
  'holidays.druze-eid-al-adha': 'Eid al-Adha',
  'holidays.druze-nabi-shuayb': 'Ziyarat Nabi Shuayb',
  'holidays.druze-al-khadr': 'Ziyarat al-Khadr',
  'holidays.druze-nabi-sablan': 'Ziyarat Nabi Sablan',
};
export default messages;
