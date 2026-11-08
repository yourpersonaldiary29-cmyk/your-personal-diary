/**
 * de - German keyword table of the smart-search parser (schema: ./index.ts).
 *
 * Notes for German:
 *  - Words are written in lower case with umlauts; `v()` / `vr()` below also register the
 *    standard transliteration typed on keyboards without umlauts (ä -> ae, ö -> oe, ü -> ue,
 *    ß -> ss). Plain-vowel spellings are NOT added because they collide with other words
 *    (schön -> "schon").
 *  - German inflects adjectives and nouns, so the usual forms are listed explicitly
 *    (letzte / letzten / letzter, Tag / Tage / Tagen, müde / müder ...).
 *  - "über" is both a comparator ("über 8") and "about" ("Einträge über Arbeit"): the parser
 *    only treats it as a comparator when a number follows, otherwise it is a stopword.
 *  - "vor" + number/unit is read as "N units ago" ("vor drei Tagen", "vor einer Woche").
 */
import type { ComparatorRule, SearchLanguageTable } from './index';
import type { Comparator } from '../../types';

const TRANSLIT: Record<string, string> = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' };

/** The word plus its umlaut-free transliteration. */
function variants(word: string): string[] {
  const plain = word.replace(/[äöüß]/g, (c) => TRANSLIT[c]);
  return plain === word ? [word] : [word, plain];
}

/** Word list with transliterated variants (deduplicated). */
function v(...words: string[]): string[] {
  return [...new Set(words.flatMap(variants))];
}

/** Record whose keys also get their transliterated variants. */
function vr<T>(record: Record<string, T>): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [key, value] of Object.entries(record)) for (const k of variants(key)) if (!(k in out)) out[k] = value;
  return out;
}

/** Comparator rule(s) for a space-separated phrase, with the transliterated variant. */
function cmp(phrase: string, comparator: Comparator): ComparatorRule[] {
  return variants(phrase).map((p) => ({ words: p.split(' '), comparator }));
}

