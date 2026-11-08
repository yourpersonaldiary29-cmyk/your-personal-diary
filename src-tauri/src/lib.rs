//! Desktop shell of "Your Personal Diary" - a thin client of the Your Personal Diary server.
//!
//! The published Windows app is SERVER-ONLY (docs/android-tasks/HOSTED-IMPL.md items 8 and 10): the
//! UI it embeds talks to the one fixed server address of src/config/server-default.json (baked into
//! the UI at build time; the window's CSP in tauri.conf.json allows exactly that origin), and the
//! shell ships no local server. What is written to the device: the WebView2 profile (session token,
//! device preferences and - with the automatic offline mode, docs/android-tasks/OFFLINE-DESIGN.md -
//! the encrypted IndexedDB of changes not yet uploaded and, with "Remember me", the encrypted copy of
//! recent data plus the DPAPI-wrapped account offline key), and the outbox mirror of `offline.rs`
//! (`%LOCALAPPDATA%\com.mydiary.app\offline\<userId>\`, ciphertext only). The password, the recovery
//! key and anything derived from them are never stored. The shell creates no other data folder and
//! no log file.
//!
//! Responsibilities (deliberately small - all business logic lives on the server):
//! * provide native dialogs and notifications through the official Tauri plugins - except the
//!   reminder toasts of the Microsoft Store (MSIX) version, which the plugin cannot send
//!   (`show_store_notification`),
//! * save a backup or an export the UI downloaded from the server where the user chooses in the
//!   native "save as" dialog (`save_file`: the shell shows the dialog and writes the file - the page
//!   never names a path),
//! * hand the UI the language chosen in the NSIS installer (`get_install_locale`),
//! * when installed from the Microsoft Store as an MSIX package, keep the WebView2 profile in the
//!   package-private folder (`packaged_webview_data_dir`),
//! * the platform half of the automatic offline mode (`offline.rs`): the account offline key at
//!   rest (DPAPI; the Keychain in the Mac app), the outbox mirror and the offline unlock (Windows
//!   Hello; Touch ID or the account password on the Mac) - the `offline_*` commands,
//! * open the privacy policy and the delete-account page of the diary server in the system browser
//!   (`opener.rs`, `open_external_url`: only those pages of the fixed server origin, through the
//!   Windows shell - the browser loads them, not the shell).
//!
//! Every call into the operating system's own APIs (DPAPI, Windows Hello, `ShellExecuteW`, the MSIX
//! package identity, the WinRT toast) lives in `platform/` - `platform/mod.rs` holds the contract,
//! `platform/windows.rs` the Windows implementation and `platform/unsupported.rs` the stub of every
//! other target - so this file, `offline.rs` and `opener.rs` are portable Rust that calls it
//! (docs/android-tasks/APPLE-PREP.md item 2, docs/APPLE-PLAN.md section 4). The rules of the Store
//! (MSIX) package that stay here - family names, the package-private folders, the WebView2 profile
//! redirect, the toast's AppUserModelID and XML - need the standard library alone and apply only
//! where `platform::package_identity::family_name()` reports a package: nowhere but Windows.
//!
//! LOCAL MODE (cargo feature `local-server`, off by default - the developer / test configuration,
//! never a published build): the shell additionally spawns the bundled Node.js server as a sidecar
//! (`binaries/diary-server`) with the app data directory (`%APPDATA%\com.mydiary.app`, or the
//! package-private folder of an MSIX install - `packaged_data_dir`) and the bundled server script
//! (`resources/server/server.cjs`), learns the port from the sidecar's stdout
//! (`{"event":"listening","port":N}`), exposes it through `get_server_info` (plus `get_server_log`
//! and `restart_server` for the Diagnostics card) and kills the sidecar when the window closes. The
//! matching Tauri config overlay is src-tauri/tauri.local.conf.json; the UI must be built with
//! `VITE_LOCAL_SERVER=1` to use these commands (src/config/server-default.ts).
//!
//! The shell never opens network connections itself.

use std::path::PathBuf;
use std::sync::Mutex;

use serde::Serialize;
use tauri::Manager;
#[cfg(feature = "local-server")]
use tauri::RunEvent;
#[cfg(feature = "local-server")]
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
#[cfg(feature = "local-server")]
use tauri_plugin_shell::ShellExt;

/// The platform half of the automatic offline mode (offline key at rest, outbox mirror, offline unlock).
mod offline;
/// The legal-page links: the diary server's privacy / delete-account pages in the system browser.
mod opener;
/// The operating-system calls behind the commands, one implementation file per platform.
mod platform;

use platform::package_identity;

/// What the shell remembers while it runs. The shipped (server-only) build uses only `log_tail`
/// (the outcome lines of the Store toasts, in memory) and keeps `data_dir` empty, so `push_log`
/// never writes a file. Local mode fills in the sidecar's state as well.
#[derive(Default)]
struct ServerState {
    #[cfg(feature = "local-server")]
    port: u16,
    #[cfg(feature = "local-server")]
    ready: bool,
    #[cfg(feature = "local-server")]
    lan_enabled: bool,
    /// Where `server.log` is appended (local mode). Empty: nothing is written to disk.
    data_dir: String,
    #[cfg(feature = "local-server")]
    last_error: Option<String>,
    #[cfg(feature = "local-server")]
    child: Option<CommandChild>,
    log_tail: Vec<String>,
}

struct AppState(Mutex<ServerState>);

#[cfg(feature = "local-server")]
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ServerInfo {
    port: u16,
    ready: bool,
    lan_enabled: bool,
    data_dir: String,
    last_error: Option<String>,
}

/// Local mode only: the sidecar's port for the UI built with `VITE_LOCAL_SERVER=1`. The shipped UI
/// never calls it (its API base is the fixed server), and the shipped shell does not register it.
#[cfg(feature = "local-server")]
#[tauri::command]
fn get_server_info(state: tauri::State<'_, AppState>) -> ServerInfo {
    let s = state.0.lock().expect("state poisoned");
    ServerInfo {
        port: s.port,
        ready: s.ready,
        lan_enabled: s.lan_enabled,
        data_dir: s.data_dir.clone(),
        last_error: s.last_error.clone(),
    }
}

/// Local mode only: last lines printed by the server (for the diagnostics panel in Settings).
#[cfg(feature = "local-server")]
#[tauri::command]
fn get_server_log(state: tauri::State<'_, AppState>) -> Vec<String> {
    let s = state.0.lock().expect("state poisoned");
    s.log_tail.clone()
}

/// Local mode only: restarts the sidecar (e.g. after a crash). The frontend re-discovers the port afterwards.
#[cfg(feature = "local-server")]
#[tauri::command]
fn restart_server(app: tauri::AppHandle) -> Result<(), String> {
    {
        let state = app.state::<AppState>();
        let mut s = state.0.lock().expect("state poisoned");
        if let Some(child) = s.child.take() {
            let _ = child.kill();
        }
        s.ready = false;
        s.port = 0;
    }
    spawn_server(&app)
}

/// UI locale codes (shared/i18n/locales.ts). The installer writes one of them; anything else is ignored.
const UI_LOCALES: [&str; 20] = [
    "en", "he", "zh", "es", "pl", "ru", "fr", "ar", "ja", "tr", "cs", "hu", "bg", "el", "pt", "de",
    "ro", "it", "th", "hi",
];

/// File the NSIS installer writes next to the executable with the language chosen in its
/// language selector (src-tauri/nsis/hooks.nsh, NSIS_HOOK_POSTINSTALL).
const INSTALL_LOCALE_FILE: &str = "install-locale.txt";

/// Parses the content of `install-locale.txt`: one supported locale code, surrounding whitespace
/// and a UTF-8 BOM tolerated. Anything else (empty, unknown code, several words...) -> None.
fn parse_install_locale(raw: &str) -> Option<&'static str> {
    let code = raw.trim_start_matches('\u{feff}').trim().to_ascii_lowercase();
    UI_LOCALES.iter().copied().find(|c| *c == code)
}

/// Reads and validates an install-locale file. Missing, unreadable, oversized or not UTF-8 -> None.
fn read_install_locale(path: &std::path::Path) -> Option<&'static str> {
    let meta = std::fs::metadata(path).ok()?;
    if !meta.is_file() || meta.len() > 64 {
        return None;
    }
    let bytes = std::fs::read(path).ok()?;
    parse_install_locale(std::str::from_utf8(&bytes).ok()?)
}

/// The language chosen in the installer (one of the 20 UI locale codes), or None when the app was
/// not installed by the NSIS installer (tauri dev, MSI, older installers) or the file is invalid.
/// The UI applies it once to the device language (src/i18n/install-locale.ts).
#[tauri::command]
fn get_install_locale() -> Option<String> {
    let exe = std::env::current_exe().ok()?;
    read_install_locale(&exe.parent()?.join(INSTALL_LOCALE_FILE)).map(str::to_string)
}

