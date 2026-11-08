//! The implementation of the platform layer for every target without a native one (`mod.rs` holds
//! the contract) - today everything but Windows; a Mac build gets `macos.rs` (WP-M2), which keeps
//! `package_identity` and `store_toast` of this file (macOS has neither), and this file then serves
//! the remaining targets. It compiles with std and the shared types only, stores nothing, opens
//! nothing and never panics: the queries answer "nothing here", the calls that would need the
//! operating system answer an error with `UNSUPPORTED` in it, which the UI already handles
//! (src/offline/native/tauri.ts turns errors of the user check into `false` / `'unavailable'`; a
//! failed `open_external_url` shows the address as text; a key that cannot be wrapped is not kept at
//! rest, so the app never opens from the device copy without a connection). The
//! `#[cfg(not(windows))]` arms of lib.rs, offline.rs and opener.rs gave the same answers before the
//! split (with other error texts). On Windows the file is compiled in the test build only, so the
//! Windows test suite proves it builds.

use super::{UserCheck, WindowHandle};

/// The text every "not here" error of this file carries (the tests of `mod.rs` look for it).
pub(crate) const UNSUPPORTED: &str = "not available on this platform";

/// `<what> is not available on this platform`.
pub(crate) fn unsupported(what: &str) -> String {
    format!("{what} is {UNSUPPORTED}")
}

pub(crate) mod package_identity {
    /// No package identity outside Windows: the shell always runs as an unpackaged app.
    pub(crate) fn family_name() -> Option<String> {
        None
    }

    pub(crate) fn install_path() -> Option<std::path::PathBuf> {
        None
    }
}

pub(crate) mod store_toast {
    /// Never reached: without a package identity lib.rs answers `not-packaged` and sends nothing.
    pub(crate) fn show(_aumid: &str, _xml: &str) -> Result<bool, String> {
        Err(super::unsupported("the toast of a Store package"))
    }
}

pub(crate) fn key_protect(_user_id: &str, _key: &[u8]) -> Result<Vec<u8>, String> {
    Err(unsupported("protecting the offline key"))
}

pub(crate) fn key_unprotect(_user_id: &str, _blob: &[u8]) -> Result<Vec<u8>, String> {
    Err(unsupported("unprotecting the offline key"))
}

/// Nothing is ever kept here (`key_protect` refuses), so there is nothing to remove: like deleting
/// a file that is already gone, that is a success. The command `offline_key_remove` (offline.rs)
/// calls it on a target this stub serves (`mod.rs`, "The key vault has three operations").
pub(crate) fn key_remove(_user_id: &str) -> Result<(), String> {
    Ok(())
}

/// No way to verify the user here: the engine then never offers the offline unlock.
pub(crate) fn user_check_available() -> Result<bool, String> {
    Ok(false)
}

/// No window is needed where nothing can be verified: the handle 0.
pub(crate) fn window_handle(_window: &tauri::WebviewWindow) -> Result<WindowHandle, String> {
    Ok(WindowHandle(0))
}

pub(crate) fn user_check(_window: WindowHandle, _message: &str) -> Result<UserCheck, String> {
    Ok(UserCheck::Unavailable)
}

pub(crate) fn open_url(_url: &str) -> Result<(), String> {
    Err(unsupported("opening an address in the system browser"))
}