const table: SearchLanguageTable = {
  locale: 'de',
  script: 'latin',
  tokenizer: 'space',
  dateOrder: 'dmy',
  prefixes: [],
  articlePrefixes: [],
  numberPrefixLetters: '',
  barePrefixTokens: [],
  articles: ['der', 'die', 'das', 'den', 'dem', 'des'],
  stopwords: v(
    // question words and auxiliaries
    'welche', 'welcher', 'welchen', 'welchem', 'welches', 'was', 'wann', 'wo', 'wie', 'warum', 'wieso', 'weshalb', 'wer',
    'wem', 'wen', 'wessen', 'ob', 'bin', 'bist', 'ist', 'sind', 'seid', 'war', 'waren', 'warst', 'wart', 'gewesen', 'sein',
    'habe', 'hab', 'hast', 'hat', 'haben', 'hatte', 'hatten', 'hattest', 'gehabt', 'werde', 'wirst', 'wird', 'werden',
    'wurde', 'wurden', 'worden', 'kann', 'konnte', 'könnte', 'muss', 'musste', 'soll', 'sollte', 'will', 'wollte', 'möchte',
    'darf', 'mag', 'tun', 'tat', 'getan', 'mache', 'machte', 'gemacht', 'ging', 'geht', 'gegangen', 'gibt', 'gab',
    // pronouns and determiners
    'ich', 'mich', 'mir', 'mein', 'meine', 'meinen', 'meinem', 'meiner', 'meines', 'du', 'dich', 'dir', 'dein', 'deine',
    'er', 'sie', 'es', 'ihn', 'ihm', 'ihr', 'ihre', 'wir', 'uns', 'unser', 'unsere', 'man', 'sich', 'selbst', 'selber',
    'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einen', 'einem', 'einer', 'eines', 'kein', 'keine', 'keinen',
    'keinem', 'dieser', 'diese', 'dieses', 'diesen', 'diesem', 'jede', 'jeder', 'jeden', 'jedem', 'alle', 'allen', 'aller',
    'alles', 'manche', 'einige', 'einigen', 'solche', 'etwas', 'nichts',
    // prepositions and conjunctions
    'an', 'auf', 'aus', 'bei', 'beim', 'mit', 'nach', 'seit', 'von', 'vom', 'zu', 'zum', 'zur', 'in', 'im', 'ins', 'am',
    'um', 'für', 'über', 'unter', 'vor', 'hinter', 'neben', 'zwischen', 'durch', 'gegen', 'ohne', 'bis', 'ab', 'während',
    'wegen', 'bezüglich', 'betreffend', 'und', 'oder', 'aber', 'doch', 'sondern', 'denn', 'dass', 'daß', 'weil', 'wenn',
    'als', 'so', 'dann', 'also', 'auch', 'noch', 'schon', 'nur', 'sehr', 'ganz', 'etwa', 'eher', 'mal', 'ja', 'nein',
    'nicht', 'nie', 'immer', 'oft', 'manchmal', 'wieder', 'jetzt', 'hier', 'da', 'dort', 'dabei', 'darüber', 'davon',
    'dazu', 'denen', 'dem',
    // degree and filler words
    'mehr', 'weniger', 'viel', 'viele', 'ziemlich', 'eigentlich', 'irgendwie', 'wirklich', 'besonders', 'bitte', 'gern',
    'gerne', 'zeig', 'zeige', 'zeigen', 'finde', 'finden', 'such', 'suche', 'suchen', 'gib', 'liste', 'auflisten', 'sag',
    'sage', 'sagen', 'dinge', 'sachen', 'zeit', 'zeiten', 'zeitraum', 'periode', 'male',
    // diary vocabulary
    'tag', 'tage', 'tagen', 'tages', 'eintrag', 'einträge', 'einträgen', 'eintrags', 'tagebuch', 'tagebuchs',
    'tagebucheintrag', 'tagebucheinträge', 'notiz', 'notizen', 'schlagwort', 'schlagworte', 'schlagwörter',
    'schlagwörtern', 'tags', 'markiert', 'gefühlt', 'fühlte', 'fühle', 'fühlen', 'gefühl', 'gefühle', 'erging',
  ),
  numberWords: vr({
    null: 0, eins: 1, ein: 1, eine: 1, einen: 1, einem: 1, einer: 1, zwei: 2, drei: 3, vier: 4, fünf: 5, sechs: 6,
    sieben: 7, acht: 8, neun: 9, zehn: 10, elf: 11, zwölf: 12, dreizehn: 13, vierzehn: 14, fünfzehn: 15, sechzehn: 16,
    siebzehn: 17, achtzehn: 18, neunzehn: 19, zwanzig: 20, dreißig: 30, vierzig: 40, fünfzig: 50, sechzig: 60,
    siebzig: 70, achtzig: 80, neunzig: 90, hundert: 100, anderthalb: 1.5, eineinhalb: 1.5,
  }),
  halfPhrases: ['und einhalb', 'einhalb', 'und eine halbe'],
  periods: {
    phrases: vr({
      'heute': 'today',
      'gestern': 'yesterday',
      'vorgestern': 'twoDaysAgo',
      // the last 7 days
      'diese woche': 'week',
      'dieser woche': 'week',
      'in dieser woche': 'week',
      'letzte woche': 'week',
      'letzten woche': 'week',
      'in der letzten woche': 'week',
      'vergangene woche': 'week',
      'vergangenen woche': 'week',
      'in der vergangenen woche': 'week',
      'vorige woche': 'week',
      'vorigen woche': 'week',
      'in der vorigen woche': 'week',
      'die letzte woche': 'week',
      'seit einer woche': 'week',
      // the last 30 days
      'diesen monat': 'month',
      'dieser monat': 'month',
      'diesem monat': 'month',
      'in diesem monat': 'month',
      'letzten monat': 'month',
      'letzter monat': 'month',
      'im letzten monat': 'month',
      'vergangenen monat': 'month',
      'im vergangenen monat': 'month',
      'vorigen monat': 'month',
      'im vorigen monat': 'month',
      'seit einem monat': 'month',
      // the last 180 days
      'letztes halbes jahr': 'halfYear',
      'letzten halben jahr': 'halfYear',
      'im letzten halben jahr': 'halfYear',
      'im vergangenen halben jahr': 'halfYear',
      'letzte halbe jahr': 'halfYear',
      'das letzte halbe jahr': 'halfYear',
      'letzten sechs monate': 'halfYear',
      'letzten sechs monaten': 'halfYear',
      'seit einem halben jahr': 'halfYear',
      // the last 365 days
      'dieses jahr': 'year',
      'diesem jahr': 'year',
      'in diesem jahr': 'year',
      'letztes jahr': 'year',
      'letzten jahr': 'year',
      'im letzten jahr': 'year',
      'vergangenes jahr': 'year',
      'vergangenen jahr': 'year',
      'im vergangenen jahr': 'year',
      'voriges jahr': 'year',
      'vorigen jahr': 'year',
      'im vorigen jahr': 'year',
      'letzten zwölf monate': 'year',
      'letzten zwölf monaten': 'year',
      'seit einem jahr': 'year',
      // since 1 January / since the 1st of the month
      'seit jahresbeginn': 'startYear',
      'seit jahresanfang': 'startYear',
      'seit anfang des jahres': 'startYear',
      'seit beginn des jahres': 'startYear',
      'seit anfang dieses jahres': 'startYear',
      'seit beginn dieses jahres': 'startYear',
      'bisher in diesem jahr': 'startYear',
      'dieses jahr bisher': 'startYear',
      'seit monatsbeginn': 'startMonth',
      'seit monatsanfang': 'startMonth',
      'seit anfang des monats': 'startMonth',
      'seit beginn des monats': 'startMonth',
      'seit anfang dieses monats': 'startMonth',
      'bisher in diesem monat': 'startMonth',
      'diesen monat bisher': 'startMonth',
      // the last few days
      'in letzter zeit': 'recent',
      'letzter zeit': 'recent',
      'kürzlich': 'recent',
      'neulich': 'recent',
      'in den letzten tagen': 'recent',
      'die letzten tage': 'recent',
      'letzten tagen': 'recent',
      'in den vergangenen tagen': 'recent',
      'vergangenen tagen': 'recent',
      'in den letzten paar tagen': 'recent',
      'letzten paar tagen': 'recent',
      'dieser tage': 'recent',
      'in den letzten wochen': 'recent',
    }),
    units: vr({
      'tag': 'day', 'tage': 'day', 'tagen': 'day', 'tages': 'day',
      'woche': 'week', 'wochen': 'week',
      'monat': 'month', 'monate': 'month', 'monaten': 'month', 'monats': 'month',
      'jahr': 'year', 'jahre': 'year', 'jahren': 'year', 'jahres': 'year',
    }),
    lastWords: v(
      'letzten', 'letzte', 'letzter', 'letztes', 'vergangenen', 'vergangene', 'vergangener', 'vorigen', 'vorige',
      'zurückliegenden', 'zurückliegende', 'vorherigen', 'vorhergehenden',
    ),
    dualWords: {},
    ago: { words: ['vor'], position: 'before' },
    monthAliases: vr({ 'jänner': 0, 'jän': 0, 'feber': 1, 'märz': 2, 'marz': 2, 'sept': 8 }),
    monthNeedsContext: [],
    monthLeadWords: v('im', 'in', 'monat', 'während', 'den', 'dem', 'des', 'seit', 'über', 'aus', 'vom', 'ab'),
    rangeConnectors: v('zwischen', 'und', 'vom', 'von', 'bis', 'zum', 'am', 'ab', 'seit', 'dem', 'den', 'datum'),
  },
  metrics: vr({
    'stimmung': 'mood', 'stimmungen': 'mood', 'laune': 'mood', 'gemütszustand': 'mood', 'gemütslage': 'mood',
    'stimmungslage': 'mood', 'befinden': 'mood', 'gefühlslage': 'mood',
    'energie': 'energy', 'energielevel': 'energy', 'energieniveau': 'energy', 'energiepegel': 'energy', 'antrieb': 'energy',
    'stress': 'stress', 'stresslevel': 'stress', 'stressniveau': 'stress', 'stresspegel': 'stress', 'belastung': 'stress',
    'druck': 'stress',
    'schlaf': 'sleepHours', 'schlafs': 'sleepHours', 'schlafen': 'sleepHours', 'geschlafen': 'sleepHours',
    'schlief': 'sleepHours', 'schlafdauer': 'sleepHours', 'schlafstunden': 'sleepHours', 'stunden schlaf': 'sleepHours',
    'schlafzeit': 'sleepHours',
    'schlafqualität': 'sleepQuality', 'qualität des schlafs': 'sleepQuality', 'qualität meines schlafs': 'sleepQuality',
    'qualität des schlafes': 'sleepQuality', 'qualität meines schlafes': 'sleepQuality',
    'sport': 'exerciseMinutes', 'sport gemacht': 'exerciseMinutes', 'sportlich': 'exerciseMinutes',
    'bewegung': 'exerciseMinutes', 'bewegt': 'exerciseMinutes', 'training': 'exerciseMinutes',
    'trainiert': 'exerciseMinutes', 'trainieren': 'exerciseMinutes', 'workout': 'exerciseMinutes',
    'fitness': 'exerciseMinutes', 'fitnessstudio': 'exerciseMinutes', 'gym': 'exerciseMinutes',
    'laufen': 'exerciseMinutes', 'gelaufen': 'exerciseMinutes', 'joggen': 'exerciseMinutes', 'gejoggt': 'exerciseMinutes',
    'schwimmen': 'exerciseMinutes', 'geschwommen': 'exerciseMinutes', 'radfahren': 'exerciseMinutes',
    'körperliche aktivität': 'exerciseMinutes', 'aktivität': 'exerciseMinutes', 'sportminuten': 'exerciseMinutes',
    'minuten sport': 'exerciseMinutes', 'sportdauer': 'exerciseMinutes',
  }),
  thresholdUnits: vr({
    'stunden': 'sleepHours', 'stunde': 'sleepHours', 'std': 'sleepHours', 'h': 'sleepHours',
    'minuten': 'exerciseMinutes', 'minute': 'exerciseMinutes', 'min': 'exerciseMinutes',
    'punkte': null, 'punkten': null, 'punkt': null, 'sterne': null, 'sternen': null,
  }),
  comparators: [
    // Comparators AFTER the number (and its unit): see ComparatorRule.position.
    { words: ['oder', 'weniger'], comparator: 'lte', position: 'after' },
    { words: ['oder', 'kürzer'], comparator: 'lte', position: 'after' },
    { words: ['oder', 'kuerzer'], comparator: 'lte', position: 'after' },
    { words: ['oder', 'niedriger'], comparator: 'lte', position: 'after' },
    { words: ['höchstens'], comparator: 'lte', position: 'after' },
    { words: ['hoechstens'], comparator: 'lte', position: 'after' },
    { words: ['oder', 'mehr'], comparator: 'gte', position: 'after' },
    { words: ['oder', 'länger'], comparator: 'gte', position: 'after' },
    { words: ['oder', 'laenger'], comparator: 'gte', position: 'after' },
    { words: ['oder', 'höher'], comparator: 'gte', position: 'after' },
    { words: ['oder', 'hoeher'], comparator: 'gte', position: 'after' },
    { words: ['mindestens'], comparator: 'gte', position: 'after' },
    ...cmp('weniger als', 'lt'),
    ...cmp('niedriger als', 'lt'),
    ...cmp('kleiner als', 'lt'),
    ...cmp('kürzer als', 'lt'),
    ...cmp('geringer als', 'lt'),
    ...cmp('unterhalb von', 'lt'),
    ...cmp('unterhalb', 'lt'),
    ...cmp('unter', 'lt'),
    ...cmp('höchstens', 'lte'),
    ...cmp('maximal', 'lte'),
    ...cmp('max', 'lte'),
    ...cmp('bis zu', 'lte'),
    ...cmp('nicht mehr als', 'lte'),
    ...cmp('mehr als', 'gt'),
    ...cmp('höher als', 'gt'),
    ...cmp('größer als', 'gt'),
    ...cmp('länger als', 'gt'),
    ...cmp('oberhalb von', 'gt'),
    ...cmp('oberhalb', 'gt'),
    ...cmp('über', 'gt'),
    ...cmp('mindestens', 'gte'),
    ...cmp('wenigstens', 'gte'),
    ...cmp('minimum', 'gte'),
    ...cmp('nicht weniger als', 'gte'),
    ...cmp('genau', 'eq'),
    ...cmp('exakt', 'eq'),
    ...cmp('gleich', 'eq'),
    { words: ['<'], comparator: 'lt' },
    { words: ['<='], comparator: 'lte' },
    { words: ['>'], comparator: 'gt' },
    { words: ['>='], comparator: 'gte' },
    { words: ['='], comparator: 'eq' },
  ],
  negations: v('ohne', 'kein', 'keine', 'keinen', 'nicht', 'nie', 'ausgelassen', 'ausgefallen', 'null'),
  rank: {
    good: v(
      'gut', 'gute', 'guten', 'guter', 'gutes', 'besten', 'beste', 'bester', 'bestes', 'schön', 'schöne', 'schönen',
      'schönsten', 'glücklich', 'glückliche', 'glücklichen', 'glücklichsten', 'positiv', 'positive', 'positiven',
      'angenehm', 'angenehme', 'angenehmen', 'fröhlich', 'fröhlichen', 'entspannt', 'entspannten', 'entspanntesten',
      'toll', 'tolle', 'tollen', 'wunderbar', 'wunderbaren', 'super',
    ),
    bad: v(
      'schlecht', 'schlechte', 'schlechten', 'schlechtesten', 'schlimm', 'schlimme', 'schlimmen', 'schlimmsten', 'schwer',
      'schwere', 'schweren', 'schwersten', 'schwierig', 'schwierige', 'schwierigen', 'schwierigsten', 'hart', 'harte',
      'harten', 'härtesten', 'traurig', 'traurige', 'traurigen', 'traurigsten', 'stressig', 'stressige', 'stressigen',
      'stressigsten', 'negativ', 'negative', 'negativen', 'furchtbar', 'furchtbaren', 'schrecklich', 'schrecklichen',
      'anstrengend', 'anstrengenden', 'mies', 'miesen',
    ),
    high: v('hoch', 'hohe', 'hohen', 'hoher', 'höchste', 'höchsten', 'meisten', 'viel', 'energiegeladen', 'ausgeruht', 'erholt'),
    low: v('niedrig', 'niedrige', 'niedrigen', 'niedrigste', 'niedrigsten', 'tief', 'tiefen', 'tiefsten', 'wenig', 'wenigsten', 'müdesten'),
    markersBefore: ['am'],
    markersAfter: [],
    dayWords: v('tage', 'tagen', 'tag'),
    bare: {
      best: v('besten', 'beste', 'bester', 'bestes', 'schönsten', 'glücklichsten', 'gut', 'top'),
      worst: v('schlechtesten', 'schlechteste', 'schlimmsten', 'schlimmste', 'schwersten', 'schwierigsten', 'härtesten', 'traurigsten', 'schlecht', 'mies'),
      high: v('höchsten', 'höchste', 'höchster', 'höhepunkt', 'spitzenwert'),
      low: v('niedrigsten', 'niedrigste', 'tiefsten', 'tiefpunkt'),
    },
  },
  trend: {
    words: v(
      'verändert', 'geändert', 'verändern', 'veränderte', 'veränderung', 'veränderungen', 'entwickelt', 'entwickelte',
      'entwicklung', 'trend', 'trends', 'verlauf', 'tendenz', 'verbessert', 'verbesserung', 'verschlechtert',
      'verschlechterung', 'gestiegen', 'gesunken', 'zugenommen', 'abgenommen', 'schwankt', 'geschwankt', 'schwankungen',
      'durchschnitt', 'durchschnittlich', 'durchschnittliche', 'durchschnittlichen', 'durchschnittlicher', 'schnitt',
      'mittelwert', 'im laufe der zeit', 'über die zeit', 'mit der zeit',
    ),
    leadWords: v('wie', 'hat', 'haben', 'sich', 'was'),
  },
  trigger: {
    words: v(
      'geschrieben', 'schrieb', 'aufgeschrieben', 'erwähnt', 'notiert', 'eingetragen', 'festgehalten', 'beschrieben',
      'erzählt', 'berichtet', 'vermerkt', 'gesagt',
    ),
    leadWords: v('wann', 'was', 'wo', 'habe', 'hab', 'hatte', 'ich'),
    conjunctions: v('dass', 'daß', 'über', 'von', 'etwas'),
    conjunctionPrefix: null,
  },
  // Label first, then aliases. The catalogue (emotions.<key>.label / .aliases) is merged in too.
  emotions: {
    happy: v('glücklich', 'glückliche', 'glücklicher', 'glückliches', 'glück', 'froh', 'frohe', 'fröhlich', 'fröhliche',
      'freudig', 'freude', 'heiter', 'gut gelaunt', 'gut drauf', 'happy'),
    calm: v('ruhig', 'ruhige', 'ruhiger', 'ruhe', 'gelassen', 'gelassenheit', 'entspannt', 'entspannte', 'entspannter',
      'friedlich', 'ausgeglichen'),
    sad: v('traurig', 'traurige', 'trauriger', 'traurigkeit', 'unglücklich', 'niedergeschlagen', 'bedrückt', 'betrübt',
      'deprimiert', 'geknickt', 'melancholisch'),
    angry: v('wütend', 'wütende', 'wütender', 'wut', 'ärger', 'verärgert', 'sauer', 'zornig', 'gereizt', 'genervt',
      'ärgerlich', 'aufgebracht'),
    stressed: v('gestresst', 'gestresste', 'gestresster', 'stress', 'angespannt', 'anspannung', 'unter druck', 'gehetzt',
      'hektisch'),
    excited: v('begeistert', 'begeisterte', 'begeisterung', 'aufgeregt', 'aufgeregte', 'gespannt', 'vorfreude', 'euphorisch'),
    tired: v('müde', 'müder', 'müdigkeit', 'erschöpft', 'erschöpfte', 'erschöpfung', 'ausgelaugt', 'schläfrig', 'kaputt',
      'übermüdet', 'platt'),
    satisfied: v('zufrieden', 'zufriedene', 'zufriedener', 'zufriedenheit', 'erfüllt', 'befriedigt'),
    frustrated: v('frustriert', 'frustrierte', 'frust', 'frustration', 'frustrierend'),
    anxious: v('ängstlich', 'ängstliche', 'angst', 'besorgt', 'sorge', 'sorgen', 'nervös', 'unruhig', 'beunruhigt', 'panisch'),
    energetic: v('energiegeladen', 'voller energie', 'schwungvoll', 'tatkräftig', 'lebhaft', 'munter', 'motiviert', 'fit'),
    grateful: v('dankbar', 'dankbare', 'dankbarkeit'),
    lonely: v('einsam', 'einsame', 'einsamer', 'einsamkeit', 'allein', 'alleine', 'isoliert'),
    hopeful: v('hoffnungsvoll', 'hoffnung', 'zuversichtlich', 'zuversicht', 'optimistisch', 'optimismus'),
    bored: v('gelangweilt', 'langeweile', 'langweilig'),
    proud: v('stolz', 'stolze', 'stolzer', 'stolz auf mich'),
    focused: v('konzentriert', 'konzentration', 'fokussiert', 'fokus'),
    overwhelmed: v('überfordert', 'überforderung', 'überwältigt', 'überlastet', 'überlastung'),
  },
  examples: [
    'An welchen Tagen im letzten Monat habe ich mich am besten gefühlt?',
    'Wann habe ich geschrieben, dass ich müde war?',
    'An welchen Tagen habe ich weniger als fünf Stunden geschlafen?',
    'Wie hat sich meine Stimmung in den letzten drei Monaten verändert?',
    'An welchen Tagen war ich gestresst?',
    'Wann war ich diese Woche glücklich',
    'Tage mit Energie über 8 im letzten Jahr',
    'Einträge über Arbeit',
    'Im Juli',
    'zwischen 01/08/2026 und 15/08/2026',
  ],
};

export default table;
