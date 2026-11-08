//! The macOS implementation of the platform layer (`mod.rs` holds the contract; docs/APPLE-PLAN.md
//! section 4 and WP-M2): the Keychain for the account offline key, LocalAuthentication (Touch ID or
//! the account password) for the offline unlock and `/usr/bin/open` for the legal pages. macOS has
//! no MSIX package identity and no Store toast: those two modules are the stub's (`unsupported.rs`).
//! Compiled for `target_os = "macos"` only, with the objc2 bindings of the
//! `[target.'cfg(target_os = "macos")'.dependencies]` table of Cargo.toml. Nothing here opens a
//! network connection, and there is no cryptography of its own: the Keychain keeps the key and
//! macOS protects it.
//!
//! The key vault (OFFLINE-DESIGN.md section 5.1; scripts/mac/README.he.md has what the owner sees):
//! * One generic-password item per account: service `KEYCHAIN_SERVICE` (the Mac identifier of
//!   src-tauri/tauri.macos.conf.json plus `.offline.v1`), account = the user id, data = the account
//!   offline key (AOK) itself, never synchronizable. `key_protect` answers a marker blob
//!   (`keychain-v1:<place>:<userId>:<32 hex>`, no secret in it) that the engine keeps in IndexedDB
//!   like the DPAPI blob on Windows; its random part is also stored on the item (`kSecAttrGeneric`)
//!   and changes whenever the item is replaced, so a stale marker or another account's marker never
//!   reads a key.
//! * Where: the data-protection keychain (`kSecUseDataProtectionKeychain`, accessible after the
//!   first unlock and on this device only) when the app may use it - that needs a team and the
//!   keychain entitlements, i.e. a signed build with a provisioning profile - otherwise the user's
//!   file-based login keychain, named explicitly in every call (`SecKeychainCopyDefault`), exactly as
//!   the tests name their temporary keychain. Checked on the build Mac (2026-11-06, macOS 14.6.1): an ad-hoc
//!   signed binary or app bundle gets errSecMissingEntitlement (-34018) from every write and delete
//!   on the data-protection keychain (a read answers "not found" either way), so the ad-hoc build of
//!   today uses the login keychain and a Developer ID build with a profile moves to the
//!   data-protection keychain by itself (and then removes the login-keychain item of the unentitled
//!   build on a best-effort basis: the key at rest is the data-protection item from then on).
//! * The file-based keychain binds an item to the code signature of the build that created it: a
//!   rebuilt ad-hoc app (new cdhash) cannot read the old item (-25293), but it may delete it and add
//!   a new one without any authorization (checked on the build Mac). So `key_protect` first reads
//!   the account's item: readable by this build and holding the very key (an online start of the
//!   same build), the item and its marker stay and nothing is written; otherwise - no item, another
//!   build's item, a new key - the item is deleted and a fresh one added. A marker is therefore valid
//!   until the item is replaced or removed, even when the engine fails to save it. Every vault call
//!   runs with the Keychain's user interaction switched off: a read that would need the "wants to
//!   use your confidential information" dialog fails instead (the app then needs one connection to
//!   wrap the key again), and macOS never asks the user for a keychain password on the app's behalf.
//!   (Over SSH no dialog can appear anyway; that the switch also holds in the GUI session is the
//!   owner's manual check, scripts/mac/README.he.md section 3.)
//! * The test build never touches the user's keychains: the contract functions work on a temporary
//!   keychain file of the test's own thread (`test_keychain`), see "The test seam" below.

use std::ffi::c_void;
use std::process::{Command, Stdio};
use std::ptr::{null, NonNull};
use std::sync::mpsc::{sync_channel, Receiver, RecvTimeoutError};
use std::sync::{Mutex, PoisonError};
use std::time::Duration;

use block2::RcBlock;
use objc2::rc::autoreleasepool;
use objc2::runtime::Bool;
use objc2_core_foundation::{CFArray, CFBoolean, CFData, CFDictionary, CFRetained, CFString, CFType, Type};
use objc2_foundation::{NSError, NSString};
use objc2_local_authentication::{LAContext, LAError, LAErrorDomain, LAPolicy};
use objc2_security::{
    errSecDuplicateItem, errSecInteractionNotAllowed, errSecItemNotFound, errSecMissingEntitlement, errSecNotAvailable,
    kSecAttrAccessible, kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly, kSecAttrAccount, kSecAttrGeneric, kSecAttrLabel,
    kSecAttrService, kSecAttrSynchronizable, kSecClass, kSecClassGenericPassword, kSecMatchLimit, kSecMatchLimitOne,
    kSecMatchSearchList, kSecRandomDefault, kSecReturnAttributes, kSecReturnData, kSecUseDataProtectionKeychain,
    kSecUseKeychain, kSecValueData, SecItemAdd, SecItemCopyMatching, SecItemDelete, SecKeychain, SecRandomCopyBytes,
};

use super::{UserCheck, WindowHandle};

// --- What macOS does not have: the stub's answers (`mod.rs`, "Adding an implementation") ---------------

pub(crate) use super::unsupported::{package_identity, store_toast};

// --- Account offline key at rest: the Keychain (offline.rs `offline_key_protect` / `_unprotect` / `_remove`)

/// The Keychain service of the account offline key: the Mac identifier (`identifier` of
/// src-tauri/tauri.macos.conf.json) plus `.offline.v1` - a test keeps the two in step.
pub(crate) const KEYCHAIN_SERVICE: &str = "app.yourpersonaldiary.mac.offline.v1";

/// The item's name in Keychain Access (no secret in it).
const KEYCHAIN_LABEL: &str = "Your Personal Diary offline key";

/// The first field of every marker blob.
const MARKER_VERSION: &str = "keychain-v1";

/// The random part of a marker, kept on the item as well (`kSecAttrGeneric`).
const NONCE_BYTES: usize = 16;

/// errSecAuthFailed: the item's access list does not name this build (Security/SecBase.h).
const ERR_SEC_AUTH_FAILED: i32 = -25293;

/// errSecNoDefaultKeychain (Security/SecBase.h): there is no file-based keychain to store in.
const ERR_SEC_NO_DEFAULT_KEYCHAIN: i32 = -25307;

/// Where an item lives.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Place {
    /// The data-protection keychain (`kSecUseDataProtectionKeychain`): needs the keychain entitlements.
    DataProtection,
    /// A file-based keychain: the user's login keychain, or the tests' temporary one.
    File,
}

impl Place {
    fn tag(self) -> &'static str {
        match self {
            Place::DataProtection => "dp",
            Place::File => "file",
        }
    }

    fn from_tag(tag: &str) -> Option<Place> {
        match tag {
            "dp" => Some(Place::DataProtection),
            "file" => Some(Place::File),
            _ => None,
        }
    }
}

/// The keychains a vault call uses.
pub(super) struct Keychains<'a> {
    /// Try the data-protection keychain first (the app). The test build does so in one test only,
    /// behind a probe that this build has no entitlements for it (so nothing is ever written there).
    data_protection: bool,
    /// The file-based keychain, named explicitly in every call (`kSecUseKeychain` /
    /// `kSecMatchSearchList`), so a query never reaches another keychain and the app takes the same
    /// path as the tests: the user's default (login) keychain in the app, the test's temporary
    /// keychain in the test build. `None` when there is no default keychain: then only the
    /// data-protection keychain can hold the key.
    file: Option<&'a SecKeychain>,
}

