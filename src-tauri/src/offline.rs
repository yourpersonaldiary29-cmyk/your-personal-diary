//! Automatic offline mode - the desktop half (WP-H10d; docs/android-tasks/OFFLINE-DESIGN.md
//! sections 5 and 7; the Mac since docs/APPLE-PLAN.md WP-M2/M3). The engine itself is one
//! TypeScript implementation (src/offline/**); what the desktop app adds is here, behind the nine
//! Tauri commands of the section 7 "command contract" and `offline_key_remove` (the Mac's tenth),
//! called by the adapter src/offline/native/tauri.ts. The operating-system calls themselves (DPAPI
//! and Windows Hello on Windows, the Keychain and LocalAuthentication on macOS) are the platform
//! layer's (`platform/`: `platform/windows.rs`, `platform/macos.rs`); this file validates the
//! input, converts base64 and keeps the outbox mirror, which is portable code:
//!
//! * the account offline key (AOK) at rest: `offline_key_protect` / `offline_key_unprotect` wrap
//!   it through `platform::key_protect` / `key_unprotect` - on Windows DPAPI (`CryptProtectData`,
//!   current-user scope, `CRYPTPROTECT_UI_FORBIDDEN`, entropy `ypd-offline-v1:<userId>` =
//!   `platform::key_binding`); the blob itself is kept by the engine in IndexedDB, the shell
//!   stores nothing of it. A blob of another account or another Windows user never unprotects. On
//!   macOS the key is a Keychain item and the blob only the marker that names it;
//!   `offline_key_remove` (`platform::key_remove`) deletes that item - on Windows it does nothing,
//!   and the Windows adapter never calls it;
//! * the outbox mirror: `offline_mirror_put / list / read / delete / clear` keep a copy of every
//!   outbox and notes record (ciphertext the engine wrote - the shell cannot read it) under
//!   `%LOCALAPPDATA%\<identifier>\offline\<userId>\` (on macOS
//!   `~/Library/Application Support/<identifier>/offline/<userId>/`), so that an IndexedDB eviction
//!   loses nothing. A Store (MSIX) install uses the package-private equivalent, by the same logic as
//!   the WebView2 profile (`packaged_webview_data_dir`). Writes are atomic: a `.tmp` file, then a rename;
//! * offline unlock: `offline_user_check_available` / `offline_user_check` ask the platform
//!   (`platform::user_check_available` / `user_check`) - on Windows, Windows Hello
//!   (`UserConsentVerifier`, through `IUserConsentVerifierInterop` for a desktop window); on macOS
//!   Touch ID or the account password (LocalAuthentication). Nothing derived from the password is
//!   stored anywhere (section 5.7).
//!
//! Input validation is the contract's: `userId` must match `^u_[0-9a-f]{16}$` and a mirror file
//! `name` `^[0-9]+-[0-9a-f-]{36}\.(op|note)$`; everything else is refused before any path is built.
//! Nothing here opens a network connection.

use std::path::{Path, PathBuf};

use tauri::Manager;

use crate::platform::{self, UserCheck};

// --- Input validation (section 7) ------------------------------------------------------------------

/// `^u_[0-9a-f]{16}$`
pub(crate) fn check_user_id(user_id: &str) -> Result<&str, String> {
    let hex = user_id.strip_prefix("u_").unwrap_or("");
    if hex.len() == 16 && hex.bytes().all(|b| matches!(b, b'0'..=b'9' | b'a'..=b'f')) {
        Ok(user_id)
    } else {
        Err("offline: invalid user id".to_string())
    }
}

/// `^[0-9]+-[0-9a-f-]{36}\.(op|note)$` - `<seq>-<uuid>.op` of an outbox row, `<id>-<uuid>.note` of a note.
pub(crate) fn check_name(name: &str) -> Result<&str, String> {
    let invalid = || "offline: invalid mirror file name".to_string();
    if name.len() > 96 {
        return Err(invalid());
    }
    let stem = name
        .strip_suffix(".op")
        .or_else(|| name.strip_suffix(".note"))
        .ok_or_else(invalid)?;
    let (number, rid) = stem.split_once('-').ok_or_else(invalid)?;
    let digits = !number.is_empty() && number.bytes().all(|b| b.is_ascii_digit());
    let uuid = rid.len() == 36 && rid.bytes().all(|b| matches!(b, b'0'..=b'9' | b'a'..=b'f' | b'-'));
    if digits && uuid {
        Ok(name)
    } else {
        Err(invalid())
    }
}

// --- base64 (standard alphabet, as `btoa` / `atob` of the adapter) ----------------------------------

const BASE64: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

