/**
 * The table of cases of `EntrySummary.excerpt`, read by the tests of the three copies of
 * `makeExcerpt`: `server/src/db/entries-repo.ts`, `server/src/stats/entry-summary.ts` and
 * `src/offline/overlay/effects.ts` (the offline overlay builds the summary of an entry that is still
 * waiting on the device exactly as the server will). It lives in `shared/` because this is the one
 * folder that both the server's tests (`server/test/excerpt.test.ts`, alias `@shared`) and the
 * client's tests (`src/offline/overlay/excerpt.test.ts`, alias `@shared`) can import and both type
 * checks cover. Only tests import it: no bundle carries it.
 *
 * The rule (the length is 160 code points, never half of a surrogate pair):
 * 1. Whitespace runs collapse to one space and the text is trimmed. A text of at most 160 code points
 *    is the excerpt as it is (no ellipsis: nothing was cut).
 * 2. A longer text keeps its first 159 code points. When the cut falls inside a word (the 159th and
 *    the 160th code point are both not a space) and there is a space among the last 40 code points
 *    kept (the 120th to the 159th), the cut goes back to the last such space. Without one (one long
 *    word, an address, Chinese, Japanese, Thai) the cut stays at 159, or a little before it when the
 *    160th code point belongs to the same character on the screen as the 159th (a combining mark, a
 *    skin tone, the second half of a flag, what follows a zero width joiner or a Hindi virama): then
 *    that whole character goes, so that no letter loses its marks and no emoji or flag is cut in half.
 *    Only when the whole beginning is one such character does the cut stay at 159.
 * 3. What looks wrong before an ellipsis is removed from the end, repeatedly: whitespace, weak
 *    punctuation, an opening bracket or opening quotation mark, a zero width joiner. Then one `…`
 *    (U+2026) is appended. When nothing would be left after going back to a space, the cut at 159 is
 *    tried the same way; when that too leaves nothing, the cut at 159 is used with only its trailing
 *    whitespace removed.
 * 4. The result is never empty for a text with a non-space character, never longer than 160 code
 *    points (also for a length argument of 0 or less: it counts as 1), and never ends with a space
 *    before the `…`.
 *
 * Every expected string below was worked out by hand from that rule; the comment of each case says
 * where the cut falls (positions count code points from 1).
 */

export interface ExcerptCase {
  name: string;
  body: string;
  expected: string;
}

const x = (n: number): string => 'x'.repeat(n);
const ELLIPSIS = '…';

