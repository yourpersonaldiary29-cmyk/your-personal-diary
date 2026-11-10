# Export compliance (encryption) - the answers, the Info.plist key and the yearly report

Package ANSWERS, written 2026-11-08. **This is not legal advice.** It sets out what Apple and the U.S. Bureau of Industry and Security (BIS) publish (FACTS section 5) and what the apps' code actually does, and it names one low-cost default and one alternative. The decision is the owner's.

## 1. Why Apple asks

Every app uploaded to App Store Connect goes to a server in the United States; an app that "uses, accesses, contains, implements, or incorporates encryption" is then an export of encryption software under U.S. law, wherever the developer lives (FACTS 5.1). App Store Connect asks the export questions for every new version unless the Info.plist answers them in advance (FACTS 5.1, 5.6).

## 2. The answer: the Info.plist key, both apps

| App | File | Key and value |
| --- | --- | --- |
| iPhone | `mobile/ios-app/InfoAdditions.plist`, merged on the Mac into `ios/App/App/Info.plist` (`scripts/ios/README.he.md` section 5.2) | `ITSAppUsesNonExemptEncryption` = `false` (NO) |
| Mac | `src-tauri/Info.plist` (merged by Tauri into the bundle's Info.plist; `scripts/mac/release.sh` prints the value from the built bundle) | `ITSAppUsesNonExemptEncryption` = `false` (NO) |

Apple: "Set the value to NO if your app - including any third-party libraries it links against - doesn't use encryption, or if it only uses forms of encryption that are exempt from export compliance documentation requirements." (FACTS 5.2) and "Typically, the use of encryption that's built into the operating system - for example, when your app makes HTTPS connections using URLSession - is exempt from export documentation upload requirements, whereas the use of proprietary encryption is not." (FACTS 5.3). With the key present, App Store Connect skips the questions and the build is not marked "Missing Compliance" (FACTS 5.5, 8.8). ENV-FINAL decision 5 stands: FACTS found no Apple rule that contradicts it (FACTS 5.3).

If the questions appear anyway (for example if the key is missing from a build): Apple does not print the exact question texts (FACTS 5.5 - NOT FOUND). Answer by meaning: the app **uses encryption: yes**; it uses only encryption provided by Apple's operating system / it **qualifies for the exemption: yes**; it does **not** use proprietary or non-standard algorithms; **no** documentation is uploaded. The France question (FACTS 5.5): French controls concern "Secure Storage, Secure Communications, and Security Anti-Virus applications"; this app is a diary that relies on the operating system's HTTPS and keychain and is not a secure-storage or secure-communication product - answer that it is not such an app / does not need a French declaration, in whatever form the dialog asks it. No App Encryption Documentation is uploaded and no `ITSEncryptionExportComplianceCode` is needed (FACTS 5.6).

## 3. What the apps' encryption actually is (from the code)

| Where | What | Who provides the cipher |
| --- | --- | --- |
| Every connection to `https://yourpersonaldiary.fly.dev` | HTTPS / TLS | the operating system's networking inside WebKit (iPhone: WKWebView of Capacitor; Mac: WKWebView of Tauri). The apps contain no TLS library. |
| The encrypted copies on the device (offline mode, outbox mirror) | AES-256-GCM through the browser's Web Crypto API (`crypto.subtle.encrypt/decrypt`) | WebKit's Web Crypto = the operating system (`src/offline/**`) |
| The device key that protects those copies | iPhone: AES-GCM through **CryptoKit** (`AES.GCM.seal/open`) with the key kept in the **Keychain** (`kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`, not synchronizable) - `mobile/plugins/diary-offline/ios/DiaryOfflinePlugin.swift`; Mac: an item of the Keychain (Security framework, `objc2-security` bindings in `src-tauri/Cargo.toml`) | the operating system |
| Unlock by Face ID / Touch ID / device passcode | LocalAuthentication (`LAContext`) | the operating system |
| Offline unlock by password (decision 2026-11-08) | the password is stretched with **scrypt** by the JavaScript library `@noble/hashes` (`src/offline/password-wrap.ts`); the resulting key is then used with Web Crypto AES-GCM | scrypt: a library bundled in the app (a key-derivation function, not a cipher); AES-GCM: the operating system |
| The diary file on the server, the recovery key, the password verifier | scrypt + AES-256-GCM | **the server only** (`server/src/security/kdf.ts`, `vault.ts`), running at Fly.io in Germany - not part of either app bundle. The published apps contain no server code: the Mac app's release configuration `src-tauri/tauri.conf.json` ships no sidecar (the Node server is only in `tauri.local.conf.json`, the developer's local mode), and the iPhone app is built in the "server" mode of `mobile/vite.config.mobile.ts`, which contains no worker core (the `@noble/ciphers` AES shim of `mobile/core/shims/crypto.ts` belongs to the developer-only "local-core" build). |
| Hashing inside the Mac shell | the Tauri framework depends on the Rust `sha2` hash crate (`src-tauri/Cargo.lock`) | a hash function, not encryption |

