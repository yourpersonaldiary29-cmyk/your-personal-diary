/** pt - insights messages. Keys are prefixed 'insights.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Insights page (src/pages/InsightsPage.tsx) ---------------------------------------
  'insights.title': 'Observações',
  'insights.period': 'Período',
  'insights.refresh': 'Atualizar',
  'insights.notesTitle': 'Não verificado / dados insuficientes',
  'insights.disclaimer':
    'As observações descrevem possíveis relações nos seus dados. Não estabelecem causa e efeito nem constituem aconselhamento médico.',
  'insights.empty.title': 'Ainda não há observações para este período',
  'insights.empty.text':
    'Para detetar padrões, são necessários pelo menos {minDays} dias com dados no período e pelo menos {minGroupSize} dias em cada grupo de comparação (por exemplo, dias com e sem exercício). Continue a escrever no diário e a registar o humor, o sono e a atividade.',
  'insights.newEntry': 'Nova entrada',
  // {inPeriod} is 'stats.period.in' ("in the last 30 days"), {start}/{end} are short dates.
  'insights.summary': '{count, plural, one {# dia} other {# dias}} com dados {inPeriod} ({start} – {end})',
  'insights.found':
    '{count, plural, =0 {Não foram encontradas observações} one {Foi encontrada # observação} other {Foram encontradas # observações}}',

  // Section headings (src/pages/insights/insight-groups.ts) --------------------------
  'insights.group.trends': 'Tendências',
  'insights.group.habits': 'Hábitos',
  'insights.group.sleepActivity': 'Sono e atividade',
  'insights.group.daysHours': 'Dias e horas',
  'insights.group.emotionsPeople': 'Emoções e pessoas',
  'insights.group.anomalies': 'Valores invulgares',
  'insights.group.other': 'Outras observações',

  // Strength and direction badges ---------------------------------------------------
  'insights.strength.strong': 'Padrão forte',
  'insights.strength.moderate': 'Padrão moderado',
  'insights.strength.weak': 'Padrão fraco',
  'insights.positive': 'Encorajador',
  'insights.attention': 'Merece atenção',

  // Insight card (src/pages/insights/InsightCard.tsx) --------------------------------
  'insights.card.why': 'Porque recebi esta observação?',
  'insights.card.evidenceCaption': 'Os dados em que a observação se baseia',
  'insights.card.relatedDays': 'Dias relacionados',
  'insights.card.period': 'Período: {start} – {end}',
  'insights.card.detail': 'Detalhe',
  'insights.card.value': 'Valor',
  'insights.card.daysExamined': 'Dias analisados',
  'insights.card.metric': 'Métrica',
  'insights.card.correlation': 'Correlação (r)',
  'insights.card.effectSize': 'Dimensão da diferença',
  'insights.card.groupRow': '{count, plural, one {# dia} other {# dias}}, média {mean}',
  'insights.card.groupRowNoMean': '{count, plural, one {# dia} other {# dias}}',

  // Home page (src/pages/HomePage.tsx, GET /api/home) --------------------------------
  'insights.home.title': 'Início',
  'insights.home.newEntry': 'Nova entrada',
  'insights.home.greetingLabel': 'Saudação',
  'insights.home.today': 'Hoje',
  'insights.home.weekAverages': 'Médias dos últimos 7 dias',
  'insights.home.habitsToday': 'Hábitos de hoje',
  'insights.home.insightOfDay': 'Observação do dia',
  'insights.home.lastEntry': 'Última entrada',
  'insights.home.noData': 'Sem dados',
  'insights.home.noHabits': 'Não há hábitos ativos.',
  'insights.home.manageHabits': 'Gerir hábitos',
  'insights.home.allHabits': 'Todos os hábitos',
  'insights.home.allInsights': 'Todas as observações',
  'insights.home.noInsight':
    'Ainda não há observações. Continue a escrever no diário e a registar o sono, o humor e a atividade para descobrir padrões.',
  'insights.home.noEntriesTitle': 'Ainda não há entradas no diário',
  'insights.home.noEntriesText': 'Todas as observações começam com uma primeira entrada. Bastam algumas frases sobre o seu dia.',
  'insights.home.firstEntry': 'Escrever a primeira entrada',
  'insights.home.untitled': 'Sem título',
  'insights.home.streak': 'Sequência de escrita: {count, plural, one {# dia} other {# dias}}',
  'insights.home.entriesToday':
    '{count, plural, =0 {Ainda não escreveu nenhuma entrada hoje} one {# entrada hoje} other {# entradas hoje}}',
  'insights.home.totalEntries': '{count, plural, one {# entrada no diário, no total} other {# entradas no diário, no total}}',
  'insights.home.ratingOf10': '{value} de 10',
  'insights.home.sleepHours': '{value} horas',
  'insights.home.lastEntryMood': 'Humor: {value}',
};
export default messages;
