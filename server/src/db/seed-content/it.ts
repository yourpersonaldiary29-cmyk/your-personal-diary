/**
 * it - demo texts ("Load sample data"). Same fields and pool sizes as en.ts (see README.md).
 *
 * The apostrophe is ’ as in the app's own messages. The sentences avoid every form that would gender
 * the writer ("oggi stavo bene", "non riuscivo a..." instead of "mi sono sentito/a").
 */
import type { SeedContent } from './types';

/** As chips "Mamma" / "Papà" start with a capital; inside a sentence they are common nouns ("Ho parlato con mamma."). */
const IN_SENTENCE: Record<string, string> = { Mamma: 'mamma', Papà: 'papà' };

/** "A", "A e B" - "ed" before a name that starts with "e" ("Luca ed Elena"). */
function joinNames(names: string[]): string {
  const words = names.map((name) => IN_SENTENCE[name] ?? name);
  if (words.length <= 1) return words.join('');
  const last = words[words.length - 1];
  return `${words.slice(0, -1).join(', ')} ${/^e/i.test(last) ? 'ed' : 'e'} ${last}`;
}

const content: SeedContent = {
  titles: {
    high: ['Una mattina meravigliosa', 'Una giornata piena di energia', 'Una giornata davvero bella', 'Finalmente un vero riposo', 'Una giornata di piccole vittorie', 'Sole e aria fresca'],
    mid: ['Una giornata normale', 'Una giornata di lavoro', 'Commissioni e routine', 'Un altro giorno passato', 'Una giornata con i miei ritmi', 'Una routine piacevole'],
    // "stanco" is the word of search example 2 (also in openers.low); said of the body, not of the writer.
    low: ['Una giornata difficile', 'Il corpo stanco', 'Oggi non è stato facile', 'Una giornata estenuante', 'La testa pesante', 'Volevo solo che la giornata finisse'],
  },
  openers: {
    high: [
      'Oggi stavo davvero bene.',
      'Ho aperto gli occhi con il sorriso e la giornata è andata avanti così.',
      'È stata una giornata piena di buona energia.',
      'Avevo il cuore leggero e contento.',
    ],
    mid: ['Una giornata normale, senza sorprese.', 'Ho vissuto la giornata con i miei ritmi.', 'Niente di speciale, ma è andata bene.', 'Una giornata di routine, tra lavoro e commissioni.'],
    low: [
      'Ho avuto una giornata difficile.',
      'Per quasi tutto il giorno ho avuto il corpo pesante e stanco.',
      'Non riuscivo a concentrarmi su niente.',
      'La giornata è partita con il piede sbagliato.',
    ],
  },
  events: [
    'Riunione di lavoro',
    'Cena in famiglia',
    'Visita dal medico',
    'Spesa al supermercato',
    'Telefonata con un vecchio amico',
    'Commissioni in banca',
    'Una conferenza interessante',
    'Giornata di lavoro da casa',
    'Una breve gita',
    'Pulizie di casa',
    'Uscita con gli amici',
    'Corso in palestra',
    'Serata film',
    'Cucinare un piatto nuovo',
  ],
  sundayEvents: ['Pianificare la settimana', 'Riunione settimanale del gruppo di lavoro', 'Montagne di e-mail a cui rispondere'],
  people: ['Giulia', 'Marco', 'Mamma', 'Papà', 'Sara', 'Chiara', 'Luca', 'Elena', 'Matteo', 'Francesca'],
  locations: ['Casa', 'Ufficio', 'Parco', 'Bar', 'Casa dei miei genitori', 'Spiaggia', 'Biblioteca'],
  tags: ['lavoro', 'famiglia', 'salute', 'amici', 'sport', 'studio', 'riposo', 'natura', 'creatività', 'soldi'],
  sportTag: 'sport',
  // Nouns that fit after "minuti di".
  exerciseTypes: ['camminata', 'corsa', 'allenamento di forza', 'nuoto', 'bicicletta', 'yoga'],
  badDay: {
    title: 'Una giornata terribile',
    body: 'Una giornata terribile. È andato tutto storto: sveglia in ritardo, una riunione importante saltata e una lite con un caro amico. Mi sembrava tutto troppo e non sapevo da dove cominciare.',
  },
  goodDay: {
    title: 'Una giornata perfetta',
    body: 'Una giornata perfetta! Ho ricevuto una bella notizia al lavoro, la sera abbiamo festeggiato con tutta la famiglia e ho provato gratitudine per tutto.',
  },
  sleep: (hours, low) => (low ? `Stanotte ho dormito solo ${hours} ore e si è sentito.` : `Ho dormito ${hours} ore, abbastanza bene.`),
  exercise: (type, minutes, slot) => `Ho fatto ${minutes} minuti di ${type} ${slot === 'midday' ? 'stamattina' : 'nel pomeriggio'}.`,
  secondEntry: (slot) => (slot === 'midday' ? 'Due righe a metà giornata, tra una cosa e l’altra.' : 'Un breve riassunto della serata prima di dormire.'),
  sundayNote: 'L’inizio della settimana è sempre un po’ stressante: sulla scrivania si accumula di tutto.',
  peopleSentence: (names, met) => `${met ? 'Ho visto' : 'Ho parlato con'} ${joinNames(names)}.`,
  note: 'Ricordarmi di scrivere domani di ciò che è andato bene.',
  // Spelled as in English: the tag "sport" and the exercise "yoga".
  sameAsEnglish: ['sport', 'yoga'],
};

export default content;
