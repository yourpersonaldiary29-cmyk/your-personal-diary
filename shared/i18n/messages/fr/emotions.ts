/**
 * fr - emotions messages. Keys are prefixed 'emotions.'; see shared/i18n/index.ts for the syntax.
 *
 * 'emotions.<key>.label'   - the label shown in the UI (emotion picker, badges, exports).
 *                            French labels are NOUNS (Joie, Fatigue...) so they never force a
 *                            grammatical gender on the person writing.
 * 'emotions.<key>.aliases' - comma-separated words the search parser also resolves to the
 *                            key: the adjectives in all four forms (masc./fem., sing./plur.),
 *                            nouns and synonyms. Lowercase, no apostrophes (the parser joins
 *                            elided words: "plein d'énergie" -> "plein dénergie", see search/fr.ts).
 */
const messages: Record<string, string> = {
  'emotions.happy.label': 'Joie',
  'emotions.happy.aliases': 'heureux,heureuse,heureuses,bonheur,joyeux,joyeuse,joyeuses,content,contente,contents,contentes,ravi,ravie,ravis,ravies,gai,gaie,gaies,enjoué,enjouée',
  'emotions.calm.label': 'Calme',
  'emotions.calm.aliases': 'calmes,détendu,détendue,détendus,détendues,serein,sereine,sereins,sereines,sérénité,apaisé,apaisée,apaisés,apaisées,paisible,paisibles,tranquille,tranquilles,zen',
  'emotions.sad.label': 'Tristesse',
  'emotions.sad.aliases': 'triste,tristes,malheureux,malheureuse,malheureuses,déprimé,déprimée,déprimés,déprimées,abattu,abattue,morose,mélancolique,cafard',
  'emotions.angry.label': 'Colère',
  'emotions.angry.aliases': 'en colère,fâché,fâchée,fâchés,fâchées,furieux,furieuse,furieuses,énervé,énervée,énervés,énervées,irrité,irritée,irrités,irritées,agacé,agacée,agacés,agacées',
  'emotions.stressed.label': 'Stress',
  'emotions.stressed.aliases': 'stressé,stressée,stressés,stressées,tendu,tendue,tendus,tendues,sous pression,sous tension',
  'emotions.excited.label': 'Enthousiasme',
  'emotions.excited.aliases': 'enthousiaste,enthousiastes,excité,excitée,excités,excitées,exalté,exaltée,emballé,emballée,impatient,impatiente,excitation',
  'emotions.tired.label': 'Fatigue',
  'emotions.tired.aliases': 'fatigué,fatiguée,fatigués,fatiguées,épuisé,épuisée,épuisés,épuisées,épuisement,crevé,crevée,crevés,crevées,vidé,vidée,las,lasse,lasses,somnolent,somnolente',
  'emotions.satisfied.label': 'Satisfaction',
  'emotions.satisfied.aliases': 'satisfait,satisfaite,satisfaits,satisfaites,comblé,comblée,comblés,comblées,épanoui,épanouie,épanouis,épanouies',
  'emotions.frustrated.label': 'Frustration',
  'emotions.frustrated.aliases': 'frustré,frustrée,frustrés,frustrées,frustrant,frustrante',
  'emotions.anxious.label': 'Anxiété',
  'emotions.anxious.aliases': 'anxieux,anxieuse,anxieuses,angoisse,angoissé,angoissée,angoissés,angoissées,inquiet,inquiète,inquiets,inquiètes,inquiétude,nerveux,nerveuse,nerveuses,soucieux,soucieuse',
  'emotions.energetic.label': 'Dynamisme',
  'emotions.energetic.aliases': 'dynamique,dynamiques,énergique,énergiques,en forme,vitalité,plein dénergie,pleine dénergie,pleins dénergie,pleines dénergie',
  'emotions.grateful.label': 'Gratitude',
  'emotions.grateful.aliases': 'reconnaissant,reconnaissante,reconnaissants,reconnaissantes,reconnaissance',
  'emotions.lonely.label': 'Solitude',
  'emotions.lonely.aliases': 'seul,seule,seuls,seules,isolé,isolée,isolés,isolées,esseulé,esseulée',
  'emotions.hopeful.label': 'Espoir',
  'emotions.hopeful.aliases': 'optimiste,optimistes,optimisme,confiant,confiante,confiants,confiantes,plein despoir,pleine despoir,espérance',
  'emotions.bored.label': 'Ennui',
  'emotions.bored.aliases': 'ennuyé,ennuyée,ennuyés,ennuyées,désœuvré,désœuvrée,lassitude',
  'emotions.proud.label': 'Fierté',
  'emotions.proud.aliases': 'fier,fière,fiers,fières',
  'emotions.focused.label': 'Concentration',
  'emotions.focused.aliases': 'concentré,concentrée,concentrés,concentrées,focalisé,focalisée,attentif,attentive',
  'emotions.overwhelmed.label': 'Surcharge',
  'emotions.overwhelmed.aliases': 'débordé,débordée,débordés,débordées,submergé,submergée,submergés,submergées,dépassé,dépassée,dépassés,dépassées,surchargé,surchargée,accablé,accablée,surmené,surmenée',
};
export default messages;
