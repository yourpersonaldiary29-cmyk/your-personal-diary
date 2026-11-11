---
title: Privacy Policy - Your Personal Diary
description: How Your Personal Diary (the Android, Windows and Mac apps, the iPhone app when it is published, and the website) stores and protects your data.
languages: Languages
otherPage: How to delete your account
---

# Privacy Policy - Your Personal Diary

Effective date: {{EFFECTIVE_DATE}}

## In short

- Your Personal Diary is one service with five ways in: the **Android app** (Google Play), the **Windows app** (Microsoft Store or a setup file), the **Mac app** (a download or the Mac App Store), the **iPhone app** (App Store, when it is published) and the **website** [{{SITE_URL}}]({{SITE_URL}}). All of them use the same server and the same account.
- Your diary is kept on our server in a file encrypted with a key derived from your password. Your account details are kept there too.
- We use your data only to run your diary for you. No advertising, no analytics, no tracking, and we do not sell or share your data.
- Please know the limits: while you are signed in, the server has your diary open in its memory, and the operator of the server could technically reset your password and read your diary. Section 4 explains this plainly.
- You can delete your account and your diary at any time in **Settings - Delete account**.

## 1. Who we are

The service is operated by {{PUBLISHER_NAME}} ("we", "us"), who is responsible for your personal data (the "controller"). Contact: [{{CONTACT_EMAIL}}](mailto:{{CONTACT_EMAIL}}).

This policy applies to the Android app, the Windows app, the Mac app, the iPhone app (when it is published) and the website. They show the same diary and follow the same rules; where an app behaves differently, this policy says so.

## 2. What we store on the server, and where

The server runs at the hosting provider Fly.io, in its data centre in **Frankfurt, Germany (European Union)**. It stores:

- **Account details:** your first name, last name, user name and e-mail address, an account ID, the language you use the app in, when the account was created and when you last signed in. When you create the account, we also keep a record of your confirmation that you have read this policy and the [Terms of Use]({{TERMS_URL}}) and agree to them: the time and the effective dates of the versions you confirmed. If you change your e-mail address, the previous address and the time of the change are kept with the account until you change the address again or delete the account. These details are not encrypted by the app, because the server needs them to sign you in and to write to you, so the operator can see them.
- **Your password:** it is not stored. The server keeps only a value derived from it (scrypt) that lets it check the password.
- **Your diary:** entries (text, and the optional fields mood, emotions, energy, stress, sleep, physical activity, events, people, place, notes and tags), habits and habit records, and your settings. Every account has its own encrypted diary file.
- **Sign-in sessions:** for each device where you are signed in: the kind of device ("Computer", "Phone" or "Browser"), when the session started, when it was last used and when it ends. The sign-in token itself is stored only as a hash. With "Remember me", the session also holds your diary key, encrypted with the server key (section 4).
- **Password reset requests:** a hash of the reset link and code, valid for 30 minutes and usable once.
- **The key for offline copies** on your devices (section 5), stored inside your encrypted diary.
- **The operator's e-mail sending settings** (the operator's own Gmail account, with its password stored encrypted). They contain nothing about you.
- **A technical log** of start-up events and errors. It contains no diary content, no e-mail addresses and no IP addresses.

**The tour** ("Skip - just look around", in the Android app) creates a temporary guest diary with sample data. It exists only in the server's memory, ends by itself after 30 minutes and is never stored.

Like every website, the server and the hosting provider receive your device's IP address when it connects. The server uses it only in its memory: to limit how many requests can come from one network (sign-in, registration and the other account functions, password reset, the tour and backups) and for the sign-in lockout. These counters cover at most the last 24 hours, and the address is never written to the log or to the storage.

## 3. How we use your data

- **To provide the service:** signing in, keeping your diary and making it the same on all your devices, search, statistics and insights about your own entries, backups, exports and reminders. Search questions are answered on the server and are not kept there.
- **E-mail:** only for your password reset messages and for security notices (your password was changed with a reset message; the e-mail address of your account was changed). They are written in the language kept with your account details; the server does not open your diary to write them. No newsletters and no marketing.
- **Never:** no advertising, no analytics or tracking tools, no profiling, no selling of data, and no use of your diary to train any AI.

Legal basis (for users in the European Union and similar laws): we process your data to provide the service you signed up for (performance of a contract, GDPR Article 6(1)(b)) and to keep it secure (our legitimate interest, Article 6(1)(f): attempt limits, lockouts, the technical log). Your diary may contain sensitive information, for example about your health or beliefs, if you choose to write it. We process it only to keep it for you and show it to you, because you asked us to by writing it (your explicit consent, Article 9(2)(a)); you can remove it at any time by editing or deleting entries (section 7 says how the old text is erased).

## 4. How your diary is protected - and what that does not protect against

What protects it:

- The diary file of every account is encrypted with AES-256-GCM. The key is derived from your password with scrypt. Any change to the file is detected.
- The hosting provider's disks are encrypted as well (encryption at rest).
- All connections between your devices and the server use HTTPS (TLS).

