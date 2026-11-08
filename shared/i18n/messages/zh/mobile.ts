/** zh - mobile messages: the Android shell and the tour mode. Keys are prefixed 'mobile.'. */
const messages: Record<string, string> = {
  // Android shell (src/components/layout/MobileShell.tsx, BottomNav.tsx, MoreSheet.tsx) ---------------
  'mobile.nav.more': '更多',

  // Tour mode: the "Skip" button, the banner and the settings card (guest account, nothing is saved) --
  'mobile.guest.skip': '跳过 - 先随便看看',
  'mobile.guest.skipHint': '用示例数据体验应用。你写下的内容不会保存。',
  'mobile.guest.started': '游览模式：当前显示的是示例数据。你写下的内容不会保存。',
  'mobile.guest.name': '访客',
  'mobile.guest.banner': '游览模式 - 你写下的内容不会保存。',
  'mobile.guest.createAccount': '创建账户',
  'mobile.guest.endTour': '结束游览',
  'mobile.guest.ended': '游览已结束。',
  'mobile.guest.unavailable': '此版本不支持游览模式。',
  'mobile.guest.settingsTitle': '游览模式',
  'mobile.guest.settingsText': '游览模式下无法使用账户、安全和备份设置。请创建账户后再使用。',

  // Files on the phone (WP-7): "Save to device" / "Share" of backups and exports, an opened .mpd file ---
  'mobile.files.saveToDevice': '保存到设备',
  'mobile.files.share': '分享',
  'mobile.files.saved': '已保存到设备：{fileName}',
  'mobile.files.shared': '已分享：{fileName}',
  'mobile.files.openedBackup': '已打开备份文件：{fileName}。请检查该文件，输入其密码并确认以恢复。',
  'mobile.files.readFailed': '无法读取打开的文件。',

  // Reminders as system notifications (WP-8): channel, texts, permission, "show habit names" ------------
  'mobile.reminders.channel': '习惯提醒',
  'mobile.reminders.channelDescription': '在您为习惯设定的时间发出提醒。',
  'mobile.reminders.genericBody': '该做您的一个习惯了。',
  'mobile.reminders.permissionText': '要在应用关闭时也能提醒您，手机需要允许 Your Personal Diary 显示通知。提醒在手机本地创建，不会向外发送任何内容。',
  'mobile.reminders.allow': '允许通知',
  'mobile.reminders.granted': '已允许通知。即使应用关闭，提醒也会送达，通常在设定时间后的几分钟内。',
  'mobile.reminders.denied': '此应用的通知已关闭。在您于手机设置中开启之前（应用 → Your Personal Diary → 通知），提醒只会在应用打开时显示。',
  'mobile.reminders.showNames': '在通知中显示习惯名称',
  'mobile.reminders.showNamesHint': '关闭：通知只说明到了做某个习惯的时间。开启：显示习惯名称，锁屏上也会显示。',

  // Lock, privacy screen and biometrics (WP-9): Security card and lock screen ---------------------------
  'mobile.security.lockOnLeave': '离开应用时锁定',
  'mobile.security.lockOnLeaveHint': '切换到其他应用或屏幕关闭时日记会锁定；输入密码即可再次打开。',
  'mobile.security.privacyScreen': '在最近任务中隐藏内容并阻止截屏',
  'mobile.security.privacyScreenHint': '应用在最近任务界面显示为空白卡片，并且无法对其截屏。',
  'mobile.security.biometric': '使用指纹或面容解锁',
  'mobile.security.biometricHint': '仅用于锁定屏幕。登录和确认敏感更改始终需要密码。',
  'mobile.security.biometricUnavailable': '此手机未设置指纹或面容解锁。',
  'mobile.security.saved': '设置已保存。',
  'mobile.lock.biometric': '使用指纹或面容解锁',
  'mobile.lock.biometricTitle': '解锁 Your Personal Diary',
  'mobile.lock.usePassword': '使用密码',
  'mobile.lock.biometricFailed': '生物识别解锁失败。请输入密码。',
};
export default messages;
