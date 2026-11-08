/** it - stats messages. Keys are prefixed 'stats.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Statistics page (src/pages/StatsPage.tsx) ----------------------------------------
  'stats.title': 'Statistiche',
  'stats.period': 'Periodo',
  'stats.movingAvg': 'Media mobile (7 giorni)',
  'stats.overTime': '{label} nel tempo',
  'stats.weekday.section': 'Per giorno della settimana',
  'stats.weekday.chart': 'Medie per giorno della settimana',
  'stats.weekday.axis': 'Giorno della settimana',
  'stats.habits.section': 'Abitudini',
  'stats.habits.chart': '{name} - valori giornalieri',
  'stats.habits.empty': 'Nessuna abitudine registrata in questo periodo.',
  // {frequency} is 'daily' | 'weekly'; {current}/{best} are formatted streaks ("5 days").
  'stats.habits.summary':
    'Completamento: {percent} ({completed} su {frequency, select, weekly {{total, plural, one {# settimana} other {# settimane}}} other {{total, plural, one {# giorno} other {# giorni}}}}), serie attuale: {current}, record: {best}',
  'stats.empty.title': 'Ancora nessun dato per questo periodo',
  'stats.empty.text': 'Scrivi delle voci e registra le abitudini per vedere qui grafici e tendenze.',
  'stats.newEntry': 'Nuova voce',
  'stats.noValues': 'Nessun dato in questo periodo.',
  'stats.overview': '{entries, plural, one {# voce} other {# voci}} in {days, plural, one {# giorno} other {# giorni}} ({from} – {to})',

  // Series summary under every chart -------------------------------------------------
  'stats.summary.base': 'Media {mean} ({sample}, minimo {min}, massimo {max}).',
  'stats.summary.sampleDays': '{count, plural, one {# giorno} other {# giorni}}',
  'stats.summary.sampleValues': '{count, plural, one {# valore} other {# valori}}',
  'stats.summary.noChange': 'Nessuna variazione rispetto al periodo precedente ({previous}).',
  'stats.summary.change': 'Rispetto a {previous} nel periodo precedente ({diff}).',
  'stats.summary.sentences': '{summary} {comparison}',
  'stats.summary.entriesPerDay': 'voci al giorno',

  // Metric titles (chart sections; also the home page tiles) -------------------------
  'stats.metric.mood': 'Umore',
  'stats.metric.energy': 'Livello di energia',
  'stats.metric.stress': 'Livello di stress',
  'stats.metric.sleepHours': 'Ore di sonno',
  'stats.metric.sleepQuality': 'Qualità del sonno',
  'stats.metric.exerciseMinutes': 'Attività fisica',
  'stats.metric.entriesPerDay': 'Voci del diario',

  // Periods (pickers on the statistics and insights pages) ---------------------------
  'stats.period.7d': '7 giorni',
  'stats.period.30d': '30 giorni',
  'stats.period.3m': '3 mesi',
  'stats.period.6m': '6 mesi',
  'stats.period.1y': '1 anno',
  'stats.period.all': 'Tutto il periodo',
  'stats.period.in':
    '{period, select, 7d {negli ultimi 7 giorni} 30d {negli ultimi 30 giorni} 3m {negli ultimi 3 mesi} 6m {negli ultimi 6 mesi} 1y {nell’ultimo anno} all {in tutto il periodo} other {nel periodo}}',

  // Charts (src/components/charts/chart-utils.ts) ------------------------------------
  'stats.chart.noData': 'Nessun dato da visualizzare',
  'stats.chart.xAxisDate': 'Data',
  'stats.chart.valueWithUnit': '{value} {unit}',
  // Tooltip of one bar / marker: series label, x label (a date or a weekday), value with unit.
  'stats.chart.pointTooltip': '{label}, {x}: {value}',
  'stats.chart.summary': '{label}: {count, plural, one {# valore} other {# valori}}, minimo {min}, massimo {max}, media {mean}.',
  'stats.chart.summaryEmpty': '{label}: nessun dato.',
  'stats.chart.range': '{count, plural, one {Un solo punto nel tempo: {from}.} other {# punti nel tempo, dal {from} al {to}.}}',
};
export default messages;
