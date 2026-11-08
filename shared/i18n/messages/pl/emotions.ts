/**
 * pl - emotions messages. Keys are prefixed 'emotions.'; see shared/i18n/index.ts for the syntax.
 *
 * 'emotions.<key>.label'   - the label shown in the UI (emotion picker, badges, exports).
 *                            Polish labels are nouns (Radość, Spokój ...), so they never need
 *                            a masculine / feminine form of the user.
 * 'emotions.<key>.aliases' - comma-separated words the search parser also resolves to the
 *                            key (synonyms, masculine and feminine adjectives, noun cases). Lowercase.
 */
const messages: Record<string, string> = {
  'emotions.happy.label': 'Radość',
  'emotions.happy.aliases': 'radości,radosny,radosna,szczęście,szczęśliwy,szczęśliwa,wesoły,wesoła,uradowany,uradowana',
  'emotions.calm.label': 'Spokój',
  'emotions.calm.aliases': 'spokoju,spokojny,spokojna,zrelaksowany,zrelaksowana,relaks,wyciszony,wyciszona,opanowany,opanowana',
  'emotions.sad.label': 'Smutek',
  'emotions.sad.aliases': 'smutku,smutny,smutna,przygnębiony,przygnębiona,przygnębienie,przybity,przybita,zdołowany,zdołowana',
  'emotions.angry.label': 'Złość',
  'emotions.angry.aliases': 'złości,gniew,zdenerwowany,zdenerwowana,wściekły,wściekła,wkurzony,wkurzona,poirytowany,poirytowana,irytacja',
  'emotions.stressed.label': 'Stres',
  'emotions.stressed.aliases': 'zestresowany,zestresowana,spięty,spięta,pod presją,presja',
  'emotions.excited.label': 'Ekscytacja',
  'emotions.excited.aliases': 'podekscytowany,podekscytowana,entuzjazm,przejęty,przejęta',
  'emotions.tired.label': 'Zmęczenie',
  'emotions.tired.aliases': 'zmęczony,zmęczona,wyczerpany,wyczerpana,wyczerpanie,wykończony,wykończona,senny,senna,śpiący,śpiąca',
  'emotions.satisfied.label': 'Zadowolenie',
  'emotions.satisfied.aliases': 'zadowolony,zadowolona,satysfakcja,usatysfakcjonowany,usatysfakcjonowana,spełniony,spełniona',
  'emotions.frustrated.label': 'Frustracja',
  'emotions.frustrated.aliases': 'frustracji,sfrustrowany,sfrustrowana',
  'emotions.anxious.label': 'Niepokój',
  'emotions.anxious.aliases': 'niepokoju,zaniepokojony,zaniepokojona,niespokojny,niespokojna,lęk,zmartwiony,zmartwiona,zmartwienie,nerwowy,nerwowa,obawa',
  'emotions.energetic.label': 'Przypływ energii',
  'emotions.energetic.aliases': 'pełen energii,pełna energii,energiczny,energiczna,wigor,żwawy,żwawa',
  'emotions.grateful.label': 'Wdzięczność',
  'emotions.grateful.aliases': 'wdzięczny,wdzięczna',
  'emotions.lonely.label': 'Samotność',
  'emotions.lonely.aliases': 'samotny,samotna,osamotniony,osamotniona,odizolowany,odizolowana',
  'emotions.hopeful.label': 'Nadzieja',
  'emotions.hopeful.aliases': 'nadziei,pełen nadziei,pełna nadziei,optymizm,optymistyczny,optymistyczna',
  'emotions.bored.label': 'Nuda',
  'emotions.bored.aliases': 'nudy,znudzony,znudzona,nudno',
  'emotions.proud.label': 'Duma',
  'emotions.proud.aliases': 'dumny,dumna,dumy',
  'emotions.focused.label': 'Skupienie',
  'emotions.focused.aliases': 'skupiony,skupiona,skoncentrowany,skoncentrowana,koncentracja',
  'emotions.overwhelmed.label': 'Przytłoczenie',
  'emotions.overwhelmed.aliases': 'przytłoczony,przytłoczona,przeciążony,przeciążona,zawalony,zawalona',
};
export default messages;