Honest note for an adviser: the apps bundle two non-OS cryptographic primitives - the scrypt key derivation of `@noble/hashes` (JavaScript, in both apps' user interface) and Tauri's SHA-256 crate (Mac). Neither encrypts data; every encryption of data in the apps is performed by Apple's operating system. This package reads that as "only encryption that is exempt"; whether a lawyer agrees is part of the open question in section 4.

## 4. The yearly self-classification report to the U.S. government

Apple: "If your app uses exempt forms of encryption, you might alternatively be required to submit a year-end self-classification report to the U.S. government." (FACTS 5.7). BIS ties the report to items "exported under License Exception ENC - 740.17(b)(1)" (FACTS 5.8); mass-market software self-classified as **5D992** is such an item (FACTS 5.9). Whether an app that only calls the operating system's encryption is an "encryption item" at all is a legal classification question that neither Apple nor BIS answers (FACTS 5.10 - NOT FOUND). Two defensible courses (ANSWERS amendment 4):

### (a) The low-cost default: file the short report

- **What**: one CSV file (only `.csv` is accepted; FACTS 5.8, 5.9a).
- **When**: by **1 February** of the year after the first upload of the apps to Apple (first upload in 2026 -> by 1 February 2027; first upload in 2027 -> by 1 February 2028) (FACTS 5.8, 5.9).
- **To whom**: one e-mail with the CSV attached, to **crypt-supp8@bis.doc.gov** and **enc@nsa.gov**, subject **self-classification report** (FACTS 5.8; postal filing is an alternative, FACTS 5.9).
- **Every following year, by 1 February**: if nothing new was made eligible for export, an e-mail to the same two addresses "stating that nothing has changed since the previous report" (or a copy of the previous report) (FACTS 5.8, 5.9). A new product (not a new version of the same app) goes into the next year's report. If no export happened in a calendar year, no report is needed for that year (FACTS 5.8).
- **The file** - the first line exactly as below, then one line per product; **no field may be empty, and commas are allowed only between fields** - so write the address and the city without commas (FACTS 5.8, 5.9a):

```
PRODUCT NAME,MODEL NUMBER,MANUFACTURER,ECCN,AUTHORIZATION TYPE,ITEM TYPE,SUBMITTER NAME,TELEPHONE NUMBER,E-MAIL ADDRESS,MAILING ADDRESS,NON-U.S. COMPONENTS,NON-U.S. MANUFACTURING LOCATIONS
Your Personal Diary,iPhone app and Mac app,SELF,5D992,MMKT,Mobility and mobile applications n.e.s.,Ouriel Sebag,<+972 phone>,yourpersonaldiary29@gmail.com,<street number city postcode Israel>,NO,<city> Israel
```

| Column | Value | Rule (FACTS 5.9a) |
| --- | --- | --- |
| PRODUCT NAME | `Your Personal Diary` | 50 characters or less |
| MODEL NUMBER | `iPhone app and Mac app` (one line for the product family, rule (c)(2)) - or two lines, `iPhone app` and `Mac app` | 50 or less; NONE / N/A allowed |
| MANUFACTURER | `SELF` | "Enter SELF if you are the primary manufacturer" |
| ECCN | `5D992` - exactly, not `5D992.c` | chosen from 5A002, 5B002, 5D002, 5A992, 5D992 |
| AUTHORIZATION TYPE | `MMKT` (the mass-market identifier; `ENC` is the other; `OTHER` if an adviser says neither fits) | "For AUTHORIZATION TYPE, enter ENC or MMKT." |
| ITEM TYPE | `Mobility and mobile applications n.e.s.` (closest descriptor of the closed list; for a Mac-only line FACTS also offers `Other (please specify)`) | chosen from the 49 descriptors of (a)(6) |
| SUBMITTER NAME / TELEPHONE / E-MAIL / MAILING ADDRESS | the owner's legal name, phone, `yourpersonaldiary29@gmail.com`, postal address without commas | 50 characters or less each |
| NON-U.S. COMPONENTS | `NO` - the apps use only Apple's (U.S.) operating-system encryption | YES / NO / N/A, 250 or less |
| NON-U.S. MANUFACTURING LOCATIONS | the owner's city and `Israel`, without a comma (or `N/A`) | 250 or less |

The file is saved as plain text with the extension `.csv` (in Notepad: Save As > "All files" > `self-classification.csv`, encoding UTF-8).

### (b) The alternative: a written legal opinion

Obtain a written opinion that the apps are not encryption items under the EAR (or that no report is due) and keep it. Then nothing is filed. Apple: the developer is "responsible for all liabilities associated with misinterpretation of export regulations or claiming exemption inaccurately" (FACTS 5.4).

Neither course is claimed to be required. Course (a) costs one e-mail a year and removes the doubt; it is the default this kit recommends.

## 5. When the answer changes

If the app ever bundles its own cipher (for example AES in JavaScript or in Rust to encrypt data), set `ITSAppUsesNonExemptEncryption` to `true` in both Info.plists, answer the questions in App Store Connect and read FACTS 5.4-5.6 again (documentation upload, possibly a CCATS). The comment in `src-tauri/Info.plist` says the same.

*This is not legal advice.*
