/**
 * cs - analysis messages (server-side insight templates, notes and labels). Keys are prefixed
 * 'analysis.'; see shared/i18n/index.ts for the template syntax and the English file for the
 * conventions.
 *
 * Czech notes:
 *  - Every sentence is hedged ("V tvých datech to vypadá, že…", "možná souvislost") and never causal.
 *  - The app's own "I checked / I found" becomes impersonal ("Zkontrolováno…", "Kontrola … nenašla…",
 *    "Počet dní, kdy…"), because a Czech first-person past tense needs a gender; the user's actions
 *    are phrased without gendered past forms too ("ve dnech s pohybovou aktivitou").
 *  - `gender` classes: 'f' (nálada, úroveň energie/stresu, kvalita spánku -> "byla … vyšší/nižší"),
 *    'fd' for the feminine duration nouns (délka spánku / cvičení -> "byla … delší/kratší") and
 *    'm' (počet záznamů -> "byl … vyšší/nižší").
 *  - Labels ('*.label') are nominative; where English puts a label in another case ("with a mood
 *    report") the sentence names the field instead ("se zapsaným údajem „nálada“").
 *  - Month names arrive in the nominative; "za {cur}" (accusative = nominative for every month) keeps them intact.
 *  - Counts use one / few / other plus many for decimals; differences are always decimals ("1,3 bodu").
 */
