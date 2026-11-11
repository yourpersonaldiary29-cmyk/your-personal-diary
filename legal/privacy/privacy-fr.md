---
title: Politique de confidentialité - Your Personal Diary
description: Comment Your Personal Diary (les applications Android, Windows, Mac et iPhone et le site web ; l'application iPhone lorsqu'elle sera publiée) conserve et protège vos données.
languages: Langues
otherPage: Comment supprimer votre compte
---

# Politique de confidentialité - Your Personal Diary

Date d'entrée en vigueur : {{EFFECTIVE_DATE}}

## En bref

- Your Personal Diary est un seul service avec cinq accès : l'**application Android** (Google Play), l'**application Windows** (Microsoft Store ou un fichier d'installation), l'**application Mac** (un téléchargement ou le Mac App Store), l'**application iPhone** (App Store, lorsqu'elle sera publiée) et le **site web** [{{SITE_URL}}]({{SITE_URL}}). Tous utilisent le même serveur et le même compte.
- Votre journal est conservé sur notre serveur dans un fichier chiffré avec une clé dérivée de votre mot de passe. Les informations de votre compte y sont conservées aussi.
- Nous utilisons vos données uniquement pour faire fonctionner votre journal. Pas de publicité, pas de mesure d'audience, pas de pistage, et nous ne vendons ni ne partageons vos données.
- Sachez quelles sont les limites : tant que vous êtes connecté, le serveur garde votre journal ouvert dans sa mémoire, et l'exploitant du serveur pourrait techniquement réinitialiser votre mot de passe et lire votre journal. La section 4 l'explique clairement.
- Vous pouvez supprimer votre compte et votre journal à tout moment dans **Paramètres - Supprimer le compte**.

## 1. Qui sommes-nous

Le service est exploité par {{PUBLISHER_NAME}} (« nous »), responsable de vos données personnelles (le « responsable du traitement »). Contact : [{{CONTACT_EMAIL}}](mailto:{{CONTACT_EMAIL}}).

Cette politique s'applique à l'application Android, à l'application Windows, à l'application Mac, à l'application iPhone (lorsqu'elle sera publiée) et au site web. Ils affichent le même journal et suivent les mêmes règles ; lorsqu'une application se comporte différemment, cette politique le précise.

## 2. Ce que nous conservons sur le serveur, et où

Le serveur fonctionne chez l'hébergeur Fly.io, dans son centre de données de **Francfort, Allemagne (Union européenne)**. Il conserve :

- **Les informations du compte :** votre prénom, votre nom, votre nom d'utilisateur et votre adresse e-mail, un identifiant de compte, la langue dans laquelle vous utilisez l'application, la date de création du compte et celle de votre dernière connexion. Lors de la création du compte, nous conservons aussi une trace de votre confirmation que vous avez lu cette politique et les [Conditions d'utilisation]({{TERMS_URL}}) et que vous les acceptez : l'heure de la confirmation et les dates d'entrée en vigueur des versions que vous avez confirmées. Si vous changez d'adresse e-mail, l'ancienne adresse et la date du changement sont conservées avec le compte jusqu'à ce que vous changiez à nouveau d'adresse ou supprimiez le compte. L'application ne chiffre pas ces informations, car le serveur en a besoin pour vous connecter et pour vous écrire ; l'exploitant peut donc les voir.
- **Votre mot de passe :** il n'est pas conservé. Le serveur garde seulement une valeur qui en est dérivée (scrypt) et qui lui permet de le vérifier.
- **Votre journal :** les entrées (texte, et les champs facultatifs humeur, émotions, énergie, stress, sommeil, activité physique, événements, personnes, lieu, notes et étiquettes), les habitudes et leurs relevés, et vos paramètres. Chaque compte a son propre fichier de journal chiffré.
- **Les sessions :** pour chaque appareil sur lequel vous êtes connecté : le type d'appareil (« Ordinateur », « Téléphone » ou « Navigateur »), le début de la session, sa dernière utilisation et sa fin. Le jeton de connexion lui-même n'est conservé que sous forme de hachage. Avec « Se souvenir de moi », la session contient aussi la clé de votre journal, chiffrée avec la clé du serveur (section 4).
- **Les demandes de réinitialisation du mot de passe :** un hachage du lien et du code, valables 30 minutes et utilisables une seule fois.
- **La clé des copies hors ligne** sur vos appareils (section 5), conservée dans votre journal chiffré.
- **Les paramètres d'envoi d'e-mails de l'exploitant** (le propre compte Gmail de l'exploitant, dont le mot de passe est conservé chiffré). Ils ne contiennent rien vous concernant.
- **Un journal technique** des événements de démarrage et des erreurs. Il ne contient ni contenu de votre journal, ni adresse e-mail, ni adresse IP.

