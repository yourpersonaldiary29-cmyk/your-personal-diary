/** cs - mobile messages: the Android shell and the tour mode. Keys are prefixed 'mobile.'. */
const messages: Record<string, string> = {
  // Android shell (src/components/layout/MobileShell.tsx, BottomNav.tsx, MoreSheet.tsx) ---------------
  'mobile.nav.more': 'Více',

  // Tour mode: the "Skip" button, the banner and the settings card (guest account, nothing is saved) --
  'mobile.guest.skip': 'Přeskočit - chci se jen porozhlédnout',
  'mobile.guest.skipHint': 'Prohlédni si aplikaci s ukázkovými daty. Nic z toho, co napíšeš, se neuloží.',
  'mobile.guest.started': 'Režim prohlídky: vidíš ukázková data. Nic z toho, co napíšeš, se neuloží.',
  'mobile.guest.name': 'hoste',
  'mobile.guest.banner': 'Režim prohlídky - nic z toho, co napíšeš, se neuloží.',
  'mobile.guest.createAccount': 'Vytvořit účet',
  'mobile.guest.endTour': 'Ukončit prohlídku',
  'mobile.guest.ended': 'Prohlídka skončila.',
  'mobile.guest.unavailable': 'Režim prohlídky není v této verzi dostupný.',
  'mobile.guest.settingsTitle': 'Režim prohlídky',
  'mobile.guest.settingsText':
    'Nastavení účtu, zabezpečení a zálohy není v režimu prohlídky dostupné. Pokud je chceš používat, vytvoř si účet.',

  // Files on the phone (WP-7): "Save to device" / "Share" of backups and exports, an opened .mpd file ---
  'mobile.files.saveToDevice': 'Uložit do zařízení',
  'mobile.files.share': 'Sdílet',
  'mobile.files.saved': 'Uloženo do zařízení: {fileName}',
  'mobile.files.shared': 'Sdíleno: {fileName}',
  'mobile.files.openedBackup': 'Byl otevřen soubor zálohy: {fileName}. Zkontrolujte jej, zadejte jeho heslo a potvrďte obnovení.',
  'mobile.files.readFailed': 'Otevřený soubor se nepodařilo přečíst.',

  // Reminders as system notifications (WP-8): channel, texts, permission, "show habit names" ------------
  'mobile.reminders.channel': 'Připomínky návyků',
  'mobile.reminders.channelDescription': 'Připomínky v časech, které jste nastavili pro své návyky.',
  'mobile.reminders.genericBody': 'Je čas na jeden z vašich návyků.',
  'mobile.reminders.permissionText': 'Aby vám telefon připomínal i při zavřené aplikaci, musí povolit oznámení pro Your Personal Diary. Připomínky vznikají přímo v telefonu - nic z něj neodchází.',
  'mobile.reminders.allow': 'Povolit oznámení',
  'mobile.reminders.granted': 'Oznámení jsou povolena. Připomínky přicházejí i při zavřené aplikaci, obvykle do několika minut od nastaveného času.',
  'mobile.reminders.denied': 'Oznámení jsou pro tuto aplikaci vypnutá. Dokud je nezapnete v nastavení telefonu (Aplikace → Your Personal Diary → Oznámení), připomínky se zobrazí jen při otevřené aplikaci.',
  'mobile.reminders.showNames': 'Zobrazovat názvy návyků v oznámeních',
  'mobile.reminders.showNamesHint': 'Vypnuto: oznámení jen říká, že je čas na návyk. Zapnuto: zobrazí se název návyku - i na zamykací obrazovce.',

  // Lock, privacy screen and biometrics (WP-9): Security card and lock screen ---------------------------
  'mobile.security.lockOnLeave': 'Zamknout, když opustím aplikaci',
  'mobile.security.lockOnLeaveHint': 'Deník se zamkne při přepnutí do jiné aplikace nebo při zhasnutí obrazovky; heslo jej znovu otevře.',
  'mobile.security.privacyScreen': 'Skrýt obsah v posledních aplikacích a blokovat snímky obrazovky',
  'mobile.security.privacyScreenHint': 'Aplikace se v přehledu posledních aplikací zobrazí jako prázdná karta a její snímky obrazovky jsou blokovány.',
  'mobile.security.biometric': 'Odemknout otiskem prstu nebo obličejem',
  'mobile.security.biometricHint': 'Jen pro zamykací obrazovku. Přihlášení a potvrzení citlivých změn vždy vyžadují heslo.',
  'mobile.security.biometricUnavailable': 'V tomto telefonu není nastaveno odemykání otiskem prstu ani obličejem.',
  'mobile.security.saved': 'Nastavení uloženo.',
  'mobile.lock.biometric': 'Odemknout otiskem prstu nebo obličejem',
  'mobile.lock.biometricTitle': 'Odemknout Your Personal Diary',
  'mobile.lock.usePassword': 'Použít heslo',
  'mobile.lock.biometricFailed': 'Biometrické odemknutí se nezdařilo. Zadejte heslo.',
};
export default messages;
