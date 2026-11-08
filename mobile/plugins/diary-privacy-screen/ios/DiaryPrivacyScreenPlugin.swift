// Your Personal Diary - the iOS side of the local Capacitor plugin `DiaryPrivacyScreen`.
//
// STATUS: DRAFT, NEVER COMPILED. Written on Windows (docs/APPLE-PLAN.md WP-A2), where no Swift
// compiler and no iOS SDK exist. The first Mac build compiles, reviews and tests it (WP-I2,
// scripts/ios/README.he.md). Until then nothing here is proven beyond "it follows the contract".
//
// JavaScript contract: mobile/plugins/diary-privacy-screen/index.ts (`setEnabled`, `isEnabled`).
// Android side: android/app/src/main/java/com/mydiary/app/plugins/DiaryPrivacyScreenPlugin.java.
//
// What it does on iOS: while the setting is on (the default), the app's window is covered with a
// plain view from the moment the app stops being active until it is active again, so the card in
// the app switcher shows nothing of the diary. The setting is kept here (UserDefaults) and read
// when the plugin loads - before the page is loaded - exactly as the Java side keeps its own copy.
//
// What it does NOT do on iOS: block screenshots. Android's FLAG_SECURE has no public equivalent,
// so the setting's text must not promise it there (the `mobile.security.privacyScreen*` texts of
// shared/i18n say "block screenshots" today - WP-I2 gives iOS its own wording, in 20 languages).
//
// Why willResignActive and not didEnterBackground: iOS takes the app-switcher snapshot after the
// app entered the background, but the live window is already visible in the switcher while the app
// is merely inactive. Covering at willResignActive hides both. The price: the cover is also up
// under Control Center, a Face ID prompt and system alerts - they are drawn above it.
//
// Opens no network connection (mobile/test/ios-prep.test.ts scans this file).

import Capacitor
import Foundation
import UIKit

@objc(DiaryPrivacyScreenPlugin)
public class DiaryPrivacyScreenPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "DiaryPrivacyScreenPlugin"
    public let jsName = "DiaryPrivacyScreen"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setEnabled", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isEnabled", returnType: CAPPluginReturnPromise)
    ]

    /// UserDefaults key of the setting; absent means ON (the default, as on Android).
    static let enabledKey = "diary.privacy-screen.enabled"

    private var observers: [NSObjectProtocol] = []
    /// The cover while it is shown. Touched on the main thread only.
    private var cover: UIView?

    override public func load() {
        let center = NotificationCenter.default
        observers.append(center.addObserver(forName: UIApplication.willResignActiveNotification, object: nil, queue: OperationQueue.main) { [weak self] _ in
            self?.showCoverIfEnabled()
        })
        observers.append(center.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: OperationQueue.main) { [weak self] _ in
            self?.hideCover()
        })
    }

    deinit {
        for observer in observers {
            NotificationCenter.default.removeObserver(observer)
        }
    }

    @objc func setEnabled(_ call: CAPPluginCall) {
        guard let enabled = call.getBool("enabled") else {
            call.reject("enabled is required")
            return
        }
        UserDefaults.standard.set(enabled, forKey: DiaryPrivacyScreenPlugin.enabledKey)
        if !enabled {
            DispatchQueue.main.async { [weak self] in
                self?.hideCover()
            }
        }
        call.resolve()
    }

    @objc func isEnabled(_ call: CAPPluginCall) {
        call.resolve(["enabled": storedEnabled()])
    }

    private func storedEnabled() -> Bool {
        let defaults = UserDefaults.standard
        if defaults.object(forKey: DiaryPrivacyScreenPlugin.enabledKey) == nil {
            return true
        }
        return defaults.bool(forKey: DiaryPrivacyScreenPlugin.enabledKey)
    }

    /// Main thread. Adds the cover above everything in the app's window (the web view included).
    private func showCoverIfEnabled() {
        guard storedEnabled(), cover == nil, let window = bridge?.viewController?.view.window else {
            return
        }
        let view = UIView(frame: window.bounds)
        view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        // The dynamic system colour: white in the light appearance, black in the dark one.
        view.backgroundColor = UIColor.systemBackground
        view.isUserInteractionEnabled = false
        view.accessibilityElementsHidden = true
        window.addSubview(view)
        cover = view
    }

    /// Main thread.
    private func hideCover() {
        cover?.removeFromSuperview()
        cover = nil
    }
}
