// Your Personal Diary - the iOS side of the local Capacitor plugin `DiaryBiometric`.
//
// STATUS: DRAFT, NEVER COMPILED. Written on Windows (docs/APPLE-PLAN.md WP-A2), where no Swift
// compiler and no iOS SDK exist. The first Mac build compiles and reviews it (WP-I2,
// scripts/ios/README.he.md).
//
// JavaScript contract: mobile/plugins/diary-biometric/index.ts. Android side:
// android/app/src/main/java/com/mydiary/app/plugins/DiaryBiometricPlugin.java.
//
// On iOS this plugin answers "unsupported" and stores nothing. The feature it belongs to -
// "Unlock with fingerprint or face" for the SERVER-side session lock - is switched off on every
// platform (`BIOMETRIC_UNLOCK_ENABLED = false`, mobile/platform/biometric.ts) until the server has
// the unlock-token contract described there, so nothing in the app calls these methods today. The
// class exists so that the JavaScript name `DiaryBiometric` resolves on iOS and a call made by
// mistake gets an honest answer instead of "plugin not implemented".
//
// This is NOT the offline unlock: that one (Face ID / Touch ID / passcode for the local lock
// overlay) is `verifyUser` of DiaryOfflinePlugin.swift and is implemented there.
//
// Design for the day the feature is turned on (not written yet): the unlock token goes into a
// Keychain generic-password item created with SecAccessControlCreateWithFlags(...,
// kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly, .biometryCurrentSet, ...). Reading the item
// makes the system show Face ID / Touch ID, and enrolling a new face or finger invalidates it -
// the analogue of the Android Keystore key bound to a BiometricPrompt CryptoObject: the token is
// released by the system, never by a yes/no answer the JavaScript could forge.
//
// Opens no network connection (mobile/test/ios-prep.test.ts scans this file).

import Capacitor
import Foundation

@objc(DiaryBiometricPlugin)
public class DiaryBiometricPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "DiaryBiometricPlugin"
    public let jsName = "DiaryBiometric"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "enroll", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "unlock", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clear", returnType: CAPPluginReturnPromise)
    ]

    /// `BiometricAvailability` of the contract: nothing can be shown, nothing is stored.
    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve(["status": "unsupported", "enrolled": false])
    }

    /// Never stores the token.
    @objc func enroll(_ call: CAPPluginCall) {
        call.resolve(["ok": false, "reason": "unavailable"])
    }

    /// There is no token to return.
    @objc func unlock(_ call: CAPPluginCall) {
        call.resolve(["token": NSNull(), "reason": "unavailable"])
    }

    /// Nothing is stored, so there is nothing to forget.
    @objc func clear(_ call: CAPPluginCall) {
        call.resolve()
    }
}
