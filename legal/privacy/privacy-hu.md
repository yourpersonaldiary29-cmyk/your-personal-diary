---
title: Adatvédelmi irányelvek - Your Personal Diary
description: Hogyan tárolja és védi az adataidat a Your Personal Diary (az Android-, a Windows-, a Mac- és az iPhone-alkalmazás, valamint a weboldal; az iPhone-alkalmazás, amikor megjelenik).
languages: Nyelvek
otherPage: Hogyan törölheted a fiókodat
---

# Adatvédelmi irányelvek - Your Personal Diary

Hatályos: {{EFFECTIVE_DATE}}

## Röviden

- A Your Personal Diary egyetlen szolgáltatás öt bejárattal: az **Android-alkalmazás** (Google Play), a **Windows-alkalmazás** (Microsoft Store vagy telepítőfájl), a **Mac-alkalmazás** (letöltés vagy a Mac App Store), az **iPhone-alkalmazás** (App Store, amikor megjelenik) és a **weboldal** [{{SITE_URL}}]({{SITE_URL}}). Mindegyik ugyanazt a szervert és ugyanazt a fiókot használja.
- A naplódat a szerverünkön tároljuk, egy olyan fájlban, amelyet a jelszavadból származtatott kulccsal titkosítunk. A fiókod adatai is ott vannak.
- Az adataidat csak arra használjuk, hogy működtessük neked a naplódat. Nincs hirdetés, nincs analitika, nincs követés, és nem adjuk el és nem osztjuk meg az adataidat.
- Ismerd a korlátokat: amíg be vagy jelentkezve, a szerver a memóriájában nyitva tartja a naplódat, és a szerver üzemeltetője technikailag vissza tudná állítani a jelszavadat, és el tudná olvasni a naplódat. A 4. szakasz ezt őszintén elmagyarázza.
- A fiókodat és a naplódat bármikor törölheted a **Beállítások - Fiók törlése** menüpontban.

## 1. Kik vagyunk

A szolgáltatást {{PUBLISHER_NAME}} („mi") üzemelteti, aki felel a személyes adataidért (az „adatkezelő"). Kapcsolat: [{{CONTACT_EMAIL}}](mailto:{{CONTACT_EMAIL}}).

Ezek az irányelvek az Android-alkalmazásra, a Windows-alkalmazásra, a Mac-alkalmazásra, az iPhone-alkalmazásra (amikor megjelenik) és a weboldalra vonatkoznak. Mindegyik ugyanazt a naplót mutatja, és ugyanazokat a szabályokat követi; ahol egy alkalmazás másként működik, azt itt jelezzük.

## 2. Mit tárolunk a szerveren, és hol

A szerver a Fly.io tárhelyszolgáltatónál fut, annak **Frankfurtban (Németország, Európai Unió)** lévő adatközpontjában. A következőket tárolja:

