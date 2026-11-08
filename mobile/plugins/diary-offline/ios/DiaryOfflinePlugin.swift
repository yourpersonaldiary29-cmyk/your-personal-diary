// Your Personal Diary - the iOS side of the local Capacitor plugin `DiaryOffline`.
//
// STATUS: DRAFT, NEVER COMPILED. Written on Windows (docs/APPLE-PLAN.md WP-A2), where no Swift
// compiler and no iOS SDK exist. The first Mac build compiles, reviews and tests it (WP-I2,
// scripts/ios/README.he.md). It is security code: read it line by line before it ships, and run
// the checks listed at the end of this header on a real iPhone.
//
// JavaScript contract: mobile/plugins/diary-offline/index.ts. The engine's seams built on it:
// mobile/platform/offline.ts. Android side (the behaviour this file mirrors, method by method):
// android/app/src/main/java/com/mydiary/app/plugins/DiaryOfflinePlugin.java. Design:
// docs/android-tasks/OFFLINE-DESIGN.md sections 5.1 and 5.7.
//
// 1. The account offline key (AOK) at rest - wrapKey / unwrapKey / deleteKey.
//    The server generates and keeps the AOK; with "Remember me" the engine keeps a wrapped copy in
//    its IndexedDB so that the app can open without a connection. Wrapping here: AES-256-GCM
//    (CryptoKit) with ONE random 256-bit device key that lives in the iOS Keychain as a
//    generic-password item (service `com.mydiary.app.offline.v1`), accessible after the first
//    unlock, THIS DEVICE ONLY (never iCloud Keychain, never a backup restored to another phone),
//    with no user-authentication binding - it must work at app start, before any prompt. The
//    account id is the GCM additional data ("ypd-offline-v1:" + userId), so a blob moved to another
//    account never unwraps. The blob is base64 of: version byte 1, the 12-byte nonce, ciphertext and
//    16-byte tag - the same layout as the Java plugin (blobs are still per device: each device has
//    its own key). Nothing is stored here except the device key and the list of account ids that
//    hold a blob, so that removing one account's key never breaks another's: the device key is
//    deleted together with the last account.
//    Difference from the Android Keystore, stated plainly: the Keystore key never leaves the secure
//    hardware; this key is DATA in the Keychain, readable by code running as this app. The same
//    residual risk as OFFLINE-DESIGN 5.1 names for a rooted phone applies to a jailbroken one. (A
//    Secure Enclave key could wrap it later; docs/APPLE-PLAN.md section 4 has the note.)
//
// 2. Offline unlock - canVerifyUser / verifyUser: the phone's own user check, Face ID / Touch ID
//    with the device passcode as the fallback (LocalAuthentication, deviceOwnerAuthentication).
//    Available exactly when a passcode is set. The answer is one word - "ok", "cancelled", "failed"
//    or "unavailable" - and it unlocks only the local lock overlay over data already in memory;
//    nothing derived from the account password is stored anywhere.
//    REQUIRED in Info.plist: NSFaceIDUsageDescription. Without it iOS terminates the app at the
//    first Face ID prompt.
//
// 3. The outbox mirror needs no methods here (it is @capacitor/filesystem in
//    Directory.LibraryNoCloud, mobile/platform/offline.ts `mirrorDirectory`). `load()` only makes
//    sure its folder, Library/NoCloud/offline, exists and is excluded from iCloud / computer
//    backups, whatever the Filesystem plugin's library does about that itself.
//
// Checks for the Mac (WP-I2): wrap, relaunch, unwrap; unwrap with another account id ->
// UNWRAP_FAILED; delete the app and reinstall -> the old device key is gone at the first launch;
// restart the phone and open the app BEFORE the first unlock is impossible by construction, after
// it the key reads; Face ID success / cancel / five failures -> passcode screen; no passcode set ->
// "unavailable"; `Library/NoCloud/offline` reports isExcludedFromBackup = true.
//
// Opens no network connection (mobile/test/ios-prep.test.ts scans this file).

import Capacitor
import CryptoKit
import Foundation
import LocalAuthentication
import Security