/// Request headers of `save_file` (src/utils/platform.ts `SAVE_FILE_HEADERS`); every value is URI-encoded.
const SAVE_FILE_HEADER_FILE_NAME: &str = "x-mpd-file-name";
const SAVE_FILE_HEADER_FILTER_NAME: &str = "x-mpd-filter-name";
const SAVE_FILE_HEADER_FILTER_EXTENSIONS: &str = "x-mpd-filter-extensions";
const SAVE_FILE_HEADER_TITLE: &str = "x-mpd-dialog-title";
/// Name offered by the dialog when the page gave none that can be used.
const SAVE_FILE_FALLBACK_NAME: &str = "download";
/// Longest suggested file name / filter name / title kept (characters); the rest is cut.
const SAVE_FILE_MAX_TEXT: usize = 200;

/// What the page asks `save_file` for - all of it only shapes the dialog; the path is the user's choice.
#[derive(Debug, PartialEq, Eq)]
struct SaveFileRequest {
    file_name: String,
    filter_name: String,
    extensions: Vec<String>,
    title: String,
}

/// Decodes `%XX` escapes (encodeURIComponent) into UTF-8 text. A broken escape or invalid UTF-8 -> None.
fn percent_decode(raw: &str) -> Option<String> {
    let bytes = raw.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' {
            let hi = (*bytes.get(i + 1)? as char).to_digit(16)?;
            let lo = (*bytes.get(i + 2)? as char).to_digit(16)?;
            out.push((hi * 16 + lo) as u8);
            i += 3;
        } else {
            out.push(bytes[i]);
            i += 1;
        }
    }
    String::from_utf8(out).ok()
}

/// Plain one-line text: control characters dropped, trimmed, at most `SAVE_FILE_MAX_TEXT` characters.
fn plain_text(raw: &str) -> String {
    let text: String = raw.chars().filter(|c| !c.is_control()).collect();
    text.trim().chars().take(SAVE_FILE_MAX_TEXT).collect::<String>().trim().to_string()
}

/// A suggested file NAME, never a path: the last path component only, without the characters
/// Windows refuses in a name, without trailing dots and spaces; `SAVE_FILE_FALLBACK_NAME` when nothing is left.
fn safe_file_name(raw: &str) -> String {
    let last = raw.rsplit(['/', '\\']).next().unwrap_or("");
    let cleaned: String = plain_text(last)
        .chars()
        .filter(|c| !matches!(c, '<' | '>' | ':' | '"' | '|' | '?' | '*'))
        .collect();
    let cleaned = cleaned.trim_end_matches(['.', ' ']).trim_start().to_string();
    if cleaned.is_empty() || cleaned.chars().all(|c| c == '.') {
        SAVE_FILE_FALLBACK_NAME.to_string()
    } else {
        cleaned
    }
}

/// The filter's extensions: "mpd" or "txt,csv" -> plain letters/digits only, 1-10 characters, at most 5.
fn safe_extensions(raw: &str) -> Vec<String> {
    raw.split(',')
        .map(str::trim)
        .filter(|e| !e.is_empty() && e.len() <= 10 && e.chars().all(|c| c.is_ascii_alphanumeric()))
        .map(str::to_ascii_lowercase)
        .take(5)
        .collect()
}

/// Reads the `save_file` headers; anything missing or unusable falls back to a harmless default.
fn parse_save_file_request(headers: &tauri::http::HeaderMap) -> SaveFileRequest {
    let text = |name: &str| {
        headers
            .get(name)
            .and_then(|v| v.to_str().ok())
            .and_then(percent_decode)
            .unwrap_or_default()
    };
    SaveFileRequest {
        file_name: safe_file_name(&text(SAVE_FILE_HEADER_FILE_NAME)),
        filter_name: plain_text(&text(SAVE_FILE_HEADER_FILTER_NAME)),
        extensions: safe_extensions(&text(SAVE_FILE_HEADER_FILTER_EXTENSIONS)),
        title: plain_text(&text(SAVE_FILE_HEADER_TITLE)),
    }
}

/// Writes `bytes` to the path the user chose and answers the saved file's name.
fn write_chosen_file(path: &std::path::Path, bytes: &[u8]) -> Result<String, String> {
    std::fs::write(path, bytes).map_err(|e| e.to_string())?;
    Ok(path
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| path.to_string_lossy().into_owned()))
}

