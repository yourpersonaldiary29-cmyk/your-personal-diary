/**
 * ro - demo texts ("Load sample data"). Same fields and pool sizes as en.ts (see README.md).
 *
 * Written with ș and ț (comma below), as in the app's own messages. Nothing genders the writer
 * ("am avut corpul greu", "m-a copleșit totul" instead of "obosit(ă)", "copleșit(ă)").
 */
import type { SeedContent } from './types';

/** As chips "Mama" / "Tata" start with a capital; inside a sentence they are common nouns ("Am vorbit cu mama."). */
const IN_SENTENCE: Record<string, string> = { Mama: 'mama', Tata: 'tata' };

/** "A", "A și B". */
function joinNames(names: string[]): string {
  const words = names.map((name) => IN_SENTENCE[name] ?? name);
  if (words.length <= 1) return words.join('');
  return `${words.slice(0, -1).join(', ')} și ${words[words.length - 1]}`;
}

const content: SeedContent = {
  titles: {
    high: ['O dimineață minunată', 'O zi plină de energie', 'O zi cu adevărat bună', 'În sfârșit, odihnă', 'O zi cu mici victorii', 'Soare și aer curat'],
    mid: ['O zi obișnuită', 'O zi de lucru', 'Treburi și rutină', 'Încă o zi a trecut', 'O zi în ritmul meu', 'O rutină plăcută'],
    // "obosit" is the word of search example 2 (also in "obositoare" and in openers.low); said of the body, not of the writer.
    low: ['O zi grea', 'Un corp obosit', 'Azi nu a fost ușor', 'O zi obositoare', 'Capul greu', 'Voiam doar să se termine ziua'],
  },
  openers: {
    high: [
      'Azi m-am simțit foarte bine.',
      'M-am trezit zâmbind și ziua a continuat la fel.',
      'A fost o zi plină de energie bună.',
      'Am avut inima ușoară și plină de bucurie.',
    ],
    mid: ['O zi obișnuită, fără surprize.', 'Am luat ziua în ritmul meu.', 'Nimic deosebit, dar a fost bine.', 'O zi de rutină, cu muncă și treburi.'],
    low: [
      'Am avut o zi grea.',
      'Aproape toată ziua am avut corpul greu și mintea obosită.',
      'Nu am reușit să mă concentrez la nimic.',
      'Ziua a început cu stângul.',
    ],
  },
  events: [
    'Ședință la serviciu',
    'Cină în familie',
    'Vizită la medic',
    'Cumpărături la supermarket',
    'Telefon cu un vechi prieten',
    'Drumuri la bancă',
    'O prelegere interesantă',
    'Zi de lucru de acasă',
    'O excursie scurtă',
    'Curățenie în casă',
    'Întâlnire cu prietenii',
    'Antrenament la sală',
    'Seară de film',
    'Am gătit o rețetă nouă',
  ],
  sundayEvents: ['Planificarea săptămânii', 'Ședința săptămânală a echipei', 'O grămadă de e-mailuri fără răspuns'],
  people: ['Ana', 'Mihai', 'Mama', 'Tata', 'Ioana', 'Elena', 'Andrei', 'Maria', 'Radu', 'Cristina'],
  locations: ['Acasă', 'Birou', 'Parc', 'Cafenea', 'La părinți', 'Plajă', 'Bibliotecă'],
  tags: ['muncă', 'familie', 'sănătate', 'prieteni', 'sport', 'studii', 'odihnă', 'natură', 'creativitate', 'bani'],
  sportTag: 'sport',
  // Nouns that fit after "de minute de".
  exerciseTypes: ['mers pe jos', 'alergare', 'antrenament de forță', 'înot', 'ciclism', 'yoga'],
  badDay: {
    title: 'O zi groaznică',
    body: 'O zi groaznică. Totul a mers prost: m-am trezit târziu, am pierdut o ședință importantă și m-am certat cu un prieten apropiat. M-a copleșit totul și nu știam de unde să încep.',
  },
  goodDay: {
    title: 'O zi perfectă',
    body: 'O zi perfectă! Am primit o veste bună la serviciu, seara am sărbătorit cu toată familia și am simțit recunoștință pentru tot.',
  },
  // 4 to 9 hours: "ore" without "de"; 20 to 60 minutes: always "de minute".
  sleep: (hours, low) => (low ? `Azi-noapte am dormit doar ${hours} ore și s-a simțit.` : `Am dormit ${hours} ore, destul de bine.`),
  exercise: (type, minutes, slot) => `${slot === 'midday' ? 'Azi-dimineață' : 'După-amiază'} am făcut ${minutes} de minute de ${type}.`,
  secondEntry: (slot) => (slot === 'midday' ? 'Câteva rânduri la mijlocul zilei, între două treburi.' : 'Un scurt rezumat al serii, înainte de culcare.'),
  sundayNote: 'Începutul săptămânii e mereu puțin stresant – se adună atât de multe pe birou.',
  peopleSentence: (names, met) => `${met ? 'M-am văzut cu' : 'Am vorbit cu'} ${joinNames(names)}.`,
  note: 'De ținut minte: să scriu mâine despre ce a mers bine.',
  // Spelled as in English: the tag "sport" and the exercise "yoga".
  sameAsEnglish: ['sport', 'yoga'],
};

export default content;
