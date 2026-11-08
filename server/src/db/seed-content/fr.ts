/**
 * fr - demo texts ("Load sample data"). Same fields and pool sizes as en.ts (see README.md).
 *
 * French typography as in the app's own messages: the apostrophe is ’ and a no-break space (written
 *   here so that it is visible) stands before ":" and "!". The sentences avoid every form that
 * would gender the writer ("je me sentais", "j’avais le cœur léger" instead of "je me suis senti(e)").
 */
import type { SeedContent } from './types';

/** As chips "Maman" / "Papa" start with a capital; inside a sentence they are written small ("J’ai vu maman."). */
const IN_SENTENCE: Record<string, string> = { Maman: 'maman', Papa: 'papa' };

/** "A", "A et B". */
function joinNames(names: string[]): string {
  const words = names.map((name) => IN_SENTENCE[name] ?? name);
  if (words.length <= 1) return words.join('');
  return `${words.slice(0, -1).join(', ')} et ${words[words.length - 1]}`;
}

const content: SeedContent = {
  titles: {
    high: ['Une matinée merveilleuse', 'Une journée pleine d’énergie', 'Une vraie bonne journée', 'Enfin du vrai repos', 'Une journée de petites victoires', 'Soleil et grand air'],
    mid: ['Une journée ordinaire', 'Une journée de travail', 'Courses et routine', 'Encore une journée de passée', 'Une journée à mon rythme', 'Une routine agréable'],
    // "fatigué" is the word of search example 2 (also in openers.low); said of the body, not of the writer.
    low: ['Une journée difficile', 'Le corps fatigué', 'Pas facile aujourd’hui', 'Une journée épuisante', 'La tête lourde', 'J’avais hâte que la journée finisse'],
  },
  openers: {
    high: [
      'Je me sentais vraiment bien aujourd’hui.',
      'J’ai ouvert les yeux avec le sourire et la journée a continué sur cette lancée.',
      'C’était une journée pleine de bonne énergie.',
      'J’avais le cœur léger et joyeux.',
    ],
    mid: ['Une journée ordinaire, sans surprise.', 'J’ai traversé la journée à mon rythme.', 'Rien de spécial, mais c’était bien.', 'Une journée de routine, entre travail et courses.'],
    low: [
      'J’ai eu une journée difficile.',
      'J’ai eu le corps lourd et fatigué presque toute la journée.',
      'Je n’ai réussi à me concentrer sur rien.',
      'La journée est partie du mauvais pied.',
    ],
  },
  events: [
    'Réunion au travail',
    'Dîner en famille',
    'Rendez-vous chez le médecin',
    'Courses au supermarché',
    'Appel avec un vieil ami',
    'Démarches à la banque',
    'Une conférence intéressante',
    'Journée de télétravail',
    'Une petite escapade',
    'Ménage à la maison',
    'Sortie entre amis',
    'Cours de sport',
    'Soirée cinéma',
    'Cuisiner un nouveau plat',
  ],
  sundayEvents: ['Préparer la semaine à venir', 'Réunion d’équipe hebdomadaire', 'Des piles d’e-mails en attente'],
  people: ['Camille', 'Julien', 'Maman', 'Papa', 'Léa', 'Chloé', 'Thomas', 'Manon', 'Antoine', 'Sophie'],
  locations: ['Maison', 'Bureau', 'Parc', 'Café', 'Chez mes parents', 'Plage', 'Bibliothèque'],
  tags: ['travail', 'famille', 'santé', 'amis', 'sport', 'études', 'repos', 'nature', 'créativité', 'argent'],
  sportTag: 'sport',
  // Nouns that fit after "minutes de".
  exerciseTypes: ['marche', 'course à pied', 'musculation', 'natation', 'vélo', 'yoga'],
  badDay: {
    title: 'Une journée terrible',
    body: 'Une journée terrible. Tout est allé de travers : réveil trop tardif, une réunion importante manquée et une dispute avec un ami proche. Tout me dépassait et je ne savais pas par où commencer.',
  },
  goodDay: {
    title: 'Une journée parfaite',
    body: 'Une journée parfaite ! J’ai reçu une bonne nouvelle au travail, nous avons fêté ça le soir avec toute la famille et j’ai ressenti de la gratitude pour tout.',
  },
  sleep: (hours, low) => (low ? `Je n’ai dormi que ${hours} heures cette nuit et ça s’est senti.` : `J’ai dormi ${hours} heures, plutôt bien.`),
  exercise: (type, minutes, slot) => `J’ai fait ${minutes} minutes de ${type} ${slot === 'midday' ? 'ce matin' : 'cet après-midi'}.`,
  secondEntry: (slot) => (slot === 'midday' ? 'Quelques mots en milieu de journée, entre deux choses à faire.' : 'Un petit résumé de la soirée avant d’aller dormir.'),
  sundayNote: 'Le début de semaine est toujours un peu stressant : tant de choses s’accumulent sur le bureau.',
  peopleSentence: (names, met) => `${met ? 'J’ai vu' : 'J’ai parlé avec'} ${joinNames(names)}.`,
  note: 'Penser à écrire demain sur ce qui s’est bien passé.',
  // Spelled as in English: the tags "sport" and "nature", the exercise "yoga".
  sameAsEnglish: ['sport', 'nature', 'yoga'],
};

export default content;
