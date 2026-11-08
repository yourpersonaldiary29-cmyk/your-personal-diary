/**
 * ro - Romanian keyword table of the smart-search parser (schema: ./index.ts).
 *
 * Notes for Romanian:
 *  - Words are written in lower case with the correct comma-below diacritics (ș ț ă â î);
 *    `v()` / `vr()` / `cmp()` below also register the spelling without diacritics
 *    (s t a a i) and the legacy cedilla forms (ş ţ) that many keyboards still produce.
 *  - Romanian inflects with endings and articles glued to the end of the word (zi / zile /
 *    zilele, lună / luna / luni), so the usual forms are listed explicitly. Clitic groups keep
 *    their hyphen as one token (m-am, s-a, n-am).
 *  - "mai" is both the month May and "more" (cel mai bine, mai puțin de): it counts as a month
 *    only after "luna" ("în luna mai") or before a year ("mai 2026").
 *  - Numbers from 20 on take "de" before the noun ("30 de zile"); the parser expects the unit
 *    right after the number, so "ultimele 30 de zile" is listed as a fixed phrase, and a unit
 *    after "N de" is not attached to a comparator (the metric word still is: "peste 30 de
 *    minute de sport" -> exercise minutes).
 */
import type { ComparatorRule, SearchLanguageTable } from './index';
import type { Comparator } from '../../types';

const CEDILLA: Record<string, string> = { ș: 'ş', ț: 'ţ' };
const PLAIN: Record<string, string> = { ș: 's', ț: 't', ă: 'a', â: 'a', î: 'i' };

/** The word, its cedilla spelling and its spelling without diacritics. */
function variants(word: string): string[] {
  const cedilla = word.replace(/[șț]/g, (c) => CEDILLA[c]);
  const plain = word.replace(/[șțăâî]/g, (c) => PLAIN[c]);
  return [...new Set([word, cedilla, plain])];
}

/** Word list with diacritic variants (deduplicated). */
function v(...words: string[]): string[] {
  return [...new Set(words.flatMap(variants))];
}

/** Record whose keys also get their diacritic variants. */
function vr<T>(record: Record<string, T>): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [key, value] of Object.entries(record)) for (const k of variants(key)) if (!(k in out)) out[k] = value;
  return out;
}

/** Comparator rule(s) for a space-separated phrase, with its diacritic variants. */
function cmp(phrase: string, comparator: Comparator): ComparatorRule[] {
  return variants(phrase).map((p) => ({ words: p.split(' '), comparator }));
}

