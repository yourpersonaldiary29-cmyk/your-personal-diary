---
title: Polityka prywatności - Your Personal Diary
description: Jak Your Personal Diary (aplikacja na Androida, aplikacja na Windows i strona internetowa) przechowuje i chroni Twoje dane.
languages: Języki
otherPage: Jak usunąć konto
---

# Polityka prywatności - Your Personal Diary

Data wejścia w życie: {{EFFECTIVE_DATE}}

## W skrócie

- Your Personal Diary to jedna usługa z trzema wejściami: **aplikacja na Androida** (Google Play), **aplikacja na Windows** (Microsoft Store lub plik instalacyjny) i **strona internetowa** [{{SITE_URL}}]({{SITE_URL}}). Wszystkie trzy korzystają z tego samego serwera i tego samego konta.
- Twój dziennik jest przechowywany na naszym serwerze w pliku zaszyfrowanym kluczem pochodzącym z Twojego hasła. Tam przechowywane są też dane Twojego konta.
- Używamy Twoich danych wyłącznie po to, by Twój dziennik działał. Bez reklam, bez analityki, bez śledzenia, nie sprzedajemy ani nie udostępniamy Twoich danych.
- Poznaj ograniczenia: dopóki jesteś zalogowany, serwer trzyma Twój dziennik otwarty w pamięci, a operator serwera mógłby technicznie zresetować Twoje hasło i przeczytać Twój dziennik. Sekcja 4 wyjaśnia to otwarcie.
- Konto i dziennik możesz usunąć w każdej chwili w **Ustawienia - Usuwanie konta**.

## 1. Kim jesteśmy

Usługę prowadzi {{PUBLISHER_NAME}} („my"), który odpowiada za Twoje dane osobowe („administrator"). Kontakt: [{{CONTACT_EMAIL}}](mailto:{{CONTACT_EMAIL}}).

Ta polityka dotyczy aplikacji na Androida, aplikacji na Windows i strony internetowej. Pokazują ten sam dziennik i działają według tych samych zasad; tam, gdzie aplikacja działa inaczej, polityka to opisuje.

## 2. Co przechowujemy na serwerze i gdzie

Serwer działa u dostawcy hostingu Fly.io, w jego centrum danych we **Frankfurcie, w Niemczech (Unia Europejska)**. Przechowuje:

