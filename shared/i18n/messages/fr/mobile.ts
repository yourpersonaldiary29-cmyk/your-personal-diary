/** fr - mobile messages: the Android shell and the tour mode. Keys are prefixed 'mobile.'. */
const messages: Record<string, string> = {
  // Android shell (src/components/layout/MobileShell.tsx, BottomNav.tsx, MoreSheet.tsx) ---------------
  'mobile.nav.more': 'Plus',

  // Tour mode: the "Skip" button, the banner and the settings card (guest account, nothing is saved) --
  'mobile.guest.skip': 'Passer - juste jeter un œil',
  'mobile.guest.skipHint': 'Découvrez l’application avec des données d’exemple. Rien de ce que vous écrivez n’est enregistré.',
  'mobile.guest.started': 'Mode visite : vous voyez des données d’exemple. Rien de ce que vous écrivez n’est enregistré.',
  'mobile.guest.name': 'invité',
  'mobile.guest.banner': 'Mode visite - rien de ce que vous écrivez n’est enregistré.',
  'mobile.guest.createAccount': 'Créer un compte',
  'mobile.guest.endTour': 'Terminer la visite',
  'mobile.guest.ended': 'La visite est terminée.',
  'mobile.guest.unavailable': 'Le mode visite n’est pas disponible dans cette version.',
  'mobile.guest.settingsTitle': 'Mode visite',
  'mobile.guest.settingsText':
    'Les paramètres du compte, de la sécurité et de la sauvegarde ne sont pas disponibles en mode visite. Créez un compte pour les utiliser.',

  // Files on the phone (WP-7): "Save to device" / "Share" of backups and exports, an opened .mpd file ---
  'mobile.files.saveToDevice': 'Enregistrer sur l\'appareil',
  'mobile.files.share': 'Partager',
  'mobile.files.saved': 'Enregistré sur l\'appareil : {fileName}',
  'mobile.files.shared': 'Partagé : {fileName}',
  'mobile.files.openedBackup': 'Un fichier de sauvegarde a été ouvert : {fileName}. Vérifiez-le, saisissez son mot de passe et confirmez pour restaurer.',
  'mobile.files.readFailed': 'Le fichier ouvert n\'a pas pu être lu.',

  // Reminders as system notifications (WP-8): channel, texts, permission, "show habit names" ------------
  'mobile.reminders.channel': 'Rappels d\'habitudes',
  'mobile.reminders.channelDescription': 'Rappels aux heures que vous avez fixées pour vos habitudes.',
  'mobile.reminders.genericBody': 'C\'est l\'heure de l\'une de vos habitudes.',
  'mobile.reminders.permissionText': 'Pour vous le rappeler même quand l\'application est fermée, le téléphone doit autoriser les notifications de Your Personal Diary. Les rappels sont créés sur le téléphone lui-même : rien n\'en sort.',
  'mobile.reminders.allow': 'Autoriser les notifications',
  'mobile.reminders.granted': 'Les notifications sont autorisées. Les rappels arrivent même quand l\'application est fermée, généralement dans les minutes qui suivent l\'heure fixée.',
  'mobile.reminders.denied': 'Les notifications sont désactivées pour cette application. Tant que vous ne les activez pas dans les réglages du téléphone (Applications → Your Personal Diary → Notifications), les rappels n\'apparaissent que lorsque l\'application est ouverte.',
  'mobile.reminders.showNames': 'Afficher le nom des habitudes dans les notifications',
  'mobile.reminders.showNamesHint': 'Désactivé : la notification dit seulement que c\'est l\'heure d\'une habitude. Activé : le nom de l\'habitude s\'affiche, y compris sur l\'écran de verrouillage.',

  // Lock, privacy screen and biometrics (WP-9): Security card and lock screen ---------------------------
  'mobile.security.lockOnLeave': 'Verrouiller quand je quitte l\'application',
  'mobile.security.lockOnLeaveHint': 'Le journal se verrouille quand vous passez à une autre application ou que l\'écran s\'éteint ; votre mot de passe le rouvre.',
  'mobile.security.privacyScreen': 'Masquer le contenu dans les applications récentes et bloquer les captures d\'écran',
  'mobile.security.privacyScreenHint': 'L\'application apparaît comme une carte vide dans l\'écran des applications récentes et ses captures d\'écran sont bloquées.',
  'mobile.security.biometric': 'Déverrouiller par empreinte ou visage',
  'mobile.security.biometricHint': 'Uniquement pour l\'écran de verrouillage. La connexion et la confirmation de modifications sensibles demandent toujours le mot de passe.',
  'mobile.security.biometricUnavailable': 'Aucun déverrouillage par empreinte ou visage n\'est configuré sur ce téléphone.',
  'mobile.security.saved': 'Réglage enregistré.',
  'mobile.lock.biometric': 'Déverrouiller par empreinte ou visage',
  'mobile.lock.biometricTitle': 'Déverrouiller Your Personal Diary',
  'mobile.lock.usePassword': 'Utiliser le mot de passe',
  'mobile.lock.biometricFailed': 'Le déverrouillage biométrique n\'a pas fonctionné. Saisissez votre mot de passe.',
};
export default messages;
