/**
 * cs - Czech keyword table of the smart-search parser (schema: ./index.ts).
 *
 * Notes for Czech:
 *  - Words are written in lower case with diacritics; `v()` / `vr()` / `cmp()` below also register
 *    the spelling without diacritics (á->a, č->c, ě->e, ř->r, š->s, ů->u, ž->z ...), which many
 *    people type on foreign keyboards.
 *  - Czech inflects nouns, adjectives and past-tense verbs (with gender: spal / spala, unavený /
 *    unavená); the parser compares whole words, so the usual case forms and both genders are listed.
 *  - Comparators stand before the number ("méně než pět hodin", "alespoň 8", "nad 8", "do 6 hodin").
 *  - Periods: "za poslední měsíc", "za poslední tři měsíce" (number + unit after "poslední"),
 *    "před týdnem" / "před třemi dny" (ago word before the unit), "v červenci" (locative month
 *    names are listed as aliases). Intl short month names (led, dub, lis, pro = "for" ...) count only
 *    with a lead word or a year.
 *  - "necvičil jsem" cannot be read as "no exercise" (the negation is glued to the verb); "bez cvičení" can.
 */
import type { ComparatorRule, SearchLanguageTable } from './index';
import type { Comparator } from '../../types';

const PLAIN: Record<string, string> = {
  á: 'a', č: 'c', ď: 'd', é: 'e', ě: 'e', í: 'i', ň: 'n', ó: 'o', ř: 'r', š: 's', ť: 't', ú: 'u', ů: 'u', ý: 'y', ž: 'z',
};

/** The word and its spelling without diacritics. */
function variants(word: string): string[] {
  const plain = word.replace(/[áčďéěíňóřšťúůýž]/g, (c) => PLAIN[c]);
  return plain === word ? [word] : [word, plain];
}

/** Word list with diacritic-free variants (deduplicated). */
function v(...words: string[]): string[] {
  return [...new Set(words.flatMap(variants))];
}

/** Record whose keys also get their diacritic-free variants. */
function vr<T>(record: Record<string, T>): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [key, value] of Object.entries(record)) for (const k of variants(key)) if (!(k in out)) out[k] = value;
  return out;
}

/** Comparator rule(s) for a space-separated phrase, with its diacritic-free variant. */
function cmp(phrase: string, comparator: Comparator): ComparatorRule[] {
  return variants(phrase).map((p) => ({ words: p.split(' '), comparator }));
}