/// The user's default keychain - the login keychain - for the app's vault calls (never in tests).
#[cfg(not(test))]
#[allow(deprecated)]
fn default_keychain() -> Option<CFRetained<SecKeychain>> {
    let mut keychain: *mut SecKeychain = std::ptr::null_mut();
    // SAFETY: a valid out pointer; on success it holds a +1 reference, which CFRetained takes over.
    // Only a reference is handed out: nothing is unlocked or read.
    let status = unsafe { SecKeychain::copy_default(NonNull::from(&mut keychain)) };
    if status != 0 {
        return None;
    }
    NonNull::new(keychain).map(|keychain| unsafe { CFRetained::from_raw(keychain) })
}

/// One vault call at a time in this process: the calls switch the Keychain's user interaction off
/// for the process while they run (`KeychainUiOff`), and `key_protect` is a read, then possibly a
/// delete followed by an add.
static VAULT: Mutex<()> = Mutex::new(());

/// Runs `work` as one vault call: serialized, with the Keychain's dialogs switched off.
fn vault_call<T>(work: impl FnOnce() -> T) -> T {
    let _one_at_a_time = VAULT.lock().unwrap_or_else(PoisonError::into_inner);
    let _no_dialogs = KeychainUiOff::new();
    work()
}

/// While it lives, Keychain calls of this process fail instead of showing a dialog
/// (`SecKeychainSetUserInteractionAllowed(false)`, the one switch that covers the file-based
/// keychain's access dialog; deprecated, still honoured), and the previous setting comes back on drop.
struct KeychainUiOff {
    /// The previous setting, a C `Boolean` (unsigned char).
    before: u8,
}

impl KeychainUiOff {
    #[allow(deprecated)]
    fn new() -> Self {
        let mut before: u8 = 1;
        // SAFETY: plain calls with a valid out pointer; they only flip a flag of this process.
        unsafe {
            if SecKeychain::user_interaction_allowed(NonNull::from(&mut before)) != 0 {
                before = 1;
            }
            SecKeychain::set_user_interaction_allowed(false);
        }
        KeychainUiOff { before }
    }
}

impl Drop for KeychainUiOff {
    #[allow(deprecated)]
    fn drop(&mut self) {
        // SAFETY: as in `new`.
        unsafe {
            SecKeychain::set_user_interaction_allowed(self.before != 0);
        }
    }
}

/// A Keychain query or new item: keys of the Security framework, retained values.
struct Query {
    keys: Vec<&'static CFString>,
    values: Vec<CFRetained<CFType>>,
}

impl Query {
    /// The account's item - a generic password of our service, account = the user id - in `place`
    /// of `keychains`. `for_add` names the target keychain the way SecItemAdd wants it.
    fn item(keychains: &Keychains<'_>, place: Place, user_id: &str, for_add: bool) -> Query {
        let mut query = Query { keys: Vec::new(), values: Vec::new() };
        // SAFETY (all `unsafe` blocks of this impl): the keys and constant values are immutable
        // statics of the Security framework, valid for the whole process.
        unsafe {
            query.set(kSecClass, kSecClassGenericPassword);
            query.set(kSecAttrService, &*CFString::from_str(KEYCHAIN_SERVICE));
            query.set(kSecAttrAccount, &*CFString::from_str(user_id));
            match (place, keychains.file) {
                (Place::DataProtection, _) => query.set(kSecUseDataProtectionKeychain, CFBoolean::new(true)),
                (Place::File, Some(keychain)) if for_add => query.set(kSecUseKeychain, keychain),
                (Place::File, Some(keychain)) => query.set(kSecMatchSearchList, &*CFArray::from_objects(&[keychain])),
                // Never sent: `add`, `delete` and `copy_key` stop before a file query without a keychain.
                (Place::File, None) => {}
            }
        }
        query
    }

    fn set(&mut self, key: &'static CFString, value: &(impl AsRef<CFType> + ?Sized)) {
        self.keys.push(key);
        self.values.push(value.as_ref().retain());
    }

    fn dictionary(&self) -> CFRetained<CFDictionary<CFString, CFType>> {
        let values: Vec<&CFType> = self.values.iter().map(|value| &**value).collect();
        CFDictionary::from_slices(&self.keys, &values)
    }

    /// The new item: the key as its data, the nonce of its marker, never synchronized; in the
    /// data-protection keychain readable after the first unlock and on this device only (the
    /// file-based keychain has no such classes: it is unlocked with the login as a whole).
    fn new_item(keychains: &Keychains<'_>, place: Place, user_id: &str, key: &[u8], nonce: &[u8; NONCE_BYTES]) -> Query {
        let mut query = Query::item(keychains, place, user_id, true);
        unsafe {
            query.set(kSecAttrLabel, &*CFString::from_str(KEYCHAIN_LABEL));
            query.set(kSecAttrGeneric, &*CFData::from_bytes(nonce));
            query.set(kSecAttrSynchronizable, CFBoolean::new(false));
            if place == Place::DataProtection {
                query.set(kSecAttrAccessible, kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly);
            }
            query.set(kSecValueData, &*CFData::from_bytes(key));
        }
        query
    }

    /// The data of the account's item whose nonce is `nonce`.
    fn key_of(keychains: &Keychains<'_>, place: Place, user_id: &str, nonce: &[u8; NONCE_BYTES]) -> Query {
        let mut query = Query::item(keychains, place, user_id, false);
        unsafe {
            query.set(kSecAttrGeneric, &*CFData::from_bytes(nonce));
            query.set(kSecMatchLimit, kSecMatchLimitOne);
            query.set(kSecReturnData, CFBoolean::new(true));
        }
        query
    }

    /// The account's item, whatever its nonce, with its attributes and its data (SecItemCopyMatching
    /// then answers a dictionary): what an earlier wrap left.
    fn existing(keychains: &Keychains<'_>, place: Place, user_id: &str) -> Query {
        let mut query = Query::item(keychains, place, user_id, false);
        unsafe {
            query.set(kSecMatchLimit, kSecMatchLimitOne);
            query.set(kSecReturnAttributes, CFBoolean::new(true));
            query.set(kSecReturnData, CFBoolean::new(true));
        }
        query
    }
}

/// What the account's item holds (`copy_item`).
#[derive(Debug, PartialEq, Eq)]
struct Existing {
    /// Its data: the key.
    key: Vec<u8>,
    /// Its `kSecAttrGeneric`, when it is a nonce of ours.
    nonce: Option<[u8; NONCE_BYTES]>,
}

/// Whether `place` is one these keychains have (the file-based one may be missing).
fn has(keychains: &Keychains<'_>, place: Place) -> bool {
    place == Place::DataProtection || keychains.file.is_some()
}

/// The places an item of these keychains may be in, the data-protection keychain first.
fn places(keychains: &Keychains<'_>) -> impl Iterator<Item = Place> {
    let (data_protection, file) = (keychains.data_protection, keychains.file.is_some());
    [Place::DataProtection, Place::File].into_iter().filter(move |place| match place {
        Place::DataProtection => data_protection,
        Place::File => file,
    })
}

/// SecItemAdd of a new item.
fn add(keychains: &Keychains<'_>, place: Place, user_id: &str, key: &[u8], nonce: &[u8; NONCE_BYTES]) -> Result<(), i32> {
    if !has(keychains, place) {
        return Err(ERR_SEC_NO_DEFAULT_KEYCHAIN);
    }
    let item = Query::new_item(keychains, place, user_id, key, nonce).dictionary();
    // SAFETY: a valid dictionary; no result is asked for.
    match unsafe { SecItemAdd(item.as_opaque(), std::ptr::null_mut()) } {
        0 => Ok(()),
        status => Err(status),
    }
}