@objc(DiaryOfflinePlugin)
public class DiaryOfflinePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "DiaryOfflinePlugin"
    public let jsName = "DiaryOffline"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "wrapKey", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "unwrapKey", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "deleteKey", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "canVerifyUser", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "verifyUser", returnType: CAPPluginReturnPromise)
    ]

    /// The Keychain item of the device key (the Android alias has the same name).
    static let keychainService = "com.mydiary.app.offline.v1"
    static let keychainAccount = "device-key"
    /// UserDefaults key: the account ids that hold a blob wrapped by the current device key.
    static let wrappedUsersKey = "diary.offline.wrapped.users"
    static let aadPrefix = "ypd-offline-v1:"
    static let blobVersion: UInt8 = 1
    static let nonceBytes = 12
    static let tagBytes = 16
    static let deviceKeyBytes = 32
    /// The AOK is 32 bytes; a generous bound against nonsense (the other platforms use the same).
    static let maxKeyBytes = 4096
    static let maxPromptText = 200
    static let defaultPromptText = "Your Personal Diary"
    /// The mirror's place below Library (mobile/platform/offline.ts: MIRROR_DIRECTORY.ios + MIRROR_BASE).
    static let mirrorPath = ["NoCloud", "offline"]

    /// Error codes the JavaScript side maps (mobile/plugins/diary-offline/index.ts DIARY_OFFLINE_ERROR).
    static let errInput = "INVALID_INPUT"
    static let errKeyMissing = "KEY_MISSING"
    static let errUnwrap = "UNWRAP_FAILED"
    static let errKeystore = "KEYSTORE_ERROR"

    private enum DeviceKeyError: Error {
        case keychain(OSStatus)
        case sealing
    }

    /// Guards the device key and the account list (plugin calls arrive on a background queue).
    private let lock = NSLock()

    override public func load() {
        lock.lock()
        // A Keychain item outlives the app. After a reinstall the old device key is still there
        // while everything it wrapped is gone: no account on record means the key wraps nothing.
        if wrappedUsers().isEmpty {
            deleteDeviceKey()
        }
        lock.unlock()
        DiaryOfflinePlugin.excludeMirrorFromBackup()
    }

    // ---------------------------------------------------------------------------------------
    // The account offline key
    // ---------------------------------------------------------------------------------------

    @objc func wrapKey(_ call: CAPPluginCall) {
        guard let userId = call.getString("userId"), DiaryOfflinePlugin.validUserId(userId) else {
            call.reject("invalid user id", DiaryOfflinePlugin.errInput)
            return
        }
        guard let keyText = call.getString("key"), var key = Data(base64Encoded: keyText), !key.isEmpty, key.count <= DiaryOfflinePlugin.maxKeyBytes else {
            call.reject("invalid key", DiaryOfflinePlugin.errInput)
            return
        }
        defer { key.resetBytes(in: 0..<key.count) }
        lock.lock()
        defer { lock.unlock() }
        do {
            let deviceKey = try loadOrCreateDeviceKey()
            // CryptoKit picks a fresh random 12-byte nonce for every seal.
            let sealed = try AES.GCM.seal(key, using: deviceKey, authenticating: DiaryOfflinePlugin.aad(userId))
            guard let combined = sealed.combined else {
                throw DeviceKeyError.sealing
            }
            var blob = Data([DiaryOfflinePlugin.blobVersion])
            blob.append(combined)
            rememberUser(userId)
            call.resolve(["blob": blob.base64EncodedString()])
        } catch {
            call.reject("the key could not be wrapped", DiaryOfflinePlugin.errKeystore)
        }
    }

    @objc func unwrapKey(_ call: CAPPluginCall) {
        guard let userId = call.getString("userId"), DiaryOfflinePlugin.validUserId(userId) else {
            call.reject("invalid user id", DiaryOfflinePlugin.errInput)
            return
        }
        let shortest = 1 + DiaryOfflinePlugin.nonceBytes + DiaryOfflinePlugin.tagBytes + 1
        guard let blobText = call.getString("blob"), let blob = Data(base64Encoded: blobText), blob.count >= shortest, blob.first == DiaryOfflinePlugin.blobVersion else {
            call.reject("invalid key blob", DiaryOfflinePlugin.errInput)
            return
        }
        lock.lock()
        defer { lock.unlock() }
        let deviceKey: SymmetricKey
        do {
            guard let loaded = try loadDeviceKey() else {
                call.reject("the device key is gone", DiaryOfflinePlugin.errKeyMissing)
                return
            }
            deviceKey = loaded
        } catch {
            call.reject("the key could not be unwrapped", DiaryOfflinePlugin.errKeystore)
            return
        }
        do {
            // A copy without the version byte: nonce (12) + ciphertext + tag (16).
            let box = try AES.GCM.SealedBox(combined: Data(blob.dropFirst()))
            var plain = try AES.GCM.open(box, using: deviceKey, authenticating: DiaryOfflinePlugin.aad(userId))
            defer { plain.resetBytes(in: 0..<plain.count) }
            call.resolve(["key": plain.base64EncodedString()])
        } catch CryptoKitError.authenticationFailure {
            // Another account's blob, a damaged blob, or one wrapped by an earlier device key.
            call.reject("the key blob does not unwrap", DiaryOfflinePlugin.errUnwrap)
        } catch {
            call.reject("the key could not be unwrapped", DiaryOfflinePlugin.errKeystore)
        }
    }

    @objc func deleteKey(_ call: CAPPluginCall) {
        guard let userId = call.getString("userId"), DiaryOfflinePlugin.validUserId(userId) else {
            call.reject("invalid user id", DiaryOfflinePlugin.errInput)
            return
        }
        lock.lock()
        defer { lock.unlock() }
        // The account no longer holds a blob; the device key goes with the last account (a full wipe).
        var users = wrappedUsers()
        users.remove(userId)
        storeWrappedUsers(users)
        if users.isEmpty {
            deleteDeviceKey()
        }
        call.resolve()
    }

    /// `^u_[0-9a-f]{16}$`, byte for byte (no Unicode look-alikes, no combining marks).
    static func validUserId(_ userId: String) -> Bool {
        let bytes = Array(userId.utf8)
        guard bytes.count == 18, bytes[0] == UInt8(ascii: "u"), bytes[1] == UInt8(ascii: "_") else {
            return false
        }
        return bytes[2...].allSatisfy { ($0 >= 48 && $0 <= 57) || ($0 >= 97 && $0 <= 102) }
    }

    static func aad(_ userId: String) -> Data {
        return Data((aadPrefix + userId).utf8)
    }

    // ---------------------------------------------------------------------------------------
    // The device key in the Keychain
    // ---------------------------------------------------------------------------------------

    private func deviceKeyQuery() -> [String: Any] {
        return [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: DiaryOfflinePlugin.keychainService,
            kSecAttrAccount as String: DiaryOfflinePlugin.keychainAccount
        ]
    }

    /// The device key, nil when there is none. Throws when the item exists but cannot be used.
    private func loadDeviceKey() throws -> SymmetricKey? {
        var query = deviceKeyQuery()
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        if status == errSecItemNotFound {
            return nil
        }
        guard status == errSecSuccess, let data = item as? Data, data.count == DiaryOfflinePlugin.deviceKeyBytes else {
            throw DeviceKeyError.keychain(status)
        }
        return SymmetricKey(data: data)
    }

    private func createDeviceKey() throws -> SymmetricKey {
        let key = SymmetricKey(size: .bits256)
        var attributes = deviceKeyQuery()
        attributes[kSecValueData as String] = key.withUnsafeBytes { Data($0) }
        // Readable once the phone was unlocked after a restart, never copied off this device.
        attributes[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        attributes[kSecAttrSynchronizable as String] = false
        let status = SecItemAdd(attributes as CFDictionary, nil)
        guard status == errSecSuccess else {
            throw DeviceKeyError.keychain(status)
        }
        return key
    }

    private func loadOrCreateDeviceKey() throws -> SymmetricKey {
        do {
            if let existing = try loadDeviceKey() {
                return existing
            }
        } catch DeviceKeyError.keychain(let status) where status == errSecInteractionNotAllowed {
            // The item exists but the phone is locked (before the first unlock after a restart):
            // replacing the key now would orphan every other account's blob. This call fails instead.
            throw DeviceKeyError.keychain(status)
        } catch {
            // An item the Keychain cannot hand out as a key (wrong size, damaged): replaced below.
        }
        // None, or an unusable one: replace it. Blobs of other accounts then stop unwrapping - their
        // AOK comes back from the server at the next sign-in, nothing is lost (the Java side does the
        // same with a Keystore key it can no longer use).
        deleteDeviceKey()
        storeWrappedUsers([])
        return try createDeviceKey()
    }

    private func deleteDeviceKey() {
        // errSecItemNotFound is as good as success here.
        SecItemDelete(deviceKeyQuery() as CFDictionary)
    }

    private func wrappedUsers() -> Set<String> {
        return Set(UserDefaults.standard.stringArray(forKey: DiaryOfflinePlugin.wrappedUsersKey) ?? [])
    }

    private func storeWrappedUsers(_ users: Set<String>) {
        UserDefaults.standard.set(users.sorted(), forKey: DiaryOfflinePlugin.wrappedUsersKey)
    }

    private func rememberUser(_ userId: String) {
        var users = wrappedUsers()
        if users.insert(userId).inserted {
            storeWrappedUsers(users)
        }
    }

    // ---------------------------------------------------------------------------------------
    // The outbox mirror's folder: excluded from backups
    // ---------------------------------------------------------------------------------------

    static func mirrorFolder() -> URL? {
        guard var folder = FileManager.default.urls(for: .libraryDirectory, in: .userDomainMask).first else {
            return nil
        }
        for name in mirrorPath {
            folder.appendPathComponent(name, isDirectory: true)
        }
        return folder
    }

    static func excludeMirrorFromBackup() {
        guard var folder = mirrorFolder() else {
            return
        }
        do {
            try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true, attributes: nil)
            var values = URLResourceValues()
            values.isExcludedFromBackup = true
            try folder.setResourceValues(values)
        } catch {
            CAPLog.print("DiaryOffline: the mirror folder could not be excluded from backups - \(error.localizedDescription)")
        }
    }

    // ---------------------------------------------------------------------------------------
    // Offline unlock: the phone's own user check
    // ---------------------------------------------------------------------------------------

    /// No UI: whether the phone has a passcode the user check can ask for.
    @objc func canVerifyUser(_ call: CAPPluginCall) {
        var error: NSError?
        let available = LAContext().canEvaluatePolicy(.deviceOwnerAuthentication, error: &error)
        call.resolve(["available": available])
    }

    @objc func verifyUser(_ call: CAPPluginCall) {
        let context = LAContext()
        var error: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error) else {
            call.resolve(["result": "unavailable"])
            return
        }
        // iOS shows one text (with Touch ID and on the passcode screen; Face ID shows the text of
        // NSFaceIDUsageDescription the first time). It must not be empty: the subtitle - the reason
        // the engine gives - when there is one, else the title, else the product name.
        let reason = DiaryOfflinePlugin.promptText(call.getString("subtitle"))
            ?? DiaryOfflinePlugin.promptText(call.getString("title"))
            ?? DiaryOfflinePlugin.defaultPromptText
        // One check at a time is the JavaScript side's job (mobile/platform/offline.ts shares the
        // promise of a check in progress).
        context.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: reason) { success, failure in
            call.resolve(["result": success ? "ok" : DiaryOfflinePlugin.result(for: failure)])
        }
    }

    /// The final error of a prompt as the seam's answer.
    static func result(for error: Error?) -> String {
        guard let failure = error as? LAError else {
            return "failed"
        }
        switch failure.code {
        case .userCancel, .systemCancel, .appCancel:
            return "cancelled"
        case .passcodeNotSet:
            return "unavailable"
        default:
            // authenticationFailed, lockouts, invalidContext, notInteractive...: with
            // deviceOwnerAuthentication the system has offered the passcode already.
            return "failed"
        }
    }

    /// A one-line prompt text: C0 / C1 control characters dropped (as the Java side and offline.ts
    /// do - never the format characters right-to-left and Indic scripts need), trimmed, at most
    /// `maxPromptText` characters; nil when nothing is left.
    static func promptText(_ raw: String?) -> String? {
        guard let raw = raw else {
            return nil
        }
        var kept = String.UnicodeScalarView()
        for scalar in raw.unicodeScalars where !(scalar.value < 0x20 || (scalar.value >= 0x7F && scalar.value <= 0x9F)) {
            kept.append(scalar)
        }
        let clean = String(kept).trimmingCharacters(in: .whitespacesAndNewlines)
        return clean.isEmpty ? nil : String(clean.prefix(maxPromptText))
    }
}
