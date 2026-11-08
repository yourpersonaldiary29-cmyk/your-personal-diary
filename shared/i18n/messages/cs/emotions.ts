/**
 * cs - emotions messages. Keys are prefixed 'emotions.'; see shared/i18n/index.ts for the syntax.
 *
 * Labels are nouns ("Radost", "Únava") so they need no gender and read well in lists and
 * sentences. Aliases add the masculine and feminine adjectives a user would write about
 * themself ("unavený", "unavená") and common noun forms; the search table (shared/i18n/search/cs.ts)
 * adds further inflected forms.
 */
const messages: Record<string, string> = {
  'emotions.happy.label': 'Radost',
  'emotions.happy.aliases': 'šťastný,šťastná,štěstí,radostný,radostná,veselý,veselá,veselost',
  'emotions.calm.label': 'Klid',
  'emotions.calm.aliases': 'klidný,klidná,v klidu,uvolněný,uvolněná,v pohodě,pohoda,vyrovnaný,vyrovnaná',
  'emotions.sad.label': 'Smutek',
  'emotions.sad.aliases': 'smutný,smutná,nešťastný,nešťastná,sklíčený,sklíčená,skleslý,skleslá',
  'emotions.angry.label': 'Vztek',
  'emotions.angry.aliases': 'naštvaný,naštvaná,rozzlobený,rozzlobená,vzteklý,vzteklá,hněv,zlost,podrážděný,podrážděná',
  'emotions.stressed.label': 'Stres',
  'emotions.stressed.aliases': 've stresu,vystresovaný,vystresovaná,napětí,napjatý,napjatá,pod tlakem',
  'emotions.excited.label': 'Nadšení',
  'emotions.excited.aliases': 'nadšený,nadšená,natěšený,natěšená,vzrušení',
  'emotions.tired.label': 'Únava',
  'emotions.tired.aliases': 'unavený,unavená,vyčerpaný,vyčerpaná,vyčerpání,ospalý,ospalá,utahaný,utahaná',
  'emotions.satisfied.label': 'Spokojenost',
  'emotions.satisfied.aliases': 'spokojený,spokojená,naplnění,naplněný,naplněná',
  'emotions.frustrated.label': 'Frustrace',
  'emotions.frustrated.aliases': 'frustrovaný,frustrovaná,zklamání,zklamaný,zklamaná',
  'emotions.anxious.label': 'Úzkost',
  'emotions.anxious.aliases': 'úzkostný,úzkostná,ustaraný,ustaraná,obavy,nervózní,nervozita,strach,neklid',
  'emotions.energetic.label': 'Elán',
  'emotions.energetic.aliases': 'plný energie,plná energie,energický,energická,svěží,čilý,čilá',
  'emotions.grateful.label': 'Vděčnost',
  'emotions.grateful.aliases': 'vděčný,vděčná',
  'emotions.lonely.label': 'Osamělost',
  'emotions.lonely.aliases': 'osamělý,osamělá,samota,opuštěný,opuštěná',
  'emotions.hopeful.label': 'Naděje',
  'emotions.hopeful.aliases': 'nadějný,nadějná,plný naděje,plná naděje,optimismus,optimistický,optimistická',
  'emotions.bored.label': 'Nuda',
  'emotions.bored.aliases': 'znuděný,znuděná,nudný,nudná',
  'emotions.proud.label': 'Hrdost',
  'emotions.proud.aliases': 'hrdý,hrdá,pyšný,pyšná',
  'emotions.focused.label': 'Soustředění',
  'emotions.focused.aliases': 'soustředěný,soustředěná,koncentrace,koncentrovaný,koncentrovaná',
  'emotions.overwhelmed.label': 'Zahlcení',
  'emotions.overwhelmed.aliases': 'zahlcený,zahlcená,přetížený,přetížená,přetížení',
};
export default messages;