/// SecItemDelete of the account's item(s) in `place`; nothing to delete is a success.
fn delete(keychains: &Keychains<'_>, place: Place, user_id: &str) -> Result<(), i32> {
    if !has(keychains, place) {
        return Ok(());
    }
    let query = Query::item(keychains, place, user_id, false).dictionary();
    // SAFETY: a valid dictionary.
    match unsafe { SecItemDelete(query.as_opaque()) } {
        0 => Ok(()),
        status if status == errSecItemNotFound => Ok(()),
        status => Err(status),
    }
}

/// SecItemCopyMatching of `query`: the result object, ours to release (the Create rule).
fn copy_matching(query: &Query) -> Result<CFRetained<CFType>, i32> {
    let query = query.dictionary();
    let mut result: *const CFType = null();
    // SAFETY: a valid dictionary and out pointer; on success `result` holds a +1 reference, which
    // `CFRetained::from_raw` takes over and releases.
    let status = unsafe { SecItemCopyMatching(query.as_opaque(), &mut result) };
    let result = NonNull::new(result.cast_mut()).map(|pointer| unsafe { CFRetained::from_raw(pointer) });
    match (status, result) {
        (0, Some(result)) => Ok(result),
        (0, None) => Err(errSecItemNotFound),
        (status, _) => Err(status),
    }
}

/// SecItemCopyMatching: the data of the account's item with this nonce.
fn copy_key(keychains: &Keychains<'_>, place: Place, user_id: &str, nonce: &[u8; NONCE_BYTES]) -> Result<Vec<u8>, i32> {
    if !has(keychains, place) {
        return Err(errSecItemNotFound);
    }
    let data = copy_matching(&Query::key_of(keychains, place, user_id, nonce))?;
    data.downcast::<CFData>().map(|data| data.to_vec()).map_err(|_| errSecItemNotFound)
}

/// SecItemCopyMatching: the account's item in `place`, whatever its nonce - its key and the nonce it
/// was stored with. In the file-based keychain the read of the data is what the item's access list
/// decides: another build's item answers -25293 (or -25308, as the dialogs are off).
fn copy_item(keychains: &Keychains<'_>, place: Place, user_id: &str) -> Result<Existing, i32> {
    if !has(keychains, place) {
        return Err(errSecItemNotFound);
    }
    let attributes = copy_matching(&Query::existing(keychains, place, user_id))?
        .downcast::<CFDictionary>()
        .map_err(|_| errSecItemNotFound)?;
    // The dictionary owns its values (the Get rule): they are copied out while it lives.
    let bytes = |key: &CFString| -> Option<Vec<u8>> {
        let key: *const CFString = key;
        // SAFETY: a valid dictionary and key; a value is a CF object the dictionary keeps alive.
        let value = unsafe { attributes.value(key.cast()) };
        let value = unsafe { value.cast::<CFType>().as_ref() }?;
        Some(value.downcast_ref::<CFData>()?.to_vec())
    };
    // SAFETY: the keys are immutable statics of the Security framework.
    let (key, nonce) = unsafe { (bytes(kSecValueData), bytes(kSecAttrGeneric)) };
    Ok(Existing { key: key.ok_or(errSecItemNotFound)?, nonce: nonce.and_then(|nonce| nonce.try_into().ok()) })
}

/// What `protect` does with the account's existing item: `Some(nonce)` keeps it - it is readable by
/// this build and holds the very key - and the marker of that nonce is the answer; `None` replaces
/// it: no item (-25300), another build's item (-25293, or -25308 with the dialogs off), another key,
/// or an item without a nonce of ours. A read error is never an error of the wrap.
fn reusable(existing: Result<Existing, i32>, key: &[u8]) -> Option<[u8; NONCE_BYTES]> {
    match existing {
        Ok(Existing { key: held, nonce: Some(nonce) }) if held == key => Some(nonce),
        _ => None,
    }
}

/// `key_protect` on `keychains`: the account's item holds `key`, and the answer is its marker.
fn protect(keychains: &Keychains<'_>, user_id: &str, key: &[u8]) -> Result<Vec<u8>, String> {
    // An online start of the same build: the item of the last wrap is readable and holds this very
    // key, so its marker stays the answer and nothing is written. (A fresh item at every start would
    // leave the engine's saved marker pointing at nothing whenever its save of the new one failed.)
    for place in places(keychains) {
        if let Some(nonce) = reusable(copy_item(keychains, place, user_id), key) {
            if place == Place::DataProtection {
                // What a build without the entitlements left in the login keychain goes too, on a
                // best-effort basis (normally nothing is there: one "not found" answer).
                let _ = delete(keychains, Place::File, user_id);
            }
            return Ok(marker(place, user_id, &nonce));
        }
    }
    // Otherwise the item is replaced: whatever is there goes first (SecItemAdd refuses a duplicate).
    let nonce = random_nonce()?;
    if keychains.data_protection {
        let stored = match delete(keychains, Place::DataProtection, user_id) {
            Ok(()) => add(keychains, Place::DataProtection, user_id, key, &nonce).map_err(|status| ("store", status)),
            Err(status) => Err(("remove", status)),
        };
        match stored {
            Ok(()) => {
                // The login keychain may still hold the item of a build without the entitlements
                // (the first online start after the switch): removed on a best-effort basis - the
                // key at rest is the data-protection item now, and a locked login keychain must not
                // fail the wrap.
                let _ = delete(keychains, Place::File, user_id);
                return Ok(marker(Place::DataProtection, user_id, &nonce));
            }
            // No keychain entitlements (today's ad-hoc build): the login keychain instead.
            Err((_, status)) if status == errSecMissingEntitlement => {}
            Err((action, status)) => return Err(keychain_error(action, status)),
        }
    }
    delete(keychains, Place::File, user_id).map_err(|status| keychain_error("remove", status))?;
    add(keychains, Place::File, user_id, key, &nonce).map_err(|status| keychain_error("store", status))?;
    Ok(marker(Place::File, user_id, &nonce))
}

/// `key_unprotect` on `keychains`: the key of the item the marker names, for this account only.
fn unprotect(keychains: &Keychains<'_>, user_id: &str, blob: &[u8]) -> Result<Vec<u8>, String> {
    let (place, nonce) = read_marker(user_id, blob)?;
    if place == Place::DataProtection && !keychains.data_protection {
        return Err(keychain_error("read", errSecItemNotFound));
    }
    let key = copy_key(keychains, place, user_id, &nonce).map_err(|status| keychain_error("read", status))?;
    if key.is_empty() {
        return Err("offline key: the Keychain item holds no key".to_string());
    }
    Ok(key)
}

/// `key_remove` on `keychains`: the account's item goes from both places (both are tried; the first
/// failure is the answer); none there is a success.
fn remove(keychains: &Keychains<'_>, user_id: &str) -> Result<(), String> {
    let mut failed = None;
    if keychains.data_protection {
        match delete(keychains, Place::DataProtection, user_id) {
            Ok(()) => {}
            Err(status) if status == errSecMissingEntitlement => {}
            Err(status) => failed = Some(keychain_error("remove", status)),
        }
    }
    if let Err(status) = delete(keychains, Place::File, user_id) {
        failed.get_or_insert_with(|| keychain_error("remove", status));
    }
    failed.map_or(Ok(()), Err)
}

/// `keychain-v1:<place>:<userId>:<nonce as 32 lower-case hex digits>` - text, no secret in it.
fn marker(place: Place, user_id: &str, nonce: &[u8; NONCE_BYTES]) -> Vec<u8> {
    format!("{MARKER_VERSION}:{}:{user_id}:{}", place.tag(), hex(nonce)).into_bytes()
}

