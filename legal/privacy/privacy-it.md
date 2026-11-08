---
title: Informativa sulla privacy - Your Personal Diary
description: Come Your Personal Diary (app Android, app Windows e sito web) conserva e protegge i tuoi dati.
languages: Lingue
otherPage: Come eliminare il tuo account
---

# Informativa sulla privacy - Your Personal Diary

Data di entrata in vigore: {{EFFECTIVE_DATE}}

## In breve

- Your Personal Diary è un unico servizio con tre accessi: l'**app Android** (Google Play), l'**app Windows** (Microsoft Store o un file di installazione) e il **sito web** [{{SITE_URL}}]({{SITE_URL}}). Tutti e tre usano lo stesso server e lo stesso account.
- Il tuo diario è conservato sul nostro server in un file cifrato con una chiave derivata dalla tua password. Anche i dati del tuo account sono conservati lì.
- Usiamo i tuoi dati solo per far funzionare il tuo diario. Niente pubblicità, niente statistiche di utilizzo, niente tracciamento, e non vendiamo né condividiamo i tuoi dati.
- Conosci i limiti: mentre hai effettuato l'accesso, il server tiene il tuo diario aperto nella sua memoria, e chi gestisce il server potrebbe tecnicamente reimpostare la tua password e leggere il tuo diario. La sezione 4 lo spiega con chiarezza.
- Puoi eliminare il tuo account e il tuo diario in qualsiasi momento da **Impostazioni - Eliminazione dell'account**.

## 1. Chi siamo

Il servizio è gestito da {{PUBLISHER_NAME}} ("noi"), che è responsabile dei tuoi dati personali (il "titolare del trattamento"). Contatto: [{{CONTACT_EMAIL}}](mailto:{{CONTACT_EMAIL}}).

Questa informativa si applica all'app Android, all'app Windows e al sito web. Mostrano lo stesso diario e seguono le stesse regole; dove un'app si comporta in modo diverso, questa informativa lo indica.

## 2. Che cosa conserviamo sul server e dove

Il server funziona presso il fornitore di hosting Fly.io, nel suo data center di **Francoforte, Germania (Unione europea)**. Conserva:

