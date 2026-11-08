/** pl - insights messages. Keys are prefixed 'insights.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Insights page (src/pages/InsightsPage.tsx) ---------------------------------------
  'insights.title': 'Spostrzeżenia',
  'insights.period': 'Okres',
  'insights.refresh': 'Odśwież',
  'insights.notesTitle': 'Nie sprawdzono / za mało danych',
  'insights.disclaimer':
    'Spostrzeżenia opisują możliwe zależności w twoich danych. Nie dowodzą związku przyczynowo-skutkowego i nie są poradą medyczną.',
  'insights.empty.title': 'Na razie brak spostrzeżeń dla tego okresu',
  'insights.empty.text':
    'Aby wykryć wzorce, w okresie potrzeba co najmniej {minDays} dni z danymi i co najmniej {minGroupSize} dni w każdej porównywanej grupie (na przykład dni z aktywnością fizyczną i bez niej). Pisz dalej w dzienniku i zapisuj nastrój, sen i aktywność.',
  'insights.newEntry': 'Nowy wpis',
  // {inPeriod} is 'stats.period.in' ("in the last 30 days"), {start}/{end} are short dates.
  'insights.summary': '{count, plural, one {# dzień} few {# dni} many {# dni} other {# dnia}} z danymi {inPeriod} ({start} – {end})',
  'insights.found':
    '{count, plural, =0 {Nie znaleziono spostrzeżeń} one {Znaleziono # spostrzeżenie} few {Znaleziono # spostrzeżenia} many {Znaleziono # spostrzeżeń} other {Znaleziono # spostrzeżenia}}',

  // Section headings (src/pages/insights/insight-groups.ts) --------------------------
  'insights.group.trends': 'Trendy',
  'insights.group.habits': 'Nawyki',
  'insights.group.sleepActivity': 'Sen i aktywność',
  'insights.group.daysHours': 'Dni i pory dnia',
  'insights.group.emotionsPeople': 'Emocje i ludzie',
  'insights.group.anomalies': 'Nietypowe dni',
  'insights.group.other': 'Inne spostrzeżenia',

  // Strength and direction badges ---------------------------------------------------
  'insights.strength.strong': 'Silny wzorzec',
  'insights.strength.moderate': 'Umiarkowany wzorzec',
  'insights.strength.weak': 'Słaby wzorzec',
  'insights.positive': 'Zachęcające',
  'insights.attention': 'Warte uwagi',

  // Insight card (src/pages/insights/InsightCard.tsx) --------------------------------
  'insights.card.why': 'Dlaczego widzę to spostrzeżenie?',
  'insights.card.evidenceCaption': 'Dane, na których opiera się spostrzeżenie',
  'insights.card.relatedDays': 'Powiązane dni',
  'insights.card.period': 'Okres: {start} – {end}',
  'insights.card.detail': 'Szczegół',
  'insights.card.value': 'Wartość',
  'insights.card.daysExamined': 'Zbadane dni',
  'insights.card.metric': 'Wskaźnik',
  'insights.card.correlation': 'Korelacja (r)',
  'insights.card.effectSize': 'Wielkość różnicy',
  'insights.card.groupRow': '{count, plural, one {# dzień} few {# dni} many {# dni} other {# dnia}}, średnia {mean}',
  'insights.card.groupRowNoMean': '{count, plural, one {# dzień} few {# dni} many {# dni} other {# dnia}}',

  // Home page (src/pages/HomePage.tsx, GET /api/home) --------------------------------
  'insights.home.title': 'Strona główna',
  'insights.home.newEntry': 'Nowy wpis',
  'insights.home.greetingLabel': 'Powitanie',
  'insights.home.today': 'Dzisiaj',
  'insights.home.weekAverages': 'Średnie z ostatnich 7 dni',
  'insights.home.habitsToday': 'Dzisiejsze nawyki',
  'insights.home.insightOfDay': 'Spostrzeżenie dnia',
  'insights.home.lastEntry': 'Ostatni wpis',
  'insights.home.noData': 'Brak danych',
  'insights.home.noHabits': 'Brak aktywnych nawyków.',
  'insights.home.manageHabits': 'Zarządzaj nawykami',
  'insights.home.allHabits': 'Wszystkie nawyki',
  'insights.home.allInsights': 'Wszystkie spostrzeżenia',
  'insights.home.noInsight':
    'Nie ma jeszcze spostrzeżeń. Pisz dalej w dzienniku i zapisuj sen, nastrój oraz aktywność, a z czasem pojawią się wzorce.',
  'insights.home.noEntriesTitle': 'W dzienniku nie ma jeszcze wpisów',
  'insights.home.noEntriesText': 'Pierwszy wpis to początek wszystkich spostrzeżeń. Wystarczy kilka zdań o twoim dniu.',
  'insights.home.firstEntry': 'Napisz pierwszy wpis',
  'insights.home.untitled': 'Bez tytułu',
  'insights.home.streak': 'Seria pisania: {count, plural, one {# dzień} few {# dni} many {# dni} other {# dnia}}',
  'insights.home.entriesToday':
    '{count, plural, =0 {Dziś nie ma jeszcze wpisu} one {# wpis dzisiaj} few {# wpisy dzisiaj} many {# wpisów dzisiaj} other {# wpisu dzisiaj}}',
  'insights.home.totalEntries':
    '{count, plural, one {Łącznie # wpis w dzienniku} few {Łącznie # wpisy w dzienniku} many {Łącznie # wpisów w dzienniku} other {Łącznie # wpisu w dzienniku}}',
  'insights.home.ratingOf10': '{value} z 10',
  'insights.home.sleepHours': '{value} godz.',
  'insights.home.lastEntryMood': 'Nastrój: {value}',
};
export default messages;