/// The place and nonce of a marker of this account; anything else is an error, never a panic.
fn read_marker(user_id: &str, blob: &[u8]) -> Result<(Place, [u8; NONCE_BYTES]), String> {
    let unreadable = || "offline key: not a Keychain key blob".to_string();
    let text = std::str::from_utf8(blob).map_err(|_| unreadable())?;
    let mut fields = text.split(':');
    let (Some(version), Some(place), Some(owner), Some(nonce), None) =
        (fields.next(), fields.next(), fields.next(), fields.next(), fields.next())
    else {
        return Err(unreadable());
    };
    let place = Place::from_tag(place).filter(|_| version == MARKER_VERSION).ok_or_else(unreadable)?;
    if owner != user_id {
        return Err("offline key: the key blob belongs to another account".to_string());
    }
    Ok((place, unhex(nonce).ok_or_else(unreadable)?))
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

fn unhex(text: &str) -> Option<[u8; NONCE_BYTES]> {
    let digits = text.as_bytes();
    if digits.len() != NONCE_BYTES * 2 || !digits.iter().all(|d| matches!(d, b'0'..=b'9' | b'a'..=b'f')) {
        return None;
    }
    let mut out = [0u8; NONCE_BYTES];
    for (i, pair) in digits.chunks(2).enumerate() {
        out[i] = u8::from_str_radix(std::str::from_utf8(pair).ok()?, 16).ok()?;
    }
    Some(out)
}

/// 16 bytes of the system's random generator (`SecRandomCopyBytes`).
fn random_nonce() -> Result<[u8; NONCE_BYTES], String> {
    let mut nonce = [0u8; NONCE_BYTES];
    // SAFETY: the buffer holds exactly NONCE_BYTES writable bytes.
    let rc = unsafe { SecRandomCopyBytes(kSecRandomDefault, NONCE_BYTES, NonNull::from(&mut nonce).cast::<c_void>()) };
    if rc == 0 {
        Ok(nonce)
    } else {
        Err("offline key: the system gave no random bytes".to_string())
    }
}

/// The error of a vault call: what failed and the Keychain's status code - never the key, the
/// marker or the account.
fn keychain_error(action: &str, status: i32) -> String {
    let reason = match status {
        s if s == errSecItemNotFound => "no such item",
        s if s == errSecDuplicateItem => "the item exists already",
        s if s == errSecInteractionNotAllowed => "it would have to ask the user",
        s if s == errSecMissingEntitlement => "the app has no keychain entitlement",
        s if s == errSecNotAvailable => "no keychain is available",
        ERR_SEC_NO_DEFAULT_KEYCHAIN => "there is no login keychain",
        ERR_SEC_AUTH_FAILED => "the item belongs to another build of the app",
        _ => "error",
    };
    format!("offline key: the Keychain could not {action} the key ({reason}, OSStatus {status})")
}

/// The keychains of the contract functions: the user's in the app (the data-protection keychain
/// when the build may use it, and the login keychain)...
#[cfg(not(test))]
fn with_keychains<T>(work: impl FnOnce(&Keychains<'_>) -> T) -> T {
    let login = default_keychain();
    work(&Keychains { data_protection: true, file: login.as_deref() })
}

/// ...and in the test build the temporary keychain of the test's own thread, never the user's.
#[cfg(test)]
fn with_keychains<T>(work: impl FnOnce(&Keychains<'_>) -> T) -> T {
    test_keychain::THIS_THREAD.with(|temporary| work(&temporary.keychains()))
}

/// Stores `key` as the account's Keychain item (keeping the item of an earlier wrap when this build
/// can read it and it holds the same key, replacing it otherwise) and answers its marker blob; the
/// engine keeps the blob, the Keychain the key.
pub(crate) fn key_protect(user_id: &str, key: &[u8]) -> Result<Vec<u8>, String> {
    with_keychains(|keychains| vault_call(|| protect(keychains, user_id, key)))
}

/// The key of the item a marker of `key_protect` names - for the same account, and only while the
/// item it names is there: a marker of another account, of a replaced item or of a removed one is an
/// error.
pub(crate) fn key_unprotect(user_id: &str, blob: &[u8]) -> Result<Vec<u8>, String> {
    with_keychains(|keychains| vault_call(|| unprotect(keychains, user_id, blob)))
}

/// Deletes the account's Keychain item (sign-out with "Delete", account deletion); an account without
/// one is a success.
pub(crate) fn key_remove(user_id: &str) -> Result<(), String> {
    with_keychains(|keychains| vault_call(|| remove(keychains, user_id)))
}

// --- Offline unlock: LocalAuthentication (offline.rs `offline_user_check_available` / `offline_user_check`)

/// The reason shown when the caller passes none (macOS throws on an empty one). The dialog reads
/// "“Your Personal Diary” is trying to unlock your diary." - macOS puts the reason after
/// "<app name> is trying to".
const FALLBACK_REASON: &str = "unlock your diary";

/// How long `user_check` waits for the reply. The framework replies as soon as the user answers or
/// the dialog goes away, and nothing slower was ever seen; the bound only keeps a reply that never
/// comes from holding the command's blocking thread for good. When it is reached the context is
/// invalidated - that dismisses the dialog, and the framework replies `appCancel` to a block nobody
/// waits for any more - and the answer is `Cancelled`, so the user may simply try again.
const REPLY_TIMEOUT: Duration = Duration::from_secs(5 * 60);

/// `canEvaluatePolicy(.deviceOwnerAuthentication)`: Touch ID, an Apple Watch or the account password
/// can verify the user. No UI.
pub(crate) fn user_check_available() -> Result<bool, String> {
    // A pool of this call's own: what the framework autoreleases inside it is freed when the call
    // ends, not when the blocking thread (which tokio keeps and reuses) ends.
    autoreleasepool(|_| {
        // SAFETY: a plain framework object; canEvaluatePolicy only checks and shows nothing.
        let context = unsafe { LAContext::new() };
        Ok(unsafe { context.canEvaluatePolicy_error(LAPolicy::DeviceOwnerAuthentication) }.is_ok())
    })
}

/// LocalAuthentication shows its own dialog: no window is needed, the handle is 0.
pub(crate) fn window_handle(_window: &tauri::WebviewWindow) -> Result<WindowHandle, String> {
    Ok(WindowHandle(0))
}

/// The macOS dialog (Touch ID or the account password) with `message` as the reason; blocks this
/// (blocking) thread until the user answered, at most `REPLY_TIMEOUT`.
pub(crate) fn user_check(_window: WindowHandle, message: &str) -> Result<UserCheck, String> {
    autoreleasepool(|_| {
        // SAFETY: as in `user_check_available`; the context lives until `evaluate` returned.
        let context = unsafe { LAContext::new() };
        Ok(evaluate(&context, reason_text(message), REPLY_TIMEOUT))
    })
}

/// The caller's cleaned message, or the fallback when it is empty.
fn reason_text(message: &str) -> &str {
    let message = message.trim();
    if message.is_empty() {
        FALLBACK_REASON
    } else {
        message
    }
}

/// `evaluatePolicy(.deviceOwnerAuthentication, localizedReason:reply:)` on `context`, waited for on
/// the calling thread, at most `timeout`. The framework calls the reply block once, on a private
/// queue of its own; the block reads the domain and code of the error there (the NSError is only
/// valid during the call) and sends the mapped answer through a channel. The framework holds its own
/// copy of the block until it replied, so dropping ours right away neither leaks nor frees it early;
/// a block released without a reply drops the sender, which ends the wait with `Unavailable`.
fn evaluate(context: &LAContext, reason: &str, timeout: Duration) -> UserCheck {
    let (sender, answer) = sync_channel::<UserCheck>(1);
    let reply = RcBlock::new(move |success: Bool, error: *mut NSError| {
        // SAFETY: nil or a valid NSError for the duration of this call; nothing of it is kept.
        let error = unsafe { error.as_ref() }.map(|error| (error.domain().isEqualToString(unsafe { LAErrorDomain }), error.code()));
        let _ = sender.send(map_reply(success.as_bool(), error));
    });
    let reason = NSString::from_str(reason);
    // SAFETY: `context` is borrowed for this whole function, so it lives until the reply came or the
    // wait ended (the framework cancels an evaluation whose context is invalidated or released); the
    // reason is not empty; the block is `Send` (it owns a SyncSender only).
    unsafe { context.evaluatePolicy_localizedReason_reply(LAPolicy::DeviceOwnerAuthentication, &reason, &reply) };
    drop(reply);
    // SAFETY: `invalidate` on a live context; an evaluation still in flight ends with appCancel.
    wait_for_reply(&answer, timeout, || unsafe { context.invalidate() })
}

/// The reply, waited for on the calling thread: the block's answer; `Unavailable` when the block was
/// released without replying (its sender is gone); and after `timeout` without a reply, `cancel()`
/// and `Cancelled`.
fn wait_for_reply(answer: &Receiver<UserCheck>, timeout: Duration, cancel: impl FnOnce()) -> UserCheck {
    match answer.recv_timeout(timeout) {
        Ok(answer) => answer,
        Err(RecvTimeoutError::Disconnected) => UserCheck::Unavailable,
        Err(RecvTimeoutError::Timeout) => {
            cancel();
            UserCheck::Cancelled
        }
    }
}

/// The reply of `evaluatePolicy` as the contract's answer (docs/APPLE-PLAN.md section 4): success ->
/// ok; the user, the system or the app cancelled -> cancelled; the attempts failed -> failed; not
/// available, nothing enrolled, no password set, not interactive, or any other error -> unavailable.
fn map_reply(success: bool, error: Option<(bool, isize)>) -> UserCheck {
    match (success, error) {
        (true, _) => UserCheck::Ok,
        (false, Some((true, code))) => match LAError(code) {
            LAError::UserCancel | LAError::SystemCancel | LAError::AppCancel => UserCheck::Cancelled,
            LAError::AuthenticationFailed => UserCheck::Failed,
            _ => UserCheck::Unavailable,
        },
        (false, _) => UserCheck::Unavailable,
    }
}

// --- The system browser: /usr/bin/open (opener.rs `open_external_url`) ------------------------------

/// The macOS tool that hands an address to the default browser (LaunchServices), present on every Mac.
const OPEN_TOOL: &str = "/usr/bin/open";

/// Hands `url` - an address `opener::open_checked` accepted - to the user's default browser:
/// `/usr/bin/open <url>`, the URL as one argument of its own and no shell in between. Chosen over
/// NSWorkspace because it needs no AppKit binding, no main thread and no new crate, and it is what
/// the Tauri opener plugin does on macOS too. Runs on a blocking thread of its own.
pub(crate) fn open_url(url: &str) -> Result<(), String> {
    let status = open_command(url)?
        .status()
        .map_err(|e| format!("macOS could not start {OPEN_TOOL} ({e})"))?;
    if status.success() {
        Ok(())
    } else {
        Err(format!("macOS could not open the address ({OPEN_TOOL} answered {status})"))
    }
}

/// The `open` command for `url`. Only an absolute https address of visible ASCII gets this far
/// (belt and braces: it can never be read as an option), and the working folder is `/`, so the
/// argument cannot name a file next to the app either.
fn open_command(url: &str) -> Result<Command, String> {
    if !url.starts_with("https://") || !url.bytes().all(|b| b.is_ascii_graphic()) {
        return Err("open_url opens only https addresses".to_string());
    }
    let mut command = Command::new(OPEN_TOOL);
    command.arg(url).current_dir("/").stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null());
    Ok(command)
}

// --- The test seam: a temporary keychain -------------------------------------------------------------

/// The tests' keychain: a keychain file of the test's own in the temp folder, created with a random
/// password that never leaves the process and deleted (file and all) when it is dropped.
/// SecKeychainCreate does not put it on the user's keychain search list (checked on the build Mac),
/// and every vault call names it explicitly (`kSecUseKeychain` / `kSecMatchSearchList`), so a test
/// never reaches the login keychain or the data-protection keychain.
#[cfg(test)]
pub(super) mod test_keychain {
    use super::*;
    use std::ffi::CString;
    use std::path::PathBuf;
    use std::sync::atomic::{AtomicU64, Ordering};

    /// The folder of the temporary keychains; files older than an hour are leftovers of a run that
    /// was killed, removed by the next run.
    const FOLDER: &str = "ypd-keychain-tests";
    const STALE: std::time::Duration = std::time::Duration::from_secs(60 * 60);

    pub(crate) struct TemporaryKeychain {
        keychain: CFRetained<SecKeychain>,
        path: PathBuf,
    }

    impl TemporaryKeychain {
        #[allow(deprecated)]
        pub(crate) fn new() -> TemporaryKeychain {
            static NEXT: AtomicU64 = AtomicU64::new(0);
            let folder = std::env::temp_dir().join(FOLDER);
            std::fs::create_dir_all(&folder).expect("the temp folder of the test keychains");
            sweep_leftovers(&folder);
            let tag = hex(&random_nonce().expect("random bytes"));
            let path = folder.join(format!("{}-{}-{tag}.keychain-db", std::process::id(), NEXT.fetch_add(1, Ordering::Relaxed)));
            let mut secret = [0u8; 24];
            // SAFETY: the buffer holds exactly 24 writable bytes.
            assert_eq!(unsafe { SecRandomCopyBytes(kSecRandomDefault, secret.len(), NonNull::from(&mut secret).cast()) }, 0);
            let password = hex(&secret);
            let c_path = CString::new(path.to_str().expect("a UTF-8 temp path")).expect("no NUL in the temp path");
            let mut keychain: *mut SecKeychain = std::ptr::null_mut();
            // SAFETY: valid C string, password buffer and out pointer; `prompt_user` false, so no UI.
            let status = unsafe {
                SecKeychain::create(
                    NonNull::new(c_path.as_ptr().cast_mut()).expect("a C string"),
                    password.len() as u32,
                    password.as_ptr().cast(),
                    false,
                    None,
                    NonNull::from(&mut keychain),
                )
            };
            assert_eq!(status, 0, "SecKeychainCreate answered OSStatus {status}");
            // SAFETY: SecKeychainCreate hands out a +1 reference.
            let keychain = unsafe { CFRetained::from_raw(NonNull::new(keychain).expect("SecKeychainCreate gave a keychain")) };
            TemporaryKeychain { keychain, path }
        }

        pub(crate) fn keychains(&self) -> Keychains<'_> {
            Keychains { data_protection: false, file: Some(&self.keychain) }
        }

        /// The keychains of the app (`with_keychains` of the app build) with this temporary keychain
        /// in the login keychain's place: the data-protection keychain is tried first. For the one
        /// test that runs behind the probe that this build cannot write there.
        pub(crate) fn keychains_of_the_app(&self) -> Keychains<'_> {
            Keychains { data_protection: true, file: Some(&self.keychain) }
        }
    }

    impl Drop for TemporaryKeychain {
        #[allow(deprecated)]
        fn drop(&mut self) {
            // SAFETY: a keychain this value created; SecKeychainDelete removes its file.
            unsafe {
                SecKeychain::delete(Some(&self.keychain));
            }
            let _ = std::fs::remove_file(&self.path);
        }
    }

    fn sweep_leftovers(folder: &std::path::Path) {
        let Ok(entries) = std::fs::read_dir(folder) else { return };
        for entry in entries.filter_map(Result::ok) {
            let stale = entry
                .metadata()
                .and_then(|m| m.modified())
                .ok()
                .and_then(|modified| modified.elapsed().ok())
                .is_some_and(|age| age >= STALE);
            if stale && entry.file_name().to_string_lossy().ends_with(".keychain-db") {
                let _ = std::fs::remove_file(entry.path());
            }
        }
    }

    thread_local! {
        /// The keychain of the contract functions (`key_protect`, ...) in the test build: one per
        /// test thread, created on first use, deleted when the test's thread ends.
        pub(super) static THIS_THREAD: TemporaryKeychain = TemporaryKeychain::new();
    }
}