- **Dati dell'account:** nome, cognome, nome utente e indirizzo e-mail, un ID account, la lingua in cui usi l'app, quando è stato creato l'account e quando hai effettuato l'ultimo accesso. Quando crei l'account, conserviamo anche una registrazione della tua conferma di aver letto questa informativa e di accettarla: il momento della conferma e la data di entrata in vigore della versione che hai confermato. Se cambi indirizzo e-mail, l'indirizzo precedente e la data della modifica restano con l'account finché non cambi di nuovo indirizzo o elimini l'account. L'app non cifra questi dati, perché il server ne ha bisogno per farti accedere e per scriverti; chi gestisce il server può quindi vederli.
- **La tua password:** non viene conservata. Il server conserva solo un valore derivato da essa (scrypt) che gli permette di verificarla.
- **Il tuo diario:** le voci (testo e i campi facoltativi umore, emozioni, energia, stress, sonno, attività fisica, eventi, persone, luogo, note e tag), le abitudini e le loro registrazioni, e le tue impostazioni. Ogni account ha il proprio file di diario cifrato.
- **Sessioni di accesso:** per ogni dispositivo su cui hai effettuato l'accesso: il tipo di dispositivo ("Computer", "Telefono" o "Browser"), quando è iniziata la sessione, quando è stata usata l'ultima volta e quando termina. Il token di accesso è conservato solo come hash. Con "Ricordami", la sessione contiene anche la chiave del tuo diario, cifrata con la chiave del server (sezione 4).
- **Richieste di reimpostazione della password:** un hash del link e del codice, validi 30 minuti e utilizzabili una sola volta.
- **La chiave delle copie offline** sui tuoi dispositivi (sezione 5), conservata all'interno del tuo diario cifrato.
- **Le impostazioni di invio e-mail del gestore** (l'account Gmail del gestore stesso, con la password conservata cifrata). Non contengono nulla che ti riguardi.
- **Un registro tecnico** degli eventi di avvio e degli errori. Non contiene contenuti del diario, indirizzi e-mail né indirizzi IP.

**Il tour** ("Salta - voglio solo dare un'occhiata", nell'app Android) crea un diario ospite temporaneo con dati di esempio. Esiste solo nella memoria del server, termina da solo dopo 30 minuti e non viene mai conservato.

Come per qualsiasi sito web, il server e il fornitore di hosting ricevono l'indirizzo IP del tuo dispositivo quando si collega. Il server lo usa solo nella sua memoria: per limitare quante richieste possono arrivare da una stessa rete (accesso, registrazione e le altre funzioni dell'account, reimpostazione della password, il tour e i backup) e per il blocco dell'accesso. Questi contatori coprono al massimo le ultime 24 ore, e l'indirizzo non viene mai scritto nel registro né nell'archivio.

## 3. Come usiamo i tuoi dati

- **Per fornire il servizio:** accesso, conservazione del diario e allineamento su tutti i tuoi dispositivi, ricerca, statistiche e approfondimenti sulle tue voci, backup, esportazioni e promemoria. Le domande di ricerca ricevono risposta sul server e non vi vengono conservate.
- **E-mail:** solo per i tuoi messaggi di reimpostazione della password e per gli avvisi di sicurezza (la tua password è stata cambiata con un messaggio di reimpostazione; l'indirizzo e-mail del tuo account è stato cambiato). Sono scritti nella lingua salvata con i dati del tuo account; il server non apre il tuo diario per scriverli. Niente newsletter e niente marketing.
- **Mai:** niente pubblicità, niente strumenti di analisi o tracciamento, niente profilazione, nessuna vendita di dati e nessun uso del tuo diario per addestrare un'IA.

Base giuridica (per gli utenti dell'Unione europea e leggi simili): trattiamo i tuoi dati per fornire il servizio a cui ti sei iscritto (esecuzione di un contratto, articolo 6, paragrafo 1, lettera b, del GDPR) e per mantenerlo sicuro (nostro legittimo interesse, articolo 6, paragrafo 1, lettera f: limiti ai tentativi, blocchi, registro tecnico). Il tuo diario può contenere informazioni sensibili, per esempio sulla tua salute o sulle tue convinzioni, se scegli di scriverle. Le trattiamo solo per conservarle per te e mostrartele, perché ce lo hai chiesto scrivendole (il tuo consenso esplicito, articolo 9, paragrafo 2, lettera a); puoi rimuoverle in qualsiasi momento modificando o eliminando le voci (la sezione 7 spiega come viene cancellato il vecchio testo).

## 4. Come è protetto il tuo diario - e da che cosa non ti protegge

Che cosa lo protegge:

- Il file di diario di ogni account è cifrato con AES-256-GCM. La chiave è derivata dalla tua password con scrypt. Qualsiasi modifica al file viene rilevata.
- Anche i dischi del fornitore di hosting sono cifrati (cifratura a riposo).
- Tutte le connessioni tra i tuoi dispositivi e il server usano HTTPS (TLS).

Che cosa devi sapere:

- **Mentre hai effettuato l'accesso, il tuo diario è decifrato nella memoria del server**, così che il server possa mostrarlo, cercarvi e analizzarlo per te. Non è una cifratura "end-to-end".
- **Il gestore può tecnicamente reimpostare qualsiasi password.** Perché "Password dimenticata?" funzioni senza perdere il diario, il server conserva per ogni account una copia della chiave del diario, cifrata con una chiave del server (una "chiave di recupero"). La chiave del server è conservata come segreto della piattaforma di hosting, al di fuori dei file archiviati, quindi una copia dei file da sola non apre nulla. Tuttavia chi controlla il server e i suoi segreti - il gestore e, in linea di principio, il fornitore di hosting - potrebbe reimpostare la password di qualsiasi account e leggerne il diario senza conoscere la password. Ci impegniamo a non farlo. Non abbiamo alcuno strumento per farlo, e i nostri strumenti di amministrazione non aprono mai un diario. Se non sei disposto a fidarti di questo impegno, non conservare nel servizio nulla che non vorresti fosse letto da altri.
- **Una richiesta di reimpostazione della password non apre il tuo diario.** Il messaggio di reimpostazione e gli avvisi di sicurezza sono scritti nella lingua salvata con i dati del tuo account (sezione 2), quindi una richiesta - fatta da te o da chiunque digiti il tuo indirizzo e-mail - lascia il tuo diario chiuso. Solo quando la reimpostazione viene completata con il link o il codice del messaggio il server apre il tuo diario con la chiave di recupero, per cifrarlo di nuovo con la tua nuova password.

## 5. Che cosa viene conservato sul tuo dispositivo

Su ogni dispositivo su cui usi il servizio:

- il token di accesso (per restare connesso), l'ultimo nome utente, le preferenze di lingua e di visualizzazione e le tue domande di ricerca recenti (cancellate quando esci).

**Senza connessione.** Se l'app non riesce a raggiungere il server, continua a funzionare: ciò che scrivi viene salvato sul dispositivo, cifrato, e caricato automaticamente sul server quando la connessione torna, anche se nel frattempo l'app è stata chiusa. Nelle app Windows e Android, se hai scelto "Ricordami", l'app conserva anche una copia cifrata di ciò che ti ha mostrato di recente (voci recenti, abitudini, dati di oggi, il mese del calendario e le tue impostazioni), così da poterla leggere senza connessione; altrimenti quella copia esiste solo in memoria finché l'app è aperta. Il server conserva la chiave di queste copie all'interno del tuo diario cifrato; con "Ricordami", le app Windows e Android la conservano anche sul dispositivo, protetta dalla protezione dei dati di Windows o dall'Android Keystore, così che l'app possa aprirsi senza connessione. La tua password e la tua chiave di recupero non vengono mai conservate sul dispositivo. Perché ogni modifica venga caricata esattamente una volta, l'app conserva anche, cifrato, un registro delle modifiche caricate negli ultimi 7 giorni.

- **App Windows:** queste copie sono conservate nelle cartelle dati dell'app all'interno del tuo profilo utente di Windows (nella versione Microsoft Store, nella cartella del pacchetto dell'app). La chiave è protetta dalla protezione dei dati di Windows (DPAPI) e funziona solo per il tuo utente Windows.
- **App Android:** queste copie sono conservate nella memoria privata dell'app, che le altre app non possono leggere ed è esclusa dai backup. La chiave è protetta dall'Android Keystore.
- **Sito web:** nel browser sono conservati, cifrati, solo le modifiche non ancora caricate, il registro degli ultimi 7 giorni e gli avvisi sulle modifiche in conflitto (vedi sotto), ma nessuna copia di ciò che hai letto; la chiave resta in memoria e scompare quando chiudi la pagina.

Quando la connessione torna, l'app carica le modifiche che hai fatto, nell'ordine in cui le hai fatte, ognuna esattamente una volta. Se la stessa voce, abitudine o impostazione è stata modificata anche su un altro dispositivo, viene mantenuta la modifica più recente e l'app te lo dice in una riga; l'altra versione resta disponibile su questo dispositivo finché non chiudi l'avviso.

Se l'app propone lo sblocco con il blocco schermo del dispositivo (Windows Hello, oppure il blocco schermo o l'impronta digitale di Android), la verifica è fatta dal sistema operativo. Nulla sulla tua impronta, sul tuo volto o sul tuo PIN arriva all'app o a noi. I promemoria delle abitudini nell'app Android sono programmati sul telefono stesso; non è coinvolto alcun servizio di notifiche push.

File che crei tu: un **backup** è cifrato con una password; un'**esportazione** (TXT, CSV, JSON o PDF) è un normale file leggibile. Decidi tu dove salvarli, e chiunque ottenga un file esportato può leggerlo.

## 6. Chi altro riceve dati

Usiamo due fornitori di servizi. Trattano i dati solo per nostro conto, per far funzionare il servizio:

- **Fly.io, Inc.** (Stati Uniti) - hosting del server a Francoforte, in Germania. I suoi sistemi contengono i file di diario cifrati, i dati degli account e gli altri dati della sezione 2, e ricevono dati di connessione come gli indirizzi IP. Poiché Fly.io è una società statunitense, può accedere ai dati dall'esterno dell'Unione europea; ciò è coperto dalle sue condizioni sul trattamento dei dati. La sua informativa sulla privacy: `fly.io/legal/privacy-policy`.
- **Google (Gmail)** - invia i messaggi di reimpostazione della password e gli avvisi di sicurezza. Google riceve il messaggio, il tuo indirizzo e-mail e il nome e il nome utente che contiene. Un messaggio non contiene mai nulla del tuo diario. Informativa sulla privacy di Google: `policies.google.com/privacy`.

Anche gli store di app trattano dati secondo le proprie informative sulla privacy quando scarichi le app: **Google Play** per l'app Android e **Microsoft Store** per l'app Windows (per esempio installazioni, valutazioni e segnalazioni di arresti anomali raccolte dai loro sistemi). Le app non contengono codice loro o di chiunque altro che invii loro dati.

Non vendiamo, non affittiamo e non condividiamo i tuoi dati personali con nessun altro. Comunicheremmo dati solo se la legge lo richiedesse.

## 7. Per quanto tempo conserviamo i dati e come eliminarli

- Conserviamo il tuo account e il tuo diario finché non li elimini. Le sessioni terminano dopo 12 ore, oppure dopo 90 giorni con "Ricordami". Le richieste di reimpostazione della password scadono dopo 30 minuti. Le copie su un dispositivo restano finché non esci da quel dispositivo.
- **Eliminare l'account nell'app o sul sito web:** accedi, apri **Impostazioni - Eliminazione dell'account**, inserisci la password e conferma. In questo modo vengono eliminati subito dal server il tuo account, il diario, le abitudini e le impostazioni, il tuo accesso su tutti i dispositivi ed eventuali richieste di reimpostazione della password, e viene eliminata la copia offline sul dispositivo che stai usando. Le modifiche ancora in attesa sugli altri tuoi dispositivi non potranno più essere caricate e andranno perse.
- **Copie nei backup del server:** il fornitore di hosting crea ogni giorno uno snapshot dell'archivio del server. Le copie di un account eliminato in questi snapshot vengono cancellate automaticamente entro 30 giorni.
- **Copie complete cifrate del server:** per potersi riprendere da un disastro, il gestore crea circa una volta al mese una copia completa cifrata dell'archivio del server; il server conserva solo le 2 più recenti, e il gestore conserva al massimo le 3 più recenti offline, su un'unità non collegata a internet, quindi le copie di un account eliminato ne scompaiono man mano che copie più recenti le sostituiscono, normalmente entro tre mesi.
- **Le voci eliminate o modificate** spariscono subito dall'app, e il loro vecchio testo viene cancellato dal file del tuo diario sul server quando la modifica viene salvata, un attimo dopo: il server sovrascrive i dati eliminati invece di segnare soltanto lo spazio come libero. La versione precedente del file, che il server conserva nel caso in cui un salvataggio non riesca, viene sostituita al salvataggio successivo. Il testo eliminato prima che esistesse questa protezione viene cancellato la prima volta che il tuo diario viene aperto dopo l'aggiornamento (per esempio quando accedi). Sul server, le versioni precedenti restano poi solo negli snapshot giornalieri dello spazio di archiviazione, fino a 30 giorni, e, cifrate, nello spazio inutilizzato del suo disco finché quello spazio non viene riutilizzato; i file di backup che hai creato prima conservano il testo che contengono. Eliminando l'account si cancella l'intero file.
- **Se non riesci ad accedere:** scrivi a [{{CONTACT_EMAIL}}](mailto:{{CONTACT_EMAIL}}) dall'indirizzo e-mail registrato nel tuo account. Confermeremo la richiesta ed elimineremo l'account entro 30 giorni. Tutti i dettagli: [{{DELETE_URL}}]({{DELETE_URL}}).
- **Disinstallare l'app non elimina il tuo account.** Se è questo che vuoi, eliminalo prima dalle Impostazioni. Uscire cancella le copie e la chiave da quel dispositivo; se ci sono ancora modifiche da caricare, l'app te lo chiede prima. Su Windows, disinstallare la versione scaricata (file di installazione) mantiene la copia cifrata, a meno che tu scelga di eliminare i dati dell'app; per sicurezza, esci prima.
- Al momento non eliminiamo automaticamente gli account inattivi. Se iniziassimo a farlo, lo indicheremo qui prima che si applichi.

## 8. Misure di sicurezza

- Solo HTTPS; il server rifiuta le connessioni che non arrivano dal suo indirizzo sicuro.
- Limiti ai tentativi di accesso e di registrazione. Dopo 10 password errate, l'accesso da quella rete viene bloccato per 15 minuti e gli ulteriori tentativi sull'account vengono rallentati.
- Il diario si blocca da solo dopo un periodo di inattività. Cambiare la password o l'indirizzo e-mail ed eliminare l'account richiedono la tua password.
- La chiave del server è conservata al di fuori dei file archiviati, e solo il gestore può amministrare il server.
- Chi può eseguire programmi come il tuo utente di Windows, o chi ha il pieno controllo di un telefono con root, potrebbe leggere la copia conservata per "Ricordami".

Nessun sistema può promettere una sicurezza perfetta. Scegli una password robusta che non usi altrove, mantieni aggiornati i tuoi dispositivi e conserva un backup.

## 9. I tuoi diritti

Puoi vedere, correggere, esportare ed eliminare i tuoi dati da solo: il tuo profilo è nelle Impostazioni, ogni voce può essere modificata o eliminata, **Impostazioni - Backup** e l'esportazione creano una copia che puoi portare altrove, ed **Eliminazione dell'account** rimuove tutto. Puoi anche scriverci per chiedere una copia dei tuoi dati, la rettifica, la cancellazione o la limitazione del trattamento, o per opporti al trattamento, e puoi revocare un consenso in qualsiasi momento. Rispondiamo entro 30 giorni. Hai anche il diritto di presentare reclamo a un'autorità di protezione dei dati: nell'Unione europea l'autorità del tuo Paese, in Israele l'Autorità per la protezione della privacy.

## 10. Minori

Il servizio non è rivolto ai minori. Per creare un account devi avere almeno {{MINIMUM_AGE}} anni. Non raccogliamo consapevolmente dati di persone più giovani. Se pensi che un minore più giovane abbia creato un account, scrivici e lo elimineremo.

## 11. Non è uno strumento medico

Gli approfondimenti dell'app descrivono possibili relazioni nelle tue voci. Non dimostrano rapporti di causa ed effetto e non sono consigli medici o psicologici.

## 12. Modifiche a questa informativa

Quando il servizio o questa informativa cambiano, aggiorniamo questa pagina e la data di entrata in vigore in alto. Se una modifica riguarda ciò che facciamo con i tuoi dati, lo indicheremo in questa pagina prima che si applichi.

## 13. Contatti

Domande sulla privacy o sui tuoi dati: [{{CONTACT_EMAIL}}](mailto:{{CONTACT_EMAIL}})

{{PUBLISHER_NAME}}