const table: SearchLanguageTable = {
  locale: 'cs',
  script: 'latin',
  tokenizer: 'space',
  dateOrder: 'dmy',
  prefixes: [],
  // Light stemming for text search: case endings ("o práci" finds "práce").
  stemSuffixes: ['ami', 'ech', 'ách', 'ům', 'ou', 'em', 'ím', 'y', 'i', 'a', 'u', 'e', 'ě', 'o', 'é', 'í'],
  stemMinLength: 4,
  articlePrefixes: [],
  numberPrefixLetters: '',
  barePrefixTokens: [],
  articles: [],
  stopwords: v(
    // question words
    'který', 'která', 'které', 'kterých', 'kterým', 'kterými', 'kterou', 'kterého', 'kterém', 'kteří', 'co', 'čem', 'čeho',
    'čemu', 'čím', 'kdy', 'kde', 'kam', 'jak', 'proč', 'kdo', 'koho', 'kolik', 'jaký', 'jaká', 'jaké', 'jakých', 'jakém',
    'jakou', 'zda', 'jestli', 'jestliže', 'li', 'vůbec',
    // pronouns and determiners
    'já', 'mě', 'mně', 'mi', 'mnou', 'můj', 'moje', 'má', 'mé', 'mého', 'mému', 'mém', 'mým', 'mí', 'mých', 'mými', 'moji',
    'mojí', 'svůj', 'svoje', 'své', 'svého', 'svém', 'svým', 'svých', 'sebe', 'sobě', 'ty', 'tě', 'ti', 'tvůj', 'tvoje',
    'on', 'ona', 'ono', 'oni', 'my', 'nás', 'nám', 'náš', 'naše', 'to', 'ten', 'ta', 'tu', 'tento', 'tato', 'toto',
    'tyto', 'tenhle', 'tahle', 'tohle', 'tom', 'tomto', 'tohoto', 'tomu', 'těch', 'těchto', 'těmi', 'tím', 'tak', 'takový',
    'nějaký', 'nějaké', 'nějakou', 'něco', 'nic', 'všechny', 'všechno', 'vše', 'všech', 'každý', 'každé', 'každém',
    'jiné', 'jiný', 'ostatní',
    // prepositions and conjunctions
    'v', 've', 'na', 'za', 'do', 'od', 'ode', 'po', 'při', 'pro', 's', 'se', 'z', 'ze', 'k', 'ke', 'o', 'u', 'bez', 'nad',
    'pod', 'před', 'mezi', 'přes', 'během', 'kolem', 'okolo', 'podle', 'mimo', 'ohledně', 'kvůli', 'a', 'i', 'nebo',
    'ani', 'ale', 'však', 'že', 'aby', 'protože', 'když', 'jako', 'než', 'také', 'taky', 'jen', 'jenom', 'už', 'ještě',
    'teď', 'nyní', 'tady', 'tam', 'zde', 'pak', 'potom', 'hodně', 'moc', 'velmi', 'dost', 'trochu', 'více', 'víc',
    'méně', 'míň', 'celkem', 'vždy', 'někdy', 'často', 'zase', 'znovu',
    // verbs of being and feeling
    'jsem', 'jsi', 'je', 'jsme', 'jste', 'jsou', 'byl', 'byla', 'bylo', 'byli', 'byly', 'být', 'bude', 'budu', 'mám',
    'máš', 'měl', 'měla', 'měli', 'mít', 'si', 'sis', 'ses', 'cítil', 'cítila', 'cítím', 'cítit', 'cítili', 'pocit',
    'pocitem', 'pocity', 'připadal', 'připadala', 'trápil', 'trápila', 'trápilo', 'trval', 'trvala', 'trvalo', 'šlo',
    'dařilo', 'bývalo', 'bylo mi',
    // diary vocabulary and requests
    'den', 'dny', 'dní', 'dnů', 'dnech', 'dne', 'dni', 'dnem', 'záznam', 'záznamy', 'záznamů', 'záznamu', 'záznamech',
    'záznamem', 'zápis', 'zápisy', 'zápisů', 'zápisu', 'zápisech', 'deník', 'deníku', 'deníkem', 'poznámka', 'poznámky',
    'poznámek', 'poznámce', 'štítek', 'štítkem', 'štítky', 'štítku', 'štítků', 'tag', 'tagem', 'tagy', 'označený',
    'označené', 'období', 'čas', 'času', 'věc', 'věci', 'ukaž', 'ukázat', 'najdi', 'najít', 'hledej', 'vyhledej', 'zobraz',
    'zobrazit', 'seznam', 'vypiš', 'prosím', 'chci', 'chtěl', 'chtěla', 'vidět', 'potřebuji', 'dnes', 'včera',
  ),
  numberWords: vr({
    nula: 0, jeden: 1, jedna: 1, jedno: 1, jednoho: 1, jednom: 1, jedním: 1, jedné: 1, dva: 2, dvě: 2, dvou: 2, dvěma: 2,
    tři: 3, tří: 3, třech: 3, třem: 3, třemi: 3, čtyři: 4, čtyř: 4, čtyřech: 4, čtyřem: 4, čtyřmi: 4, pět: 5, pěti: 5,
    šest: 6, šesti: 6, sedm: 7, sedmi: 7, osm: 8, osmi: 8, devět: 9, devíti: 9, deset: 10, deseti: 10, jedenáct: 11,
    jedenácti: 11, dvanáct: 12, dvanácti: 12, třináct: 13, čtrnáct: 14, čtrnácti: 14, patnáct: 15, patnácti: 15,
    šestnáct: 16, sedmnáct: 17, osmnáct: 18, devatenáct: 19, dvacet: 20, dvaceti: 20, třicet: 30, třiceti: 30,
    čtyřicet: 40, padesát: 50, padesáti: 50, šedesát: 60, šedesáti: 60, sedmdesát: 70, osmdesát: 80, devadesát: 90,
    sto: 100, půl: 0.5, půldruhé: 1.5,
  }),
  halfPhrases: v('a půl'),
  periods: {
    phrases: vr({
      'dnes': 'today',
      'dneska': 'today',
      'dnešek': 'today',
      'dnešní den': 'today',
      'včera': 'yesterday',
      'včerejšek': 'yesterday',
      'včerejší den': 'yesterday',
      'předevčírem': 'twoDaysAgo',
      'předvčírem': 'twoDaysAgo',
      // the last 7 days
      'tento týden': 'week',
      'tenhle týden': 'week',
      'tomto týdnu': 'week',
      'tohoto týdne': 'week',
      'minulý týden': 'week',
      'minulém týdnu': 'week',
      'minulého týdne': 'week',
      'poslední týden': 'week',
      'posledním týdnu': 'week',
      'posledního týdne': 'week',
      'uplynulý týden': 'week',
      'uplynulém týdnu': 'week',
      'předchozí týden': 'week',
      'předchozím týdnu': 'week',
      // the last 30 days
      'tento měsíc': 'month',
      'tenhle měsíc': 'month',
      'tomto měsíci': 'month',
      'tohoto měsíce': 'month',
      'minulý měsíc': 'month',
      'minulém měsíci': 'month',
      'minulého měsíce': 'month',
      'poslední měsíc': 'month',
      'posledním měsíci': 'month',
      'posledního měsíce': 'month',
      'uplynulý měsíc': 'month',
      'uplynulém měsíci': 'month',
      'předchozí měsíc': 'month',
      'předchozím měsíci': 'month',
      // the last 180 days
      'posledního půl roku': 'halfYear',
      'posledních půl roku': 'halfYear',
      'poslední půlrok': 'halfYear',
      'posledním půlroce': 'halfYear',
      'uplynulého půl roku': 'halfYear',
      'uplynulý půlrok': 'halfYear',
      'posledních šest měsíců': 'halfYear',
      // the last 365 days
      'tento rok': 'year',
      'tenhle rok': 'year',
      'tomto roce': 'year',
      'tohoto roku': 'year',
      'letos': 'year',
      'letošní rok': 'year',
      'minulý rok': 'year',
      'minulém roce': 'year',
      'minulého roku': 'year',
      'loni': 'year',
      'vloni': 'year',
      'loňský rok': 'year',
      'poslední rok': 'year',
      'posledním roce': 'year',
      'posledního roku': 'year',
      'uplynulý rok': 'year',
      'uplynulém roce': 'year',
      'předchozí rok': 'year',
      'posledních dvanáct měsíců': 'year',
      // since 1 January / since the 1st of the month
      'od začátku roku': 'startYear',
      'od začátku tohoto roku': 'startYear',
      'od začátku letošního roku': 'startYear',
      'od začátku letoška': 'startYear',
      'od počátku roku': 'startYear',
      'letos zatím': 'startYear',
      'zatím letos': 'startYear',
      'od začátku měsíce': 'startMonth',
      'od začátku tohoto měsíce': 'startMonth',
      'od počátku měsíce': 'startMonth',
      'tento měsíc zatím': 'startMonth',
      'zatím tento měsíc': 'startMonth',
      // the last few days
      'poslední dobou': 'recent',
      'v poslední době': 'recent',
      'poslední době': 'recent',
      'nedávno': 'recent',
      'v posledních dnech': 'recent',
      'posledních dnech': 'recent',
      'posledních pár dní': 'recent',
      'posledních pár dnech': 'recent',
      'posledních několik dní': 'recent',
      'posledních několika dnech': 'recent',
      'v těchto dnech': 'recent',
      'těchto dnech': 'recent',
    }),
    units: vr({
      'den': 'day', 'dny': 'day', 'dní': 'day', 'dnů': 'day', 'dne': 'day', 'dnech': 'day', 'dnem': 'day', 'dnům': 'day',
      'týden': 'week', 'týdny': 'week', 'týdnů': 'week', 'týdne': 'week', 'týdnu': 'week', 'týdnech': 'week', 'týdnem': 'week',
      'měsíc': 'month', 'měsíce': 'month', 'měsíců': 'month', 'měsíci': 'month', 'měsících': 'month', 'měsícem': 'month',
      'rok': 'year', 'roky': 'year', 'roků': 'year', 'let': 'year', 'roku': 'year', 'roce': 'year', 'rokem': 'year',
      'letech': 'year', 'lety': 'year',
    }),
    lastWords: v(
      'poslední', 'posledních', 'posledním', 'posledního', 'uplynulé', 'uplynulých', 'uplynulý', 'uplynulá', 'minulé',
      'minulých', 'předchozí', 'předchozích', 'nedávné', 'nedávných',
    ),
    dualWords: {},
    ago: { words: ['před'], position: 'before' },
    monthAliases: vr({
      // nominative (for the spellings without diacritics), genitive ("od ledna") and locative ("v lednu")
      'leden': 0, 'ledna': 0, 'lednu': 0,
      'únor': 1, 'února': 1, 'únoru': 1,
      'březen': 2, 'března': 2, 'březnu': 2,
      'duben': 3, 'dubna': 3, 'dubnu': 3,
      'květen': 4, 'května': 4, 'květnu': 4,
      'červen': 5, 'června': 5, 'červnu': 5,
      'červenec': 6, 'července': 6, 'červenci': 6,
      'srpen': 7, 'srpna': 7, 'srpnu': 7,
      'září': 8,
      'říjen': 9, 'října': 9, 'říjnu': 9,
      'listopad': 10, 'listopadu': 10,
      'prosinec': 11, 'prosince': 11, 'prosinci': 11,
    }),
    // Intl short month names that are also ordinary words ("pro" = for, "led" = ice, "lis" = press ...)
    monthNeedsContext: ['led', 'úno', 'bře', 'dub', 'kvě', 'čvn', 'čvc', 'srp', 'zář', 'říj', 'lis', 'pro'],
    monthLeadWords: v('v', 've', 'během', 'za', 'měsíc', 'měsíci', 'měsíce', 'od', 'do'),
    rangeConnectors: v('mezi', 'a', 'od', 'ode', 'do', 'až', 'dne', 'k', 'ke'),
  },
  metrics: vr({
    'nálada': 'mood', 'nálady': 'mood', 'náladu': 'mood', 'náladě': 'mood', 'náladou': 'mood', 'nálad': 'mood',
    'rozpoložení': 'mood', 'psychika': 'mood', 'psychiku': 'mood', 'hodnocení nálady': 'mood',
    'energie': 'energy', 'energii': 'energy', 'energií': 'energy', 'úroveň energie': 'energy', 'úrovně energie': 'energy',
    'úrovni energie': 'energy', 'úrovní energie': 'energy', 'síla': 'energy', 'sil': 'energy',
    'stres': 'stress', 'stresu': 'stress', 'stresem': 'stress', 'stresy': 'stress', 'úroveň stresu': 'stress',
    'úrovně stresu': 'stress', 'úrovni stresu': 'stress', 'úrovní stresu': 'stress', 'vypětí': 'stress',
    'spánek': 'sleepHours', 'spánku': 'sleepHours', 'spánkem': 'sleepHours', 'spal': 'sleepHours', 'spala': 'sleepHours',
    'spali': 'sleepHours', 'nespal': 'sleepHours', 'nespala': 'sleepHours', 'vyspal': 'sleepHours', 'vyspala': 'sleepHours',
    'naspal': 'sleepHours', 'naspala': 'sleepHours', 'prospal': 'sleepHours', 'prospala': 'sleepHours', 'spát': 'sleepHours',
    'spím': 'sleepHours', 'hodiny spánku': 'sleepHours', 'hodin spánku': 'sleepHours', 'délka spánku': 'sleepHours',
    'délky spánku': 'sleepHours', 'délku spánku': 'sleepHours', 'doba spánku': 'sleepHours', 'dobu spánku': 'sleepHours',
    'kvalita spánku': 'sleepQuality', 'kvality spánku': 'sleepQuality', 'kvalitu spánku': 'sleepQuality',
    'kvalitě spánku': 'sleepQuality', 'kvalitou spánku': 'sleepQuality', 'kvalita mého spánku': 'sleepQuality',
    'kvalitu mého spánku': 'sleepQuality', 'kvality mého spánku': 'sleepQuality',
    'cvičení': 'exerciseMinutes', 'cvičil': 'exerciseMinutes', 'cvičila': 'exerciseMinutes', 'cvičit': 'exerciseMinutes',
    'cvičím': 'exerciseMinutes', 'zacvičil': 'exerciseMinutes', 'zacvičila': 'exerciseMinutes', 'sport': 'exerciseMinutes',
    'sportu': 'exerciseMinutes', 'sportem': 'exerciseMinutes', 'sportoval': 'exerciseMinutes', 'sportovala': 'exerciseMinutes',
    'trénink': 'exerciseMinutes', 'tréninku': 'exerciseMinutes', 'trénoval': 'exerciseMinutes', 'trénovala': 'exerciseMinutes',
    'pohyb': 'exerciseMinutes', 'pohybu': 'exerciseMinutes', 'pohybem': 'exerciseMinutes',
    'pohybová aktivita': 'exerciseMinutes', 'pohybové aktivity': 'exerciseMinutes', 'pohybovou aktivitu': 'exerciseMinutes',
    'pohybovou aktivitou': 'exerciseMinutes', 'aktivita': 'exerciseMinutes', 'aktivity': 'exerciseMinutes',
    'aktivitu': 'exerciseMinutes', 'běh': 'exerciseMinutes', 'běhání': 'exerciseMinutes', 'běhal': 'exerciseMinutes',
    'běhala': 'exerciseMinutes', 'posilovna': 'exerciseMinutes', 'posilovně': 'exerciseMinutes', 'fitness': 'exerciseMinutes',
    'minuty cvičení': 'exerciseMinutes', 'minut cvičení': 'exerciseMinutes', 'délka cvičení': 'exerciseMinutes',
    'délku cvičení': 'exerciseMinutes', 'doba cvičení': 'exerciseMinutes',
  }),
  thresholdUnits: vr({
    'hodin': 'sleepHours', 'hodiny': 'sleepHours', 'hodina': 'sleepHours', 'hodinu': 'sleepHours', 'hodinou': 'sleepHours',
    'hodinami': 'sleepHours', 'hod': 'sleepHours', 'h': 'sleepHours',
    'minut': 'exerciseMinutes', 'minuty': 'exerciseMinutes', 'minuta': 'exerciseMinutes', 'minutu': 'exerciseMinutes',
    'minutami': 'exerciseMinutes', 'min': 'exerciseMinutes',
    'bodů': null, 'body': null, 'bod': null, 'bodu': null, 'hvězdiček': null,
  }),
  comparators: [
    ...cmp('méně než', 'lt'),
    ...cmp('míň než', 'lt'),
    ...cmp('méně jak', 'lt'),
    ...cmp('menší než', 'lt'),
    ...cmp('nižší než', 'lt'),
    ...cmp('kratší než', 'lt'),
    ...cmp('pod', 'lt'),
    ...cmp('nejvýše', 'lte'),
    ...cmp('nejvýš', 'lte'),
    ...cmp('nanejvýš', 'lte'),
    ...cmp('maximálně', 'lte'),
    ...cmp('max', 'lte'),
    ...cmp('ne více než', 'lte'),
    ...cmp('ne víc než', 'lte'),
    ...cmp('do', 'lte'),
    ...cmp('více než', 'gt'),
    ...cmp('víc než', 'gt'),
    ...cmp('více jak', 'gt'),
    ...cmp('větší než', 'gt'),
    ...cmp('vyšší než', 'gt'),
    ...cmp('delší než', 'gt'),
    ...cmp('nad', 'gt'),
    ...cmp('přes', 'gt'),
    ...cmp('alespoň', 'gte'),
    ...cmp('aspoň', 'gte'),
    ...cmp('nejméně', 'gte'),
    ...cmp('minimálně', 'gte'),
    ...cmp('min', 'gte'),
    ...cmp('ne méně než', 'gte'),
    ...cmp('přesně', 'eq'),
    ...cmp('rovných', 'eq'),
    ...cmp('rovno', 'eq'),
    { words: ['<'], comparator: 'lt' },
    { words: ['<='], comparator: 'lte' },
    { words: ['>'], comparator: 'gt' },
    { words: ['>='], comparator: 'gte' },
    { words: ['='], comparator: 'eq' },
  ],
  negations: v(
    'bez', 'ne', 'žádné', 'žádný', 'žádná', 'žádnou', 'nula', 'vynechal', 'vynechala', 'vynechané', 'nesportoval',
    'nesportovala', 'necvičil', 'necvičila',
  ),
  rank: {
    good: v(
      'dobrý', 'dobrá', 'dobré', 'dobrých', 'dobrými', 'skvělý', 'skvělá', 'skvělé', 'skvělých', 'šťastný', 'šťastná',
      'šťastné', 'šťastných', 'příjemný', 'příjemná', 'příjemné', 'příjemných', 'pozitivní', 'krásný', 'krásná', 'krásné',
      'krásných', 'pohodový', 'pohodové', 'pohodových', 'úspěšný', 'úspěšné', 'úspěšných', 'povedené', 'povedený',
    ),
    bad: v(
      'špatný', 'špatná', 'špatné', 'špatných', 'těžký', 'těžká', 'těžké', 'těžkých', 'náročný', 'náročná', 'náročné',
      'náročných', 'smutný', 'smutná', 'smutné', 'smutných', 'stresující', 'stresujících', 'negativní', 'hrozný', 'hrozná',
      'hrozné', 'hrozných', 'mizerný', 'mizerné', 'mizerných', 'příšerné', 'nepříjemné', 'nepříjemných', 'vyčerpávající',
    ),
    high: v('vysoký', 'vysoká', 'vysoké', 'vysokou', 'energický', 'energická', 'odpočatý', 'odpočatá'),
    low: v('nízký', 'nízká', 'nízké', 'nízkou', 'unavený', 'unavená', 'vyčerpaný', 'vyčerpaná'),
    markersBefore: [],
    markersAfter: [],
    dayWords: v('dny', 'dnech', 'dní', 'dnů', 'den', 'dnem'),
    bare: {
      best: v(
        'nejlepší', 'nejlíp', 'nejlépe', 'nejšťastnější', 'nejkrásnější', 'nejpříjemnější', 'nejklidnější', 'nejpovedenější',
        'dobře', 'skvěle',
      ),
      worst: v(
        'nejhorší', 'nejhůř', 'nejhůře', 'nejtěžší', 'nejsmutnější', 'nejnáročnější', 'nejstresovější', 'špatně', 'mizerně',
        'hrozně',
      ),
      high: v('nejvyšší', 'nejvíc', 'nejvíce', 'maximální', 'nejsilnější', 'rekordní'),
      low: v('nejnižší', 'nejméně', 'nejmíň', 'minimální', 'nejslabší'),
    },
  },
  trend: {
    words: v(
      'změnila', 'změnil', 'změnilo', 'změnily', 'měnila', 'měnil', 'měnilo', 'měnily', 'mění', 'změna', 'změny', 'změnu',
      'vývoj', 'vývoje', 'vyvíjela', 'vyvíjel', 'vyvíjelo', 'trend', 'trendu', 'tendence', 'tendenci', 'zlepšila', 'zlepšil',
      'zlepšilo', 'zlepšení', 'zhoršila', 'zhoršil', 'zhoršilo', 'zhoršení', 'rostla', 'rostl', 'vzrostla', 'vzrostl',
      'klesala', 'klesal', 'klesla', 'klesl', 'kolísala', 'kolísal', 'průměr', 'průměrná', 'průměrný', 'průměrné', 'průměru',
      'průměrně', 'vypadala', 'vypadal', 'v průběhu času', 'v čase', 'postupem času', 'časem',
    ),
    leadWords: v('jak', 'se', 'si'),
  },
  trigger: {
    words: v(
      'psal', 'psala', 'napsal', 'napsala', 'píšu', 'píši', 'psáno', 'napsáno', 'zmínil', 'zmínila', 'zmiňoval', 'zmiňovala',
      'zmiňuji', 'zmiňuju', 'zapsal', 'zapsala', 'zapisoval', 'zapisovala', 'poznamenal', 'poznamenala', 'uvedl', 'uvedla',
      'popsal', 'popsala', 'popisoval', 'popisovala', 'zmínka', 'zmínky', 'zmínku',
    ),
    leadWords: v('kdy', 'co', 'kde', 'jsem', 'jsi', 'o', 'čem', 'v', 've', 'deníku'),
    conjunctions: v('že', 'o', 'jak', 'něco', 'si'),
    conjunctionPrefix: null,
  },
  // Label first, then aliases. The catalogue (emotions.<key>.label / .aliases) is merged in too.
  emotions: {
    happy: v('radost', 'radosti', 'radostí', 'šťastný', 'šťastná', 'šťastné', 'šťastně', 'štěstí', 'radostný', 'radostná',
      'veselý', 'veselá', 'vesele', 'v dobré náladě', 'měl jsem radost', 'měla jsem radost'),
    calm: v('klid', 'klidu', 'klidný', 'klidná', 'klidně', 'v klidu', 'uvolněný', 'uvolněná', 'pohoda', 'pohodě', 'v pohodě',
      'vyrovnaný', 'vyrovnaná', 'uklidněný', 'uklidněná'),
    sad: v('smutek', 'smutku', 'smutný', 'smutná', 'smutně', 'nešťastný', 'nešťastná', 'sklíčený', 'sklíčená', 'skleslý',
      'skleslá', 'deprese', 'depresivní', 'na dně', 'zdrcený', 'zdrcená', 'plakal', 'plakala'),
    angry: v('vztek', 'vzteku', 'vzteklý', 'vzteklá', 'naštvaný', 'naštvaná', 'naštvání', 'rozzlobený', 'rozzlobená', 'hněv',
      'hněvu', 'zlost', 'zlosti', 'zlostný', 'zlostná', 'podrážděný', 'podrážděná', 'rozčilený', 'rozčilená', 'otrávený',
      'otrávená'),
    stressed: v('stres', 'stresu', 've stresu', 'stresovaný', 'stresovaná', 'vystresovaný', 'vystresovaná', 'napětí',
      'napjatý', 'napjatá', 'pod tlakem', 'stresující'),
    excited: v('nadšení', 'nadšený', 'nadšená', 'natěšený', 'natěšená', 'vzrušení', 'vzrušený', 'vzrušená', 'nedočkavý',
      'nedočkavá'),
    tired: v('únava', 'únavy', 'únavou', 'unavený', 'unavená', 'unaveně', 'vyčerpaný', 'vyčerpaná', 'vyčerpání', 'ospalý',
      'ospalá', 'utahaný', 'utahaná', 'vyždímaný', 'vyždímaná', 'zničený', 'zničená', 'vyhořelý', 'vyhořelá'),
    satisfied: v('spokojenost', 'spokojenosti', 'spokojený', 'spokojená', 'naplnění', 'naplněný', 'naplněná'),
    frustrated: v('frustrace', 'frustrovaný', 'frustrovaná', 'frustrující', 'zklamání', 'zklamaný', 'zklamaná'),
    anxious: v('úzkost', 'úzkosti', 'úzkostný', 'úzkostná', 'ustaraný', 'ustaraná', 'obavy', 'obava', 'strach', 'strachu',
      'nervózní', 'nervozita', 'neklid', 'neklidný', 'neklidná', 'vystrašený', 'vystrašená'),
    energetic: v('elán', 'elánu', 'plný energie', 'plná energie', 'energický', 'energická', 'svěží', 'čilý', 'čilá',
      'nabitý', 'nabitá', 'plný sil', 'plná sil'),
    grateful: v('vděčnost', 'vděčnosti', 'vděčný', 'vděčná'),
    lonely: v('osamělost', 'osamělý', 'osamělá', 'samota', 'samotě', 'opuštěný', 'opuštěná', 'sám', 'sama'),
    hopeful: v('naděje', 'naději', 'nadějí', 'nadějný', 'nadějná', 'plný naděje', 'plná naděje', 'optimismus', 'optimistický',
      'optimistická'),
    bored: v('nuda', 'nudy', 'nudou', 'znuděný', 'znuděná', 'nudil jsem se', 'nudila jsem se', 'nudný', 'nudná', 'nudno'),
    proud: v('hrdost', 'hrdosti', 'hrdý', 'hrdá', 'pyšný', 'pyšná'),
    focused: v('soustředění', 'soustředěný', 'soustředěná', 'koncentrace', 'koncentrovaný', 'koncentrovaná'),
    overwhelmed: v('zahlcení', 'zahlcený', 'zahlcená', 'přetížený', 'přetížená', 'přetížení', 'zavalený', 'zavalená',
      'nad hlavu'),
  },
  examples: [
    'Které dny za poslední měsíc byly nejlepší?',
    'Kdy jsem psal, že jsem unavený?',
    'Ve kterých dnech trval můj spánek méně než pět hodin?',
    'Jak se změnila moje nálada za poslední tři měsíce?',
    'Ve kterých dnech mě trápil stres?',
    'Kdy jsem byl tento týden šťastný',
    'Dny s energií nad 8 za poslední rok',
    'záznamy o práci',
    'v červenci',
    'mezi 01/08/2026 a 15/08/2026',
  ],
};

export default table;