What you should know:

- **While you are signed in, your diary is decrypted in the server's memory**, so that the server can show, search and analyse it for you. This is not "end-to-end" encryption.
- **The operator can technically reset any password.** So that "Forgot password?" works without losing your diary, the server keeps for every account a copy of the diary key, encrypted with a server key (a "recovery key"). The server key is kept as a secret of the hosting platform, outside the stored files, so a copy of the files alone opens nothing. Still, whoever controls the server and its secrets - the operator, and in principle the hosting provider - could reset the password of any account and read its diary without knowing the password. We promise not to do this. We have no tool for it, and our administration tools never open a diary. If you are not willing to rely on this promise, do not keep anything in the service that you would not want anyone else to read.
- **A password reset request does not open your diary.** The reset message and the security notices are written in the language kept with your account details (section 2), so a request - by you or by anyone who types your e-mail address - leaves your diary closed. Only when the reset is completed with the link or the code from the message does the server open your diary with the recovery key, to encrypt it again under your new password.

## 5. What is stored on your device

On every device where you use the service:

- your sign-in token (so you stay signed in), the last user name, your language and display preferences, and your recent search questions (removed when you sign out).

**Without a connection.** If the app cannot reach the server it keeps working: what you write is saved on your device, encrypted, and uploaded to the server automatically when the connection returns, even if the app was closed in between. In the Windows, Mac, Android and iPhone apps, if you chose "Remember me", the app also keeps an encrypted copy of what it showed you recently (recent entries, habits, today's data, the calendar month and your settings) so that you can read it without a connection; otherwise that copy exists only in memory while the app is open. The key to these copies is kept by the server inside your encrypted diary; with "Remember me", the Windows, Mac, Android and iPhone apps also keep it on the device, protected by Windows Data Protection, by the macOS Keychain, by the Android Keystore or by the iOS Keychain, so that the app can open without a connection. Your password and your recovery key are never stored on the device. In the apps that keep that key on the device with "Remember me", the app also keeps a copy of it encrypted with a key derived from your password, so that you can unlock the app without a connection by typing your password; the password itself is not stored, and this copy is deleted together with the key - when you sign out, when the sign-in ends, or when the account is deleted. Someone with a copy of this device's data could try to guess your password against that copy without needing your device account, each guess costing as much as against the server but with no limit on the number of tries; a strong password is what protects it. So that every change is uploaded exactly once, the app also keeps, encrypted, a record of the changes it uploaded in the last 7 days.

- **Windows app:** these copies are kept in the app's data folders inside your Windows user profile (for the Microsoft Store version, in the app's own package folder). The key is protected by Windows Data Protection (DPAPI) and works only for your Windows user.
- **Android app:** these copies are kept in the app's private storage, which other apps cannot read and which is excluded from backups. The key is protected by the Android Keystore.
- **Mac app:** these copies are kept in the app's folder inside your user Library (Application Support/app.yourpersonaldiary.mac). The key is kept as an item of your Mac user's login keychain, named "Your Personal Diary offline key" and never synchronized to iCloud Keychain; it is protected by your Mac login password and can be read only by the app. A Migration Assistant or Time Machine copy of your user account carries the item, still protected by that password. Once the app is distributed with Apple's signature, the item will move to the keychain that stays on this Mac only.
- **iPhone app:** these copies are kept in the app's private storage, excluded from iCloud backup. The key is kept in the iOS Keychain, available only on this device after it was unlocked once, and removed when you sign out.
- **Website:** the browser keeps, encrypted, only the changes not yet uploaded, the record of the last 7 days and the notes about conflicting changes (see below), but no copy of what you read; the key stays in memory and is gone when you close the page.

When the connection returns, the app uploads the changes you made, in the order you made them, each exactly once. If the same entry, habit or setting was also changed on another device, the newer change is kept and the app tells you in one line; the other version stays available to you on this device until you dismiss the note.

If the app offers to unlock with your device's screen lock (Windows Hello, Touch ID or the Mac password, Face ID / Touch ID or the iPhone passcode, or the Android screen lock or fingerprint), the check is done by the operating system. Nothing about your fingerprint, face or PIN reaches the app or us. Habit reminders in the Android and iPhone apps are scheduled on the device itself; no push service is involved.

Files you create yourself: a **backup** is encrypted with a password; an **export** (TXT, CSV, JSON or PDF) is an ordinary readable file. You decide where to save them, and anyone who gets an export file can read it.

## 6. Who else receives data

We use two service providers. They process data only on our behalf, to run the service:

- **Fly.io, Inc.** (United States) - hosting of the server in Frankfurt, Germany. Its systems hold the encrypted diary files, the account details and the other data of section 2, and receive connection data such as IP addresses. Because Fly.io is a US company, it may access the data from outside the European Union; this is covered by its data processing terms. Its privacy policy: `fly.io/legal/privacy-policy`.
- **Google (Gmail)** - sends the password reset messages and security notices. Google receives the message, your e-mail address, and the first name and user name in it. A message never contains anything from your diary. Google's privacy policy: `policies.google.com/privacy`.

