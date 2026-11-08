/** hu - mobile messages: the Android shell and the tour mode. Keys are prefixed 'mobile.'. */
const messages: Record<string, string> = {
  // Android shell (src/components/layout/MobileShell.tsx, BottomNav.tsx, MoreSheet.tsx) ---------------
  'mobile.nav.more': 'Továbbiak',

  // Tour mode: the "Skip" button, the banner and the settings card (guest account, nothing is saved) --
  'mobile.guest.skip': 'Kihagyás - csak körülnéznék',
  'mobile.guest.skipHint': 'Nézd meg az alkalmazást mintaadatokkal. Semmi sem mentődik el abból, amit írsz.',
  'mobile.guest.started': 'Bemutató mód: mintaadatokat látsz. Semmi sem mentődik el abból, amit írsz.',
  'mobile.guest.name': 'vendég',
  'mobile.guest.banner': 'Bemutató mód - semmi sem mentődik el abból, amit írsz.',
  'mobile.guest.createAccount': 'Fiók létrehozása',
  'mobile.guest.endTour': 'Bemutató befejezése',
  'mobile.guest.ended': 'A bemutató véget ért.',
  'mobile.guest.unavailable': 'A bemutató mód ebben a verzióban nem érhető el.',
  'mobile.guest.settingsTitle': 'Bemutató mód',
  'mobile.guest.settingsText':
    'A fiók, a biztonság és a biztonsági mentés beállításai bemutató módban nem érhetők el. A használatukhoz hozz létre egy fiókot.',

  // Files on the phone (WP-7): "Save to device" / "Share" of backups and exports, an opened .mpd file ---
  'mobile.files.saveToDevice': 'Mentés az eszközre',
  'mobile.files.share': 'Megosztás',
  'mobile.files.saved': 'Mentve az eszközre: {fileName}',
  'mobile.files.shared': 'Megosztva: {fileName}',
  'mobile.files.openedBackup': 'Megnyílt egy biztonsági mentés: {fileName}. Ellenőrizze, adja meg a jelszavát, és erősítse meg a visszaállítást.',
  'mobile.files.readFailed': 'A megnyitott fájl nem olvasható.',

  // Reminders as system notifications (WP-8): channel, texts, permission, "show habit names" ------------
  'mobile.reminders.channel': 'Szokás-emlékeztetők',
  'mobile.reminders.channelDescription': 'Emlékeztetők a szokásaihoz beállított időpontokban.',
  'mobile.reminders.genericBody': 'Itt az ideje az egyik szokásának.',
  'mobile.reminders.permissionText': 'Hogy zárt alkalmazás mellett is emlékeztesse, a telefonnak engedélyeznie kell a Your Personal Diary értesítéseit. Az emlékeztetők magán a telefonon jönnek létre - semmi sem hagyja el azt.',
  'mobile.reminders.allow': 'Értesítések engedélyezése',
  'mobile.reminders.granted': 'Az értesítések engedélyezve vannak. Az emlékeztetők zárt alkalmazás mellett is megérkeznek, általában a beállított időpont után néhány percen belül.',
  'mobile.reminders.denied': 'Az értesítések ki vannak kapcsolva ehhez az alkalmazáshoz. Amíg be nem kapcsolja őket a telefon beállításaiban (Alkalmazások → Your Personal Diary → Értesítések), az emlékeztetők csak nyitott alkalmazásnál jelennek meg.',
  'mobile.reminders.showNames': 'Szokásnevek megjelenítése az értesítésekben',
  'mobile.reminders.showNamesHint': 'Kikapcsolva: az értesítés csak annyit mond, hogy itt az ideje egy szokásnak. Bekapcsolva: megjelenik a szokás neve - a lezárási képernyőn is.',

  // Lock, privacy screen and biometrics (WP-9): Security card and lock screen ---------------------------
  'mobile.security.lockOnLeave': 'Zárolás, amikor elhagyom az alkalmazást',
  'mobile.security.lockOnLeaveHint': 'A napló zárolódik, ha másik alkalmazásra vált vagy kialszik a képernyő; a jelszava nyitja meg újra.',
  'mobile.security.privacyScreen': 'Tartalom elrejtése a legutóbbi alkalmazások között és képernyőképek tiltása',
  'mobile.security.privacyScreenHint': 'Az alkalmazás üres kártyaként jelenik meg a legutóbbi alkalmazások képernyőjén, és nem készíthető róla képernyőkép.',
  'mobile.security.biometric': 'Feloldás ujjlenyomattal vagy arccal',
  'mobile.security.biometricHint': 'Csak a lezárási képernyőhöz. A bejelentkezés és az érzékeny módosítások megerősítése mindig jelszót kér.',
  'mobile.security.biometricUnavailable': 'Ezen a telefonon nincs beállítva ujjlenyomatos vagy arcfelismeréses feloldás.',
  'mobile.security.saved': 'Beállítás mentve.',
  'mobile.lock.biometric': 'Feloldás ujjlenyomattal vagy arccal',
  'mobile.lock.biometricTitle': 'A Your Personal Diary feloldása',
  'mobile.lock.usePassword': 'Jelszó használata',
  'mobile.lock.biometricFailed': 'A biometrikus feloldás nem sikerült. Adja meg a jelszavát.',
};
export default messages;