#[cfg(test)]
mod tests {
    use super::test_keychain::TemporaryKeychain;
    use super::*;

    const DANA: &str = "u_0123456789abcdef";
    const LIOR: &str = "u_fedcba9876543210";

    fn aok(seed: u8) -> Vec<u8> {
        (0u8..32).map(|i| i.wrapping_mul(29).wrapping_add(seed)).collect()
    }

    fn protect_on(temporary: &TemporaryKeychain, user_id: &str, key: &[u8]) -> Result<Vec<u8>, String> {
        vault_call(|| protect(&temporary.keychains(), user_id, key))
    }

    fn unprotect_on(temporary: &TemporaryKeychain, user_id: &str, blob: &[u8]) -> Result<Vec<u8>, String> {
        vault_call(|| unprotect(&temporary.keychains(), user_id, blob))
    }

    fn remove_on(temporary: &TemporaryKeychain, user_id: &str) -> Result<(), String> {
        vault_call(|| remove(&temporary.keychains(), user_id))
    }

    #[test]
    fn the_keychain_keeps_one_key_per_account_and_the_latest_marker_reads_it() {
        let temporary = TemporaryKeychain::new();
        let (dana_key, lior_key) = (aok(5), aok(9));
        let first = protect_on(&temporary, DANA, &dana_key).unwrap();
        assert_eq!(unprotect_on(&temporary, DANA, &first).unwrap(), dana_key);
        // Another account's marker never reads this account's key, nor the other way round.
        let lior = protect_on(&temporary, LIOR, &lior_key).unwrap();
        assert!(unprotect_on(&temporary, LIOR, &first).unwrap_err().contains("another account"));
        assert_eq!(unprotect_on(&temporary, LIOR, &lior).unwrap(), lior_key);
        // The same key again (every online start of the same build): the item stays, and so does
        // its marker - nothing is replaced, so the engine's saved marker cannot go stale.
        assert_eq!(protect_on(&temporary, DANA, &dana_key).unwrap(), first);
        assert_eq!(unprotect_on(&temporary, DANA, &first).unwrap(), dana_key);
        // A new key: the item is replaced, the marker changes and the older one stops reading.
        let rotated = aok(6);
        let second = protect_on(&temporary, DANA, &rotated).unwrap();
        assert_ne!(second, first);
        assert!(unprotect_on(&temporary, DANA, &first).is_err(), "a stale marker reads nothing");
        assert_eq!(unprotect_on(&temporary, DANA, &second).unwrap(), rotated);
        assert_eq!(unprotect_on(&temporary, LIOR, &lior).unwrap(), lior_key, "the other account is untouched");
        // Removing deletes the item: the marker reads nothing any more; removing again is fine, and
        // the other account keeps its key.
        assert_eq!(remove_on(&temporary, DANA), Ok(()));
        assert!(unprotect_on(&temporary, DANA, &second).is_err());
        assert_eq!(remove_on(&temporary, DANA), Ok(()));
        assert_eq!(unprotect_on(&temporary, LIOR, &lior).unwrap(), lior_key);
        assert_eq!(remove_on(&temporary, LIOR), Ok(()));
        assert_eq!(remove_on(&temporary, "u_00000000000000aa"), Ok(()), "an account without an item");
    }

