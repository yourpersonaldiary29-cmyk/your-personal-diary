/** pl - settings messages. Keys are prefixed 'settings.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Language card (src/pages/settings/LanguageSection.tsx, src/context/LanguageContext.tsx)
  'settings.language.title': 'Język',
  'settings.language.label': 'Język interfejsu',
  'settings.language.hint':
    'Cały dziennik od razu przełącza się na wybrany język. Przed zalogowaniem wybór jest zapamiętywany na tym urządzeniu, a po zalogowaniu – zapisywany na twoim koncie.',
  'settings.language.changed': 'Zmieniono język: {language}',
  'settings.language.saveFailed': 'Język zmieniono na tym urządzeniu, ale nie udało się zapisać go na koncie.',

  // Page titles (src/pages/SettingsPage.tsx, BackupPage.tsx)
  'settings.title': 'Ustawienia',
  'settings.backup.pageTitle': 'Kopia zapasowa, przywracanie i eksport',
  'settings.actionCancelled': 'Operacja została anulowana.',

  // Account card (src/pages/settings/AccountSection.tsx, ProfileEditor.tsx, ChangePasswordDialog.tsx)
  'settings.account.title': 'Konto',
  'settings.account.anonymousText':
    'Ustawienia konta, bezpieczeństwa, przypomnień i danych są dostępne po zalogowaniu. Preferencje wyświetlania są zapamiętywane na tym urządzeniu także bez konta.',
  'settings.account.setEmail': 'Ustaw',
  'settings.account.setEmailTitle': 'Ustaw adres e-mail',
  'settings.account.emailSaved': 'Adres e-mail został zapisany.',
  'settings.account.editDetails': 'Edytuj dane',
  'settings.account.editDetailsHint': 'Imię pojawia się też w powitaniu u góry dziennika.',
  'settings.account.emailPassword': 'Hasło do konta',
  'settings.account.emailPasswordHint': 'Potrzebne do zmiany adresu e-mail, bo na ten adres wysyłane są e-maile do resetowania hasła.',
  'settings.account.profileSaved': 'Twoje dane zostały zapisane.',
  'settings.account.noChanges': 'Niczego nie zmieniono.',
  'settings.account.changePassword': 'Zmień hasło',
  'settings.account.logout': 'Wyloguj się',
  'settings.account.logoutQuestion': 'Wylogować się z dziennika? Aby wrócić, trzeba będzie podać nazwę użytkownika i hasło.',
  'settings.account.oldPassword': 'Stare hasło',
  'settings.account.newPassword': 'Nowe hasło',
  'settings.account.confirmNewPassword': 'Potwierdź nowe hasło',
  'settings.account.newPasswordHint': 'Co najmniej {min} znaków, w tym litery i cyfry',
  'settings.account.passwordChanged': 'Hasło zostało zmienione',
  'settings.account.wrongOldPassword': 'Stare hasło jest nieprawidłowe. Spróbuj ponownie.',
  'settings.account.passwordChangeHint': 'Zmiana hasła powoduje ponowne zaszyfrowanie dziennika i wylogowanie na wszystkich innych urządzeniach.',
  // Account ID row (hosted server only): the server owner copies it to turn the owner cards on.
  'settings.account.accountId': 'Identyfikator konta',
  'settings.account.copyAccountId': 'Kopiuj identyfikator konta',
  'settings.account.accountIdCopied': 'Skopiowano identyfikator konta',
  'settings.account.accountIdCopyFailed': 'Nie udało się skopiować. Zaznacz identyfikator konta i skopiuj go ręcznie.',
  'settings.account.accountIdHint': 'Potrzebuje go tylko właściciel serwera, aby włączyć karty właściciela.',

  // Connected devices (src/pages/settings/SessionsList.tsx)
  'settings.devices.title': 'Połączone urządzenia',
  'settings.devices.hint':
    'Wszystkie urządzenia, które są teraz zalogowane na to konto. Odłączenie urządzenia natychmiast kończy jego sesję.',
  'settings.devices.current': 'To urządzenie',
  'settings.devices.remembered': 'Zapamiętane',
  'settings.devices.unknown': 'Urządzenie bez nazwy',
  'settings.devices.connectedAt': 'Zalogowano',
  'settings.devices.lastSeen': 'Ostatnia aktywność',
  'settings.devices.revoke': 'Odłącz',
  'settings.devices.revokeName': 'Odłącz: {device}',
  'settings.devices.none': 'Brak połączonych urządzeń.',
  'settings.devices.revoked': 'Urządzenie „{device}” zostało odłączone.',

  // Display card (src/pages/settings/DisplaySection.tsx)
  'settings.display.title': 'Wygląd',
  'settings.display.theme': 'Motyw',
  'settings.display.themeOption.system': 'Zgodnie z systemem',
  'settings.display.themeOption.light': 'Jasny',
  'settings.display.themeOption.dark': 'Ciemny',
  'settings.display.themeOption.highContrast': 'Wysoki kontrast',
  'settings.display.themeChanged': 'Zmieniono motyw: {label}',
  'settings.display.fontScale': 'Rozmiar tekstu',
  'settings.display.fontScaleOption.small': 'Mały ({percent}%)',
  'settings.display.fontScaleOption.normal': 'Normalny ({percent}%)',
  'settings.display.fontScaleOption.large': 'Duży ({percent}%)',
  'settings.display.fontScaleOption.veryLarge': 'Bardzo duży ({percent}%)',
  'settings.display.fontScaleOption.huge': 'Ogromny ({percent}%)',
  'settings.display.fontScaleOption.custom': 'Własny ({percent}%)',
  'settings.display.fontScaleChanged': 'Zmieniono rozmiar tekstu: {label}',
  'settings.display.reduceMotion': 'Ogranicz animacje',
  'settings.display.reduceMotionHint': 'Wyłącza animacje i przejścia w interfejsie.',
  'settings.display.reduceMotionOn': 'Ograniczanie animacji włączone.',
  'settings.display.reduceMotionOff': 'Ograniczanie animacji wyłączone.',
  'settings.display.firstDayOfWeek': 'Pierwszy dzień tygodnia',
  'settings.display.sunday': 'Niedziela',
  'settings.display.monday': 'Poniedziałek',
  'settings.display.firstDayChanged': 'Pierwszy dzień tygodnia: {label}.',
  'settings.display.anonymousHint': 'Preferencje są zapisywane w tej przeglądarce. Po zalogowaniu zostaną zapisane na twoim koncie.',

  // Security card (src/pages/settings/SecuritySection.tsx)
  'settings.security.title': 'Bezpieczeństwo',
  'settings.security.autoLock': 'Automatyczna blokada po bezczynności',
  'settings.security.autoLockHint': 'Po wybranym czasie dziennik wyświetla ekran blokady i prosi o hasło. Sesja pozostaje aktywna.',
  'settings.security.autoLockOff': 'Wyłączona',
  'settings.security.autoLockChanged': 'Automatyczna blokada: {label}',
  'settings.security.lockNow': 'Zablokuj teraz',
  'settings.security.lockNowHint': 'W każdej chwili możesz też zablokować dziennik skrótem Ctrl+L.',

  // Reminders card (src/pages/settings/RemindersSection.tsx)
  'settings.reminders.title': 'Przypomnienia',
  'settings.reminders.enabled': 'Pokazuj przypomnienia o nawykach',
  'settings.reminders.hint':
    'Przypomnienia to wyłącznie lokalne powiadomienia – na komputerze lub w przeglądarce, w której otwarty jest dziennik. Nic nie jest wysyłane na zewnątrz.',
  'settings.reminders.explanation':
    'Godzinę przypomnienia ustawia się osobno dla każdego nawyku na stronie nawyków. Gdy ta opcja jest wyłączona, przypomnienia się nie pojawiają.',
  'settings.reminders.on': 'Przypomnienia włączone.',
  'settings.reminders.off': 'Przypomnienia wyłączone.',
  'settings.reminders.habitsLink': 'Przejdź do strony nawyków',

  // Privacy card (src/pages/settings/PrivacySection.tsx)
  // Link to the privacy policy page of the diary server (src/components/legal/PrivacyPolicyLink.tsx)
  'settings.privacy.policyLink': 'Polityka prywatności',
  'settings.privacy.termsLink': 'Warunki korzystania',
  'settings.privacy.title': 'Prywatność',
  'settings.privacy.offlineLabel': 'Tryb prywatności offline',
  'settings.privacy.offlineHint':
    'Gdy ta opcja jest włączona, aplikacja nie może nawiązywać żadnych połączeń sieciowych poza własnym serwerem lokalnym. Wyłącz ją tylko wtedy, gdy korzystasz z dostępu zdalnego.',
  'settings.privacy.offlineOn': 'Tryb prywatności offline włączony.',
  'settings.privacy.offlineOff': 'Tryb prywatności offline wyłączony.',
  // Data card (src/pages/settings/DataSection.tsx)
  'settings.data.title': 'Dane',
  'settings.data.reassurance': 'Dane twojego dziennika są przechowywane na twoim osobistym koncie i szyfrowane end-to-end.',
  'settings.data.seedDemo': 'Wczytaj przykładowe dane',
  'settings.data.seedDemoTitle': 'Wczytywanie przykładowych danych',
  'settings.data.seedDemoMessage':
    'Dziennik jest teraz pusty. Zostaną utworzone fikcyjne wpisy i nawyki z około {days} dni, dzięki którym poznasz spostrzeżenia, statystyki i wyszukiwanie. Możesz je edytować i usuwać jak każdy inny wpis.',
  'settings.data.seedDemoConfirm': 'Wczytaj',
  'settings.data.seedDemoDone':
    'Wczytano: {entries, plural, one {# wpis} few {# wpisy} many {# wpisów} other {# wpisu}}, {habits, plural, one {# nawyk} few {# nawyki} many {# nawyków} other {# nawyku}} i {logs, plural, one {# zapis nawyku} few {# zapisy nawyków} many {# zapisów nawyków} other {# zapisu nawyków}}.',

  // Delete account card - the last card of the page (src/pages/settings/DeleteAccountSection.tsx)
  'settings.deleteAccount.title': 'Usuwanie konta',
  'settings.deleteAccount.warning':
    'Usunięcie konta trwale kasuje je razem z dziennikiem, nawykami i ustawieniami oraz wylogowuje je na wszystkich urządzeniach. Nie da się go przywrócić. Nie dotyczy to plików kopii zapasowych zapisanych w innym miejscu.',
  'settings.deleteAccount.button': 'Usuń konto',
  'settings.deleteAccount.dialogTitle': 'Usunąć konto „{username}”?',
  'settings.deleteAccount.passwordHint': 'Aby potwierdzić, wpisz hasło do konta.',
  'settings.deleteAccount.understand': 'Rozumiem, że tej operacji nie można cofnąć',
  'settings.deleteAccount.confirm': 'Usuń konto na zawsze',
  'settings.deleteAccount.done': 'Wszystkie dane i konto zostały usunięte.',
  'settings.deleteAccount.wrongPassword': 'Nieprawidłowe hasło. Spróbuj ponownie.',
  'settings.deleteAccount.ownerRemote':
    'Twoje konto jest właścicielem dostępu zdalnego na tym komputerze. Jego usunięcie wyłącza dostęp zdalny i kasuje jego ustawienia (adres i token DuckDNS, certyfikat); właścicielem zostaje najstarsze z pozostałych kont, które może skonfigurować go od nowa.',
  'settings.deleteAccount.ownerMail':
    'Twoje konto jest właścicielem e-maila do resetowania hasła na tym komputerze. Jego usunięcie wyłącza wysyłanie e-maili i kasuje ustawienia (konto nadawcy i hasło do aplikacji); właścicielem zostaje najstarsze z pozostałych kont, które może skonfigurować je od nowa.',
  'settings.deleteAccount.ownerBoth':
    'Twoje konto jest właścicielem dostępu zdalnego i e-maila do resetowania hasła na tym komputerze. Jego usunięcie wyłącza obie funkcje i kasuje ich ustawienia (adres i token DuckDNS, certyfikat, konto nadawcy i hasło do aplikacji); ich właścicielem zostaje najstarsze z pozostałych kont, które może skonfigurować je od nowa.',
  // The owner line on the Your Personal Diary server (hosted mode): its owner is DIARY_OWNER_ID only, and deleting
  // the owner erases the mail settings and promotes nobody (server/src/hosted/owner.ts, docs/API.md "בעלות").
  'settings.deleteAccount.ownerHosted':
    'Twoje konto jest właścicielem serwera dziennika. Jego usunięcie wstrzymuje wysyłanie e-maili do resetowania hasła dla wszystkich kont i kasuje ustawienia e-maila (konto nadawcy i hasło do aplikacji). Żadne inne konto nie zostaje właścicielem, więc nikt nie będzie mógł otworzyć karty „Serwer” ani przygotować archiwum serwera. Jeśli zarejestrujesz się ponownie, nowe konto otrzyma nowy identyfikator konta, który trzeba będzie ponownie ustawić na serwerze jako DIARY_OWNER_ID.',

  // Diagnostics card (src/pages/settings/DiagnosticsSection.tsx, desktop only)
  'settings.diagnostics.title': 'Diagnostyka',
  'settings.diagnostics.hint': 'Informacje techniczne o lokalnym serwerze działającym w tle. Przydają się, gdy coś nie działa.',
  'settings.diagnostics.uiVersion': 'Wersja interfejsu',
  'settings.diagnostics.serverVersion': 'Wersja serwera',
  'settings.diagnostics.port': 'Port',
  'settings.diagnostics.lanStatus': 'Dostęp sieciowy',
  'settings.diagnostics.lanOn': 'Włączony',
  'settings.diagnostics.lanOff': 'Wyłączony',
  'settings.diagnostics.startedAt': 'Uruchomiono',
  'settings.diagnostics.showServerLog': 'Pokaż log serwera',
  'settings.diagnostics.hideServerLog': 'Ukryj log serwera',
  'settings.diagnostics.serverLog': 'Log serwera',
  'settings.diagnostics.serverLogEmpty': 'Log serwera jest pusty.',
  'settings.diagnostics.serverLogLoaded':
    'Wczytano log serwera: {count, plural, one {# wiersz} few {# wiersze} many {# wierszy} other {# wiersza}}.',
  'settings.diagnostics.serverLogFailed': 'Nie udało się odczytać logu serwera.',
  'settings.diagnostics.restartServer': 'Uruchom ponownie serwer',
  'settings.diagnostics.restartTitle': 'Ponowne uruchamianie serwera',
  'settings.diagnostics.restartMessage':
    'Lokalny serwer zostanie zamknięty i uruchomiony ponownie, a interfejs przeładuje się, aby znów się z nim połączyć. Jeśli opcja „Zapamiętaj mnie” nie była zaznaczona, może być konieczne ponowne zalogowanie.',
  'settings.diagnostics.restartConfirm': 'Uruchom ponownie',
  'settings.diagnostics.restarting': 'Serwer uruchamia się ponownie. Za chwilę interfejs zostanie przeładowany.',
  'settings.diagnostics.restartFailed': 'Nie udało się ponownie uruchomić serwera.',

  // Data card: phone (LAN) access, desktop only (src/pages/settings/LanAccessSection.tsx)
  'settings.lan.title': 'Dostęp z telefonu w sieci domowej',
  'settings.lan.label': 'Dostęp z telefonu w sieci domowej',
  'settings.lan.hint':
    'Lokalny serwer będzie nasłuchiwał także w domowej sieci Wi-Fi, dzięki czemu ten sam dziennik otworzysz na telefonie. Dane nigdy nie opuszczają domu.',
  'settings.lan.onlyFromComputer': 'Dostęp z telefonu można włączyć lub wyłączyć tylko na komputerze, na którym zainstalowano dziennik.',
  'settings.lan.enabled': 'Dostęp z telefonu włączony.',
  'settings.lan.disabled': 'Dostęp z telefonu wyłączony.',
  'settings.lan.ownerOnly': 'Dostęp z telefonu może włączyć lub wyłączyć tylko konto właściciela tego komputera (pierwsze konto utworzone na nim).',
  'settings.lan.statusOn': 'Dostęp z telefonu jest włączony.',
  'settings.lan.statusOff': 'Dostęp z telefonu jest wyłączony.',
  'settings.lan.confirmTitle': 'Włącz dostęp z telefonu',
  'settings.lan.confirmMessage': 'Telefony i komputery w sieci domowej będą mogły otworzyć stronę logowania do dziennika. Aby potwierdzić, wpisz hasło do konta.',
  'settings.lan.urlsTitle': 'Adresy do otwarcia na telefonie',
  'settings.lan.noUrls': 'Nie znaleziono adresu sieciowego. Upewnij się, że komputer jest połączony z Wi-Fi, i spróbuj ponownie.',
  'settings.lan.copy': 'Kopiuj',
  'settings.lan.copyName': 'Kopiuj {url}',
  'settings.lan.copied': 'Skopiowano adres {url}.',
  'settings.lan.copyFailed': 'Nie udało się skopiować. Możesz zaznaczyć adres i skopiować go ręcznie.',
  'settings.lan.instructionsTitle': 'Jak połączyć się z telefonu',
  'settings.lan.instructions.sameNetwork': 'Upewnij się, że telefon jest połączony z tą samą siecią Wi-Fi co komputer.',
  'settings.lan.instructions.openUrl':
    'Otwórz jeden z powyższych adresów w przeglądarce telefonu i zaloguj się tą samą nazwą użytkownika i hasłem.',
  'settings.lan.instructions.firewall':
    'Za pierwszym razem Zapora systemu Windows może poprosić o zgodę – zezwól na dostęp wyłącznie w sieciach prywatnych.',
  'settings.lan.instructions.sameServer':
    'Telefon widzi dokładnie to samo co komputer, ponieważ oba urządzenia korzystają z tego samego serwera lokalnego.',

  // Backup page: backup card (src/pages/settings/BackupCreateSection.tsx)
  'settings.backup.title': 'Kopia zapasowa',
  'settings.backup.explanation':
    'Plik kopii zapasowej to zaszyfrowana kopia całego dziennika (wpisów, nawyków i ustawień) w formacie .mpd. Przechowuj go w bezpiecznym miejscu – na przykład na dysku zewnętrznym. Bez hasła nie da się go otworzyć.',
  'settings.backup.ownPassword': 'Osobne hasło do kopii zapasowej',
  'settings.backup.ownPasswordHint':
    'Domyślnie kopia zapasowa jest szyfrowana hasłem do konta. Możesz wybrać inne hasło tylko dla tego pliku.',
  'settings.backup.password': 'Hasło do kopii zapasowej',
  'settings.backup.passwordConfirm': 'Potwierdź hasło do kopii zapasowej',
  'settings.backup.create': 'Utwórz plik kopii zapasowej',
  'settings.backup.fileFilter': 'Zaszyfrowany plik kopii zapasowej',
  'settings.backup.created': 'Utworzono kopię zapasową: {fileName} ({size}).',

  // Backup page: restore card (src/pages/settings/RestoreSection.tsx)
  'settings.restore.title': 'Przywracanie z kopii zapasowej',
  'settings.restore.explanation': 'Przywrócenie zastępuje bieżący dziennik zawartością pliku kopii zapasowej. Hasło do konta się nie zmienia.',
  'settings.restore.pickFile': 'Wybierz plik kopii zapasowej',
  'settings.restore.fileField': 'Plik kopii zapasowej',
  'settings.restore.fileHint': 'Plik .mpd utworzony na tej stronie.',
  'settings.restore.chosenFile': 'Plik',
  'settings.restore.fileSize': 'Rozmiar',
  'settings.restore.fileStatus': 'Stan',
  'settings.restore.inspecting': 'Sprawdzanie pliku…',
  'settings.restore.action': 'Przywróć z kopii zapasowej',
  'settings.restore.confirmTitle': 'Przywrócić z kopii zapasowej?',
  'settings.restore.warning':
    'Bieżący dziennik – wszystkie wpisy, nawyki i ustawienia – zostanie zastąpiony zawartością pliku kopii zapasowej. Tej operacji nie można cofnąć. Zalecamy najpierw utworzyć kopię zapasową bieżącego dziennika.',
  'settings.restore.confirm': 'Przywróć',
  'settings.restore.done':
    'Przywracanie zakończone: {entries, plural, one {# wpis} few {# wpisy} many {# wpisów} other {# wpisu}} i {habits, plural, one {# nawyk} few {# nawyki} many {# nawyków} other {# nawyku}}.',
  'settings.restore.needFile': 'Wybierz plik kopii zapasowej',
  'settings.restore.invalidFile': 'Wybrany plik nie jest prawidłowym plikiem kopii zapasowej',

  // Backup page: export card (src/pages/settings/ExportSection.tsx)
  'settings.export.title': 'Eksport',
  'settings.export.explanation':
    'Eksport tworzy czytelny (niezaszyfrowany) plik z wpisami, na przykład do czytania, drukowania lub użycia w innym programie. Przechowuj go z odpowiednią ostrożnością.',
  'settings.export.format': 'Format',
  'settings.export.formatOption.txt': 'TXT – tekst',
  'settings.export.formatOption.csv': 'CSV – tabela',
  'settings.export.formatOption.json': 'JSON – pełne dane',
  'settings.export.formatOption.pdf': 'PDF – dokument',
  'settings.export.formatHint.txt': 'Zwykły plik tekstowy, który otworzysz na każdym komputerze i telefonie',
  'settings.export.formatHint.csv': 'Do otwarcia w Excelu lub innym arkuszu kalkulacyjnym',
  'settings.export.formatHint.json': 'Wszystkie pola, do przeniesienia do innego programu',
  'settings.export.formatHint.pdf': 'Sformatowany dokument do czytania i drukowania',
  'settings.export.filter.txt': 'Plik tekstowy',
  'settings.export.filter.csv': 'Plik CSV',
  'settings.export.filter.json': 'Plik JSON',
  'settings.export.filter.pdf': 'Dokument PDF',
  'settings.export.from': 'Od daty',
  'settings.export.to': 'Do daty',
  'settings.export.rangeHint': 'Pozostaw puste, aby wyeksportować cały dziennik.',
  'settings.export.rangeError': 'Data końcowa musi być taka sama jak data początkowa lub późniejsza',
  'settings.export.includeHabits': 'Dołącz nawyki i ich zapisy',
  'settings.export.includeHabitsCsv': 'Plik CSV zawiera tylko wpisy. Nawyki są dołączane w formatach TXT, JSON i PDF.',
  'settings.export.action': 'Eksportuj',
  'settings.export.done': 'Eksport zakończony: {count, plural, one {# wpis} few {# wpisy} many {# wpisów} other {# wpisu}}.',
  'settings.export.doneWithFile':
    'Eksport zakończony: {count, plural, one {# wpis} few {# wpisy} many {# wpisów} other {# wpisu}}. {fileName}',
  'settings.export.downloaded': 'Eksport zakończony. Pobrano plik {fileName}.',

  // Remote access card (src/pages/settings/RemoteAccessSection.tsx; the Privacy card's confirmation in PrivacySection.tsx)
  'settings.remote.title': 'Dostęp zdalny',
  'settings.remote.intro':
    'Otwieraj swój dziennik z dowolnego miejsca – na telefonie lub innym komputerze – pod własnym adresem DuckDNS. Dziennik pozostaje na tym komputerze i nic nie trafia do chmury: ten komputer odpowiada przez szyfrowane połączenie HTTPS.',
  'settings.remote.switchLabel': 'Zezwól na dostęp z internetu',
  'settings.remote.switchHint':
    'Domyślnie wyłączone. Gdy ta opcja jest włączona, komputer łączy się z DuckDNS (aby twój adres wskazywał na ten komputer) i z Let’s Encrypt (aby uzyskać certyfikat bezpieczeństwa), dlatego tryb prywatności offline zostaje wyłączony.',
  'settings.remote.enabled':
    'Dostęp zdalny został włączony. Konfiguracja może potrwać około dwóch minut; stan poniżej aktualizuje się automatycznie.',
  'settings.remote.disabled': 'Dostęp zdalny został wyłączony. Dziennika nie można już otworzyć z internetu.',
  'settings.remote.offlineTurnedOff':
    'Tryb prywatności offline został wyłączony, ponieważ dostęp zdalny łączy się z DuckDNS i Let’s Encrypt.',
  'settings.remote.detailsTitle': 'Dane połączenia',
  'settings.remote.hostname': 'Adres DuckDNS',
  'settings.remote.hostnameHint': 'Nazwa utworzona w serwisie duckdns.org, na przykład yourpersonaldiary.duckdns.org.',
  'settings.remote.hostnameInvalid':
    'Podaj nazwę DuckDNS, np. yourpersonaldiary.duckdns.org (litery łacińskie bez polskich znaków, cyfry i łączniki).',
  'settings.remote.token': 'Token DuckDNS',
  'settings.remote.tokenHint':
    'Widoczny u góry twojej strony w serwisie duckdns.org po zalogowaniu. Jest przechowywany na tym komputerze w postaci zaszyfrowanej i już nigdy nie jest wyświetlany.',
  'settings.remote.tokenSaved': 'Token jest zapisany. Pozostaw pole puste, aby go zachować, albo wpisz nowy token, aby go zastąpić.',
  'settings.remote.tokenMissing': 'Podaj swój token DuckDNS.',
  'settings.remote.tokenInvalid':
    'Token DuckDNS wygląda tak: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (cyfry i litery od a do f).',
  'settings.remote.showToken': 'Pokaż token',
  'settings.remote.publicPort': 'Port na routerze',
  'settings.remote.publicPortHint':
    'Port, przez który internet łączy się z tym komputerem. 443 to standardowy port HTTPS; zmień go tylko wtedy, gdy twój dostawca internetu go blokuje.',
  'settings.remote.portInvalid': 'Podaj liczbę całkowitą od 1 do 65535.',
  'settings.remote.upnp': 'Otwórz port na routerze automatycznie (UPnP)',
  'settings.remote.upnpHint':
    'Działa z większością domowych routerów. Jeśli się nie uda, instrukcje poniżej wyjaśniają, jak otworzyć port ręcznie.',
  'settings.remote.save': 'Zapisz dane',
  'settings.remote.saved': 'Dane dostępu zdalnego zostały zapisane.',
  'settings.remote.test': 'Sprawdź połączenie',
  'settings.remote.testTitle': 'Wyniki testu połączenia',
  'settings.remote.testDone': 'Test połączenia zakończony: pomyślne sprawdzenia – {passed} z {total}.',
  'settings.remote.statusTitle': 'Stan',
  'settings.remote.busy': 'Konfigurowanie dostępu zdalnego. Może to potrwać około dwóch minut; lista aktualizuje się automatycznie.',
  'settings.remote.ready': 'Dostęp zdalny jest gotowy. Adres twojego dziennika: {url}',
  'settings.remote.failed': 'Nie udało się skonfigurować dostępu zdalnego: {message}',
  'settings.remote.lastError': 'Ostatni problem: {message}',
  'settings.remote.nextRetry': 'Następna automatyczna próba: {time}.',
  'settings.remote.stepAt': 'Zaktualizowano: {time}',
  'settings.remote.state.idle': 'Nie rozpoczęto',
  'settings.remote.state.running': 'W toku',
  'settings.remote.state.ok': 'Gotowe',
  'settings.remote.state.error': 'Niepowodzenie',
  'settings.remote.state.warning': 'Ostrzeżenie',
  'settings.remote.state.skipped': 'Pominięto',
  'settings.remote.step.duckdns': 'Adres DuckDNS',
  'settings.remote.step.certificate': 'Certyfikat bezpieczeństwa (Let’s Encrypt)',
  'settings.remote.step.listener': 'Bezpieczne połączenie (HTTPS)',
  'settings.remote.step.upnp': 'Port na routerze',
  'settings.remote.check.duckdns': 'Aktualizacja DuckDNS',
  'settings.remote.check.upnp': 'Router (UPnP)',
  'settings.remote.check.dns': 'Wyszukiwanie adresu (DNS)',
  'settings.remote.check.https': 'Połączenie HTTPS',
  'settings.remote.publicIp': 'Publiczny adres IP',
  'settings.remote.unknown': 'Nieznany',
  'settings.remote.certificate': 'Certyfikat',
  'settings.remote.certificateValid':
    'Ważny do {date} ({days, plural, one {pozostał # dzień} few {pozostały # dni} many {pozostało # dni} other {pozostało # dnia}}), wystawca: {issuer}. Odnawia się automatycznie.',
  'settings.remote.certificateStaging': 'To certyfikat testowy (Let’s Encrypt staging); przeglądarki będą wyświetlać ostrzeżenie.',
  'settings.remote.noCertificate': 'Nie ma jeszcze certyfikatu.',
  'settings.remote.renew': 'Odnów certyfikat',
  'settings.remote.renewStarted': 'Rozpoczęto odnawianie certyfikatu. Może to potrwać około dwóch minut.',
  'settings.remote.urlTitle': 'Adres twojego dziennika',
  'settings.remote.urlHint':
    'Otwórz ten adres na telefonie lub dowolnym komputerze, a następnie zaloguj się swoją nazwą użytkownika i hasłem.',
  'settings.remote.noUrl': 'Adres pojawi się tutaj, gdy bezpieczne połączenie będzie gotowe.',
  'settings.remote.qrLabel': 'Kod QR adresu {url}',
  'settings.remote.qrHint': 'Zeskanuj kod aparatem telefonu, aby otworzyć adres.',
  'settings.remote.instructionsTitle': 'Jak to działa i czego potrzebujesz',
  'settings.remote.instructions.account':
    'Załóż bezpłatne konto w serwisie duckdns.org, dodaj nazwę (na przykład yourpersonaldiary) i skopiuj token widoczny na stronie.',
  'settings.remote.instructions.enter':
    'Wpisz powyżej nazwę i token, zaznacz „Zezwól na dostęp z internetu”, podaj hasło do konta i wybierz „Zapisz dane”.',
  'settings.remote.instructions.firstCertificate':
    'Uzyskanie pierwszego certyfikatu może potrwać około dwóch minut. Lista stanu aktualizuje się automatycznie.',
  'settings.remote.instructions.keepOn':
    'Nie wyłączaj tego komputera i nie zamykaj aplikacji dziennika: dziennik jest dostępny tylko wtedy, gdy oba działają.',
  'settings.remote.instructions.manualForward':
    'Jeśli portu na routerze nie da się otworzyć automatycznie, otwórz ustawienia routera i przekieruj port zewnętrzny {publicPort} (TCP) na adres tego komputera {ip}, port {port}.',
  'settings.remote.instructions.manualForwardNoIp':
    'Jeśli portu na routerze nie da się otworzyć automatycznie, otwórz ustawienia routera i przekieruj port zewnętrzny {publicPort} (TCP) na ten komputer (jego adres w sieci domowej), port {port}.',
  'settings.remote.instructions.signIn':
    'Na telefonie otwórz adres i zaloguj się swoją nazwą użytkownika i hasłem – wszystkie twoje wpisy są tam dostępne.',
  'settings.remote.instructions.firewall':
    'Jeśli Zapora systemu Windows zapyta, czy zezwolić programowi diary-server.exe (część aplikacji Your Personal Diary), zezwól na to (może to wymagać zgody administratora). W przeciwnym razie połączenia z internetu będą blokowane.',
  'settings.remote.instructions.atHome':
    'W domu, w tej samej sieci, adres internetowy może się nie otwierać (wiele routerów tego nie obsługuje). W takiej sytuacji skorzystaj z opcji „Dostęp z telefonu w sieci domowej”.',
  'settings.remote.privacyNote':
    'Prywatność: twoje wpisy pozostają na tym komputerze i trafiają – zaszyfrowane – wyłącznie na urządzenia, na których się logujesz. DuckDNS zna publiczny adres IP tego komputera, a Let’s Encrypt – nazwę twojego adresu. Każdy, kto zna adres, może otworzyć stronę logowania, dlatego używaj silnego hasła; kilkukrotne podanie błędnego hasła blokuje logowanie z innych urządzeń na 15 minut (z tego komputera zawsze można się zalogować). Przez internet nie można zakładać nowych kont.',
  'settings.remote.offlineConflictTitle': 'Włączyć tryb prywatności offline?',
  'settings.remote.offlineConflictMessage':
    'Tryb prywatności offline nie pozwala na połączenia, których potrzebuje dostęp zdalny (DuckDNS i Let’s Encrypt). Jego włączenie wyłączy też dostęp zdalny i dziennika nie będzie już można otworzyć z internetu.',
  'settings.remote.offlineConflictConfirm': 'Wyłącz dostęp zdalny',
  'settings.remote.disabledByOffline': 'Dostęp zdalny został wyłączony.',
  'settings.remote.offlineConflictPassword': 'Wpisz hasło do konta, aby wyłączyć dostęp zdalny.',
  // Ownership and the locked card (only the account that set remote access up can view or change it).
  'settings.remote.ownerNote':
    'Tylko twoje konto może wyświetlać i zmieniać te ustawienia. Inne konta na tym komputerze nie widzą tej karty.',
  'settings.remote.setupOwnerNote':
    'Konto, które zapisze te ustawienia, stanie się jedynym kontem na tym komputerze, które może je wyświetlać i zmieniać.',
  'settings.remote.currentTitle': 'Bieżące ustawienia',
  'settings.remote.summary.state': 'Dostęp zdalny',
  'settings.remote.summary.on': 'Włączony',
  'settings.remote.summary.off': 'Wyłączony',
  'settings.remote.summary.tokenSaved': 'Zapisany (zaszyfrowany, nigdy nie jest wyświetlany)',
  'settings.remote.summary.upnp': 'Otwieranie portu na routerze',
  'settings.remote.summary.upnpAuto': 'Automatycznie (UPnP)',
  'settings.remote.summary.upnpManual': 'Ręcznie, w ustawieniach routera',
  'settings.remote.lockedHint': 'Ustawienia są zablokowane. Aby je zmienić, wybierz „Zmień ustawienia” i wpisz hasło do konta.',
  'settings.remote.change': 'Zmień ustawienia',
  'settings.remote.unlockTitle': 'Zmiana ustawień dostępu zdalnego',
  'settings.remote.unlockMessage':
    'Aby chronić twój dziennik, wpisz hasło do konta, zanim zmienisz, skąd i w jaki sposób można się z nim łączyć przez internet.',
  'settings.remote.unlocked': 'Ustawienia są odblokowane do edycji. Zmień dane, a następnie wybierz „Zapisz dane”.',
  'settings.remote.editCancelled': 'Nie wprowadzono zmian. Ustawienia są ponownie zablokowane.',
  'settings.remote.savedLocked': 'Ustawienia dostępu zdalnego zostały zapisane i ponownie zablokowane.',
  'settings.remote.password': 'Hasło do twojego konta',
  'settings.remote.passwordHint': 'Potrzebne do zapisania. Od tej chwili tylko to konto będzie mogło wyświetlać i zmieniać dostęp zdalny.',
  'settings.remote.passwordMissing': 'Podaj hasło do konta.',
  'settings.remote.wrongPassword': 'Nieprawidłowe hasło.',
  // E-mail for password reset (src/pages/settings/MailSection.tsx; owner-only, locked after setup, like remote access).
  'settings.mail.title': 'E-mail do resetowania hasła',
  'settings.mail.intro':
    'Gdy ktoś zapomni hasła, dziennik wysyła mu e-mailem link i kod do ustawienia nowego. Do tego potrzebne jest konto e-mail, z którego dziennik będzie wysyłać wiadomości – na przykład adres Gmail założony specjalnie dla dziennika.',
  'settings.mail.ownerNote':
    'Tylko twoje konto może wyświetlać i zmieniać te ustawienia. Inne konta na tym komputerze nie widzą tej karty.',
  'settings.mail.setupOwnerNote':
    'Konto, które zapisze te ustawienia, stanie się jedynym kontem na tym komputerze, które może je wyświetlać i zmieniać.',
  'settings.mail.switchLabel': 'Wysyłaj e-maile do resetowania hasła',
  'settings.mail.switchHint':
    'Gdy ta opcja jest włączona, dziennik łączy się z serwerem poczty tylko po to, aby wysyłać e-maile do resetowania hasła i wiadomości testowe.',
  'settings.mail.detailsTitle': 'Konto nadawcy',
  'settings.mail.address': 'Adres Gmail',
  'settings.mail.addressHint': 'Wiadomości są wysyłane z tego adresu jako nadawca „Your Personal Diary”.',
  'settings.mail.addressInvalid': 'Wpisz prawidłowy adres e-mail.',
  'settings.mail.appPassword': 'Hasło do aplikacji',
  'settings.mail.appPasswordHint':
    '16-literowe hasło do aplikacji, które Google utworzył dla dziennika – nie twoje zwykłe hasło do Gmaila. Spacje nie mają znaczenia.',
  'settings.mail.appPasswordSaved':
    'Hasło do aplikacji jest zapisane (zaszyfrowane, nigdy nie jest wyświetlane). Zostaw pole puste, aby je zachować.',
  'settings.mail.appPasswordMissing': 'Wpisz hasło do aplikacji.',
  'settings.mail.appPasswordGmail':
    'Hasło do aplikacji Gmail ma 16 liter. Twoje zwykłe hasło do Gmaila tutaj nie działa.',
  'settings.mail.advanced': 'Zaawansowane: serwer poczty',
  'settings.mail.host': 'Serwer poczty wychodzącej (SMTP)',
  'settings.mail.hostHint': 'Dla Gmaila: smtp.gmail.com',
  'settings.mail.hostInvalid': 'Wpisz nazwę serwera poczty, na przykład smtp.gmail.com.',
  'settings.mail.port': 'Port',
  'settings.mail.portHint': '465 z SSL/TLS, 587 ze STARTTLS',
  'settings.mail.portInvalid': 'Wpisz numer portu od 1 do 65535.',
  'settings.mail.security': 'Szyfrowanie',
  'settings.mail.security.tls': 'SSL/TLS (zwykle port 465)',
  'settings.mail.security.starttls': 'STARTTLS (zwykle port 587)',
  'settings.mail.password': 'Hasło do twojego konta',
  'settings.mail.passwordHint':
    'Hasło do twojego konta w dzienniku. Potrzebne do zapisania; od tej chwili tylko to konto będzie mogło wyświetlać i zmieniać te ustawienia.',
  'settings.mail.passwordMissing': 'Podaj hasło do konta.',
  'settings.mail.wrongPassword': 'Nieprawidłowe hasło.',
  'settings.mail.saved': 'Ustawienia poczty zostały zapisane.',
  'settings.mail.savedLocked': 'Ustawienia poczty zostały zapisane i zablokowane.',
  'settings.mail.enabled':
    'Wysyłanie e-maili do resetowania hasła jest włączone. Wybierz „Wyślij testowy e-mail”, aby to sprawdzić.',
  'settings.mail.disabled': 'Wysyłanie e-maili do resetowania hasła jest wyłączone.',
  'settings.mail.notReady':
    'Nie można jeszcze wysyłać wiadomości: dane są niekompletne. Wybierz „Zmień ustawienia”, aby je uzupełnić.',
  'settings.mail.currentTitle': 'Bieżące ustawienia',
  'settings.mail.summary.state': 'E-maile do resetowania hasła',
  'settings.mail.summary.on': 'Włączone',
  'settings.mail.summary.off': 'Wyłączone',
  'settings.mail.summary.address': 'Nadawca',
  'settings.mail.summary.appPassword': 'Hasło do aplikacji',
  'settings.mail.summary.appPasswordSaved': 'Zapisane (zaszyfrowane, nigdy nie jest wyświetlane)',
  'settings.mail.summary.server': 'Serwer poczty',
  'settings.mail.summary.serverValue': '{host}, port {port}, {security}',
  'settings.mail.lockedHint':
    'Ustawienia są zablokowane. Aby je zmienić, wybierz „Zmień ustawienia” i wpisz hasło do konta.',
  'settings.mail.change': 'Zmień ustawienia',
  'settings.mail.unlockTitle': 'Zmiana ustawień poczty',
  'settings.mail.unlockMessage':
    'Aby chronić twój dziennik, wpisz hasło do konta, zanim zmienisz konto, z którego dziennik wysyła e-maile.',
  'settings.mail.unlocked': 'Ustawienia są odblokowane do edycji. Zmień dane, a następnie wybierz „Zapisz dane”.',
  'settings.mail.editCancelled': 'Nie wprowadzono zmian. Ustawienia są ponownie zablokowane.',
  'settings.mail.test': 'Wyślij testowy e-mail',
  'settings.mail.testHint': 'Wysyła krótką wiadomość na twój własny adres: {email}.',
  'settings.mail.testNoEmail':
    'Twoje konto nie ma jeszcze adresu e-mail. Dodaj go na karcie „Konto”, aby otrzymać testową wiadomość.',
  'settings.mail.testSent': 'Wysłano testowy e-mail na adres {email}. Sprawdź skrzynkę odbiorczą (i folder spamu).',
  'settings.mail.testFailed': 'Nie udało się wysłać testowego e-maila. {message}',
  'settings.mail.instructionsTitle': 'Jak uzyskać hasło do aplikacji Gmail',
  'settings.mail.instructions.signIn':
    'Zaloguj się na myaccount.google.com na konto Gmail, z którego dziennik będzie wysyłać wiadomości.',
  'settings.mail.instructions.twoStep':
    'Otwórz „Bezpieczeństwo” i włącz weryfikację dwuetapową. Google udostępnia hasła do aplikacji tylko kontom z weryfikacją dwuetapową.',
  'settings.mail.instructions.create':
    'Otwórz myaccount.google.com/apppasswords (lub wyszukaj „Hasła do aplikacji” na swoim koncie Google), wpisz nazwę, np. „Your Personal Diary”, i wybierz „Utwórz”.',
  'settings.mail.instructions.copy':
    'Google jednorazowo pokaże 16-literowe hasło. Wpisz je tutaj w polu „Hasło do aplikacji” (spacje nie mają znaczenia), wpisz hasło do swojego konta i wybierz „Zapisz”.',
  'settings.mail.instructions.test':
    'Wybierz „Wyślij testowy e-mail” i sprawdź, czy wiadomość dociera do skrzynki odbiorczej.',
  'settings.mail.whyAppPassword':
    'Dlaczego hasło do aplikacji? Google nie przyjmuje zwykłego hasła do Gmaila w programach pocztowych, więc tutaj ono nie działa. Hasła do aplikacji można używać tylko do poczty i w każdej chwili można je unieważnić na koncie Google.',
  'settings.mail.privacyNote':
    'Hasło do aplikacji jest przechowywane w postaci zaszyfrowanej na tym komputerze i nigdy więcej nie jest wyświetlane. Wiadomości zawierają tylko link i kod do resetowania – nigdy nic z twojego dziennika.',

  // Your Personal Diary server (src/pages/settings/PrivacySection.tsx; the published apps, the web UI it serves)
  'settings.hosted.reassurance': 'Twój dziennik jest przechowywany na serwerze Your Personal Diary i szyfrowany twoim hasłem.',
  'settings.hosted.serverAddress': 'Serwer dziennika: {host}',
  'settings.hosted.offlineHint': 'Gdy ta opcja jest włączona, aplikacja nie może nawiązywać żadnych połączeń sieciowych poza serwerem dziennika.',
  // Server card (src/pages/settings/ServerSection.tsx): hosted server, its owner only (docs/android-tasks/SERVER-CARD.md)
  'settings.server.title': 'Serwer',
  'settings.server.intro': 'Stan serwera Your Personal Diary. Tę kartę widzisz tylko ty jako właściciel.',
  'settings.server.refresh': 'Odśwież',
  'settings.server.refreshed': 'Stan serwera został odświeżony.',
  'settings.server.version': 'Wersja',
  'settings.server.uptime': 'Czas działania',
  'settings.server.accounts': 'Konta',
  'settings.server.accountsValue': '{count} z maksymalnie {max}',
  'settings.server.registrations': 'Nowe konta w ciągu ostatnich 24 godzin',
  'settings.server.disk': 'Dysk',
  'settings.server.diskValue': '{used} zajęte, {free} wolne ({percent})',
  'settings.server.diskLow':
    'Na dysku zostało tylko {percent} wolnego miejsca. Wkrótce powiększ wolumin (fly volumes extend, zobacz podręcznik obsługi): gdy dysk się zapełni, zmian nie będzie można zapisać.',
  'settings.server.storage': 'Zapis na dysk',
  'settings.server.storageOk': 'Działa',
  'settings.server.storageFailed': 'Nie działa - zapis się nie udaje',
  'settings.server.storageAlert':
    'Serwer nie może teraz zapisywać zmian na dysku. Sprawdź wolne miejsce i dziennik (zobacz podręcznik obsługi).',
  'settings.server.lastSave': 'Ostatni udany zapis',
  'settings.server.noSaveYet': 'Brak od uruchomienia serwera',
  'settings.server.memory': 'Używana pamięć',
  'settings.server.gigabytes': '{value} GB',
  'settings.server.lastArchive': 'Ostatnie archiwum serwera',
  'settings.server.noArchive': 'Jeszcze brak',
  'settings.server.archiveDueNone': 'Nie ma jeszcze żadnego archiwum serwera. Przygotuj je poniżej i pobierz na swój komputer.',
  'settings.server.archiveDueOld': 'Ostatnie archiwum serwera ma ponad {days} dni. Przygotuj nowe poniżej i pobierz je na swój komputer.',
  'settings.server.archive.title': 'Archiwum serwera',
  'settings.server.archive.intro':
    'Zaszyfrowana kopia wszystkich danych z serwera, do odtworzenia go po awarii. Jest zapisywana na dysku serwera, który przechowuje 2 najnowsze; potem pobierasz ją na swój komputer poleceniem we własnym oknie PowerShell. Nigdy nie da się jej pobrać przez stronę ani aplikację.',
  'settings.server.archive.listTitle': 'Archiwa na serwerze',
  'settings.server.archive.created': 'Przygotowano',
  'settings.server.archive.size': 'Rozmiar',
  'settings.server.archive.download': 'Polecenie pobrania',
  'settings.server.archive.check': 'Polecenie sprawdzenia',
  'settings.server.archive.copyDownload': 'Kopiuj polecenie pobrania',
  'settings.server.archive.copyCheck': 'Kopiuj polecenie sprawdzenia',
  'settings.server.archive.copied': 'Polecenie zostało skopiowane.',
  'settings.server.archive.copyFailed': 'Nie udało się skopiować. Zaznacz polecenie i skopiuj je ręcznie.',
  'settings.server.archive.stepsTitle': 'Jak pobrać archiwum',
  'settings.server.archive.step.open': 'Na swoim komputerze otwórz PowerShell w folderze, w którym chcesz trzymać plik.',
  'settings.server.archive.step.download': 'Wklej polecenie pobrania i naciśnij Enter.',
  'settings.server.archive.step.check':
    'Wklej polecenie sprawdzenia i naciśnij Enter. Musi wypisać True; jeśli nie, pobierz plik jeszcze raz.',
  'settings.server.archive.step.keep':
    'Przechowuj plik offline (na przykład na dysku zewnętrznym), a hasło archiwum w innym bezpiecznym miejscu.',
  'settings.server.archive.prepare': 'Przygotuj archiwum serwera',
  'settings.server.archive.formTitle': 'Przygotowanie nowego archiwum',
  'settings.server.archive.password': 'Hasło do twojego konta',
  'settings.server.archive.passphrase': 'Hasło archiwum',
  'settings.server.archive.passphraseHint': 'Co najmniej {min} znaków. To nie jest hasło do konta - wybierz osobne i zapisz je.',
  'settings.server.archive.passphraseRepeat': 'Powtórz hasło archiwum',
  'settings.server.archive.passphraseWarning': 'Hasło archiwum jest potrzebne do jego odtworzenia i nie da się go odzyskać.',
  'settings.server.archive.passwordMissing': 'Podaj hasło do konta.',
  'settings.server.archive.passphraseShort': 'Hasło archiwum musi mieć co najmniej {min} znaków.',
  'settings.server.archive.passphraseLong': 'Hasło archiwum może mieć co najwyżej {max} znaków.',
  'settings.server.archive.passphraseMismatch': 'Podane hasła archiwum się różnią.',
  'settings.server.archive.submit': 'Przygotuj archiwum',
  'settings.server.archive.preparing': 'Trwa przygotowywanie archiwum. Może to potrwać minutę - nie zamykaj tej strony.',
  'settings.server.archive.ready': 'Archiwum {name} ({size}) jest gotowe. Pobierz je teraz poleceniem poniżej.',
  'settings.server.archive.busy': 'Właśnie trwa przygotowywanie archiwum.',
  'settings.server.archive.nextAt': 'Następne archiwum można przygotować od {time}.',
  // Deletion request by e-mail (src/pages/settings/DeletionRequest.tsx, docs/android-tasks/ADMIN-TOOL.md item 3): the card builds two commands and sends nothing
  'settings.server.deletion.title': 'Prośba o usunięcie przez e-mail',
  'settings.server.deletion.intro':
    'Dla osoby, która nie może się zalogować i prosi e-mailem o usunięcie swojego konta. Sama aplikacja nie może wyszukiwać ani usuwać kont: wpisz tu adres, a karta przygotuje dwa polecenia dla PowerShell na twoim komputerze, które działają tylko z twoim logowaniem do Fly. Nic, co tu wpiszesz, nie jest nigdzie wysyłane.',
  'settings.server.deletion.check': 'Sprawdź, czy prośba przyszła z adresu zarejestrowanego w koncie.',
  'settings.server.deletion.email': 'Adres e-mail osoby zgłaszającej prośbę',
  'settings.server.deletion.waiting': 'Polecenia pojawią się tutaj, gdy wpiszesz pełny adres e-mail.',
  'settings.server.deletion.encoded':
    'Ten adres zawiera znaki, które PowerShell by zmienił, więc polecenia przekazują go w postaci zakodowanej (b64:...); narzędzie go dekoduje.',
  'settings.server.deletion.find': 'Krok 1: znajdź konto',
  'settings.server.deletion.findHint':
    'Wklej je do PowerShell i naciśnij Enter. Niczego nie zmienia: pokazuje nazwę użytkownika konta, adres e-mail, datę rejestracji i rozmiar dziennika.',
  'settings.server.deletion.copyFind': 'Kopiuj polecenie wyszukiwania',
  'settings.server.deletion.username': 'Nazwa użytkownika pokazana przez polecenie wyszukiwania',
  'settings.server.deletion.usernameHint': 'Wpisz ją dokładnie tak, jak została pokazana; poniżej pojawi się wtedy polecenie usunięcia.',
  'settings.server.deletion.usernameInvalid':
    'To nie jest nazwa użytkownika: nazwa użytkownika ma od 3 do 32 liter, cyfr, kropek, łączników lub podkreśleń.',
  'settings.server.deletion.delete': 'Krok 2: usuń konto',
  'settings.server.deletion.deleteHint':
    'Uruchom je dopiero po sprawdzeniu adresu. Trwale usuwa konto i jego dziennik; tej operacji nie można cofnąć. Zanotuj w swoim rejestrze datę, którą wyświetli.',
  'settings.server.deletion.copyDelete': 'Kopiuj polecenie usunięcia',
};
export default messages;