export const EXCERPT_CASES: readonly ExcerptCase[] = [
  // --- nothing is cut -------------------------------------------------------------------------
  { name: 'empty text', body: '', expected: '' },
  { name: 'only whitespace', body: ' \n\t   ', expected: '' },
  { name: 'short text', body: 'Hello world.', expected: 'Hello world.' },
  { name: 'whitespace runs collapse and the ends are trimmed', body: '  שלום   עולם  \n שוב ', expected: 'שלום עולם שוב' },
  { name: 'a no-break space and an ideographic space are whitespace too', body: 'a 　b', expected: 'a b' },
  { name: 'exactly 160 code points: no ellipsis', body: x(160), expected: x(160) },
  {
    name: 'exactly 160 code points after the whitespace collapses',
    body: `  ${x(80)}   \n ${'y'.repeat(79)}\n`,
    expected: `${x(80)} ${'y'.repeat(79)}`,
  },
  { name: 'a short text that ends with a comma keeps it (nothing was cut)', body: 'one, two,', expected: 'one, two,' },

  // --- where the cut falls --------------------------------------------------------------------
  // 161 code points, one word: positions 159 and 160 are letters, no space at all -> 159 + ellipsis.
  { name: '161 code points, one long word', body: x(161), expected: x(159) + ELLIPSIS },
  // Space at 151; the cut (159 = "h", 160 = "i") is inside "abcdefghijklmnop" -> back to the space.
  { name: 'a cut inside a word with a near space', body: `${x(150)} abcdefghijklmnop`, expected: x(150) + ELLIPSIS },
  // 159 = last "y", 160 = a space: the cut is at the end of a word and stays.
  {
    name: 'a cut right at a space (the 160th code point is a space)',
    body: `${x(100)} ${'y'.repeat(58)} zzzz`,
    expected: `${x(100)} ${'y'.repeat(58)}${ELLIPSIS}`,
  },
  // 159 = a space: removed before the ellipsis.
  { name: 'the 159th code point is a space', body: `${x(158)} yyyy`, expected: x(158) + ELLIPSIS },
  // The space at 120 is the first of the last 40 kept (120..159): the cut goes back to it.
  { name: 'a space 40 code points back is near enough', body: `${x(119)} ${'y'.repeat(60)}`, expected: x(119) + ELLIPSIS },
  // The space at 119 is 41 back: too far, the cut stays at 159 (inside the y-word).
  {
    name: 'a space 41 code points back is too far',
    body: `${x(118)} ${'y'.repeat(61)}`,
    expected: `${x(118)} ${'y'.repeat(40)}${ELLIPSIS}`,
  },
  // The only space is at 101 (59 back): too far, the cut stays at 159, inside the address.
  {
    name: 'an address (no space near the cut)',
    body: `${x(100)} www.example.com/abc/${'p'.repeat(80)}`,
    expected: `${x(100)} www.example.com/abc/${'p'.repeat(38)}${ELLIPSIS}`,
  },

  // --- languages without spaces ---------------------------------------------------------------
  // "我今天去公园散步了。" is 10 code points: 15 sentences = 150, then 9 more (159 = "了", 160 = "。").
  {
    name: 'Chinese, no spaces: cut at 159',
    body: '我今天去公园散步了。'.repeat(17),
    expected: `${'我今天去公园散步了。'.repeat(15)}我今天去公园散步了${ELLIPSIS}`,
  },
  // 159 = "，": a weak comma, removed.
  { name: 'Chinese, a full-width comma at the cut is removed', body: `${'好'.repeat(158)}，${'好'.repeat(10)}`, expected: '好'.repeat(158) + ELLIPSIS },
  // 159 = "。".
  { name: 'Japanese, an ideographic full stop at the cut is removed', body: `${'日'.repeat(158)}。${'本'.repeat(10)}`, expected: '日'.repeat(158) + ELLIPSIS },
  // "ภาษาไทย" is 7 code points: 22 words = 154, then "ภาษาไ" (155..159).
  { name: 'Thai, no spaces: cut at 159', body: 'ภาษาไทย'.repeat(25), expected: `${'ภาษาไทย'.repeat(22)}ภาษาไ${ELLIPSIS}` },

  // --- right-to-left text ---------------------------------------------------------------------
  // "א" then "שלום " x 40 (trimmed): 159 = "ו", 160 = "ם" of the 32nd word; last space at 156 -> back to it.
  {
    name: 'Hebrew: the cut goes back to the end of a word',
    body: `א${'שלום '.repeat(40)}`,
    expected: `א${'שלום '.repeat(30)}שלום${ELLIPSIS}`,
  },
  // "مرحبا، " is 7 code points: 159 = "ا", 160 = "،" (not a space); last space at 154 -> back to it,
  // and the Arabic comma before it is removed.
  {
    name: 'Arabic: the cut goes back to a space and the Arabic comma is removed',
    body: 'مرحبا، '.repeat(25),
    expected: `${'مرحبا، '.repeat(21)}مرحبا${ELLIPSIS}`,
  },
  // 156 = a space, 157..159 = "هل؟", 160 = a space: the Arabic question mark is strong and stays.
  { name: 'Arabic: a question mark at the cut stays', body: `${'ب'.repeat(155)} هل؟ نعم نعم`, expected: `${'ب'.repeat(155)} هل؟${ELLIPSIS}` },
  // 159 = "?" (160 = a space).
  { name: 'Hebrew: a question mark at the cut stays', body: `${'מ'.repeat(155)} מה? כן כן`, expected: `${'מ'.repeat(155)} מה?${ELLIPSIS}` },

  // --- emoji ----------------------------------------------------------------------------------
  // One code point, two UTF-16 units: 159 = the first emoji, never half of it.
  { name: 'an emoji of a surrogate pair at the cut', body: `${x(158)}😀😀😀`, expected: `${x(158)}😀${ELLIPSIS}` },
  { name: 'only emoji of surrogate pairs', body: '😀'.repeat(200), expected: '😀'.repeat(159) + ELLIPSIS },
  // "👨‍👩‍👧" = man, joiner, woman, joiner, girl (5 code points): 158 = man, 159 = joiner, 160 = woman.
  // The cut would split the sequence: it goes back to before the man (no space to go back to).
  { name: 'an emoji of several code points cut after a joiner is dropped whole', body: `${x(157)}👨‍👩‍👧`, expected: x(157) + ELLIPSIS },
  // 157 = man, 158 = joiner, 159 = woman, 160 = joiner: dropped whole, not cut between its people.
  { name: 'an emoji of several code points cut inside is dropped whole', body: `${x(156)}👨‍👩‍👧`, expected: x(156) + ELLIPSIS },
  // The family emoji is a word of its own (152..156); 159 = "n", 160 = "d" of "endings" -> back to the space at 157.
  { name: 'an emoji of several code points before a near space stays whole', body: `${x(150)} 👨‍👩‍👧 endings`, expected: `${x(150)} 👨‍👩‍👧${ELLIPSIS}` },

  // --- never inside a letter with its marks, an emoji or a flag --------------------------------
  // A cut without a space near falls at 159 or, when the 160th code point belongs to the same
  // character on the screen (a mark, a skin tone, the second half of a flag, what follows a joiner
  // or a Hindi virama), just before that character.
  // 159 = the first regional indicator of a flag, 160 = its second: the flag goes, not half of it.
  { name: 'a flag at the cut is dropped whole', body: `${x(158)}🇮🇱🇮🇱`, expected: x(158) + ELLIPSIS },
  // 158 / 159 = one whole flag, 160 = the first half of the next: the whole flag stays.
  { name: 'a whole flag before the cut stays', body: `${x(157)}🇮🇱🇮🇱`, expected: `${x(157)}🇮🇱${ELLIPSIS}` },
  // 159 = thumbs up, 160 = its skin tone.
  { name: 'an emoji with a skin tone at the cut is dropped whole', body: `${x(158)}👍🏽 more`, expected: x(158) + ELLIPSIS },
  // 159 = "ש", 160 = its vowel point (qamats).
  { name: 'Hebrew: a letter whose points come after the cut is dropped with them', body: `${'ש'.repeat(158)}שָׁלוֹם`, expected: 'ש'.repeat(158) + ELLIPSIS },
  // 159 = "ก", 160 = the vowel mark above it.
  { name: 'Thai: a consonant whose vowel mark comes after the cut is dropped with it', body: `${'ก'.repeat(158)}กินข้าว`, expected: 'ก'.repeat(158) + ELLIPSIS },
  // 159 = "क", 160 = the vowel sign "ी" (a spacing mark).
  { name: 'Hindi: a consonant whose vowel sign comes after the cut is dropped with it', body: `${'क'.repeat(158)}की बात`, expected: 'क'.repeat(158) + ELLIPSIS },
  // 158 = "क", 159 = the virama, 160 = "ष": the conjunct "क्ष" is dropped whole, not left as "क्".
  { name: 'Hindi: a conjunct cut after its virama is dropped whole', body: `${'क'.repeat(157)}क्ष और`, expected: 'क'.repeat(157) + ELLIPSIS },
  // One letter with 200 marks is one character on the screen: there is no better place, so the cut at
  // 159 code points stays (never empty).
  { name: 'one letter with more marks than fit is cut at 159 code points', body: `a${'\u0301'.repeat(200)}`, expected: `a${'\u0301'.repeat(158)}${ELLIPSIS}` },

  // --- punctuation at the cut -----------------------------------------------------------------
  // 159 = "," / ":" / ";" (160 = a space): weak.
  { name: 'a comma at the cut is removed', body: `${x(150)} end, of, it`, expected: `${x(150)} end, of${ELLIPSIS}` },
  { name: 'a colon at the cut is removed', body: `${x(150)} end, of: it`, expected: `${x(150)} end, of${ELLIPSIS}` },
  { name: 'a semicolon at the cut is removed', body: `${x(150)} end, of; it`, expected: `${x(150)} end, of${ELLIPSIS}` },
  // 159 = "؛" (160 = "ب", no space near).
  { name: 'an Arabic semicolon at the cut is removed', body: `${'ب'.repeat(158)}؛${'ب'.repeat(10)}`, expected: 'ب'.repeat(158) + ELLIPSIS },
  // 159 = "、" / "：" (160 = a letter, no space near).
  { name: 'an ideographic comma at the cut is removed', body: `${'日'.repeat(158)}、${'日'.repeat(10)}`, expected: '日'.repeat(158) + ELLIPSIS },
  { name: 'a full-width colon at the cut is removed', body: `${'好'.repeat(158)}：${'好'.repeat(10)}`, expected: '好'.repeat(158) + ELLIPSIS },
  // 154..158 = "λόγος", 159 = the Greek ano teleia U+0387, 160 = a space.
  { name: 'a Greek ano teleia at the cut is removed', body: `${'α'.repeat(152)} λόγος\u0387 και`, expected: `${'α'.repeat(152)} λόγος${ELLIPSIS}` },
  // 158 = "॥" (Hindi double danda), 159 = a space.
  { name: 'a Hindi double danda at the cut is removed', body: `${'क'.repeat(157)}॥ और बात`, expected: 'क'.repeat(157) + ELLIPSIS },
  // 159 = "‚" (a low quotation mark only opens), 160 = "a".
  { name: 'a low opening quotation mark at the cut is removed', body: `${x(158)}‚abc`, expected: x(158) + ELLIPSIS },
  // 159 = "「" (160 = "本").
  { name: 'an opening corner bracket at the cut is removed', body: `${'日'.repeat(158)}「本本本」`, expected: '日'.repeat(158) + ELLIPSIS },
  // 158 = a space, 159 = "›", 160 = a space: after a space it opens -> removed with the space.
  { name: 'a single guillemet after a space is removed', body: `${x(157)} › next`, expected: x(157) + ELLIPSIS },
  // 159 = "›" after a letter (160 = a space): it closes and stays.
  { name: 'a single guillemet after a letter stays', body: `${x(158)}› more`, expected: `${x(158)}›${ELLIPSIS}` },
  // 156..159 = "what", 160 = "?": the 160th code point is not a space, so by the rule the cut is inside
  // a word and goes back to the space at 155. Kept on purpose: punctuation as a word end would also cut
  // "don't", "well-known" or "בית־ספר" in half, which is what this rule is there to stop.
  { name: 'punctuation as the 160th code point does not end the word before it', body: `${x(154)} what?! more`, expected: x(154) + ELLIPSIS },
  // 159 = "." (160 = a space): a full stop is weak.
  { name: 'a full stop at the cut is removed', body: `${x(150)} end, of. it`, expected: `${x(150)} end, of${ELLIPSIS}` },
  // Back to the space at 158; "—" and the space before it are removed.
  { name: 'a dash at the cut is removed with the space before it', body: `${x(155)} — and more`, expected: x(155) + ELLIPSIS },
  // 159 = a space; then "..." is removed: one ellipsis, not four dots.
  { name: 'three dots at the cut become one ellipsis', body: `${x(150)} wait... and then`, expected: `${x(150)} wait${ELLIPSIS}` },
  // 158 = "(", 159 = '"' (after an opening bracket: an opening quotation mark): both removed.
  { name: 'an opening bracket and an opening quotation mark at the cut are removed', body: `${x(157)}("abc`, expected: x(157) + ELLIPSIS },
  // 159 = '"' after "!" (a closing quotation mark), 160 = a space: kept, and so is the "!".
  { name: 'a closing quotation mark at the cut stays', body: `${x(153)} "go!" then`, expected: `${x(153)} "go!"${ELLIPSIS}` },
  // German quotes: 153 = "„", 159 = "“" after a letter (160 = a space): there it closes the quotation and stays.
  { name: 'a German closing quotation mark at the cut stays', body: `${x(151)} „Hallo“ sagte er`, expected: `${x(151)} „Hallo“${ELLIPSIS}` },
  // 159 = ")" (160 = a space).
  { name: 'a closing bracket at the cut stays', body: `${x(154)} (ok) more`, expected: `${x(154)} (ok)${ELLIPSIS}` },
  // 159 = "¿" (160 = "Q", no space near): an opening Spanish question mark is removed.
  { name: 'an opening Spanish question mark at the cut is removed', body: `${x(158)}¿Qué`, expected: x(158) + ELLIPSIS },
  // French spacing: 158 = a space, 159 = "«", 160 = a space. A guillemet after a space opens a quotation: removed.
  { name: 'a French opening guillemet after a space is removed', body: `${x(157)} « Ça va »`, expected: x(157) + ELLIPSIS },
  // 158 = "।" (Hindi full stop), 159 = a space.
  { name: 'a Hindi full stop at the cut is removed', body: `${'क'.repeat(157)}। और बात`, expected: 'क'.repeat(157) + ELLIPSIS },
  // 159 = "!" (160 = a space): strong.
  { name: 'an exclamation mark at the cut stays', body: `${x(151)} Really! Yes`, expected: `${x(151)} Really!${ELLIPSIS}` },
  // 159 = "；" (160 = "好"): a full-width semicolon is weak.
  { name: 'a full-width semicolon at the cut is removed', body: `${'好'.repeat(158)}；好好好`, expected: '好'.repeat(158) + ELLIPSIS },

  // --- nothing but weak punctuation ------------------------------------------------------------
  // Removing would leave nothing: the cut at 159 as it is.
  { name: 'a text of full stops only', body: '.'.repeat(200), expected: '.'.repeat(159) + ELLIPSIS },
  // 159 = a space, 160 = ".": everything is weak, so the plain cut is used, without its trailing space.
  { name: 'only spaced full stops: the plain cut loses its trailing space', body: `..${' .'.repeat(100)}`, expected: `..${' .'.repeat(78)}${ELLIPSIS}` },
  // Back to the space at 131 would leave only dashes: the cut at 159 is used instead (it ends in "y").
  {
    name: 'going back to a space would leave only dashes',
    body: `${'-'.repeat(130)} ${'y'.repeat(40)}`,
    expected: `${'-'.repeat(130)} ${'y'.repeat(28)}${ELLIPSIS}`,
  },
];
