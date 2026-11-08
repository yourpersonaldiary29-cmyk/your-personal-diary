//! The platform layer of the desktop shell: every call into the operating system's own APIs lives
//! behind the functions of this module, so that `lib.rs`, `offline.rs` and `opener.rs` are plain,
//! portable Rust and a build for another operating system is a matter of adding one implementation
//! file here (docs/android-tasks/APPLE-PREP.md item 2; docs/APPLE-PLAN.md section 4 and WP-A1 /
//! WP-M2). Nothing user-visible changed with the split: the Windows calls moved here unchanged.
//!
//! Implementations:
//! * `windows.rs` - the shipped Windows app (`cfg(windows)`): DPAPI, Windows Hello, `ShellExecuteW`,
//!   the MSIX package identity and the WinRT toast of the Store package.
//! * `macos.rs` - the Mac app (`cfg(target_os = "macos")`, WP-M2): the Keychain, LocalAuthentication
//!   and `/usr/bin/open`; no package identity and no Store toast (the stub's answers, `None` / never
//!   reached).
//! * `unsupported.rs` - every other target (today `cfg(not(any(windows, target_os = "macos")))`):
//!   compiles everywhere with std and the shared types only, stores nothing and answers what the
//!   table says. It is compiled on Windows too, in the test build only, so the Windows test suite
//!   proves it builds (tests below); macOS uses two of its modules.
//!
//! The contract - one free function per concern; the command plumbing, the input validation and the
//! outbox mirror (portable file code) stay in the calling module. The list is written once, below
//! (`pub(crate) use self::native::{...}`), and resolved against the implementation of the target
//! being built, so an implementation that lacks one of the names does not compile:
//!
//! | function | Windows (`windows.rs`) | stub (`unsupported.rs`) | macOS (`macos.rs`, WP-M2) |
//! |---|---|---|---|
//! | `key_protect(user_id, key) -> blob` | `CryptProtectData`, current user, entropy `key_binding(user_id)`; the blob holds everything | error | keeps the account's Keychain item when this build can read it and it holds the same key, else replaces it (service `app.yourpersonaldiary.mac.offline.v1`, account `<userId>`, data = the key; the data-protection keychain when the build may use it, else the login keychain), answers a marker blob |
//! | `key_unprotect(user_id, blob) -> key` | `CryptUnprotectData`, the same entropy | error | reads the item the marker names (this account; not a replaced or removed item) |
//! | `key_remove(user_id)` | `Ok(())`: nothing is kept outside the blob | `Ok(())`: nothing is ever kept | deletes the Keychain item (`Ok(())` when there is none) |
//! | `user_check_available() -> bool` | `UserConsentVerifier.CheckAvailabilityAsync` | `Ok(false)` | `LAContext.canEvaluatePolicy(.deviceOwnerAuthentication)` |
//! | `window_handle(&window) -> WindowHandle` | the HWND | `WindowHandle(0)` | `WindowHandle(0)` (LAContext needs no window) |
//! | `user_check(handle, message) -> UserCheck` | the Windows Hello prompt, parented to the window | `Ok(Unavailable)` | `evaluatePolicy(.deviceOwnerAuthentication)` (Touch ID or the account password), its reply waited for on the calling thread |
//! | `open_url(url)` | `ShellExecuteW` (after `opener::open_checked` accepted the address) | error | `/usr/bin/open <url>` (the same check first) |
//! | `package_identity::family_name()` / `install_path()` | kernel32 `GetCurrentPackageFamilyName` / `GetCurrentPackagePath` | `None` | the stub's: `None` (no MSIX) |
//! | `store_toast::show(aumid, xml)` | WinRT `ToastNotificationManager` | error, never reached | the stub's |
//!
//! The key vault has three operations, like `OfflineKeyVault` of src/offline/seams.ts (wrap, unwrap,
//! remove), each behind a command of offline.rs (`offline_key_protect`, `offline_key_unprotect`,
//! `offline_key_remove`). The Windows adapter never calls `offline_key_remove` (its `remove()` is
//! empty: nothing is kept outside the DPAPI blob); the Mac adapter (the `'keychain'` kind) does.
//!
//! What is not here: the rules of the Microsoft Store (MSIX) package - family names, the
//! package-private folders, the WebView2 profile redirect, the AppUserModelID and the toast XML in
//! `lib.rs`, the mirror root in `offline.rs`. They are path and text logic on the standard library
//! alone, they stay where their unit tests and the Store scripts name them
//! (scripts/store/msix-lib.mjs, src-tauri/msix/README.md), and ONE function of this layer decides
//! whether they apply at all: `package_identity::family_name()`. Where it answers `None` (the stub;
//! macOS) no package folder is selected, the WebView profile is not redirected, the mirror uses the
//! plain local data folder and no Store toast is sent (the test
//! `without_a_package_identity_the_store_package_rules_never_apply`).
//!
//! Adding an implementation (macOS, WP-M2 - done this way; the recipe for the next one):
//! 1. `platform/macos.rs` with `key_protect`, `key_unprotect`, `key_remove`, `user_check_available`,
//!    `window_handle`, `user_check` and `open_url`, and `pub(crate) use
//!    super::unsupported::{package_identity, store_toast};` for the two things macOS does not have.
//! 2. Here: `#[cfg(target_os = "macos")] pub(crate) mod macos;`, `use self::macos as native;` for
//!    that target, `not(any(windows, target_os = "macos"))` on the stub's `native` line, and
//!    `#[cfg_attr(target_os = "macos", allow(dead_code))]` on `mod unsupported` (macOS uses only
//!    those two modules of it).
//! 3. Cargo.toml: a `[target.'cfg(target_os = "macos")'.dependencies]` table (macOS-only crates).
//! 4. The tests below that name no platform run against the new implementation as they are. Three
//!    older tests compare Windows path literals and need `#[cfg(windows)]` on a Mac
//!    (`packaged_install_uses_the_package_private_data_dir` and
//!    `packaged_install_puts_the_webview_profile_in_the_package_private_folder` in lib.rs,
//!    `mirror_root_follows_the_install_kind` in offline.rs).
//!
//! Rules every implementation keeps: no network connection is ever opened here; nothing derived from
//! the password is stored; the callers validate their input (user ids, mirror names, the opener's
//! allow-rule) before calling in, so an implementation only sees checked values - `message` of
//! `user_check` is one cleaned line of at most 200 characters and may be empty; every function may
//! block (prompts, COM) and is called from a blocking thread by the commands.