pub(crate) fn base64_encode(bytes: &[u8]) -> String {
    let mut out = String::with_capacity(bytes.len().div_ceil(3) * 4);
    for chunk in bytes.chunks(3) {
        let n = (u32::from(chunk[0]) << 16)
            | (u32::from(*chunk.get(1).unwrap_or(&0)) << 8)
            | u32::from(*chunk.get(2).unwrap_or(&0));
        out.push(BASE64[(n >> 18) as usize & 63] as char);
        out.push(BASE64[(n >> 12) as usize & 63] as char);
        out.push(if chunk.len() > 1 { BASE64[(n >> 6) as usize & 63] as char } else { '=' });
        out.push(if chunk.len() > 2 { BASE64[n as usize & 63] as char } else { '=' });
    }
    out
}

/// Strict decoding: the standard alphabet, padding either complete or absent, nothing else.
pub(crate) fn base64_decode(text: &str) -> Result<Vec<u8>, String> {
    let invalid = || "offline: invalid base64".to_string();
    let trimmed = text.trim_end_matches('=');
    let padding = text.len() - trimmed.len();
    // A lone character never decodes; padding, when present, completes the last group to four
    // characters exactly ("QQ==", "QUI=") - never more, and never padding without data ("=").
    if trimmed.len() % 4 == 1 || (padding > 0 && (padding > 2 || trimmed.len() % 4 == 0 || text.len() % 4 != 0)) {
        return Err(invalid());
    }
    let mut out = Vec::with_capacity(trimmed.len() / 4 * 3 + 2);
    for chunk in trimmed.as_bytes().chunks(4) {
        let mut n: u32 = 0;
        for &c in chunk {
            let v = match c {
                b'A'..=b'Z' => c - b'A',
                b'a'..=b'z' => c - b'a' + 26,
                b'0'..=b'9' => c - b'0' + 52,
                b'+' => 62,
                b'/' => 63,
                _ => return Err(invalid()),
            };
            n = (n << 6) | u32::from(v);
        }
        // A short last group is left-aligned like a full one; the bytes the missing characters would
        // have completed are dropped.
        n <<= 6 * (4 - chunk.len());
        out.push((n >> 16) as u8);
        if chunk.len() > 2 {
            out.push((n >> 8) as u8);
        }
        if chunk.len() > 3 {
            out.push(n as u8);
        }
    }
    Ok(out)
}

// --- The account offline key at rest (section 5.1; DPAPI on Windows, the Keychain on macOS) --------

/// Longest key the commands wrap (the AOK is 32 bytes; a generous bound against nonsense).
const MAX_KEY_BYTES: usize = 4096;

/// `offline_key_protect` without the Tauri plumbing: base64 in, base64 out. The platform binds the
/// blob to the account (`platform::key_binding`: the DPAPI entropy `ypd-offline-v1:<userId>`).
fn key_protect(user_id: &str, key_b64: &str) -> Result<String, String> {
    let user_id = check_user_id(user_id)?;
    let key = base64_decode(key_b64)?;
    if key.is_empty() || key.len() > MAX_KEY_BYTES {
        return Err("offline: key of an unexpected size".into());
    }
    Ok(base64_encode(&platform::key_protect(user_id, &key)?))
}

/// `offline_key_unprotect` without the Tauri plumbing.
fn key_unprotect(user_id: &str, blob_b64: &str) -> Result<String, String> {
    let user_id = check_user_id(user_id)?;
    let blob = base64_decode(blob_b64)?;
    if blob.is_empty() {
        return Err("offline: empty key blob".into());
    }
    Ok(base64_encode(&platform::key_unprotect(user_id, &blob)?))
}

/// `offline_key_remove` without the Tauri plumbing: what the platform keeps of the account's key
/// outside the blob - the Keychain item on macOS; nothing on Windows, where the blob holds everything
/// (the Windows adapter's `remove()` never calls the command).
fn key_remove(user_id: &str) -> Result<(), String> {
    platform::key_remove(check_user_id(user_id)?)
}

// --- Outbox mirror (section 5.4) --------------------------------------------------------------------

/// Folder of the mirror inside the app's local data folder: `<identifier>\offline\<userId>\<name>`.
const MIRROR_DIR: &str = "offline";
/// Suffix of the file a `put` writes first; the rename to the real name is the atomic step.
const MIRROR_TMP_SUFFIX: &str = ".tmp";
/// Longest mirror file accepted (an operation is at most about 2 MB of ciphertext, section 4.4).
const MIRROR_MAX_FILE_BYTES: u64 = 16 * 1024 * 1024;
/// A helper file this old is the leftover of a run that died in the middle of a put; `list` removes it.
const MIRROR_STALE_TMP: std::time::Duration = std::time::Duration::from_secs(60 * 60);
/// Makes every put's helper file name unique (the commands run on parallel threads: two puts of one
/// name must never write the same helper file).
static MIRROR_TMP_COUNTER: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);

