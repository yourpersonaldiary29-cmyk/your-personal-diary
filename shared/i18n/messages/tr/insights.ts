/** tr - insights messages. Keys are prefixed 'insights.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Insights page (src/pages/InsightsPage.tsx) ---------------------------------------
  'insights.title': 'İçgörüler',
  'insights.period': 'Dönem',
  'insights.refresh': 'Yenile',
  'insights.notesTitle': 'Kontrol edilmedi / yeterli veri yok',
  'insights.disclaimer': 'İçgörüler verilerinizdeki olası ilişkileri tanımlar. Neden-sonuç ilişkisi kurmaz ve tıbbi tavsiye değildir.',
  'insights.empty.title': 'Bu dönem için henüz içgörü yok',
  'insights.empty.text':
    'Örüntüleri bulmak için dönem içinde en az {minDays} gün veri ve her karşılaştırma grubunda en az {minGroupSize} gün gerekir (örneğin egzersiz yapılan ve yapılmayan günler). Günlüğünüze yazmaya ve ruh halinizi, uykunuzu ve aktivitenizi kaydetmeye devam edin.',
  'insights.newEntry': 'Yeni kayıt',
  // {inPeriod} is 'stats.period.in' ("in the last 30 days"), {start}/{end} are short dates.
  'insights.summary': '{inPeriod} veri olan {count, plural, one {# gün} other {# gün}} ({start} – {end})',
  'insights.found': '{count, plural, =0 {İçgörü bulunamadı} one {# içgörü bulundu} other {# içgörü bulundu}}',

  // Section headings (src/pages/insights/insight-groups.ts) --------------------------
  'insights.group.trends': 'Eğilimler',
  'insights.group.habits': 'Alışkanlıklar',
  'insights.group.sleepActivity': 'Uyku ve aktivite',
  'insights.group.daysHours': 'Günler ve saatler',
  'insights.group.emotionsPeople': 'Duygular ve kişiler',
  'insights.group.anomalies': 'Olağandışı günler',
  'insights.group.other': 'Diğer içgörüler',

  // Strength and direction badges ---------------------------------------------------
  'insights.strength.strong': 'Güçlü örüntü',
  'insights.strength.moderate': 'Orta düzey örüntü',
  'insights.strength.weak': 'Zayıf örüntü',
  'insights.positive': 'Cesaret verici',
  'insights.attention': 'Dikkate değer',

  // Insight card (src/pages/insights/InsightCard.tsx) --------------------------------
  'insights.card.why': 'Bu içgörüyü neden aldım?',
  'insights.card.evidenceCaption': 'İçgörünün dayandığı veriler',
  'insights.card.relatedDays': 'İlgili günler',
  'insights.card.period': 'Dönem: {start} – {end}',
  'insights.card.detail': 'Ayrıntı',
  'insights.card.value': 'Değer',
  'insights.card.daysExamined': 'İncelenen günler',
  'insights.card.metric': 'Ölçüm',
  'insights.card.correlation': 'Korelasyon (r)',
  'insights.card.effectSize': 'Farkın büyüklüğü',
  'insights.card.groupRow': '{count, plural, one {# gün} other {# gün}}, ortalama {mean}',
  'insights.card.groupRowNoMean': '{count, plural, one {# gün} other {# gün}}',

  // Home page (src/pages/HomePage.tsx, GET /api/home) --------------------------------
  'insights.home.title': 'Ana sayfa',
  'insights.home.newEntry': 'Yeni kayıt',
  'insights.home.greetingLabel': 'Karşılama',
  'insights.home.today': 'Bugün',
  'insights.home.weekAverages': 'Son 7 günün ortalamaları',
  'insights.home.habitsToday': 'Bugünün alışkanlıkları',
  'insights.home.insightOfDay': 'Günün içgörüsü',
  'insights.home.lastEntry': 'Son kayıt',
  'insights.home.noData': 'Veri yok',
  'insights.home.noHabits': 'Etkin alışkanlık yok.',
  'insights.home.manageHabits': 'Alışkanlıkları yönet',
  'insights.home.allHabits': 'Tüm alışkanlıklar',
  'insights.home.allInsights': 'Tüm içgörüler',
  'insights.home.noInsight':
    'Henüz içgörü yok. Örüntüleri keşfetmek için günlüğünüze yazmaya ve uykunuzu, ruh halinizi ve aktivitenizi kaydetmeye devam edin.',
  'insights.home.noEntriesTitle': 'Henüz günlük kaydı yok',
  'insights.home.noEntriesText': 'Her içgörü ilk kayıtla başlar. Gününüz hakkında birkaç cümle yeterli.',
  'insights.home.firstEntry': 'İlk kaydı yaz',
  'insights.home.untitled': 'Başlıksız',
  'insights.home.streak': 'Yazma serisi: {count, plural, one {# gün} other {# gün}}',
  'insights.home.entriesToday':
    '{count, plural, =0 {Bugün henüz kayıt yazılmadı} one {Bugün # kayıt} other {Bugün # kayıt}}',
  'insights.home.totalEntries': '{count, plural, one {Günlükte toplam # kayıt} other {Günlükte toplam # kayıt}}',
  'insights.home.ratingOf10': '{value}/10',
  'insights.home.sleepHours': '{value} saat',
  'insights.home.lastEntryMood': 'Ruh hali: {value}',
};
export default messages;