- **Fiókadatok:** a keresztneved, vezetékneved, felhasználóneved és e-mail-címed, egy fiókazonosító, a nyelv, amelyen az alkalmazást használod, a fiók létrehozásának ideje és az utolsó bejelentkezésed ideje. A fiók létrehozásakor azt is rögzítjük, mikor erősítetted meg, hogy elolvastad ezeket az irányelveket és a [felhasználási feltételeket]({{TERMS_URL}}), és elfogadod őket, valamint a megerősített változatok hatálybalépésének dátumát. Ha megváltoztatod az e-mail-címedet, az előző cím és a változtatás ideje a fióknál marad, amíg újra meg nem változtatod a címet, vagy nem törlöd a fiókot. Ezeket az adatokat az alkalmazás nem titkosítja, mert a szervernek szüksége van rájuk a bejelentkezéshez és ahhoz, hogy írjon neked, ezért az üzemeltető láthatja őket.
- **A jelszavad:** nem tároljuk. A szerver csak egy belőle származtatott értéket (scrypt) őriz meg, amellyel ellenőrizni tudja.
- **A naplód:** bejegyzések (szöveg és a nem kötelező mezők: hangulat, érzelmek, energia, stressz, alvás, testmozgás, események, emberek, hely, jegyzetek és címkék), a szokások és azok bejegyzései, valamint a beállításaid. Minden fióknak saját titkosított naplófájlja van.
- **Bejelentkezési munkamenetek:** minden eszközre, ahol be vagy jelentkezve: az eszköz típusa („Számítógép", „Telefon" vagy „Böngésző"), mikor kezdődött a munkamenet, mikor használták utoljára, és mikor ér véget. Magát a bejelentkezési tokent csak hash-ként tároljuk. Az „Emlékezz rám" esetén a munkamenet a naplód kulcsát is tartalmazza, a szerver kulcsával titkosítva (4. szakasz).
- **Jelszó-visszaállítási kérések:** a visszaállító link és kód hash-e, 30 percig érvényes és egyszer használható.
- **Az eszközeiden lévő offline másolatok kulcsa** (5. szakasz), a titkosított naplódban tárolva.
- **Az üzemeltető e-mail-küldési beállításai** (az üzemeltető saját Gmail-fiókja, a jelszava titkosítva tárolva). Semmit sem tartalmaznak rólad.
- **Technikai napló** az indítási eseményekről és a hibákról. Nem tartalmaz naplótartalmat, e-mail-címet és IP-címet.

**A bemutató** („Kihagyás - csak körülnéznék" az Android-alkalmazásban) egy ideiglenes vendégnaplót hoz létre mintaadatokkal. Csak a szerver memóriájában létezik, 30 perc után magától véget ér, és soha nem tároljuk.

Mint minden weboldalnál, a szerver és a tárhelyszolgáltató megkapja az eszközöd IP-címét, amikor csatlakozik. A szerver csak a saját memóriájában használja: annak korlátozására, hogy egy hálózatról hány kérés érkezhet (bejelentkezés, regisztráció és a fiók többi funkciója, jelszó-visszaállítás, a bemutató és a biztonsági mentések), valamint a bejelentkezés zárolására. Ezek a számlálók legfeljebb az utolsó 24 órát fedik le, és a címet soha nem írja be sem a naplójába, sem a tárhelyre.

## 3. Hogyan használjuk az adataidat

- **A szolgáltatás nyújtására:** bejelentkezés, a napló tárolása és összehangolása minden eszközödön, keresés, statisztikák és megállapítások a saját bejegyzéseidről, biztonsági mentések, exportálás és emlékeztetők. A keresési kérdésekre a szerver válaszol, és nem tárolja őket.
- **E-mail:** csak a jelszó-visszaállító üzeneteidhez és biztonsági értesítésekhez (a jelszavadat egy visszaállító üzenettel megváltoztatták; a fiókod e-mail-címét megváltoztatták). Ezek a fiókadataidnál tárolt nyelven készülnek; a szerver ehhez nem nyitja meg a naplódat. Nincs hírlevél és nincs marketing.
- **Soha:** nincs hirdetés, nincsenek analitikai vagy követő eszközök, nincs profilalkotás, nincs adateladás, és a naplódat nem használjuk semmilyen MI tanítására.

Jogalap (az Európai Unióban élő felhasználók és hasonló jogszabályok esetén): az adataidat azért kezeljük, hogy nyújtsuk a szolgáltatást, amelyre regisztráltál (szerződés teljesítése, a GDPR 6. cikk (1) bekezdés b) pontja), és hogy biztonságban tartsuk (jogos érdekünk, 6. cikk (1) bekezdés f) pont: kísérletek korlátozása, zárolások, technikai napló). A naplód érzékeny adatokat is tartalmazhat, például az egészségedről vagy a meggyőződésedről, ha úgy döntesz, hogy leírod őket. Ezeket csak azért kezeljük, hogy megőrizzük és megmutassuk neked, mert a leírásukkal erre kértél (kifejezett hozzájárulásod, 9. cikk (2) bekezdés a) pont); bármikor eltávolíthatod őket a bejegyzések szerkesztésével vagy törlésével (a 7. szakasz leírja, hogyan törlődik a régi szöveg).

## 4. Hogyan védjük a naplódat - és mi ellen nem véd ez a védelem

Ami védi:

- Minden fiók naplófájlja AES-256-GCM titkosítással védett. A kulcsot scrypt segítségével származtatjuk a jelszavadból. A fájl bármilyen módosítása kiderül.
- A tárhelyszolgáltató lemezei is titkosítottak (tárolt adatok titkosítása).
- Az eszközeid és a szerver közötti minden kapcsolat HTTPS-t (TLS) használ.

Amit tudnod kell:

