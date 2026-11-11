---
title: Zásady ochrany osobních údajů - Your Personal Diary
description: Jak Your Personal Diary (aplikace pro Android, Windows, Mac a iPhone a web; aplikace pro iPhone, až bude zveřejněna) ukládá a chrání tvá data.
languages: Jazyky
otherPage: Jak smazat účet
---

# Zásady ochrany osobních údajů - Your Personal Diary

Platnost od: {{EFFECTIVE_DATE}}

## Stručně

- Your Personal Diary je jedna služba s pěti vstupy: **aplikace pro Android** (Google Play), **aplikace pro Windows** (Microsoft Store nebo instalační soubor), **aplikace pro Mac** (stažení z webu nebo Mac App Store), **aplikace pro iPhone** (App Store, až bude zveřejněna) a **web** [{{SITE_URL}}]({{SITE_URL}}). Všechny používají stejný server a stejný účet.
- Tvůj deník je uložen na našem serveru v souboru zašifrovaném klíčem odvozeným z tvého hesla. Ukládají se tam i údaje tvého účtu.
- Tvá data používáme jen k tomu, aby tvůj deník fungoval. Žádné reklamy, žádná analytika, žádné sledování a tvá data neprodáváme ani nesdílíme.
- Znej hranice: dokud jsi přihlášený, server má tvůj deník otevřený v paměti a provozovatel serveru by technicky mohl obnovit tvé heslo a deník si přečíst. Oddíl 4 to vysvětluje otevřeně.
- Účet i deník můžeš kdykoli smazat v **Nastavení - Smazání účtu**.

## 1. Kdo jsme

Službu provozuje {{PUBLISHER_NAME}} („my"), který odpovídá za tvé osobní údaje („správce"). Kontakt: [{{CONTACT_EMAIL}}](mailto:{{CONTACT_EMAIL}}).

Tyto zásady platí pro aplikaci pro Android, aplikaci pro Windows, aplikaci pro Mac, aplikaci pro iPhone (až bude zveřejněna) a web. Všechny zobrazují stejný deník a řídí se stejnými pravidly; kde se některá aplikace chová jinak, zásady to uvádějí.

## 2. Co ukládáme na serveru a kde

Server běží u poskytovatele hostingu Fly.io v jeho datovém centru ve **Frankfurtu v Německu (Evropská unie)**. Ukládá se na něm:

