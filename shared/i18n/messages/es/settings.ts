/** es - settings messages. Keys are prefixed 'settings.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Language card (src/pages/settings/LanguageSection.tsx, src/context/LanguageContext.tsx)
  'settings.language.title': 'Idioma',
  'settings.language.label': 'Idioma de la interfaz',
  'settings.language.hint':
    'Todo el diario cambia al idioma elegido de inmediato. Antes de iniciar sesión, la elección se guarda en este dispositivo; después, se guarda en tu cuenta.',
  'settings.language.changed': 'Idioma actualizado: {language}',
  'settings.language.saveFailed': 'El idioma se ha cambiado en este dispositivo, pero no se ha podido guardar en la cuenta.',

  // Page titles (src/pages/SettingsPage.tsx, BackupPage.tsx)
  'settings.title': 'Ajustes',
  'settings.backup.pageTitle': 'Copia de seguridad, restauración y exportación',
  'settings.actionCancelled': 'Se ha cancelado la operación.',

  // Account card (src/pages/settings/AccountSection.tsx, ProfileEditor.tsx, ChangePasswordDialog.tsx)
  'settings.account.title': 'Cuenta',
  'settings.account.anonymousText':
    'Los ajustes de cuenta, seguridad, recordatorios y datos están disponibles después de iniciar sesión. Las preferencias de visualización se guardan en este dispositivo incluso sin cuenta.',
  'settings.account.setEmail': 'Definir',
  'settings.account.setEmailTitle': 'Definir la dirección de correo electrónico',
  'settings.account.emailSaved': 'Se ha guardado la dirección de correo electrónico.',
  'settings.account.editDetails': 'Editar datos',
  'settings.account.editDetailsHint': 'El nombre también se usa en el saludo de la parte superior del diario.',
  'settings.account.emailPassword': 'La contraseña de tu cuenta',
  'settings.account.emailPasswordHint': 'Necesaria para cambiar la dirección de correo, porque a ella se envían los correos para restablecer la contraseña.',
  'settings.account.profileSaved': 'Se han guardado tus datos.',
  'settings.account.noChanges': 'No se ha cambiado nada.',
  'settings.account.changePassword': 'Cambiar la contraseña',
  'settings.account.logout': 'Cerrar sesión',
  'settings.account.logoutQuestion':
    '¿Quieres cerrar la sesión del diario? Para volver tendrás que introducir tu nombre de usuario y tu contraseña.',
  'settings.account.oldPassword': 'Contraseña actual',
  'settings.account.newPassword': 'Nueva contraseña',
  'settings.account.confirmNewPassword': 'Confirmar la nueva contraseña',
  'settings.account.newPasswordHint': 'Al menos {min} caracteres, con letras y números',
  'settings.account.passwordChanged': 'La contraseña se ha cambiado correctamente',
  'settings.account.wrongOldPassword': 'La contraseña actual no es correcta. Inténtalo de nuevo.',
  'settings.account.passwordChangeHint': 'Al cambiar la contraseña se vuelve a cifrar el diario y se cierra la sesión en todos los demás dispositivos.',
  // Account ID row (hosted server only): the server owner copies it to turn the owner cards on.
  'settings.account.accountId': 'ID de cuenta',
  'settings.account.copyAccountId': 'Copiar ID de cuenta',
  'settings.account.accountIdCopied': 'ID de cuenta copiado',
  'settings.account.accountIdCopyFailed': 'No se ha podido copiar. Selecciona el ID de cuenta y cópialo a mano.',
  'settings.account.accountIdHint': 'Solo lo necesita el propietario del servidor, para activar las tarjetas de propietario.',

  // Connected devices (src/pages/settings/SessionsList.tsx)
  'settings.devices.title': 'Dispositivos conectados',
  'settings.devices.hint':
    'Todos los dispositivos que tienen ahora una sesión abierta en esta cuenta. Al desconectar un dispositivo, su sesión termina de inmediato.',
  'settings.devices.current': 'Este dispositivo',
  'settings.devices.remembered': 'Recordarme',
  'settings.devices.unknown': 'Dispositivo sin nombre',
  'settings.devices.connectedAt': 'Inicio de sesión',
  'settings.devices.lastSeen': 'Última actividad',
  'settings.devices.revoke': 'Desconectar',
  'settings.devices.revokeName': 'Desconectar {device}',
  'settings.devices.none': 'No hay dispositivos conectados.',
  'settings.devices.revoked': 'Se ha desconectado el dispositivo «{device}».',

  // Display card (src/pages/settings/DisplaySection.tsx)
  'settings.display.title': 'Visualización',
  'settings.display.theme': 'Tema',
  'settings.display.themeOption.system': 'Igual que el sistema',
  'settings.display.themeOption.light': 'Claro',
  'settings.display.themeOption.dark': 'Oscuro',
  'settings.display.themeOption.highContrast': 'Alto contraste',
  'settings.display.themeChanged': 'Tema actualizado: {label}',
  'settings.display.fontScale': 'Tamaño del texto',
  'settings.display.fontScaleOption.small': 'Pequeño ({percent} %)',
  'settings.display.fontScaleOption.normal': 'Normal ({percent} %)',
  'settings.display.fontScaleOption.large': 'Grande ({percent} %)',
  'settings.display.fontScaleOption.veryLarge': 'Muy grande ({percent} %)',
  'settings.display.fontScaleOption.huge': 'Enorme ({percent} %)',
  'settings.display.fontScaleOption.custom': 'Personalizado ({percent} %)',
  'settings.display.fontScaleChanged': 'Tamaño del texto actualizado: {label}',
  'settings.display.reduceMotion': 'Reducir el movimiento',
  'settings.display.reduceMotionHint': 'Desactiva las animaciones y las transiciones de la interfaz.',
  'settings.display.reduceMotionOn': 'Se ha activado la reducción de movimiento.',
  'settings.display.reduceMotionOff': 'Se ha desactivado la reducción de movimiento.',
  'settings.display.firstDayOfWeek': 'Primer día de la semana',
  'settings.display.sunday': 'Domingo',
  'settings.display.monday': 'Lunes',
  'settings.display.firstDayChanged': 'Primer día de la semana actualizado: {label}.',
  'settings.display.anonymousHint': 'Las preferencias se guardan en este navegador. Después de iniciar sesión se guardan en tu cuenta.',

  // Security card (src/pages/settings/SecuritySection.tsx)
  'settings.security.title': 'Seguridad',
  'settings.security.autoLock': 'Bloqueo automático por inactividad',
  'settings.security.autoLockHint':
    'Pasado el tiempo elegido, el diario muestra una pantalla de bloqueo y pide la contraseña. La sesión sigue abierta.',
  'settings.security.autoLockOff': 'Desactivado',
  'settings.security.autoLockChanged': 'Bloqueo automático: {label}',
  'settings.security.lockNow': 'Bloquear ahora',
  'settings.security.lockNowHint': 'También puedes bloquearlo en cualquier momento con Ctrl+L.',

  // Reminders card (src/pages/settings/RemindersSection.tsx)
  'settings.reminders.title': 'Recordatorios',
  'settings.reminders.enabled': 'Mostrar recordatorios de hábitos',
  'settings.reminders.hint':
    'Los recordatorios son solo notificaciones locales, en el ordenador o en el navegador donde está abierto el diario. No se envía nada al exterior.',
  'settings.reminders.explanation':
    'La hora del recordatorio se define para cada hábito por separado en la página de hábitos. Mientras esta opción esté desactivada, no se muestra ningún recordatorio.',
  'settings.reminders.on': 'Se han activado los recordatorios.',
  'settings.reminders.off': 'Se han desactivado los recordatorios.',
  'settings.reminders.habitsLink': 'Ir a la página de hábitos',

  // Privacy card (src/pages/settings/PrivacySection.tsx)
  // Link to the privacy policy page of the diary server (src/components/legal/PrivacyPolicyLink.tsx)
  'settings.privacy.policyLink': 'Política de privacidad',
  // TODO-TRANSLATE (docs/apple-tasks/TERMS-DIFF.md): English placeholder of the Terms-of-Use keys below - the translator replaces it and removes this line
  'settings.privacy.termsLink': 'Terms of Use',
  'settings.privacy.title': 'Privacidad',
  'settings.privacy.offlineLabel': 'Modo de privacidad sin conexión',
  'settings.privacy.offlineHint':
    'Con esta opción activada, la aplicación no puede abrir ninguna conexión de red salvo con su propio servidor local. Desactívala solo si usas el acceso remoto.',
  'settings.privacy.offlineOn': 'Se ha activado el modo de privacidad sin conexión.',
  'settings.privacy.offlineOff': 'Se ha desactivado el modo de privacidad sin conexión.',
  // Data card (src/pages/settings/DataSection.tsx)
  'settings.data.title': 'Datos',
  'settings.data.reassurance': 'Los datos de tu diario se guardan en tu cuenta personal y están cifrados de extremo a extremo.',
  'settings.data.seedDemo': 'Cargar datos de ejemplo',
  'settings.data.seedDemoTitle': 'Carga de datos de ejemplo',
  'settings.data.seedDemoMessage':
    'Ahora mismo el diario está vacío. Se crearán unos {days} días de entradas y hábitos ficticios para que puedas hacerte una idea de las observaciones, las estadísticas y la búsqueda. Puedes editarlos y eliminarlos como cualquier otra entrada.',
  'settings.data.seedDemoConfirm': 'Cargar',
  'settings.data.seedDemoDone':
    'Se han cargado {entries, plural, one {# entrada} other {# entradas}}, {habits, plural, one {# hábito} other {# hábitos}} y {logs, plural, one {# registro de hábito} other {# registros de hábitos}}.',

  // Delete account card - the last card of the page (src/pages/settings/DeleteAccountSection.tsx)
  'settings.deleteAccount.title': 'Eliminar la cuenta',
  'settings.deleteAccount.warning':
    'Al eliminar tu cuenta, se borra para siempre junto con su diario, sus hábitos y sus ajustes, y se cierra la sesión en todos los dispositivos. No se puede restaurar. Los archivos de copia de seguridad que hayas guardado en otro lugar no se ven afectados.',
  'settings.deleteAccount.button': 'Eliminar la cuenta',
  'settings.deleteAccount.dialogTitle': '¿Eliminar la cuenta «{username}»?',
  'settings.deleteAccount.passwordHint': 'Para confirmarlo, introduce la contraseña de la cuenta.',
  'settings.deleteAccount.understand': 'Entiendo que esto no se puede deshacer',
  'settings.deleteAccount.confirm': 'Eliminar la cuenta para siempre',
  'settings.deleteAccount.done': 'Se han eliminado todos los datos y la cuenta.',
  'settings.deleteAccount.wrongPassword': 'La contraseña no es correcta. Inténtalo de nuevo.',
  'settings.deleteAccount.ownerRemote':
    'Tu cuenta es la propietaria del acceso remoto en este ordenador. Al eliminarla, el acceso remoto se desactiva y se borran sus ajustes (dirección y token de DuckDNS, certificado); la cuenta más antigua que quede pasa a ser la propietaria y puede volver a configurarlo.',
  'settings.deleteAccount.ownerMail':
    'Tu cuenta es la propietaria del correo para restablecer la contraseña en este ordenador. Al eliminarla, se desactiva el envío de correos y se borran sus ajustes (cuenta de envío y contraseña de aplicación); la cuenta más antigua que quede pasa a ser la propietaria y puede volver a configurarlo.',
  'settings.deleteAccount.ownerBoth':
    'Tu cuenta es la propietaria del acceso remoto y del correo para restablecer la contraseña en este ordenador. Al eliminarla, ambos se desactivan y se borran sus ajustes (dirección y token de DuckDNS, certificado, cuenta de envío y contraseña de aplicación); la cuenta más antigua que quede pasa a ser su propietaria y puede volver a configurarlos.',
  // The owner line on the Your Personal Diary server (hosted mode): its owner is DIARY_OWNER_ID only, and deleting
  // the owner erases the mail settings and promotes nobody (server/src/hosted/owner.ts, docs/API.md "בעלות").
  'settings.deleteAccount.ownerHosted':
    'Tu cuenta es la propietaria del servidor del diario. Al eliminarla, se dejan de enviar los correos para restablecer la contraseña a todas las cuentas y se borran los ajustes del correo (cuenta de envío y contraseña de aplicación). Ninguna otra cuenta pasa a ser la propietaria, así que nadie podrá abrir la tarjeta «Servidor» ni preparar un archivo del servidor. Si te vuelves a registrar, tu nueva cuenta tendrá un nuevo ID de cuenta, y habrá que volver a configurar DIARY_OWNER_ID con él en el servidor.',

  // Diagnostics card (src/pages/settings/DiagnosticsSection.tsx, desktop only)
  'settings.diagnostics.title': 'Diagnóstico',
  'settings.diagnostics.hint':
    'Información técnica sobre el servidor local que se ejecuta en segundo plano. Resulta útil si algo no funciona.',
  'settings.diagnostics.uiVersion': 'Versión de la interfaz',
  'settings.diagnostics.serverVersion': 'Versión del servidor',
  'settings.diagnostics.port': 'Puerto',
  'settings.diagnostics.lanStatus': 'Acceso por la red',
  'settings.diagnostics.lanOn': 'Activado',
  'settings.diagnostics.lanOff': 'Desactivado',
  'settings.diagnostics.startedAt': 'Inicio',
  'settings.diagnostics.showServerLog': 'Mostrar el registro del servidor',
  'settings.diagnostics.hideServerLog': 'Ocultar el registro del servidor',
  'settings.diagnostics.serverLog': 'Registro del servidor',
  'settings.diagnostics.serverLogEmpty': 'El registro del servidor está vacío.',
  'settings.diagnostics.serverLogLoaded': 'Registro del servidor cargado: {count, plural, one {# línea} other {# líneas}}.',
  'settings.diagnostics.serverLogFailed': 'No se ha podido leer el registro del servidor.',
  'settings.diagnostics.restartServer': 'Reiniciar el servidor',
  'settings.diagnostics.restartTitle': 'Reinicio del servidor',
  'settings.diagnostics.restartMessage':
    'El servidor local se cerrará y se volverá a iniciar, y la interfaz se recargará para volver a conectarse. Si no marcaste «Recordarme», puede que tengas que iniciar sesión de nuevo.',
  'settings.diagnostics.restartConfirm': 'Reiniciar',
  'settings.diagnostics.restarting': 'El servidor se está reiniciando. La interfaz se recargará en un momento.',
  'settings.diagnostics.restartFailed': 'No se ha podido reiniciar el servidor.',

  // Data card: phone (LAN) access, desktop only (src/pages/settings/LanAccessSection.tsx)
  'settings.lan.title': 'Acceso desde el teléfono en la red de casa',
  'settings.lan.label': 'Acceso desde el teléfono en la red de casa',
  'settings.lan.hint':
    'El servidor local también escuchará en la red wifi de casa, para que puedas abrir el mismo diario desde el teléfono. Los datos nunca salen de casa.',
  'settings.lan.onlyFromComputer':
    'El acceso desde el teléfono solo se puede activar o desactivar desde el ordenador en el que está instalado el diario.',
  'settings.lan.enabled': 'Se ha activado el acceso desde el teléfono.',
  'settings.lan.disabled': 'Se ha desactivado el acceso desde el teléfono.',
  'settings.lan.ownerOnly': 'Solo la cuenta propietaria de este ordenador (la primera que se creó en él) puede activar o desactivar el acceso desde el móvil.',
  'settings.lan.statusOn': 'El acceso desde el móvil está activado.',
  'settings.lan.statusOff': 'El acceso desde el móvil está desactivado.',
  'settings.lan.confirmTitle': 'Activar el acceso desde el móvil',
  'settings.lan.confirmMessage': 'Los móviles y ordenadores de la red de casa podrán abrir la página de inicio de sesión del diario. Para confirmar, escribe la contraseña de tu cuenta.',
  'settings.lan.urlsTitle': 'Direcciones para abrir en el teléfono',
  'settings.lan.noUrls': 'No se ha encontrado ninguna dirección de red. Comprueba que el ordenador esté conectado a la wifi y vuelve a intentarlo.',
  'settings.lan.copy': 'Copiar',
  'settings.lan.copyName': 'Copiar {url}',
  'settings.lan.copied': 'Se ha copiado la dirección {url}.',
  'settings.lan.copyFailed': 'No se ha podido copiar. Puedes seleccionar la dirección y copiarla a mano.',
  'settings.lan.instructionsTitle': 'Cómo conectarse desde el teléfono',
  'settings.lan.instructions.sameNetwork': 'Comprueba que el teléfono esté conectado a la misma red wifi que el ordenador.',
  'settings.lan.instructions.openUrl':
    'Abre una de las direcciones anteriores en el navegador del teléfono e inicia sesión con el mismo nombre de usuario y la misma contraseña.',
  'settings.lan.instructions.firewall':
    'La primera vez, el Firewall de Windows puede pedir permiso: permite el acceso solo en redes privadas.',
  'settings.lan.instructions.sameServer':
    'El teléfono ve exactamente lo mismo que el ordenador, porque los dos trabajan con el mismo servidor local.',

  // Backup page: backup card (src/pages/settings/BackupCreateSection.tsx)
  'settings.backup.title': 'Copia de seguridad',
  'settings.backup.explanation':
    'El archivo de copia de seguridad es una copia cifrada de todo el diario (entradas, hábitos y ajustes) en formato .mpd. Guárdalo en un lugar seguro, por ejemplo en un disco externo. Sin la contraseña no se puede abrir.',
  'settings.backup.ownPassword': 'Otra contraseña para la copia de seguridad',
  'settings.backup.ownPasswordHint':
    'De forma predeterminada, la copia de seguridad se cifra con la contraseña de la cuenta. Puedes elegir otra contraseña solo para este archivo.',
  'settings.backup.password': 'Contraseña de la copia de seguridad',
  'settings.backup.passwordConfirm': 'Confirmar la contraseña de la copia de seguridad',
  'settings.backup.create': 'Crear archivo de copia de seguridad',
  'settings.backup.fileFilter': 'Archivo de copia de seguridad cifrado',
  'settings.backup.created': 'Copia de seguridad creada: {fileName} ({size}).',

  // Backup page: restore card (src/pages/settings/RestoreSection.tsx)
  'settings.restore.title': 'Restaurar desde una copia de seguridad',
  'settings.restore.explanation':
    'Al restaurar, el diario actual se sustituye por el contenido del archivo de copia de seguridad. La contraseña de la cuenta no cambia.',
  'settings.restore.pickFile': 'Elegir archivo de copia de seguridad',
  'settings.restore.fileField': 'Archivo de copia de seguridad',
  'settings.restore.fileHint': 'Un archivo .mpd creado en esta página.',
  'settings.restore.chosenFile': 'Archivo',
  'settings.restore.fileSize': 'Tamaño',
  'settings.restore.fileStatus': 'Estado',
  'settings.restore.inspecting': 'Comprobando el archivo…',
  'settings.restore.action': 'Restaurar desde la copia de seguridad',
  'settings.restore.confirmTitle': '¿Restaurar desde la copia de seguridad?',
  'settings.restore.warning':
    'El diario actual (todas las entradas, hábitos y ajustes) se sustituirá por el contenido del archivo de copia de seguridad. No se puede deshacer. Te recomendamos crear antes una copia de seguridad del diario actual.',
  'settings.restore.confirm': 'Restaurar',
  'settings.restore.done':
    'Restauración completada: {entries, plural, one {# entrada} other {# entradas}} y {habits, plural, one {# hábito} other {# hábitos}}.',
  'settings.restore.needFile': 'Elige un archivo de copia de seguridad',
  'settings.restore.invalidFile': 'El archivo elegido no es un archivo de copia de seguridad válido',

  // Backup page: export card (src/pages/settings/ExportSection.tsx)
  'settings.export.title': 'Exportar',
  'settings.export.explanation':
    'La exportación crea un archivo legible (sin cifrar) con las entradas, por ejemplo para leerlas, imprimirlas o usarlas en otro programa. Guárdalo con el cuidado correspondiente.',
  'settings.export.format': 'Formato',
  'settings.export.formatOption.txt': 'TXT: texto',
  'settings.export.formatOption.csv': 'CSV: tabla',
  'settings.export.formatOption.json': 'JSON: datos completos',
  'settings.export.formatOption.pdf': 'PDF: documento',
  'settings.export.formatHint.txt': 'Un archivo de texto sin formato que se abre en cualquier ordenador o teléfono',
  'settings.export.formatHint.csv': 'Para abrirlo en Excel o en una hoja de cálculo',
  'settings.export.formatHint.json': 'Todos los campos, ideal para pasar los datos a otro programa',
  'settings.export.formatHint.pdf': 'Un documento con formato para leer e imprimir',
  'settings.export.filter.txt': 'Archivo de texto',
  'settings.export.filter.csv': 'Archivo CSV',
  'settings.export.filter.json': 'Archivo JSON',
  'settings.export.filter.pdf': 'Documento PDF',
  'settings.export.from': 'Desde la fecha',
  'settings.export.to': 'Hasta la fecha',
  'settings.export.rangeHint': 'Déjalo vacío para exportar todo el diario.',
  'settings.export.rangeError': 'La fecha final debe ser igual o posterior a la fecha inicial',
  'settings.export.includeHabits': 'Incluir hábitos y registros',
  'settings.export.includeHabitsCsv': 'Un archivo CSV contiene solo las entradas. Los hábitos se incluyen en TXT, JSON y PDF.',
  'settings.export.action': 'Exportar',
  'settings.export.done': 'Exportación completada: {count, plural, one {# entrada} other {# entradas}}.',
  'settings.export.doneWithFile': 'Exportación completada: {count, plural, one {# entrada} other {# entradas}}. {fileName}',
  'settings.export.downloaded': 'Exportación completada. Se ha descargado el archivo {fileName}.',

  // Remote access card (src/pages/settings/RemoteAccessSection.tsx; the Privacy card's confirmation in PrivacySection.tsx)
  'settings.remote.title': 'Acceso remoto',
  'settings.remote.intro':
    'Abre tu diario desde cualquier lugar (el teléfono u otro ordenador) en tu propia dirección de DuckDNS. El diario se queda en este ordenador y no se sube nada a la nube: este ordenador responde mediante una conexión HTTPS cifrada.',
  'settings.remote.switchLabel': 'Permitir el acceso desde internet',
  'settings.remote.switchHint':
    "Desactivado de forma predeterminada. Mientras está activado, este ordenador se comunica con DuckDNS (para que tu dirección siga apuntando aquí) y con Let's Encrypt (para el certificado de seguridad), por lo que se desactiva el modo de privacidad sin conexión.",
  'settings.remote.enabled':
    'Se ha activado el acceso remoto. La configuración puede tardar unos dos minutos; el estado de abajo se actualiza solo.',
  'settings.remote.disabled': 'Se ha desactivado el acceso remoto. El diario ya no se puede abrir desde internet.',
  'settings.remote.offlineTurnedOff':
    "Se ha desactivado el modo de privacidad sin conexión, porque el acceso remoto se conecta a DuckDNS y a Let's Encrypt.",
  'settings.remote.detailsTitle': 'Datos de conexión',
  'settings.remote.hostname': 'Dirección de DuckDNS',
  'settings.remote.hostnameHint': 'El nombre que creaste en duckdns.org, por ejemplo yourpersonaldiary.duckdns.org.',
  'settings.remote.hostnameInvalid':
    'Introduce un nombre de DuckDNS como yourpersonaldiary.duckdns.org (letras inglesas, números y guiones).',
  'settings.remote.token': 'Token de DuckDNS',
  'settings.remote.tokenHint':
    'Aparece en la parte superior de tu página de duckdns.org después de iniciar sesión. Se guarda cifrado en este ordenador y no se vuelve a mostrar nunca.',
  'settings.remote.tokenSaved': 'Hay un token guardado. Deja el campo vacío para conservarlo o introduce un token nuevo para sustituirlo.',
  'settings.remote.tokenMissing': 'Introduce tu token de DuckDNS.',
  'settings.remote.tokenInvalid':
    'Un token de DuckDNS tiene este aspecto: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (números y las letras de la a a la f).',
  'settings.remote.showToken': 'Mostrar el token',
  'settings.remote.publicPort': 'Puerto en el router',
  'settings.remote.publicPortHint':
    'El puerto por el que internet llega a este ordenador. El 443 es el puerto HTTPS estándar; cámbialo solo si tu proveedor de internet lo bloquea.',
  'settings.remote.portInvalid': 'Introduce un número entero entre 1 y 65535.',
  'settings.remote.upnp': 'Abrir el puerto del router automáticamente (UPnP)',
  'settings.remote.upnpHint':
    'Funciona con la mayoría de los routers domésticos. Si no funciona, las instrucciones de abajo explican cómo abrir el puerto a mano.',
  'settings.remote.save': 'Guardar datos',
  'settings.remote.saved': 'Se han guardado los datos del acceso remoto.',
  'settings.remote.test': 'Probar la conexión',
  'settings.remote.testTitle': 'Resultados de la prueba de conexión',
  'settings.remote.testDone': 'Prueba de conexión terminada: se han superado {passed} de {total} comprobaciones.',
  'settings.remote.statusTitle': 'Estado',
  'settings.remote.busy': 'Configurando el acceso remoto. Puede tardar unos dos minutos; la lista se actualiza sola.',
  'settings.remote.ready': 'El acceso remoto está listo. La dirección de tu diario: {url}',
  'settings.remote.failed': 'No se ha podido configurar el acceso remoto: {message}',
  'settings.remote.lastError': 'Último problema: {message}',
  'settings.remote.nextRetry': 'Próximo intento automático: {time}.',
  'settings.remote.stepAt': 'Actualizado: {time}',
  'settings.remote.state.idle': 'Sin iniciar',
  'settings.remote.state.running': 'En curso',
  'settings.remote.state.ok': 'Hecho',
  'settings.remote.state.error': 'Error',
  'settings.remote.state.warning': 'Aviso',
  'settings.remote.state.skipped': 'Omitido',
  'settings.remote.step.duckdns': 'Dirección de DuckDNS',
  'settings.remote.step.certificate': "Certificado de seguridad (Let's Encrypt)",
  'settings.remote.step.listener': 'Conexión segura (HTTPS)',
  'settings.remote.step.upnp': 'Puerto del router',
  'settings.remote.check.duckdns': 'Actualización de DuckDNS',
  'settings.remote.check.upnp': 'Router (UPnP)',
  'settings.remote.check.dns': 'Resolución de la dirección (DNS)',
  'settings.remote.check.https': 'Conexión HTTPS',
  'settings.remote.publicIp': 'Dirección IP pública',
  'settings.remote.unknown': 'Desconocida',
  'settings.remote.certificate': 'Certificado',
  'settings.remote.certificateValid':
    'Válido hasta el {date} ({days, plural, one {queda # día} other {quedan # días}}), emitido por {issuer}. Se renueva automáticamente.',
  'settings.remote.certificateStaging':
    "Es un certificado de prueba (entorno de pruebas de Let's Encrypt); los navegadores mostrarán una advertencia.",
  'settings.remote.noCertificate': 'Todavía no hay ningún certificado.',
  'settings.remote.renew': 'Renovar el certificado',
  'settings.remote.renewStarted': 'Se ha iniciado la renovación del certificado. Puede tardar unos dos minutos.',
  'settings.remote.urlTitle': 'La dirección de tu diario',
  'settings.remote.urlHint': 'Abre esta dirección en el teléfono o en cualquier ordenador e inicia sesión con tu nombre de usuario y tu contraseña.',
  'settings.remote.noUrl': 'La dirección aparecerá aquí cuando la conexión segura esté lista.',
  'settings.remote.qrLabel': 'Código QR de la dirección {url}',
  'settings.remote.qrHint': 'Escanea el código con la cámara del teléfono para abrir la dirección.',
  'settings.remote.instructionsTitle': 'Cómo funciona y qué necesitas',
  'settings.remote.instructions.account':
    'Crea una cuenta gratuita en duckdns.org, añade un nombre (por ejemplo, yourpersonaldiary) y copia el token que aparece en la página.',
  'settings.remote.instructions.enter':
    'Introduce arriba el nombre y el token, marca «Permitir el acceso desde internet», escribe la contraseña de tu cuenta y selecciona Guardar.',
  'settings.remote.instructions.firstCertificate':
    'El primer certificado puede tardar unos dos minutos. La lista de estado se actualiza sola.',
  'settings.remote.instructions.keepOn':
    'Mantén este ordenador encendido y la aplicación del diario abierta: solo se puede acceder al diario mientras ambos estén en marcha.',
  'settings.remote.instructions.manualForward':
    'Si el puerto del router no se puede abrir automáticamente, abre la configuración del router y redirige el puerto externo {publicPort} (TCP) a la dirección de este ordenador, {ip}, puerto {port}.',
  'settings.remote.instructions.manualForwardNoIp':
    'Si el puerto del router no se puede abrir automáticamente, abre la configuración del router y redirige el puerto externo {publicPort} (TCP) a este ordenador (su dirección en la red de casa), puerto {port}.',
  'settings.remote.instructions.signIn':
    'En el teléfono, abre la dirección e inicia sesión con tu nombre de usuario y tu contraseña: ahí está todo lo que has escrito.',
  'settings.remote.instructions.firewall':
    'Si el Firewall de Windows pregunta si quieres permitir diary-server.exe (parte de Your Personal Diary), permítelo (puede que haga falta la aprobación de un administrador). De lo contrario, las conexiones desde internet quedarán bloqueadas.',
  'settings.remote.instructions.atHome':
    'En casa, en la misma red, puede que la dirección de internet no se abra (muchos routers no lo admiten). Allí, usa en su lugar el «Acceso desde el teléfono en la red de casa».',
  'settings.remote.privacyNote':
    "Privacidad: tus entradas se quedan en este ordenador y solo viajan, cifradas, a los dispositivos desde los que inicias sesión. DuckDNS conoce la dirección IP pública de este ordenador y Let's Encrypt conoce el nombre de tu dirección. Cualquiera que conozca la dirección puede llegar a la página de inicio de sesión, así que usa una contraseña segura; si se introduce una contraseña incorrecta varias veces, se bloquean los inicios de sesión desde otros dispositivos durante 15 minutos (desde este ordenador siempre se puede iniciar sesión). No se pueden crear cuentas nuevas a través de internet.",
  'settings.remote.offlineConflictTitle': '¿Activar el modo de privacidad sin conexión?',
  'settings.remote.offlineConflictMessage':
    "El modo de privacidad sin conexión no permite las conexiones que necesita el acceso remoto (DuckDNS y Let's Encrypt). Al activarlo también se desactiva el acceso remoto y el diario ya no se podrá abrir desde internet.",
  'settings.remote.offlineConflictConfirm': 'Desactivar el acceso remoto',
  'settings.remote.disabledByOffline': 'Se ha desactivado el acceso remoto.',
  'settings.remote.offlineConflictPassword': 'Introduce la contraseña de tu cuenta para desactivar el acceso remoto.',
  // Ownership and the locked card (only the account that set remote access up can view or change it).
  'settings.remote.ownerNote':
    'Solo tu cuenta puede ver o cambiar estos ajustes. Las demás cuentas de este ordenador no ven esta tarjeta.',
  'settings.remote.setupOwnerNote':
    'La cuenta que guarde estos ajustes será la única de este ordenador que pueda verlos o cambiarlos.',
  'settings.remote.currentTitle': 'Ajustes actuales',
  'settings.remote.summary.state': 'Acceso remoto',
  'settings.remote.summary.on': 'Activado',
  'settings.remote.summary.off': 'Desactivado',
  'settings.remote.summary.tokenSaved': 'Guardado (cifrado, nunca se muestra)',
  'settings.remote.summary.upnp': 'Apertura del puerto del router',
  'settings.remote.summary.upnpAuto': 'Automática (UPnP)',
  'settings.remote.summary.upnpManual': 'Manual, en la configuración del router',
  'settings.remote.lockedHint':
    'Los ajustes están bloqueados. Para cambiarlos, selecciona «Cambiar ajustes» e introduce la contraseña de tu cuenta.',
  'settings.remote.change': 'Cambiar ajustes',
  'settings.remote.unlockTitle': 'Cambiar los ajustes del acceso remoto',
  'settings.remote.unlockMessage':
    'Para proteger tu diario, introduce la contraseña de tu cuenta antes de cambiar desde dónde y cómo se puede acceder a él por internet.',
  'settings.remote.unlocked': 'Los ajustes se pueden editar. Cambia los datos y selecciona Guardar.',
  'settings.remote.editCancelled': 'No se ha hecho ningún cambio. Los ajustes vuelven a estar bloqueados.',
  'settings.remote.savedLocked': 'Se han guardado los ajustes del acceso remoto y se han vuelto a bloquear.',
  'settings.remote.password': 'La contraseña de tu cuenta',
  'settings.remote.passwordHint': 'Necesaria para guardar. A partir de entonces, solo esta cuenta podrá ver o cambiar el acceso remoto.',
  'settings.remote.passwordMissing': 'Introduce la contraseña de tu cuenta.',
  'settings.remote.wrongPassword': 'La contraseña no es correcta.',
  // E-mail for password reset (src/pages/settings/MailSection.tsx; owner-only, locked after setup, like remote access).
  'settings.mail.title': 'Correo para restablecer la contraseña',
  'settings.mail.intro':
    'Cuando alguien olvida su contraseña, el diario le envía por correo un enlace y un código para elegir una nueva. Para ello, el diario necesita una cuenta de correo desde la que enviar, por ejemplo la dirección de Gmail que creaste para el diario.',
  'settings.mail.ownerNote':
    'Solo tu cuenta puede ver o cambiar estos ajustes. Las demás cuentas de este ordenador no ven esta tarjeta.',
  'settings.mail.setupOwnerNote':
    'La cuenta que guarde estos ajustes será la única de este ordenador que pueda verlos o cambiarlos.',
  'settings.mail.switchLabel': 'Enviar correos para restablecer la contraseña',
  'settings.mail.switchHint':
    'Mientras esté activado, el diario se conecta al servidor de correo solo para enviar correos de restablecimiento de contraseña y correos de prueba.',
  'settings.mail.detailsTitle': 'Cuenta de envío',
  'settings.mail.address': 'Dirección de Gmail',
  'settings.mail.addressHint':
    'Los correos se envían desde esta dirección, con el nombre de remitente «Your Personal Diary».',
  'settings.mail.addressInvalid': 'Introduce una dirección de correo válida.',
  'settings.mail.appPassword': 'Contraseña de aplicación',
  'settings.mail.appPasswordHint':
    'La contraseña de aplicación de 16 letras que Google creó para el diario, no tu contraseña normal de Gmail. Los espacios no importan.',
  'settings.mail.appPasswordSaved':
    'Hay una contraseña de aplicación guardada (cifrada, nunca se muestra). Deja el campo vacío para conservarla.',
  'settings.mail.appPasswordMissing': 'Introduce la contraseña de aplicación.',
  'settings.mail.appPasswordGmail':
    'Una contraseña de aplicación de Gmail tiene 16 letras. Tu contraseña normal de Gmail no funciona aquí.',
  'settings.mail.advanced': 'Avanzado: servidor de correo',
  'settings.mail.host': 'Servidor de correo saliente (SMTP)',
  'settings.mail.hostHint': 'Para Gmail: smtp.gmail.com',
  'settings.mail.hostInvalid': 'Introduce el nombre del servidor de correo, por ejemplo smtp.gmail.com.',
  'settings.mail.port': 'Puerto',
  'settings.mail.portHint': '465 con SSL/TLS, 587 con STARTTLS',
  'settings.mail.portInvalid': 'Introduce un número de puerto del 1 al 65535.',
  'settings.mail.security': 'Cifrado',
  'settings.mail.security.tls': 'SSL/TLS (normalmente puerto 465)',
  'settings.mail.security.starttls': 'STARTTLS (normalmente puerto 587)',
  'settings.mail.password': 'La contraseña de tu cuenta',
  'settings.mail.passwordHint':
    'La contraseña de tu cuenta del diario. Necesaria para guardar; a partir de entonces, solo esta cuenta podrá ver o cambiar estos ajustes.',
  'settings.mail.passwordMissing': 'Introduce la contraseña de tu cuenta.',
  'settings.mail.wrongPassword': 'La contraseña no es correcta.',
  'settings.mail.saved': 'Se han guardado los ajustes de correo.',
  'settings.mail.savedLocked': 'Se han guardado y bloqueado los ajustes de correo.',
  'settings.mail.enabled':
    'El envío de correos para restablecer la contraseña está activado. Selecciona «Enviar correo de prueba» para comprobarlo.',
  'settings.mail.disabled': 'El envío de correos para restablecer la contraseña está desactivado.',
  'settings.mail.notReady':
    'Todavía no se pueden enviar correos: faltan datos. Selecciona «Cambiar ajustes» para completarlos.',
  'settings.mail.currentTitle': 'Ajustes actuales',
  'settings.mail.summary.state': 'Envío de correos de restablecimiento',
  'settings.mail.summary.on': 'Activado',
  'settings.mail.summary.off': 'Desactivado',
  'settings.mail.summary.address': 'Se envía desde',
  'settings.mail.summary.appPassword': 'Contraseña de aplicación',
  'settings.mail.summary.appPasswordSaved': 'Guardada (cifrada, nunca se muestra)',
  'settings.mail.summary.server': 'Servidor de correo',
  'settings.mail.summary.serverValue': '{host}, puerto {port}, {security}',
  'settings.mail.lockedHint':
    'Los ajustes están bloqueados. Para cambiarlos, selecciona «Cambiar ajustes» e introduce la contraseña de tu cuenta.',
  'settings.mail.change': 'Cambiar ajustes',
  'settings.mail.unlockTitle': 'Cambiar los ajustes de correo',
  'settings.mail.unlockMessage':
    'Para proteger tu diario, introduce la contraseña de tu cuenta antes de cambiar la cuenta desde la que el diario envía correos.',
  'settings.mail.unlocked': 'Los ajustes se pueden editar. Cambia los datos y selecciona Guardar.',
  'settings.mail.editCancelled': 'No se ha hecho ningún cambio. Los ajustes vuelven a estar bloqueados.',
  'settings.mail.test': 'Enviar correo de prueba',
  'settings.mail.testHint': 'Envía un correo breve a tu propia dirección: {email}.',
  'settings.mail.testNoEmail':
    'Tu cuenta todavía no tiene dirección de correo. Añade una en la tarjeta «Cuenta» para recibir el correo de prueba.',
  'settings.mail.testSent':
    'Se ha enviado un correo de prueba a {email}. Revisa la bandeja de entrada (y la carpeta de spam).',
  'settings.mail.testFailed': 'No se ha podido enviar el correo de prueba. {message}',
  'settings.mail.instructionsTitle': 'Cómo obtener una contraseña de aplicación de Gmail',
  'settings.mail.instructions.signIn':
    'Inicia sesión en myaccount.google.com con la cuenta de Gmail desde la que enviará el diario.',
  'settings.mail.instructions.twoStep':
    'Abre «Seguridad» y activa la verificación en dos pasos. Google solo ofrece contraseñas de aplicación a las cuentas con verificación en dos pasos.',
  'settings.mail.instructions.create':
    'Abre myaccount.google.com/apppasswords (o busca «Contraseñas de aplicaciones» en tu cuenta de Google), escribe un nombre como «Your Personal Diary» y selecciona «Crear».',
  'settings.mail.instructions.copy':
    'Google muestra una sola vez una contraseña de 16 letras. Escríbela aquí en el campo «Contraseña de aplicación» (los espacios no importan), introduce la contraseña de tu cuenta y selecciona «Guardar».',
  'settings.mail.instructions.test':
    'Selecciona «Enviar correo de prueba» y comprueba que llega a tu bandeja de entrada.',
  'settings.mail.whyAppPassword':
    '¿Por qué una contraseña de aplicación? Google rechaza la contraseña normal de Gmail en los programas de correo, así que aquí no funciona. Una contraseña de aplicación solo sirve para el correo y puedes revocarla en tu cuenta de Google en cualquier momento.',
  'settings.mail.privacyNote':
    'La contraseña de aplicación se guarda cifrada en este ordenador y no se vuelve a mostrar. Los correos solo contienen el enlace y el código de restablecimiento, nunca nada de tu diario.',

  // Your Personal Diary server (src/pages/settings/PrivacySection.tsx; the published apps, the web UI it serves)
  'settings.hosted.reassurance': 'Tu diario se guarda en el servidor de Your Personal Diary y está cifrado con tu contraseña.',
  'settings.hosted.serverAddress': 'Servidor del diario: {host}',
  'settings.hosted.offlineHint': 'Con esta opción activada, la aplicación no puede abrir ninguna conexión de red salvo con el servidor del diario.',
  // Server card (src/pages/settings/ServerSection.tsx): hosted server, its owner only (docs/android-tasks/SERVER-CARD.md)
  'settings.server.title': 'Servidor',
  'settings.server.intro': 'El estado del servidor de Your Personal Diary. Solo tú, como propietario, ves esta tarjeta.',
  'settings.server.refresh': 'Actualizar',
  'settings.server.refreshed': 'Se ha actualizado el estado del servidor.',
  'settings.server.version': 'Versión',
  'settings.server.uptime': 'Tiempo en funcionamiento',
  'settings.server.accounts': 'Cuentas',
  'settings.server.accountsValue': '{count} de un máximo de {max}',
  'settings.server.registrations': 'Cuentas nuevas en las últimas 24 horas',
  'settings.server.disk': 'Disco',
  'settings.server.diskValue': '{used} usados, {free} libres ({percent})',
  'settings.server.diskLow':
    'Solo queda libre el {percent} del disco. Amplía el volumen pronto (fly volumes extend, consulta el manual de operaciones): cuando el disco se llena, los cambios ya no se pueden guardar.',
  'settings.server.storage': 'Guardado en el disco',
  'settings.server.storageOk': 'Correcto',
  'settings.server.storageFailed': 'Con fallos: no se puede guardar',
  'settings.server.storageAlert':
    'Ahora mismo el servidor no puede guardar los cambios en su disco. Revisa el espacio libre y el registro (consulta el manual de operaciones).',
  'settings.server.lastSave': 'Último guardado correcto',
  'settings.server.noSaveYet': 'Ninguno desde que se inició el servidor',
  'settings.server.memory': 'Memoria en uso',
  'settings.server.gigabytes': '{value} GB',
  'settings.server.lastArchive': 'Último archivo del servidor',
  'settings.server.noArchive': 'Todavía ninguno',
  'settings.server.archiveDueNone': 'Todavía no hay ningún archivo del servidor. Prepara uno abajo y descárgalo en tu ordenador.',
  'settings.server.archiveDueOld':
    'El último archivo del servidor tiene más de {days} días. Prepara uno nuevo abajo y descárgalo en tu ordenador.',
  'settings.server.archive.title': 'Archivo del servidor',
  'settings.server.archive.intro':
    'Una copia cifrada de todos los datos del servidor, para restaurarlo después de un desastre. Se escribe en el disco del servidor, que guarda los 2 más recientes, y luego lo descargas en tu ordenador con un comando en tu propia ventana de PowerShell. Nunca se puede descargar a través del sitio web ni de la aplicación.',
  'settings.server.archive.listTitle': 'Archivos en el servidor',
  'settings.server.archive.created': 'Preparado',
  'settings.server.archive.size': 'Tamaño',
  'settings.server.archive.download': 'Comando de descarga',
  'settings.server.archive.check': 'Comando de comprobación',
  'settings.server.archive.copyDownload': 'Copiar el comando de descarga',
  'settings.server.archive.copyCheck': 'Copiar el comando de comprobación',
  'settings.server.archive.copied': 'Se ha copiado el comando.',
  'settings.server.archive.copyFailed': 'No se ha podido copiar. Selecciona el comando y cópialo a mano.',
  'settings.server.archive.stepsTitle': 'Cómo descargar el archivo',
  'settings.server.archive.step.open': 'En tu ordenador, abre PowerShell en la carpeta donde quieras guardar el archivo.',
  'settings.server.archive.step.download': 'Pega el comando de descarga y pulsa Intro.',
  'settings.server.archive.step.check':
    'Pega el comando de comprobación y pulsa Intro. Debe mostrar True; si no, vuelve a descargar el archivo.',
  'settings.server.archive.step.keep':
    'Guarda el archivo sin conexión (por ejemplo, en un disco externo) y la frase de contraseña en otro lugar seguro.',
  'settings.server.archive.prepare': 'Preparar archivo del servidor',
  'settings.server.archive.formTitle': 'Preparar un archivo nuevo',
  'settings.server.archive.password': 'La contraseña de tu cuenta',
  'settings.server.archive.passphrase': 'Frase de contraseña del archivo',
  'settings.server.archive.passphraseHint': 'Al menos {min} caracteres. No es la contraseña de tu cuenta: elige otra distinta y anótala.',
  'settings.server.archive.passphraseRepeat': 'Repite la frase de contraseña del archivo',
  'settings.server.archive.passphraseWarning': 'La frase de contraseña es necesaria para restaurar el archivo y no se puede recuperar.',
  'settings.server.archive.passwordMissing': 'Introduce la contraseña de tu cuenta.',
  'settings.server.archive.passphraseShort': 'La frase de contraseña del archivo debe tener al menos {min} caracteres.',
  'settings.server.archive.passphraseLong': 'La frase de contraseña del archivo puede tener como máximo {max} caracteres.',
  'settings.server.archive.passphraseMismatch': 'Las dos frases de contraseña no coinciden.',
  'settings.server.archive.submit': 'Preparar archivo',
  'settings.server.archive.preparing': 'Preparando el archivo. Puede tardar un minuto: no cierres esta página.',
  'settings.server.archive.ready': 'El archivo {name} ({size}) está listo. Descárgalo ahora con el comando de abajo.',
  'settings.server.archive.busy': 'Se está preparando un archivo en este momento.',
  'settings.server.archive.nextAt': 'El próximo archivo se podrá preparar a partir de las {time}.',
  // Deletion request by e-mail (src/pages/settings/DeletionRequest.tsx, docs/android-tasks/ADMIN-TOOL.md item 3): the card builds two commands and sends nothing
  'settings.server.deletion.title': 'Solicitud de eliminación por correo electrónico',
  'settings.server.deletion.intro':
    'Para alguien que no puede iniciar sesión y pide por correo electrónico que se elimine su cuenta. La aplicación no puede buscar ni eliminar cuentas: escribe aquí la dirección y la tarjeta prepara dos comandos para PowerShell en tu ordenador, que solo funcionan con tu inicio de sesión en Fly. Nada de lo que escribas aquí se envía a ningún sitio.',
  'settings.server.deletion.check': 'Comprueba que la solicitud llegó desde la dirección registrada en la cuenta.',
  'settings.server.deletion.email': 'Dirección de correo electrónico de quien lo solicita',
  'settings.server.deletion.waiting': 'Los comandos aparecen aquí en cuanto escribes una dirección de correo electrónico completa.',
  'settings.server.deletion.encoded':
    'Esta dirección tiene caracteres que PowerShell cambiaría, así que los comandos la llevan codificada (b64:...); la herramienta la decodifica.',
  'settings.server.deletion.find': 'Paso 1: buscar la cuenta',
  'settings.server.deletion.findHint':
    'Pégalo en PowerShell y pulsa Intro. No cambia nada: muestra el nombre de usuario de la cuenta, su dirección de correo electrónico, la fecha de registro y el tamaño del diario.',
  'settings.server.deletion.copyFind': 'Copiar el comando de búsqueda',
  'settings.server.deletion.username': 'Nombre de usuario que mostró el comando de búsqueda',
  'settings.server.deletion.usernameHint': 'Escríbelo exactamente como aparece; debajo aparecerá entonces el comando de eliminación.',
  'settings.server.deletion.usernameInvalid':
    'Esto no es un nombre de usuario: un nombre de usuario tiene de 3 a 32 letras, dígitos, puntos, guiones o guiones bajos.',
  'settings.server.deletion.delete': 'Paso 2: eliminar la cuenta',
  'settings.server.deletion.deleteHint':
    'Ejecútalo solo después de comprobar la dirección. Elimina la cuenta y su diario para siempre; no se puede deshacer. Anota en tu registro la fecha que muestra.',
  'settings.server.deletion.copyDelete': 'Copiar el comando de eliminación',
};
export default messages;