const messages: Record<string, string> = {
  // Engine / provider -----------------------------------------------------------------
  'analysis.engine.providerFailed': 'Analýza vzorců se nedokončila (vnitřní chyba). Zkus to prosím později.',
  'analysis.engine.detectorFailed': 'Kontrola „{label}“ se nedokončila (vnitřní chyba); ostatní postřehy jsou v pořádku.',

  // Strength (always after "síla": "Síla vzorce: slabá") -------------------------------
  'analysis.strength.weak': 'slabá',
  'analysis.strength.moderate': 'střední',
  'analysis.strength.strong': 'silná',

  // Metrics: label (short, standalone), defined (subject inside a sentence), gender -----
  'analysis.metric.mood.label': 'nálada',
  'analysis.metric.mood.defined': 'tvoje nálada',
  'analysis.metric.mood.gender': 'f',
  'analysis.metric.energy.label': 'úroveň energie',
  'analysis.metric.energy.defined': 'tvoje úroveň energie',
  'analysis.metric.energy.gender': 'f',
  'analysis.metric.stress.label': 'úroveň stresu',
  'analysis.metric.stress.defined': 'tvoje úroveň stresu',
  'analysis.metric.stress.gender': 'f',
  'analysis.metric.sleepHours.label': 'délka spánku',
  'analysis.metric.sleepHours.defined': 'délka tvého spánku',
  'analysis.metric.sleepHours.gender': 'fd',
  'analysis.metric.sleepQuality.label': 'kvalita spánku',
  'analysis.metric.sleepQuality.defined': 'kvalita tvého spánku',
  'analysis.metric.sleepQuality.gender': 'f',
  'analysis.metric.exerciseMinutes.label': 'délka cvičení',
  'analysis.metric.exerciseMinutes.defined': 'délka tvého cvičení',
  'analysis.metric.exerciseMinutes.gender': 'fd',
  'analysis.metric.entries.label': 'počet záznamů',
  'analysis.metric.entries.defined': 'počet tvých záznamů',
  'analysis.metric.entries.gender': 'm',

  // Counts and dates ------------------------------------------------------------------
  'analysis.count.days': '{count, plural, one {# den} few {# dny} many {# dne} other {# dní}}',
  'analysis.count.weeks': '{count, plural, one {# týden} few {# týdny} many {# týdne} other {# týdnů}}',
  // "7. 9. 2026 (pondělí)" - sentences put "dne" before it
  'analysis.date.dayWithDate': '{date} ({weekday})',

  // Weekdays (index 0 = Sunday) --------------------------------------------------------
  'analysis.weekday.plural.0': 'neděle',
  'analysis.weekday.plural.1': 'pondělky',
  'analysis.weekday.plural.2': 'úterky',
  'analysis.weekday.plural.3': 'středy',
  'analysis.weekday.plural.4': 'čtvrtky',
  'analysis.weekday.plural.5': 'pátky',
  'analysis.weekday.plural.6': 'soboty',
  'analysis.weekday.on.0': 'o nedělích',
  'analysis.weekday.on.1': 'o pondělcích',
  'analysis.weekday.on.2': 'o úterých',
  'analysis.weekday.on.3': 'o středách',
  'analysis.weekday.on.4': 'o čtvrtcích',
  'analysis.weekday.on.5': 'o pátcích',
  'analysis.weekday.on.6': 'o sobotách',

  // Notes shared by the detectors -------------------------------------------------------
  'analysis.note.insufficient': 'Pro tuto kontrolu zatím není dost dat: {what} (potřeba je alespoň {required}; k dispozici: {have}).',
  'analysis.note.insufficientWhether': 'Zatím není dost dat k ověření, {what} (potřeba je alespoň {required}; k dispozici: {have}).',
  'analysis.note.nothingNotable':
    'Kontrola ({what}) za {count, plural, one {# den} few {# dny} many {# dne} other {# dní}} nenašla žádný výrazný rozdíl.',

  // Requirement / availability phrases used inside the notes above ----------------------
  'analysis.req.daysBothValues':
    '{count, plural, one {# den s oběma hodnotami} few {# dny s oběma hodnotami} many {# dne s oběma hodnotami} other {# dní s oběma hodnotami}}',
  'analysis.req.daysPerGroup':
    '{count, plural, one {# den v každé skupině} few {# dny v každé skupině} many {# dne v každé skupině} other {# dní v každé skupině}}',
  'analysis.req.daysWithReport':
    '{count, plural, one {# den se záznamem} few {# dny se záznamem} many {# dne se záznamem} other {# dní se záznamem}}',
  'analysis.req.daysWithRatings':
    '{count, plural, one {# den s hodnocením} few {# dny s hodnocením} many {# dne s hodnocením} other {# dní s hodnocením}}',
  'analysis.req.daysPerMonth':
    '{count, plural, one {# den se záznamem v každém měsíci} few {# dny se záznamem v každém měsíci} many {# dne se záznamem v každém měsíci} other {# dní se záznamem v každém měsíci}}',
  'analysis.req.recentDays':
    '{count, plural, one {# den se záznamem za poslední dva týdny} few {# dny se záznamem za poslední dva týdny} many {# dne se záznamem za poslední dva týdny} other {# dní se záznamem za poslední dva týdny}}',
  'analysis.req.fullWeeks':
    '{count, plural, one {# celý týden se záznamy} few {# celé týdny se záznamy} many {# celého týdne se záznamy} other {# celých týdnů se záznamy}}',
  'analysis.req.weeksOfLogs':
    '{count, plural, one {# týden záznamů} few {# týdny záznamů} many {# týdne záznamů} other {# týdnů záznamů}}',
  'analysis.req.weekPerGroup':
    'jeden týden v každé skupině a {count, plural, one {# den} few {# dny} many {# dne} other {# dní}} se záznamem v každé skupině',
  'analysis.req.moodReports':
    '{count, plural, one {# záznam nálady} few {# záznamy nálady} many {# záznamu nálady} other {# záznamů nálady}}',
  'analysis.req.reportsInWindow':
    '{count, plural, one {# záznam v jednom časovém úseku} few {# záznamy v jednom časovém úseku} many {# záznamu v jednom časovém úseku} other {# záznamů v jednom časovém úseku}}',
  'analysis.req.emotionRepeated':
    'jedna emoce zaznamenaná {count, plural, one {v # dni} few {ve # dnech} many {v # dne} other {v # dnech}}',
  'analysis.have.twoGroups':
    '{groupA}: {countA, plural, one {# den} few {# dny} many {# dne} other {# dní}}; {groupB}: {countB, plural, one {# den} few {# dny} many {# dne} other {# dní}}',
  'analysis.have.weeksTwoGroups':
    'týdny se splněným cílem: {metWeeks, plural, one {# týden} few {# týdny} many {# týdne} other {# týdnů}} ({metDays, plural, one {# den} few {# dny} many {# dne} other {# dní}}); týdny pod cílem: {belowWeeks, plural, one {# týden} few {# týdny} many {# týdne} other {# týdnů}} ({belowDays, plural, one {# den} few {# dny} many {# dne} other {# dní}})',
  'analysis.have.twoMonths':
    '{cur}: {countA, plural, one {# den} few {# dny} many {# dne} other {# dní}}, {prev}: {countB, plural, one {# den} few {# dny} many {# dne} other {# dní}}',
  'analysis.have.noData': 'žádná data',
  'analysis.have.noSuchEmotion': 'zatím žádná',
  'analysis.have.fewerInEveryWindow': 'v každém úseku méně',

  // Sentences shared by the group-comparison detectors ----------------------------------
  'analysis.relation.text':
    'V tvých datech to vypadá, že {condition} {gender, select, fd {byla {metricDefined} {direction, select, higher {v průměru delší} other {v průměru kratší}}} m {byl {metricDefined} {direction, select, higher {v průměru vyšší} other {v průměru nižší}}} other {byla {metricDefined} {direction, select, higher {v průměru vyšší} other {v průměru nižší}}}} ({meanA} vs. {meanB}).',
  'analysis.correlation.text':
    'Vypadá to, že by v tvých datech mohla existovat souvislost mezi dvěma ukazateli – {x} a {y}: {xGender, select, fd {když byla {x} delší} m {když byl {x} vyšší} other {když byla {x} vyšší}}, {yGender, select, fd {{y} bývala {direction, select, higher {spíše delší} other {spíše kratší}}} m {{y} býval {direction, select, higher {spíše vyšší} other {spíše nižší}}} other {{y} bývala {direction, select, higher {spíše vyšší} other {spíše nižší}}}} (korelace {r}).',
  'analysis.explain.checkedDays': 'Zkontrolováno: {count, plural, one {# den} few {# dny} many {# dne} other {# dní}}.',
  'analysis.explain.onDaysCondition': 'Počet dní, kdy {conditionPast}: {count}.',
  'analysis.explain.groupMeans':
    'V těchto dnech {gender, select, m {byl {metricDefined} v průměru {meanA}} other {byla {metricDefined} v průměru {meanA}}}, v ostatních dnech {meanB}.',
  'analysis.explain.correlation': 'Korelace: {r}.',
  'analysis.explain.correlationBetween': 'Korelace ({predictor} vs. {outcome}): {r}.',
  'analysis.explain.diffAndStrength': 'Rozdíl mezi průměry: {diff} bodu. Síla vzorce: {strength}.',
  'analysis.explain.diffStrength': 'Rozdíl: {diff} bodu. Síla vzorce: {strength}.',
  'analysis.split.corrExplainChecked': 'Počet zkontrolovaných dní, kdy byly zaznamenány oba ukazatele ({x} i {y}): {count}.',
  'analysis.split.corrExplainPearson': 'Pearsonova korelace: {r} (síla: {strength}).',
  'analysis.split.corrExplainGroups':
    'V jednotlivých skupinách nebylo dost dní na porovnání průměrů ({groupA}: {countA, plural, one {# den} few {# dny} many {# dne} other {# dní}}; {groupB}: {countB, plural, one {# den} few {# dny} many {# dne} other {# dní}}; potřeba je alespoň {min} v každé skupině).',

  // Evidence table keys ---------------------------------------------------------------
  'analysis.extra.predictor': 'Prediktor',
  'analysis.extra.strength': 'Síla',
  'analysis.extra.meanDiff': 'Rozdíl průměrů (A minus B)',
  'analysis.extra.cohenD': 'Velikost účinku (Cohenovo d)',
  'analysis.extra.weeksChecked': 'Zkontrolované týdny',
  'analysis.extra.weeklyTarget': 'Týdenní cíl',
  'analysis.extra.target': 'Cíl',
  'analysis.extra.frequency': 'Četnost',
  'analysis.extra.periodMean': 'Průměr za období',
  'analysis.extra.overallMean': 'Celkový průměr',
  'analysis.extra.stddev': 'Směrodatná odchylka',
  'analysis.extra.slopePerDay': 'Sklon za den',
  'analysis.extra.daysInWindow': 'Dny v okně',
  'analysis.extra.movingWindow': 'Okno klouzavého průměru',
  'analysis.extra.relativeChange': 'Relativní změna',
  'analysis.extra.longestStreak': 'Nejdelší série v období',
  'analysis.extra.shareOfEmotionDays': 'Podíl dní s danou emocí',
  'analysis.frequency.daily': 'denní',
  'analysis.frequency.weekly': 'týdenní',
  'analysis.groupB.otherDays': 'Ostatní dny',

  // Sleep detectors -------------------------------------------------------------------
  'analysis.sleep.groupA': 'Dny s méně než {hours, plural, one {# hodinou} few {# hodinami} many {# hodiny} other {# hodinami}} spánku',
  'analysis.sleep.groupB': 'Dny s {hours, plural, one {# hodinou} few {# hodinami} many {# hodiny} other {# hodinami}} spánku nebo více',
  'analysis.sleep.condition': 've dnech s méně než {hours, plural, one {# hodinou} few {# hodinami} many {# hodiny} other {# hodinami}} spánku',
  'analysis.sleep.conditionPast': 'spánek trval méně než {hours, plural, one {# hodinu} few {# hodiny} many {# hodiny} other {# hodin}}',
  'analysis.sleepMood.label': 'souvislost mezi spánkem a náladou',
  'analysis.sleepMood.title': '{direction, select, lower {Krátký spánek a horší nálada} other {Krátký spánek a lepší nálada}}',
  'analysis.sleepMood.corrTitle': 'Možná souvislost mezi délkou spánku a náladou',
  'analysis.sleepEnergy.label': 'souvislost mezi spánkem a úrovní energie',
  'analysis.sleepEnergy.title': '{direction, select, lower {Krátký spánek a nižší energie} other {Krátký spánek a vyšší energie}}',
  'analysis.sleepEnergy.corrTitle': 'Možná souvislost mezi délkou spánku a úrovní energie',

  // Exercise detectors ----------------------------------------------------------------
  'analysis.exercise.groupA': 'Dny s pohybovou aktivitou',
  'analysis.exercise.groupB': 'Dny bez pohybové aktivity',
  'analysis.exercise.condition': 've dnech s pohybovou aktivitou',
  'analysis.exercise.conditionPast': 'byla zaznamenána pohybová aktivita',
  'analysis.exerciseMood.label': 'souvislost mezi pohybovou aktivitou a náladou',
  'analysis.exerciseMood.title': '{direction, select, higher {Pohybová aktivita a lepší nálada} other {Pohybová aktivita a horší nálada}}',
  'analysis.exerciseMood.corrTitle': 'Možná souvislost mezi délkou cvičení a náladou',
  'analysis.exerciseEnergy.label': 'souvislost mezi pohybovou aktivitou a úrovní energie',
  'analysis.exerciseEnergy.title': '{direction, select, higher {Pohybová aktivita a vyšší energie} other {Pohybová aktivita a nižší energie}}',
  'analysis.exerciseEnergy.corrTitle': 'Možná souvislost mezi délkou cvičení a úrovní energie',

  // Habit - mood / energy / stress ------------------------------------------------------
  'analysis.habit.detectorLabel': 'souvislost mezi návyky a náladou',
  'analysis.habit.noHabits': 'Nejsou žádné aktivní návyky, takže souvislost mezi návyky a náladou se nezkoumala.',
  'analysis.habit.noLogs': 'Návyk „{habit}“ zatím v tomto období nemá žádné záznamy, takže jeho souvislost s náladou se nezkoumala.',
  'analysis.habit.noFullWeeks': 'Návyk „{habit}“ zatím nemá žádný celý týden se záznamy, takže jeho souvislost s náladou se nezkoumala.',
  'analysis.habit.label': 'souvislost: návyk „{habit}“ a {metric}',
  'analysis.habit.groupA': 'Dny, kdy byl návyk „{habit}“ splněn',
  'analysis.habit.groupB': 'Dny, kdy návyk „{habit}“ splněn nebyl',
  'analysis.habit.condition': 've dnech se splněným návykem „{habit}“',
  'analysis.habit.conditionPast': 'byl splněn návyk „{habit}“',
  'analysis.habit.title':
    'Návyk „{habit}“: {gender, select, fd {{direction, select, higher {{metric} v průměru delší} other {{metric} v průměru kratší}}} other {{direction, select, higher {{metric} v průměru vyšší} other {{metric} v průměru nižší}}}}',
  'analysis.habit.corrTitle': 'Možná souvislost: návyk „{habit}“ a {metric}',
  'analysis.habit.weeklyCondition': 'v týdnech se splněným cílem návyku „{habit}“',
  'analysis.habit.weeklyTarget': '{target} {unit} za týden',
  'analysis.habit.targetValue': '{target} {unit}',
  'analysis.habit.weeklyExplainChecked':
    'Zkontrolovány byly celé týdny: {weeks, plural, one {# týden} few {# týdny} many {# týdne} other {# týdnů}} ({days, plural, one {# den} few {# dny} many {# dne} other {# dní}} se zapsaným údajem „{metric}“).',
  'analysis.habit.weeklyExplainMet': 'Počet týdnů se splněným cílem návyku ({target}): {count}.',
  'analysis.habit.weeklyExplainMeans':
    'Ve dnech těchto týdnů {gender, select, m {byl {metricDefined} v průměru {meanA}} other {byla {metricDefined} v průměru {meanA}}}, ve dnech týdnů pod cílem ({count, plural, one {# týden} few {# týdny} many {# týdne} other {# týdnů}}) {meanB}.',
  'analysis.habit.groupAWeeks':
    'Dny v týdnech se splněným cílem ({count, plural, one {# týden} few {# týdny} many {# týdne} other {# týdnů}})',
  'analysis.habit.groupBWeeks': 'Dny v týdnech pod cílem ({count, plural, one {# týden} few {# týdny} many {# týdne} other {# týdnů}})',

  // Weekday differences -----------------------------------------------------------------
  'analysis.weekday.label': 'rozdíly mezi dny v týdnu',
  'analysis.weekday.text':
    'V tvých datech to vypadá, že {onWeekday} {gender, select, fd {byla {metricDefined} {direction, select, higher {v průměru delší} other {v průměru kratší}}} m {byl {metricDefined} {direction, select, higher {v průměru vyšší} other {v průměru nižší}}} other {byla {metricDefined} {direction, select, higher {v průměru vyšší} other {v průměru nižší}}}} než v ostatní dny v týdnu ({meanA} vs. {meanB}).',
  'analysis.weekday.explainChecked':
    'Počet zkontrolovaných dní se zapsaným údajem „{metric}“: {count, plural, one {# den} few {# dny} many {# dne} other {# dní}}, z toho {weekdays}: {countA}.',
  'analysis.weekday.explainMeans':
    'V průměru {gender, select, m {byl {metricDefined} {onWeekday} {meanA}} other {byla {metricDefined} {onWeekday} {meanA}}}, v ostatních dnech {meanB}.',
  'analysis.weekday.title':
    'Dny v týdnu – {weekdays}: {gender, select, fd {{direction, select, higher {{metric} v průměru delší} other {{metric} v průměru kratší}}} other {{direction, select, higher {{metric} v průměru vyšší} other {{metric} v průměru nižší}}}}',
  'analysis.weekday.groupB': 'Ostatní dny v týdnu',
  'analysis.weekday.tableValue': '{mean} ({count, plural, one {# den} few {# dny} many {# dne} other {# dní}})',
  'analysis.weekday.nothing':
    'Kontrola rozdílů mezi dny v týdnu za {count, plural, one {# den} few {# dny} many {# dne} other {# dní}} nenašla žádný výrazný rozdíl.',

  // Time of day -------------------------------------------------------------------------
  'analysis.timeOfDay.label': 'souvislost mezi časem psaní a náladou',
  'analysis.timeOfDay.morning.label': 'Ráno',
  'analysis.timeOfDay.morning.phrase': 'ráno',
  'analysis.timeOfDay.late_morning.label': 'Dopoledne',
  'analysis.timeOfDay.late_morning.phrase': 'dopoledne',
  'analysis.timeOfDay.afternoon.label': 'Odpoledne',
  'analysis.timeOfDay.afternoon.phrase': 'odpoledne',
  'analysis.timeOfDay.evening.label': 'Večer',
  'analysis.timeOfDay.evening.phrase': 'večer',
  'analysis.timeOfDay.night.label': 'Noc',
  'analysis.timeOfDay.night.phrase': 'v noci',
  'analysis.timeOfDay.tableKey': '{label} ({hours})',
  'analysis.timeOfDay.tableValue':
    'průměr {mean}, {count, plural, one {# záznam} few {# záznamy} many {# záznamu} other {# záznamů}}',
  'analysis.timeOfDay.tableRow': '{key}: {value}',
  'analysis.timeOfDay.nothing':
    'Kontrola ({label}) na základě {count, plural, one {# záznamu} few {# záznamů} many {# záznamu} other {# záznamů}} nenašla žádný časový úsek, který by vyčníval nad průměr.',
  'analysis.timeOfDay.text':
    'V tvých datech to vypadá, že nálada zapsaná {phrase} ({hours}) byla nejvyšší: v průměru {mean}, oproti {overall} u všech záznamů.',
  'analysis.timeOfDay.explainChecked':
    'Zkontrolováno podle času zápisu: {count, plural, one {# záznam nálady} few {# záznamy nálady} many {# záznamu nálady} other {# záznamů nálady}} z {days, plural, one {# dne} few {# dnů} many {# dne} other {# dnů}}.',
  'analysis.timeOfDay.explainTable': '{table}. Celkový průměr: {overall}.',
  'analysis.timeOfDay.explainDiff':
    'Rozdíl mezi nejlepším časovým úsekem a celkovým průměrem: {diff} bodu. Síla vzorce: {strength}.',
  'analysis.timeOfDay.title': 'Lepší nálada {phrase}',
  'analysis.timeOfDay.groupA': 'Záznamy {phrase} ({hours})',
  'analysis.timeOfDay.groupB': 'Ostatní záznamy',

  // Trends ------------------------------------------------------------------------------
  'analysis.trends.label': 'trendy v náladě, stresu a spánku',
  'analysis.trends.text':
    'V tvých datech to vypadá, že {metricDefined} {gender, select, other {má {direction, select, up {stoupající tendenci} other {klesající tendenci}}}} {horizon, select, period {za celé období} monthly {za poslední měsíc} other {za poslední dva týdny}}: trendová čára klouzavého průměru {direction, select, up {vzrostla z} other {klesla z}} {fromValue} na {toValue}.',
  'analysis.trends.explainChecked':
    'Zkontrolováno: {count, plural, one {# den} few {# dny} many {# dne} other {# dní}} se zapsaným údajem „{metric}“ z {len} {horizon, select, period {dní období} other {posledních dní}} ({from}–{to}).',
  'analysis.trends.explainFit':
    'Byl vypočten {window}denní klouzavý průměr a jím proložená trendová čára (lineární regrese): {direction, select, up {sklon nahoru} other {sklon dolů}} o {unit, select, hours {{slope} hod.} other {{slope} bodu}} za den, tedy změna zhruba o {unit, select, hours {{change} hod.} other {{change} bodu}} za celé okno (z {fromValue} na {toValue} podél trendové čáry). Síla trendu: {strength}.',
  'analysis.trends.title':
    '{direction, select, up {Stoupající trend} other {Klesající trend}} {metric, select, mood {tvé nálady} energy {tvé úrovně energie} stress {tvé úrovně stresu} sleepHours {délky tvého spánku} sleepQuality {kvality tvého spánku} exerciseMinutes {délky tvého cvičení} other {počtu záznamů}} {horizon, select, period {za celé období} monthly {za poslední měsíc} other {za poslední dva týdny}}',
  'analysis.trends.groupA': 'Začátek okna (trendová čára)',
  'analysis.trends.groupB': 'Konec okna (trendová čára)',
  'analysis.trends.slopeValue': '{unit, select, hours {{slope} hod.} other {{slope} bodu}}',
  'analysis.trends.nothingSince': 'Kontrola trendů v náladě, stresu a spánku od {from} nenašla žádný výrazný trend.',
  'analysis.trends.nothingAll': 'Kontrola trendů v náladě, stresu a spánku za celé období nenašla žádný výrazný trend.',

  // Month comparison --------------------------------------------------------------------
  'analysis.periodCompare.label': 'srovnání aktuálního a předchozího měsíce',
  'analysis.periodCompare.text':
    'V tvých datech to vypadá, že za {cur} {gender, select, fd {byla {metricDefined} {direction, select, higher {v průměru delší} other {v průměru kratší}}} m {byl {metricDefined} {direction, select, higher {v průměru vyšší} other {v průměru nižší}}} other {byla {metricDefined} {direction, select, higher {v průměru vyšší} other {v průměru nižší}}}} než za {prev} ({meanA} vs. {meanB}).',
  'analysis.periodCompare.explain':
    'Porovnány byly dny se zapsaným údajem „{metric}“ za {cur} ({countA, plural, one {# den} few {# dny} many {# dne} other {# dní}}, do dneška) a za {prev} ({countB, plural, one {# den} few {# dny} many {# dne} other {# dní}}). Průměr za {cur}: {meanA}; za {prev}: {meanB}. Rozdíl: {unit, select, hours {{diff} hod.} other {{diff} bodu}}. Síla rozdílu: {strength}.',
  'analysis.periodCompare.title':
    'Za {cur}: {gender, select, fd {{direction, select, higher {{metric} delší než za {prev}} other {{metric} kratší než za {prev}}}} other {{direction, select, higher {{metric} vyšší než za {prev}} other {{metric} nižší než za {prev}}}}}',
  'analysis.periodCompare.entriesText':
    'Vypadá to, že {window, plural, one {za první den} few {za první # dny} many {za prvních # dne} other {za prvních # dní}} měsíce vzniklo {direction, select, more {více záznamů} other {méně záznamů}} za {cur} ({countA, plural, one {# záznam} few {# záznamy} many {# záznamu} other {# záznamů}}) než za {prev} ({countB, plural, one {# záznam} few {# záznamy} many {# záznamu} other {# záznamů}}).',
  'analysis.periodCompare.entriesExplain':
    'Aby se porovnávala stejně dlouhá období, byly spočítány záznamy za {window, plural, one {první den} few {první # dny} many {prvních # dne} other {prvních # dní}} každého měsíce: {cur} – {countA, plural, one {# záznam} few {# záznamy} many {# záznamu} other {# záznamů}}, {prev} – {countB, plural, one {# záznam} few {# záznamy} many {# záznamu} other {# záznamů}}. Rozdíl: {diff, plural, one {# záznam} few {# záznamy} many {# záznamu} other {# záznamů}} ({percent}). Síla rozdílu: {strength}.',
  'analysis.periodCompare.entriesTitle': '{direction, select, more {Více záznamů} other {Méně záznamů}} za {cur} než za {prev}',
  'analysis.periodCompare.monthWindow':
    '{month} ({window, plural, one {první den} few {první # dny} many {prvních # dne} other {prvních # dní}})',
  'analysis.periodCompare.insufficientWhat': 'srovnání měsíců ({cur} a {prev})',
  'analysis.periodCompare.nothing':
    'Srovnání za {cur} a za {prev} nenašlo žádný výrazný rozdíl v náladě, stresu, spánku ani v počtu záznamů.',

  // Habit trend (improved / declined) -----------------------------------------------------
  'analysis.habitsTrend.label': 'návyky, které se zlepšily nebo zhoršily',
  'analysis.habitsTrend.whether': 'zda se návyk „{habit}“ zlepšil, nebo zhoršil',
  'analysis.habitsTrend.textDaily':
    'Vypadá to, že {direction, select, improved {se návyk „{habit}“ zlepšil} other {se návyk „{habit}“ zhoršil}}: za poslední dva týdny byl splněn v {recent} z {window} dní, oproti {previous} z {window} v předchozích dvou týdnech.',
  'analysis.habitsTrend.textWeekly':
    'Vypadá to, že {direction, select, improved {se návyk „{habit}“ zlepšil} other {se návyk „{habit}“ zhoršil}}: za poslední dva týdny bylo zaznamenáno {recent} {unit}, oproti {previous} v předchozích dvou týdnech (cíl: {target} {unit} za týden).',
  'analysis.habitsTrend.explain':
    'Porovnána byla míra plnění návyku za poslední dva týdny ({recentFrom}–{recentTo}) a za dva týdny předtím ({previousFrom}–{previousTo}): {recentRate} vs. {previousRate}. Rozdíl: {diff} p. b. Síla změny: {strength}.',
  'analysis.habitsTrend.title':
    '{direction, select, improved {Návyk „{habit}“ se za poslední dva týdny zlepšil} other {Návyk „{habit}“ se za poslední dva týdny zhoršil}}',
  'analysis.habitsTrend.metric': 'Míra plnění – {habit}',
  'analysis.habitsTrend.groupA': 'Poslední dva týdny',
  'analysis.habitsTrend.groupB': 'Předchozí dva týdny',

  // Best / hardest days ------------------------------------------------------------------
  'analysis.bestWorst.label': 'nejlepší a nejtěžší dny',
  'analysis.bestWorst.describedDay': '{day} – „{title}“',
  'analysis.bestWorst.noTitle': 'Bez názvu',
  'analysis.bestWorst.extraValue': '{titles} – skóre {score}',
  'analysis.bestWorst.text':
    '{kind, select, best {Nejlepší dny} other {Nejtěžší dny}} v období podle kombinovaného skóre nálady, energie a stresu: {days}.',
  'analysis.bestWorst.explainScore':
    'Pro každý z {count, plural, one {# dne} few {# dnů} many {# dne} other {# dnů}} bylo vypočteno kombinované skóre: průměr nálady, úrovně energie a (11 minus úroveň stresu) z hodnot zapsaných ten den.',
  'analysis.bestWorst.explainMeans':
    'Průměrné skóre v období: {overall}. {kind, select, best {{count, plural, one {Nejlepší den měl skóre} =3 {Tři nejlepší dny měly v průměru skóre} other {Nejlepší dny měly v průměru skóre}}} other {{count, plural, one {Nejtěžší den měl skóre} =3 {Tři nejtěžší dny měly v průměru skóre} other {Nejtěžší dny měly v průměru skóre}}}} {mean}.',
  'analysis.bestWorst.explainDiff': 'Rozdíl od průměru: {diff} bodu. Síla rozdílu: {strength}.',
  'analysis.bestWorst.title': '{kind, select, best {Nejlepší dny v období} other {Nejtěžší dny v období}}',
  'analysis.bestWorst.metric': 'Kombinované skóre (nálada + energie + obrácený stres)',
  'analysis.bestWorst.groupA': '{kind, select, best {Nejlepší dny} other {Nejtěžší dny}}',
  'analysis.bestWorst.nothing':
    'Kontrola ({label}) za {count, plural, one {# den} few {# dny} many {# dne} other {# dní}} ukázala podobná skóre; žádný den výrazně nevyčníval.',

  // Streaks -------------------------------------------------------------------------------
  'analysis.streaks.label': 'série psaní a návyků',
  'analysis.streaks.entriesTitle': 'Série psaní: {count, plural, one {# den} few {# dny} many {# dne} other {# dní}}',
  'analysis.streaks.entriesText':
    'Skvělá práce! Do deníku píšeš už {count, plural, one {# den} few {# dny} many {# dne} other {# dní}} v řadě ({from}–{to}).',
  'analysis.streaks.entriesExplain':
    'Spočítány byly po sobě jdoucí dny s alespoň jedním záznamem, až do dneška nebo včerejška. Aktuální série: {count, plural, one {# den} few {# dny} many {# dne} other {# dní}}, od {from} do {to}. Nejdelší série v období: {best, plural, one {# den} few {# dny} many {# dne} other {# dní}}.',
  'analysis.streaks.entriesMetric': 'Dny psaní',
  'analysis.streaks.currentDays': 'Dny v aktuální sérii',
  'analysis.streaks.daysWithEntry': 'Dny se záznamem v období',
  'analysis.streaks.habitTitle': 'Návyk „{habit}“: série {count, plural, one {# den} few {# dny} many {# dne} other {# dní}}',
  'analysis.streaks.habitText':
    'Návyk „{habit}“ plníš už {count, plural, one {# den} few {# dny} many {# dne} other {# dní}} v řadě ({from}–{to}).',
  'analysis.streaks.habitExplain':
    'Spočítány byly po sobě jdoucí dny, kdy byl návyk „{habit}“ označen jako splněný, až do dneška nebo včerejška. Aktuální série: {count, plural, one {# den} few {# dny} many {# dne} other {# dní}}. Nejdelší série v období: {best, plural, one {# den} few {# dny} many {# dne} other {# dní}}.',
  'analysis.streaks.habitMetric': 'Plnění návyku „{habit}“',
  'analysis.streaks.daysCompleted': 'Dny se splněným návykem v období',
  'analysis.streaks.weeklyTitle':
    'Návyk „{habit}“: série {count, plural, one {# týden} few {# týdny} many {# týdne} other {# týdnů}}',
  'analysis.streaks.weeklyText':
    'Cíl návyku „{habit}“ plníš už {count, plural, one {# týden} few {# týdny} many {# týdne} other {# týdnů}} v řadě ({from}–{to}).',
  'analysis.streaks.weeklyExplain':
    'Pro každý týden bylo sečteno množství zaznamenané u návyku „{habit}“ a porovnáno s týdenním cílem ({target}). Aktuální série týdnů se splněným cílem: {count, plural, one {# týden} few {# týdny} many {# týdne} other {# týdnů}}.',
  'analysis.streaks.weeklyMetric': 'Splněný týdenní cíl – {habit}',
  'analysis.streaks.currentWeeks': 'Týdny v aktuální sérii',
  'analysis.streaks.weeksWithLogs': 'Týdny se záznamy v období',
  'analysis.streaks.none':
    'Nebyly nalezeny žádné aktivní série (série psaní alespoň {entryMin, plural, one {# den} few {# dny} many {# dne} other {# dní}} nebo série návyku o délce alespoň {habitMin} dní či týdnů).',

  // Anomalies -----------------------------------------------------------------------------
  'analysis.anomalies.label': 'neobvyklé dny v náladě nebo stresu',
  'analysis.anomalies.textOne':
    'Vypadá to, že dne {day} {gender, select, fd {byla {metricDefined} {side, select, high {neobvykle dlouhá} other {neobvykle krátká}}} m {byl {metricDefined} {side, select, high {neobvykle vysoký} other {neobvykle nízký}}} other {byla {metricDefined} {side, select, high {neobvykle vysoká} other {neobvykle nízká}}}} ve srovnání se zbytkem období ({value} oproti průměru {mean}).',
  'analysis.anomalies.textMany':
    'Vypadá to, že {count, plural, one {v # dni} few {ve # dnech} many {v # dne} other {v # dnech}} {gender, select, fd {byla {metricDefined} {side, select, high {neobvykle dlouhá} other {neobvykle krátká}}} m {byl {metricDefined} {side, select, high {neobvykle vysoký} other {neobvykle nízký}}} other {byla {metricDefined} {side, select, high {neobvykle vysoká} other {neobvykle nízká}}}} ve srovnání se zbytkem období: {days}; průměr v období: {mean}.',
  'analysis.anomalies.textManyMore':
    'Vypadá to, že {count, plural, one {v # dni} few {ve # dnech} many {v # dne} other {v # dnech}} {gender, select, fd {byla {metricDefined} {side, select, high {neobvykle dlouhá} other {neobvykle krátká}}} m {byl {metricDefined} {side, select, high {neobvykle vysoký} other {neobvykle nízký}}} other {byla {metricDefined} {side, select, high {neobvykle vysoká} other {neobvykle nízká}}}} ve srovnání se zbytkem období: {days} a další; průměr v období: {mean}.',
  'analysis.anomalies.dayItem': '{day}: {value}',
  'analysis.anomalies.detail':
    '{date}: {value} ({z} směrodatné odchylky {side, select, above {nad průměrem} other {pod průměrem}})',
  'analysis.anomalies.explain':
    'Zkontrolováno: {count, plural, one {# den} few {# dny} many {# dne} other {# dní}} se zapsaným údajem „{metric}“. Průměr: {mean}, směrodatná odchylka: {sd}. Den se považuje za neobvyklý, když se jeho hodnota liší od průměru o {z} směrodatné odchylky nebo více. {details}. Síla odchylky: {strength}.',
  'analysis.anomalies.title':
    '{count, plural, one {Neobvyklý den} few {Neobvyklé dny} many {Neobvyklé dny} other {Neobvyklé dny}}: {gender, select, fd {{side, select, high {{metric} neobvykle dlouhá} other {{metric} neobvykle krátká}}} m {{side, select, high {{metric} neobvykle vysoký} other {{metric} neobvykle nízký}}} other {{side, select, high {{metric} neobvykle vysoká} other {{metric} neobvykle nízká}}}}',
  'analysis.anomalies.groupA': 'Neobvyklé dny',
  'analysis.anomalies.zValue': '{value} (z {z})',
  'analysis.anomalies.nothing':
    'Kontrola neobvyklých dní za {count, plural, one {# den} few {# dny} many {# dne} other {# dní}} nenašla žádný den, který by se od průměru lišil o {z} směrodatné odchylky nebo více.',

  // Emotion patterns ----------------------------------------------------------------------
  'analysis.emotion.label': 'vzorce emocí podle dnů, lidí a míst',
  'analysis.emotion.metric': 'Emoce „{emotion}“',
  'analysis.emotion.groupA': 'Dny s emocí „{emotion}“',
  'analysis.emotion.weekdayTitle': 'Emoce „{emotion}“ se objevuje hlavně {onWeekday}',
  'analysis.emotion.weekdayText':
    'V tvých datech to vypadá, že se emoce „{emotion}“ objevovala hlavně {onWeekday} ({top} z {total} případů).',
  'analysis.emotion.weekdayExplain':
    'Zkontrolováno: {count, plural, one {# den} few {# dny} many {# dne} other {# dní}}. Emoce „{emotion}“ byla zaznamenána {total, plural, one {v # dni} few {ve # dnech} many {v # dne} other {v # dnech}}; z toho na {weekdays} {top, plural, one {připadl # den} few {připadly # dny} many {připadlo # dne} other {připadlo # dní}} ({share}), přičemž {weekdays} tvoří {baseline} všech zkontrolovaných dní. Síla vzorce: {strength}.',
  'analysis.emotion.groupBWeekday': 'Z toho {weekdays}',
  'analysis.emotion.weekdayShareKey': 'Podíl ({weekdays}) ze všech dní',
  'analysis.emotion.personTitle': 'Emoce „{emotion}“ a {name}',
  'analysis.emotion.placeTitle': 'Emoce „{emotion}“ a „{place}“',
  'analysis.emotion.personText':
    'V tvých datech to vypadá, že se emoce „{emotion}“ často objevovala ve dnech, kdy záznam zmiňuje také jméno {name} ({with} z {total} případů).',
  'analysis.emotion.placeText':
    'V tvých datech to vypadá, že se emoce „{emotion}“ často objevovala ve dnech, kdy bylo v záznamu uvedeno místo „{place}“ ({with} z {total} případů).',
  'analysis.emotion.personExplain':
    'Zkontrolováno: {count, plural, one {# den} few {# dny} many {# dne} other {# dní}}. Emoce „{emotion}“ byla zaznamenána {total, plural, one {v # dni} few {ve # dnech} many {v # dne} other {v # dnech}}; v {with} z nich ({share}) záznam zmiňuje také jméno {name}. Jméno {name} se celkem objevuje v {baselineCount} z {count} dní ({baseline}). Síla vzorce: {strength}.',
  'analysis.emotion.placeExplain':
    'Zkontrolováno: {count, plural, one {# den} few {# dny} many {# dne} other {# dní}}. Emoce „{emotion}“ byla zaznamenána {total, plural, one {v # dni} few {ve # dnech} many {v # dne} other {v # dnech}}; v {with} z nich ({share}) záznam uvádí také místo „{place}“. Místo „{place}“ se celkem objevuje v {baselineCount} z {count} dní ({baseline}). Síla vzorce: {strength}.',
  'analysis.emotion.groupBPerson': 'Z toho s osobou {name}',
  'analysis.emotion.groupBPlace': 'Z toho v místě „{place}“',
  'analysis.emotion.personShareKey': 'Podíl dní se jménem {name} ze všech dní',
  'analysis.emotion.placeShareKey': 'Podíl dní s místem „{place}“ ze všech dní',
  'analysis.emotion.nothing':
    'Kontrola {count, plural, one {# emoce, která se opakovala} few {# emocí, které se opakovaly} many {# emoce, které se opakovaly} other {# emocí, které se opakovaly}} alespoň {min}krát, nenašla žádné výrazné soustředění na určité dny, lidi nebo místa.',
};
export default messages;
