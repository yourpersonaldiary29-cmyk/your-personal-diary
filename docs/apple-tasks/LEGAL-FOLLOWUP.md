# LEGAL follow-up: the privacy policy sentence for the offline unlock by password

**STATUS 2026-11-11: APPLIED - do not apply again.** Both sentences are in legal/privacy/privacy-en.md and privacy-he.md, section 5, with the aligned wording of the TERMS base writer ("each guess costing as much as against the server but with no limit on the number of tries"), and are translated into all 20 languages (LEGAL-DIFF.md item g, TERMS-DIFF.md).

Written by the OFFLINE-PASSWORD package (2026-11-08). `legal/**` belonged to the LEGAL package, which ran in parallel, so nothing here was applied at the time: the main session (or the LEGAL fixer) was to copy the sentences below into the policy. Source of truth for the behaviour: `docs/android-tasks/OFFLINE-DESIGN.md` section 13, note "2026-11-08, owner decision: offline unlock by password".

## What changed in the app

Owner decision 2026-11-08: offline, the lock screen accepts the diary password as well (not only the device's screen lock). To check it without a server, an app with "Remember me" keeps the offline key (the key of the encrypted copies on the device, already mentioned in section 5) encrypted under a key derived from the password with scrypt, in the same place and with the same lifecycle as the key it already keeps there. The password itself is still never stored. Without "Remember me" (and on the web) this copy exists only in memory while the app is open, so nothing changes at rest.

## Where: section 5 "What is stored on your device", paragraph "Without a connection"

The sentence **"Your password and your recovery key are never stored on the device."** stays true and stays in place. Add directly after it:

### English (required sentence)

> In the apps that keep that key on the device with "Remember me", the app also keeps a copy of it encrypted with a key derived from your password, so that you can unlock the app without a connection by typing your password; the password itself is not stored, and this copy is deleted together with the key - when you sign out, when the sign-in ends, or when the account is deleted.

### English (recommended second sentence, honest residual risk)

> Someone with a copy of this device's data could try to guess your password against that copy without needing your device account, each guess costing as much as against the server but with no limit on the number of tries; a strong password is what protects it.

### Hebrew (required sentence) - the policy addresses the reader in the plural, as the rest of the Hebrew text does

> באפליקציות ששומרות את המפתח הזה במכשיר עם "זכור אותי", האפליקציה שומרת גם עותק שלו, מוצפן במפתח שנגזר מהסיסמה שלכם, כדי שתוכלו לבטל את נעילת האפליקציה בלי חיבור על ידי הקלדת הסיסמה; הסיסמה עצמה לא נשמרת, והעותק הזה נמחק יחד עם המפתח - בהתנתקות, כשהחיבור לחשבון מסתיים או כשהחשבון נמחק.

### Hebrew (recommended second sentence)

> מי שבידיו העתק של נתוני המכשיר הזה יכול לנסות לנחש מולו את הסיסמה שלכם גם בלי חשבון המשתמש של המכשיר, כשכל ניחוש עולה כמו מול השרת אבל בלי הגבלה על מספר הניסיונות; סיסמה חזקה היא מה שמגן עליו.

## Notes for whoever applies it

- "The apps that keep that key on the device" is deliberately platform-neutral: the LEGAL package is rewording the same paragraph for the Mac (Keychain) and the iPhone app, and this sentence attaches to whatever list of apps that paragraph ends up naming. Do not add a platform list here that could contradict it.
- The other 18 languages need the same two sentences translated in the register of the surrounding paragraph (the LEGAL translators' job); the parity of the generated pages (`node scripts/legal/build-pages.mjs --check --strict`) is theirs too.
- No change to the "In short" summary is needed: it already says the device copies are encrypted and that the password is never stored, both of which remain true.
- The App Store / Play "data safety" answers do not change: nothing new is collected or sent; this is a device-local derivation of a key from a password the user already types into the app.
