---
title: Gizlilik Politikası - Your Personal Diary
description: Your Personal Diary'nin (Android uygulaması, Windows uygulaması ve web sitesi) verilerinizi nasıl sakladığı ve koruduğu.
languages: Diller
otherPage: Hesabınızı nasıl silersiniz
---

# Gizlilik Politikası - Your Personal Diary

Yürürlük tarihi: {{EFFECTIVE_DATE}}

## Kısaca

- Your Personal Diary, üç girişi olan tek bir hizmettir: **Android uygulaması** (Google Play), **Windows uygulaması** (Microsoft Store veya kurulum dosyası) ve **web sitesi** [{{SITE_URL}}]({{SITE_URL}}). Üçü de aynı sunucuyu ve aynı hesabı kullanır.
- Günlüğünüz, sunucumuzda parolanızdan türetilen bir anahtarla şifrelenmiş bir dosyada saklanır. Hesap bilgileriniz de orada saklanır.
- Verilerinizi yalnızca günlüğünüzü sizin için çalıştırmak amacıyla kullanırız. Reklam yok, analiz yok, izleme yok; verilerinizi satmayız ve paylaşmayız.
- Lütfen sınırları bilin: oturumunuz açıkken sunucu günlüğünüzü belleğinde açık tutar ve sunucunun işletmecisi teknik olarak parolanızı sıfırlayıp günlüğünüzü okuyabilir. Bölüm 4 bunu açıkça anlatır.
- Hesabınızı ve günlüğünüzü istediğiniz zaman **Ayarlar - Hesabı sil** bölümünden silebilirsiniz.

## 1. Biz kimiz

Hizmet, kişisel verilerinizden sorumlu olan ("veri sorumlusu") {{PUBLISHER_NAME}} ("biz") tarafından işletilir. İletişim: [{{CONTACT_EMAIL}}](mailto:{{CONTACT_EMAIL}}).

Bu politika Android uygulaması, Windows uygulaması ve web sitesi için geçerlidir. Hepsi aynı günlüğü gösterir ve aynı kurallara uyar; bir uygulamanın farklı davrandığı yerde bu politika bunu belirtir.

## 2. Sunucuda neleri, nerede saklıyoruz

Sunucu, barındırma sağlayıcısı Fly.io'nun **Frankfurt, Almanya'daki (Avrupa Birliği)** veri merkezinde çalışır. Sunucuda şunlar saklanır:

- **Hesap bilgileri:** adınız, soyadınız, kullanıcı adınız ve e-posta adresiniz, bir hesap kimliği, uygulamayı kullandığınız dil, hesabın ne zaman oluşturulduğu ve en son ne zaman oturum açtığınız. Hesap oluşturulurken, bu politikayı okuduğunuzu ve kabul ettiğinizi onayladığınıza dair bir kayıt da saklarız: onay zamanı ve onayladığınız sürümün yürürlük tarihi. E-posta adresinizi değiştirirseniz, önceki adres ve değişiklik zamanı, adresi yeniden değiştirene ya da hesabı silene kadar hesapla birlikte saklanır. Uygulama bu bilgileri şifrelemez, çünkü sunucunun oturumunuzu açmak ve size yazmak için bunlara ihtiyacı vardır; bu yüzden işletmeci bunları görebilir.
- **Parolanız:** saklanmaz. Sunucu yalnızca parolayı doğrulamasını sağlayan, ondan türetilmiş bir değeri (scrypt) tutar.
- **Günlüğünüz:** kayıtlar (metin ve isteğe bağlı alanlar: ruh hali, duygular, enerji, stres, uyku, fiziksel aktivite, olaylar, kişiler, yer, notlar ve etiketler), alışkanlıklar ve kayıtları ile ayarlarınız. Her hesabın kendi şifreli günlük dosyası vardır.
- **Oturumlar:** oturum açtığınız her cihaz için: cihaz türü ("Bilgisayar", "Telefon" veya "Tarayıcı"), oturumun ne zaman başladığı, en son ne zaman kullanıldığı ve ne zaman sona ereceği. Oturum belirtecinin kendisi yalnızca karma (hash) olarak saklanır. "Beni hatırla" seçildiğinde oturum, sunucu anahtarıyla şifrelenmiş günlük anahtarınızı da içerir (Bölüm 4).
- **Parola sıfırlama istekleri:** sıfırlama bağlantısının ve kodunun karması; 30 dakika geçerlidir ve bir kez kullanılabilir.
- **Cihazlarınızdaki çevrimdışı kopyaların anahtarı** (Bölüm 5); şifreli günlüğünüzün içinde saklanır.
- **İşletmecinin e-posta gönderme ayarları** (işletmecinin kendi Gmail hesabı; parolası şifreli olarak saklanır). Bu ayarlarda sizinle ilgili hiçbir şey yoktur.
- **Teknik günlük**: başlangıç olayları ve hatalar. Günlük içeriği, e-posta adresi veya IP adresi içermez.