- **Údaje účtu:** tvé jméno, příjmení, uživatelské jméno a e-mailová adresa, ID účtu, jazyk, ve kterém aplikaci používáš, kdy byl účet vytvořen a kdy ses naposledy přihlásil. Při vytvoření účtu si také uchováváme záznam o tvém potvrzení, že sis tyto zásady a [Podmínky používání]({{TERMS_URL}}) přečetl a souhlasíš s nimi: čas potvrzení a data účinnosti verzí, které jsi potvrdil. Pokud změníš e-mailovou adresu, předchozí adresa a čas změny zůstanou u účtu, dokud adresu znovu nezměníš nebo účet nesmažeš. Aplikace tyto údaje nešifruje, protože je server potřebuje k přihlášení a k tomu, aby ti mohl psát; provozovatel je proto může vidět.
- **Tvé heslo:** neukládá se. Server uchovává jen hodnotu z něj odvozenou (scrypt), pomocí které heslo ověří.
- **Tvůj deník:** záznamy (text a nepovinná pole nálada, emoce, energie, stres, spánek, pohybová aktivita, události, lidé, místo, poznámky a štítky), návyky a jejich záznamy a tvá nastavení. Každý účet má vlastní zašifrovaný soubor deníku.
- **Přihlašovací relace:** pro každé zařízení, kde jsi přihlášený: druh zařízení („Počítač", „Telefon" nebo „Prohlížeč"), kdy relace začala, kdy byla naposledy použita a kdy skončí. Samotný přihlašovací token se ukládá jen jako hash. Se „Zapamatovat si mě" obsahuje relace také klíč tvého deníku, zašifrovaný klíčem serveru (oddíl 4).
- **Žádosti o obnovení hesla:** hash odkazu a kódu, platné 30 minut a použitelné jednou.
- **Klíč k offline kopiím** na tvých zařízeních (oddíl 5), uložený uvnitř tvého zašifrovaného deníku.
- **Nastavení odesílání e-mailů provozovatele** (vlastní účet Gmail provozovatele, jehož heslo je uloženo zašifrovaně). Neobsahuje nic o tobě.
- **Technický protokol** událostí spuštění a chyb. Neobsahuje obsah deníku, e-mailové adresy ani IP adresy.

**Prohlídka** („Přeskočit - chci se jen porozhlédnout" v aplikaci pro Android) vytvoří dočasný deník hosta s ukázkovými daty. Existuje jen v paměti serveru, po 30 minutách sám skončí a nikdy se neukládá.

Jako u každého webu dostávají server a poskytovatel hostingu IP adresu tvého zařízení, když se připojí. Server ji používá jen ve své paměti: k omezení počtu požadavků, které mohou přijít z jedné sítě (přihlášení, registrace a ostatní funkce účtu, obnovení hesla, prohlídka a zálohy), a pro blokaci přihlášení. Tato počítadla pokrývají nejvýše posledních 24 hodin a adresa se nikdy nezapisuje do protokolu ani do úložiště.

## 3. Jak tvá data používáme

- **K poskytování služby:** přihlašování, ukládání deníku a jeho shoda na všech tvých zařízeních, vyhledávání, statistiky a postřehy o tvých vlastních záznamech, zálohy, exporty a připomínky. Na vyhledávací dotazy se odpovídá na serveru a neukládají se tam.
- **E-mail:** jen pro tvé zprávy k obnovení hesla a pro bezpečnostní upozornění (tvé heslo bylo změněno pomocí zprávy k obnovení; e-mailová adresa tvého účtu byla změněna). Píší se v jazyce uloženém u údajů tvého účtu; server kvůli nim neotevírá tvůj deník. Žádné zpravodaje a žádný marketing.
- **Nikdy:** žádné reklamy, žádné analytické ani sledovací nástroje, žádné profilování, žádný prodej dat a žádné použití tvého deníku k trénování jakékoli AI.

Právní základ (pro uživatele v Evropské unii a obdobné zákony): tvá data zpracováváme, abychom poskytli službu, ke které ses zaregistroval (plnění smlouvy, čl. 6 odst. 1 písm. b) GDPR), a abychom ji udrželi v bezpečí (náš oprávněný zájem, čl. 6 odst. 1 písm. f): limity pokusů, blokace, technický protokol). Tvůj deník může obsahovat citlivé informace, například o tvém zdraví nebo přesvědčení, pokud se je rozhodneš zapsat. Zpracováváme je jen proto, abychom ti je uchovali a zobrazili, protože jsi nás o to požádal tím, že jsi je zapsal (tvůj výslovný souhlas, čl. 9 odst. 2 písm. a)); kdykoli je můžeš odstranit úpravou nebo smazáním záznamů (oddíl 7 uvádí, jak se starý text maže).

## 4. Jak je tvůj deník chráněn - a před čím tato ochrana nechrání

Co ho chrání:

- Soubor deníku každého účtu je šifrován pomocí AES-256-GCM. Klíč se odvozuje z tvého hesla pomocí scrypt. Každá změna souboru se odhalí.
- Disky poskytovatele hostingu jsou také šifrované (šifrování v klidu).
- Všechna spojení mezi tvými zařízeními a serverem používají HTTPS (TLS).

Co bys měl vědět:

- **Dokud jsi přihlášený, je tvůj deník v paměti serveru dešifrovaný**, aby ho server mohl zobrazovat, prohledávat a analyzovat. Nejde o šifrování „end-to-end".
- **Provozovatel může technicky obnovit jakékoli heslo.** Aby „Zapomenuté heslo?" fungovalo bez ztráty deníku, uchovává server pro každý účet kopii klíče deníku zašifrovanou klíčem serveru („klíč pro obnovení"). Klíč serveru je uložen jako tajemství hostingové platformy mimo uložené soubory, takže samotná kopie souborů nic neotevře. Přesto ten, kdo ovládá server a jeho tajemství - provozovatel a v zásadě i poskytovatel hostingu -, by mohl obnovit heslo libovolného účtu a přečíst si jeho deník, aniž by heslo znal. Zavazujeme se, že to neuděláme. Nemáme k tomu žádný nástroj a naše správcovské nástroje nikdy deník neotevírají. Pokud se na tento závazek nechceš spoléhat, neukládej do služby nic, co bys nechtěl, aby četl někdo jiný.
- **Žádost o obnovení hesla tvůj deník neotevře.** Zpráva k obnovení a bezpečnostní upozornění se píší v jazyce uloženém u údajů tvého účtu (oddíl 2), takže žádost - od tebe nebo od kohokoli, kdo zadá tvou e-mailovou adresu - nechá tvůj deník zavřený. Teprve když se obnovení dokončí odkazem nebo kódem ze zprávy, server otevře tvůj deník klíčem pro obnovení, aby ho znovu zašifroval tvým novým heslem.