use serde::Serialize;

/// The binding of a wrapped account offline key to its account: `ypd-offline-v1:<userId>`. On
/// Windows it is the DPAPI entropy (a blob of another account never unprotects); the Android plugin
/// uses the same text as the AES-GCM additional data (`AAD_PREFIX` in DiaryOfflinePlugin.java), and
/// so will the iOS plugin. It is part of the on-disk format of the Windows app: existing blobs stop
/// unprotecting if it changes (docs/android-tasks/OFFLINE-DESIGN.md section 5.1). The stub binds
/// nothing, hence the allowance for the targets it serves.
#[cfg_attr(not(windows), allow(dead_code))]
pub(crate) const KEY_BINDING_PREFIX: &str = "ypd-offline-v1:";

#[cfg_attr(not(windows), allow(dead_code))]
pub(crate) fn key_binding(user_id: &str) -> Vec<u8> {
    format!("{KEY_BINDING_PREFIX}{user_id}").into_bytes()
}

/// The answer of `user_check` and of the `offline_user_check` command (the adapter
/// src/offline/native/tauri.ts reads the lowercase names). The stub only ever answers
/// `Unavailable`, hence the allowance for the targets it serves.
#[derive(Serialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
#[cfg_attr(not(windows), allow(dead_code))]
pub(crate) enum UserCheck {
    /// The operating system verified the user.
    Ok,
    /// The user dismissed the prompt.
    Cancelled,
    /// The attempts were used up.
    Failed,
    /// No way to verify on this device or for this user, disabled by policy, or the device is busy.
    Unavailable,
}

/// The native handle of the app window as a plain integer, so it can cross to a blocking thread
/// (Windows: the HWND; a platform whose prompt needs no window: 0). Taken with `window_handle` on
/// the command's thread, handed to `user_check` on a blocking one.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) struct WindowHandle(pub(crate) isize);

#[cfg(windows)]
pub(crate) mod windows;
#[cfg(target_os = "macos")]
pub(crate) mod macos;

/// The stub: the implementation of every target without a native one - and on Windows a module of
/// the test build only (never part of the shipped executable), so `cargo test` compiles it there.
/// macOS uses its `package_identity` and `store_toast` only, hence the allowance there.
#[cfg(any(not(windows), test))]
#[cfg_attr(target_os = "macos", allow(dead_code))]
pub(crate) mod unsupported;

/// The implementation of the target being built.
#[cfg(windows)]
use self::windows as native;
#[cfg(target_os = "macos")]
use self::macos as native;
#[cfg(not(any(windows, target_os = "macos")))]
use self::unsupported as native;

