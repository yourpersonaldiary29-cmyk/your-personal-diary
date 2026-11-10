---
title: Datenschutzerklärung - Your Personal Diary
description: Wie Your Personal Diary (Android-App, Windows-App und Website) deine Daten speichert und schützt.
languages: Sprachen
otherPage: So löschst du dein Konto
---

# Datenschutzerklärung - Your Personal Diary

Gültig ab: {{EFFECTIVE_DATE}}

## Kurz gesagt

- Your Personal Diary ist ein einziger Dienst mit drei Zugängen: die **Android-App** (Google Play), die **Windows-App** (Microsoft Store oder eine Setup-Datei) und die **Website** [{{SITE_URL}}]({{SITE_URL}}). Alle drei nutzen denselben Server und dasselbe Konto.
- Dein Tagebuch liegt auf unserem Server in einer Datei, die mit einem aus deinem Passwort abgeleiteten Schlüssel verschlüsselt ist. Auch deine Kontodaten liegen dort.
- Wir nutzen deine Daten nur, um dein Tagebuch für dich zu betreiben. Keine Werbung, keine Analyse, kein Tracking, und wir verkaufen oder teilen deine Daten nicht.
- Kenne die Grenzen: Solange du angemeldet bist, hält der Server dein Tagebuch geöffnet in seinem Arbeitsspeicher, und der Betreiber des Servers könnte technisch dein Passwort zurücksetzen und dein Tagebuch lesen. Abschnitt 4 erklärt das offen.
- Du kannst dein Konto und dein Tagebuch jederzeit unter **Einstellungen - Konto löschen** löschen.

## 1. Wer wir sind

Der Dienst wird von {{PUBLISHER_NAME}} („wir") betrieben, der für deine personenbezogenen Daten verantwortlich ist (der „Verantwortliche"). Kontakt: [{{CONTACT_EMAIL}}](mailto:{{CONTACT_EMAIL}}).

Diese Erklärung gilt für die Android-App, die Windows-App und die Website. Sie zeigen dasselbe Tagebuch und folgen denselben Regeln; wo sich eine App anders verhält, steht es hier.

## 2. Was wir auf dem Server speichern und wo

Der Server läuft beim Hosting-Anbieter Fly.io in dessen Rechenzentrum in **Frankfurt, Deutschland (Europäische Union)**. Gespeichert werden:

