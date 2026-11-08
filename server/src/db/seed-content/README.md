# Demo texts per language (`server/src/db/seed-content`)

"Load sample data" (Settings > Data, `POST /api/settings/seed-demo`) fills an empty diary with about
120 days of fictional entries and habits. The generator is `../seed.ts`; the **words** come from this
folder, one file per UI language:

| File | What it is |
| --- | --- |
| `types.ts` | The `SeedContent` shape every language file exports (and the five habit keys). |
| `en.ts` | English. **The reference file**: sizes, order and meaning of every pool. |
| `he.ts` | Hebrew. |
| `<locale>.ts` | The other 18 languages: `ar zh ja hi th es pt fr it de ro el pl cs hu ru bg tr` (all written; el pl cs hu ru bg since 2026-10-26). |
| `index.ts` | The registry (static imports), typed `Record<Locale, SeedContent>` since all 20 files are in (section 7). |
| `README.md` | This contract. |

Tests: `server/test/data-seed-content.test.ts` reads the folder listing and checks **every language
file it finds** - nothing in the test has to be edited when a file is added. Languages without a file
show up there as `todo`.

Only texts live here. Dates, ratings, habit targets and values, and which pool item is used where are
decided by the generator from a seeded random sequence and are identical in every language: entry
number N of the German demo is the translation of entry number N of the English demo. That is why
the pools must have **identical sizes and the same order of meaning** in every file.

---

## 1. The shape: `SeedContent`

Sizes are fixed (the tests compare them with `en.ts`). "Slot" = position in the pool, counted from 1.

