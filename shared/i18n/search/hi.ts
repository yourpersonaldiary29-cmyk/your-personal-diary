/**
 * hi - Hindi keyword table of the smart-search parser (schema: ./index.ts).
 *
 * Notes for this language:
 *  - Hindi writes postpositions as separate words (में, से, को, का/की/के), so the table uses the
 *    'space' tokenizer with no prefixes; the postpositions are stopwords.
 *  - Every word is written in NFC (the parser normalises the question to NFC): nukta letters are
 *    stored as letter + ़ (फ़, ज़, ड़), exactly as Intl and NFC produce them.
 *  - Hindi puts comparisons AFTER the number ("पाँच घंटे से कम", "8 से ज़्यादा", "7 घंटे या उससे
 *    ज़्यादा"): those rules carry position 'after'. The pre-number forms (कम से कम 8, अधिकतम 6,
 *    ज़्यादा से ज़्यादा 6, ठीक 7) and the symbols < > <= >= = work as well.
 *  - "N units ago" is "N दिन/सप्ताह/महीने पहले" (ago word after the unit); "पिछले N ..." is a
 *    last-N period; कल is read as "yesterday" (a diary asks about the past).
 *  - Devanagari digits (०-९) are listed as number words so "५ घंटे" works like "5 घंटे".
 */
import type { SearchLanguageTable } from './index';

const DEVANAGARI_DIGITS = '०१२३४५६७८९';

/** Devanagari numerals 0..max -> value ('५' -> 5, '३०' -> 30). */
function devanagariNumerals(max: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (let n = 0; n <= max; n++) out[String(n).replace(/\d/g, (d) => DEVANAGARI_DIGITS[Number(d)])] = n;
  return out;
}

