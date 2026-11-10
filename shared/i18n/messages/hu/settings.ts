/** hu - settings messages. Keys are prefixed 'settings.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Language card (src/pages/settings/LanguageSection.tsx, src/context/LanguageContext.tsx)
  'settings.language.title': 'Nyelv',
  'settings.language.label': 'A felület nyelve',
  'settings.language.hint':
    'Az egész napló azonnal a választott nyelvre vált. Bejelentkezés előtt a választás ezen az eszközön marad meg, bejelentkezés után a fiókodba mentődik.',
  'settings.language.changed': 'Nyelv módosítva: {language}',
  'settings.language.saveFailed': 'A nyelv ezen az eszközön módosult, de a fiókba mentés nem sikerült.',

  // Page titles (src/pages/SettingsPage.tsx, BackupPage.tsx)
  'settings.title': 'Beállítások',
  'settings.backup.pageTitle': 'Biztonsági mentés, visszaállítás és exportálás',
  'settings.actionCancelled': 'A művelet megszakadt.',

  // Account card (src/pages/settings/AccountSection.tsx, ProfileEditor.tsx, ChangePasswordDialog.tsx)
  'settings.account.title': 'Fiók',
  'settings.account.anonymousText':
    'A fiók-, biztonsági, emlékeztető- és adatbeállítások bejelentkezés után érhetők el. A megjelenítési beállítások fiók nélkül is megmaradnak ezen az eszközön.',
  'settings.account.setEmail': 'Megadás',
  'settings.account.setEmailTitle': 'E-mail-cím megadása',
  'settings.account.emailSaved': 'Az e-mail-cím mentve.',
  'settings.account.editDetails': 'Adatok szerkesztése',
  'settings.account.editDetailsHint': 'A keresztneved a napló tetején lévő üdvözlésben is megjelenik.',
  'settings.account.emailPassword': 'A fiókod jelszava',
  'settings.account.emailPasswordHint': 'Az e-mail-cím módosításához szükséges, mert a jelszó-visszaállító e-mailek erre a címre mennek.',
  'settings.account.profileSaved': 'Az adataid mentve.',
  'settings.account.noChanges': 'Nem történt módosítás.',
  'settings.account.changePassword': 'Jelszó módosítása',
  'settings.account.logout': 'Kijelentkezés',
  'settings.account.logoutQuestion': 'Kijelentkezel a naplóból? A visszatéréshez meg kell adnod a felhasználónevedet és a jelszavadat.',
  'settings.account.oldPassword': 'Régi jelszó',
  'settings.account.newPassword': 'Új jelszó',
  'settings.account.confirmNewPassword': 'Új jelszó megerősítése',
  'settings.account.newPasswordHint': 'Legalább {min} karakter, betűkkel és számjegyekkel',
  'settings.account.passwordChanged': 'A jelszó sikeresen módosult',
  'settings.account.wrongOldPassword': 'A régi jelszó hibás. Kérlek, próbáld újra.',
  'settings.account.passwordChangeHint': 'A jelszó módosítása újratitkosítja a naplót, és minden más eszközön kijelentkeztet.',
  // Account ID row (hosted server only): the server owner copies it to turn the owner cards on.
  'settings.account.accountId': 'Fiókazonosító',
  'settings.account.copyAccountId': 'Fiókazonosító másolása',
  'settings.account.accountIdCopied': 'Fiókazonosító kimásolva',
  'settings.account.accountIdCopyFailed': 'A másolás nem sikerült. Jelöld ki a fiókazonosítót, és másold ki kézzel.',
  'settings.account.accountIdHint': 'Erre csak a szerver tulajdonosának van szüksége, hogy bekapcsolja a tulajdonosi kártyákat.',

  // Connected devices (src/pages/settings/SessionsList.tsx)
  'settings.devices.title': 'Csatlakoztatott eszközök',
  'settings.devices.hint':
    'Az összes eszköz, amely jelenleg be van jelentkezve ebbe a fiókba. Egy eszköz leválasztása azonnal véget vet a munkamenetének.',
  'settings.devices.current': 'Ez az eszköz',
  'settings.devices.remembered': 'Emlékezz rám',
  'settings.devices.unknown': 'Névtelen eszköz',
  'settings.devices.connectedAt': 'Bejelentkezés',
  'settings.devices.lastSeen': 'Utolsó tevékenység',
  'settings.devices.revoke': 'Leválasztás',
  'settings.devices.revokeName': '{device} leválasztása',
  'settings.devices.none': 'Nincsenek csatlakoztatott eszközök.',
  'settings.devices.revoked': 'Eszköz leválasztva: „{device}”.',

  // Display card (src/pages/settings/DisplaySection.tsx)
  'settings.display.title': 'Megjelenítés',
  'settings.display.theme': 'Téma',
  'settings.display.themeOption.system': 'A rendszer beállítása szerint',
  'settings.display.themeOption.light': 'Világos',
  'settings.display.themeOption.dark': 'Sötét',
  'settings.display.themeOption.highContrast': 'Nagy kontraszt',
  'settings.display.themeChanged': 'Téma módosítva: {label}',
  'settings.display.fontScale': 'Szövegméret',
  'settings.display.fontScaleOption.small': 'Kicsi ({percent}%)',
  'settings.display.fontScaleOption.normal': 'Normál ({percent}%)',
  'settings.display.fontScaleOption.large': 'Nagy ({percent}%)',
  'settings.display.fontScaleOption.veryLarge': 'Nagyon nagy ({percent}%)',
  'settings.display.fontScaleOption.huge': 'Óriási ({percent}%)',
  'settings.display.fontScaleOption.custom': 'Egyéni ({percent}%)',
  'settings.display.fontScaleChanged': 'Szövegméret módosítva: {label}',
  'settings.display.reduceMotion': 'Kevesebb animáció',
  'settings.display.reduceMotionHint': 'Kikapcsolja az animációkat és az áttűnéseket a felületen.',
  'settings.display.reduceMotionOn': 'Kevesebb animáció: bekapcsolva.',
  'settings.display.reduceMotionOff': 'Kevesebb animáció: kikapcsolva.',
  'settings.display.firstDayOfWeek': 'A hét első napja',
  'settings.display.sunday': 'Vasárnap',
  'settings.display.monday': 'Hétfő',
  'settings.display.firstDayChanged': 'A hét első napja mostantól: {label}.',
  'settings.display.anonymousHint': 'A beállítások ebben a böngészőben maradnak meg. Bejelentkezés után a fiókodba mentődnek.',

  // Security card (src/pages/settings/SecuritySection.tsx)
  'settings.security.title': 'Biztonság',
  'settings.security.autoLock': 'Automatikus zárolás tétlenség után',
  'settings.security.autoLockHint':
    'A megadott idő után a napló zárolási képernyőt jelenít meg, és kéri a jelszót. Közben bejelentkezve maradsz.',
  'settings.security.autoLockOff': 'Ki',
  'settings.security.autoLockChanged': 'Automatikus zárolás: {label}',
  'settings.security.lockNow': 'Zárolás most',
  'settings.security.lockNowHint': 'Bármikor zárolhatod a naplót a Ctrl+L billentyűkombinációval is.',

  // Reminders card (src/pages/settings/RemindersSection.tsx)
  'settings.reminders.title': 'Emlékeztetők',
  'settings.reminders.enabled': 'Szokásemlékeztetők megjelenítése',
  'settings.reminders.hint':
    'Az emlékeztetők csak helyi értesítések – azon a számítógépen vagy abban a böngészőben, ahol a napló nyitva van. Semmi nem kerül ki innen.',
  'settings.reminders.explanation':
    'Az emlékeztető időpontját minden szokásnál külön állíthatod be a szokások oldalán. Amíg ez a beállítás ki van kapcsolva, nem jelenik meg emlékeztető.',
  'settings.reminders.on': 'Emlékeztetők bekapcsolva.',
  'settings.reminders.off': 'Emlékeztetők kikapcsolva.',
  'settings.reminders.habitsLink': 'Ugrás a szokások oldalára',

  // Privacy card (src/pages/settings/PrivacySection.tsx)
  // Link to the privacy policy page of the diary server (src/components/legal/PrivacyPolicyLink.tsx)
  'settings.privacy.policyLink': 'Adatvédelmi irányelvek',
  // TODO-TRANSLATE (docs/apple-tasks/TERMS-DIFF.md): English placeholder of the Terms-of-Use keys below - the translator replaces it and removes this line
  'settings.privacy.termsLink': 'Terms of Use',
  'settings.privacy.title': 'Adatvédelem',
  'settings.privacy.offlineLabel': 'Offline adatvédelmi mód',
  'settings.privacy.offlineHint':
    'Ha be van kapcsolva, maga az alkalmazás semmilyen hálózati kapcsolatot nem nyithat, csak a saját helyi szerverével. Csak akkor kapcsold ki, ha távoli hozzáférést használsz.',
  'settings.privacy.offlineOn': 'Offline adatvédelmi mód bekapcsolva.',
  'settings.privacy.offlineOff': 'Offline adatvédelmi mód kikapcsolva.',
  // Data card (src/pages/settings/DataSection.tsx)
  'settings.data.title': 'Adatok',
  'settings.data.reassurance': 'A naplód adatai a személyes fiókodban tárolódnak, végponttól végpontig titkosítva.',
  'settings.data.seedDemo': 'Mintaadatok betöltése',
  'settings.data.seedDemoTitle': 'Mintaadatok betöltése',
  'settings.data.seedDemoMessage':
    'A napló jelenleg üres. Körülbelül {days} napnyi kitalált bejegyzés és szokás jön létre, hogy kipróbálhasd a meglátásokat, a statisztikát és a keresést. Ezeket ugyanúgy szerkesztheted és törölheted, mint bármely más bejegyzést.',
  'settings.data.seedDemoConfirm': 'Betöltés',
  'settings.data.seedDemoDone':
    'Betöltve: {entries, plural, one {# bejegyzés} other {# bejegyzés}}, {habits, plural, one {# szokás} other {# szokás}} és {logs, plural, one {# szokásrögzítés} other {# szokásrögzítés}}.',

  // Delete account card - the last card of the page (src/pages/settings/DeleteAccountSection.tsx)
  'settings.deleteAccount.title': 'Fiók törlése',
  'settings.deleteAccount.warning':
    'A fiók törlése véglegesen eltávolítja a fiókot a naplójával, szokásaival és beállításaival együtt, és minden eszközön kijelentkezteti. Nem állítható vissza. A máshová mentett biztonsági mentéseidet ez nem érinti.',
  'settings.deleteAccount.button': 'Fiók törlése',
  'settings.deleteAccount.dialogTitle': 'Törlöd a(z) „{username}” fiókot?',
  'settings.deleteAccount.passwordHint': 'A megerősítéshez add meg a fiók jelszavát.',
  'settings.deleteAccount.understand': 'Tudomásul veszem, hogy ez nem vonható vissza',
  'settings.deleteAccount.confirm': 'Fiók végleges törlése',
  'settings.deleteAccount.done': 'Minden adat és a fiók törölve.',
  'settings.deleteAccount.wrongPassword': 'Hibás jelszó. Kérlek, próbáld újra.',
  'settings.deleteAccount.ownerRemote':
    'A fiókod a távoli hozzáférés tulajdonosa ezen a számítógépen. Törlésekor a távoli hozzáférés kikapcsol, a beállításai (DuckDNS-cím és -token, tanúsítvány) pedig törlődnek; a megmaradt fiókok közül a legrégebbi lesz a tulajdonos, és újra beállíthatja.',
  'settings.deleteAccount.ownerMail':
    'A fiókod a jelszó-visszaállító e-mail tulajdonosa ezen a számítógépen. Törlésekor az e-mailek küldése kikapcsol, a beállításai (küldő fiók és alkalmazásjelszó) pedig törlődnek; a megmaradt fiókok közül a legrégebbi lesz a tulajdonos, és újra beállíthatja.',
  'settings.deleteAccount.ownerBoth':
    'A fiókod a távoli hozzáférés és a jelszó-visszaállító e-mail tulajdonosa ezen a számítógépen. Törlésekor mindkettő kikapcsol, a beállításaik (DuckDNS-cím és -token, tanúsítvány, küldő fiók és alkalmazásjelszó) pedig törlődnek; a megmaradt fiókok közül a legrégebbi lesz a tulajdonosuk, és újra beállíthatja őket.',
  // The owner line on the Your Personal Diary server (hosted mode): its owner is DIARY_OWNER_ID only, and deleting
  // the owner erases the mail settings and promotes nobody (server/src/hosted/owner.ts, docs/API.md "בעלות").
  'settings.deleteAccount.ownerHosted':
    'A fiókod a napló szerverének tulajdonosa. Törlésekor a jelszó-visszaállító e-mailek küldése minden fiók számára leáll, az e-mail beállításai (küldő fiók és alkalmazásjelszó) pedig törlődnek. Egyetlen másik fiók sem lesz tulajdonos, így senki sem tudja majd megnyitni a „Szerver” kártyát, és szerverarchívumot sem lehet készíteni. Ha újra regisztrálsz, az új fiókod új fiókazonosítót kap, és a szerveren újra erre kell állítani a DIARY_OWNER_ID értékét.',

  // Diagnostics card (src/pages/settings/DiagnosticsSection.tsx, desktop only)
  'settings.diagnostics.title': 'Diagnosztika',
  'settings.diagnostics.hint': 'Műszaki információk a háttérben futó helyi szerverről. Hasznos, ha valami nem működik.',
  'settings.diagnostics.uiVersion': 'A felület verziója',
  'settings.diagnostics.serverVersion': 'A szerver verziója',
  'settings.diagnostics.port': 'Port',
  'settings.diagnostics.lanStatus': 'Hálózati hozzáférés',
  'settings.diagnostics.lanOn': 'Be',
  'settings.diagnostics.lanOff': 'Ki',
  'settings.diagnostics.startedAt': 'Indítás ideje',
  'settings.diagnostics.showServerLog': 'Szervernapló megjelenítése',
  'settings.diagnostics.hideServerLog': 'Szervernapló elrejtése',
  'settings.diagnostics.serverLog': 'Szervernapló',
  'settings.diagnostics.serverLogEmpty': 'A szervernapló üres.',
  'settings.diagnostics.serverLogLoaded': 'Szervernapló betöltve: {count, plural, one {# sor} other {# sor}}.',
  'settings.diagnostics.serverLogFailed': 'A szervernaplót nem sikerült beolvasni.',
  'settings.diagnostics.restartServer': 'A szerver újraindítása',
  'settings.diagnostics.restartTitle': 'A szerver újraindítása',
  'settings.diagnostics.restartMessage':
    'A helyi szerver leáll, majd újraindul, a felület pedig újratöltődik, hogy újra csatlakozzon hozzá. Ha az „Emlékezz rám” nem volt bejelölve, lehet, hogy újra be kell jelentkezned.',
  'settings.diagnostics.restartConfirm': 'Újraindítás',
  'settings.diagnostics.restarting': 'A szerver újraindul. A felület hamarosan újratöltődik.',
  'settings.diagnostics.restartFailed': 'A szerver újraindítása nem sikerült.',

  // Data card: phone (LAN) access, desktop only (src/pages/settings/LanAccessSection.tsx)
  'settings.lan.title': 'Telefonos hozzáférés az otthoni hálózaton',
  'settings.lan.label': 'Telefonos hozzáférés az otthoni hálózaton',
  'settings.lan.hint':
    'A helyi szerver az otthoni Wi-Fi-hálózaton is elérhető lesz, így ugyanazt a naplót a telefonodon is megnyithatod. Az adatok soha nem hagyják el az otthonodat.',
  'settings.lan.onlyFromComputer': 'A telefonos hozzáférést csak azon a számítógépen lehet be- vagy kikapcsolni, amelyre a napló telepítve van.',
  'settings.lan.enabled': 'Telefonos hozzáférés bekapcsolva.',
  'settings.lan.disabled': 'Telefonos hozzáférés kikapcsolva.',
  'settings.lan.ownerOnly': 'A telefonos hozzáférést csak a számítógép tulajdonosának fiókja (az elsőként létrehozott fiók) kapcsolhatja be vagy ki.',
  'settings.lan.statusOn': 'A telefonos hozzáférés be van kapcsolva.',
  'settings.lan.statusOff': 'A telefonos hozzáférés ki van kapcsolva.',
  'settings.lan.confirmTitle': 'Telefonos hozzáférés bekapcsolása',
  'settings.lan.confirmMessage': 'Az otthoni hálózat telefonjai és számítógépei megnyithatják a napló bejelentkezési oldalát. A megerősítéshez add meg a fiókod jelszavát.',
  'settings.lan.urlsTitle': 'A telefonon megnyitható címek',
  'settings.lan.noUrls': 'Nem található hálózati cím. Ellenőrizd, hogy a számítógép csatlakozik-e a Wi-Fi-hez, majd próbáld újra.',
  'settings.lan.copy': 'Másolás',
  'settings.lan.copyName': '{url} másolása',
  'settings.lan.copied': 'Cím kimásolva: {url}',
  'settings.lan.copyFailed': 'A másolás nem sikerült. A címet kijelölheted és kézzel is kimásolhatod.',
  'settings.lan.instructionsTitle': 'Csatlakozás a telefonról',
  'settings.lan.instructions.sameNetwork': 'Győződj meg róla, hogy a telefon ugyanahhoz a Wi-Fi-hálózathoz csatlakozik, mint a számítógép.',
  'settings.lan.instructions.openUrl':
    'Nyisd meg a fenti címek egyikét a telefon böngészőjében, és jelentkezz be ugyanazzal a felhasználónévvel és jelszóval.',
  'settings.lan.instructions.firewall':
    'Az első alkalommal a Windows tűzfal engedélyt kérhet – csak magánhálózatokon engedélyezd a hozzáférést.',
  'settings.lan.instructions.sameServer':
    'A telefon pontosan azt látja, ami a számítógépen történik, mert mindkettő ugyanazzal a helyi szerverrel dolgozik.',

  // Backup page: backup card (src/pages/settings/BackupCreateSection.tsx)
  'settings.backup.title': 'Biztonsági mentés',
  'settings.backup.explanation':
    'A mentési fájl a teljes napló (bejegyzések, szokások és beállítások) titkosított másolata .mpd formátumban. Tartsd biztonságos helyen – például külső meghajtón. Jelszó nélkül nem nyitható meg.',
  'settings.backup.ownPassword': 'Külön jelszó a mentéshez',
  'settings.backup.ownPasswordHint':
    'Alapértelmezés szerint a mentést a fiók jelszava titkosítja. Csak ehhez a fájlhoz választhatsz másik jelszót is.',
  'settings.backup.password': 'A mentés jelszava',
  'settings.backup.passwordConfirm': 'A mentés jelszavának megerősítése',
  'settings.backup.create': 'Mentési fájl létrehozása',
  'settings.backup.fileFilter': 'Titkosított mentési fájl',
  'settings.backup.created': 'A biztonsági mentés elkészült: {fileName} ({size}).',

  // Backup page: restore card (src/pages/settings/RestoreSection.tsx)
  'settings.restore.title': 'Visszaállítás biztonsági mentésből',
  'settings.restore.explanation': 'A visszaállítás a jelenlegi naplót a mentési fájl tartalmára cseréli. A fiók jelszava nem változik.',
  'settings.restore.pickFile': 'Mentési fájl kiválasztása',
  'settings.restore.fileField': 'Mentési fájl',
  'settings.restore.fileHint': 'Ezen az oldalon létrehozott .mpd fájl.',
  'settings.restore.chosenFile': 'Fájl',
  'settings.restore.fileSize': 'Méret',
  'settings.restore.fileStatus': 'Állapot',
  'settings.restore.inspecting': 'A fájl ellenőrzése…',
  'settings.restore.action': 'Visszaállítás a mentésből',
  'settings.restore.confirmTitle': 'Visszaállítod a mentést?',
  'settings.restore.warning':
    'A jelenlegi napló – az összes bejegyzés, szokás és beállítás – a mentési fájl tartalmára cserélődik. Ez nem vonható vissza. Érdemes előbb biztonsági mentést készíteni a jelenlegi naplóról.',
  'settings.restore.confirm': 'Visszaállítás',
  'settings.restore.done':
    'A visszaállítás kész: {entries, plural, one {# bejegyzés} other {# bejegyzés}} és {habits, plural, one {# szokás} other {# szokás}}.',
  'settings.restore.needFile': 'Válassz ki egy mentési fájlt',
  'settings.restore.invalidFile': 'A kiválasztott fájl nem érvényes mentési fájl',

  // Backup page: export card (src/pages/settings/ExportSection.tsx)
  'settings.export.title': 'Exportálás',
  'settings.export.explanation':
    'Az exportálás olvasható (titkosítatlan) fájlt készít a bejegyzésekből, például olvasáshoz, nyomtatáshoz vagy más programban való felhasználáshoz. Ennek megfelelően tárold.',
  'settings.export.format': 'Formátum',
  'settings.export.formatOption.txt': 'TXT – szöveg',
  'settings.export.formatOption.csv': 'CSV – táblázat',
  'settings.export.formatOption.json': 'JSON – teljes adatok',
  'settings.export.formatOption.pdf': 'PDF – dokumentum',
  'settings.export.formatHint.txt': 'Egyszerű szövegfájl, amely bármely számítógépen és telefonon megnyílik',
  'settings.export.formatHint.csv': 'Excelben vagy más táblázatkezelőben való megnyitáshoz',
  'settings.export.formatHint.json': 'Minden mező, más programba való átvitelhez',
  'settings.export.formatHint.pdf': 'Formázott dokumentum olvasáshoz és nyomtatáshoz',
  'settings.export.filter.txt': 'Szövegfájl',
  'settings.export.filter.csv': 'CSV-fájl',
  'settings.export.filter.json': 'JSON-fájl',
  'settings.export.filter.pdf': 'PDF-dokumentum',
  'settings.export.from': 'Kezdő dátum',
  'settings.export.to': 'Záró dátum',
  'settings.export.rangeHint': 'A teljes napló exportálásához hagyd üresen.',
  'settings.export.rangeError': 'A záró dátum nem lehet korábbi a kezdő dátumnál',
  'settings.export.includeHabits': 'A szokások és rögzítéseik hozzáadása',
  'settings.export.includeHabitsCsv': 'A CSV-fájl csak a bejegyzéseket tartalmazza. A szokások a TXT, a JSON és a PDF formátumba kerülnek bele.',
  'settings.export.action': 'Exportálás',
  'settings.export.done': 'Az exportálás kész: {count, plural, one {# bejegyzés} other {# bejegyzés}}.',
  'settings.export.doneWithFile': 'Az exportálás kész: {count, plural, one {# bejegyzés} other {# bejegyzés}}. {fileName}',
  'settings.export.downloaded': 'Az exportálás kész. Letöltött fájl: {fileName}',

  // Remote access card (src/pages/settings/RemoteAccessSection.tsx; the Privacy card's confirmation in PrivacySection.tsx)
  'settings.remote.title': 'Távoli hozzáférés',
  'settings.remote.intro':
    'Nyisd meg a naplódat bárhonnan – a telefonodról vagy egy másik számítógépről – a saját DuckDNS-címeden. A napló ezen a számítógépen marad, és semmi nem kerül felhőbe: ez a számítógép titkosított HTTPS-kapcsolaton keresztül válaszol.',
  'settings.remote.switchLabel': 'Hozzáférés engedélyezése az internetről',
  'settings.remote.switchHint':
    "Alapértelmezés szerint ki van kapcsolva. Amíg be van kapcsolva, ez a számítógép kapcsolatba lép a DuckDNS-szel (hogy a címed ide mutasson) és a Let's Encrypttel (a biztonsági tanúsítvány miatt), ezért az offline adatvédelmi mód kikapcsol.",
  'settings.remote.enabled': 'A távoli hozzáférés bekapcsolva. A beállítás körülbelül két percig tarthat; az alábbi állapot magától frissül.',
  'settings.remote.disabled': 'A távoli hozzáférés kikapcsolva. A napló már nem nyitható meg az internetről.',
  'settings.remote.offlineTurnedOff':
    "Az offline adatvédelmi mód kikapcsolt, mert a távoli hozzáférés a DuckDNS-hez és a Let's Encrypthez kapcsolódik.",
  'settings.remote.detailsTitle': 'Kapcsolati adatok',
  'settings.remote.hostname': 'DuckDNS-cím',
  'settings.remote.hostnameHint': 'A duckdns.org oldalon létrehozott név, például yourpersonaldiary.duckdns.org.',
  'settings.remote.hostnameInvalid':
    'Adj meg egy DuckDNS-nevet, például yourpersonaldiary.duckdns.org (angol betűk, számjegyek és kötőjelek).',
  'settings.remote.token': 'DuckDNS-token',
  'settings.remote.tokenHint':
    'Bejelentkezés után a duckdns.org oldalon, a saját oldalad tetején látható. Titkosítva tárolódik ezen a számítógépen, és soha többé nem jelenik meg.',
  'settings.remote.tokenSaved': 'Van mentett token. Hagyd üresen a mezőt, ha megtartanád, vagy adj meg új tokent a cseréjéhez.',
  'settings.remote.tokenMissing': 'Add meg a DuckDNS-tokenedet.',
  'settings.remote.tokenInvalid': 'A DuckDNS-token így néz ki: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (számjegyek és a–f betűk).',
  'settings.remote.showToken': 'Token megjelenítése',
  'settings.remote.publicPort': 'Port a routeren',
  'settings.remote.publicPortHint':
    'Az a port, amelyen keresztül az internet eléri ezt a számítógépet. A 443 a szabványos HTTPS-port; csak akkor változtasd meg, ha az internetszolgáltatód letiltja.',
  'settings.remote.portInvalid': 'Adj meg egy 1 és 65535 közötti egész számot.',
  'settings.remote.upnp': 'A routerport automatikus megnyitása (UPnP)',
  'settings.remote.upnpHint':
    'A legtöbb otthoni routerrel működik. Ha mégsem, az alábbi útmutató leírja, hogyan nyithatod meg a portot kézzel.',
  'settings.remote.save': 'Adatok mentése',
  'settings.remote.saved': 'A távoli hozzáférés adatai mentve.',
  'settings.remote.test': 'Kapcsolat tesztelése',
  'settings.remote.testTitle': 'A kapcsolatteszt eredménye',
  'settings.remote.testDone': 'A kapcsolatteszt befejeződött: sikeres ellenőrzések: {passed}/{total}.',
  'settings.remote.statusTitle': 'Állapot',
  'settings.remote.busy': 'A távoli hozzáférés beállítása folyamatban. Körülbelül két percig tarthat; a lista magától frissül.',
  'settings.remote.ready': 'A távoli hozzáférés kész. A naplód címe: {url}',
  'settings.remote.failed': 'A távoli hozzáférést nem sikerült beállítani: {message}',
  'settings.remote.lastError': 'Utolsó probléma: {message}',
  'settings.remote.nextRetry': 'Következő automatikus próbálkozás: {time}.',
  'settings.remote.stepAt': 'Frissítve: {time}',
  'settings.remote.state.idle': 'Nem indult el',
  'settings.remote.state.running': 'Folyamatban',
  'settings.remote.state.ok': 'Kész',
  'settings.remote.state.error': 'Sikertelen',
  'settings.remote.state.warning': 'Figyelmeztetés',
  'settings.remote.state.skipped': 'Kihagyva',
  'settings.remote.step.duckdns': 'DuckDNS-cím',
  'settings.remote.step.certificate': "Biztonsági tanúsítvány (Let's Encrypt)",
  'settings.remote.step.listener': 'Biztonságos kapcsolat (HTTPS)',
  'settings.remote.step.upnp': 'Routerport',
  'settings.remote.check.duckdns': 'DuckDNS-frissítés',
  'settings.remote.check.upnp': 'Router (UPnP)',
  'settings.remote.check.dns': 'Címfeloldás (DNS)',
  'settings.remote.check.https': 'HTTPS-kapcsolat',
  'settings.remote.publicIp': 'Nyilvános IP-cím',
  'settings.remote.unknown': 'Ismeretlen',
  'settings.remote.certificate': 'Tanúsítvány',
  'settings.remote.certificateValid':
    'Érvényes eddig: {date} ({days, plural, one {# nap van hátra} other {# nap van hátra}}), kiállító: {issuer}. Automatikusan megújul.',
  'settings.remote.certificateStaging': "Ez egy teszttanúsítvány (Let's Encrypt staging); a böngészők figyelmeztetni fognak miatta.",
  'settings.remote.noCertificate': 'Még nincs tanúsítvány.',
  'settings.remote.renew': 'Tanúsítvány megújítása',
  'settings.remote.renewStarted': 'A tanúsítvány megújítása elindult. Körülbelül két percig tarthat.',
  'settings.remote.urlTitle': 'A naplód címe',
  'settings.remote.urlHint':
    'Nyisd meg ezt a címet a telefonodon vagy bármely számítógépen, majd jelentkezz be a felhasználóneveddel és a jelszavaddal.',
  'settings.remote.noUrl': 'A cím itt jelenik meg, amint a biztonságos kapcsolat elkészült.',
  'settings.remote.qrLabel': 'QR-kód ehhez a címhez: {url}',
  'settings.remote.qrHint': 'Olvasd be a kódot a telefon kamerájával a cím megnyitásához.',
  'settings.remote.instructionsTitle': 'Hogyan működik, és mire van szükséged?',
  'settings.remote.instructions.account':
    'Hozz létre egy ingyenes fiókot a duckdns.org oldalon, adj hozzá egy nevet (például yourpersonaldiary), és másold ki az oldalon megjelenő tokent.',
  'settings.remote.instructions.enter':
    'Írd be fent a nevet és a tokent, jelöld be a „Hozzáférés engedélyezése az internetről” lehetőséget, add meg a fiókod jelszavát, és válaszd a Mentés gombot.',
  'settings.remote.instructions.firstCertificate':
    'Az első tanúsítvány kiállítása körülbelül két percig tarthat. Az állapotlista magától frissül.',
  'settings.remote.instructions.keepOn':
    'Hagyd bekapcsolva ezt a számítógépet, és tartsd nyitva a napló alkalmazást: a napló csak akkor érhető el, ha mindkettő fut.',
  'settings.remote.instructions.manualForward':
    'Ha a routerportot nem sikerül automatikusan megnyitni, nyisd meg a router beállításait, és irányítsd át a külső portot ({publicPort}, TCP) erre a számítógépre – cím: {ip}, port: {port}.',
  'settings.remote.instructions.manualForwardNoIp':
    'Ha a routerportot nem sikerül automatikusan megnyitni, nyisd meg a router beállításait, és irányítsd át a külső portot ({publicPort}, TCP) erre a számítógépre (az otthoni hálózaton használt címére) – port: {port}.',
  'settings.remote.instructions.signIn':
    'A telefonon nyisd meg a címet, és jelentkezz be a felhasználóneveddel és a jelszavaddal – ott lesz minden, amit írtál.',
  'settings.remote.instructions.firewall':
    'Ha a Windows tűzfal megkérdezi, engedélyezze-e a diary-server.exe programot (a Your Personal Diary része), engedélyezd (ehhez rendszergazdai jóváhagyás is kellhet). Ellenkező esetben az internetről érkező kapcsolatok le lesznek tiltva.',
  'settings.remote.instructions.atHome':
    'Otthon, ugyanazon a hálózaton az internetes cím nem mindig nyílik meg (sok router ezt nem támogatja). Ott inkább a „Telefonos hozzáférés az otthoni hálózaton” lehetőséget használd.',
  'settings.remote.privacyNote':
    "Adatvédelem: a bejegyzéseid ezen a számítógépen maradnak, és csak titkosítva jutnak el azokra az eszközökre, amelyekről bejelentkezel. A DuckDNS megismeri ennek a számítógépnek a nyilvános IP-címét, a Let's Encrypt pedig a címed nevét. Aki ismeri a címet, eljuthat a bejelentkezési oldalig, ezért használj erős jelszót; az ismételten hibás jelszavak 15 percre letiltják a más eszközökről történő bejelentkezést (erről a számítógépről mindig be lehet jelentkezni). Az interneten keresztül nem hozhatók létre új fiókok.",
  'settings.remote.offlineConflictTitle': 'Bekapcsolod az offline adatvédelmi módot?',
  'settings.remote.offlineConflictMessage':
    "Az offline adatvédelmi mód nem engedi a távoli hozzáféréshez szükséges kapcsolatokat (DuckDNS és Let's Encrypt). A bekapcsolása a távoli hozzáférést is kikapcsolja, és a napló többé nem nyitható meg az internetről.",
  'settings.remote.offlineConflictConfirm': 'Távoli hozzáférés kikapcsolása',
  'settings.remote.disabledByOffline': 'A távoli hozzáférés kikapcsolva.',
  'settings.remote.offlineConflictPassword': 'A távoli hozzáférés kikapcsolásához add meg a fiókod jelszavát.',
  // Ownership and the locked card (only the account that set remote access up can view or change it).
  'settings.remote.ownerNote':
    'Ezeket a beállításokat csak a te fiókod láthatja és módosíthatja. A számítógép többi fiókja nem látja ezt a kártyát.',
  'settings.remote.setupOwnerNote':
    'Az a fiók, amelyik elmenti ezeket a beállításokat, lesz az egyetlen fiók ezen a számítógépen, amely láthatja és módosíthatja őket.',
  'settings.remote.currentTitle': 'Jelenlegi beállítások',
  'settings.remote.summary.state': 'Távoli hozzáférés',
  'settings.remote.summary.on': 'Be',
  'settings.remote.summary.off': 'Ki',
  'settings.remote.summary.tokenSaved': 'Mentve (titkosítva, soha nem jelenik meg)',
  'settings.remote.summary.upnp': 'A routerport megnyitása',
  'settings.remote.summary.upnpAuto': 'Automatikus (UPnP)',
  'settings.remote.summary.upnpManual': 'Kézzel, a router beállításaiban',
  'settings.remote.lockedHint':
    'A beállítások zárolva vannak. A módosításhoz válaszd a „Beállítások módosítása” lehetőséget, és add meg a fiókod jelszavát.',
  'settings.remote.change': 'Beállítások módosítása',
  'settings.remote.unlockTitle': 'A távoli hozzáférés beállításainak módosítása',
  'settings.remote.unlockMessage':
    'A naplód védelme érdekében add meg a fiókod jelszavát, mielőtt módosítod, hol és hogyan érhető el az internetről.',
  'settings.remote.unlocked': 'A beállítások szerkeszthetők. Módosítsd az adatokat, majd válaszd a Mentés gombot.',
  'settings.remote.editCancelled': 'Nem történt módosítás. A beállítások ismét zárolva vannak.',
  'settings.remote.savedLocked': 'A távoli hozzáférés beállításai mentve és ismét zárolva.',
  'settings.remote.password': 'A fiókod jelszava',
  'settings.remote.passwordHint': 'A mentéshez szükséges. Ettől kezdve csak ez a fiók láthatja és módosíthatja a távoli hozzáférést.',
  'settings.remote.passwordMissing': 'Add meg a fiókod jelszavát.',
  'settings.remote.wrongPassword': 'Hibás jelszó.',
  // E-mail for password reset (src/pages/settings/MailSection.tsx; owner-only, locked after setup, like remote access).
  'settings.mail.title': 'A jelszó visszaállításához használt e-mail',
  'settings.mail.intro':
    'Ha valaki elfelejti a jelszavát, a napló e-mailben küld neki egy linket és egy kódot, amellyel újat választhat. Ehhez a naplónak szüksége van egy e-mail-fiókra, amelyről küldhet – például arra a Gmail-címre, amelyet a naplóhoz hoztál létre.',
  'settings.mail.ownerNote':
    'Ezeket a beállításokat csak a te fiókod láthatja és módosíthatja. A számítógép többi fiókja nem látja ezt a kártyát.',
  'settings.mail.setupOwnerNote':
    'Az a fiók, amelyik elmenti ezeket a beállításokat, lesz az egyetlen fiók ezen a számítógépen, amely láthatja és módosíthatja őket.',
  'settings.mail.switchLabel': 'Jelszó-visszaállító e-mailek küldése',
  'settings.mail.switchHint':
    'Amíg ez be van kapcsolva, a napló csak jelszó-visszaállító és teszt e-mailek küldéséhez kapcsolódik a levelezőszerverhez.',
  'settings.mail.detailsTitle': 'Küldő fiók',
  'settings.mail.address': 'Gmail-cím',
  'settings.mail.addressHint': 'Az e-maileket erről a címről küldjük, „Your Personal Diary” feladónévvel.',
  'settings.mail.addressInvalid': 'Adj meg egy érvényes e-mail-címet.',
  'settings.mail.appPassword': 'Alkalmazásjelszó',
  'settings.mail.appPasswordHint':
    'A 16 betűs alkalmazásjelszó, amelyet a Google a naplóhoz hozott létre – nem a szokásos Gmail-jelszavad. A szóközök nem számítanak.',
  'settings.mail.appPasswordSaved':
    'Van mentett alkalmazásjelszó (titkosítva, soha nem jelenik meg). Ha meg akarod tartani, hagyd üresen a mezőt.',
  'settings.mail.appPasswordMissing': 'Add meg az alkalmazásjelszót.',
  'settings.mail.appPasswordGmail':
    'A Gmail-alkalmazásjelszó 16 betűből áll. A szokásos Gmail-jelszavad itt nem működik.',
  'settings.mail.advanced': 'Speciális: levelezőszerver',
  'settings.mail.host': 'Kimenő levelek kiszolgálója (SMTP)',
  'settings.mail.hostHint': 'Gmail esetén: smtp.gmail.com',
  'settings.mail.hostInvalid': 'Add meg a levelezőszerver nevét, például: smtp.gmail.com.',
  'settings.mail.port': 'Port',
  'settings.mail.portHint': '465 SSL/TLS-sel, 587 STARTTLS-sel',
  'settings.mail.portInvalid': 'Adj meg egy portszámot 1 és 65535 között.',
  'settings.mail.security': 'Titkosítás',
  'settings.mail.security.tls': 'SSL/TLS (általában a 465-ös port)',
  'settings.mail.security.starttls': 'STARTTLS (általában az 587-es port)',
  'settings.mail.password': 'A fiókod jelszava',
  'settings.mail.passwordHint':
    'A naplófiókod jelszava. A mentéshez szükséges; ettől kezdve csak ez a fiók láthatja és módosíthatja ezeket a beállításokat.',
  'settings.mail.passwordMissing': 'Add meg a fiókod jelszavát.',
  'settings.mail.wrongPassword': 'Hibás jelszó.',
  'settings.mail.saved': 'Az e-mail-beállítások mentve.',
  'settings.mail.savedLocked': 'Az e-mail-beállítások mentve és zárolva.',
  'settings.mail.enabled':
    'A jelszó-visszaállító e-mailek küldése be van kapcsolva. Az ellenőrzéshez válaszd a „Teszt e-mail küldése” lehetőséget.',
  'settings.mail.disabled': 'A jelszó-visszaállító e-mailek küldése ki van kapcsolva.',
  'settings.mail.notReady':
    'Még nem lehet e-mailt küldeni: hiányosak az adatok. A kiegészítésükhöz válaszd a „Beállítások módosítása” lehetőséget.',
  'settings.mail.currentTitle': 'Jelenlegi beállítások',
  'settings.mail.summary.state': 'Jelszó-visszaállító e-mailek',
  'settings.mail.summary.on': 'Be',
  'settings.mail.summary.off': 'Ki',
  'settings.mail.summary.address': 'Feladó',
  'settings.mail.summary.appPassword': 'Alkalmazásjelszó',
  'settings.mail.summary.appPasswordSaved': 'Mentve (titkosítva, soha nem jelenik meg)',
  'settings.mail.summary.server': 'Levelezőszerver',
  'settings.mail.summary.serverValue': '{host}, port: {port}, {security}',
  'settings.mail.lockedHint':
    'A beállítások zárolva vannak. A módosításhoz válaszd a „Beállítások módosítása” lehetőséget, és add meg a fiókod jelszavát.',
  'settings.mail.change': 'Beállítások módosítása',
  'settings.mail.unlockTitle': 'Az e-mail-beállítások módosítása',
  'settings.mail.unlockMessage':
    'A naplód védelme érdekében add meg a fiókod jelszavát, mielőtt módosítod, melyik fiókról küld e-maileket a napló.',
  'settings.mail.unlocked': 'A beállítások szerkeszthetők. Módosítsd az adatokat, majd válaszd a Mentés gombot.',
  'settings.mail.editCancelled': 'Nem történt módosítás. A beállítások ismét zárolva vannak.',
  'settings.mail.test': 'Teszt e-mail küldése',
  'settings.mail.testHint': 'Rövid e-mailt küld a saját címedre: {email}.',
  'settings.mail.testNoEmail':
    'A fiókodnak még nincs e-mail-címe. A teszt e-mail fogadásához adj meg egyet a „Fiók” kártyán.',
  'settings.mail.testSent':
    'Teszt e-mail elküldve ide: {email}. Nézd meg a beérkezett leveleket (és a levélszemét mappát is).',
  'settings.mail.testFailed': 'Nem sikerült elküldeni a teszt e-mailt. {message}',
  'settings.mail.instructionsTitle': 'Így kaphatsz Gmail-alkalmazásjelszót',
  'settings.mail.instructions.signIn':
    'Jelentkezz be a myaccount.google.com oldalon abba a Gmail-fiókba, amelyről a napló küldeni fog.',
  'settings.mail.instructions.twoStep':
    'Nyisd meg a „Biztonság” részt, és kapcsold be a kétlépcsős azonosítást. A Google csak kétlépcsős azonosítással védett fiókoknak ad alkalmazásjelszót.',
  'settings.mail.instructions.create':
    'Nyisd meg a myaccount.google.com/apppasswords oldalt (vagy keress rá az „Alkalmazásjelszavak” kifejezésre a Google-fiókodban), írj be egy nevet, például „Your Personal Diary”, és válaszd a „Létrehozás” lehetőséget.',
  'settings.mail.instructions.copy':
    'A Google egyszer megjelenít egy 16 betűs jelszót. Írd be ide, az „Alkalmazásjelszó” mezőbe (a szóközök nem számítanak), add meg a fiókod jelszavát, és válaszd a „Mentés” lehetőséget.',
  'settings.mail.instructions.test':
    'Válaszd a „Teszt e-mail küldése” lehetőséget, és ellenőrizd, hogy megérkezik-e a postafiókodba.',
  'settings.mail.whyAppPassword':
    'Miért kell alkalmazásjelszó? A Google a levelezőprogramoktól nem fogadja el a szokásos Gmail-jelszót, ezért az itt nem működik. Az alkalmazásjelszó csak levelezésre használható, és a Google-fiókodban bármikor visszavonhatod.',
  'settings.mail.privacyNote':
    'Az alkalmazásjelszót titkosítva tároljuk ezen a számítógépen, és soha többé nem jelenik meg. Az e-mailek csak a visszaállító linket és kódot tartalmazzák – soha semmit a naplódból.',

  // Your Personal Diary server (src/pages/settings/PrivacySection.tsx; the published apps, the web UI it serves)
  'settings.hosted.reassurance': 'A naplód a Your Personal Diary szerveren tárolódik, a jelszavaddal titkosítva.',
  'settings.hosted.serverAddress': 'A napló szervere: {host}',
  'settings.hosted.offlineHint': 'Ha be van kapcsolva, maga az alkalmazás semmilyen hálózati kapcsolatot nem nyithat, csak a napló szerverével.',
  // Server card (src/pages/settings/ServerSection.tsx): hosted server, its owner only (docs/android-tasks/SERVER-CARD.md)
  'settings.server.title': 'Szerver',
  'settings.server.intro': 'A Your Personal Diary szerver állapota. Ezt a kártyát csak te látod, a szerver tulajdonosa.',
  'settings.server.refresh': 'Frissítés',
  'settings.server.refreshed': 'A szerver állapota frissült.',
  'settings.server.version': 'Verzió',
  'settings.server.uptime': 'Üzemidő',
  'settings.server.accounts': 'Fiókok',
  'settings.server.accountsValue': '{count} / legfeljebb {max}',
  'settings.server.registrations': 'Új fiókok az elmúlt 24 órában',
  'settings.server.disk': 'Lemez',
  'settings.server.diskValue': '{used} foglalt, {free} szabad ({percent})',
  'settings.server.diskLow':
    'A lemeznek már csak {percent} része szabad. Hamarosan növeld a kötet méretét (fly volumes extend, lásd az üzemeltetési kézikönyvet): ha a lemez megtelik, a módosításokat nem lehet többé menteni.',
  'settings.server.storage': 'Mentés a lemezre',
  'settings.server.storageOk': 'Rendben',
  'settings.server.storageFailed': 'Nincs rendben - a mentés nem sikerül',
  'settings.server.storageAlert':
    'A szerver most nem tudja a lemezére menteni a módosításokat. Ellenőrizd a szabad helyet és a naplót (lásd az üzemeltetési kézikönyvet).',
  'settings.server.lastSave': 'Utolsó sikeres mentés',
  'settings.server.noSaveYet': 'Nincs a szerver indítása óta',
  'settings.server.memory': 'Használt memória',
  'settings.server.gigabytes': '{value} GB',
  'settings.server.lastArchive': 'Utolsó szerverarchívum',
  'settings.server.noArchive': 'Még nincs',
  'settings.server.archiveDueNone': 'Még nincs szerverarchívum. Készíts egyet lent, és töltsd le a számítógépedre.',
  'settings.server.archiveDueOld':
    'Az utolsó szerverarchívum több mint {days} napos. Készíts lent egy újat, és töltsd le a számítógépedre.',
  'settings.server.archive.title': 'Szerverarchívum',
  'settings.server.archive.intro':
    'A szerver összes adatának titkosított másolata, hogy egy katasztrófa után vissza lehessen állítani. A szerver lemezére íródik, amely a 2 legújabbat őrzi meg; utána a saját PowerShell-ablakodban egy paranccsal töltöd le a számítógépedre. A weboldalon vagy az alkalmazáson keresztül soha nem tölthető le.',
  'settings.server.archive.listTitle': 'Archívumok a szerveren',
  'settings.server.archive.created': 'Elkészült',
  'settings.server.archive.size': 'Méret',
  'settings.server.archive.download': 'Letöltési parancs',
  'settings.server.archive.check': 'Ellenőrző parancs',
  'settings.server.archive.copyDownload': 'A letöltési parancs másolása',
  'settings.server.archive.copyCheck': 'Az ellenőrző parancs másolása',
  'settings.server.archive.copied': 'A parancs a vágólapra került.',
  'settings.server.archive.copyFailed': 'A másolás nem sikerült. Jelöld ki a parancsot, és másold ki kézzel.',
  'settings.server.archive.stepsTitle': 'Az archívum letöltése',
  'settings.server.archive.step.open': 'A számítógépeden nyisd meg a PowerShellt abban a mappában, ahol a fájlt tartani szeretnéd.',
  'settings.server.archive.step.download': 'Illeszd be a letöltési parancsot, és nyomd meg az Entert.',
  'settings.server.archive.step.check':
    'Illeszd be az ellenőrző parancsot, és nyomd meg az Entert. True-t kell kiírnia; ha nem, töltsd le újra a fájlt.',
  'settings.server.archive.step.keep':
    'A fájlt offline tárold (például külső meghajtón), a jelmondatot pedig egy másik biztonságos helyen.',
  'settings.server.archive.prepare': 'Szerverarchívum készítése',
  'settings.server.archive.formTitle': 'Új archívum készítése',
  'settings.server.archive.password': 'A fiókod jelszava',
  'settings.server.archive.passphrase': 'Az archívum jelmondata',
  'settings.server.archive.passphraseHint': 'Legalább {min} karakter. Nem a fiókod jelszava - válassz egy külön jelmondatot, és írd fel.',
  'settings.server.archive.passphraseRepeat': 'Az archívum jelmondata újra',
  'settings.server.archive.passphraseWarning': 'A jelmondat az archívum visszaállításához kell, és nem lehet visszaszerezni.',
  'settings.server.archive.passwordMissing': 'Add meg a fiókod jelszavát.',
  'settings.server.archive.passphraseShort': 'Az archívum jelmondatának legalább {min} karakterből kell állnia.',
  'settings.server.archive.passphraseLong': 'Az archívum jelmondata legfeljebb {max} karakterből állhat.',
  'settings.server.archive.passphraseMismatch': 'A két jelmondat nem egyezik.',
  'settings.server.archive.submit': 'Archívum készítése',
  'settings.server.archive.preparing': 'Az archívum készül. Ez egy percig is eltarthat - hagyd nyitva ezt az oldalt.',
  'settings.server.archive.ready': 'Az archívum elkészült: {name} ({size}). Töltsd le most az alábbi paranccsal.',
  'settings.server.archive.busy': 'Éppen készül egy archívum.',
  'settings.server.archive.nextAt': 'A következő archívum ettől az időponttól készíthető: {time}.',
  // Deletion request by e-mail (src/pages/settings/DeletionRequest.tsx, docs/android-tasks/ADMIN-TOOL.md item 3): the card builds two commands and sends nothing
  'settings.server.deletion.title': 'Törlési kérés e-mailben',
  'settings.server.deletion.intro':
    'Annak, aki nem tud bejelentkezni, és e-mailben kéri a fiókja törlését. Maga az alkalmazás nem tud fiókokat keresni vagy törölni: írd be ide a címet, és a kártya két parancsot készít a számítógéped PowerShelljéhez, amelyek csak a Fly-bejelentkezéseddel működnek. Semmi, amit ide írsz, nem kerül el sehová.',
  'settings.server.deletion.check': 'Ellenőrizd, hogy a kérés a fiókban regisztrált címről érkezett-e.',
  'settings.server.deletion.email': 'A kérelmező e-mail-címe',
  'settings.server.deletion.waiting': 'A parancsok itt jelennek meg, amint beírsz egy teljes e-mail-címet.',
  'settings.server.deletion.encoded':
    'Ebben a címben olyan karakterek vannak, amelyeket a PowerShell megváltoztatna, ezért a parancsok kódolva tartalmazzák (b64:...); az eszköz visszafejti.',
  'settings.server.deletion.find': '1. lépés: a fiók megkeresése',
  'settings.server.deletion.findHint':
    'Illeszd be a PowerShellbe, és nyomd meg az Entert. Semmit sem változtat: megmutatja a fiók felhasználónevét, e-mail-címét, a regisztráció dátumát és a napló méretét.',
  'settings.server.deletion.copyFind': 'A keresési parancs másolása',
  'settings.server.deletion.username': 'A keresési parancs által mutatott felhasználónév',
  'settings.server.deletion.usernameHint': 'Írd be pontosan úgy, ahogy megjelent; alatta ekkor megjelenik a törlési parancs.',
  'settings.server.deletion.usernameInvalid':
    'Ez nem felhasználónév: a felhasználónév 3–32 betűből, számjegyből, pontból, kötőjelből vagy aláhúzásjelből áll.',
  'settings.server.deletion.delete': '2. lépés: a fiók törlése',
  'settings.server.deletion.deleteHint':
    'Csak akkor futtasd, ha ellenőrizted a címet. Véglegesen törli a fiókot és a naplóját; ez nem vonható vissza. Jegyezd fel a nyilvántartásodba a dátumot, amelyet kiír.',
  'settings.server.deletion.copyDelete': 'A törlési parancs másolása',
};
export default messages;