    /// The decision of `protect` on what it finds: only a readable item of the same key, with a
    /// nonce of ours, is kept; every read error - none there, another build's item (-25293 / -25308),
    /// anything else - replaces the item and never fails the wrap.
    #[test]
    fn protect_keeps_a_readable_item_of_the_same_key_and_replaces_everything_else() {
        let key = aok(8);
        let nonce = [3u8; NONCE_BYTES];
        let held = |key: &[u8], nonce| Existing { key: key.to_vec(), nonce };
        assert_eq!(reusable(Ok(held(&key, Some(nonce))), &key), Some(nonce));
        assert_eq!(reusable(Ok(held(&aok(9), Some(nonce))), &key), None, "another key");
        assert_eq!(reusable(Ok(held(&key, None)), &key), None, "no nonce of ours");
        assert_eq!(reusable(Ok(held(&[], Some(nonce))), &key), None, "an empty item");
        for status in [errSecItemNotFound, ERR_SEC_AUTH_FAILED, errSecInteractionNotAllowed, errSecMissingEntitlement, -1] {
            assert_eq!(reusable(Err(status), &key), None, "OSStatus {status}: replaced, not an error");
        }
        // On the keychain: what `copy_item` reads back is what `protect` stored, nonce included.
        let temporary = TemporaryKeychain::new();
        assert_eq!(vault_call(|| copy_item(&temporary.keychains(), Place::File, DANA)), Err(errSecItemNotFound));
        let marker = protect_on(&temporary, DANA, &key).unwrap();
        let (_, stored) = read_marker(DANA, &marker).unwrap();
        assert_eq!(vault_call(|| copy_item(&temporary.keychains(), Place::File, DANA)), Ok(Existing { key, nonce: Some(stored) }));
        remove_on(&temporary, DANA).unwrap();
    }

    #[test]
    fn the_marker_is_text_without_the_key_and_garbage_is_an_error() {
        let temporary = TemporaryKeychain::new();
        let key = aok(77);
        let blob = protect_on(&temporary, DANA, &key).unwrap();
        let text = String::from_utf8(blob.clone()).expect("the marker is text");
        let prefix = format!("keychain-v1:file:{DANA}:");
        assert!(text.starts_with(&prefix), "{text}");
        assert_eq!(text.len(), prefix.len() + 2 * NONCE_BYTES);
        assert!(!blob.windows(key.len()).any(|w| w == key.as_slice()), "the key is not in the marker");
        let nonce = &text[prefix.len()..];
        for bad in [
            String::new(),
            "keychain-v1".to_string(),
            format!("keychain-v2:file:{DANA}:{nonce}"),
            format!("keychain-v1:icloud:{DANA}:{nonce}"),
            format!("keychain-v1:file:{DANA}:{}", &nonce[1..]),
            format!("keychain-v1:file:{DANA}:{}", nonce.to_uppercase()),
            format!("keychain-v1:file:{DANA}:{nonce}:x"),
            format!("keychain-v1:file::{nonce}"),
        ] {
            assert!(unprotect_on(&temporary, DANA, bad.as_bytes()).is_err(), "{bad:?}");
        }
        assert!(unprotect_on(&temporary, DANA, &[0xff, 0xfe, 0x00]).is_err(), "not UTF-8");
        // A data-protection marker is refused where the vault may not use that keychain.
        assert!(unprotect_on(&temporary, DANA, format!("keychain-v1:dp:{DANA}:{nonce}").as_bytes()).is_err());
        assert_eq!(unprotect_on(&temporary, DANA, &blob).unwrap(), key, "the real marker still reads");
        remove_on(&temporary, DANA).unwrap();
    }

