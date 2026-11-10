---
title: Política de privacidade - Your Personal Diary
description: Como o Your Personal Diary (aplicação Android, aplicação Windows e site) guarda e protege os seus dados.
languages: Idiomas
otherPage: Como eliminar a sua conta
---

# Política de privacidade - Your Personal Diary

Data de entrada em vigor: {{EFFECTIVE_DATE}}

## Em resumo

- O Your Personal Diary é um único serviço com três formas de acesso: a **aplicação Android** (Google Play), a **aplicação Windows** (Microsoft Store ou um ficheiro de instalação) e o **site** [{{SITE_URL}}]({{SITE_URL}}). As três utilizam o mesmo servidor e a mesma conta.
- O seu diário é guardado no nosso servidor num ficheiro encriptado com uma chave derivada da sua palavra-passe. Os dados da sua conta também são guardados aí.
- Utilizamos os seus dados apenas para fazer funcionar o seu diário. Sem publicidade, sem análises, sem rastreio, e não vendemos nem partilhamos os seus dados.
- Conheça os limites: enquanto tem a sessão iniciada, o servidor tem o seu diário aberto na memória, e quem opera o servidor poderia, tecnicamente, repor a sua palavra-passe e ler o seu diário. A secção 4 explica isto com clareza.
- Pode eliminar a sua conta e o seu diário a qualquer momento em **Definições - Eliminar a conta**.

## 1. Quem somos

O serviço é operado por {{PUBLISHER_NAME}} ("nós"), responsável pelos seus dados pessoais (o "responsável pelo tratamento"). Contacto: [{{CONTACT_EMAIL}}](mailto:{{CONTACT_EMAIL}}).

Esta política aplica-se à aplicação Android, à aplicação Windows e ao site. Todos mostram o mesmo diário e seguem as mesmas regras; quando uma aplicação se comporta de forma diferente, esta política indica-o.

## 2. O que guardamos no servidor e onde

O servidor funciona no fornecedor de alojamento Fly.io, no seu centro de dados em **Frankfurt, Alemanha (União Europeia)**. Guarda:

- **Dados da conta:** o seu nome próprio, apelido, nome de utilizador e endereço de e-mail, um identificador de conta, o idioma em que usa a aplicação, quando a conta foi criada e quando iniciou sessão pela última vez. Ao criar a conta, guardamos também um registo da sua confirmação de que leu e aceita esta política: o momento da confirmação e a data de entrada em vigor da versão que confirmou. Se alterar o seu endereço de e-mail, o endereço anterior e a data da alteração ficam guardados com a conta até voltar a alterá-lo ou eliminar a conta. A aplicação não encripta estes dados, porque o servidor precisa deles para iniciar a sua sessão e para lhe escrever, pelo que quem opera o servidor pode vê-los.
- **A sua palavra-passe:** não é guardada. O servidor guarda apenas um valor derivado dela (scrypt) que lhe permite verificá-la.
- **O seu diário:** entradas (texto e os campos opcionais humor, emoções, energia, stress, sono, atividade física, acontecimentos, pessoas, local, notas e etiquetas), hábitos e respetivos registos, e as suas definições. Cada conta tem o seu próprio ficheiro de diário encriptado.
- **Sessões:** para cada dispositivo em que tem a sessão iniciada: o tipo de dispositivo ("Computador", "Telemóvel" ou "Navegador"), quando a sessão começou, quando foi usada pela última vez e quando termina. O token de sessão só é guardado como hash. Com "Manter sessão iniciada", a sessão contém também a chave do seu diário, encriptada com a chave do servidor (secção 4).
- **Pedidos de reposição da palavra-passe:** um hash da ligação e do código, válidos durante 30 minutos e utilizáveis uma única vez.
- **A chave das cópias offline** nos seus dispositivos (secção 5), guardada dentro do seu diário encriptado.
- **As definições de envio de e-mail do operador** (a própria conta Gmail do operador, com a palavra-passe guardada encriptada). Não contêm nada sobre si.
- **Um registo técnico** dos eventos de arranque e dos erros. Não contém conteúdo do diário, endereços de e-mail nem endereços IP.

