/**
 * cs - demo texts ("Load sample data"). Same fields and pool sizes as en.ts (see README.md).
 *
 * Czech past-tense verbs show the writer's gender ("cítil / cítila"), so the sentences use the
 * present tense, impersonal forms or noun phrases ("Mám za sebou těžký den.", "Spánek: ..."). The
 * word of search example 2, "unavený", is said of the day and of a feeling, never of the writer.
 * Names and exercise types stay in the nominative: they follow a colon, where no case ending is
 * needed ("Dnešní setkání: Anna a Petr.", "30 minut pohybu: běh.").
 */
import type { SeedContent } from './types';

const plural = new Intl.PluralRules('cs');

/** The counted noun after a number: "1 hodina", "4 hodiny", "4,5 hodiny", "5 hodin". */
function counted(value: number, forms: { one: string; few: string; many: string; other: string }): string {
  const category = plural.select(value);
  return category === 'one' || category === 'few' || category === 'many' ? forms[category] : forms.other;
}

const HOURS = { one: 'hodina', few: 'hodiny', many: 'hodiny', other: 'hodin' };
const MINUTES = { one: 'minuta', few: 'minuty', many: 'minuty', other: 'minut' };

const content: SeedContent = {
  titles: {
    high: ['Nádherné ráno', 'Den plný energie', 'Opravdu dobrý den', 'Konečně odpočinek', 'Den malých vítězství', 'Slunce a čerstvý vzduch'],
    mid: ['Obyčejný den', 'Pracovní den', 'Pochůzky a rutina', 'Další den za mnou', 'Den v mém tempu', 'Příjemná rutina'],
    // "unavený" is the word of search example 2 (also in openers.low); said of the day, not of the writer.
    low: ['Těžký den', 'Jeden unavený den', 'Dnes to nebylo lehké', 'Vyčerpávající den', 'Těžká hlava', 'Chtělo se mi, aby den už skončil'],
  },
  openers: {
    high: [
      'Dnes mi je opravdu dobře.',
      'Ráno začalo úsměvem a tak to vydrželo celý den.',
      'Byl to den plný dobré energie.',
      'Je mi lehko a vesele.',
    ],
    mid: [
      'Obyčejný den, žádná překvapení.',
      'Den uběhl v mém tempu.',
      'Nic zvláštního, ale bylo to fajn.',
      'Rutinní den plný práce a pochůzek.',
    ],
    low: [
      'Mám za sebou těžký den.',
      'Většinu dne mě držel těžký, unavený pocit.',
      'Nešlo se na nic soustředit.',
      'Den začal levou nohou.',
    ],
  },
  events: [
    'Schůzka v práci',
    'Rodinná večeře',
    'Návštěva u lékaře',
    'Nákup potravin',
    'Telefonát se starým kamarádem',
    'Pochůzky v bance',
    'Zajímavá přednáška',
    'Den práce z domova',
    'Krátký výlet',
    'Úklid domácnosti',
    'Setkání s přáteli',
    'Hodina cvičení',
    'Filmový večer',
    'Vaření nového jídla',
  ],
  sundayEvents: ['Plánování nadcházejícího týdne', 'Týdenní schůzka týmu', 'Hromady e-mailů k zodpovězení'],
  people: ['Anna', 'Petr', 'Máma', 'Táta', 'Jana', 'Tomáš', 'Lucie', 'Jakub', 'Eva', 'Martin'],
  locations: ['Doma', 'Kancelář', 'Park', 'Kavárna', 'U rodičů', 'Pláž', 'Knihovna'],
  tags: ['práce', 'rodina', 'zdraví', 'přátelé', 'sport', 'studium', 'odpočinek', 'příroda', 'tvořivost', 'peníze'],
  sportTag: 'sport',
  // Nominative nouns, named after a colon in exercise().
  exerciseTypes: ['chůze', 'běh', 'posilování', 'plavání', 'jízda na kole', 'jóga'],
  badDay: {
    title: 'Hrozný den',
    body: 'Hrozný den. Všechno šlo špatně: pozdní vstávání, zmeškaná důležitá schůzka a hádka s blízkým člověkem. Všechno mě zavalilo a nebylo jasné, kde začít.',
  },
  goodDay: {
    title: 'Dokonalý den',
    body: 'Dokonalý den! V práci přišla radostná zpráva, večer jsme slavili s celou rodinou a cítím vděčnost za všechno.',
  },
  sleep: (hours, low, value) => {
    const unit = counted(value, HOURS);
    return low ? `Dnes v noci jen ${hours} ${unit} spánku, a bylo to cítit.` : `Spánek: ${hours} ${unit}, docela dobrý.`;
  },
  exercise: (type, minutes, slot, value) => `${slot === 'midday' ? 'Dopoledne' : 'Odpoledne'} ${minutes} ${counted(value, MINUTES)} pohybu: ${type}.`,
  secondEntry: (slot) => (slot === 'midday' ? 'Pár slov uprostřed dne, mezi jednou věcí a druhou.' : 'Krátké shrnutí večera před spaním.'),
  sundayNote: 'Začátek týdne je vždycky trochu stresující – na stole se toho tolik nahromadí.',
  peopleSentence: (names, met) => `${met ? 'Dnešní setkání' : 'Dnešní rozhovor'}: ${names.join(' a ')}.`,
  note: 'Zítra nezapomenout napsat, co se povedlo.',
  // Spelled as in English: the tag "sport" and the place "Park".
  sameAsEnglish: ['sport', 'Park'],
};

export default content;
