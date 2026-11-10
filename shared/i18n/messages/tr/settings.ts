/** tr - settings messages. Keys are prefixed 'settings.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Language card (src/pages/settings/LanguageSection.tsx, src/context/LanguageContext.tsx)
  'settings.language.title': 'Dil',
  'settings.language.label': 'Arayüz dili',
  'settings.language.hint':
    'Günlüğün tamamı seçilen dile hemen geçer. Giriş yapmadan önce seçim bu cihazda tutulur; giriş yaptıktan sonra hesabınıza kaydedilir.',
  'settings.language.changed': 'Dil güncellendi: {language}',
  'settings.language.saveFailed': 'Dil bu cihazda değiştirildi ancak hesaba kaydedilemedi.',

  // Page titles (src/pages/SettingsPage.tsx, BackupPage.tsx)
  'settings.title': 'Ayarlar',
  'settings.backup.pageTitle': 'Yedekleme, geri yükleme ve dışa aktarma',
  'settings.actionCancelled': 'İşlem iptal edildi.',

  // Account card (src/pages/settings/AccountSection.tsx, ProfileEditor.tsx, ChangePasswordDialog.tsx)
  'settings.account.title': 'Hesap',
  'settings.account.anonymousText':
    'Hesap, güvenlik, hatırlatıcı ve veri ayarları giriş yaptıktan sonra kullanılabilir. Görünüm tercihleri hesap olmadan da bu cihazda tutulur.',
  'settings.account.setEmail': 'Belirle',
  'settings.account.setEmailTitle': 'E-posta adresini belirle',
  'settings.account.emailSaved': 'E-posta adresi kaydedildi.',
  'settings.account.editDetails': 'Bilgileri düzenle',
  'settings.account.editDetailsHint': 'Adınız, günlüğün üst kısmındaki karşılama mesajında da kullanılır.',
  'settings.account.emailPassword': 'Hesap parolanız',
  'settings.account.emailPasswordHint': 'E-posta adresini değiştirmek için gerekir, çünkü parola sıfırlama e-postaları bu adrese gönderilir.',
  'settings.account.profileSaved': 'Bilgileriniz kaydedildi.',
  'settings.account.noChanges': 'Hiçbir şey değişmedi.',
  'settings.account.changePassword': 'Parolayı değiştir',
  'settings.account.logout': 'Çıkış yap',
  'settings.account.logoutQuestion': 'Günlükten çıkış yapılsın mı? Geri dönmek için kullanıcı adınızı ve parolanızı girmeniz gerekecek.',
  'settings.account.oldPassword': 'Eski parola',
  'settings.account.newPassword': 'Yeni parola',
  'settings.account.confirmNewPassword': 'Yeni parolayı onaylayın',
  'settings.account.newPasswordHint': 'En az {min} karakter; harf ve rakam içermeli',
  'settings.account.passwordChanged': 'Parola başarıyla değiştirildi',
  'settings.account.wrongOldPassword': 'Eski parola yanlış. Lütfen tekrar deneyin.',
  'settings.account.passwordChangeHint': 'Parolayı değiştirmek günlüğü yeniden şifreler ve diğer tüm cihazlarda oturumu kapatır.',
  // Account ID row (hosted server only): the server owner copies it to turn the owner cards on.
  'settings.account.accountId': 'Hesap kimliği',
  'settings.account.copyAccountId': 'Hesap kimliğini kopyala',
  'settings.account.accountIdCopied': 'Hesap kimliği kopyalandı',
  'settings.account.accountIdCopyFailed': 'Kopyalama başarısız oldu. Hesap kimliğini seçip elle kopyalayın.',
  'settings.account.accountIdHint': 'Buna yalnızca sunucu sahibi, sahip kartlarını açmak için ihtiyaç duyar.',

  // Connected devices (src/pages/settings/SessionsList.tsx)
  'settings.devices.title': 'Bağlı cihazlar',
  'settings.devices.hint': 'Bu hesapta şu anda oturum açık olan tüm cihazlar. Bir cihazın bağlantısını kesmek oturumunu hemen sonlandırır.',
  'settings.devices.current': 'Bu cihaz',
  'settings.devices.remembered': 'Beni hatırla',
  'settings.devices.unknown': 'Adsız cihaz',
  'settings.devices.connectedAt': 'Giriş zamanı',
  'settings.devices.lastSeen': 'Son etkinlik',
  'settings.devices.revoke': 'Bağlantıyı kes',
  'settings.devices.revokeName': 'Bağlantıyı kes: {device}',
  'settings.devices.none': 'Bağlı cihaz yok.',
  'settings.devices.revoked': '"{device}" cihazının bağlantısı kesildi.',

  // Display card (src/pages/settings/DisplaySection.tsx)
  'settings.display.title': 'Görünüm',
  'settings.display.theme': 'Tema',
  'settings.display.themeOption.system': 'Sistemi izle',
  'settings.display.themeOption.light': 'Açık',
  'settings.display.themeOption.dark': 'Koyu',
  'settings.display.themeOption.highContrast': 'Yüksek karşıtlık',
  'settings.display.themeChanged': 'Tema güncellendi: {label}',
  'settings.display.fontScale': 'Metin boyutu',
  'settings.display.fontScaleOption.small': 'Küçük (%{percent})',
  'settings.display.fontScaleOption.normal': 'Normal (%{percent})',
  'settings.display.fontScaleOption.large': 'Büyük (%{percent})',
  'settings.display.fontScaleOption.veryLarge': 'Çok büyük (%{percent})',
  'settings.display.fontScaleOption.huge': 'Dev (%{percent})',
  'settings.display.fontScaleOption.custom': 'Özel (%{percent})',
  'settings.display.fontScaleChanged': 'Metin boyutu güncellendi: {label}',
  'settings.display.reduceMotion': 'Hareketi azalt',
  'settings.display.reduceMotionHint': 'Arayüzdeki animasyonları ve geçişleri kapatır.',
  'settings.display.reduceMotionOn': 'Hareketi azaltma açıldı.',
  'settings.display.reduceMotionOff': 'Hareketi azaltma kapatıldı.',
  'settings.display.firstDayOfWeek': 'Haftanın ilk günü',
  'settings.display.sunday': 'Pazar',
  'settings.display.monday': 'Pazartesi',
  'settings.display.firstDayChanged': 'Hafta artık şu günle başlayacak: {label}.',
  'settings.display.anonymousHint': 'Tercihler bu tarayıcıda tutulur. Giriş yaptıktan sonra hesabınıza kaydedilir.',

  // Security card (src/pages/settings/SecuritySection.tsx)
  'settings.security.title': 'Güvenlik',
  'settings.security.autoLock': 'Hareketsizlikten sonra otomatik kilit',
  'settings.security.autoLockHint': 'Seçilen süreden sonra günlük bir kilit ekranı gösterir ve parolayı ister. Oturumunuz açık kalır.',
  'settings.security.autoLockOff': 'Kapalı',
  'settings.security.autoLockChanged': 'Otomatik kilit: {label}',
  'settings.security.lockNow': 'Şimdi kilitle',
  'settings.security.lockNowHint': 'İstediğiniz an Ctrl+L ile de kilitleyebilirsiniz.',

  // Reminders card (src/pages/settings/RemindersSection.tsx)
  'settings.reminders.title': 'Hatırlatıcılar',
  'settings.reminders.enabled': 'Alışkanlık hatırlatıcılarını göster',
  'settings.reminders.hint':
    'Hatırlatıcılar yalnızca yerel bildirimlerdir - günlüğün açık olduğu bilgisayarda veya tarayıcıda. Dışarıya hiçbir şey gönderilmez.',
  'settings.reminders.explanation':
    'Hatırlatma saati, alışkanlıklar sayfasında her alışkanlık için ayrı ayrı belirlenir. Bu seçenek kapalıyken hiçbir hatırlatıcı gösterilmez.',
  'settings.reminders.on': 'Hatırlatıcılar açıldı.',
  'settings.reminders.off': 'Hatırlatıcılar kapatıldı.',
  'settings.reminders.habitsLink': 'Alışkanlıklar sayfasına git',

  // Privacy card (src/pages/settings/PrivacySection.tsx)
  // Link to the privacy policy page of the diary server (src/components/legal/PrivacyPolicyLink.tsx)
  'settings.privacy.policyLink': 'Gizlilik Politikası',
  // TODO-TRANSLATE (docs/apple-tasks/TERMS-DIFF.md): English placeholder of the Terms-of-Use keys below - the translator replaces it and removes this line
  'settings.privacy.termsLink': 'Terms of Use',
  'settings.privacy.title': 'Gizlilik',
  'settings.privacy.offlineLabel': 'Çevrimdışı gizlilik modu',
  'settings.privacy.offlineHint':
    'Bu mod açıkken uygulamanın kendisi, kendi yerel sunucusu dışında hiçbir ağ bağlantısı açamaz. Yalnızca uzaktan erişim kullanıyorsanız kapatın.',
  'settings.privacy.offlineOn': 'Çevrimdışı gizlilik modu açıldı.',
  'settings.privacy.offlineOff': 'Çevrimdışı gizlilik modu kapatıldı.',
  // Data card (src/pages/settings/DataSection.tsx)
  'settings.data.title': 'Veriler',
  'settings.data.reassurance': 'Günlük verileriniz kişisel hesabınızda saklanır ve uçtan uca şifrelenir.',
  'settings.data.seedDemo': 'Örnek verileri yükle',
  'settings.data.seedDemoTitle': 'Örnek veriler yükleniyor',
  'settings.data.seedDemoMessage':
    'Günlük şu anda boş. İçgörüleri, istatistikleri ve aramayı tanıyabilmeniz için yaklaşık {days} günlük kurgusal kayıt ve alışkanlık oluşturulacak. Bunları diğer kayıtlar gibi düzenleyip silebilirsiniz.',
  'settings.data.seedDemoConfirm': 'Yükle',
  'settings.data.seedDemoDone':
    '{entries, plural, one {# kayıt} other {# kayıt}}, {habits, plural, one {# alışkanlık} other {# alışkanlık}} ve {logs, plural, one {# alışkanlık kaydı} other {# alışkanlık kaydı}} yüklendi.',

  // Delete account card - the last card of the page (src/pages/settings/DeleteAccountSection.tsx)
  'settings.deleteAccount.title': 'Hesabı sil',
  'settings.deleteAccount.warning':
    'Hesabınızı silmek, onu günlüğü, alışkanlıkları ve ayarlarıyla birlikte kalıcı olarak siler ve tüm cihazlarda oturumunu kapatır. Hesap geri yüklenemez. Başka bir yere kaydettiğiniz yedek dosyaları bundan etkilenmez.',
  'settings.deleteAccount.button': 'Hesabı sil',
  'settings.deleteAccount.dialogTitle': '"{username}" hesabı silinsin mi?',
  'settings.deleteAccount.passwordHint': 'Onaylamak için hesap parolanızı girin.',
  'settings.deleteAccount.understand': 'Bu işlemin geri alınamayacağını anlıyorum',
  'settings.deleteAccount.confirm': 'Hesabı kalıcı olarak sil',
  'settings.deleteAccount.done': 'Tüm veriler ve hesap silindi.',
  'settings.deleteAccount.wrongPassword': 'Parola yanlış. Lütfen tekrar deneyin.',
  'settings.deleteAccount.ownerRemote':
    'Hesabınız bu bilgisayardaki uzaktan erişimin sahibidir. Silindiğinde uzaktan erişim kapatılır ve ayarları (DuckDNS adresi ve belirteci, sertifika) silinir; kalan hesaplardan en eskisi sahibi olur ve onu yeniden kurabilir.',
  'settings.deleteAccount.ownerMail':
    'Hesabınız bu bilgisayardaki parola sıfırlama e-postasının sahibidir. Silindiğinde e-posta gönderimi kapatılır ve ayarları (gönderen hesap ve uygulama şifresi) silinir; kalan hesaplardan en eskisi sahibi olur ve onu yeniden kurabilir.',
  'settings.deleteAccount.ownerBoth':
    'Hesabınız bu bilgisayardaki uzaktan erişimin ve parola sıfırlama e-postasının sahibidir. Silindiğinde ikisi de kapatılır ve ayarları (DuckDNS adresi ve belirteci, sertifika, gönderen hesap ve uygulama şifresi) silinir; kalan hesaplardan en eskisi bunların sahibi olur ve onları yeniden kurabilir.',
  // The owner line on the Your Personal Diary server (hosted mode): its owner is DIARY_OWNER_ID only, and deleting
  // the owner erases the mail settings and promotes nobody (server/src/hosted/owner.ts, docs/API.md "בעלות").
  'settings.deleteAccount.ownerHosted':
    'Hesabınız günlük sunucusunun sahibidir. Silindiğinde tüm hesaplar için parola sıfırlama e-postaları durur ve e-posta ayarları (gönderen hesap ve uygulama şifresi) silinir. Başka hiçbir hesap sahip olmaz; bu yüzden kimse "Sunucu" kartını açamaz ve sunucu arşivi hazırlayamaz. Yeniden hesap oluşturursanız yeni hesabınız yeni bir hesap kimliği alır ve sunucudaki DIARY_OWNER_ID değerinin yeniden bu kimliğe ayarlanması gerekir.',

  // Diagnostics card (src/pages/settings/DiagnosticsSection.tsx, desktop only)
  'settings.diagnostics.title': 'Tanılama',
  'settings.diagnostics.hint': 'Arka planda çalışan yerel sunucu hakkında teknik bilgiler. Bir şey çalışmadığında işe yarar.',
  'settings.diagnostics.uiVersion': 'Arayüz sürümü',
  'settings.diagnostics.serverVersion': 'Sunucu sürümü',
  'settings.diagnostics.port': 'Bağlantı noktası',
  'settings.diagnostics.lanStatus': 'Ağ erişimi',
  'settings.diagnostics.lanOn': 'Açık',
  'settings.diagnostics.lanOff': 'Kapalı',
  'settings.diagnostics.startedAt': 'Başlatılma',
  'settings.diagnostics.showServerLog': 'Sunucu günlüğünü göster',
  'settings.diagnostics.hideServerLog': 'Sunucu günlüğünü gizle',
  'settings.diagnostics.serverLog': 'Sunucu günlüğü',
  'settings.diagnostics.serverLogEmpty': 'Sunucu günlüğü boş.',
  'settings.diagnostics.serverLogLoaded': 'Sunucu günlüğü yüklendi: {count, plural, one {# satır} other {# satır}}.',
  'settings.diagnostics.serverLogFailed': 'Sunucu günlüğü okunamadı.',
  'settings.diagnostics.restartServer': 'Sunucuyu yeniden başlat',
  'settings.diagnostics.restartTitle': 'Sunucu yeniden başlatılıyor',
  'settings.diagnostics.restartMessage':
    'Yerel sunucu kapatılıp yeniden başlatılacak ve arayüz, sunucuya yeniden bağlanmak için yenilenecek. "Beni hatırla" işaretli değilse yeniden giriş yapmanız gerekebilir.',
  'settings.diagnostics.restartConfirm': 'Yeniden başlat',
  'settings.diagnostics.restarting': 'Sunucu yeniden başlatılıyor. Arayüz birazdan yenilenecek.',
  'settings.diagnostics.restartFailed': 'Sunucu yeniden başlatılamadı.',

  // Data card: phone (LAN) access, desktop only (src/pages/settings/LanAccessSection.tsx)
  'settings.lan.title': 'Ev ağında telefondan erişim',
  'settings.lan.label': 'Ev ağında telefondan erişim',
  'settings.lan.hint':
    'Yerel sunucu ev Wi-Fi ağını da dinler; böylece aynı günlük telefondan açılabilir. Veriler hiçbir zaman evden çıkmaz.',
  'settings.lan.onlyFromComputer': 'Telefondan erişim yalnızca günlüğün kurulu olduğu bilgisayardan açılıp kapatılabilir.',
  'settings.lan.enabled': 'Telefondan erişim açıldı.',
  'settings.lan.disabled': 'Telefondan erişim kapatıldı.',
  'settings.lan.ownerOnly': 'Telefondan erişimi yalnızca bu bilgisayarın sahibi olan hesap (bilgisayarda oluşturulan ilk hesap) açıp kapatabilir.',
  'settings.lan.statusOn': 'Telefondan erişim açık.',
  'settings.lan.statusOff': 'Telefondan erişim kapalı.',
  'settings.lan.confirmTitle': 'Telefondan erişimi aç',
  'settings.lan.confirmMessage': 'Ev ağındaki telefonlar ve bilgisayarlar günlüğün giriş sayfasını açabilecek. Onaylamak için hesap parolanızı girin.',
  'settings.lan.urlsTitle': 'Telefonda açılacak adresler',
  'settings.lan.noUrls': 'Ağ adresi bulunamadı. Bilgisayarın Wi-Fi ağına bağlı olduğundan emin olup tekrar deneyin.',
  'settings.lan.copy': 'Kopyala',
  'settings.lan.copyName': 'Kopyala: {url}',
  'settings.lan.copied': '{url} adresi kopyalandı.',
  'settings.lan.copyFailed': 'Kopyalama başarısız oldu. Adresi seçip elle kopyalayabilirsiniz.',
  'settings.lan.instructionsTitle': 'Telefondan nasıl bağlanılır',
  'settings.lan.instructions.sameNetwork': 'Telefonun bilgisayarla aynı Wi-Fi ağına bağlı olduğundan emin olun.',
  'settings.lan.instructions.openUrl':
    'Yukarıdaki adreslerden birini telefonun tarayıcısında açın ve aynı kullanıcı adı ve parolayla giriş yapın.',
  'settings.lan.instructions.firewall': 'İlk seferde Windows Güvenlik Duvarı izin isteyebilir - yalnızca özel ağlarda erişime izin verin.',
  'settings.lan.instructions.sameServer': 'Telefon, bilgisayarda yapılanların aynısını görür; çünkü ikisi de aynı yerel sunucuyla çalışır.',

  // Backup page: backup card (src/pages/settings/BackupCreateSection.tsx)
  'settings.backup.title': 'Yedekleme',
  'settings.backup.explanation':
    'Yedek dosyası, günlüğün tamamının (kayıtlar, alışkanlıklar ve ayarlar) .mpd biçimindeki şifreli bir kopyasıdır. Güvenli bir yerde saklayın - örneğin harici bir diskte. Parola olmadan açılamaz.',
  'settings.backup.ownPassword': 'Yedek için farklı parola',
  'settings.backup.ownPasswordHint':
    'Varsayılan olarak yedek, hesap parolasıyla şifrelenir. Yalnızca bu dosya için farklı bir parola seçebilirsiniz.',
  'settings.backup.password': 'Yedek parolası',
  'settings.backup.passwordConfirm': 'Yedek parolasını onaylayın',
  'settings.backup.create': 'Yedek dosyası oluştur',
  'settings.backup.fileFilter': 'Şifreli yedek dosyası',
  'settings.backup.created': 'Yedek oluşturuldu: {fileName} ({size}).',

  // Backup page: restore card (src/pages/settings/RestoreSection.tsx)
  'settings.restore.title': 'Yedekten geri yükle',
  'settings.restore.explanation': 'Geri yükleme, mevcut günlüğü yedek dosyasının içeriğiyle değiştirir. Hesap parolası değişmez.',
  'settings.restore.pickFile': 'Yedek dosyası seçin',
  'settings.restore.fileField': 'Yedek dosyası',
  'settings.restore.fileHint': 'Bu sayfada oluşturulmuş bir .mpd dosyası.',
  'settings.restore.chosenFile': 'Dosya',
  'settings.restore.fileSize': 'Boyut',
  'settings.restore.fileStatus': 'Durum',
  'settings.restore.inspecting': 'Dosya kontrol ediliyor…',
  'settings.restore.action': 'Yedekten geri yükle',
  'settings.restore.confirmTitle': 'Yedekten geri yüklensin mi?',
  'settings.restore.warning':
    'Mevcut günlük - tüm kayıtlar, alışkanlıklar ve ayarlar - yedek dosyasının içeriğiyle değiştirilecek. Bu işlem geri alınamaz. Önce mevcut günlüğün bir yedeğini oluşturmanız önerilir.',
  'settings.restore.confirm': 'Geri yükle',
  'settings.restore.done':
    'Geri yükleme tamamlandı: {entries, plural, one {# kayıt} other {# kayıt}} ve {habits, plural, one {# alışkanlık} other {# alışkanlık}}.',
  'settings.restore.needFile': 'Bir yedek dosyası seçin',
  'settings.restore.invalidFile': 'Seçilen dosya geçerli bir yedek dosyası değil',

  // Backup page: export card (src/pages/settings/ExportSection.tsx)
  'settings.export.title': 'Dışa aktarma',
  'settings.export.explanation':
    'Dışa aktarma, kayıtların okunabilir (şifrelenmemiş) bir dosyasını oluşturur; örneğin okumak, yazdırmak veya başka bir programda kullanmak için. Dosyayı buna göre saklayın.',
  'settings.export.format': 'Biçim',
  'settings.export.formatOption.txt': 'TXT - metin',
  'settings.export.formatOption.csv': 'CSV - tablo',
  'settings.export.formatOption.json': 'JSON - tüm veriler',
  'settings.export.formatOption.pdf': 'PDF - belge',
  'settings.export.formatHint.txt': 'Her bilgisayarda ve telefonda açılan düz metin dosyası',
  'settings.export.formatHint.csv': 'Excel’de veya bir elektronik tabloda açmak için',
  'settings.export.formatHint.json': 'Tüm alanlar; başka bir programa taşımaya uygun',
  'settings.export.formatHint.pdf': 'Okumak ve yazdırmak için biçimlendirilmiş belge',
  'settings.export.filter.txt': 'Metin dosyası',
  'settings.export.filter.csv': 'CSV dosyası',
  'settings.export.filter.json': 'JSON dosyası',
  'settings.export.filter.pdf': 'PDF belgesi',
  'settings.export.from': 'Başlangıç tarihi',
  'settings.export.to': 'Bitiş tarihi',
  'settings.export.rangeHint': 'Günlüğün tamamını dışa aktarmak için boş bırakın.',
  'settings.export.rangeError': 'Bitiş tarihi, başlangıç tarihiyle aynı veya ondan sonra olmalıdır',
  'settings.export.includeHabits': 'Alışkanlıkları ve kayıtlarını dahil et',
  'settings.export.includeHabitsCsv': 'CSV dosyası yalnızca kayıtları içerir. Alışkanlıklar TXT, JSON ve PDF dosyalarına eklenir.',
  'settings.export.action': 'Dışa aktar',
  'settings.export.done': 'Dışa aktarma tamamlandı: {count, plural, one {# kayıt} other {# kayıt}}.',
  'settings.export.doneWithFile': 'Dışa aktarma tamamlandı: {count, plural, one {# kayıt} other {# kayıt}}. {fileName}',
  'settings.export.downloaded': 'Dışa aktarma tamamlandı. {fileName} dosyası indirildi.',

  // Remote access card (src/pages/settings/RemoteAccessSection.tsx; the Privacy card's confirmation in PrivacySection.tsx)
  'settings.remote.title': 'Uzaktan erişim',
  'settings.remote.intro':
    'Günlüğünüzü her yerden - telefonunuzdan veya başka bir bilgisayardan - kendi DuckDNS adresinizle açın. Günlük bu bilgisayarda kalır ve buluta hiçbir şey yüklenmez: şifreli bir HTTPS bağlantısı üzerinden yanıt veren bu bilgisayardır.',
  'settings.remote.switchLabel': 'İnternetten erişime izin ver',
  'settings.remote.switchHint':
    'Varsayılan olarak kapalıdır. Açıkken bu bilgisayar DuckDNS’e (adresinizin buraya yönelmesi için) ve Let’s Encrypt’e (güvenlik sertifikası için) bağlanır; bu nedenle çevrimdışı gizlilik modu kapatılır.',
  'settings.remote.enabled': 'Uzaktan erişim açıldı. Kurulum yaklaşık iki dakika sürebilir; aşağıdaki durum kendiliğinden güncellenir.',
  'settings.remote.disabled': 'Uzaktan erişim kapatıldı. Günlük artık internetten açılamaz.',
  'settings.remote.offlineTurnedOff': 'Uzaktan erişim DuckDNS’e ve Let’s Encrypt’e bağlandığı için çevrimdışı gizlilik modu kapatıldı.',
  'settings.remote.detailsTitle': 'Bağlantı ayrıntıları',
  'settings.remote.hostname': 'DuckDNS adresi',
  'settings.remote.hostnameHint': 'duckdns.org’da oluşturduğunuz ad; örneğin yourpersonaldiary.duckdns.org.',
  'settings.remote.hostnameInvalid': 'yourpersonaldiary.duckdns.org gibi bir DuckDNS adı girin (İngilizce harfler, rakamlar ve kısa çizgiler).',
  'settings.remote.token': 'DuckDNS belirteci (token)',
  'settings.remote.tokenHint':
    'duckdns.org’da giriş yaptıktan sonra sayfanızın üst kısmında gösterilir. Bu bilgisayarda şifreli olarak saklanır ve bir daha gösterilmez.',
  'settings.remote.tokenSaved': 'Kayıtlı bir belirteç var. Korumak için alanı boş bırakın veya değiştirmek için yeni bir belirteç girin.',
  'settings.remote.tokenMissing': 'DuckDNS belirtecinizi girin.',
  'settings.remote.tokenInvalid': 'Bir DuckDNS belirteci xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx biçimindedir (rakamlar ve a ile f arasındaki harfler).',
  'settings.remote.showToken': 'Belirteci göster',
  'settings.remote.publicPort': 'Modemdeki bağlantı noktası',
  'settings.remote.publicPortHint':
    'İnternetin bu bilgisayara ulaşmak için kullandığı bağlantı noktası. 443 standart HTTPS bağlantı noktasıdır; yalnızca internet sağlayıcınız engelliyorsa değiştirin.',
  'settings.remote.portInvalid': '1 ile 65535 arasında bir tam sayı girin.',
  'settings.remote.upnp': 'Modem bağlantı noktasını otomatik aç (UPnP)',
  'settings.remote.upnpHint': 'Çoğu ev modeminde çalışır. Çalışmazsa aşağıdaki talimatlar bağlantı noktasının elle nasıl açılacağını anlatır.',
  'settings.remote.save': 'Ayrıntıları kaydet',
  'settings.remote.saved': 'Uzaktan erişim ayrıntıları kaydedildi.',
  'settings.remote.test': 'Bağlantıyı test et',
  'settings.remote.testTitle': 'Bağlantı testi sonuçları',
  'settings.remote.testDone': 'Bağlantı testi tamamlandı: {total} kontrolden {passed} tanesi başarılı.',
  'settings.remote.statusTitle': 'Durum',
  'settings.remote.busy': 'Uzaktan erişim kuruluyor. Bu yaklaşık iki dakika sürebilir; liste kendiliğinden güncellenir.',
  'settings.remote.ready': 'Uzaktan erişim hazır. Günlüğünüzün adresi: {url}',
  'settings.remote.failed': 'Uzaktan erişim kurulamadı: {message}',
  'settings.remote.lastError': 'Son sorun: {message}',
  'settings.remote.nextRetry': 'Sonraki otomatik deneme: {time}.',
  'settings.remote.stepAt': 'Güncellenme: {time}',
  'settings.remote.state.idle': 'Başlamadı',
  'settings.remote.state.running': 'Sürüyor',
  'settings.remote.state.ok': 'Tamam',
  'settings.remote.state.error': 'Başarısız',
  'settings.remote.state.warning': 'Uyarı',
  'settings.remote.state.skipped': 'Atlandı',
  'settings.remote.step.duckdns': 'DuckDNS adresi',
  'settings.remote.step.certificate': 'Güvenlik sertifikası (Let’s Encrypt)',
  'settings.remote.step.listener': 'Güvenli bağlantı (HTTPS)',
  'settings.remote.step.upnp': 'Modem bağlantı noktası',
  'settings.remote.check.duckdns': 'DuckDNS güncellemesi',
  'settings.remote.check.upnp': 'Modem (UPnP)',
  'settings.remote.check.dns': 'Adres sorgulama (DNS)',
  'settings.remote.check.https': 'HTTPS bağlantısı',
  'settings.remote.publicIp': 'Genel IP adresi',
  'settings.remote.unknown': 'Bilinmiyor',
  'settings.remote.certificate': 'Sertifika',
  'settings.remote.certificateValid':
    '{date} tarihine kadar geçerli ({days, plural, one {# gün kaldı} other {# gün kaldı}}), veren: {issuer}. Otomatik olarak yenilenir.',
  'settings.remote.certificateStaging': 'Bu bir test sertifikasıdır (Let’s Encrypt staging); tarayıcılar bu konuda uyarı verir.',
  'settings.remote.noCertificate': 'Henüz sertifika yok.',
  'settings.remote.renew': 'Sertifikayı yenile',
  'settings.remote.renewStarted': 'Sertifika yenileme başladı. Yaklaşık iki dakika sürebilir.',
  'settings.remote.urlTitle': 'Günlüğünüzün adresi',
  'settings.remote.urlHint': 'Bu adresi telefonunuzda veya herhangi bir bilgisayarda açın, ardından kullanıcı adınız ve parolanızla giriş yapın.',
  'settings.remote.noUrl': 'Güvenli bağlantı hazır olduğunda adres burada görünür.',
  'settings.remote.qrLabel': '{url} adresinin QR kodu',
  'settings.remote.qrHint': 'Adresi açmak için kodu telefon kamerasıyla tarayın.',
  'settings.remote.instructionsTitle': 'Nasıl çalışır ve neler gerekir',
  'settings.remote.instructions.account':
    'duckdns.org’da ücretsiz bir hesap oluşturun, bir ad ekleyin (örneğin yourpersonaldiary) ve sayfada gösterilen belirteci kopyalayın.',
  'settings.remote.instructions.enter':
    'Adı ve belirteci yukarıya girin, "İnternetten erişime izin ver" seçeneğini işaretleyin, hesap parolanızı yazın ve Kaydet’i seçin.',
  'settings.remote.instructions.firstCertificate': 'İlk sertifika yaklaşık iki dakika sürebilir. Durum listesi kendiliğinden güncellenir.',
  'settings.remote.instructions.keepOn':
    'Bu bilgisayarı açık ve günlük uygulamasını çalışır durumda tutun: günlüğe yalnızca ikisi de çalışırken ulaşılabilir.',
  'settings.remote.instructions.manualForward':
    'Modem bağlantı noktası otomatik olarak açılamazsa modeminizin ayarlarını açın ve dış bağlantı noktası {publicPort} (TCP) için bu bilgisayarın {ip} adresine, {port} numaralı bağlantı noktasına yönlendirme ekleyin.',
  'settings.remote.instructions.manualForwardNoIp':
    'Modem bağlantı noktası otomatik olarak açılamazsa modeminizin ayarlarını açın ve dış bağlantı noktası {publicPort} (TCP) için bu bilgisayara (ev ağındaki adresine), {port} numaralı bağlantı noktasına yönlendirme ekleyin.',
  'settings.remote.instructions.signIn':
    'Telefonda adresi açın ve kullanıcı adınız ve parolanızla giriş yapın - yazdığınız her şey orada.',
  'settings.remote.instructions.firewall':
    'Windows Güvenlik Duvarı diary-server.exe dosyasına (Your Personal Diary’nin bir parçası) izin verilip verilmeyeceğini sorarsa izin verin (bu, yönetici onayı gerektirebilir). Aksi halde internetten gelen bağlantılar engellenir.',
  'settings.remote.instructions.atHome':
    'Evde, aynı ağdayken internet adresi açılmayabilir (birçok modem bunu desteklemez). Orada bunun yerine "Ev ağında telefondan erişim" seçeneğini kullanın.',
  'settings.remote.privacyNote':
    'Gizlilik: kayıtlarınız bu bilgisayarda kalır ve yalnızca şifreli olarak, giriş yaptığınız cihazlara iletilir. DuckDNS bu bilgisayarın genel IP adresini, Let’s Encrypt ise adres adınızı öğrenir. Adresi bilen herkes giriş sayfasına ulaşabilir; bu yüzden güçlü bir parola kullanın. Tekrarlanan hatalı parolalar diğer cihazlardan girişi 15 dakika boyunca kilitler (bu bilgisayardan her zaman giriş yapılabilir). İnternet üzerinden yeni hesap oluşturulamaz.',
  'settings.remote.offlineConflictTitle': 'Çevrimdışı gizlilik modu açılsın mı?',
  'settings.remote.offlineConflictMessage':
    'Çevrimdışı gizlilik modu, uzaktan erişimin ihtiyaç duyduğu bağlantılara (DuckDNS ve Let’s Encrypt) izin vermez. Bu modu açmak uzaktan erişimi de kapatır ve günlük artık internetten açılamaz.',
  'settings.remote.offlineConflictConfirm': 'Uzaktan erişimi kapat',
  'settings.remote.disabledByOffline': 'Uzaktan erişim kapatıldı.',
  'settings.remote.offlineConflictPassword': 'Uzaktan erişimi kapatmak için hesap parolanızı girin.',
  // Ownership and the locked card (only the account that set remote access up can view or change it).
  'settings.remote.ownerNote':
    'Bu ayarları yalnızca sizin hesabınız görüntüleyebilir veya değiştirebilir. Bu bilgisayardaki diğer hesaplar bu kartı görmez.',
  'settings.remote.setupOwnerNote':
    'Bu ayarları kaydeden hesap, bu bilgisayarda onları görüntüleyebilen veya değiştirebilen tek hesap olur.',
  'settings.remote.currentTitle': 'Geçerli ayarlar',
  'settings.remote.summary.state': 'Uzaktan erişim',
  'settings.remote.summary.on': 'Açık',
  'settings.remote.summary.off': 'Kapalı',
  'settings.remote.summary.tokenSaved': 'Kayıtlı (şifreli, hiçbir zaman gösterilmez)',
  'settings.remote.summary.upnp': 'Modem bağlantı noktasının açılması',
  'settings.remote.summary.upnpAuto': 'Otomatik (UPnP)',
  'settings.remote.summary.upnpManual': 'Elle, modem ayarlarından',
  'settings.remote.lockedHint': 'Ayarlar kilitli. Değiştirmek için "Ayarları değiştir"i seçin ve hesap parolanızı girin.',
  'settings.remote.change': 'Ayarları değiştir',
  'settings.remote.unlockTitle': 'Uzaktan erişim ayarlarını değiştir',
  'settings.remote.unlockMessage':
    'Günlüğünüzü korumak için, internetten nereden ve nasıl erişilebileceğini değiştirmeden önce hesap parolanızı girin.',
  'settings.remote.unlocked': 'Ayarlar düzenlemeye açık. Ayrıntıları değiştirin, ardından Kaydet’i seçin.',
  'settings.remote.editCancelled': 'Hiçbir değişiklik yapılmadı. Ayarlar yeniden kilitlendi.',
  'settings.remote.savedLocked': 'Uzaktan erişim ayarları kaydedildi ve yeniden kilitlendi.',
  'settings.remote.password': 'Hesap parolanız',
  'settings.remote.passwordHint':
    'Kaydetmek için gereklidir. Bundan sonra uzaktan erişimi yalnızca bu hesap görüntüleyebilir veya değiştirebilir.',
  'settings.remote.passwordMissing': 'Hesap parolanızı girin.',
  'settings.remote.wrongPassword': 'Parola yanlış.',
  // E-mail for password reset (src/pages/settings/MailSection.tsx; owner-only, locked after setup, like remote access).
  'settings.mail.title': 'Parola sıfırlama e-postası',
  'settings.mail.intro':
    'Biri parolasını unuttuğunda günlük, yeni bir parola seçmesi için ona e-postayla bir bağlantı ve bir kod gönderir. Bunun için günlüğün, gönderim yapacağı bir e-posta hesabına ihtiyacı vardır; örneğin günlük için oluşturduğunuz Gmail adresi.',
  'settings.mail.ownerNote':
    'Bu ayarları yalnızca sizin hesabınız görüntüleyebilir veya değiştirebilir. Bu bilgisayardaki diğer hesaplar bu kartı görmez.',
  'settings.mail.setupOwnerNote':
    'Bu ayarları kaydeden hesap, bu bilgisayarda onları görüntüleyebilen veya değiştirebilen tek hesap olur.',
  'settings.mail.switchLabel': 'Parola sıfırlama e-postaları gönder',
  'settings.mail.switchHint':
    'Bu seçenek açıkken günlük, posta sunucusuna yalnızca parola sıfırlama e-postaları ve test e-postaları göndermek için bağlanır.',
  'settings.mail.detailsTitle': 'Gönderen hesap',
  'settings.mail.address': 'Gmail adresi',
  'settings.mail.addressHint': 'E-postalar bu adresten, "Your Personal Diary" gönderen adıyla gönderilir.',
  'settings.mail.addressInvalid': 'Geçerli bir e-posta adresi girin.',
  'settings.mail.appPassword': 'Uygulama şifresi',
  'settings.mail.appPasswordHint':
    'Google\'ın günlük için oluşturduğu 16 harfli uygulama şifresi; normal Gmail şifreniz değil. Boşlukların önemi yoktur.',
  'settings.mail.appPasswordSaved':
    'Kayıtlı bir uygulama şifresi var (şifreli, hiçbir zaman gösterilmez). Korumak için alanı boş bırakın.',
  'settings.mail.appPasswordMissing': 'Uygulama şifresini girin.',
  'settings.mail.appPasswordGmail': 'Gmail uygulama şifresi 16 harften oluşur. Normal Gmail şifreniz burada çalışmaz.',
  'settings.mail.advanced': 'Gelişmiş: posta sunucusu',
  'settings.mail.host': 'Giden posta sunucusu (SMTP)',
  'settings.mail.hostHint': 'Gmail için: smtp.gmail.com',
  'settings.mail.hostInvalid': 'Posta sunucusunun adını girin, örneğin smtp.gmail.com.',
  'settings.mail.port': 'Bağlantı noktası',
  'settings.mail.portHint': 'SSL/TLS ile 465, STARTTLS ile 587',
  'settings.mail.portInvalid': '1 ile 65535 arasında bir bağlantı noktası numarası girin.',
  'settings.mail.security': 'Şifreleme',
  'settings.mail.security.tls': 'SSL/TLS (genellikle 465 numaralı bağlantı noktası)',
  'settings.mail.security.starttls': 'STARTTLS (genellikle 587 numaralı bağlantı noktası)',
  'settings.mail.password': 'Hesap parolanız',
  'settings.mail.passwordHint':
    'Günlük hesabınızın parolası. Kaydetmek için gereklidir; bundan sonra bu ayarları yalnızca bu hesap görüntüleyebilir veya değiştirebilir.',
  'settings.mail.passwordMissing': 'Hesap parolanızı girin.',
  'settings.mail.wrongPassword': 'Parola yanlış.',
  'settings.mail.saved': 'E-posta ayarları kaydedildi.',
  'settings.mail.savedLocked': 'E-posta ayarları kaydedildi ve kilitlendi.',
  'settings.mail.enabled': 'Parola sıfırlama e-postaları açık. Denemek için "Test e-postası gönder"i seçin.',
  'settings.mail.disabled': 'Parola sıfırlama e-postaları kapalı.',
  'settings.mail.notReady': 'Henüz e-posta gönderilemiyor: bilgiler eksik. Tamamlamak için "Ayarları değiştir"i seçin.',
  'settings.mail.currentTitle': 'Geçerli ayarlar',
  'settings.mail.summary.state': 'Parola sıfırlama e-postaları',
  'settings.mail.summary.on': 'Açık',
  'settings.mail.summary.off': 'Kapalı',
  'settings.mail.summary.address': 'Gönderen',
  'settings.mail.summary.appPassword': 'Uygulama şifresi',
  'settings.mail.summary.appPasswordSaved': 'Kayıtlı (şifreli, hiçbir zaman gösterilmez)',
  'settings.mail.summary.server': 'Posta sunucusu',
  'settings.mail.summary.serverValue': '{host}, bağlantı noktası: {port}, {security}',
  'settings.mail.lockedHint': 'Ayarlar kilitli. Değiştirmek için "Ayarları değiştir"i seçin ve hesap parolanızı girin.',
  'settings.mail.change': 'Ayarları değiştir',
  'settings.mail.unlockTitle': 'E-posta ayarlarını değiştir',
  'settings.mail.unlockMessage':
    'Günlüğünüzü korumak için, günlüğün e-posta gönderdiği hesabı değiştirmeden önce hesap parolanızı girin.',
  'settings.mail.unlocked': 'Ayarlar düzenlemeye açık. Ayrıntıları değiştirin, ardından Kaydet’i seçin.',
  'settings.mail.editCancelled': 'Hiçbir değişiklik yapılmadı. Ayarlar yeniden kilitlendi.',
  'settings.mail.test': 'Test e-postası gönder',
  'settings.mail.testHint': 'Kendi adresinize kısa bir e-posta gönderir: {email}.',
  'settings.mail.testNoEmail':
    'Hesabınızın henüz bir e-posta adresi yok. Test e-postasını almak için "Hesap" kartından bir adres ekleyin.',
  'settings.mail.testSent':
    'Test e-postası gönderildi: {email}. Gelen kutusunu (ve istenmeyen posta klasörünü) kontrol edin.',
  'settings.mail.testFailed': 'Test e-postası gönderilemedi. {message}',
  'settings.mail.instructionsTitle': 'Gmail uygulama şifresi nasıl alınır',
  'settings.mail.instructions.signIn':
    'Günlüğün e-posta göndereceği Gmail hesabıyla myaccount.google.com adresinde oturum açın.',
  'settings.mail.instructions.twoStep':
    '"Güvenlik" bölümünü açın ve 2 Adımlı Doğrulama\'yı etkinleştirin. Google, uygulama şifrelerini yalnızca 2 Adımlı Doğrulama kullanan hesaplara sunar.',
  'settings.mail.instructions.create':
    'myaccount.google.com/apppasswords adresini açın (veya Google Hesabınızda "Uygulama şifreleri" diye arayın), "Your Personal Diary" gibi bir ad yazın ve "Oluştur"u seçin.',
  'settings.mail.instructions.copy':
    'Google, 16 harfli bir şifreyi yalnızca bir kez gösterir. Bunu buradaki "Uygulama şifresi" alanına yazın (boşlukların önemi yoktur), hesap parolanızı girin ve "Kaydet"i seçin.',
  'settings.mail.instructions.test':
    '"Test e-postası gönder"i seçin ve e-postanın gelen kutunuza ulaştığını kontrol edin.',
  'settings.mail.whyAppPassword':
    'Neden uygulama şifresi? Google, e-posta programlarında normal Gmail şifresini kabul etmez; bu yüzden burada çalışmaz. Uygulama şifresi yalnızca e-posta için kullanılabilir ve Google Hesabınızdan istediğiniz zaman iptal edilebilir.',
  'settings.mail.privacyNote':
    'Uygulama şifresi bu bilgisayarda şifrelenmiş olarak saklanır ve bir daha asla gösterilmez. E-postalar yalnızca sıfırlama bağlantısını ve kodunu içerir; günlüğünüzden hiçbir şey içermez.',

  // Your Personal Diary server (src/pages/settings/PrivacySection.tsx; the published apps, the web UI it serves)
  'settings.hosted.reassurance': 'Günlüğünüz Your Personal Diary sunucusunda saklanır ve parolanızla şifrelenir.',
  'settings.hosted.serverAddress': 'Günlük sunucusu: {host}',
  'settings.hosted.offlineHint': 'Bu mod açıkken uygulamanın kendisi, günlük sunucusu dışında hiçbir ağ bağlantısı açamaz.',
  // Server card (src/pages/settings/ServerSection.tsx): hosted server, its owner only (docs/android-tasks/SERVER-CARD.md)
  'settings.server.title': 'Sunucu',
  'settings.server.intro': 'Your Personal Diary sunucusunun durumu. Bu kartı yalnızca sunucunun sahibi olarak siz görürsünüz.',
  'settings.server.refresh': 'Yenile',
  'settings.server.refreshed': 'Sunucu durumu güncellendi.',
  'settings.server.version': 'Sürüm',
  'settings.server.uptime': 'Çalışma süresi',
  'settings.server.accounts': 'Hesaplar',
  'settings.server.accountsValue': '{count} / en fazla {max}',
  'settings.server.registrations': 'Son 24 saatteki yeni hesaplar',
  'settings.server.disk': 'Disk',
  'settings.server.diskValue': '{used} kullanılıyor, {free} boş ({percent})',
  'settings.server.diskLow':
    'Diskin yalnızca {percent} kadarı boş. Birimi yakında büyütün (fly volumes extend, işletim kılavuzuna bakın): disk dolduğunda değişiklikler artık kaydedilemez.',
  'settings.server.storage': 'Diske kaydetme',
  'settings.server.storageOk': 'Sorunsuz',
  'settings.server.storageFailed': 'Sorunlu - kaydetme başarısız oluyor',
  'settings.server.storageAlert':
    'Sunucu şu anda değişiklikleri diskine kaydedemiyor. Boş alanı ve günlüğü kontrol edin (işletim kılavuzuna bakın).',
  'settings.server.lastSave': 'Son başarılı kayıt',
  'settings.server.noSaveYet': 'Sunucu başladığından beri yok',
  'settings.server.memory': 'Kullanılan bellek',
  'settings.server.gigabytes': '{value} GB',
  'settings.server.lastArchive': 'Son sunucu arşivi',
  'settings.server.noArchive': 'Henüz yok',
  'settings.server.archiveDueNone': 'Henüz sunucu arşivi yok. Aşağıda bir tane hazırlayın ve bilgisayarınıza indirin.',
  'settings.server.archiveDueOld': 'Son sunucu arşivi {days} günden eski. Aşağıda yenisini hazırlayın ve bilgisayarınıza indirin.',
  'settings.server.archive.title': 'Sunucu arşivi',
  'settings.server.archive.intro':
    'Sunucudaki tüm verilerin şifrelenmiş bir kopyası; bir felaketten sonra sunucuyu geri yüklemek için. Sunucunun diskine yazılır ve en yeni 2 tanesi saklanır; ardından onu kendi PowerShell pencerenizde bir komutla bilgisayarınıza indirirsiniz. Web sitesi veya uygulama üzerinden asla indirilemez.',
  'settings.server.archive.listTitle': 'Sunucudaki arşivler',
  'settings.server.archive.created': 'Hazırlanma zamanı',
  'settings.server.archive.size': 'Boyut',
  'settings.server.archive.download': 'İndirme komutu',
  'settings.server.archive.check': 'Kontrol komutu',
  'settings.server.archive.copyDownload': 'İndirme komutunu kopyala',
  'settings.server.archive.copyCheck': 'Kontrol komutunu kopyala',
  'settings.server.archive.copied': 'Komut kopyalandı.',
  'settings.server.archive.copyFailed': 'Kopyalama başarısız oldu. Komutu seçip elle kopyalayabilirsiniz.',
  'settings.server.archive.stepsTitle': 'Arşiv nasıl indirilir',
  'settings.server.archive.step.open': 'Bilgisayarınızda, dosyayı saklamak istediğiniz klasörde PowerShell’i açın.',
  'settings.server.archive.step.download': 'İndirme komutunu yapıştırıp Enter’a basın.',
  'settings.server.archive.step.check': 'Kontrol komutunu yapıştırıp Enter’a basın. True yazmalıdır; yazmazsa dosyayı yeniden indirin.',
  'settings.server.archive.step.keep':
    'Dosyayı çevrimdışı (örneğin harici bir diskte), parola ifadesini ise ayrı ve güvenli bir yerde saklayın.',
  'settings.server.archive.prepare': 'Sunucu arşivi hazırla',
  'settings.server.archive.formTitle': 'Yeni arşiv hazırlama',
  'settings.server.archive.password': 'Hesap parolanız',
  'settings.server.archive.passphrase': 'Arşiv parola ifadesi',
  'settings.server.archive.passphraseHint': 'En az {min} karakter. Hesap parolanız değil - ayrı bir ifade seçin ve not edin.',
  'settings.server.archive.passphraseRepeat': 'Arşiv parola ifadesi (tekrar)',
  'settings.server.archive.passphraseWarning': 'Parola ifadesi arşivi geri yüklemek için gereklidir ve kurtarılamaz.',
  'settings.server.archive.passwordMissing': 'Hesap parolanızı girin.',
  'settings.server.archive.passphraseShort': 'Arşiv parola ifadesi en az {min} karakter olmalıdır.',
  'settings.server.archive.passphraseLong': 'Arşiv parola ifadesi en fazla {max} karakter olabilir.',
  'settings.server.archive.passphraseMismatch': 'İki parola ifadesi aynı değil.',
  'settings.server.archive.submit': 'Arşivi hazırla',
  'settings.server.archive.preparing': 'Arşiv hazırlanıyor. Bu bir dakika sürebilir - bu sayfayı açık tutun.',
  'settings.server.archive.ready': '{name} arşivi ({size}) hazır. Şimdi aşağıdaki komutla indirin.',
  'settings.server.archive.busy': 'Şu anda bir arşiv hazırlanıyor.',
  'settings.server.archive.nextAt': 'Sonraki arşiv şu saatten itibaren hazırlanabilir: {time}.',
  // Deletion request by e-mail (src/pages/settings/DeletionRequest.tsx, docs/android-tasks/ADMIN-TOOL.md item 3): the card builds two commands and sends nothing
  'settings.server.deletion.title': 'E-postayla silme talebi',
  'settings.server.deletion.intro':
    'Oturum açamayan ve hesabının silinmesini e-postayla isteyen biri için. Uygulamanın kendisi hesap arayamaz veya silemez: adresi buraya yazın; kart, bilgisayarınızdaki PowerShell için yalnızca Fly oturumunuzla çalışan iki komut hazırlar. Buraya yazdığınız hiçbir şey hiçbir yere gönderilmez.',
  'settings.server.deletion.check': 'Talebin, hesapta kayıtlı adresten geldiğini kontrol edin.',
  'settings.server.deletion.email': 'Talep edenin e-posta adresi',
  'settings.server.deletion.waiting': 'Tam bir e-posta adresi yazdığınızda komutlar burada görünür.',
  'settings.server.deletion.encoded':
    'Bu adreste PowerShell’in değiştireceği karakterler var; bu yüzden komutlar onu kodlanmış olarak taşır (b64:...) ve araç kodu çözer.',
  'settings.server.deletion.find': 'Adım 1: hesabı bulun',
  'settings.server.deletion.findHint':
    'Komutu PowerShell’e yapıştırıp Enter’a basın. Hiçbir şeyi değiştirmez: hesabın kullanıcı adını, e-posta adresini, kayıt tarihini ve günlük boyutunu gösterir.',
  'settings.server.deletion.copyFind': 'Arama komutunu kopyala',
  'settings.server.deletion.username': 'Arama komutunun gösterdiği kullanıcı adı',
  'settings.server.deletion.usernameHint': 'Gösterildiği gibi aynen yazın; silme komutu o zaman aşağıda görünür.',
  'settings.server.deletion.usernameInvalid':
    'Bu bir kullanıcı adı değil: kullanıcı adı 3 ile 32 arasında harf, rakam, nokta, kısa çizgi veya alt çizgiden oluşur.',
  'settings.server.deletion.delete': 'Adım 2: hesabı silin',
  'settings.server.deletion.deleteHint':
    'Yalnızca adresi kontrol ettikten sonra çalıştırın. Hesabı ve günlüğünü kalıcı olarak siler; bu işlem geri alınamaz. Yazdırdığı tarihi kendi kaydınıza not edin.',
  'settings.server.deletion.copyDelete': 'Silme komutunu kopyala',
};
export default messages;