**La visite** (« Passer - juste jeter un œil », dans l'application Android) crée un journal invité temporaire avec des données d'exemple. Il n'existe que dans la mémoire du serveur, se termine de lui-même au bout de 30 minutes et n'est jamais conservé.

Comme pour tout site web, le serveur et l'hébergeur reçoivent l'adresse IP de votre appareil quand il se connecte. Le serveur ne l'utilise que dans sa mémoire : pour limiter le nombre de requêtes qui peuvent venir d'un même réseau (connexion, inscription et les autres fonctions du compte, réinitialisation du mot de passe, la visite et les sauvegardes) et pour le verrouillage de la connexion. Ces compteurs couvrent au plus les dernières 24 heures, et l'adresse n'est jamais écrite dans le journal technique ni dans le stockage.

## 3. Comment nous utilisons vos données

- **Pour fournir le service :** la connexion, la conservation de votre journal à l'identique sur tous vos appareils, la recherche, les statistiques et les analyses de vos propres entrées, les sauvegardes, les exports et les rappels. Les questions de recherche sont traitées sur le serveur et n'y sont pas conservées.
- **E-mail :** uniquement pour vos messages de réinitialisation du mot de passe et pour des avis de sécurité (votre mot de passe a été modifié avec un message de réinitialisation ; l'adresse e-mail de votre compte a été modifiée). Ils sont rédigés dans la langue enregistrée avec les informations de votre compte ; le serveur n'ouvre pas votre journal pour les rédiger. Pas de lettre d'information et pas de marketing.
- **Jamais :** pas de publicité, pas d'outils de mesure d'audience ou de pistage, pas de profilage, pas de vente de données, et aucune utilisation de votre journal pour entraîner une IA.

Base juridique (pour les utilisateurs de l'Union européenne et des lois similaires) : nous traitons vos données pour fournir le service auquel vous vous êtes inscrit (exécution d'un contrat, article 6, paragraphe 1, point b, du RGPD) et pour en assurer la sécurité (notre intérêt légitime, article 6, paragraphe 1, point f : limitation des tentatives, verrouillages, journal technique). Votre journal peut contenir des informations sensibles, par exemple sur votre santé ou vos convictions, si vous choisissez de les écrire. Nous les traitons uniquement pour les conserver et vous les montrer, parce que vous nous l'avez demandé en les écrivant (votre consentement explicite, article 9, paragraphe 2, point a) ; vous pouvez les retirer à tout moment en modifiant ou en supprimant des entrées (la section 7 indique comment l'ancien texte est effacé).

## 4. Comment votre journal est protégé - et contre quoi cela ne protège pas

Ce qui le protège :

- Le fichier de journal de chaque compte est chiffré avec AES-256-GCM. La clé est dérivée de votre mot de passe avec scrypt. Toute modification du fichier est détectée.
- Les disques de l'hébergeur sont également chiffrés (chiffrement au repos).
- Toutes les connexions entre vos appareils et le serveur passent par HTTPS (TLS).

Ce que vous devez savoir :

- **Tant que vous êtes connecté, votre journal est déchiffré dans la mémoire du serveur**, pour que le serveur puisse l'afficher, y chercher et l'analyser pour vous. Ce n'est pas un chiffrement « de bout en bout ».
- **L'exploitant peut techniquement réinitialiser n'importe quel mot de passe.** Pour que « Mot de passe oublié ? » fonctionne sans perdre votre journal, le serveur conserve pour chaque compte une copie de la clé du journal, chiffrée avec une clé du serveur (une « clé de récupération »). La clé du serveur est conservée comme secret de la plateforme d'hébergement, en dehors des fichiers stockés : une copie des fichiers seule n'ouvre donc rien. Malgré tout, quiconque contrôle le serveur et ses secrets - l'exploitant et, en principe, l'hébergeur - pourrait réinitialiser le mot de passe de n'importe quel compte et lire son journal sans connaître le mot de passe. Nous nous engageons à ne pas le faire. Nous n'avons aucun outil pour cela, et nos outils d'administration n'ouvrent jamais un journal. Si vous n'êtes pas prêt à vous fier à cet engagement, ne conservez dans le service rien que vous ne voudriez pas voir lu par quelqu'un d'autre.
- **Une demande de réinitialisation du mot de passe n'ouvre pas votre journal.** Le message de réinitialisation et les avis de sécurité sont rédigés dans la langue enregistrée avec les informations de votre compte (section 2) ; une demande - faite par vous ou par quiconque saisit votre adresse e-mail - laisse donc votre journal fermé. Ce n'est que lorsque la réinitialisation est menée à terme avec le lien ou le code du message que le serveur ouvre votre journal avec la clé de récupération, pour le chiffrer à nouveau avec votre nouveau mot de passe.

## 5. Ce qui est conservé sur votre appareil

Sur chaque appareil où vous utilisez le service :

- votre jeton de connexion (pour rester connecté), le dernier nom d'utilisateur, vos préférences de langue et d'affichage, et vos questions de recherche récentes (effacées à la déconnexion).

**Sans connexion.** Si l'application ne peut pas joindre le serveur, elle continue de fonctionner : ce que vous écrivez est enregistré sur votre appareil, chiffré, puis envoyé automatiquement au serveur quand la connexion revient, même si l'application a été fermée entre-temps. Dans les applications Windows, Mac, Android et iPhone, si vous avez choisi « Se souvenir de moi », l'application conserve aussi une copie chiffrée de ce qu'elle vous a affiché récemment (entrées récentes, habitudes, données du jour, mois du calendrier et vos paramètres) pour que vous puissiez la lire sans connexion ; sinon, cette copie n'existe qu'en mémoire tant que l'application est ouverte. Le serveur conserve la clé de ces copies dans votre journal chiffré ; avec « Se souvenir de moi », les applications Windows, Mac, Android et iPhone la conservent aussi sur l'appareil, protégée par la protection des données de Windows, par le Keychain de macOS, par l'Android Keystore ou par le Keychain d'iOS, pour que l'application puisse s'ouvrir sans connexion. Votre mot de passe et votre clé de récupération ne sont jamais conservés sur l'appareil. Dans les applications qui conservent cette clé sur l'appareil avec « Se souvenir de moi », l'application en conserve aussi une copie chiffrée avec une clé dérivée de votre mot de passe, pour que vous puissiez déverrouiller l'application sans connexion en tapant votre mot de passe ; le mot de passe lui-même n'est pas conservé, et cette copie est supprimée en même temps que la clé - quand vous vous déconnectez, quand la session prend fin ou quand le compte est supprimé. Une personne disposant d'une copie des données de cet appareil pourrait essayer de deviner votre mot de passe sur cette copie sans avoir besoin de votre compte utilisateur de l'appareil, chaque essai coûtant autant que sur le serveur mais sans limite du nombre d'essais ; c'est un mot de passe robuste qui la protège. Pour que chaque modification soit envoyée exactement une fois, l'application conserve aussi, chiffré, un registre des modifications qu'elle a envoyées au cours des 7 derniers jours.

- **Application Windows :** ces copies sont conservées dans les dossiers de données de l'application, dans votre profil utilisateur Windows (pour la version Microsoft Store, dans le dossier du paquet de l'application). La clé est protégée par la protection des données de Windows (DPAPI) et ne fonctionne que pour votre utilisateur Windows.
- **Application Android :** ces copies sont conservées dans le stockage privé de l'application, que les autres applications ne peuvent pas lire et qui est exclu des sauvegardes. La clé est protégée par l'Android Keystore.
- **Application Mac :** ces copies sont conservées dans le dossier de l'application, dans la Bibliothèque (Library) de votre utilisateur (Application Support/app.yourpersonaldiary.mac). La clé est conservée comme un élément du trousseau de session (login keychain) de votre utilisateur Mac, nommé « Your Personal Diary offline key », et n'est jamais synchronisée avec iCloud Keychain ; elle est protégée par le mot de passe de session de votre Mac et seule l'application peut la lire. Une copie de votre compte utilisateur faite avec Migration Assistant ou Time Machine emporte cet élément, toujours protégé par ce mot de passe. Lorsque l'application sera distribuée avec la signature d'Apple, l'élément passera dans le trousseau qui reste uniquement sur ce Mac.
- **Application iPhone :** ces copies sont conservées dans le stockage privé de l'application, exclu de la sauvegarde iCloud. La clé est conservée dans le Keychain d'iOS, disponible uniquement sur cet appareil après qu'il a été déverrouillé une première fois, et supprimée quand vous vous déconnectez.
- **Site web :** le navigateur ne conserve, chiffrés, que les modifications pas encore envoyées, le registre des 7 derniers jours et les notes sur les modifications en conflit (voir plus bas), mais aucune copie de ce que vous avez lu ; la clé reste en mémoire et disparaît quand vous fermez la page.