- **Amíg be vagy jelentkezve, a naplód visszafejtve van a szerver memóriájában**, hogy a szerver meg tudja jeleníteni, keresni tudjon benne, és elemezni tudja neked. Ez nem „végponttól végpontig" tartó titkosítás.
- **Az üzemeltető technikailag bármelyik jelszót vissza tudja állítani.** Hogy az „Elfelejtetted a jelszavad?" működjön a napló elvesztése nélkül, a szerver minden fiókhoz megőrzi a naplókulcs egy másolatát, a szerver kulcsával titkosítva (ez a „helyreállító kulcs"). A szerver kulcsát a tárhelyplatform titkaként, a tárolt fájloktól elkülönítve őrizzük, így a fájlok másolata önmagában semmit sem nyit meg. Ennek ellenére aki a szervert és annak titkait irányítja - az üzemeltető és elvileg a tárhelyszolgáltató -, bármelyik fiók jelszavát visszaállíthatná, és elolvashatná a naplóját a jelszó ismerete nélkül. Vállaljuk, hogy ezt nem tesszük. Nincs erre eszközünk, és az adminisztrációs eszközeink soha nem nyitnak meg naplót. Ha nem szeretnél erre az ígéretre hagyatkozni, ne tárolj a szolgáltatásban semmit, amit nem szeretnél, hogy más elolvasson.
- **A jelszó-visszaállítási kérés nem nyitja meg a naplódat.** A visszaállító üzenet és a biztonsági értesítések a fiókadataidnál tárolt nyelven készülnek (2. szakasz), így egy kérés - akár te küldöd, akár bárki, aki beírja az e-mail-címedet - zárva hagyja a naplódat. A szerver csak akkor nyitja meg a naplódat a helyreállító kulccsal, amikor a visszaállítást az üzenetben kapott linkkel vagy kóddal befejezik, hogy az új jelszavaddal újra titkosítsa.

## 5. Mit tárolunk az eszközödön

Minden eszközön, ahol a szolgáltatást használod:

- a bejelentkezési tokened (hogy bejelentkezve maradj), az utolsó felhasználónév, a nyelvi és megjelenítési beállításaid, valamint a legutóbbi keresési kérdéseid (kijelentkezéskor törlődnek).

**Kapcsolat nélkül.** Ha az alkalmazás nem éri el a szervert, tovább működik: amit írsz, titkosítva az eszközödre kerül, és a kapcsolat visszatérésekor automatikusan feltöltődik a szerverre, akkor is, ha közben bezártad az alkalmazást. A Windows-, a Mac-, az Android- és az iPhone-alkalmazásban, ha az „Emlékezz rám" lehetőséget választottad, az alkalmazás titkosított másolatot is őriz arról, amit legutóbb megmutatott (legutóbbi bejegyzések, szokások, a mai adatok, a naptár hónapja és a beállításaid), hogy kapcsolat nélkül is elolvashasd; különben ez a másolat csak a memóriában létezik, amíg az alkalmazás nyitva van. Ezeknek a másolatoknak a kulcsát a szerver a titkosított naplódban őrzi; az „Emlékezz rám" esetén a Windows-, a Mac-, az Android- és az iPhone-alkalmazás az eszközön is tárolja, a Windows adatvédelmével, a macOS Keychainnel, az Android Keystore-ral vagy az iOS Keychainnel védve, hogy az alkalmazás kapcsolat nélkül is megnyíljon. A jelszavadat és a helyreállító kulcsodat soha nem tároljuk az eszközön. Azokban az alkalmazásokban, amelyek az „Emlékezz rám" esetén ezt a kulcsot az eszközön tárolják, az alkalmazás egy másolatot is őriz róla, a jelszavadból származtatott kulccsal titkosítva, hogy kapcsolat nélkül, a jelszavad beírásával is feloldhasd az alkalmazást; magát a jelszót nem tároljuk, és ez a másolat a kulccsal együtt törlődik - amikor kijelentkezel, amikor a bejelentkezés lejár, vagy amikor a fiók törlődik. Aki másolatot szerez ennek az eszköznek az adatairól, megpróbálhatja kitalálni a jelszavadat ezzel a másolattal szemben, az eszköz felhasználói fiókja nélkül is; minden egyes próbálkozás ugyanannyi számítást igényel, mint a szerverrel szemben, de a próbálkozások száma nincs korlátozva - ez ellen az erős jelszó véd. Hogy minden módosítás pontosan egyszer töltődjön fel, az alkalmazás titkosítva nyilvántartást is őriz az utolsó 7 napban feltöltött módosításokról.

