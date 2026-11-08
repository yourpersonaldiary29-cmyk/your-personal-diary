/**
 * hu - Hungarian keyword table of the smart-search parser (schema: ./index.ts).
 *
 * Notes for Hungarian:
 *  - Hungarian glues case, possessive and person endings to the end of the word and the parser
 *    compares whole words (it strips prefixes, never suffixes), so the common inflected forms are
 *    listed explicitly (hónapban, héten, napokon, hangulatom, aludtam, júliusban, órát).
 *  - Words are written with accents; `v()` / `vr()` / `cmp()` below also register the spelling
 *    without accents (á->a, é->e, ő/ö->o, ű/ü->u ...), except where that collides with another
 *    word (fél -> "fel", öröm -> "orom", hála -> "hala").
 *  - "hét" is both "seven" and "week": it is a number word and a unit, and "az elmúlt hét" (the
 *    past week) is a fixed phrase.
 *  - Comparators must stand before the number ("kevesebb, mint öt órát", "legalább 8", "több mint 30
 *    percet"); the postposed forms ("öt óránál kevesebbet", "8 felett") cannot be read by the parser,
 *    which expects the number after the comparator.
 *  - "N ... ezelőtt" is read as "N units ago" ("egy héttel ezelőtt", "három nappal ezelőtt"); the
 *    possessive forms without a separate word ("két hete", "három napja") mean "ago" (periods.ago.units).
 *  - Typed dates are year-first (2026.08.01); a year written before a month name ("2025 augusztusában")
 *    is not attached to the month, which is then placed in the last twelve months.
 */
import type { ComparatorRule, SearchLanguageTable } from './index';
import type { Comparator } from '../../types';

const PLAIN: Record<string, string> = { á: 'a', é: 'e', í: 'i', ó: 'o', ö: 'o', ő: 'o', ú: 'u', ü: 'u', ű: 'u' };
/** Words whose accent-free spelling is another Hungarian word. */
const NO_PLAIN = new Set(['fél', 'másfél', 'öröm', 'hála', 'hálával', 'féltem']);

/** The word and its spelling without accents. */
function variants(word: string): string[] {
  if (NO_PLAIN.has(word)) return [word];
  const plain = word.replace(/[áéíóöőúüű]/g, (c) => PLAIN[c]);
  return plain === word ? [word] : [word, plain];
}

/** Word list with accent-free variants (deduplicated). */
function v(...words: string[]): string[] {
  return [...new Set(words.flatMap(variants))];
}

/** Record whose keys also get their accent-free variants. */
function vr<T>(record: Record<string, T>): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [key, value] of Object.entries(record)) for (const k of variants(key)) if (!(k in out)) out[k] = value;
  return out;
}

/** Comparator rule(s) for a space-separated phrase, with its accent-free variant. */
function cmp(phrase: string, comparator: Comparator): ComparatorRule[] {
  return variants(phrase).map((p) => ({ words: p.split(' '), comparator }));
}

/** Rules for a phrase that FOLLOWS the number and its unit ('öt óránál kevesebbet', '8 felett'). */
function cmpAfter(phrase: string, comparator: Comparator): ComparatorRule[] {
  return cmp(phrase, comparator).map((r) => ({ ...r, position: 'after' as const }));
}

