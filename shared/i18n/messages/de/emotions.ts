/**
 * de - emotions messages. Keys are prefixed 'emotions.'; see shared/i18n/index.ts for the syntax.
 *
 * 'emotions.<key>.label'   - the label shown in the UI (emotion picker, badges, exports).
 * 'emotions.<key>.aliases' - comma-separated words the search parser also resolves to the
 *                            key (synonyms, nouns). Lowercase. Inflected forms live in
 *                            shared/i18n/search/de.ts.
 */
const messages: Record<string, string> = {
  'emotions.happy.label': 'Glücklich',
  'emotions.happy.aliases': 'glück,freude,froh,fröhlich,freudig,heiter,gut gelaunt',
  'emotions.calm.label': 'Ruhig',
  'emotions.calm.aliases': 'ruhe,gelassen,gelassenheit,entspannt,friedlich,ausgeglichen',
  'emotions.sad.label': 'Traurig',
  'emotions.sad.aliases': 'traurigkeit,unglücklich,niedergeschlagen,bedrückt,betrübt,deprimiert',
  'emotions.angry.label': 'Wütend',
  'emotions.angry.aliases': 'wut,ärger,verärgert,sauer,zornig,gereizt,genervt',
  'emotions.stressed.label': 'Gestresst',
  'emotions.stressed.aliases': 'stress,angespannt,anspannung,unter druck',
  'emotions.excited.label': 'Begeistert',
  'emotions.excited.aliases': 'begeisterung,aufgeregt,gespannt,vorfreude,voller vorfreude',
  'emotions.tired.label': 'Müde',
  'emotions.tired.aliases': 'müdigkeit,erschöpft,erschöpfung,ausgelaugt,schläfrig,kaputt',
  'emotions.satisfied.label': 'Zufrieden',
  'emotions.satisfied.aliases': 'zufriedenheit,erfüllt,befriedigt',
  'emotions.frustrated.label': 'Frustriert',
  'emotions.frustrated.aliases': 'frust,frustration',
  'emotions.anxious.label': 'Ängstlich',
  'emotions.anxious.aliases': 'angst,besorgt,sorge,sorgen,nervös,unruhig,beunruhigt',
  'emotions.energetic.label': 'Energiegeladen',
  'emotions.energetic.aliases': 'voller energie,schwungvoll,tatkräftig,lebhaft',
  'emotions.grateful.label': 'Dankbar',
  'emotions.grateful.aliases': 'dankbarkeit',
  'emotions.lonely.label': 'Einsam',
  'emotions.lonely.aliases': 'einsamkeit,allein,isoliert',
  'emotions.hopeful.label': 'Hoffnungsvoll',
  'emotions.hopeful.aliases': 'hoffnung,zuversichtlich,zuversicht,optimistisch,optimismus',
  'emotions.bored.label': 'Gelangweilt',
  'emotions.bored.aliases': 'langeweile,langweilig',
  'emotions.proud.label': 'Stolz',
  'emotions.proud.aliases': 'stolz auf mich',
  'emotions.focused.label': 'Konzentriert',
  'emotions.focused.aliases': 'konzentration,fokussiert,fokus',
  'emotions.overwhelmed.label': 'Überfordert',
  'emotions.overwhelmed.aliases': 'überforderung,überwältigt,überlastet',
};
export default messages;
