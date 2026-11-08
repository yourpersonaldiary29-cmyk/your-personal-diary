/**
 * pl - demo texts ("Load sample data"). Same fields and pool sizes as en.ts (see README.md).
 *
 * Polish past-tense verbs show the writer's gender ("czułem / czułam"), so the sentences use the
 * present tense, impersonal forms or noun phrases ("Mam za sobą ciężki dzień.", "Sen trwał...").
 * Names and exercise types stay in the nominative: they follow a colon, where no case ending is
 * needed ("Dzisiejsze spotkanie: Anna i Marek.", "30 minut ruchu: bieganie.").
 */
import type { SeedContent } from './types';

const plural = new Intl.PluralRules('pl');

/** The counted noun after a number: "1 godzina", "4 godziny", "5 godzin", "4,5 godziny". */
function counted(value: number, forms: { one: string; few: string; many: string; other: string }): string {
  const category = plural.select(value);
  return category === 'one' || category === 'few' || category === 'many' ? forms[category] : forms.other;
}

const HOURS = { one: 'godzina', few: 'godziny', many: 'godzin', other: 'godziny' };
const MINUTES = { one: 'minuta', few: 'minuty', many: 'minut', other: 'minuty' };

const content: SeedContent = {
  titles: {
    high: ['Cudowny poranek', 'Dzień pełen energii', 'Naprawdę dobry dzień', 'Wreszcie odpoczynek', 'Dzień małych zwycięstw', 'Słońce i świeże powietrze'],
    mid: ['Zwyczajny dzień', 'Dzień pracy', 'Sprawy i rutyna', 'Kolejny dzień za mną', 'Dzień w moim tempie', 'Przyjemna rutyna'],
    // "zmęczeni" is the stem of search example 2 ("zmęczenie" contains it; also in openers.low).
    low: ['Ciężki dzień', 'Głębokie zmęczenie', 'Dziś nie było łatwo', 'Wyczerpujący dzień', 'Ciężka głowa', 'Chciałoby się, żeby dzień już się skończył'],
  },
  openers: {
    high: [
      'Czuję się dziś naprawdę dobrze.',
      'Poranek zaczął się uśmiechem i taki był cały dzień.',
      'To był dzień pełen dobrej energii.',
      'Lekkość i radość – tak wyglądał dzisiejszy nastrój.',
    ],
    mid: [
      'Zwyczajny dzień, bez niespodzianek.',
      'Dzień minął w moim tempie.',
      'Nic szczególnego, ale było w porządku.',
      'Rutynowy dzień pracy i załatwiania spraw.',
    ],
    low: [
      'Mam za sobą ciężki dzień.',
      'Przez większość dnia towarzyszyło mi zmęczenie i uczucie ciężkości.',
      'Nie dało się na niczym skupić.',
      'Dzień zaczął się od wstania lewą nogą.',
    ],
  },
  events: [
    'Spotkanie w pracy',
    'Rodzinna kolacja',
    'Wizyta u lekarza',
    'Zakupy spożywcze',
    'Rozmowa ze starym przyjacielem',
    'Sprawy w banku',
    'Ciekawy wykład',
    'Dzień pracy z domu',
    'Krótka wycieczka',
    'Sprzątanie domu',
    'Spotkanie ze znajomymi',
    'Zajęcia sportowe',
    'Wieczór filmowy',
    'Gotowanie nowej potrawy',
  ],
  sundayEvents: ['Planowanie nadchodzącego tygodnia', 'Cotygodniowe spotkanie zespołu', 'Stosy e-maili do odpisania'],
  people: ['Anna', 'Marek', 'Mama', 'Tata', 'Kasia', 'Zosia', 'Piotr', 'Ola', 'Tomek', 'Magda'],
  locations: ['Dom', 'Biuro', 'Park', 'Kawiarnia', 'U rodziców', 'Plaża', 'Biblioteka'],
  tags: ['praca', 'rodzina', 'zdrowie', 'przyjaciele', 'sport', 'nauka', 'odpoczynek', 'natura', 'kreatywność', 'pieniądze'],
  sportTag: 'sport',
  // Nominative nouns, named after a colon in exercise().
  exerciseTypes: ['spacer', 'bieganie', 'trening siłowy', 'pływanie', 'jazda na rowerze', 'joga'],
  badDay: {
    title: 'Okropny dzień',
    body: 'Okropny dzień. Wszystko poszło nie tak: późne wstawanie, spóźnienie na ważne spotkanie i kłótnia z bliską osobą. Wszystko mnie przytłoczyło i nie było wiadomo, od czego zacząć.',
  },
  goodDay: {
    title: 'Idealny dzień',
    body: 'Idealny dzień! W pracy dotarła do mnie radosna wiadomość, wieczorem świętowaliśmy całą rodziną, a we mnie było mnóstwo wdzięczności za wszystko.',
  },
  sleep: (hours, low, value) => {
    const unit = counted(value, HOURS);
    return low ? `Tej nocy sen trwał tylko ${hours} ${unit} i dało się to odczuć.` : `Przespane ${hours} ${unit}, całkiem dobrze.`;
  },
  exercise: (type, minutes, slot, value) => `${slot === 'midday' ? 'Rano' : 'Po południu'} ${minutes} ${counted(value, MINUTES)} ruchu: ${type}.`,
  secondEntry: (slot) => (slot === 'midday' ? 'Kilka słów w środku dnia, między jedną sprawą a drugą.' : 'Krótkie podsumowanie wieczoru przed snem.'),
  sundayNote: 'Początek tygodnia jest zawsze trochę stresujący – tyle spraw zbiera się na biurku.',
  peopleSentence: (names, met) => `${met ? 'Dzisiejsze spotkanie' : 'Dzisiejsza rozmowa'}: ${names.join(' i ')}.`,
  note: 'Pamiętać, żeby jutro zapisać, co się udało.',
  // Spelled as in English: the tag "sport" and the place "Park".
  sameAsEnglish: ['sport', 'Park'],
};

export default content;
