/**
 * it - analysis messages (server-side insight templates, notes and labels). Keys are prefixed
 * 'analysis.'; see shared/i18n/index.ts for the template syntax and the English file for the
 * conventions.
 *
 * Note per l'italiano:
 *  - Sempre prudente e mai causale: "Dai tuoi dati sembra che...", "potrebbe esserci un
 *    legame...". "Sembra che" regge il congiuntivo (fosse, sia comparsa).
 *  - Genere: 'analysis.metric.<m>.gender' vale 'f' (durata del sonno, qualità del sonno) o 'm';
 *    i template aggiungono un ramo `f {...}` per possessivo e aggettivi (più alta / più basso).
 *  - Le forme 'defined' includono articolo e possessivo ("la qualità del tuo sonno").
 *  - Dove il template inglese non ha {gender}, l'indicatore compare senza articolo
 *    ("un valore di {metric}") o tra virgolette ("l'indicatore “{metric}”").
 */
const messages: Record<string, string> = {
  // Engine / provider -----------------------------------------------------------------
  'analysis.engine.providerFailed': 'L’analisi delle tendenze non è stata completata (errore interno). Riprova più tardi.',
  'analysis.engine.detectorFailed': 'La verifica “{label}” non è stata completata (errore interno); le altre osservazioni non ne risentono.',

  // Strength --------------------------------------------------------------------------
  'analysis.strength.weak': 'debole',
  'analysis.strength.moderate': 'moderata',
  'analysis.strength.strong': 'forte',

  // Metrics: label (short, standalone), defined (subject inside a sentence), gender -----
  'analysis.metric.mood.label': 'umore',
  'analysis.metric.mood.defined': 'il tuo umore',
  'analysis.metric.mood.gender': 'm',
  'analysis.metric.energy.label': 'livello di energia',
  'analysis.metric.energy.defined': 'il tuo livello di energia',
  'analysis.metric.energy.gender': 'm',
  'analysis.metric.stress.label': 'livello di stress',
  'analysis.metric.stress.defined': 'il tuo livello di stress',
  'analysis.metric.stress.gender': 'm',
  'analysis.metric.sleepHours.label': 'durata del sonno',
  'analysis.metric.sleepHours.defined': 'la durata del tuo sonno',
  'analysis.metric.sleepHours.gender': 'f',
  'analysis.metric.sleepQuality.label': 'qualità del sonno',
  'analysis.metric.sleepQuality.defined': 'la qualità del tuo sonno',
  'analysis.metric.sleepQuality.gender': 'f',
  'analysis.metric.exerciseMinutes.label': 'tempo di attività fisica',
  'analysis.metric.exerciseMinutes.defined': 'il tuo tempo di attività fisica',
  'analysis.metric.exerciseMinutes.gender': 'm',
  'analysis.metric.entries.label': 'numero di voci',
  'analysis.metric.entries.defined': 'il numero delle tue voci',
  'analysis.metric.entries.gender': 'm',

  // Counts and dates ------------------------------------------------------------------
  'analysis.count.days': '{count, plural, one {# giorno} other {# giorni}}',
  'analysis.count.weeks': '{count, plural, one {# settimana} other {# settimane}}',
  'analysis.date.dayWithDate': '{weekday} {date}',

  // Weekdays (index 0 = Sunday) --------------------------------------------------------
  'analysis.weekday.plural.0': 'domeniche',
  'analysis.weekday.plural.1': 'lunedì',
  'analysis.weekday.plural.2': 'martedì',
  'analysis.weekday.plural.3': 'mercoledì',
  'analysis.weekday.plural.4': 'giovedì',
  'analysis.weekday.plural.5': 'venerdì',
  'analysis.weekday.plural.6': 'sabati',
  'analysis.weekday.on.0': 'di domenica',
  'analysis.weekday.on.1': 'di lunedì',
  'analysis.weekday.on.2': 'di martedì',
  'analysis.weekday.on.3': 'di mercoledì',
  'analysis.weekday.on.4': 'di giovedì',
  'analysis.weekday.on.5': 'di venerdì',
  'analysis.weekday.on.6': 'di sabato',

  // Notes shared by the detectors -------------------------------------------------------
  'analysis.note.insufficient': 'Non ci sono ancora abbastanza dati per esaminare {what} (servono almeno {required}; al momento: {have}).',
  'analysis.note.insufficientWhether': 'Non ci sono ancora abbastanza dati per verificare {what} (servono almeno {required}; al momento: {have}).',
  'analysis.note.nothingNotable': 'Ho esaminato {what} su {count, plural, one {# giorno} other {# giorni}} e non ho trovato differenze degne di nota.',

  // Requirement / availability phrases used inside the notes above ----------------------
  'analysis.req.daysBothValues': '{count, plural, one {# giorno con entrambi i valori} other {# giorni con entrambi i valori}}',
  'analysis.req.daysPerGroup': '{count, plural, one {# giorno in ciascun gruppo} other {# giorni in ciascun gruppo}}',
  'analysis.req.daysWithReport': '{count, plural, one {# giorno con un valore registrato} other {# giorni con valori registrati}}',
  'analysis.req.daysWithRatings': '{count, plural, one {# giorno con valutazioni} other {# giorni con valutazioni}}',
  'analysis.req.daysPerMonth': '{count, plural, one {# giorno registrato in ogni mese} other {# giorni registrati in ogni mese}}',
  'analysis.req.recentDays': '{count, plural, one {# giorno registrato nelle ultime due settimane} other {# giorni registrati nelle ultime due settimane}}',
  'analysis.req.fullWeeks': '{count, plural, one {# settimana completa registrata} other {# settimane complete registrate}}',
  'analysis.req.weeksOfLogs': '{count, plural, one {# settimana di registrazioni} other {# settimane di registrazioni}}',
  'analysis.req.weekPerGroup': 'una settimana in ciascun gruppo e {count, plural, one {# giorno registrato} other {# giorni registrati}} in ciascun gruppo',
  'analysis.req.moodReports': '{count, plural, one {# valore di umore} other {# valori di umore}}',
  'analysis.req.reportsInWindow': '{count, plural, one {# valore in una stessa fascia oraria} other {# valori in una stessa fascia oraria}}',
  'analysis.req.emotionRepeated': 'un’emozione registrata in {count, plural, one {# giorno} other {# giorni}}',
  'analysis.have.twoGroups': '{groupA}: {countA, plural, one {# giorno} other {# giorni}}; {groupB}: {countB, plural, one {# giorno} other {# giorni}}',
  'analysis.have.weeksTwoGroups':
    'settimane con obiettivo raggiunto: {metWeeks, plural, one {# settimana} other {# settimane}} ({metDays, plural, one {# giorno} other {# giorni}}); settimane sotto l’obiettivo: {belowWeeks, plural, one {# settimana} other {# settimane}} ({belowDays, plural, one {# giorno} other {# giorni}})',
  'analysis.have.twoMonths': '{countA, plural, one {# giorno} other {# giorni}} in {cur} e {countB, plural, one {# giorno} other {# giorni}} in {prev}',
  'analysis.have.noData': 'nessun dato',
  'analysis.have.noSuchEmotion': 'ancora nessuna',
  'analysis.have.fewerInEveryWindow': 'meno di così in ogni fascia oraria',

  // Sentences shared by the group-comparison detectors ----------------------------------
  'analysis.relation.text':
    'Dai tuoi dati sembra che, {condition}, {metricDefined} fosse in media {gender, select, f {{direction, select, higher {più alta} other {più bassa}}} other {{direction, select, higher {più alto} other {più basso}}}} ({meanA} contro {meanB}).',
  'analysis.correlation.text':
    'Dai tuoi dati sembra che possa esserci un legame tra {x} e {y}: {xGender, select, f {quando {x} era più alta} other {quando {x} era più alto}}, {yGender, select, f {{y} {direction, select, higher {tendeva a essere più alta} other {tendeva a essere più bassa}}} other {{y} {direction, select, higher {tendeva a essere più alto} other {tendeva a essere più basso}}}} (correlazione {r}).',
  'analysis.explain.checkedDays': 'Ho esaminato {count, plural, one {# giorno} other {# giorni}}.',
  'analysis.explain.onDaysCondition': 'In {count, plural, one {# giorno} other {# giorni}} hai {conditionPast}.',
  'analysis.explain.groupMeans':
    '{gender, select, other {In quei giorni {metricDefined} era in media {meanA}}}, contro {meanB} negli altri giorni.',
  'analysis.explain.correlation': 'Correlazione: {r}.',
  'analysis.explain.correlationBetween': 'Correlazione ({predictor} / {outcome}): {r}.',
  'analysis.explain.diffAndStrength': 'Differenza tra le medie: {diff} punti. Forza della tendenza: {strength}.',
  'analysis.explain.diffStrength': 'Differenza: {diff} punti. Forza della tendenza: {strength}.',
  'analysis.split.corrExplainChecked': 'Ho esaminato {count, plural, one {# giorno} other {# giorni}} in cui erano registrati sia {x} sia {y}.',
  'analysis.split.corrExplainPearson': 'Correlazione di Pearson: {r} (forza: {strength}).',
  'analysis.split.corrExplainGroups':
    'Non c’erano abbastanza giorni in ciascun gruppo per confrontare le medie ({groupA}: {countA, plural, one {# giorno} other {# giorni}}; {groupB}: {countB, plural, one {# giorno} other {# giorni}}; ne servono almeno {min} per gruppo).',

  // Evidence table keys ---------------------------------------------------------------
  'analysis.extra.predictor': 'Predittore',
  'analysis.extra.strength': 'Forza',
  'analysis.extra.meanDiff': 'Differenza tra le medie (A meno B)',
  'analysis.extra.cohenD': 'Dimensione dell’effetto (d di Cohen)',
  'analysis.extra.weeksChecked': 'Settimane esaminate',
  'analysis.extra.weeklyTarget': 'Obiettivo settimanale',
  'analysis.extra.target': 'Obiettivo',
  'analysis.extra.frequency': 'Frequenza',
  'analysis.extra.periodMean': 'Media del periodo',
  'analysis.extra.overallMean': 'Media complessiva',
  'analysis.extra.stddev': 'Deviazione standard',
  'analysis.extra.slopePerDay': 'Pendenza al giorno',
  'analysis.extra.daysInWindow': 'Giorni nella finestra',
  'analysis.extra.movingWindow': 'Finestra della media mobile',
  'analysis.extra.relativeChange': 'Variazione relativa',
  'analysis.extra.longestStreak': 'Serie più lunga del periodo',
  'analysis.extra.shareOfEmotionDays': 'Quota dei giorni con l’emozione',
  'analysis.frequency.daily': 'giornaliera',
  'analysis.frequency.weekly': 'settimanale',
  'analysis.groupB.otherDays': 'Altri giorni',

  // Sleep detectors -------------------------------------------------------------------
  'analysis.sleep.groupA': 'Giorni con meno di {hours} ore di sonno',
  'analysis.sleep.groupB': 'Giorni con {hours} ore di sonno o più',
  'analysis.sleep.condition': 'nei giorni in cui hai dormito meno di {hours} ore',
  'analysis.sleep.conditionPast': 'dormito meno di {hours} ore',
  'analysis.sleepMood.label': 'il legame tra sonno e umore',
  'analysis.sleepMood.title': '{direction, select, lower {Sonno breve e umore più basso} other {Sonno breve e umore più alto}}',
  'analysis.sleepMood.corrTitle': 'Possibile legame tra ore di sonno e umore',
  'analysis.sleepEnergy.label': 'il legame tra sonno e livello di energia',
  'analysis.sleepEnergy.title': '{direction, select, lower {Sonno breve ed energia più bassa} other {Sonno breve ed energia più alta}}',
  'analysis.sleepEnergy.corrTitle': 'Possibile legame tra ore di sonno e livello di energia',

  // Exercise detectors ----------------------------------------------------------------
  'analysis.exercise.groupA': 'Giorni con attività fisica',
  'analysis.exercise.groupB': 'Giorni senza attività fisica',
  'analysis.exercise.condition': 'nei giorni in cui hai fatto attività fisica',
  'analysis.exercise.conditionPast': 'fatto attività fisica',
  'analysis.exerciseMood.label': 'il legame tra attività fisica e umore',
  'analysis.exerciseMood.title': '{direction, select, higher {Attività fisica e umore più alto} other {Attività fisica e umore più basso}}',
  'analysis.exerciseMood.corrTitle': 'Possibile legame tra minuti di attività fisica e umore',
  'analysis.exerciseEnergy.label': 'il legame tra attività fisica e livello di energia',
  'analysis.exerciseEnergy.title': '{direction, select, higher {Attività fisica ed energia più alta} other {Attività fisica ed energia più bassa}}',
  'analysis.exerciseEnergy.corrTitle': 'Possibile legame tra minuti di attività fisica e livello di energia',

  // Habit - mood / energy / stress ------------------------------------------------------
  'analysis.habit.detectorLabel': 'il legame tra abitudini e umore',
  'analysis.habit.noHabits': 'Non ci sono abitudini attive, quindi non ho cercato un legame tra abitudini e umore.',
  'analysis.habit.noLogs': 'L’abitudine “{habit}” non ha ancora registrazioni in questo periodo, quindi non ho cercato un legame con l’umore.',
  'analysis.habit.noFullWeeks': 'L’abitudine “{habit}” non ha ancora settimane complete di registrazioni, quindi non ho cercato un legame con l’umore.',
  'analysis.habit.label': 'il legame tra l’abitudine “{habit}” e l’indicatore “{metric}”',
  'analysis.habit.groupA': 'Giorni in cui l’abitudine “{habit}” è stata completata',
  'analysis.habit.groupB': 'Giorni in cui l’abitudine “{habit}” non è stata completata',
  'analysis.habit.condition': 'nei giorni in cui hai completato l’abitudine “{habit}”',
  'analysis.habit.conditionPast': 'completato l’abitudine “{habit}”',
  'analysis.habit.title':
    'Abitudine “{habit}” e {gender, select, f {{direction, select, higher {{metric} più alta} other {{metric} più bassa}}} other {{direction, select, higher {{metric} più alto} other {{metric} più basso}}}}',
  'analysis.habit.corrTitle': 'Possibile legame tra l’abitudine “{habit}” e l’indicatore “{metric}”',
  'analysis.habit.weeklyCondition': 'nelle settimane in cui hai raggiunto l’obiettivo dell’abitudine “{habit}”',
  'analysis.habit.weeklyTarget': '{target} {unit} a settimana',
  'analysis.habit.targetValue': '{target} {unit}',
  'analysis.habit.weeklyExplainChecked':
    'Ho esaminato {weeks, plural, one {# settimana completa} other {# settimane complete}} ({days, plural, one {# giorno} other {# giorni}} con un valore registrato per “{metric}”).',
  'analysis.habit.weeklyExplainMet': 'In {count, plural, one {# settimana} other {# settimane}} hai raggiunto l’obiettivo dell’abitudine ({target}).',
  'analysis.habit.weeklyExplainMeans':
    '{gender, select, other {Nei giorni di quelle settimane {metricDefined} era in media {meanA}}}, contro {meanB} nei giorni {count, plural, one {della settimana rimasta sotto l’obiettivo} other {delle # settimane rimaste sotto l’obiettivo}}.',
  'analysis.habit.groupAWeeks': 'Giorni delle settimane con obiettivo raggiunto ({count, plural, one {# settimana} other {# settimane}})',
  'analysis.habit.groupBWeeks': 'Giorni delle settimane sotto l’obiettivo ({count, plural, one {# settimana} other {# settimane}})',

  // Weekday differences -----------------------------------------------------------------
  'analysis.weekday.label': 'le differenze tra i giorni della settimana',
  'analysis.weekday.text':
    'Dai tuoi dati sembra che {onWeekday} {metricDefined} fosse in media {gender, select, f {{direction, select, higher {più alta} other {più bassa}}} other {{direction, select, higher {più alto} other {più basso}}}} rispetto agli altri giorni della settimana ({meanA} contro {meanB}).',
  'analysis.weekday.explainChecked': 'Ho esaminato {count, plural, one {# giorno} other {# giorni}} con un valore registrato per “{metric}”, di cui {countA} erano {weekdays}.',
  'analysis.weekday.explainMeans':
    '{gender, select, other {In media, {onWeekday} {metricDefined} era {meanA}}}, contro {meanB} negli altri giorni.',
  'analysis.weekday.title':
    'Giorni della settimana: {weekdays} con {gender, select, f {{direction, select, higher {{metric} più alta} other {{metric} più bassa}}} other {{direction, select, higher {{metric} più alto} other {{metric} più basso}}}}',
  'analysis.weekday.groupB': 'Altri giorni della settimana',
  'analysis.weekday.tableValue': '{mean} ({count, plural, one {# giorno} other {# giorni}})',
  'analysis.weekday.nothing': 'Ho cercato differenze tra i giorni della settimana su {count, plural, one {# giorno} other {# giorni}} e non ho trovato differenze degne di nota.',

  // Time of day -------------------------------------------------------------------------
  'analysis.timeOfDay.label': 'il legame tra il momento della scrittura e l’umore',
  'analysis.timeOfDay.morning.label': 'Mattina',
  'analysis.timeOfDay.morning.phrase': 'di mattina',
  'analysis.timeOfDay.late_morning.label': 'Tarda mattinata',
  'analysis.timeOfDay.late_morning.phrase': 'in tarda mattinata',
  'analysis.timeOfDay.afternoon.label': 'Pomeriggio',
  'analysis.timeOfDay.afternoon.phrase': 'nel pomeriggio',
  'analysis.timeOfDay.evening.label': 'Sera',
  'analysis.timeOfDay.evening.phrase': 'di sera',
  'analysis.timeOfDay.night.label': 'Notte',
  'analysis.timeOfDay.night.phrase': 'di notte',
  'analysis.timeOfDay.tableKey': '{label} ({hours})',
  'analysis.timeOfDay.tableValue': 'media {mean}, {count, plural, one {# valore} other {# valori}}',
  'analysis.timeOfDay.tableRow': '{key}: {value}',
  'analysis.timeOfDay.nothing': 'Ho esaminato {label} su {count, plural, one {# valore} other {# valori}} e non ho trovato fasce orarie nettamente sopra la media.',
  'analysis.timeOfDay.text':
    'Dai tuoi dati sembra che l’umore registrato {phrase} ({hours}) fosse il più alto: {mean} in media, contro {overall} su tutti i valori.',
  'analysis.timeOfDay.explainChecked':
    'Ho esaminato {count, plural, one {# valore di umore} other {# valori di umore}} di {days, plural, one {# giorno} other {# giorni}}, in base all’ora in cui è stata scritta la voce.',
  'analysis.timeOfDay.explainTable': '{table}. Media complessiva: {overall}.',
  'analysis.timeOfDay.explainDiff': 'Differenza tra la fascia oraria più alta e la media complessiva: {diff} punti. Forza della tendenza: {strength}.',
  'analysis.timeOfDay.title': 'Umore più alto {phrase}',
  'analysis.timeOfDay.groupA': 'Valori registrati {phrase} ({hours})',
  'analysis.timeOfDay.groupB': 'Altri valori',

  // Trends ------------------------------------------------------------------------------
  'analysis.trends.label': 'le tendenze di umore, stress e sonno',
  'analysis.trends.text':
    'Dai tuoi dati sembra che {metricDefined} {gender, select, other {{direction, select, up {sia in aumento} other {sia in calo}}}} {horizon, select, period {nel periodo} monthly {nell’ultimo mese} other {nelle ultime due settimane}}: la linea di tendenza della media mobile {direction, select, up {è salita da} other {è scesa da}} {fromValue} a {toValue}.',
  'analysis.trends.explainChecked':
    'Ho esaminato {count, plural, one {# giorno} other {# giorni}} con un valore registrato per “{metric}” sui {len} {horizon, select, period {giorni del periodo} other {giorni più recenti}} ({from}-{to}).',
  'analysis.trends.explainFit':
    'Ho calcolato una media mobile su {window} giorni e una linea di tendenza (regressione lineare): {direction, select, up {una pendenza positiva} other {una pendenza negativa}} di {unit, select, hours {{slope} h} other {{slope} punti}} al giorno, cioè una variazione di circa {unit, select, hours {{change} h} other {{change} punti}} nella finestra (da {fromValue} a {toValue} lungo la linea di tendenza). Forza della tendenza: {strength}.',
  'analysis.trends.title':
    '{direction, select, up {Tendenza al rialzo} other {Tendenza al ribasso}} {metric, select, mood {del tuo umore} energy {del tuo livello di energia} stress {del tuo livello di stress} sleepHours {della durata del tuo sonno} sleepQuality {della qualità del tuo sonno} exerciseMinutes {del tuo tempo di attività fisica} other {del numero di voci}} {horizon, select, period {nel periodo} monthly {nell’ultimo mese} other {nelle ultime due settimane}}',
  'analysis.trends.groupA': 'Inizio della finestra (linea di tendenza)',
  'analysis.trends.groupB': 'Fine della finestra (linea di tendenza)',
  'analysis.trends.slopeValue': '{unit, select, hours {{slope} h} other {{slope} punti}}',
  'analysis.trends.nothingSince': 'Ho cercato tendenze in umore, stress e sonno dal {from} e non ne ho trovate di rilevanti.',
  'analysis.trends.nothingAll': 'Ho cercato tendenze in umore, stress e sonno nell’intero periodo e non ne ho trovate di rilevanti.',

  // Month comparison --------------------------------------------------------------------
  'analysis.periodCompare.label': 'il confronto tra il mese in corso e il mese precedente',
  'analysis.periodCompare.text':
    'Dai tuoi dati sembra che in {cur} {metricDefined} fosse in media {gender, select, f {{direction, select, higher {più alta} other {più bassa}}} other {{direction, select, higher {più alto} other {più basso}}}} che in {prev} ({meanA} contro {meanB}).',
  'analysis.periodCompare.explain':
    'Ho confrontato i giorni con un valore registrato per “{metric}” in {cur} ({countA, plural, one {# giorno} other {# giorni}}, fino a oggi) con quelli di {prev} ({countB, plural, one {# giorno} other {# giorni}}). Media in {cur}: {meanA}; in {prev}: {meanB}. Differenza: {unit, select, hours {{diff} h} other {{diff} punti}}. Entità della differenza: {strength}.',
  'analysis.periodCompare.title':
    'In {cur}: {gender, select, f {{direction, select, higher {{metric} più alta} other {{metric} più bassa}}} other {{direction, select, higher {{metric} più alto} other {{metric} più basso}}}} che in {prev}',
  'analysis.periodCompare.entriesText':
    'Sembra che tu abbia {direction, select, more {scritto di più} other {scritto di meno}} in {cur} ({countA, plural, one {# voce} other {# voci}}) che in {prev} ({countB, plural, one {# voce} other {# voci}}), confrontando i primi {window} giorni di ciascun mese.',
  'analysis.periodCompare.entriesExplain':
    'Ho contato le voci dei primi {window} giorni di ciascun mese, per confrontare periodi di uguale durata: {cur} - {countA, plural, one {# voce} other {# voci}}, {prev} - {countB, plural, one {# voce} other {# voci}}. Differenza: {diff, plural, one {# voce} other {# voci}} ({percent}). Entità della differenza: {strength}.',
  'analysis.periodCompare.entriesTitle': '{direction, select, more {Più voci} other {Meno voci}} in {cur} che in {prev}',
  'analysis.periodCompare.monthWindow': '{month} (primi {window} giorni)',
  'analysis.periodCompare.insufficientWhat': 'il confronto tra {cur} e {prev}',
  'analysis.periodCompare.nothing': 'Ho confrontato {cur} con {prev} e non ho trovato differenze degne di nota in umore, stress, sonno o numero di voci.',

  // Habit trend (improved / declined) -----------------------------------------------------
  'analysis.habitsTrend.label': 'le abitudini migliorate o peggiorate',
  'analysis.habitsTrend.whether': 'se l’abitudine “{habit}” è migliorata o peggiorata',
  'analysis.habitsTrend.textDaily':
    'Sembra che l’abitudine “{habit}” {direction, select, improved {sia migliorata} other {sia peggiorata}}: nelle ultime due settimane l’hai completata in {recent} dei {window} giorni, contro {previous} dei {window} nelle due settimane precedenti.',
  'analysis.habitsTrend.textWeekly':
    'Sembra che l’abitudine “{habit}” {direction, select, improved {sia migliorata} other {sia peggiorata}}: nelle ultime due settimane hai registrato {recent} {unit}, contro {previous} nelle due settimane precedenti (obiettivo: {target} {unit} a settimana).',
  'analysis.habitsTrend.explain':
    'Ho confrontato il tasso di completamento dell’abitudine nelle ultime due settimane ({recentFrom}-{recentTo}) con quello delle due settimane precedenti ({previousFrom}-{previousTo}): {recentRate} contro {previousRate}. Differenza: {diff} punti percentuali. Entità del cambiamento: {strength}.',
  'analysis.habitsTrend.title': 'L’abitudine “{habit}” {direction, select, improved {è migliorata} other {è peggiorata}} nelle ultime due settimane',
  'analysis.habitsTrend.metric': 'Tasso di completamento - {habit}',
  'analysis.habitsTrend.groupA': 'Ultime due settimane',
  'analysis.habitsTrend.groupB': 'Due settimane precedenti',

  // Best / hardest days ------------------------------------------------------------------
  'analysis.bestWorst.label': 'i giorni migliori e quelli più difficili',
  'analysis.bestWorst.describedDay': '{day} (“{title}”)',
  'analysis.bestWorst.noTitle': 'Senza titolo',
  'analysis.bestWorst.extraValue': '{titles} - punteggio {score}',
  'analysis.bestWorst.text':
    '{kind, select, best {I giorni migliori} other {I giorni più difficili}} del periodo, secondo un punteggio che combina umore, energia e stress: {days}.',
  'analysis.bestWorst.explainScore':
    '{count, plural, one {Per questo giorno} other {Per ciascuno dei # giorni}} ho calcolato un punteggio combinato: la media di umore, livello di energia e (11 meno il livello di stress), in base ai valori registrati quel giorno.',
  'analysis.bestWorst.explainMeans':
    'Punteggio medio del periodo: {overall}. {kind, select, best {{count, plural, one {Il giorno migliore ha ottenuto} =3 {I tre giorni migliori hanno ottenuto} other {I giorni migliori hanno ottenuto}}} other {{count, plural, one {Il giorno più difficile ha ottenuto} =3 {I tre giorni più difficili hanno ottenuto} other {I giorni più difficili hanno ottenuto}}}} in media {mean}.',
  'analysis.bestWorst.explainDiff': 'Differenza rispetto alla media: {diff} punti. Entità della differenza: {strength}.',
  'analysis.bestWorst.title': '{kind, select, best {I giorni migliori del periodo} other {I giorni più difficili del periodo}}',
  'analysis.bestWorst.metric': 'Punteggio combinato (umore + energia + stress invertito)',
  'analysis.bestWorst.groupA': '{kind, select, best {I giorni migliori} other {I giorni più difficili}}',
  'analysis.bestWorst.nothing': 'Ho esaminato {label} su {count, plural, one {# giorno} other {# giorni}}; i punteggi erano simili e nessun giorno si distingueva in modo particolare.',

  // Streaks -------------------------------------------------------------------------------
  'analysis.streaks.label': 'le serie di scrittura e di abitudini',
  'analysis.streaks.entriesTitle': 'Serie di scrittura di {count, plural, one {# giorno} other {# giorni}}',
  'analysis.streaks.entriesText': 'Complimenti! Hai scritto nel diario per {count, plural, one {# giorno} other {# giorni}} di fila ({from}-{to}).',
  'analysis.streaks.entriesExplain':
    'Ho contato i giorni consecutivi con almeno una voce, fino a oggi o a ieri. Serie attuale: {count, plural, one {# giorno} other {# giorni}}, dal {from} al {to}. Serie più lunga del periodo: {best, plural, one {# giorno} other {# giorni}}.',
  'analysis.streaks.entriesMetric': 'Giorni di scrittura',
  'analysis.streaks.currentDays': 'Giorni della serie attuale',
  'analysis.streaks.daysWithEntry': 'Giorni con una voce nel periodo',
  'analysis.streaks.habitTitle': 'Serie di {count, plural, one {# giorno} other {# giorni}} per l’abitudine “{habit}”',
  'analysis.streaks.habitText': 'Hai completato l’abitudine “{habit}” per {count, plural, one {# giorno} other {# giorni}} di fila ({from}-{to}).',
  'analysis.streaks.habitExplain':
    'Ho contato i giorni consecutivi in cui l’abitudine “{habit}” è stata segnata come completata, fino a oggi o a ieri. Serie attuale: {count, plural, one {# giorno} other {# giorni}}. Serie più lunga del periodo: {best, plural, one {# giorno} other {# giorni}}.',
  'analysis.streaks.habitMetric': 'Completamento dell’abitudine {habit}',
  'analysis.streaks.daysCompleted': 'Giorni in cui l’abitudine è stata completata nel periodo',
  'analysis.streaks.weeklyTitle': 'Serie di {count, plural, one {# settimana} other {# settimane}} per l’abitudine “{habit}”',
  'analysis.streaks.weeklyText': 'Hai raggiunto l’obiettivo dell’abitudine “{habit}” per {count, plural, one {# settimana} other {# settimane}} di fila ({from}-{to}).',
  'analysis.streaks.weeklyExplain':
    'Ho sommato ogni settimana la quantità registrata per l’abitudine “{habit}” e l’ho confrontata con l’obiettivo settimanale ({target}). Serie attuale di settimane con obiettivo raggiunto: {count, plural, one {# settimana} other {# settimane}}.',
  'analysis.streaks.weeklyMetric': 'Obiettivo settimanale raggiunto - {habit}',
  'analysis.streaks.currentWeeks': 'Settimane della serie attuale',
  'analysis.streaks.weeksWithLogs': 'Settimane con registrazioni nel periodo',
  'analysis.streaks.none':
    'Non sono state trovate serie attive (una serie di scrittura di almeno {entryMin} giorni, oppure una serie di un’abitudine di almeno {habitMin} giorni o settimane).',

  // Anomalies -----------------------------------------------------------------------------
  'analysis.anomalies.label': 'i giorni insoliti per umore o stress',
  'analysis.anomalies.textOne':
    'Sembra che {day} {metricDefined} fosse {gender, select, f {{side, select, high {insolitamente alta} other {insolitamente bassa}}} other {{side, select, high {insolitamente alto} other {insolitamente basso}}}} rispetto al resto del periodo ({value}, contro una media di {mean}).',
  'analysis.anomalies.textMany':
    'Sembra che in {count, plural, one {# giorno} other {# giorni}} {metricDefined} fosse {gender, select, f {{side, select, high {insolitamente alta} other {insolitamente bassa}}} other {{side, select, high {insolitamente alto} other {insolitamente basso}}}} rispetto al resto del periodo: {days}; media del periodo: {mean}.',
  'analysis.anomalies.textManyMore':
    'Sembra che in {count, plural, one {# giorno} other {# giorni}} {metricDefined} fosse {gender, select, f {{side, select, high {insolitamente alta} other {insolitamente bassa}}} other {{side, select, high {insolitamente alto} other {insolitamente basso}}}} rispetto al resto del periodo: {days} e altri; media del periodo: {mean}.',
  'analysis.anomalies.dayItem': '{day} ({value})',
  'analysis.anomalies.detail': '{date}: {value} ({z} deviazioni standard {side, select, above {sopra la media} other {sotto la media}})',
  'analysis.anomalies.explain':
    'Ho esaminato {count, plural, one {# giorno} other {# giorni}} con un valore registrato per “{metric}”. Media: {mean}, deviazione standard: {sd}. Un giorno è considerato insolito quando il suo valore si discosta dalla media di almeno {z} deviazioni standard. {details}. Entità dello scostamento: {strength}.',
  'analysis.anomalies.title':
    '{count, plural, one {Un giorno con} other {Giorni con}} {gender, select, f {{side, select, high {{metric} insolitamente alta} other {{metric} insolitamente bassa}}} other {{side, select, high {{metric} insolitamente alto} other {{metric} insolitamente basso}}}}',
  'analysis.anomalies.groupA': 'Giorni insoliti',
  'analysis.anomalies.zValue': '{value} (z {z})',
  'analysis.anomalies.nothing':
    'Ho cercato giorni insoliti su {count, plural, one {# giorno} other {# giorni}} e non ho trovato giorni che si discostino dalla media di almeno {z} deviazioni standard.',

  // Emotion patterns ----------------------------------------------------------------------
  'analysis.emotion.label': 'gli schemi delle emozioni per giorni, persone e luoghi',
  'analysis.emotion.metric': 'L’emozione “{emotion}”',
  'analysis.emotion.groupA': 'Giorni con l’emozione “{emotion}”',
  'analysis.emotion.weekdayTitle': 'L’emozione “{emotion}” compare soprattutto {onWeekday}',
  'analysis.emotion.weekdayText': 'Dai tuoi dati sembra che l’emozione “{emotion}” sia comparsa soprattutto {onWeekday} ({top} su {total}).',
  'analysis.emotion.weekdayExplain':
    'Ho esaminato {count, plural, one {# giorno} other {# giorni}}. L’emozione “{emotion}” è stata registrata in {total, plural, one {# giorno} other {# giorni}}, di cui {top} erano {weekdays} ({share}), mentre questo giorno della settimana rappresenta {baseline} di tutti i giorni esaminati. Forza della tendenza: {strength}.',
  'analysis.emotion.groupBWeekday': 'Di questi: {weekdays}',
  'analysis.emotion.weekdayShareKey': 'Quota di {weekdays} su tutti i giorni',
  'analysis.emotion.personTitle': 'L’emozione “{emotion}” e {name}',
  'analysis.emotion.placeTitle': 'L’emozione “{emotion}” e “{place}”',
  'analysis.emotion.personText':
    'Dai tuoi dati sembra che l’emozione “{emotion}” sia comparsa spesso nei giorni in cui hai visto {name} ({with} su {total}).',
  'analysis.emotion.placeText':
    'Dai tuoi dati sembra che l’emozione “{emotion}” sia comparsa spesso nei giorni in cui il luogo era “{place}” ({with} su {total}).',
  'analysis.emotion.personExplain':
    'Ho esaminato {count, plural, one {# giorno} other {# giorni}}. L’emozione “{emotion}” è stata registrata in {total} giorni; in {with} di questi ({share}) nella voce compariva anche {name}. {name} compare in {baselineCount} dei {count} giorni in totale ({baseline}). Forza della tendenza: {strength}.',
  'analysis.emotion.placeExplain':
    'Ho esaminato {count, plural, one {# giorno} other {# giorni}}. L’emozione “{emotion}” è stata registrata in {total} giorni; in {with} di questi ({share}) nella voce compariva anche il luogo “{place}”. Il luogo “{place}” compare in {baselineCount} dei {count} giorni in totale ({baseline}). Forza della tendenza: {strength}.',
  'analysis.emotion.groupBPerson': 'Di questi, con {name}',
  'analysis.emotion.groupBPlace': 'Di questi, a “{place}”',
  'analysis.emotion.personShareKey': 'Quota dei giorni con {name} su tutti i giorni',
  'analysis.emotion.placeShareKey': 'Quota del luogo “{place}” su tutti i giorni',
  'analysis.emotion.nothing':
    'Ho esaminato {count, plural, one {# emozione ricorrente} other {# emozioni ricorrenti}} almeno {min} volte e non ho trovato concentrazioni degne di nota in particolari giorni, persone o luoghi.',
};
export default messages;
