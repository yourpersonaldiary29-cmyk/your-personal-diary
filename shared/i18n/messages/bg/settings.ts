/** bg - settings messages. Keys are prefixed 'settings.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Language card (src/pages/settings/LanguageSection.tsx, src/context/LanguageContext.tsx)
  'settings.language.title': 'Език',
  'settings.language.label': 'Език на интерфейса',
  'settings.language.hint':
    'Целият дневник веднага превключва на избрания език. Преди вход изборът се пази на това устройство, а след вход се запазва в профила ви.',
  'settings.language.changed': 'Езикът е сменен: {language}',
  'settings.language.saveFailed': 'Езикът е сменен на това устройство, но запазването му в профила не успя.',

  // Page titles (src/pages/SettingsPage.tsx, BackupPage.tsx)
  'settings.title': 'Настройки',
  'settings.backup.pageTitle': 'Резервно копие, възстановяване и експорт',
  'settings.actionCancelled': 'Операцията е отменена.',

  // Account card (src/pages/settings/AccountSection.tsx, ProfileEditor.tsx, ChangePasswordDialog.tsx)
  'settings.account.title': 'Профил',
  'settings.account.anonymousText':
    'Настройките на профила, сигурността, напомнянията и данните са достъпни след вход. Настройките на изгледа се пазят на това устройство и без профил.',
  'settings.account.setEmail': 'Задай',
  'settings.account.setEmailTitle': 'Задаване на имейл адрес',
  'settings.account.emailSaved': 'Имейл адресът е запазен.',
  'settings.account.editDetails': 'Редактирай данните',
  'settings.account.editDetailsHint': 'Името се използва и в поздрава в горната част на дневника.',
  'settings.account.emailPassword': 'Паролата на профила ви',
  'settings.account.emailPasswordHint': 'Нужна е, за да смените имейл адреса, защото на него се изпращат имейлите за нулиране на паролата.',
  'settings.account.profileSaved': 'Данните ви са запазени.',
  'settings.account.noChanges': 'Нищо не е променено.',
  'settings.account.changePassword': 'Смяна на паролата',
  'settings.account.logout': 'Изход',
  'settings.account.logoutQuestion':
    'Да излезете ли от дневника? За да се върнете, ще трябва да въведете потребителското си име и паролата.',
  'settings.account.oldPassword': 'Стара парола',
  'settings.account.newPassword': 'Нова парола',
  'settings.account.confirmNewPassword': 'Потвърдете новата парола',
  'settings.account.newPasswordHint': 'Поне {min} знака, с букви и цифри',
  'settings.account.passwordChanged': 'Паролата е сменена успешно',
  'settings.account.wrongOldPassword': 'Старата парола е грешна. Моля, опитайте отново.',
  'settings.account.passwordChangeHint': 'Смяната на паролата шифрова дневника наново и излиза от профила на всички други устройства.',
  // Account ID row (hosted server only): the server owner copies it to turn the owner cards on.
  'settings.account.accountId': 'Идентификатор на профила',
  'settings.account.copyAccountId': 'Копирай идентификатора на профила',
  'settings.account.accountIdCopied': 'Идентификаторът на профила е копиран',
  'settings.account.accountIdCopyFailed': 'Копирането не успя. Маркирайте идентификатора на профила и го копирайте ръчно.',
  'settings.account.accountIdHint': 'Той е нужен само на собственика на сървъра, за да включи разделите на собственика.',

  // Connected devices (src/pages/settings/SessionsList.tsx)
  'settings.devices.title': 'Свързани устройства',
  'settings.devices.hint':
    'Всички устройства, от които в момента е влязъл този профил. Прекъсването на устройство прекратява сесията му веднага.',
  'settings.devices.current': 'Текущо устройство',
  'settings.devices.remembered': 'Запомни ме',
  'settings.devices.unknown': 'Устройство без име',
  'settings.devices.connectedAt': 'Вход',
  'settings.devices.lastSeen': 'Последна активност',
  'settings.devices.revoke': 'Прекъсни',
  'settings.devices.revokeName': 'Прекъсни {device}',
  'settings.devices.none': 'Няма свързани устройства.',
  'settings.devices.revoked': 'Устройството „{device}“ е прекъснато.',

  // Display card (src/pages/settings/DisplaySection.tsx)
  'settings.display.title': 'Изглед',
  'settings.display.theme': 'Тема',
  'settings.display.themeOption.system': 'Като системата',
  'settings.display.themeOption.light': 'Светла',
  'settings.display.themeOption.dark': 'Тъмна',
  'settings.display.themeOption.highContrast': 'Висок контраст',
  'settings.display.themeChanged': 'Темата е сменена: {label}',
  'settings.display.fontScale': 'Размер на текста',
  'settings.display.fontScaleOption.small': 'Малък ({percent}%)',
  'settings.display.fontScaleOption.normal': 'Нормален ({percent}%)',
  'settings.display.fontScaleOption.large': 'Голям ({percent}%)',
  'settings.display.fontScaleOption.veryLarge': 'Много голям ({percent}%)',
  'settings.display.fontScaleOption.huge': 'Огромен ({percent}%)',
  'settings.display.fontScaleOption.custom': 'Потребителски ({percent}%)',
  'settings.display.fontScaleChanged': 'Размерът на текста е сменен: {label}',
  'settings.display.reduceMotion': 'Намаляване на движението',
  'settings.display.reduceMotionHint': 'Изключва анимациите и преходите в интерфейса.',
  'settings.display.reduceMotionOn': 'Намаляването на движението е включено.',
  'settings.display.reduceMotionOff': 'Намаляването на движението е изключено.',
  'settings.display.firstDayOfWeek': 'Първи ден от седмицата',
  'settings.display.sunday': 'Неделя',
  'settings.display.monday': 'Понеделник',
  'settings.display.firstDayChanged': 'Седмицата ще започва от: {label}.',
  'settings.display.anonymousHint': 'Настройките се пазят в този браузър. След вход те се запазват в профила ви.',

  // Security card (src/pages/settings/SecuritySection.tsx)
  'settings.security.title': 'Сигурност',
  'settings.security.autoLock': 'Автоматично заключване при неактивност',
  'settings.security.autoLockHint':
    'След избраното време дневникът показва заключен екран и иска паролата. Оставате влезли в профила.',
  'settings.security.autoLockOff': 'Изключено',
  'settings.security.autoLockChanged': 'Автоматично заключване: {label}',
  'settings.security.lockNow': 'Заключи сега',
  'settings.security.lockNowHint': 'Можете да заключите по всяко време и с Ctrl+L.',

  // Reminders card (src/pages/settings/RemindersSection.tsx)
  'settings.reminders.title': 'Напомняния',
  'settings.reminders.enabled': 'Показвай напомняния за навици',
  'settings.reminders.hint':
    'Напомнянията са само локални известия - на компютъра или в браузъра, където е отворен дневникът. Нищо не се изпраща навън.',
  'settings.reminders.explanation':
    'Часът на напомнянето се задава за всеки навик поотделно на страницата с навици. Докато тази опция е изключена, не се показват напомняния.',
  'settings.reminders.on': 'Напомнянията са включени.',
  'settings.reminders.off': 'Напомнянията са изключени.',
  'settings.reminders.habitsLink': 'Към страницата с навици',

  // Privacy card (src/pages/settings/PrivacySection.tsx)
  // Link to the privacy policy page of the diary server (src/components/legal/PrivacyPolicyLink.tsx)
  'settings.privacy.policyLink': 'Политика за поверителност',
  // TODO-TRANSLATE (docs/apple-tasks/TERMS-DIFF.md): English placeholder of the Terms-of-Use keys below - the translator replaces it and removes this line
  'settings.privacy.termsLink': 'Terms of Use',
  'settings.privacy.title': 'Поверителност',
  'settings.privacy.offlineLabel': 'Режим на поверителност без мрежа',
  'settings.privacy.offlineHint':
    'Когато е включен, самото приложение не може да отваря мрежови връзки освен към собствения си локален сървър. Изключете го само ако използвате отдалечен достъп.',
  'settings.privacy.offlineOn': 'Режимът на поверителност без мрежа е включен.',
  'settings.privacy.offlineOff': 'Режимът на поверителност без мрежа е изключен.',
  // Data card (src/pages/settings/DataSection.tsx)
  'settings.data.title': 'Данни',
  'settings.data.reassurance':
    'Данните от дневника ви се съхраняват в личния ви профил и са защитени с шифроване от край до край.',
  'settings.data.seedDemo': 'Зареди примерни данни',
  'settings.data.seedDemoTitle': 'Зареждане на примерни данни',
  'settings.data.seedDemoMessage':
    'В момента дневникът е празен. Ще бъдат създадени измислени записи и навици за около {days} дни, за да се запознаете с наблюденията, статистиката и търсенето. Можете да ги редактирате и изтривате като всички останали записи.',
  'settings.data.seedDemoConfirm': 'Зареди',
  'settings.data.seedDemoDone':
    'Заредени са {entries, plural, one {# запис} other {# записа}}, {habits, plural, one {# навик} other {# навика}} и {logs, plural, one {# отбелязване на навик} other {# отбелязвания на навици}}.',

  // Delete account card - the last card of the page (src/pages/settings/DeleteAccountSection.tsx)
  'settings.deleteAccount.title': 'Изтриване на профила',
  'settings.deleteAccount.warning':
    'Изтриването на профила го премахва окончателно заедно с дневника, навиците и настройките му и прекратява сесиите му на всички устройства. Той не може да бъде възстановен. Файловете с резервни копия, които сте запазили на друго място, не се засягат.',
  'settings.deleteAccount.button': 'Изтрий профила',
  'settings.deleteAccount.dialogTitle': 'Да се изтрие ли профилът „{username}“?',
  'settings.deleteAccount.passwordHint': 'За потвърждение въведете паролата на профила.',
  'settings.deleteAccount.understand': 'Разбирам, че това действие не може да бъде отменено',
  'settings.deleteAccount.confirm': 'Изтрий профила окончателно',
  'settings.deleteAccount.done': 'Всички данни и профилът бяха изтрити.',
  'settings.deleteAccount.wrongPassword': 'Паролата е грешна. Моля, опитайте отново.',
  'settings.deleteAccount.ownerRemote':
    'Вашият профил е собственик на отдалечения достъп на този компютър. При изтриването му отдалеченият достъп се изключва, а настройките му (адрес и токен за DuckDNS, сертификат) се изтриват; собственик става най-старият от останалите профили и може да го настрои отново.',
  'settings.deleteAccount.ownerMail':
    'Вашият профил е собственик на имейла за нулиране на паролата на този компютър. При изтриването му изпращането на имейли се изключва, а настройките (акаунт за изпращане и парола за приложение) се изтриват; собственик става най-старият от останалите профили и може да го настрои отново.',
  'settings.deleteAccount.ownerBoth':
    'Вашият профил е собственик на отдалечения достъп и на имейла за нулиране на паролата на този компютър. При изтриването му и двете се изключват, а настройките им (адрес и токен за DuckDNS, сертификат, акаунт за изпращане и парола за приложение) се изтриват; техен собственик става най-старият от останалите профили и може да ги настрои отново.',
  // The owner line on the Your Personal Diary server (hosted mode): its owner is DIARY_OWNER_ID only, and deleting
  // the owner erases the mail settings and promotes nobody (server/src/hosted/owner.ts, docs/API.md "בעלות").
  'settings.deleteAccount.ownerHosted':
    'Вашият профил е собственик на сървъра на дневника. При изтриването му имейлите за нулиране на паролата спират за всички профили, а настройките на имейла (акаунт за изпращане и парола за приложение) се изтриват. Никой друг профил не става собственик, затова никой няма да може да отвори картата „Сървър“ или да подготви архив на сървъра. Ако се регистрирате отново, новият профил ще получи нов идентификатор на профила, който трябва отново да бъде зададен като DIARY_OWNER_ID на сървъра.',

  // Diagnostics card (src/pages/settings/DiagnosticsSection.tsx, desktop only)
  'settings.diagnostics.title': 'Диагностика',
  'settings.diagnostics.hint':
    'Техническа информация за локалния сървър, който работи във фонов режим. Полезна е, ако нещо не работи.',
  'settings.diagnostics.uiVersion': 'Версия на интерфейса',
  'settings.diagnostics.serverVersion': 'Версия на сървъра',
  'settings.diagnostics.port': 'Порт',
  'settings.diagnostics.lanStatus': 'Мрежов достъп',
  'settings.diagnostics.lanOn': 'Включен',
  'settings.diagnostics.lanOff': 'Изключен',
  'settings.diagnostics.startedAt': 'Стартиран',
  'settings.diagnostics.showServerLog': 'Покажи журнала на сървъра',
  'settings.diagnostics.hideServerLog': 'Скрий журнала на сървъра',
  'settings.diagnostics.serverLog': 'Журнал на сървъра',
  'settings.diagnostics.serverLogEmpty': 'Журналът на сървъра е празен.',
  'settings.diagnostics.serverLogLoaded':
    'Журналът на сървъра е зареден: {count, plural, one {# ред} other {# реда}}.',
  'settings.diagnostics.serverLogFailed': 'Журналът на сървъра не можа да бъде прочетен.',
  'settings.diagnostics.restartServer': 'Рестартирай сървъра',
  'settings.diagnostics.restartTitle': 'Рестартиране на сървъра',
  'settings.diagnostics.restartMessage':
    'Локалният сървър ще бъде затворен и стартиран отново, а интерфейсът ще се презареди, за да се свърже с него. Ако „Запомни ме“ не е било отметнато, може да се наложи да влезете отново.',
  'settings.diagnostics.restartConfirm': 'Рестартирай',
  'settings.diagnostics.restarting': 'Сървърът се рестартира. Интерфейсът ще се презареди след малко.',
  'settings.diagnostics.restartFailed': 'Рестартирането на сървъра не успя.',

  // Data card: phone (LAN) access, desktop only (src/pages/settings/LanAccessSection.tsx)
  'settings.lan.title': 'Достъп от телефона в домашната мрежа',
  'settings.lan.label': 'Достъп от телефона в домашната мрежа',
  'settings.lan.hint':
    'Локалният сървър ще слуша и в домашната Wi-Fi мрежа, така че същият дневник да може да се отвори от телефона. Данните никога не напускат дома.',
  'settings.lan.onlyFromComputer':
    'Достъпът от телефона може да се включва или изключва само от компютъра, на който е инсталиран дневникът.',
  'settings.lan.enabled': 'Достъпът от телефона е включен.',
  'settings.lan.disabled': 'Достъпът от телефона е изключен.',
  'settings.lan.ownerOnly': 'Само профилът, който притежава този компютър (първият създаден на него), може да включва или изключва достъпа от телефон.',
  'settings.lan.statusOn': 'Достъпът от телефон е включен.',
  'settings.lan.statusOff': 'Достъпът от телефон е изключен.',
  'settings.lan.confirmTitle': 'Включване на достъпа от телефон',
  'settings.lan.confirmMessage': 'Телефоните и компютрите в домашната мрежа ще могат да отворят страницата за вход в дневника. За потвърждение въведете паролата на профила си.',
  'settings.lan.urlsTitle': 'Адреси за отваряне на телефона',
  'settings.lan.noUrls': 'Не е намерен мрежов адрес. Уверете се, че компютърът е свързан към Wi-Fi, и опитайте отново.',
  'settings.lan.copy': 'Копирай',
  'settings.lan.copyName': 'Копирай {url}',
  'settings.lan.copied': 'Адресът {url} е копиран.',
  'settings.lan.copyFailed': 'Копирането не успя. Можете да маркирате адреса и да го копирате ръчно.',
  'settings.lan.instructionsTitle': 'Как да се свържете от телефона',
  'settings.lan.instructions.sameNetwork': 'Уверете се, че телефонът е свързан към същата Wi-Fi мрежа като компютъра.',
  'settings.lan.instructions.openUrl':
    'Отворете един от адресите по-горе в браузъра на телефона и влезте със същото потребителско име и парола.',
  'settings.lan.instructions.firewall':
    'Първия път защитната стена на Windows може да поиска разрешение - разрешете достъп само в частни мрежи.',
  'settings.lan.instructions.sameServer':
    'Телефонът вижда точно същото като компютъра, защото и двата работят със същия локален сървър.',

  // Backup page: backup card (src/pages/settings/BackupCreateSection.tsx)
  'settings.backup.title': 'Резервно копие',
  'settings.backup.explanation':
    'Файлът с резервно копие е шифровано копие на целия дневник (записи, навици и настройки) във формат .mpd. Пазете го на сигурно място - например на външен диск. Без паролата не може да бъде отворен.',
  'settings.backup.ownPassword': 'Отделна парола за резервното копие',
  'settings.backup.ownPasswordHint':
    'По подразбиране резервното копие се шифрова с паролата на профила. Можете да изберете друга парола само за този файл.',
  'settings.backup.password': 'Парола за резервното копие',
  'settings.backup.passwordConfirm': 'Потвърдете паролата за резервното копие',
  'settings.backup.create': 'Създай файл с резервно копие',
  'settings.backup.fileFilter': 'Шифрован файл с резервно копие',
  'settings.backup.created': 'Резервното копие е създадено: {fileName} ({size}).',

  // Backup page: restore card (src/pages/settings/RestoreSection.tsx)
  'settings.restore.title': 'Възстановяване от резервно копие',
  'settings.restore.explanation':
    'Възстановяването заменя текущия дневник със съдържанието на файла с резервно копие. Паролата на профила не се променя.',
  'settings.restore.pickFile': 'Изберете файл с резервно копие',
  'settings.restore.fileField': 'Файл с резервно копие',
  'settings.restore.fileHint': 'Файл .mpd, създаден на тази страница.',
  'settings.restore.chosenFile': 'Файл',
  'settings.restore.fileSize': 'Размер',
  'settings.restore.fileStatus': 'Състояние',
  'settings.restore.inspecting': 'Проверка на файла…',
  'settings.restore.action': 'Възстанови от резервното копие',
  'settings.restore.confirmTitle': 'Да възстановим ли от резервното копие?',
  'settings.restore.warning':
    'Текущият дневник - всички записи, навици и настройки - ще бъде заменен със съдържанието на файла с резервно копие. Това не може да бъде отменено. Препоръчваме първо да създадете резервно копие на текущия дневник.',
  'settings.restore.confirm': 'Възстанови',
  'settings.restore.done':
    'Възстановяването завърши: {entries, plural, one {# запис} other {# записа}} и {habits, plural, one {# навик} other {# навика}}.',
  'settings.restore.needFile': 'Изберете файл с резервно копие',
  'settings.restore.invalidFile': 'Избраният файл не е валиден файл с резервно копие',

  // Backup page: export card (src/pages/settings/ExportSection.tsx)
  'settings.export.title': 'Експорт',
  'settings.export.explanation':
    'Експортът създава четим (нешифрован) файл със записите - например за четене, печат или използване в друга програма. Съхранявайте го съответно.',
  'settings.export.format': 'Формат',
  'settings.export.formatOption.txt': 'TXT - текст',
  'settings.export.formatOption.csv': 'CSV - таблица',
  'settings.export.formatOption.json': 'JSON - всички данни',
  'settings.export.formatOption.pdf': 'PDF - документ',
  'settings.export.formatHint.txt': 'Обикновен текстов файл, който се отваря на всеки компютър и телефон',
  'settings.export.formatHint.csv': 'За отваряне в Excel или друга електронна таблица',
  'settings.export.formatHint.json': 'Всички полета, подходящ за пренасяне в друга програма',
  'settings.export.formatHint.pdf': 'Форматиран документ за четене и печат',
  'settings.export.filter.txt': 'Текстов файл',
  'settings.export.filter.csv': 'CSV файл',
  'settings.export.filter.json': 'JSON файл',
  'settings.export.filter.pdf': 'PDF документ',
  'settings.export.from': 'От дата',
  'settings.export.to': 'До дата',
  'settings.export.rangeHint': 'Оставете празно, за да експортирате целия дневник.',
  'settings.export.rangeError': 'Крайната дата трябва да съвпада с началната или да е след нея',
  'settings.export.includeHabits': 'Включи навиците и отбелязванията',
  'settings.export.includeHabitsCsv': 'CSV файлът съдържа само записите. Навиците се включват във форматите TXT, JSON и PDF.',
  'settings.export.action': 'Експортирай',
  'settings.export.done': 'Експортът завърши: {count, plural, one {# запис} other {# записа}}.',
  'settings.export.doneWithFile': 'Експортът завърши: {count, plural, one {# запис} other {# записа}}. {fileName}',
  'settings.export.downloaded': 'Експортът завърши. Файлът {fileName} е изтеглен.',

  // Remote access card (src/pages/settings/RemoteAccessSection.tsx; the Privacy card's confirmation in PrivacySection.tsx)
  'settings.remote.title': 'Отдалечен достъп',
  'settings.remote.intro':
    'Отваряйте дневника си отвсякъде - от телефона или от друг компютър - на собствения си адрес в DuckDNS. Дневникът остава на този компютър и нищо не се качва в облак: този компютър отговаря по шифрована HTTPS връзка.',
  'settings.remote.switchLabel': 'Разреши достъп от интернет',
  'settings.remote.switchHint':
    "Изключено по подразбиране. Докато е включено, този компютър се свързва с DuckDNS (за да сочи адресът ви тук) и с Let's Encrypt (за сертификата за сигурност), затова режимът на поверителност без мрежа се изключва.",
  'settings.remote.enabled':
    'Отдалеченият достъп е включен. Настройването може да отнеме около две минути; състоянието по-долу се обновява само.',
  'settings.remote.disabled': 'Отдалеченият достъп е изключен. Дневникът вече не може да се отваря от интернет.',
  'settings.remote.offlineTurnedOff':
    "Режимът на поверителност без мрежа е изключен, защото отдалеченият достъп се свързва с DuckDNS и Let's Encrypt.",
  'settings.remote.detailsTitle': 'Данни за връзката',
  'settings.remote.hostname': 'Адрес в DuckDNS',
  'settings.remote.hostnameHint': 'Името, което сте създали в duckdns.org, например yourpersonaldiary.duckdns.org.',
  'settings.remote.hostnameInvalid':
    'Въведете име в DuckDNS, например yourpersonaldiary.duckdns.org (латински букви, цифри и тирета).',
  'settings.remote.token': 'Токен за DuckDNS',
  'settings.remote.tokenHint':
    'Показва се в горната част на страницата ви в duckdns.org след вход. Съхранява се шифрован на този компютър и повече не се показва.',
  'settings.remote.tokenSaved':
    'Има запазен токен. Оставете полето празно, за да го запазите, или въведете нов токен, за да го замените.',
  'settings.remote.tokenMissing': 'Въведете токена си за DuckDNS.',
  'settings.remote.tokenInvalid':
    'Токенът за DuckDNS изглежда така: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (цифри и латинските букви от a до f).',
  'settings.remote.showToken': 'Покажи токена',
  'settings.remote.publicPort': 'Порт на рутера',
  'settings.remote.publicPortHint':
    'Портът, през който интернет достига до този компютър. 443 е стандартният HTTPS порт; сменяйте го само ако доставчикът ви го блокира.',
  'settings.remote.portInvalid': 'Въведете цяло число от 1 до 65535.',
  'settings.remote.upnp': 'Отвори порта на рутера автоматично (UPnP)',
  'settings.remote.upnpHint':
    'Работи с повечето домашни рутери. Ако не стане, инструкциите по-долу обясняват как да отворите порта ръчно.',
  'settings.remote.save': 'Запази данните',
  'settings.remote.saved': 'Данните за отдалечения достъп са запазени.',
  'settings.remote.test': 'Провери връзката',
  'settings.remote.testTitle': 'Резултати от проверката на връзката',
  'settings.remote.testDone': 'Проверката на връзката завърши: успешни проверки - {passed} от {total}.',
  'settings.remote.statusTitle': 'Състояние',
  'settings.remote.busy':
    'Отдалеченият достъп се настройва. Това може да отнеме около две минути; списъкът се обновява сам.',
  'settings.remote.ready': 'Отдалеченият достъп е готов. Адресът на дневника ви: {url}',
  'settings.remote.failed': 'Отдалеченият достъп не можа да бъде настроен: {message}',
  'settings.remote.lastError': 'Последен проблем: {message}',
  'settings.remote.nextRetry': 'Следващ автоматичен опит: {time}.',
  'settings.remote.stepAt': 'Обновено: {time}',
  'settings.remote.state.idle': 'Не е започнато',
  'settings.remote.state.running': 'В процес',
  'settings.remote.state.ok': 'Готово',
  'settings.remote.state.error': 'Неуспешно',
  'settings.remote.state.warning': 'Предупреждение',
  'settings.remote.state.skipped': 'Пропуснато',
  'settings.remote.step.duckdns': 'Адрес в DuckDNS',
  'settings.remote.step.certificate': "Сертификат за сигурност (Let's Encrypt)",
  'settings.remote.step.listener': 'Защитена връзка (HTTPS)',
  'settings.remote.step.upnp': 'Порт на рутера',
  'settings.remote.check.duckdns': 'Обновяване в DuckDNS',
  'settings.remote.check.upnp': 'Рутер (UPnP)',
  'settings.remote.check.dns': 'Намиране на адреса (DNS)',
  'settings.remote.check.https': 'HTTPS връзка',
  'settings.remote.publicIp': 'Публичен IP адрес',
  'settings.remote.unknown': 'Неизвестно',
  'settings.remote.certificate': 'Сертификат',
  'settings.remote.certificateValid':
    'Валиден до {date} ({days, plural, one {остава # ден} other {остават # дни}}), издаден от {issuer}. Подновява се автоматично.',
  'settings.remote.certificateStaging':
    "Това е тестов сертификат (Let's Encrypt staging); браузърите ще предупреждават за него.",
  'settings.remote.noCertificate': 'Все още няма сертификат.',
  'settings.remote.renew': 'Поднови сертификата',
  'settings.remote.renewStarted': 'Подновяването на сертификата започна. Може да отнеме около две минути.',
  'settings.remote.urlTitle': 'Адресът на дневника ви',
  'settings.remote.urlHint':
    'Отворете този адрес на телефона или на който и да е компютър и влезте с потребителското си име и паролата.',
  'settings.remote.noUrl': 'Адресът ще се появи тук, щом защитената връзка е готова.',
  'settings.remote.qrLabel': 'QR код на адреса {url}',
  'settings.remote.qrHint': 'Сканирайте кода с камерата на телефона, за да отворите адреса.',
  'settings.remote.instructionsTitle': 'Как работи и какво ви трябва',
  'settings.remote.instructions.account':
    'Създайте безплатен профил в duckdns.org, добавете име (например yourpersonaldiary) и копирайте токена, показан на страницата.',
  'settings.remote.instructions.enter':
    'Въведете името и токена по-горе, отметнете „Разреши достъп от интернет“, въведете паролата на профила си и изберете „Запази данните“.',
  'settings.remote.instructions.firstCertificate':
    'Първият сертификат може да отнеме около две минути. Списъкът със състоянието се обновява сам.',
  'settings.remote.instructions.keepOn':
    'Дръжте компютъра включен и приложението на дневника отворено: дневникът е достъпен само докато и двете работят.',
  'settings.remote.instructions.manualForward':
    'Ако портът на рутера не може да се отвори автоматично, отворете настройките на рутера и пренасочете външния порт {publicPort} (TCP) към адреса на този компютър {ip}, порт {port}.',
  'settings.remote.instructions.manualForwardNoIp':
    'Ако портът на рутера не може да се отвори автоматично, отворете настройките на рутера и пренасочете външния порт {publicPort} (TCP) към този компютър (адреса му в домашната мрежа), порт {port}.',
  'settings.remote.instructions.signIn':
    'На телефона отворете адреса и влезте с потребителското си име и паролата - всичко, което сте написали, е там.',
  'settings.remote.instructions.firewall':
    'Ако защитната стена на Windows попита дали да разреши diary-server.exe (част от Your Personal Diary), разрешете (може да е нужно одобрение от администратор). В противен случай връзките от интернет се блокират.',
  'settings.remote.instructions.atHome':
    'У дома, в същата мрежа, интернет адресът може да не се отваря (много рутери не поддържат това). Там използвайте „Достъп от телефона в домашната мрежа“.',
  'settings.remote.privacyNote':
    "Поверителност: записите ви остават на този компютър и се пренасят, шифровани, само до устройствата, от които влизате. DuckDNS научава публичния IP адрес на този компютър, а Let's Encrypt - името на адреса ви. Всеки, който знае адреса, може да стигне до страницата за вход, затова използвайте силна парола; при многократно грешни пароли входът от други устройства се блокира за 15 минути (от този компютър винаги може да се влезе). През интернет не могат да се създават нови профили.",
  'settings.remote.offlineConflictTitle': 'Да включим ли режима на поверителност без мрежа?',
  'settings.remote.offlineConflictMessage':
    "Режимът на поверителност без мрежа не позволява връзките, от които се нуждае отдалеченият достъп (DuckDNS и Let's Encrypt). Включването му изключва и отдалечения достъп и дневникът вече няма да може да се отваря от интернет.",
  'settings.remote.offlineConflictConfirm': 'Изключи отдалечения достъп',
  'settings.remote.disabledByOffline': 'Отдалеченият достъп е изключен.',
  'settings.remote.offlineConflictPassword': 'Въведете паролата на профила си, за да изключите отдалечения достъп.',
  // Ownership and the locked card (only the account that set remote access up can view or change it).
  'settings.remote.ownerNote':
    'Само вашият профил може да вижда и променя тези настройки. Другите профили на този компютър не виждат този раздел.',
  'settings.remote.setupOwnerNote':
    'Профилът, който запази тези настройки, става единственият профил на този компютър, който може да ги вижда и променя.',
  'settings.remote.currentTitle': 'Текущи настройки',
  'settings.remote.summary.state': 'Отдалечен достъп',
  'settings.remote.summary.on': 'Включен',
  'settings.remote.summary.off': 'Изключен',
  'settings.remote.summary.tokenSaved': 'Запазен (шифрован, никога не се показва)',
  'settings.remote.summary.upnp': 'Отваряне на порта на рутера',
  'settings.remote.summary.upnpAuto': 'Автоматично (UPnP)',
  'settings.remote.summary.upnpManual': 'Ръчно, в настройките на рутера',
  'settings.remote.lockedHint':
    'Настройките са заключени. За да ги промените, изберете „Промени настройките“ и въведете паролата на профила си.',
  'settings.remote.change': 'Промени настройките',
  'settings.remote.unlockTitle': 'Промяна на настройките за отдалечен достъп',
  'settings.remote.unlockMessage':
    'За да защитим дневника ви, въведете паролата на профила си, преди да променяте откъде и как може да се достига от интернет.',
  'settings.remote.unlocked': 'Настройките са отключени за редакция. Променете данните и изберете „Запази данните“.',
  'settings.remote.editCancelled': 'Не са направени промени. Настройките отново са заключени.',
  'settings.remote.savedLocked': 'Данните за отдалечения достъп са запазени и отново заключени.',
  'settings.remote.password': 'Паролата на профила ви',
  'settings.remote.passwordHint':
    'Нужна е за запазване. Оттук нататък само този профил може да вижда и променя отдалечения достъп.',
  'settings.remote.passwordMissing': 'Въведете паролата на профила си.',
  'settings.remote.wrongPassword': 'Паролата е грешна.',
  // E-mail for password reset (src/pages/settings/MailSection.tsx; owner-only, locked after setup, like remote access).
  'settings.mail.title': 'Имейл за нулиране на паролата',
  'settings.mail.intro':
    'Когато някой забрави паролата си, дневникът му изпраща по имейл линк и код, с които да избере нова. За целта дневникът се нуждае от имейл акаунт, от който да изпраща – например Gmail адреса, който сте създали за дневника.',
  'settings.mail.ownerNote':
    'Само вашият профил може да вижда и променя тези настройки. Другите профили на този компютър не виждат този раздел.',
  'settings.mail.setupOwnerNote':
    'Профилът, който запази тези настройки, става единственият профил на този компютър, който може да ги вижда и променя.',
  'settings.mail.switchLabel': 'Изпращане на имейли за нулиране на паролата',
  'settings.mail.switchHint':
    'Докато това е включено, дневникът се свързва с пощенския сървър само за да изпраща имейли за нулиране на паролата и тестови имейли.',
  'settings.mail.detailsTitle': 'Акаунт за изпращане',
  'settings.mail.address': 'Gmail адрес',
  'settings.mail.addressHint': 'Имейлите се изпращат от този адрес с име на подателя „Your Personal Diary“.',
  'settings.mail.addressInvalid': 'Въведете валиден имейл адрес.',
  'settings.mail.appPassword': 'Парола за приложение',
  'settings.mail.appPasswordHint':
    'Паролата за приложение от 16 букви, която Google създаде за дневника – не обичайната ви парола за Gmail. Интервалите нямат значение.',
  'settings.mail.appPasswordSaved':
    'Има запазена парола за приложение (шифрована, никога не се показва). Оставете полето празно, за да я запазите.',
  'settings.mail.appPasswordMissing': 'Въведете паролата за приложение.',
  'settings.mail.appPasswordGmail':
    'Паролата за приложение на Gmail има 16 букви. Обичайната ви парола за Gmail не работи тук.',
  'settings.mail.advanced': 'Разширени: пощенски сървър',
  'settings.mail.host': 'Сървър за изходяща поща (SMTP)',
  'settings.mail.hostHint': 'За Gmail: smtp.gmail.com',
  'settings.mail.hostInvalid': 'Въведете името на пощенския сървър, например smtp.gmail.com.',
  'settings.mail.port': 'Порт',
  'settings.mail.portHint': '465 със SSL/TLS, 587 със STARTTLS',
  'settings.mail.portInvalid': 'Въведете номер на порт от 1 до 65535.',
  'settings.mail.security': 'Шифроване',
  'settings.mail.security.tls': 'SSL/TLS (обикновено порт 465)',
  'settings.mail.security.starttls': 'STARTTLS (обикновено порт 587)',
  'settings.mail.password': 'Паролата на профила ви',
  'settings.mail.passwordHint':
    'Паролата на профила ви в дневника. Нужна е за запазване; оттук нататък само този профил може да вижда и променя тези настройки.',
  'settings.mail.passwordMissing': 'Въведете паролата на профила си.',
  'settings.mail.wrongPassword': 'Паролата е грешна.',
  'settings.mail.saved': 'Настройките за имейл са запазени.',
  'settings.mail.savedLocked': 'Настройките за имейл са запазени и заключени.',
  'settings.mail.enabled':
    'Изпращането на имейли за нулиране на паролата е включено. Изберете „Изпрати тестов имейл“, за да го проверите.',
  'settings.mail.disabled': 'Изпращането на имейли за нулиране на паролата е изключено.',
  'settings.mail.notReady':
    'Все още не могат да се изпращат имейли: данните са непълни. Изберете „Промени настройките“, за да ги допълните.',
  'settings.mail.currentTitle': 'Текущи настройки',
  'settings.mail.summary.state': 'Изпращане на имейли за нулиране',
  'settings.mail.summary.on': 'Включено',
  'settings.mail.summary.off': 'Изключено',
  'settings.mail.summary.address': 'Изпраща се от',
  'settings.mail.summary.appPassword': 'Парола за приложение',
  'settings.mail.summary.appPasswordSaved': 'Запазена (шифрована, никога не се показва)',
  'settings.mail.summary.server': 'Пощенски сървър',
  'settings.mail.summary.serverValue': '{host}, порт {port}, {security}',
  'settings.mail.lockedHint':
    'Настройките са заключени. За да ги промените, изберете „Промени настройките“ и въведете паролата на профила си.',
  'settings.mail.change': 'Промени настройките',
  'settings.mail.unlockTitle': 'Промяна на настройките за имейл',
  'settings.mail.unlockMessage':
    'За да защитим дневника ви, въведете паролата на профила си, преди да смените акаунта, от който дневникът изпраща имейли.',
  'settings.mail.unlocked': 'Настройките са отключени за редакция. Променете данните и изберете „Запази данните“.',
  'settings.mail.editCancelled': 'Не са направени промени. Настройките отново са заключени.',
  'settings.mail.test': 'Изпрати тестов имейл',
  'settings.mail.testHint': 'Изпраща кратък имейл до вашия собствен адрес: {email}.',
  'settings.mail.testNoEmail':
    'Профилът ви все още няма имейл адрес. Добавете такъв в картата „Профил“, за да получите тестовия имейл.',
  'settings.mail.testSent': 'Изпратен е тестов имейл до {email}. Проверете входящата поща (и папката за спам).',
  'settings.mail.testFailed': 'Тестовият имейл не можа да бъде изпратен. {message}',
  'settings.mail.instructionsTitle': 'Как да получите парола за приложение на Gmail',
  'settings.mail.instructions.signIn':
    'Влезте в myaccount.google.com с акаунта в Gmail, от който дневникът ще изпраща имейли.',
  'settings.mail.instructions.twoStep':
    'Отворете „Сигурност“ и включете потвърждаването в две стъпки. Google предлага пароли за приложения само на акаунти с потвърждаване в две стъпки.',
  'settings.mail.instructions.create':
    'Отворете myaccount.google.com/apppasswords (или потърсете „Пароли за приложения“ в профила си в Google), въведете име, например „Your Personal Diary“, и изберете „Създаване“.',
  'settings.mail.instructions.copy':
    'Google показва еднократно парола от 16 букви. Въведете я тук в полето „Парола за приложение“ (интервалите нямат значение), въведете паролата на профила си и изберете „Запази“.',
  'settings.mail.instructions.test': 'Изберете „Изпрати тестов имейл“ и проверете дали пристига във входящата ви поща.',
  'settings.mail.whyAppPassword':
    'Защо парола за приложение? Google отказва обичайната парола за Gmail в пощенски програми, затова тя не работи тук. Паролата за приложение може да се използва само за поща и можете да я отмените по всяко време от профила си в Google.',
  'settings.mail.privacyNote':
    'Паролата за приложение се съхранява шифрована на този компютър и никога повече не се показва. Имейлите съдържат само линка и кода за нулиране – никога нищо от дневника ви.',

  // Your Personal Diary server (src/pages/settings/PrivacySection.tsx; the published apps, the web UI it serves)
  'settings.hosted.reassurance': 'Дневникът ви се съхранява на сървъра Your Personal Diary и е шифрован с вашата парола.',
  'settings.hosted.serverAddress': 'Сървър на дневника: {host}',
  'settings.hosted.offlineHint': 'Когато е включен, самото приложение не може да отваря мрежови връзки освен към сървъра на дневника.',
  // Server card (src/pages/settings/ServerSection.tsx): hosted server, its owner only (docs/android-tasks/SERVER-CARD.md)
  'settings.server.title': 'Сървър',
  'settings.server.intro': 'Състоянието на сървъра на Your Personal Diary. Само вие като собственик виждате тази карта.',
  'settings.server.refresh': 'Опресни',
  'settings.server.refreshed': 'Състоянието на сървъра е обновено.',
  'settings.server.version': 'Версия',
  'settings.server.uptime': 'Време на работа',
  'settings.server.accounts': 'Профили',
  'settings.server.accountsValue': '{count} от най-много {max}',
  'settings.server.registrations': 'Нови профили през последните 24 часа',
  'settings.server.disk': 'Диск',
  'settings.server.diskValue': '{used} заети, {free} свободни ({percent})',
  'settings.server.diskLow':
    'Свободни са само {percent} от диска. Скоро увеличете тома (fly volumes extend, вижте наръчника за поддръжка): когато дискът се запълни, промените вече не могат да се запазват.',
  'settings.server.storage': 'Запазване на диска',
  'settings.server.storageOk': 'Наред',
  'settings.server.storageFailed': 'Не е наред - запазването е неуспешно',
  'settings.server.storageAlert':
    'В момента сървърът не може да запазва промени на диска си. Проверете свободното място и дневника (вижте наръчника за поддръжка).',
  'settings.server.lastSave': 'Последно успешно запазване',
  'settings.server.noSaveYet': 'Няма от стартирането на сървъра',
  'settings.server.memory': 'Използвана памет',
  'settings.server.gigabytes': '{value} GB',
  'settings.server.lastArchive': 'Последен архив на сървъра',
  'settings.server.noArchive': 'Още няма',
  'settings.server.archiveDueNone': 'Все още няма архив на сървъра. Подгответе един по-долу и го изтеглете на компютъра си.',
  'settings.server.archiveDueOld':
    'Последният архив на сървъра е по-стар от {days} дни. Подгответе нов по-долу и го изтеглете на компютъра си.',
  'settings.server.archive.title': 'Архив на сървъра',
  'settings.server.archive.intro':
    'Шифровано копие на всички данни на сървъра, за да бъде възстановен след бедствие. Записва се на диска на сървъра, който пази последните 2; след това го изтегляте на компютъра си с команда в собствения си прозорец на PowerShell. Никога не може да се изтегли през уебсайта или приложението.',
  'settings.server.archive.listTitle': 'Архиви на сървъра',
  'settings.server.archive.created': 'Подготвен',
  'settings.server.archive.size': 'Размер',
  'settings.server.archive.download': 'Команда за изтегляне',
  'settings.server.archive.check': 'Команда за проверка',
  'settings.server.archive.copyDownload': 'Копирай командата за изтегляне',
  'settings.server.archive.copyCheck': 'Копирай командата за проверка',
  'settings.server.archive.copied': 'Командата е копирана.',
  'settings.server.archive.copyFailed': 'Копирането не успя. Маркирайте командата и я копирайте ръчно.',
  'settings.server.archive.stepsTitle': 'Как да изтеглите архива',
  'settings.server.archive.step.open': 'На компютъра си отворете PowerShell в папката, в която искате да пазите файла.',
  'settings.server.archive.step.download': 'Поставете командата за изтегляне и натиснете Enter.',
  'settings.server.archive.step.check':
    'Поставете командата за проверка и натиснете Enter. Тя трябва да изведе True; ако не, изтеглете файла отново.',
  'settings.server.archive.step.keep': 'Пазете файла офлайн (например на външен диск), а паролата на архива - на друго сигурно място.',
  'settings.server.archive.prepare': 'Подготви архив на сървъра',
  'settings.server.archive.formTitle': 'Подготовка на нов архив',
  'settings.server.archive.password': 'Паролата на профила ви',
  'settings.server.archive.passphrase': 'Парола на архива',
  'settings.server.archive.passphraseHint': 'Поне {min} знака. Не паролата на профила ви - изберете отделна и я запишете.',
  'settings.server.archive.passphraseRepeat': 'Паролата на архива отново',
  'settings.server.archive.passphraseWarning': 'Паролата на архива е нужна за възстановяването му и не може да бъде възстановена.',
  'settings.server.archive.passwordMissing': 'Въведете паролата на профила си.',
  'settings.server.archive.passphraseShort': 'Паролата на архива трябва да е поне {min} знака.',
  'settings.server.archive.passphraseLong': 'Паролата на архива може да е най-много {max} знака.',
  'settings.server.archive.passphraseMismatch': 'Двете пароли на архива не съвпадат.',
  'settings.server.archive.submit': 'Подготви архива',
  'settings.server.archive.preparing': 'Архивът се подготвя. Може да отнеме минута - оставете тази страница отворена.',
  'settings.server.archive.ready': 'Архивът {name} ({size}) е готов. Изтеглете го сега с командата по-долу.',
  'settings.server.archive.busy': 'В момента се подготвя архив.',
  'settings.server.archive.nextAt': 'Следващият архив може да се подготви от {time}.',
  // Deletion request by e-mail (src/pages/settings/DeletionRequest.tsx, docs/android-tasks/ADMIN-TOOL.md item 3): the card builds two commands and sends nothing
  'settings.server.deletion.title': 'Заявка за изтриване по имейл',
  'settings.server.deletion.intro':
    'За човек, който не може да влезе и моли по имейл профилът му да бъде изтрит. Самото приложение не може да търси или изтрива профили: въведете тук адреса и картата съставя две команди за PowerShell на вашия компютър, които работят само с вашия вход във Fly. Нищо от въведеното тук не се изпраща никъде.',
  'settings.server.deletion.check': 'Проверете дали заявката е дошла от адреса, регистриран в профила.',
  'settings.server.deletion.email': 'Имейл адрес на подателя на заявката',
  'settings.server.deletion.waiting': 'Командите се появяват тук, щом въведете пълен имейл адрес.',
  'settings.server.deletion.encoded':
    'Този адрес съдържа знаци, които PowerShell би променил, затова командите го носят кодиран (b64:...); инструментът го декодира.',
  'settings.server.deletion.find': 'Стъпка 1: намиране на профила',
  'settings.server.deletion.findHint':
    'Поставете я в PowerShell и натиснете Enter. Тя не променя нищо: показва потребителското име на профила, имейл адреса, датата на регистрация и размера на дневника.',
  'settings.server.deletion.copyFind': 'Копирай командата за търсене',
  'settings.server.deletion.username': 'Потребителско име, показано от командата за търсене',
  'settings.server.deletion.usernameHint': 'Въведете го точно както е показано; под него тогава ще се появи командата за изтриване.',
  'settings.server.deletion.usernameInvalid':
    'Това не е потребителско име: потребителското име има от 3 до 32 букви, цифри, точки, тирета или долни черти.',
  'settings.server.deletion.delete': 'Стъпка 2: изтриване на профила',
  'settings.server.deletion.deleteHint':
    'Изпълнете я само след като сте проверили адреса. Тя изтрива окончателно профила и дневника му; това не може да бъде отменено. Запишете в своя регистър датата, която тя показва.',
  'settings.server.deletion.copyDelete': 'Копирай командата за изтриване',
};
export default messages;
