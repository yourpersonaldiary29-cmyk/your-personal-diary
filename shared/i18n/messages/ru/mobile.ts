/** ru - mobile messages: the Android shell and the tour mode. Keys are prefixed 'mobile.'. */
const messages: Record<string, string> = {
  // Android shell (src/components/layout/MobileShell.tsx, BottomNav.tsx, MoreSheet.tsx) ---------------
  'mobile.nav.more': 'Ещё',

  // Tour mode: the "Skip" button, the banner and the settings card (guest account, nothing is saved) --
  'mobile.guest.skip': 'Пропустить - просто посмотреть',
  'mobile.guest.skipHint': 'Посмотрите приложение на примере данных. То, что вы напишете, не сохранится.',
  'mobile.guest.started': 'Режим знакомства: вы видите пример данных. То, что вы напишете, не сохранится.',
  'mobile.guest.name': 'гость',
  'mobile.guest.banner': 'Режим знакомства - то, что вы напишете, не сохранится.',
  'mobile.guest.createAccount': 'Создать аккаунт',
  'mobile.guest.endTour': 'Завершить знакомство',
  'mobile.guest.ended': 'Знакомство завершено.',
  'mobile.guest.unavailable': 'Режим знакомства недоступен в этой версии.',
  'mobile.guest.settingsTitle': 'Режим знакомства',
  'mobile.guest.settingsText':
    'Настройки аккаунта, безопасности и резервного копирования недоступны в режиме знакомства. Создайте аккаунт, чтобы пользоваться ими.',

  // Files on the phone (WP-7): "Save to device" / "Share" of backups and exports, an opened .mpd file ---
  'mobile.files.saveToDevice': 'Сохранить на устройстве',
  'mobile.files.share': 'Поделиться',
  'mobile.files.saved': 'Сохранено на устройстве: {fileName}',
  'mobile.files.shared': 'Отправлено: {fileName}',
  'mobile.files.openedBackup': 'Открыт файл резервной копии: {fileName}. Проверьте его, введите его пароль и подтвердите восстановление.',
  'mobile.files.readFailed': 'Не удалось прочитать открытый файл.',

  // Reminders as system notifications (WP-8): channel, texts, permission, "show habit names" ------------
  'mobile.reminders.channel': 'Напоминания о привычках',
  'mobile.reminders.channelDescription': 'Напоминания в то время, которое вы задали для своих привычек.',
  'mobile.reminders.genericBody': 'Время для одной из ваших привычек.',
  'mobile.reminders.permissionText': 'Чтобы напоминать вам и при закрытом приложении, телефон должен разрешить уведомления для Your Personal Diary. Напоминания создаются на самом телефоне - ничто его не покидает.',
  'mobile.reminders.allow': 'Разрешить уведомления',
  'mobile.reminders.granted': 'Уведомления разрешены. Напоминания приходят даже при закрытом приложении, обычно в течение нескольких минут после заданного времени.',
  'mobile.reminders.denied': 'Уведомления для этого приложения отключены. Пока вы не включите их в настройках телефона (Приложения → Your Personal Diary → Уведомления), напоминания будут появляться только при открытом приложении.',
  'mobile.reminders.showNames': 'Показывать названия привычек в уведомлениях',
  'mobile.reminders.showNamesHint': 'Выкл.: уведомление лишь сообщает, что пора заняться привычкой. Вкл.: показывается название привычки - в том числе на экране блокировки.',

  // Lock, privacy screen and biometrics (WP-9): Security card and lock screen ---------------------------
  'mobile.security.lockOnLeave': 'Блокировать, когда я выхожу из приложения',
  'mobile.security.lockOnLeaveHint': 'Дневник блокируется при переходе в другое приложение или выключении экрана; пароль открывает его снова.',
  'mobile.security.privacyScreen': 'Скрывать содержимое в недавних приложениях и запрещать снимки экрана',
  'mobile.security.privacyScreenHint': 'В списке недавних приложений приложение показано пустой карточкой, а снимки экрана в нём запрещены.',
  'mobile.security.biometric': 'Разблокировка по отпечатку пальца или лицу',
  'mobile.security.biometricHint': 'Только для экрана блокировки. Вход и подтверждение важных изменений всегда требуют пароль.',
  'mobile.security.biometricUnavailable': 'На этом телефоне не настроена разблокировка по отпечатку пальца или лицу.',
  'mobile.security.saved': 'Настройка сохранена.',
  'mobile.lock.biometric': 'Разблокировать по отпечатку пальца или лицу',
  'mobile.lock.biometricTitle': 'Разблокировать Your Personal Diary',
  'mobile.lock.usePassword': 'Ввести пароль',
  'mobile.lock.biometricFailed': 'Биометрическая разблокировка не сработала. Введите пароль.',
};
export default messages;