Quand la connexion revient, l'application envoie les modifications que vous avez faites, dans l'ordre où vous les avez faites, chacune exactement une fois. Si la même entrée, habitude ou le même paramètre a aussi été modifié sur un autre appareil, la modification la plus récente est conservée et l'application vous le signale en une ligne ; l'autre version reste disponible sur cet appareil jusqu'à ce que vous fermiez la note.

Si l'application propose de déverrouiller avec le verrouillage d'écran de votre appareil (Windows Hello, Touch ID ou le mot de passe du Mac, Face ID / Touch ID ou le code de l'iPhone, ou le verrouillage d'écran ou l'empreinte digitale d'Android), la vérification est faite par le système d'exploitation. Rien concernant votre empreinte, votre visage ou votre code PIN n'arrive à l'application ni à nous. Les rappels d'habitudes des applications Android et iPhone sont programmés sur l'appareil lui-même ; aucun service de notifications push n'intervient.

Fichiers que vous créez vous-même : une **sauvegarde** est chiffrée avec un mot de passe ; un **export** (TXT, CSV, JSON ou PDF) est un fichier ordinaire et lisible. Vous choisissez où les enregistrer, et toute personne qui obtient un fichier exporté peut le lire.

## 6. Qui d'autre reçoit des données

Nous faisons appel à deux prestataires. Ils traitent les données uniquement pour notre compte, afin de faire fonctionner le service :

