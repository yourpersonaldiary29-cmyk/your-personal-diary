/** cs - settings messages. Keys are prefixed 'settings.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Language card (src/pages/settings/LanguageSection.tsx, src/context/LanguageContext.tsx)
  'settings.language.title': 'Jazyk',
  'settings.language.label': 'Jazyk rozhraní',
  'settings.language.hint':
    'Celý deník se okamžitě přepne do zvoleného jazyka. Před přihlášením se volba uloží v tomto zařízení, po přihlášení do tvého účtu.',
  'settings.language.changed': 'Jazyk změněn: {language}',
  'settings.language.saveFailed': 'Jazyk se v tomto zařízení změnil, ale uložit ho do účtu se nepodařilo.',

  // Page titles (src/pages/SettingsPage.tsx, BackupPage.tsx)
  'settings.title': 'Nastavení',
  'settings.backup.pageTitle': 'Záloha, obnovení a export',
  'settings.actionCancelled': 'Operace byla zrušena.',

  // Account card (src/pages/settings/AccountSection.tsx, ProfileEditor.tsx, ChangePasswordDialog.tsx)
  'settings.account.title': 'Účet',
  'settings.account.anonymousText':
    'Nastavení účtu, zabezpečení, připomínek a dat jsou dostupná po přihlášení. Předvolby zobrazení se ukládají v tomto zařízení i bez účtu.',
  'settings.account.setEmail': 'Nastavit',
  'settings.account.setEmailTitle': 'Nastavit e-mailovou adresu',
  'settings.account.emailSaved': 'E-mailová adresa byla uložena.',
  'settings.account.editDetails': 'Upravit údaje',
  'settings.account.editDetailsHint': 'Jméno se používá také v pozdravu v horní části deníku.',
  'settings.account.emailPassword': 'Heslo k tvému účtu',
  'settings.account.emailPasswordHint': 'Je potřeba ke změně e-mailové adresy, protože na ni chodí e-maily pro obnovení hesla.',
  'settings.account.profileSaved': 'Tvoje údaje byly uloženy.',
  'settings.account.noChanges': 'Nic se nezměnilo.',
  'settings.account.changePassword': 'Změnit heslo',
  'settings.account.logout': 'Odhlásit se',
  'settings.account.logoutQuestion': 'Odhlásit se z deníku? Pro návrat bude potřeba zadat uživatelské jméno a heslo.',
  'settings.account.oldPassword': 'Původní heslo',
  'settings.account.newPassword': 'Nové heslo',
  'settings.account.confirmNewPassword': 'Potvrzení nového hesla',
  'settings.account.newPasswordHint': 'Alespoň {min} znaků, písmena i číslice',
  'settings.account.passwordChanged': 'Heslo bylo úspěšně změněno',
  'settings.account.wrongOldPassword': 'Původní heslo není správné. Zkus to prosím znovu.',
  'settings.account.passwordChangeHint': 'Změnou hesla se deník znovu zašifruje a všechna ostatní zařízení se odhlásí.',
  // Account ID row (hosted server only): the server owner copies it to turn the owner cards on.
  'settings.account.accountId': 'ID účtu',
  'settings.account.copyAccountId': 'Kopírovat ID účtu',
  'settings.account.accountIdCopied': 'ID účtu bylo zkopírováno',
  'settings.account.accountIdCopyFailed': 'Kopírování se nezdařilo. Označ ID účtu a zkopíruj ho ručně.',
  'settings.account.accountIdHint': 'Potřebuje ho jen vlastník serveru, aby zapnul karty vlastníka.',

  // Connected devices (src/pages/settings/SessionsList.tsx)
  'settings.devices.title': 'Připojená zařízení',
  'settings.devices.hint': 'Všechna zařízení, která jsou právě přihlášena k tomuto účtu. Odpojením zařízení jeho přihlášení okamžitě skončí.',
  'settings.devices.current': 'Toto zařízení',
  'settings.devices.remembered': 'Zapamatovat si mě',
  'settings.devices.unknown': 'Nepojmenované zařízení',
  'settings.devices.connectedAt': 'Přihlášeno',
  'settings.devices.lastSeen': 'Poslední aktivita',
  'settings.devices.revoke': 'Odpojit',
  'settings.devices.revokeName': 'Odpojit {device}',
  'settings.devices.none': 'Žádná připojená zařízení.',
  'settings.devices.revoked': 'Zařízení „{device}“ bylo odpojeno.',

  // Display card (src/pages/settings/DisplaySection.tsx)
  'settings.display.title': 'Zobrazení',
  'settings.display.theme': 'Motiv',
  'settings.display.themeOption.system': 'Podle systému',
  'settings.display.themeOption.light': 'Světlý',
  'settings.display.themeOption.dark': 'Tmavý',
  'settings.display.themeOption.highContrast': 'Vysoký kontrast',
  'settings.display.themeChanged': 'Motiv změněn: {label}',
  'settings.display.fontScale': 'Velikost textu',
  'settings.display.fontScaleOption.small': 'Malá ({percent} %)',
  'settings.display.fontScaleOption.normal': 'Normální ({percent} %)',
  'settings.display.fontScaleOption.large': 'Velká ({percent} %)',
  'settings.display.fontScaleOption.veryLarge': 'Velmi velká ({percent} %)',
  'settings.display.fontScaleOption.huge': 'Obrovská ({percent} %)',
  'settings.display.fontScaleOption.custom': 'Vlastní ({percent} %)',
  'settings.display.fontScaleChanged': 'Velikost textu změněna: {label}',
  'settings.display.reduceMotion': 'Omezit animace',
  'settings.display.reduceMotionHint': 'Vypne animace a přechody v rozhraní.',
  'settings.display.reduceMotionOn': 'Omezení animací je zapnuté.',
  'settings.display.reduceMotionOff': 'Omezení animací je vypnuté.',
  'settings.display.firstDayOfWeek': 'První den v týdnu',
  'settings.display.sunday': 'Neděle',
  'settings.display.monday': 'Pondělí',
  'settings.display.firstDayChanged': 'Týden bude začínat dnem: {label}.',
  'settings.display.anonymousHint': 'Předvolby se ukládají v tomto prohlížeči. Po přihlášení se uloží do tvého účtu.',

  // Security card (src/pages/settings/SecuritySection.tsx)
  'settings.security.title': 'Zabezpečení',
  'settings.security.autoLock': 'Automatické zamčení při nečinnosti',
  'settings.security.autoLockHint':
    'Po zvolené době deník zobrazí zamykací obrazovku a vyžádá si heslo. Přihlášení přitom zůstává zachováno.',
  'settings.security.autoLockOff': 'Vypnuto',
  'settings.security.autoLockChanged': 'Automatické zamčení: {label}',
  'settings.security.lockNow': 'Zamknout hned',
  'settings.security.lockNowHint': 'Deník můžeš kdykoli zamknout také zkratkou Ctrl+L.',

  // Reminders card (src/pages/settings/RemindersSection.tsx)
  'settings.reminders.title': 'Připomínky',
  'settings.reminders.enabled': 'Zobrazovat připomínky návyků',
  'settings.reminders.hint':
    'Připomínky jsou jen místní oznámení – v počítači nebo v prohlížeči, kde je deník otevřený. Nic se nikam neodesílá.',
  'settings.reminders.explanation':
    'Čas připomínky se nastavuje u každého návyku zvlášť na stránce návyků. Dokud je tato volba vypnutá, žádná připomínka se nezobrazí.',
  'settings.reminders.on': 'Připomínky jsou zapnuté.',
  'settings.reminders.off': 'Připomínky jsou vypnuté.',
  'settings.reminders.habitsLink': 'Přejít na stránku návyků',

  // Privacy card (src/pages/settings/PrivacySection.tsx)
  // Link to the privacy policy page of the diary server (src/components/legal/PrivacyPolicyLink.tsx)
  'settings.privacy.policyLink': 'Zásady ochrany osobních údajů',
  'settings.privacy.title': 'Soukromí',
  'settings.privacy.offlineLabel': 'Offline režim soukromí',
  'settings.privacy.offlineHint':
    'Když je zapnutý, samotná aplikace nesmí otevřít žádné síťové připojení kromě připojení k vlastnímu místnímu serveru. Vypni ho jen tehdy, když používáš vzdálený přístup.',
  'settings.privacy.offlineOn': 'Offline režim soukromí je zapnutý.',
  'settings.privacy.offlineOff': 'Offline režim soukromí je vypnutý.',
  // Data card (src/pages/settings/DataSection.tsx)
  'settings.data.title': 'Data',
  'settings.data.reassurance': 'Data tvého deníku se ukládají do tvého osobního účtu a chrání je koncové šifrování.',
  'settings.data.seedDemo': 'Načíst ukázková data',
  'settings.data.seedDemoTitle': 'Načtení ukázkových dat',
  'settings.data.seedDemoMessage':
    'Deník je teď prázdný. Vytvoří se smyšlené záznamy a návyky zhruba za {days, plural, one {# den} few {# dny} many {# dne} other {# dní}}, na kterých si můžeš vyzkoušet postřehy, statistiky a hledání. Můžeš je upravovat a mazat jako kterékoli jiné záznamy.',
  'settings.data.seedDemoConfirm': 'Načíst',
  'settings.data.seedDemoDone':
    'Načteno: {entries, plural, one {# záznam} few {# záznamy} many {# záznamu} other {# záznamů}}, {habits, plural, one {# návyk} few {# návyky} many {# návyku} other {# návyků}} a {logs, plural, one {# záznam návyku} few {# záznamy návyků} many {# záznamu návyků} other {# záznamů návyků}}.',

  // Delete account card - the last card of the page (src/pages/settings/DeleteAccountSection.tsx)
  'settings.deleteAccount.title': 'Smazání účtu',
  'settings.deleteAccount.warning':
    'Smazáním účtu ho trvale odstraníš i s deníkem, návyky a nastavením a odhlásíš ho na všech zařízeních. Obnovit ho nepůjde. Záložních souborů, které máš uložené jinde, se to netýká.',
  'settings.deleteAccount.button': 'Smazat účet',
  'settings.deleteAccount.dialogTitle': 'Smazat účet „{username}“?',
  'settings.deleteAccount.passwordHint': 'Pro potvrzení zadej heslo k účtu.',
  'settings.deleteAccount.understand': 'Rozumím, že to nelze vrátit zpět',
  'settings.deleteAccount.confirm': 'Smazat účet natrvalo',
  'settings.deleteAccount.done': 'Všechna data i účet byly smazány.',
  'settings.deleteAccount.wrongPassword': 'Heslo není správné. Zkus to prosím znovu.',
  'settings.deleteAccount.ownerRemote':
    'Tvůj účet je vlastníkem vzdáleného přístupu na tomto počítači. Jeho smazáním se vzdálený přístup vypne a jeho nastavení (adresa a token DuckDNS, certifikát) se vymaže; vlastníkem se stane nejstarší ze zbývajících účtů a může ho nastavit znovu.',
  'settings.deleteAccount.ownerMail':
    'Tvůj účet je vlastníkem e-mailu pro obnovení hesla na tomto počítači. Jeho smazáním se odesílání e-mailů vypne a jeho nastavení (odesílací účet a heslo aplikace) se vymaže; vlastníkem se stane nejstarší ze zbývajících účtů a může ho nastavit znovu.',
  'settings.deleteAccount.ownerBoth':
    'Tvůj účet je vlastníkem vzdáleného přístupu i e-mailu pro obnovení hesla na tomto počítači. Jeho smazáním se obojí vypne a jejich nastavení (adresa a token DuckDNS, certifikát, odesílací účet a heslo aplikace) se vymaže; jejich vlastníkem se stane nejstarší ze zbývajících účtů a může je nastavit znovu.',
  // The owner line on the Your Personal Diary server (hosted mode): its owner is DIARY_OWNER_ID only, and deleting
  // the owner erases the mail settings and promotes nobody (server/src/hosted/owner.ts, docs/API.md "בעלות").
  'settings.deleteAccount.ownerHosted':
    'Tvůj účet je vlastníkem serveru deníku. Jeho smazáním se zastaví e-maily pro obnovení hesla pro všechny účty a nastavení e-mailu (odesílací účet a heslo aplikace) se vymaže. Žádný jiný účet se vlastníkem nestane, takže nikdo nebude moci otevřít kartu „Server“ ani připravit archiv serveru. Pokud se zaregistruješ znovu, nový účet dostane nové ID účtu, které bude nutné na serveru znovu nastavit jako DIARY_OWNER_ID.',

  // Diagnostics card (src/pages/settings/DiagnosticsSection.tsx, desktop only)
  'settings.diagnostics.title': 'Diagnostika',
  'settings.diagnostics.hint': 'Technické informace o místním serveru, který běží na pozadí. Hodí se, když něco nefunguje.',
  'settings.diagnostics.uiVersion': 'Verze rozhraní',
  'settings.diagnostics.serverVersion': 'Verze serveru',
  'settings.diagnostics.port': 'Port',
  'settings.diagnostics.lanStatus': 'Síťový přístup',
  'settings.diagnostics.lanOn': 'Zapnuto',
  'settings.diagnostics.lanOff': 'Vypnuto',
  'settings.diagnostics.startedAt': 'Spuštěno',
  'settings.diagnostics.showServerLog': 'Zobrazit protokol serveru',
  'settings.diagnostics.hideServerLog': 'Skrýt protokol serveru',
  'settings.diagnostics.serverLog': 'Protokol serveru',
  'settings.diagnostics.serverLogEmpty': 'Protokol serveru je prázdný.',
  'settings.diagnostics.serverLogLoaded':
    'Protokol serveru načten: {count, plural, one {# řádek} few {# řádky} many {# řádku} other {# řádků}}.',
  'settings.diagnostics.serverLogFailed': 'Protokol serveru se nepodařilo přečíst.',
  'settings.diagnostics.restartServer': 'Restartovat server',
  'settings.diagnostics.restartTitle': 'Restart serveru',
  'settings.diagnostics.restartMessage':
    'Místní server se ukončí a znovu spustí a rozhraní se znovu načte, aby se k němu připojilo. Pokud nebyla zaškrtnutá volba „Zapamatovat si mě“, může být potřeba se znovu přihlásit.',
  'settings.diagnostics.restartConfirm': 'Restartovat',
  'settings.diagnostics.restarting': 'Server se restartuje. Rozhraní se za chvíli znovu načte.',
  'settings.diagnostics.restartFailed': 'Restart serveru se nezdařil.',

  // Data card: phone (LAN) access, desktop only (src/pages/settings/LanAccessSection.tsx)
  'settings.lan.title': 'Přístup z telefonu v domácí síti',
  'settings.lan.label': 'Přístup z telefonu v domácí síti',
  'settings.lan.hint':
    'Místní server bude naslouchat také v domácí síti Wi-Fi, takže stejný deník půjde otevřít i v telefonu. Data nikdy neopustí domácnost.',
  'settings.lan.onlyFromComputer': 'Přístup z telefonu lze zapnout nebo vypnout jen v počítači, kde je deník nainstalovaný.',
  'settings.lan.enabled': 'Přístup z telefonu je zapnutý.',
  'settings.lan.disabled': 'Přístup z telefonu je vypnutý.',
  'settings.lan.ownerOnly': 'Přístup z telefonu může zapnout nebo vypnout jen účet, který vlastní tento počítač (první účet na něm vytvořený).',
  'settings.lan.statusOn': 'Přístup z telefonu je zapnutý.',
  'settings.lan.statusOff': 'Přístup z telefonu je vypnutý.',
  'settings.lan.confirmTitle': 'Zapnout přístup z telefonu',
  'settings.lan.confirmMessage': 'Telefony a počítače v domácí síti budou moci otevřít přihlašovací stránku deníku. Pro potvrzení zadejte heslo k účtu.',
  'settings.lan.urlsTitle': 'Adresy k otevření v telefonu',
  'settings.lan.noUrls': 'Nenašla se žádná síťová adresa. Zkontroluj, že je počítač připojený k Wi-Fi, a zkus to znovu.',
  'settings.lan.copy': 'Kopírovat',
  'settings.lan.copyName': 'Kopírovat {url}',
  'settings.lan.copied': 'Adresa {url} byla zkopírována.',
  'settings.lan.copyFailed': 'Kopírování se nezdařilo. Adresu můžeš označit a zkopírovat ručně.',
  'settings.lan.instructionsTitle': 'Jak se připojit z telefonu',
  'settings.lan.instructions.sameNetwork': 'Zkontroluj, že je telefon připojený ke stejné síti Wi-Fi jako počítač.',
  'settings.lan.instructions.openUrl':
    'Otevři jednu z adres výše v prohlížeči telefonu a přihlas se stejným uživatelským jménem a heslem.',
  'settings.lan.instructions.firewall':
    'Poprvé se může Windows Firewall zeptat na povolení – přístup povol jen v privátních sítích.',
  'settings.lan.instructions.sameServer':
    'Telefon vidí přesně to, co se děje v počítači, protože oba pracují se stejným místním serverem.',

  // Backup page: backup card (src/pages/settings/BackupCreateSection.tsx)
  'settings.backup.title': 'Záloha',
  'settings.backup.explanation':
    'Záložní soubor je zašifrovaná kopie celého deníku (záznamy, návyky a nastavení) ve formátu .mpd. Ulož ho na bezpečné místo – například na externí disk. Bez hesla ho nelze otevřít.',
  'settings.backup.ownPassword': 'Jiné heslo pro zálohu',
  'settings.backup.ownPasswordHint':
    'Ve výchozím nastavení se záloha šifruje heslem k účtu. Jen pro tento soubor můžeš zvolit jiné heslo.',
  'settings.backup.password': 'Heslo zálohy',
  'settings.backup.passwordConfirm': 'Potvrzení hesla zálohy',
  'settings.backup.create': 'Vytvořit záložní soubor',
  'settings.backup.fileFilter': 'Zašifrovaný záložní soubor',
  'settings.backup.created': 'Záloha vytvořena: {fileName} ({size}).',

  // Backup page: restore card (src/pages/settings/RestoreSection.tsx)
  'settings.restore.title': 'Obnovení ze zálohy',
  'settings.restore.explanation': 'Obnovení nahradí současný deník obsahem záložního souboru. Heslo k účtu se nemění.',
  'settings.restore.pickFile': 'Vybrat záložní soubor',
  'settings.restore.fileField': 'Záložní soubor',
  'settings.restore.fileHint': 'Soubor .mpd vytvořený na této stránce.',
  'settings.restore.chosenFile': 'Soubor',
  'settings.restore.fileSize': 'Velikost',
  'settings.restore.fileStatus': 'Stav',
  'settings.restore.inspecting': 'Kontroluje se soubor…',
  'settings.restore.action': 'Obnovit ze zálohy',
  'settings.restore.confirmTitle': 'Obnovit ze zálohy?',
  'settings.restore.warning':
    'Současný deník – všechny záznamy, návyky a nastavení – bude nahrazen obsahem záložního souboru. Tuto akci nelze vrátit. Doporučujeme nejdřív vytvořit zálohu současného deníku.',
  'settings.restore.confirm': 'Obnovit',
  'settings.restore.done':
    'Obnovení dokončeno: {entries, plural, one {# záznam} few {# záznamy} many {# záznamu} other {# záznamů}} a {habits, plural, one {# návyk} few {# návyky} many {# návyku} other {# návyků}}.',
  'settings.restore.needFile': 'Vyber záložní soubor',
  'settings.restore.invalidFile': 'Vybraný soubor není platný záložní soubor',

  // Backup page: export card (src/pages/settings/ExportSection.tsx)
  'settings.export.title': 'Export',
  'settings.export.explanation':
    'Export vytvoří čitelný (nešifrovaný) soubor se záznamy, například ke čtení, tisku nebo použití v jiném programu. Podle toho s ním zacházej.',
  'settings.export.format': 'Formát',
  'settings.export.formatOption.txt': 'TXT – text',
  'settings.export.formatOption.csv': 'CSV – tabulka',
  'settings.export.formatOption.json': 'JSON – úplná data',
  'settings.export.formatOption.pdf': 'PDF – dokument',
  'settings.export.formatHint.txt': 'Prostý textový soubor, který otevřeš na každém počítači i telefonu',
  'settings.export.formatHint.csv': 'K otevření v Excelu nebo jiném tabulkovém programu',
  'settings.export.formatHint.json': 'Všechna pole, vhodné pro přenos do jiného programu',
  'settings.export.formatHint.pdf': 'Formátovaný dokument ke čtení a tisku',
  'settings.export.filter.txt': 'Textový soubor',
  'settings.export.filter.csv': 'Soubor CSV',
  'settings.export.filter.json': 'Soubor JSON',
  'settings.export.filter.pdf': 'Dokument PDF',
  'settings.export.from': 'Od data',
  'settings.export.to': 'Do data',
  'settings.export.rangeHint': 'Pro export celého deníku nech pole prázdná.',
  'settings.export.rangeError': 'Koncové datum musí být stejné jako počáteční, nebo pozdější',
  'settings.export.includeHabits': 'Zahrnout návyky a jejich záznamy',
  'settings.export.includeHabitsCsv': 'Soubor CSV obsahuje jen záznamy. Návyky jsou součástí formátů TXT, JSON a PDF.',
  'settings.export.action': 'Exportovat',
  'settings.export.done': 'Export dokončen: {count, plural, one {# záznam} few {# záznamy} many {# záznamu} other {# záznamů}}.',
  'settings.export.doneWithFile':
    'Export dokončen: {count, plural, one {# záznam} few {# záznamy} many {# záznamu} other {# záznamů}}. {fileName}',
  'settings.export.downloaded': 'Export dokončen. Soubor {fileName} byl stažen.',

  // Remote access card (src/pages/settings/RemoteAccessSection.tsx; the Privacy card's confirmation in PrivacySection.tsx)
  'settings.remote.title': 'Vzdálený přístup',
  'settings.remote.intro':
    'Otevírej svůj deník odkudkoli – z telefonu nebo z jiného počítače – na vlastní adrese DuckDNS. Deník zůstává v tomto počítači a nic se nenahrává do cloudu: tento počítač odpovídá přes šifrované spojení HTTPS.',
  'settings.remote.switchLabel': 'Povolit přístup z internetu',
  'settings.remote.switchHint':
    "Ve výchozím stavu vypnuto. Když je zapnuto, tento počítač komunikuje s DuckDNS (aby tvoje adresa ukazovala sem) a s Let's Encrypt (kvůli bezpečnostnímu certifikátu), proto se offline režim soukromí vypne.",
  'settings.remote.enabled': 'Vzdálený přístup byl zapnut. Nastavení může trvat asi dvě minuty; stav níže se aktualizuje sám.',
  'settings.remote.disabled': 'Vzdálený přístup byl vypnut. Deník už nelze otevřít z internetu.',
  'settings.remote.offlineTurnedOff':
    "Offline režim soukromí byl vypnut, protože vzdálený přístup se připojuje k DuckDNS a Let's Encrypt.",
  'settings.remote.detailsTitle': 'Údaje o připojení',
  'settings.remote.hostname': 'Adresa DuckDNS',
  'settings.remote.hostnameHint': 'Název vytvořený na duckdns.org, například yourpersonaldiary.duckdns.org.',
  'settings.remote.hostnameInvalid':
    'Zadej název DuckDNS, například yourpersonaldiary.duckdns.org (anglická písmena, číslice a pomlčky).',
  'settings.remote.token': 'Token DuckDNS',
  'settings.remote.tokenHint':
    'Zobrazí se po přihlášení nahoře na tvé stránce na duckdns.org. Uloží se zašifrovaně v tomto počítači a už se nikdy nezobrazí.',
  'settings.remote.tokenSaved': 'Token je uložený. Nech pole prázdné, pokud ho chceš ponechat, nebo zadej nový token, který ho nahradí.',
  'settings.remote.tokenMissing': 'Zadej svůj token DuckDNS.',
  'settings.remote.tokenInvalid':
    'Token DuckDNS vypadá takto: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (číslice a písmena a až f).',
  'settings.remote.showToken': 'Zobrazit token',
  'settings.remote.publicPort': 'Port na routeru',
  'settings.remote.publicPortHint':
    'Port, přes který se internet dostane k tomuto počítači. 443 je standardní port HTTPS; změň ho jen tehdy, když ho tvůj poskytovatel internetu blokuje.',
  'settings.remote.portInvalid': 'Zadej celé číslo od 1 do 65535.',
  'settings.remote.upnp': 'Otevřít port na routeru automaticky (UPnP)',
  'settings.remote.upnpHint':
    'Funguje s většinou domácích routerů. Pokud ne, pokyny níže vysvětlují, jak port otevřít ručně.',
  'settings.remote.save': 'Uložit údaje',
  'settings.remote.saved': 'Údaje vzdáleného přístupu byly uloženy.',
  'settings.remote.test': 'Otestovat připojení',
  'settings.remote.testTitle': 'Výsledky testu připojení',
  'settings.remote.testDone': 'Test připojení dokončen: úspěšné kontroly {passed} z {total}.',
  'settings.remote.statusTitle': 'Stav',
  'settings.remote.busy': 'Vzdálený přístup se nastavuje. Může to trvat asi dvě minuty; seznam se aktualizuje sám.',
  'settings.remote.ready': 'Vzdálený přístup je připravený. Adresa tvého deníku: {url}',
  'settings.remote.failed': 'Vzdálený přístup se nepodařilo nastavit: {message}',
  'settings.remote.lastError': 'Poslední problém: {message}',
  'settings.remote.nextRetry': 'Další automatický pokus: {time}.',
  'settings.remote.stepAt': 'Aktualizováno {time}',
  'settings.remote.state.idle': 'Nespuštěno',
  'settings.remote.state.running': 'Probíhá',
  'settings.remote.state.ok': 'Hotovo',
  'settings.remote.state.error': 'Selhalo',
  'settings.remote.state.warning': 'Upozornění',
  'settings.remote.state.skipped': 'Přeskočeno',
  'settings.remote.step.duckdns': 'Adresa DuckDNS',
  'settings.remote.step.certificate': "Bezpečnostní certifikát (Let's Encrypt)",
  'settings.remote.step.listener': 'Zabezpečené připojení (HTTPS)',
  'settings.remote.step.upnp': 'Port na routeru',
  'settings.remote.check.duckdns': 'Aktualizace DuckDNS',
  'settings.remote.check.upnp': 'Router (UPnP)',
  'settings.remote.check.dns': 'Vyhledání adresy (DNS)',
  'settings.remote.check.https': 'Připojení HTTPS',
  'settings.remote.publicIp': 'Veřejná IP adresa',
  'settings.remote.unknown': 'Neznámá',
  'settings.remote.certificate': 'Certifikát',
  'settings.remote.certificateValid':
    'Platný do {date} ({days, plural, one {zbývá # den} few {zbývají # dny} many {zbývá # dne} other {zbývá # dní}}), vydal {issuer}. Obnovuje se automaticky.',
  'settings.remote.certificateStaging': "Toto je testovací certifikát (Let's Encrypt staging); prohlížeče na něj budou upozorňovat.",
  'settings.remote.noCertificate': 'Zatím žádný certifikát.',
  'settings.remote.renew': 'Obnovit certifikát',
  'settings.remote.renewStarted': 'Obnova certifikátu začala. Může trvat asi dvě minuty.',
  'settings.remote.urlTitle': 'Adresa tvého deníku',
  'settings.remote.urlHint':
    'Otevři tuto adresu v telefonu nebo na libovolném počítači a pak se přihlas svým uživatelským jménem a heslem.',
  'settings.remote.noUrl': 'Adresa se tu zobrazí, jakmile bude zabezpečené připojení připravené.',
  'settings.remote.qrLabel': 'QR kód adresy {url}',
  'settings.remote.qrHint': 'Naskenuj kód fotoaparátem telefonu a adresa se otevře.',
  'settings.remote.instructionsTitle': 'Jak to funguje a co potřebuješ',
  'settings.remote.instructions.account':
    'Vytvoř si bezplatný účet na duckdns.org, přidej název (například yourpersonaldiary) a zkopíruj token zobrazený na stránce.',
  'settings.remote.instructions.enter':
    'Zadej výše název a token, zaškrtni „Povolit přístup z internetu“, napiš heslo ke svému účtu a zvol Uložit.',
  'settings.remote.instructions.firstCertificate': 'Vydání prvního certifikátu může trvat asi dvě minuty. Seznam stavů se aktualizuje sám.',
  'settings.remote.instructions.keepOn':
    'Nech tento počítač zapnutý a aplikaci deníku otevřenou: deník je dostupný jen tehdy, když běží obojí.',
  'settings.remote.instructions.manualForward':
    'Pokud se port na routeru nepodaří otevřít automaticky, otevři nastavení routeru a přesměruj externí port {publicPort} (TCP) na adresu tohoto počítače {ip}, port {port}.',
  'settings.remote.instructions.manualForwardNoIp':
    'Pokud se port na routeru nepodaří otevřít automaticky, otevři nastavení routeru a přesměruj externí port {publicPort} (TCP) na tento počítač (na jeho adresu v domácí síti), port {port}.',
  'settings.remote.instructions.signIn':
    'V telefonu otevři adresu a přihlas se svým uživatelským jménem a heslem – najdeš tam všechny své záznamy.',
  'settings.remote.instructions.firewall':
    'Pokud se Windows Firewall zeptá, zda povolit diary-server.exe (součást Your Personal Diary), povol ho (může být potřeba souhlas správce). Jinak budou připojení z internetu blokována.',
  'settings.remote.instructions.atHome':
    'Doma ve stejné síti se internetová adresa nemusí otevřít (mnoho routerů to nepodporuje). Tam místo toho použij „Přístup z telefonu v domácí síti“.',
  'settings.remote.privacyNote':
    "Soukromí: tvoje záznamy zůstávají v tomto počítači a putují jen zašifrované do zařízení, ze kterých se přihlašuješ. DuckDNS zná veřejnou IP adresu tohoto počítače a Let's Encrypt zná název tvé adresy. Kdo zná adresu, dostane se na přihlašovací stránku, proto používej silné heslo; opakovaně zadané chybné heslo zablokuje přihlašování z ostatních zařízení na 15 minut (tento počítač se přihlásit může vždy). Přes internet nelze vytvářet nové účty.",
  'settings.remote.offlineConflictTitle': 'Zapnout offline režim soukromí?',
  'settings.remote.offlineConflictMessage':
    "Offline režim soukromí nepovoluje připojení, která vzdálený přístup potřebuje (DuckDNS a Let's Encrypt). Jeho zapnutím se vypne i vzdálený přístup a deník už nepůjde otevřít z internetu.",
  'settings.remote.offlineConflictConfirm': 'Vypnout vzdálený přístup',
  'settings.remote.disabledByOffline': 'Vzdálený přístup byl vypnut.',
  'settings.remote.offlineConflictPassword': 'Pro vypnutí vzdáleného přístupu zadej heslo ke svému účtu.',
  // Ownership and the locked card (only the account that set remote access up can view or change it).
  'settings.remote.ownerNote': 'Tato nastavení může zobrazit a měnit jen tvůj účet. Ostatní účty v tomto počítači tuto kartu nevidí.',
  'settings.remote.setupOwnerNote':
    'Účet, který tato nastavení uloží, se stane jediným účtem v tomto počítači, který je může zobrazit a měnit.',
  'settings.remote.currentTitle': 'Aktuální nastavení',
  'settings.remote.summary.state': 'Vzdálený přístup',
  'settings.remote.summary.on': 'Zapnuto',
  'settings.remote.summary.off': 'Vypnuto',
  'settings.remote.summary.tokenSaved': 'Uložen (zašifrovaně, nikdy se nezobrazí)',
  'settings.remote.summary.upnp': 'Otevření portu na routeru',
  'settings.remote.summary.upnpAuto': 'Automaticky (UPnP)',
  'settings.remote.summary.upnpManual': 'Ručně v nastavení routeru',
  'settings.remote.lockedHint':
    'Nastavení jsou uzamčená. Chceš-li je změnit, zvol „Změnit nastavení“ a zadej heslo ke svému účtu.',
  'settings.remote.change': 'Změnit nastavení',
  'settings.remote.unlockTitle': 'Změna nastavení vzdáleného přístupu',
  'settings.remote.unlockMessage':
    'Na ochranu tvého deníku zadej heslo ke svému účtu dřív, než změníš, kde a jak je deník dostupný z internetu.',
  'settings.remote.unlocked': 'Nastavení jsou odemčená pro úpravy. Změň údaje a pak zvol Uložit.',
  'settings.remote.editCancelled': 'Nebyly provedeny žádné změny. Nastavení jsou znovu uzamčená.',
  'settings.remote.savedLocked': 'Nastavení vzdáleného přístupu byla uložena a znovu uzamčena.',
  'settings.remote.password': 'Heslo k tvému účtu',
  'settings.remote.passwordHint': 'Nutné pro uložení. Od té chvíle bude vzdálený přístup moci zobrazit a měnit jen tento účet.',
  'settings.remote.passwordMissing': 'Zadej heslo ke svému účtu.',
  'settings.remote.wrongPassword': 'Heslo není správné.',
  // E-mail for password reset (src/pages/settings/MailSection.tsx; owner-only, locked after setup, like remote access).
  'settings.mail.title': 'E-mail pro obnovení hesla',
  'settings.mail.intro':
    'Když někdo zapomene heslo, deník mu e-mailem pošle odkaz a kód, kterými si zvolí nové. K tomu deník potřebuje e-mailový účet, ze kterého bude posílat – například adresu Gmail založenou speciálně pro deník.',
  'settings.mail.ownerNote':
    'Tato nastavení může zobrazit a měnit jen tvůj účet. Ostatní účty v tomto počítači tuto kartu nevidí.',
  'settings.mail.setupOwnerNote':
    'Účet, který tato nastavení uloží, se stane jediným účtem v tomto počítači, který je může zobrazit a měnit.',
  'settings.mail.switchLabel': 'Posílat e-maily pro obnovení hesla',
  'settings.mail.switchHint':
    'Dokud je tato volba zapnutá, deník se připojuje k poštovnímu serveru jen kvůli odeslání e-mailů pro obnovení hesla a zkušebních e-mailů.',
  'settings.mail.detailsTitle': 'Odesílací účet',
  'settings.mail.address': 'Adresa Gmail',
  'settings.mail.addressHint': 'E-maily se posílají z této adresy se jménem odesílatele „Your Personal Diary“.',
  'settings.mail.addressInvalid': 'Zadej platnou e-mailovou adresu.',
  'settings.mail.appPassword': 'Heslo aplikace',
  'settings.mail.appPasswordHint':
    'Šestnáctipísmenné heslo aplikace, které Google vytvořil pro deník – ne tvoje běžné heslo k Gmailu. Na mezerách nezáleží.',
  'settings.mail.appPasswordSaved':
    'Heslo aplikace je uložené (zašifrované, nikdy se nezobrazí). Pokud ho chceš ponechat, nech pole prázdné.',
  'settings.mail.appPasswordMissing': 'Zadej heslo aplikace.',
  'settings.mail.appPasswordGmail': 'Heslo aplikace pro Gmail má 16 písmen. Tvoje běžné heslo k Gmailu tady nefunguje.',
  'settings.mail.advanced': 'Pokročilé: poštovní server',
  'settings.mail.host': 'Server odchozí pošty (SMTP)',
  'settings.mail.hostHint': 'Pro Gmail: smtp.gmail.com',
  'settings.mail.hostInvalid': 'Zadej název poštovního serveru, například smtp.gmail.com.',
  'settings.mail.port': 'Port',
  'settings.mail.portHint': '465 s SSL/TLS, 587 se STARTTLS',
  'settings.mail.portInvalid': 'Zadej číslo portu od 1 do 65535.',
  'settings.mail.security': 'Šifrování',
  'settings.mail.security.tls': 'SSL/TLS (obvykle port 465)',
  'settings.mail.security.starttls': 'STARTTLS (obvykle port 587)',
  'settings.mail.password': 'Heslo k tvému účtu',
  'settings.mail.passwordHint':
    'Heslo k tvému účtu v deníku. Nutné pro uložení; od té chvíle bude tato nastavení moci zobrazit a měnit jen tento účet.',
  'settings.mail.passwordMissing': 'Zadej heslo ke svému účtu.',
  'settings.mail.wrongPassword': 'Heslo není správné.',
  'settings.mail.saved': 'Nastavení e-mailu jsou uložená.',
  'settings.mail.savedLocked': 'Nastavení e-mailu jsou uložená a uzamčená.',
  'settings.mail.enabled':
    'Odesílání e-mailů pro obnovení hesla je zapnuté. Chceš-li ho vyzkoušet, zvol „Poslat zkušební e-mail“.',
  'settings.mail.disabled': 'Odesílání e-mailů pro obnovení hesla je vypnuté.',
  'settings.mail.notReady':
    'E-maily zatím nejde posílat: údaje nejsou úplné. Chceš-li je doplnit, zvol „Změnit nastavení“.',
  'settings.mail.currentTitle': 'Aktuální nastavení',
  'settings.mail.summary.state': 'Odesílání e-mailů pro obnovení hesla',
  'settings.mail.summary.on': 'Zapnuto',
  'settings.mail.summary.off': 'Vypnuto',
  'settings.mail.summary.address': 'Odesílatel',
  'settings.mail.summary.appPassword': 'Heslo aplikace',
  'settings.mail.summary.appPasswordSaved': 'Uloženo (zašifrovaně, nikdy se nezobrazí)',
  'settings.mail.summary.server': 'Poštovní server',
  'settings.mail.summary.serverValue': '{host}, port {port}, {security}',
  'settings.mail.lockedHint':
    'Nastavení jsou uzamčená. Chceš-li je změnit, zvol „Změnit nastavení“ a zadej heslo ke svému účtu.',
  'settings.mail.change': 'Změnit nastavení',
  'settings.mail.unlockTitle': 'Změna nastavení e-mailu',
  'settings.mail.unlockMessage':
    'Na ochranu tvého deníku zadej heslo ke svému účtu dřív, než změníš účet, ze kterého deník posílá e-maily.',
  'settings.mail.unlocked': 'Nastavení jsou odemčená pro úpravy. Změň údaje a pak zvol Uložit.',
  'settings.mail.editCancelled': 'Nebyly provedeny žádné změny. Nastavení jsou znovu uzamčená.',
  'settings.mail.test': 'Poslat zkušební e-mail',
  'settings.mail.testHint': 'Pošle krátký e-mail na tvou vlastní adresu: {email}.',
  'settings.mail.testNoEmail':
    'Tvůj účet zatím nemá e-mailovou adresu. Aby ti zkušební e-mail přišel, přidej ji na kartě „Účet“.',
  'settings.mail.testSent':
    'Zkušební e-mail byl odeslán na {email}. Podívej se do doručené pošty (i do složky se spamem).',
  'settings.mail.testFailed': 'Zkušební e-mail se nepodařilo odeslat. {message}',
  'settings.mail.instructionsTitle': 'Jak získat heslo aplikace pro Gmail',
  'settings.mail.instructions.signIn':
    'Na myaccount.google.com se přihlas k účtu Gmail, ze kterého bude deník posílat e-maily.',
  'settings.mail.instructions.twoStep':
    'Otevři „Zabezpečení“ a zapni dvoufázové ověření. Google nabízí hesla aplikací jen účtům s dvoufázovým ověřením.',
  'settings.mail.instructions.create':
    'Otevři myaccount.google.com/apppasswords (nebo v účtu Google vyhledej „Hesla aplikací“), napiš název, třeba „Your Personal Diary“, a zvol „Vytvořit“.',
  'settings.mail.instructions.copy':
    'Google jednou zobrazí heslo o 16 písmenech. Napiš ho sem do pole „Heslo aplikace“ (na mezerách nezáleží), zadej heslo ke svému účtu a zvol „Uložit“.',
  'settings.mail.instructions.test': 'Zvol „Poslat zkušební e-mail“ a zkontroluj, že dorazí do tvé doručené pošty.',
  'settings.mail.whyAppPassword':
    'Proč heslo aplikace? Google u poštovních programů odmítá běžné heslo k Gmailu, takže tady nefunguje. Heslo aplikace se dá použít jen pro poštu a v účtu Google ho můžeš kdykoli zrušit.',
  'settings.mail.privacyNote':
    'Heslo aplikace se ukládá zašifrované v tomto počítači a už se nikdy nezobrazí. E-maily obsahují jen odkaz a kód k obnovení – nikdy nic z tvého deníku.',

  // Your Personal Diary server (src/pages/settings/PrivacySection.tsx; the published apps, the web UI it serves)
  'settings.hosted.reassurance': 'Tvůj deník je uložený na serveru Your Personal Diary a šifrovaný tvým heslem.',
  'settings.hosted.serverAddress': 'Server deníku: {host}',
  'settings.hosted.offlineHint': 'Když je zapnutý, samotná aplikace nesmí otevřít žádné síťové připojení kromě připojení k serveru deníku.',
  // Server card (src/pages/settings/ServerSection.tsx): hosted server, its owner only (docs/android-tasks/SERVER-CARD.md)
  'settings.server.title': 'Server',
  'settings.server.intro': 'Stav serveru Your Personal Diary. Tuto kartu vidíš jen ty jako vlastník.',
  'settings.server.refresh': 'Obnovit',
  'settings.server.refreshed': 'Stav serveru byl aktualizován.',
  'settings.server.version': 'Verze',
  'settings.server.uptime': 'Doba běhu',
  'settings.server.accounts': 'Účty',
  'settings.server.accountsValue': '{count} z nejvýše {max}',
  'settings.server.registrations': 'Nové účty za posledních 24 hodin',
  'settings.server.disk': 'Disk',
  'settings.server.diskValue': '{used} obsazeno, {free} volno ({percent})',
  'settings.server.diskLow':
    'Na disku zbývá jen {percent} volného místa. Brzy zvětši svazek (fly volumes extend, viz provozní příručka): když se disk zaplní, změny už nepůjde uložit.',
  'settings.server.storage': 'Ukládání na disk',
  'settings.server.storageOk': 'V pořádku',
  'settings.server.storageFailed': 'Není v pořádku - ukládání selhává',
  'settings.server.storageAlert':
    'Server teď nemůže ukládat změny na svůj disk. Zkontroluj volné místo a protokol (viz provozní příručka).',
  'settings.server.lastSave': 'Poslední úspěšné uložení',
  'settings.server.noSaveYet': 'Žádné od spuštění serveru',
  'settings.server.memory': 'Využitá paměť',
  'settings.server.gigabytes': '{value} GB',
  'settings.server.lastArchive': 'Poslední archiv serveru',
  'settings.server.noArchive': 'Zatím žádný',
  'settings.server.archiveDueNone': 'Zatím neexistuje žádný archiv serveru. Připrav ho níže a stáhni si ho do počítače.',
  'settings.server.archiveDueOld': 'Poslední archiv serveru je starší než {days} dní. Připrav níže nový a stáhni si ho do počítače.',
  'settings.server.archive.title': 'Archiv serveru',
  'settings.server.archive.intro':
    'Šifrovaná kopie všech dat na serveru pro jeho obnovení po havárii. Zapisuje se na disk serveru, který uchovává 2 nejnovější; potom si ji stáhneš do počítače příkazem ve vlastním okně PowerShellu. Přes web ani aplikaci ji nikdy stáhnout nejde.',
  'settings.server.archive.listTitle': 'Archivy na serveru',
  'settings.server.archive.created': 'Připraveno',
  'settings.server.archive.size': 'Velikost',
  'settings.server.archive.download': 'Příkaz ke stažení',
  'settings.server.archive.check': 'Kontrolní příkaz',
  'settings.server.archive.copyDownload': 'Kopírovat příkaz ke stažení',
  'settings.server.archive.copyCheck': 'Kopírovat kontrolní příkaz',
  'settings.server.archive.copied': 'Příkaz byl zkopírován.',
  'settings.server.archive.copyFailed': 'Kopírování se nezdařilo. Označ příkaz a zkopíruj ho ručně.',
  'settings.server.archive.stepsTitle': 'Jak archiv stáhnout',
  'settings.server.archive.step.open': 'Na svém počítači otevři PowerShell ve složce, kde chceš soubor uchovávat.',
  'settings.server.archive.step.download': 'Vlož příkaz ke stažení a stiskni Enter.',
  'settings.server.archive.step.check': 'Vlož kontrolní příkaz a stiskni Enter. Musí vypsat True; jinak soubor stáhni znovu.',
  'settings.server.archive.step.keep': 'Soubor uchovávej offline (třeba na externím disku) a heslo archivu na jiném bezpečném místě.',
  'settings.server.archive.prepare': 'Připravit archiv serveru',
  'settings.server.archive.formTitle': 'Příprava nového archivu',
  'settings.server.archive.password': 'Heslo k tvému účtu',
  'settings.server.archive.passphrase': 'Heslo archivu',
  'settings.server.archive.passphraseHint': 'Alespoň {min} znaků. Není to heslo k účtu - zvol si samostatné a zapiš si ho.',
  'settings.server.archive.passphraseRepeat': 'Heslo archivu znovu',
  'settings.server.archive.passphraseWarning': 'Heslo archivu je potřeba k jeho obnovení a nedá se získat zpět.',
  'settings.server.archive.passwordMissing': 'Zadej heslo ke svému účtu.',
  'settings.server.archive.passphraseShort': 'Heslo archivu musí mít alespoň {min} znaků.',
  'settings.server.archive.passphraseLong': 'Heslo archivu může mít nejvýše {max} znaků.',
  'settings.server.archive.passphraseMismatch': 'Zadaná hesla archivu se neshodují.',
  'settings.server.archive.submit': 'Připravit archiv',
  'settings.server.archive.preparing': 'Archiv se připravuje. Může to trvat minutu - nech tuto stránku otevřenou.',
  'settings.server.archive.ready': 'Archiv {name} ({size}) je hotový. Stáhni si ho hned příkazem níže.',
  'settings.server.archive.busy': 'Právě se připravuje archiv.',
  'settings.server.archive.nextAt': 'Další archiv lze připravit od {time}.',
  // Deletion request by e-mail (src/pages/settings/DeletionRequest.tsx, docs/android-tasks/ADMIN-TOOL.md item 3): the card builds two commands and sends nothing
  'settings.server.deletion.title': 'Žádost o smazání e-mailem',
  'settings.server.deletion.intro':
    'Pro někoho, kdo se nemůže přihlásit a e-mailem žádá o smazání svého účtu. Samotná aplikace nemůže účty vyhledávat ani mazat: zadej sem adresu a karta připraví dva příkazy pro PowerShell na tvém počítači, které fungují jen s tvým přihlášením k Fly. Nic, co sem zadáš, se nikam neodesílá.',
  'settings.server.deletion.check': 'Zkontroluj, že žádost přišla z adresy registrované v účtu.',
  'settings.server.deletion.email': 'E-mailová adresa žadatele',
  'settings.server.deletion.waiting': 'Příkazy se tu objeví, jakmile zadáš celou e-mailovou adresu.',
  'settings.server.deletion.encoded':
    'Tato adresa obsahuje znaky, které by PowerShell změnil, proto ji příkazy nesou zakódovanou (b64:...); nástroj ji dekóduje.',
  'settings.server.deletion.find': 'Krok 1: najít účet',
  'settings.server.deletion.findHint':
    'Vlož ho do PowerShellu a stiskni Enter. Nic nemění: zobrazí uživatelské jméno účtu, e-mailovou adresu, datum registrace a velikost deníku.',
  'settings.server.deletion.copyFind': 'Kopírovat příkaz k vyhledání',
  'settings.server.deletion.username': 'Uživatelské jméno zobrazené příkazem k vyhledání',
  'settings.server.deletion.usernameHint': 'Zadej ho přesně tak, jak bylo zobrazeno; pod ním se pak objeví příkaz ke smazání.',
  'settings.server.deletion.usernameInvalid':
    'Toto není uživatelské jméno: uživatelské jméno má 3 až 32 písmen, číslic, teček, spojovníků nebo podtržítek.',
  'settings.server.deletion.delete': 'Krok 2: smazat účet',
  'settings.server.deletion.deleteHint':
    'Spusť ho až po kontrole adresy. Natrvalo smaže účet i s deníkem; nelze to vrátit zpět. Datum, které vypíše, si zapiš do svého záznamu.',
  'settings.server.deletion.copyDelete': 'Kopírovat příkaz ke smazání',
};
export default messages;