## 5. Co se ukládá na tvém zařízení

Na každém zařízení, kde službu používáš:

- tvůj přihlašovací token (abys zůstal přihlášený), poslední uživatelské jméno, nastavení jazyka a zobrazení a tvé nedávné vyhledávací dotazy (smažou se při odhlášení).

**Bez připojení.** Když se aplikace nemůže spojit se serverem, funguje dál: co napíšeš, se uloží na zařízení v zašifrované podobě a po obnovení připojení se automaticky nahraje na server, i když byla aplikace mezitím zavřená. V aplikacích pro Windows, Mac, Android a iPhone, pokud jsi zvolil „Zapamatovat si mě", aplikace uchovává také zašifrovanou kopii toho, co ti nedávno ukázala (nedávné záznamy, návyky, dnešní data, měsíc v kalendáři a tvá nastavení), abys to mohl číst bez připojení; jinak tato kopie existuje jen v paměti, dokud je aplikace otevřená. Klíč k těmto kopiím uchovává server uvnitř tvého zašifrovaného deníku; se „Zapamatovat si mě" ho aplikace pro Windows, Mac, Android a iPhone ukládají i na zařízení, chráněný ochranou dat Windows nebo pomocí Keychain v macOS, Android Keystore či Keychain v iOS, aby se aplikace mohla otevřít bez připojení. Tvé heslo a klíč pro obnovení se na zařízení nikdy neukládají. V aplikacích, které tento klíč se „Zapamatovat si mě" ukládají na zařízení, uchovává aplikace také jeho kopii zašifrovanou klíčem odvozeným z tvého hesla, abys mohl aplikaci odemknout bez připojení zadáním hesla; samotné heslo se neukládá a tato kopie se maže spolu s klíčem - když se odhlásíš, když přihlášení vyprší nebo když je účet smazán. Kdo má kopii dat tohoto zařízení, mohl by se pokusit uhodnout tvé heslo vůči této kopii, aniž by potřeboval tvůj uživatelský účet v zařízení, přičemž každý pokus stojí stejně jako vůči serveru, ale počet pokusů není omezen; chrání ji silné heslo. Aby se každá změna nahrála právě jednou, aplikace uchovává také, zašifrovaný, záznam změn nahraných za posledních 7 dní.

- **Aplikace pro Windows:** tyto kopie jsou uložené v datových složkách aplikace ve tvém uživatelském profilu Windows (u verze z Microsoft Store ve vlastní složce balíčku aplikace). Klíč je chráněn ochranou dat Windows (DPAPI) a funguje jen pro tvého uživatele Windows.
- **Aplikace pro Android:** tyto kopie jsou uložené v soukromém úložišti aplikace, které jiné aplikace nemohou číst a které je vyloučené ze záloh. Klíč je chráněn pomocí Android Keystore.
- **Aplikace pro Mac:** tyto kopie jsou uložené ve složce aplikace v Knihovně (Library) tvého uživatele (Application Support/app.yourpersonaldiary.mac). Klíč je uložen jako položka přihlašovací klíčenky (login keychain) tvého uživatele Macu s názvem „Your Personal Diary offline key" a nikdy se nesynchronizuje s iCloud Keychain; chrání ho tvé přihlašovací heslo k Macu a číst ho může jen aplikace. Kopie tvého uživatelského účtu vytvořená pomocí Migration Assistant nebo Time Machine tuto položku obsahuje, stále chráněnou tímto heslem. Až bude aplikace distribuována s podpisem Apple, položka se přesune do klíčenky, která zůstává jen na tomto Macu.
- **Aplikace pro iPhone:** tyto kopie jsou uložené v soukromém úložišti aplikace, vyloučeném ze zálohy na iCloud. Klíč je uložen v Keychain systému iOS, je dostupný jen na tomto zařízení poté, co bylo jednou odemčeno, a při odhlášení se smaže.
- **Web:** v prohlížeči se ukládají, zašifrované, jen dosud nenahrané změny, záznam za posledních 7 dní a poznámky o konfliktních změnách (viz níže), ale žádná kopie toho, co jsi četl; klíč zůstává v paměti a zmizí, když stránku zavřeš.