- **Fly.io, Inc.** (États-Unis) - hébergement du serveur à Francfort, en Allemagne. Ses systèmes contiennent les fichiers de journal chiffrés, les informations des comptes et les autres données de la section 2, et reçoivent des données de connexion comme les adresses IP. Fly.io étant une société américaine, elle peut accéder aux données depuis l'extérieur de l'Union européenne ; cela est couvert par ses conditions de traitement des données. Sa politique de confidentialité : `fly.io/legal/privacy-policy`.
- **Google (Gmail)** - envoie les messages de réinitialisation du mot de passe et les avis de sécurité. Google reçoit le message, votre adresse e-mail, ainsi que le prénom et le nom d'utilisateur qu'il contient. Un message ne contient jamais rien de votre journal. Politique de confidentialité de Google : `policies.google.com/privacy`.

Les boutiques d'applications traitent aussi des données selon leurs propres politiques de confidentialité quand vous téléchargez les applications : **Google Play** pour l'application Android, le **Microsoft Store** pour l'application Windows, et l'**App Store** et le **Mac App Store** (Apple) pour les applications iPhone et Mac (par exemple installations, notes et rapports de plantage collectés par leurs systèmes). Les applications ne contiennent aucun code d'elles ni de qui que ce soit d'autre qui leur enverrait des données.

