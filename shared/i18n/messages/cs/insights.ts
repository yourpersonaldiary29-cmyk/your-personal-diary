/** cs - insights messages. Keys are prefixed 'insights.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Insights page (src/pages/InsightsPage.tsx) ---------------------------------------
  'insights.title': 'Postřehy',
  'insights.period': 'Období',
  'insights.refresh': 'Obnovit',
  'insights.notesTitle': 'Neověřeno / nedostatek dat',
  'insights.disclaimer':
    'Postřehy popisují možné souvislosti ve tvých datech. Neprokazují příčinu a následek a nejsou lékařskou radou.',
  'insights.empty.title': 'Pro toto období zatím nejsou žádné postřehy',
  'insights.empty.text':
    'K rozpoznání vzorců je v období potřeba alespoň {minDays, plural, one {# den} few {# dny} many {# dne} other {# dní}} s daty a alespoň {minGroupSize, plural, one {# den} few {# dny} many {# dne} other {# dní}} v každé porovnávané skupině (například dny se cvičením a bez něj). Pokračuj v psaní deníku a zaznamenávej náladu, spánek a pohyb.',
  'insights.newEntry': 'Nový záznam',
  'insights.summary': '{count, plural, one {# den} few {# dny} many {# dne} other {# dní}} s daty {inPeriod} ({start} – {end})',
  'insights.found':
    '{count, plural, =0 {Nebyly nalezeny žádné postřehy} one {Nalezen # postřeh} few {Nalezeny # postřehy} many {Nalezeno # postřehu} other {Nalezeno # postřehů}}',

  // Section headings (src/pages/insights/insight-groups.ts) --------------------------
  'insights.group.trends': 'Trendy',
  'insights.group.habits': 'Návyky',
  'insights.group.sleepActivity': 'Spánek a pohyb',
  'insights.group.daysHours': 'Dny a denní doba',
  'insights.group.emotionsPeople': 'Emoce a lidé',
  'insights.group.anomalies': 'Neobvyklé dny',
  'insights.group.other': 'Další postřehy',

  // Strength and direction badges ---------------------------------------------------
  'insights.strength.strong': 'Silný vzorec',
  'insights.strength.moderate': 'Středně silný vzorec',
  'insights.strength.weak': 'Slabý vzorec',
  'insights.positive': 'Povzbudivé',
  'insights.attention': 'Stojí za pozornost',

  // Insight card (src/pages/insights/InsightCard.tsx) --------------------------------
  'insights.card.why': 'Proč vidím tento postřeh?',
  'insights.card.evidenceCaption': 'Data, ze kterých postřeh vychází',
  'insights.card.relatedDays': 'Související dny',
  'insights.card.period': 'Období: {start} – {end}',
  'insights.card.detail': 'Údaj',
  'insights.card.value': 'Hodnota',
  'insights.card.daysExamined': 'Zkoumané dny',
  'insights.card.metric': 'Ukazatel',
  'insights.card.correlation': 'Korelace (r)',
  'insights.card.effectSize': 'Velikost rozdílu',
  'insights.card.groupRow': '{count, plural, one {# den} few {# dny} many {# dne} other {# dní}}, průměr {mean}',
  'insights.card.groupRowNoMean': '{count, plural, one {# den} few {# dny} many {# dne} other {# dní}}',

  // Home page (src/pages/HomePage.tsx, GET /api/home) --------------------------------
  'insights.home.title': 'Domů',
  'insights.home.newEntry': 'Nový záznam',
  'insights.home.greetingLabel': 'Pozdrav',
  'insights.home.today': 'Dnes',
  'insights.home.weekAverages': 'Průměry za posledních 7 dní',
  'insights.home.habitsToday': 'Dnešní návyky',
  'insights.home.insightOfDay': 'Postřeh dne',
  'insights.home.lastEntry': 'Poslední záznam',
  'insights.home.noData': 'Žádná data',
  'insights.home.noHabits': 'Žádné aktivní návyky.',
  'insights.home.manageHabits': 'Spravovat návyky',
  'insights.home.allHabits': 'Všechny návyky',
  'insights.home.allInsights': 'Všechny postřehy',
  'insights.home.noInsight':
    'Zatím žádné postřehy. Pokračuj v psaní deníku a zaznamenávej spánek, náladu a pohyb – postupně se začnou ukazovat vzorce.',
  'insights.home.noEntriesTitle': 'V deníku zatím nejsou žádné záznamy',
  'insights.home.noEntriesText': 'Každý postřeh začíná prvním záznamem. Stačí pár vět o tvém dni.',
  'insights.home.firstEntry': 'Napsat první záznam',
  'insights.home.untitled': 'Bez názvu',
  'insights.home.streak': 'Série psaní: {count, plural, one {# den} few {# dny} many {# dne} other {# dní}}',
  'insights.home.entriesToday':
    '{count, plural, =0 {Dnes zatím žádný záznam} one {Dnes # záznam} few {Dnes # záznamy} many {Dnes # záznamu} other {Dnes # záznamů}}',
  'insights.home.totalEntries':
    '{count, plural, one {V deníku je celkem # záznam} few {V deníku jsou celkem # záznamy} many {V deníku je celkem # záznamu} other {V deníku je celkem # záznamů}}',
  'insights.home.ratingOf10': '{value} z 10',
  'insights.home.sleepHours': '{value} hod.',
  'insights.home.lastEntryMood': 'Nálada: {value}',
};
export default messages;