**A visita guiada** ("Ignorar - só quero ver", na aplicação Android) cria um diário de convidado temporário com dados de exemplo. Existe apenas na memória do servidor, termina sozinho ao fim de 30 minutos e nunca é guardado.

Como em qualquer site, o servidor e o fornecedor de alojamento recebem o endereço IP do seu dispositivo quando este se liga. O servidor utiliza-o apenas na sua memória: para limitar quantos pedidos podem chegar de uma mesma rede (início de sessão, registo e as outras funções da conta, reposição da palavra-passe, a visita guiada e as cópias de segurança) e para o bloqueio do início de sessão. Estes contadores abrangem no máximo as últimas 24 horas, e o endereço nunca é escrito no registo nem no armazenamento.

## 3. Como utilizamos os seus dados

- **Para prestar o serviço:** iniciar sessão, guardar o seu diário e mantê-lo igual em todos os seus dispositivos, pesquisa, estatísticas e conclusões sobre as suas próprias entradas, cópias de segurança, exportações e lembretes. As perguntas de pesquisa são respondidas no servidor e não ficam guardadas nele.
- **E-mail:** apenas para as suas mensagens de reposição da palavra-passe e para avisos de segurança (a sua palavra-passe foi alterada com uma mensagem de reposição; o endereço de e-mail da sua conta foi alterado). São escritos no idioma guardado com os dados da sua conta; o servidor não abre o seu diário para os escrever. Sem newsletters e sem marketing.
- **Nunca:** sem publicidade, sem ferramentas de análise ou rastreio, sem definição de perfis, sem venda de dados e sem utilização do seu diário para treinar qualquer IA.

Fundamento jurídico (para utilizadores da União Europeia e leis semelhantes): tratamos os seus dados para prestar o serviço em que se registou (execução de um contrato, artigo 6.º, n.º 1, alínea b), do RGPD) e para o manter seguro (o nosso interesse legítimo, artigo 6.º, n.º 1, alínea f): limites de tentativas, bloqueios, o registo técnico). O seu diário pode conter informação sensível, por exemplo sobre a sua saúde ou as suas convicções, se decidir escrevê-la. Tratamo-la apenas para a guardar e lha mostrar, porque nos pediu isso ao escrevê-la (o seu consentimento explícito, artigo 9.º, n.º 2, alínea a)); pode removê-la a qualquer momento editando ou eliminando entradas (a secção 7 indica como o texto antigo é apagado).

## 4. Como o seu diário é protegido - e contra o que isso não protege

O que o protege:

- O ficheiro de diário de cada conta é encriptado com AES-256-GCM. A chave é derivada da sua palavra-passe com scrypt. Qualquer alteração ao ficheiro é detetada.
- Os discos do fornecedor de alojamento também estão encriptados (encriptação em repouso).
- Todas as ligações entre os seus dispositivos e o servidor usam HTTPS (TLS).

O que deve saber:

- **Enquanto tem a sessão iniciada, o seu diário está desencriptado na memória do servidor**, para que o servidor o possa mostrar, pesquisar e analisar por si. Não se trata de encriptação "ponto a ponto".
- **Quem opera o servidor pode, tecnicamente, repor qualquer palavra-passe.** Para que "Esqueceu-se da palavra-passe?" funcione sem perder o seu diário, o servidor guarda para cada conta uma cópia da chave do diário, encriptada com uma chave do servidor (uma "chave de recuperação"). A chave do servidor é guardada como segredo da plataforma de alojamento, fora dos ficheiros armazenados, pelo que uma cópia dos ficheiros, por si só, não abre nada. Ainda assim, quem controla o servidor e os seus segredos - o operador e, em princípio, o fornecedor de alojamento - poderia repor a palavra-passe de qualquer conta e ler o respetivo diário sem conhecer a palavra-passe. Comprometemo-nos a não o fazer. Não temos nenhuma ferramenta para isso, e as nossas ferramentas de administração nunca abrem um diário. Se não estiver disposto a confiar neste compromisso, não guarde no serviço nada que não queira que outra pessoa leia.
- **Um pedido de reposição da palavra-passe não abre o seu diário.** A mensagem de reposição e os avisos de segurança são escritos no idioma guardado com os dados da sua conta (secção 2), pelo que um pedido - seu ou de qualquer pessoa que escreva o seu endereço de e-mail - deixa o seu diário fechado. Só quando a reposição é concluída com a ligação ou o código da mensagem é que o servidor abre o seu diário com a chave de recuperação, para o voltar a encriptar com a sua nova palavra-passe.