/// `<name>.<pid>-<n>.tmp`: the helper file of one put.
fn mirror_tmp_name(name: &str) -> String {
    let n = MIRROR_TMP_COUNTER.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    format!("{name}.{}-{n}{MIRROR_TMP_SUFFIX}", std::process::id())
}

/// Whether `file` is a helper file of a put (`mirror_tmp_name` of a contract name).
fn is_mirror_tmp(file: &str) -> bool {
    let Some(stem) = file.strip_suffix(MIRROR_TMP_SUFFIX) else { return false };
    let Some((name, tag)) = stem.rsplit_once('.') else { return false };
    !tag.is_empty() && tag.bytes().all(|b| b.is_ascii_digit() || b == b'-') && check_name(name).is_ok()
}

/// The mirror root: `%LOCALAPPDATA%\<identifier>\offline`, or - inside our Store (MSIX) package - the
/// package-private folder the WebView2 profile uses too (`packaged_webview_data_dir`), so that the
/// mirror lives next to the IndexedDB it backs and is removed with the package. None without
/// `%LOCALAPPDATA%` (then the mirror is simply unavailable; the engine treats it as best effort).
fn mirror_root(local_app_data: Option<PathBuf>, own_family: Option<&str>, identifier: &str) -> Option<PathBuf> {
    let local = local_app_data?;
    let base = match own_family {
        Some(family) if super::is_package_family_name(family) => {
            super::packaged_webview_data_dir(&local, family, identifier)
        }
        _ => local.join(identifier),
    };
    Some(base.join(MIRROR_DIR))
}

/// The account's mirror folder (the user id is validated here, before any path exists).
fn account_dir(root: &Path, user_id: &str) -> Result<PathBuf, String> {
    Ok(root.join(check_user_id(user_id)?))
}

/// Writes `bytes` as `<dir>\<name>` atomically: the whole content goes to a helper file of its own
/// (`<name>.<pid>-<n>.tmp`) and is flushed to disk, then the rename replaces whatever `<name>` was
/// before (on Windows `std::fs::rename` replaces an existing file in one step). A crash leaves either
/// the old file, the new file, or a helper file that `list` never reports and removes once stale.
fn mirror_put(dir: &Path, name: &str, bytes: &[u8]) -> Result<(), String> {
    let name = check_name(name)?;
    if bytes.len() as u64 > MIRROR_MAX_FILE_BYTES {
        return Err("offline: mirror file too large".into());
    }
    std::fs::create_dir_all(dir).map_err(|e| format!("offline mirror: cannot create folder: {e}"))?;
    let final_path = dir.join(name);
    let tmp_path = dir.join(mirror_tmp_name(name));
    let written = (|| -> std::io::Result<()> {
        use std::io::Write;
        let mut file = std::fs::File::create(&tmp_path)?;
        file.write_all(bytes)?;
        file.sync_all()?;
        drop(file);
        std::fs::rename(&tmp_path, &final_path)
    })();
    if let Err(e) = written {
        let _ = std::fs::remove_file(&tmp_path);
        return Err(format!("offline mirror: write failed: {e}"));
    }
    Ok(())
}

/// The mirror files of an account (names matching the contract only, sorted); none for a missing
/// folder. Helper files of puts that died more than `MIRROR_STALE_TMP` ago are removed on the way (a
/// younger one may belong to a put still running).
fn mirror_list(dir: &Path) -> Result<Vec<String>, String> {
    let entries = match std::fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(e) => return Err(format!("offline mirror: cannot list: {e}")),
    };
    let mut names = Vec::new();
    for entry in entries.filter_map(Result::ok) {
        if !entry.file_type().map(|t| t.is_file()).unwrap_or(false) {
            continue;
        }
        let Ok(name) = entry.file_name().into_string() else { continue };
        if check_name(&name).is_ok() {
            names.push(name);
        } else if is_mirror_tmp(&name) {
            let stale = entry
                .metadata()
                .and_then(|m| m.modified())
                .ok()
                .and_then(|modified| modified.elapsed().ok())
                .is_some_and(|age| age >= MIRROR_STALE_TMP);
            if stale {
                let _ = std::fs::remove_file(entry.path());
            }
        }
    }
    names.sort();
    Ok(names)
}

fn mirror_read(dir: &Path, name: &str) -> Result<Vec<u8>, String> {
    let path = dir.join(check_name(name)?);
    let meta = std::fs::metadata(&path).map_err(|e| format!("offline mirror: cannot read: {e}"))?;
    if !meta.is_file() || meta.len() > MIRROR_MAX_FILE_BYTES {
        return Err("offline mirror: not a mirror file".into());
    }
    std::fs::read(&path).map_err(|e| format!("offline mirror: cannot read: {e}"))
}

/// Removes one file; a file that is already gone is not an error (the engine retries deletes).
fn mirror_delete(dir: &Path, name: &str) -> Result<(), String> {
    let path = dir.join(check_name(name)?);
    match std::fs::remove_file(&path) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(format!("offline mirror: cannot delete: {e}")),
    }
}