- **Dane konta:** Twoje imię, nazwisko, nazwę użytkownika i adres e-mail, identyfikator konta, język, w którym korzystasz z aplikacji, datę utworzenia konta i datę ostatniego logowania. Przy zakładaniu konta zapisujemy też potwierdzenie zapoznania się z tą polityką i jej akceptacji: czas potwierdzenia i datę wejścia w życie potwierdzonej wersji. Jeśli zmienisz adres e-mail, poprzedni adres i czas zmiany pozostają przy koncie, dopóki ponownie nie zmienisz adresu lub nie usuniesz konta. Aplikacja nie szyfruje tych danych, bo serwer potrzebuje ich do logowania i do pisania do Ciebie, więc operator może je widzieć.
- **Twoje hasło:** nie jest przechowywane. Serwer przechowuje tylko wartość z niego wyprowadzoną (scrypt), dzięki której może je sprawdzić.
- **Twój dziennik:** wpisy (tekst oraz pola opcjonalne: nastrój, emocje, energia, stres, sen, aktywność fizyczna, wydarzenia, osoby, miejsce, notatki i tagi), nawyki i ich zapisy oraz Twoje ustawienia. Każde konto ma własny zaszyfrowany plik dziennika.
- **Sesje logowania:** dla każdego urządzenia, na którym jesteś zalogowany: rodzaj urządzenia („Komputer", „Telefon" lub „Przeglądarka"), kiedy sesja się zaczęła, kiedy była ostatnio używana i kiedy się kończy. Sam token logowania jest przechowywany tylko jako skrót (hash). Przy „Zapamiętaj mnie" sesja zawiera też klucz Twojego dziennika, zaszyfrowany kluczem serwera (sekcja 4).
- **Prośby o reset hasła:** skrót linku i kodu, ważne 30 minut i jednorazowe.
- **Klucz do kopii offline** na Twoich urządzeniach (sekcja 5), przechowywany wewnątrz Twojego zaszyfrowanego dziennika.
- **Ustawienia wysyłki e-maili operatora** (własne konto Gmail operatora, z hasłem przechowywanym w postaci zaszyfrowanej). Nie zawierają niczego o Tobie.
- **Dziennik techniczny** zdarzeń uruchomienia i błędów. Nie zawiera treści dziennika, adresów e-mail ani adresów IP.

**Wycieczka** („Pomiń - chcę się tylko rozejrzeć" w aplikacji na Androida) tworzy tymczasowy dziennik gościa z przykładowymi danymi. Istnieje tylko w pamięci serwera, kończy się sama po 30 minutach i nigdy nie jest zapisywany.

Jak w przypadku każdej strony internetowej, serwer i dostawca hostingu otrzymują adres IP Twojego urządzenia, gdy się ono łączy. Serwer używa go tylko w swojej pamięci: do ograniczania liczby żądań, które mogą przyjść z jednej sieci (logowanie, rejestracja i pozostałe funkcje konta, reset hasła, wycieczka i kopie zapasowe), oraz do blokady logowania. Te liczniki obejmują najwyżej ostatnie 24 godziny, a adres nigdy nie jest zapisywany w dzienniku technicznym ani w pamięci masowej.

## 3. Jak używamy Twoich danych

- **Do świadczenia usługi:** logowanie, przechowywanie dziennika i utrzymywanie go w tej samej postaci na wszystkich Twoich urządzeniach, wyszukiwanie, statystyki i spostrzeżenia dotyczące Twoich własnych wpisów, kopie zapasowe, eksport i przypomnienia. Pytania wyszukiwania są obsługiwane na serwerze i nie są tam przechowywane.
- **E-mail:** wyłącznie do Twoich wiadomości o resecie hasła i do powiadomień o bezpieczeństwie (Twoje hasło zostało zmienione za pomocą wiadomości resetującej; adres e-mail Twojego konta został zmieniony). Są pisane w języku zapisanym przy danych Twojego konta; serwer nie otwiera w tym celu Twojego dziennika. Bez newsletterów i bez marketingu.
- **Nigdy:** żadnych reklam, narzędzi analitycznych ani śledzących, profilowania, sprzedaży danych ani używania Twojego dziennika do trenowania jakiejkolwiek SI.

Podstawa prawna (dla użytkowników w Unii Europejskiej i podobnych przepisów): przetwarzamy Twoje dane, aby świadczyć usługę, na którą się zarejestrowałeś (wykonanie umowy, art. 6 ust. 1 lit. b RODO), oraz aby zapewnić jej bezpieczeństwo (nasz prawnie uzasadniony interes, art. 6 ust. 1 lit. f: limity prób, blokady, dziennik techniczny). Twój dziennik może zawierać informacje wrażliwe, na przykład o Twoim zdrowiu lub przekonaniach, jeśli zdecydujesz się je zapisać. Przetwarzamy je tylko po to, by je dla Ciebie przechowywać i pokazywać, bo poprosiłeś nas o to, zapisując je (Twoja wyraźna zgoda, art. 9 ust. 2 lit. a); w każdej chwili możesz je usunąć, edytując lub usuwając wpisy (sekcja 7 mówi, jak stary tekst jest usuwany).

## 4. Jak chroniony jest Twój dziennik - i przed czym ta ochrona nie chroni

Co go chroni:

- Plik dziennika każdego konta jest zaszyfrowany algorytmem AES-256-GCM. Klucz jest wyprowadzany z Twojego hasła za pomocą scrypt. Każda zmiana pliku zostaje wykryta.
- Dyski dostawcy hostingu również są zaszyfrowane (szyfrowanie danych w spoczynku).
- Wszystkie połączenia między Twoimi urządzeniami a serwerem korzystają z HTTPS (TLS).

Co warto wiedzieć:

- **Dopóki jesteś zalogowany, Twój dziennik jest odszyfrowany w pamięci serwera**, aby serwer mógł go dla Ciebie wyświetlać, przeszukiwać i analizować. To nie jest szyfrowanie „end-to-end".
- **Operator może technicznie zresetować każde hasło.** Aby „Nie pamiętasz hasła?" działało bez utraty dziennika, serwer przechowuje dla każdego konta kopię klucza dziennika, zaszyfrowaną kluczem serwera („klucz odzyskiwania"). Klucz serwera jest przechowywany jako sekret platformy hostingowej, poza zapisanymi plikami, więc sama kopia plików niczego nie otwiera. Mimo to ten, kto kontroluje serwer i jego sekrety - operator, a co do zasady także dostawca hostingu - mógłby zresetować hasło dowolnego konta i przeczytać jego dziennik bez znajomości hasła. Zobowiązujemy się tego nie robić. Nie mamy do tego żadnego narzędzia, a nasze narzędzia administracyjne nigdy nie otwierają dziennika. Jeśli nie chcesz polegać na tym zobowiązaniu, nie przechowuj w usłudze niczego, czego nie chciałbyś pokazać nikomu innemu.
- **Prośba o reset hasła nie otwiera Twojego dziennika.** Wiadomość o resecie i powiadomienia o bezpieczeństwie są pisane w języku zapisanym przy danych Twojego konta (sekcja 2), więc prośba - Twoja albo kogokolwiek, kto wpisze Twój adres e-mail - zostawia dziennik zamknięty. Dopiero gdy reset zostanie dokończony za pomocą linku lub kodu z wiadomości, serwer otwiera Twój dziennik kluczem odzyskiwania, aby zaszyfrować go ponownie nowym hasłem.

## 5. Co jest przechowywane na Twoim urządzeniu

Na każdym urządzeniu, na którym korzystasz z usługi:

- Twój token logowania (abyś pozostał zalogowany), ostatnia nazwa użytkownika, ustawienia języka i wyświetlania oraz ostatnie pytania wyszukiwania (usuwane po wylogowaniu).

**Bez połączenia.** Jeśli aplikacja nie może połączyć się z serwerem, nadal działa: to, co piszesz, jest zapisywane na urządzeniu w postaci zaszyfrowanej i automatycznie wysyłane na serwer, gdy połączenie wróci, nawet jeśli w międzyczasie aplikacja została zamknięta. W aplikacjach na Windows i Androida, jeśli wybrałeś „Zapamiętaj mnie", aplikacja przechowuje też zaszyfrowaną kopię tego, co ostatnio Ci pokazała (ostatnie wpisy, nawyki, dzisiejsze dane, miesiąc w kalendarzu i Twoje ustawienia), abyś mógł to czytać bez połączenia; w przeciwnym razie ta kopia istnieje tylko w pamięci, dopóki aplikacja jest otwarta. Klucz do tych kopii serwer przechowuje wewnątrz Twojego zaszyfrowanego dziennika; przy „Zapamiętaj mnie" aplikacje na Windows i Androida przechowują go także na urządzeniu, chroniony przez ochronę danych systemu Windows lub przez Android Keystore, aby aplikacja mogła się otworzyć bez połączenia. Twoje hasło i klucz odzyskiwania nigdy nie są przechowywane na urządzeniu. Aby każda zmiana została wysłana dokładnie raz, aplikacja przechowuje też, w postaci zaszyfrowanej, rejestr zmian wysłanych w ciągu ostatnich 7 dni.

- **Aplikacja na Windows:** te kopie są przechowywane w folderach danych aplikacji w Twoim profilu użytkownika Windows (w wersji z Microsoft Store - w folderze pakietu aplikacji). Klucz jest chroniony przez ochronę danych systemu Windows (DPAPI) i działa tylko dla Twojego użytkownika Windows.
- **Aplikacja na Androida:** te kopie są przechowywane w prywatnej pamięci aplikacji, której inne aplikacje nie mogą odczytać i która jest wyłączona z kopii zapasowych. Klucz jest chroniony przez Android Keystore.
- TODO-TRANSLATE: **Mac app:** these copies are kept in the app's folder inside your user Library (Application Support/app.yourpersonaldiary.mac). The key is kept as an item of your Mac user's login keychain, named "Your Personal Diary offline key" and never synchronized to iCloud Keychain; it is protected by your Mac login password and can be read only by the app. A Migration Assistant or Time Machine copy of your user account carries the item, still protected by that password. Once the app is distributed with Apple's signature, the item will move to the keychain that stays on this Mac only.
- TODO-TRANSLATE: **iPhone app:** these copies are kept in the app's private storage, excluded from iCloud backup. The key is kept in the iOS Keychain, available only on this device after it was unlocked once, and removed when you sign out.
- **Strona internetowa:** w przeglądarce przechowywane są, w postaci zaszyfrowanej, tylko zmiany jeszcze niewysłane, rejestr z ostatnich 7 dni i informacje o sprzecznych zmianach (zob. niżej), ale żadna kopia tego, co czytałeś; klucz pozostaje w pamięci i znika po zamknięciu strony.

Gdy połączenie wróci, aplikacja wysyła Twoje zmiany w kolejności, w jakiej je wprowadziłeś, każdą dokładnie raz. Jeśli ten sam wpis, nawyk lub ustawienie zmieniono też na innym urządzeniu, zachowywana jest nowsza zmiana, a aplikacja informuje Cię o tym w jednym wierszu; druga wersja pozostaje dostępna na tym urządzeniu, dopóki nie zamkniesz powiadomienia.

Jeśli aplikacja proponuje odblokowanie blokadą ekranu urządzenia (Windows Hello albo blokada ekranu lub odcisk palca na Androidzie), sprawdzenie wykonuje system operacyjny. Nic na temat Twojego odcisku palca, twarzy ani kodu PIN nie trafia do aplikacji ani do nas. Przypomnienia o nawykach w aplikacji na Androida są planowane na samym telefonie; nie jest używana żadna usługa powiadomień push.

Pliki, które tworzysz sam: **kopia zapasowa** jest zaszyfrowana hasłem; **eksport** (TXT, CSV, JSON lub PDF) to zwykły, czytelny plik. To Ty decydujesz, gdzie je zapisać, a każdy, kto zdobędzie plik eksportu, może go przeczytać.

## 6. Kto jeszcze otrzymuje dane

Korzystamy z dwóch dostawców usług. Przetwarzają oni dane wyłącznie w naszym imieniu, aby usługa działała:

- **Fly.io, Inc.** (Stany Zjednoczone) - hosting serwera we Frankfurcie, w Niemczech. Jej systemy przechowują zaszyfrowane pliki dzienników, dane kont i pozostałe dane z sekcji 2 oraz otrzymują dane połączeń, takie jak adresy IP. Ponieważ Fly.io jest firmą amerykańską, może uzyskiwać dostęp do danych spoza Unii Europejskiej; obejmują to jej warunki przetwarzania danych. Jej polityka prywatności: `fly.io/legal/privacy-policy`.
- **Google (Gmail)** - wysyła wiadomości o resecie hasła i powiadomienia o bezpieczeństwie. Google otrzymuje wiadomość, Twój adres e-mail oraz zawarte w niej imię i nazwę użytkownika. Wiadomość nigdy nie zawiera niczego z Twojego dziennika. Polityka prywatności Google: `policies.google.com/privacy`.

Sklepy z aplikacjami również przetwarzają dane zgodnie z własnymi politykami prywatności, gdy pobierasz aplikacje: **Google Play** w przypadku aplikacji na Androida i **Microsoft Store** w przypadku aplikacji na Windows (na przykład instalacje, oceny i raporty o awariach zbierane przez ich systemy). Aplikacje nie zawierają ich kodu ani kodu nikogo innego, który wysyłałby im dane.

Nie sprzedajemy, nie wynajmujemy ani nie udostępniamy Twoich danych osobowych nikomu innemu. Ujawnilibyśmy dane tylko wtedy, gdyby wymagało tego prawo.

## 7. Jak długo przechowujemy dane i jak je usunąć

- Przechowujemy Twoje konto i dziennik, dopóki ich nie usuniesz. Sesje logowania kończą się po 12 godzinach, a przy „Zapamiętaj mnie" po 90 dniach. Prośby o reset hasła wygasają po 30 minutach. Kopie na urządzeniu pozostają, dopóki się na nim nie wylogujesz.
- **Usunięcie konta w aplikacji lub na stronie:** zaloguj się, otwórz **Ustawienia - Usuwanie konta**, wpisz hasło i potwierdź. Spowoduje to natychmiastowe usunięcie z serwera Twojego konta, dziennika, nawyków i ustawień, Twoich zalogowań na wszystkich urządzeniach i wszelkich próśb o reset hasła, a także usunięcie kopii offline na używanym urządzeniu. Zmiany, które wciąż czekają na innych Twoich urządzeniach, nie będą mogły już zostać wysłane i przepadną.
- **Kopie w kopiach zapasowych serwera:** dostawca hostingu codziennie wykonuje migawkę pamięci serwera. Kopie usuniętego konta w tych migawkach są automatycznie usuwane w ciągu 30 dni.
- **Zaszyfrowane archiwa serwera:** aby móc odzyskać dane po awarii, operator mniej więcej raz w miesiącu tworzy zaszyfrowane archiwum pamięci serwera; serwer przechowuje tylko 2 najnowsze, a operator przechowuje offline najwyżej 3 najnowsze, na dysku niepodłączonym do internetu, więc kopie usuniętego konta znikają z nich, gdy zastępują je nowsze archiwa, zwykle w ciągu trzech miesięcy.
- **Usunięte lub zmienione wpisy** od razu znikają z aplikacji, a ich stary tekst jest usuwany z pliku Twojego dziennika na serwerze, gdy zmiana zostanie zapisana, chwilę później: serwer nadpisuje usunięte dane, zamiast tylko oznaczać miejsce jako wolne. Poprzednia wersja pliku, którą serwer przechowuje na wypadek nieudanego zapisu, jest zastępowana przy następnym zapisie. Tekst usunięty, zanim istniała ta ochrona, jest usuwany przy pierwszym otwarciu Twojego dziennika po aktualizacji (na przykład gdy się logujesz). Na serwerze wcześniejsze wersje pozostają potem tylko w codziennych migawkach pamięci masowej, przez maksymalnie 30 dni, oraz, zaszyfrowane, w nieużywanym miejscu jego dysku, dopóki to miejsce nie zostanie ponownie użyte; pliki kopii zapasowych, które utworzyłeś wcześniej, zachowują tekst, który zawierają. Usunięcie konta usuwa cały plik.
- **Jeśli nie możesz się zalogować:** napisz na adres [{{CONTACT_EMAIL}}](mailto:{{CONTACT_EMAIL}}) z adresu e-mail zarejestrowanego w Twoim koncie. Potwierdzimy prośbę i usuniemy konto w ciągu 30 dni. Wszystkie szczegóły: [{{DELETE_URL}}]({{DELETE_URL}}).
- **Odinstalowanie aplikacji nie usuwa konta.** Jeśli tego chcesz, najpierw usuń je w Ustawieniach. Wylogowanie usuwa kopie i klucz z tego urządzenia; jeśli jakieś zmiany wciąż czekają na wysłanie, aplikacja najpierw zapyta. W systemie Windows odinstalowanie pobranej wersji (z pliku instalacyjnego) pozostawia zaszyfrowaną kopię, chyba że wybierzesz usunięcie danych aplikacji; dla pewności najpierw się wyloguj.
- Obecnie nie usuwamy automatycznie nieaktywnych kont. Jeśli zaczniemy to robić, napiszemy o tym tutaj, zanim zacznie to obowiązywać.

## 8. Środki bezpieczeństwa

- Tylko HTTPS; serwer odrzuca połączenia, które nie przychodzą przez jego bezpieczny adres.
- Limity prób logowania i rejestracji. Po 10 błędnych hasłach logowanie z tej sieci zostaje zablokowane na 15 minut, a kolejne próby dla konta są spowalniane.
- Dziennik blokuje się sam po okresie bezczynności. Zmiana hasła lub adresu e-mail oraz usunięcie konta wymagają podania hasła.
- Klucz serwera jest przechowywany poza zapisanymi plikami, a serwerem może zarządzać tylko operator.
- Ktoś, kto może uruchamiać programy jako Twój użytkownik Windows albo ma pełną kontrolę nad zrootowanym telefonem, mógłby odczytać kopię przechowywaną dla „Zapamiętaj mnie".

Żaden system nie może obiecać doskonałego bezpieczeństwa. Wybierz silne hasło, którego nie używasz nigdzie indziej, aktualizuj swoje urządzenia i miej kopię zapasową.

## 9. Twoje prawa

Możesz samodzielnie przeglądać, poprawiać, eksportować i usuwać swoje dane: Twój profil jest w Ustawieniach, każdy wpis można edytować lub usunąć, **Ustawienia - Kopia zapasowa** i eksport tworzą kopię, którą możesz zabrać gdzie indziej, a **Usuwanie konta** usuwa wszystko. Możesz też napisać do nas, aby poprosić o kopię swoich danych, ich sprostowanie, usunięcie lub ograniczenie przetwarzania albo aby wnieść sprzeciw, a zgodę możesz wycofać w każdej chwili. Odpowiadamy w ciągu 30 dni. Masz też prawo złożyć skargę do organu ochrony danych - w Unii Europejskiej do organu w Twoim kraju, w Izraelu do Urzędu Ochrony Prywatności.

## 10. Dzieci

Usługa nie jest skierowana do dzieci. Aby założyć konto, musisz mieć co najmniej {{MINIMUM_AGE}} lat. Nie zbieramy świadomie danych osób młodszych. Jeśli uważasz, że konto założyło młodsze dziecko, napisz do nas, a je usuniemy.

## 11. To nie jest narzędzie medyczne

Spostrzeżenia w aplikacji opisują możliwe zależności w Twoich własnych wpisach. Nie dowodzą związku przyczynowo-skutkowego i nie stanowią porady medycznej ani psychologicznej.

## 12. Zmiany tej polityki

Gdy usługa lub ta polityka się zmienia, aktualizujemy tę stronę i datę wejścia w życie na górze. Jeśli zmiana wpływa na to, co robimy z Twoimi danymi, napiszemy o tym na tej stronie, zanim zacznie obowiązywać.

## 13. Kontakt

Pytania dotyczące prywatności lub Twoich danych: [{{CONTACT_EMAIL}}](mailto:{{CONTACT_EMAIL}})

{{PUBLISHER_NAME}}