// The contract as the callers reach it (`platform::key_protect`, ...): one list for every target.
pub(crate) use self::native::{
    key_protect, key_remove, key_unprotect, open_url, package_identity, store_toast, user_check,
    user_check_available, window_handle,
};

#[cfg(test)]
mod tests {
    use super::*;

    const DANA: &str = "u_0123456789abcdef";
    const LIOR: &str = "u_fedcba9876543210";

    /// The signatures of the contract, written once: lib.rs, offline.rs and opener.rs compile
    /// against exactly these, so every implementation module must provide them all.
    macro_rules! assert_contract_signatures {
        ($implementation:ident) => {{
            let _: fn(&str, &[u8]) -> Result<Vec<u8>, String> = $implementation::key_protect;
            let _: fn(&str, &[u8]) -> Result<Vec<u8>, String> = $implementation::key_unprotect;
            let _: fn(&str) -> Result<(), String> = $implementation::key_remove;
            let _: fn() -> Result<bool, String> = $implementation::user_check_available;
            let _: fn(&tauri::WebviewWindow) -> Result<WindowHandle, String> = $implementation::window_handle;
            let _: fn(WindowHandle, &str) -> Result<UserCheck, String> = $implementation::user_check;
            let _: fn(&str) -> Result<(), String> = $implementation::open_url;
            let _: fn() -> Option<String> = $implementation::package_identity::family_name;
            let _: fn() -> Option<std::path::PathBuf> = $implementation::package_identity::install_path;
            let _: fn(&str, &str) -> Result<bool, String> = $implementation::store_toast::show;
        }};
    }

    #[test]
    fn every_implementation_has_the_contract_signatures() {
        // The implementation of this target - what the callers reach as `platform::*`...
        assert_contract_signatures!(native);
        // ...and the stub, compiled on every target (on Windows in the test build only): a target
        // that gets no implementation of its own still builds.
        assert_contract_signatures!(unsupported);
    }

    /// The stub stores nothing and answers without panicking - an error where the operating system
    /// would have been needed, the honest "nothing here" for the queries. The same answers the
    /// `#[cfg(not(windows))]` arms of lib.rs, offline.rs and opener.rs gave before the split.
    #[test]
    fn the_stub_answers_unsupported_without_panicking() {
        use super::unsupported as stub;
        let key = [7u8; 32];
        for error in [
            stub::key_protect(DANA, &key).unwrap_err(),
            stub::key_unprotect(DANA, &key).unwrap_err(),
            stub::open_url("about:blank").unwrap_err(),
            stub::store_toast::show("Publisher.App_abcdefghjkmnp!App", "<toast/>").unwrap_err(),
        ] {
            assert!(error.contains(stub::UNSUPPORTED), "{error}");
        }
        assert_eq!(stub::key_remove(DANA), Ok(()), "nothing is ever kept, so there is nothing to remove");
        assert_eq!(stub::user_check_available(), Ok(false));
        assert_eq!(stub::user_check(WindowHandle(0), "Unlock your diary"), Ok(UserCheck::Unavailable));
        assert_eq!(stub::user_check(WindowHandle(0), ""), Ok(UserCheck::Unavailable));
        assert_eq!(stub::package_identity::family_name(), None);
        assert_eq!(stub::package_identity::install_path(), None);
        assert_eq!(stub::unsupported("x"), format!("x is {}", stub::UNSUPPORTED));
    }

    /// The one gate of everything MSIX in lib.rs: a platform without a package identity (the stub's
    /// answers; macOS) selects no package folder, leaves the WebView profile alone and sends no Store
    /// toast - the frontend keeps the notification plugin. (The mirror root of such a platform is the
    /// plain local data folder: `mirror_root_is_the_identifier_folder_of_the_local_data_folder` in
    /// offline.rs, which runs on every target; `mirror_root_follows_the_install_kind` there is the
    /// Windows one, `#[cfg(windows)]`.)
    #[test]
    fn without_a_package_identity_the_store_package_rules_never_apply() {
        use super::unsupported::{package_identity as none, store_toast};
        let family = crate::own_package_family(none::family_name(), none::install_path(), std::env::current_exe().ok());
        assert_eq!(family, None);
        let local = Some(std::path::PathBuf::from("local-data"));
        assert_eq!(crate::select_webview_data_dir(local, family.as_deref(), "com.mydiary.app", false), None);
        assert_eq!(
            crate::notify_as_store_app(family.as_deref(), "Reminder", "Drink water", store_toast::show),
            (crate::StoreNotification::NotPackaged, None)
        );
    }