/// Removes the account's whole mirror folder (a full wipe, section 5.5); a missing folder is fine.
fn mirror_clear(dir: &Path) -> Result<(), String> {
    match std::fs::remove_dir_all(dir) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(format!("offline mirror: cannot clear: {e}")),
    }
}

/// The error of a mirror command when the install has no local data folder. Also one of the byte
/// strings scripts/store/build-msix.mjs looks for in the executable (`REQUIRED_EXE_MARKERS` in
/// scripts/store/msix-lib.mjs) to make sure a Store package ships a shell with the mirror commands.
pub(crate) const MIRROR_UNAVAILABLE_ERROR: &str = "offline mirror: no local data folder";

/// The account's mirror folder for a command: validated user id under the install's mirror root.
fn command_account_dir(app: &tauri::AppHandle, user_id: &str) -> Result<PathBuf, String> {
    let root = mirror_root(
        app.path().local_data_dir().ok(),
        super::own_package_family_name().as_deref(),
        &app.config().identifier,
    )
    .ok_or_else(|| MIRROR_UNAVAILABLE_ERROR.to_string())?;
    account_dir(&root, user_id)
}

// --- Offline unlock (section 5.7; Windows Hello on Windows, `platform::user_check*`) --------------
//
// The answer type `UserCheck` ("ok" | "cancelled" | "failed" | "unavailable") is the platform
// layer's (`platform::UserCheck`), imported above.

/// Longest message shown in the prompt (characters); the rest is cut.
const USER_CHECK_MAX_MESSAGE: usize = 200;

// --- The Tauri commands (section 7) ---------------------------------------------------------------
//
// Every command runs its work on a blocking thread: the key wrapping and the file system are quick
// but never belong on the IPC thread, and the user-check prompt blocks until the user answers.

async fn blocking<T: Send + 'static>(work: impl FnOnce() -> Result<T, String> + Send + 'static) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(work).await.map_err(|e| e.to_string())?
}

/// DPAPI-wraps the account offline key (macOS: stores it in the Keychain): `{ userId, keyB64 }` -> `blobB64`.
#[tauri::command]
pub async fn offline_key_protect(user_id: String, key_b64: String) -> Result<String, String> {
    blocking(move || key_protect(&user_id, &key_b64)).await
}

/// Unwraps a blob of `offline_key_protect` for the same account and Windows user: `{ userId, blobB64 }` -> `keyB64`.
#[tauri::command]
pub async fn offline_key_unprotect(user_id: String, blob_b64: String) -> Result<String, String> {
    blocking(move || key_unprotect(&user_id, &blob_b64)).await
}

/// Deletes what the platform keeps of the account's offline key outside the blob (the Mac's Keychain
/// item; nothing on Windows) - sign-out with "Delete", account deletion: `{ userId }`.
#[tauri::command]
pub async fn offline_key_remove(user_id: String) -> Result<(), String> {
    blocking(move || key_remove(&user_id)).await
}

/// Writes one mirror file atomically: `{ userId, name, dataB64 }`.
#[tauri::command]
pub async fn offline_mirror_put(
    app: tauri::AppHandle,
    user_id: String,
    name: String,
    data_b64: String,
) -> Result<(), String> {
    let dir = command_account_dir(&app, &user_id)?;
    blocking(move || mirror_put(&dir, &name, &base64_decode(&data_b64)?)).await
}

/// The account's mirror file names: `{ userId }` -> `string[]`.
#[tauri::command]
pub async fn offline_mirror_list(app: tauri::AppHandle, user_id: String) -> Result<Vec<String>, String> {
    let dir = command_account_dir(&app, &user_id)?;
    blocking(move || mirror_list(&dir)).await
}

/// One mirror file: `{ userId, name }` -> `dataB64`.
#[tauri::command]
pub async fn offline_mirror_read(app: tauri::AppHandle, user_id: String, name: String) -> Result<String, String> {
    let dir = command_account_dir(&app, &user_id)?;
    blocking(move || mirror_read(&dir, &name).map(|bytes| base64_encode(&bytes))).await
}

/// Removes one mirror file (after the IndexedDB delete committed): `{ userId, name }`.
#[tauri::command]
pub async fn offline_mirror_delete(app: tauri::AppHandle, user_id: String, name: String) -> Result<(), String> {
    let dir = command_account_dir(&app, &user_id)?;
    blocking(move || mirror_delete(&dir, &name)).await
}

/// Removes the account's whole mirror (sign-out with "Delete", account deletion): `{ userId }`.
#[tauri::command]
pub async fn offline_mirror_clear(app: tauri::AppHandle, user_id: String) -> Result<(), String> {
    let dir = command_account_dir(&app, &user_id)?;
    blocking(move || mirror_clear(&dir)).await
}

