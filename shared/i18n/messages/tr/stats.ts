/** tr - stats messages. Keys are prefixed 'stats.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Statistics page (src/pages/StatsPage.tsx) ----------------------------------------
  'stats.title': 'İstatistikler',
  'stats.period': 'Dönem',
  'stats.movingAvg': 'Hareketli ortalama (7 gün)',
  'stats.overTime': 'Zaman içinde: {label}',
  'stats.weekday.section': 'Haftanın günlerine göre',
  'stats.weekday.chart': 'Haftanın günlerine göre ortalamalar',
  'stats.weekday.axis': 'Haftanın günü',
  'stats.habits.section': 'Alışkanlıklar',
  'stats.habits.chart': '{name} - günlük değerler',
  'stats.habits.empty': 'Bu dönemde kaydı olan alışkanlık yok.',
  // {frequency} is 'daily' | 'weekly'; {current}/{best} are formatted streaks ("5 days").
  'stats.habits.summary':
    'Tamamlanma: {percent} ({frequency, select, weekly {{total, plural, one {# haftanın} other {# haftanın}}} other {{total, plural, one {# günün} other {# günün}}}} {completed} tanesi), mevcut seri: {current}, en iyi: {best}',
  'stats.empty.title': 'Bu dönem için henüz veri yok',
  'stats.empty.text': 'Grafikleri ve eğilimleri burada görmek için kayıt yazın ve alışkanlıkları kaydedin.',
  'stats.newEntry': 'Yeni kayıt',
  'stats.noValues': 'Bu dönemde veri yok.',
  'stats.overview': '{days, plural, one {# günde} other {# günde}} {entries, plural, one {# kayıt} other {# kayıt}} ({from} – {to})',

  // Series summary under every chart -------------------------------------------------
  'stats.summary.base': 'Ortalama {mean} ({sample}; en düşük {min}; en yüksek {max}).',
  'stats.summary.sampleDays': '{count, plural, one {# gün} other {# gün}}',
  'stats.summary.sampleValues': '{count, plural, one {# değer} other {# değer}}',
  'stats.summary.noChange': 'Önceki döneme göre değişiklik yok ({previous}).',
  'stats.summary.change': 'Önceki dönemdeki değer: {previous} ({diff}).',
  'stats.summary.sentences': '{summary} {comparison}',
  'stats.summary.entriesPerDay': 'günlük kayıt sayısı',

  // Metric titles (chart sections; also the home page tiles) -------------------------
  'stats.metric.mood': 'Ruh hali',
  'stats.metric.energy': 'Enerji düzeyi',
  'stats.metric.stress': 'Stres düzeyi',
  'stats.metric.sleepHours': 'Uyku süresi',
  'stats.metric.sleepQuality': 'Uyku kalitesi',
  'stats.metric.exerciseMinutes': 'Egzersiz',
  'stats.metric.entriesPerDay': 'Günlük kayıtları',

  // Periods (pickers on the statistics and insights pages) ---------------------------
  'stats.period.7d': '7 gün',
  'stats.period.30d': '30 gün',
  'stats.period.3m': '3 ay',
  'stats.period.6m': '6 ay',
  'stats.period.1y': '1 yıl',
  'stats.period.all': 'Tüm zamanlar',
  'stats.period.in':
    '{period, select, 7d {son 7 günde} 30d {son 30 günde} 3m {son 3 ayda} 6m {son 6 ayda} 1y {son bir yılda} all {tüm dönem boyunca} other {bu dönemde}}',

  // Charts (src/components/charts/chart-utils.ts) ------------------------------------
  'stats.chart.noData': 'Gösterilecek veri yok',
  'stats.chart.xAxisDate': 'Tarih',
  'stats.chart.valueWithUnit': '{value} {unit}',
  // Tooltip of one bar / marker: series label, x label (a date or a weekday), value with unit.
  'stats.chart.pointTooltip': '{label}, {x}: {value}',
  'stats.chart.summary':
    '{label}: {count, plural, one {# değer} other {# değer}}; en düşük {min}; en yüksek {max}; ortalama {mean}.',
  'stats.chart.summaryEmpty': '{label}: veri yok.',
  'stats.chart.range': '{count, plural, one {Tek zaman noktası: {from}.} other {# zaman noktası, {from} ile {to} arası.}}',
};
export default messages;