## 5. O que fica guardado no seu dispositivo

Em cada dispositivo em que utiliza o serviço:

- o seu token de sessão (para manter a sessão iniciada), o último nome de utilizador, as suas preferências de idioma e de apresentação, e as suas perguntas de pesquisa recentes (apagadas quando termina a sessão).

**Sem ligação.** Se a aplicação não conseguir chegar ao servidor, continua a funcionar: o que escreve fica guardado no seu dispositivo, encriptado, e é enviado para o servidor automaticamente quando a ligação regressa, mesmo que a aplicação tenha sido fechada entretanto. Nas aplicações Windows e Android, se escolheu "Manter sessão iniciada", a aplicação guarda também uma cópia encriptada do que lhe mostrou recentemente (entradas recentes, hábitos, dados de hoje, o mês do calendário e as suas definições), para que a possa ler sem ligação; caso contrário, essa cópia só existe na memória enquanto a aplicação está aberta. O servidor guarda a chave destas cópias dentro do seu diário encriptado; com "Manter sessão iniciada", as aplicações Windows e Android guardam-na também no dispositivo, protegida pela proteção de dados do Windows ou pelo Android Keystore, para que a aplicação possa abrir sem ligação. A sua palavra-passe e a sua chave de recuperação nunca são guardadas no dispositivo. Para que cada alteração seja enviada exatamente uma vez, a aplicação guarda também, encriptado, um registo das alterações que enviou nos últimos 7 dias.

- **Aplicação Windows:** estas cópias ficam nas pastas de dados da aplicação dentro do seu perfil de utilizador do Windows (na versão da Microsoft Store, na pasta do próprio pacote da aplicação). A chave está protegida pela proteção de dados do Windows (DPAPI) e só funciona para o seu utilizador do Windows.
- **Aplicação Android:** estas cópias ficam no armazenamento privado da aplicação, que outras aplicações não conseguem ler e que está excluído das cópias de segurança. A chave está protegida pelo Android Keystore.
- TODO-TRANSLATE: **Mac app:** these copies are kept in the app's folder inside your user Library (Application Support/app.yourpersonaldiary.mac). The key is kept as an item of your Mac user's login keychain, named "Your Personal Diary offline key" and never synchronized to iCloud Keychain; it is protected by your Mac login password and can be read only by the app. A Migration Assistant or Time Machine copy of your user account carries the item, still protected by that password. Once the app is distributed with Apple's signature, the item will move to the keychain that stays on this Mac only.
- TODO-TRANSLATE: **iPhone app:** these copies are kept in the app's private storage, excluded from iCloud backup. The key is kept in the iOS Keychain, available only on this device after it was unlocked once, and removed when you sign out.
- **Site:** no navegador ficam guardados, encriptados, apenas as alterações ainda não enviadas, o registo dos últimos 7 dias e os avisos sobre alterações em conflito (ver abaixo), mas nenhuma cópia do que leu; a chave fica na memória e desaparece quando fecha a página.

Quando a ligação regressa, a aplicação envia as alterações que fez, pela ordem em que as fez, cada uma exatamente uma vez. Se a mesma entrada, hábito ou definição também tiver sido alterada noutro dispositivo, fica a alteração mais recente e a aplicação informa-o numa linha; a outra versão continua disponível para si neste dispositivo até fechar o aviso.

Se a aplicação oferecer o desbloqueio com o bloqueio de ecrã do seu dispositivo (Windows Hello, ou o bloqueio de ecrã ou a impressão digital do Android), a verificação é feita pelo sistema operativo. Nada sobre a sua impressão digital, o seu rosto ou o seu PIN chega à aplicação ou a nós. Os lembretes de hábitos da aplicação Android são agendados no próprio telemóvel; não é usado nenhum serviço de notificações push.