/// Server mode (the published Windows app): saves a file the Your Personal Diary server produced - a
/// backup or an export the page downloaded - through the native "save as" dialog. The page sends the
/// file's bytes as the raw request body and only a suggested name, the dialog filter and the dialog
/// title in headers (`SAVE_FILE_HEADER_*`); the SHELL shows the dialog and writes the file, so nothing
/// running in the WebView can name a path to write to. Answers the saved file's name, or None when the
/// user cancelled the dialog; an error when the file could not be written. (The local-mode developer
/// build lets its local server write such files at a dialog-chosen path instead - src/utils/platform.ts.)
#[tauri::command]
async fn save_file(
    app: tauri::AppHandle,
    window: tauri::WebviewWindow,
    request: tauri::ipc::Request<'_>,
) -> Result<Option<String>, String> {
    let tauri::ipc::InvokeBody::Raw(bytes) = request.body() else {
        return Err("save_file expects the file content as raw bytes".to_string());
    };
    let bytes = bytes.clone();
    let wanted = parse_save_file_request(request.headers());
    // The dialog blocks until the user answers: keep it off the async runtime's threads.
    tauri::async_runtime::spawn_blocking(move || {
        use tauri_plugin_dialog::DialogExt;
        let mut dialog = app
            .dialog()
            .file()
            .set_parent(&window)
            .set_file_name(wanted.file_name);
        if !wanted.title.is_empty() {
            dialog = dialog.set_title(wanted.title);
        }
        if !wanted.extensions.is_empty() {
            let extensions: Vec<&str> = wanted.extensions.iter().map(String::as_str).collect();
            dialog = dialog.add_filter(wanted.filter_name, &extensions);
        }
        let Some(chosen) = dialog.blocking_save_file() else {
            return Ok(None);
        };
        let path = chosen.into_path().map_err(|e| e.to_string())?;
        write_chosen_file(&path, &bytes).map(Some)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Local mode only (the shipped thin client keeps no data folder - these stay compiled for the tests
/// and the local-server build). Log line written when the shell runs from its Microsoft Store (MSIX)
/// package and therefore uses the package-private data folder. scripts/store/build-msix.mjs looks for the text
/// `msix-package-data-dir` inside the executable to make sure a Store package never ships a shell
/// that was built before this logic existed - keep the two in sync.
#[cfg(any(feature = "local-server", test))]
const MSIX_DATA_DIR_LOG_TAG: &str = "[shell] msix-package-data-dir";

// The package identity of the current process (`package_identity::family_name` / `install_path`)
// comes from the platform layer: kernel32 on Windows, `None` everywhere else (`platform/`).

/// A package family name as Windows builds it: `<Name>_<13 character publisher id>`, where the
/// name uses letters, digits, '.' and '-'. Anything else is rejected (it becomes a folder name).
fn is_package_family_name(name: &str) -> bool {
    match name.rsplit_once('_') {
        Some((package, publisher_id)) => {
            !package.is_empty()
                && name.len() <= 64
                && publisher_id.len() == 13
                && publisher_id.chars().all(|c| c.is_ascii_alphanumeric())
                && package
                    .chars()
                    .all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '-')
        }
        None => false,
    }
}

/// True when `file` lies inside `dir`. Windows paths: case-insensitive, `\\?\` prefix ignored.
fn is_inside(dir: &std::path::Path, file: &std::path::Path) -> bool {
    let dir = plain_path(dir).replace('/', "\\").to_lowercase();
    let file = plain_path(file).replace('/', "\\").to_lowercase();
    let dir = dir.trim_end_matches('\\');
    !dir.is_empty()
        && file.len() > dir.len() + 1
        && file.starts_with(dir)
        && file.as_bytes()[dir.len()] == b'\\'
}

/// The family name of the MSIX package THIS executable was installed with, or None.
/// None for the NSIS / MSI installs and `tauri dev` (no package identity), and also when an
/// unpackaged build is merely started from inside some other packaged app (the process then
/// inherits that app's identity, but the executable is not inside that package).
fn own_package_family(
    family: Option<String>,
    package_path: Option<PathBuf>,
    exe: Option<PathBuf>,
) -> Option<String> {
    let family = family.filter(|f| is_package_family_name(f))?;
    if is_inside(&package_path?, &exe?) {
        Some(family)
    } else {
        None
    }
}

fn own_package_family_name() -> Option<String> {
    own_package_family(
        package_identity::family_name(),
        package_identity::install_path(),
        std::env::current_exe().ok(),
    )
}

// --- Reminders in the Microsoft Store (MSIX) version ---------------------------------------------
//
// tauri-plugin-notification sends every toast with the AppUserModelID `com.mydiary.app` (the bundle
// identifier). A packaged process may only use the AppUserModelID Windows generated for its package,
// so inside the Store package such a toast belongs to an app that does not exist and is never shown -
// while the plugin still reports success, which also skips the in-app fallback: the reminder is lost
// (store/MSIX-BUILD.md, section 5 item 5). The Store version therefore sends its reminder toasts
// here, as the packaged app itself, and tells the frontend what Windows did with them. The downloaded
// (NSIS / MSI) version keeps using the plugin exactly as before: `StoreNotification::NotPackaged`.

/// `Id` of the `<Application>` element in src-tauri/msix/AppxManifest.template.xml (`APPLICATION_ID`
/// in scripts/store/msix-lib.mjs). Part of the AppUserModelID; fixed after the first Store release.
const MSIX_APPLICATION_ID: &str = "YourPersonalDiary";

/// Log line written when the outcome of the Store version's reminder toasts changes (the first
/// reminder, notifications turned off or on again...). Never the text of a reminder.
const MSIX_TOAST_LOG_TAG: &str = "[shell] msix-store-toast";

/// The AppUserModelID of the packaged app: `<PackageFamilyName>!<Application Id>`.
fn packaged_aumid(family: &str) -> Option<String> {
    is_package_family_name(family).then(|| format!("{family}!{MSIX_APPLICATION_ID}"))
}

/// Text inside the toast XML: the five special characters escaped, and the characters XML 1.0 does
/// not allow (control characters other than tab / line feed / carriage return) dropped - one of
/// them in a habit name would make Windows reject the whole toast.
fn xml_text(raw: &str) -> String {
    let mut out = String::with_capacity(raw.len() + 16);
    for c in raw.chars() {
        match c {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            '\'' => out.push_str("&apos;"),
            '\t' | '\n' | '\r' => out.push(c),
            c if c.is_control() || c == '\u{fffe}' || c == '\u{ffff}' => {}
            c => out.push(c),
        }
    }
    out
}

/// The reminder toast: a title and one text under it (`ToastGeneric`, Windows 10 and 11).
fn toast_xml(title: &str, body: &str) -> String {
    format!(
        r#"<toast><visual><binding template="ToastGeneric"><text>{}</text><text>{}</text></binding></visual></toast>"#,
        xml_text(title),
        xml_text(body)
    )
}

/// What became of a reminder handed to `show_store_notification`. The frontend
/// (`StoreNotificationResult` in src/hooks/useReminders.ts) reads the kebab-case names.
#[derive(Serialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
enum StoreNotification {
    /// Not running from our Store package: the caller keeps using the notification plugin.
    NotPackaged,
    /// Windows took the toast.
    Shown,
    /// Notifications are turned off for the app (Windows settings, policy): show it inside the app.
    Disabled,
    /// The toast could not be sent: show it inside the app.
    Failed,
}

// The WinRT toast API itself is `platform::store_toast::show` (Windows only; the stub of every other
// target answers an error that is never reached, because without a package identity nothing is sent).

/// The whole decision, with the Windows call passed in (the unit tests pass a stand-in): without a
/// package of our own nothing is sent and the answer is `NotPackaged`; otherwise the toast goes out
/// with the package's AppUserModelID and the answer says what Windows did. The second value is the
/// error text of a failed call (for server.log).
fn notify_as_store_app(
    own_family: Option<&str>,
    title: &str,
    body: &str,
    send: impl FnOnce(&str, &str) -> Result<bool, String>,
) -> (StoreNotification, Option<String>) {
    let Some(aumid) = own_family.and_then(packaged_aumid) else {
        return (StoreNotification::NotPackaged, None);
    };
    match send(&aumid, &toast_xml(title, body)) {
        Ok(true) => (StoreNotification::Shown, None),
        Ok(false) => (StoreNotification::Disabled, None),
        Err(e) => (StoreNotification::Failed, Some(e)),
    }
}

/// The line for server.log when the outcome differs from the previous one, else None: one line per
/// change, not one per reminder.
fn toast_log_line(
    previous: Option<StoreNotification>,
    outcome: StoreNotification,
    detail: Option<&str>,
) -> Option<String> {
    if previous == Some(outcome) {
        return None;
    }
    Some(match detail {
        Some(detail) => format!("{MSIX_TOAST_LOG_TAG} {outcome:?}: {detail}"),
        None => format!("{MSIX_TOAST_LOG_TAG} {outcome:?}"),
    })
}

/// Shows a habit reminder as a Windows toast of the Store (MSIX) package and reports the outcome.
/// Outside our own package it does nothing and answers `not-packaged` - the frontend then uses the
/// notification plugin as it always did. `disabled` / `failed`: the frontend shows the reminder
/// inside the app instead, so it is never lost.
#[tauri::command]
async fn show_store_notification(
    app: tauri::AppHandle,
    title: String,
    body: String,
) -> StoreNotification {
    let Some(family) = own_package_family_name() else {
        return StoreNotification::NotPackaged;
    };
    // The WinRT calls may block for a moment: keep them off the main thread.
    let (outcome, detail) = tauri::async_runtime::spawn_blocking(move || {
        notify_as_store_app(Some(&family), &title, &body, platform::store_toast::show)
    })
    .await
    .unwrap_or_else(|e| (StoreNotification::Failed, Some(e.to_string())));

    static LAST_OUTCOME: Mutex<Option<StoreNotification>> = Mutex::new(None);
    let mut last = LAST_OUTCOME.lock().expect("toast state poisoned");
    if let Some(line) = toast_log_line(*last, outcome, detail.as_deref()) {
        let state = app.state::<AppState>();
        let mut s = state.0.lock().expect("state poisoned");
        push_log(&mut s, &line);
    }
    *last = Some(outcome);
    outcome
}

/// The private data folder of a packaged (Microsoft Store) install:
/// `%LOCALAPPDATA%\Packages\<family>\LocalCache\Roaming\<identifier>`.
///
/// This is where Windows itself puts every NEW file a packaged desktop app creates under
/// `%APPDATA%\<identifier>`, so a new user gets exactly the folder the OS redirection would
/// give. The path is used explicitly because the redirected `%APPDATA%` view is MERGED with the
/// real folder: for a user who already has a diary from the downloaded (NSIS / MSI) version the
/// packaged app would see the old files, change some of them in place and put new ones (also the
/// `.tmp` files of our atomic writes) into the private folder - a silent fork of the diary, whose
/// private half is deleted when the Store app is uninstalled. With the explicit path the Store
/// version starts fresh and never touches the old folder (store/MSIX-BUILD.md, section 4a).
#[cfg(any(feature = "local-server", test))]
fn packaged_data_dir(local_app_data: &std::path::Path, family: &str, identifier: &str) -> PathBuf {
    local_app_data
        .join("Packages")
        .join(family)
        .join("LocalCache")
        .join("Roaming")
        .join(identifier)
}

/// Environment variable WebView2 reads when it creates its browser environment. A value there
/// replaces the user data folder the host passes to `CreateCoreWebView2EnvironmentWithOptions`
/// (Microsoft: the folder "may be overridden by values either specified in environment variables
/// or in the registry" - quoted in store/MSIX-BUILD.md, 4a). Tauri always passes
/// `%LOCALAPPDATA%\<identifier>`; this is the only way to change it without rebuilding the main
/// window in code, because Tauri creates the configured windows before `setup` runs.
const WEBVIEW2_USER_DATA_FOLDER_ENV: &str = "WEBVIEW2_USER_DATA_FOLDER";

/// Log line written next to `MSIX_DATA_DIR_LOG_TAG` with the WebView2 profile folder in use.
/// (A log tag only. The executable check of scripts/store/build-msix.mjs - `REQUIRED_EXE_MARKERS` /
/// `FORBIDDEN_EXE_MARKERS` in scripts/store/msix-lib.mjs - no longer looks for it: it expects
/// `WEBVIEW2_USER_DATA_FOLDER` (the constant above), "offline mirror: no local data folder"
/// (offline.rs) and `msix-store-toast` (`MSIX_TOAST_LOG_TAG`), and refuses the markers of a
/// local-server build.)
#[cfg(any(feature = "local-server", test))]
const MSIX_WEBVIEW_PROFILE_LOG_TAG: &str = "[shell] msix-webview2-profile";

/// The WebView2 profile folder of a packaged (Microsoft Store) install:
/// `%LOCALAPPDATA%\Packages\<family>\LocalCache\Local\<identifier>` (WebView2 creates its
/// `EBWebView` folder inside it).
///
/// This is where the OS redirection puts the profile of a new user anyway (every NEW file under
/// `%LOCALAPPDATA%\<identifier>`), so nothing changes for new users. For a user of the downloaded
/// (NSIS / MSI) version the redirected view is MERGED with the real folder: the Store version
/// would open the old profile - localStorage with the recent search questions (diary-derived
/// text), the last user name, the first-run flag and the "remember me" token - and two differently
/// virtualized apps would write one Chromium profile (new files private, existing ones in place).
/// Same rule as `packaged_data_dir`: explicit path, the old profile is never read or written.
fn packaged_webview_data_dir(
    local_app_data: &std::path::Path,
    family: &str,
    identifier: &str,
) -> PathBuf {
    local_app_data
        .join("Packages")
        .join(family)
        .join("LocalCache")
        .join("Local")
        .join(identifier)
}

/// The folder to hand WebView2 through `WEBVIEW2_USER_DATA_FOLDER`, or None to leave Tauri's
/// default untouched: unpackaged installs (behaviour exactly as before), an unusable family name,
/// no `%LOCALAPPDATA%`, or a value that is already in the environment (`already_set`: the same
/// documented override applies to the unpackaged version too, so it is respected, not fought).
fn select_webview_data_dir(
    local_app_data: Option<PathBuf>,
    own_family: Option<&str>,
    identifier: &str,
    already_set: bool,
) -> Option<PathBuf> {
    if already_set {
        return None;
    }
    match (own_family, local_app_data) {
        (Some(family), Some(local)) if is_package_family_name(family) => {
            Some(packaged_webview_data_dir(&local, family, identifier))
        }
        _ => None,
    }
}

/// Store (MSIX) install only: points WebView2 at the package-private profile folder. Must run
/// before the Tauri builder creates the main window. Returns the folder it set, or None when
/// nothing was changed (unpackaged, or the folder cannot be created - then the window still
/// opens with Tauri's default, which the OS redirects to the same place for new files).
fn redirect_webview_profile_when_packaged(identifier: &str) -> Option<PathBuf> {
    let already_set = std::env::var_os(WEBVIEW2_USER_DATA_FOLDER_ENV).is_some_and(|v| !v.is_empty());
    let dir = select_webview_data_dir(
        std::env::var_os("LOCALAPPDATA").map(PathBuf::from),
        own_package_family_name().as_deref(),
        identifier,
        already_set,
    )?;
    std::fs::create_dir_all(&dir).ok()?;
    std::env::set_var(WEBVIEW2_USER_DATA_FOLDER_ENV, &dir);
    Some(dir)
}

/// The data folder to use: the package-private one when running from our own MSIX package,
/// otherwise `default_dir` unchanged (unpackaged behaviour is exactly as before).
#[cfg(any(feature = "local-server", test))]
fn select_data_dir(
    default_dir: PathBuf,
    local_app_data: Option<PathBuf>,
    own_family: Option<&str>,
    identifier: &str,
) -> PathBuf {
    match (own_family, local_app_data) {
        (Some(family), Some(local)) if is_package_family_name(family) => {
            packaged_data_dir(&local, family, identifier)
        }
        _ => default_dir,
    }
}

/// Local mode only. Resolves the data directory used by the server: `%APPDATA%\com.mydiary.app` on
/// Windows, or the package-private folder when installed from the Microsoft Store (see
/// `packaged_data_dir`). The shipped build never calls this: it creates no folder on the device.
#[cfg(feature = "local-server")]
fn data_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let default_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("cannot resolve app data dir: {e}"))?;
    let dir = select_data_dir(
        default_dir,
        app.path().local_data_dir().ok(),
        own_package_family_name().as_deref(),
        &app.config().identifier,
    );
    std::fs::create_dir_all(&dir).map_err(|e| format!("cannot create {}: {e}", dir.display()))?;
    Ok(dir)
}

/// Local mode only. Resolves the bundled server script. In `tauri dev` the resources are copied
/// next to the debug binary; in a local-mode installer they live in the installation's resource
/// directory (tauri.local.conf.json `bundle.resources`).
#[cfg(feature = "local-server")]
fn server_script(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|e| format!("cannot resolve resource dir: {e}"))?;
    let candidates = [
        resource_dir.join("server").join("server.cjs"),
        resource_dir.join("resources").join("server").join("server.cjs"),
        // Running from the repo (cargo run / tauri dev without bundling step)
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("resources")
            .join("server")
            .join("server.cjs"),
    ];
    for c in &candidates {
        if c.exists() {
            return Ok(c.clone());
        }
    }
    Err(format!(
        "server script not found. Looked in: {}",
        candidates
            .iter()
            .map(|p| p.display().to_string())
            .collect::<Vec<_>>()
            .join(", ")
    ))
}

