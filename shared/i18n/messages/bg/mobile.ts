/** bg - mobile messages: the Android shell and the tour mode. Keys are prefixed 'mobile.'. */
const messages: Record<string, string> = {
  // Android shell (src/components/layout/MobileShell.tsx, BottomNav.tsx, MoreSheet.tsx) ---------------
  'mobile.nav.more': 'Още',

  // Tour mode: the "Skip" button, the banner and the settings card (guest account, nothing is saved) --
  'mobile.guest.skip': 'Пропусни - само ще разгледам',
  'mobile.guest.skipHint': 'Разгледайте приложението с примерни данни. Нищо от написаното няма да се запази.',
  'mobile.guest.started': 'Режим на разглеждане: виждате примерни данни. Нищо от написаното няма да се запази.',
  'mobile.guest.name': 'гост',
  'mobile.guest.banner': 'Режим на разглеждане - нищо от написаното няма да се запази.',
  'mobile.guest.createAccount': 'Създай профил',
  'mobile.guest.endTour': 'Край на разглеждането',
  'mobile.guest.ended': 'Разглеждането приключи.',
  'mobile.guest.unavailable': 'Режимът на разглеждане не е достъпен в тази версия.',
  'mobile.guest.settingsTitle': 'Режим на разглеждане',
  'mobile.guest.settingsText':
    'Настройките за профил, сигурност и резервно копие не са достъпни в режим на разглеждане. Създайте профил, за да ги използвате.',

  // Files on the phone (WP-7): "Save to device" / "Share" of backups and exports, an opened .mpd file ---
  'mobile.files.saveToDevice': 'Запазване на устройството',
  'mobile.files.share': 'Споделяне',
  'mobile.files.saved': 'Запазено на устройството: {fileName}',
  'mobile.files.shared': 'Споделено: {fileName}',
  'mobile.files.openedBackup': 'Отворен е файл с резервно копие: {fileName}. Проверете го, въведете паролата му и потвърдете възстановяването.',
  'mobile.files.readFailed': 'Отвореният файл не можа да бъде прочетен.',

  // Reminders as system notifications (WP-8): channel, texts, permission, "show habit names" ------------
  'mobile.reminders.channel': 'Напомняния за навици',
  'mobile.reminders.channelDescription': 'Напомняния в часовете, които сте задали за навиците си.',
  'mobile.reminders.genericBody': 'Време е за един от вашите навици.',
  'mobile.reminders.permissionText': 'За да ви напомня и при затворено приложение, телефонът трябва да разреши известията за Your Personal Diary. Напомнянията се създават на самия телефон - нищо не излиза от него.',
  'mobile.reminders.allow': 'Разрешаване на известията',
  'mobile.reminders.granted': 'Известията са разрешени. Напомнянията пристигат дори при затворено приложение, обикновено до няколко минути след зададения час.',
  'mobile.reminders.denied': 'Известията за това приложение са изключени. Докато не ги включите в настройките на телефона (Приложения → Your Personal Diary → Известия), напомнянията ще се показват само при отворено приложение.',
  'mobile.reminders.showNames': 'Показване на имената на навиците в известията',
  'mobile.reminders.showNamesHint': 'Изключено: известието казва само, че е време за навик. Включено: показва се името на навика - и на заключения екран.',

  // Lock, privacy screen and biometrics (WP-9): Security card and lock screen ---------------------------
  'mobile.security.lockOnLeave': 'Заключване, когато напусна приложението',
  'mobile.security.lockOnLeaveHint': 'Дневникът се заключва при преминаване към друго приложение или при изгасване на екрана; паролата ви го отваря отново.',
  'mobile.security.privacyScreen': 'Скриване на съдържанието в скорошните приложения и блокиране на екранни снимки',
  'mobile.security.privacyScreenHint': 'Приложението се показва като празна карта в екрана със скорошни приложения, а екранните му снимки са блокирани.',
  'mobile.security.biometric': 'Отключване с пръстов отпечатък или лице',
  'mobile.security.biometricHint': 'Само за заключения екран. Влизането и потвърждаването на чувствителни промени винаги изискват паролата.',
  'mobile.security.biometricUnavailable': 'На този телефон не е настроено отключване с пръстов отпечатък или лице.',
  'mobile.security.saved': 'Настройката е запазена.',
  'mobile.lock.biometric': 'Отключване с пръстов отпечатък или лице',
  'mobile.lock.biometricTitle': 'Отключване на Your Personal Diary',
  'mobile.lock.usePassword': 'Използване на парола',
  'mobile.lock.biometricFailed': 'Биометричното отключване не успя. Въведете паролата си.',
};
export default messages;