Ficheiros que cria: uma **cópia de segurança** é encriptada com uma palavra-passe; uma **exportação** (TXT, CSV, JSON ou PDF) é um ficheiro normal e legível. É o utilizador que decide onde os guarda, e qualquer pessoa que obtenha um ficheiro exportado pode lê-lo.

## 6. Quem mais recebe dados

Utilizamos dois prestadores de serviços. Tratam os dados apenas em nosso nome, para fazer funcionar o serviço:

- **Fly.io, Inc.** (Estados Unidos) - alojamento do servidor em Frankfurt, Alemanha. Os seus sistemas contêm os ficheiros de diário encriptados, os dados das contas e os restantes dados da secção 2, e recebem dados de ligação como endereços IP. Como a Fly.io é uma empresa norte-americana, pode aceder aos dados a partir de fora da União Europeia; isto está abrangido pelas suas condições de tratamento de dados. A sua política de privacidade: `fly.io/legal/privacy-policy`.
- **Google (Gmail)** - envia as mensagens de reposição da palavra-passe e os avisos de segurança. A Google recebe a mensagem, o seu endereço de e-mail e o nome próprio e o nome de utilizador nela incluídos. Uma mensagem nunca contém nada do seu diário. Política de privacidade da Google: `policies.google.com/privacy`.

As lojas de aplicações também tratam dados segundo as suas próprias políticas de privacidade quando descarrega as aplicações: o **Google Play** para a aplicação Android e a **Microsoft Store** para a aplicação Windows (por exemplo, instalações, classificações e relatórios de falhas recolhidos pelos seus sistemas). As aplicações não contêm código delas nem de mais ninguém que lhes envie dados.

Não vendemos, alugamos nem partilhamos os seus dados pessoais com mais ninguém. Só divulgaríamos dados se a lei o exigisse.

## 7. Durante quanto tempo guardamos os dados e como os eliminar

- Guardamos a sua conta e o seu diário até os eliminar. As sessões terminam ao fim de 12 horas, ou de 90 dias com "Manter sessão iniciada". Os pedidos de reposição da palavra-passe expiram ao fim de 30 minutos. As cópias num dispositivo mantêm-se até terminar a sessão nesse dispositivo.
- **Eliminar a sua conta na aplicação ou no site:** inicie sessão, abra **Definições - Eliminar a conta**, introduza a sua palavra-passe e confirme. Isto elimina imediatamente do servidor a sua conta, o seu diário, os seus hábitos e definições, a sua sessão em todos os dispositivos e quaisquer pedidos de reposição da palavra-passe, e elimina a cópia offline do dispositivo que está a usar. As alterações que ainda aguardam nos seus outros dispositivos deixam de poder ser enviadas e perdem-se.
- **Cópias nas cópias de segurança do servidor:** o fornecedor de alojamento faz uma captura diária do armazenamento do servidor. As cópias de uma conta eliminada nessas capturas são apagadas automaticamente no prazo de 30 dias.
- **Arquivos encriptados do servidor:** para poder recuperar de um desastre, quem opera o servidor faz cerca de uma vez por mês uma cópia encriptada de todo o armazenamento do servidor (um "arquivo do servidor"); o servidor guarda apenas os 2 mais recentes, e quem o opera guarda no máximo os 3 mais recentes offline, numa unidade que não está ligada à internet, pelo que as cópias de uma conta eliminada desaparecem deles à medida que arquivos mais recentes os substituem, normalmente no prazo de três meses.
- **As entradas eliminadas ou alteradas** desaparecem da aplicação de imediato, e o texto antigo é apagado do ficheiro do seu diário no servidor quando a alteração é guardada, um momento depois: o servidor sobrescreve os dados eliminados em vez de apenas marcar o espaço como livre. A versão anterior do ficheiro, que o servidor guarda para o caso de uma gravação falhar, é substituída na gravação seguinte. O texto eliminado antes de existir esta proteção é apagado na primeira vez que o seu diário é aberto depois da atualização (por exemplo, quando inicia sessão). No servidor, as versões anteriores ficam depois apenas nas capturas diárias do armazenamento, durante até 30 dias, e, encriptadas, no espaço não utilizado do seu disco até esse espaço voltar a ser usado; as cópias de segurança que fez antes mantêm o texto que contêm. Eliminar a conta apaga o ficheiro inteiro.
- **Se não conseguir iniciar sessão:** escreva para [{{CONTACT_EMAIL}}](mailto:{{CONTACT_EMAIL}}) a partir do endereço de e-mail registado na sua conta. Confirmaremos o pedido e eliminaremos a conta no prazo de 30 dias. Todos os pormenores: [{{DELETE_URL}}]({{DELETE_URL}}).
- **Desinstalar a aplicação não elimina a sua conta.** Se é isso que pretende, elimine-a primeiro nas Definições. Terminar a sessão apaga as cópias e a chave desse dispositivo; se ainda houver alterações por enviar, a aplicação pergunta primeiro. No Windows, desinstalar a versão descarregada (ficheiro de instalação) mantém a cópia encriptada, a menos que escolha eliminar os dados da aplicação; para ter a certeza, termine primeiro a sessão.
- De momento não eliminamos automaticamente contas inativas. Se começarmos a fazê-lo, indicá-lo-emos aqui antes de se aplicar.