/// Local mode only. Static UI directory to serve to phones: the UI is bundled inside the shell, so
/// the local-mode build also ships a copy under resources/server/ui (created by scripts/build-server.mjs).
#[cfg(feature = "local-server")]
fn static_dir(app: &tauri::AppHandle) -> Option<PathBuf> {
    let script = server_script(app).ok()?;
    let ui = script.parent()?.join("ui");
    if ui.join("index.html").exists() {
        Some(ui)
    } else {
        None
    }
}

/// Node's module loader cannot open Windows "verbatim" paths (`\\?\C:\...`), which is what
/// Tauri's `resource_dir()` returns on Windows. Strip the prefix before handing paths to Node.
fn plain_path(p: &std::path::Path) -> String {
    let s = p.to_string_lossy().to_string();
    if let Some(rest) = s.strip_prefix(r"\\?\UNC\") {
        format!(r"\\{rest}")
    } else if let Some(rest) = s.strip_prefix(r"\\?\") {
        rest.to_string()
    } else {
        s
    }
}

/// Local mode only: starts the bundled server as a sidecar and follows its stdout. Not compiled
/// into the shipped build (no sidecar binary, no server resources - HOSTED-IMPL item 8).
#[cfg(feature = "local-server")]
fn spawn_server(app: &tauri::AppHandle) -> Result<(), String> {
    let dir = data_dir(app)?;
    let script = server_script(app)?;
    let static_ui = static_dir(app);

    let mut args: Vec<String> = vec![
        plain_path(&script),
        "--data-dir".into(),
        plain_path(&dir),
        "--assets".into(),
        script.parent().map(plain_path).unwrap_or_default(),
        // The server polls this pid and stops when we are gone (crash, forced close...).
        "--parent-pid".into(),
        std::process::id().to_string(),
    ];
    if let Some(ui) = static_ui {
        args.push("--static".into());
        args.push(plain_path(&ui));
    }
    // Development builds (tauri dev) load the UI from the Vite dev server (http://localhost:1420):
    // only then may that origin call the API cross-origin.
    if cfg!(debug_assertions) {
        args.push("--dev".into());
    }

    {
        // Record the data dir first so the startup lines below reach server.log too.
        let state = app.state::<AppState>();
        let mut s = state.0.lock().expect("state poisoned");
        s.data_dir = plain_path(&dir);
        if let Some(family) = own_package_family_name() {
            // Store (MSIX) install: the data lives in the package-private folder.
            push_log(&mut s, &format!("{} {}", MSIX_DATA_DIR_LOG_TAG, family));
            if let Some(profile) = std::env::var_os(WEBVIEW2_USER_DATA_FOLDER_ENV) {
                push_log(
                    &mut s,
                    &format!("{} {}", MSIX_WEBVIEW_PROFILE_LOG_TAG, profile.to_string_lossy()),
                );
            }
        }
        push_log(&mut s, &format!("[shell] starting diary-server {}", args.join(" ")));
    }

    let sidecar = app
        .shell()
        .sidecar("diary-server")
        .map_err(|e| format!("sidecar not found: {e}"))?
        .args(args)
        // Never let the Node runtime pick up proxies or debug hooks from the environment.
        .env("NODE_OPTIONS", "")
        .env("NO_PROXY", "*")
        .env("HTTP_PROXY", "")
        .env("HTTPS_PROXY", "");

    let (mut rx, child) = match sidecar.spawn() {
        Ok(pair) => pair,
        Err(e) => {
            let msg = format!("cannot start local server: {e}");
            let state = app.state::<AppState>();
            let mut s = state.0.lock().expect("state poisoned");
            push_log(&mut s, &format!("[shell] {msg}"));
            return Err(msg);
        }
    };

    {
        let state = app.state::<AppState>();
        let mut s = state.0.lock().expect("state poisoned");
        s.child = Some(child);
        s.last_error = None;
        push_log(&mut s, "[shell] diary-server spawned");
    }

    let handle = app.clone();
    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(bytes) => {
                    let line = String::from_utf8_lossy(&bytes).trim().to_string();
                    if line.is_empty() {
                        continue;
                    }
                    let state = handle.state::<AppState>();
                    let mut s = state.0.lock().expect("state poisoned");
                    push_log(&mut s, &line);
                    if let Ok(v) = serde_json::from_str::<serde_json::Value>(&line) {
                        match v.get("event").and_then(|e| e.as_str()) {
                            Some("listening") => {
                                s.port = v.get("port").and_then(|p| p.as_u64()).unwrap_or(0) as u16;
                                s.lan_enabled = v
                                    .get("lanEnabled")
                                    .and_then(|b| b.as_bool())
                                    .unwrap_or(false);
                                s.ready = s.port > 0;
                            }
                            Some("lan") => {
                                s.lan_enabled = v
                                    .get("enabled")
                                    .and_then(|b| b.as_bool())
                                    .unwrap_or(false);
                            }
                            Some("fatal") => {
                                s.ready = false;
                                s.last_error = v
                                    .get("message")
                                    .and_then(|m| m.as_str())
                                    .map(|m| m.to_string());
                            }
                            _ => {}
                        }
                    }
                }
                CommandEvent::Stderr(bytes) => {
                    let line = String::from_utf8_lossy(&bytes).trim().to_string();
                    if !line.is_empty() {
                        let state = handle.state::<AppState>();
                        let mut s = state.0.lock().expect("state poisoned");
                        push_log(&mut s, &format!("[stderr] {line}"));
                    }
                }
                CommandEvent::Error(err) => {
                    let state = handle.state::<AppState>();
                    let mut s = state.0.lock().expect("state poisoned");
                    s.ready = false;
                    push_log(&mut s, &format!("[shell] sidecar error: {err}"));
                    s.last_error = Some(err);
                }
                CommandEvent::Terminated(payload) => {
                    let state = handle.state::<AppState>();
                    let mut s = state.0.lock().expect("state poisoned");
                    s.ready = false;
                    s.child = None;
                    push_log(
                        &mut s,
                        &format!("server terminated (code {:?})", payload.code),
                    );
                }
                _ => {}
            }
        }
    });
    Ok(())
}

