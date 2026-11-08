/**
 * tr - searchAnswers messages (server/src/search: parser explanations, period labels,
 * executor answers). Keys are prefixed 'searchAnswers.'; see shared/i18n/index.ts for the syntax.
 *
 * `{metric, select, ...}` branches carry the case ending each sentence needs (ruh haline göre,
 * ruh halinin, ruh haliniz). `{period}` is a lowercase phrase ("son bir ayda"), so sentences
 * never start with it; it goes in the middle or in parentheses. Comparisons avoid suffixes on
 * the number ("5 değerinin altında").
 */
const messages: Record<string, string> = {
  // Period labels (ParsedQuery.periodLabel and the {period} of every sentence) --------
  'searchAnswers.period.all': 'tüm zamanlar',
  'searchAnswers.period.allPhrase': 'günlüğün tamamında',
  'searchAnswers.period.today': 'bugün',
  'searchAnswers.period.yesterday': 'dün',
  'searchAnswers.period.twoDaysAgo': 'evvelsi gün',
  'searchAnswers.period.week': 'son bir haftada',
  'searchAnswers.period.month': 'son bir ayda',
  'searchAnswers.period.halfYear': 'son altı ayda',
  'searchAnswers.period.year': 'son bir yılda',
  'searchAnswers.period.startYear': 'yıl başından bu yana',
  'searchAnswers.period.startMonth': 'ay başından bu yana',
  'searchAnswers.period.recent': 'son günlerde',
  'searchAnswers.period.lastDays': '{count, plural, one {bugün} other {son # günde}}',
  'searchAnswers.period.lastWeeks': '{count, plural, one {son bir haftada} other {son # haftada}}',
  'searchAnswers.period.lastMonths': '{count, plural, one {son bir ayda} other {son # ayda}}',
  'searchAnswers.period.lastYears': '{count, plural, one {son bir yılda} other {son # yılda}}',
  'searchAnswers.period.agoDays': '{count, plural, one {bir gün önce} other {# gün önce}}',
  'searchAnswers.period.agoWeeks': '{count, plural, one {bir hafta önce} other {# hafta önce}}',
  'searchAnswers.period.agoMonths': '{count, plural, one {bir ay önce} other {# ay önce}}',
  'searchAnswers.period.agoYears': '{count, plural, one {bir yıl önce} other {# yıl önce}}',
  'searchAnswers.period.calendarMonth': '{month} {year} ayında',
  'searchAnswers.period.onDate': '{date} tarihinde',
  'searchAnswers.period.between': '{from} ile {to} arasında',

  // Comparators ("less than 5") ------------------------------------------------------
  'searchAnswers.comparator.lt': '{value} değerinin altında',
  'searchAnswers.comparator.lte': 'en fazla {value}',
  'searchAnswers.comparator.gt': '{value} değerinin üzerinde',
  'searchAnswers.comparator.gte': 'en az {value}',
  'searchAnswers.comparator.eq': 'tam olarak {value}',

  // Lists and quoting ----------------------------------------------------------------
  'searchAnswers.quoted': '"{term}"',
  'searchAnswers.listSeparator': ', ',
  'searchAnswers.dayWithValues': '{day} ({values})',
  'searchAnswers.value.mood': 'ruh hali {value}',
  'searchAnswers.value.energy': 'enerji {value}',
  'searchAnswers.value.stress': 'stres {value}',
  'searchAnswers.value.sleepHours': 'uyku süresi {value}',
  'searchAnswers.value.sleepQuality': 'uyku kalitesi {value}',
  'searchAnswers.value.exerciseMinutes': 'egzersiz dakikası {value}',
  'searchAnswers.mention.something': 'bir şey',

  // "How I understood the question" (ParsedQuery.explanation) ------------------------
  'searchAnswers.explain.best': 'Anladığım: kendinizi en iyi hissettiğiniz günler, {period}.',
  'searchAnswers.explain.bestByMetric':
    'Anladığım: {metric, select, mood {ruh haline göre} energy {enerji düzeyine göre} stress {stres düzeyine göre} sleepHours {uyku süresine göre} sleepQuality {uyku kalitesine göre} exerciseMinutes {egzersiz dakikasına göre} other {değere göre}} en iyi günler, {period}.',
  'searchAnswers.explain.worst': 'Anladığım: en zor günler, {period}.',
  'searchAnswers.explain.worstByMetric':
    'Anladığım: {metric, select, mood {ruh haline göre} energy {enerji düzeyine göre} stress {stres düzeyine göre} sleepHours {uyku süresine göre} sleepQuality {uyku kalitesine göre} exerciseMinutes {egzersiz dakikasına göre} other {değere göre}} en zor günler, {period}.',
  'searchAnswers.explain.filter':
    'Anladığım: {metric, select, mood {ruh halinin} energy {enerji düzeyinin} stress {stres düzeyinin} sleepHours {uyku süresinin} sleepQuality {uyku kalitesinin} exerciseMinutes {egzersiz dakikasının} other {değerin}} {comparison} olduğu günler, {period}.',
  'searchAnswers.explain.trend':
    'Anladığım: {metric, select, mood {ruh halinizin} energy {enerji düzeyinizin} stress {stres düzeyinizin} sleepHours {uyku sürenizin} sleepQuality {uyku kalitenizin} exerciseMinutes {egzersiz sürenizin} other {değerlerin}} nasıl değiştiği, {period}.',
  'searchAnswers.explain.mention': 'Anladığım: {terms} yazdığınız kayıtlar, {period}.',
  'searchAnswers.explain.mentionAny': 'Anladığım: yazdığınız kayıtlar, {period}.',
  'searchAnswers.explain.emotion': 'Anladığım: kendinizi {emotions} hissettiğiniz günler, {period}.',
  'searchAnswers.explain.list': 'Anladığım: {terms} içeren kayıtlar, {period}.',
  'searchAnswers.explain.listAll': 'Anladığım: tüm kayıtlar, {period}.',
  'searchAnswers.explain.unknown':
    'Soruyu anlayamadım. Örneğin şöyle sorabilirsiniz: "Son bir ayda hangi günlerde kendimi en iyi hissettim?"',

  // Answers ---------------------------------------------------------------------------
  'searchAnswers.noResults': 'Soruyla eşleşen kayıt bulamadım.',
  'searchAnswers.noResultsPeriod': 'Soruyla eşleşen kayıt bulamadım ({period}).',
  'searchAnswers.rank.best': 'Kendinizi en iyi hissettiğiniz günler ({period}): {days}.',
  'searchAnswers.rank.bestByMetric':
    'En iyi günler, {metric, select, mood {ruh haline göre} energy {enerji düzeyine göre} stress {stres düzeyine göre} sleepHours {uyku süresine göre} sleepQuality {uyku kalitesine göre} exerciseMinutes {egzersiz dakikasına göre} other {değere göre}} ({period}): {days}.',
  'searchAnswers.rank.worst': 'En zor günler ({period}): {days}.',
  'searchAnswers.rank.worstByMetric':
    'En zor günler, {metric, select, mood {ruh haline göre} energy {enerji düzeyine göre} stress {stres düzeyine göre} sleepHours {uyku süresine göre} sleepQuality {uyku kalitesine göre} exerciseMinutes {egzersiz dakikasına göre} other {değere göre}} ({period}): {days}.',
  'searchAnswers.filter.found':
    '{metric, select, mood {Ruh halinin} energy {Enerji düzeyinin} stress {Stres düzeyinin} sleepHours {Uyku süresinin} sleepQuality {Uyku kalitesinin} exerciseMinutes {Egzersiz dakikasının} other {Değerin}} {comparison} olduğu {count, plural, one {# gün} other {# gün}} buldum ({period}): {days}{more, plural, =0 {} one { ve # gün daha} other { ve # gün daha}}.',
  'searchAnswers.emotion.found':
    'Kendinizi {emotions} hissettiğiniz {count, plural, one {# gün} other {# gün}} var ({period}): {days}{more, plural, =0 {} one { ve # gün daha} other { ve # gün daha}}.',
  'searchAnswers.mention.found':
    '{terms} ifadesini {count, plural, one {# kayıtta yazdınız ({period}), {first} tarihinde} other {# kayıtta yazdınız ({period}); ilki {first}, sonuncusu {last} tarihinde}}.',
  'searchAnswers.list.found': '{count, plural, one {# kayıt} other {# kayıt}} buldum ({period}); en yenisi {last} tarihinde.',
  'searchAnswers.list.foundTerms':
    '{terms} içeren {count, plural, one {# kayıt} other {# kayıt}} buldum ({period}); en yenisi {last} tarihinde.',
  'searchAnswers.unknown.fallback':
    'Sorunun ne olduğundan emin olamadım; bu yüzden {total} kayıt içinden {count, plural, one {en yeni kaydı} other {en yeni # kaydı}} gösteriyorum. {explanation}',
  'searchAnswers.trend.insufficient':
    'Bir eğilim saptamak için yeterli veri yok: {metric, select, mood {ruh haliniz} energy {enerji düzeyiniz} stress {stres düzeyiniz} sleepHours {uyku süreniz} sleepQuality {uyku kaliteniz} exerciseMinutes {egzersiz süreniz} other {değerler}}, {period}.',
  'searchAnswers.trend.evidence':
    '(dönemin başındaki {first, plural, one {# gün} other {# gün}} ile sonundaki {last, plural, one {# gün} other {# gün}} karşılaştırıldı)',
  'searchAnswers.trend.stable':
    'Ortalama {metric, select, mood {ruh haliniz} energy {enerji düzeyiniz} stress {stres düzeyiniz} sleepHours {uyku süreniz} sleepQuality {uyku kaliteniz} exerciseMinutes {egzersiz süreniz} other {değer}} {period} sabit kaldı: {from} ve {to} {evidence}.',
  'searchAnswers.trend.up':
    'Ortalama {metric, select, mood {ruh haliniz} energy {enerji düzeyiniz} stress {stres düzeyiniz} sleepHours {uyku süreniz} sleepQuality {uyku kaliteniz} exerciseMinutes {egzersiz süreniz} other {değer}} {period} {from} değerinden {to} değerine yükseldi {evidence}.',
  'searchAnswers.trend.down':
    'Ortalama {metric, select, mood {ruh haliniz} energy {enerji düzeyiniz} stress {stres düzeyiniz} sleepHours {uyku süreniz} sleepQuality {uyku kaliteniz} exerciseMinutes {egzersiz süreniz} other {değer}} {period} {from} değerinden {to} değerine düştü {evidence}.',

  // Request validation (POST /api/search) ----------------------------------------------
  'searchAnswers.validation.body': 'İstek gövdesi bir soru (query) içermelidir',
  'searchAnswers.validation.query': 'Bir soru girin',
  'searchAnswers.validation.queryTooLong': 'Soru çok uzun (en fazla {max} karakter)',
  'searchAnswers.validation.limit': 'Sonuç sayısı 1 ile {max} arasında bir tam sayı olmalıdır',
};
export default messages;
