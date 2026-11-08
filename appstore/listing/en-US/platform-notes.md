# Platform notes (en-US)

The nine text files in this folder are shared by the two App Store Connect records: the iPhone app (bundle id `app.yourpersonaldiary`) and the Mac app (bundle id `app.yourpersonaldiary.mac`). Every sentence is written so that it is true on both, so the same files are pasted into both records.

Where a record could say something more precisely, the table gives the optional wording for that record. Using the shared sentence is always correct; the precise wording is a choice, and after any change the limits must be checked again with `node scripts/appstore/check-listing.mjs --only en-US`.

| File and shared sentence | iPhone record, more precise (optional) | Mac record, more precise (optional) |
| --- | --- | --- |
| description.txt: "Optional reminders as notifications, at the time you choose for each habit." | "Optional reminders as notifications on your iPhone, at the time you choose for each habit - even when the app is closed." | "Optional reminders as notifications, at the time you choose for each habit, while the app is open." |
| description.txt: "If the diary is locked and there is no connection, unlock it with Face ID or Touch ID, or with the passcode or password of your device." | "If the diary is locked and there is no connection, unlock it with Face ID, Touch ID or your iPhone passcode." | "If the diary is locked and there is no connection, unlock it with Touch ID or your Mac password." |
| description.txt: "Choose your language at any time in Settings, under Language; your account keeps it." | "The app opens in your iPhone's language when it is one of the 20. Choose another at any time in Settings, under Language; your account keeps it." | "The app opens in English. Choose your language in Settings, under Language; your account keeps it." |
| description.txt: "Automatic lock after a period of inactivity, and "Lock now" whenever you want." | may add: "or, if you choose, whenever you leave the app" | unchanged |
| description.txt, the Accessibility block | unchanged | may add the line "- Everything can be done with the keyboard, with shortcuts for the main actions." |

Everything else - name, subtitle, promotional text, keywords, what's new and the three URLs - is identical in both records. Screenshots are per record: the iPhone sets and the Mac set under `appstore/screenshots/` (SHOTS package; its README names the folder for each device size).

What the texts deliberately do not say, on either record: the guest tour (not in the Apple apps), hiding the app's content in the app switcher or blocking screenshots (not promised on these platforms), keyboard shortcuts by name (they differ per platform), and anything about other platforms or stores (App Review Guideline 2.3.10).
