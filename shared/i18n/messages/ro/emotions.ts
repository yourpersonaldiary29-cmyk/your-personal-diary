/**
 * ro - emotions messages. Keys are prefixed 'emotions.'; see shared/i18n/index.ts for the syntax.
 *
 * 'emotions.<key>.label'   - the label shown in the UI (emotion picker, badges, exports).
 *                            Romanian labels are nouns, so they never assume the user's gender.
 * 'emotions.<key>.aliases' - comma-separated words the search parser also resolves to the
 *                            key: the adjective in both genders, synonyms. Lowercase.
 *                            Spellings without diacritics live in shared/i18n/search/ro.ts.
 */
const messages: Record<string, string> = {
  'emotions.happy.label': 'Fericire',
  'emotions.happy.aliases': 'fericit,fericită,bucurie,bucuros,bucuroasă,vesel,veselă,voios,voioasă',
  'emotions.calm.label': 'Calm',
  'emotions.calm.aliases': 'calmă,liniște,liniștit,liniștită,relaxat,relaxată,senin,senină,împăcat,împăcată',
  'emotions.sad.label': 'Tristețe',
  'emotions.sad.aliases': 'trist,tristă,abătut,abătută,necăjit,necăjită,deprimat,deprimată',
  'emotions.angry.label': 'Furie',
  'emotions.angry.aliases': 'furios,furioasă,supărat,supărată,nervos,nervoasă,iritat,iritată,enervat,enervată,mânie',
  'emotions.stressed.label': 'Stres',
  'emotions.stressed.aliases': 'stresat,stresată,tensionat,tensionată,încordat,încordată,sub presiune',
  'emotions.excited.label': 'Entuziasm',
  'emotions.excited.aliases': 'entuziasmat,entuziasmată,încântat,încântată,nerăbdător,nerăbdătoare',
  'emotions.tired.label': 'Oboseală',
  'emotions.tired.aliases': 'obosit,obosită,epuizat,epuizată,epuizare,extenuat,extenuată,somnoros,somnoroasă,sleit,sleită',
  'emotions.satisfied.label': 'Mulțumire',
  'emotions.satisfied.aliases': 'mulțumit,mulțumită,satisfacție,satisfăcut,satisfăcută,împlinit,împlinită',
  'emotions.frustrated.label': 'Frustrare',
  'emotions.frustrated.aliases': 'frustrat,frustrată',
  'emotions.anxious.label': 'Anxietate',
  'emotions.anxious.aliases': 'anxios,anxioasă,îngrijorat,îngrijorată,îngrijorare,neliniștit,neliniștită,neliniște,teamă',
  'emotions.energetic.label': 'Vitalitate',
  'emotions.energetic.aliases': 'energic,energică,plin de energie,plină de energie,vioi,vioaie,dinamic,dinamică',
  'emotions.grateful.label': 'Recunoștință',
  'emotions.grateful.aliases': 'recunoscător,recunoscătoare,gratitudine',
  'emotions.lonely.label': 'Singurătate',
  'emotions.lonely.aliases': 'singur,singură,izolat,izolată,însingurat,însingurată',
  'emotions.hopeful.label': 'Speranță',
  'emotions.hopeful.aliases': 'plin de speranță,plină de speranță,optimist,optimistă,optimism,încrezător,încrezătoare',
  'emotions.bored.label': 'Plictiseală',
  'emotions.bored.aliases': 'plictisit,plictisită,plictis',
  'emotions.proud.label': 'Mândrie',
  'emotions.proud.aliases': 'mândru,mândră',
  'emotions.focused.label': 'Concentrare',
  'emotions.focused.aliases': 'concentrat,concentrată,focusat,focusată,atent,atentă',
  'emotions.overwhelmed.label': 'Copleșire',
  'emotions.overwhelmed.aliases': 'copleșit,copleșită,depășit,depășită,suprasolicitat,suprasolicitată,împovărat,împovărată',
};
export default messages;