| Field | Size | Meaning and use |
| --- | --- | --- |
| `titles.high` | 6 | Entry title on a good day (mood 8-10). |
| `titles.mid` | 6 | Entry title on an ordinary day (mood 5-7). |
| `titles.low` | 6 | Entry title on a bad day (mood 1-4). |
| `openers.high` / `.mid` / `.low` | 4 each | First sentence of the entry body, by the same mood levels. A full sentence with its final punctuation. |
| `events` | 14 | Things that happened (short noun phrases, shown as chips; 1-2 per entry in about 70% of the entries). |
| `sundayEvents` | 3 | Extra events that can appear only on Sundays (the planted "start of the week" stress). |
| `people` | 10 | Fictional first names; **slot 3 = the word for mother, slot 4 = the word for father**. Shown as chips and put into `peopleSentence()`. |
| `locations` | 7 | Places (the entry's location field). |
| `tags` | 10 | Tags: single words, no spaces, no `#`, no comma. 1-3 per entry. |
| `sportTag` | 1 string | Exactly the same string as `tags` slot 5 (the "sport" tag); added on exercise days. |
| `exerciseTypes` | 6 | Kinds of exercise. Stored as the entry's exercise type **and** put into `exercise()`. |
| `badDay` | `{ title, body }` | The one very bad day of the demo (mood 1). `body` may be several sentences. |
| `goodDay` | `{ title, body }` | The one very good day (mood 10). |
| `sleep(hours, low, value)` | function | Sentence about last night. `hours` is the number already formatted for the language (`"7.5"` / `"7,5"`) - show it as given. `low` = a short night (under 6 hours). `value` = the same number as a number (4, 4.5 ... 9) for languages whose word for "hours" changes with it. |
| `exercise(type, minutes, slot, value)` | function | Sentence about the day's exercise. `type` is one item of `exerciseTypes`; `minutes` is already formatted - show it as given; `slot` is `'midday'` (the entry was written 10:00-12:59: say "in the morning") or `'evening'` (18:00-22:59: say "in the afternoon"); `value` = the minutes as a number (whole, 20 to 60). |
| `secondEntry(slot)` | function | Opening of the day's second entry (a short check-in at midday / in the evening). |
| `sundayNote` | 1 string | Sentence added to every Sunday entry (the week starts, things pile up). |
| `peopleSentence(names, met)` | function | `names` holds one or two items of `people`. `met` true: "I met X and Y."; false: "I talked with X and Y.". |
| `note` | 1 string | The entry's notes field (about one entry in five). |
| `sentenceSeparator` | optional `''` or `' '` | What the generator puts between two sentences of a body. Leave it out for a space. **Chinese and Japanese set `''`** (no space after `。`). |
| `sameAsEnglish` | optional list | Latin-script languages only - see rule 8. |
| `habits` | optional | **Leave it out.** See rule 1. Only `en.ts` and `he.ts` have it. |

How a body is put together: `opener` + `sleep(...)` + `exercise(...)` (only on exercise days) on the
first entry of a day, or `opener` + `secondEntry(...)` on the second one; then `sundayNote` on Sundays;
then `peopleSentence(...)` when people were drawn. The parts are joined with `sentenceSeparator`. So
every part must be a complete sentence that can stand next to any other.

### The English pools, slot by slot (translate slot for slot)

- `titles.high`: 1 A wonderful morning · 2 A day full of energy · 3 A genuinely good day · 4 Finally rested · 5 A day of small wins · 6 Sunshine and fresh air
- `titles.mid`: 1 An ordinary day · 2 A work day · 3 Errands and routine · 4 Another day gone by · 5 A day at my own pace · 6 A pleasant routine
- `titles.low`: 1 A hard day · 2 Deep tiredness · 3 Today was not easy · 4 An exhausting day · 5 A heavy head · 6 I wanted the day to end
- `openers.high`: 1 I felt really good today. · 2 I woke up smiling and the day kept going that way. · 3 It was a day full of good energy. · 4 I felt light and happy.
- `openers.mid`: 1 An ordinary day, no surprises. · 2 I got through the day at my own pace. · 3 Nothing special, but it was fine. · 4 A routine day of work and errands.
- `openers.low`: 1 I had a hard day. · 2 I felt heavy and tired most of the day. · 3 I could not concentrate on anything. · 4 The day got off on the wrong foot.
- `events`: 1 Meeting at work · 2 Family dinner · 3 Doctor visit · 4 Grocery shopping · 5 Call with an old friend · 6 Errands at the bank · 7 An interesting lecture · 8 Work-from-home day · 9 A short trip · 10 Cleaning the house · 11 Meeting friends · 12 Sports class · 13 Movie night · 14 Cooking a new dish
- `sundayEvents`: 1 Planning the week ahead · 2 Weekly team meeting · 3 Piles of e-mails to answer
- `people`: 1-2 names · **3 Mom · 4 Dad** · 5-10 names
- `locations`: 1 Home · 2 Office · 3 Park · 4 Cafe · 5 My parents' place · 6 Beach · 7 Library
- `tags`: 1 work · 2 family · 3 health · 4 friends · **5 sport** · 6 studies · 7 rest · 8 nature · 9 creativity · 10 money
- `exerciseTypes`: 1 walking · 2 running · 3 strength training · 4 swimming · 5 cycling · 6 yoga

The exact English sentences (bad day, good day, the functions, `sundayNote`, `note`) are in `en.ts`.

---

## 2. Rules for a language file

1. **No `habits`.** The five demo habits take their name, description and unit from the app's habit
   templates in the language (`shared/i18n/messages/<locale>/habits.ts`), so they are called exactly
   like the templates the user sees. Targets and frequencies are fixed in `../seed.ts`.
2. **Same sizes, same order of meaning** as `en.ts` (table above). Translate slot for slot. Do not
   reorder, merge or drop items; no item twice in a pool; no title used in two pools; no opener that
   is the beginning of another opener.
3. **Language.** Natural, everyday diary language of a neutral adult. Gender-neutral where the
   language allows it, otherwise one consistent first person. No health conditions, no politics, no
   religion. Stay with what the English set says (the doctor visit and the `health` tag stay as they are).
4. **Script and punctuation of the language**: French no-break spaces before `; : ! ?`, Arabic comma
   and question mark, CJK punctuation (`。` `，` `！`), Thai without spaces between words, typographic
   quotes of the language. One line per text, no double spaces, no space at an end.
5. **People**: first names that are common where the language is spoken, fictional, first names only
   (no family names). Slots 3 and 4 are "Mom" and "Dad" in the language.
6. **Names and exercise types stay in their dictionary form.** The same string is stored in the
   entry (chips, the exercise field) and inserted into the sentence, and the function only receives
   the string. In languages with cases, write the sentence so that the inserted word fits as it is,
   for example a colon or brackets: "Today I saw: X and Y." / "Training in the morning (running),
   30 minutes.". The sentence must change with its arguments: other people or another exercise type
   give another sentence; two names are both named, in the order given.
7. **Numbers.** Show `hours` and `minutes` exactly as received (they are formatted for the language).
   If the noun depends on the number (2 hours / 5 hours in Slavic languages, Arabic...), choose the
   form from `value` (for example with `new Intl.PluralRules('<locale>')`), or use an abbreviation
   that does not change. Possible values: hours 4 to 9 in halves, minutes 20 to 60.
8. **No English leftovers.**
   - Languages in another script (ar, zh, ja, hi, th, el, ru, bg): no word in Latin letters at all
     (write "yoga", "e-mail", "cafe" in the language's own script).
   - Languages in Latin letters: no string may equal the English string of the same pool, and no
     sentence may contain common English words ("the", "and", "with"...). A one-word item of `people`,
     `locations`, `tags` or `exerciseTypes` that really is spelled like the English one (a cognate such
     as `sport`, `yoga`, `Park`, or a name such as `Dana`) must be listed in `sameAsEnglish`, for
     example `sameAsEnglish: ['sport', 'yoga']`. List only what is needed; "Mom" and "Dad" can never
     be listed.
9. **Tags** are single words as a person would type them (no spaces, `#`, commas). `sportTag` is the
   string of `tags` slot 5.
10. **The words of the search examples** (section 3) must be in the texts.
11. **Code.** The file imports only `import type { SeedContent } from './types';`, has no other
    imports, no network, no dates, no randomness: the functions are pure (same arguments, same
    sentence). Default export of type `SeedContent`. Local helper functions (joining names, plural
    forms) are fine. Text limits: title 200 characters, event / person / tag 100, location 200,
    exercise type 100.

---

## 3. The words the search examples look for

The search page of every language shows six example questions
(`shared/i18n/messages/<locale>/search.ts`, keys `search.example.1` ... `6`). They must find something
in the demo of that language. Four of them ask about ratings, sleep and emotions and work in any
language. Two ask for **words**:

- **Example 2** ("When did I write that I was tired?") searches the entry texts for a word. Put that
  word into **at least two low-mood texts: one item of `titles.low` and one item of `openers.low`**
  (in English: "Deep tiredness" and "I felt heavy and tired most of the day."). One place is not
  enough: on some weekdays that one text is never drawn, and the tests try all seven.
- **Example 6** ("Entries with the tag work") searches for a tag. That word must be **one of `tags`**
  (slot 1, "work"), written the same way.

The search matches the stem below as a part of a word; letters with accents and letters outside
A-Z must be written exactly as in the stem (same accents, same upper/lower case).

| Locale | Example 2 | Stem the texts must contain | Example 6 | Tag (slot 1) |
| --- | --- | --- | --- | --- |
| en | When did I write that I was tired? | tired | Entries with the tag work | work |
| he | מתי כתבתי שאני עייף? | עייף / עייפ | רשומות עם התגית עבודה | עבודה |
| ar | متى كتبت أنني متعب؟ | متعب | التدوينات التي تحمل الوسم «عمل» | عمل |
| zh | 我什么时候写过我很累？ | 累 | 带有“工作”标签的记录 | 工作 |
| ja | 「疲れた」と書いたのはいつ？ | 疲れた | 「仕事」タグが付いた記録 | 仕事 |
| hi | मैंने कब लिखा कि मुझे थकान थी? | थकान | काम टैग वाली प्रविष्टियाँ | काम |
| th | ฉันเขียนว่าฉันเหนื่อยเมื่อไหร่? | เหนื่อย | บันทึกที่มีแท็กงาน | งาน |
| es | ¿Cuándo escribí sobre el cansancio? | cansancio | Entradas con la etiqueta trabajo | trabajo |
| pt | Quando escrevi sobre o cansaço? | cansaço | Entradas com a etiqueta trabalho | trabalho |
| fr | Quand ai-je écrit que j’étais fatigué ? | fatigué | Entrées avec l’étiquette travail | travail |
| it | Quando ho scritto che ero stanco? | stanco | Voci con il tag lavoro | lavoro |
| de | Wann habe ich geschrieben, dass ich müde war? | müde | Einträge mit dem Schlagwort Arbeit | Arbeit |
| ro | Când am scris că eram obosit? | obosit | Însemnări cu eticheta muncă | muncă |
| el | Πότε έγραψα για κούραση; | κούραση | Καταχωρίσεις με την ετικέτα δουλειά | δουλειά |
| pl | W których wpisach piszę o zmęczeniu? | zmęczeni | Wpisy z tagiem praca | praca |
| cs | Kdy jsem psal, že jsem unavený? | unavený | Záznamy se štítkem práce | práce |
| hu | Mikor írtam, hogy fáradt vagyok? | fárad | Bejegyzések a munka címkével | munka |
| ru | Когда я писал(а), что устал(а)? | устал | Записи с тегом «работа» | работа |
| bg | Кога писах, че съм уморен(а)? | уморен | Записи с етикет „работа“ | работа |
| tr | Ne zaman yorgun olduğumu yazdım? | yorg | Etiketi iş olan kayıtlar | iş |

The table was produced from the search parser on 2026-10-04. If an example question changes, the
test is the authority: its failure message prints the words the search looked for
(`example 2 "..." finds nothing (words: [...])`). When the stem is a gendered form (cs "unavený",
it "stanco"), use it in a way that does not gender the writer (a tired day, a tired body...).

---

## 4. Adding a language, step by step

1. Write `server/src/db/seed-content/<locale>.ts` from the skeleton in section 6, following `en.ts`
   slot by slot. Write the whole file to disk in one go.
2. Register it in `index.ts`: remove the `// ` in front of its import line and in front of its line
   in `SEED_CONTENT` (both lines are already there). Touch nothing else in that file.
3. In `shared/i18n/messages/<locale>/settings.ts`, key `settings.data.seedDemoMessage`: delete the
   last sentence, the one that says the sample entries are in English. It is no longer true. (The
   test fails while a language has its own texts and still says so.)
4. Run, from `server/`:
   `npx tsc --noEmit -p tsconfig.json` and
   `npx vitest run test/data-seed-content.test.ts test/data-seed.test.ts`
   Every failure names the item and the reason. Then the project gates (server and root tsc + vitest,
   `node scripts/check-no-network.mjs`).

Nothing else changes: `seedLanguageOf(locale)` returns the locale itself as soon as it is registered.

## 5. What the tests check for each file

- registered in `index.ts`; the file name is a UI language code
- same fields and pool sizes as `en.ts`
- every text well-formed (one line, trimmed, no double spaces, no broken placeholder), no duplicate
  in a pool, tags are single words, `sportTag` is `tags` slot 5, text limits
- the functions use their arguments (rule 6), show the numbers (rule 7) for every possible value and
  are pure
- no English leftovers (rule 8)
- the demo of the language has exactly the structure of the English demo on all seven weekdays:
  same dates, times, ratings, emotions and habit logs, the same pool slot in every title, opener,
  event, person, location and tag - so the planted patterns (short sleep -> lower mood, exercise ->
  energy, Sunday stress, weekly reading) do not depend on the language
- every stored entry passes the normal entry validation unchanged; the analysis engine finds the
  planted patterns
- the six example questions of the language's search page find something on all seven weekdays, and
  the tag of example 6 is one of `tags`
- the habits are named like the habit templates of the language
- the "Load sample data?" confirmation says "the sample entries are in English" exactly in the
  languages without their own file

## 6. Skeleton of a new file

```ts
/** xx - demo texts ("Load sample data"). Same fields and pool sizes as en.ts (see README.md). */
import type { SeedContent } from './types';

const content: SeedContent = {
  titles: {
    high: ['', '', '', '', '', ''],
    mid: ['', '', '', '', '', ''],
    low: ['', '', '', '', '', ''],
  },
  openers: {
    high: ['', '', '', ''],
    mid: ['', '', '', ''],
    low: ['', '', '', ''],
  },
  events: ['', '', '', '', '', '', '', '', '', '', '', '', '', ''], // 14
  sundayEvents: ['', '', ''],
  people: ['', '', '', '', '', '', '', '', '', ''], // 10; slot 3 = Mom, slot 4 = Dad
  locations: ['', '', '', '', '', '', ''], // 7
  tags: ['', '', '', '', '', '', '', '', '', ''], // 10; slot 1 = the tag of search example 6, slot 5 = sport
  sportTag: '', // = tags slot 5
  exerciseTypes: ['', '', '', '', '', ''], // 6; dictionary form
  badDay: { title: '', body: '' },
  goodDay: { title: '', body: '' },
  sleep: (hours, low, value) => (low ? `... ${hours} ...` : `... ${hours} ...`),
  exercise: (type, minutes, slot, value) => `... ${slot === 'midday' ? '...' : '...'} ... ${type} ... ${minutes} ...`,
  secondEntry: (slot) => (slot === 'midday' ? '...' : '...'),
  sundayNote: '',
  peopleSentence: (names, met) => `${met ? '...' : '...'} ${names.join(' ... ')}.`,
  note: '',
  // sentenceSeparator: '',            // zh and ja only
  // sameAsEnglish: ['sport', 'yoga'], // Latin-script languages only, only if really identical
};

export default content;
```

(`value` may be left out of the parameter list when the language does not need it, as in `en.ts`.)

## 7. When the last language is in

When all 20 files are registered, the `todo` list of the test is empty. Then tighten the registry
type in `index.ts` to `Record<Locale, SeedContent>`: from then on the compiler itself refuses a
missing language. (Done 2026-10-26: all 20 files are in and the registry has that type. A new UI
language now needs its seed file in the same change, or the server does not compile.)
