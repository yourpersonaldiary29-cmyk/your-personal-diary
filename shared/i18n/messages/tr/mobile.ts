/** tr - mobile messages: the Android shell and the tour mode. Keys are prefixed 'mobile.'. */
const messages: Record<string, string> = {
  // Android shell (src/components/layout/MobileShell.tsx, BottomNav.tsx, MoreSheet.tsx) ---------------
  'mobile.nav.more': 'Diğer',

  // Tour mode: the "Skip" button, the banner and the settings card (guest account, nothing is saved) --
  'mobile.guest.skip': 'Atla - sadece göz atmak istiyorum',
  'mobile.guest.skipHint': 'Uygulamayı örnek verilerle keşfedin. Yazdıklarınız kaydedilmez.',
  'mobile.guest.started': 'Tur modu: örnek verileri görüyorsunuz. Yazdıklarınız kaydedilmez.',
  'mobile.guest.name': 'misafir',
  'mobile.guest.banner': 'Tur modu - yazdıklarınız kaydedilmez.',
  'mobile.guest.createAccount': 'Hesap oluştur',
  'mobile.guest.endTour': 'Turu bitir',
  'mobile.guest.ended': 'Tur sona erdi.',
  'mobile.guest.unavailable': 'Tur modu bu sürümde kullanılamıyor.',
  'mobile.guest.settingsTitle': 'Tur modu',
  'mobile.guest.settingsText': 'Hesap, güvenlik ve yedekleme ayarları tur modunda kullanılamaz. Kullanmak için bir hesap oluşturun.',

  // Files on the phone (WP-7): "Save to device" / "Share" of backups and exports, an opened .mpd file ---
  'mobile.files.saveToDevice': 'Cihaza kaydet',
  'mobile.files.share': 'Paylaş',
  'mobile.files.saved': 'Cihaza kaydedildi: {fileName}',
  'mobile.files.shared': 'Paylaşıldı: {fileName}',
  'mobile.files.openedBackup': 'Bir yedek dosyası açıldı: {fileName}. Dosyayı kontrol edin, parolasını girin ve geri yüklemeyi onaylayın.',
  'mobile.files.readFailed': 'Açılan dosya okunamadı.',

  // Reminders as system notifications (WP-8): channel, texts, permission, "show habit names" ------------
  'mobile.reminders.channel': 'Alışkanlık hatırlatıcıları',
  'mobile.reminders.channelDescription': 'Alışkanlıklarınız için belirlediğiniz saatlerde hatırlatmalar.',
  'mobile.reminders.genericBody': 'Alışkanlıklarınızdan birinin zamanı geldi.',
  'mobile.reminders.permissionText': 'Uygulama kapalıyken de hatırlatabilmesi için telefonun Your Personal Diary bildirimlerine izin vermesi gerekir. Hatırlatıcılar telefonun kendisinde oluşturulur - hiçbir şey dışarı çıkmaz.',
  'mobile.reminders.allow': 'Bildirimlere izin ver',
  'mobile.reminders.granted': 'Bildirimlere izin verildi. Hatırlatıcılar uygulama kapalıyken de gelir; genellikle belirlenen saatten birkaç dakika sonra.',
  'mobile.reminders.denied': 'Bu uygulama için bildirimler kapalı. Telefon ayarlarından açana kadar (Uygulamalar → Your Personal Diary → Bildirimler) hatırlatıcılar yalnızca uygulama açıkken görünür.',
  'mobile.reminders.showNames': 'Bildirimlerde alışkanlık adlarını göster',
  'mobile.reminders.showNamesHint': 'Kapalı: bildirim yalnızca bir alışkanlığın zamanının geldiğini söyler. Açık: alışkanlığın adı gösterilir - kilit ekranında da.',

  // Lock, privacy screen and biometrics (WP-9): Security card and lock screen ---------------------------
  'mobile.security.lockOnLeave': 'Uygulamadan çıkınca kilitle',
  'mobile.security.lockOnLeaveHint': 'Başka bir uygulamaya geçtiğinizde veya ekran kapandığında günlük kilitlenir; parolanız onu yeniden açar.',
  'mobile.security.privacyScreen': 'Son uygulamalarda içeriği gizle ve ekran görüntüsünü engelle',
  'mobile.security.privacyScreenHint': 'Uygulama, son uygulamalar ekranında boş bir kart olarak görünür ve ekran görüntüsü alınamaz.',
  'mobile.security.biometric': 'Parmak izi veya yüzle kilidi aç',
  'mobile.security.biometricHint': 'Yalnızca kilit ekranı için. Oturum açma ve hassas değişiklikleri onaylama her zaman parola ister.',
  'mobile.security.biometricUnavailable': 'Bu telefonda parmak izi veya yüzle kilit açma ayarlanmamış.',
  'mobile.security.saved': 'Ayar kaydedildi.',
  'mobile.lock.biometric': 'Parmak izi veya yüzle kilidi aç',
  'mobile.lock.biometricTitle': 'Your Personal Diary kilidini aç',
  'mobile.lock.usePassword': 'Parola kullan',
  'mobile.lock.biometricFailed': 'Biyometrik kilit açma başarısız oldu. Parolanızı girin.',
};
export default messages;
