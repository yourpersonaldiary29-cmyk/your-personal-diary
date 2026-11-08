/**
 * pt - demo texts ("Load sample data"). Same fields and pool sizes as en.ts (see README.md).
 *
 * European Portuguese, like the app's own messages ("ecrã", "equipa"). Nothing genders the writer
 * ("leve" and "feliz" have one form).
 */
import type { SeedContent } from './types';

/**
 * In European Portuguese a first name inside a sentence takes the article ("Estive com a Marta e o João."),
 * and one says "a minha mãe" / "o meu pai". The chips stay bare ("Marta", "Mãe"); a name that is not in
 * this table is used as it is.
 */
const IN_SENTENCE: Record<string, string> = {
  Marta: 'a Marta',
  João: 'o João',
  Mãe: 'a minha mãe',
  Pai: 'o meu pai',
  Inês: 'a Inês',
  Beatriz: 'a Beatriz',
  Tiago: 'o Tiago',
  Sofia: 'a Sofia',
  Miguel: 'o Miguel',
  Catarina: 'a Catarina',
};

/** "a A", "a A e o B". */
function joinNames(names: string[]): string {
  const words = names.map((name) => IN_SENTENCE[name] ?? name);
  if (words.length <= 1) return words.join('');
  return `${words.slice(0, -1).join(', ')} e ${words[words.length - 1]}`;
}

const content: SeedContent = {
  titles: {
    high: ['Uma manhã maravilhosa', 'Um dia cheio de energia', 'Um dia mesmo bom', 'Finalmente, um bom descanso', 'Um dia de pequenas vitórias', 'Sol e ar fresco'],
    mid: ['Um dia normal', 'Um dia de trabalho', 'Recados e rotina', 'Mais um dia que passou', 'Um dia ao meu ritmo', 'Uma rotina agradável'],
    // "cansaço" is the word of search example 2 (also in openers.low).
    low: ['Um dia difícil', 'Um cansaço profundo', 'Hoje não foi fácil', 'Um dia esgotante', 'A cabeça pesada', 'Só queria que o dia acabasse'],
  },
  openers: {
    high: ['Hoje senti-me mesmo bem.', 'Acordei a sorrir e o dia continuou assim.', 'Foi um dia cheio de boa energia.', 'Senti-me leve e feliz.'],
    mid: ['Um dia normal, sem surpresas.', 'Passei o dia ao meu ritmo.', 'Nada de especial, mas correu bem.', 'Um dia de rotina, entre trabalho e recados.'],
    low: ['Tive um dia difícil.', 'Senti peso e cansaço durante quase todo o dia.', 'Não consegui concentrar-me em nada.', 'O dia começou com o pé esquerdo.'],
  },
  events: [
    'Reunião de trabalho',
    'Jantar em família',
    'Ida ao médico',
    'Compras no supermercado',
    'Telefonema com um velho amigo',
    'Tratar de assuntos no banco',
    'Uma palestra interessante',
    'Dia de teletrabalho',
    'Um pequeno passeio',
    'Limpeza da casa',
    'Encontro com amigos',
    'Aula no ginásio',
    'Noite de cinema',
    'Cozinhar um prato novo',
  ],
  sundayEvents: ['Planear a semana', 'Reunião semanal da equipa', 'Montes de e-mails por responder'],
  people: ['Marta', 'João', 'Mãe', 'Pai', 'Inês', 'Beatriz', 'Tiago', 'Sofia', 'Miguel', 'Catarina'],
  locations: ['Casa', 'Escritório', 'Parque', 'Café', 'Casa dos meus pais', 'Praia', 'Biblioteca'],
  tags: ['trabalho', 'família', 'saúde', 'amigos', 'desporto', 'estudos', 'descanso', 'natureza', 'criatividade', 'dinheiro'],
  sportTag: 'desporto',
  // Nouns that fit after "minutos de".
  exerciseTypes: ['caminhada', 'corrida', 'treino de força', 'natação', 'ciclismo', 'ioga'],
  badDay: {
    title: 'Um dia terrível',
    body: 'Um dia terrível. Correu tudo mal: levantei-me tarde, faltei a uma reunião importante e discuti com um amigo próximo. Senti que era tudo demasiado e não sabia por onde começar.',
  },
  goodDay: {
    title: 'Um dia perfeito',
    body: 'Um dia perfeito! Recebi uma boa notícia no trabalho, à noite festejámos com toda a família e senti gratidão por tudo.',
  },
  sleep: (hours, low) => (low ? `Esta noite dormi só ${hours} horas e notou-se.` : `Dormi ${hours} horas, bastante bem.`),
  exercise: (type, minutes, slot) => `Fiz ${minutes} minutos de ${type} ${slot === 'midday' ? 'de manhã' : 'à tarde'}.`,
  secondEntry: (slot) => (slot === 'midday' ? 'Umas palavras a meio do dia, entre uma coisa e outra.' : 'Um breve resumo do fim do dia, antes de dormir.'),
  sundayNote: 'O início da semana é sempre um pouco stressante: acumula-se tanta coisa na secretária.',
  peopleSentence: (names, met) => `${met ? 'Estive com' : 'Falei com'} ${joinNames(names)}.`,
  note: 'Lembrar-me de escrever amanhã sobre o que correu bem.',
};

export default content;