- **Windows-alkalmazás:** ezek a másolatok az alkalmazás adatmappáiban vannak a Windows-felhasználói profilodon belül (a Microsoft Store-os verziónál az alkalmazás saját csomagmappájában). A kulcsot a Windows adatvédelme (DPAPI) védi, és csak a te Windows-felhasználódnak működik.
- **Android-alkalmazás:** ezek a másolatok az alkalmazás privát tárhelyén vannak, amelyet más alkalmazások nem tudnak olvasni, és amely ki van zárva a biztonsági mentésekből. A kulcsot az Android Keystore védi.
- **Mac-alkalmazás:** ezek a másolatok az alkalmazás mappájában vannak a felhasználói Library (Könyvtár) mappádon belül (Application Support/app.yourpersonaldiary.mac). A kulcsot a Mac-felhasználód bejelentkezési kulcskarikája (login keychain) őrzi egy „Your Personal Diary offline key" nevű elemként, amely soha nem szinkronizálódik az iCloud Keychainbe; a Mac bejelentkezési jelszavad védi, és csak az alkalmazás olvashatja. A felhasználói fiókodról készült Migration Assistant- vagy Time Machine-másolat ezt az elemet is átviszi, továbbra is ugyanazzal a jelszóval védve. Amint az alkalmazást az Apple aláírásával terjesztik, az elem abba a kulcskarikába kerül át, amely csak ezen a Macen marad.
- **iPhone-alkalmazás:** ezek a másolatok az alkalmazás privát tárhelyén vannak, kizárva az iCloud-mentésből. A kulcsot az iOS Keychain őrzi: csak ezen az eszközön érhető el, miután az eszközt egyszer feloldották, és kijelentkezéskor törlődik.
- **Weboldal:** a böngészőben titkosítva csak a még fel nem töltött módosítások, az utolsó 7 nap nyilvántartása és az ütköző módosításokról szóló értesítések (lásd lent) maradnak meg, de semmilyen másolat arról, amit olvastál; a kulcs a memóriában marad, és eltűnik, amikor bezárod az oldalt.

Amikor visszatér a kapcsolat, az alkalmazás feltölti a módosításaidat, abban a sorrendben, ahogy végezted őket, mindegyiket pontosan egyszer. Ha ugyanazt a bejegyzést, szokást vagy beállítást egy másik eszközön is módosították, az újabb módosítás marad meg, és az alkalmazás egy sorban jelzi ezt; a másik változat ezen az eszközön elérhető marad, amíg be nem zárod az értesítést.

Ha az alkalmazás felajánlja a feloldást az eszköz képernyőzárával (Windows Hello, Touch ID vagy a Mac jelszava, Face ID / Touch ID vagy az iPhone jelkódja, vagy Androidon a képernyőzár vagy az ujjlenyomat), az ellenőrzést az operációs rendszer végzi. Az ujjlenyomatodról, arcodról vagy PIN-kódodról semmi sem jut el az alkalmazáshoz vagy hozzánk. Az Android- és az iPhone-alkalmazás szokás-emlékeztetőit maga az eszköz ütemezi; semmilyen push-szolgáltatás nem vesz részt benne.

A saját magad által létrehozott fájlok: a **biztonsági mentés** jelszóval titkosított; az **exportálás** (TXT, CSV, JSON vagy PDF) közönséges, olvasható fájl. Te döntöd el, hová mented őket, és bárki, aki hozzájut egy exportált fájlhoz, elolvashatja.

## 6. Ki kap még adatokat

Két szolgáltatót veszünk igénybe. Az adatokat kizárólag a nevünkben kezelik, a szolgáltatás működtetéséhez:

- **Fly.io, Inc.** (Egyesült Államok) - a szerver tárhelye Frankfurtban, Németországban. Rendszerei tárolják a titkosított naplófájlokat, a fiókadatokat és a 2. szakasz többi adatát, és kapcsolati adatokat, például IP-címeket kapnak. Mivel a Fly.io amerikai cég, az Európai Unión kívülről is hozzáférhet az adatokhoz; ezt az adatkezelési feltételei szabályozzák. Adatvédelmi irányelvei: `fly.io/legal/privacy-policy`.
- **Google (Gmail)** - elküldi a jelszó-visszaállító üzeneteket és a biztonsági értesítéseket. A Google megkapja az üzenetet, az e-mail-címedet, valamint a benne szereplő keresztnevet és felhasználónevet. Egy üzenet soha nem tartalmaz semmit a naplódból. A Google adatvédelmi irányelvei: `policies.google.com/privacy`.

