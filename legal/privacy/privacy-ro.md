---
title: Politica de confidențialitate - Your Personal Diary
description: Cum păstrează și protejează Your Personal Diary (aplicația Android, aplicația Windows și site-ul) datele tale.
languages: Limbi
otherPage: Cum îți ștergi contul
---

# Politica de confidențialitate - Your Personal Diary

Data intrării în vigoare: {{EFFECTIVE_DATE}}

## Pe scurt

- Your Personal Diary este un singur serviciu cu trei căi de acces: **aplicația Android** (Google Play), **aplicația Windows** (Microsoft Store sau un fișier de instalare) și **site-ul** [{{SITE_URL}}]({{SITE_URL}}). Toate trei folosesc același server și același cont.
- Jurnalul tău este păstrat pe serverul nostru, într-un fișier criptat cu o cheie derivată din parola ta. Datele contului tău sunt păstrate tot acolo.
- Folosim datele tale doar ca să-ți facem jurnalul să funcționeze. Fără reclame, fără analize, fără urmărire și nu vindem și nu partajăm datele tale.
- Cunoaște limitele: cât timp ești conectat, serverul ține jurnalul tău deschis în memorie, iar operatorul serverului ar putea, tehnic, să-ți reseteze parola și să-ți citească jurnalul. Secțiunea 4 explică acest lucru deschis.
- Îți poți șterge contul și jurnalul oricând din **Setări - Ștergerea contului**.

## 1. Cine suntem

Serviciul este operat de {{PUBLISHER_NAME}} („noi"), care răspunde de datele tale personale („operatorul de date"). Contact: [{{CONTACT_EMAIL}}](mailto:{{CONTACT_EMAIL}}).

Această politică se aplică aplicației Android, aplicației Windows și site-ului. Toate afișează același jurnal și urmează aceleași reguli; acolo unde o aplicație se comportă diferit, politica o spune.

## 2. Ce păstrăm pe server și unde

Serverul rulează la furnizorul de găzduire Fly.io, în centrul său de date din **Frankfurt, Germania (Uniunea Europeană)**. Pe el se păstrează:

