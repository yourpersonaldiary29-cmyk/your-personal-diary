/** ru - holidays messages. Keys are prefixed 'holidays.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Traditions (legend, settings, screen-reader text) - shared/calendars/types.ts -------
  'holidays.tradition.jewish': 'Еврейские праздники и памятные даты',
  'holidays.tradition.muslim': 'Мусульманские праздники и памятные даты',
  'holidays.tradition.christian': 'Христианские праздники и памятные даты',
  'holidays.tradition.druze': 'Друзские праздники и памятные даты',
  // Shown in parentheses after a holiday name: "Ид аль-Адха (ислам)"
  'holidays.traditionShort.jewish': 'иудаизм',
  'holidays.traditionShort.muslim': 'ислам',
  'holidays.traditionShort.christian': 'христианство',
  'holidays.traditionShort.druze': 'друзы',

  // Kinds ---------------------------------------------------------------------------
  'holidays.kind.major': 'Праздник',
  'holidays.kind.minor': 'Памятная дата',
  'holidays.kind.fast': 'Пост',
  'holidays.kind.memorial': 'День памяти',
  'holidays.kind.national': 'Национальный праздник',

  // Sentences (describeHoliday / describeHolidayAmong) -------------------------------
  'holidays.dayOf': '{name} (день {index} из {count})',
  'holidays.withTradition': '{label} ({tradition})',

  // Notes attached to moved or approximate dates ---------------------------------------
  'holidays.note.postponedFromShabbat': 'Перенесено на более поздний день из-за шаббата',
  'holidays.note.advancedFromShabbat': 'Перенесено на более ранний день из-за шаббата',
  'holidays.note.advancedFromFriday': 'Перенесено на более ранний день из-за пятницы',
  'holidays.note.postponedFromSunday': 'Перенесено с воскресенья на более поздний день',
  'holidays.note.postponedFromMonday': 'Перенесено с понедельника на более поздний день',
  'holidays.note.movedWithYomHaatzmaut': 'Перенесено вместе с Днём независимости',
  'holidays.note.roshChodeshTwoDays': 'Двухдневный Рош Ходеш',
  'holidays.note.ummAlQura':
    'По календарю Умм аль-Кура; фактическая дата определяется по наблюдению луны и может сдвинуться на один день',
  'holidays.note.civilHijri':
    'По арифметическому календарю хиджры; фактическая дата определяется по наблюдению луны и может сдвинуться на один-два дня',
  'holidays.note.officialHoliday': 'Официальный праздник',

  // Jewish holidays (key = 'holidays.' + id with dots replaced by dashes) --------------
  'holidays.jewish-rosh-hashana': 'Рош ха-Шана',
  'holidays.jewish-tzom-gedaliah': 'Пост Гедальи',
  'holidays.jewish-yom-kippur': 'Йом Кипур',
  'holidays.jewish-sukkot': 'Суккот',
  'holidays.jewish-sukkot.cholHamoed': 'Холь ха-Моэд Суккот',
  'holidays.jewish-hoshana-rabba': 'Хошана Раба',
  'holidays.jewish-shemini-atzeret': 'Шмини Ацерет и Симхат Тора',
  'holidays.jewish-sigd': 'Сигд',
  'holidays.jewish-hanukkah': 'Ханука',
  'holidays.jewish-asara-btevet': 'Десятое тевета',
  'holidays.jewish-tu-bishvat': 'Ту би-Шват',
  'holidays.jewish-taanit-esther': 'Пост Эстер',
  'holidays.jewish-purim': 'Пурим',
  'holidays.jewish-shushan-purim': 'Шушан Пурим',
  'holidays.jewish-pesach': 'Песах',
  'holidays.jewish-pesach.cholHamoed': 'Холь ха-Моэд Песах',
  'holidays.jewish-pesach.seventh': 'Седьмой день Песаха',
  'holidays.jewish-yom-hashoah': 'День памяти жертв Катастрофы',
  'holidays.jewish-yom-haatzmaut': 'День независимости',
  'holidays.jewish-yom-hazikaron': 'День памяти павших',
  'holidays.jewish-lag-baomer': 'Лаг ба-Омер',
  'holidays.jewish-yom-yerushalayim': 'День Иерусалима',
  'holidays.jewish-shavuot': 'Шавуот',
  'holidays.jewish-tzom-tammuz': 'Семнадцатое таммуза',
  'holidays.jewish-tisha-bav': 'Девятое ава',
  'holidays.jewish-tu-bav': 'Ту бе-Ав',
  'holidays.jewish-rosh-chodesh': 'Рош Ходеш {month}',

  // Muslim holidays -----------------------------------------------------------------
  'holidays.muslim-hijri-new-year': 'Исламский Новый год',
  'holidays.muslim-ashura': 'Ашура',
  'holidays.muslim-mawlid': 'Мавлид ан-Наби',
  'holidays.muslim-isra-miraj': 'Исра и Мирадж',
  'holidays.muslim-ramadan-start': 'Начало Рамадана',
  'holidays.muslim-laylat-al-qadr': 'Ночь предопределения (Ляйлят аль-Кадр)',
  'holidays.muslim-eid-al-fitr': 'Ураза-байрам (Ид аль-Фитр)',
  'holidays.muslim-arafah': 'День Арафа',
  'holidays.muslim-eid-al-adha': 'Курбан-байрам (Ид аль-Адха)',

  // Christian holidays ----------------------------------------------------------------
  'holidays.christian-epiphany-western': 'Богоявление (западное)',
  'holidays.christian-annunciation': 'Благовещение',
  'holidays.christian-assumption': 'Успение Богородицы',
  'holidays.christian-all-saints': 'День всех святых',
  'holidays.christian-christmas-western': 'Рождество (западное)',
  'holidays.christian-ash-wednesday': 'Пепельная среда',
  'holidays.christian-palm-sunday-western': 'Вербное воскресенье (западное)',
  'holidays.christian-maundy-thursday': 'Великий четверг',
  'holidays.christian-good-friday-western': 'Страстная пятница (западная)',
  'holidays.christian-easter-western': 'Пасха (западная)',
  'holidays.christian-easter-monday': 'Пасхальный понедельник',
  'holidays.christian-ascension-western': 'Вознесение (западное)',
  'holidays.christian-pentecost-western': 'Пятидесятница (западная)',
  'holidays.christian-christmas-orthodox': 'Рождество (православное)',
  'holidays.christian-epiphany-orthodox': 'Крещение (православное)',
  'holidays.christian-lazarus-saturday': 'Лазарева суббота',
  'holidays.christian-palm-sunday-orthodox': 'Вербное воскресенье (православное)',
  'holidays.christian-good-friday-orthodox': 'Страстная пятница (православная)',
  'holidays.christian-easter-orthodox': 'Пасха (православная)',
  'holidays.christian-ascension-orthodox': 'Вознесение (православное)',
  'holidays.christian-pentecost-orthodox': 'Троица (православная)',

  // Druze holidays --------------------------------------------------------------------
  'holidays.druze-eid-al-adha': 'Ид аль-Адха',
  'holidays.druze-nabi-shuayb': 'Зиярат Наби Шуайб',
  'holidays.druze-al-khadr': 'Зиярат аль-Хадр',
  'holidays.druze-nabi-sablan': 'Зиярат Наби Сабалан',
};
export default messages;