const table: SearchLanguageTable = {
  locale: 'hi',
  script: 'devanagari',
  tokenizer: 'space',
  dateOrder: 'dmy',
  prefixes: [],
  articlePrefixes: [],
  numberPrefixLetters: '',
  barePrefixTokens: [],
  articles: [],
  stopwords: [
    // question words
    'कौन', 'कौनसे', 'कौन-से', 'कौनसा', 'कौन-सा', 'कौनसी', 'कौन-सी', 'किन', 'किस', 'किसी', 'किसे', 'कब', 'क्या', 'कहाँ',
    'कहां', 'कैसे', 'कैसा', 'कैसी', 'क्यों', 'कितना', 'कितने', 'कितनी', 'जब', 'तब', 'जहाँ', 'जो', 'जिन', 'जिस', 'जिनमें',
    'जिसमें', 'जिनको', 'जिन्हें',
    // pronouns
    'मैं', 'मैंने', 'मैने', 'मुझे', 'मुझको', 'मेरा', 'मेरी', 'मेरे', 'मुझसे', 'हम', 'हमने', 'हमें', 'हमारा', 'हमारी', 'हमारे',
    'आप', 'आपने', 'आपका', 'आपकी', 'आपके', 'आपको', 'तुम', 'तुमने', 'यह', 'ये', 'वह', 'वो', 'वे', 'इस', 'उस', 'इन', 'उन',
    'इसमें', 'उसमें', 'इनमें', 'उनमें', 'इसे', 'उसे', 'खुद', 'ख़ुद', 'अपना', 'अपनी', 'अपने',
    // postpositions and conjunctions
    'का', 'की', 'के', 'को', 'से', 'में', 'पर', 'तक', 'ने', 'लिए', 'साथ', 'बारे', 'बीच', 'द्वारा', 'वाला', 'वाली', 'वाले',
    'सहित', 'दौरान', 'बाद', 'पहले', 'और', 'या', 'अथवा', 'लेकिन', 'परंतु', 'मगर', 'कि', 'तो', 'भी', 'ही', 'बस', 'सिर्फ़',
    'सिर्फ', 'केवल', 'फिर', 'अब', 'यहाँ', 'वहाँ', 'ऐसे', 'ऐसा', 'ऐसी', 'वैसे',
    // auxiliaries and light verbs
    'है', 'हैं', 'था', 'थी', 'थे', 'थीं', 'हूँ', 'हूं', 'हो', 'होता', 'होती', 'होते', 'हुआ', 'हुई', 'हुए', 'हुईं', 'रहा',
    'रही', 'रहे', 'रहीं', 'गया', 'गई', 'गए', 'गयी', 'किया', 'कीं', 'कर', 'करके', 'करता', 'करती', 'सकता', 'सकती', 'सकते',
    'लगा', 'लगी', 'लगे', 'पाया', 'पाई', 'चाहिए', 'चाहता', 'चाहती', 'न', 'ना', 'नहीं', 'मत',
    // degree and filler words
    'बहुत', 'काफ़ी', 'काफी', 'ज़रा', 'थोड़ा', 'थोड़ी', 'थोड़े', 'कुछ', 'सब', 'सभी', 'हर', 'कोई', 'कई', 'ज़्यादा', 'ज्यादा',
    'अधिक', 'कम', 'सबसे', 'बिल्कुल', 'शायद', 'लगभग', 'करीब', 'क़रीब', 'चीज़', 'चीज़ें', 'बात', 'बातें', 'समय', 'वक़्त', 'वक्त',
    'बार', 'दफ़ा', 'अवधि', 'दौर', 'कृपया', 'ज़रूर',
    // diary vocabulary and request words
    'दिन', 'दिनों', 'दिवस', 'रोज़', 'रोज', 'महीने', 'महीना', 'माह', 'सप्ताह', 'हफ़्ते', 'हफ्ते', 'साल', 'वर्ष', 'प्रविष्टि',
    'प्रविष्टियाँ', 'प्रविष्टियां', 'प्रविष्टियों', 'एंट्री', 'एंट्रियाँ', 'डायरी', 'नोट', 'नोट्स', 'टैग', 'टैगों', 'टैग्स',
    'महसूस', 'एहसास', 'अनुभव', 'दिखाओ', 'दिखाएँ', 'दिखाएं', 'दिखाइए', 'बताओ', 'बताएँ', 'बताएं', 'बताइए', 'ढूँढो', 'ढूंढो',
    'ढूँढें', 'ढूंढें', 'खोजो', 'खोजें', 'खोजिए', 'सूची', 'देखना', 'देखें', 'जानना', 'चाहूँगा', 'चाहूँगी', 'मिला', 'मिली',
    'मिले', 'शामिल', 'संबंधित', 'लिखी', 'लिखे',
  ],
  numberWords: {
    शून्य: 0, एक: 1, दो: 2, तीन: 3, चार: 4, पाँच: 5, पांच: 5, छह: 6, छः: 6, छै: 6, सात: 7, आठ: 8, नौ: 9, दस: 10,
    ग्यारह: 11, बारह: 12, तेरह: 13, चौदह: 14, पंद्रह: 15, पन्द्रह: 15, सोलह: 16, सत्रह: 17, अठारह: 18, उन्नीस: 19,
    बीस: 20, पच्चीस: 25, तीस: 30, चालीस: 40, पैंतालीस: 45, पचास: 50, साठ: 60, सत्तर: 70, अस्सी: 80, नब्बे: 90, सौ: 100,
    // one and a half, two and a half
    डेढ़: 1.5, ढाई: 2.5,
    ...devanagariNumerals(100),
  },
  // "सात और आधा" = 7.5 (the usual prefix form साढ़े सात cannot be read by the parser)
  halfPhrases: ['और आधा', 'और आधे'],
  // "साढ़े सात" = seven and a half: the half word stands BEFORE the number.
  halfBeforeWords: ['साढ़े', 'साढे'],
  periods: {
    phrases: {
      'आज': 'today',
      'आज के दिन': 'today',
      'कल': 'yesterday',
      'बीते कल': 'yesterday',
      'परसों': 'twoDaysAgo',
      'इस सप्ताह': 'week',
      'इस हफ़्ते': 'week',
      'इस हफ्ते': 'week',
      'पिछले सप्ताह': 'week',
      'पिछले हफ़्ते': 'week',
      'पिछले हफ्ते': 'week',
      'पिछला सप्ताह': 'week',
      'पिछला हफ़्ता': 'week',
      'बीते सप्ताह': 'week',
      'बीते हफ़्ते': 'week',
      'गत सप्ताह': 'week',
      'इस महीने': 'month',
      'इस माह': 'month',
      'पिछले महीने': 'month',
      'पिछला महीना': 'month',
      'पिछले माह': 'month',
      'बीते महीने': 'month',
      'गत माह': 'month',
      'पिछले आधे साल': 'halfYear',
      'पिछले आधे साल में': 'halfYear',
      'पिछले छह महीनों': 'halfYear',
      'पिछले छह महीने': 'halfYear',
      'पिछले छः महीनों': 'halfYear',
      'इस साल': 'year',
      'इस वर्ष': 'year',
      'पिछले साल': 'year',
      'पिछला साल': 'year',
      'पिछले वर्ष': 'year',
      'बीते साल': 'year',
      'गत वर्ष': 'year',
      'पिछले बारह महीनों': 'year',
      'साल की शुरुआत से': 'startYear',
      'इस साल की शुरुआत से': 'startYear',
      'वर्ष की शुरुआत से': 'startYear',
      'साल के शुरू से': 'startYear',
      'महीने की शुरुआत से': 'startMonth',
      'इस महीने की शुरुआत से': 'startMonth',
      'महीने के शुरू से': 'startMonth',
      'हाल ही में': 'recent',
      'हाल में': 'recent',
      'पिछले दिनों': 'recent',
      'पिछले कुछ दिन': 'recent',
      'हाल के दिनों में': 'recent',
      'पिछले कुछ दिनों': 'recent',
      'पिछले कुछ दिनों में': 'recent',
      'बीते कुछ दिनों में': 'recent',
      'इन दिनों': 'recent',
      'आजकल': 'recent',
    },
    units: {
      'दिन': 'day', 'दिनों': 'day',
      'सप्ताह': 'week', 'सप्ताहों': 'week', 'हफ़्ता': 'week', 'हफ़्ते': 'week', 'हफ़्तों': 'week', 'हफ्ता': 'week',
      'हफ्ते': 'week', 'हफ्तों': 'week',
      'महीना': 'month', 'महीने': 'month', 'महीनों': 'month', 'माह': 'month',
      'साल': 'year', 'सालों': 'year', 'वर्ष': 'year', 'वर्षों': 'year', 'बरस': 'year',
    },
    lastWords: ['पिछले', 'पिछला', 'पिछली', 'बीते', 'बीता', 'बीती', 'गत', 'विगत', 'आख़िरी', 'आखिरी', 'अंतिम'],
    dualWords: { 'पखवाड़ा': 'week', 'पखवाड़े': 'week' },
    ago: { words: ['पहले', 'पूर्व'], position: 'after' },
    monthAliases: { 'फरवरी': 1, 'अप्रेल': 3, 'सितम्बर': 8, 'अक्तूबर': 9, 'नवम्बर': 10, 'दिसम्बर': 11 },
    monthNeedsContext: [],
    monthLeadWords: ['महीने', 'माह'],
    rangeConnectors: ['से', 'तक', 'और', 'के', 'बीच', 'तारीख', 'दिनांक', 'को', 'लेकर'],
  },
  metrics: {
    'मूड': 'mood', 'मनोदशा': 'mood', 'मिज़ाज': 'mood', 'मिजाज': 'mood', 'मूड स्कोर': 'mood', 'मूड की रेटिंग': 'mood',
    'ऊर्जा': 'energy', 'एनर्जी': 'energy', 'ऊर्जा स्तर': 'energy', 'ऊर्जा का स्तर': 'energy',
    'तनाव': 'stress', 'तनाव स्तर': 'stress', 'तनाव का स्तर': 'stress', 'स्ट्रेस': 'stress', 'टेंशन': 'stress', 'दबाव': 'stress',
    'नींद': 'sleepHours', 'सोया': 'sleepHours', 'सोई': 'sleepHours', 'सोए': 'sleepHours', 'सोना': 'sleepHours',
    'नींद के घंटे': 'sleepHours', 'नींद के घंटों': 'sleepHours', 'सोने के घंटे': 'sleepHours', 'नींद की अवधि': 'sleepHours',
    'नींद की गुणवत्ता': 'sleepQuality', 'नींद की क्वालिटी': 'sleepQuality',
    'व्यायाम': 'exerciseMinutes', 'कसरत': 'exerciseMinutes', 'वर्कआउट': 'exerciseMinutes', 'एक्सरसाइज़': 'exerciseMinutes',
    'एक्सरसाइज': 'exerciseMinutes', 'योग': 'exerciseMinutes', 'योगा': 'exerciseMinutes', 'दौड़': 'exerciseMinutes',
    'दौड़ा': 'exerciseMinutes', 'दौड़ी': 'exerciseMinutes', 'दौड़ना': 'exerciseMinutes', 'जिम': 'exerciseMinutes',
    'खेलकूद': 'exerciseMinutes', 'तैराकी': 'exerciseMinutes', 'साइकिलिंग': 'exerciseMinutes', 'सैर': 'exerciseMinutes',
    'टहलना': 'exerciseMinutes', 'शारीरिक गतिविधि': 'exerciseMinutes', 'व्यायाम के मिनट': 'exerciseMinutes',
    'कसरत के मिनट': 'exerciseMinutes',
  },
  thresholdUnits: {
    'घंटे': 'sleepHours', 'घंटा': 'sleepHours', 'घंटों': 'sleepHours', 'घण्टे': 'sleepHours',
    'मिनट': 'exerciseMinutes', 'मिनटों': 'exerciseMinutes',
    'अंक': null, 'पॉइंट': null, 'स्कोर': null,
  },
  comparators: [
    // Comparators AFTER the number (and its unit): see ComparatorRule.position.
    { words: ['से', 'कम'], comparator: 'lt', position: 'after' },
    { words: ['से', 'नीचे'], comparator: 'lt', position: 'after' },
    { words: ['से', 'ज़्यादा'], comparator: 'gt', position: 'after' },
    { words: ['से', 'ज्यादा'], comparator: 'gt', position: 'after' },
    { words: ['से', 'अधिक'], comparator: 'gt', position: 'after' },
    { words: ['से', 'ऊपर'], comparator: 'gt', position: 'after' },
    { words: ['या', 'उससे', 'कम'], comparator: 'lte', position: 'after' },
    { words: ['या', 'कम'], comparator: 'lte', position: 'after' },
    { words: ['या', 'उससे', 'ज़्यादा'], comparator: 'gte', position: 'after' },
    { words: ['या', 'उससे', 'ज्यादा'], comparator: 'gte', position: 'after' },
    { words: ['या', 'उससे', 'अधिक'], comparator: 'gte', position: 'after' },
    { words: ['या', 'ज़्यादा'], comparator: 'gte', position: 'after' },
    { words: ['या', 'ज्यादा'], comparator: 'gte', position: 'after' },
    { words: ['या', 'अधिक'], comparator: 'gte', position: 'after' },
    { words: ['कम', 'से', 'कम'], comparator: 'gte' },
    { words: ['कम-से-कम'], comparator: 'gte' },
    { words: ['न्यूनतम'], comparator: 'gte' },
    { words: ['ज़्यादा', 'से', 'ज़्यादा'], comparator: 'lte' },
    { words: ['ज्यादा', 'से', 'ज्यादा'], comparator: 'lte' },
    { words: ['ज़्यादा-से-ज़्यादा'], comparator: 'lte' },
    { words: ['अधिक', 'से', 'अधिक'], comparator: 'lte' },
    { words: ['अधिकतम'], comparator: 'lte' },
    { words: ['ठीक'], comparator: 'eq' },
    { words: ['पूरे'], comparator: 'eq' },
    { words: ['<'], comparator: 'lt' },
    { words: ['<='], comparator: 'lte' },
    { words: ['>'], comparator: 'gt' },
    { words: ['>='], comparator: 'gte' },
    { words: ['='], comparator: 'eq' },
  ],
  negations: ['बिना', 'बग़ैर', 'बगैर', 'नहीं', 'न', 'ना'],
  rank: {
    good: ['अच्छा', 'अच्छी', 'अच्छे', 'बढ़िया', 'शानदार', 'बेहतर', 'बेहतरीन', 'खुशनुमा', 'सुखद'],
    bad: ['बुरा', 'बुरी', 'बुरे', 'ख़राब', 'खराब', 'कठिन', 'मुश्किल', 'भारी', 'दुखद', 'तनावपूर्ण', 'बेकार'],
    high: ['ऊँचा', 'ऊँची', 'ऊँचे', 'ऊंचा', 'ऊंची', 'ऊंचे', 'ज़्यादा', 'ज्यादा', 'अधिक', 'ऊर्जावान', 'तरोताज़ा'],
    low: ['नीचा', 'नीची', 'नीचे', 'निचला', 'कम', 'थका', 'थकी', 'थके'],
    markersBefore: ['सबसे'],
    markersAfter: [],
    dayWords: ['दिन', 'दिनों'],
    bare: {
      best: ['सर्वश्रेष्ठ', 'बेहतरीन', 'अच्छा', 'अच्छी', 'बढ़िया', 'शानदार'],
      worst: ['बदतर', 'बुरा', 'बुरी', 'ख़राब', 'खराब'],
      high: ['सर्वाधिक', 'चरम'],
      low: ['न्यूनतम', 'निम्नतम'],
    },
  },
  trend: {
    words: [
      'बदला', 'बदली', 'बदले', 'बदल', 'बदलाव', 'बदलता', 'बदलती', 'बदलते', 'परिवर्तन', 'रुझान', 'प्रवृत्ति', 'ट्रेंड', 'औसत',
      'औसतन', 'सुधार', 'सुधरा', 'सुधरी', 'सुधरे', 'गिरावट', 'गिरा', 'गिरी', 'घटा', 'घटी', 'घटे', 'बढ़ा', 'बढ़ी', 'बढ़े',
      'उतार-चढ़ाव', 'प्रगति', 'बदल गया', 'बदल गई', 'बदल गए', 'समय के साथ',
    ],
    leadWords: ['कैसे', 'कैसा', 'कैसी', 'किस', 'तरह', 'क्या'],
  },
  trigger: {
    // Multi-word forms swallow the auxiliary after the verb ("लिखा था"), so the words the user
    // typed before the verb (Hindi puts the object first) are kept as the search terms.
    words: [
      'लिखा', 'लिखी', 'लिखे', 'लिखीं', 'लिख', 'लिखा था', 'लिखी थी', 'लिखे थे', 'लिखा है', 'लिखा हुआ', 'ज़िक्र', 'जिक्र',
      'ज़िक्र किया', 'जिक्र किया', 'ज़िक्र किया था', 'जिक्र किया था', 'उल्लेख', 'उल्लेख किया', 'उल्लेख किया था', 'बताया',
      'बताया था', 'दर्ज किया', 'दर्ज किया था', 'नोट किया', 'नोट किया था',
    ],
    leadWords: ['कब', 'क्या', 'कहाँ', 'कहां', 'मैंने', 'मैने'],
    conjunctions: ['कि', 'किया', 'की', 'के'],
    conjunctionPrefix: null,
  },
  // Label first, then aliases (the catalogue's label and aliases are merged in as well).
  emotions: {
    happy: ['खुश', 'ख़ुश', 'खुशी', 'ख़ुशी', 'प्रसन्न', 'आनंदित', 'खुशमिज़ाज'],
    calm: ['शांत', 'शान्त', 'सुकून', 'चैन', 'निश्चिंत', 'तनावमुक्त'],
    sad: ['उदास', 'उदासी', 'दुखी', 'दुःखी', 'मायूस', 'निराश'],
    angry: ['नाराज़', 'नाराज', 'गुस्सा', 'ग़ुस्सा', 'गुस्से', 'गुस्से में', 'क्रोध', 'क्रोधित', 'चिढ़'],
    stressed: ['तनावग्रस्त', 'तनाव', 'तनाव में', 'टेंशन', 'टेंशन में', 'स्ट्रेस', 'स्ट्रेस में', 'दबाव में', 'परेशान'],
    excited: ['उत्साहित', 'उत्साह', 'रोमांचित', 'जोश में'],
    tired: ['थका हुआ', 'थका', 'थकी', 'थके', 'थकी हुई', 'थके हुए', 'थकान', 'थकावट', 'निढाल'],
    satisfied: ['संतुष्ट', 'संतुष्टि', 'तृप्त'],
    frustrated: ['कुंठित', 'कुंठा', 'झुंझलाहट', 'झुंझलाया', 'झुंझलाई', 'हताश', 'खीज'],
    anxious: ['चिंतित', 'चिंता', 'फ़िक्र', 'फिक्र', 'बेचैन', 'बेचैनी', 'घबराहट', 'घबराया', 'घबराई'],
    energetic: ['ऊर्जावान', 'ऊर्जा से भरपूर', 'जोशीला', 'जोशीली', 'फुर्तीला', 'फुर्तीली'],
    grateful: ['आभारी', 'आभार', 'कृतज्ञ', 'कृतज्ञता', 'शुक्रगुज़ार', 'शुक्रगुजार'],
    lonely: ['अकेला', 'अकेली', 'अकेले', 'अकेलापन', 'तन्हा', 'तनहा'],
    hopeful: ['आशावान', 'आशावादी', 'आशान्वित', 'उम्मीद'],
    bored: ['ऊबा हुआ', 'ऊबा', 'ऊबी', 'ऊबे', 'ऊबी हुई', 'ऊब', 'बोर', 'बोरियत'],
    proud: ['गर्वित', 'गर्व', 'गौरवान्वित'],
    focused: ['एकाग्र', 'एकाग्रता', 'केंद्रित', 'फ़ोकस', 'फोकस'],
    overwhelmed: ['अभिभूत', 'बोझिल', 'बेहाल'],
  },
  // The ten reference questions, in the order of en.ts. The Hindi comparison stands after the
  // number, so questions 3 and 7 use the pre-number forms अधिकतम / कम से कम.
  examples: [
    'पिछले महीने किन दिनों मुझे सबसे अच्छा महसूस हुआ?',
    'मैंने कब लिखा कि मुझे थकान थी?',
    'किन दिनों मैंने पाँच घंटे से कम नींद ली?',
    'पिछले तीन महीनों में मेरा मूड कैसे बदला?',
    'किन दिनों मुझे तनाव महसूस हुआ?',
    'इस सप्ताह मुझे कब खुशी महसूस हुई',
    'पिछले एक साल में वे दिन जब ऊर्जा 8 से ज़्यादा थी',
    'काम के बारे में प्रविष्टियाँ',
    'जुलाई में',
    '01/08/2026 से 15/08/2026 तक',
  ],
};

export default table;