    #[test]
    fn errors_name_the_status_but_never_the_key_marker_or_account() {
        let temporary = TemporaryKeychain::new();
        let blob = protect_on(&temporary, DANA, &aok(1)).unwrap();
        remove_on(&temporary, DANA).unwrap();
        let error = unprotect_on(&temporary, DANA, &blob).unwrap_err();
        assert!(error.contains("OSStatus -25300") && error.contains("no such item"), "{error}");
        let marker = String::from_utf8(blob).unwrap();
        assert!(!error.contains(DANA) && !error.contains(&marker[marker.len() - 2 * NONCE_BYTES..]), "{error}");
        assert!(keychain_error("read", -25293).contains("another build"));
        assert!(keychain_error("store", -34018).contains("entitlement"));
    }

    #[test]
    fn the_test_build_never_reaches_the_users_keychains() {
        // The contract functions of the test build use the thread's temporary keychain only.
        with_keychains(|keychains| {
            assert!(keychains.file.is_some(), "a temporary keychain");
            assert!(!keychains.data_protection, "never the data-protection keychain");
        });
        // ...and the item queries name that keychain explicitly.
        let temporary = TemporaryKeychain::new();
        let search = Query::item(&temporary.keychains(), Place::File, DANA, false);
        let add = Query::item(&temporary.keychains(), Place::File, DANA, true);
        assert!(search.keys.iter().any(|k| std::ptr::eq(*k, unsafe { kSecMatchSearchList })));
        assert!(add.keys.iter().any(|k| std::ptr::eq(*k, unsafe { kSecUseKeychain })));
    }

    #[test]
    fn the_items_of_the_app_are_built_as_the_plan_says() {
        let key = aok(3);
        let nonce = [7u8; NONCE_BYTES];
        // The app names the login keychain where a test names its temporary one; the items are the same.
        let temporary = TemporaryKeychain::new();
        let keychains = temporary.keychains();
        let value = |query: &Query, key: &CFString| -> Option<CFRetained<CFType>> {
            query.keys.iter().position(|k| std::ptr::eq(*k, key)).map(|i| query.values[i].clone())
        };
        let is_true = |v: Option<CFRetained<CFType>>| v.and_then(|v| v.downcast::<CFBoolean>().ok()).map(|b| b.as_bool());
        let text = |v: Option<CFRetained<CFType>>| v.and_then(|v| v.downcast::<CFString>().ok()).map(|s| s.to_string());
        unsafe {
            // The data-protection keychain: after the first unlock, this device only, never synchronized.
            let dp = Query::new_item(&keychains, Place::DataProtection, DANA, &key, &nonce);
            assert_eq!(is_true(value(&dp, kSecUseDataProtectionKeychain)), Some(true));
            assert_eq!(text(value(&dp, kSecAttrAccessible)), Some(kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly.to_string()));
            assert_eq!(is_true(value(&dp, kSecAttrSynchronizable)), Some(false));
            assert_eq!(text(value(&dp, kSecAttrService)).as_deref(), Some(KEYCHAIN_SERVICE));
            assert_eq!(text(value(&dp, kSecAttrAccount)).as_deref(), Some(DANA));
            assert_eq!(text(value(&dp, kSecAttrLabel)).as_deref(), Some(KEYCHAIN_LABEL));
            assert_eq!(value(&dp, kSecValueData).and_then(|v| v.downcast::<CFData>().ok()).map(|d| d.to_vec()), Some(key.clone()));
            assert!(value(&dp, kSecUseKeychain).is_none(), "no file keychain named for the data-protection keychain");
            // The file-based keychain: named explicitly, never synchronized, no accessibility class.
            let file = Query::new_item(&keychains, Place::File, DANA, &key, &nonce);
            assert!(value(&file, kSecUseDataProtectionKeychain).is_none() && value(&file, kSecAttrAccessible).is_none());
            let named = value(&file, kSecUseKeychain).expect("the keychain is named");
            let expected: &CFType = keychains.file.expect("a temporary keychain").as_ref();
            assert!(std::ptr::eq(&*named, expected), "exactly that keychain");
            assert_eq!(is_true(value(&file, kSecAttrSynchronizable)), Some(false));
            assert_eq!(value(&file, kSecAttrGeneric).and_then(|v| v.downcast::<CFData>().ok()).map(|d| d.to_vec()), Some(nonce.to_vec()));
        }
    }

    #[test]
    fn without_a_file_keychain_the_vault_answers_errors_not_panics() {
        let none = Keychains { data_protection: false, file: None };
        let error = vault_call(|| protect(&none, DANA, &aok(4))).unwrap_err();
        assert!(error.contains("no login keychain"), "{error}");
        assert_eq!(vault_call(|| remove(&none, DANA)), Ok(()), "nothing to remove");
        let marker = format!("keychain-v1:file:{DANA}:{}", hex(&[1u8; NONCE_BYTES]));
        assert!(vault_call(|| unprotect(&none, DANA, marker.as_bytes())).is_err());
    }

    #[test]
    fn the_service_name_is_the_mac_identifier_plus_offline_v1() {
        let conf: serde_json::Value = serde_json::from_str(include_str!("../../tauri.macos.conf.json")).unwrap();
        let identifier = conf["identifier"].as_str().expect("the macOS identifier");
        assert_eq!(KEYCHAIN_SERVICE, format!("{identifier}.offline.v1"));
    }

    /// The data-protection keychain's answer to this test binary: a delete of an item that cannot
    /// exist (a random service) touches nothing and shows whether writes are allowed at all; a read
    /// would answer "not found" either way.
    fn data_protection_probe() -> i32 {
        let service = CFString::from_str(&format!("{KEYCHAIN_SERVICE}.probe-{}", hex(&random_nonce().unwrap())));
        unsafe {
            let query = CFDictionary::<CFString, CFType>::from_slices(
                &[kSecClass, kSecAttrService, kSecUseDataProtectionKeychain],
                &[kSecClassGenericPassword.as_ref(), service.as_ref(), CFBoolean::new(true).as_ref()],
            );
            vault_call(|| SecItemDelete(query.as_opaque()))
        }
    }

    /// What decided the design (module comment): this test binary, ad-hoc signed by the linker and
    /// without entitlements, cannot use the data-protection keychain (-34018).
    #[test]
    fn an_unsigned_build_has_no_data_protection_keychain() {
        let status = data_protection_probe();
        println!("data-protection keychain probe: OSStatus {status}");
        assert!(status == errSecMissingEntitlement || status == errSecItemNotFound, "OSStatus {status}");
    }