The app stores also process data under their own privacy policies when you download the apps: **Google Play** for the Android app, the **Microsoft Store** for the Windows app, and the **App Store** and the **Mac App Store** (Apple) for the iPhone and Mac apps (for example installations, ratings and crash reports that their systems collect). The apps contain no code from them or from anyone else that sends data to them.

We do not sell, rent or share your personal data with anyone else. We would disclose data only if the law requires it.

## 7. How long we keep data, and how to delete it

- We keep your account and diary until you delete them. Sign-in sessions end after 12 hours, or after 90 days with "Remember me". Password reset requests end after 30 minutes. The copies on a device stay until you sign out on that device.
- **Delete your account in the app or on the website:** sign in, open **Settings - Delete account**, enter your password and confirm. This immediately deletes from the server your account, your diary, habits and settings, your sign-in on every device and any password reset requests, and it deletes the offline copy on the device you use. Changes still waiting on your other devices can then no longer be uploaded and are lost.
- **Copies in backups of the server:** the hosting provider takes a daily snapshot of the server's storage. Copies of a deleted account in these snapshots are deleted automatically within 30 days.
- **The operator's encrypted server archives:** to be able to recover from a disaster, the operator makes an encrypted archive of the server's storage about once a month; the server keeps only the 2 newest, and the operator keeps at most the 3 newest offline, on a drive that is not connected to the internet, so copies of a deleted account disappear from them as newer archives replace them, normally within three months.
- **Deleted or changed entries** disappear from the app at once, and their old text is erased from your diary file on the server when the change is saved, a moment later: the server overwrites deleted data instead of only marking the space as free. The previous version of the file, which the server keeps in case a save goes wrong, is replaced at the next save. Text deleted before this protection existed is erased the first time your diary is opened after the update (for example when you sign in). On the server, earlier versions then remain only in the daily snapshots of the storage, for up to 30 days, and, encrypted, in unused space of its disk until that space is used again; backup files you made before keep the text they contain. Deleting your account removes the whole file.
- **If you cannot sign in:** write to [{{CONTACT_EMAIL}}](mailto:{{CONTACT_EMAIL}}) from the e-mail address registered in your account. We will confirm the request and delete the account within 30 days. All the details: [{{DELETE_URL}}]({{DELETE_URL}}).
- **Uninstalling the app does not delete your account.** Delete it in Settings first if that is what you want. Signing out deletes the copies and the key from that device; if changes are still waiting to be uploaded, the app asks first. On Windows, uninstalling the downloaded (setup file) version keeps the encrypted copy unless you choose to delete the application data; sign out first to be sure. On a Mac, moving the app to the Bin keeps the encrypted copies in your Library and the key in your keychain until you sign out or delete them; sign out first. Deleting the iPhone app removes its storage; the keychain item is removed when you sign out - sign out first to be sure.
- We do not delete inactive accounts automatically at the moment. If we start doing so, we will say so here before it applies.

## 8. Security measures

- HTTPS only; the server refuses connections that do not come through its secure address.
- Limits on sign-in and registration attempts. After 10 wrong passwords, sign-in from that network is locked for 15 minutes, and further attempts on the account are slowed down.
- The diary locks itself after a period of inactivity. Changing the password or the e-mail address and deleting the account require your password.
- The server key is kept outside the stored files, and only the operator can manage the server.
- Someone who can run programs as your Windows or Mac user, or who has full control of a rooted or jailbroken phone, could read the copy kept for "Remember me".

No system can promise perfect security. Choose a strong password that you do not use anywhere else, keep your devices up to date and keep a backup.

## 9. Your rights

You can see, correct, export and delete your data yourself: your profile is in Settings, every entry can be edited or deleted, **Settings - Backup** and the export create a copy that you can take elsewhere, and **Delete account** removes everything. You can also write to us to ask for a copy of your data, a correction, deletion or restriction of processing, or to object to it, and you can withdraw a consent at any time. We answer within 30 days. You also have the right to complain to a data protection authority - in the European Union the authority of your country, in Israel the Privacy Protection Authority.

## 10. Children

The service is not directed at children. You must be at least {{MINIMUM_AGE}} years old to create an account. We do not knowingly collect data of anyone younger. If you think a younger child has created an account, write to us and we will delete it.

## 11. Not a medical tool

The insights in the app describe possible relationships in your own entries. They do not prove cause and effect and they are not medical or psychological advice.

## 12. Changes to this policy

When the service or this policy changes, we update this page and the effective date at the top. If a change affects what we do with your data, we will say so on this page before it takes effect.

## 13. Contact

Questions about privacy or your data: [{{CONTACT_EMAIL}}](mailto:{{CONTACT_EMAIL}})

{{PUBLISHER_NAME}}