**Tur** (Android uygulamasındaki "Atla - sadece göz atmak istiyorum") örnek verilerle geçici bir misafir günlüğü oluşturur. Bu günlük yalnızca sunucunun belleğinde bulunur, 30 dakika sonra kendiliğinden sona erer ve asla saklanmaz.

Her web sitesinde olduğu gibi, cihazınız bağlandığında sunucu ve barındırma sağlayıcısı cihazınızın IP adresini alır. Sunucu bunu yalnızca kendi belleğinde kullanır: tek bir ağdan kaç istek gelebileceğini sınırlamak (oturum açma, kayıt ve hesabın diğer işlevleri, parola sıfırlama, tur ve yedekler) ve oturum açma kilidi için. Bu sayaçlar en fazla son 24 saati kapsar; adres hiçbir zaman teknik günlüğe veya depolamaya yazılmaz.

## 3. Verilerinizi nasıl kullanıyoruz

- **Hizmeti sunmak için:** oturum açma, günlüğünüzü saklama ve tüm cihazlarınızda aynı tutma, arama, kendi kayıtlarınızla ilgili istatistikler ve içgörüler, yedeklemeler, dışa aktarmalar ve hatırlatıcılar. Arama soruları sunucuda yanıtlanır ve orada saklanmaz.
- **E-posta:** yalnızca parola sıfırlama iletileriniz ve güvenlik bildirimleri için (parolanız bir sıfırlama iletisiyle değiştirildi; hesabınızın e-posta adresi değiştirildi). Bunlar hesap bilgilerinizle birlikte saklanan dilde yazılır; sunucu bunları yazmak için günlüğünüzü açmaz. Bülten yok, pazarlama yok.
- **Asla:** reklam yok, analiz veya izleme aracı yok, profil çıkarma yok, veri satışı yok ve günlüğünüz hiçbir yapay zekâyı eğitmek için kullanılmaz.

