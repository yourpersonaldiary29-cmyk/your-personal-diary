/** it - mobile messages: the Android shell and the tour mode. Keys are prefixed 'mobile.'. */
const messages: Record<string, string> = {
  // Android shell (src/components/layout/MobileShell.tsx, BottomNav.tsx, MoreSheet.tsx) ---------------
  'mobile.nav.more': 'Altro',

  // Tour mode: the "Skip" button, the banner and the settings card (guest account, nothing is saved) --
  'mobile.guest.skip': 'Salta - voglio solo dare un’occhiata',
  'mobile.guest.skipHint': 'Esplora l’app con dati di esempio. Niente di ciò che scrivi viene salvato.',
  'mobile.guest.started': 'Modalità tour: stai vedendo dati di esempio. Niente di ciò che scrivi viene salvato.',
  'mobile.guest.name': 'ospite',
  'mobile.guest.banner': 'Modalità tour - niente di ciò che scrivi viene salvato.',
  'mobile.guest.createAccount': 'Crea un account',
  'mobile.guest.endTour': 'Termina il tour',
  'mobile.guest.ended': 'Il tour è terminato.',
  'mobile.guest.unavailable': 'La modalità tour non è disponibile in questa versione.',
  'mobile.guest.settingsTitle': 'Modalità tour',
  'mobile.guest.settingsText':
    'Le impostazioni di account, sicurezza e backup non sono disponibili in modalità tour. Crea un account per usarle.',

  // Files on the phone (WP-7): "Save to device" / "Share" of backups and exports, an opened .mpd file ---
  'mobile.files.saveToDevice': 'Salva sul dispositivo',
  'mobile.files.share': 'Condividi',
  'mobile.files.saved': 'Salvato sul dispositivo: {fileName}',
  'mobile.files.shared': 'Condiviso: {fileName}',
  'mobile.files.openedBackup': 'È stato aperto un file di backup: {fileName}. Controllalo, inserisci la sua password e conferma per ripristinare.',
  'mobile.files.readFailed': 'Impossibile leggere il file aperto.',

  // Reminders as system notifications (WP-8): channel, texts, permission, "show habit names" ------------
  'mobile.reminders.channel': 'Promemoria delle abitudini',
  'mobile.reminders.channelDescription': 'Promemoria agli orari che hai impostato per le tue abitudini.',
  'mobile.reminders.genericBody': 'È ora di una delle tue abitudini.',
  'mobile.reminders.permissionText': 'Per ricordartelo anche ad app chiusa, il telefono deve consentire le notifiche di Your Personal Diary. I promemoria vengono creati sul telefono stesso: nulla lo lascia.',
  'mobile.reminders.allow': 'Consenti le notifiche',
  'mobile.reminders.granted': 'Le notifiche sono consentite. I promemoria arrivano anche ad app chiusa, di solito entro pochi minuti dall\'orario impostato.',
  'mobile.reminders.denied': 'Le notifiche sono disattivate per questa app. Finché non le attivi nelle impostazioni del telefono (App → Your Personal Diary → Notifiche), i promemoria compaiono solo ad app aperta.',
  'mobile.reminders.showNames': 'Mostra i nomi delle abitudini nelle notifiche',
  'mobile.reminders.showNamesHint': 'Disattivato: la notifica dice solo che è ora di un\'abitudine. Attivato: viene mostrato il nome dell\'abitudine, anche nella schermata di blocco.',

  // Lock, privacy screen and biometrics (WP-9): Security card and lock screen ---------------------------
  'mobile.security.lockOnLeave': 'Blocca quando esco dall\'app',
  'mobile.security.lockOnLeaveHint': 'Il diario si blocca quando passi a un\'altra app o lo schermo si spegne; la tua password lo riapre.',
  'mobile.security.privacyScreen': 'Nascondi il contenuto nelle app recenti e blocca gli screenshot',
  'mobile.security.privacyScreenHint': 'Nella schermata delle app recenti l\'app appare come una scheda vuota e i suoi screenshot sono bloccati.',
  'mobile.security.biometric': 'Sblocca con impronta o volto',
  'mobile.security.biometricHint': 'Solo per la schermata di blocco. L\'accesso e la conferma di modifiche delicate richiedono sempre la password.',
  'mobile.security.biometricUnavailable': 'Su questo telefono non è configurato lo sblocco con impronta o volto.',
  'mobile.security.saved': 'Impostazione salvata.',
  'mobile.lock.biometric': 'Sblocca con impronta o volto',
  'mobile.lock.biometricTitle': 'Sblocca Your Personal Diary',
  'mobile.lock.usePassword': 'Usa la password',
  'mobile.lock.biometricFailed': 'Lo sblocco biometrico non ha funzionato. Inserisci la password.',
};
export default messages;
