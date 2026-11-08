// Your Personal Diary - the view controller of the iOS app.
//
// STATUS: DRAFT, NEVER COMPILED. Written on Windows (docs/APPLE-PLAN.md WP-A2), where no Swift
// compiler and no iOS SDK exist. The first Mac build compiles and reviews it (WP-I1 / WP-I2,
// scripts/ios/README.he.md).
//
// WHERE IT GOES. `npx cap add ios` (Capacitor CLI 8.5.2) generates ios/App/App/SceneDelegate.swift
// with `window?.rootViewController = CAPBridgeViewController()`. That one line becomes
// `window?.rootViewController = DiaryBridgeViewController()`; this file and the four plugin files
// (mobile/plugins/*/ios/*.swift) are added to the App target. Nothing else of the generated
// project's code changes. (Main.storyboard still names CAPBridgeViewController; the scene delegate
// replaces the window it describes, so the storyboard's class is not what runs. Change the custom
// class there as well if a later Capacitor template stops creating the window in code.)
//
// WHAT IT DOES. It is the iOS counterpart of android/.../MainActivity.java:
//  1. registers the plugins written for this app. Plugins from npm packages need nothing here -
//     `npx cap sync ios` lists them and the bridge loads them. `capacitorDidLoad()` runs after the
//     bridge exists and before the page is loaded, and a registered instance is loaded at once, so
//     the privacy cover and the "open with" listener are in place before the first screen;
//  2. keeps the web view's own storage out of iCloud and computer backups (see DiaryBackup).
//
// Opens no network connection (mobile/test/ios-prep.test.ts scans this file).

import Capacitor
import Foundation
import UIKit

class DiaryBridgeViewController: CAPBridgeViewController {

    override open func capacitorDidLoad() {
        DiaryBackup.excludeWebDataFromBackups()
        bridge?.registerPluginInstance(DiaryPrivacyScreenPlugin())
        bridge?.registerPluginInstance(DiaryFilesPlugin())
        bridge?.registerPluginInstance(DiaryOfflinePlugin())
        bridge?.registerPluginInstance(DiaryBiometricPlugin())
    }
}

/// What the Android manifest does with `allowBackup="false"`: nothing the app keeps on the phone
/// may travel through a cloud backup or a transfer to another device.
///
/// iOS has no such switch for a whole app; a folder can be excluded. What the app keeps:
///  - the web view's storage, Library/WebKit - localStorage (the remembered session, the language)
///    and IndexedDB (the offline copy, encrypted with the account offline key): excluded HERE;
///  - the outbox mirror, Library/NoCloud/offline: excluded by DiaryOfflinePlugin;
///  - the device key in the Keychain: "this device only" by its accessibility class;
///  - UserDefaults (the phone settings, no diary content): left in the backup;
///  - Documents: the app keeps nothing there (copies of opened files are removed by DiaryFilesPlugin).
/// The visible effect, the same as on Android: after an iPhone is restored from a backup the app
/// starts signed out. To let the session travel with a backup instead, remove the one call above.
///
/// TO VERIFY ON A DEVICE (WP-I2): that WKWebView's default data store really lives below
/// Library/WebKit on the supported iOS versions (download the app's container from Xcode's Devices
/// window and look), and that the folder still reports isExcludedFromBackup after the web view
/// wrote to it. Apple documents the flag as guidance for the backup system, not as a guarantee.
enum DiaryBackup {

    static func excludeWebDataFromBackups() {
        guard let library = FileManager.default.urls(for: .libraryDirectory, in: .userDomainMask).first else {
            return
        }
        var folder = library.appendingPathComponent("WebKit", isDirectory: true)
        do {
            // The flag lives on the folder, so the folder must exist before the web view creates it.
            try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true, attributes: nil)
            var values = URLResourceValues()
            values.isExcludedFromBackup = true
            try folder.setResourceValues(values)
        } catch {
            CAPLog.print("DiaryBackup: the web view's storage could not be excluded from backups - \(error.localizedDescription)")
        }
    }
}
