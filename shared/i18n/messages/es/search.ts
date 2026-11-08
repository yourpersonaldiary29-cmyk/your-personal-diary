/** es - search messages. Keys are prefixed 'search.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Search page (src/pages/SearchPage.tsx) -------------------------------------------
  'search.title': 'Búsqueda',
  'search.label': 'Pregunta a tu diario',
  'search.hint': 'Una pregunta libre, por ejemplo sobre días, estado de ánimo, sueño o palabras que hayas escrito.',
  'search.submit': 'Buscar',
  'search.searching': 'Buscando…',
  'search.examplesTitle': 'Preguntas de ejemplo',
  'search.recentTitle': 'Preguntas recientes',
  'search.clearRecent': 'Borrar',
  'search.resultsTitle': 'Resultados',
  'search.understood': 'Cómo he entendido la pregunta',
  'search.answer': 'Respuesta',
  'search.days': 'Días',
  'search.entries': 'Entradas',
  'search.emptyQuestion': 'Escribe una pregunta',
  'search.untitled': 'Sin título',
  'search.noRatings': 'Sin valoraciones',
  'search.period': 'Periodo: {label}',
  'search.matches': '{count, plural, one {Se ha encontrado # coincidencia} other {Se han encontrado # coincidencias}}',

  // Per-day metrics line under a matching day ("mood 8, energy 7, sleep 7.5 hours, 1 entry")
  'search.day.mood': 'ánimo {value}',
  'search.day.energy': 'energía {value}',
  'search.day.stress': 'estrés {value}',
  'search.day.sleep': 'sueño {hours}',
  'search.day.entries': '{count, plural, one {# entrada} other {# entradas}}',
  'search.day.separator': ', ',

  // Example questions. The server-side parser must understand these in every language
  // (keys 'search.example.1'..'search.example.6' are the contract with the search module).
  'search.example.1': '¿Qué días del último mes me sentí mejor?',
  'search.example.2': '¿Cuándo escribí sobre el cansancio?',
  'search.example.3': '¿Qué días dormí menos de cinco horas?',
  'search.example.4': '¿Cómo cambió mi estado de ánimo en los últimos tres meses?',
  'search.example.5': '¿Qué días sentí estrés?',
  'search.example.6': 'Entradas con la etiqueta trabajo',
};
export default messages;