Az alkalmazásboltok is kezelnek adatokat a saját adatvédelmi irányelveik szerint, amikor letöltöd az alkalmazásokat: a **Google Play** az Android-alkalmazásnál, a **Microsoft Store** a Windows-alkalmazásnál, az **App Store** és a **Mac App Store** (Apple) pedig az iPhone- és a Mac-alkalmazásnál (például telepítések, értékelések és összeomlás-jelentések, amelyeket a rendszereik gyűjtenek). Az alkalmazások nem tartalmaznak tőlük vagy bárki mástól származó kódot, amely adatokat küldene nekik.

A személyes adataidat senki másnak nem adjuk el, nem adjuk bérbe és nem osztjuk meg. Adatokat csak akkor adnánk ki, ha jogszabály előírná.

## 7. Meddig őrizzük az adatokat, és hogyan törölheted őket

- A fiókodat és a naplódat addig őrizzük, amíg nem törlöd őket. A bejelentkezési munkamenetek 12 óra után, az „Emlékezz rám" esetén 90 nap után érnek véget. A jelszó-visszaállítási kérések 30 perc után lejárnak. Egy eszközön lévő másolatok addig maradnak meg, amíg ki nem jelentkezel azon az eszközön.
- **A fiók törlése az alkalmazásban vagy a weboldalon:** jelentkezz be, nyisd meg a **Beállítások - Fiók törlése** menüpontot, add meg a jelszavadat, és erősítsd meg. Ez azonnal törli a szerverről a fiókodat, a naplódat, a szokásaidat és a beállításaidat, a bejelentkezésedet minden eszközön és a jelszó-visszaállítási kéréseket, valamint törli a használt eszközön lévő offline másolatot. A többi eszközödön még várakozó módosításokat ezután már nem lehet feltölteni, és elvesznek.
- **Másolatok a szerver biztonsági mentéseiben:** a tárhelyszolgáltató naponta pillanatképet készít a szerver tárhelyéről. Egy törölt fiók másolatai ezekből a pillanatképekből 30 napon belül automatikusan törlődnek.
- **A szerver titkosított archívumai:** hogy egy katasztrófa után helyre lehessen állítani az adatokat, az üzemeltető nagyjából havonta egyszer titkosított archívumot készít a szerver tárhelyéről; a szerver csak a 2 legújabbat őrzi meg, az üzemeltető pedig legfeljebb a 3 legújabbat tartja offline, egy internethez nem csatlakoztatott meghajtón, így egy törölt fiók másolatai eltűnnek belőlük, ahogy újabb archívumok váltják fel őket, általában három hónapon belül.
- **A törölt vagy módosított bejegyzések** azonnal eltűnnek az alkalmazásból, és a régi szövegük a változás mentésekor, egy pillanattal később törlődik a szerveren lévő naplófájlodból: a szerver felülírja a törölt adatokat ahelyett, hogy csak szabadnak jelölné a helyüket. A fájl előző változata, amelyet a szerver arra az esetre őriz meg, ha egy mentés nem sikerül, a következő mentéskor lecserélődik. Az a szöveg, amelyet még e védelem előtt töröltél, akkor törlődik, amikor a naplódat a frissítés után először megnyitják (például amikor bejelentkezel). A szerveren a korábbi változatok ezután csak a tárhely napi pillanatképeiben maradnak meg legfeljebb 30 napig, valamint titkosítva a lemezének kihasználatlan területén, amíg azt a területet újra fel nem használják; a korábban készített biztonsági mentési fájljaid megtartják a bennük lévő szöveget. A fiók törlése az egész fájlt törli.
- **Ha nem tudsz bejelentkezni:** írj a [{{CONTACT_EMAIL}}](mailto:{{CONTACT_EMAIL}}) címre a fiókodban regisztrált e-mail-címről. Visszaigazoljuk a kérést, és 30 napon belül töröljük a fiókot. Minden részlet: [{{DELETE_URL}}]({{DELETE_URL}}).
- **Az alkalmazás eltávolítása nem törli a fiókodat.** Ha ezt szeretnéd, előbb töröld a Beállításokban. A kijelentkezés törli a másolatokat és a kulcsot arról az eszközről; ha még vannak feltöltésre váró módosítások, az alkalmazás előbb rákérdez. Windowson a letöltött (telepítőfájlos) verzió eltávolítása megtartja a titkosított másolatot, hacsak nem választod az alkalmazásadatok törlését; a biztonság kedvéért előbb jelentkezz ki. Macen, ha az alkalmazást a Kukába helyezed, a titkosított másolatok a Library mappádban, a kulcs pedig a kulcskarikádban marad, amíg ki nem jelentkezel, vagy nem törlöd őket; előbb jelentkezz ki. Az iPhone-alkalmazás törlése eltávolítja a tárhelyét; a kulcskarika-elem kijelentkezéskor törlődik - a biztonság kedvéért előbb jelentkezz ki.
- Jelenleg nem töröljük automatikusan az inaktív fiókokat. Ha elkezdjük, itt jelezzük, mielőtt érvénybe lép.

