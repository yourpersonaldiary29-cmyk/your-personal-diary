/** cs - stats messages. Keys are prefixed 'stats.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Statistics page (src/pages/StatsPage.tsx) ----------------------------------------
  'stats.title': 'Statistiky',
  'stats.period': 'Období',
  'stats.movingAvg': 'Klouzavý průměr (7 dní)',
  'stats.overTime': '{label} v čase',
  'stats.weekday.section': 'Podle dne v týdnu',
  'stats.weekday.chart': 'Průměry podle dne v týdnu',
  'stats.weekday.axis': 'Den v týdnu',
  'stats.habits.section': 'Návyky',
  'stats.habits.chart': '{name} – denní hodnoty',
  'stats.habits.empty': 'V tomto období nejsou žádné návyky se záznamy.',
  'stats.habits.summary':
    'Plnění: {percent} ({completed} z {frequency, select, weekly {{total, plural, one {# týdne} few {# týdnů} many {# týdne} other {# týdnů}}} other {{total, plural, one {# dne} few {# dnů} many {# dne} other {# dnů}}}}), aktuální série: {current}, nejlepší: {best}',
  'stats.empty.title': 'Pro toto období zatím nejsou žádná data',
  'stats.empty.text': 'Piš záznamy a zaznamenávej návyky – grafy a trendy se pak zobrazí tady.',
  'stats.newEntry': 'Nový záznam',
  'stats.noValues': 'V tomto období nejsou žádná data.',
  'stats.overview':
    '{entries, plural, one {# záznam} few {# záznamy} many {# záznamu} other {# záznamů}} za {days, plural, one {# den} few {# dny} many {# dne} other {# dní}} ({from} – {to})',

  // Series summary under every chart -------------------------------------------------
  'stats.summary.base': 'Průměr {mean} ({sample}, minimum {min}, maximum {max}).',
  'stats.summary.sampleDays': '{count, plural, one {# den} few {# dny} many {# dne} other {# dní}}',
  'stats.summary.sampleValues': '{count, plural, one {# hodnota} few {# hodnoty} many {# hodnoty} other {# hodnot}}',
  'stats.summary.noChange': 'Beze změny oproti předchozímu období ({previous}).',
  'stats.summary.change': 'V předchozím období: {previous} ({diff}).',
  'stats.summary.sentences': '{summary} {comparison}',
  'stats.summary.entriesPerDay': 'zázn./den',

  // Metric titles (chart sections; also the home page tiles) -------------------------
  'stats.metric.mood': 'Nálada',
  'stats.metric.energy': 'Úroveň energie',
  'stats.metric.stress': 'Úroveň stresu',
  'stats.metric.sleepHours': 'Hodiny spánku',
  'stats.metric.sleepQuality': 'Kvalita spánku',
  'stats.metric.exerciseMinutes': 'Cvičení',
  'stats.metric.entriesPerDay': 'Záznamy v deníku',

  // Periods (pickers on the statistics and insights pages) ---------------------------
  'stats.period.7d': '7 dní',
  'stats.period.30d': '30 dní',
  'stats.period.3m': '3 měsíce',
  'stats.period.6m': '6 měsíců',
  'stats.period.1y': '1 rok',
  'stats.period.all': 'Celé období',
  'stats.period.in':
    '{period, select, 7d {za posledních 7 dní} 30d {za posledních 30 dní} 3m {za poslední 3 měsíce} 6m {za posledních 6 měsíců} 1y {za poslední rok} all {za celé období} other {ve zvoleném období}}',

  // Charts (src/components/charts/chart-utils.ts) ------------------------------------
  'stats.chart.noData': 'Žádná data k zobrazení',
  'stats.chart.xAxisDate': 'Datum',
  'stats.chart.valueWithUnit': '{value} {unit}',
  'stats.chart.pointTooltip': '{label}, {x}: {value}',
  'stats.chart.summary':
    '{label}: {count, plural, one {# hodnota} few {# hodnoty} many {# hodnoty} other {# hodnot}}, minimum {min}, maximum {max}, průměr {mean}.',
  'stats.chart.summaryEmpty': '{label}: žádná data.',
  'stats.chart.range':
    '{count, plural, one {Jeden časový bod: {from}.} few {# časové body, od {from} do {to}.} many {# časového bodu, od {from} do {to}.} other {# časových bodů, od {from} do {to}.}}',
};
export default messages;
