/**
 * hu - demo texts ("Load sample data"). Same fields and pool sizes as en.ts (see README.md).
 *
 * Hungarian has no grammatical gender, so first person is natural throughout. Names and exercise
 * types stay in their dictionary form: Hungarian would add a case suffix to a name inside a
 * sentence ("Annával"), so people and exercise types follow a colon ("Mai találkozás: Anna és
 * Péter.", "30 perc mozgás: futás."). Numbers take the singular ("7,5 óra", "30 perc").
 */
import type { SeedContent } from './types';

const content: SeedContent = {
  titles: {
    high: ['Csodálatos reggel', 'Energiával teli nap', 'Igazán jó nap', 'Végre kipihenten', 'A kis győzelmek napja', 'Napsütés és friss levegő'],
    mid: ['Egy átlagos nap', 'Munkanap', 'Ügyintézés és rutin', 'Eltelt még egy nap', 'Egy nap a saját tempómban', 'Kellemes rutin'],
    // "fárad" is the stem of search example 2 ("fáradtság", "fáradtnak"; also in openers.low).
    low: ['Nehéz nap', 'Mély fáradtság', 'Ma nem volt könnyű', 'Kimerítő nap', 'Nehéz fej', 'Azt akartam, hogy vége legyen a napnak'],
  },
  openers: {
    high: [
      'Ma igazán jól éreztem magam.',
      'Mosolyogva ébredtem, és a nap is így folytatódott.',
      'Jó energiával teli nap volt.',
      'Könnyűnek és boldognak éreztem magam.',
    ],
    mid: [
      'Átlagos nap, meglepetések nélkül.',
      'A saját tempómban haladtam végig a napon.',
      'Semmi különös, de rendben volt.',
      'Rutinnap munkával és ügyintézéssel.',
    ],
    low: [
      'Nehéz napom volt.',
      'A nap nagy részében nehéznek és fáradtnak éreztem magam.',
      'Semmire sem tudtam odafigyelni.',
      'A nap rosszul indult.',
    ],
  },
  events: [
    'Megbeszélés a munkahelyen',
    'Családi vacsora',
    'Orvosi vizsgálat',
    'Bevásárlás',
    'Telefon egy régi baráttal',
    'Ügyintézés a bankban',
    'Egy érdekes előadás',
    'Otthoni munkanap',
    'Egy rövid kirándulás',
    'Takarítás',
    'Találkozás a barátokkal',
    'Edzés',
    'Filmest',
    'Új étel főzése',
  ],
  sundayEvents: ['A következő hét megtervezése', 'Heti csapatmegbeszélés', 'Rengeteg megválaszolatlan e-mail'],
  people: ['Anna', 'Péter', 'Anya', 'Apa', 'Eszter', 'Zsófi', 'Gábor', 'Kata', 'Bence', 'Réka'],
  locations: ['Otthon', 'Iroda', 'Park', 'Kávézó', 'A szüleimnél', 'Strand', 'Könyvtár'],
  tags: ['munka', 'család', 'egészség', 'barátok', 'sport', 'tanulás', 'pihenés', 'természet', 'kreativitás', 'pénz'],
  sportTag: 'sport',
  // Dictionary forms, named after a colon in exercise().
  exerciseTypes: ['séta', 'futás', 'erősítő edzés', 'úszás', 'kerékpározás', 'jóga'],
  badDay: {
    title: 'Szörnyű nap',
    body: 'Szörnyű nap. Minden rosszul sült el: későn keltem, lemaradtam egy fontos megbeszélésről, és összevesztem egy közeli barátommal. Teljesen maga alá temetett minden, és nem tudtam, hol kezdjem.',
  },
  goodDay: {
    title: 'Tökéletes nap',
    body: 'Tökéletes nap! Örömteli hírt kaptam a munkahelyen, este az egész családdal ünnepeltünk, és hálát éreztem mindenért.',
  },
  sleep: (hours, low) => (low ? `Az éjjel csak ${hours} órát aludtam, és meg is éreztem.` : `Aludtam ${hours} órát, egész jól.`),
  exercise: (type, minutes, slot) => `${slot === 'midday' ? 'Reggel' : 'Délután'} ${minutes} perc mozgás: ${type}.`,
  secondEntry: (slot) => (slot === 'midday' ? 'Néhány szó a nap közepén, két teendő között.' : 'Rövid összegzés az estéről, elalvás előtt.'),
  sundayNote: 'A hét eleje mindig egy kicsit stresszes – annyi minden gyűlik össze az asztalon.',
  peopleSentence: (names, met) => `${met ? 'Mai találkozás' : 'Mai beszélgetés'}: ${names.join(' és ')}.`,
  note: 'Ne felejtsem el holnap leírni, mi ment jól.',
  // Spelled as in English: the tag "sport" and the place "Park".
  sameAsEnglish: ['sport', 'Park'],
};

export default content;