/// Whether the device can verify the current user (Windows Hello on Windows; no UI).
#[tauri::command]
pub async fn offline_user_check_available() -> Result<bool, String> {
    blocking(platform::user_check_available).await
}

/// Shows the device's verification prompt (Windows Hello on Windows) for the app window with
/// `message` and reports what the user did.
#[tauri::command]
pub async fn offline_user_check(window: tauri::WebviewWindow, message: String) -> Result<UserCheck, String> {
    let text: String = super::plain_text(&message).chars().take(USER_CHECK_MAX_MESSAGE).collect();
    // The window handle is taken here, on the command's thread; the prompt runs on a blocking one.
    let handle = platform::window_handle(&window)?;
    blocking(move || platform::user_check(handle, &text)).await
}

// Names the unit tests below use as before the platform split (the tests stay unchanged): the
// account binding of a wrapped key, and the Windows Hello module of the Windows implementation.
#[cfg(test)]
use crate::platform::key_binding as entropy;
#[cfg(all(test, windows))]
use crate::platform::windows::hello;

#[cfg(test)]
mod tests {
    use super::*;

    const DANA: &str = "u_0123456789abcdef";
    const LIOR: &str = "u_fedcba9876543210";
    const OP: &str = "7-11111111-1111-4111-8111-111111111111.op";
    const NOTE: &str = "3-22222222-2222-4222-8222-222222222222.note";

