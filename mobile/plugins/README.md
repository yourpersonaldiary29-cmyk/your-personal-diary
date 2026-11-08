# Local Capacitor plugins of the Android app (and, prepared, of the iPhone app)

Each folder here is the JavaScript side (`registerPlugin` + the typed contract) of a plugin written
for this app only. The Java side lives in the app module, so no extra Gradle module or dependency is
needed: `android/app/src/main/java/com/mydiary/app/plugins/<Name>Plugin.java`, registered in
`MainActivity.java` before `super.onCreate()`. `scripts/check-no-network.mjs` scans that Java: none
of these plugins may open a network connection.

| Plugin | Package | Purpose |
|---|---|---|
| `DiaryFiles` | WP-7 | Storage Access Framework: "Save to device" (ACTION_CREATE_DOCUMENT), "Choose backup file" (ACTION_OPEN_DOCUMENT - not the WebView's own file chooser, see below), reading a `.mpd` the app was opened with; chunked base64 streams |
| `DiaryPrivacyScreen` | WP-9 | FLAG_SECURE (blank card in recent apps, no screenshots); default on, applied natively at start |
| `DiaryBiometric` | WP-9 | BiometricPrompt + CryptoObject over a Keystore key bound to biometric authentication; stores the core's unlock token, never the password |
| `DiaryOffline` | WP-H10d | the automatic offline mode's native half: the account offline key wrapped by a non-exportable Keystore key, and the screen-lock check of the offline unlock |

The host-side logic that uses them (chunking, scheduling, lifecycle, settings) is in `mobile/platform/`.

## The iOS side (prepared on Windows, docs/APPLE-PLAN.md WP-A2)

Each plugin folder also has `ios/<Name>Plugin.swift`: the same JavaScript name, the same methods
and the same answers, written for iOS (UIDocumentPickerViewController, a cover view in the app
switcher, the Keychain + CryptoKit + LocalAuthentication; `DiaryBiometric` answers "unsupported").
They are DRAFTS that no compiler has read - Windows has no Swift toolchain. On the Mac they are
added to the Xcode project by reference together with `mobile/ios-app/` (the view controller that
registers them, the Info.plist additions, the privacy manifest): `scripts/ios/README.he.md`.
`mobile/test/ios-prep.test.ts` checks on Windows that every Swift plugin matches its TypeScript
contract and its Java twin method for method, and that no Swift file opens a network connection.
The few places where the phones differ in JavaScript take `os` from `mobile/platform/os.ts`; on
iOS "Save to device" shows the export sheet at the END (`closeWrite` answers `cancelled`), because
iOS has no "save as" dialog for a file that does not exist yet.

## Why the restore picker is a plugin method and not `<input type="file">`

The WebView's file input works in Capacitor (BridgeWebChromeClient opens ACTION_GET_CONTENT), but
nothing tells JavaScript that the chooser is open: Android stops MainActivity for it like for any
other app, @capacitor/app reports `appStateChange(isActive=false)`, and "Lock when I leave the app"
(default on) locks the diary under the chooser - the chosen file is then inspected against a locked
core (423) and the restore can never complete. Every system dialog the app opens itself therefore
goes through `DiaryFiles` (`createDocument`, `openDocument`) or @capacitor/share, and
`mobile/platform/files.ts` holds the lifecycle's `suspendLock()` token for exactly the dialog's
duration (`mobile/platform/lifecycle.ts`): the flush still happens, the lock does not.

## Biometric unlock: the two npm candidates and why neither was used (WP-9)

The package asked to compare two maintained biometric plugins (maintenance, Capacitor 8 support,
licence) and to say why one was chosen. Checked on 2026-10-18 with `npm view` (no package was
installed):

| Candidate | Latest | Last publish | Licence | Capacitor 8 | What it offers |
|---|---|---|---|---|---|
| `capacitor-native-biometric` (epicshaggy, the original) | 4.2.2 | 2023-06 | MIT | no (Capacitor 4 era, unmaintained) | prompt (`verifyIdentity`) + an encrypted username/password store (`setCredentials` / `getCredentials`) |
| `@capgo/capacitor-native-biometric` (Capgo's maintained fork) | 8.9.0 | 2026-10 | MPL-2.0 | yes (`peerDependencies: @capacitor/core >= 8`) | the same API as the original, actively maintained |
| `@aparajita/capacitor-biometric-auth` | 10.0.0 | 2026-02 | MIT | yes (built against `@capacitor/core ^8.0.2`) | prompt only (`authenticate()` resolves or throws); stores nothing by design |

Decision: a local plugin, `DiaryBiometricPlugin` (framework `BiometricPrompt` + Android Keystore,
~350 lines, no dependency, no network), because neither candidate gives what the package demands -
a secret that only the biometric prompt can release:

- `@aparajita/capacitor-biometric-auth` is the best maintained of the three but is an
  *authentication-only* plugin: its answer is a JavaScript boolean. Anything the app unlocks on that
  answer is unlocked by whoever controls the JavaScript; to unlock a server-side session lock the app
  would have to keep the password or a token readable without the prompt - exactly the "do not fake
  it" the package forbids.
- The native-biometric family (original and fork) stores a secret, but its public API keeps the
  prompt and the store apart: `verifyIdentity()` and `getCredentials()` are independent calls, and
  nothing in the API binds the stored credentials to a `CryptoObject` of the prompt - the store is a
  Keystore-encrypted blob that the JavaScript side reads after it decided the prompt succeeded. It is
  also shaped around "store the username and password", the wrong secret for us. The original is
  unmaintained; the fork is MPL-2.0 (file-level copyleft, acceptable but a licence more to track).
- What the lock screen needs is small and entirely in the framework: an AES-GCM Keystore key with
  `setUserAuthenticationRequired(true)` and a per-use validity (`setUserAuthenticationParameters(0,
  AUTH_BIOMETRIC_STRONG)` on Android 11+, `-1` before), `setInvalidatedByBiometricEnrollment(true)`,
  used only inside `BiometricPrompt.CryptoObject`; it encrypts the UNLOCK TOKEN the core issued, never
  the password. Android 9+ (API 28) only - on Android 7/8 `isAvailable()` is false and the setting
  stays hidden. The native side is finished and unit-tested on the JS side; the feature stays behind
  `BIOMETRIC_UNLOCK_ENABLED = false` (`mobile/platform/biometric.ts`) until the core implements
  `/api/auth/biometric/{enroll,unlock}` and `DELETE /api/auth/biometric` (contract in that file).
