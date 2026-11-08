//! The Windows implementation of the platform layer (`mod.rs` holds the contract): the Win32 / WinRT
//! calls that sat in lib.rs, offline.rs and opener.rs before the split, unchanged - DPAPI for the
//! account offline key, Windows Hello for the offline unlock, `ShellExecuteW` for the legal pages,
//! the MSIX package identity and the WinRT toast of the Store package. Compiled for `cfg(windows)`
//! only; the `windows` crate features it needs are listed in Cargo.toml. Nothing here opens a
//! network connection.

use super::{UserCheck, WindowHandle};

// --- MSIX package identity (lib.rs `own_package_family_name`) ---------------------------------------

/// Windows package identity of the current process (kernel32, available since Windows 8).
/// No extra crate: two plain FFI calls.
pub(crate) mod package_identity {
    const ERROR_SUCCESS: i32 = 0;
    const ERROR_INSUFFICIENT_BUFFER: i32 = 122;

    #[link(name = "kernel32")]
    extern "system" {
        fn GetCurrentPackageFamilyName(length: *mut u32, family_name: *mut u16) -> i32;
        fn GetCurrentPackagePath(length: *mut u32, path: *mut u16) -> i32;
    }

    /// The usual two-step call: ask for the length, then fetch the string. `None` when the
    /// process has no package identity (APPMODEL_ERROR_NO_PACKAGE) or on any other error.
    pub(crate) fn query(f: unsafe extern "system" fn(*mut u32, *mut u16) -> i32) -> Option<String> {
        let mut len: u32 = 0;
        // SAFETY: a zero length with a null buffer is the documented way to query the length.
        let rc = unsafe { f(&mut len, std::ptr::null_mut()) };
        if rc != ERROR_INSUFFICIENT_BUFFER || len == 0 || len > 32_768 {
            return None;
        }
        let mut buf = vec![0u16; len as usize];
        // SAFETY: `buf` holds `len` UTF-16 units, exactly what the first call asked for.
        let rc = unsafe { f(&mut len, buf.as_mut_ptr()) };
        if rc != ERROR_SUCCESS {
            return None;
        }
        let end = buf.iter().position(|c| *c == 0).unwrap_or(buf.len());
        String::from_utf16(&buf[..end]).ok().filter(|s| !s.is_empty())
    }

    /// Package family name (`Name_publisherid`) of the package this process runs in, if any.
    pub(crate) fn family_name() -> Option<String> {
        query(GetCurrentPackageFamilyName)
    }

    /// Install folder of the package this process runs in, if any.
    pub(crate) fn install_path() -> Option<std::path::PathBuf> {
        query(GetCurrentPackagePath).map(std::path::PathBuf::from)
    }
}

// --- Reminder toasts of the Store (MSIX) package (lib.rs `show_store_notification`) ------------------

/// The WinRT toast API, used only from inside our own package.
pub(crate) mod store_toast {
    use windows::core::HSTRING;
    use windows::Data::Xml::Dom::XmlDocument;
    use windows::UI::Notifications::{
        NotificationSetting, ToastNotification, ToastNotificationManager,
    };

    /// Sends `xml` as a toast of the packaged app. `Ok(true)`: Windows took it; `Ok(false)`:
    /// Windows reports that notifications are turned off for the app, nothing was sent.
    pub(crate) fn show(aumid: &str, xml: &str) -> Result<bool, String> {
        send(aumid, xml).map_err(|e| e.to_string())
    }

    fn send(aumid: &str, xml: &str) -> windows::core::Result<bool> {
        // The notifier of the calling app - the documented way for a process with package identity
        // (it is bound to the package's own AppUserModelID). Should Windows refuse that, the same
        // app is named explicitly.
        let notifier = ToastNotificationManager::CreateToastNotifier().or_else(|_| {
            ToastNotificationManager::CreateToastNotifierWithId(&HSTRING::from(aumid))
        })?;
        // Only a clear "turned off" stops here; if the setting cannot be read the toast is tried.
        if matches!(notifier.Setting(), Ok(setting) if setting != NotificationSetting::Enabled) {
            return Ok(false);
        }
        let document = XmlDocument::new()?;
        document.LoadXml(&HSTRING::from(xml))?;
        notifier.Show(&ToastNotification::CreateToastNotification(&document)?)?;
        Ok(true)
    }
}

// --- Account offline key at rest: DPAPI (offline.rs `offline_key_protect` / `offline_key_unprotect`) --

