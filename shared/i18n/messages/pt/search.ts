/** pt - search messages. Keys are prefixed 'search.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Search page (src/pages/SearchPage.tsx) -------------------------------------------
  'search.title': 'Pesquisa',
  'search.label': 'Pergunte ao seu diário',
  'search.hint': 'Uma pergunta livre, por exemplo sobre dias, humor, sono ou palavras que escreveu.',
  'search.submit': 'Pesquisar',
  'search.searching': 'A pesquisar…',
  'search.examplesTitle': 'Exemplos de perguntas',
  'search.recentTitle': 'Perguntas recentes',
  'search.clearRecent': 'Limpar',
  'search.resultsTitle': 'Resultados',
  'search.understood': 'Como interpretei a pergunta',
  'search.answer': 'Resposta',
  'search.days': 'Dias',
  'search.entries': 'Entradas',
  'search.emptyQuestion': 'Escreva uma pergunta',
  'search.untitled': 'Sem título',
  'search.noRatings': 'Sem classificações',
  'search.period': 'Período: {label}',
  'search.matches': '{count, plural, one {Foi encontrado # resultado} other {Foram encontrados # resultados}}',

  // Per-day metrics line under a matching day ("mood 8, energy 7, sleep 7.5 hours, 1 entry")
  'search.day.mood': 'humor {value}',
  'search.day.energy': 'energia {value}',
  'search.day.stress': 'stress {value}',
  'search.day.sleep': 'sono {hours}',
  'search.day.entries': '{count, plural, one {# entrada} other {# entradas}}',
  'search.day.separator': ', ',

  // Example questions. The server-side parser must understand these in every language
  // (keys 'search.example.1'..'search.example.6' are the contract with the search module).
  'search.example.1': 'Em que dias do último mês me senti melhor?',
  'search.example.2': 'Quando escrevi sobre o cansaço?',
  'search.example.3': 'Em que dias dormi menos de cinco horas?',
  'search.example.4': 'Como mudou o meu humor nos últimos três meses?',
  'search.example.5': 'Em que dias senti stress?',
  'search.example.6': 'Entradas com a etiqueta trabalho',
};
export default messages;
