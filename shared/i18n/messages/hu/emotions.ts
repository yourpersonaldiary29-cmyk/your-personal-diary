/**
 * hu - emotions messages. Keys are prefixed 'emotions.'; see shared/i18n/index.ts for the syntax.
 *
 * Labels are adjectives (Hungarian has no grammatical gender); aliases add the noun forms and
 * common synonyms. The search table (shared/i18n/search/hu.ts) adds the suffixed forms
 * ("fáradt voltam", "boldogok").
 */
const messages: Record<string, string> = {
  'emotions.happy.label': 'Boldog',
  'emotions.happy.aliases': 'boldogság,vidám,vidámság,örömteli,öröm,jókedvű,jókedv',
  'emotions.calm.label': 'Nyugodt',
  'emotions.calm.aliases': 'nyugalom,ellazult,békés,kiegyensúlyozott,higgadt',
  'emotions.sad.label': 'Szomorú',
  'emotions.sad.aliases': 'szomorúság,boldogtalan,lehangolt,levert,bánatos,rosszkedvű',
  'emotions.angry.label': 'Dühös',
  'emotions.angry.aliases': 'düh,harag,mérges,bosszús,ingerült,felbosszantott',
  'emotions.stressed.label': 'Stresszes',
  'emotions.stressed.aliases': 'stresszelt,feszült,feszültség,nyomás alatt',
  'emotions.excited.label': 'Izgatott',
  'emotions.excited.aliases': 'izgatottság,lelkes,lelkesedés,izgalom',
  'emotions.tired.label': 'Fáradt',
  'emotions.tired.aliases': 'fáradtság,kimerült,kimerültség,álmos,elcsigázott',
  'emotions.satisfied.label': 'Elégedett',
  'emotions.satisfied.aliases': 'elégedettség,megelégedett,kiteljesedett',
  'emotions.frustrated.label': 'Frusztrált',
  'emotions.frustrated.aliases': 'frusztráció,csalódott,csalódottság',
  'emotions.anxious.label': 'Szorongó',
  'emotions.anxious.aliases': 'szorongás,aggódó,aggodalom,nyugtalan,ideges,félelem',
  'emotions.energetic.label': 'Energikus',
  'emotions.energetic.aliases': 'tele energiával,energiával teli,lendületes,élénk',
  'emotions.grateful.label': 'Hálás',
  'emotions.grateful.aliases': 'hála',
  'emotions.lonely.label': 'Magányos',
  'emotions.lonely.aliases': 'magány,egyedül,elszigetelt',
  'emotions.hopeful.label': 'Reménykedő',
  'emotions.hopeful.aliases': 'remény,reményteli,bizakodó,optimista,optimizmus',
  'emotions.bored.label': 'Unott',
  'emotions.bored.aliases': 'unalom,unatkozó,unatkoztam',
  'emotions.proud.label': 'Büszke',
  'emotions.proud.aliases': 'büszkeség',
  'emotions.focused.label': 'Koncentrált',
  'emotions.focused.aliases': 'koncentráció,fókuszált,fókusz,összpontosító',
  'emotions.overwhelmed.label': 'Túlterhelt',
  'emotions.overwhelmed.aliases': 'túlterheltség,agyonhajszolt,elárasztott',
};
export default messages;