mod dpapi {
    use windows::core::PCWSTR;
    use windows::Win32::Foundation::{LocalFree, HLOCAL};
    use windows::Win32::Security::Cryptography::{
        CryptProtectData, CryptUnprotectData, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB,
    };

    fn blob(bytes: &[u8]) -> CRYPT_INTEGER_BLOB {
        CRYPT_INTEGER_BLOB { cbData: bytes.len() as u32, pbData: bytes.as_ptr() as *mut u8 }
    }

    /// Copies DPAPI's output and frees it (`LocalFree`), whatever happens next.
    unsafe fn take(out: CRYPT_INTEGER_BLOB) -> Vec<u8> {
        if out.pbData.is_null() {
            return Vec::new();
        }
        let bytes = std::slice::from_raw_parts(out.pbData, out.cbData as usize).to_vec();
        let _ = LocalFree(Some(HLOCAL(out.pbData as *mut core::ffi::c_void)));
        bytes
    }

    /// `CryptProtectData`, current-user scope (the default), no UI ever, the given entropy.
    pub fn protect(data: &[u8], entropy: &[u8]) -> Result<Vec<u8>, String> {
        let mut out = CRYPT_INTEGER_BLOB::default();
        // SAFETY: the input blobs point into slices that outlive the call; the output blob is
        // LocalAlloc'd by Windows and freed in `take`.
        unsafe {
            CryptProtectData(
                &blob(data),
                PCWSTR::null(),
                Some(&blob(entropy)),
                None,
                None,
                CRYPTPROTECT_UI_FORBIDDEN,
                &mut out,
            )
            .map_err(|e| format!("DPAPI protect failed: {e}"))?;
            Ok(take(out))
        }
    }

    /// `CryptUnprotectData` with the same entropy; fails for another entropy, user or machine.
    pub fn unprotect(data: &[u8], entropy: &[u8]) -> Result<Vec<u8>, String> {
        let mut out = CRYPT_INTEGER_BLOB::default();
        // SAFETY: as in `protect`; the description string is not requested (None).
        unsafe {
            CryptUnprotectData(
                &blob(data),
                None,
                Some(&blob(entropy)),
                None,
                None,
                CRYPTPROTECT_UI_FORBIDDEN,
                &mut out,
            )
            .map_err(|e| format!("DPAPI unprotect failed: {e}"))?;
            Ok(take(out))
        }
    }
}

/// DPAPI-wraps `key` for the current Windows user with the account's binding as entropy
/// (`ypd-offline-v1:<userId>`, docs/android-tasks/OFFLINE-DESIGN.md section 5.1). The blob is the
/// caller's to keep (the engine puts it in IndexedDB); nothing is stored here.
pub(crate) fn key_protect(user_id: &str, key: &[u8]) -> Result<Vec<u8>, String> {
    dpapi::protect(key, &super::key_binding(user_id))
}

/// Unwraps a blob of `key_protect` for the same account and Windows user; a blob of another account
/// (another entropy), user or machine is an error.
pub(crate) fn key_unprotect(user_id: &str, blob: &[u8]) -> Result<Vec<u8>, String> {
    dpapi::unprotect(blob, &super::key_binding(user_id))
}

/// Removes what Windows keeps of the account's key outside the blob: nothing. A DPAPI blob holds
/// everything and lives in the engine's IndexedDB, which the engine deletes itself
/// (docs/android-tasks/OFFLINE-DESIGN.md section 5.5), so this always succeeds and touches nothing.
/// The command `offline_key_remove` (offline.rs) calls it; the Windows adapter never invokes that
/// command - its `remove()` is empty - only the Mac's does (`mod.rs`, "The key vault has three
/// operations").
pub(crate) fn key_remove(_user_id: &str) -> Result<(), String> {
    Ok(())
}

// --- Offline unlock: Windows Hello (offline.rs `offline_user_check_available` / `offline_user_check`) --

pub(crate) mod hello {
    use super::UserCheck;
    use windows::core::HSTRING;
    use windows::Security::Credentials::UI::{
        UserConsentVerificationResult, UserConsentVerifier, UserConsentVerifierAvailability,
    };
    use windows::Win32::Foundation::HWND;
    use windows::Win32::System::WinRT::IUserConsentVerifierInterop;
    use windows_future::IAsyncOperation;

