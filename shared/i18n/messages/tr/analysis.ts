/**
 * tr - analysis messages (server-side insight templates, notes and labels).
 * Keys are prefixed 'analysis.'; see shared/i18n/index.ts for the template syntax.
 *
 * Conventions shared with the English reference (shared/i18n/messages/en/analysis.ts):
 *  - Every sentence is hedged ("Verilerinize göre … görünüyor", "olası bir ilişki") and never
 *    causal: no "neden olur", "yol açar", "yüzünden".
 *  - Turkish has no grammatical gender: every metric is 'n' and the `gender` selects keep a
 *    single `other` branch. 'analysis.metric.<metric>.defined' carries the possessive
 *    ("ruh haliniz", "uyku süreniz") because Turkish marks "your" with a suffix.
 *  - No case suffix is ever glued to a {placeholder} (vowel harmony is unknown); sentences
 *    use postpositions and "değerinden … değerine", "{cur} ayında", "şunu inceledim: {what}".
 *  - Branch bodies are never one bare ASCII word (see the English header).
 */
const messages: Record<string, string> = {
  // Engine / provider -----------------------------------------------------------------
  'analysis.engine.providerFailed': 'Örüntü analizi tamamlanamadı (dahili hata). Lütfen daha sonra tekrar deneyin.',
  'analysis.engine.detectorFailed': '"{label}" kontrolü tamamlanamadı (dahili hata); diğer içgörüler sorunsuz.',

  // Strength --------------------------------------------------------------------------
  'analysis.strength.weak': 'zayıf',
  'analysis.strength.moderate': 'orta',
  'analysis.strength.strong': 'güçlü',

  // Metrics: label (short, standalone), defined (subject inside a sentence), gender -----
  'analysis.metric.mood.label': 'ruh hali',
  'analysis.metric.mood.defined': 'ruh haliniz',
  'analysis.metric.mood.gender': 'n',
  'analysis.metric.energy.label': 'enerji düzeyi',
  'analysis.metric.energy.defined': 'enerji düzeyiniz',
  'analysis.metric.energy.gender': 'n',
  'analysis.metric.stress.label': 'stres düzeyi',
  'analysis.metric.stress.defined': 'stres düzeyiniz',
  'analysis.metric.stress.gender': 'n',
  'analysis.metric.sleepHours.label': 'uyku süresi',
  'analysis.metric.sleepHours.defined': 'uyku süreniz',
  'analysis.metric.sleepHours.gender': 'n',
  'analysis.metric.sleepQuality.label': 'uyku kalitesi',
  'analysis.metric.sleepQuality.defined': 'uyku kaliteniz',
  'analysis.metric.sleepQuality.gender': 'n',
  'analysis.metric.exerciseMinutes.label': 'egzersiz dakikası',
  'analysis.metric.exerciseMinutes.defined': 'egzersiz süreniz',
  'analysis.metric.exerciseMinutes.gender': 'n',
  'analysis.metric.entries.label': 'günlük kayıtları',
  'analysis.metric.entries.defined': 'kayıt sayınız',
  'analysis.metric.entries.gender': 'n',

  // Counts and dates ------------------------------------------------------------------
  'analysis.count.days': '{count, plural, one {# gün} other {# gün}}',
  'analysis.count.weeks': '{count, plural, one {# hafta} other {# hafta}}',
  'analysis.date.dayWithDate': '{weekday}, {date}',

  // Weekdays (index 0 = Sunday) --------------------------------------------------------
  'analysis.weekday.plural.0': 'Pazar günleri',
  'analysis.weekday.plural.1': 'Pazartesi günleri',
  'analysis.weekday.plural.2': 'Salı günleri',
  'analysis.weekday.plural.3': 'Çarşamba günleri',
  'analysis.weekday.plural.4': 'Perşembe günleri',
  'analysis.weekday.plural.5': 'Cuma günleri',
  'analysis.weekday.plural.6': 'Cumartesi günleri',
  'analysis.weekday.on.0': 'Pazar günleri',
  'analysis.weekday.on.1': 'Pazartesi günleri',
  'analysis.weekday.on.2': 'Salı günleri',
  'analysis.weekday.on.3': 'Çarşamba günleri',
  'analysis.weekday.on.4': 'Perşembe günleri',
  'analysis.weekday.on.5': 'Cuma günleri',
  'analysis.weekday.on.6': 'Cumartesi günleri',

  // Notes shared by the detectors -------------------------------------------------------
  'analysis.note.insufficient': 'Şunu kontrol etmek için yeterli veri yok: {what} (en az {required} gerekli; mevcut: {have}).',
  'analysis.note.insufficientWhether': 'Şunu kontrol etmek için yeterli veri yok: {what} (en az {required} gerekli; mevcut: {have}).',
  'analysis.note.nothingNotable':
    '{count, plural, one {# gün} other {# gün}} boyunca şunu inceledim: {what}. Belirgin bir fark bulamadım.',

  // Requirement / availability phrases used inside the notes above ----------------------
  'analysis.req.daysBothValues': '{count, plural, one {iki değerin de girildiği # gün} other {iki değerin de girildiği # gün}}',
  'analysis.req.daysPerGroup': '{count, plural, one {her grupta # gün} other {her grupta # gün}}',
  'analysis.req.daysWithReport': '{count, plural, one {değer girilen # gün} other {değer girilen # gün}}',
  'analysis.req.daysWithRatings': '{count, plural, one {puan girilen # gün} other {puan girilen # gün}}',
  'analysis.req.daysPerMonth': '{count, plural, one {her ay değer girilen # gün} other {her ay değer girilen # gün}}',
  'analysis.req.recentDays': '{count, plural, one {son iki haftada değer girilen # gün} other {son iki haftada değer girilen # gün}}',
  'analysis.req.fullWeeks': '{count, plural, one {değer girilen # tam hafta} other {değer girilen # tam hafta}}',
  'analysis.req.weeksOfLogs': '{count, plural, one {# haftalık kayıt} other {# haftalık kayıt}}',
  'analysis.req.weekPerGroup': 'her grupta bir hafta ve her grupta değer girilen {count, plural, one {# gün} other {# gün}}',
  'analysis.req.moodReports': '{count, plural, one {# ruh hali girişi} other {# ruh hali girişi}}',
  'analysis.req.reportsInWindow': '{count, plural, one {tek bir saat aralığında # giriş} other {tek bir saat aralığında # giriş}}',
  'analysis.req.emotionRepeated': '{count, plural, one {# günde bildirilmiş bir duygu} other {# günde bildirilmiş bir duygu}}',
  'analysis.have.twoGroups':
    '{groupA}: {countA, plural, one {# gün} other {# gün}}; {groupB}: {countB, plural, one {# gün} other {# gün}}',
  'analysis.have.weeksTwoGroups':
    'hedefe ulaşılan haftalar: {metWeeks, plural, one {# hafta} other {# hafta}} ({metDays, plural, one {# gün} other {# gün}}); hedefin altında kalan haftalar: {belowWeeks, plural, one {# hafta} other {# hafta}} ({belowDays, plural, one {# gün} other {# gün}})',
  'analysis.have.twoMonths': '{cur}: {countA, plural, one {# gün} other {# gün}}, {prev}: {countB, plural, one {# gün} other {# gün}}',
  'analysis.have.noData': 'veri yok',
  'analysis.have.noSuchEmotion': 'henüz yok',
  'analysis.have.fewerInEveryWindow': 'her aralıkta bundan az',

  // Sentences shared by the group-comparison detectors ----------------------------------
  'analysis.relation.text':
    'Verilerinize göre, {condition} {metricDefined} {gender, select, other {ortalamada {direction, select, higher {daha yüksek görünüyor} other {daha düşük görünüyor}}}} (bu günlerde {meanA}; diğerlerinde {meanB}).',
  'analysis.correlation.text':
    'Verilerinizde {x} ile {y} arasında olası bir ilişki var gibi görünüyor: {xGender, select, other {{x} daha yüksek olduğunda}} {yGender, select, other {{y} {direction, select, higher {daha yüksek olma eğilimindeydi} other {daha düşük olma eğilimindeydi}}}} (korelasyon {r}).',
  'analysis.explain.checkedDays': '{count, plural, one {# günü inceledim.} other {# günü inceledim.}}',
  'analysis.explain.onDaysCondition': '{count, plural, one {# gün} other {# gün}} {conditionPast}.',
  'analysis.explain.groupMeans':
    'Bu günlerde ortalama {metricDefined} {gender, select, other {{meanA} idi}}; diğer günlerde ise {meanB}.',
  'analysis.explain.correlation': 'Korelasyon: {r}.',
  'analysis.explain.correlationBetween': 'Korelasyon ({predictor} - {outcome}): {r}.',
  'analysis.explain.diffAndStrength': 'Ortalamalar arasındaki fark: {diff} puan. Örüntü gücü: {strength}.',
  'analysis.explain.diffStrength': 'Fark: {diff} puan. Örüntü gücü: {strength}.',
  'analysis.split.corrExplainChecked':
    '{x} ve {y} değerlerinin ikisinin de girildiği {count, plural, one {# günü} other {# günü}} inceledim.',
  'analysis.split.corrExplainPearson': 'Pearson korelasyonu: {r} (güç: {strength}).',
  'analysis.split.corrExplainGroups':
    'Ortalamaları karşılaştırmak için her grupta yeterli gün yoktu ({groupA}: {countA, plural, one {# gün} other {# gün}}; {groupB}: {countB, plural, one {# gün} other {# gün}}; her grupta en az {min} gerekir).',

  // Evidence table keys ---------------------------------------------------------------
  'analysis.extra.predictor': 'Yordayıcı',
  'analysis.extra.strength': 'Güç',
  'analysis.extra.meanDiff': 'Ortalama farkı (A eksi B)',
  'analysis.extra.cohenD': 'Etki büyüklüğü (Cohen d)',
  'analysis.extra.weeksChecked': 'İncelenen haftalar',
  'analysis.extra.weeklyTarget': 'Haftalık hedef',
  'analysis.extra.target': 'Hedef',
  'analysis.extra.frequency': 'Sıklık',
  'analysis.extra.periodMean': 'Dönem ortalaması',
  'analysis.extra.overallMean': 'Genel ortalama',
  'analysis.extra.stddev': 'Standart sapma',
  'analysis.extra.slopePerDay': 'Günlük eğim',
  'analysis.extra.daysInWindow': 'Aralıktaki günler',
  'analysis.extra.movingWindow': 'Hareketli ortalama aralığı',
  'analysis.extra.relativeChange': 'Göreli değişim',
  'analysis.extra.longestStreak': 'Dönemdeki en uzun seri',
  'analysis.extra.shareOfEmotionDays': 'Duygunun görüldüğü günlerdeki payı',
  'analysis.frequency.daily': 'günlük',
  'analysis.frequency.weekly': 'haftalık',
  'analysis.groupB.otherDays': 'Diğer günler',

  // Sleep detectors -------------------------------------------------------------------
  'analysis.sleep.groupA': '{hours} saatten az uyunan günler',
  'analysis.sleep.groupB': '{hours} saat veya daha fazla uyunan günler',
  'analysis.sleep.condition': '{hours} saatten az uyuduğunuz günlerde',
  'analysis.sleep.conditionPast': '{hours} saatten az uyudunuz',
  'analysis.sleepMood.label': 'uyku ile ruh hali arasındaki ilişki',
  'analysis.sleepMood.title': '{direction, select, lower {Kısa uyku ve daha düşük ruh hali} other {Kısa uyku ve daha yüksek ruh hali}}',
  'analysis.sleepMood.corrTitle': 'Uyku süresi ile ruh hali arasında olası ilişki',
  'analysis.sleepEnergy.label': 'uyku ile enerji düzeyi arasındaki ilişki',
  'analysis.sleepEnergy.title': '{direction, select, lower {Kısa uyku ve daha düşük enerji} other {Kısa uyku ve daha yüksek enerji}}',
  'analysis.sleepEnergy.corrTitle': 'Uyku süresi ile enerji düzeyi arasında olası ilişki',

  // Exercise detectors ----------------------------------------------------------------
  'analysis.exercise.groupA': 'Fiziksel aktivite olan günler',
  'analysis.exercise.groupB': 'Fiziksel aktivite olmayan günler',
  'analysis.exercise.condition': 'egzersiz yaptığınız günlerde',
  'analysis.exercise.conditionPast': 'egzersiz yaptınız',
  'analysis.exerciseMood.label': 'fiziksel aktivite ile ruh hali arasındaki ilişki',
  'analysis.exerciseMood.title':
    '{direction, select, higher {Fiziksel aktivite ve daha yüksek ruh hali} other {Fiziksel aktivite ve daha düşük ruh hali}}',
  'analysis.exerciseMood.corrTitle': 'Egzersiz dakikası ile ruh hali arasında olası ilişki',
  'analysis.exerciseEnergy.label': 'fiziksel aktivite ile enerji düzeyi arasındaki ilişki',
  'analysis.exerciseEnergy.title':
    '{direction, select, higher {Fiziksel aktivite ve daha yüksek enerji} other {Fiziksel aktivite ve daha düşük enerji}}',
  'analysis.exerciseEnergy.corrTitle': 'Egzersiz dakikası ile enerji düzeyi arasında olası ilişki',

  // Habit - mood / energy / stress ------------------------------------------------------
  'analysis.habit.detectorLabel': 'alışkanlıklar ile ruh hali arasındaki ilişki',
  'analysis.habit.noHabits': 'Etkin alışkanlık olmadığı için alışkanlıklar ile ruh hali arasında bir ilişki olup olmadığını kontrol etmedim.',
  'analysis.habit.noLogs': '"{habit}" alışkanlığının bu dönemde henüz kaydı olmadığı için ruh haliyle bir ilişkisi olup olmadığını kontrol etmedim.',
  'analysis.habit.noFullWeeks':
    '"{habit}" alışkanlığının henüz kayıtlı tam bir haftası olmadığı için ruh haliyle bir ilişkisi olup olmadığını kontrol etmedim.',
  'analysis.habit.label': '"{habit}" alışkanlığı ile {metric} arasındaki ilişki',
  'analysis.habit.groupA': '"{habit}" alışkanlığının tamamlandığı günler',
  'analysis.habit.groupB': '"{habit}" alışkanlığının tamamlanmadığı günler',
  'analysis.habit.condition': '"{habit}" alışkanlığını tamamladığınız günlerde',
  'analysis.habit.conditionPast': '"{habit}" alışkanlığını tamamladınız',
  'analysis.habit.title':
    '"{habit}" alışkanlığı ve {gender, select, other {{direction, select, higher {daha yüksek {metric}} other {daha düşük {metric}}}}}',
  'analysis.habit.corrTitle': '"{habit}" alışkanlığı ile {metric} arasında olası ilişki',
  'analysis.habit.weeklyCondition': '"{habit}" alışkanlığının hedefine ulaştığınız haftalarda',
  'analysis.habit.weeklyTarget': 'haftada {target} {unit}',
  'analysis.habit.targetValue': '{target} {unit}',
  'analysis.habit.weeklyExplainChecked':
    '{weeks, plural, one {# tam haftayı} other {# tam haftayı}} inceledim ({metric} değeri girilen {days, plural, one {# gün} other {# gün}}).',
  'analysis.habit.weeklyExplainMet': '{count, plural, one {# haftada} other {# haftada}} alışkanlığın hedefine ({target}) ulaştınız.',
  'analysis.habit.weeklyExplainMeans':
    'Bu haftaların günlerinde ortalama {metricDefined} {gender, select, other {{meanA} idi}}; hedefin altında kalan {count, plural, one {# haftanın} other {# haftanın}} günlerinde ise {meanB}.',
  'analysis.habit.groupAWeeks': 'Hedefe ulaşılan haftalardaki günler ({count, plural, one {# hafta} other {# hafta}})',
  'analysis.habit.groupBWeeks': 'Hedefin altında kalan haftalardaki günler ({count, plural, one {# hafta} other {# hafta}})',

  // Weekday differences -----------------------------------------------------------------
  'analysis.weekday.label': 'haftanın günleri arasındaki farklar',
  'analysis.weekday.text':
    'Verilerinize göre {onWeekday} {metricDefined} {gender, select, other {haftanın diğer günlerine kıyasla ortalamada {direction, select, higher {daha yüksek görünüyor} other {daha düşük görünüyor}}}} (bu günlerde {meanA}; diğerlerinde {meanB}).',
  'analysis.weekday.explainChecked':
    '{metric} değeri girilen {count, plural, one {# günü} other {# günü}} inceledim; {weekdays}: {countA}.',
  'analysis.weekday.explainMeans':
    '{onWeekday} ortalama {metricDefined} {gender, select, other {{meanA} idi}}; diğer günlerde ise {meanB}.',
  'analysis.weekday.title':
    '{weekdays}: {gender, select, other {{direction, select, higher {daha yüksek {metric}} other {daha düşük {metric}}}}}',
  'analysis.weekday.groupB': 'Haftanın diğer günleri',
  'analysis.weekday.tableValue': '{mean} ({count, plural, one {# gün} other {# gün}})',
  'analysis.weekday.nothing':
    'Haftanın günleri arasındaki farkları {count, plural, one {# gün} other {# gün}} boyunca inceledim ve belirgin bir fark bulamadım.',

  // Time of day -------------------------------------------------------------------------
  'analysis.timeOfDay.label': 'yazma saati ile ruh hali arasındaki ilişki',
  'analysis.timeOfDay.morning.label': 'Sabah',
  'analysis.timeOfDay.morning.phrase': 'sabahları',
  'analysis.timeOfDay.late_morning.label': 'Öğleden önce',
  'analysis.timeOfDay.late_morning.phrase': 'öğleden önce',
  'analysis.timeOfDay.afternoon.label': 'Öğleden sonra',
  'analysis.timeOfDay.afternoon.phrase': 'öğleden sonra',
  'analysis.timeOfDay.evening.label': 'Akşam',
  'analysis.timeOfDay.evening.phrase': 'akşamları',
  'analysis.timeOfDay.night.label': 'Gece',
  'analysis.timeOfDay.night.phrase': 'geceleri',
  'analysis.timeOfDay.tableKey': '{label} ({hours})',
  'analysis.timeOfDay.tableValue': 'ortalama {mean}, {count, plural, one {# giriş} other {# giriş}}',
  'analysis.timeOfDay.tableRow': '{key}: {value}',
  'analysis.timeOfDay.nothing':
    '{count, plural, one {# giriş} other {# giriş}} üzerinden şunu inceledim: {label}. Ortalamanın üzerinde öne çıkan bir zaman aralığı bulamadım.',
  'analysis.timeOfDay.text':
    'Verilerinize göre {phrase} ({hours}) bildirdiğiniz ruh hali en yüksek görünüyor: ortalama {mean}; tüm girişlerde ise {overall}.',
  'analysis.timeOfDay.explainChecked':
    '{days, plural, one {# gündeki} other {# gündeki}} {count, plural, one {# ruh hali girişini} other {# ruh hali girişini}}, kaydın yazıldığı saate göre inceledim.',
  'analysis.timeOfDay.explainTable': '{table}. Genel ortalama: {overall}.',
  'analysis.timeOfDay.explainDiff': 'En yüksek zaman aralığı ile genel ortalama arasındaki fark: {diff} puan. Örüntü gücü: {strength}.',
  'analysis.timeOfDay.title': 'Daha yüksek ruh hali: {phrase}',
  'analysis.timeOfDay.groupA': 'Girişler: {phrase} ({hours})',
  'analysis.timeOfDay.groupB': 'Diğer girişler',

  // Trends ------------------------------------------------------------------------------
  'analysis.trends.label': 'ruh hali, stres ve uykudaki eğilimler',
  'analysis.trends.text':
    'Verilerinize göre {metricDefined} {horizon, select, period {dönem boyunca} monthly {son bir ayda} other {son iki haftada}} {gender, select, other {{direction, select, up {yükseliş eğiliminde görünüyor} other {düşüş eğiliminde görünüyor}}}}: hareketli ortalamanın eğilim çizgisi {fromValue} değerinden {toValue} değerine {direction, select, up {yükseldi.} other {düştü.}}',
  'analysis.trends.explainChecked':
    '{horizon, select, period {Dönemdeki {len} günün} other {Son {len} günün}} {metric} değeri girilen {count, plural, one {# gününü} other {# gününü}} inceledim ({from}-{to}).',
  'analysis.trends.explainFit':
    '{window} günlük hareketli ortalamayı ve bunun üzerinden bir eğilim çizgisi (doğrusal regresyon) hesapladım: günde {unit, select, hours {{slope} saat} other {{slope} puan}} {direction, select, up {yükselen bir eğim} other {düşen bir eğim}}; yani aralık boyunca yaklaşık {unit, select, hours {{change} saat} other {{change} puan}} değişim (eğilim çizgisinde {fromValue} değerinden {toValue} değerine). Eğilim gücü: {strength}.',
  'analysis.trends.title':
    '{horizon, select, period {Dönem boyunca} monthly {Son bir ayda} other {Son iki haftada}} {metric, select, mood {ruh halinizde} energy {enerji düzeyinizde} stress {stres düzeyinizde} sleepHours {uyku sürenizde} sleepQuality {uyku kalitenizde} exerciseMinutes {egzersiz sürenizde} other {kayıt sayısında}} {direction, select, up {yükseliş eğilimi} other {düşüş eğilimi}}',
  'analysis.trends.groupA': 'Aralığın başı (eğilim çizgisi)',
  'analysis.trends.groupB': 'Aralığın sonu (eğilim çizgisi)',
  'analysis.trends.slopeValue': '{unit, select, hours {{slope} saat} other {{slope} puan}}',
  'analysis.trends.nothingSince': '{from} tarihinden bu yana ruh hali, stres ve uykudaki eğilimleri inceledim ve belirgin bir eğilim bulamadım.',
  'analysis.trends.nothingAll': 'Tüm dönem boyunca ruh hali, stres ve uykudaki eğilimleri inceledim ve belirgin bir eğilim bulamadım.',

  // Month comparison --------------------------------------------------------------------
  'analysis.periodCompare.label': 'bu ay ile geçen ayın karşılaştırması',
  'analysis.periodCompare.text':
    'Verilerinize göre {cur} ayında {metricDefined} {gender, select, other {{prev} ayına kıyasla ortalamada {direction, select, higher {daha yüksek görünüyor} other {daha düşük görünüyor}}}} ({cur}: {meanA}, {prev}: {meanB}).',
  'analysis.periodCompare.explain':
    '{cur} ayında {metric} değeri girilen günleri ({countA, plural, one {# gün} other {# gün}}, bugüne kadar) {prev} ayındaki günlerle ({countB, plural, one {# gün} other {# gün}}) karşılaştırdım. {cur} ortalaması: {meanA}; {prev} ortalaması: {meanB}. Fark: {unit, select, hours {{diff} saat} other {{diff} puan}}. Farkın gücü: {strength}.',
  'analysis.periodCompare.title':
    '{cur}: {prev} ayına kıyasla {gender, select, other {{direction, select, higher {daha yüksek {metric}} other {daha düşük {metric}}}}}',
  'analysis.periodCompare.entriesText':
    'Görünüşe göre {cur} ayının ilk {window} gününde ({countA, plural, one {# kayıt} other {# kayıt}}), {prev} ayının ilk {window} gününe ({countB, plural, one {# kayıt} other {# kayıt}}) kıyasla {direction, select, more {daha fazla yazdınız} other {daha az yazdınız}}.',
  'analysis.periodCompare.entriesExplain':
    'Eşit zaman aralıklarını karşılaştırmak için her ayın ilk {window} günündeki kayıtları saydım: {cur} - {countA, plural, one {# kayıt} other {# kayıt}}, {prev} - {countB, plural, one {# kayıt} other {# kayıt}}. Fark: {diff, plural, one {# kayıt} other {# kayıt}} ({percent}). Farkın gücü: {strength}.',
  'analysis.periodCompare.entriesTitle':
    '{cur} ayında {prev} ayına kıyasla {direction, select, more {daha fazla kayıt} other {daha az kayıt}}',
  'analysis.periodCompare.monthWindow': '{month} (ilk {window} gün)',
  'analysis.periodCompare.insufficientWhat': '{cur} ile {prev} karşılaştırması',
  'analysis.periodCompare.nothing':
    '{cur} ayını {prev} ayıyla karşılaştırdım ve ruh hali, stres, uyku veya kayıt sayısında belirgin bir fark bulamadım.',

  // Habit trend (improved / declined) -----------------------------------------------------
  'analysis.habitsTrend.label': 'gelişen veya gerileyen alışkanlıklar',
  'analysis.habitsTrend.whether': '"{habit}" alışkanlığının gelişip gelişmediği',
  'analysis.habitsTrend.textDaily':
    'Görünüşe göre "{habit}" alışkanlığında {direction, select, improved {bir gelişme var} other {bir gerileme var}}: son iki haftada {window} günün {recent} gününde tamamladınız; önceki iki haftada ise {window} günün {previous} gününde.',
  'analysis.habitsTrend.textWeekly':
    'Görünüşe göre "{habit}" alışkanlığında {direction, select, improved {bir gelişme var} other {bir gerileme var}}: son iki haftada {recent} {unit} kaydettiniz; önceki iki haftada ise {previous} (hedef: haftada {target} {unit}).',
  'analysis.habitsTrend.explain':
    'Alışkanlığın son iki haftadaki ({recentFrom}-{recentTo}) tamamlanma oranını önceki iki haftayla ({previousFrom}-{previousTo}) karşılaştırdım: {recentRate} ve {previousRate}. Fark: {diff} yüzde puan. Değişimin gücü: {strength}.',
  'analysis.habitsTrend.title':
    '"{habit}" alışkanlığı son iki haftada {direction, select, improved {gelişme gösterdi} other {gerileme gösterdi}}',
  'analysis.habitsTrend.metric': 'Tamamlanma oranı - {habit}',
  'analysis.habitsTrend.groupA': 'Son iki hafta',
  'analysis.habitsTrend.groupB': 'Önceki iki hafta',

  // Best / hardest days ------------------------------------------------------------------
  'analysis.bestWorst.label': 'en iyi ve en zor günler',
  'analysis.bestWorst.describedDay': '{day} ("{title}")',
  'analysis.bestWorst.noTitle': 'Başlıksız',
  'analysis.bestWorst.extraValue': '{titles} - puan {score}',
  'analysis.bestWorst.text':
    'Ruh hali, enerji ve stresten oluşan birleşik puana göre dönemin {kind, select, best {en iyi günleri} other {en zor günleri}}: {days}.',
  'analysis.bestWorst.explainScore':
    '{count, plural, one {# günün} other {# günün}} her biri için birleşik bir puan hesapladım: o gün girilen değerlerden ruh hali, enerji düzeyi ve (11 eksi stres düzeyi) ortalaması.',
  'analysis.bestWorst.explainMeans':
    'Dönemdeki ortalama puan: {overall}. {kind, select, best {{count, plural, one {En iyi günün puanı} =3 {En iyi üç günün puanı} other {En iyi günlerin puanı}}} other {{count, plural, one {En zor günün puanı} =3 {En zor üç günün puanı} other {En zor günlerin puanı}}}} ortalama {mean}.',
  'analysis.bestWorst.explainDiff': 'Ortalamadan fark: {diff} puan. Farkın gücü: {strength}.',
  'analysis.bestWorst.title': '{kind, select, best {Dönemin en iyi günleri} other {Dönemin en zor günleri}}',
  'analysis.bestWorst.metric': 'Birleşik puan (ruh hali + enerji + ters çevrilmiş stres)',
  'analysis.bestWorst.groupA': '{kind, select, best {En iyi günler} other {En zor günler}}',
  'analysis.bestWorst.nothing':
    '{count, plural, one {# gün} other {# gün}} boyunca şunu inceledim: {label}. Puanlar birbirine yakındı ve hiçbir gün öne çıkmadı.',

  // Streaks -------------------------------------------------------------------------------
  'analysis.streaks.label': 'yazma ve alışkanlık serileri',
  'analysis.streaks.entriesTitle': '{count, plural, one {# günlük} other {# günlük}} yazma serisi',
  'analysis.streaks.entriesText': 'Tebrikler! Günlüğünüze art arda {count, plural, one {# gün} other {# gün}} yazdınız ({from}-{to}).',
  'analysis.streaks.entriesExplain':
    'Bugüne veya düne kadar en az bir kayıt olan ardışık günleri saydım. Mevcut seri: {count, plural, one {# gün} other {# gün}}, {from} - {to}. Dönemdeki en uzun seri: {best, plural, one {# gün} other {# gün}}.',
  'analysis.streaks.entriesMetric': 'Yazılan günler',
  'analysis.streaks.currentDays': 'Mevcut serideki günler',
  'analysis.streaks.daysWithEntry': 'Dönemde kayıt olan günler',
  'analysis.streaks.habitTitle': '"{habit}" alışkanlığı için {count, plural, one {# günlük} other {# günlük}} seri',
  'analysis.streaks.habitText': '"{habit}" alışkanlığını art arda {count, plural, one {# gün} other {# gün}} tamamladınız ({from}-{to}).',
  'analysis.streaks.habitExplain':
    '"{habit}" alışkanlığının tamamlandı olarak işaretlendiği ardışık günleri bugüne veya düne kadar saydım. Mevcut seri: {count, plural, one {# gün} other {# gün}}. Dönemdeki en uzun seri: {best, plural, one {# gün} other {# gün}}.',
  'analysis.streaks.habitMetric': '"{habit}" alışkanlığının tamamlanması',
  'analysis.streaks.daysCompleted': 'Dönemde alışkanlığın tamamlandığı günler',
  'analysis.streaks.weeklyTitle': '"{habit}" alışkanlığı için {count, plural, one {# haftalık} other {# haftalık}} seri',
  'analysis.streaks.weeklyText':
    '"{habit}" alışkanlığının hedefine art arda {count, plural, one {# hafta} other {# hafta}} ulaştınız ({from}-{to}).',
  'analysis.streaks.weeklyExplain':
    '"{habit}" alışkanlığı için her hafta kaydedilen miktarı topladım ve haftalık hedefle ({target}) karşılaştırdım. Hedefe ulaşılan haftalardan oluşan mevcut seri: {count, plural, one {# hafta} other {# hafta}}.',
  'analysis.streaks.weeklyMetric': 'Haftalık hedefe ulaşma - {habit}',
  'analysis.streaks.currentWeeks': 'Mevcut serideki haftalar',
  'analysis.streaks.weeksWithLogs': 'Dönemde kayıt olan haftalar',
  'analysis.streaks.none':
    'Etkin seri bulunamadı ({entryMin} gün veya daha uzun bir yazma serisi ya da {habitMin} gün veya hafta ya da daha uzun bir alışkanlık serisi).',

  // Anomalies -----------------------------------------------------------------------------
  'analysis.anomalies.label': 'ruh hali veya streste olağandışı günler',
  'analysis.anomalies.textOne':
    'Verilerinize göre {day} günü {metricDefined} dönemin geri kalanına kıyasla {gender, select, other {{side, select, high {olağandışı derecede yüksek görünüyor} other {olağandışı derecede düşük görünüyor}}}} ({value}; ortalama {mean}).',
  'analysis.anomalies.textMany':
    'Verilerinize göre {count, plural, one {# gün} other {# gün}} boyunca {metricDefined} dönemin geri kalanına kıyasla {gender, select, other {{side, select, high {olağandışı derecede yüksek görünüyor} other {olağandışı derecede düşük görünüyor}}}}: {days}; dönem ortalaması: {mean}.',
  'analysis.anomalies.textManyMore':
    'Verilerinize göre {count, plural, one {# gün} other {# gün}} boyunca {metricDefined} dönemin geri kalanına kıyasla {gender, select, other {{side, select, high {olağandışı derecede yüksek görünüyor} other {olağandışı derecede düşük görünüyor}}}}: {days} ve diğerleri; dönem ortalaması: {mean}.',
  'analysis.anomalies.dayItem': '{day} ({value})',
  'analysis.anomalies.detail': '{date}: {value} ({side, select, above {ortalamanın {z} standart sapma üzerinde} other {ortalamanın {z} standart sapma altında}})',
  'analysis.anomalies.explain':
    '{metric} değeri girilen {count, plural, one {# günü} other {# günü}} inceledim. Ortalama: {mean}, standart sapma: {sd}. Değeri ortalamadan {z} standart sapma veya daha fazla uzaklaşan gün olağandışı sayılır. {details}. Sapmanın gücü: {strength}.',
  'analysis.anomalies.title':
    '{gender, select, other {{side, select, high {Olağandışı derecede yüksek {metric}} other {Olağandışı derecede düşük {metric}}}}} {count, plural, one {görülen gün} other {görülen günler}}',
  'analysis.anomalies.groupA': 'Olağandışı günler',
  'analysis.anomalies.zValue': '{value} (z {z})',
  'analysis.anomalies.nothing':
    '{count, plural, one {# gün} other {# gün}} boyunca olağandışı günleri inceledim ve ortalamadan {z} standart sapma veya daha fazla uzaklaşan bir gün bulamadım.',

  // Emotion patterns ----------------------------------------------------------------------
  'analysis.emotion.label': 'günlere, kişilere ve yerlere göre duygu örüntüleri',
  'analysis.emotion.metric': '"{emotion}" duygusu',
  'analysis.emotion.groupA': '"{emotion}" duygusunun görüldüğü günler',
  'analysis.emotion.weekdayTitle': '"{emotion}" duygusu çoğunlukla {onWeekday} görülüyor',
  'analysis.emotion.weekdayText':
    'Verilerinize göre "{emotion}" duygusu çoğunlukla {onWeekday} ortaya çıkmış görünüyor ({total} seferin {top} tanesi).',
  'analysis.emotion.weekdayExplain':
    '{count, plural, one {# günü} other {# günü}} inceledim. "{emotion}" duygusu {total, plural, one {# günde} other {# günde}} bildirildi; bunların {top} tanesi {weekdays} ({share}); oysa {weekdays}, incelenen tüm günlerin {baseline} kadarını oluşturuyor. Örüntü gücü: {strength}.',
  'analysis.emotion.groupBWeekday': 'Bunlardan {weekdays}',
  'analysis.emotion.weekdayShareKey': '{weekdays}: tüm günler içindeki payı',
  'analysis.emotion.personTitle': '"{emotion}" duygusu ve {name}',
  'analysis.emotion.placeTitle': '"{emotion}" duygusu ve "{place}"',
  'analysis.emotion.personText':
    'Verilerinize göre "{emotion}" duygusu, {name} ile görüştüğünüz günlerde sık ortaya çıkmış görünüyor ({total} seferin {with} tanesi).',
  'analysis.emotion.placeText':
    'Verilerinize göre "{emotion}" duygusu, konumun "{place}" olduğu günlerde sık ortaya çıkmış görünüyor ({total} seferin {with} tanesi).',
  'analysis.emotion.personExplain':
    '{count, plural, one {# günü} other {# günü}} inceledim. "{emotion}" duygusu {total} günde bildirildi; bunların {with} tanesinde ({share}) kayıtta {name} adı da geçiyordu. {name} adı toplam {count} günün {baselineCount} tanesinde geçiyor ({baseline}). Örüntü gücü: {strength}.',
  'analysis.emotion.placeExplain':
    '{count, plural, one {# günü} other {# günü}} inceledim. "{emotion}" duygusu {total} günde bildirildi; bunların {with} tanesinde ({share}) kayıtta "{place}" konumu da geçiyordu. "{place}" konumu toplam {count} günün {baselineCount} tanesinde geçiyor ({baseline}). Örüntü gücü: {strength}.',
  'analysis.emotion.groupBPerson': 'Bunlardan {name} ile olanlar',
  'analysis.emotion.groupBPlace': 'Bunlardan "{place}" konumunda olanlar',
  'analysis.emotion.personShareKey': '{name}: tüm günler içindeki payı',
  'analysis.emotion.placeShareKey': '"{place}" konumunun tüm günler içindeki payı',
  'analysis.emotion.nothing':
    'En az {min} kez tekrarlanan {count, plural, one {# duyguyu} other {# duyguyu}} inceledim ve belirli günlerde, kişilerde veya yerlerde belirgin bir yoğunlaşma bulamadım.',
};
export default messages;