- **Datele contului:** prenumele, numele, numele de utilizator și adresa de e-mail, un ID de cont, limba în care folosești aplicația, momentul creării contului și momentul ultimei conectări. La crearea contului păstrăm și o evidență a confirmării tale că ai citit această politică și ești de acord cu ea: momentul confirmării și data intrării în vigoare a versiunii pe care ai confirmat-o. Dacă îți schimbi adresa de e-mail, adresa anterioară și momentul schimbării rămân la cont până când schimbi din nou adresa sau ștergi contul. Aplicația nu criptează aceste date, pentru că serverul are nevoie de ele ca să te conecteze și să-ți scrie, așa că operatorul le poate vedea.
- **Parola ta:** nu este păstrată. Serverul păstrează doar o valoare derivată din ea (scrypt), cu care o verifică.
- **Jurnalul tău:** înregistrările (text și câmpurile opționale dispoziție, emoții, energie, stres, somn, activitate fizică, evenimente, persoane, loc, note și etichete), obiceiurile și înregistrările lor, precum și setările tale. Fiecare cont are propriul fișier de jurnal criptat.
- **Sesiuni de conectare:** pentru fiecare dispozitiv pe care ești conectat: tipul dispozitivului („Computer", „Telefon" sau „Browser"), când a început sesiunea, când a fost folosită ultima dată și când se încheie. Tokenul de conectare este păstrat doar ca hash. Cu „Ține-mă minte", sesiunea conține și cheia jurnalului tău, criptată cu cheia serverului (secțiunea 4).
- **Cereri de resetare a parolei:** un hash al linkului și al codului, valabile 30 de minute și utilizabile o singură dată.
- **Cheia copiilor offline** de pe dispozitivele tale (secțiunea 5), păstrată în interiorul jurnalului tău criptat.
- **Setările de trimitere a e-mailurilor ale operatorului** (contul Gmail al operatorului, cu parola păstrată criptat). Nu conțin nimic despre tine.
- **Un jurnal tehnic** cu evenimentele de pornire și erorile. Nu conține conținut din jurnal, adrese de e-mail sau adrese IP.

**Turul** („Omite - vreau doar să arunc o privire", în aplicația Android) creează un jurnal temporar de invitat cu date de exemplu. Există doar în memoria serverului, se încheie singur după 30 de minute și nu este niciodată păstrat.

Ca la orice site, serverul și furnizorul de găzduire primesc adresa IP a dispozitivului tău când acesta se conectează. Serverul o folosește doar în memoria lui: pentru a limita câte cereri pot veni din aceeași rețea (conectare, înregistrare și celelalte funcții ale contului, resetarea parolei, turul și backupurile) și pentru blocarea conectării. Aceste contoare acoperă cel mult ultimele 24 de ore, iar adresa nu este scrisă niciodată în jurnalul tehnic sau în stocare.

## 3. Cum folosim datele tale

- **Pentru a furniza serviciul:** conectarea, păstrarea jurnalului și menținerea lui la fel pe toate dispozitivele, căutarea, statisticile și observațiile despre propriile înregistrări, backupurile, exporturile și mementourile. Întrebările de căutare primesc răspuns pe server și nu sunt păstrate acolo.
- **E-mail:** doar pentru mesajele tale de resetare a parolei și pentru notificări de securitate (parola ta a fost schimbată cu un mesaj de resetare; adresa de e-mail a contului tău a fost schimbată). Ele sunt scrise în limba păstrată la datele contului tău; serverul nu îți deschide jurnalul ca să le scrie. Fără buletine informative și fără marketing.
- **Niciodată:** fără reclame, fără instrumente de analiză sau urmărire, fără profilare, fără vânzarea datelor și fără folosirea jurnalului tău pentru a antrena vreo IA.

Temeiul legal (pentru utilizatorii din Uniunea Europeană și legi similare): prelucrăm datele tale pentru a furniza serviciul la care te-ai înscris (executarea unui contract, articolul 6 alineatul (1) litera (b) din GDPR) și pentru a-l menține sigur (interesul nostru legitim, articolul 6 alineatul (1) litera (f): limitarea încercărilor, blocări, jurnalul tehnic). Jurnalul tău poate conține informații sensibile, de exemplu despre sănătatea sau convingerile tale, dacă alegi să le scrii. Le prelucrăm doar pentru a le păstra pentru tine și a ți le arăta, pentru că ne-ai cerut asta scriindu-le (consimțământul tău explicit, articolul 9 alineatul (2) litera (a)); le poți elimina oricând, editând sau ștergând înregistrări (secțiunea 7 spune cum este șters textul vechi).

## 4. Cum este protejat jurnalul tău - și de ce nu te protejează

Ce îl protejează:

- Fișierul de jurnal al fiecărui cont este criptat cu AES-256-GCM. Cheia este derivată din parola ta cu scrypt. Orice modificare a fișierului este detectată.
- Discurile furnizorului de găzduire sunt și ele criptate (criptare în repaus).
- Toate conexiunile dintre dispozitivele tale și server folosesc HTTPS (TLS).

Ce ar trebui să știi:

- **Cât timp ești conectat, jurnalul tău este decriptat în memoria serverului**, ca serverul să-l poată afișa, căuta și analiza pentru tine. Aceasta nu este criptare „end-to-end".
- **Operatorul poate, tehnic, reseta orice parolă.** Pentru ca „Ai uitat parola?" să funcționeze fără să pierzi jurnalul, serverul păstrează pentru fiecare cont o copie a cheii jurnalului, criptată cu o cheie a serverului (o „cheie de recuperare"). Cheia serverului este păstrată ca secret al platformei de găzduire, în afara fișierelor stocate, așa că o copie a fișierelor singură nu deschide nimic. Totuși, cine controlează serverul și secretele lui - operatorul și, în principiu, furnizorul de găzduire - ar putea reseta parola oricărui cont și citi jurnalul acestuia fără să cunoască parola. Ne angajăm să nu facem asta. Nu avem niciun instrument pentru așa ceva, iar instrumentele noastre de administrare nu deschid niciodată un jurnal. Dacă nu ești dispus să te bazezi pe acest angajament, nu păstra în serviciu nimic din ce n-ai vrea să citească altcineva.
- **O cerere de resetare a parolei nu îți deschide jurnalul.** Mesajul de resetare și notificările de securitate sunt scrise în limba păstrată la datele contului tău (secțiunea 2), așa că o cerere - făcută de tine sau de oricine tastează adresa ta de e-mail - îți lasă jurnalul închis. Doar când resetarea este finalizată cu linkul sau codul din mesaj, serverul îți deschide jurnalul cu cheia de recuperare, ca să-l cripteze din nou cu parola ta nouă.

## 5. Ce se păstrează pe dispozitivul tău

Pe fiecare dispozitiv pe care folosești serviciul:

- tokenul de conectare (ca să rămâi conectat), ultimul nume de utilizator, preferințele de limbă și de afișare și întrebările de căutare recente (se șterg când te deconectezi).

**Fără conexiune.** Dacă aplicația nu poate ajunge la server, continuă să funcționeze: ce scrii este salvat pe dispozitiv, criptat, și încărcat automat pe server când revine conexiunea, chiar dacă între timp aplicația a fost închisă. În aplicațiile Windows și Android, dacă ai ales „Ține-mă minte", aplicația păstrează și o copie criptată a ceea ce ți-a arătat recent (înregistrările recente, obiceiurile, datele de azi, luna din calendar și setările tale), ca s-o poți citi fără conexiune; altfel, copia există doar în memorie cât timp aplicația este deschisă. Cheia acestor copii este păstrată de server în interiorul jurnalului tău criptat; cu „Ține-mă minte", aplicațiile Windows și Android o păstrează și pe dispozitiv, protejată de protecția datelor din Windows sau de Android Keystore, ca aplicația să se poată deschide fără conexiune. Parola și cheia de recuperare nu sunt niciodată păstrate pe dispozitiv. Ca fiecare modificare să fie încărcată exact o dată, aplicația păstrează și, criptat, un registru al modificărilor încărcate în ultimele 7 zile.

- **Aplicația Windows:** aceste copii sunt păstrate în folderele de date ale aplicației din profilul tău de utilizator Windows (la versiunea din Microsoft Store, în folderul pachetului aplicației). Cheia este protejată de protecția datelor din Windows (DPAPI) și funcționează doar pentru utilizatorul tău Windows.
- **Aplicația Android:** aceste copii sunt păstrate în spațiul de stocare privat al aplicației, pe care alte aplicații nu îl pot citi și care este exclus din backupuri. Cheia este protejată de Android Keystore.
- TODO-TRANSLATE: **Mac app:** these copies are kept in the app's folder inside your user Library (Application Support/app.yourpersonaldiary.mac). The key is kept as an item of your Mac user's login keychain, named "Your Personal Diary offline key" and never synchronized to iCloud Keychain; it is protected by your Mac login password and can be read only by the app. A Migration Assistant or Time Machine copy of your user account carries the item, still protected by that password. Once the app is distributed with Apple's signature, the item will move to the keychain that stays on this Mac only.
- TODO-TRANSLATE: **iPhone app:** these copies are kept in the app's private storage, excluded from iCloud backup. The key is kept in the iOS Keychain, available only on this device after it was unlocked once, and removed when you sign out.
- **Site-ul:** în browser sunt păstrate, criptat, doar modificările încă neîncărcate, registrul ultimelor 7 zile și notele despre modificările în conflict (vezi mai jos), dar nicio copie a ceea ce ai citit; cheia rămâne în memorie și dispare când închizi pagina.

Când revine conexiunea, aplicația încarcă modificările făcute de tine, în ordinea în care le-ai făcut, fiecare exact o dată. Dacă aceeași înregistrare, același obicei sau aceeași setare a fost modificată și pe alt dispozitiv, se păstrează modificarea mai nouă, iar aplicația îți spune asta într-un rând; cealaltă versiune rămâne disponibilă pe acest dispozitiv până închizi nota.

Dacă aplicația îți oferă deblocarea cu blocarea ecranului dispozitivului (Windows Hello sau blocarea ecranului ori amprenta pe Android), verificarea este făcută de sistemul de operare. Nimic despre amprenta, fața sau PIN-ul tău nu ajunge la aplicație sau la noi. Mementourile pentru obiceiuri din aplicația Android sunt programate pe telefonul însuși; nu este implicat niciun serviciu de notificări push.

Fișiere create de tine: un **backup** este criptat cu o parolă; un **export** (TXT, CSV, JSON sau PDF) este un fișier obișnuit, lizibil. Tu decizi unde le salvezi, iar oricine obține un fișier exportat îl poate citi.

## 6. Cine mai primește date

Folosim doi furnizori de servicii. Ei prelucrează datele doar în numele nostru, pentru a face serviciul să funcționeze:

- **Fly.io, Inc.** (Statele Unite) - găzduirea serverului în Frankfurt, Germania. Sistemele sale conțin fișierele de jurnal criptate, datele conturilor și celelalte date din secțiunea 2 și primesc date de conexiune precum adresele IP. Deoarece Fly.io este o companie americană, poate accesa datele din afara Uniunii Europene; acest lucru este acoperit de condițiile sale privind prelucrarea datelor. Politica sa de confidențialitate: `fly.io/legal/privacy-policy`.
- **Google (Gmail)** - trimite mesajele de resetare a parolei și notificările de securitate. Google primește mesajul, adresa ta de e-mail și prenumele și numele de utilizator din el. Un mesaj nu conține niciodată nimic din jurnalul tău. Politica de confidențialitate Google: `policies.google.com/privacy`.

Și magazinele de aplicații prelucrează date conform propriilor politici de confidențialitate când descarci aplicațiile: **Google Play** pentru aplicația Android și **Microsoft Store** pentru aplicația Windows (de exemplu instalări, evaluări și rapoarte de blocare colectate de sistemele lor). Aplicațiile nu conțin cod al lor sau al altcuiva care să le trimită date.

Nu vindem, nu închiriem și nu partajăm datele tale personale cu nimeni altcineva. Am dezvălui date doar dacă legea ar cere-o.

## 7. Cât timp păstrăm datele și cum le ștergi

- Îți păstrăm contul și jurnalul până le ștergi. Sesiunile de conectare se încheie după 12 ore sau, cu „Ține-mă minte", după 90 de zile. Cererile de resetare a parolei expiră după 30 de minute. Copiile de pe un dispozitiv rămân până te deconectezi de pe acel dispozitiv.
- **Ștergerea contului în aplicație sau pe site:** conectează-te, deschide **Setări - Ștergerea contului**, introdu parola și confirmă. Astfel se șterg imediat de pe server contul, jurnalul, obiceiurile și setările tale, conectarea ta pe toate dispozitivele și orice cereri de resetare a parolei, iar copia offline de pe dispozitivul pe care îl folosești este ștearsă. Modificările care încă așteaptă pe celelalte dispozitive nu mai pot fi încărcate și se pierd.
- **Copii în backupurile serverului:** furnizorul de găzduire face zilnic un snapshot al stocării serverului. Copiile unui cont șters din aceste snapshoturi sunt șterse automat în cel mult 30 de zile.
- **Arhivele criptate ale serverului:** ca să se poată recupera după un dezastru, operatorul face aproximativ o dată pe lună o arhivă criptată a stocării serverului; serverul păstrează doar cele mai noi 2, iar operatorul păstrează cel mult cele mai noi 3 offline, pe o unitate care nu este conectată la internet, astfel încât copiile unui cont șters dispar din ele pe măsură ce arhive mai noi le înlocuiesc, de obicei în cel mult trei luni.
- **Înregistrările șterse sau modificate** dispar imediat din aplicație, iar textul lor vechi este șters din fișierul jurnalului tău de pe server când modificarea este salvată, o clipă mai târziu: serverul suprascrie datele șterse, în loc să marcheze doar spațiul ca liber. Versiunea anterioară a fișierului, pe care serverul o păstrează pentru cazul în care o salvare eșuează, este înlocuită la următoarea salvare. Textul șters înainte să existe această protecție este șters prima dată când jurnalul tău este deschis după actualizare (de exemplu, când te conectezi). Pe server, versiunile mai vechi rămân apoi doar în snapshoturile zilnice ale stocării, timp de cel mult 30 de zile, și, criptate, în spațiul nefolosit al discului său până când acel spațiu este folosit din nou; fișierele de backup pe care le-ai făcut înainte păstrează textul pe care îl conțin. Ștergerea contului șterge întregul fișier.
- **Dacă nu te poți conecta:** scrie la [{{CONTACT_EMAIL}}](mailto:{{CONTACT_EMAIL}}) de pe adresa de e-mail înregistrată în cont. Vom confirma cererea și vom șterge contul în cel mult 30 de zile. Toate detaliile: [{{DELETE_URL}}]({{DELETE_URL}}).
- **Dezinstalarea aplicației nu îți șterge contul.** Dacă asta vrei, șterge-l mai întâi din Setări. Deconectarea șterge copiile și cheia de pe acel dispozitiv; dacă mai sunt modificări care așteaptă să fie încărcate, aplicația te întreabă mai întâi. Pe Windows, dezinstalarea versiunii descărcate (fișier de instalare) păstrează copia criptată, dacă nu alegi să ștergi datele aplicației; ca să fii sigur, deconectează-te mai întâi.
- Deocamdată nu ștergem automat conturile inactive. Dacă vom începe să facem asta, o vom spune aici înainte să se aplice.

## 8. Măsuri de securitate

- Doar HTTPS; serverul refuză conexiunile care nu vin prin adresa sa securizată.
- Limite pentru încercările de conectare și de înregistrare. După 10 parole greșite, conectarea din rețeaua respectivă este blocată 15 minute, iar încercările următoare asupra contului sunt încetinite.
- Jurnalul se blochează singur după o perioadă de inactivitate. Schimbarea parolei sau a adresei de e-mail și ștergerea contului necesită parola ta.
- Cheia serverului este păstrată în afara fișierelor stocate și doar operatorul poate administra serverul.
- Cine poate rula programe ca utilizatorul tău de Windows, sau cine are controlul deplin asupra unui telefon cu root, ar putea citi copia păstrată pentru „Ține-mă minte".

Niciun sistem nu poate promite securitate perfectă. Alege o parolă puternică pe care n-o folosești nicăieri altundeva, ține-ți dispozitivele actualizate și păstrează un backup.

## 9. Drepturile tale

Îți poți vedea, corecta, exporta și șterge singur datele: profilul tău este în Setări, fiecare înregistrare poate fi editată sau ștearsă, **Setări - Backup** și exportul creează o copie pe care o poți lua în altă parte, iar **Ștergerea contului** elimină tot. Ne poți scrie și ca să ceri o copie a datelor tale, rectificarea, ștergerea sau restricționarea prelucrării ori ca să te opui prelucrării, și îți poți retrage oricând consimțământul. Răspundem în cel mult 30 de zile. Ai și dreptul de a depune o plângere la o autoritate de protecție a datelor - în Uniunea Europeană, autoritatea din țara ta; în Israel, Autoritatea pentru Protecția Vieții Private.

## 10. Copii

Serviciul nu se adresează copiilor. Trebuie să ai cel puțin {{MINIMUM_AGE}} ani pentru a crea un cont. Nu colectăm cu bună știință date ale persoanelor mai tinere. Dacă crezi că un copil mai mic a creat un cont, scrie-ne și îl vom șterge.

## 11. Nu este un instrument medical

Observațiile din aplicație descriu posibile legături în propriile tale înregistrări. Ele nu dovedesc cauză și efect și nu sunt sfaturi medicale sau psihologice.

## 12. Modificări ale acestei politici

Când serviciul sau această politică se schimbă, actualizăm această pagină și data intrării în vigoare de sus. Dacă o modificare afectează ce facem cu datele tale, o vom spune pe această pagină înainte să intre în vigoare.

## 13. Contact

Întrebări despre confidențialitate sau despre datele tale: [{{CONTACT_EMAIL}}](mailto:{{CONTACT_EMAIL}})

{{PUBLISHER_NAME}}
