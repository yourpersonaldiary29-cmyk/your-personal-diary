/** pl - mobile messages: the Android shell and the tour mode. Keys are prefixed 'mobile.'. */
const messages: Record<string, string> = {
  // Android shell (src/components/layout/MobileShell.tsx, BottomNav.tsx, MoreSheet.tsx) ---------------
  'mobile.nav.more': 'Więcej',

  // Tour mode: the "Skip" button, the banner and the settings card (guest account, nothing is saved) --
  'mobile.guest.skip': 'Pomiń - chcę się tylko rozejrzeć',
  'mobile.guest.skipHint': 'Poznaj aplikację na przykładowych danych. Nic, co napiszesz, nie zostanie zapisane.',
  'mobile.guest.started': 'Tryb zwiedzania: widzisz przykładowe dane. Nic, co napiszesz, nie zostanie zapisane.',
  'mobile.guest.name': 'gościu',
  'mobile.guest.banner': 'Tryb zwiedzania - nic, co napiszesz, nie zostanie zapisane.',
  'mobile.guest.createAccount': 'Utwórz konto',
  'mobile.guest.endTour': 'Zakończ zwiedzanie',
  'mobile.guest.ended': 'Zwiedzanie zakończone.',
  'mobile.guest.unavailable': 'Tryb zwiedzania nie jest dostępny w tej wersji.',
  'mobile.guest.settingsTitle': 'Tryb zwiedzania',
  'mobile.guest.settingsText':
    'Ustawienia konta, bezpieczeństwa i kopii zapasowej nie są dostępne w trybie zwiedzania. Utwórz konto, aby z nich korzystać.',

  // Files on the phone (WP-7): "Save to device" / "Share" of backups and exports, an opened .mpd file ---
  'mobile.files.saveToDevice': 'Zapisz na urządzeniu',
  'mobile.files.share': 'Udostępnij',
  'mobile.files.saved': 'Zapisano na urządzeniu: {fileName}',
  'mobile.files.shared': 'Udostępniono: {fileName}',
  'mobile.files.openedBackup': 'Otwarto plik kopii zapasowej: {fileName}. Sprawdź go, wpisz jego hasło i potwierdź, aby przywrócić.',
  'mobile.files.readFailed': 'Nie udało się odczytać otwartego pliku.',

  // Reminders as system notifications (WP-8): channel, texts, permission, "show habit names" ------------
  'mobile.reminders.channel': 'Przypomnienia o nawykach',
  'mobile.reminders.channelDescription': 'Przypomnienia o godzinach ustawionych dla Twoich nawyków.',
  'mobile.reminders.genericBody': 'Czas na jeden z Twoich nawyków.',
  'mobile.reminders.permissionText': 'Aby przypominać Ci także przy zamkniętej aplikacji, telefon musi zezwolić na powiadomienia dla Your Personal Diary. Przypomnienia powstają w samym telefonie - nic z niego nie wychodzi.',
  'mobile.reminders.allow': 'Zezwól na powiadomienia',
  'mobile.reminders.granted': 'Powiadomienia są dozwolone. Przypomnienia przychodzą nawet przy zamkniętej aplikacji, zwykle w ciągu kilku minut od ustawionej godziny.',
  'mobile.reminders.denied': 'Powiadomienia dla tej aplikacji są wyłączone. Dopóki nie włączysz ich w ustawieniach telefonu (Aplikacje → Your Personal Diary → Powiadomienia), przypomnienia pojawią się tylko przy otwartej aplikacji.',
  'mobile.reminders.showNames': 'Pokazuj nazwy nawyków w powiadomieniach',
  'mobile.reminders.showNamesHint': 'Wyłączone: powiadomienie mówi tylko, że czas na nawyk. Włączone: widać nazwę nawyku - także na ekranie blokady.',

  // Lock, privacy screen and biometrics (WP-9): Security card and lock screen ---------------------------
  'mobile.security.lockOnLeave': 'Blokuj, gdy opuszczam aplikację',
  'mobile.security.lockOnLeaveHint': 'Dziennik blokuje się po przejściu do innej aplikacji lub wygaszeniu ekranu; hasło otwiera go ponownie.',
  'mobile.security.privacyScreen': 'Ukryj treść w ostatnich aplikacjach i blokuj zrzuty ekranu',
  'mobile.security.privacyScreenHint': 'Aplikacja jest pustą kartą na ekranie ostatnich aplikacji, a zrzuty ekranu z niej są blokowane.',
  'mobile.security.biometric': 'Odblokuj odciskiem palca lub twarzą',
  'mobile.security.biometricHint': 'Tylko dla ekranu blokady. Logowanie i potwierdzanie wrażliwych zmian zawsze wymagają hasła.',
  'mobile.security.biometricUnavailable': 'Na tym telefonie nie skonfigurowano odblokowania odciskiem palca ani twarzą.',
  'mobile.security.saved': 'Ustawienie zapisane.',
  'mobile.lock.biometric': 'Odblokuj odciskiem palca lub twarzą',
  'mobile.lock.biometricTitle': 'Odblokuj Your Personal Diary',
  'mobile.lock.usePassword': 'Użyj hasła',
  'mobile.lock.biometricFailed': 'Odblokowanie biometryczne nie powiodło się. Wpisz hasło.',
};
export default messages;