const table: SearchLanguageTable = {
  locale: 'ro',
  script: 'latin',
  tokenizer: 'space',
  dateOrder: 'dmy',
  prefixes: [],
  articlePrefixes: [],
  numberPrefixLetters: '',
  barePrefixTokens: [],
  articles: [],
  stopwords: v(
    // question words
    'ce', 'care', 'când', 'unde', 'cum', 'cât', 'câte', 'câți', 'câtă', 'cine', 'oare', 'dacă',
    // auxiliaries, verbs of being and feeling, clitic groups
    'am', 'ai', 'a', 'au', 'ați', 'este', 'e', 'sunt', 'ești', 'era', 'eram', 'erai', 'erau', 'fost', 'fi', 'fie', 'să',
    'va', 'vor', 'voi', 'aș', 'ar', 'aveam', 'avea', 'avut', 'fac', 'face', 'făcut', 'făceam', 'simțit', 'simt', 'simțeam',
    'simți', 'simte', 'simțisem', 'm-am', 'te-ai', 's-a', 's-au', 'mi-a', 'mi-au', 'mi-e', 'mi-era', 'mi-am', 'l-am',
    'le-am', 'i-am', 'îmi', 'mă', 'te', 'se', 'mergea', 'mers', 'merge',
    // pronouns and determiners
    'eu', 'tu', 'el', 'ea', 'noi', 'ei', 'ele', 'mea', 'meu', 'mele', 'mei', 'mie', 'tău', 'ta', 'tale', 'său', 'sa',
    'sale', 'lui', 'lor', 'al', 'ale', 'cel', 'cea', 'cei', 'cele', 'un', 'o', 'unui', 'unei', 'niște', 'acest',
    'această', 'aceste', 'acești', 'acel', 'acea', 'acele', 'acei', 'asta', 'ăsta', 'astea', 'ăstea', 'aceea', 'acela',
    'fiecare', 'orice', 'toate', 'toți', 'toată', 'tot', 'ceva', 'nimic', 'altele', 'alte',
    // prepositions and conjunctions
    'și', 'sau', 'dar', 'iar', 'ori', 'nici', 'pe', 'la', 'în', 'din', 'de', 'cu', 'pentru', 'despre', 'fără', 'până',
    'după', 'înainte', 'între', 'dintre', 'prin', 'spre', 'către', 'timpul', 'privind', 'legat', 'legate', 'că',
    // degree and filler words
    'foarte', 'mult', 'multe', 'prea', 'doar', 'numai', 'chiar', 'încă', 'deja', 'acum', 'atunci', 'aici', 'acolo', 'da',
    'nu', 'mai', 'puțin', 'cam', 'destul', 'arată', 'arată-mi', 'găsește', 'caută', 'spune-mi', 'spune', 'listează',
    'afișează', 'vreau', 'vrea', 'văd', 'rog', 'lucruri', 'lucru', 'chestii', 'timp', 'perioadă', 'perioada', 'dată',
    'dăți',
    // diary vocabulary
    'zi', 'zile', 'zilele', 'ziua', 'zilei', 'zilelor', 'însemnare', 'însemnări', 'însemnările', 'însemnarea',
    'însemnărilor', 'înregistrare', 'înregistrări', 'înregistrările', 'jurnal', 'jurnalul', 'jurnalului', 'notă', 'note',
    'notițe', 'etichetă', 'eticheta', 'etichete', 'etichetele', 'tag', 'taguri', 'sentiment', 'sentimente',
  ),
  numberWords: vr({
    zero: 0, unu: 1, una: 1, un: 1, o: 1, doi: 2, două: 2, trei: 3, patru: 4, cinci: 5, șase: 6, șapte: 7, opt: 8,
    nouă: 9, zece: 10, unsprezece: 11, doisprezece: 12, douăsprezece: 12, treisprezece: 13, paisprezece: 14,
    cincisprezece: 15, șaisprezece: 16, șaptesprezece: 17, optsprezece: 18, nouăsprezece: 19, douăzeci: 20,
    treizeci: 30, patruzeci: 40, cincizeci: 50, șaizeci: 60, șaptezeci: 70, optzeci: 80, nouăzeci: 90, sută: 100,
  }),
  halfPhrases: v('și jumătate', 'și o jumătate'),
  periods: {
    phrases: vr({
      'azi': 'today',
      'astăzi': 'today',
      'ieri': 'yesterday',
      'alaltăieri': 'twoDaysAgo',
      // the last 7 days
      'săptămâna aceasta': 'week',
      'săptămâna asta': 'week',
      'această săptămână': 'week',
      'săptămâna trecută': 'week',
      'săptămâna precedentă': 'week',
      'săptămâna anterioară': 'week',
      'ultima săptămână': 'week',
      'ultimele șapte zile': 'week',
      // the last 30 days
      'luna aceasta': 'month',
      'luna asta': 'month',
      'această lună': 'month',
      'luna trecută': 'month',
      'luna precedentă': 'month',
      'luna anterioară': 'month',
      'ultima lună': 'month',
      'ultimele 30 de zile': 'month',
      'ultimele treizeci de zile': 'month',
      // the last 180 days
      'ultima jumătate de an': 'halfYear',
      'ultimul semestru': 'halfYear',
      'ultimele șase luni': 'halfYear',
      'jumătatea de an trecută': 'halfYear',
      'ultimele 180 de zile': 'halfYear',
      // the last 365 days
      'anul acesta': 'year',
      'anul ăsta': 'year',
      'acest an': 'year',
      'anul trecut': 'year',
      'anul precedent': 'year',
      'anul anterior': 'year',
      'ultimul an': 'year',
      'ultimele douăsprezece luni': 'year',
      'ultimele 365 de zile': 'year',
      // since 1 January / since the 1st of the month
      'de la începutul anului': 'startYear',
      'de la începutul acestui an': 'startYear',
      'de la începutul anului curent': 'startYear',
      'de la începutul lunii': 'startMonth',
      'de la începutul acestei luni': 'startMonth',
      'de la începutul lunii curente': 'startMonth',
      // the last few days
      'recent': 'recent',
      'de curând': 'recent',
      'în ultima vreme': 'recent',
      'ultima vreme': 'recent',
      'în ultimul timp': 'recent',
      'ultimul timp': 'recent',
      'în ultimele zile': 'recent',
      'ultimele zile': 'recent',
      'ultimele câteva zile': 'recent',
      'zilele astea': 'recent',
      'zilele acestea': 'recent',
      'în ultima perioadă': 'recent',
    }),
    units: vr({
      'zi': 'day', 'zile': 'day', 'zilele': 'day', 'ziua': 'day',
      'săptămână': 'week', 'săptămâna': 'week', 'săptămâni': 'week', 'săptămânile': 'week',
      'lună': 'month', 'luna': 'month', 'luni': 'month', 'lunile': 'month',
      'an': 'year', 'anul': 'year', 'ani': 'year', 'anii': 'year',
    }),
    lastWords: v(
      'ultimele', 'ultimii', 'ultima', 'ultimul', 'trecute', 'trecuți', 'trecută', 'trecut', 'precedente', 'precedenți',
      'anterioare', 'anteriori',
    ),
    dualWords: {},
    ago: { words: ['acum'], position: 'before' },
    monthAliases: vr({ 'ian': 0, 'iun': 5, 'iul': 6, 'sep': 8, 'sept': 8 }),
    // "mai" = May / "more", "mar" = "apple" typed without diacritics: months only with "luna" before or a year after.
    monthNeedsContext: ['mai', 'mar'],
    monthLeadWords: v('luna', 'lunii', 'lună'),
    rangeConnectors: v('între', 'și', 'de', 'la', 'până', 'din', 'pe', 'începând', 'cu', 'data', 'datele', 'dintre'),
  },
  metrics: vr({
    'dispoziție': 'mood', 'dispoziția': 'mood', 'dispoziției': 'mood', 'dispoziții': 'mood',
    'starea de spirit': 'mood', 'stare de spirit': 'mood', 'stării de spirit': 'mood', 'starea mea': 'mood',
    'moral': 'mood', 'moralul': 'mood', 'moralului': 'mood', 'umoare': 'mood', 'umoarea': 'mood', 'dispoziția mea': 'mood',
    'energie': 'energy', 'energia': 'energy', 'energiei': 'energy', 'nivelul de energie': 'energy',
    'nivel de energie': 'energy', 'nivelul energiei': 'energy', 'energia mea': 'energy',
    'stres': 'stress', 'stresul': 'stress', 'stresului': 'stress', 'nivelul de stres': 'stress', 'nivel de stres': 'stress',
    'nivelul stresului': 'stress', 'tensiune': 'stress', 'tensiunea': 'stress', 'presiune': 'stress', 'presiunea': 'stress',
    'somn': 'sleepHours', 'somnul': 'sleepHours', 'somnului': 'sleepHours', 'dormit': 'sleepHours', 'dorm': 'sleepHours',
    'dormi': 'sleepHours', 'dormisem': 'sleepHours', 'ore de somn': 'sleepHours', 'orele de somn': 'sleepHours',
    'durata somnului': 'sleepHours',
    'calitatea somnului': 'sleepQuality', 'calitate a somnului': 'sleepQuality', 'calitatea somnului meu': 'sleepQuality',
    'sport': 'exerciseMinutes', 'sportul': 'exerciseMinutes', 'sportului': 'exerciseMinutes',
    'exerciții': 'exerciseMinutes', 'exercițiu': 'exerciseMinutes', 'exercițiile': 'exerciseMinutes',
    'exerciții fizice': 'exerciseMinutes', 'antrenament': 'exerciseMinutes', 'antrenamente': 'exerciseMinutes',
    'antrenamentul': 'exerciseMinutes', 'antrenat': 'exerciseMinutes', 'alergat': 'exerciseMinutes',
    'alergare': 'exerciseMinutes', 'alergarea': 'exerciseMinutes', 'mișcare': 'exerciseMinutes',
    'mișcarea': 'exerciseMinutes', 'activitate fizică': 'exerciseMinutes', 'activitatea fizică': 'exerciseMinutes',
    'activitatea': 'exerciseMinutes', 'activitate': 'exerciseMinutes', 'sală': 'exerciseMinutes',
    'sala': 'exerciseMinutes', 'fitness': 'exerciseMinutes', 'înot': 'exerciseMinutes', 'înotat': 'exerciseMinutes',
    'bicicletă': 'exerciseMinutes', 'jogging': 'exerciseMinutes', 'minute de sport': 'exerciseMinutes',
    'minutele de sport': 'exerciseMinutes',
  }),
  thresholdUnits: vr({
    'ore': 'sleepHours', 'oră': 'sleepHours', 'ora': 'sleepHours', 'h': 'sleepHours',
    'minute': 'exerciseMinutes', 'minut': 'exerciseMinutes', 'min': 'exerciseMinutes',
    'puncte': null, 'punct': null, 'pct': null, 'stele': null,
  }),
  comparators: [
    ...cmp('nu mai mult de', 'lte'),
    ...cmp('nu mai puțin de', 'gte'),
    ...cmp('mai puțin de', 'lt'),
    ...cmp('mai puțin decât', 'lt'),
    ...cmp('mai mic de', 'lt'),
    ...cmp('mai mică de', 'lt'),
    ...cmp('mai mici de', 'lt'),
    ...cmp('mai mic decât', 'lt'),
    ...cmp('mai mică decât', 'lt'),
    ...cmp('mai scăzut de', 'lt'),
    ...cmp('mai scăzută de', 'lt'),
    ...cmp('sub', 'lt'),
    ...cmp('cel mult', 'lte'),
    ...cmp('până la', 'lte'),
    ...cmp('maximum', 'lte'),
    ...cmp('maxim', 'lte'),
    ...cmp('max', 'lte'),
    ...cmp('mai mult de', 'gt'),
    ...cmp('mai mult decât', 'gt'),
    ...cmp('mai mare de', 'gt'),
    ...cmp('mai mari de', 'gt'),
    ...cmp('mai mare decât', 'gt'),
    ...cmp('mai ridicat de', 'gt'),
    ...cmp('mai ridicată de', 'gt'),
    ...cmp('de peste', 'gt'),
    ...cmp('peste', 'gt'),
    ...cmp('cel puțin', 'gte'),
    ...cmp('minimum', 'gte'),
    ...cmp('minim', 'gte'),
    ...cmp('măcar', 'gte'),
    ...cmp('exact', 'eq'),
    ...cmp('fix', 'eq'),
    ...cmp('egal cu', 'eq'),
    { words: ['<'], comparator: 'lt' },
    { words: ['<='], comparator: 'lte' },
    { words: ['>'], comparator: 'gt' },
    { words: ['>='], comparator: 'gte' },
    { words: ['='], comparator: 'eq' },
  ],
  negations: v('fără', 'nu', 'n-am', 'n-a', 'niciun', 'nicio', 'deloc', 'zero'),
  rank: {
    good: v(
      'bine', 'bun', 'bună', 'bune', 'buni', 'fericit', 'fericită', 'fericite', 'frumos', 'frumoasă', 'frumoase', 'plăcut',
      'plăcută', 'plăcute', 'minunat', 'minunată', 'minunate', 'grozav', 'grozavă', 'grozave', 'pozitiv', 'pozitivă',
      'pozitive', 'relaxat', 'relaxată', 'relaxante', 'vesel', 'veselă', 'vesele', 'reușit', 'reușită', 'reușite',
      'excelent', 'excelentă',
    ),
    bad: v(
      'rău', 'rea', 'rele', 'prost', 'proastă', 'proaste', 'greu', 'grea', 'grele', 'dificil', 'dificilă', 'dificile', 'trist',
      'tristă', 'triste', 'stresant', 'stresantă', 'stresante', 'negativ', 'negativă', 'negative', 'groaznic', 'groaznică',
      'groaznice', 'îngrozitor', 'îngrozitoare', 'urât', 'urâtă', 'urâte', 'obositor', 'obositoare', 'nasol', 'nasoală',
      'nasoale', 'apăsător', 'apăsătoare',
    ),
    high: v('mare', 'mari', 'ridicat', 'ridicată', 'ridicate', 'înalt', 'înaltă', 'mult', 'multă', 'energic', 'energică', 'odihnit', 'odihnită'),
    low: v('mic', 'mică', 'mici', 'scăzut', 'scăzută', 'scăzute', 'redus', 'redusă', 'puțin', 'puțină', 'puține', 'obosit', 'obosită', 'epuizat', 'epuizată'),
    markersBefore: ['mai'],
    markersAfter: [],
    dayWords: v('zile', 'zilele', 'ziua', 'zi'),
    bare: {
      best: v('bine', 'excelent', 'minunat', 'grozav'),
      worst: v('rău', 'prost', 'groaznic', 'îngrozitor', 'nasol'),
      high: v('maximă', 'maxime', 'record', 'vârf'),
      low: v('minimă', 'minime'),
    },
  },
  trend: {
    words: v(
      'schimbat', 'schimbată', 'schimbare', 'schimbarea', 'schimbări', 'schimbările', 'evoluat', 'evoluție', 'evoluția',
      'tendință', 'tendința', 'tendințe', 'tendințele', 'trend', 'trendul', 'dezvoltat', 'îmbunătățit', 'îmbunătățire',
      'îmbunătățirea', 'înrăutățit', 'înrăutățire', 'progresat', 'progres', 'creștere', 'scădere', 'variat', 'oscilat',
      'fluctuat', 'medie', 'media', 'mediu', 'în medie', 'în timp', 'de-a lungul timpului', 'cu timpul',
    ),
    leadWords: v('cum', 's-a', 's-au', 'a', 'au', 'am', 'ce'),
  },
  trigger: {
    words: v(
      'scris', 'scriu', 'scrisesem', 'menționat', 'pomenit', 'notat', 'consemnat', 'descris', 'povestit', 'amintit',
      'spus', 'vorbit', 'relatat',
    ),
    leadWords: v('când', 'ce', 'unde', 'am', 'oare', 'despre'),
    conjunctions: v('că', 'despre', 'ceva', 'de'),
    conjunctionPrefix: null,
  },
  // Label first, then aliases. The catalogue (emotions.<key>.label / .aliases) is merged in too.
  emotions: {
    happy: v('fericire', 'fericit', 'fericită', 'fericiți', 'fericite', 'bucuros', 'bucuroasă', 'bucurie', 'm-am bucurat',
      'vesel', 'veselă', 'voios', 'voioasă'),
    calm: v('calm', 'calmă', 'calmul', 'liniște', 'liniștit', 'liniștită', 'relaxat', 'relaxată', 'senin', 'senină',
      'împăcat', 'împăcată'),
    sad: v('tristețe', 'trist', 'tristă', 'triști', 'triste', 'abătut', 'abătută', 'necăjit', 'necăjită', 'deprimat',
      'deprimată', 'amărât', 'amărâtă'),
    angry: v('furie', 'furios', 'furioasă', 'supărat', 'supărată', 'nervos', 'nervoasă', 'iritat', 'iritată', 'enervat',
      'enervată', 'mânie', 'mânios', 'mânioasă', 'nervi'),
    stressed: v('stres', 'stresat', 'stresată', 'stresați', 'stresate', 'tensionat', 'tensionată', 'încordat', 'încordată',
      'sub presiune', 'agitat', 'agitată'),
    excited: v('entuziasm', 'entuziasmat', 'entuziasmată', 'încântat', 'încântată', 'nerăbdător', 'nerăbdătoare', 'entuziast'),
    tired: v('oboseală', 'obosit', 'obosită', 'obosiți', 'obosite', 'epuizat', 'epuizată', 'epuizare', 'extenuat',
      'extenuată', 'somnoros', 'somnoroasă', 'sleit', 'sleită', 'frânt', 'frântă', 'istovit', 'istovită'),
    satisfied: v('mulțumire', 'mulțumit', 'mulțumită', 'satisfacție', 'satisfăcut', 'satisfăcută', 'împlinit', 'împlinită'),
    frustrated: v('frustrare', 'frustrat', 'frustrată', 'frustrant'),
    anxious: v('anxietate', 'anxios', 'anxioasă', 'îngrijorat', 'îngrijorată', 'îngrijorare', 'neliniștit', 'neliniștită',
      'neliniște', 'teamă', 'frică', 'speriat', 'speriată', 'panică'),
    energetic: v('vitalitate', 'energic', 'energică', 'plin de energie', 'plină de energie', 'vioi', 'vioaie', 'dinamic',
      'dinamică', 'în formă'),
    grateful: v('recunoștință', 'recunoscător', 'recunoscătoare', 'gratitudine'),
    lonely: v('singurătate', 'singur', 'singură', 'izolat', 'izolată', 'însingurat', 'însingurată'),
    hopeful: v('speranță', 'plin de speranță', 'plină de speranță', 'optimist', 'optimistă', 'optimism', 'încrezător',
      'încrezătoare'),
    bored: v('plictiseală', 'plictisit', 'plictisită', 'plictis', 'plictisitor'),
    proud: v('mândrie', 'mândru', 'mândră'),
    focused: v('concentrare', 'concentrat', 'concentrată', 'focusat', 'focusată', 'atent', 'atentă'),
    overwhelmed: v('copleșire', 'copleșit', 'copleșită', 'depășit', 'depășită', 'suprasolicitat', 'suprasolicitată',
      'împovărat', 'împovărată'),
  },
  examples: [
    'În ce zile din ultima lună m-am simțit cel mai bine?',
    'Când am scris că eram obosit?',
    'În ce zile am dormit mai puțin de cinci ore?',
    'Cum s-a schimbat dispoziția mea în ultimele trei luni?',
    'În ce zile am fost stresat?',
    'Când am fost fericit săptămâna aceasta',
    'Zile cu energie peste 8 în ultimul an',
    'Însemnări despre muncă',
    'În iulie',
    'între 01/08/2026 și 15/08/2026',
  ],
};

export default table;
