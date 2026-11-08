/** ro - insights messages. Keys are prefixed 'insights.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Insights page (src/pages/InsightsPage.tsx) ---------------------------------------
  'insights.title': 'Observații',
  'insights.period': 'Perioadă',
  'insights.refresh': 'Actualizează',
  'insights.notesTitle': 'Neverificate / date insuficiente',
  'insights.disclaimer': 'Observațiile descriu posibile legături din datele tale. Ele nu stabilesc o relație de cauză și efect și nu sunt sfaturi medicale.',
  'insights.empty.title': 'Încă nu există observații pentru această perioadă',
  'insights.empty.text':
    'Pentru a descoperi tipare, perioada trebuie să conțină cel puțin {minDays, plural, one {# zi} few {# zile} other {# de zile}} cu date, iar fiecare grup de comparație cel puțin {minGroupSize, plural, one {# zi} few {# zile} other {# de zile}} (de exemplu, zile cu și fără sport). Continuă să scrii în jurnal și să notezi dispoziția, somnul și activitatea.',
  'insights.newEntry': 'Însemnare nouă',
  // {inPeriod} is 'stats.period.in' ("in the last 30 days"), {start}/{end} are short dates.
  'insights.summary': '{count, plural, one {# zi} few {# zile} other {# de zile}} cu date {inPeriod} ({start} – {end})',
  'insights.found': '{count, plural, =0 {Nu a fost găsită nicio observație} one {A fost găsită o observație} few {Au fost găsite # observații} other {Au fost găsite # de observații}}',

  // Section headings (src/pages/insights/insight-groups.ts) --------------------------
  'insights.group.trends': 'Tendințe',
  'insights.group.habits': 'Obiceiuri',
  'insights.group.sleepActivity': 'Somn și activitate',
  'insights.group.daysHours': 'Zile și ore',
  'insights.group.emotionsPeople': 'Emoții și oameni',
  'insights.group.anomalies': 'Abateri',
  'insights.group.other': 'Alte observații',

  // Strength and direction badges ---------------------------------------------------
  'insights.strength.strong': 'Tipar puternic',
  'insights.strength.moderate': 'Tipar moderat',
  'insights.strength.weak': 'Tipar slab',
  'insights.positive': 'Încurajator',
  'insights.attention': 'Merită atenție',

  // Insight card (src/pages/insights/InsightCard.tsx) --------------------------------
  'insights.card.why': 'De ce văd această observație?',
  'insights.card.evidenceCaption': 'Datele din spatele observației',
  'insights.card.relatedDays': 'Zile asociate',
  'insights.card.period': 'Perioada: {start} – {end}',
  'insights.card.detail': 'Detaliu',
  'insights.card.value': 'Valoare',
  'insights.card.daysExamined': 'Zile analizate',
  'insights.card.metric': 'Indicator',
  'insights.card.correlation': 'Corelație (r)',
  'insights.card.effectSize': 'Mărimea diferenței',
  'insights.card.groupRow': '{count, plural, one {# zi} few {# zile} other {# de zile}}, media {mean}',
  'insights.card.groupRowNoMean': '{count, plural, one {# zi} few {# zile} other {# de zile}}',

  // Home page (src/pages/HomePage.tsx, GET /api/home) --------------------------------
  'insights.home.title': 'Acasă',
  'insights.home.newEntry': 'Însemnare nouă',
  'insights.home.greetingLabel': 'Salut',
  'insights.home.today': 'Azi',
  'insights.home.weekAverages': 'Mediile ultimelor 7 zile',
  'insights.home.habitsToday': 'Obiceiurile de azi',
  'insights.home.insightOfDay': 'Observația zilei',
  'insights.home.lastEntry': 'Ultima însemnare',
  'insights.home.noData': 'Nu există date',
  'insights.home.noHabits': 'Niciun obicei activ.',
  'insights.home.manageHabits': 'Gestionează obiceiurile',
  'insights.home.allHabits': 'Toate obiceiurile',
  'insights.home.allInsights': 'Toate observațiile',
  'insights.home.noInsight': 'Încă nu există observații. Continuă să scrii în jurnal și să notezi somnul, dispoziția și activitatea ca să descoperi tipare.',
  'insights.home.noEntriesTitle': 'Încă nu există însemnări în jurnal',
  'insights.home.noEntriesText': 'Prima însemnare este începutul oricărei observații. Câteva propoziții despre ziua ta sunt de ajuns.',
  'insights.home.firstEntry': 'Scrie prima însemnare',
  'insights.home.untitled': 'Fără titlu',
  'insights.home.streak': 'Seria de scris: {count, plural, one {# zi} few {# zile} other {# de zile}}',
  'insights.home.entriesToday': '{count, plural, =0 {Încă nicio însemnare azi} one {O însemnare azi} few {# însemnări azi} other {# de însemnări azi}}',
  'insights.home.totalEntries': '{count, plural, one {O însemnare în jurnal în total} few {# însemnări în jurnal în total} other {# de însemnări în jurnal în total}}',
  'insights.home.ratingOf10': '{value} din 10',
  'insights.home.sleepHours': '{value} ore',
  'insights.home.lastEntryMood': 'Dispoziție: {value}',
};
export default messages;