Po obnovení připojení aplikace nahraje tvé změny v pořadí, v jakém jsi je provedl, každou právě jednou. Pokud byl stejný záznam, návyk nebo nastavení změněn i na jiném zařízení, ponechá se novější změna a aplikace ti to sdělí jedním řádkem; druhá verze ti zůstane na tomto zařízení k dispozici, dokud upozornění nezavřeš.

Pokud aplikace nabídne odemknutí zámkem obrazovky zařízení (Windows Hello, Touch ID nebo heslo Macu, Face ID / Touch ID nebo kód iPhonu, případně zámek obrazovky či otisk prstu v Androidu), ověření provádí operační systém. Nic o tvém otisku prstu, obličeji ani PINu se nedostane do aplikace ani k nám. Připomínky návyků v aplikacích pro Android a iPhone se plánují přímo v zařízení; nepoužívá se žádná služba push oznámení.

Soubory, které si vytvoříš sám: **záloha** je zašifrovaná heslem; **export** (TXT, CSV, JSON nebo PDF) je obyčejný čitelný soubor. Ty rozhoduješ, kam je uložíš, a kdokoli získá soubor exportu, může si ho přečíst.

## 6. Kdo další data dostává

Využíváme dva poskytovatele služeb. Data zpracovávají jen naším jménem, aby služba fungovala:

- **Fly.io, Inc.** (Spojené státy) - hosting serveru ve Frankfurtu v Německu. Její systémy uchovávají zašifrované soubory deníků, údaje účtů a další data z oddílu 2 a dostávají údaje o připojení, například IP adresy. Protože je Fly.io americká společnost, může k datům přistupovat i mimo Evropskou unii; to pokrývají její podmínky zpracování dat. Její zásady ochrany soukromí: `fly.io/legal/privacy-policy`.
- **Google (Gmail)** - odesílá zprávy k obnovení hesla a bezpečnostní upozornění. Google dostává zprávu, tvou e-mailovou adresu a jméno a uživatelské jméno, které obsahuje. Zpráva nikdy neobsahuje nic z tvého deníku. Zásady ochrany soukromí Google: `policies.google.com/privacy`.

Obchody s aplikacemi také zpracovávají data podle svých vlastních zásad ochrany soukromí, když si aplikace stahuješ: **Google Play** u aplikace pro Android, **Microsoft Store** u aplikace pro Windows a **App Store** a **Mac App Store** (Apple) u aplikací pro iPhone a Mac (například instalace, hodnocení a hlášení o pádech, které jejich systémy shromažďují). Aplikace neobsahují jejich kód ani kód nikoho jiného, který by jim posílal data.

Tvé osobní údaje neprodáváme, nepronajímáme ani je s nikým dalším nesdílíme. Data bychom poskytli jen tehdy, kdyby to vyžadoval zákon.

## 7. Jak dlouho data uchováváme a jak je smazat

- Tvůj účet a deník uchováváme, dokud je nesmažeš. Přihlašovací relace končí po 12 hodinách, se „Zapamatovat si mě" po 90 dnech. Žádosti o obnovení hesla vyprší po 30 minutách. Kopie na zařízení zůstávají, dokud se na něm neodhlásíš.
- **Smazání účtu v aplikaci nebo na webu:** přihlas se, otevři **Nastavení - Smazání účtu**, zadej heslo a potvrď. Tím se ze serveru okamžitě smaže tvůj účet, deník, návyky a nastavení, tvé přihlášení na všech zařízeních a všechny žádosti o obnovení hesla a smaže se i offline kopie na zařízení, které používáš. Změny, které ještě čekají na tvých dalších zařízeních, už pak nelze nahrát a ztratí se.
- **Kopie v zálohách serveru:** poskytovatel hostingu pořizuje každý den snímek úložiště serveru. Kopie smazaného účtu v těchto snímcích se automaticky smažou do 30 dnů.
- **Šifrované archivy serveru:** aby se dalo zotavit z havárie, vytváří provozovatel přibližně jednou za měsíc šifrovaný archiv úložiště serveru; server uchovává jen 2 nejnovější a provozovatel uchovává offline nejvýše 3 nejnovější, na disku, který není připojený k internetu, takže kopie smazaného účtu z nich zmizí, jakmile je nahradí novější archivy, obvykle do tří měsíců.
- **Smazané nebo změněné záznamy** z aplikace hned zmizí a jejich starý text se ze souboru tvého deníku na serveru smaže, když se změna uloží, o okamžik později: server smazaná data přepíše, místo aby jen označil místo jako volné. Předchozí verze souboru, kterou server uchovává pro případ, že by se uložení nezdařilo, se nahradí při dalším uložení. Text smazaný dříve, než tato ochrana existovala, se smaže, když se tvůj deník po aktualizaci poprvé otevře (například když se přihlásíš). Na serveru pak dřívější verze zůstávají jen v denních snímcích úložiště, nejvýše 30 dní, a zašifrované v nevyužitém místě jeho disku, dokud se toto místo znovu nepoužije; soubory záloh, které jsi vytvořil dříve, si text, který obsahují, ponechají. Smazáním účtu se smaže celý soubor.
- **Pokud se nemůžeš přihlásit:** napiš na [{{CONTACT_EMAIL}}](mailto:{{CONTACT_EMAIL}}) z e-mailové adresy zaregistrované v tvém účtu. Žádost potvrdíme a účet smažeme do 30 dnů. Všechny podrobnosti: [{{DELETE_URL}}]({{DELETE_URL}}).
- **Odinstalování aplikace účet nesmaže.** Pokud to chceš, nejdřív ho smaž v Nastavení. Odhlášení smaže kopie a klíč z daného zařízení; pokud ještě čekají změny na nahrání, aplikace se nejdřív zeptá. Ve Windows zůstane po odinstalování stažené verze (z instalačního souboru) zašifrovaná kopie, pokud nezvolíš smazání dat aplikace; pro jistotu se nejdřív odhlas. Na Macu zůstanou po přesunutí aplikace do Koše zašifrované kopie ve tvé Knihovně (Library) a klíč ve tvé klíčence, dokud se neodhlásíš nebo je nesmažeš; nejdřív se odhlas. Smazání aplikace pro iPhone odstraní její úložiště; položka v Keychain se smaže při odhlášení - pro jistotu se nejdřív odhlas.
- Neaktivní účty zatím automaticky nemažeme. Pokud s tím začneme, napíšeme to sem dříve, než to začne platit.

