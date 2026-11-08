/**
 * es - emotions messages. Keys are prefixed 'emotions.'; see shared/i18n/index.ts for the syntax.
 *
 * 'emotions.<key>.label'   - the label shown in the UI (emotion picker, badges, exports).
 *                            Spanish labels are nouns ('Alegría', 'Cansancio') so they never
 *                            assume the user's gender; the adjectives go into the aliases.
 * 'emotions.<key>.aliases' - comma-separated words the search parser also resolves to the
 *                            key (masculine/feminine and plural forms, nouns, synonyms). Lowercase.
 */
const messages: Record<string, string> = {
  'emotions.happy.label': 'Alegría',
  'emotions.happy.aliases': 'feliz,felices,felicidad,alegre,alegres,contento,contenta,contentos,contentas,dichoso,dichosa',
  'emotions.calm.label': 'Calma',
  'emotions.calm.aliases': 'tranquilo,tranquila,tranquilidad,relajado,relajada,sereno,serena,serenidad,en paz',
  'emotions.sad.label': 'Tristeza',
  'emotions.sad.aliases': 'triste,tristes,desanimado,desanimada,decaído,decaída,abatido,abatida,melancolía',
  'emotions.angry.label': 'Enfado',
  'emotions.angry.aliases': 'enfadado,enfadada,enojo,enojado,enojada,ira,rabia,furioso,furiosa,irritado,irritada,molesto,molesta',
  'emotions.stressed.label': 'Estrés',
  'emotions.stressed.aliases': 'estresado,estresada,estresados,estresadas,tenso,tensa,presionado,presionada,bajo presión',
  'emotions.excited.label': 'Entusiasmo',
  'emotions.excited.aliases': 'entusiasmado,entusiasmada,ilusionado,ilusionada,ilusión,emocionado,emocionada',
  'emotions.tired.label': 'Cansancio',
  'emotions.tired.aliases': 'cansado,cansada,cansados,cansadas,agotado,agotada,agotamiento,fatiga,fatigado,fatigada,exhausto,exhausta',
  'emotions.satisfied.label': 'Satisfacción',
  'emotions.satisfied.aliases': 'satisfecho,satisfecha,realizado,realizada,complacido,complacida',
  'emotions.frustrated.label': 'Frustración',
  'emotions.frustrated.aliases': 'frustrado,frustrada,frustrados,frustradas',
  'emotions.anxious.label': 'Ansiedad',
  'emotions.anxious.aliases': 'ansioso,ansiosa,preocupado,preocupada,preocupación,nervioso,nerviosa,nervios,inquieto,inquieta',
  'emotions.energetic.label': 'Vitalidad',
  'emotions.energetic.aliases': 'enérgico,enérgica,lleno de energía,llena de energía,con mucha energía,vital,activo,activa',
  'emotions.grateful.label': 'Gratitud',
  'emotions.grateful.aliases': 'agradecido,agradecida,agradecimiento',
  'emotions.lonely.label': 'Soledad',
  'emotions.lonely.aliases': 'solo,sola,aislado,aislada,aislamiento',
  'emotions.hopeful.label': 'Esperanza',
  'emotions.hopeful.aliases': 'esperanzado,esperanzada,optimista,optimismo,con esperanza',
  'emotions.bored.label': 'Aburrimiento',
  'emotions.bored.aliases': 'aburrido,aburrida,hastío',
  'emotions.proud.label': 'Orgullo',
  'emotions.proud.aliases': 'orgulloso,orgullosa',
  'emotions.focused.label': 'Concentración',
  'emotions.focused.aliases': 'concentrado,concentrada,centrado,centrada,enfocado,enfocada',
  'emotions.overwhelmed.label': 'Agobio',
  'emotions.overwhelmed.aliases': 'agobiado,agobiada,desbordado,desbordada,abrumado,abrumada,saturado,saturada',
};
export default messages;