## 8. Medidas de segurança

- Apenas HTTPS; o servidor recusa ligações que não cheguem pelo seu endereço seguro.
- Limites às tentativas de início de sessão e de registo. Após 10 palavras-passe erradas, o início de sessão a partir dessa rede fica bloqueado durante 15 minutos, e as tentativas seguintes na conta são abrandadas.
- O diário bloqueia-se sozinho após um período de inatividade. Alterar a palavra-passe ou o endereço de e-mail e eliminar a conta exigem a sua palavra-passe.
- A chave do servidor é guardada fora dos ficheiros armazenados, e só o operador pode gerir o servidor.
- Quem puder executar programas como o seu utilizador do Windows, ou quem tiver o controlo total de um telemóvel com root, poderia ler a cópia guardada para "Manter sessão iniciada".

Nenhum sistema pode prometer segurança perfeita. Escolha uma palavra-passe forte que não use em mais nenhum lado, mantenha os seus dispositivos atualizados e guarde uma cópia de segurança.

## 9. Os seus direitos

Pode ver, corrigir, exportar e eliminar os seus dados por si próprio: o seu perfil está nas Definições, cada entrada pode ser editada ou eliminada, **Definições - Cópia de segurança** e a exportação criam uma cópia que pode levar para outro lado, e **Eliminar a conta** remove tudo. Pode também escrever-nos para pedir uma cópia dos seus dados, a sua retificação, o apagamento ou a limitação do tratamento, ou para se opor a ele, e pode retirar um consentimento a qualquer momento. Respondemos no prazo de 30 dias. Tem também o direito de apresentar reclamação a uma autoridade de proteção de dados - na União Europeia, a autoridade do seu país; em Israel, a Autoridade de Proteção da Privacidade.

## 10. Crianças

O serviço não se destina a crianças. Tem de ter pelo menos {{MINIMUM_AGE}} anos para criar uma conta. Não recolhemos conscientemente dados de ninguém mais novo. Se pensa que uma criança mais nova criou uma conta, escreva-nos e eliminá-la-emos.

## 11. Não é uma ferramenta médica

As conclusões da aplicação descrevem possíveis relações nas suas próprias entradas. Não provam causa e efeito e não são aconselhamento médico ou psicológico.

## 12. Alterações a esta política

Quando o serviço ou esta política mudarem, atualizamos esta página e a data de entrada em vigor no topo. Se uma alteração afetar o que fazemos com os seus dados, indicá-lo-emos nesta página antes de entrar em vigor.

## 13. Contacto

Perguntas sobre privacidade ou sobre os seus dados: [{{CONTACT_EMAIL}}](mailto:{{CONTACT_EMAIL}})

{{PUBLISHER_NAME}}