    /// `UserConsentVerifier.CheckAvailabilityAsync`: no UI, answers at once.
    pub(crate) fn available() -> Result<bool, String> {
        let availability = UserConsentVerifier::CheckAvailabilityAsync()
            .and_then(|op| op.get())
            .map_err(|e| e.to_string())?;
        Ok(availability == UserConsentVerifierAvailability::Available)
    }

    /// The Hello prompt, parented to the app window (`IUserConsentVerifierInterop`: the plain
    /// `RequestVerificationAsync` needs a CoreWindow and fails in a desktop app).
    pub(crate) fn verify(hwnd: HWND, message: &str) -> Result<UserCheck, String> {
        let interop = windows::core::factory::<UserConsentVerifier, IUserConsentVerifierInterop>()
            .map_err(|e| e.to_string())?;
        // SAFETY: `hwnd` is the live window handle Tauri handed out; the message outlives the call.
        let operation: IAsyncOperation<UserConsentVerificationResult> =
            unsafe { interop.RequestVerificationForWindowAsync(hwnd, &HSTRING::from(message)) }
                .map_err(|e| e.to_string())?;
        Ok(map_result(operation.get().map_err(|e| e.to_string())?))
    }

    pub(crate) fn map_result(result: UserConsentVerificationResult) -> UserCheck {
        match result {
            UserConsentVerificationResult::Verified => UserCheck::Ok,
            UserConsentVerificationResult::Canceled => UserCheck::Cancelled,
            UserConsentVerificationResult::RetriesExhausted => UserCheck::Failed,
            UserConsentVerificationResult::DeviceNotPresent
            | UserConsentVerificationResult::NotConfiguredForUser
            | UserConsentVerificationResult::DisabledByPolicy
            | UserConsentVerificationResult::DeviceBusy => UserCheck::Unavailable,
            _ => UserCheck::Failed,
        }
    }
}

/// Whether Windows Hello can verify the current user (no UI).
pub(crate) fn user_check_available() -> Result<bool, String> {
    hello::available()
}

/// The app window's HWND, taken on the command's thread. HWND is a raw pointer (not Send): carried
/// to the blocking thread as an integer.
pub(crate) fn window_handle(window: &tauri::WebviewWindow) -> Result<WindowHandle, String> {
    Ok(WindowHandle(window.hwnd().map_err(|e| e.to_string())?.0 as isize))
}

/// The Windows Hello prompt for the window of `window_handle`, with `message` (plain, one line,
/// already cut by the caller); blocks until the user answers.
pub(crate) fn user_check(window: WindowHandle, message: &str) -> Result<UserCheck, String> {
    hello::verify(windows::Win32::Foundation::HWND(window.0 as *mut core::ffi::c_void), message)
}

// --- The system browser: ShellExecuteW (opener.rs `open_external_url`) -------------------------------

/// Hands `url` - an address `opener::open_checked` accepted - to the default browser through the
/// Windows shell (`ShellExecuteW`, the `Win32_UI_Shell`, `Win32_UI_WindowsAndMessaging` and
/// `Win32_System_Com` features in Cargo.toml). Runs on a blocking thread of its own.
pub(crate) fn open_url(url: &str) -> Result<(), String> {
    use windows::core::{w, HSTRING, PCWSTR};
    use windows::Win32::System::Com::{
        CoInitializeEx, CoUninitialize, COINIT_APARTMENTTHREADED, COINIT_DISABLE_OLE1DDE,
    };
    use windows::Win32::UI::Shell::ShellExecuteW;
    use windows::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;

    let file = HSTRING::from(url);
    // Microsoft's ShellExecute documentation: initialize COM (apartment-threaded, without OLE1
    // DDE) first, because the address may be handed to a shell extension activated through COM.
    // SAFETY: plain Win32 calls; a successful CoInitializeEx (S_OK or S_FALSE) is balanced by
    // CoUninitialize on this same thread; `file` outlives the ShellExecuteW call.
    let code = unsafe {
        let com = CoInitializeEx(None, COINIT_APARTMENTTHREADED | COINIT_DISABLE_OLE1DDE);
        let instance = ShellExecuteW(
            None,
            w!("open"),
            &file,
            PCWSTR::null(),
            PCWSTR::null(),
            SW_SHOWNORMAL,
        );
        if com.is_ok() {
            CoUninitialize();
        }
        instance.0 as isize
    };
    crate::opener::shell_execute_outcome(code)
}
