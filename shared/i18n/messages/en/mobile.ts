/** en - mobile messages: the Android shell and the tour mode. Keys are prefixed 'mobile.'. */
const messages: Record<string, string> = {
  // Android shell (src/components/layout/MobileShell.tsx, BottomNav.tsx, MoreSheet.tsx) ---------------
  'mobile.nav.more': 'More',

  // Tour mode: the "Skip" button, the banner and the settings card (guest account, nothing is saved) --
  'mobile.guest.skip': 'Skip - just look around',
  'mobile.guest.skipHint': 'Explore the app with sample data. Nothing you write is saved.',
  'mobile.guest.started': 'Tour mode: you are looking at sample data. Nothing you write is saved.',
  'mobile.guest.name': 'Guest',
  'mobile.guest.banner': 'Tour mode - nothing you write is saved.',
  'mobile.guest.createAccount': 'Create an account',
  'mobile.guest.endTour': 'End the tour',
  'mobile.guest.ended': 'The tour has ended.',
  'mobile.guest.unavailable': 'Tour mode is not available in this version.',
  'mobile.guest.settingsTitle': 'Tour mode',
  'mobile.guest.settingsText': 'Account, security and backup settings are not available in tour mode. Create an account to use them.',

  // Files on the phone (WP-7): "Save to device" / "Share" of backups and exports, an opened .mpd file ---
  'mobile.files.saveToDevice': 'Save to device',
  'mobile.files.share': 'Share',
  'mobile.files.saved': 'Saved to the device: {fileName}',
  'mobile.files.shared': 'Shared: {fileName}',
  'mobile.files.openedBackup': 'A backup file was opened: {fileName}. Check it, enter its password and confirm to restore.',
  'mobile.files.readFailed': 'The opened file could not be read.',

  // Reminders as system notifications (WP-8): channel, texts, permission, "show habit names" ------------
  'mobile.reminders.channel': 'Habit reminders',
  'mobile.reminders.channelDescription': 'Reminders at the times you set for your habits.',
  'mobile.reminders.genericBody': 'Time for one of your habits.',
  'mobile.reminders.permissionText': 'To remind you while the app is closed, the phone must allow notifications for Your Personal Diary. Reminders are created on the phone itself - nothing leaves it.',
  'mobile.reminders.allow': 'Allow notifications',
  'mobile.reminders.granted': 'Notifications are allowed. Reminders arrive even when the app is closed, usually within a few minutes of the set time.',
  'mobile.reminders.denied': 'Notifications are turned off for this app. Until you turn them on in the phone settings (Apps → Your Personal Diary → Notifications), reminders appear only while the app is open.',
  'mobile.reminders.showNames': 'Show habit names in notifications',
  'mobile.reminders.showNamesHint': 'Off: the notification only says it is time for a habit. On: the habit name is shown - also on the lock screen.',

  // Lock, privacy screen and biometrics (WP-9): Security card and lock screen ---------------------------
  'mobile.security.lockOnLeave': 'Lock when I leave the app',
  'mobile.security.lockOnLeaveHint': 'The diary locks when you switch to another app or the screen turns off; your password opens it again.',
  'mobile.security.privacyScreen': 'Hide content in recent apps and block screenshots',
  'mobile.security.privacyScreenHint': 'The app shows a blank card in the recent-apps screen and screenshots of it are blocked.',
  'mobile.security.biometric': 'Unlock with fingerprint or face',
  'mobile.security.biometricHint': 'Only for the lock screen. Signing in and confirming sensitive changes always ask for your password.',
  'mobile.security.biometricUnavailable': 'No fingerprint or face unlock is set up on this phone.',
  'mobile.security.saved': 'Setting saved.',
  'mobile.lock.biometric': 'Unlock with fingerprint or face',
  'mobile.lock.biometricTitle': 'Unlock Your Personal Diary',
  'mobile.lock.usePassword': 'Use password',
  'mobile.lock.biometricFailed': 'Biometric unlock did not work. Enter your password.',
};
export default messages;
