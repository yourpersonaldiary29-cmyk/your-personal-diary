/**
 * pt - emotions messages. Keys are prefixed 'emotions.'; see shared/i18n/index.ts for the syntax.
 *
 * 'emotions.<key>.label'   - the label shown in the UI (emotion picker, badges, exports).
 *                            Portuguese labels are nouns ('Alegria', 'Cansaço') so they never
 *                            assume the user's gender; the adjectives go into the aliases.
 * 'emotions.<key>.aliases' - comma-separated words the search parser also resolves to the
 *                            key (masculine/feminine and plural forms, nouns, synonyms). Lowercase.
 */
const messages: Record<string, string> = {
  'emotions.happy.label': 'Alegria',
  'emotions.happy.aliases': 'feliz,felizes,felicidade,alegre,alegres,contente,contentes',
  'emotions.calm.label': 'Calma',
  'emotions.calm.aliases': 'calmo,tranquilo,tranquila,tranquilidade,relaxado,relaxada,sereno,serena,serenidade,em paz',
  'emotions.sad.label': 'Tristeza',
  'emotions.sad.aliases': 'triste,tristes,desanimado,desanimada,em baixo,abatido,abatida,melancolia',
  'emotions.angry.label': 'Raiva',
  'emotions.angry.aliases': 'zangado,zangada,zanga,irritado,irritada,irritação,furioso,furiosa,fúria,chateado,chateada',
  'emotions.stressed.label': 'Stress',
  'emotions.stressed.aliases': 'stressado,stressada,stressados,stressadas,tenso,tensa,pressionado,pressionada,sob pressão',
  'emotions.excited.label': 'Entusiasmo',
  'emotions.excited.aliases': 'entusiasmado,entusiasmada,empolgado,empolgada,animado,animada',
  'emotions.tired.label': 'Cansaço',
  'emotions.tired.aliases': 'cansado,cansada,cansados,cansadas,exausto,exausta,exaustão,esgotado,esgotada,fadiga',
  'emotions.satisfied.label': 'Satisfação',
  'emotions.satisfied.aliases': 'satisfeito,satisfeita,realizado,realizada',
  'emotions.frustrated.label': 'Frustração',
  'emotions.frustrated.aliases': 'frustrado,frustrada,frustrados,frustradas',
  'emotions.anxious.label': 'Ansiedade',
  'emotions.anxious.aliases': 'ansioso,ansiosa,preocupado,preocupada,preocupação,nervoso,nervosa,nervosismo,inquieto,inquieta',
  'emotions.energetic.label': 'Vitalidade',
  'emotions.energetic.aliases': 'enérgico,enérgica,cheio de energia,cheia de energia,com muita energia,ativo,ativa',
  'emotions.grateful.label': 'Gratidão',
  'emotions.grateful.aliases': 'grato,grata,agradecido,agradecida',
  'emotions.lonely.label': 'Solidão',
  'emotions.lonely.aliases': 'sozinho,sozinha,solitário,solitária,isolado,isolada,isolamento',
  'emotions.hopeful.label': 'Esperança',
  'emotions.hopeful.aliases': 'esperançoso,esperançosa,otimista,otimismo,com esperança',
  'emotions.bored.label': 'Tédio',
  'emotions.bored.aliases': 'aborrecido,aborrecida,aborrecimento,entediado,entediada',
  'emotions.proud.label': 'Orgulho',
  'emotions.proud.aliases': 'orgulhoso,orgulhosa',
  'emotions.focused.label': 'Concentração',
  'emotions.focused.aliases': 'concentrado,concentrada,focado,focada,foco',
  'emotions.overwhelmed.label': 'Sobrecarga',
  'emotions.overwhelmed.aliases': 'sobrecarregado,sobrecarregada,assoberbado,assoberbada,sufocado,sufocada',
};
export default messages;
