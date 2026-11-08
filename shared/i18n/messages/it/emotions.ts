/**
 * it - emotions messages. Keys are prefixed 'emotions.'; see shared/i18n/index.ts for the syntax.
 *
 * 'emotions.<key>.label'   - the label shown in the UI (emotion picker, badges, exports).
 *                            Italian labels are NOUNS (Gioia, Stanchezza...) so they never force a
 *                            grammatical gender on the person writing.
 * 'emotions.<key>.aliases' - comma-separated words the search parser also resolves to the
 *                            key: the adjectives in all four forms (masc./fem., sing./plur.),
 *                            nouns and synonyms. Lowercase, no apostrophes.
 */
const messages: Record<string, string> = {
  'emotions.happy.label': 'Gioia',
  'emotions.happy.aliases': 'felice,felici,felicità,contento,contenta,contenti,contente,allegro,allegra,allegri,allegre,gioioso,gioiosa,gioiosi,gioiose,lieto,lieta,lieti,liete',
  'emotions.calm.label': 'Calma',
  'emotions.calm.aliases': 'calmo,calmi,calme,rilassato,rilassata,rilassati,rilassate,sereno,serena,sereni,serene,serenità,tranquillo,tranquilla,tranquilli,tranquille,in pace',
  'emotions.sad.label': 'Tristezza',
  'emotions.sad.aliases': 'triste,tristi,infelice,infelici,giù di morale,depresso,depressa,depressi,depresse,abbattuto,abbattuta,malinconico,malinconica,malinconia',
  'emotions.angry.label': 'Rabbia',
  'emotions.angry.aliases': 'arrabbiato,arrabbiata,arrabbiati,arrabbiate,furioso,furiosa,furiosi,furiose,irritato,irritata,irritati,irritate,infastidito,infastidita,nervoso,nervosa,nervosi,nervose,collera',
  'emotions.stressed.label': 'Stress',
  'emotions.stressed.aliases': 'stressato,stressata,stressati,stressate,teso,tesa,sotto pressione',
  'emotions.excited.label': 'Entusiasmo',
  'emotions.excited.aliases': 'entusiasta,entusiasti,entusiaste,emozionato,emozionata,emozionati,emozionate,eccitato,eccitata,elettrizzato,elettrizzata,euforico,euforica',
  'emotions.tired.label': 'Stanchezza',
  'emotions.tired.aliases': 'stanco,stanca,stanchi,stanche,esausto,esausta,esausti,esauste,sfinito,sfinita,sfiniti,sfinite,spossato,spossata,stremato,stremata,assonnato,assonnata,spossatezza',
  'emotions.satisfied.label': 'Soddisfazione',
  'emotions.satisfied.aliases': 'soddisfatto,soddisfatta,soddisfatti,soddisfatte,appagato,appagata,appagati,appagate,realizzato,realizzata',
  'emotions.frustrated.label': 'Frustrazione',
  'emotions.frustrated.aliases': 'frustrato,frustrata,frustrati,frustrate,frustrante',
  'emotions.anxious.label': 'Ansia',
  'emotions.anxious.aliases': 'ansioso,ansiosa,ansiosi,ansiose,preoccupato,preoccupata,preoccupati,preoccupate,preoccupazione,agitato,agitata,agitati,agitate,inquieto,inquieta,angoscia,angosciato,angosciata',
  'emotions.energetic.label': 'Vitalità',
  'emotions.energetic.aliases': 'energico,energica,energici,energiche,pieno di energia,piena di energia,pieni di energia,piene di energia,vivace,vivaci,dinamico,dinamica',
  'emotions.grateful.label': 'Gratitudine',
  'emotions.grateful.aliases': 'grato,grata,grati,grate,riconoscente,riconoscenti,riconoscenza',
  'emotions.lonely.label': 'Solitudine',
  'emotions.lonely.aliases': 'solo,sola,soli,solitario,solitaria,isolato,isolata,isolati,isolate',
  'emotions.hopeful.label': 'Speranza',
  'emotions.hopeful.aliases': 'speranzoso,speranzosa,fiducioso,fiduciosa,fiduciosi,fiduciose,ottimista,ottimisti,ottimiste,ottimismo,pieno di speranza,piena di speranza',
  'emotions.bored.label': 'Noia',
  'emotions.bored.aliases': 'annoiato,annoiata,annoiati,annoiate,noioso,noiosa',
  'emotions.proud.label': 'Orgoglio',
  'emotions.proud.aliases': 'orgoglioso,orgogliosa,orgogliosi,orgogliose,fiero,fiera,fieri,fiere,fierezza',
  'emotions.focused.label': 'Concentrazione',
  'emotions.focused.aliases': 'concentrato,concentrata,concentrati,concentrate,attento,attenta,focalizzato,focalizzata',
  'emotions.overwhelmed.label': 'Sovraccarico',
  'emotions.overwhelmed.aliases': 'sovraccarica,sovraccarichi,sovraccariche,sopraffatto,sopraffatta,sopraffatti,sopraffatte,sommerso,sommersa,travolto,travolta,oberato,oberata',
};
export default messages;
