/**
 * th - analysis messages (server-side insight templates, notes and labels). Keys are prefixed
 * 'analysis.'; see shared/i18n/index.ts for the template syntax and en/analysis.ts for the conventions.
 *
 * Thai notes:
 *  - Every sentence is hedged ("ดูเหมือนว่า...", "อาจมีความเชื่อมโยง") and never causal.
 *  - Thai nouns have no grammatical gender, so `gender` is 'n' for every metric and the
 *    `{gender, select, other {...}}` wrappers keep a single branch.
 *  - Thai has no plural forms: plurals use 'other' only (plus `=1` / `=3` exact matches
 *    where the English sentence changes).
 */
const messages: Record<string, string> = {
  // Engine / provider -----------------------------------------------------------------
  'analysis.engine.providerFailed': 'การวิเคราะห์รูปแบบไม่เสร็จสมบูรณ์ (ข้อผิดพลาดภายใน) โปรดลองอีกครั้งภายหลัง',
  'analysis.engine.detectorFailed': 'การตรวจสอบ "{label}" ไม่เสร็จสมบูรณ์ (ข้อผิดพลาดภายใน) ส่วนข้อสังเกตอื่น ๆ ยังใช้ได้ตามปกติ',

  // Strength --------------------------------------------------------------------------
  'analysis.strength.weak': 'อ่อน',
  'analysis.strength.moderate': 'ปานกลาง',
  'analysis.strength.strong': 'แรง',

  // Metrics: label (short, standalone), defined (subject inside a sentence), gender -----
  'analysis.metric.mood.label': 'อารมณ์',
  'analysis.metric.mood.defined': 'อารมณ์',
  'analysis.metric.mood.gender': 'n',
  'analysis.metric.energy.label': 'ระดับพลังงาน',
  'analysis.metric.energy.defined': 'ระดับพลังงาน',
  'analysis.metric.energy.gender': 'n',
  'analysis.metric.stress.label': 'ระดับความเครียด',
  'analysis.metric.stress.defined': 'ระดับความเครียด',
  'analysis.metric.stress.gender': 'n',
  'analysis.metric.sleepHours.label': 'ชั่วโมงการนอน',
  'analysis.metric.sleepHours.defined': 'จำนวนชั่วโมงการนอน',
  'analysis.metric.sleepHours.gender': 'n',
  'analysis.metric.sleepQuality.label': 'คุณภาพการนอน',
  'analysis.metric.sleepQuality.defined': 'คุณภาพการนอน',
  'analysis.metric.sleepQuality.gender': 'n',
  'analysis.metric.exerciseMinutes.label': 'นาทีที่ออกกำลังกาย',
  'analysis.metric.exerciseMinutes.defined': 'จำนวนนาทีที่ออกกำลังกาย',
  'analysis.metric.exerciseMinutes.gender': 'n',
  'analysis.metric.entries.label': 'บันทึกไดอารี่',
  'analysis.metric.entries.defined': 'จำนวนบันทึก',
  'analysis.metric.entries.gender': 'n',

  // Counts and dates ------------------------------------------------------------------
  'analysis.count.days': '{count, plural, other {# วัน}}',
  'analysis.count.weeks': '{count, plural, other {# สัปดาห์}}',
  'analysis.date.dayWithDate': '{weekday} {date}',

  // Weekdays (index 0 = Sunday) --------------------------------------------------------
  'analysis.weekday.plural.0': 'วันอาทิตย์',
  'analysis.weekday.plural.1': 'วันจันทร์',
  'analysis.weekday.plural.2': 'วันอังคาร',
  'analysis.weekday.plural.3': 'วันพุธ',
  'analysis.weekday.plural.4': 'วันพฤหัสบดี',
  'analysis.weekday.plural.5': 'วันศุกร์',
  'analysis.weekday.plural.6': 'วันเสาร์',
  'analysis.weekday.on.0': 'ในวันอาทิตย์',
  'analysis.weekday.on.1': 'ในวันจันทร์',
  'analysis.weekday.on.2': 'ในวันอังคาร',
  'analysis.weekday.on.3': 'ในวันพุธ',
  'analysis.weekday.on.4': 'ในวันพฤหัสบดี',
  'analysis.weekday.on.5': 'ในวันศุกร์',
  'analysis.weekday.on.6': 'ในวันเสาร์',

  // Notes shared by the detectors -------------------------------------------------------
  'analysis.note.insufficient': 'ข้อมูลยังไม่เพียงพอสำหรับตรวจสอบ{what} (ต้องมีอย่างน้อย {required} ขณะนี้มี {have})',
  'analysis.note.insufficientWhether': 'ข้อมูลยังไม่เพียงพอสำหรับตรวจสอบว่า{what} (ต้องมีอย่างน้อย {required} ขณะนี้มี {have})',
  'analysis.note.nothingNotable': 'ฉันตรวจสอบ{what}ใน {count, plural, other {# วัน}} และไม่พบความแตกต่างที่น่าสังเกต',

  // Requirement / availability phrases used inside the notes above ----------------------
  'analysis.req.daysBothValues': '{count, plural, other {# วันที่มีทั้งสองค่า}}',
  'analysis.req.daysPerGroup': '{count, plural, other {# วันในแต่ละกลุ่ม}}',
  'analysis.req.daysWithReport': '{count, plural, other {# วันที่มีการบันทึก}}',
  'analysis.req.daysWithRatings': '{count, plural, other {# วันที่มีคะแนน}}',
  'analysis.req.daysPerMonth': '{count, plural, other {# วันที่มีการบันทึกในแต่ละเดือน}}',
  'analysis.req.recentDays': '{count, plural, other {# วันที่มีการบันทึกในสองสัปดาห์ที่ผ่านมา}}',
  'analysis.req.fullWeeks': '{count, plural, other {# สัปดาห์เต็มที่มีการบันทึก}}',
  'analysis.req.weeksOfLogs': '{count, plural, other {การบันทึก # สัปดาห์}}',
  'analysis.req.weekPerGroup': 'หนึ่งสัปดาห์ในแต่ละกลุ่ม และ {count, plural, other {# วัน}}ที่มีการบันทึกในแต่ละกลุ่ม',
  'analysis.req.moodReports': '{count, plural, other {การบันทึกอารมณ์ # ครั้ง}}',
  'analysis.req.reportsInWindow': '{count, plural, other {การบันทึก # ครั้งในช่วงเวลาเดียวกัน}}',
  'analysis.req.emotionRepeated': 'ความรู้สึกหนึ่งที่บันทึกไว้ใน {count, plural, other {# วัน}}',
  'analysis.have.twoGroups': '{groupA}: {countA, plural, other {# วัน}}; {groupB}: {countB, plural, other {# วัน}}',
  'analysis.have.weeksTwoGroups':
    'สัปดาห์ที่ถึงเป้าหมาย: {metWeeks, plural, other {# สัปดาห์}} ({metDays, plural, other {# วัน}}); สัปดาห์ที่ต่ำกว่าเป้าหมาย: {belowWeeks, plural, other {# สัปดาห์}} ({belowDays, plural, other {# วัน}})',
  'analysis.have.twoMonths': '{countA, plural, other {# วัน}}ในเดือน{cur} และ {countB, plural, other {# วัน}}ในเดือน{prev}',
  'analysis.have.noData': 'ไม่มีข้อมูล',
  'analysis.have.noSuchEmotion': 'ยังไม่มี',
  'analysis.have.fewerInEveryWindow': 'น้อยกว่านั้นในทุกช่วงเวลา',

  // Sentences shared by the group-comparison detectors ----------------------------------
  'analysis.relation.text':
    'ดูเหมือนว่าในข้อมูลของคุณ {condition} {metricDefined}ของคุณ{gender, select, other {{direction, select, higher {สูงกว่าโดยเฉลี่ย} other {ต่ำกว่าโดยเฉลี่ย}}}} ({meanA} เทียบกับ {meanB})',
  'analysis.correlation.text':
    'ดูเหมือนว่าในข้อมูลของคุณอาจมีความเชื่อมโยงระหว่าง{x}กับ{y}: {xGender, select, other {เมื่อ{x}ของคุณสูงขึ้น}} {yGender, select, other {{y}ของคุณ{direction, select, higher {มักจะสูงขึ้นด้วย} other {มักจะต่ำลง}}}} (สหสัมพันธ์ {r})',
  'analysis.explain.checkedDays': 'ฉันตรวจสอบ {count, plural, other {# วัน}}',
  'analysis.explain.onDaysCondition': 'ใน {count, plural, other {# วัน}} คุณ{conditionPast}',
  'analysis.explain.groupMeans':
    '{metricDefined}เฉลี่ยของคุณในวันเหล่านั้น{gender, select, other {อยู่ที่ {meanA}}} เทียบกับ {meanB} ในวันอื่น ๆ',
  'analysis.explain.correlation': 'สหสัมพันธ์: {r}',
  'analysis.explain.correlationBetween': 'สหสัมพันธ์ ({predictor} กับ {outcome}): {r}',
  'analysis.explain.diffAndStrength': 'ความแตกต่างระหว่างค่าเฉลี่ย: {diff} คะแนน ความแรงของรูปแบบ: {strength}',
  'analysis.explain.diffStrength': 'ความแตกต่าง: {diff} คะแนน ความแรงของรูปแบบ: {strength}',
  'analysis.split.corrExplainChecked': 'ฉันตรวจสอบ {count, plural, other {# วัน}}ที่มีการบันทึกทั้ง{x}และ{y}',
  'analysis.split.corrExplainPearson': 'สหสัมพันธ์เพียร์สัน: {r} (ความแรง: {strength})',
  'analysis.split.corrExplainGroups':
    'จำนวนวันในแต่ละกลุ่มยังไม่พอสำหรับเปรียบเทียบค่าเฉลี่ย ({groupA}: {countA, plural, other {# วัน}}; {groupB}: {countB, plural, other {# วัน}}; ต้องมีอย่างน้อย {min} วันในแต่ละกลุ่ม)',

  // Evidence table keys ---------------------------------------------------------------
  'analysis.extra.predictor': 'ตัวแปรที่นำมาเปรียบเทียบ',
  'analysis.extra.strength': 'ความแรง',
  'analysis.extra.meanDiff': 'ผลต่างค่าเฉลี่ย (A ลบ B)',
  'analysis.extra.cohenD': "ขนาดของความแตกต่าง (Cohen's d)",
  'analysis.extra.weeksChecked': 'จำนวนสัปดาห์ที่ตรวจสอบ',
  'analysis.extra.weeklyTarget': 'เป้าหมายรายสัปดาห์',
  'analysis.extra.target': 'เป้าหมาย',
  'analysis.extra.frequency': 'ความถี่',
  'analysis.extra.periodMean': 'ค่าเฉลี่ยของช่วงเวลา',
  'analysis.extra.overallMean': 'ค่าเฉลี่ยรวม',
  'analysis.extra.stddev': 'ส่วนเบี่ยงเบนมาตรฐาน',
  'analysis.extra.slopePerDay': 'ความชันต่อวัน',
  'analysis.extra.daysInWindow': 'จำนวนวันในช่วง',
  'analysis.extra.movingWindow': 'ช่วงของค่าเฉลี่ยเคลื่อนที่',
  'analysis.extra.relativeChange': 'การเปลี่ยนแปลงสัมพัทธ์',
  'analysis.extra.longestStreak': 'ความต่อเนื่องที่ยาวที่สุดในช่วงเวลา',
  'analysis.extra.shareOfEmotionDays': 'สัดส่วนของวันที่มีความรู้สึกนี้',
  'analysis.frequency.daily': 'รายวัน',
  'analysis.frequency.weekly': 'รายสัปดาห์',
  'analysis.groupB.otherDays': 'วันอื่น ๆ',

  // Sleep detectors -------------------------------------------------------------------
  'analysis.sleep.groupA': 'วันที่นอนน้อยกว่า {hours} ชั่วโมง',
  'analysis.sleep.groupB': 'วันที่นอน {hours} ชั่วโมงขึ้นไป',
  'analysis.sleep.condition': 'ในวันที่คุณนอนน้อยกว่า {hours} ชั่วโมง',
  'analysis.sleep.conditionPast': 'นอนน้อยกว่า {hours} ชั่วโมง',
  'analysis.sleepMood.label': 'ความเชื่อมโยงระหว่างการนอนกับอารมณ์',
  'analysis.sleepMood.title': '{direction, select, lower {การนอนน้อยกับอารมณ์ที่ต่ำกว่า} other {การนอนน้อยกับอารมณ์ที่สูงกว่า}}',
  'analysis.sleepMood.corrTitle': 'ความเชื่อมโยงที่เป็นไปได้ระหว่างชั่วโมงการนอนกับอารมณ์',
  'analysis.sleepEnergy.label': 'ความเชื่อมโยงระหว่างการนอนกับระดับพลังงาน',
  'analysis.sleepEnergy.title': '{direction, select, lower {การนอนน้อยกับพลังงานที่ต่ำกว่า} other {การนอนน้อยกับพลังงานที่สูงกว่า}}',
  'analysis.sleepEnergy.corrTitle': 'ความเชื่อมโยงที่เป็นไปได้ระหว่างชั่วโมงการนอนกับระดับพลังงาน',

  // Exercise detectors ----------------------------------------------------------------
  'analysis.exercise.groupA': 'วันที่มีกิจกรรมทางกาย',
  'analysis.exercise.groupB': 'วันที่ไม่มีกิจกรรมทางกาย',
  'analysis.exercise.condition': 'ในวันที่คุณได้ออกกำลังกาย',
  'analysis.exercise.conditionPast': 'ได้ออกกำลังกาย',
  'analysis.exerciseMood.label': 'ความเชื่อมโยงระหว่างกิจกรรมทางกายกับอารมณ์',
  'analysis.exerciseMood.title': '{direction, select, higher {กิจกรรมทางกายกับอารมณ์ที่สูงกว่า} other {กิจกรรมทางกายกับอารมณ์ที่ต่ำกว่า}}',
  'analysis.exerciseMood.corrTitle': 'ความเชื่อมโยงที่เป็นไปได้ระหว่างนาทีที่ออกกำลังกายกับอารมณ์',
  'analysis.exerciseEnergy.label': 'ความเชื่อมโยงระหว่างกิจกรรมทางกายกับระดับพลังงาน',
  'analysis.exerciseEnergy.title': '{direction, select, higher {กิจกรรมทางกายกับพลังงานที่สูงกว่า} other {กิจกรรมทางกายกับพลังงานที่ต่ำกว่า}}',
  'analysis.exerciseEnergy.corrTitle': 'ความเชื่อมโยงที่เป็นไปได้ระหว่างนาทีที่ออกกำลังกายกับระดับพลังงาน',

  // Habit - mood / energy / stress ------------------------------------------------------
  'analysis.habit.detectorLabel': 'ความเชื่อมโยงระหว่างนิสัยกับอารมณ์',
  'analysis.habit.noHabits': 'ไม่มีนิสัยที่ใช้งานอยู่ ฉันจึงไม่ได้ตรวจสอบความเชื่อมโยงระหว่างนิสัยกับอารมณ์',
  'analysis.habit.noLogs': 'นิสัย "{habit}" ยังไม่มีการบันทึกในช่วงเวลานี้ ฉันจึงไม่ได้ตรวจสอบความเชื่อมโยงระหว่างนิสัยนี้กับอารมณ์',
  'analysis.habit.noFullWeeks': 'นิสัย "{habit}" ยังไม่มีสัปดาห์เต็มที่มีการบันทึก ฉันจึงไม่ได้ตรวจสอบความเชื่อมโยงระหว่างนิสัยนี้กับอารมณ์',
  'analysis.habit.label': 'ความเชื่อมโยงระหว่างนิสัย "{habit}" กับ{metric}',
  'analysis.habit.groupA': 'วันที่ทำนิสัย "{habit}" สำเร็จ',
  'analysis.habit.groupB': 'วันที่ไม่ได้ทำนิสัย "{habit}" สำเร็จ',
  'analysis.habit.condition': 'ในวันที่คุณทำนิสัย "{habit}" สำเร็จ',
  'analysis.habit.conditionPast': 'ทำนิสัย "{habit}" สำเร็จ',
  'analysis.habit.title':
    'นิสัย "{habit}" กับ{gender, select, other {{direction, select, higher {{metric}ที่สูงกว่า} other {{metric}ที่ต่ำกว่า}}}}',
  'analysis.habit.corrTitle': 'ความเชื่อมโยงที่เป็นไปได้ระหว่างนิสัย "{habit}" กับ{metric}',
  'analysis.habit.weeklyCondition': 'ในสัปดาห์ที่คุณทำนิสัย "{habit}" ได้ตามเป้าหมาย',
  'analysis.habit.weeklyTarget': '{target} {unit} ต่อสัปดาห์',
  'analysis.habit.targetValue': '{target} {unit}',
  'analysis.habit.weeklyExplainChecked':
    'ฉันตรวจสอบ {weeks, plural, other {# สัปดาห์เต็ม}} ({days, plural, other {# วัน}}ที่มีการบันทึก{metric})',
  'analysis.habit.weeklyExplainMet': 'ใน {count, plural, other {# สัปดาห์}} คุณทำได้ตามเป้าหมายของนิสัย ({target})',
  'analysis.habit.weeklyExplainMeans':
    '{metricDefined}เฉลี่ยของคุณในวันของสัปดาห์เหล่านั้น{gender, select, other {อยู่ที่ {meanA}}} เทียบกับ {meanB} ในวันของ {count, plural, other {# สัปดาห์}}ที่ต่ำกว่าเป้าหมาย',
  'analysis.habit.groupAWeeks': 'วันในสัปดาห์ที่ถึงเป้าหมาย ({count, plural, other {# สัปดาห์}})',
  'analysis.habit.groupBWeeks': 'วันในสัปดาห์ที่ต่ำกว่าเป้าหมาย ({count, plural, other {# สัปดาห์}})',

  // Weekday differences -----------------------------------------------------------------
  'analysis.weekday.label': 'ความแตกต่างระหว่างวันในสัปดาห์',
  'analysis.weekday.text':
    'ดูเหมือนว่าในข้อมูลของคุณ {onWeekday} {metricDefined}ของคุณ{gender, select, other {{direction, select, higher {สูงกว่าโดยเฉลี่ย} other {ต่ำกว่าโดยเฉลี่ย}}}}เมื่อเทียบกับวันอื่น ๆ ในสัปดาห์ ({meanA} เทียบกับ {meanB})',
  'analysis.weekday.explainChecked': 'ฉันตรวจสอบ {count, plural, other {# วัน}}ที่มีการบันทึก{metric} ในจำนวนนี้ {countA} วันเป็น{weekdays}',
  'analysis.weekday.explainMeans':
    '{metricDefined}เฉลี่ยของคุณ{onWeekday}{gender, select, other {อยู่ที่ {meanA}}} เทียบกับ {meanB} ในวันอื่น ๆ',
  'analysis.weekday.title':
    '{weekdays}: {gender, select, other {{direction, select, higher {{metric}สูงกว่า} other {{metric}ต่ำกว่า}}}}',
  'analysis.weekday.groupB': 'วันอื่น ๆ ในสัปดาห์',
  'analysis.weekday.tableValue': '{mean} ({count, plural, other {# วัน}})',
  'analysis.weekday.nothing': 'ฉันตรวจสอบความแตกต่างระหว่างวันในสัปดาห์ใน {count, plural, other {# วัน}} และไม่พบความแตกต่างที่น่าสังเกต',

  // Time of day -------------------------------------------------------------------------
  'analysis.timeOfDay.label': 'ความเชื่อมโยงระหว่างช่วงเวลาที่เขียนกับอารมณ์',
  'analysis.timeOfDay.morning.label': 'ช่วงเช้า',
  'analysis.timeOfDay.morning.phrase': 'ในช่วงเช้า',
  'analysis.timeOfDay.late_morning.label': 'ช่วงสาย',
  'analysis.timeOfDay.late_morning.phrase': 'ในช่วงสาย',
  'analysis.timeOfDay.afternoon.label': 'ช่วงบ่าย',
  'analysis.timeOfDay.afternoon.phrase': 'ในช่วงบ่าย',
  'analysis.timeOfDay.evening.label': 'ช่วงเย็น',
  'analysis.timeOfDay.evening.phrase': 'ในช่วงเย็น',
  'analysis.timeOfDay.night.label': 'ช่วงกลางคืน',
  'analysis.timeOfDay.night.phrase': 'ในช่วงกลางคืน',
  'analysis.timeOfDay.tableKey': '{label} ({hours})',
  'analysis.timeOfDay.tableValue': 'เฉลี่ย {mean}, {count, plural, other {บันทึก # ครั้ง}}',
  'analysis.timeOfDay.tableRow': '{key}: {value}',
  'analysis.timeOfDay.nothing': 'ฉันตรวจสอบ{label}จาก {count, plural, other {การบันทึก # ครั้ง}} และไม่พบช่วงเวลาใดที่โดดเด่นกว่าค่าเฉลี่ย',
  'analysis.timeOfDay.text':
    'ดูเหมือนว่าในข้อมูลของคุณ อารมณ์ที่คุณบันทึก{phrase} ({hours}) สูงที่สุด: เฉลี่ย {mean} เทียบกับ {overall} จากการบันทึกทั้งหมด',
  'analysis.timeOfDay.explainChecked':
    'ฉันตรวจสอบ {count, plural, other {การบันทึกอารมณ์ # ครั้ง}} จาก {days, plural, other {# วัน}} โดยแบ่งตามเวลาที่เขียนบันทึก',
  'analysis.timeOfDay.explainTable': '{table} ค่าเฉลี่ยรวม: {overall}',
  'analysis.timeOfDay.explainDiff': 'ความแตกต่างระหว่างช่วงเวลาที่สูงที่สุดกับค่าเฉลี่ยรวม: {diff} คะแนน ความแรงของรูปแบบ: {strength}',
  'analysis.timeOfDay.title': 'อารมณ์สูงกว่า{phrase}',
  'analysis.timeOfDay.groupA': 'การบันทึก{phrase} ({hours})',
  'analysis.timeOfDay.groupB': 'การบันทึกอื่น ๆ',

  // Trends ------------------------------------------------------------------------------
  'analysis.trends.label': 'แนวโน้มของอารมณ์ ความเครียด และการนอน',
  'analysis.trends.text':
    'ดูเหมือนว่าในข้อมูลของคุณ {metricDefined}ของคุณ{gender, select, other {{direction, select, up {มีแนวโน้มสูงขึ้น} other {มีแนวโน้มลดลง}}}}{horizon, select, period {ตลอดช่วงเวลานี้} monthly {ในเดือนที่ผ่านมา} other {ในสองสัปดาห์ที่ผ่านมา}}: เส้นแนวโน้มของค่าเฉลี่ยเคลื่อนที่{direction, select, up {เพิ่มขึ้นจาก} other {ลดลงจาก}} {fromValue} เป็น {toValue}',
  'analysis.trends.explainChecked':
    'ฉันตรวจสอบ {count, plural, other {# วัน}}ที่มีการบันทึก{metric} จาก{horizon, select, period {จำนวนวันในช่วงเวลานี้} other {วันล่าสุด}} {len} วัน ({from}-{to})',
  'analysis.trends.explainFit':
    'ฉันคำนวณค่าเฉลี่ยเคลื่อนที่ {window} วัน แล้วลากเส้นแนวโน้ม (การถดถอยเชิงเส้น) ผ่านค่านั้น: {direction, select, up {ความชันขาขึ้น} other {ความชันขาลง}} {unit, select, hours {{slope} ชั่วโมง} other {{slope} คะแนน}} ต่อวัน หรือเปลี่ยนแปลงประมาณ {unit, select, hours {{change} ชั่วโมง} other {{change} คะแนน}} ตลอดช่วง (จาก {fromValue} เป็น {toValue} ตามเส้นแนวโน้ม) ความแรงของแนวโน้ม: {strength}',
  'analysis.trends.title':
    '{direction, select, up {แนวโน้มขาขึ้น} other {แนวโน้มขาลง}}ของ{metric, select, mood {อารมณ์ของคุณ} energy {ระดับพลังงานของคุณ} stress {ระดับความเครียดของคุณ} sleepHours {ชั่วโมงการนอนของคุณ} sleepQuality {คุณภาพการนอนของคุณ} exerciseMinutes {นาทีที่ออกกำลังกายของคุณ} other {จำนวนบันทึก}}{horizon, select, period {ตลอดช่วงเวลานี้} monthly {ในเดือนที่ผ่านมา} other {ในสองสัปดาห์ที่ผ่านมา}}',
  'analysis.trends.groupA': 'ต้นช่วง (เส้นแนวโน้ม)',
  'analysis.trends.groupB': 'ปลายช่วง (เส้นแนวโน้ม)',
  'analysis.trends.slopeValue': '{unit, select, hours {{slope} ชั่วโมง} other {{slope} คะแนน}}',
  'analysis.trends.nothingSince': 'ฉันตรวจสอบแนวโน้มของอารมณ์ ความเครียด และการนอนตั้งแต่ {from} และไม่พบแนวโน้มที่น่าสังเกต',
  'analysis.trends.nothingAll': 'ฉันตรวจสอบแนวโน้มของอารมณ์ ความเครียด และการนอนตลอดช่วงเวลาทั้งหมด และไม่พบแนวโน้มที่น่าสังเกต',

  // Month comparison --------------------------------------------------------------------
  'analysis.periodCompare.label': 'การเปรียบเทียบระหว่างเดือนนี้กับเดือนก่อน',
  'analysis.periodCompare.text':
    'ดูเหมือนว่าในข้อมูลของคุณ {metricDefined}ของคุณในเดือน{cur}{gender, select, other {{direction, select, higher {สูงกว่าโดยเฉลี่ย} other {ต่ำกว่าโดยเฉลี่ย}}}}เมื่อเทียบกับเดือน{prev} ({meanA} เทียบกับ {meanB})',
  'analysis.periodCompare.explain':
    'ฉันเปรียบเทียบวันที่มีการบันทึก{metric}ในเดือน{cur} ({countA, plural, other {# วัน}} จนถึงวันนี้) กับวันในเดือน{prev} ({countB, plural, other {# วัน}}) ค่าเฉลี่ยในเดือน{cur}: {meanA} ในเดือน{prev}: {meanB} ความแตกต่าง: {unit, select, hours {{diff} ชั่วโมง} other {{diff} คะแนน}} ความแรงของความแตกต่าง: {strength}',
  'analysis.periodCompare.title':
    'เดือน{cur}: {gender, select, other {{direction, select, higher {{metric}สูงกว่า} other {{metric}ต่ำกว่า}}}}เดือน{prev}',
  'analysis.periodCompare.entriesText':
    'ดูเหมือนว่าคุณ{direction, select, more {เขียนมากกว่า} other {เขียนน้อยกว่า}}ใน {window} วันแรกของเดือน{cur} ({countA, plural, other {# บันทึก}}) เมื่อเทียบกับ {window} วันแรกของเดือน{prev} ({countB, plural, other {# บันทึก}})',
  'analysis.periodCompare.entriesExplain':
    'ฉันนับบันทึกใน {window} วันแรกของแต่ละเดือน เพื่อเปรียบเทียบช่วงเวลาที่เท่ากัน: {cur} - {countA, plural, other {# บันทึก}}, {prev} - {countB, plural, other {# บันทึก}} ความแตกต่าง: {diff, plural, other {# บันทึก}} ({percent}) ความแรงของความแตกต่าง: {strength}',
  'analysis.periodCompare.entriesTitle': '{direction, select, more {บันทึกมากกว่า} other {บันทึกน้อยกว่า}}ในเดือน{cur}เมื่อเทียบกับเดือน{prev}',
  'analysis.periodCompare.monthWindow': '{month} ({window} วันแรก)',
  'analysis.periodCompare.insufficientWhat': 'การเปรียบเทียบระหว่างเดือน{cur}กับเดือน{prev}',
  'analysis.periodCompare.nothing': 'ฉันเปรียบเทียบเดือน{cur}กับเดือน{prev} และไม่พบความแตกต่างที่น่าสังเกตในอารมณ์ ความเครียด การนอน หรือจำนวนบันทึก',

  // Habit trend (improved / declined) -----------------------------------------------------
  'analysis.habitsTrend.label': 'นิสัยที่ดีขึ้นหรือลดลง',
  'analysis.habitsTrend.whether': 'นิสัย "{habit}" ดีขึ้นหรือลดลง',
  'analysis.habitsTrend.textDaily':
    'ดูเหมือนว่านิสัย "{habit}" {direction, select, improved {ดีขึ้น} other {ลดลง}}: ในสองสัปดาห์ที่ผ่านมา คุณทำสำเร็จ {recent} จาก {window} วัน เทียบกับ {previous} จาก {window} วันในสองสัปดาห์ก่อนหน้า',
  'analysis.habitsTrend.textWeekly':
    'ดูเหมือนว่านิสัย "{habit}" {direction, select, improved {ดีขึ้น} other {ลดลง}}: ในสองสัปดาห์ที่ผ่านมา คุณบันทึกได้ {recent} {unit} เทียบกับ {previous} ในสองสัปดาห์ก่อนหน้า (เป้าหมาย: {target} {unit} ต่อสัปดาห์)',
  'analysis.habitsTrend.explain':
    'ฉันเปรียบเทียบอัตราการทำนิสัยสำเร็จในสองสัปดาห์ที่ผ่านมา ({recentFrom}-{recentTo}) กับสองสัปดาห์ก่อนหน้า ({previousFrom}-{previousTo}): {recentRate} เทียบกับ {previousRate} ความแตกต่าง: {diff} จุดเปอร์เซ็นต์ ความแรงของการเปลี่ยนแปลง: {strength}',
  'analysis.habitsTrend.title': 'นิสัย "{habit}" {direction, select, improved {ดีขึ้น} other {ลดลง}}ในสองสัปดาห์ที่ผ่านมา',
  'analysis.habitsTrend.metric': 'อัตราการทำสำเร็จ - {habit}',
  'analysis.habitsTrend.groupA': 'สองสัปดาห์ที่ผ่านมา',
  'analysis.habitsTrend.groupB': 'สองสัปดาห์ก่อนหน้า',

  // Best / hardest days ------------------------------------------------------------------
  'analysis.bestWorst.label': 'วันที่ดีที่สุดและวันที่ยากที่สุด',
  'analysis.bestWorst.describedDay': '{day} ("{title}")',
  'analysis.bestWorst.noTitle': 'ไม่มีชื่อเรื่อง',
  'analysis.bestWorst.extraValue': '{titles} - คะแนน {score}',
  'analysis.bestWorst.text':
    '{kind, select, best {วันที่ดีที่สุด} other {วันที่ยากที่สุด}}ในช่วงเวลานี้ ตามคะแนนรวมของอารมณ์ พลังงาน และความเครียด: {days}',
  'analysis.bestWorst.explainScore':
    'สำหรับแต่ละวัน (รวม {count, plural, other {# วัน}}) ฉันคำนวณคะแนนรวม: ค่าเฉลี่ยของอารมณ์ ระดับพลังงาน และ (11 ลบระดับความเครียด) จากค่าที่บันทึกในวันนั้น',
  'analysis.bestWorst.explainMeans':
    'คะแนนเฉลี่ยในช่วงเวลานี้: {overall} {kind, select, best {{count, plural, =1 {วันที่ดีที่สุดได้คะแนน} =3 {สามวันที่ดีที่สุดได้คะแนน} other {วันที่ดีที่สุดได้คะแนน}}} other {{count, plural, =1 {วันที่ยากที่สุดได้คะแนน} =3 {สามวันที่ยากที่สุดได้คะแนน} other {วันที่ยากที่สุดได้คะแนน}}}}เฉลี่ย {mean}',
  'analysis.bestWorst.explainDiff': 'ความแตกต่างจากค่าเฉลี่ย: {diff} คะแนน ความแรงของความแตกต่าง: {strength}',
  'analysis.bestWorst.title': '{kind, select, best {วันที่ดีที่สุดในช่วงเวลานี้} other {วันที่ยากที่สุดในช่วงเวลานี้}}',
  'analysis.bestWorst.metric': 'คะแนนรวม (อารมณ์ + พลังงาน + ความเครียดแบบกลับค่า)',
  'analysis.bestWorst.groupA': '{kind, select, best {วันที่ดีที่สุด} other {วันที่ยากที่สุด}}',
  'analysis.bestWorst.nothing': 'ฉันตรวจสอบ{label}ใน {count, plural, other {# วัน}} คะแนนใกล้เคียงกันและไม่มีวันใดโดดเด่นเป็นพิเศษ',

  // Streaks -------------------------------------------------------------------------------
  'analysis.streaks.label': 'ความต่อเนื่องในการเขียนและการทำนิสัย',
  'analysis.streaks.entriesTitle': 'เขียนต่อเนื่อง {count, plural, other {# วัน}}',
  'analysis.streaks.entriesText': 'เยี่ยมมาก! คุณเขียนไดอารี่ติดต่อกัน {count, plural, other {# วัน}} ({from}-{to})',
  'analysis.streaks.entriesExplain':
    'ฉันนับวันที่ต่อเนื่องกันซึ่งมีบันทึกอย่างน้อยหนึ่งรายการ จนถึงวันนี้หรือเมื่อวาน ความต่อเนื่องปัจจุบัน: {count, plural, other {# วัน}} ตั้งแต่ {from} ถึง {to} ความต่อเนื่องที่ยาวที่สุดในช่วงเวลานี้: {best, plural, other {# วัน}}',
  'analysis.streaks.entriesMetric': 'วันที่เขียน',
  'analysis.streaks.currentDays': 'จำนวนวันในความต่อเนื่องปัจจุบัน',
  'analysis.streaks.daysWithEntry': 'วันที่มีบันทึกในช่วงเวลานี้',
  'analysis.streaks.habitTitle': 'ทำนิสัย "{habit}" ต่อเนื่อง {count, plural, other {# วัน}}',
  'analysis.streaks.habitText': 'คุณทำนิสัย "{habit}" สำเร็จติดต่อกัน {count, plural, other {# วัน}} ({from}-{to})',
  'analysis.streaks.habitExplain':
    'ฉันนับวันที่ต่อเนื่องกันซึ่งนิสัย "{habit}" ถูกทำเครื่องหมายว่าสำเร็จ จนถึงวันนี้หรือเมื่อวาน ความต่อเนื่องปัจจุบัน: {count, plural, other {# วัน}} ความต่อเนื่องที่ยาวที่สุดในช่วงเวลานี้: {best, plural, other {# วัน}}',
  'analysis.streaks.habitMetric': 'การทำนิสัย {habit} สำเร็จ',
  'analysis.streaks.daysCompleted': 'วันที่ทำนิสัยสำเร็จในช่วงเวลานี้',
  'analysis.streaks.weeklyTitle': 'ทำนิสัย "{habit}" ต่อเนื่อง {count, plural, other {# สัปดาห์}}',
  'analysis.streaks.weeklyText': 'คุณทำได้ตามเป้าหมายของนิสัย "{habit}" ติดต่อกัน {count, plural, other {# สัปดาห์}} ({from}-{to})',
  'analysis.streaks.weeklyExplain':
    'ฉันรวมจำนวนที่บันทึกสำหรับนิสัย "{habit}" ในแต่ละสัปดาห์ แล้วเปรียบเทียบกับเป้าหมายรายสัปดาห์ ({target}) ความต่อเนื่องปัจจุบันของสัปดาห์ที่ถึงเป้าหมาย: {count, plural, other {# สัปดาห์}}',
  'analysis.streaks.weeklyMetric': 'ถึงเป้าหมายรายสัปดาห์ - {habit}',
  'analysis.streaks.currentWeeks': 'จำนวนสัปดาห์ในความต่อเนื่องปัจจุบัน',
  'analysis.streaks.weeksWithLogs': 'สัปดาห์ที่มีการบันทึกในช่วงเวลานี้',
  'analysis.streaks.none':
    'ไม่พบความต่อเนื่องที่กำลังดำเนินอยู่ (การเขียนต่อเนื่องตั้งแต่ {entryMin} วันขึ้นไป หรือการทำนิสัยต่อเนื่องตั้งแต่ {habitMin} วันหรือสัปดาห์ขึ้นไป)',

  // Anomalies -----------------------------------------------------------------------------
  'analysis.anomalies.label': 'วันที่อารมณ์หรือความเครียดผิดปกติ',
  'analysis.anomalies.textOne':
    'ดูเหมือนว่าใน{day} {metricDefined}ของคุณ{gender, select, other {{side, select, high {สูงผิดปกติ} other {ต่ำผิดปกติ}}}}เมื่อเทียบกับช่วงเวลาที่เหลือ ({value} เทียบกับค่าเฉลี่ย {mean})',
  'analysis.anomalies.textMany':
    'ดูเหมือนว่าใน {count, plural, other {# วัน}} {metricDefined}ของคุณ{gender, select, other {{side, select, high {สูงผิดปกติ} other {ต่ำผิดปกติ}}}}เมื่อเทียบกับช่วงเวลาที่เหลือ: {days}; ค่าเฉลี่ยในช่วงเวลานี้: {mean}',
  'analysis.anomalies.textManyMore':
    'ดูเหมือนว่าใน {count, plural, other {# วัน}} {metricDefined}ของคุณ{gender, select, other {{side, select, high {สูงผิดปกติ} other {ต่ำผิดปกติ}}}}เมื่อเทียบกับช่วงเวลาที่เหลือ: {days} และวันอื่น ๆ; ค่าเฉลี่ยในช่วงเวลานี้: {mean}',
  'analysis.anomalies.dayItem': '{day} ({value})',
  'analysis.anomalies.detail': '{date}: {value} ({side, select, above {สูงกว่าค่าเฉลี่ย {z} ส่วนเบี่ยงเบนมาตรฐาน} other {ต่ำกว่าค่าเฉลี่ย {z} ส่วนเบี่ยงเบนมาตรฐาน}})',
  'analysis.anomalies.explain':
    'ฉันตรวจสอบ {count, plural, other {# วัน}}ที่มีการบันทึก{metric} ค่าเฉลี่ย: {mean} ส่วนเบี่ยงเบนมาตรฐาน: {sd} วันหนึ่งจะถือว่าผิดปกติเมื่อค่าของวันนั้นห่างจากค่าเฉลี่ยตั้งแต่ {z} ส่วนเบี่ยงเบนมาตรฐานขึ้นไป {details} ความแรงของความเบี่ยงเบน: {strength}',
  'analysis.anomalies.title':
    '{count, plural, other {วันที่}}{gender, select, other {{side, select, high {{metric}สูงผิดปกติ} other {{metric}ต่ำผิดปกติ}}}}',
  'analysis.anomalies.groupA': 'วันที่ผิดปกติ',
  'analysis.anomalies.zValue': '{value} (z {z})',
  'analysis.anomalies.nothing':
    'ฉันตรวจสอบวันที่ผิดปกติใน {count, plural, other {# วัน}} และไม่พบวันใดที่ห่างจากค่าเฉลี่ยตั้งแต่ {z} ส่วนเบี่ยงเบนมาตรฐานขึ้นไป',

  // Emotion patterns ----------------------------------------------------------------------
  'analysis.emotion.label': 'รูปแบบของความรู้สึกตามวัน ผู้คน และสถานที่',
  'analysis.emotion.metric': 'ความรู้สึก {emotion}',
  'analysis.emotion.groupA': 'วันที่มีความรู้สึก "{emotion}"',
  'analysis.emotion.weekdayTitle': 'ความรู้สึก "{emotion}" มักปรากฏ{onWeekday}',
  'analysis.emotion.weekdayText': 'ดูเหมือนว่าในข้อมูลของคุณ ความรู้สึก "{emotion}" มักปรากฏ{onWeekday} ({top} จาก {total} ครั้ง)',
  'analysis.emotion.weekdayExplain':
    'ฉันตรวจสอบ {count, plural, other {# วัน}} ความรู้สึก "{emotion}" ถูกบันทึกไว้ใน {total, plural, other {# วัน}} ในจำนวนนี้ {top} วันเป็น{weekdays} ({share}) ขณะที่{weekdays}คิดเป็น {baseline} ของวันทั้งหมดที่ตรวจสอบ ความแรงของรูปแบบ: {strength}',
  'analysis.emotion.groupBWeekday': 'ในจำนวนนี้เป็น{weekdays}',
  'analysis.emotion.weekdayShareKey': 'สัดส่วนของ{weekdays}ในวันทั้งหมด',
  'analysis.emotion.personTitle': 'ความรู้สึก "{emotion}" กับ {name}',
  'analysis.emotion.placeTitle': 'ความรู้สึก "{emotion}" กับ "{place}"',
  'analysis.emotion.personText':
    'ดูเหมือนว่าในข้อมูลของคุณ ความรู้สึก "{emotion}" มักปรากฏในวันที่คุณได้พบ {name} ({with} จาก {total} ครั้ง)',
  'analysis.emotion.placeText':
    'ดูเหมือนว่าในข้อมูลของคุณ ความรู้สึก "{emotion}" มักปรากฏในวันที่สถานที่คือ "{place}" ({with} จาก {total} ครั้ง)',
  'analysis.emotion.personExplain':
    'ฉันตรวจสอบ {count, plural, other {# วัน}} ความรู้สึก "{emotion}" ถูกบันทึกไว้ใน {total} วัน ในจำนวนนี้ {with} วัน ({share}) มีชื่อ {name} อยู่ในบันทึกด้วย ชื่อ {name} ปรากฏใน {baselineCount} จากทั้งหมด {count} วัน ({baseline}) ความแรงของรูปแบบ: {strength}',
  'analysis.emotion.placeExplain':
    'ฉันตรวจสอบ {count, plural, other {# วัน}} ความรู้สึก "{emotion}" ถูกบันทึกไว้ใน {total} วัน ในจำนวนนี้ {with} วัน ({share}) มีสถานที่ "{place}" อยู่ในบันทึกด้วย สถานที่ "{place}" ปรากฏใน {baselineCount} จากทั้งหมด {count} วัน ({baseline}) ความแรงของรูปแบบ: {strength}',
  'analysis.emotion.groupBPerson': 'ในจำนวนนี้มี {name}',
  'analysis.emotion.groupBPlace': 'ในจำนวนนี้อยู่ที่ "{place}"',
  'analysis.emotion.personShareKey': 'สัดส่วนของ {name} ในวันทั้งหมด',
  'analysis.emotion.placeShareKey': 'สัดส่วนของสถานที่ "{place}" ในวันทั้งหมด',
  'analysis.emotion.nothing':
    'ฉันตรวจสอบ{count, plural, other {ความรู้สึก # อย่าง}}ที่เกิดซ้ำอย่างน้อย {min} ครั้ง และไม่พบการกระจุกตัวที่น่าสังเกตในวัน ผู้คน หรือสถานที่ใดเป็นพิเศษ',
};
export default messages;
