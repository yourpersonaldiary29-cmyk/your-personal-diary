/** pt - mobile messages: the Android shell and the tour mode. Keys are prefixed 'mobile.'. */
const messages: Record<string, string> = {
  // Android shell (src/components/layout/MobileShell.tsx, BottomNav.tsx, MoreSheet.tsx) ---------------
  'mobile.nav.more': 'Mais',

  // Tour mode: the "Skip" button, the banner and the settings card (guest account, nothing is saved) --
  'mobile.guest.skip': 'Ignorar - só quero ver',
  'mobile.guest.skipHint': 'Explore a aplicação com dados de exemplo. Nada do que escrever é guardado.',
  'mobile.guest.started': 'Modo de visita: está a ver dados de exemplo. Nada do que escrever é guardado.',
  'mobile.guest.name': 'visitante',
  'mobile.guest.banner': 'Modo de visita - nada do que escrever é guardado.',
  'mobile.guest.createAccount': 'Criar uma conta',
  'mobile.guest.endTour': 'Terminar a visita',
  'mobile.guest.ended': 'A visita terminou.',
  'mobile.guest.unavailable': 'O modo de visita não está disponível nesta versão.',
  'mobile.guest.settingsTitle': 'Modo de visita',
  'mobile.guest.settingsText':
    'As definições de conta, segurança e cópia de segurança não estão disponíveis no modo de visita. Crie uma conta para as utilizar.',

  // Files on the phone (WP-7): "Save to device" / "Share" of backups and exports, an opened .mpd file ---
  'mobile.files.saveToDevice': 'Guardar no dispositivo',
  'mobile.files.share': 'Partilhar',
  'mobile.files.saved': 'Guardado no dispositivo: {fileName}',
  'mobile.files.shared': 'Partilhado: {fileName}',
  'mobile.files.openedBackup': 'Foi aberto um ficheiro de cópia de segurança: {fileName}. Verifique-o, introduza a sua palavra-passe e confirme para restaurar.',
  'mobile.files.readFailed': 'Não foi possível ler o ficheiro aberto.',

  // Reminders as system notifications (WP-8): channel, texts, permission, "show habit names" ------------
  'mobile.reminders.channel': 'Lembretes de hábitos',
  'mobile.reminders.channelDescription': 'Lembretes às horas que definiu para os seus hábitos.',
  'mobile.reminders.genericBody': 'Está na hora de um dos seus hábitos.',
  'mobile.reminders.permissionText': 'Para o lembrar com a aplicação fechada, o telemóvel tem de permitir as notificações do Your Personal Diary. Os lembretes são criados no próprio telemóvel - nada sai dele.',
  'mobile.reminders.allow': 'Permitir notificações',
  'mobile.reminders.granted': 'As notificações estão permitidas. Os lembretes chegam mesmo com a aplicação fechada, normalmente poucos minutos depois da hora definida.',
  'mobile.reminders.denied': 'As notificações estão desativadas para esta aplicação. Até as ativar nas definições do telemóvel (Aplicações → Your Personal Diary → Notificações), os lembretes só aparecem com a aplicação aberta.',
  'mobile.reminders.showNames': 'Mostrar os nomes dos hábitos nas notificações',
  'mobile.reminders.showNamesHint': 'Desativado: a notificação diz apenas que está na hora de um hábito. Ativado: o nome do hábito é mostrado - também no ecrã de bloqueio.',

  // Lock, privacy screen and biometrics (WP-9): Security card and lock screen ---------------------------
  'mobile.security.lockOnLeave': 'Bloquear quando saio da aplicação',
  'mobile.security.lockOnLeaveHint': 'O diário bloqueia quando muda para outra aplicação ou o ecrã se apaga; a sua palavra-passe volta a abri-lo.',
  'mobile.security.privacyScreen': 'Ocultar o conteúdo nas aplicações recentes e bloquear capturas de ecrã',
  'mobile.security.privacyScreenHint': 'A aplicação aparece como um cartão em branco no ecrã de aplicações recentes e as capturas de ecrã são bloqueadas.',
  'mobile.security.biometric': 'Desbloquear com impressão digital ou rosto',
  'mobile.security.biometricHint': 'Apenas para o ecrã de bloqueio. Iniciar sessão e confirmar alterações sensíveis pedem sempre a palavra-passe.',
  'mobile.security.biometricUnavailable': 'Este telemóvel não tem desbloqueio por impressão digital ou rosto configurado.',
  'mobile.security.saved': 'Definição guardada.',
  'mobile.lock.biometric': 'Desbloquear com impressão digital ou rosto',
  'mobile.lock.biometricTitle': 'Desbloquear o Your Personal Diary',
  'mobile.lock.usePassword': 'Usar a palavra-passe',
  'mobile.lock.biometricFailed': 'O desbloqueio biométrico não funcionou. Introduza a sua palavra-passe.',
};
export default messages;
