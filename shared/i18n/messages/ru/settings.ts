/** ru - settings messages. Keys are prefixed 'settings.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Language card (src/pages/settings/LanguageSection.tsx, src/context/LanguageContext.tsx)
  'settings.language.title': 'Язык',
  'settings.language.label': 'Язык интерфейса',
  'settings.language.hint':
    'Весь дневник сразу переключится на выбранный язык. До входа выбор хранится на этом устройстве, после входа - сохраняется в вашем аккаунте.',
  'settings.language.changed': 'Язык изменён: {language}',
  'settings.language.saveFailed': 'Язык изменён на этом устройстве, но сохранить его в аккаунте не удалось.',

  // Page titles (src/pages/SettingsPage.tsx, BackupPage.tsx)
  'settings.title': 'Настройки',
  'settings.backup.pageTitle': 'Резервное копирование, восстановление и экспорт',
  'settings.actionCancelled': 'Операция отменена.',

  // Account card (src/pages/settings/AccountSection.tsx, ProfileEditor.tsx, ChangePasswordDialog.tsx)
  'settings.account.title': 'Аккаунт',
  'settings.account.anonymousText':
    'Настройки аккаунта, безопасности, напоминаний и данных доступны после входа. Настройки отображения сохраняются на этом устройстве и без аккаунта.',
  'settings.account.setEmail': 'Указать',
  'settings.account.setEmailTitle': 'Адрес электронной почты',
  'settings.account.emailSaved': 'Адрес электронной почты сохранён.',
  'settings.account.editDetails': 'Изменить данные',
  'settings.account.editDetailsHint': 'Имя также используется в приветствии в верхней части дневника.',
  'settings.account.emailPassword': 'Пароль вашего аккаунта',
  'settings.account.emailPasswordHint': 'Нужен, чтобы изменить адрес электронной почты: на него приходят письма для сброса пароля.',
  'settings.account.profileSaved': 'Ваши данные сохранены.',
  'settings.account.noChanges': 'Ничего не изменилось.',
  'settings.account.changePassword': 'Сменить пароль',
  'settings.account.logout': 'Выйти',
  'settings.account.logoutQuestion': 'Выйти из дневника? Чтобы вернуться, нужно будет ввести имя пользователя и пароль.',
  'settings.account.oldPassword': 'Текущий пароль',
  'settings.account.newPassword': 'Новый пароль',
  'settings.account.confirmNewPassword': 'Подтверждение нового пароля',
  'settings.account.newPasswordHint': 'Не менее {min} символов, буквы и цифры',
  'settings.account.passwordChanged': 'Пароль успешно изменён',
  'settings.account.wrongOldPassword': 'Текущий пароль неверен. Попробуйте ещё раз.',
  'settings.account.passwordChangeHint': 'При смене пароля дневник шифруется заново, а на всех других устройствах выполняется выход.',
  // Account ID row (hosted server only): the server owner copies it to turn the owner cards on.
  'settings.account.accountId': 'ID аккаунта',
  'settings.account.copyAccountId': 'Копировать ID аккаунта',
  'settings.account.accountIdCopied': 'ID аккаунта скопирован',
  'settings.account.accountIdCopyFailed': 'Не удалось скопировать. Выделите ID аккаунта и скопируйте его вручную.',
  'settings.account.accountIdHint': 'Он нужен только владельцу сервера, чтобы включить разделы владельца.',

  // Connected devices (src/pages/settings/SessionsList.tsx)
  'settings.devices.title': 'Подключённые устройства',
  'settings.devices.hint':
    'Все устройства, на которых сейчас выполнен вход в этот аккаунт. При отключении устройства его сеанс сразу завершается.',
  'settings.devices.current': 'Это устройство',
  'settings.devices.remembered': 'Запомнить меня',
  'settings.devices.unknown': 'Устройство без названия',
  'settings.devices.connectedAt': 'Вход выполнен',
  'settings.devices.lastSeen': 'Последняя активность',
  'settings.devices.revoke': 'Отключить',
  'settings.devices.revokeName': 'Отключить {device}',
  'settings.devices.none': 'Нет подключённых устройств.',
  'settings.devices.revoked': 'Устройство «{device}» отключено.',

  // Display card (src/pages/settings/DisplaySection.tsx)
  'settings.display.title': 'Отображение',
  'settings.display.theme': 'Тема',
  'settings.display.themeOption.system': 'Как в системе',
  'settings.display.themeOption.light': 'Светлая',
  'settings.display.themeOption.dark': 'Тёмная',
  'settings.display.themeOption.highContrast': 'Высокая контрастность',
  'settings.display.themeChanged': 'Тема изменена: {label}',
  'settings.display.fontScale': 'Размер текста',
  'settings.display.fontScaleOption.small': 'Мелкий ({percent}%)',
  'settings.display.fontScaleOption.normal': 'Обычный ({percent}%)',
  'settings.display.fontScaleOption.large': 'Крупный ({percent}%)',
  'settings.display.fontScaleOption.veryLarge': 'Очень крупный ({percent}%)',
  'settings.display.fontScaleOption.huge': 'Огромный ({percent}%)',
  'settings.display.fontScaleOption.custom': 'Свой ({percent}%)',
  'settings.display.fontScaleChanged': 'Размер текста изменён: {label}',
  'settings.display.reduceMotion': 'Уменьшить движение',
  'settings.display.reduceMotionHint': 'Отключает анимации и переходы в интерфейсе.',
  'settings.display.reduceMotionOn': 'Уменьшение движения включено.',
  'settings.display.reduceMotionOff': 'Уменьшение движения выключено.',
  'settings.display.firstDayOfWeek': 'Первый день недели',
  'settings.display.sunday': 'Воскресенье',
  'settings.display.monday': 'Понедельник',
  'settings.display.firstDayChanged': 'Первый день недели: {label}.',
  'settings.display.anonymousHint': 'Настройки хранятся в этом браузере. После входа они сохранятся в вашем аккаунте.',

  // Security card (src/pages/settings/SecuritySection.tsx)
  'settings.security.title': 'Безопасность',
  'settings.security.autoLock': 'Автоблокировка при бездействии',
  'settings.security.autoLockHint':
    'По истечении выбранного времени дневник покажет экран блокировки и запросит пароль. Вход при этом сохраняется.',
  'settings.security.autoLockOff': 'Выключена',
  'settings.security.autoLockChanged': 'Автоблокировка: {label}',
  'settings.security.lockNow': 'Заблокировать сейчас',
  'settings.security.lockNowHint': 'Заблокировать дневник можно в любой момент сочетанием Ctrl+L.',

  // Reminders card (src/pages/settings/RemindersSection.tsx)
  'settings.reminders.title': 'Напоминания',
  'settings.reminders.enabled': 'Показывать напоминания о привычках',
  'settings.reminders.hint':
    'Напоминания - это только локальные уведомления на компьютере или в браузере, где открыт дневник. Ничего никуда не отправляется.',
  'settings.reminders.explanation':
    'Время напоминания задаётся для каждой привычки отдельно на странице привычек. Пока этот параметр выключен, напоминания не показываются.',
  'settings.reminders.on': 'Напоминания включены.',
  'settings.reminders.off': 'Напоминания выключены.',
  'settings.reminders.habitsLink': 'Перейти к привычкам',

  // Privacy card (src/pages/settings/PrivacySection.tsx)
  // Link to the privacy policy page of the diary server (src/components/legal/PrivacyPolicyLink.tsx)
  'settings.privacy.policyLink': 'Политика конфиденциальности',
  'settings.privacy.termsLink': 'Условия использования',
  'settings.privacy.title': 'Конфиденциальность',
  'settings.privacy.offlineLabel': 'Автономный режим конфиденциальности',
  'settings.privacy.offlineHint':
    'Когда режим включён, приложение не открывает никаких сетевых подключений, кроме подключения к собственному локальному серверу. Выключайте его, только если пользуетесь удалённым доступом.',
  'settings.privacy.offlineOn': 'Автономный режим конфиденциальности включён.',
  'settings.privacy.offlineOff': 'Автономный режим конфиденциальности выключен.',
  // Data card (src/pages/settings/DataSection.tsx)
  'settings.data.title': 'Данные',
  'settings.data.reassurance': 'Данные вашего дневника хранятся в вашем личном аккаунте и защищены сквозным шифрованием.',
  'settings.data.seedDemo': 'Загрузить пример данных',
  'settings.data.seedDemoTitle': 'Загрузка примера данных',
  'settings.data.seedDemoMessage':
    'Сейчас дневник пуст. Будут созданы вымышленные записи и привычки примерно за {days} дней, чтобы вы могли познакомиться с наблюдениями, статистикой и поиском. Их можно изменять и удалять, как любые другие записи.',
  'settings.data.seedDemoConfirm': 'Загрузить',
  'settings.data.seedDemoDone':
    'Загружено: {entries, plural, one {# запись} few {# записи} many {# записей} other {# записи}}, {habits, plural, one {# привычка} few {# привычки} many {# привычек} other {# привычки}} и {logs, plural, one {# отметка привычек} few {# отметки привычек} many {# отметок привычек} other {# отметки привычек}}.',

  // Delete account card - the last card of the page (src/pages/settings/DeleteAccountSection.tsx)
  'settings.deleteAccount.title': 'Удаление аккаунта',
  'settings.deleteAccount.warning':
    'При удалении аккаунт безвозвратно стирается вместе с дневником, привычками и настройками, а сеансы на всех устройствах завершаются. Восстановить его невозможно. Файлы резервных копий, сохранённые в другом месте, не затрагиваются.',
  'settings.deleteAccount.button': 'Удалить аккаунт',
  'settings.deleteAccount.dialogTitle': 'Удалить аккаунт «{username}»?',
  'settings.deleteAccount.passwordHint': 'Для подтверждения введите пароль аккаунта.',
  'settings.deleteAccount.understand': 'Я понимаю, что это действие нельзя отменить',
  'settings.deleteAccount.confirm': 'Удалить аккаунт навсегда',
  'settings.deleteAccount.done': 'Все данные и аккаунт удалены.',
  'settings.deleteAccount.wrongPassword': 'Неверный пароль. Попробуйте ещё раз.',
  'settings.deleteAccount.ownerRemote':
    'Ваш аккаунт - владелец удалённого доступа на этом компьютере. При его удалении удалённый доступ отключается, а его настройки (адрес и токен DuckDNS, сертификат) стираются; владельцем становится самый старый из оставшихся аккаунтов, который сможет настроить его заново.',
  'settings.deleteAccount.ownerMail':
    'Ваш аккаунт - владелец почты для сброса пароля на этом компьютере. При его удалении отправка писем отключается, а её настройки (аккаунт отправителя и пароль приложения) стираются; владельцем становится самый старый из оставшихся аккаунтов, который сможет настроить её заново.',
  'settings.deleteAccount.ownerBoth':
    'Ваш аккаунт - владелец удалённого доступа и почты для сброса пароля на этом компьютере. При его удалении обе функции отключаются, а их настройки (адрес и токен DuckDNS, сертификат, аккаунт отправителя и пароль приложения) стираются; их владельцем становится самый старый из оставшихся аккаунтов, который сможет настроить их заново.',
  // The owner line on the Your Personal Diary server (hosted mode): its owner is DIARY_OWNER_ID only, and deleting
  // the owner erases the mail settings and promotes nobody (server/src/hosted/owner.ts, docs/API.md "בעלות").
  'settings.deleteAccount.ownerHosted':
    'Ваш аккаунт - владелец сервера дневника. При его удалении письма для сброса пароля перестают отправляться для всех аккаунтов, а настройки почты (аккаунт отправителя и пароль приложения) стираются. Другой аккаунт владельцем не становится, поэтому никто не сможет открыть карточку «Сервер» или подготовить архив сервера. Если вы зарегистрируетесь снова, у нового аккаунта будет новый ID аккаунта, и его нужно будет снова указать на сервере в DIARY_OWNER_ID.',

  // Diagnostics card (src/pages/settings/DiagnosticsSection.tsx, desktop only)
  'settings.diagnostics.title': 'Диагностика',
  'settings.diagnostics.hint':
    'Техническая информация о локальном сервере, работающем в фоне. Пригодится, если что-то не работает.',
  'settings.diagnostics.uiVersion': 'Версия интерфейса',
  'settings.diagnostics.serverVersion': 'Версия сервера',
  'settings.diagnostics.port': 'Порт',
  'settings.diagnostics.lanStatus': 'Доступ по сети',
  'settings.diagnostics.lanOn': 'Включён',
  'settings.diagnostics.lanOff': 'Выключен',
  'settings.diagnostics.startedAt': 'Запущен',
  'settings.diagnostics.showServerLog': 'Показать журнал сервера',
  'settings.diagnostics.hideServerLog': 'Скрыть журнал сервера',
  'settings.diagnostics.serverLog': 'Журнал сервера',
  'settings.diagnostics.serverLogEmpty': 'Журнал сервера пуст.',
  'settings.diagnostics.serverLogLoaded':
    'Журнал сервера загружен: {count, plural, one {# строка} few {# строки} many {# строк} other {# строки}}.',
  'settings.diagnostics.serverLogFailed': 'Не удалось прочитать журнал сервера.',
  'settings.diagnostics.restartServer': 'Перезапустить сервер',
  'settings.diagnostics.restartTitle': 'Перезапуск сервера',
  'settings.diagnostics.restartMessage':
    'Локальный сервер будет закрыт и запущен снова, а интерфейс перезагрузится, чтобы переподключиться к нему. Если флажок «Запомнить меня» не был установлен, возможно, придётся войти снова.',
  'settings.diagnostics.restartConfirm': 'Перезапустить',
  'settings.diagnostics.restarting': 'Сервер перезапускается. Интерфейс сейчас перезагрузится.',
  'settings.diagnostics.restartFailed': 'Не удалось перезапустить сервер.',

  // Data card: phone (LAN) access, desktop only (src/pages/settings/LanAccessSection.tsx)
  'settings.lan.title': 'Доступ с телефона в домашней сети',
  'settings.lan.label': 'Доступ с телефона в домашней сети',
  'settings.lan.hint':
    'Локальный сервер будет доступен и в домашней сети Wi-Fi, чтобы тот же дневник можно было открыть с телефона. Данные не покидают дом.',
  'settings.lan.onlyFromComputer': 'Включить или выключить доступ с телефона можно только на компьютере, где установлен дневник.',
  'settings.lan.enabled': 'Доступ с телефона включён.',
  'settings.lan.disabled': 'Доступ с телефона выключен.',
  'settings.lan.ownerOnly': 'Включать и выключать доступ с телефона может только аккаунт владельца этого компьютера (первый созданный на нём аккаунт).',
  'settings.lan.statusOn': 'Доступ с телефона включён.',
  'settings.lan.statusOff': 'Доступ с телефона выключен.',
  'settings.lan.confirmTitle': 'Включить доступ с телефона',
  'settings.lan.confirmMessage': 'Телефоны и компьютеры в домашней сети смогут открыть страницу входа в дневник. Для подтверждения введите пароль аккаунта.',
  'settings.lan.urlsTitle': 'Адреса для открытия на телефоне',
  'settings.lan.noUrls': 'Сетевой адрес не найден. Убедитесь, что компьютер подключён к Wi-Fi, и попробуйте снова.',
  'settings.lan.copy': 'Копировать',
  'settings.lan.copyName': 'Копировать {url}',
  'settings.lan.copied': 'Адрес {url} скопирован.',
  'settings.lan.copyFailed': 'Не удалось скопировать. Можно выделить адрес и скопировать его вручную.',
  'settings.lan.instructionsTitle': 'Как подключиться с телефона',
  'settings.lan.instructions.sameNetwork': 'Убедитесь, что телефон подключён к той же сети Wi-Fi, что и компьютер.',
  'settings.lan.instructions.openUrl':
    'Откройте один из адресов выше в браузере телефона и войдите с теми же именем пользователя и паролем.',
  'settings.lan.instructions.firewall':
    'При первом подключении брандмауэр Windows может запросить разрешение - разрешите доступ только в частных сетях.',
  'settings.lan.instructions.sameServer':
    'На телефоне видно ровно то же, что и на компьютере, потому что оба работают с одним и тем же локальным сервером.',

  // Backup page: backup card (src/pages/settings/BackupCreateSection.tsx)
  'settings.backup.title': 'Резервная копия',
  'settings.backup.explanation':
    'Файл резервной копии - это зашифрованная копия всего дневника (записи, привычки и настройки) в формате .mpd. Храните его в надёжном месте, например на внешнем диске. Без пароля его невозможно открыть.',
  'settings.backup.ownPassword': 'Отдельный пароль для резервной копии',
  'settings.backup.ownPasswordHint':
    'По умолчанию резервная копия шифруется паролем аккаунта. Можно задать другой пароль только для этого файла.',
  'settings.backup.password': 'Пароль резервной копии',
  'settings.backup.passwordConfirm': 'Подтверждение пароля резервной копии',
  'settings.backup.create': 'Создать файл резервной копии',
  'settings.backup.fileFilter': 'Зашифрованный файл резервной копии',
  'settings.backup.created': 'Резервная копия создана: {fileName} ({size}).',

  // Backup page: restore card (src/pages/settings/RestoreSection.tsx)
  'settings.restore.title': 'Восстановление из резервной копии',
  'settings.restore.explanation':
    'При восстановлении текущий дневник заменяется содержимым файла резервной копии. Пароль аккаунта не меняется.',
  'settings.restore.pickFile': 'Выбрать файл резервной копии',
  'settings.restore.fileField': 'Файл резервной копии',
  'settings.restore.fileHint': 'Файл .mpd, созданный на этой странице.',
  'settings.restore.chosenFile': 'Файл',
  'settings.restore.fileSize': 'Размер',
  'settings.restore.fileStatus': 'Состояние',
  'settings.restore.inspecting': 'Проверяем файл…',
  'settings.restore.action': 'Восстановить из резервной копии',
  'settings.restore.confirmTitle': 'Восстановить из резервной копии?',
  'settings.restore.warning':
    'Текущий дневник - все записи, привычки и настройки - будет заменён содержимым файла резервной копии. Это действие нельзя отменить. Рекомендуем сначала создать резервную копию текущего дневника.',
  'settings.restore.confirm': 'Восстановить',
  'settings.restore.done':
    'Восстановление завершено: {entries, plural, one {# запись} few {# записи} many {# записей} other {# записи}} и {habits, plural, one {# привычка} few {# привычки} many {# привычек} other {# привычки}}.',
  'settings.restore.needFile': 'Выберите файл резервной копии',
  'settings.restore.invalidFile': 'Выбранный файл не является корректным файлом резервной копии',

  // Backup page: export card (src/pages/settings/ExportSection.tsx)
  'settings.export.title': 'Экспорт',
  'settings.export.explanation':
    'Экспорт создаёт читаемый (незашифрованный) файл с записями - например, для чтения, печати или использования в другой программе. Храните его с соответствующей осторожностью.',
  'settings.export.format': 'Формат',
  'settings.export.formatOption.txt': 'TXT - текст',
  'settings.export.formatOption.csv': 'CSV - таблица',
  'settings.export.formatOption.json': 'JSON - все данные',
  'settings.export.formatOption.pdf': 'PDF - документ',
  'settings.export.formatHint.txt': 'Обычный текстовый файл, который откроется на любом компьютере и телефоне',
  'settings.export.formatHint.csv': 'Для открытия в Excel или другой электронной таблице',
  'settings.export.formatHint.json': 'Все поля; подходит для переноса в другую программу',
  'settings.export.formatHint.pdf': 'Оформленный документ для чтения и печати',
  'settings.export.filter.txt': 'Текстовый файл',
  'settings.export.filter.csv': 'Файл CSV',
  'settings.export.filter.json': 'Файл JSON',
  'settings.export.filter.pdf': 'Документ PDF',
  'settings.export.from': 'С даты',
  'settings.export.to': 'По дату',
  'settings.export.rangeHint': 'Оставьте пустым, чтобы экспортировать весь дневник.',
  'settings.export.rangeError': 'Конечная дата должна совпадать с начальной или быть позже неё',
  'settings.export.includeHabits': 'Включить привычки и отметки',
  'settings.export.includeHabitsCsv': 'Файл CSV содержит только записи. Привычки включаются в форматы TXT, JSON и PDF.',
  'settings.export.action': 'Экспортировать',
  'settings.export.done':
    'Экспорт завершён: {count, plural, one {# запись} few {# записи} many {# записей} other {# записи}}.',
  'settings.export.doneWithFile':
    'Экспорт завершён: {count, plural, one {# запись} few {# записи} many {# записей} other {# записи}}. {fileName}',
  'settings.export.downloaded': 'Экспорт завершён. Файл {fileName} скачан.',

  // Remote access card (src/pages/settings/RemoteAccessSection.tsx; the Privacy card's confirmation in PrivacySection.tsx)
  'settings.remote.title': 'Удалённый доступ',
  'settings.remote.intro':
    'Открывайте дневник откуда угодно - с телефона или другого компьютера - по собственному адресу DuckDNS. Дневник остаётся на этом компьютере и ничего не загружается в облако: этот компьютер отвечает по зашифрованному соединению HTTPS.',
  'settings.remote.switchLabel': 'Разрешить доступ из интернета',
  'settings.remote.switchHint':
    "По умолчанию выключено. Пока доступ включён, этот компьютер обращается к DuckDNS (чтобы ваш адрес указывал сюда) и к Let's Encrypt (за сертификатом безопасности), поэтому автономный режим конфиденциальности отключается.",
  'settings.remote.enabled':
    'Удалённый доступ включён. Настройка может занять около двух минут; состояние ниже обновляется само.',
  'settings.remote.disabled': 'Удалённый доступ выключен. Дневник больше нельзя открыть из интернета.',
  'settings.remote.offlineTurnedOff':
    "Автономный режим конфиденциальности выключен, потому что удалённый доступ подключается к DuckDNS и Let's Encrypt.",
  'settings.remote.detailsTitle': 'Параметры подключения',
  'settings.remote.hostname': 'Адрес DuckDNS',
  'settings.remote.hostnameHint': 'Имя, которое вы создали на duckdns.org, например yourpersonaldiary.duckdns.org.',
  'settings.remote.hostnameInvalid':
    'Введите имя DuckDNS, например yourpersonaldiary.duckdns.org (латинские буквы, цифры и дефисы).',
  'settings.remote.token': 'Токен DuckDNS',
  'settings.remote.tokenHint':
    'Отображается в верхней части вашей страницы на duckdns.org после входа. Хранится в зашифрованном виде на этом компьютере и больше не показывается.',
  'settings.remote.tokenSaved': 'Токен сохранён. Оставьте поле пустым, чтобы сохранить его, или введите новый токен для замены.',
  'settings.remote.tokenMissing': 'Введите токен DuckDNS.',
  'settings.remote.tokenInvalid':
    'Токен DuckDNS выглядит так: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (цифры и латинские буквы от a до f).',
  'settings.remote.showToken': 'Показать токен',
  'settings.remote.publicPort': 'Порт на роутере',
  'settings.remote.publicPortHint':
    'Порт, через который интернет обращается к этому компьютеру. 443 - стандартный порт HTTPS; меняйте его, только если провайдер его блокирует.',
  'settings.remote.portInvalid': 'Введите целое число от 1 до 65535.',
  'settings.remote.upnp': 'Открыть порт на роутере автоматически (UPnP)',
  'settings.remote.upnpHint':
    'Работает с большинством домашних роутеров. Если не получится, в инструкции ниже описано, как открыть порт вручную.',
  'settings.remote.save': 'Сохранить параметры',
  'settings.remote.saved': 'Параметры удалённого доступа сохранены.',
  'settings.remote.test': 'Проверить подключение',
  'settings.remote.testTitle': 'Результаты проверки подключения',
  'settings.remote.testDone': 'Проверка подключения завершена: пройдено проверок - {passed} из {total}.',
  'settings.remote.statusTitle': 'Состояние',
  'settings.remote.busy': 'Идёт настройка удалённого доступа. Это может занять около двух минут; список обновляется сам.',
  'settings.remote.ready': 'Удалённый доступ готов. Адрес вашего дневника: {url}',
  'settings.remote.failed': 'Не удалось настроить удалённый доступ: {message}',
  'settings.remote.lastError': 'Последняя проблема: {message}',
  'settings.remote.nextRetry': 'Следующая автоматическая попытка: {time}.',
  'settings.remote.stepAt': 'Обновлено: {time}',
  'settings.remote.state.idle': 'Не начато',
  'settings.remote.state.running': 'Выполняется',
  'settings.remote.state.ok': 'Готово',
  'settings.remote.state.error': 'Ошибка',
  'settings.remote.state.warning': 'Предупреждение',
  'settings.remote.state.skipped': 'Пропущено',
  'settings.remote.step.duckdns': 'Адрес DuckDNS',
  'settings.remote.step.certificate': "Сертификат безопасности (Let's Encrypt)",
  'settings.remote.step.listener': 'Защищённое соединение (HTTPS)',
  'settings.remote.step.upnp': 'Порт на роутере',
  'settings.remote.check.duckdns': 'Обновление DuckDNS',
  'settings.remote.check.upnp': 'Роутер (UPnP)',
  'settings.remote.check.dns': 'Поиск адреса (DNS)',
  'settings.remote.check.https': 'Соединение HTTPS',
  'settings.remote.publicIp': 'Внешний IP-адрес',
  'settings.remote.unknown': 'Неизвестно',
  'settings.remote.certificate': 'Сертификат',
  'settings.remote.certificateValid':
    'Действителен до {date} ({days, plural, one {остался # день} few {осталось # дня} many {осталось # дней} other {осталось # дня}}), издатель: {issuer}. Продлевается автоматически.',
  'settings.remote.certificateStaging':
    "Это тестовый сертификат (Let's Encrypt staging); браузеры будут показывать о нём предупреждение.",
  'settings.remote.noCertificate': 'Сертификата пока нет.',
  'settings.remote.renew': 'Продлить сертификат',
  'settings.remote.renewStarted': 'Продление сертификата запущено. Это может занять около двух минут.',
  'settings.remote.urlTitle': 'Адрес вашего дневника',
  'settings.remote.urlHint':
    'Откройте этот адрес на телефоне или на любом компьютере и войдите со своими именем пользователя и паролем.',
  'settings.remote.noUrl': 'Адрес появится здесь, когда защищённое соединение будет готово.',
  'settings.remote.qrLabel': 'QR-код адреса {url}',
  'settings.remote.qrHint': 'Отсканируйте код камерой телефона, чтобы открыть адрес.',
  'settings.remote.instructionsTitle': 'Как это работает и что нужно',
  'settings.remote.instructions.account':
    'Создайте бесплатный аккаунт на duckdns.org, добавьте имя (например, yourpersonaldiary) и скопируйте токен, показанный на странице.',
  'settings.remote.instructions.enter':
    'Введите имя и токен выше, отметьте «Разрешить доступ из интернета», введите пароль аккаунта и нажмите «Сохранить параметры».',
  'settings.remote.instructions.firstCertificate':
    'Получение первого сертификата может занять около двух минут. Список состояний обновляется сам.',
  'settings.remote.instructions.keepOn':
    'Не выключайте компьютер и не закрывайте приложение дневника: дневник доступен, только пока работают оба.',
  'settings.remote.instructions.manualForward':
    'Если порт на роутере не удаётся открыть автоматически, откройте настройки роутера и перенаправьте внешний порт {publicPort} (TCP) на адрес этого компьютера {ip}, порт {port}.',
  'settings.remote.instructions.manualForwardNoIp':
    'Если порт на роутере не удаётся открыть автоматически, откройте настройки роутера и перенаправьте внешний порт {publicPort} (TCP) на этот компьютер (его адрес в домашней сети), порт {port}.',
  'settings.remote.instructions.signIn':
    'На телефоне откройте адрес и войдите со своими именем пользователя и паролем - всё, что вы написали, будет там.',
  'settings.remote.instructions.firewall':
    'Если брандмауэр Windows спросит, разрешить ли diary-server.exe (часть Your Personal Diary), разрешите (может понадобиться подтверждение администратора). Иначе подключения из интернета будут заблокированы.',
  'settings.remote.instructions.atHome':
    'Дома, в той же сети, интернет-адрес может не открываться (многие роутеры этого не поддерживают). В этом случае используйте «Доступ с телефона в домашней сети».',
  'settings.remote.privacyNote':
    "Конфиденциальность: ваши записи остаются на этом компьютере и передаются, в зашифрованном виде, только на устройства, с которых вы входите. DuckDNS узнаёт внешний IP-адрес этого компьютера, а Let's Encrypt - имя вашего адреса. Любой, кто знает адрес, может открыть страницу входа, поэтому используйте надёжный пароль; после нескольких неверных попыток вход с других устройств блокируется на 15 минут (с этого компьютера войти можно всегда). Создавать новые аккаунты через интернет нельзя.",
  'settings.remote.offlineConflictTitle': 'Включить автономный режим конфиденциальности?',
  'settings.remote.offlineConflictMessage':
    "Автономный режим конфиденциальности не допускает подключений, необходимых для удалённого доступа (DuckDNS и Let's Encrypt). Его включение также выключит удалённый доступ, и дневник больше нельзя будет открыть из интернета.",
  'settings.remote.offlineConflictConfirm': 'Выключить удалённый доступ',
  'settings.remote.disabledByOffline': 'Удалённый доступ выключен.',
  'settings.remote.offlineConflictPassword': 'Введите пароль аккаунта, чтобы выключить удалённый доступ.',
  // Ownership and the locked card (only the account that set remote access up can view or change it).
  'settings.remote.ownerNote':
    'Просматривать и изменять эти настройки может только ваш аккаунт. Другие аккаунты на этом компьютере этот раздел не видят.',
  'settings.remote.setupOwnerNote':
    'Аккаунт, который сохранит эти настройки, станет единственным аккаунтом на этом компьютере, которому доступны их просмотр и изменение.',
  'settings.remote.currentTitle': 'Текущие настройки',
  'settings.remote.summary.state': 'Удалённый доступ',
  'settings.remote.summary.on': 'Включён',
  'settings.remote.summary.off': 'Выключен',
  'settings.remote.summary.tokenSaved': 'Сохранён (зашифрован, не показывается)',
  'settings.remote.summary.upnp': 'Открытие порта на роутере',
  'settings.remote.summary.upnpAuto': 'Автоматически (UPnP)',
  'settings.remote.summary.upnpManual': 'Вручную, в настройках роутера',
  'settings.remote.lockedHint':
    'Настройки заблокированы. Чтобы изменить их, нажмите «Изменить настройки» и введите пароль аккаунта.',
  'settings.remote.change': 'Изменить настройки',
  'settings.remote.unlockTitle': 'Изменение настроек удалённого доступа',
  'settings.remote.unlockMessage':
    'Чтобы защитить ваш дневник, введите пароль аккаунта, прежде чем менять, где и как его можно открыть из интернета.',
  'settings.remote.unlocked': 'Настройки открыты для изменения. Измените параметры и нажмите «Сохранить параметры».',
  'settings.remote.editCancelled': 'Изменения не внесены. Настройки снова заблокированы.',
  'settings.remote.savedLocked': 'Параметры удалённого доступа сохранены и снова заблокированы.',
  'settings.remote.password': 'Пароль вашего аккаунта',
  'settings.remote.passwordHint':
    'Нужен для сохранения. После этого просматривать и изменять удалённый доступ сможет только этот аккаунт.',
  'settings.remote.passwordMissing': 'Введите пароль аккаунта.',
  'settings.remote.wrongPassword': 'Неверный пароль.',
  // E-mail for password reset (src/pages/settings/MailSection.tsx; owner-only, locked after setup, like remote access).
  'settings.mail.title': 'Почта для сброса пароля',
  'settings.mail.intro':
    'Если кто-то забудет пароль, дневник пришлёт ему по почте ссылку и код для выбора нового. Для этого дневнику нужен почтовый аккаунт, с которого он будет отправлять письма, например адрес Gmail, созданный специально для дневника.',
  'settings.mail.ownerNote':
    'Просматривать и изменять эти настройки может только ваш аккаунт. Другие аккаунты на этом компьютере этот раздел не видят.',
  'settings.mail.setupOwnerNote':
    'Аккаунт, который сохранит эти настройки, станет единственным аккаунтом на этом компьютере, которому доступны их просмотр и изменение.',
  'settings.mail.switchLabel': 'Отправлять письма для сброса пароля',
  'settings.mail.switchHint':
    'Пока эта функция включена, дневник подключается к почтовому серверу только для отправки писем для сброса пароля и тестовых писем.',
  'settings.mail.detailsTitle': 'Аккаунт отправителя',
  'settings.mail.address': 'Адрес Gmail',
  'settings.mail.addressHint': 'Письма отправляются с этого адреса от имени «Your Personal Diary».',
  'settings.mail.addressInvalid': 'Введите правильный адрес электронной почты.',
  'settings.mail.appPassword': 'Пароль приложения',
  'settings.mail.appPasswordHint':
    'Пароль приложения из 16 букв, который Google создал для дневника, а не ваш обычный пароль Gmail. Пробелы не важны.',
  'settings.mail.appPasswordSaved':
    'Пароль приложения сохранён (зашифрован, не показывается). Оставьте поле пустым, чтобы сохранить его.',
  'settings.mail.appPasswordMissing': 'Введите пароль приложения.',
  'settings.mail.appPasswordGmail':
    'Пароль приложения Gmail состоит из 16 букв. Ваш обычный пароль Gmail здесь не подойдёт.',
  'settings.mail.advanced': 'Дополнительно: почтовый сервер',
  'settings.mail.host': 'Сервер исходящей почты (SMTP)',
  'settings.mail.hostHint': 'Для Gmail: smtp.gmail.com',
  'settings.mail.hostInvalid': 'Введите имя почтового сервера, например smtp.gmail.com.',
  'settings.mail.port': 'Порт',
  'settings.mail.portHint': '465 с SSL/TLS, 587 со STARTTLS',
  'settings.mail.portInvalid': 'Введите номер порта от 1 до 65535.',
  'settings.mail.security': 'Шифрование',
  'settings.mail.security.tls': 'SSL/TLS (обычно порт 465)',
  'settings.mail.security.starttls': 'STARTTLS (обычно порт 587)',
  'settings.mail.password': 'Пароль вашего аккаунта',
  'settings.mail.passwordHint':
    'Пароль вашего аккаунта в дневнике. Нужен для сохранения; после этого просматривать и изменять эти настройки сможет только этот аккаунт.',
  'settings.mail.passwordMissing': 'Введите пароль аккаунта.',
  'settings.mail.wrongPassword': 'Неверный пароль.',
  'settings.mail.saved': 'Настройки почты сохранены.',
  'settings.mail.savedLocked': 'Настройки почты сохранены и заблокированы.',
  'settings.mail.enabled':
    'Отправка писем для сброса пароля включена. Чтобы проверить её, нажмите «Отправить тестовое письмо».',
  'settings.mail.disabled': 'Отправка писем для сброса пароля выключена.',
  'settings.mail.notReady':
    'Письма пока нельзя отправлять: данные заполнены не полностью. Чтобы дополнить их, нажмите «Изменить настройки».',
  'settings.mail.currentTitle': 'Текущие настройки',
  'settings.mail.summary.state': 'Отправка писем для сброса пароля',
  'settings.mail.summary.on': 'Включена',
  'settings.mail.summary.off': 'Выключена',
  'settings.mail.summary.address': 'Отправитель',
  'settings.mail.summary.appPassword': 'Пароль приложения',
  'settings.mail.summary.appPasswordSaved': 'Сохранён (зашифрован, не показывается)',
  'settings.mail.summary.server': 'Почтовый сервер',
  'settings.mail.summary.serverValue': '{host}, порт {port}, {security}',
  'settings.mail.lockedHint':
    'Настройки заблокированы. Чтобы изменить их, нажмите «Изменить настройки» и введите пароль аккаунта.',
  'settings.mail.change': 'Изменить настройки',
  'settings.mail.unlockTitle': 'Изменение настроек почты',
  'settings.mail.unlockMessage':
    'Чтобы защитить ваш дневник, введите пароль аккаунта, прежде чем менять аккаунт, с которого дневник отправляет письма.',
  'settings.mail.unlocked': 'Настройки открыты для изменения. Измените параметры и нажмите «Сохранить параметры».',
  'settings.mail.editCancelled': 'Изменения не внесены. Настройки снова заблокированы.',
  'settings.mail.test': 'Отправить тестовое письмо',
  'settings.mail.testHint': 'Отправляет короткое письмо на ваш собственный адрес: {email}.',
  'settings.mail.testNoEmail':
    'У вашего аккаунта пока нет адреса электронной почты. Чтобы получить тестовое письмо, добавьте адрес в карточке «Аккаунт».',
  'settings.mail.testSent': 'Тестовое письмо отправлено на {email}. Проверьте входящие (и папку «Спам»).',
  'settings.mail.testFailed': 'Не удалось отправить тестовое письмо. {message}',
  'settings.mail.instructionsTitle': 'Как получить пароль приложения Gmail',
  'settings.mail.instructions.signIn':
    'Войдите на myaccount.google.com в аккаунт Gmail, с которого дневник будет отправлять письма.',
  'settings.mail.instructions.twoStep':
    'Откройте раздел «Безопасность» и включите двухэтапную аутентификацию. Google выдаёт пароли приложений только аккаунтам с двухэтапной аутентификацией.',
  'settings.mail.instructions.create':
    'Откройте myaccount.google.com/apppasswords (или найдите «Пароли приложений» в аккаунте Google), введите название, например «Your Personal Diary», и нажмите «Создать».',
  'settings.mail.instructions.copy':
    'Google один раз покажет пароль из 16 букв. Введите его здесь в поле «Пароль приложения» (пробелы не важны), введите пароль своего аккаунта и нажмите «Сохранить».',
  'settings.mail.instructions.test': 'Нажмите «Отправить тестовое письмо» и проверьте, что оно пришло во входящие.',
  'settings.mail.whyAppPassword':
    'Зачем пароль приложения? Google не принимает обычный пароль Gmail от почтовых программ, поэтому здесь он не работает. Пароль приложения подходит только для почты, и его можно в любой момент отозвать в аккаунте Google.',
  'settings.mail.privacyNote':
    'Пароль приложения хранится на этом компьютере в зашифрованном виде и больше никогда не показывается. Письма содержат только ссылку и код для сброса, но ничего из вашего дневника.',

  // Your Personal Diary server (src/pages/settings/PrivacySection.tsx; the published apps, the web UI it serves)
  'settings.hosted.reassurance': 'Ваш дневник хранится на сервере Your Personal Diary и зашифрован вашим паролем.',
  'settings.hosted.serverAddress': 'Сервер дневника: {host}',
  'settings.hosted.offlineHint': 'Когда режим включён, приложение не открывает никаких сетевых подключений, кроме подключения к серверу дневника.',
  // Server card (src/pages/settings/ServerSection.tsx): hosted server, its owner only (docs/android-tasks/SERVER-CARD.md)
  'settings.server.title': 'Сервер',
  'settings.server.intro': 'Состояние сервера Your Personal Diary. Эту карточку видите только вы как владелец.',
  'settings.server.refresh': 'Обновить',
  'settings.server.refreshed': 'Состояние сервера обновлено.',
  'settings.server.version': 'Версия',
  'settings.server.uptime': 'Время работы',
  'settings.server.accounts': 'Аккаунты',
  'settings.server.accountsValue': '{count} (максимум {max})',
  'settings.server.registrations': 'Новые аккаунты за последние 24 часа',
  'settings.server.disk': 'Диск',
  'settings.server.diskValue': 'занято {used}, свободно {free} ({percent})',
  'settings.server.diskLow':
    'На диске свободно только {percent}. Скоро увеличьте том (fly volumes extend, см. руководство по эксплуатации): когда диск заполнится, изменения больше нельзя будет сохранить.',
  'settings.server.storage': 'Сохранение на диск',
  'settings.server.storageOk': 'В порядке',
  'settings.server.storageFailed': 'Не в порядке - сохранение не удаётся',
  'settings.server.storageAlert':
    'Сейчас сервер не может сохранять изменения на свой диск. Проверьте свободное место и журнал (см. руководство по эксплуатации).',
  'settings.server.lastSave': 'Последнее успешное сохранение',
  'settings.server.noSaveYet': 'Не было с момента запуска сервера',
  'settings.server.memory': 'Используемая память',
  'settings.server.gigabytes': '{value} ГБ',
  'settings.server.lastArchive': 'Последний архив сервера',
  'settings.server.noArchive': 'Пока нет',
  'settings.server.archiveDueNone': 'Архива сервера пока нет. Подготовьте его ниже и скачайте на свой компьютер.',
  'settings.server.archiveDueOld': 'Последнему архиву сервера больше {days} дней. Подготовьте новый ниже и скачайте его на свой компьютер.',
  'settings.server.archive.title': 'Архив сервера',
  'settings.server.archive.intro':
    'Зашифрованная копия всех данных на сервере, чтобы восстановить его после аварии. Она записывается на диск сервера, где хранятся 2 самых новых архива; затем вы скачиваете её на свой компьютер командой в собственном окне PowerShell. Скачать её через сайт или приложение невозможно.',
  'settings.server.archive.listTitle': 'Архивы на сервере',
  'settings.server.archive.created': 'Подготовлен',
  'settings.server.archive.size': 'Размер',
  'settings.server.archive.download': 'Команда скачивания',
  'settings.server.archive.check': 'Команда проверки',
  'settings.server.archive.copyDownload': 'Копировать команду скачивания',
  'settings.server.archive.copyCheck': 'Копировать команду проверки',
  'settings.server.archive.copied': 'Команда скопирована.',
  'settings.server.archive.copyFailed': 'Не удалось скопировать. Выделите команду и скопируйте её вручную.',
  'settings.server.archive.stepsTitle': 'Как скачать архив',
  'settings.server.archive.step.open': 'На своём компьютере откройте PowerShell в папке, где хотите хранить файл.',
  'settings.server.archive.step.download': 'Вставьте команду скачивания и нажмите Enter.',
  'settings.server.archive.step.check':
    'Вставьте команду проверки и нажмите Enter. Она должна вывести True; если нет, скачайте файл снова.',
  'settings.server.archive.step.keep': 'Храните файл офлайн (например, на внешнем диске), а парольную фразу - в другом надёжном месте.',
  'settings.server.archive.prepare': 'Подготовить архив сервера',
  'settings.server.archive.formTitle': 'Подготовка нового архива',
  'settings.server.archive.password': 'Пароль вашего аккаунта',
  'settings.server.archive.passphrase': 'Парольная фраза архива',
  'settings.server.archive.passphraseHint': 'Не менее {min} символов. Не пароль аккаунта - выберите отдельную фразу и запишите её.',
  'settings.server.archive.passphraseRepeat': 'Парольная фраза архива ещё раз',
  'settings.server.archive.passphraseWarning': 'Парольная фраза нужна для восстановления архива, и восстановить её саму невозможно.',
  'settings.server.archive.passwordMissing': 'Введите пароль аккаунта.',
  'settings.server.archive.passphraseShort': 'Парольная фраза архива должна содержать не менее {min} символов.',
  'settings.server.archive.passphraseLong': 'Парольная фраза архива может содержать не более {max} символов.',
  'settings.server.archive.passphraseMismatch': 'Парольные фразы не совпадают.',
  'settings.server.archive.submit': 'Подготовить архив',
  'settings.server.archive.preparing': 'Архив готовится. Это может занять минуту - не закрывайте эту страницу.',
  'settings.server.archive.ready': 'Архив {name} ({size}) готов. Скачайте его сейчас командой ниже.',
  'settings.server.archive.busy': 'Сейчас готовится архив.',
  'settings.server.archive.nextAt': 'Следующий архив можно подготовить с {time}.',
  // Deletion request by e-mail (src/pages/settings/DeletionRequest.tsx, docs/android-tasks/ADMIN-TOOL.md item 3): the card builds two commands and sends nothing
  'settings.server.deletion.title': 'Запрос на удаление по электронной почте',
  'settings.server.deletion.intro':
    'Для того, кто не может войти и просит по электронной почте удалить свой аккаунт. Само приложение не может искать или удалять аккаунты: введите здесь адрес, и карточка составит две команды для PowerShell на вашем компьютере, которые работают только с вашим входом в Fly. Ничего из введённого здесь никуда не отправляется.',
  'settings.server.deletion.check': 'Убедитесь, что запрос пришёл с адреса, указанного в аккаунте.',
  'settings.server.deletion.email': 'Адрес эл. почты автора запроса',
  'settings.server.deletion.waiting': 'Команды появятся здесь, как только вы введёте полный адрес электронной почты.',
  'settings.server.deletion.encoded':
    'В этом адресе есть символы, которые PowerShell изменил бы, поэтому команды передают его в закодированном виде (b64:...); инструмент его раскодирует.',
  'settings.server.deletion.find': 'Шаг 1: найти аккаунт',
  'settings.server.deletion.findHint':
    'Вставьте её в PowerShell и нажмите Enter. Она ничего не меняет: показывает имя пользователя аккаунта, адрес эл. почты, дату регистрации и размер дневника.',
  'settings.server.deletion.copyFind': 'Копировать команду поиска',
  'settings.server.deletion.username': 'Имя пользователя, показанное командой поиска',
  'settings.server.deletion.usernameHint': 'Введите его точно так, как оно показано; под ним появится команда удаления.',
  'settings.server.deletion.usernameInvalid':
    'Это не имя пользователя: имя пользователя состоит из 3–32 букв, цифр, точек, дефисов или подчёркиваний.',
  'settings.server.deletion.delete': 'Шаг 2: удалить аккаунт',
  'settings.server.deletion.deleteHint':
    'Запускайте её только после проверки адреса. Она безвозвратно удаляет аккаунт и его дневник; отменить это нельзя. Запишите в свой журнал дату, которую она выведет.',
  'settings.server.deletion.copyDelete': 'Копировать команду удаления',
};
export default messages;
