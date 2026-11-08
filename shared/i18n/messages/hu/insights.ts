/** hu - insights messages. Keys are prefixed 'insights.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Insights page (src/pages/InsightsPage.tsx) ---------------------------------------
  'insights.title': 'Meglátások',
  'insights.period': 'Időszak',
  'insights.refresh': 'Frissítés',
  'insights.notesTitle': 'Nem vizsgált / kevés adat',
  'insights.disclaimer':
    'A meglátások az adataidban látható lehetséges összefüggéseket írják le. Nem bizonyítanak ok-okozati kapcsolatot, és nem minősülnek orvosi tanácsnak.',
  'insights.empty.title': 'Ehhez az időszakhoz még nincsenek meglátások',
  'insights.empty.text':
    'A mintázatok felismeréséhez az időszakban legalább {minDays} nap adatára van szükség, és minden összehasonlított csoportban legalább {minGroupSize} napra (például a testmozgással töltött és a mozgás nélküli napokra). Írj tovább a naplódba, és rögzítsd a hangulatodat, az alvásodat és a mozgásodat.',
  'insights.newEntry': 'Új bejegyzés',
  'insights.summary': '{count, plural, one {# nap} other {# nap}} adatokkal {inPeriod} ({start} – {end})',
  'insights.found': '{count, plural, =0 {Nem található meglátás} one {# meglátás található} other {# meglátás található}}',

  // Section headings (src/pages/insights/insight-groups.ts) --------------------------
  'insights.group.trends': 'Trendek',
  'insights.group.habits': 'Szokások',
  'insights.group.sleepActivity': 'Alvás és mozgás',
  'insights.group.daysHours': 'Napok és napszakok',
  'insights.group.emotionsPeople': 'Érzelmek és emberek',
  'insights.group.anomalies': 'Szokatlan napok',
  'insights.group.other': 'Egyéb meglátások',

  // Strength and direction badges ---------------------------------------------------
  'insights.strength.strong': 'Erős mintázat',
  'insights.strength.moderate': 'Közepes mintázat',
  'insights.strength.weak': 'Gyenge mintázat',
  'insights.positive': 'Biztató',
  'insights.attention': 'Figyelmet érdemel',

  // Insight card (src/pages/insights/InsightCard.tsx) --------------------------------
  'insights.card.why': 'Miért kaptam ezt a meglátást?',
  'insights.card.evidenceCaption': 'A meglátás mögötti adatok',
  'insights.card.relatedDays': 'Kapcsolódó napok',
  'insights.card.period': 'Időszak: {start} – {end}',
  'insights.card.detail': 'Részlet',
  'insights.card.value': 'Érték',
  'insights.card.daysExamined': 'Vizsgált napok',
  'insights.card.metric': 'Mutató',
  'insights.card.correlation': 'Korreláció (r)',
  'insights.card.effectSize': 'A különbség mértéke',
  'insights.card.groupRow': '{count, plural, one {# nap} other {# nap}}, átlag: {mean}',
  'insights.card.groupRowNoMean': '{count, plural, one {# nap} other {# nap}}',

  // Home page (src/pages/HomePage.tsx, GET /api/home) --------------------------------
  'insights.home.title': 'Kezdőlap',
  'insights.home.newEntry': 'Új bejegyzés',
  'insights.home.greetingLabel': 'Üdvözlés',
  'insights.home.today': 'Ma',
  'insights.home.weekAverages': 'Az elmúlt 7 nap átlagai',
  'insights.home.habitsToday': 'Mai szokások',
  'insights.home.insightOfDay': 'A nap meglátása',
  'insights.home.lastEntry': 'Legutóbbi bejegyzés',
  'insights.home.noData': 'Nincs adat',
  'insights.home.noHabits': 'Nincsenek aktív szokások.',
  'insights.home.manageHabits': 'Szokások kezelése',
  'insights.home.allHabits': 'Összes szokás',
  'insights.home.allInsights': 'Összes meglátás',
  'insights.home.noInsight':
    'Még nincsenek meglátások. Írj tovább a naplódba, és rögzítsd az alvásodat, a hangulatodat és a mozgásodat, hogy kirajzolódjanak a mintázatok.',
  'insights.home.noEntriesTitle': 'Még nincsenek naplóbejegyzések',
  'insights.home.noEntriesText': 'Minden meglátás az első bejegyzéssel kezdődik. Elég néhány mondat a napodról.',
  'insights.home.firstEntry': 'Az első bejegyzés megírása',
  'insights.home.untitled': 'Cím nélkül',
  'insights.home.streak': 'Írási sorozat: {count, plural, one {# nap} other {# nap}}',
  'insights.home.entriesToday': '{count, plural, =0 {Ma még nincs bejegyzés} one {Ma # bejegyzés} other {Ma # bejegyzés}}',
  'insights.home.totalEntries': '{count, plural, one {Összesen # bejegyzés a naplóban} other {Összesen # bejegyzés a naplóban}}',
  'insights.home.ratingOf10': '{value}/10',
  'insights.home.sleepHours': '{value} óra',
  'insights.home.lastEntryMood': 'Hangulat: {value}',
};
export default messages;