    fn temp_dir(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("mpd-offline-{tag}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        dir
    }

    #[test]
    fn user_ids_follow_the_contract() {
        assert_eq!(check_user_id(DANA), Ok(DANA));
        assert_eq!(check_user_id(LIOR), Ok(LIOR));
        for bad in [
            "",
            "u_",
            "u_0123456789ABCDEF",
            "u_0123456789abcde",
            "u_0123456789abcdef0",
            "x_0123456789abcdef",
            "../0123456789abcdef",
            "u_0123456789abcdef/..",
            "u_0123456789abcdeg",
            "u_0123456789abcde\u{5c}",
        ] {
            assert!(check_user_id(bad).is_err(), "{bad:?}");
        }
    }

    #[test]
    fn mirror_names_follow_the_contract() {
        assert_eq!(check_name(OP), Ok(OP));
        assert_eq!(check_name(NOTE), Ok(NOTE));
        assert!(check_name("0-00000000-0000-0000-0000-000000000000.op").is_ok());
        for bad in [
            "",
            "7-11111111-1111-4111-8111-111111111111.txt",
            "7-11111111-1111-4111-8111-111111111111.op.tmp",
            "-11111111-1111-4111-8111-111111111111.op",
            "7-11111111-1111-4111-8111-11111111111.op",
            "7-11111111-1111-4111-8111-1111111111111.op",
            "7-11111111-1111-4111-8111-11111111111G.op",
            "a-11111111-1111-4111-8111-111111111111.op",
            "..\u{5c}x.op",
            "../7-11111111-1111-4111-8111-111111111111.op",
            "7-11111111-1111-4111-8111-111111111111.OP",
            "7_11111111-1111-4111-8111-111111111111.op",
        ] {
            assert!(check_name(bad).is_err(), "{bad:?}");
        }
        let too_long = format!("{}-11111111-1111-4111-8111-111111111111.op", "9".repeat(80));
        assert!(check_name(&too_long).is_err());
    }

    #[test]
    fn base64_round_trips_and_rejects_garbage() {
        for len in 0..=66 {
            let bytes: Vec<u8> = (0..len).map(|i| (i * 37 + 11) as u8).collect();
            let text = base64_encode(&bytes);
            assert_eq!(text.len() % 4, 0);
            assert_eq!(base64_decode(&text).unwrap(), bytes, "len {len}");
            // The adapter's `atob` accepts unpadded input; so does this decoder.
            assert_eq!(base64_decode(text.trim_end_matches('=')).unwrap(), bytes, "unpadded len {len}");
        }
        assert_eq!(base64_encode(b"fictional diary text"), "ZmljdGlvbmFsIGRpYXJ5IHRleHQ=");
        assert_eq!(base64_decode("ZmljdGlvbmFsIGRpYXJ5IHRleHQ=").unwrap(), b"fictional diary text");
        for bad in ["=", "==", "A", "A===", "AB=C", "AB C", "AB\nCD", "AB-D", "ÄBCD", "A=BC", "QQ=", "QUJD=", "QUJD==", "QQ==="] {
            assert!(base64_decode(bad).is_err(), "{bad:?}");
        }
    }

    #[cfg(windows)]
    #[test]
    fn dpapi_round_trip_and_wrong_entropy_fails() {
        let key: Vec<u8> = (0u8..32).map(|i| i.wrapping_mul(7).wrapping_add(3)).collect();
        let key_b64 = base64_encode(&key);
        let blob = key_protect(DANA, &key_b64).unwrap();
        assert_ne!(blob, key_b64, "the blob is not the key");
        assert!(base64_decode(&blob).unwrap().len() > key.len(), "DPAPI adds its header");
        assert_eq!(key_unprotect(DANA, &blob).unwrap(), key_b64);
        // The same blob under another account (another entropy) never unprotects.
        assert!(key_unprotect(LIOR, &blob).is_err());
        // Two wraps of the same key differ (DPAPI salts), both unwrap.
        let again = key_protect(DANA, &key_b64).unwrap();
        assert_ne!(again, blob);
        assert_eq!(key_unprotect(DANA, &again).unwrap(), key_b64);
        // Damaged blobs and nonsense are errors, never panics.
        let mut damaged = base64_decode(&blob).unwrap();
        let last = damaged.len() - 1;
        damaged[last] ^= 0x55;
        assert!(key_unprotect(DANA, &base64_encode(&damaged)).is_err());
        assert!(key_unprotect(DANA, "AAAA").is_err());
        assert!(key_unprotect(DANA, "").is_err());
        assert!(key_unprotect(DANA, "not base64!").is_err());
    }

    #[test]
    fn key_commands_refuse_bad_input_before_touching_dpapi() {
        let key_b64 = base64_encode(&[1u8; 32]);
        assert!(key_protect("dana", &key_b64).is_err());
        assert!(key_protect(DANA, "").is_err(), "an empty key");
        assert!(key_protect(DANA, "***").is_err(), "not base64");
        assert!(key_protect(DANA, &base64_encode(&vec![0u8; MAX_KEY_BYTES + 1])).is_err(), "too large");
        assert!(key_unprotect("", "AAAA").is_err());
        assert_eq!(entropy(DANA), b"ypd-offline-v1:u_0123456789abcdef");
    }

    #[test]
    fn mirror_cycle_in_a_temp_dir_with_atomic_writes() {
        let root = temp_dir("mirror");
        let dir = account_dir(&root, DANA).unwrap();
        assert_eq!(dir, root.join(DANA));
        // Nothing yet: listing a folder that does not exist is empty, not an error.
        assert_eq!(mirror_list(&dir).unwrap(), Vec::<String>::new());
        assert!(mirror_read(&dir, OP).is_err());
        mirror_delete(&dir, OP).unwrap();
        mirror_clear(&dir).unwrap();

        mirror_put(&dir, OP, b"ciphertext of an operation").unwrap();
        mirror_put(&dir, NOTE, b"ciphertext of a note").unwrap();
        assert_eq!(mirror_list(&dir).unwrap(), vec![NOTE.to_string(), OP.to_string()]);
        assert_eq!(mirror_read(&dir, OP).unwrap(), b"ciphertext of an operation");
        assert_eq!(mirror_read(&dir, NOTE).unwrap(), b"ciphertext of a note");
        // The write went through a temporary file that is gone afterwards.
        let leftovers: Vec<_> = std::fs::read_dir(&dir)
            .unwrap()
            .filter_map(Result::ok)
            .map(|e| e.file_name().into_string().unwrap())
            .filter(|n| n.ends_with(MIRROR_TMP_SUFFIX))
            .collect();
        assert!(leftovers.is_empty(), "{leftovers:?}");
        // A second put replaces the content whole (the rename replaces the file).
        mirror_put(&dir, OP, b"sealed: the same row again").unwrap();
        assert_eq!(mirror_read(&dir, OP).unwrap(), b"sealed: the same row again");
        // Foreign files and a stray .tmp are never listed.
        std::fs::write(dir.join("notes.txt"), b"x").unwrap();
        std::fs::write(dir.join(format!("{OP}{MIRROR_TMP_SUFFIX}")), b"half").unwrap();
        std::fs::create_dir_all(dir.join("9-33333333-3333-4333-8333-333333333333.op")).unwrap();
        assert_eq!(mirror_list(&dir).unwrap(), vec![NOTE.to_string(), OP.to_string()]);

        mirror_delete(&dir, OP).unwrap();
        assert_eq!(mirror_list(&dir).unwrap(), vec![NOTE.to_string()]);
        mirror_delete(&dir, OP).unwrap(); // already gone: fine
        mirror_clear(&dir).unwrap();
        assert!(!dir.exists());
        assert_eq!(mirror_list(&dir).unwrap(), Vec::<String>::new());
        // Another account's folder is untouched by a clear of this one.
        let other = account_dir(&root, LIOR).unwrap();
        mirror_put(&other, OP, b"lior").unwrap();
        mirror_clear(&dir).unwrap();
        assert_eq!(mirror_read(&other, OP).unwrap(), b"lior");
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn mirror_refuses_unchecked_input_and_builds_no_path_from_it() {
        let root = temp_dir("mirror-bad");
        assert!(account_dir(&root, "../escape").is_err());
        assert!(account_dir(&root, "u_0123456789abcdef/../x").is_err());
        let dir = account_dir(&root, DANA).unwrap();
        for bad in ["../x.op", "x.op", "7-11111111-1111-4111-8111-111111111111.op.tmp", "C:\\x.op"] {
            assert!(mirror_put(&dir, bad, b"x").is_err(), "{bad:?}");
            assert!(mirror_read(&dir, bad).is_err(), "{bad:?}");
            assert!(mirror_delete(&dir, bad).is_err(), "{bad:?}");
        }
        assert!(!root.exists(), "nothing was created for refused input");
        // Oversized content is refused before anything is written.
        assert!(mirror_put(&dir, OP, &vec![0u8; MIRROR_MAX_FILE_BYTES as usize + 1]).is_err());
        assert!(!dir.join(OP).exists());
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn concurrent_puts_of_one_name_never_share_a_helper_file() {
        let root = temp_dir("mirror-race");
        let dir = account_dir(&root, DANA).unwrap();
        let payloads: Vec<Vec<u8>> = (0..8u8).map(|i| vec![b'a' + i; 64 * 1024 + usize::from(i) * 977]).collect();
        let threads: Vec<_> = payloads
            .iter()
            .cloned()
            .map(|bytes| {
                let dir = dir.clone();
                std::thread::spawn(move || {
                    for _ in 0..10 {
                        mirror_put(&dir, OP, &bytes).unwrap();
                    }
                })
            })
            .collect();
        for thread in threads {
            thread.join().unwrap();
        }
        // The file is one of the payloads, whole - never a mix or a truncated write.
        let content = mirror_read(&dir, OP).unwrap();
        assert!(payloads.contains(&content), "a torn file of {} bytes", content.len());
        let helpers: Vec<_> = std::fs::read_dir(&dir)
            .unwrap()
            .filter_map(Result::ok)
            .map(|e| e.file_name().into_string().unwrap())
            .filter(|n| n.ends_with(MIRROR_TMP_SUFFIX))
            .collect();
        assert!(helpers.is_empty(), "{helpers:?}");
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn list_removes_stale_helper_files_only() {
        let root = temp_dir("mirror-stale");
        let dir = account_dir(&root, DANA).unwrap();
        mirror_put(&dir, OP, b"row").unwrap();
        let stale = dir.join(format!("{NOTE}.4242-7{MIRROR_TMP_SUFFIX}"));
        let fresh = dir.join(format!("{OP}.4242-8{MIRROR_TMP_SUFFIX}"));
        let foreign = dir.join("notes.tmp");
        for path in [&stale, &fresh, &foreign] {
            std::fs::write(path, b"half written").unwrap();
        }
        let two_hours_ago = std::time::SystemTime::now() - std::time::Duration::from_secs(2 * 60 * 60);
        for path in [&stale, &foreign] {
            std::fs::File::options().write(true).open(path).unwrap().set_modified(two_hours_ago).unwrap();
        }
        assert!(is_mirror_tmp(&mirror_tmp_name(OP)));
        assert!(!is_mirror_tmp("notes.tmp"));
        assert!(!is_mirror_tmp(&format!("{OP}{MIRROR_TMP_SUFFIX}")));
        assert!(!is_mirror_tmp(&format!("{OP}.x{MIRROR_TMP_SUFFIX}")));
        assert_eq!(mirror_list(&dir).unwrap(), vec![OP.to_string()]);
        assert!(!stale.exists(), "a stale helper of this mirror is removed");
        assert!(fresh.exists(), "a young helper may belong to a running put");
        assert!(foreign.exists(), "files that are not ours are left alone");
        let _ = std::fs::remove_dir_all(&root);
    }

    #[cfg(windows)]
    #[test]
    fn mirror_root_follows_the_install_kind() {
        let local = PathBuf::from(r"C:\Users\dana\AppData\Local");
        // Downloaded (NSIS / MSI) install or tauri dev: next to the WebView2 profile folder.
        assert_eq!(
            mirror_root(Some(local.clone()), None, "com.mydiary.app"),
            Some(PathBuf::from(r"C:\Users\dana\AppData\Local\com.mydiary.app\offline"))
        );
        // Store (MSIX) install: the package-private folder of the WebView2 profile.
        let family = "12345Publisher.YourPersonalDiary_abcdefghjkmnp";
        assert_eq!(
            mirror_root(Some(local.clone()), Some(family), "com.mydiary.app"),
            Some(PathBuf::from(
                r"C:\Users\dana\AppData\Local\Packages\12345Publisher.YourPersonalDiary_abcdefghjkmnp\LocalCache\Local\com.mydiary.app\offline"
            ))
        );
        // An unusable family name is treated as unpackaged; no LOCALAPPDATA means no mirror.
        assert_eq!(
            mirror_root(Some(local), Some("garbage"), "com.mydiary.app"),
            Some(PathBuf::from(r"C:\Users\dana\AppData\Local\com.mydiary.app\offline"))
        );
        assert_eq!(mirror_root(None, Some(family), "com.mydiary.app"), None);
    }

    #[cfg(windows)]
    #[test]
    fn user_check_availability_returns_without_ui() {
        let started = std::time::Instant::now();
        let available = hello::available();
        println!("Windows Hello availability on this machine: {available:?} ({:?})", started.elapsed());
        assert!(available.is_ok(), "{available:?}");
        assert!(started.elapsed() < std::time::Duration::from_secs(20), "no prompt may be shown");
        // The result mapping of the prompt itself (never shown in a test).
        use windows::Security::Credentials::UI::UserConsentVerificationResult as R;
        assert_eq!(hello::map_result(R::Verified), UserCheck::Ok);
        assert_eq!(hello::map_result(R::Canceled), UserCheck::Cancelled);
        assert_eq!(hello::map_result(R::RetriesExhausted), UserCheck::Failed);
        for unavailable in [R::DeviceNotPresent, R::NotConfiguredForUser, R::DisabledByPolicy, R::DeviceBusy] {
            assert_eq!(hello::map_result(unavailable), UserCheck::Unavailable);
        }
        assert_eq!(hello::map_result(R(99)), UserCheck::Failed);
    }

    #[test]
    fn user_check_answers_match_the_adapter() {
        let names: Vec<String> = [UserCheck::Ok, UserCheck::Cancelled, UserCheck::Failed, UserCheck::Unavailable]
            .iter()
            .map(|o| serde_json::to_string(o).unwrap())
            .collect();
        assert_eq!(names, [r#""ok""#, r#""cancelled""#, r#""failed""#, r#""unavailable""#]);
        // The adapter (src/offline/native/tauri.ts, section 7) invokes exactly these commands.
        let adapter = include_str!("../../src/offline/native/tauri.ts");
        for command in [
            "offline_key_protect",
            "offline_key_unprotect",
            "offline_mirror_put",
            "offline_mirror_list",
            "offline_mirror_read",
            "offline_mirror_delete",
            "offline_mirror_clear",
            "offline_user_check_available",
            "offline_user_check",
        ] {
            assert!(adapter.contains(&format!("'{command}'")), "{command} missing in tauri.ts");
        }
        // The argument names are the camelCase of the Rust parameters (Tauri's default).
        for arg in ["userId:", "keyB64:", "blobB64:", "name:", "dataB64:", "message:"] {
            assert!(adapter.contains(arg), "{arg} missing in tauri.ts");
        }
    }

    #[test]
    fn key_remove_checks_the_user_id_and_is_registered_like_the_others() {
        for bad in ["", "dana", "u_0123456789ABCDEF", "u_0123456789abcdef/.."] {
            assert!(key_remove(bad).is_err(), "{bad:?}");
        }
        // Nothing is kept for this fictional account, so removing succeeds, also twice: on Windows
        // nothing is ever kept outside the blob, the macOS test build works on a temporary keychain
        // of the test's own (platform/macos.rs), the stub keeps nothing.
        assert_eq!(key_remove(DANA), Ok(()));
        assert_eq!(key_remove(DANA), Ok(()));
        // The Mac adapter invokes it (src/offline/native/tauri.ts), and both invoke handlers of
        // lib.rs - the shipped one and the local-server one - register it.
        let adapter = include_str!("../../src/offline/native/tauri.ts");
        assert!(adapter.contains("'offline_key_remove'"), "offline_key_remove missing in tauri.ts");
        assert_eq!(include_str!("lib.rs").matches("offline::offline_key_remove").count(), 2);
    }

    /// Portable (every target): without a package identity the mirror lives in
    /// `<local data folder>/<identifier>/offline` - on the Mac
    /// `~/Library/Application Support/app.yourpersonaldiary.mac/offline` (Tauri's `local_data_dir`).
    #[test]
    fn mirror_root_is_the_identifier_folder_of_the_local_data_folder() {
        let local = PathBuf::from("Users").join("dana").join("Library").join("Application Support");
        assert_eq!(
            mirror_root(Some(local.clone()), None, "app.yourpersonaldiary.mac"),
            Some(local.join("app.yourpersonaldiary.mac").join("offline"))
        );
        let dir = account_dir(&mirror_root(Some(local.clone()), None, "app.yourpersonaldiary.mac").unwrap(), DANA).unwrap();
        assert_eq!(dir, local.join("app.yourpersonaldiary.mac").join("offline").join(DANA));
        assert_eq!(mirror_root(None, None, "app.yourpersonaldiary.mac"), None);
    }
}
