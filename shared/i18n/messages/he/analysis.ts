/**
 * he - analysis messages (server-side insight templates, notes and labels).
 * Keys are prefixed 'analysis.'; see shared/i18n/index.ts for the template syntax.
 *
 * Conventions shared with the English reference (shared/i18n/messages/en/analysis.ts):
 *  - Every sentence is hedged ("נראה שבנתונים שלך...", "קשר אפשרי") and never causal;
 *    the analysis tests scan the catalogue for "גורם", "בגלל", "מוביל ל".
 *  - `gender` is the grammatical class of the metric noun in THIS language, taken from
 *    'analysis.metric.<metric>.gender' below (Hebrew: m / f). Templates select on it for
 *    verb and adjective agreement. `direction` is 'higher' | 'lower', `side` 'high' | 'low'.
 *  - Numbers, dates and month/weekday names arrive already formatted for the locale.
 */
const messages: Record<string, string> = {
  // Engine / provider -----------------------------------------------------------------
  'analysis.engine.providerFailed': 'ניתוח הדפוסים לא הושלם (שגיאה פנימית). נסו שוב מאוחר יותר.',
  'analysis.engine.detectorFailed': 'הבדיקה "{label}" לא הושלמה (שגיאה פנימית); שאר התובנות תקינות.',

  // Strength --------------------------------------------------------------------------
  'analysis.strength.weak': 'חלש',
  'analysis.strength.moderate': 'בינוני',
  'analysis.strength.strong': 'חזק',

  // Metrics: label (short, standalone), defined (subject inside a sentence), gender -----
  'analysis.metric.mood.label': 'מצב רוח',
  'analysis.metric.mood.defined': 'מצב הרוח',
  'analysis.metric.mood.gender': 'm',
  'analysis.metric.energy.label': 'רמת אנרגיה',
  'analysis.metric.energy.defined': 'רמת האנרגיה',
  'analysis.metric.energy.gender': 'f',
  'analysis.metric.stress.label': 'רמת לחץ',
  'analysis.metric.stress.defined': 'רמת הלחץ',
  'analysis.metric.stress.gender': 'f',
  'analysis.metric.sleepHours.label': 'שעות שינה',
  'analysis.metric.sleepHours.defined': 'מספר שעות השינה',
  'analysis.metric.sleepHours.gender': 'm',
  'analysis.metric.sleepQuality.label': 'איכות שינה',
  'analysis.metric.sleepQuality.defined': 'איכות השינה',
  'analysis.metric.sleepQuality.gender': 'f',
  'analysis.metric.exerciseMinutes.label': 'דקות פעילות גופנית',
  'analysis.metric.exerciseMinutes.defined': 'מספר דקות הפעילות הגופנית',
  'analysis.metric.exerciseMinutes.gender': 'm',
  'analysis.metric.entries.label': 'רשומות יומן',
  'analysis.metric.entries.defined': 'מספר הרשומות',
  'analysis.metric.entries.gender': 'm',

  // Counts and dates ------------------------------------------------------------------
  'analysis.count.days': '{count, plural, one {יום אחד} other {# ימים}}',
  'analysis.count.weeks': '{count, plural, one {שבוע אחד} other {# שבועות}}',
  'analysis.date.dayWithDate': '{weekday} {date}',

  // Weekdays (index 0 = Sunday) --------------------------------------------------------
  'analysis.weekday.plural.0': 'ימי ראשון',
  'analysis.weekday.plural.1': 'ימי שני',
  'analysis.weekday.plural.2': 'ימי שלישי',
  'analysis.weekday.plural.3': 'ימי רביעי',
  'analysis.weekday.plural.4': 'ימי חמישי',
  'analysis.weekday.plural.5': 'ימי שישי',
  'analysis.weekday.plural.6': 'שבתות',
  'analysis.weekday.on.0': 'בימי ראשון',
  'analysis.weekday.on.1': 'בימי שני',
  'analysis.weekday.on.2': 'בימי שלישי',
  'analysis.weekday.on.3': 'בימי רביעי',
  'analysis.weekday.on.4': 'בימי חמישי',
  'analysis.weekday.on.5': 'בימי שישי',
  'analysis.weekday.on.6': 'בשבתות',

  // Notes shared by the detectors -------------------------------------------------------
  'analysis.note.insufficient': 'אין מספיק נתונים כדי לבדוק את {what} (נדרשים לפחות {required}; יש {have}).',
  'analysis.note.insufficientWhether': 'אין מספיק נתונים כדי לבדוק {what} (נדרשים לפחות {required}; יש {have}).',
  'analysis.note.nothingNotable': 'בדקתי את {what} {count, plural, one {ביום אחד} other {ב-# ימים}} ולא מצאתי הבדל בולט.',

  // Requirement / availability phrases used inside the notes above ----------------------
  'analysis.req.daysBothValues': '{count, plural, one {יום אחד עם שני הנתונים} other {# ימים עם שני הנתונים}}',
  'analysis.req.daysPerGroup': '{count, plural, one {יום אחד בכל קבוצה} other {# ימים בכל קבוצה}}',
  'analysis.req.daysWithReport': '{count, plural, one {יום אחד עם דיווח} other {# ימים עם דיווח}}',
  'analysis.req.daysWithRatings': '{count, plural, one {יום אחד עם דירוגים} other {# ימים עם דירוגים}}',
  'analysis.req.daysPerMonth': '{count, plural, one {יום אחד עם דיווח בכל חודש} other {# ימים עם דיווח בכל חודש}}',
  'analysis.req.recentDays': '{count, plural, one {יום אחד עם דיווח בשבועיים האחרונים} other {# ימים עם דיווח בשבועיים האחרונים}}',
  'analysis.req.fullWeeks': '{count, plural, one {שבוע מלא אחד עם דיווחים} other {# שבועות מלאים עם דיווחים}}',
  'analysis.req.weeksOfLogs': '{count, plural, one {שבוע אחד של דיווחים} other {# שבועות של דיווחים}}',
  'analysis.req.weekPerGroup': 'שבוע אחד בכל קבוצה ו-{count, plural, one {יום אחד} other {# ימים}} עם דיווח בכל קבוצה',
  'analysis.req.moodReports': '{count, plural, one {דיווח מצב רוח אחד} other {# דיווחי מצב רוח}}',
  'analysis.req.reportsInWindow': '{count, plural, one {דיווח אחד בחלון שעות אחד} other {# דיווחים בחלון שעות אחד}}',
  'analysis.req.emotionRepeated': 'רגש אחד שדווח {count, plural, one {ביום אחד} other {ב-# ימים}}',
  'analysis.have.twoGroups': '{groupA}: {countA, plural, one {יום אחד} other {# ימים}}; {groupB}: {countB, plural, one {יום אחד} other {# ימים}}',
  'analysis.have.weeksTwoGroups':
    'שבועות שעמדו ביעד: {metWeeks, plural, one {שבוע אחד} other {# שבועות}} ({metDays, plural, one {יום אחד} other {# ימים}}); שבועות מתחת ליעד: {belowWeeks, plural, one {שבוע אחד} other {# שבועות}} ({belowDays, plural, one {יום אחד} other {# ימים}})',
  'analysis.have.twoMonths': '{countA, plural, one {יום אחד} other {# ימים}} ב{cur} ו{countB, plural, one {יום אחד} other {-# ימים}} ב{prev}',
  'analysis.have.noData': 'אין נתונים',
  'analysis.have.noSuchEmotion': 'אין רגש כזה',
  'analysis.have.fewerInEveryWindow': 'פחות מזה בכל חלון',

  // Sentences shared by the group-comparison detectors ----------------------------------
  'analysis.relation.text':
    'נראה שבנתונים שלך, {condition} {metricDefined} {gender, select, f {הייתה {direction, select, higher {גבוהה} other {נמוכה}}} other {היה {direction, select, higher {גבוה} other {נמוך}}}} יותר בממוצע ({meanA} לעומת {meanB}).',
  'analysis.correlation.text':
    'נראה שבנתונים שלך קיים קשר אפשרי בין {x} ל{y}: ככל ש{x} {xGender, select, f {הייתה גבוהה} other {היה גבוה}} יותר, {y} {yGender, select, f {נטתה להיות {direction, select, higher {גבוהה} other {נמוכה}}} other {נטה להיות {direction, select, higher {גבוה} other {נמוך}}}} יותר (מתאם {r}).',
  'analysis.explain.checkedDays': 'בדקתי {count, plural, one {יום אחד} other {# ימים}}.',
  'analysis.explain.onDaysCondition': '{count, plural, one {ביום אחד} other {ב-# ימים}} {conditionPast}.',
  'analysis.explain.groupMeans':
    '{metricDefined} {gender, select, f {הממוצעת} other {הממוצע}} בימים האלה {gender, select, f {הייתה} other {היה}} {meanA}, לעומת {meanB} בשאר הימים.',
  'analysis.explain.correlation': 'מתאם: {r}.',
  'analysis.explain.correlationBetween': 'מתאם ({predictor} מול {outcome}): {r}.',
  'analysis.explain.diffAndStrength': 'הפרש הממוצעים: {diff} נקודות. עוצמת הדפוס: {strength}.',
  'analysis.explain.diffStrength': 'הפרש: {diff} נקודות. עוצמת הדפוס: {strength}.',
  'analysis.split.corrExplainChecked': 'בדקתי {count, plural, one {יום אחד} other {# ימים}} שבהם דווחו גם {x} וגם {y}.',
  'analysis.split.corrExplainPearson': 'מתאם פירסון: {r} (עוצמה {strength}).',
  'analysis.split.corrExplainGroups':
    'לא היו מספיק ימים בכל קבוצה כדי להשוות ממוצעים ({groupA}: {countA, plural, one {יום אחד} other {# ימים}}; {groupB}: {countB, plural, one {יום אחד} other {# ימים}}; נדרשים לפחות {min} בכל קבוצה).',

  // Evidence table keys ---------------------------------------------------------------
  'analysis.extra.predictor': 'משתנה מנבא',
  'analysis.extra.strength': 'עוצמה',
  'analysis.extra.meanDiff': 'הפרש ממוצעים (א פחות ב)',
  'analysis.extra.cohenD': 'גודל אפקט (Cohen d)',
  'analysis.extra.weeksChecked': 'שבועות שנבדקו',
  'analysis.extra.weeklyTarget': 'יעד שבועי',
  'analysis.extra.target': 'יעד',
  'analysis.extra.frequency': 'תדירות',
  'analysis.extra.periodMean': 'ממוצע התקופה',
  'analysis.extra.overallMean': 'ממוצע כללי',
  'analysis.extra.stddev': 'סטיית תקן',
  'analysis.extra.slopePerDay': 'שיפוע ליום',
  'analysis.extra.daysInWindow': 'ימים בחלון',
  'analysis.extra.movingWindow': 'חלון הממוצע הנע',
  'analysis.extra.relativeChange': 'שינוי יחסי',
  'analysis.extra.longestStreak': 'הרצף הארוך ביותר בתקופה',
  'analysis.extra.shareOfEmotionDays': 'חלק מימי הרגש',
  'analysis.frequency.daily': 'יומי',
  'analysis.frequency.weekly': 'שבועי',
  'analysis.groupB.otherDays': 'שאר הימים',

  // Sleep detectors -------------------------------------------------------------------
  'analysis.sleep.groupA': 'ימים עם פחות מ-{hours} שעות שינה',
  'analysis.sleep.groupB': 'ימים עם {hours} שעות שינה או יותר',
  'analysis.sleep.condition': 'בימים שבהם ישנת פחות מ-{hours} שעות',
  'analysis.sleep.conditionPast': 'ישנת פחות מ-{hours} שעות',
  'analysis.sleepMood.label': 'הקשר בין שינה למצב רוח',
  'analysis.sleepMood.title': '{direction, select, lower {שינה קצרה ומצב רוח נמוך יותר} other {שינה קצרה ומצב רוח גבוה יותר}}',
  'analysis.sleepMood.corrTitle': 'קשר אפשרי בין שעות שינה למצב רוח',
  'analysis.sleepEnergy.label': 'הקשר בין שינה לרמת האנרגיה',
  'analysis.sleepEnergy.title': '{direction, select, lower {שינה קצרה ורמת אנרגיה נמוכה יותר} other {שינה קצרה ורמת אנרגיה גבוהה יותר}}',
  'analysis.sleepEnergy.corrTitle': 'קשר אפשרי בין שעות שינה לרמת האנרגיה',

  // Exercise detectors ----------------------------------------------------------------
  'analysis.exercise.groupA': 'ימים עם פעילות גופנית',
  'analysis.exercise.groupB': 'ימים ללא פעילות גופנית',
  'analysis.exercise.condition': 'בימים שבהם ביצעת פעילות גופנית',
  'analysis.exercise.conditionPast': 'ביצעת פעילות גופנית',
  'analysis.exerciseMood.label': 'הקשר בין פעילות גופנית למצב רוח',
  'analysis.exerciseMood.title': '{direction, select, higher {פעילות גופנית ומצב רוח גבוה יותר} other {פעילות גופנית ומצב רוח נמוך יותר}}',
  'analysis.exerciseMood.corrTitle': 'קשר אפשרי בין דקות פעילות למצב הרוח',
  'analysis.exerciseEnergy.label': 'הקשר בין פעילות גופנית לרמת האנרגיה',
  'analysis.exerciseEnergy.title': '{direction, select, higher {פעילות גופנית ורמת אנרגיה גבוהה יותר} other {פעילות גופנית ורמת אנרגיה נמוכה יותר}}',
  'analysis.exerciseEnergy.corrTitle': 'קשר אפשרי בין דקות פעילות לרמת האנרגיה',

  // Habit - mood / energy / stress ------------------------------------------------------
  'analysis.habit.detectorLabel': 'הקשר בין הרגלים למצב רוח',
  'analysis.habit.noHabits': 'אין הרגלים פעילים, ולכן לא בדקתי קשר בין הרגלים למצב רוח.',
  'analysis.habit.noLogs': 'להרגל "{habit}" אין עדיין דיווחים בתקופה, ולכן לא בדקתי קשר בינו למצב הרוח.',
  'analysis.habit.noFullWeeks': 'להרגל "{habit}" אין עדיין שבועות מלאים עם דיווחים, ולכן לא בדקתי קשר בינו למצב הרוח.',
  'analysis.habit.label': 'הקשר בין ההרגל "{habit}" ל{metric}',
  'analysis.habit.groupA': 'ימים שבהם ההרגל "{habit}" הושלם',
  'analysis.habit.groupB': 'ימים שבהם ההרגל "{habit}" לא הושלם',
  'analysis.habit.condition': 'בימים שבהם השלמת את ההרגל "{habit}"',
  'analysis.habit.conditionPast': 'השלמת את ההרגל "{habit}"',
  'analysis.habit.title':
    'הרגל "{habit}" ו{metric} {gender, select, f {{direction, select, higher {גבוהה} other {נמוכה}}} other {{direction, select, higher {גבוה} other {נמוך}}}} יותר',
  'analysis.habit.corrTitle': 'קשר אפשרי בין ההרגל "{habit}" ל{metric}',
  'analysis.habit.weeklyCondition': 'בשבועות שבהם עמדת ביעד של ההרגל "{habit}"',
  'analysis.habit.weeklyTarget': '{target} {unit} בשבוע',
  'analysis.habit.targetValue': '{target} {unit}',
  'analysis.habit.weeklyExplainChecked':
    'בדקתי {weeks, plural, one {שבוע מלא אחד} other {# שבועות מלאים}} ({days, plural, one {יום אחד} other {# ימים}} עם דיווח של {metric}).',
  'analysis.habit.weeklyExplainMet': '{count, plural, one {בשבוע אחד} other {ב-# שבועות}} עמדת ביעד של ההרגל ({target}).',
  'analysis.habit.weeklyExplainMeans':
    '{metricDefined} {gender, select, f {הממוצעת} other {הממוצע}} בימים של השבועות האלה {gender, select, f {הייתה} other {היה}} {meanA}, לעומת {meanB} בימים של {count, plural, one {שבוע אחד} other {# שבועות}} שלא עמדו ביעד.',
  'analysis.habit.groupAWeeks': 'ימים בשבועות שעמדו ביעד ({count, plural, one {שבוע אחד} other {# שבועות}})',
  'analysis.habit.groupBWeeks': 'ימים בשבועות מתחת ליעד ({count, plural, one {שבוע אחד} other {# שבועות}})',

  // Weekday differences -----------------------------------------------------------------
  'analysis.weekday.label': 'הבדלים בין ימי השבוע',
  'analysis.weekday.text':
    'נראה שבנתונים שלך, {onWeekday} {metricDefined} {gender, select, f {הייתה {direction, select, higher {גבוהה} other {נמוכה}}} other {היה {direction, select, higher {גבוה} other {נמוך}}}} יותר בממוצע מאשר בשאר ימי השבוע ({meanA} לעומת {meanB}).',
  'analysis.weekday.explainChecked': 'בדקתי {count, plural, one {יום אחד} other {# ימים}} עם דיווח של {metric}, מהם {countA} {weekdays}.',
  'analysis.weekday.explainMeans':
    '{metricDefined} {gender, select, f {הממוצעת} other {הממוצע}} {onWeekday} {gender, select, f {הייתה} other {היה}} {meanA}, לעומת {meanB} בשאר הימים.',
  'analysis.weekday.title':
    '{weekdays}: {metric} {gender, select, f {{direction, select, higher {גבוהה} other {נמוכה}}} other {{direction, select, higher {גבוה} other {נמוך}}}} יותר',
  'analysis.weekday.groupB': 'שאר ימי השבוע',
  'analysis.weekday.tableValue': '{mean} ({count, plural, one {יום אחד} other {# ימים}})',
  'analysis.weekday.nothing': 'בדקתי הבדלים בין ימי השבוע {count, plural, one {ביום אחד} other {ב-# ימים}} ולא מצאתי הבדל בולט.',

  // Time of day -------------------------------------------------------------------------
  'analysis.timeOfDay.label': 'הקשר בין שעת הכתיבה למצב הרוח',
  'analysis.timeOfDay.morning.label': 'בוקר',
  'analysis.timeOfDay.morning.phrase': 'בשעות הבוקר',
  'analysis.timeOfDay.late_morning.label': 'לפני הצהריים',
  'analysis.timeOfDay.late_morning.phrase': 'בשעות שלפני הצהריים',
  'analysis.timeOfDay.afternoon.label': 'אחר הצהריים',
  'analysis.timeOfDay.afternoon.phrase': 'בשעות אחר הצהריים',
  'analysis.timeOfDay.evening.label': 'ערב',
  'analysis.timeOfDay.evening.phrase': 'בשעות הערב',
  'analysis.timeOfDay.night.label': 'לילה',
  'analysis.timeOfDay.night.phrase': 'בשעות הלילה',
  'analysis.timeOfDay.tableKey': '{label} ({hours})',
  'analysis.timeOfDay.tableValue': 'ממוצע {mean}, {count, plural, one {דיווח אחד} other {# דיווחים}}',
  'analysis.timeOfDay.tableRow': '{key}: {value}',
  'analysis.timeOfDay.nothing': 'בדקתי את {label} {count, plural, one {בדיווח אחד} other {ב-# דיווחים}} ולא מצאתי חלון שעות שבולט מעל הממוצע.',
  'analysis.timeOfDay.text':
    'נראה שבנתונים שלך, מצב הרוח שדיווחת {phrase} ({hours}) היה הגבוה ביותר: {mean} בממוצע, לעומת {overall} בכל הדיווחים.',
  'analysis.timeOfDay.explainChecked':
    'בדקתי {count, plural, one {דיווח מצב רוח אחד} other {# דיווחי מצב רוח}} מ-{days, plural, one {יום אחד} other {# ימים}}, לפי שעת הכתיבה של הרשומה.',
  'analysis.timeOfDay.explainTable': '{table}. הממוצע הכללי: {overall}.',
  'analysis.timeOfDay.explainDiff': 'ההפרש בין חלון השעות הגבוה ביותר לממוצע הכללי: {diff} נקודות. עוצמת הדפוס: {strength}.',
  'analysis.timeOfDay.title': 'מצב רוח גבוה יותר {phrase}',
  'analysis.timeOfDay.groupA': 'דיווחים {phrase} ({hours})',
  'analysis.timeOfDay.groupB': 'שאר הדיווחים',

  // Trends ------------------------------------------------------------------------------
  'analysis.trends.label': 'מגמות במצב הרוח, בלחץ ובשינה',
  'analysis.trends.text':
    'נראה שבנתונים שלך {metricDefined} {gender, select, f {נמצאת} other {נמצא}} במגמת {direction, select, up {עלייה} other {ירידה}} {horizon, select, period {לאורך התקופה} monthly {בחודש האחרון} other {בשבועיים האחרונים}}: קו המגמה של הממוצע הנע {direction, select, up {עלה} other {ירד}} מ-{fromValue} ל-{toValue}.',
  'analysis.trends.explainChecked':
    'בדקתי {count, plural, one {יום אחד} other {# ימים}} עם דיווח של {metric} מתוך {len} הימים {horizon, select, period {בתקופה} other {האחרונים}} ({from}-{to}).',
  'analysis.trends.explainFit':
    'חישבתי ממוצע נע של {window} ימים וקו מגמה (רגרסיה ליניארית) דרכו: שיפוע של {slope} {unit, select, hours {שעות} other {נקודות}} ליום {direction, select, up {כלפי מעלה} other {כלפי מטה}}, כלומר שינוי של כ-{change} {unit, select, hours {שעות} other {נקודות}} לאורך החלון (מ-{fromValue} ל-{toValue} לפי קו המגמה). עוצמת המגמה: {strength}.',
  'analysis.trends.title':
    'מגמת {direction, select, up {עלייה} other {ירידה}} {metric, select, mood {במצב הרוח} energy {ברמת האנרגיה} stress {ברמת הלחץ} sleepHours {בשעות השינה} sleepQuality {באיכות השינה} exerciseMinutes {בדקות הפעילות הגופנית} other {במספר הרשומות}} {horizon, select, period {לאורך התקופה} monthly {בחודש האחרון} other {בשבועיים האחרונים}}',
  'analysis.trends.groupA': 'תחילת החלון (לפי קו המגמה)',
  'analysis.trends.groupB': 'סוף החלון (לפי קו המגמה)',
  'analysis.trends.slopeValue': '{slope} {unit, select, hours {שעות} other {נקודות}}',
  'analysis.trends.nothingSince': 'בדקתי מגמות במצב הרוח, בלחץ ובשינה מאז {from} ולא מצאתי מגמה בולטת.',
  'analysis.trends.nothingAll': 'בדקתי מגמות במצב הרוח, בלחץ ובשינה לאורך כל התקופה ולא מצאתי מגמה בולטת.',

  // Month comparison --------------------------------------------------------------------
  'analysis.periodCompare.label': 'השוואה בין החודש הנוכחי לחודש הקודם',
  'analysis.periodCompare.text':
    'נראה שבנתונים שלך {metricDefined} ב{cur} {gender, select, f {הייתה {direction, select, higher {גבוהה} other {נמוכה}}} other {היה {direction, select, higher {גבוה} other {נמוך}}}} יותר בממוצע מאשר ב{prev} ({meanA} לעומת {meanB}).',
  'analysis.periodCompare.explain':
    'השוויתי את הימים עם דיווח של {metric} ב{cur} ({countA, plural, one {יום אחד} other {# ימים}}, עד היום) לימים ב{prev} ({countB, plural, one {יום אחד} other {# ימים}}). הממוצע ב{cur}: {meanA}; ב{prev}: {meanB}. הפרש: {diff} {unit, select, hours {שעות} other {נקודות}}. עוצמת ההבדל: {strength}.',
  'analysis.periodCompare.title':
    // A noun ("עלייה" / "ירידה") instead of an adjective: the label "שעות שינה" is plural while
    // its gender ('m') belongs to "מספר שעות השינה", so "שעות שינה ...: נמוך יותר" was ungrammatical.
    '{metric} ב{cur} לעומת {prev}: {gender, select, other {{direction, select, higher {עלייה} other {ירידה}}}}',
  'analysis.periodCompare.entriesText':
    'נראה שכתבת {direction, select, more {יותר} other {פחות}} ב-{window} הימים הראשונים של {cur} ({countA, plural, one {רשומה אחת} other {# רשומות}}) מאשר ב-{window} הימים הראשונים של {prev} ({countB, plural, one {רשומה אחת} other {# רשומות}}).',
  'analysis.periodCompare.entriesExplain':
    'ספרתי את הרשומות ב-{window} הימים הראשונים של כל חודש, כדי להשוות חלונות זמן שווים: {cur} - {countA, plural, one {רשומה אחת} other {# רשומות}}, {prev} - {countB, plural, one {רשומה אחת} other {# רשומות}}. הפרש: {diff, plural, one {רשומה אחת} other {# רשומות}} ({percent}). עוצמת ההבדל: {strength}.',
  'analysis.periodCompare.entriesTitle': '{direction, select, more {יותר} other {פחות}} רשומות ב{cur} מאשר ב{prev}',
  'analysis.periodCompare.monthWindow': '{month} ({window} ימים ראשונים)',
  'analysis.periodCompare.insufficientWhat': 'ההשוואה בין {cur} ל{prev}',
  'analysis.periodCompare.nothing': 'השוויתי את {cur} ל{prev} ולא מצאתי הבדל בולט במצב הרוח, בלחץ, בשינה או במספר הרשומות.',

  // Habit trend (improved / declined) -----------------------------------------------------
  'analysis.habitsTrend.label': 'הרגלים שהשתפרו או נחלשו',
  'analysis.habitsTrend.whether': 'אם ההרגל "{habit}" השתפר או נחלש',
  'analysis.habitsTrend.textDaily':
    'נראה שההרגל "{habit}" {direction, select, improved {השתפר} other {נחלש}}: בשבועיים האחרונים השלמת אותו ב-{recent} מתוך {window} ימים, לעומת {previous} מתוך {window} בשבועיים שלפני.',
  'analysis.habitsTrend.textWeekly':
    'נראה שההרגל "{habit}" {direction, select, improved {השתפר} other {נחלש}}: בשבועיים האחרונים צברת {recent} {unit}, לעומת {previous} בשבועיים שלפני (היעד: {target} {unit} בשבוע).',
  'analysis.habitsTrend.explain':
    'השוויתי את שיעור ההשלמה של ההרגל בשבועיים האחרונים ({recentFrom}-{recentTo}) לשבועיים שלפניהם ({previousFrom}-{previousTo}): {recentRate} לעומת {previousRate}. הפרש: {diff} נקודות אחוז. עוצמת השינוי: {strength}.',
  'analysis.habitsTrend.title': 'ההרגל "{habit}" {direction, select, improved {השתפר} other {נחלש}} בשבועיים האחרונים',
  'analysis.habitsTrend.metric': 'שיעור השלמה - {habit}',
  'analysis.habitsTrend.groupA': 'שבועיים אחרונים',
  'analysis.habitsTrend.groupB': 'שבועיים קודמים',

  // Best / hardest days ------------------------------------------------------------------
  'analysis.bestWorst.label': 'הימים הטובים והקשים ביותר',
  'analysis.bestWorst.describedDay': '{day} ("{title}")',
  'analysis.bestWorst.noTitle': 'ללא כותרת',
  'analysis.bestWorst.extraValue': '{titles} - ציון {score}',
  'analysis.bestWorst.text':
    'הימים {kind, select, best {הטובים ביותר} other {הקשים ביותר}} בתקופה, לפי ציון משולב של מצב רוח, אנרגיה ולחץ: {days}.',
  'analysis.bestWorst.explainScore':
    'חישבתי לכל אחד מ-{count, plural, one {יום אחד} other {# ימים}} ציון משולב: ממוצע של מצב הרוח, רמת האנרגיה ו-(11 פחות רמת הלחץ), לפי הערכים שדווחו באותו יום.',
  'analysis.bestWorst.explainMeans':
    'הציון הממוצע בתקופה: {overall}. {kind, select, best {{count, plural, one {היום הטוב ביותר קיבל} =3 {שלושת הימים הטובים ביותר קיבלו} other {הימים הטובים ביותר קיבלו}}} other {{count, plural, one {היום הקשה ביותר קיבל} =3 {שלושת הימים הקשים ביותר קיבלו} other {הימים הקשים ביותר קיבלו}}}} בממוצע {mean}.',
  'analysis.bestWorst.explainDiff': 'הפרש מהממוצע: {diff} נקודות. עוצמת ההבדל: {strength}.',
  'analysis.bestWorst.title': '{kind, select, best {הימים הטובים ביותר בתקופה} other {הימים הקשים ביותר בתקופה}}',
  'analysis.bestWorst.metric': 'ציון משולב (מצב רוח + אנרגיה + לחץ הפוך)',
  'analysis.bestWorst.groupA': 'הימים {kind, select, best {הטובים ביותר} other {הקשים ביותר}}',
  'analysis.bestWorst.nothing': 'בדקתי את {label} {count, plural, one {ביום אחד} other {ב-# ימים}}; הציונים היו דומים ולא בלט יום מסוים.',

  // Streaks -------------------------------------------------------------------------------
  'analysis.streaks.label': 'רצפי כתיבה והשלמת הרגלים',
  'analysis.streaks.entriesTitle': 'רצף כתיבה של {count, plural, one {יום אחד} other {# ימים}}',
  'analysis.streaks.entriesText': 'כל הכבוד! כתבת ביומן {count, plural, one {יום אחד} other {# ימים}} ברציפות ({from}-{to}).',
  'analysis.streaks.entriesExplain':
    'ספרתי את הימים הרצופים עם לפחות רשומה אחת, עד היום או עד אתמול. הרצף הנוכחי: {count, plural, one {יום אחד} other {# ימים}}, מ-{from} עד {to}. הרצף הארוך ביותר בתקופה: {best, plural, one {יום אחד} other {# ימים}}.',
  'analysis.streaks.entriesMetric': 'ימי כתיבה',
  'analysis.streaks.currentDays': 'ימים ברצף הנוכחי',
  'analysis.streaks.daysWithEntry': 'ימים עם רשומה בתקופה',
  'analysis.streaks.habitTitle': 'רצף של {count, plural, one {יום אחד} other {# ימים}} בהרגל "{habit}"',
  'analysis.streaks.habitText': 'השלמת את ההרגל "{habit}" {count, plural, one {יום אחד} other {# ימים}} ברציפות ({from}-{to}).',
  'analysis.streaks.habitExplain':
    'ספרתי את הימים הרצופים שבהם ההרגל "{habit}" סומן כהושלם, עד היום או עד אתמול. הרצף הנוכחי: {count, plural, one {יום אחד} other {# ימים}}. הרצף הארוך ביותר בתקופה: {best, plural, one {יום אחד} other {# ימים}}.',
  'analysis.streaks.habitMetric': 'השלמת ההרגל {habit}',
  'analysis.streaks.daysCompleted': 'ימים שבהם ההרגל הושלם בתקופה',
  'analysis.streaks.weeklyTitle': 'רצף של {count, plural, one {שבוע אחד} other {# שבועות}} בהרגל "{habit}"',
  'analysis.streaks.weeklyText': 'עמדת ביעד של ההרגל "{habit}" {count, plural, one {שבוע אחד} other {# שבועות}} ברציפות ({from}-{to}).',
  'analysis.streaks.weeklyExplain':
    'סיכמתי את הכמות שדווחה להרגל "{habit}" בכל שבוע והשוויתי ליעד השבועי ({target}). הרצף הנוכחי של שבועות שעמדו ביעד: {count, plural, one {שבוע אחד} other {# שבועות}}.',
  'analysis.streaks.weeklyMetric': 'עמידה ביעד השבועי - {habit}',
  'analysis.streaks.currentWeeks': 'שבועות ברצף הנוכחי',
  'analysis.streaks.weeksWithLogs': 'שבועות עם דיווח בתקופה',
  'analysis.streaks.none':
    'לא נמצאו רצפים פעילים (רצף כתיבה של {entryMin} ימים ומעלה, או רצף הרגל של {habitMin} ימים או שבועות ומעלה).',

  // Anomalies -----------------------------------------------------------------------------
  'analysis.anomalies.label': 'ימים חריגים במצב הרוח או בלחץ',
  'analysis.anomalies.textOne':
    'נראה שב{day} {metricDefined} {gender, select, f {הייתה {side, select, high {גבוהה} other {נמוכה}}} other {היה {side, select, high {גבוה} other {נמוך}}}} במיוחד ביחס לשאר התקופה ({value}, לעומת ממוצע של {mean}).',
  'analysis.anomalies.textMany':
    'נראה ש{count, plural, one {ביום אחד} other {ב-# ימים}} {metricDefined} {gender, select, f {הייתה {side, select, high {גבוהה} other {נמוכה}}} other {היה {side, select, high {גבוה} other {נמוך}}}} במיוחד ביחס לשאר התקופה: {days}; הממוצע בתקופה: {mean}.',
  'analysis.anomalies.textManyMore':
    'נראה ש{count, plural, one {ביום אחד} other {ב-# ימים}} {metricDefined} {gender, select, f {הייתה {side, select, high {גבוהה} other {נמוכה}}} other {היה {side, select, high {גבוה} other {נמוך}}}} במיוחד ביחס לשאר התקופה: {days} ועוד; הממוצע בתקופה: {mean}.',
  'analysis.anomalies.dayItem': '{day} ({value})',
  'analysis.anomalies.detail': '{date}: {value} ({z} סטיות תקן {side, select, above {מעל} other {מתחת}} לממוצע)',
  'analysis.anomalies.explain':
    'בדקתי {count, plural, one {יום אחד} other {# ימים}} עם דיווח של {metric}. הממוצע: {mean}, סטיית התקן: {sd}. יום נחשב חריג כשהערך בו רחוק מהממוצע ב-{z} סטיות תקן או יותר. {details}. עוצמת החריגה: {strength}.',
  'analysis.anomalies.title':
    '{count, plural, one {יום} other {ימים}} עם {metric} {gender, select, f {{side, select, high {גבוהה} other {נמוכה}}} other {{side, select, high {גבוה} other {נמוך}}}} במיוחד',
  'analysis.anomalies.groupA': 'ימים חריגים',
  'analysis.anomalies.zValue': '{value} (z {z})',
  'analysis.anomalies.nothing':
    'בדקתי ימים חריגים {count, plural, one {ביום אחד} other {ב-# ימים}} ולא מצאתי יום שחורג מהממוצע ב-{z} סטיות תקן או יותר.',

  // Emotion patterns ----------------------------------------------------------------------
  'analysis.emotion.label': 'דפוסי רגשות לפי ימים, אנשים ומקומות',
  'analysis.emotion.metric': 'הרגש {emotion}',
  'analysis.emotion.groupA': 'ימים עם הרגש "{emotion}"',
  'analysis.emotion.weekdayTitle': 'הרגש "{emotion}" מופיע בעיקר {onWeekday}',
  'analysis.emotion.weekdayText': 'נראה שבנתונים שלך הרגש "{emotion}" הופיע בעיקר {onWeekday} ({top} מתוך {total} הפעמים).',
  'analysis.emotion.weekdayExplain':
    'בדקתי {count, plural, one {יום אחד} other {# ימים}}. הרגש "{emotion}" דווח {total, plural, one {ביום אחד} other {ב-# ימים}}; {top} מהם היו {weekdays} ({share}), בעוד ש{weekdays} הם {baseline} מכלל הימים שנבדקו. עוצמת הדפוס: {strength}.',
  'analysis.emotion.groupBWeekday': 'מהם {weekdays}',
  'analysis.emotion.weekdayShareKey': 'חלק {weekdays} מכלל הימים',
  'analysis.emotion.personTitle': 'הרגש "{emotion}" ו{name}',
  'analysis.emotion.placeTitle': 'הרגש "{emotion}" ו"{place}"',
  'analysis.emotion.personText':
    'נראה שבנתונים שלך הרגש "{emotion}" הופיע לעיתים קרובות בימים שבהם נפגשת עם {name} ({with} מתוך {total} הפעמים).',
  'analysis.emotion.placeText':
    'נראה שבנתונים שלך הרגש "{emotion}" הופיע לעיתים קרובות בימים שבהם המיקום היה "{place}" ({with} מתוך {total} הפעמים).',
  'analysis.emotion.personExplain':
    'בדקתי {count, plural, one {יום אחד} other {# ימים}}. הרגש "{emotion}" דווח ב-{total} ימים; ב-{with} מהם ({share}) הופיע גם {name} ברשומה. {name} מופיע בסך הכול ב-{baselineCount} מתוך {count} הימים ({baseline}). עוצמת הדפוס: {strength}.',
  'analysis.emotion.placeExplain':
    'בדקתי {count, plural, one {יום אחד} other {# ימים}}. הרגש "{emotion}" דווח ב-{total} ימים; ב-{with} מהם ({share}) הופיע גם המיקום "{place}" ברשומה. המיקום "{place}" מופיע בסך הכול ב-{baselineCount} מתוך {count} הימים ({baseline}). עוצמת הדפוס: {strength}.',
  'analysis.emotion.groupBPerson': 'מהם עם {name}',
  'analysis.emotion.groupBPlace': 'מהם ב"{place}"',
  'analysis.emotion.personShareKey': 'חלק {name} מכלל הימים',
  'analysis.emotion.placeShareKey': 'חלק המיקום "{place}" מכלל הימים',
  'analysis.emotion.nothing':
    'בדקתי {count, plural, one {רגש אחד} other {# רגשות}} שחזרו לפחות {min} פעמים ולא מצאתי ריכוז בולט בימים מסוימים, באנשים או במקומות.',
};
export default messages;
