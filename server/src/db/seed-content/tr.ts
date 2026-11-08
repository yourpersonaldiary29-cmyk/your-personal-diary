/** tr - demo texts ("Load sample data"). Same fields and pool sizes as en.ts (see README.md). */
import type { SeedContent } from './types';

/** As chips "Annem" / "Babam" start with a capital; inside a sentence they are common nouns ("Elif ve annem ile ..."). */
const IN_SENTENCE: Record<string, string> = { Annem: 'annem', Babam: 'babam' };

/** "A", "A ve B" - a kinship word that does not open the sentence is written in lower case. */
function joinNames(names: string[]): string {
  return names.map((name, i) => (i > 0 ? (IN_SENTENCE[name] ?? name) : name)).join(' ve ');
}

const content: SeedContent = {
  titles: {
    high: ['Harika bir sabah', 'Enerji dolu bir gün', 'Gerçekten güzel bir gün', 'Sonunda dinlendim', 'Küçük başarılarla dolu bir gün', 'Güneş ve temiz hava'],
    mid: ['Sıradan bir gün', 'Bir iş günü', 'Ufak tefek işler ve rutin', 'Bir gün daha geçti', 'Kendi tempomda bir gün', 'Keyifli bir rutin'],
    low: ['Zor bir gün', 'Derin bir yorgunluk', 'Bugün kolay değildi', 'Yorucu bir gün', 'Başımda bir ağırlık', 'Günün bitmesini istedim'],
  },
  openers: {
    high: ['Bugün kendimi gerçekten iyi hissettim.', 'Gülümseyerek uyandım ve gün de öyle devam etti.', 'Güzel enerjiyle dolu bir gündü.', 'Kendimi hafif ve mutlu hissettim.'],
    mid: ['Sıradan bir gün, sürpriz yok.', 'Günü kendi tempomda geçirdim.', 'Özel bir şey olmadı ama fena değildi.', 'İş ve ufak tefek işlerle geçen rutin bir gün.'],
    low: ['Zor bir gün geçirdim.', 'Günün büyük bölümünde kendimi ağır ve yorgun hissettim.', 'Hiçbir şeye odaklanamadım.', 'Gün ters başladı.'],
  },
  events: [
    'İş toplantısı',
    'Ailece akşam yemeği',
    'Doktor randevusu',
    'Market alışverişi',
    'Eski bir arkadaşla telefon görüşmesi',
    'Banka işleri',
    'İlginç bir seminer',
    'Evden çalışma günü',
    'Kısa bir gezi',
    'Ev temizliği',
    'Arkadaş buluşması',
    'Spor dersi',
    'Film gecesi',
    'Yeni bir yemek denemesi',
  ],
  sundayEvents: ['Yeni haftayı planlamak', 'Haftalık ekip toplantısı', 'Yanıt bekleyen yığınla e-posta'],
  // Slots 3 and 4: "my mom" / "my dad" - the form that stands as it is before "ile".
  people: ['Elif', 'Mehmet', 'Annem', 'Babam', 'Zeynep', 'Ayşe', 'Emre', 'Selin', 'Can', 'Deniz'],
  locations: ['Ev', 'Ofis', 'Park', 'Kafe', 'Ailemin evi', 'Sahil', 'Kütüphane'],
  tags: ['iş', 'aile', 'sağlık', 'arkadaşlar', 'spor', 'eğitim', 'dinlenme', 'doğa', 'yaratıcılık', 'para'],
  sportTag: 'spor',
  // Named after a colon, so no type needs its own verb: "Sabah 30 dakika spor yaptım: bisiklet.".
  exerciseTypes: ['yürüyüş', 'koşu', 'kuvvet antrenmanı', 'yüzme', 'bisiklet', 'yoga'],
  badDay: {
    title: 'Berbat bir gün',
    body: 'Berbat bir gün. Her şey ters gitti: geç kalktım, önemli bir toplantıyı kaçırdım ve yakın bir arkadaşımla tartıştım. Her şey üstüme geldi, nereden başlayacağımı bilemedim.',
  },
  goodDay: {
    title: 'Mükemmel bir gün',
    body: 'Mükemmel bir gün! İşte sevindirici bir haber aldım, akşam bütün aileyle birlikte kutladık ve her şey için minnet duydum.',
  },
  sleep: (hours, low) => (low ? `Dün gece yalnızca ${hours} saat uyudum ve bunu gün boyu hissettim.` : `Dün gece ${hours} saat uyudum, gayet iyiydi.`),
  exercise: (type, minutes, slot) => `${slot === 'midday' ? 'Sabah' : 'Öğleden sonra'} ${minutes} dakika spor yaptım: ${type}.`,
  secondEntry: (slot) => (slot === 'midday' ? 'Gün ortasında, bir işten ötekine geçerken birkaç satır.' : 'Uyumadan önce akşamın kısa bir özeti.'),
  sundayNote: 'Yeni haftanın başı hep biraz stresli oluyor; masada bir sürü iş birikiyor.',
  peopleSentence: (names, met) => `${joinNames(names)} ile ${met ? 'buluştum' : 'konuştum'}.`,
  note: 'Yarın nelerin iyi gittiğini yazmayı unutma.',
  // Spelled as in English: the place "Park" and the exercise "yoga".
  sameAsEnglish: ['Park', 'yoga'],
};

export default content;