const table: SearchLanguageTable = {
  locale: 'hu',
  script: 'latin',
  tokenizer: 'space',
  dateOrder: 'ymd',
  prefixes: [],
  // Light stemming for text search: common case endings ("munkában" finds "munka").
  stemSuffixes: ['ban', 'ben', 'ból', 'ből', 'nak', 'nek', 'val', 'vel', 'ról', 'ről', 'hoz', 'hez', 'höz', 'ra', 're', 'ba', 'be', 'ot', 'et', 'öt', 'at', 't'],
  stemMinLength: 4,
  articlePrefixes: [],
  numberPrefixLetters: '',
  barePrefixTokens: [],
  articles: ['a', 'az', 'egy'],
  stopwords: v(
    // question words
    'mely', 'melyik', 'melyek', 'melyiken', 'mikor', 'mit', 'mi', 'mik', 'hol', 'hogyan', 'hogy', 'miért', 'ki', 'kik', 'kit',
    'mennyi', 'hány', 'milyen', 'miről', 'mivel', 'vajon', 'e',
    // pronouns and determiners
    'a', 'az', 'egy', 'én', 'engem', 'nekem', 'enyém', 'magam', 'magamat', 'magamnak', 'te', 'ő', 'ez', 'ezt', 'azt', 'ezek',
    'azok', 'ezen', 'azon', 'ebben', 'abban', 'erről', 'arról', 'ennek', 'annak', 'ilyen', 'olyan', 'minden', 'mind',
    'összes', 'valami', 'valamit', 'semmi', 'semmit', 'saját',
    // conjunctions and postpositions
    'és', 'vagy', 'de', 'meg', 'is', 'sem', 'se', 'mint', 'ha', 'akkor', 'amikor', 'ami', 'amit', 'amely', 'amelyen',
    'amelyeken', 'amelyek', 'ahol', 'aki', 'mert', 'csak', 'már', 'még', 'most', 'itt', 'ott', 'nagyon', 'kicsit', 'eléggé',
    'elég', 'túl', 'kapcsolatban', 'szóló', 'róla', 'miatt', 'alatt', 'felett', 'fölött', 'között', 'közötti', 'óta', 'után',
    'előtt', 'során', 'folyamán', 'alapján', 'szerint', 'nélkül', 'körül', 'kb', 'körülbelül',
    // verbs of being and feeling
    'volt', 'voltam', 'voltál', 'vagyok', 'van', 'vannak', 'voltak', 'lett', 'lettem', 'éreztem', 'érzem', 'érezted',
    'érzés', 'érzéssel', 'éreztem magam', 'mutasd', 'mutass', 'keress', 'keresd', 'találd', 'listázd', 'kérlek',
    'szeretném', 'látni',
    // diary vocabulary
    'nap', 'napok', 'napokon', 'napokat', 'napon', 'napot', 'napjaim', 'napjai', 'bejegyzés', 'bejegyzések', 'bejegyzéseket',
    'bejegyzésekben', 'bejegyzésben', 'bejegyzéseim', 'bejegyzéseimet', 'bejegyzést', 'napló', 'naplóban', 'naplómban',
    'naplóbejegyzés', 'naplóbejegyzések', 'jegyzet', 'jegyzetek', 'címke', 'címkével', 'címkéjű', 'címkés', 'címkét',
    'címkék', 'időszak', 'időszakban', 'idő', 'időben', 'dolog', 'dolgok', 'dolgot', 'téma', 'témában', 'témájú',
  ),
  numberWords: vr({
    nulla: 0, egy: 1, kettő: 2, két: 2, három: 3, négy: 4, öt: 5, hat: 6, hét: 7, nyolc: 8, kilenc: 9, tíz: 10,
    tizenegy: 11, tizenkét: 12, tizenkettő: 12, tizenhárom: 13, tizennégy: 14, tizenöt: 15, húsz: 20, huszonnégy: 24,
    harminc: 30, negyven: 40, negyvenöt: 45, ötven: 50, hatvan: 60, hetven: 70, nyolcvan: 80, kilencven: 90, száz: 100,
    fél: 0.5, másfél: 1.5,
  }),
  halfPhrases: v('és fél', 'és egy fél'),
  periods: {
    phrases: vr({
      'ma': 'today',
      'mai napon': 'today',
      'mai nap': 'today',
      'tegnap': 'yesterday',
      'tegnapi napon': 'yesterday',
      'tegnapi nap': 'yesterday',
      'tegnapelőtt': 'twoDaysAgo',
      'tegnapelőtti napon': 'twoDaysAgo',
      // the last 7 days
      'ezen a héten': 'week',
      'e héten': 'week',
      'a héten': 'week',
      'ezen a hét': 'week',
      'elmúlt héten': 'week',
      'elmúlt hét': 'week',
      'elmúlt egy hétben': 'week',
      'múlt héten': 'week',
      'múlt hét': 'week',
      'múlt heti': 'week',
      'utóbbi héten': 'week',
      'legutóbbi héten': 'week',
      'utolsó héten': 'week',
      'előző héten': 'week',
      'e heti': 'week',
      // the last 30 days
      'ebben a hónapban': 'month',
      'e hónapban': 'month',
      'a hónapban': 'month',
      'elmúlt hónapban': 'month',
      'elmúlt hónap': 'month',
      'elmúlt egy hónapban': 'month',
      'múlt hónapban': 'month',
      'múlt hónap': 'month',
      'múlt havi': 'month',
      'utóbbi hónapban': 'month',
      'legutóbbi hónapban': 'month',
      'utolsó hónapban': 'month',
      'előző hónapban': 'month',
      'e havi': 'month',
      // the last 180 days
      'elmúlt fél évben': 'halfYear',
      'elmúlt félévben': 'halfYear',
      'utóbbi fél évben': 'halfYear',
      'utóbbi félévben': 'halfYear',
      'elmúlt hat hónapban': 'halfYear',
      'utolsó fél évben': 'halfYear',
      // the last 365 days
      'ebben az évben': 'year',
      'e évben': 'year',
      'idén': 'year',
      'idei': 'year',
      'elmúlt évben': 'year',
      'elmúlt év': 'year',
      'elmúlt egy évben': 'year',
      'múlt évben': 'year',
      'múlt év': 'year',
      'tavaly': 'year',
      'tavalyi': 'year',
      'utóbbi évben': 'year',
      'legutóbbi évben': 'year',
      'utolsó évben': 'year',
      'előző évben': 'year',
      'elmúlt tizenkét hónapban': 'year',
      // since 1 January / since the 1st of the month
      'év eleje óta': 'startYear',
      'év elejétől': 'startYear',
      'az év eleje óta': 'startYear',
      'idén eddig': 'startYear',
      'eddig idén': 'startYear',
      'hónap eleje óta': 'startMonth',
      'hónap elejétől': 'startMonth',
      'e hónap eleje óta': 'startMonth',
      'ebben a hónapban eddig': 'startMonth',
      // the last few days
      'mostanában': 'recent',
      'az utóbbi időben': 'recent',
      'utóbbi időben': 'recent',
      'utóbbi napokban': 'recent',
      'elmúlt napokban': 'recent',
      'elmúlt pár napban': 'recent',
      'utóbbi pár napban': 'recent',
      'elmúlt néhány napban': 'recent',
      'a napokban': 'recent',
      'nemrég': 'recent',
      'nemrégiben': 'recent',
    }),
    units: vr({
      'nap': 'day', 'napot': 'day', 'napon': 'day', 'napban': 'day', 'napra': 'day', 'napig': 'day', 'napos': 'day',
      'napnyi': 'day', 'nappal': 'day', 'napból': 'day', 'napok': 'day', 'napokban': 'day', 'napokat': 'day', 'napokon': 'day',
      'hét': 'week', 'hetet': 'week', 'héten': 'week', 'hétben': 'week', 'hétre': 'week', 'hétig': 'week', 'hetes': 'week',
      'hétnyi': 'week', 'héttel': 'week', 'hetek': 'week', 'hetekben': 'week', 'heteket': 'week', 'heteken': 'week',
      'hónap': 'month', 'hónapot': 'month', 'hónapban': 'month', 'hónapra': 'month', 'hónapig': 'month', 'hónapos': 'month',
      'hónapnyi': 'month', 'hónappal': 'month', 'hónapok': 'month', 'hónapokban': 'month', 'hónapokat': 'month',
      'év': 'year', 'évet': 'year', 'évben': 'year', 'évre': 'year', 'évig': 'year', 'éves': 'year', 'évnyi': 'year',
      'évvel': 'year', 'évek': 'year', 'években': 'year', 'éveket': 'year',
    }),
    lastWords: v('elmúlt', 'utóbbi', 'utolsó', 'legutóbbi', 'múlt', 'előző', 'megelőző'),
    dualWords: {},
    ago: {
      words: v('ezelőtt', 'előtt'),
      position: 'after',
      // Possessive units that say "ago" on their own: "két hete" (two weeks ago), "három napja".
      units: vr({ 'napja': 'day', 'hete': 'week', 'hónapja': 'month', 'éve': 'year' }),
    },
    monthAliases: vr({
      // inessive ("júliusban"), adjective ("júliusi"), from / until, possessive inessive ("júliusában")
      'január': 0, 'januárban': 0, 'januári': 0, 'januártól': 0, 'januárig': 0, 'januárjában': 0,
      'február': 1, 'februárban': 1, 'februári': 1, 'februártól': 1, 'februárig': 1, 'februárjában': 1,
      'március': 2, 'márciusban': 2, 'márciusi': 2, 'márciustól': 2, 'márciusig': 2, 'márciusában': 2,
      'április': 3, 'áprilisban': 3, 'áprilisi': 3, 'áprilistól': 3, 'áprilisig': 3, 'áprilisában': 3,
      'május': 4, 'májusban': 4, 'májusi': 4, 'májustól': 4, 'májusig': 4, 'májusában': 4,
      'június': 5, 'júniusban': 5, 'júniusi': 5, 'júniustól': 5, 'júniusig': 5, 'júniusában': 5,
      'július': 6, 'júliusban': 6, 'júliusi': 6, 'júliustól': 6, 'júliusig': 6, 'júliusában': 6,
      'augusztus': 7, 'augusztusban': 7, 'augusztusi': 7, 'augusztustól': 7, 'augusztusig': 7, 'augusztusában': 7,
      'szeptember': 8, 'szeptemberben': 8, 'szeptemberi': 8, 'szeptembertől': 8, 'szeptemberig': 8, 'szeptemberében': 8,
      'október': 9, 'októberben': 9, 'októberi': 9, 'októbertől': 9, 'októberig': 9, 'októberében': 9,
      'november': 10, 'novemberben': 10, 'novemberi': 10, 'novembertől': 10, 'novemberig': 10, 'novemberében': 10,
      'december': 11, 'decemberben': 11, 'decemberi': 11, 'decembertől': 11, 'decemberig': 11, 'decemberében': 11,
    }),
    // Intl short month names ("máj" = liver, "jan" / "nov" ...) count only before a year.
    monthNeedsContext: ['jan', 'febr', 'márc', 'ápr', 'máj', 'jún', 'júl', 'aug', 'szept', 'okt', 'nov', 'dec'],
    monthLeadWords: [],
    rangeConnectors: v('és', 'között', 'közötti', 'kezdve', 'ig', 'tól', 'től', 'dátumtól', 'dátumig'),
  },
  metrics: vr({
    'hangulat': 'mood', 'hangulatom': 'mood', 'hangulatomat': 'mood', 'hangulatomban': 'mood', 'hangulatot': 'mood',
    'hangulata': 'mood', 'hangulatban': 'mood', 'kedvem': 'mood', 'kedv': 'mood', 'kedély': 'mood', 'lelkiállapot': 'mood',
    'lelkiállapotom': 'mood', 'közérzet': 'mood', 'közérzetem': 'mood', 'közérzetemet': 'mood',
    'energia': 'energy', 'energiám': 'energy', 'energiámat': 'energy', 'energiát': 'energy', 'energiával': 'energy',
    'energiája': 'energy', 'energiaszint': 'energy', 'energiaszintem': 'energy', 'energiaszintemet': 'energy',
    'energiaszintet': 'energy', 'energiaszintje': 'energy',
    'stressz': 'stress', 'stresszem': 'stress', 'stresszemet': 'stress', 'stresszt': 'stress', 'stresszszint': 'stress',
    'stresszszintem': 'stress', 'stresszszintemet': 'stress', 'stresszszintet': 'stress', 'stresszszintje': 'stress',
    'alvás': 'sleepHours', 'alvásom': 'sleepHours', 'alvásomat': 'sleepHours', 'alvást': 'sleepHours', 'alvással': 'sleepHours',
    'alvásidő': 'sleepHours', 'alvásidőm': 'sleepHours', 'alvásidőmet': 'sleepHours', 'alvásidőt': 'sleepHours',
    'aludtam': 'sleepHours', 'aludtál': 'sleepHours', 'aludni': 'sleepHours', 'alszom': 'sleepHours', 'kialudtam': 'sleepHours',
    'alvással töltött idő': 'sleepHours', 'alvásórák': 'sleepHours',
    'alvásminőség': 'sleepQuality', 'alvásminőségem': 'sleepQuality', 'alvásminőségemet': 'sleepQuality',
    'alvásminőséget': 'sleepQuality', 'alvás minősége': 'sleepQuality', 'alvásom minősége': 'sleepQuality',
    'alvásom minőségét': 'sleepQuality', 'alvás minőségét': 'sleepQuality',
    'testmozgás': 'exerciseMinutes', 'testmozgást': 'exerciseMinutes', 'testmozgással': 'exerciseMinutes',
    'testmozgásom': 'exerciseMinutes', 'mozgás': 'exerciseMinutes', 'mozgást': 'exerciseMinutes', 'mozgással': 'exerciseMinutes',
    'mozogtam': 'exerciseMinutes', 'mozogni': 'exerciseMinutes', 'edzés': 'exerciseMinutes', 'edzést': 'exerciseMinutes',
    'edzéssel': 'exerciseMinutes', 'edzettem': 'exerciseMinutes', 'edzeni': 'exerciseMinutes', 'sport': 'exerciseMinutes',
    'sportot': 'exerciseMinutes', 'sporttal': 'exerciseMinutes', 'sportoltam': 'exerciseMinutes', 'sportolni': 'exerciseMinutes',
    'futás': 'exerciseMinutes', 'futást': 'exerciseMinutes', 'futottam': 'exerciseMinutes', 'tornáztam': 'exerciseMinutes',
    'torna': 'exerciseMinutes', 'konditerem': 'exerciseMinutes', 'konditeremben': 'exerciseMinutes',
    'edzőterem': 'exerciseMinutes', 'edzőteremben': 'exerciseMinutes', 'fitnesz': 'exerciseMinutes',
    'testmozgás ideje': 'exerciseMinutes', 'mozgással töltött idő': 'exerciseMinutes', 'fizikai aktivitás': 'exerciseMinutes',
    'fizikai aktivitást': 'exerciseMinutes', 'aktivitás': 'exerciseMinutes',
  }),
  thresholdUnits: vr({
    'óra': 'sleepHours', 'órát': 'sleepHours', 'órán': 'sleepHours', 'óránál': 'sleepHours', 'órányi': 'sleepHours',
    'órás': 'sleepHours', 'ó': 'sleepHours',
    'perc': 'exerciseMinutes', 'percet': 'exerciseMinutes', 'percnél': 'exerciseMinutes', 'percnyi': 'exerciseMinutes',
    'perces': 'exerciseMinutes',
    'pont': null, 'pontot': null, 'pontnál': null, 'pontos': null,
  }),
  comparators: [
    // Comparators AFTER the number (and its unit): see ComparatorRule.position.
    ...cmpAfter('kevesebb', 'lt'),
    ...cmpAfter('kevesebbet', 'lt'),
    ...cmpAfter('alatt', 'lt'),
    ...cmpAfter('több', 'gt'),
    ...cmpAfter('többet', 'gt'),
    ...cmpAfter('felett', 'gt'),
    ...cmpAfter('fölött', 'gt'),
    ...cmpAfter('vagy kevesebb', 'lte'),
    ...cmpAfter('vagy kevesebbet', 'lte'),
    ...cmpAfter('vagy annál kevesebb', 'lte'),
    ...cmpAfter('vagy több', 'gte'),
    ...cmpAfter('vagy többet', 'gte'),
    ...cmpAfter('vagy annál több', 'gte'),
    ...cmp('kevesebb mint', 'lt'),
    ...cmp('kevesebbet mint', 'lt'),
    ...cmp('kisebb mint', 'lt'),
    ...cmp('alacsonyabb mint', 'lt'),
    ...cmp('rövidebb mint', 'lt'),
    ...cmp('legfeljebb', 'lte'),
    ...cmp('legföljebb', 'lte'),
    ...cmp('maximum', 'lte'),
    ...cmp('max', 'lte'),
    ...cmp('maximálisan', 'lte'),
    ...cmp('nem több mint', 'lte'),
    ...cmp('több mint', 'gt'),
    ...cmp('többet mint', 'gt'),
    ...cmp('nagyobb mint', 'gt'),
    ...cmp('magasabb mint', 'gt'),
    ...cmp('hosszabb mint', 'gt'),
    ...cmp('legalább', 'gte'),
    ...cmp('minimum', 'gte'),
    ...cmp('min', 'gte'),
    ...cmp('minimálisan', 'gte'),
    ...cmp('nem kevesebb mint', 'gte'),
    ...cmp('pontosan', 'eq'),
    ...cmp('éppen', 'eq'),
    ...cmp('egyenlő', 'eq'),
    { words: ['<'], comparator: 'lt' },
    { words: ['<='], comparator: 'lte' },
    { words: ['>'], comparator: 'gt' },
    { words: ['>='], comparator: 'gte' },
    { words: ['='], comparator: 'eq' },
  ],
  negations: v('nem', 'nélkül', 'nincs', 'semmi', 'nulla', 'kihagytam', 'kimaradt'),
  rank: {
    good: v('jó', 'jól', 'jobb', 'szép', 'boldog', 'kellemes', 'pozitív', 'vidám', 'remek', 'nagyszerű', 'csodás', 'klassz',
      'sikeres', 'nyugodt'),
    bad: v('rossz', 'rosszul', 'nehéz', 'nehezebb', 'szomorú', 'stresszes', 'negatív', 'borzasztó', 'szörnyű', 'kimerítő',
      'fárasztó', 'kellemetlen', 'pocsék', 'vacak'),
    high: v('magas', 'sok', 'energikus', 'kipihent'),
    low: v('alacsony', 'kevés', 'fáradt', 'kimerült'),
    markersBefore: [],
    markersAfter: [],
    dayWords: v('napok', 'napokat', 'napokon', 'napjaim', 'napjaimat', 'nap', 'napot', 'napom'),
    bare: {
      best: v('legjobb', 'legjobban', 'legjobbak', 'legboldogabb', 'legszebb', 'legkellemesebb', 'legnyugodtabb', 'jól'),
      worst: v('legrosszabb', 'legrosszabbul', 'legrosszabbak', 'legnehezebb', 'legnehezebbek', 'legszomorúbb',
        'legstresszesebb', 'rosszul'),
      high: v('legmagasabb', 'legtöbb', 'legtöbbet', 'csúcs', 'maximális'),
      low: v('legalacsonyabb', 'legkevesebb', 'legkevesebbet', 'mélypont', 'minimális'),
    },
  },
  trend: {
    words: v(
      'változott', 'változik', 'változás', 'változása', 'változását', 'alakult', 'alakul', 'alakulása', 'alakulását', 'trend',
      'trendje', 'trendjét', 'tendencia', 'tendenciája', 'javult', 'javulás', 'romlott', 'romlás', 'nőtt', 'növekedett',
      'csökkent', 'emelkedett', 'fejlődött', 'fejlődés', 'ingadozott', 'átlag', 'átlaga', 'átlagom', 'átlagos', 'átlagosan',
      'átlagát', 'idővel', 'az idő során', 'időbeli alakulás',
    ),
    leadWords: v('hogyan', 'hogy', 'miként', 'mennyire'),
  },
  trigger: {
    words: v(
      'írtam', 'leírtam', 'megírtam', 'beírtam', 'írok', 'írtam le', 'említettem', 'megemlítettem', 'jegyeztem',
      'feljegyeztem', 'lejegyeztem', 'beszéltem', 'meséltem', 'szerepel', 'szerepelt', 'említés',
    ),
    leadWords: v('mikor', 'mit', 'mi', 'hol', 'miről', 'melyik', 'mely', 'naplóba', 'naplómba'),
    conjunctions: v('hogy', 'arról', 'róla', 'erről', 'valamit', 'azt'),
    conjunctionPrefix: null,
  },
  // Label first, then aliases. The catalogue (emotions.<key>.label / .aliases) is merged in too.
  emotions: {
    happy: v('boldog', 'boldogság', 'boldogan', 'vidám', 'vidáman', 'örültem', 'öröm', 'örömteli', 'jókedvű', 'jókedv',
      'jókedvem', 'jó kedvem', 'jó kedvem volt', 'jó hangulatban', 'boldog voltam'),
    calm: v('nyugodt', 'nyugodtan', 'nyugalom', 'nyugodtság', 'békés', 'ellazult', 'laza', 'kiegyensúlyozott', 'higgadt',
      'nyugodt voltam'),
    sad: v('szomorú', 'szomorúság', 'szomorúan', 'lehangolt', 'levert', 'bánatos', 'bánat', 'boldogtalan', 'rosszkedvű',
      'rosszkedv', 'rossz kedvem', 'rossz kedvem volt', 'rossz hangulatban', 'depressziós', 'sírtam', 'szomorú voltam'),
    angry: v('dühös', 'düh', 'mérges', 'harag', 'haragudtam', 'bosszús', 'ingerült', 'feldúlt', 'felhúztam magam',
      'dühös voltam'),
    stressed: v('stresszes', 'stresszelt', 'stresszeltem', 'stressz', 'stresszben', 'feszült', 'feszültség', 'nyomás alatt',
      'stresszes voltam'),
    excited: v('izgatott', 'izgatottság', 'izgalom', 'lelkes', 'lelkesedés', 'felvillanyozott'),
    tired: v('fáradt', 'fáradtság', 'fáradtan', 'kimerült', 'kimerültség', 'álmos', 'elcsigázott', 'kifáradt', 'fáradt voltam',
      'hulla fáradt'),
    satisfied: v('elégedett', 'elégedettség', 'megelégedett', 'kiteljesedett', 'megelégedés'),
    frustrated: v('frusztrált', 'frusztráció', 'csalódott', 'csalódottság', 'csalódás'),
    anxious: v('szorongó', 'szorongás', 'szorongtam', 'aggódó', 'aggódtam', 'aggodalom', 'aggodalmas', 'nyugtalan', 'ideges',
      'idegesség', 'félelem', 'féltem'),
    energetic: v('energikus', 'tele energiával', 'energiával teli', 'lendületes', 'élénk', 'fitt'),
    grateful: v('hálás', 'hála', 'hálával'),
    lonely: v('magányos', 'magány', 'egyedül', 'elszigetelt', 'egyedül voltam', 'magányos voltam'),
    hopeful: v('reménykedő', 'remény', 'reményteli', 'bizakodó', 'optimista', 'optimizmus', 'reménykedtem'),
    bored: v('unott', 'unalom', 'unatkoztam', 'unatkozó', 'unalmas', 'unatkozás'),
    proud: v('büszke', 'büszkeség', 'büszke voltam'),
    focused: v('koncentrált', 'koncentráció', 'fókuszált', 'fókusz', 'összpontosított', 'összpontosító'),
    overwhelmed: v('túlterhelt', 'túlterheltség', 'agyonhajszolt', 'elárasztott', 'túl sok volt'),
  },
  examples: [
    'Az elmúlt hónapban mely napokon éreztem magam a legjobban?',
    'Mikor írtam, hogy fáradt vagyok?',
    'Mely napokon aludtam kevesebb, mint öt órát?',
    'Hogyan változott a hangulatom az elmúlt három hónapban?',
    'Mely napokon voltam stresszes?',
    'Mikor voltam boldog ezen a héten',
    'Napok, amikor az energiám több mint 8 volt az elmúlt évben',
    'bejegyzések a munkáról',
    'júliusban',
    '2026.08.01. és 2026.08.15. között',
  ],
};

export default table;
