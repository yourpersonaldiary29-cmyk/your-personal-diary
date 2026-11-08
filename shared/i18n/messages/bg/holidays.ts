/** bg - holidays messages. Keys are prefixed 'holidays.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Traditions (legend, settings, screen-reader text) - shared/calendars/types.ts -------
  'holidays.tradition.jewish': 'Еврейски празници и паметни дати',
  'holidays.tradition.muslim': 'Мюсюлмански празници и паметни дати',
  'holidays.tradition.christian': 'Християнски празници и паметни дати',
  'holidays.tradition.druze': 'Друзки празници и паметни дати',
  // Shown in parentheses after a holiday name: "Курбан Байрам (ислям)"
  'holidays.traditionShort.jewish': 'юдаизъм',
  'holidays.traditionShort.muslim': 'ислям',
  'holidays.traditionShort.christian': 'християнство',
  'holidays.traditionShort.druze': 'друзи',

  // Kinds ---------------------------------------------------------------------------
  'holidays.kind.major': 'Празник',
  'holidays.kind.minor': 'Паметна дата',
  'holidays.kind.fast': 'Пост',
  'holidays.kind.memorial': 'Ден за възпоменание',
  'holidays.kind.national': 'Национален празник',

  // Sentences (describeHoliday / describeHolidayAmong) -------------------------------
  'holidays.dayOf': '{name} (ден {index} от {count})',
  'holidays.withTradition': '{label} ({tradition})',

  // Notes attached to moved or approximate dates ---------------------------------------
  'holidays.note.postponedFromShabbat': 'Отложено заради шабат',
  'holidays.note.advancedFromShabbat': 'Изтеглено по-рано заради шабат',
  'holidays.note.advancedFromFriday': 'Изтеглено по-рано заради петък',
  'holidays.note.postponedFromSunday': 'Отложено от неделя',
  'holidays.note.postponedFromMonday': 'Отложено от понеделник',
  'holidays.note.movedWithYomHaatzmaut': 'Преместено заедно с Деня на независимостта',
  'holidays.note.roshChodeshTwoDays': 'Двудневен Рош Ходеш',
  'holidays.note.ummAlQura':
    'Според календара Умм ал-Кура; действителната дата се определя от наблюдението на луната и може да се измести с един ден',
  'holidays.note.civilHijri':
    'Според аритметичния календар хиджра; действителната дата се определя от наблюдението на луната и може да се измести с един или два дни',
  'holidays.note.officialHoliday': 'Официален празник',

  // Jewish holidays (key = 'holidays.' + id with dots replaced by dashes) --------------
  'holidays.jewish-rosh-hashana': 'Рош ха-Шана',
  'holidays.jewish-tzom-gedaliah': 'Пост на Гедалия',
  'holidays.jewish-yom-kippur': 'Йом Кипур',
  'holidays.jewish-sukkot': 'Сукот',
  'holidays.jewish-sukkot.cholHamoed': 'Хол ха-Моед Сукот',
  'holidays.jewish-hoshana-rabba': 'Хошана Раба',
  'holidays.jewish-shemini-atzeret': 'Шмини Ацерет и Симхат Тора',
  'holidays.jewish-sigd': 'Сигд',
  'holidays.jewish-hanukkah': 'Ханука',
  'holidays.jewish-asara-btevet': 'Десети тевет',
  'holidays.jewish-tu-bishvat': 'Ту би-Шват',
  'holidays.jewish-taanit-esther': 'Пост на Естер',
  'holidays.jewish-purim': 'Пурим',
  'holidays.jewish-shushan-purim': 'Шушан Пурим',
  'holidays.jewish-pesach': 'Песах',
  'holidays.jewish-pesach.cholHamoed': 'Хол ха-Моед Песах',
  'holidays.jewish-pesach.seventh': 'Седмият ден на Песах',
  'holidays.jewish-yom-hashoah': 'Ден на паметта на жертвите на Холокоста',
  'holidays.jewish-yom-haatzmaut': 'Ден на независимостта',
  'holidays.jewish-yom-hazikaron': 'Ден на паметта на загиналите',
  'holidays.jewish-lag-baomer': 'Лаг ба-Омер',
  'holidays.jewish-yom-yerushalayim': 'Ден на Йерусалим',
  'holidays.jewish-shavuot': 'Шавуот',
  'holidays.jewish-tzom-tammuz': 'Седемнадесети тамуз',
  'holidays.jewish-tisha-bav': 'Тиша бе-Ав',
  'holidays.jewish-tu-bav': 'Ту бе-Ав',
  'holidays.jewish-rosh-chodesh': 'Рош Ходеш {month}',

  // Muslim holidays -----------------------------------------------------------------
  'holidays.muslim-hijri-new-year': 'Ислямска Нова година',
  'holidays.muslim-ashura': 'Ашура',
  'holidays.muslim-mawlid': 'Мевлид (рождението на Пророка)',
  'holidays.muslim-isra-miraj': 'Исра и Мирадж',
  'holidays.muslim-ramadan-start': 'Начало на Рамазана',
  'holidays.muslim-laylat-al-qadr': 'Нощта на предопределението (Лейлят ал-Кадр)',
  'holidays.muslim-eid-al-fitr': 'Рамазан Байрам (Ид ал-Фитр)',
  'holidays.muslim-arafah': 'Денят Арафат',
  'holidays.muslim-eid-al-adha': 'Курбан Байрам (Ид ал-Адха)',

  // Christian holidays ----------------------------------------------------------------
  'holidays.christian-epiphany-western': 'Богоявление (западно)',
  'holidays.christian-annunciation': 'Благовещение',
  'holidays.christian-assumption': 'Успение Богородично',
  'holidays.christian-all-saints': 'Ден на всички светии',
  'holidays.christian-christmas-western': 'Коледа (западна)',
  'holidays.christian-ash-wednesday': 'Пепелна сряда',
  'holidays.christian-palm-sunday-western': 'Цветница (западна)',
  'holidays.christian-maundy-thursday': 'Велики четвъртък',
  'holidays.christian-good-friday-western': 'Разпети петък (западен)',
  'holidays.christian-easter-western': 'Великден (западен)',
  'holidays.christian-easter-monday': 'Великденски понеделник',
  'holidays.christian-ascension-western': 'Възнесение (западно)',
  'holidays.christian-pentecost-western': 'Петдесетница (западна)',
  'holidays.christian-christmas-orthodox': 'Православна Коледа',
  'holidays.christian-epiphany-orthodox': 'Православно Богоявление (Йордановден)',
  'holidays.christian-lazarus-saturday': 'Лазаровден',
  'holidays.christian-palm-sunday-orthodox': 'Цветница (православна)',
  'holidays.christian-good-friday-orthodox': 'Разпети петък (православен)',
  'holidays.christian-easter-orthodox': 'Православен Великден',
  'holidays.christian-ascension-orthodox': 'Възнесение (православно)',
  'holidays.christian-pentecost-orthodox': 'Петдесетница (православна)',

  // Druze holidays --------------------------------------------------------------------
  'holidays.druze-eid-al-adha': 'Ид ал-Адха',
  'holidays.druze-nabi-shuayb': 'Зиярат Наби Шуайб',
  'holidays.druze-al-khadr': 'Зиярат ал-Хадр',
  'holidays.druze-nabi-sablan': 'Зиярат Наби Сабалан',
};
export default messages;