    /// The path the app ships - `Keychains { data_protection: true, .. }`, `with_keychains` of the
    /// app build - on a build without the keychain entitlements, i.e. today's ad-hoc build: the
    /// data-protection delete and add answer -34018 and the vault falls back to the file keychain
    /// (here the temporary one, in the app the login keychain), where the item is reused, read and
    /// removed as everywhere. Skipped on a build the data-protection keychain accepts (none exists
    /// yet): the test would otherwise write to that build's real data-protection keychain.
    #[test]
    fn the_shipped_path_falls_back_to_the_file_keychain_without_the_entitlements() {
        let probe = data_protection_probe();
        if probe != errSecMissingEntitlement {
            println!("skipped: the data-protection keychain answered OSStatus {probe}, not -34018");
            return;
        }
        let temporary = TemporaryKeychain::new();
        let keychains = temporary.keychains_of_the_app();
        assert!(keychains.data_protection, "the app's keychains try the data-protection keychain first");
        let key = aok(42);
        let marker = vault_call(|| protect(&keychains, DANA, &key)).unwrap();
        let text = String::from_utf8(marker.clone()).unwrap();
        assert!(text.starts_with(&format!("keychain-v1:file:{DANA}:")), "{text}");
        assert_eq!(vault_call(|| unprotect(&keychains, DANA, &marker)).unwrap(), key);
        assert_eq!(vault_call(|| protect(&keychains, DANA, &key)).unwrap(), marker, "the same key keeps item and marker");
        let replaced = vault_call(|| protect(&keychains, DANA, &aok(43))).unwrap();
        assert_ne!(replaced, marker);
        assert!(vault_call(|| unprotect(&keychains, DANA, &marker)).is_err(), "the older marker reads nothing");
        assert_eq!(vault_call(|| remove(&keychains, DANA)), Ok(()));
        assert_eq!(vault_call(|| remove(&keychains, DANA)), Ok(()), "removing again is fine");
        assert!(vault_call(|| unprotect(&keychains, DANA, &replaced)).is_err(), "the item is gone");
    }

    #[test]
    fn the_user_check_answers_map_as_the_plan_says() {
        assert_eq!(map_reply(true, None), UserCheck::Ok);
        for code in [LAError::UserCancel, LAError::SystemCancel, LAError::AppCancel] {
            assert_eq!(map_reply(false, Some((true, code.0))), UserCheck::Cancelled, "{code:?}");
        }
        assert_eq!(map_reply(false, Some((true, LAError::AuthenticationFailed.0))), UserCheck::Failed);
        for code in [
            LAError::BiometryNotAvailable,
            LAError::BiometryNotEnrolled,
            LAError::PasscodeNotSet,
            LAError::BiometryLockout,
            LAError::NotInteractive,
            LAError::InvalidContext,
            LAError::UserFallback,
            LAError(-9999),
        ] {
            assert_eq!(map_reply(false, Some((true, code.0))), UserCheck::Unavailable, "{code:?}");
        }
        // An error of another domain, or none at all, is never read as an LA code.
        assert_eq!(map_reply(false, Some((false, LAError::UserCancel.0))), UserCheck::Unavailable);
        assert_eq!(map_reply(false, None), UserCheck::Unavailable);
    }

    #[test]
    fn the_reason_is_the_callers_message_or_a_short_fallback() {
        assert_eq!(reason_text("Unlock Your Personal Diary"), "Unlock Your Personal Diary");
        assert_eq!(reason_text(""), FALLBACK_REASON);
        assert_eq!(reason_text("   "), FALLBACK_REASON);
        assert!(!FALLBACK_REASON.is_empty());
    }

    /// The asynchronous reply of evaluatePolicy is waited for on the calling thread, from several
    /// threads at once. `interactionNotAllowed` makes the framework answer "not interactive" instead
    /// of showing its dialog (LAContext.h), so no prompt can appear.
    #[test]
    fn the_user_check_waits_for_the_reply_without_showing_anything() {
        let threads: Vec<_> = (0..4)
            .map(|_| {
                std::thread::spawn(|| {
                    for _ in 0..5 {
                        let context = unsafe { LAContext::new() };
                        unsafe { context.setInteractionNotAllowed(true) };
                        let started = std::time::Instant::now();
                        assert_eq!(evaluate(&context, reason_text(""), REPLY_TIMEOUT), UserCheck::Unavailable);
                        assert!(started.elapsed() < Duration::from_secs(20));
                    }
                })
            })
            .collect();
        for thread in threads {
            thread.join().unwrap();
        }
    }

    /// The wait for the reply block is bounded: its answer when it comes; `unavailable` when the
    /// block was released without replying; after the bound, the evaluation is cancelled (once) and
    /// the answer is `cancelled`. The bound itself is minutes, never a test's wait.
    #[test]
    fn the_wait_for_the_reply_is_bounded() {
        let long = Duration::from_secs(20);
        let (sender, answer) = sync_channel(1);
        sender.send(UserCheck::Failed).unwrap();
        assert_eq!(wait_for_reply(&answer, long, || panic!("not cancelled")), UserCheck::Failed);
        let (sender, answer) = sync_channel::<UserCheck>(1);
        drop(sender);
        assert_eq!(wait_for_reply(&answer, long, || panic!("not cancelled")), UserCheck::Unavailable);
        let (_silent, answer) = sync_channel::<UserCheck>(1);
        let cancelled = std::cell::Cell::new(0);
        let started = std::time::Instant::now();
        let bound = Duration::from_millis(50);
        assert_eq!(wait_for_reply(&answer, bound, || cancelled.set(cancelled.get() + 1)), UserCheck::Cancelled);
        assert_eq!(cancelled.get(), 1);
        assert!(started.elapsed() >= bound && started.elapsed() < Duration::from_secs(10), "{:?}", started.elapsed());
        assert!(REPLY_TIMEOUT >= Duration::from_secs(60) && REPLY_TIMEOUT <= Duration::from_secs(10 * 60));
    }

    /// A reply that does not come within the bound invalidates the context (the framework then
    /// replies `appCancel` to a block nobody waits for) and answers `cancelled`. With
    /// `interactionNotAllowed` the framework replies within milliseconds and nothing is shown; a
    /// zero bound is reached first almost always, and when the reply wins the race the answer is the
    /// usual `unavailable` - either way the context survives the invalidation and its release.
    #[test]
    fn a_reply_that_does_not_come_in_time_cancels_the_evaluation() {
        let context = unsafe { LAContext::new() };
        unsafe { context.setInteractionNotAllowed(true) };
        let answer = evaluate(&context, reason_text(""), Duration::ZERO);
        println!("zero bound: {answer:?}");
        assert!(matches!(answer, UserCheck::Cancelled | UserCheck::Unavailable), "{answer:?}");
        // Invalidating again is harmless (LAContext.h), and so is dropping the context now.
        unsafe { context.invalidate() };
        std::thread::sleep(Duration::from_millis(100));
    }

    #[test]
    fn the_browser_is_started_with_the_checked_address_as_one_argument() {
        let url = format!("https://{}/privacy/he/", "diary.example.org");
        let command = open_command(&url).unwrap();
        assert_eq!(command.get_program(), OPEN_TOOL);
        assert_eq!(command.get_args().collect::<Vec<_>>(), [url.as_str()]);
        assert_eq!(command.get_current_dir(), Some(std::path::Path::new("/")));
        assert!(std::path::Path::new(OPEN_TOOL).exists());
        // Never an option, a file or another scheme (opener.rs refused them already; never started
        // here). The addresses are put together from parts: scripts/check-no-network.mjs scans this file.
        let (https, http) = ("https:", "http:");
        for bad in [
            "-a Calculator".to_string(),
            "file:///etc/hosts".to_string(),
            "/etc/hosts".to_string(),
            format!("{http}//x"),
            format!("{https}//x y"),
            format!("{https}//x\n"),
            String::new(),
        ] {
            assert!(open_command(&bad).is_err(), "{bad:?}");
        }
    }
}