Hukuki dayanak (Avrupa Birliği'ndeki kullanıcılar ve benzer yasalar için): verilerinizi, kaydolduğunuz hizmeti sunmak (sözleşmenin ifası, GDPR madde 6(1)(b)) ve güvenliğini sağlamak (meşru menfaatimiz, madde 6(1)(f): deneme sınırları, kilitlemeler, teknik günlük) için işleriz. Yazmayı seçerseniz günlüğünüz hassas bilgiler içerebilir; örneğin sağlığınız veya inançlarınız hakkında. Bunları yalnızca sizin için saklamak ve size göstermek amacıyla işleriz, çünkü onları yazarak bunu bizden istemiş olursunuz (açık rızanız, madde 9(2)(a)); kayıtları düzenleyerek veya silerek bunları istediğiniz zaman kaldırabilirsiniz (eski metnin nasıl silindiğini bölüm 7 açıklar).

## 4. Günlüğünüz nasıl korunur - ve bu koruma neye karşı korumaz

Onu koruyan şeyler:

- Her hesabın günlük dosyası AES-256-GCM ile şifrelenir. Anahtar, parolanızdan scrypt ile türetilir. Dosyadaki her değişiklik fark edilir.
- Barındırma sağlayıcısının diskleri de şifrelidir (bekleyen veride şifreleme).
- Cihazlarınız ile sunucu arasındaki tüm bağlantılar HTTPS (TLS) kullanır.

Bilmeniz gerekenler:

- **Oturumunuz açıkken günlüğünüz sunucunun belleğinde şifresi çözülmüş durumdadır**; böylece sunucu onu sizin için gösterebilir, içinde arama yapabilir ve analiz edebilir. Bu, "uçtan uca" şifreleme değildir.
- **İşletmeci teknik olarak her parolayı sıfırlayabilir.** "Parolanızı mı unuttunuz?" özelliğinin günlüğünüzü kaybetmeden çalışabilmesi için sunucu, her hesap için günlük anahtarının sunucu anahtarıyla şifrelenmiş bir kopyasını (bir "kurtarma anahtarı") saklar. Sunucu anahtarı, barındırma platformunun bir sırrı olarak, saklanan dosyaların dışında tutulur; bu yüzden dosyaların tek başına bir kopyası hiçbir şeyi açmaz. Yine de sunucuyu ve sırlarını kontrol eden kişi - işletmeci ve ilke olarak barındırma sağlayıcısı - parolayı bilmeden herhangi bir hesabın parolasını sıfırlayıp günlüğünü okuyabilir. Bunu yapmayacağımızı taahhüt ederiz. Bunun için bir aracımız yoktur ve yönetim araçlarımız hiçbir zaman bir günlüğü açmaz. Bu taahhüde güvenmek istemiyorsanız, hizmette başkasının okumasını istemeyeceğiniz hiçbir şeyi saklamayın.
- **Bir parola sıfırlama isteği günlüğünüzü açmaz.** Sıfırlama iletisi ve güvenlik bildirimleri hesap bilgilerinizle birlikte saklanan dilde yazılır (bölüm 2); bu yüzden bir istek - ister sizden ister e-posta adresinizi yazan herhangi birinden gelsin - günlüğünüzü kapalı bırakır. Sunucu, günlüğünüzü kurtarma anahtarıyla yalnızca sıfırlama, iletideki bağlantı veya kodla tamamlandığında açar; amacı günlüğünüzü yeni parolanızla yeniden şifrelemektir.

## 5. Cihazınızda neler saklanır

Hizmeti kullandığınız her cihazda:

- oturum belirteciniz (oturumunuzun açık kalması için), son kullanıcı adı, dil ve görünüm tercihleriniz ve son arama sorularınız (oturumu kapattığınızda silinir).

**Bağlantı olmadan.** Uygulama sunucuya ulaşamazsa çalışmaya devam eder: yazdıklarınız cihazınızda şifreli olarak saklanır ve bağlantı geri geldiğinde, arada uygulama kapatılmış olsa bile, otomatik olarak sunucuya yüklenir. Windows ve Android uygulamalarında "Beni hatırla"yı seçtiyseniz, uygulama size son gösterdiklerinin (son kayıtlar, alışkanlıklar, bugünün verileri, takvim ayı ve ayarlarınız) şifreli bir kopyasını da saklar; böylece bağlantı olmadan okuyabilirsiniz; aksi halde bu kopya yalnızca uygulama açıkken bellekte bulunur. Bu kopyaların anahtarını sunucu, şifreli günlüğünüzün içinde saklar; "Beni hatırla" ile Windows ve Android uygulamaları onu, uygulamanın bağlantı olmadan açılabilmesi için Windows Veri Koruması veya Android Keystore ile korunmuş olarak cihazda da saklar. Parolanız ve kurtarma anahtarınız cihazda asla saklanmaz. Her değişikliğin tam olarak bir kez yüklenmesi için uygulama, son 7 günde yüklediği değişikliklerin bir listesini de şifreli olarak saklar.

- **Windows uygulaması:** bu kopyalar, Windows kullanıcı profilinizdeki uygulama veri klasörlerinde saklanır (Microsoft Store sürümünde uygulamanın kendi paket klasöründe). Anahtar, Windows Veri Koruması (DPAPI) ile korunur ve yalnızca sizin Windows kullanıcınız için çalışır.
- **Android uygulaması:** bu kopyalar, diğer uygulamaların okuyamadığı ve yedeklemelerin dışında tutulan uygulamanın özel depolama alanında saklanır. Anahtar Android Keystore ile korunur.
- **Web sitesi:** tarayıcıda yalnızca henüz yüklenmemiş değişiklikler, son 7 günün listesi ve çakışan değişikliklerle ilgili notlar (aşağıya bakın) şifreli olarak saklanır, okuduklarınızın bir kopyası saklanmaz; anahtar bellekte kalır ve sayfayı kapattığınızda kaybolur.

Bağlantı geri geldiğinde uygulama, yaptığınız değişiklikleri yaptığınız sırayla ve her birini tam olarak bir kez yükler. Aynı kayıt, alışkanlık veya ayar başka bir cihazda da değiştirildiyse, daha yeni olan değişiklik korunur ve uygulama bunu size tek satırla bildirir; diğer sürüm, notu kapatana kadar bu cihazda kullanımınıza açık kalır.

Uygulama cihazınızın ekran kilidiyle (Windows Hello veya Android'de ekran kilidi ya da parmak izi) kilit açmayı önerirse, doğrulamayı işletim sistemi yapar. Parmak iziniz, yüzünüz veya PIN'iniz hakkında hiçbir şey uygulamaya ya da bize ulaşmaz. Android uygulamasındaki alışkanlık hatırlatıcıları telefonun kendisinde planlanır; hiçbir anlık bildirim (push) hizmeti kullanılmaz.

Kendi oluşturduğunuz dosyalar: **yedek** bir parolayla şifrelenir; **dışa aktarma** (TXT, CSV, JSON veya PDF) sıradan, okunabilir bir dosyadır. Nereye kaydedeceğinize siz karar verirsiniz ve dışa aktarılmış bir dosyayı ele geçiren herkes onu okuyabilir.

## 6. Verileri başka kimler alır

İki hizmet sağlayıcı kullanıyoruz. Bunlar verileri yalnızca bizim adımıza, hizmeti çalıştırmak için işler:

- **Fly.io, Inc.** (Amerika Birleşik Devletleri) - sunucunun Frankfurt, Almanya'da barındırılması. Sistemlerinde şifreli günlük dosyaları, hesap bilgileri ve Bölüm 2'deki diğer veriler bulunur; IP adresleri gibi bağlantı verilerini alır. Fly.io bir ABD şirketi olduğundan verilere Avrupa Birliği dışından erişebilir; bu, şirketin veri işleme koşullarıyla düzenlenir. Gizlilik politikası: `fly.io/legal/privacy-policy`.
- **Google (Gmail)** - parola sıfırlama iletilerini ve güvenlik bildirimlerini gönderir. Google iletiyi, e-posta adresinizi ve iletideki ad ile kullanıcı adını alır. Bir ileti asla günlüğünüzden bir şey içermez. Google'ın gizlilik politikası: `policies.google.com/privacy`.

Uygulamaları indirdiğinizde uygulama mağazaları da kendi gizlilik politikalarına göre veri işler: Android uygulaması için **Google Play**, Windows uygulaması için **Microsoft Store** (örneğin sistemlerinin topladığı yüklemeler, puanlar ve kilitlenme raporları). Uygulamalar, onlara veri gönderen ne onların ne de başka birinin kodunu içerir.

Kişisel verilerinizi başka hiç kimseye satmayız, kiralamayız veya paylaşmayız. Verileri yalnızca yasa gerektirirse açıklarız.

## 7. Verileri ne kadar süre saklarız ve nasıl silinir

- Hesabınızı ve günlüğünüzü siz silene kadar saklarız. Oturumlar 12 saat sonra, "Beni hatırla" ile 90 gün sonra sona erer. Parola sıfırlama istekleri 30 dakika sonra geçersiz olur. Bir cihazdaki kopyalar, o cihazda oturumu kapatana kadar kalır.
- **Hesabınızı uygulamada veya web sitesinde silin:** oturum açın, **Ayarlar - Hesabı sil** bölümünü açın, parolanızı girin ve onaylayın. Bu işlem hesabınızı, günlüğünüzü, alışkanlıklarınızı ve ayarlarınızı, tüm cihazlardaki oturumunuzu ve tüm parola sıfırlama isteklerini sunucudan hemen siler ve kullandığınız cihazdaki çevrimdışı kopyayı da siler. Diğer cihazlarınızda hâlâ bekleyen değişiklikler artık yüklenemez ve kaybolur.
- **Sunucu yedeklerindeki kopyalar:** barındırma sağlayıcısı sunucunun depolama alanının her gün bir anlık görüntüsünü alır. Silinen bir hesabın bu anlık görüntülerdeki kopyaları 30 gün içinde otomatik olarak silinir.
- **Sunucunun şifreli arşivleri:** bir felaketten sonra kurtarma yapabilmek için işletmeci yaklaşık ayda bir kez sunucunun depolama alanının şifreli bir arşivini oluşturur; sunucu yalnızca en yeni 2 arşivi saklar, işletmeci ise en fazla en yeni 3 arşivi internete bağlı olmayan bir sürücüde çevrimdışı saklar; bu nedenle silinen bir hesabın kopyaları, daha yeni arşivler onların yerini aldıkça bunlardan kaybolur, genellikle üç ay içinde.
- **Silinen veya değiştirilen kayıtlar** uygulamadan hemen kaybolur ve eski metinleri, değişiklik kaydedildiğinde, bir an sonra sunucudaki günlük dosyanızdan silinir: sunucu, silinen verilerin yerini yalnızca boş olarak işaretlemek yerine üzerlerine yazar. Dosyanın, sunucunun bir kaydetme başarısız olursa diye sakladığı önceki sürümü bir sonraki kaydetmede değiştirilir. Bu koruma var olmadan önce silinen metin, güncellemeden sonra günlüğünüz ilk kez açıldığında silinir (örneğin oturum açtığınızda). Sunucuda daha eski sürümler bundan sonra yalnızca depolamanın günlük anlık görüntülerinde en fazla 30 gün boyunca ve şifreli olarak diskinin kullanılmayan alanında, o alan yeniden kullanılana kadar kalır; daha önce oluşturduğunuz yedek dosyaları içerdikleri metni korur. Hesabınızı silmek dosyanın tamamını siler.
- **Oturum açamıyorsanız:** hesabınızda kayıtlı e-posta adresinden [{{CONTACT_EMAIL}}](mailto:{{CONTACT_EMAIL}}) adresine yazın. İsteği doğrular ve hesabı 30 gün içinde sileriz. Tüm ayrıntılar: [{{DELETE_URL}}]({{DELETE_URL}}).
- **Uygulamayı kaldırmak hesabınızı silmez.** İstediğiniz buysa önce Ayarlar'dan silin. Oturumu kapatmak, kopyaları ve anahtarı o cihazdan siler; yüklenmeyi bekleyen değişiklikler varsa uygulama önce sorar. Windows'ta indirilen (kurulum dosyalı) sürümü kaldırmak, uygulama verilerini silmeyi seçmediğiniz sürece şifreli kopyayı korur; emin olmak için önce oturumu kapatın.
- Şu anda etkin olmayan hesapları otomatik olarak silmiyoruz. Bunu yapmaya başlarsak, uygulanmadan önce burada belirteceğiz.

## 8. Güvenlik önlemleri

- Yalnızca HTTPS; sunucu, güvenli adresi üzerinden gelmeyen bağlantıları reddeder.
- Oturum açma ve kayıt denemelerinde sınırlar. 10 yanlış paroladan sonra o ağdan oturum açma 15 dakika boyunca kilitlenir ve hesaba yönelik sonraki denemeler yavaşlatılır.
- Günlük, bir süre işlem yapılmadığında kendini kilitler. Parolayı veya e-posta adresini değiştirmek ve hesabı silmek parolanızı gerektirir.
- Sunucu anahtarı saklanan dosyaların dışında tutulur ve sunucuyu yalnızca işletmeci yönetebilir.
- Windows kullanıcınız olarak program çalıştırabilen ya da root'lu bir telefonun tam denetimine sahip olan biri, "Beni hatırla" için saklanan kopyayı okuyabilir.

Hiçbir sistem kusursuz güvenlik vaat edemez. Başka hiçbir yerde kullanmadığınız güçlü bir parola seçin, cihazlarınızı güncel tutun ve bir yedek saklayın.

## 9. Haklarınız

Verilerinizi kendiniz görebilir, düzeltebilir, dışa aktarabilir ve silebilirsiniz: profiliniz Ayarlar'dadır, her kayıt düzenlenebilir veya silinebilir, **Ayarlar - Yedekleme** ve dışa aktarma başka bir yere götürebileceğiniz bir kopya oluşturur ve **Hesabı sil** her şeyi kaldırır. Ayrıca verilerinizin bir kopyasını, düzeltilmesini, silinmesini veya işlenmesinin kısıtlanmasını istemek ya da işlemeye itiraz etmek için bize yazabilir ve verdiğiniz bir rızayı istediğiniz zaman geri alabilirsiniz. 30 gün içinde yanıt veririz. Bir veri koruma otoritesine şikâyette bulunma hakkınız da vardır - Avrupa Birliği'nde ülkenizin otoritesine, İsrail'de Gizliliği Koruma Otoritesi'ne.

## 10. Çocuklar

Hizmet çocuklara yönelik değildir. Hesap oluşturmak için en az {{MINIMUM_AGE}} yaşında olmalısınız. Daha küçük kişilerin verilerini bilerek toplamayız. Daha küçük bir çocuğun hesap oluşturduğunu düşünüyorsanız bize yazın, hesabı sileriz.

## 11. Tıbbi bir araç değildir

Uygulamadaki içgörüler, kendi kayıtlarınızdaki olası ilişkileri tanımlar. Neden-sonuç ilişkisini kanıtlamaz ve tıbbi veya psikolojik tavsiye değildir.

## 12. Bu politikadaki değişiklikler

Hizmet veya bu politika değiştiğinde bu sayfayı ve en üstteki yürürlük tarihini güncelleriz. Bir değişiklik verilerinizle yaptıklarımızı etkiliyorsa, yürürlüğe girmeden önce bunu bu sayfada belirtiriz.

## 13. İletişim

Gizlilik veya verilerinizle ilgili sorular: [{{CONTACT_EMAIL}}](mailto:{{CONTACT_EMAIL}})

{{PUBLISHER_NAME}}