## 8. Biztonsági intézkedések

- Csak HTTPS; a szerver elutasítja azokat a kapcsolatokat, amelyek nem a biztonságos címén érkeznek.
- A bejelentkezési és regisztrációs kísérletek korlátozása. 10 hibás jelszó után az adott hálózatról 15 percre zárolódik a bejelentkezés, és a fiókra irányuló további kísérletek lelassulnak.
- A napló egy ideig tartó tétlenség után magától zárolódik. A jelszó vagy az e-mail-cím módosításához és a fiók törléséhez meg kell adnod a jelszavadat.
- A szerver kulcsát a tárolt fájloktól elkülönítve őrizzük, és a szervert csak az üzemeltető kezelheti.
- Aki programokat tud futtatni a Windows- vagy Mac-felhasználódként, vagy teljes irányítása van egy rootolt vagy jailbreakelt telefon felett, el tudja olvasni az „Emlékezz rám" számára őrzött másolatot.

Egyetlen rendszer sem ígérhet tökéletes biztonságot. Válassz erős jelszót, amelyet sehol máshol nem használsz, tartsd naprakészen az eszközeidet, és készíts biztonsági mentést.

## 9. A jogaid

Az adataidat magad is megnézheted, kijavíthatod, exportálhatod és törölheted: a profilod a Beállításokban van, minden bejegyzés szerkeszthető vagy törölhető, a **Beállítások - Biztonsági mentés** és az exportálás olyan másolatot készít, amelyet máshová vihetsz, a **Fiók törlése** pedig mindent eltávolít. Írhatsz is nekünk, hogy kérd az adataid másolatát, helyesbítését, törlését vagy kezelésük korlátozását, illetve hogy tiltakozz a kezelés ellen, és a hozzájárulásodat bármikor visszavonhatod. 30 napon belül válaszolunk. Jogod van panaszt tenni egy adatvédelmi hatóságnál is - az Európai Unióban a saját országod hatóságánál, Izraelben a Magánszféra-védelmi Hatóságnál.

## 10. Gyermekek

A szolgáltatás nem gyermekeknek szól. Fiók létrehozásához legalább {{MINIMUM_AGE}} évesnek kell lenned. Tudatosan nem gyűjtünk adatokat fiatalabbaktól. Ha úgy gondolod, hogy egy fiatalabb gyermek fiókot hozott létre, írj nekünk, és töröljük.

## 11. Nem orvosi eszköz

Az alkalmazás megállapításai lehetséges összefüggéseket írnak le a saját bejegyzéseidben. Nem bizonyítanak ok-okozati kapcsolatot, és nem minősülnek orvosi vagy pszichológiai tanácsnak.

## 12. Az irányelvek módosítása

Ha a szolgáltatás vagy ezek az irányelvek változnak, frissítjük ezt az oldalt és a fenti hatálybalépési dátumot. Ha egy változás érinti, hogy mit teszünk az adataiddal, ezt még a hatálybalépése előtt jelezzük ezen az oldalon.

## 13. Kapcsolat

Kérdések az adatvédelemről vagy az adataidról: [{{CONTACT_EMAIL}}](mailto:{{CONTACT_EMAIL}})

{{PUBLISHER_NAME}}