- **Kontodaten:** dein Vorname, Nachname, Benutzername und deine E-Mail-Adresse, eine Konto-ID, die Sprache, in der du die App nutzt, wann das Konto erstellt wurde und wann du dich zuletzt angemeldet hast. Beim Erstellen des Kontos speichern wir außerdem einen Nachweis deiner Bestätigung, dass du diese Erklärung gelesen hast und ihr zustimmst: den Zeitpunkt und das Datum, ab dem die bestätigte Fassung gilt. Wenn du deine E-Mail-Adresse änderst, bleiben die frühere Adresse und der Zeitpunkt der Änderung beim Konto, bis du die Adresse erneut änderst oder das Konto löschst. Die App verschlüsselt diese Daten nicht, weil der Server sie für die Anmeldung und zum Schreiben an dich braucht; der Betreiber kann sie daher sehen.
- **Dein Passwort:** wird nicht gespeichert. Der Server bewahrt nur einen daraus abgeleiteten Wert (scrypt) auf, mit dem er das Passwort prüft.
- **Dein Tagebuch:** Einträge (Text und die optionalen Felder Stimmung, Gefühle, Energie, Stress, Schlaf, körperliche Aktivität, Ereignisse, Personen, Ort, Notizen und Schlagwörter), Gewohnheiten und ihre Einträge sowie deine Einstellungen. Jedes Konto hat seine eigene verschlüsselte Tagebuchdatei.
- **Anmeldesitzungen:** für jedes Gerät, auf dem du angemeldet bist: die Art des Geräts („Computer", „Smartphone" oder „Browser"), wann die Sitzung begann, wann sie zuletzt genutzt wurde und wann sie endet. Das Anmelde-Token selbst wird nur als Hash gespeichert. Mit „Angemeldet bleiben" enthält die Sitzung auch den Schlüssel deines Tagebuchs, verschlüsselt mit dem Serverschlüssel (Abschnitt 4).
- **Anfragen zum Zurücksetzen des Passworts:** ein Hash des Links und des Codes, 30 Minuten gültig und nur einmal verwendbar.
- **Der Schlüssel für die Offline-Kopien** auf deinen Geräten (Abschnitt 5), gespeichert in deinem verschlüsselten Tagebuch.
- **Die E-Mail-Versandeinstellungen des Betreibers** (das eigene Gmail-Konto des Betreibers, dessen Passwort verschlüsselt gespeichert ist). Sie enthalten nichts über dich.
- **Ein technisches Protokoll** über Startvorgänge und Fehler. Es enthält keine Tagebuchinhalte, keine E-Mail-Adressen und keine IP-Adressen.

**Die Tour** („Überspringen - nur umsehen" in der Android-App) erstellt ein vorübergehendes Gast-Tagebuch mit Beispieldaten. Es existiert nur im Arbeitsspeicher des Servers, endet nach 30 Minuten von selbst und wird nie gespeichert.

Wie bei jeder Website erhalten der Server und der Hosting-Anbieter die IP-Adresse deines Geräts, wenn es sich verbindet. Der Server nutzt sie nur in seinem Arbeitsspeicher: um zu begrenzen, wie viele Anfragen aus einem Netzwerk kommen können (Anmeldung, Registrierung und die übrigen Kontofunktionen, Zurücksetzen des Passworts, die Tour und Sicherungen), und für die Anmeldesperre. Diese Zähler umfassen höchstens die letzten 24 Stunden, und die Adresse wird nie in das Protokoll oder in den Speicher geschrieben.

## 3. Wie wir deine Daten nutzen

- **Um den Dienst bereitzustellen:** Anmeldung, Speichern deines Tagebuchs und Abgleich auf all deinen Geräten, Suche, Statistiken und Erkenntnisse zu deinen eigenen Einträgen, Backups, Exporte und Erinnerungen. Suchfragen werden auf dem Server beantwortet und dort nicht gespeichert.
- **E-Mail:** nur für deine Nachrichten zum Zurücksetzen des Passworts und für Sicherheitshinweise (dein Passwort wurde über eine Zurücksetzen-Nachricht geändert; die E-Mail-Adresse deines Kontos wurde geändert). Sie werden in der Sprache geschrieben, die bei deinen Kontodaten gespeichert ist; der Server öffnet dafür nicht dein Tagebuch. Keine Newsletter und kein Marketing.
- **Niemals:** keine Werbung, keine Analyse- oder Tracking-Werkzeuge, kein Profiling, kein Verkauf von Daten und keine Nutzung deines Tagebuchs zum Training einer KI.

Rechtsgrundlage (für Nutzer in der Europäischen Union und vergleichbare Gesetze): Wir verarbeiten deine Daten, um den Dienst bereitzustellen, für den du dich registriert hast (Vertragserfüllung, Art. 6 Abs. 1 lit. b DSGVO), und um ihn sicher zu halten (unser berechtigtes Interesse, Art. 6 Abs. 1 lit. f: Begrenzung von Versuchen, Sperren, technisches Protokoll). Dein Tagebuch kann sensible Informationen enthalten, etwa über deine Gesundheit oder deine Überzeugungen, wenn du sie aufschreibst. Wir verarbeiten sie nur, um sie für dich aufzubewahren und dir anzuzeigen, weil du uns durch das Aufschreiben darum gebeten hast (deine ausdrückliche Einwilligung, Art. 9 Abs. 2 lit. a); du kannst sie jederzeit entfernen, indem du Einträge bearbeitest oder löschst (Abschnitt 7 sagt, wie der alte Text gelöscht wird).

## 4. Wie dein Tagebuch geschützt ist - und wovor dieser Schutz nicht schützt

Was es schützt:

- Die Tagebuchdatei jedes Kontos ist mit AES-256-GCM verschlüsselt. Der Schlüssel wird mit scrypt aus deinem Passwort abgeleitet. Jede Änderung an der Datei wird erkannt.
- Auch die Festplatten des Hosting-Anbieters sind verschlüsselt (Verschlüsselung im Ruhezustand).
- Alle Verbindungen zwischen deinen Geräten und dem Server nutzen HTTPS (TLS).

Was du wissen solltest:

- **Solange du angemeldet bist, ist dein Tagebuch im Arbeitsspeicher des Servers entschlüsselt**, damit der Server es für dich anzeigen, durchsuchen und auswerten kann. Das ist keine „Ende-zu-Ende"-Verschlüsselung.
- **Der Betreiber kann technisch jedes Passwort zurücksetzen.** Damit „Passwort vergessen?" funktioniert, ohne dass dein Tagebuch verloren geht, bewahrt der Server für jedes Konto eine Kopie des Tagebuchschlüssels auf, verschlüsselt mit einem Serverschlüssel (ein „Wiederherstellungsschlüssel"). Der Serverschlüssel wird als Geheimnis der Hosting-Plattform außerhalb der gespeicherten Dateien aufbewahrt, sodass eine Kopie der Dateien allein nichts öffnet. Trotzdem könnte, wer den Server und seine Geheimnisse kontrolliert - der Betreiber und grundsätzlich der Hosting-Anbieter -, das Passwort jedes Kontos zurücksetzen und dessen Tagebuch lesen, ohne das Passwort zu kennen. Wir versprechen, das nicht zu tun. Wir haben kein Werkzeug dafür, und unsere Verwaltungswerkzeuge öffnen nie ein Tagebuch. Wenn du dich auf dieses Versprechen nicht verlassen möchtest, bewahre im Dienst nichts auf, das niemand sonst lesen soll.
- **Eine Anfrage zum Zurücksetzen des Passworts öffnet dein Tagebuch nicht.** Die Nachricht zum Zurücksetzen und die Sicherheitshinweise werden in der Sprache geschrieben, die bei deinen Kontodaten gespeichert ist (Abschnitt 2); eine Anfrage - von dir oder von jedem, der deine E-Mail-Adresse eingibt - lässt dein Tagebuch also geschlossen. Erst wenn das Zurücksetzen mit dem Link oder dem Code aus der Nachricht abgeschlossen wird, öffnet der Server dein Tagebuch mit dem Wiederherstellungsschlüssel, um es unter deinem neuen Passwort neu zu verschlüsseln.

## 5. Was auf deinem Gerät gespeichert wird

Auf jedem Gerät, auf dem du den Dienst nutzt:

- dein Anmelde-Token (damit du angemeldet bleibst), der zuletzt verwendete Benutzername, deine Sprach- und Anzeigeeinstellungen und deine letzten Suchfragen (werden beim Abmelden gelöscht).

**Ohne Verbindung.** Wenn die App den Server nicht erreicht, arbeitet sie weiter: Was du schreibst, wird verschlüsselt auf deinem Gerät gespeichert und automatisch auf den Server hochgeladen, sobald die Verbindung zurück ist, auch wenn die App zwischendurch geschlossen wurde. In der Windows- und der Android-App, wenn du „Angemeldet bleiben" gewählt hast, bewahrt die App außerdem eine verschlüsselte Kopie dessen auf, was sie dir zuletzt gezeigt hat (letzte Einträge, Gewohnheiten, die Daten von heute, den Kalendermonat und deine Einstellungen), damit du sie ohne Verbindung lesen kannst; andernfalls existiert diese Kopie nur im Arbeitsspeicher, solange die App geöffnet ist. Den Schlüssel zu diesen Kopien bewahrt der Server in deinem verschlüsselten Tagebuch auf; mit „Angemeldet bleiben" speichern ihn die Windows- und die Android-App auch auf dem Gerät, geschützt durch den Windows-Datenschutz oder den Android Keystore, damit sich die App ohne Verbindung öffnen lässt. Dein Passwort und dein Wiederherstellungsschlüssel werden nie auf dem Gerät gespeichert. Damit jede Änderung genau einmal hochgeladen wird, bewahrt die App außerdem eine verschlüsselte Liste der Änderungen auf, die sie in den letzten 7 Tagen hochgeladen hat.

- **Windows-App:** Diese Kopien liegen in den Datenordnern der App in deinem Windows-Benutzerprofil (bei der Microsoft-Store-Version im eigenen Paketordner der App). Der Schlüssel ist durch den Windows-Datenschutz (DPAPI) geschützt und funktioniert nur für deinen Windows-Benutzer.
- **Android-App:** Diese Kopien liegen im privaten Speicher der App, den andere Apps nicht lesen können und der von Sicherungen ausgenommen ist. Der Schlüssel ist durch den Android Keystore geschützt.
- TODO-TRANSLATE: **Mac app:** these copies are kept in the app's folder inside your user Library (Application Support/app.yourpersonaldiary.mac). The key is kept as an item of your Mac user's login keychain, named "Your Personal Diary offline key" and never synchronized to iCloud Keychain; it is protected by your Mac login password and can be read only by the app. A Migration Assistant or Time Machine copy of your user account carries the item, still protected by that password. Once the app is distributed with Apple's signature, the item will move to the keychain that stays on this Mac only.
- TODO-TRANSLATE: **iPhone app:** these copies are kept in the app's private storage, excluded from iCloud backup. The key is kept in the iOS Keychain, available only on this device after it was unlocked once, and removed when you sign out.
- **Website:** Im Browser werden, verschlüsselt, nur die noch nicht hochgeladenen Änderungen, die Liste der letzten 7 Tage und die Hinweise zu widersprüchlichen Änderungen (siehe unten) gespeichert, aber keine Kopie dessen, was du gelesen hast; der Schlüssel bleibt im Arbeitsspeicher und ist weg, wenn du die Seite schließt.

Wenn die Verbindung zurück ist, lädt die App deine Änderungen in der Reihenfolge hoch, in der du sie gemacht hast, jede genau einmal. Wurde derselbe Eintrag, dieselbe Gewohnheit oder Einstellung auch auf einem anderen Gerät geändert, bleibt die neuere Änderung erhalten und die App sagt es dir in einer Zeile; die andere Fassung bleibt auf diesem Gerät für dich verfügbar, bis du den Hinweis schließt.

Wenn die App das Entsperren mit der Bildschirmsperre deines Geräts anbietet (Windows Hello oder die Bildschirmsperre bzw. der Fingerabdruck unter Android), erfolgt die Prüfung durch das Betriebssystem. Nichts über deinen Fingerabdruck, dein Gesicht oder deine PIN erreicht die App oder uns. Gewohnheits-Erinnerungen in der Android-App werden auf dem Smartphone selbst geplant; es wird kein Push-Dienst verwendet.

Dateien, die du selbst erstellst: Ein **Backup** ist mit einem Passwort verschlüsselt; ein **Export** (TXT, CSV, JSON oder PDF) ist eine gewöhnliche lesbare Datei. Du entscheidest, wo du sie speicherst, und jeder, der eine Exportdatei bekommt, kann sie lesen.

## 6. Wer sonst Daten erhält

Wir nutzen zwei Dienstleister. Sie verarbeiten Daten nur in unserem Auftrag, um den Dienst zu betreiben:

- **Fly.io, Inc.** (USA) - Hosting des Servers in Frankfurt, Deutschland. Ihre Systeme enthalten die verschlüsselten Tagebuchdateien, die Kontodaten und die übrigen Daten aus Abschnitt 2 und erhalten Verbindungsdaten wie IP-Adressen. Da Fly.io ein US-Unternehmen ist, kann es von außerhalb der Europäischen Union auf die Daten zugreifen; dies ist durch seine Bedingungen zur Auftragsverarbeitung geregelt. Seine Datenschutzerklärung: `fly.io/legal/privacy-policy`.
- **Google (Gmail)** - versendet die Nachrichten zum Zurücksetzen des Passworts und die Sicherheitshinweise. Google erhält die Nachricht, deine E-Mail-Adresse sowie den darin enthaltenen Vornamen und Benutzernamen. Eine Nachricht enthält nie etwas aus deinem Tagebuch. Datenschutzerklärung von Google: `policies.google.com/privacy`.

Auch die App-Stores verarbeiten nach ihren eigenen Datenschutzerklärungen Daten, wenn du die Apps herunterlädst: **Google Play** für die Android-App und der **Microsoft Store** für die Windows-App (zum Beispiel Installationen, Bewertungen und Absturzberichte, die ihre Systeme erfassen). Die Apps enthalten keinen Code von ihnen oder von anderen, der Daten an sie sendet.

Wir verkaufen, vermieten oder teilen deine personenbezogenen Daten mit niemand anderem. Wir würden Daten nur herausgeben, wenn das Gesetz es verlangt.

## 7. Wie lange wir Daten aufbewahren und wie du sie löschst

- Wir bewahren dein Konto und dein Tagebuch auf, bis du sie löschst. Anmeldesitzungen enden nach 12 Stunden oder mit „Angemeldet bleiben" nach 90 Tagen. Anfragen zum Zurücksetzen des Passworts verfallen nach 30 Minuten. Die Kopien auf einem Gerät bleiben, bis du dich auf diesem Gerät abmeldest.
- **Konto in der App oder auf der Website löschen:** Melde dich an, öffne **Einstellungen - Konto löschen**, gib dein Passwort ein und bestätige. Das löscht sofort vom Server dein Konto, dein Tagebuch, deine Gewohnheiten und Einstellungen, deine Anmeldung auf allen Geräten und alle Anfragen zum Zurücksetzen des Passworts, und es löscht die Offline-Kopie auf dem Gerät, das du gerade nutzt. Änderungen, die auf deinen anderen Geräten noch warten, können danach nicht mehr hochgeladen werden und gehen verloren.
- **Kopien in Sicherungen des Servers:** Der Hosting-Anbieter erstellt täglich einen Snapshot des Serverspeichers. Kopien eines gelöschten Kontos in diesen Snapshots werden innerhalb von 30 Tagen automatisch gelöscht.
- **Verschlüsselte Serverarchive des Betreibers:** Um sich von einem Notfall erholen zu können, erstellt der Betreiber etwa einmal im Monat ein verschlüsseltes Archiv des Serverspeichers; der Server behält nur die 2 neuesten, und der Betreiber bewahrt höchstens die 3 neuesten offline auf einem Laufwerk auf, das nicht mit dem Internet verbunden ist, sodass Kopien eines gelöschten Kontos daraus verschwinden, sobald neuere Archive sie ersetzen, normalerweise innerhalb von drei Monaten.
- **Gelöschte oder geänderte Einträge** verschwinden sofort aus der App, und ihr alter Text wird in deiner Tagebuchdatei auf dem Server gelöscht, sobald die Änderung gespeichert wird, einen Augenblick später: Der Server überschreibt gelöschte Daten, statt den Platz nur als frei zu markieren. Die vorherige Fassung der Datei, die der Server für den Fall eines fehlgeschlagenen Speicherns aufbewahrt, wird beim nächsten Speichern ersetzt. Text, der gelöscht wurde, bevor es diesen Schutz gab, wird gelöscht, wenn dein Tagebuch nach dem Update zum ersten Mal geöffnet wird (zum Beispiel bei deiner Anmeldung). Auf dem Server bleiben frühere Fassungen danach nur in den täglichen Snapshots des Speichers, bis zu 30 Tage lang, und verschlüsselt in ungenutztem Platz seiner Festplatte, bis dieser Platz wieder verwendet wird; Sicherungsdateien, die du vorher erstellt hast, behalten den Text, den sie enthalten. Wenn du dein Konto löschst, wird die ganze Datei gelöscht.
- **Wenn du dich nicht anmelden kannst:** Schreibe an [{{CONTACT_EMAIL}}](mailto:{{CONTACT_EMAIL}}) von der E-Mail-Adresse, die in deinem Konto hinterlegt ist. Wir bestätigen die Anfrage und löschen das Konto innerhalb von 30 Tagen. Alle Einzelheiten: [{{DELETE_URL}}]({{DELETE_URL}}).
- **Das Deinstallieren der App löscht dein Konto nicht.** Wenn du das möchtest, lösche es vorher in den Einstellungen. Beim Abmelden werden die Kopien und der Schlüssel von diesem Gerät gelöscht; warten noch Änderungen auf das Hochladen, fragt die App vorher nach. Unter Windows bleibt beim Deinstallieren der heruntergeladenen Version (Setup-Datei) die verschlüsselte Kopie erhalten, es sei denn, du wählst das Löschen der App-Daten; melde dich zur Sicherheit vorher ab.
- Inaktive Konten löschen wir derzeit nicht automatisch. Wenn wir damit beginnen, schreiben wir es hier, bevor es gilt.

## 8. Sicherheitsmaßnahmen

- Nur HTTPS; der Server lehnt Verbindungen ab, die nicht über seine sichere Adresse kommen.
- Begrenzung von Anmelde- und Registrierungsversuchen. Nach 10 falschen Passwörtern wird die Anmeldung aus diesem Netzwerk für 15 Minuten gesperrt, und weitere Versuche für das Konto werden verlangsamt.
- Das Tagebuch sperrt sich nach einer Zeit ohne Aktivität selbst. Das Ändern des Passworts oder der E-Mail-Adresse und das Löschen des Kontos erfordern dein Passwort.
- Der Serverschlüssel wird außerhalb der gespeicherten Dateien aufbewahrt, und nur der Betreiber kann den Server verwalten.
- Wer Programme als dein Windows-Benutzer ausführen kann oder die volle Kontrolle über ein gerootetes Handy hat, könnte die für „Angemeldet bleiben" gespeicherte Kopie lesen.

Kein System kann vollkommene Sicherheit versprechen. Wähle ein starkes Passwort, das du nirgendwo sonst verwendest, halte deine Geräte aktuell und bewahre ein Backup auf.

## 9. Deine Rechte

Du kannst deine Daten selbst einsehen, berichtigen, exportieren und löschen: Dein Profil findest du in den Einstellungen, jeder Eintrag lässt sich bearbeiten oder löschen, **Einstellungen - Backup** und der Export erstellen eine Kopie, die du mitnehmen kannst, und **Konto löschen** entfernt alles. Du kannst uns auch schreiben, um eine Kopie deiner Daten, ihre Berichtigung, Löschung oder die Einschränkung der Verarbeitung zu verlangen oder der Verarbeitung zu widersprechen, und du kannst eine Einwilligung jederzeit widerrufen. Wir antworten innerhalb von 30 Tagen. Du hast außerdem das Recht, dich bei einer Datenschutzbehörde zu beschweren - in der Europäischen Union bei der Behörde deines Landes, in Israel bei der Datenschutzbehörde (Privacy Protection Authority).

## 10. Kinder

Der Dienst richtet sich nicht an Kinder. Um ein Konto zu erstellen, musst du mindestens {{MINIMUM_AGE}} Jahre alt sein. Wir erheben nicht wissentlich Daten von Jüngeren. Wenn du glaubst, dass ein jüngeres Kind ein Konto erstellt hat, schreibe uns, und wir löschen es.

## 11. Kein medizinisches Werkzeug

Die Erkenntnisse in der App beschreiben mögliche Zusammenhänge in deinen eigenen Einträgen. Sie beweisen keine Ursache und Wirkung und sind keine medizinische oder psychologische Beratung.

## 12. Änderungen dieser Erklärung

Wenn sich der Dienst oder diese Erklärung ändert, aktualisieren wir diese Seite und das Datum oben. Betrifft eine Änderung, was wir mit deinen Daten tun, schreiben wir es auf dieser Seite, bevor sie wirksam wird.

## 13. Kontakt

Fragen zum Datenschutz oder zu deinen Daten: [{{CONTACT_EMAIL}}](mailto:{{CONTACT_EMAIL}})

{{PUBLISHER_NAME}}