## 8. Bezpečnostní opatření

- Jen HTTPS; server odmítá spojení, která nepřicházejí přes jeho zabezpečenou adresu.
- Limity pokusů o přihlášení a registraci. Po 10 špatných heslech se přihlašování z dané sítě na 15 minut zablokuje a další pokusy o přihlášení k účtu se zpomalí.
- Deník se po určité době nečinnosti sám zamkne. Změna hesla nebo e-mailové adresy a smazání účtu vyžadují tvé heslo.
- Klíč serveru je uložen mimo uložené soubory a server může spravovat jen provozovatel.
- Kdo může spouštět programy jako tvůj uživatel Windows nebo Macu, nebo kdo má plnou kontrolu nad telefonem s rootem nebo jailbreakem, by mohl přečíst kopii uloženou pro „Zapamatovat si mě".

Žádný systém nemůže slíbit dokonalé zabezpečení. Zvol silné heslo, které jinde nepoužíváš, udržuj svá zařízení aktuální a měj zálohu.

## 9. Tvá práva

Svá data můžeš sám zobrazit, opravit, exportovat a smazat: tvůj profil je v Nastavení, každý záznam lze upravit nebo smazat, **Nastavení - Záloha** a export vytvoří kopii, kterou si můžeš odnést jinam, a **Smazání účtu** odstraní vše. Můžeš nám také napsat a požádat o kopii svých údajů, jejich opravu, výmaz nebo omezení zpracování, případně vznést námitku, a souhlas můžeš kdykoli odvolat. Odpovídáme do 30 dnů. Máš také právo podat stížnost u úřadu pro ochranu osobních údajů - v Evropské unii u úřadu své země, v Izraeli u Úřadu pro ochranu soukromí.

## 10. Děti

Služba není určena dětem. K vytvoření účtu ti musí být alespoň {{MINIMUM_AGE}} let. Vědomě neshromažďujeme údaje mladších osob. Pokud si myslíš, že účet vytvořilo mladší dítě, napiš nám a účet smažeme.

## 11. Nejde o zdravotnický nástroj

Postřehy v aplikaci popisují možné souvislosti ve tvých vlastních záznamech. Neprokazují příčinu a následek a nejsou lékařskou ani psychologickou radou.

## 12. Změny těchto zásad

Když se služba nebo tyto zásady změní, aktualizujeme tuto stránku a datum platnosti nahoře. Pokud změna ovlivní, co s tvými daty děláme, uvedeme to na této stránce dříve, než začne platit.

## 13. Kontakt

Dotazy k ochraně soukromí nebo k tvým datům: [{{CONTACT_EMAIL}}](mailto:{{CONTACT_EMAIL}})

{{PUBLISHER_NAME}}