/// Keeps the last 200 lines in memory and, when a data directory is known (local mode), appends
/// every line to `<data_dir>/server.log` so problems can be inspected after the app closed. The
/// shipped build never sets a data directory: its few lines (Store toast outcomes) stay in memory
/// and nothing is written to the device. The log holds only lifecycle output, never diary content.
fn push_log(s: &mut ServerState, line: &str) {
    s.log_tail.push(line.to_string());
    if s.log_tail.len() > 200 {
        let overflow = s.log_tail.len() - 200;
        s.log_tail.drain(0..overflow);
    }
    if s.data_dir.is_empty() {
        return;
    }
    let path = PathBuf::from(&s.data_dir).join("server.log");
    // Rotate at ~1 MB: keep one previous generation.
    if let Ok(meta) = std::fs::metadata(&path) {
        if meta.len() > 1_000_000 {
            let _ = std::fs::rename(&path, path.with_extension("log.1"));
        }
    }
    if let Ok(mut f) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
    {
        use std::io::Write;
        let stamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
        let _ = writeln!(f, "{stamp} {line}");
    }
}

/// Local mode only: stops the sidecar when the window closes.
#[cfg(feature = "local-server")]
fn kill_server(app: &tauri::AppHandle) {
    let state = app.state::<AppState>();
    let mut s = state.0.lock().expect("state poisoned");
    if let Some(child) = s.child.take() {
        let _ = child.kill();
    }
    s.ready = false;
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let context = tauri::generate_context!();
    // Store (MSIX) install only - no-op otherwise. Before the builder: the main window, and with
    // it the WebView2 environment that reads the variable, is created before `setup` runs.
    let _ = redirect_webview_profile_when_packaged(&context.config().identifier);

    let builder = tauri::Builder::default();
    // The shell plugin exists only to spawn the sidecar: not part of the shipped build.
    #[cfg(feature = "local-server")]
    let builder = builder.plugin(tauri_plugin_shell::init());
    let builder = builder
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .manage(AppState(Mutex::new(ServerState::default())));

    // The commands the UI may invoke. The shipped (server-only) build registers the ones that do not
    // concern a local server - the shell's own three, the legal-page opener (opener.rs) and the ten of
    // the automatic offline mode (offline.rs: the command contract of OFFLINE-DESIGN.md section 7 and
    // the key removal of the Mac's Keychain vault, docs/APPLE-PLAN.md WP-M3, which the Windows
    // adapter never calls); local mode adds the sidecar commands of the Diagnostics card and the port
    // discovery of a UI built with VITE_LOCAL_SERVER=1.
    #[cfg(not(feature = "local-server"))]
    let builder = builder.invoke_handler(tauri::generate_handler![
        get_install_locale,
        show_store_notification,
        save_file,
        opener::open_external_url,
        offline::offline_key_protect,
        offline::offline_key_unprotect,
        offline::offline_key_remove,
        offline::offline_mirror_put,
        offline::offline_mirror_list,
        offline::offline_mirror_read,
        offline::offline_mirror_delete,
        offline::offline_mirror_clear,
        offline::offline_user_check_available,
        offline::offline_user_check
    ]);
    #[cfg(feature = "local-server")]
    let builder = builder.invoke_handler(tauri::generate_handler![
        get_server_info,
        get_server_log,
        restart_server,
        get_install_locale,
        show_store_notification,
        save_file,
        opener::open_external_url,
        offline::offline_key_protect,
        offline::offline_key_unprotect,
        offline::offline_key_remove,
        offline::offline_mirror_put,
        offline::offline_mirror_list,
        offline::offline_mirror_read,
        offline::offline_mirror_delete,
        offline::offline_mirror_clear,
        offline::offline_user_check_available,
        offline::offline_user_check
    ]);
    #[cfg(feature = "local-server")]
    let builder = builder.setup(|app| {
        let handle = app.handle().clone();
        if let Err(e) = spawn_server(&handle) {
            let state = handle.state::<AppState>();
            let mut s = state.0.lock().expect("state poisoned");
            s.last_error = Some(e);
        }
        Ok(())
    });

    builder
        .build(context)
        .expect("error while building tauri application")
        .run(|_app, _event| {
            #[cfg(feature = "local-server")]
            if matches!(_event, RunEvent::ExitRequested { .. } | RunEvent::Exit) {
                kill_server(_app);
            }
        });
}

#[cfg(test)]
mod tests {
    use super::*;

