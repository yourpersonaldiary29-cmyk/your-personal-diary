/** pt - settings messages. Keys are prefixed 'settings.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Language card (src/pages/settings/LanguageSection.tsx, src/context/LanguageContext.tsx)
  'settings.language.title': 'Idioma',
  'settings.language.label': 'Idioma da interface',
  'settings.language.hint':
    'Todo o diário muda de imediato para o idioma escolhido. Antes de iniciar sessão, a escolha fica guardada neste dispositivo; depois de iniciar sessão, é guardada na sua conta.',
  'settings.language.changed': 'Idioma atualizado: {language}',
  'settings.language.saveFailed': 'O idioma foi alterado neste dispositivo, mas não foi possível guardá-lo na conta.',

  // Page titles (src/pages/SettingsPage.tsx, BackupPage.tsx)
  'settings.title': 'Definições',
  'settings.backup.pageTitle': 'Cópia de segurança, restauro e exportação',
  'settings.actionCancelled': 'A operação foi cancelada.',

  // Account card (src/pages/settings/AccountSection.tsx, ProfileEditor.tsx, ChangePasswordDialog.tsx)
  'settings.account.title': 'Conta',
  'settings.account.anonymousText':
    'As definições de conta, segurança, lembretes e dados ficam disponíveis depois de iniciar sessão. As preferências de apresentação ficam guardadas neste dispositivo, mesmo sem conta.',
  'settings.account.setEmail': 'Definir',
  'settings.account.setEmailTitle': 'Definir o endereço de e-mail',
  'settings.account.emailSaved': 'O endereço de e-mail foi guardado.',
  'settings.account.editDetails': 'Editar dados',
  'settings.account.editDetailsHint': 'O nome próprio também é usado na saudação no topo do diário.',
  'settings.account.emailPassword': 'A palavra-passe da sua conta',
  'settings.account.emailPasswordHint': 'Necessária para alterar o endereço de e-mail, porque os e-mails para repor a palavra-passe são enviados para ele.',
  'settings.account.profileSaved': 'Os seus dados foram guardados.',
  'settings.account.noChanges': 'Não foi alterado nada.',
  'settings.account.changePassword': 'Alterar a palavra-passe',
  'settings.account.logout': 'Terminar sessão',
  'settings.account.logoutQuestion':
    'Pretende terminar a sessão no diário? Para voltar, terá de introduzir o nome de utilizador e a palavra-passe.',
  'settings.account.oldPassword': 'Palavra-passe atual',
  'settings.account.newPassword': 'Nova palavra-passe',
  'settings.account.confirmNewPassword': 'Confirmar a nova palavra-passe',
  'settings.account.newPasswordHint': 'Pelo menos {min} carateres, com letras e algarismos',
  'settings.account.passwordChanged': 'A palavra-passe foi alterada com sucesso',
  'settings.account.wrongOldPassword': 'A palavra-passe atual está incorreta. Tente novamente.',
  'settings.account.passwordChangeHint': 'Ao alterar a palavra-passe, o diário volta a ser encriptado e a sessão é terminada em todos os outros dispositivos.',
  // Account ID row (hosted server only): the server owner copies it to turn the owner cards on.
  'settings.account.accountId': 'ID da conta',
  'settings.account.copyAccountId': 'Copiar ID da conta',
  'settings.account.accountIdCopied': 'ID da conta copiado',
  'settings.account.accountIdCopyFailed': 'Não foi possível copiar. Selecione o ID da conta e copie-o manualmente.',
  'settings.account.accountIdHint': 'Só o proprietário do servidor precisa disto, para ativar os cartões do proprietário.',

  // Connected devices (src/pages/settings/SessionsList.tsx)
  'settings.devices.title': 'Dispositivos ligados',
  'settings.devices.hint':
    'Todos os dispositivos com sessão iniciada nesta conta neste momento. Ao desligar um dispositivo, a respetiva sessão termina de imediato.',
  'settings.devices.current': 'Este dispositivo',
  'settings.devices.remembered': 'Manter sessão iniciada',
  'settings.devices.unknown': 'Dispositivo sem nome',
  'settings.devices.connectedAt': 'Início de sessão',
  'settings.devices.lastSeen': 'Última atividade',
  'settings.devices.revoke': 'Desligar',
  'settings.devices.revokeName': 'Desligar {device}',
  'settings.devices.none': 'Não há dispositivos ligados.',
  'settings.devices.revoked': 'O dispositivo «{device}» foi desligado.',

  // Display card (src/pages/settings/DisplaySection.tsx)
  'settings.display.title': 'Apresentação',
  'settings.display.theme': 'Tema',
  'settings.display.themeOption.system': 'Igual ao sistema',
  'settings.display.themeOption.light': 'Claro',
  'settings.display.themeOption.dark': 'Escuro',
  'settings.display.themeOption.highContrast': 'Alto contraste',
  'settings.display.themeChanged': 'Tema atualizado: {label}',
  'settings.display.fontScale': 'Tamanho do texto',
  'settings.display.fontScaleOption.small': 'Pequeno ({percent}%)',
  'settings.display.fontScaleOption.normal': 'Normal ({percent}%)',
  'settings.display.fontScaleOption.large': 'Grande ({percent}%)',
  'settings.display.fontScaleOption.veryLarge': 'Muito grande ({percent}%)',
  'settings.display.fontScaleOption.huge': 'Enorme ({percent}%)',
  'settings.display.fontScaleOption.custom': 'Personalizado ({percent}%)',
  'settings.display.fontScaleChanged': 'Tamanho do texto atualizado: {label}',
  'settings.display.reduceMotion': 'Reduzir o movimento',
  'settings.display.reduceMotionHint': 'Desativa as animações e as transições da interface.',
  'settings.display.reduceMotionOn': 'A redução de movimento foi ativada.',
  'settings.display.reduceMotionOff': 'A redução de movimento foi desativada.',
  'settings.display.firstDayOfWeek': 'Primeiro dia da semana',
  'settings.display.sunday': 'Domingo',
  'settings.display.monday': 'Segunda-feira',
  'settings.display.firstDayChanged': 'Primeiro dia da semana atualizado: {label}.',
  'settings.display.anonymousHint': 'As preferências ficam guardadas neste navegador. Depois de iniciar sessão, são guardadas na sua conta.',

  // Security card (src/pages/settings/SecuritySection.tsx)
  'settings.security.title': 'Segurança',
  'settings.security.autoLock': 'Bloqueio automático por inatividade',
  'settings.security.autoLockHint':
    'Decorrido o tempo escolhido, o diário mostra um ecrã de bloqueio e pede a palavra-passe. A sessão mantém-se iniciada.',
  'settings.security.autoLockOff': 'Desativado',
  'settings.security.autoLockChanged': 'Bloqueio automático: {label}',
  'settings.security.lockNow': 'Bloquear agora',
  'settings.security.lockNowHint': 'Também pode bloquear em qualquer momento com Ctrl+L.',

  // Reminders card (src/pages/settings/RemindersSection.tsx)
  'settings.reminders.title': 'Lembretes',
  'settings.reminders.enabled': 'Mostrar lembretes de hábitos',
  'settings.reminders.hint':
    'Os lembretes são apenas notificações locais, no computador ou no navegador onde o diário está aberto. Nada é enviado para fora.',
  'settings.reminders.explanation':
    'A hora do lembrete é definida para cada hábito separadamente, na página de hábitos. Enquanto esta opção estiver desativada, não é mostrado nenhum lembrete.',
  'settings.reminders.on': 'Os lembretes foram ativados.',
  'settings.reminders.off': 'Os lembretes foram desativados.',
  'settings.reminders.habitsLink': 'Ir para a página de hábitos',

  // Privacy card (src/pages/settings/PrivacySection.tsx)
  // Link to the privacy policy page of the diary server (src/components/legal/PrivacyPolicyLink.tsx)
  'settings.privacy.policyLink': 'Política de privacidade',
  'settings.privacy.title': 'Privacidade',
  'settings.privacy.offlineLabel': 'Modo de privacidade offline',
  'settings.privacy.offlineHint':
    'Com esta opção ativada, a própria aplicação não pode abrir nenhuma ligação de rede, exceto ao seu servidor local. Desative-a apenas se utilizar o acesso remoto.',
  'settings.privacy.offlineOn': 'O modo de privacidade offline foi ativado.',
  'settings.privacy.offlineOff': 'O modo de privacidade offline foi desativado.',
  // Data card (src/pages/settings/DataSection.tsx)
  'settings.data.title': 'Dados',
  'settings.data.reassurance': 'Os dados do seu diário são guardados na sua conta pessoal e encriptados de ponta a ponta.',
  'settings.data.seedDemo': 'Carregar dados de exemplo',
  'settings.data.seedDemoTitle': 'Carregamento de dados de exemplo',
  'settings.data.seedDemoMessage':
    'De momento, o diário está vazio. Serão criados cerca de {days} dias de entradas e hábitos fictícios, para que possa ter uma ideia das observações, das estatísticas e da pesquisa. Pode editá-los e eliminá-los como qualquer outra entrada.',
  'settings.data.seedDemoConfirm': 'Carregar',
  'settings.data.seedDemoDone':
    'Foram carregados {entries, plural, one {# entrada} other {# entradas}}, {habits, plural, one {# hábito} other {# hábitos}} e {logs, plural, one {# registo de hábito} other {# registos de hábitos}}.',

  // Delete account card - the last card of the page (src/pages/settings/DeleteAccountSection.tsx)
  'settings.deleteAccount.title': 'Eliminar a conta',
  'settings.deleteAccount.warning':
    'Eliminar a sua conta apaga-a definitivamente, juntamente com o diário, os hábitos e as definições, e termina a sessão em todos os dispositivos. Não é possível restaurá-la. Os ficheiros de cópia de segurança que guardou noutro local não são afetados.',
  'settings.deleteAccount.button': 'Eliminar a conta',
  'settings.deleteAccount.dialogTitle': 'Eliminar a conta «{username}»?',
  'settings.deleteAccount.passwordHint': 'Para confirmar, introduza a palavra-passe da conta.',
  'settings.deleteAccount.understand': 'Compreendo que esta ação não pode ser anulada',
  'settings.deleteAccount.confirm': 'Eliminar a conta definitivamente',
  'settings.deleteAccount.done': 'Todos os dados e a conta foram eliminados.',
  'settings.deleteAccount.wrongPassword': 'A palavra-passe está incorreta. Tente novamente.',
  'settings.deleteAccount.ownerRemote':
    'A sua conta é a proprietária do acesso remoto neste computador. Ao eliminá-la, o acesso remoto é desligado e as respetivas definições (endereço e token do DuckDNS, certificado) são apagadas; a conta mais antiga que restar passa a ser a proprietária e pode configurá-lo de novo.',
  'settings.deleteAccount.ownerMail':
    'A sua conta é a proprietária do e-mail para repor a palavra-passe neste computador. Ao eliminá-la, o envio de e-mails é desligado e as respetivas definições (conta de envio e palavra-passe de app) são apagadas; a conta mais antiga que restar passa a ser a proprietária e pode configurá-lo de novo.',
  'settings.deleteAccount.ownerBoth':
    'A sua conta é a proprietária do acesso remoto e do e-mail para repor a palavra-passe neste computador. Ao eliminá-la, ambos são desligados e as respetivas definições (endereço e token do DuckDNS, certificado, conta de envio e palavra-passe de app) são apagadas; a conta mais antiga que restar passa a ser a proprietária e pode configurá-los de novo.',
  // The owner line on the Your Personal Diary server (hosted mode): its owner is DIARY_OWNER_ID only, and deleting
  // the owner erases the mail settings and promotes nobody (server/src/hosted/owner.ts, docs/API.md "בעלות").
  'settings.deleteAccount.ownerHosted':
    'A sua conta é a proprietária do servidor do diário. Ao eliminá-la, os e-mails para repor a palavra-passe deixam de ser enviados a todas as contas e as definições do e-mail (conta de envio e palavra-passe de app) são apagadas. Nenhuma outra conta passa a ser a proprietária, por isso ninguém poderá abrir o cartão «Servidor» nem preparar um arquivo do servidor. Se se registar novamente, a nova conta terá um novo ID da conta, e será preciso voltar a definir DIARY_OWNER_ID com ele no servidor.',

  // Diagnostics card (src/pages/settings/DiagnosticsSection.tsx, desktop only)
  'settings.diagnostics.title': 'Diagnóstico',
  'settings.diagnostics.hint':
    'Informações técnicas sobre o servidor local que é executado em segundo plano. Úteis se algo não estiver a funcionar.',
  'settings.diagnostics.uiVersion': 'Versão da interface',
  'settings.diagnostics.serverVersion': 'Versão do servidor',
  'settings.diagnostics.port': 'Porta',
  'settings.diagnostics.lanStatus': 'Acesso pela rede',
  'settings.diagnostics.lanOn': 'Ativado',
  'settings.diagnostics.lanOff': 'Desativado',
  'settings.diagnostics.startedAt': 'Iniciado',
  'settings.diagnostics.showServerLog': 'Mostrar o registo do servidor',
  'settings.diagnostics.hideServerLog': 'Ocultar o registo do servidor',
  'settings.diagnostics.serverLog': 'Registo do servidor',
  'settings.diagnostics.serverLogEmpty': 'O registo do servidor está vazio.',
  'settings.diagnostics.serverLogLoaded': 'Registo do servidor carregado: {count, plural, one {# linha} other {# linhas}}.',
  'settings.diagnostics.serverLogFailed': 'Não foi possível ler o registo do servidor.',
  'settings.diagnostics.restartServer': 'Reiniciar o servidor',
  'settings.diagnostics.restartTitle': 'Reinício do servidor',
  'settings.diagnostics.restartMessage':
    'O servidor local será fechado e iniciado novamente, e a interface será recarregada para voltar a ligar-se a ele. Se a opção «Manter sessão iniciada» não estava assinalada, poderá ter de iniciar sessão novamente.',
  'settings.diagnostics.restartConfirm': 'Reiniciar',
  'settings.diagnostics.restarting': 'O servidor está a reiniciar. A interface será recarregada dentro de momentos.',
  'settings.diagnostics.restartFailed': 'Não foi possível reiniciar o servidor.',

  // Data card: phone (LAN) access, desktop only (src/pages/settings/LanAccessSection.tsx)
  'settings.lan.title': 'Acesso a partir do telemóvel na rede de casa',
  'settings.lan.label': 'Acesso a partir do telemóvel na rede de casa',
  'settings.lan.hint':
    'O servidor local passa também a escutar na rede Wi-Fi de casa, para que o mesmo diário possa ser aberto no telemóvel. Os dados nunca saem de casa.',
  'settings.lan.onlyFromComputer':
    'O acesso a partir do telemóvel só pode ser ativado ou desativado no computador onde o diário está instalado.',
  'settings.lan.enabled': 'O acesso a partir do telemóvel foi ativado.',
  'settings.lan.disabled': 'O acesso a partir do telemóvel foi desativado.',
  'settings.lan.ownerOnly': 'Só a conta proprietária deste computador (a primeira conta criada nele) pode ativar ou desativar o acesso pelo telemóvel.',
  'settings.lan.statusOn': 'O acesso pelo telemóvel está ativado.',
  'settings.lan.statusOff': 'O acesso pelo telemóvel está desativado.',
  'settings.lan.confirmTitle': 'Ativar o acesso pelo telemóvel',
  'settings.lan.confirmMessage': 'Os telemóveis e computadores da rede de casa poderão abrir a página de início de sessão do diário. Para confirmar, introduza a palavra-passe da sua conta.',
  'settings.lan.urlsTitle': 'Endereços a abrir no telemóvel',
  'settings.lan.noUrls': 'Não foi encontrado nenhum endereço de rede. Verifique se o computador está ligado ao Wi-Fi e tente novamente.',
  'settings.lan.copy': 'Copiar',
  'settings.lan.copyName': 'Copiar {url}',
  'settings.lan.copied': 'O endereço {url} foi copiado.',
  'settings.lan.copyFailed': 'Não foi possível copiar. Pode selecionar o endereço e copiá-lo manualmente.',
  'settings.lan.instructionsTitle': 'Como ligar a partir do telemóvel',
  'settings.lan.instructions.sameNetwork': 'Verifique se o telemóvel está ligado à mesma rede Wi-Fi que o computador.',
  'settings.lan.instructions.openUrl':
    'Abra um dos endereços acima no navegador do telemóvel e inicie sessão com o mesmo nome de utilizador e a mesma palavra-passe.',
  'settings.lan.instructions.firewall':
    'Na primeira vez, a Firewall do Windows pode pedir autorização: permita o acesso apenas em redes privadas.',
  'settings.lan.instructions.sameServer':
    'O telemóvel vê exatamente o que é feito no computador, porque ambos trabalham com o mesmo servidor local.',

  // Backup page: backup card (src/pages/settings/BackupCreateSection.tsx)
  'settings.backup.title': 'Cópia de segurança',
  'settings.backup.explanation':
    'O ficheiro de cópia de segurança é uma cópia encriptada de todo o diário (entradas, hábitos e definições) no formato .mpd. Guarde-o num local seguro, por exemplo num disco externo. Sem a palavra-passe, não pode ser aberto.',
  'settings.backup.ownPassword': 'Outra palavra-passe para a cópia de segurança',
  'settings.backup.ownPasswordHint':
    'Por predefinição, a cópia de segurança é encriptada com a palavra-passe da conta. Pode escolher outra palavra-passe apenas para este ficheiro.',
  'settings.backup.password': 'Palavra-passe da cópia de segurança',
  'settings.backup.passwordConfirm': 'Confirmar a palavra-passe da cópia de segurança',
  'settings.backup.create': 'Criar ficheiro de cópia de segurança',
  'settings.backup.fileFilter': 'Ficheiro de cópia de segurança encriptado',
  'settings.backup.created': 'Cópia de segurança criada: {fileName} ({size}).',

  // Backup page: restore card (src/pages/settings/RestoreSection.tsx)
  'settings.restore.title': 'Restaurar a partir de uma cópia de segurança',
  'settings.restore.explanation':
    'O restauro substitui o diário atual pelo conteúdo do ficheiro de cópia de segurança. A palavra-passe da conta não muda.',
  'settings.restore.pickFile': 'Escolher ficheiro de cópia de segurança',
  'settings.restore.fileField': 'Ficheiro de cópia de segurança',
  'settings.restore.fileHint': 'Um ficheiro .mpd criado nesta página.',
  'settings.restore.chosenFile': 'Ficheiro',
  'settings.restore.fileSize': 'Tamanho',
  'settings.restore.fileStatus': 'Estado',
  'settings.restore.inspecting': 'A verificar o ficheiro…',
  'settings.restore.action': 'Restaurar a partir da cópia de segurança',
  'settings.restore.confirmTitle': 'Restaurar a partir da cópia de segurança?',
  'settings.restore.warning':
    'O diário atual (todas as entradas, hábitos e definições) será substituído pelo conteúdo do ficheiro de cópia de segurança. Esta ação não pode ser anulada. Recomenda-se criar primeiro uma cópia de segurança do diário atual.',
  'settings.restore.confirm': 'Restaurar',
  'settings.restore.done':
    'Restauro concluído: {entries, plural, one {# entrada} other {# entradas}} e {habits, plural, one {# hábito} other {# hábitos}}.',
  'settings.restore.needFile': 'Escolha um ficheiro de cópia de segurança',
  'settings.restore.invalidFile': 'O ficheiro escolhido não é um ficheiro de cópia de segurança válido',

  // Backup page: export card (src/pages/settings/ExportSection.tsx)
  'settings.export.title': 'Exportar',
  'settings.export.explanation':
    'A exportação cria um ficheiro legível (não encriptado) com as entradas, por exemplo para ler, imprimir ou usar noutro programa. Guarde-o com o devido cuidado.',
  'settings.export.format': 'Formato',
  'settings.export.formatOption.txt': 'TXT: texto',
  'settings.export.formatOption.csv': 'CSV: tabela',
  'settings.export.formatOption.json': 'JSON: dados completos',
  'settings.export.formatOption.pdf': 'PDF: documento',
  'settings.export.formatHint.txt': 'Um ficheiro de texto simples que abre em qualquer computador ou telemóvel',
  'settings.export.formatHint.csv': 'Para abrir no Excel ou numa folha de cálculo',
  'settings.export.formatHint.json': 'Todos os campos, adequado para passar os dados para outro programa',
  'settings.export.formatHint.pdf': 'Um documento formatado para ler e imprimir',
  'settings.export.filter.txt': 'Ficheiro de texto',
  'settings.export.filter.csv': 'Ficheiro CSV',
  'settings.export.filter.json': 'Ficheiro JSON',
  'settings.export.filter.pdf': 'Documento PDF',
  'settings.export.from': 'Data inicial',
  'settings.export.to': 'Data final',
  'settings.export.rangeHint': 'Deixe em branco para exportar todo o diário.',
  'settings.export.rangeError': 'A data final tem de ser igual ou posterior à data inicial',
  'settings.export.includeHabits': 'Incluir hábitos e registos',
  'settings.export.includeHabitsCsv': 'Um ficheiro CSV contém apenas as entradas. Os hábitos são incluídos em TXT, JSON e PDF.',
  'settings.export.action': 'Exportar',
  'settings.export.done': 'Exportação concluída: {count, plural, one {# entrada} other {# entradas}}.',
  'settings.export.doneWithFile': 'Exportação concluída: {count, plural, one {# entrada} other {# entradas}}. {fileName}',
  'settings.export.downloaded': 'Exportação concluída. O ficheiro {fileName} foi transferido.',

  // Remote access card (src/pages/settings/RemoteAccessSection.tsx; the Privacy card's confirmation in PrivacySection.tsx)
  'settings.remote.title': 'Acesso remoto',
  'settings.remote.intro':
    'Abra o seu diário em qualquer lugar (no telemóvel ou noutro computador) no seu próprio endereço DuckDNS. O diário fica neste computador e nada é enviado para uma nuvem: este computador responde através de uma ligação HTTPS encriptada.',
  'settings.remote.switchLabel': 'Permitir o acesso a partir da internet',
  'settings.remote.switchHint':
    "Desativado por predefinição. Enquanto estiver ativado, este computador contacta o DuckDNS (para manter o seu endereço a apontar para aqui) e o Let's Encrypt (para o certificado de segurança), pelo que o modo de privacidade offline é desativado.",
  'settings.remote.enabled':
    'O acesso remoto foi ativado. A configuração pode demorar cerca de dois minutos; o estado abaixo é atualizado automaticamente.',
  'settings.remote.disabled': 'O acesso remoto foi desativado. O diário já não pode ser aberto a partir da internet.',
  'settings.remote.offlineTurnedOff':
    "O modo de privacidade offline foi desativado, porque o acesso remoto liga-se ao DuckDNS e ao Let's Encrypt.",
  'settings.remote.detailsTitle': 'Dados de ligação',
  'settings.remote.hostname': 'Endereço DuckDNS',
  'settings.remote.hostnameHint': 'O nome que criou em duckdns.org, por exemplo yourpersonaldiary.duckdns.org.',
  'settings.remote.hostnameInvalid':
    'Introduza um nome DuckDNS como yourpersonaldiary.duckdns.org (letras do alfabeto inglês, algarismos e hífenes).',
  'settings.remote.token': 'Token do DuckDNS',
  'settings.remote.tokenHint':
    'Aparece no topo da sua página em duckdns.org depois de iniciar sessão. Fica guardado encriptado neste computador e nunca mais é mostrado.',
  'settings.remote.tokenSaved': 'Há um token guardado. Deixe o campo em branco para o manter ou introduza um novo token para o substituir.',
  'settings.remote.tokenMissing': 'Introduza o seu token do DuckDNS.',
  'settings.remote.tokenInvalid':
    'Um token do DuckDNS tem este aspeto: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (algarismos e as letras de a a f).',
  'settings.remote.showToken': 'Mostrar o token',
  'settings.remote.publicPort': 'Porta no router',
  'settings.remote.publicPortHint':
    'A porta através da qual a internet chega a este computador. A 443 é a porta HTTPS padrão; altere-a apenas se o seu fornecedor de internet a bloquear.',
  'settings.remote.portInvalid': 'Introduza um número inteiro entre 1 e 65535.',
  'settings.remote.upnp': 'Abrir a porta do router automaticamente (UPnP)',
  'settings.remote.upnpHint':
    'Funciona com a maioria dos routers domésticos. Se não funcionar, as instruções abaixo explicam como abrir a porta manualmente.',
  'settings.remote.save': 'Guardar dados',
  'settings.remote.saved': 'Os dados do acesso remoto foram guardados.',
  'settings.remote.test': 'Testar a ligação',
  'settings.remote.testTitle': 'Resultados do teste de ligação',
  'settings.remote.testDone': 'Teste de ligação concluído: {passed} de {total} verificações bem-sucedidas.',
  'settings.remote.statusTitle': 'Estado',
  'settings.remote.busy': 'A configurar o acesso remoto. Pode demorar cerca de dois minutos; a lista é atualizada automaticamente.',
  'settings.remote.ready': 'O acesso remoto está pronto. O endereço do seu diário: {url}',
  'settings.remote.failed': 'Não foi possível configurar o acesso remoto: {message}',
  'settings.remote.lastError': 'Último problema: {message}',
  'settings.remote.nextRetry': 'Próxima tentativa automática: {time}.',
  'settings.remote.stepAt': 'Atualizado: {time}',
  'settings.remote.state.idle': 'Não iniciado',
  'settings.remote.state.running': 'Em curso',
  'settings.remote.state.ok': 'Concluído',
  'settings.remote.state.error': 'Falhou',
  'settings.remote.state.warning': 'Aviso',
  'settings.remote.state.skipped': 'Ignorado',
  'settings.remote.step.duckdns': 'Endereço DuckDNS',
  'settings.remote.step.certificate': "Certificado de segurança (Let's Encrypt)",
  'settings.remote.step.listener': 'Ligação segura (HTTPS)',
  'settings.remote.step.upnp': 'Porta do router',
  'settings.remote.check.duckdns': 'Atualização do DuckDNS',
  'settings.remote.check.upnp': 'Router (UPnP)',
  'settings.remote.check.dns': 'Resolução do endereço (DNS)',
  'settings.remote.check.https': 'Ligação HTTPS',
  'settings.remote.publicIp': 'Endereço IP público',
  'settings.remote.unknown': 'Desconhecido',
  'settings.remote.certificate': 'Certificado',
  'settings.remote.certificateValid':
    'Válido até {date} ({days, plural, one {falta # dia} other {faltam # dias}}), emitido por {issuer}. É renovado automaticamente.',
  'settings.remote.certificateStaging':
    "Este é um certificado de teste (ambiente de testes do Let's Encrypt); os navegadores vão mostrar um aviso.",
  'settings.remote.noCertificate': 'Ainda não há nenhum certificado.',
  'settings.remote.renew': 'Renovar o certificado',
  'settings.remote.renewStarted': 'A renovação do certificado foi iniciada. Pode demorar cerca de dois minutos.',
  'settings.remote.urlTitle': 'O endereço do seu diário',
  'settings.remote.urlHint': 'Abra este endereço no telemóvel ou em qualquer computador e inicie sessão com o seu nome de utilizador e a sua palavra-passe.',
  'settings.remote.noUrl': 'O endereço aparece aqui quando a ligação segura estiver pronta.',
  'settings.remote.qrLabel': 'Código QR do endereço {url}',
  'settings.remote.qrHint': 'Leia o código com a câmara do telemóvel para abrir o endereço.',
  'settings.remote.instructionsTitle': 'Como funciona e o que é necessário',
  'settings.remote.instructions.account':
    'Crie uma conta gratuita em duckdns.org, adicione um nome (por exemplo, yourpersonaldiary) e copie o token apresentado na página.',
  'settings.remote.instructions.enter':
    'Introduza acima o nome e o token, assinale «Permitir o acesso a partir da internet», escreva a palavra-passe da sua conta e selecione Guardar.',
  'settings.remote.instructions.firstCertificate':
    'O primeiro certificado pode demorar cerca de dois minutos. A lista de estado é atualizada automaticamente.',
  'settings.remote.instructions.keepOn':
    'Mantenha este computador ligado e a aplicação do diário aberta: o diário só está acessível enquanto ambos estiverem a funcionar.',
  'settings.remote.instructions.manualForward':
    'Se não for possível abrir a porta do router automaticamente, abra as definições do router e reencaminhe a porta externa {publicPort} (TCP) para o endereço deste computador, {ip}, porta {port}.',
  'settings.remote.instructions.manualForwardNoIp':
    'Se não for possível abrir a porta do router automaticamente, abra as definições do router e reencaminhe a porta externa {publicPort} (TCP) para este computador (o seu endereço na rede de casa), porta {port}.',
  'settings.remote.instructions.signIn':
    'No telemóvel, abra o endereço e inicie sessão com o seu nome de utilizador e a sua palavra-passe: está lá tudo o que escreveu.',
  'settings.remote.instructions.firewall':
    'Se a Firewall do Windows perguntar se pretende permitir o diary-server.exe (parte do Your Personal Diary), permita-o (pode ser necessária a aprovação de um administrador). Caso contrário, as ligações a partir da internet ficam bloqueadas.',
  'settings.remote.instructions.atHome':
    'Em casa, na mesma rede, o endereço de internet pode não abrir (muitos routers não o suportam). Nesse caso, utilize antes o «Acesso a partir do telemóvel na rede de casa».',
  'settings.remote.privacyNote':
    "Privacidade: as suas entradas ficam neste computador e só viajam, encriptadas, para os dispositivos em que inicia sessão. O DuckDNS fica a conhecer o endereço IP público deste computador e o Let's Encrypt fica a conhecer o nome do seu endereço. Qualquer pessoa que conheça o endereço pode chegar à página de início de sessão, por isso utilize uma palavra-passe forte; várias palavras-passe erradas seguidas bloqueiam os inícios de sessão a partir de outros dispositivos durante 15 minutos (neste computador é sempre possível iniciar sessão). Não é possível criar novas contas através da internet.",
  'settings.remote.offlineConflictTitle': 'Ativar o modo de privacidade offline?',
  'settings.remote.offlineConflictMessage':
    "O modo de privacidade offline não permite as ligações de que o acesso remoto precisa (DuckDNS e Let's Encrypt). Ao ativá-lo, o acesso remoto também é desativado e o diário deixa de poder ser aberto a partir da internet.",
  'settings.remote.offlineConflictConfirm': 'Desativar o acesso remoto',
  'settings.remote.disabledByOffline': 'O acesso remoto foi desativado.',
  'settings.remote.offlineConflictPassword': 'Introduza a palavra-passe da sua conta para desativar o acesso remoto.',
  // Ownership and the locked card (only the account that set remote access up can view or change it).
  'settings.remote.ownerNote':
    'Apenas a sua conta pode ver ou alterar estas definições. As outras contas deste computador não veem este cartão.',
  'settings.remote.setupOwnerNote':
    'A conta que guardar estas definições passa a ser a única conta deste computador que as pode ver ou alterar.',
  'settings.remote.currentTitle': 'Definições atuais',
  'settings.remote.summary.state': 'Acesso remoto',
  'settings.remote.summary.on': 'Ativado',
  'settings.remote.summary.off': 'Desativado',
  'settings.remote.summary.tokenSaved': 'Guardado (encriptado, nunca é mostrado)',
  'settings.remote.summary.upnp': 'Abertura da porta do router',
  'settings.remote.summary.upnpAuto': 'Automática (UPnP)',
  'settings.remote.summary.upnpManual': 'Manual, nas definições do router',
  'settings.remote.lockedHint':
    'As definições estão bloqueadas. Para as alterar, selecione «Alterar definições» e introduza a palavra-passe da sua conta.',
  'settings.remote.change': 'Alterar definições',
  'settings.remote.unlockTitle': 'Alterar as definições do acesso remoto',
  'settings.remote.unlockMessage':
    'Para proteger o seu diário, introduza a palavra-passe da sua conta antes de alterar a partir de onde e de que forma pode ser acedido pela internet.',
  'settings.remote.unlocked': 'As definições podem ser editadas. Altere os dados e selecione Guardar.',
  'settings.remote.editCancelled': 'Não foram feitas alterações. As definições voltaram a ficar bloqueadas.',
  'settings.remote.savedLocked': 'As definições do acesso remoto foram guardadas e voltaram a ficar bloqueadas.',
  'settings.remote.password': 'A palavra-passe da sua conta',
  'settings.remote.passwordHint': 'Necessária para guardar. A partir daí, só esta conta poderá ver ou alterar o acesso remoto.',
  'settings.remote.passwordMissing': 'Introduza a palavra-passe da sua conta.',
  'settings.remote.wrongPassword': 'A palavra-passe está incorreta.',
  // E-mail for password reset (src/pages/settings/MailSection.tsx; owner-only, locked after setup, like remote access).
  'settings.mail.title': 'E-mail para repor a palavra-passe',
  'settings.mail.intro':
    'Quando alguém se esquece da palavra-passe, o diário envia-lhe por e-mail uma ligação e um código para escolher uma nova. Para isso, o diário precisa de uma conta de e-mail a partir da qual enviar, por exemplo o endereço Gmail que criou para o diário.',
  'settings.mail.ownerNote':
    'Apenas a sua conta pode ver ou alterar estas definições. As outras contas deste computador não veem este cartão.',
  'settings.mail.setupOwnerNote':
    'A conta que guardar estas definições passa a ser a única conta deste computador que as pode ver ou alterar.',
  'settings.mail.switchLabel': 'Enviar e-mails de reposição da palavra-passe',
  'settings.mail.switchHint':
    'Enquanto esta opção estiver ativada, o diário liga-se ao servidor de e-mail apenas para enviar e-mails de reposição da palavra-passe e e-mails de teste.',
  'settings.mail.detailsTitle': 'Conta de envio',
  'settings.mail.address': 'Endereço Gmail',
  'settings.mail.addressHint':
    'Os e-mails são enviados a partir deste endereço, com o nome de remetente «Your Personal Diary».',
  'settings.mail.addressInvalid': 'Introduza um endereço de e-mail válido.',
  'settings.mail.appPassword': 'Palavra-passe de app',
  'settings.mail.appPasswordHint':
    'A palavra-passe de app de 16 letras que a Google criou para o diário, e não a sua palavra-passe normal do Gmail. Os espaços não importam.',
  'settings.mail.appPasswordSaved':
    'Está guardada uma palavra-passe de app (encriptada, nunca é mostrada). Deixe o campo vazio para a manter.',
  'settings.mail.appPasswordMissing': 'Introduza a palavra-passe de app.',
  'settings.mail.appPasswordGmail':
    'Uma palavra-passe de app do Gmail tem 16 letras. A sua palavra-passe normal do Gmail não funciona aqui.',
  'settings.mail.advanced': 'Avançado: servidor de e-mail',
  'settings.mail.host': 'Servidor de envio (SMTP)',
  'settings.mail.hostHint': 'Para o Gmail: smtp.gmail.com',
  'settings.mail.hostInvalid': 'Introduza o nome do servidor de e-mail, por exemplo smtp.gmail.com.',
  'settings.mail.port': 'Porta',
  'settings.mail.portHint': '465 com SSL/TLS, 587 com STARTTLS',
  'settings.mail.portInvalid': 'Introduza um número de porta de 1 a 65535.',
  'settings.mail.security': 'Encriptação',
  'settings.mail.security.tls': 'SSL/TLS (normalmente porta 465)',
  'settings.mail.security.starttls': 'STARTTLS (normalmente porta 587)',
  'settings.mail.password': 'A palavra-passe da sua conta',
  'settings.mail.passwordHint':
    'A palavra-passe da sua conta do diário. Necessária para guardar; a partir daí, só esta conta poderá ver ou alterar estas definições.',
  'settings.mail.passwordMissing': 'Introduza a palavra-passe da sua conta.',
  'settings.mail.wrongPassword': 'A palavra-passe está incorreta.',
  'settings.mail.saved': 'As definições de e-mail foram guardadas.',
  'settings.mail.savedLocked': 'As definições de e-mail foram guardadas e bloqueadas.',
  'settings.mail.enabled':
    'O envio de e-mails de reposição da palavra-passe está ativado. Selecione «Enviar e-mail de teste» para o verificar.',
  'settings.mail.disabled': 'O envio de e-mails de reposição da palavra-passe está desativado.',
  'settings.mail.notReady':
    'Ainda não é possível enviar e-mails: os dados estão incompletos. Selecione «Alterar definições» para os completar.',
  'settings.mail.currentTitle': 'Definições atuais',
  'settings.mail.summary.state': 'Envio de e-mails de reposição',
  'settings.mail.summary.on': 'Ativado',
  'settings.mail.summary.off': 'Desativado',
  'settings.mail.summary.address': 'Enviado a partir de',
  'settings.mail.summary.appPassword': 'Palavra-passe de app',
  'settings.mail.summary.appPasswordSaved': 'Guardada (encriptada, nunca é mostrada)',
  'settings.mail.summary.server': 'Servidor de e-mail',
  'settings.mail.summary.serverValue': '{host}, porta {port}, {security}',
  'settings.mail.lockedHint':
    'As definições estão bloqueadas. Para as alterar, selecione «Alterar definições» e introduza a palavra-passe da sua conta.',
  'settings.mail.change': 'Alterar definições',
  'settings.mail.unlockTitle': 'Alterar as definições de e-mail',
  'settings.mail.unlockMessage':
    'Para proteger o seu diário, introduza a palavra-passe da sua conta antes de alterar a conta a partir da qual o diário envia e-mails.',
  'settings.mail.unlocked': 'As definições podem ser editadas. Altere os dados e selecione Guardar.',
  'settings.mail.editCancelled': 'Não foram feitas alterações. As definições voltaram a ficar bloqueadas.',
  'settings.mail.test': 'Enviar e-mail de teste',
  'settings.mail.testHint': 'Envia um e-mail curto para o seu próprio endereço: {email}.',
  'settings.mail.testNoEmail':
    'A sua conta ainda não tem endereço de e-mail. Adicione um no cartão «Conta» para receber o e-mail de teste.',
  'settings.mail.testSent':
    'Foi enviado um e-mail de teste para {email}. Verifique a caixa de entrada (e a pasta de spam).',
  'settings.mail.testFailed': 'Não foi possível enviar o e-mail de teste. {message}',
  'settings.mail.instructionsTitle': 'Como obter uma palavra-passe de app do Gmail',
  'settings.mail.instructions.signIn':
    'Inicie sessão em myaccount.google.com com a conta Gmail a partir da qual o diário vai enviar.',
  'settings.mail.instructions.twoStep':
    'Abra «Segurança» e ative a validação em dois passos. A Google só oferece palavras-passe de apps a contas com validação em dois passos.',
  'settings.mail.instructions.create':
    'Abra myaccount.google.com/apppasswords (ou procure «Palavras-passe de apps» na sua Conta Google), escreva um nome como «Your Personal Diary» e selecione «Criar».',
  'settings.mail.instructions.copy':
    'A Google mostra uma única vez uma palavra-passe de 16 letras. Escreva-a aqui no campo «Palavra-passe de app» (os espaços não importam), introduza a palavra-passe da sua conta e selecione «Guardar».',
  'settings.mail.instructions.test': 'Selecione «Enviar e-mail de teste» e confirme que chega à sua caixa de entrada.',
  'settings.mail.whyAppPassword':
    'Porquê uma palavra-passe de app? A Google recusa a palavra-passe normal do Gmail em programas de e-mail, por isso ela não funciona aqui. Uma palavra-passe de app só pode ser usada para e-mail e pode revogá-la na sua Conta Google a qualquer momento.',
  'settings.mail.privacyNote':
    'A palavra-passe de app é guardada encriptada neste computador e nunca volta a ser mostrada. Os e-mails contêm apenas a ligação e o código de reposição, nunca nada do seu diário.',

  // Your Personal Diary server (src/pages/settings/PrivacySection.tsx; the published apps, the web UI it serves)
  'settings.hosted.reassurance': 'O seu diário é guardado no servidor Your Personal Diary e encriptado com a sua palavra-passe.',
  'settings.hosted.serverAddress': 'Servidor do diário: {host}',
  'settings.hosted.offlineHint': 'Com esta opção ativada, a própria aplicação não pode abrir nenhuma ligação de rede, exceto ao servidor do diário.',
  // Server card (src/pages/settings/ServerSection.tsx): hosted server, its owner only (docs/android-tasks/SERVER-CARD.md)
  'settings.server.title': 'Servidor',
  'settings.server.intro': 'O estado do servidor do Your Personal Diary. Apenas o proprietário do servidor vê este cartão.',
  'settings.server.refresh': 'Atualizar',
  'settings.server.refreshed': 'O estado do servidor foi atualizado.',
  'settings.server.version': 'Versão',
  'settings.server.uptime': 'Tempo em funcionamento',
  'settings.server.accounts': 'Contas',
  'settings.server.accountsValue': '{count} de um máximo de {max}',
  'settings.server.registrations': 'Contas novas nas últimas 24 horas',
  'settings.server.disk': 'Disco',
  'settings.server.diskValue': '{used} usados, {free} livres ({percent})',
  'settings.server.diskLow':
    'Só {percent} do disco está livre. Aumente o volume em breve (fly volumes extend, consulte o manual de operações): quando o disco fica cheio, deixa de ser possível guardar alterações.',
  'settings.server.storage': 'Gravação no disco',
  'settings.server.storageOk': 'Normal',
  'settings.server.storageFailed': 'Com falhas: a gravação está a falhar',
  'settings.server.storageAlert':
    'Neste momento o servidor não consegue gravar alterações no disco. Verifique o espaço livre e o registo (consulte o manual de operações).',
  'settings.server.lastSave': 'Última gravação bem-sucedida',
  'settings.server.noSaveYet': 'Nenhuma desde que o servidor arrancou',
  'settings.server.memory': 'Memória em uso',
  'settings.server.gigabytes': '{value} GB',
  'settings.server.lastArchive': 'Último arquivo do servidor',
  'settings.server.noArchive': 'Ainda nenhum',
  'settings.server.archiveDueNone': 'Ainda não existe nenhum arquivo do servidor. Prepare um abaixo e transfira-o para o seu computador.',
  'settings.server.archiveDueOld':
    'O último arquivo do servidor tem mais de {days} dias. Prepare um novo abaixo e transfira-o para o seu computador.',
  'settings.server.archive.title': 'Arquivo do servidor',
  'settings.server.archive.intro':
    'Uma cópia cifrada de todos os dados do servidor, para o restaurar depois de um desastre. É gravada no disco do servidor, que guarda os 2 mais recentes, e depois é transferida para o seu computador com um comando na sua própria janela do PowerShell. Nunca pode ser transferida através do site nem da aplicação.',
  'settings.server.archive.listTitle': 'Arquivos no servidor',
  'settings.server.archive.created': 'Preparado em',
  'settings.server.archive.size': 'Tamanho',
  'settings.server.archive.download': 'Comando de transferência',
  'settings.server.archive.check': 'Comando de verificação',
  'settings.server.archive.copyDownload': 'Copiar o comando de transferência',
  'settings.server.archive.copyCheck': 'Copiar o comando de verificação',
  'settings.server.archive.copied': 'O comando foi copiado.',
  'settings.server.archive.copyFailed': 'Não foi possível copiar. Selecione o comando e copie-o manualmente.',
  'settings.server.archive.stepsTitle': 'Como transferir o arquivo',
  'settings.server.archive.step.open': 'No seu computador, abra o PowerShell na pasta onde quer guardar o ficheiro.',
  'settings.server.archive.step.download': 'Cole o comando de transferência e prima Enter.',
  'settings.server.archive.step.check':
    'Cole o comando de verificação e prima Enter. Tem de mostrar True; caso contrário, transfira o ficheiro novamente.',
  'settings.server.archive.step.keep': 'Guarde o ficheiro offline (por exemplo, num disco externo) e a frase-passe noutro local seguro.',
  'settings.server.archive.prepare': 'Preparar arquivo do servidor',
  'settings.server.archive.formTitle': 'Preparar um novo arquivo',
  'settings.server.archive.password': 'A palavra-passe da sua conta',
  'settings.server.archive.passphrase': 'Frase-passe do arquivo',
  'settings.server.archive.passphraseHint': 'Pelo menos {min} caracteres. Não é a palavra-passe da sua conta: escolha outra e anote-a.',
  'settings.server.archive.passphraseRepeat': 'Repita a frase-passe do arquivo',
  'settings.server.archive.passphraseWarning': 'A frase-passe é necessária para restaurar o arquivo e não pode ser recuperada.',
  'settings.server.archive.passwordMissing': 'Introduza a palavra-passe da sua conta.',
  'settings.server.archive.passphraseShort': 'A frase-passe do arquivo tem de ter pelo menos {min} caracteres.',
  'settings.server.archive.passphraseLong': 'A frase-passe do arquivo pode ter no máximo {max} caracteres.',
  'settings.server.archive.passphraseMismatch': 'As duas frases-passe não são iguais.',
  'settings.server.archive.submit': 'Preparar arquivo',
  'settings.server.archive.preparing': 'A preparar o arquivo. Pode demorar um minuto - mantenha esta página aberta.',
  'settings.server.archive.ready': 'O arquivo {name} ({size}) está pronto. Transfira-o agora com o comando abaixo.',
  'settings.server.archive.busy': 'Está a ser preparado um arquivo neste momento.',
  'settings.server.archive.nextAt': 'O próximo arquivo pode ser preparado a partir das {time}.',
  // Deletion request by e-mail (src/pages/settings/DeletionRequest.tsx, docs/android-tasks/ADMIN-TOOL.md item 3): the card builds two commands and sends nothing
  'settings.server.deletion.title': 'Pedido de eliminação por e-mail',
  'settings.server.deletion.intro':
    'Para quem não consegue iniciar sessão e pede por e-mail que a sua conta seja eliminada. A própria aplicação não pode procurar nem eliminar contas: escreva aqui o endereço e o cartão prepara dois comandos para o PowerShell no seu computador, que só funcionam com o seu início de sessão no Fly. Nada do que escrever aqui é enviado para lado nenhum.',
  'settings.server.deletion.check': 'Verifique se o pedido veio do endereço registado na conta.',
  'settings.server.deletion.email': 'Endereço de e-mail de quem faz o pedido',
  'settings.server.deletion.waiting': 'Os comandos aparecem aqui assim que escrever um endereço de e-mail completo.',
  'settings.server.deletion.encoded':
    'Este endereço tem carateres que o PowerShell alteraria, por isso os comandos levam-no codificado (b64:...); a ferramenta descodifica-o.',
  'settings.server.deletion.find': 'Passo 1: encontrar a conta',
  'settings.server.deletion.findHint':
    'Cole-o no PowerShell e prima Enter. Não altera nada: mostra o nome de utilizador da conta, o endereço de e-mail, a data de registo e o tamanho do diário.',
  'settings.server.deletion.copyFind': 'Copiar o comando de pesquisa',
  'settings.server.deletion.username': 'Nome de utilizador mostrado pelo comando de pesquisa',
  'settings.server.deletion.usernameHint': 'Escreva-o exatamente como foi mostrado; o comando de eliminação aparece então por baixo.',
  'settings.server.deletion.usernameInvalid':
    'Isto não é um nome de utilizador: um nome de utilizador tem de 3 a 32 letras, algarismos, pontos, hífenes ou sublinhados.',
  'settings.server.deletion.delete': 'Passo 2: eliminar a conta',
  'settings.server.deletion.deleteHint':
    'Execute-o só depois de verificar o endereço. Elimina a conta e o diário definitivamente; não é possível anular. Anote no seu registo a data que ele mostra.',
  'settings.server.deletion.copyDelete': 'Copiar o comando de eliminação',
};
export default messages;