    /// The key vault of the target being built: a blob is bound to its account, and nonsense is an
    /// error, never a panic. A target without a vault (the stub) refuses everything instead; Windows
    /// always has one, and so has macOS (in the test build on a temporary keychain of the test's
    /// own, `macos::test_keychain` - never the login keychain).
    #[test]
    fn the_key_vault_binds_a_blob_to_its_account() {
        let key: Vec<u8> = (0u8..32).map(|i| i.wrapping_mul(13).wrapping_add(5)).collect();
        let blob = match key_protect(DANA, &key) {
            Ok(blob) => blob,
            Err(error) => {
                assert!(cfg!(not(windows)), "DPAPI is always there on Windows: {error}");
                assert!(key_unprotect(DANA, &key).is_err());
                assert_eq!(key_remove(DANA), Ok(()));
                return;
            }
        };
        assert_ne!(blob, key, "the blob is not the key");
        assert_eq!(key_unprotect(DANA, &blob).unwrap(), key);
        assert!(key_unprotect(LIOR, &blob).is_err(), "another account's binding never unprotects");
        assert!(key_unprotect(DANA, &[1, 2, 3]).is_err(), "nonsense is an error, never a panic");
        // Removing succeeds, also twice and for an account that never had a key.
        assert_eq!(key_remove(DANA), Ok(()));
        assert_eq!(key_remove(DANA), Ok(()));
        assert_eq!(key_remove(LIOR), Ok(()));
        // Windows keeps nothing outside the blob: removing deleted nothing, the blob still opens.
        #[cfg(windows)]
        assert_eq!(key_unprotect(DANA, &blob).unwrap(), key);
        // macOS keeps the key in the Keychain item: once it is removed, the blob opens nothing.
        #[cfg(target_os = "macos")]
        assert!(key_unprotect(DANA, &blob).is_err(), "the Keychain item is gone");
    }

    /// The queries of the target being built answer at once and never show a prompt.
    #[test]
    fn the_queries_answer_without_ui() {
        // The test process is never installed inside our package; the two calls agree with each other.
        assert_eq!(package_identity::family_name().is_some(), package_identity::install_path().is_some());
        let started = std::time::Instant::now();
        assert!(user_check_available().is_ok());
        assert!(started.elapsed() < std::time::Duration::from_secs(20), "no prompt may be shown");
    }

    #[test]
    fn key_binding_is_the_text_every_platform_binds_a_key_with() {
        // The DPAPI entropy of the Windows app and the AES-GCM additional data of the Android plugin
        // (android/app/src/main/java/com/mydiary/app/plugins/DiaryOfflinePlugin.java `AAD_PREFIX`).
        assert_eq!(KEY_BINDING_PREFIX, "ypd-offline-v1:");
        assert_eq!(key_binding(DANA), b"ypd-offline-v1:u_0123456789abcdef");
        assert_ne!(key_binding(DANA), key_binding(LIOR));
    }

    #[test]
    fn user_check_answers_serialize_as_the_adapter_reads_them() {
        let names: Vec<String> = [UserCheck::Ok, UserCheck::Cancelled, UserCheck::Failed, UserCheck::Unavailable]
            .iter()
            .map(|o| serde_json::to_string(o).unwrap())
            .collect();
        assert_eq!(names, [r#""ok""#, r#""cancelled""#, r#""failed""#, r#""unavailable""#]);
    }

    /// The byte strings scripts/store/msix-lib.mjs (`REQUIRED_EXE_MARKERS`) looks for in the Windows
    /// executable are constants of lib.rs / offline.rs, used on reachable paths of the shipped build:
    /// the split must never move them into a module that is not compiled on Windows.
    #[test]
    fn the_store_build_markers_stay_in_the_windows_sources() {
        let script = include_str!("../../../scripts/store/msix-lib.mjs");
        let block = script
            .split("REQUIRED_EXE_MARKERS = [")
            .nth(1)
            .expect("REQUIRED_EXE_MARKERS in scripts/store/msix-lib.mjs")
            .split("];")
            .next()
            .unwrap();
        let markers: Vec<&str> = block.split("text: '").skip(1).map(|rest| rest.split('\'').next().unwrap()).collect();
        assert!(markers.len() >= 3, "{markers:?}");
        let constants = [crate::WEBVIEW2_USER_DATA_FOLDER_ENV, crate::offline::MIRROR_UNAVAILABLE_ERROR, crate::MSIX_TOAST_LOG_TAG];
        for marker in &markers {
            assert!(constants.iter().any(|c| c.contains(marker)), "marker {marker:?} is not a constant of lib.rs / offline.rs");
        }
    }
}