Nous ne vendons, ne louons ni ne partageons vos données personnelles avec qui que ce soit d'autre. Nous ne communiquerions des données que si la loi l'exigeait.

## 7. Combien de temps nous conservons les données, et comment les supprimer

- Nous conservons votre compte et votre journal jusqu'à ce que vous les supprimiez. Les sessions prennent fin au bout de 12 heures, ou de 90 jours avec « Se souvenir de moi ». Les demandes de réinitialisation du mot de passe expirent au bout de 30 minutes. Les copies sur un appareil restent jusqu'à ce que vous vous déconnectiez sur cet appareil.
- **Supprimer votre compte dans l'application ou sur le site web :** connectez-vous, ouvrez **Paramètres - Supprimer le compte**, saisissez votre mot de passe et confirmez. Cela supprime immédiatement du serveur votre compte, votre journal, vos habitudes et vos paramètres, votre connexion sur tous les appareils et toute demande de réinitialisation du mot de passe, et supprime la copie hors ligne de l'appareil que vous utilisez. Les modifications encore en attente sur vos autres appareils ne pourront plus être envoyées et seront perdues.
- **Copies dans les sauvegardes du serveur :** l'hébergeur prend chaque jour un instantané du stockage du serveur. Les copies d'un compte supprimé dans ces instantanés sont effacées automatiquement dans un délai de 30 jours.
- **Archives chiffrées du serveur :** pour pouvoir se remettre d'un sinistre, l'exploitant crée environ une fois par mois une archive chiffrée du stockage du serveur ; le serveur ne garde que les 2 plus récentes, et l'exploitant garde au maximum les 3 plus récentes hors ligne, sur un disque qui n'est pas connecté à internet, si bien que les copies d'un compte supprimé en disparaissent à mesure que des archives plus récentes les remplacent, normalement dans un délai de trois mois.
- **Les entrées supprimées ou modifiées** disparaissent aussitôt de l'application, et leur ancien texte est effacé du fichier de votre journal sur le serveur lorsque la modification est enregistrée, un instant plus tard : le serveur écrase les données supprimées au lieu de seulement marquer l'espace comme libre. La version précédente du fichier, que le serveur conserve au cas où un enregistrement échouerait, est remplacée à l'enregistrement suivant. Le texte supprimé avant l'existence de cette protection est effacé la première fois que votre journal est ouvert après la mise à jour (par exemple quand vous vous connectez). Sur le serveur, les versions antérieures ne restent ensuite que dans les instantanés quotidiens du stockage, pendant 30 jours au plus, et, chiffrées, dans l'espace inutilisé de son disque jusqu'à ce que cet espace soit réutilisé ; les fichiers de sauvegarde que vous avez créés auparavant gardent le texte qu'ils contiennent. La suppression du compte efface le fichier entier.
- **Si vous ne pouvez pas vous connecter :** écrivez à [{{CONTACT_EMAIL}}](mailto:{{CONTACT_EMAIL}}) depuis l'adresse e-mail enregistrée dans votre compte. Nous confirmerons la demande et supprimerons le compte dans un délai de 30 jours. Tous les détails : [{{DELETE_URL}}]({{DELETE_URL}}).
- **Désinstaller l'application ne supprime pas votre compte.** Si c'est ce que vous voulez, supprimez-le d'abord dans les Paramètres. La déconnexion efface les copies et la clé de cet appareil ; s'il reste des modifications à envoyer, l'application vous le demande d'abord. Sous Windows, désinstaller la version téléchargée (fichier d'installation) conserve la copie chiffrée, sauf si vous choisissez de supprimer les données de l'application ; pour être sûr, déconnectez-vous d'abord. Sur un Mac, placer l'application dans la Corbeille conserve les copies chiffrées dans votre Bibliothèque (Library) et la clé dans votre trousseau jusqu'à ce que vous vous déconnectiez ou que vous les supprimiez ; déconnectez-vous d'abord. Supprimer l'application iPhone efface son stockage ; l'élément du Keychain est supprimé quand vous vous déconnectez - pour être sûr, déconnectez-vous d'abord.
- Pour l'instant, nous ne supprimons pas automatiquement les comptes inactifs. Si nous commençons à le faire, nous l'indiquerons ici avant que cela s'applique.

## 8. Mesures de sécurité

- HTTPS uniquement ; le serveur refuse les connexions qui ne passent pas par son adresse sécurisée.
- Limitation des tentatives de connexion et d'inscription. Après 10 mots de passe erronés, la connexion depuis ce réseau est bloquée pendant 15 minutes, et les tentatives suivantes sur le compte sont ralenties.
- Le journal se verrouille de lui-même après une période d'inactivité. Changer le mot de passe ou l'adresse e-mail et supprimer le compte nécessitent votre mot de passe.
- La clé du serveur est conservée en dehors des fichiers stockés, et seul l'exploitant peut administrer le serveur.
- Une personne qui peut exécuter des programmes sous votre utilisateur Windows ou Mac, ou qui a le contrôle total d'un téléphone rooté ou jailbreaké, pourrait lire la copie conservée pour « Se souvenir de moi ».

Aucun système ne peut promettre une sécurité parfaite. Choisissez un mot de passe solide que vous n'utilisez nulle part ailleurs, maintenez vos appareils à jour et gardez une sauvegarde.

## 9. Vos droits

Vous pouvez consulter, corriger, exporter et supprimer vos données vous-même : votre profil est dans les Paramètres, chaque entrée peut être modifiée ou supprimée, **Paramètres - Sauvegarde** et l'export créent une copie que vous pouvez emporter ailleurs, et **Supprimer le compte** efface tout. Vous pouvez aussi nous écrire pour demander une copie de vos données, leur rectification, leur effacement ou la limitation du traitement, ou pour vous y opposer, et vous pouvez retirer un consentement à tout moment. Nous répondons dans un délai de 30 jours. Vous avez aussi le droit d'introduire une réclamation auprès d'une autorité de protection des données - dans l'Union européenne, l'autorité de votre pays ; en Israël, l'Autorité de protection de la vie privée.

## 10. Enfants

Le service ne s'adresse pas aux enfants. Vous devez avoir au moins {{MINIMUM_AGE}} ans pour créer un compte. Nous ne collectons pas sciemment de données de personnes plus jeunes. Si vous pensez qu'un enfant plus jeune a créé un compte, écrivez-nous et nous le supprimerons.

## 11. Pas un outil médical

Les analyses de l'application décrivent des relations possibles dans vos propres entrées. Elles ne prouvent pas de lien de cause à effet et ne constituent pas un avis médical ou psychologique.

## 12. Modifications de cette politique

Quand le service ou cette politique change, nous mettons à jour cette page et la date d'entrée en vigueur en haut. Si un changement modifie ce que nous faisons de vos données, nous l'indiquerons sur cette page avant qu'il ne s'applique.

## 13. Contact

Questions sur la confidentialité ou sur vos données : [{{CONTACT_EMAIL}}](mailto:{{CONTACT_EMAIL}})

{{PUBLISHER_NAME}}
