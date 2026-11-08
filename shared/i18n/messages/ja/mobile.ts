/** ja - mobile messages: the Android shell and the tour mode. Keys are prefixed 'mobile.'. */
const messages: Record<string, string> = {
  // Android shell (src/components/layout/MobileShell.tsx, BottomNav.tsx, MoreSheet.tsx) ---------------
  'mobile.nav.more': 'その他',

  // Tour mode: the "Skip" button, the banner and the settings card (guest account, nothing is saved) --
  'mobile.guest.skip': 'スキップ - まずは見てみる',
  'mobile.guest.skipHint': 'サンプルデータでアプリを試せます。書いた内容は保存されません。',
  'mobile.guest.started': 'ツアーモード：表示されているのはサンプルデータです。書いた内容は保存されません。',
  'mobile.guest.name': 'ゲスト',
  'mobile.guest.banner': 'ツアーモード - 書いた内容は保存されません。',
  'mobile.guest.createAccount': 'アカウントを作成',
  'mobile.guest.endTour': 'ツアーを終了',
  'mobile.guest.ended': 'ツアーを終了しました。',
  'mobile.guest.unavailable': 'このバージョンではツアーモードを利用できません。',
  'mobile.guest.settingsTitle': 'ツアーモード',
  'mobile.guest.settingsText': 'アカウント、セキュリティ、バックアップの設定はツアーモードでは利用できません。利用するにはアカウントを作成してください。',

  // Files on the phone (WP-7): "Save to device" / "Share" of backups and exports, an opened .mpd file ---
  'mobile.files.saveToDevice': '端末に保存',
  'mobile.files.share': '共有',
  'mobile.files.saved': '端末に保存しました：{fileName}',
  'mobile.files.shared': '共有しました：{fileName}',
  'mobile.files.openedBackup': 'バックアップファイルを開きました：{fileName}。内容を確認し、パスワードを入力して復元を確定してください。',
  'mobile.files.readFailed': '開いたファイルを読み取れませんでした。',

  // Reminders as system notifications (WP-8): channel, texts, permission, "show habit names" ------------
  'mobile.reminders.channel': '習慣のリマインダー',
  'mobile.reminders.channelDescription': '習慣に設定した時刻にお知らせします。',
  'mobile.reminders.genericBody': '習慣の時間です。',
  'mobile.reminders.permissionText': 'アプリを閉じているときにもお知らせするには、端末で Your Personal Diary の通知を許可する必要があります。リマインダーは端末内で作成され、外部には何も送信されません。',
  'mobile.reminders.allow': '通知を許可',
  'mobile.reminders.granted': '通知は許可されています。アプリを閉じていてもリマインダーが届きます（通常は設定時刻から数分以内）。',
  'mobile.reminders.denied': 'このアプリの通知はオフになっています。端末の設定（アプリ → Your Personal Diary → 通知）でオンにするまで、リマインダーはアプリを開いているときにのみ表示されます。',
  'mobile.reminders.showNames': '通知に習慣の名前を表示',
  'mobile.reminders.showNamesHint': 'オフ：通知には「習慣の時間」とだけ表示されます。オン：習慣の名前が表示されます（ロック画面にも）。',

  // Lock, privacy screen and biometrics (WP-9): Security card and lock screen ---------------------------
  'mobile.security.lockOnLeave': 'アプリを離れたらロック',
  'mobile.security.lockOnLeaveHint': '他のアプリに切り替えたときや画面が消えたときに日記をロックします。パスワードで再び開けます。',
  'mobile.security.privacyScreen': '最近使ったアプリで内容を隠し、スクリーンショットを禁止',
  'mobile.security.privacyScreenHint': '最近使ったアプリの画面では空白のカードとして表示され、スクリーンショットは撮れません。',
  'mobile.security.biometric': '指紋または顔でロック解除',
  'mobile.security.biometricHint': 'ロック画面のみ。ログインや重要な変更の確認には常にパスワードが必要です。',
  'mobile.security.biometricUnavailable': 'この端末では指紋または顔によるロック解除が設定されていません。',
  'mobile.security.saved': '設定を保存しました。',
  'mobile.lock.biometric': '指紋または顔でロック解除',
  'mobile.lock.biometricTitle': 'Your Personal Diary のロック解除',
  'mobile.lock.usePassword': 'パスワードを使う',
  'mobile.lock.biometricFailed': '生体認証でのロック解除に失敗しました。パスワードを入力してください。',
};
export default messages;
