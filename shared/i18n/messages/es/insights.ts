/** es - insights messages. Keys are prefixed 'insights.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Insights page (src/pages/InsightsPage.tsx) ---------------------------------------
  'insights.title': 'Observaciones',
  'insights.period': 'Periodo',
  'insights.refresh': 'Actualizar',
  'insights.notesTitle': 'No comprobado / datos insuficientes',
  'insights.disclaimer':
    'Las observaciones describen posibles relaciones en tus datos. No demuestran causa y efecto y no son consejo médico.',
  'insights.empty.title': 'Todavía no hay observaciones para este periodo',
  'insights.empty.text':
    'Para detectar patrones hacen falta al menos {minDays} días con datos en el periodo, y al menos {minGroupSize} días en cada grupo de comparación (por ejemplo, días con ejercicio y sin él). Sigue escribiendo en tu diario y registrando tu estado de ánimo, tu sueño y tu actividad.',
  'insights.newEntry': 'Nueva entrada',
  // {inPeriod} is 'stats.period.in' ("in the last 30 days"), {start}/{end} are short dates.
  'insights.summary': '{count, plural, one {# día} other {# días}} con datos {inPeriod} ({start} – {end})',
  'insights.found':
    '{count, plural, =0 {No se han encontrado observaciones} one {Se ha encontrado # observación} other {Se han encontrado # observaciones}}',

  // Section headings (src/pages/insights/insight-groups.ts) --------------------------
  'insights.group.trends': 'Tendencias',
  'insights.group.habits': 'Hábitos',
  'insights.group.sleepActivity': 'Sueño y actividad',
  'insights.group.daysHours': 'Días y horas',
  'insights.group.emotionsPeople': 'Emociones y personas',
  'insights.group.anomalies': 'Valores inusuales',
  'insights.group.other': 'Otras observaciones',

  // Strength and direction badges ---------------------------------------------------
  'insights.strength.strong': 'Patrón fuerte',
  'insights.strength.moderate': 'Patrón moderado',
  'insights.strength.weak': 'Patrón débil',
  'insights.positive': 'Alentador',
  'insights.attention': 'Merece atención',

  // Insight card (src/pages/insights/InsightCard.tsx) --------------------------------
  'insights.card.why': '¿Por qué recibí esta observación?',
  'insights.card.evidenceCaption': 'Los datos en los que se basa la observación',
  'insights.card.relatedDays': 'Días relacionados',
  'insights.card.period': 'Periodo: {start} – {end}',
  'insights.card.detail': 'Detalle',
  'insights.card.value': 'Valor',
  'insights.card.daysExamined': 'Días analizados',
  'insights.card.metric': 'Métrica',
  'insights.card.correlation': 'Correlación (r)',
  'insights.card.effectSize': 'Tamaño de la diferencia',
  'insights.card.groupRow': '{count, plural, one {# día} other {# días}}, media {mean}',
  'insights.card.groupRowNoMean': '{count, plural, one {# día} other {# días}}',

  // Home page (src/pages/HomePage.tsx, GET /api/home) --------------------------------
  'insights.home.title': 'Inicio',
  'insights.home.newEntry': 'Nueva entrada',
  'insights.home.greetingLabel': 'Saludo',
  'insights.home.today': 'Hoy',
  'insights.home.weekAverages': 'Medias de los últimos 7 días',
  'insights.home.habitsToday': 'Hábitos de hoy',
  'insights.home.insightOfDay': 'Observación del día',
  'insights.home.lastEntry': 'Última entrada',
  'insights.home.noData': 'Sin datos',
  'insights.home.noHabits': 'No hay hábitos activos.',
  'insights.home.manageHabits': 'Gestionar hábitos',
  'insights.home.allHabits': 'Todos los hábitos',
  'insights.home.allInsights': 'Todas las observaciones',
  'insights.home.noInsight':
    'Todavía no hay observaciones. Sigue escribiendo en tu diario y registrando tu sueño, tu estado de ánimo y tu actividad para descubrir patrones.',
  'insights.home.noEntriesTitle': 'Todavía no hay entradas en el diario',
  'insights.home.noEntriesText': 'Toda observación empieza con una primera entrada. Bastan unas pocas frases sobre tu día.',
  'insights.home.firstEntry': 'Escribir la primera entrada',
  'insights.home.untitled': 'Sin título',
  'insights.home.streak': 'Racha de escritura: {count, plural, one {# día} other {# días}}',
  'insights.home.entriesToday':
    '{count, plural, =0 {Hoy todavía no has escrito ninguna entrada} one {# entrada hoy} other {# entradas hoy}}',
  'insights.home.totalEntries': '{count, plural, one {# entrada en el diario en total} other {# entradas en el diario en total}}',
  'insights.home.ratingOf10': '{value} de 10',
  'insights.home.sleepHours': '{value} horas',
  'insights.home.lastEntryMood': 'Ánimo: {value}',
};
export default messages;