    fn save_headers(pairs: &[(&'static str, &str)]) -> tauri::http::HeaderMap {
        let mut headers = tauri::http::HeaderMap::new();
        for (name, value) in pairs {
            headers.insert(*name, tauri::http::HeaderValue::from_str(value).unwrap());
        }
        headers
    }

    #[test]
    fn save_file_decodes_the_uri_encoded_headers() {
        // What src/utils/platform.ts sends for a backup in Hebrew (encodeURIComponent of every value).
        let headers = save_headers(&[
            (SAVE_FILE_HEADER_FILE_NAME, "your-personal-diary-backup-dana-2026-10-23.mpd"),
            (SAVE_FILE_HEADER_FILTER_NAME, "%D7%A7%D7%95%D7%91%D7%A5%20%D7%92%D7%99%D7%91%D7%95%D7%99"),
            (SAVE_FILE_HEADER_FILTER_EXTENSIONS, "mpd"),
            (SAVE_FILE_HEADER_TITLE, "%D7%A9%D7%9E%D7%99%D7%A8%D7%AA%20%D7%A7%D7%95%D7%91%D7%A5"),
        ]);
        assert_eq!(
            parse_save_file_request(&headers),
            SaveFileRequest {
                file_name: "your-personal-diary-backup-dana-2026-10-23.mpd".into(),
                filter_name: "קובץ גיבוי".into(),
                extensions: vec!["mpd".into()],
                title: "שמירת קובץ".into(),
            }
        );
    }

    #[test]
    fn save_file_suggests_a_name_never_a_path() {
        assert_eq!(safe_file_name("C:\\Windows\\System32\\evil.dll"), "evil.dll");
        assert_eq!(safe_file_name("../../etc/passwd"), "passwd");
        assert_eq!(safe_file_name("a<b>c:d\"e|f?g*h.txt"), "abcdefgh.txt");
        assert_eq!(safe_file_name("export.txt. . "), "export.txt");
        assert_eq!(safe_file_name("line\nbreak.csv"), "linebreak.csv");
        for raw in ["", "   ", "..", "C:\\", "/", "???"] {
            assert_eq!(safe_file_name(raw), SAVE_FILE_FALLBACK_NAME, "{raw:?}");
        }
        assert_eq!(safe_file_name(&"x".repeat(500)).chars().count(), SAVE_FILE_MAX_TEXT);
    }

    #[test]
    fn save_file_keeps_plain_extensions_only() {
        assert_eq!(safe_extensions("mpd"), vec!["mpd"]);
        assert_eq!(safe_extensions("TXT, csv"), vec!["txt", "csv"]);
        assert_eq!(safe_extensions("*.exe,../x,,a b,toolongextension,pdf"), vec!["pdf"]);
        assert!(safe_extensions("").is_empty());
        assert_eq!(safe_extensions("a,b,c,d,e,f,g").len(), 5);
    }

    #[test]
    fn save_file_tolerates_missing_and_broken_headers() {
        let empty = parse_save_file_request(&tauri::http::HeaderMap::new());
        assert_eq!(
            empty,
            SaveFileRequest {
                file_name: SAVE_FILE_FALLBACK_NAME.into(),
                filter_name: String::new(),
                extensions: Vec::new(),
                title: String::new(),
            }
        );
        // A broken escape or invalid UTF-8 counts as missing.
        assert_eq!(percent_decode("abc%2"), None);
        assert_eq!(percent_decode("%zz"), None);
        assert_eq!(percent_decode("%FF"), None);
        assert_eq!(percent_decode("a%20b%2Fc"), Some("a b/c".into()));
        let broken = save_headers(&[(SAVE_FILE_HEADER_FILE_NAME, "%E0%A4"), (SAVE_FILE_HEADER_TITLE, "ok%0Atitle")]);
        let parsed = parse_save_file_request(&broken);
        assert_eq!(parsed.file_name, SAVE_FILE_FALLBACK_NAME);
        assert_eq!(parsed.title, "oktitle");
    }

    #[test]
    fn save_file_header_names_match_the_frontend() {
        // SAVE_FILE_HEADERS in src/utils/platform.ts - the page that sends them.
        let frontend = include_str!("../../src/utils/platform.ts");
        for (key, name) in [
            ("fileName", SAVE_FILE_HEADER_FILE_NAME),
            ("filterName", SAVE_FILE_HEADER_FILTER_NAME),
            ("filterExtensions", SAVE_FILE_HEADER_FILTER_EXTENSIONS),
            ("title", SAVE_FILE_HEADER_TITLE),
        ] {
            assert!(frontend.contains(&format!("{key}: '{name}'")), "{key}: '{name}' missing in platform.ts");
        }
        assert!(frontend.contains("invoke<string | null>('save_file'"));
    }

    #[test]
    fn save_file_writes_the_bytes_and_answers_the_file_name() {
        let dir = std::env::temp_dir().join(format!("mpd-save-file-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let target = dir.join("export.txt");
        assert_eq!(write_chosen_file(&target, b"fictional diary text").unwrap(), "export.txt");
        assert_eq!(std::fs::read(&target).unwrap(), b"fictional diary text");
        // Overwriting (the dialog already asked) replaces the content.
        write_chosen_file(&target, b"x").unwrap();
        assert_eq!(std::fs::read(&target).unwrap(), b"x");
        // A folder that does not exist is an error, not a panic.
        assert!(write_chosen_file(&dir.join("missing").join("a.txt"), b"x").is_err());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn install_locale_accepts_every_ui_locale() {
        for code in UI_LOCALES {
            assert_eq!(parse_install_locale(code), Some(code));
        }
        assert_eq!(UI_LOCALES.len(), 20);
    }

    #[test]
    fn install_locale_tolerates_whitespace_bom_and_case() {
        assert_eq!(parse_install_locale("he\r\n"), Some("he"));
        assert_eq!(parse_install_locale("  de  "), Some("de"));
        assert_eq!(parse_install_locale("\u{feff}ar"), Some("ar"));
        assert_eq!(parse_install_locale("ZH"), Some("zh"));
    }

    #[test]
    fn install_locale_rejects_anything_else() {
        for raw in [
            "", " ", "xx", "en-US", "pt-BR", "zh-CN", "he en", "he\nen", "english", "../en", "e n",
            "\0en",
        ] {
            assert_eq!(parse_install_locale(raw), None, "{raw:?}");
        }
    }

    #[test]
    fn install_locale_file_is_read_and_validated() {
        let dir = std::env::temp_dir().join(format!("mpd-install-locale-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let file = dir.join(INSTALL_LOCALE_FILE);

        assert_eq!(read_install_locale(&file), None, "missing file");
        std::fs::write(&file, b"th").unwrap();
        assert_eq!(read_install_locale(&file), Some("th"));
        std::fs::write(&file, b"fr\r\n").unwrap();
        assert_eq!(read_install_locale(&file), Some("fr"));
        std::fs::write(&file, b"klingon").unwrap();
        assert_eq!(read_install_locale(&file), None, "unknown code");
        std::fs::write(&file, [0xff, 0xfe, b'e', 0, b'n', 0]).unwrap();
        assert_eq!(read_install_locale(&file), None, "not UTF-8");
        std::fs::write(&file, format!("en{}", " ".repeat(100))).unwrap();
        assert_eq!(read_install_locale(&file), None, "oversized");
        assert_eq!(read_install_locale(&dir), None, "a directory is not a locale file");

        std::fs::remove_dir_all(&dir).unwrap();
    }

    // --- Microsoft Store (MSIX) package: data folder selection ---------------------------------

    const FAMILY: &str = "12345Publisher.YourPersonalDiary_abcdefghjkmnp";

    #[test]
    fn unpackaged_installs_keep_the_default_data_dir() {
        let default_dir = PathBuf::from(r"C:\Users\dana\AppData\Roaming\com.mydiary.app");
        let local = Some(PathBuf::from(r"C:\Users\dana\AppData\Local"));
        // No package identity (NSIS / MSI install, tauri dev): exactly the directory as before.
        assert_eq!(
            select_data_dir(default_dir.clone(), local.clone(), None, "com.mydiary.app"),
            default_dir
        );
        // Something that is not a package family name is never turned into a folder.
        for bad in ["", "NoPublisherId", r"..\..\evil_abcdefghjkmnp", "Name_short", "Na me_abcdefghjkmnp"] {
            assert_eq!(
                select_data_dir(default_dir.clone(), local.clone(), Some(bad), "com.mydiary.app"),
                default_dir,
                "{bad:?}"
            );
        }
        // LocalAppData unknown: fall back to the default instead of guessing.
        assert_eq!(
            select_data_dir(default_dir.clone(), None, Some(FAMILY), "com.mydiary.app"),
            default_dir
        );
    }

    #[cfg(windows)]
    #[test]
    fn packaged_install_uses_the_package_private_data_dir() {
        let default_dir = PathBuf::from(r"C:\Users\dana\AppData\Roaming\com.mydiary.app");
        let local = PathBuf::from(r"C:\Users\dana\AppData\Local");
        let dir = select_data_dir(default_dir.clone(), Some(local), Some(FAMILY), "com.mydiary.app");
        assert_eq!(
            dir,
            PathBuf::from(
                r"C:\Users\dana\AppData\Local\Packages\12345Publisher.YourPersonalDiary_abcdefghjkmnp\LocalCache\Roaming\com.mydiary.app"
            )
        );
        // Never the folder of the downloaded (unpackaged) version.
        assert_ne!(dir, default_dir);
        assert!(!is_inside(&default_dir, &dir.join("accounts.json")));
    }

    #[cfg(windows)]
    #[test]
    fn packaged_install_puts_the_webview_profile_in_the_package_private_folder() {
        let local = PathBuf::from(r"C:\Users\dana\AppData\Local");
        let dir = select_webview_data_dir(Some(local.clone()), Some(FAMILY), "com.mydiary.app", false)
            .expect("packaged: a folder is selected");
        assert_eq!(
            dir,
            PathBuf::from(
                r"C:\Users\dana\AppData\Local\Packages\12345Publisher.YourPersonalDiary_abcdefghjkmnp\LocalCache\Local\com.mydiary.app"
            )
        );
        // Never the folder Tauri passes by default (the merged view that includes the profile of
        // the downloaded version).
        let tauri_default = local.join("com.mydiary.app");
        assert_ne!(dir, tauri_default);
        assert!(!is_inside(&tauri_default, &dir));
        // Next to the diary data: same package, same LocalCache (Local vs Roaming).
        let data = packaged_data_dir(&local, FAMILY, "com.mydiary.app");
        assert_eq!(dir.parent().unwrap().parent().unwrap(), data.parent().unwrap().parent().unwrap());
        assert_eq!(dir.parent().unwrap().file_name().unwrap(), "Local");
        assert_eq!(data.parent().unwrap().file_name().unwrap(), "Roaming");
    }

    #[test]
    fn webview_profile_is_left_alone_unless_packaged() {
        let local = Some(PathBuf::from(r"C:\Users\dana\AppData\Local"));
        // No package identity (NSIS / MSI install, tauri dev): Tauri's default stays.
        assert_eq!(select_webview_data_dir(local.clone(), None, "com.mydiary.app", false), None);
        // Not a package family name: never turned into a folder.
        for bad in ["", "NoPublisherId", r"..\..\evil_abcdefghjkmnp", "Name_short"] {
            assert_eq!(
                select_webview_data_dir(local.clone(), Some(bad), "com.mydiary.app", false),
                None,
                "{bad:?}"
            );
        }
        // LocalAppData unknown: do not guess.
        assert_eq!(select_webview_data_dir(None, Some(FAMILY), "com.mydiary.app", false), None);
        // WEBVIEW2_USER_DATA_FOLDER already in the environment: the documented override wins.
        assert_eq!(select_webview_data_dir(local, Some(FAMILY), "com.mydiary.app", true), None);
    }

    #[test]
    fn webview_profile_redirect_is_a_no_op_outside_our_package() {
        // The test process is never installed inside our package: nothing is set or created.
        let before = std::env::var_os(WEBVIEW2_USER_DATA_FOLDER_ENV);
        assert_eq!(redirect_webview_profile_when_packaged("com.mydiary.app"), None);
        assert_eq!(std::env::var_os(WEBVIEW2_USER_DATA_FOLDER_ENV), before);
    }

    #[test]
    fn package_family_names_are_validated() {
        assert!(is_package_family_name(FAMILY));
        assert!(is_package_family_name("Placeholder.YourPersonalDiary_e9xxthmdhp5wa"));
        assert!(is_package_family_name("Microsoft.WindowsTerminal_8wekyb3d8bbwe"));
        for bad in [
            "",
            "_",
            "_8wekyb3d8bbwe",
            "Name",
            "Name_8wekyb3d8bbw",
            "Name_8wekyb3d8bbwe1",
            "Name_8wekyb3d8bb/e",
            r"Na\me_8wekyb3d8bbwe",
            "Na me_8wekyb3d8bbwe",
            "..\u{5c}.._8wekyb3d8bbwe",
        ] {
            assert!(!is_package_family_name(bad), "{bad:?}");
        }
        let too_long = format!("{}_8wekyb3d8bbwe", "a".repeat(60));
        assert!(!is_package_family_name(&too_long));
    }

    #[test]
    fn own_package_requires_the_executable_inside_the_package() {
        let pkg = PathBuf::from(r"C:\Program Files\WindowsApps\12345Publisher.YourPersonalDiary_1.0.0.0_x64__abcdefghjkmnp");
        let exe_in = pkg.join("your-personal-diary.exe");
        assert_eq!(
            own_package_family(Some(FAMILY.into()), Some(pkg.clone()), Some(exe_in.clone())),
            Some(FAMILY.to_string())
        );
        // Verbatim prefix and different letter case (what current_exe() may return on Windows).
        let verbatim = PathBuf::from(format!(r"\\?\{}", exe_in.display()).to_uppercase());
        assert_eq!(
            own_package_family(Some(FAMILY.into()), Some(pkg.clone()), Some(verbatim)),
            Some(FAMILY.to_string())
        );
        // An unpackaged build started from inside another packaged app inherits that app's
        // identity, but its executable is elsewhere: treated as unpackaged.
        let exe_out = PathBuf::from(r"C:\Users\dana\AppData\Local\Your Personal Diary\your-personal-diary.exe");
        assert_eq!(own_package_family(Some(FAMILY.into()), Some(pkg.clone()), Some(exe_out)), None);
        // A sibling folder that merely starts with the same text is not "inside".
        let sibling = PathBuf::from(format!(r"{}-other\your-personal-diary.exe", pkg.display()));
        assert_eq!(own_package_family(Some(FAMILY.into()), Some(pkg.clone()), Some(sibling)), None);
        assert!(!is_inside(&pkg, &pkg));
        // No identity, no path or no executable path: unpackaged.
        assert_eq!(own_package_family(None, Some(pkg.clone()), Some(exe_in.clone())), None);
        assert_eq!(own_package_family(Some(FAMILY.into()), None, Some(exe_in.clone())), None);
        assert_eq!(own_package_family(Some(FAMILY.into()), Some(pkg.clone()), None), None);
        assert_eq!(own_package_family(Some("garbage".into()), Some(pkg), Some(exe_in)), None);
    }

    #[test]
    fn package_identity_of_the_test_process_is_never_ours() {
        // The real Windows calls must not crash. The test binary may run without package identity
        // (a normal terminal) or inside another packaged app's container (then a family name and
        // an install path are reported); it is never installed inside a package itself.
        let family = package_identity::family_name();
        let path = package_identity::install_path();
        println!("package identity of the test process: {family:?} at {path:?}");
        assert_eq!(family.is_some(), path.is_some());
        if let Some(f) = &family {
            assert!(is_package_family_name(f), "{f:?}");
        }
        assert_eq!(own_package_family_name(), None);
    }

    /// Stand-ins for GetCurrentPackageFamilyName with the documented contract: the length
    /// includes the terminating NUL; a too small (or null) buffer yields ERROR_INSUFFICIENT_BUFFER
    /// (122) and the needed length; no package yields APPMODEL_ERROR_NO_PACKAGE (15700).
    #[cfg(windows)]
    unsafe extern "system" fn fake_packaged(len: *mut u32, buf: *mut u16) -> i32 {
        let text: Vec<u16> = FAMILY.encode_utf16().chain(std::iter::once(0)).collect();
        let capacity = *len as usize;
        *len = text.len() as u32;
        if buf.is_null() || capacity < text.len() {
            return 122;
        }
        std::ptr::copy_nonoverlapping(text.as_ptr(), buf, text.len());
        0
    }

    #[cfg(windows)]
    unsafe extern "system" fn fake_unpackaged(len: *mut u32, _buf: *mut u16) -> i32 {
        *len = 0;
        15700
    }

    #[cfg(windows)]
    unsafe extern "system" fn fake_failing_second_call(len: *mut u32, buf: *mut u16) -> i32 {
        if buf.is_null() {
            *len = 8;
            122
        } else {
            5 // ERROR_ACCESS_DENIED
        }
    }

    #[cfg(windows)]
    #[test]
    fn package_identity_query_follows_the_two_call_contract() {
        assert_eq!(package_identity::query(fake_packaged), Some(FAMILY.to_string()));
        assert_eq!(package_identity::query(fake_unpackaged), None);
        assert_eq!(package_identity::query(fake_failing_second_call), None);
    }

    // --- Microsoft Store (MSIX) package: reminder toasts ----------------------------------------

    /// A stand-in for the Windows toast call that must never be reached.
    fn never_sent(_aumid: &str, _xml: &str) -> Result<bool, String> {
        panic!("the toast API must not be called outside our own package");
    }

    #[test]
    fn packaged_aumid_is_the_family_name_and_the_application_id() {
        assert_eq!(
            packaged_aumid(FAMILY).as_deref(),
            Some("12345Publisher.YourPersonalDiary_abcdefghjkmnp!YourPersonalDiary")
        );
        // The Application Id of the manifest template (scripts/store/msix-lib.mjs APPLICATION_ID).
        assert_eq!(MSIX_APPLICATION_ID, "YourPersonalDiary");
        // Never the bundle identifier the notification plugin signs its toasts with.
        assert_ne!(packaged_aumid(FAMILY).as_deref(), Some("com.mydiary.app"));
        // Something that is not a package family name never becomes an AppUserModelID.
        for bad in ["", "com.mydiary.app", "NoPublisherId", "Name_short", "Na me_abcdefghjkmnp", "a!b_abcdefghjkmnp"] {
            assert_eq!(packaged_aumid(bad), None, "{bad:?}");
        }
    }

    #[test]
    fn unpackaged_installs_never_send_a_store_toast() {
        // No package identity (NSIS / MSI install, tauri dev): the plugin stays in charge.
        assert_eq!(
            notify_as_store_app(None, "Reminder", "Drink water", never_sent),
            (StoreNotification::NotPackaged, None)
        );
        // An unusable family name is treated the same way.
        for bad in ["", "com.mydiary.app", "Name_short"] {
            assert_eq!(
                notify_as_store_app(Some(bad), "Reminder", "Drink water", never_sent),
                (StoreNotification::NotPackaged, None),
                "{bad:?}"
            );
        }
        // The real detection in this test process (never installed inside our package).
        assert_eq!(
            notify_as_store_app(own_package_family_name().as_deref(), "Reminder", "Drink water", never_sent),
            (StoreNotification::NotPackaged, None)
        );
    }

    #[test]
    fn packaged_install_sends_the_toast_with_its_own_aumid() {
        let mut sent: Vec<(String, String)> = Vec::new();
        let outcome = notify_as_store_app(Some(FAMILY), "Reminder", "Drink water", |aumid, xml| {
            sent.push((aumid.to_string(), xml.to_string()));
            Ok(true)
        });
        assert_eq!(outcome, (StoreNotification::Shown, None));
        assert_eq!(sent.len(), 1);
        assert_eq!(sent[0].0, "12345Publisher.YourPersonalDiary_abcdefghjkmnp!YourPersonalDiary");
        assert_eq!(
            sent[0].1,
            r#"<toast><visual><binding template="ToastGeneric"><text>Reminder</text><text>Drink water</text></binding></visual></toast>"#
        );
    }

    #[test]
    fn packaged_install_reports_what_windows_did_with_the_toast() {
        // Notifications turned off for the app: nothing was shown, the frontend falls back.
        assert_eq!(
            notify_as_store_app(Some(FAMILY), "t", "b", |_, _| Ok(false)),
            (StoreNotification::Disabled, None)
        );
        // The call failed: the frontend falls back, the error text goes to the log.
        assert_eq!(
            notify_as_store_app(Some(FAMILY), "t", "b", |_, _| Err("0x80070490".to_string())),
            (StoreNotification::Failed, Some("0x80070490".to_string()))
        );
    }

    #[test]
    fn toast_xml_escapes_the_text_and_drops_what_xml_forbids() {
        assert_eq!(xml_text(r#"<b> & "quotes" 'single'"#), "&lt;b&gt; &amp; &quot;quotes&quot; &apos;single&apos;");
        // Hebrew, Arabic, emoji and line breaks pass through unchanged.
        assert_eq!(xml_text("תזכורת: לשתות מים\nتذكير 💧"), "תזכורת: לשתות מים\nتذكير 💧");
        // Control characters (also NUL and the C1 block) and the two non-characters are dropped.
        assert_eq!(xml_text("a\u{0}b\u{1b}c\u{85}d\u{fffe}e\u{ffff}f\tg"), "abcdef\tg");
        // A habit name cannot break out of its <text> element.
        let xml = toast_xml("Reminder", r#"</text><action content="x"/><text>"#);
        assert_eq!(xml.matches("<text>").count(), 2);
        assert_eq!(xml.matches("</text>").count(), 2);
        assert!(!xml.contains("<action"));
        assert!(xml.starts_with("<toast><visual>") && xml.ends_with("</visual></toast>"));
    }

    #[test]
    fn store_notification_names_match_the_frontend() {
        // StoreNotificationResult in src/hooks/useReminders.ts
        let names: Vec<String> = [
            StoreNotification::NotPackaged,
            StoreNotification::Shown,
            StoreNotification::Disabled,
            StoreNotification::Failed,
        ]
        .iter()
        .map(|o| serde_json::to_string(o).unwrap())
        .collect();
        assert_eq!(names, [r#""not-packaged""#, r#""shown""#, r#""disabled""#, r#""failed""#]);
    }

    #[test]
    fn toast_outcome_is_logged_once_per_change() {
        let first = toast_log_line(None, StoreNotification::Shown, None);
        assert_eq!(first.as_deref(), Some("[shell] msix-store-toast Shown"));
        // The same outcome again: no further line (one per reminder would flood the log).
        assert_eq!(toast_log_line(Some(StoreNotification::Shown), StoreNotification::Shown, None), None);
        // A change is logged, with the error text of a failed call.
        assert_eq!(
            toast_log_line(Some(StoreNotification::Shown), StoreNotification::Failed, Some("0x80070490")).as_deref(),
            Some("[shell] msix-store-toast Failed: 0x80070490")
        );
        assert_eq!(
            toast_log_line(Some(StoreNotification::Failed), StoreNotification::Disabled, None).as_deref(),
            Some("[shell] msix-store-toast Disabled")
        );
    }

    #[test]
    fn msix_log_tags_match_the_build_script_markers() {
        // scripts/store/msix-lib.mjs PACKAGED_DATA_DIR_MARKER / PACKAGED_WEBVIEW_PROFILE_MARKER
        assert!(MSIX_DATA_DIR_LOG_TAG.contains("msix-package-data-dir"));
        assert!(MSIX_WEBVIEW_PROFILE_LOG_TAG.contains("msix-webview2-profile"));
    }

    // --- The shipped Windows app is a server-only thin client (HOSTED-IMPL items 8 and 10) -----
    //
    // Read from the same files the build uses, so the tests follow every edit: the shipped Tauri
    // config, the local-mode overlay and the clients' one server address (src/config/
    // server-default.json - the host is never spelled in code, scripts/check-no-network.mjs).

    fn shipped_config() -> serde_json::Value {
        serde_json::from_str(include_str!("../tauri.conf.json")).expect("tauri.conf.json is JSON")
    }

    fn local_mode_overlay() -> serde_json::Value {
        serde_json::from_str(include_str!("../tauri.local.conf.json")).expect("tauri.local.conf.json is JSON")
    }

    /// The origin of the Your Personal Diary server the UI is wired to (`https://<host>`).
    fn default_server_origin() -> String {
        let v: serde_json::Value = serde_json::from_str(include_str!("../../src/config/server-default.json"))
            .expect("server-default.json is JSON");
        let url = v["url"].as_str().expect("server-default.json: \"url\"").trim().trim_end_matches('/');
        assert!(url.starts_with("https://"), "the default server is https: {url}");
        assert!(!url["https://".len()..].contains('/'), "a bare origin, no path: {url}");
        url.to_string()
    }

    /// The sources of the `connect-src` directive of a CSP string.
    fn connect_src(csp: &str) -> Vec<String> {
        csp.split(';')
            .map(str::trim)
            .find_map(|directive| directive.strip_prefix("connect-src "))
            .expect("the CSP has a connect-src directive")
            .split_whitespace()
            .map(str::to_string)
            .collect()
    }

    #[test]
    fn shipped_bundle_carries_no_server() {
        let bundle = &shipped_config()["bundle"];
        // No sidecar binary (node.exe) and no server resources (server.cjs, sql-wasm.wasm, fonts, ui):
        // the installer holds the shell and the UI only. Local mode adds them through the overlay.
        assert!(bundle.get("externalBin").is_none(), "tauri.conf.json must not bundle a sidecar");
        assert!(bundle.get("resources").is_none(), "tauri.conf.json must not bundle server resources");
        assert!(bundle["active"].as_bool().unwrap_or(false));
        // The installer's language chooser is unchanged.
        let nsis = &bundle["windows"]["nsis"];
        assert_eq!(nsis["languages"].as_array().map(Vec::len), Some(20));
        assert_eq!(nsis["displayLanguageSelector"], true);
        assert_eq!(nsis["installerHooks"], "./nsis/hooks.nsh");
    }

    #[test]
    fn shipped_window_connects_only_to_the_diary_server() {
        let security = &shipped_config()["app"]["security"];
        let origin = default_server_origin();
        // Release CSP: the fixed server origin and Tauri's IPC - nothing else, no loopback, no scheme
        // wildcard (the address is fixed at build time, so it can be named exactly).
        let csp = security["csp"].as_str().expect("csp");
        assert_eq!(connect_src(csp), ["'self'", origin.as_str(), "ipc:", "http://ipc.localhost"]);
        for forbidden in ["https:", "http:", "*"] {
            assert!(!connect_src(csp).iter().any(|s| s == forbidden), "no wildcard source {forbidden:?}");
        }
        // Dev CSP (tauri dev / --debug): the same origin, plus loopback for a local test server pointed
        // at with VITE_API_BASE and the Vite HMR socket - still no other host on the internet.
        let dev = connect_src(security["devCsp"].as_str().expect("devCsp"));
        assert!(dev.contains(&origin), "devCsp allows the diary server");
        for source in &dev {
            let local = source.starts_with("http://127.0.0.1:")
                || source.starts_with("http://localhost:")
                || source.starts_with("ws://localhost:");
            assert!(
                *source == origin || source == "'self'" || source == "ipc:" || source == "http://ipc.localhost" || local,
                "unexpected devCsp connect-src source {source:?}"
            );
        }
    }

    #[test]
    fn local_mode_overlay_restores_the_sidecar_and_the_loopback_csp() {
        let overlay = local_mode_overlay();
        assert_eq!(overlay["bundle"]["externalBin"], serde_json::json!(["binaries/diary-server"]));
        assert_eq!(overlay["bundle"]["resources"]["resources/server/"], "server/");
        for key in ["csp", "devCsp"] {
            let sources = connect_src(overlay["app"]["security"][key].as_str().expect(key));
            assert!(sources.iter().any(|s| s == "http://127.0.0.1:*"), "{key}: the local server is reachable");
            // Local mode is the developer configuration of the LOCAL server: the public server is not
            // on its allow-list (the UI built with VITE_LOCAL_SERVER=1 never calls it).
            assert!(!sources.contains(&default_server_origin()), "{key}: no public server in local mode");
        }
        // The UI of a local-mode build must discover the sidecar's port (src/config/server-default.ts).
        for key in ["beforeDevCommand", "beforeBuildCommand"] {
            let command = overlay["build"][key].as_str().expect(key);
            assert!(command.contains("VITE_LOCAL_SERVER=1"), "{key}: {command}");
        }
        // Nothing else of the shipped config is touched (window, identifier, installer languages).
        for key in ["identifier", "productName", "mainBinaryName", "version"] {
            assert!(overlay.get(key).is_none(), "the overlay must not change {key}");
        }
        assert!(overlay["bundle"].get("windows").is_none());
    }

    #[test]
    fn shipped_build_keeps_its_log_in_memory_only() {
        // No data directory is ever chosen in the shipped build, so push_log has no file to append to:
        // the Store toast outcomes stay in the 200-line memory tail and nothing is written to the device.
        let mut s = ServerState::default();
        assert!(s.data_dir.is_empty());
        push_log(&mut s, "[shell] msix-store-toast Shown");
        push_log(&mut s, "[shell] msix-store-toast Disabled");
        assert_eq!(s.log_tail, ["[shell] msix-store-toast Shown", "[shell] msix-store-toast Disabled"]);
        assert!(s.data_dir.is_empty(), "logging never invents a data directory");
        assert!(!std::path::Path::new("server.log").exists(), "no server.log in the working directory");
    }

    #[test]
    fn shipped_build_compiles_without_the_local_server() {
        // The default feature set is the thin client; `--features local-server` is the developer
        // configuration (src-tauri/Cargo.toml). A test run with the feature on checks the local branch.
        if cfg!(feature = "local-server") {
            println!("local-server feature on: developer configuration under test");
        } else {
            // In the shipped build the state carries no sidecar fields and no sidecar is spawned.
            let s = ServerState::default();
            assert!(s.log_tail.is_empty() && s.data_dir.is_empty());
        }
    }
}
