/**
 * de - demo texts ("Load sample data"). Same fields and pool sizes as en.ts (see README.md).
 *
 * Tags and exercise types are nouns and therefore capitalised ("Arbeit", "Yoga"), as a German
 * writer types them. Nothing genders the writer.
 */
import type { SeedContent } from './types';

/** "A", "A und B". */
function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} und ${names[names.length - 1]}`;
}

const content: SeedContent = {
  titles: {
    high: ['Ein wunderbarer Morgen', 'Ein Tag voller Energie', 'Ein richtig guter Tag', 'Endlich ausgeruht', 'Ein Tag der kleinen Erfolge', 'Sonne und frische Luft'],
    mid: ['Ein ganz normaler Tag', 'Ein Arbeitstag', 'Besorgungen und Alltag', 'Wieder ein Tag vorbei', 'Ein Tag in meinem Tempo', 'Angenehme Routine'],
    // "müde" is the word of search example 2 (also in openers.low).
    low: ['Ein schwerer Tag', 'Hundemüde', 'Heute war es nicht leicht', 'Ein anstrengender Tag', 'Ein schwerer Kopf', 'Ich wollte nur, dass der Tag vorbei ist'],
  },
  openers: {
    high: [
      'Heute habe ich mich richtig gut gefühlt.',
      'Ich bin mit einem Lächeln aufgewacht, und so ging der Tag auch weiter.',
      'Es war ein Tag voller guter Energie.',
      'Ich habe mich leicht und glücklich gefühlt.',
    ],
    mid: [
      'Ein ganz normaler Tag, keine Überraschungen.',
      'Ich bin in meinem eigenen Tempo durch den Tag gekommen.',
      'Nichts Besonderes, aber es war in Ordnung.',
      'Ein Routinetag mit Arbeit und Besorgungen.',
    ],
    low: [
      'Ich hatte einen schweren Tag.',
      'Ich habe mich fast den ganzen Tag schwer und müde gefühlt.',
      'Ich konnte mich auf nichts konzentrieren.',
      'Ich bin heute mit dem falschen Fuß aufgestanden.',
    ],
  },
  events: [
    'Besprechung bei der Arbeit',
    'Abendessen mit der Familie',
    'Arzttermin',
    'Einkauf im Supermarkt',
    'Telefonat mit einem alten Freund',
    'Erledigungen bei der Bank',
    'Ein interessanter Vortrag',
    'Tag im Homeoffice',
    'Ein kurzer Ausflug',
    'Hausputz',
    'Treffen mit Freunden',
    'Sportkurs',
    'Filmabend',
    'Ein neues Gericht kochen',
  ],
  sundayEvents: ['Die kommende Woche planen', 'Wöchentliche Teambesprechung', 'Stapelweise E-Mails zu beantworten'],
  people: ['Anna', 'Jonas', 'Mama', 'Papa', 'Lena', 'Lukas', 'Julia', 'Felix', 'Marie', 'Paul'],
  locations: ['Zuhause', 'Büro', 'Park', 'Café', 'Bei meinen Eltern', 'Strand', 'Bibliothek'],
  tags: ['Arbeit', 'Familie', 'Gesundheit', 'Freunde', 'Sport', 'Lernen', 'Erholung', 'Natur', 'Kreativität', 'Geld'],
  sportTag: 'Sport',
  // Named after a colon, so that every type fits as it is: "... 30 Minuten Sport gemacht: Schwimmen.".
  exerciseTypes: ['Spazierengehen', 'Laufen', 'Krafttraining', 'Schwimmen', 'Radfahren', 'Yoga'],
  badDay: {
    title: 'Ein schrecklicher Tag',
    body: 'Ein schrecklicher Tag. Alles ging schief – ich bin zu spät aufgestanden, habe eine wichtige Besprechung verpasst und mich mit einem guten Freund gestritten. Mir wuchs alles über den Kopf, und ich wusste nicht, wo ich anfangen sollte.',
  },
  goodDay: {
    title: 'Ein perfekter Tag',
    body: 'Ein perfekter Tag! Bei der Arbeit gab es eine schöne Nachricht, am Abend haben wir mit der ganzen Familie gefeiert, und ich war für alles dankbar.',
  },
  sleep: (hours, low) =>
    low ? `Letzte Nacht habe ich nur ${hours} Stunden geschlafen, und das habe ich gemerkt.` : `Ich habe ${hours} Stunden geschlafen, ziemlich gut.`,
  exercise: (type, minutes, slot) => `${slot === 'midday' ? 'Heute Morgen' : 'Heute Nachmittag'} habe ich ${minutes} Minuten Sport gemacht: ${type}.`,
  secondEntry: (slot) => (slot === 'midday' ? 'Ein paar Worte mitten am Tag, zwischen zwei Erledigungen.' : 'Ein kurzer Rückblick auf den Abend vor dem Schlafengehen.'),
  sundayNote: 'Der Wochenanfang ist immer ein bisschen stressig – auf dem Schreibtisch stapelt sich so vieles.',
  peopleSentence: (names, met) => (met ? `Ich habe ${joinNames(names)} getroffen.` : `Ich habe mit ${joinNames(names)} gesprochen.`),
  note: 'Morgen daran denken, aufzuschreiben, was gut gelaufen ist.',
  // Spelled as in English: the place "Park".
  sameAsEnglish: ['Park'],
};

export default content;
