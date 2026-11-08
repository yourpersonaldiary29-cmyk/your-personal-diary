/** es - mobile messages: the Android shell and the tour mode. Keys are prefixed 'mobile.'. */
const messages: Record<string, string> = {
  // Android shell (src/components/layout/MobileShell.tsx, BottomNav.tsx, MoreSheet.tsx) ---------------
  'mobile.nav.more': 'Más',

  // Tour mode: the "Skip" button, the banner and the settings card (guest account, nothing is saved) --
  'mobile.guest.skip': 'Omitir - solo quiero mirar',
  'mobile.guest.skipHint': 'Explora la aplicación con datos de ejemplo. No se guarda nada de lo que escribas.',
  'mobile.guest.started': 'Modo de visita: estás viendo datos de ejemplo. No se guarda nada de lo que escribas.',
  'mobile.guest.name': 'invitado',
  'mobile.guest.banner': 'Modo de visita - no se guarda nada de lo que escribas.',
  'mobile.guest.createAccount': 'Crear una cuenta',
  'mobile.guest.endTour': 'Terminar la visita',
  'mobile.guest.ended': 'La visita ha terminado.',
  'mobile.guest.unavailable': 'El modo de visita no está disponible en esta versión.',
  'mobile.guest.settingsTitle': 'Modo de visita',
  'mobile.guest.settingsText':
    'Los ajustes de cuenta, seguridad y copia de seguridad no están disponibles en el modo de visita. Crea una cuenta para usarlos.',

  // Files on the phone (WP-7): "Save to device" / "Share" of backups and exports, an opened .mpd file ---
  'mobile.files.saveToDevice': 'Guardar en el dispositivo',
  'mobile.files.share': 'Compartir',
  'mobile.files.saved': 'Guardado en el dispositivo: {fileName}',
  'mobile.files.shared': 'Compartido: {fileName}',
  'mobile.files.openedBackup': 'Se abrió un archivo de copia de seguridad: {fileName}. Revísalo, escribe su contraseña y confirma para restaurar.',
  'mobile.files.readFailed': 'No se pudo leer el archivo abierto.',

  // Reminders as system notifications (WP-8): channel, texts, permission, "show habit names" ------------
  'mobile.reminders.channel': 'Recordatorios de hábitos',
  'mobile.reminders.channelDescription': 'Recordatorios a las horas que fijaste para tus hábitos.',
  'mobile.reminders.genericBody': 'Es hora de uno de tus hábitos.',
  'mobile.reminders.permissionText': 'Para recordártelo con la aplicación cerrada, el teléfono debe permitir las notificaciones de Your Personal Diary. Los recordatorios se crean en el propio teléfono: nada sale de él.',
  'mobile.reminders.allow': 'Permitir notificaciones',
  'mobile.reminders.granted': 'Las notificaciones están permitidas. Los recordatorios llegan aunque la aplicación esté cerrada, normalmente pocos minutos después de la hora fijada.',
  'mobile.reminders.denied': 'Las notificaciones están desactivadas para esta aplicación. Hasta que las actives en los ajustes del teléfono (Aplicaciones → Your Personal Diary → Notificaciones), los recordatorios solo aparecerán con la aplicación abierta.',
  'mobile.reminders.showNames': 'Mostrar los nombres de los hábitos en las notificaciones',
  'mobile.reminders.showNamesHint': 'Desactivado: la notificación solo dice que es hora de un hábito. Activado: se muestra el nombre del hábito, también en la pantalla de bloqueo.',

  // Lock, privacy screen and biometrics (WP-9): Security card and lock screen ---------------------------
  'mobile.security.lockOnLeave': 'Bloquear al salir de la aplicación',
  'mobile.security.lockOnLeaveHint': 'El diario se bloquea al cambiar a otra aplicación o al apagarse la pantalla; tu contraseña lo abre de nuevo.',
  'mobile.security.privacyScreen': 'Ocultar el contenido en aplicaciones recientes y bloquear capturas de pantalla',
  'mobile.security.privacyScreenHint': 'La aplicación aparece como una tarjeta en blanco en la pantalla de aplicaciones recientes y no se pueden hacer capturas de ella.',
  'mobile.security.biometric': 'Desbloquear con huella o rostro',
  'mobile.security.biometricHint': 'Solo para la pantalla de bloqueo. Iniciar sesión y confirmar cambios delicados siempre piden la contraseña.',
  'mobile.security.biometricUnavailable': 'Este teléfono no tiene configurado el desbloqueo con huella o rostro.',
  'mobile.security.saved': 'Ajuste guardado.',
  'mobile.lock.biometric': 'Desbloquear con huella o rostro',
  'mobile.lock.biometricTitle': 'Desbloquear Your Personal Diary',
  'mobile.lock.usePassword': 'Usar la contraseña',
  'mobile.lock.biometricFailed': 'El desbloqueo biométrico no funcionó. Escribe tu contraseña.',
};
export default messages;
