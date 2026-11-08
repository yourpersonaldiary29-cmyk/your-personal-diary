//! Opening the diary server's legal pages in the system browser (docs/android-tasks/WINDOWS-OPENER.md).
//!
//! The UI links to the privacy policy and the delete-account page of the fixed diary server
//! (src/components/legal/PrivacyPolicyLink.tsx). In the Windows app WebView2 swallows
//! `target="_blank"` and a plain navigation would replace the app, so the page hands the address to
//! the `open_external_url` command and the shell passes it to the platform layer
//! (`platform::open_url`: on Windows the Windows shell, `ShellExecuteW`, which starts the user's
//! default browser - `platform/windows.rs`). The shell itself opens no connection - the browser
//! does, exactly as when the user types the address.
//!
//! The page decides nothing: the shell opens ONLY an absolute https address of the fixed diary
//! server - the origin of src/config/server-default.json, the one address the UI and the window's
//! CSP are wired to - whose path is one of the legal pages, `/privacy/...` or
//! `/delete-account/...` (the page itself or a locale folder of it, scripts/legal/build-pages.mjs).
//! Anything else is refused with an error and never reaches Windows: no other site, no other
//! scheme (javascript:, file:, ms-settings:...), no local file or program, no other page of the
//! server, no address with user-info, a port, an escape, a dot segment, a backslash, a query or a
//! fragment.

use crate::platform;

/// The legal pages of the diary server the UI links to (`legalPageUrl` in PrivacyPolicyLink.tsx).
const LEGAL_PAGE_PREFIXES: [&str; 2] = ["/privacy/", "/delete-account/"];

/// Longest address accepted (bytes). The real ones are about 50.
const MAX_URL_LEN: usize = 512;

/// The error of a refused address. The address itself is not repeated.
const REFUSED: &str =
    "open_external_url opens only the privacy and delete-account pages of the diary server";

/// The origin of the fixed diary server (`https://<host>`, lower case, no trailing slash), read from
/// the same src/config/server-default.json the UI is built with, so no second copy of the address
/// can drift. None when that file does not hold a usable address: then nothing is ever opened.
fn diary_server_origin() -> Option<String> {
    parse_server_origin(include_str!("../../src/config/server-default.json"))
}

/// `{"url": "https://<host>[:port]"}` -> the origin, validated like `normalizeServerUrl` in
/// src/config/server-default.ts and scripts/check-no-network.mjs: https, a plain DNS host name
/// (letters, digits, '-' and dots), an optional port, no path, query, fragment or credentials.
/// The host is lower-cased and the default port 443 dropped, as the browser's `URL.origin` does.
fn parse_server_origin(json: &str) -> Option<String> {
    let value: serde_json::Value = serde_json::from_str(json).ok()?;
    let raw = value.get("url")?.as_str()?.trim();
    let authority = raw.strip_prefix("https://")?;
    let authority = authority.strip_suffix('/').unwrap_or(authority).to_ascii_lowercase();
    let (host, port) = match authority.split_once(':') {
        Some((host, port)) => (host, Some(port)),
        None => (authority.as_str(), None),
    };
    let host_ok = !host.is_empty()
        && host.len() <= 253
        && host.split('.').all(|label| {
            !label.is_empty()
                && label.len() <= 63
                && !label.starts_with('-')
                && !label.ends_with('-')
                && label.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
        });
    let port = match port {
        None => None,
        Some(p) if !p.is_empty() && p.len() <= 5 && p.chars().all(|c| c.is_ascii_digit()) => {
            match p.parse::<u16>() {
                Ok(443) => None,
                Ok(n) if n > 0 => Some(n),
                _ => return None,
            }
        }
        Some(_) => return None,
    };
    if !host_ok {
        return None;
    }
    Some(match port {
        Some(port) => format!("https://{host}:{port}"),
        None => format!("https://{host}"),
    })
}

/// True only for `<origin>/privacy/...` or `<origin>/delete-account/...` with nothing after the page
/// but locale folders (`he/`, `pt-br/`): segments of ASCII letters, digits, '-' and '_' separated by
/// single slashes, an optional trailing slash.
///
/// Compared as text, never "repaired": the address must START with the origin followed by the
/// path's slash, so another host (`<host>.example`), user-info (`<host>@example`), a port or a
/// scheme in other letter case cannot get past; only visible ASCII is accepted (no space, control
/// character, look-alike letter); and the folder rule leaves no room for `%` (an encoded dot or
/// slash), `.` (a `..` segment the browser would resolve away), `\` (a slash to the browser), `?`,
/// `#` or `@`.
fn is_openable_url(url: &str, origin: &str) -> bool {
    if origin.is_empty() || url.len() > MAX_URL_LEN || !url.bytes().all(|b| b.is_ascii_graphic()) {
        return false;
    }
    let Some(path) = url.strip_prefix(origin) else {
        return false;
    };
    let Some(rest) = LEGAL_PAGE_PREFIXES.iter().find_map(|page| path.strip_prefix(page)) else {
        return false;
    };
    if rest.is_empty() {
        return true;
    }
    rest.strip_suffix('/').unwrap_or(rest).split('/').all(|segment| {
        !segment.is_empty()
            && segment.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
    })
}

/// The whole decision, with the platform call passed in (the unit tests pass a stand-in): an address
/// the rule accepts goes to `open`, anything else is an error and `open` is never called.
fn open_checked(
    url: &str,
    origin: Option<&str>,
    open: impl FnOnce(&str) -> Result<(), String>,
) -> Result<(), String> {
    match origin {
        Some(origin) if is_openable_url(url, origin) => open(url),
        _ => Err(REFUSED.to_string()),
    }
}

/// What `ShellExecuteW` answered: a value above 32 means Windows started the program for the
/// address; 32 and below are its documented error codes. Windows knowledge in portable code: it
/// stays here next to its test, and `platform::windows::open_url` maps the shell's answer with it
/// (no other platform calls it, hence the allowance).
#[cfg_attr(not(windows), allow(dead_code))]
pub(crate) fn shell_execute_outcome(code: isize) -> Result<(), String> {
    if code > 32 {
        return Ok(());
    }
    let reason = match code {
        0 | 8 => "out of memory",
        2 | 3 => "the address was not found",
        5 => "access denied",
        26 => "sharing violation",
        27 | 31 => "no program is set to open web addresses",
        28 | 29 | 30 => "the browser did not answer",
        32 => "a library was not found",
        _ => "unknown error",
    };
    Err(format!("Windows could not open the address ({reason}, ShellExecute error {code})"))
}

/// Opens a legal page of the diary server (`{ url }`) in the system browser. Refused with an error,
/// and never handed to the platform, unless `url` is one of those pages (`is_openable_url`); an
/// error as well when the platform could not start a browser (`platform::open_url`: the Windows
/// shell call on Windows, an error on a target without an implementation). The UI then shows the
/// address as text.
#[tauri::command]
pub async fn open_external_url(url: String) -> Result<(), String> {
    let origin = diary_server_origin();
    // The platform call may block for a moment while the browser starts: keep it off the IPC thread.
    tauri::async_runtime::spawn_blocking(move || open_checked(&url, origin.as_deref(), platform::open_url))
        .await
        .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    // The addresses below are put together from parts: scripts/check-no-network.mjs scans this file
    // and refuses a literal external address outside comments. Nothing here opens anything - the
    // tests never call `shell::open` or the command.

    /// A host that is not the diary server.
    const OTHER: &str = "evil.example";
    /// A user name in front of a host (`<user>@<host>`).
    const USER: &str = "user";
    /// A sub-domain label in front of the diary server's host.
    const WWW: &str = "www";

    /// The fixed diary server's origin and host, from src/config/server-default.json.
    fn origin() -> String {
        diary_server_origin().expect("server-default.json holds the diary server's https origin")
    }

    fn host() -> String {
        origin()["https://".len()..].to_string()
    }

    fn json(url: &str) -> String {
        serde_json::json!({ "url": url }).to_string()
    }

    /// A stand-in for the Windows call that must never be reached.
    fn never_opened(url: &str) -> Result<(), String> {
        panic!("a refused address reached the Windows shell: {url:?}");
    }

    fn assert_refused(url: &str) {
        assert!(!is_openable_url(url, &origin()), "accepted: {url:?}");
        assert_eq!(open_checked(url, Some(&origin()), never_opened), Err(REFUSED.to_string()), "{url:?}");
    }

    #[test]
    fn the_origin_is_the_one_of_server_default_json() {
        let origin = origin();
        assert!(origin.starts_with("https://"), "{origin}");
        assert!(!host().is_empty() && !host().contains('/') && !host().contains('@'), "{origin}");
        // The same address the window's CSP allows (tauri.conf.json connect-src).
        let conf: serde_json::Value = serde_json::from_str(include_str!("../tauri.conf.json")).unwrap();
        let csp = conf["app"]["security"]["csp"].as_str().unwrap();
        assert!(csp.split_whitespace().any(|source| source == origin), "{csp}");
    }

    #[test]
    fn server_origin_is_validated_like_the_ui_does() {
        let h = "diary.example.org";
        assert_eq!(parse_server_origin(&json(&format!("https://{h}"))), Some(format!("https://{h}")));
        assert_eq!(parse_server_origin(&json(&format!(" https://{h}/ "))), Some(format!("https://{h}")));
        assert_eq!(parse_server_origin(&json(&format!("https://{}", h.to_uppercase()))), Some(format!("https://{h}")));
        assert_eq!(parse_server_origin(&json(&format!("https://{h}:8443"))), Some(format!("https://{h}:8443")));
        assert_eq!(parse_server_origin(&json(&format!("https://{h}:443"))), Some(format!("https://{h}")));
        for bad in [
            format!("http://{h}"),
            format!("https://{h}/api"),
            format!("https://{h}/?x=1"),
            format!("https://{h}#x"),
            format!("https://{USER}@{h}"),
            format!("https://{USER}:pw@{h}"),
            format!("https://{h}:0"),
            format!("https://{h}:99999"),
            format!("https://{h}:"),
            format!("https://{h}:44a"),
            format!("https://{}{h}", "-"),
            format!("https://{h}..org"),
            format!("https://{h}\\x"),
            "https://".to_string(),
            "https:///".to_string(),
            String::new(),
            "javascript:alert(1)".to_string(),
        ] {
            assert_eq!(parse_server_origin(&json(&bad)), None, "{bad:?}");
        }
        for bad in ["", "{}", "not json", r#"{"url": 42}"#, r#"["x"]"#] {
            assert_eq!(parse_server_origin(bad), None, "{bad:?}");
        }
    }

    #[test]
    fn accepts_the_legal_pages_of_the_diary_server() {
        let origin = origin();
        for page in ["privacy", "delete-account"] {
            for url in [
                format!("{origin}/{page}/"),
                format!("{origin}/{page}/he/"),
                format!("{origin}/{page}/he"),
                format!("{origin}/{page}/pt-br/"),
            ] {
                assert!(is_openable_url(&url, &origin), "{url:?}");
            }
            // Every UI language (the pages the UI links to: English at /<page>/, the others in their folder).
            for locale in crate::UI_LOCALES {
                let url = format!("{origin}/{page}/{locale}/");
                assert!(is_openable_url(&url, &origin), "{url:?}");
            }
        }
    }

    #[test]
    fn an_accepted_address_is_handed_to_windows_unchanged() {
        let url = format!("{}/privacy/de/", origin());
        let mut opened = Vec::new();
        let result = open_checked(&url, Some(&origin()), |u| {
            opened.push(u.to_string());
            Ok(())
        });
        assert_eq!(result, Ok(()));
        assert_eq!(opened, [url.clone()]);
        // The Windows error is passed on (the UI then shows the address as text).
        assert_eq!(
            open_checked(&url, Some(&origin()), |_| Err("no browser".to_string())),
            Err("no browser".to_string())
        );
        // Without a usable server address nothing is opened at all.
        assert_eq!(open_checked(&url, None, never_opened), Err(REFUSED.to_string()));
        assert!(!is_openable_url(&url, ""));
    }

    #[test]
    fn refuses_another_scheme() {
        let host = host();
        for url in [
            format!("http://{host}/privacy/"),
            format!("HTTPS://{host}/privacy/"),
            format!("Https://{host}/privacy/"),
            format!("ftp://{host}/privacy/"),
            format!("ws://{host}/privacy/"),
            format!("//{host}/privacy/"),
            format!("{host}/privacy/"),
            format!("https:{host}/privacy/"),
            format!("https:/{host}/privacy/"),
            format!("https:///{host}/privacy/"),
            format!("ms-settings:{host}/privacy/"),
            format!("mailto:privacy@{host}"),
            "data:text/html,<script>alert(1)</script>".to_string(),
        ] {
            assert_refused(&url);
        }
    }

    #[test]
    fn refuses_another_host() {
        let host = host();
        for url in [
            format!("https://{OTHER}/privacy/"),
            format!("https://{host}.{OTHER}/privacy/"),
            format!("https://{host}-{OTHER}/privacy/"),
            format!("https://{OTHER}/{host}/privacy/"),
            format!("https://{WWW}.{host}/privacy/"),
            format!("https://{host}./privacy/"),
            format!("https://{host}:443/privacy/"),
            format!("https://{host}:8443/privacy/"),
            format!("https://{}/privacy/", host.to_uppercase()),
            format!("https://{}/privacy/", host.replace('.', "\u{3002}")),
        ] {
            assert_refused(&url);
        }
    }

    #[test]
    fn refuses_user_info_tricks() {
        let host = host();
        for url in [
            format!("https://{USER}@{host}/privacy/"),
            format!("https://{USER}:pw@{host}/privacy/"),
            format!("https://{host}@{OTHER}/privacy/"),
            format!("https://{host}:pw@{OTHER}/privacy/"),
            format!("https://{host}/privacy/@{OTHER}/"),
            format!("https://{host}/privacy/x@{OTHER}"),
            format!("https://{host}\\@{OTHER}/privacy/"),
            format!("https://{host}%40{OTHER}/privacy/"),
            format!("https://{host}%2F@{OTHER}/privacy/"),
        ] {
            assert_refused(&url);
        }
    }

    #[test]
    fn refuses_encoded_and_dot_segment_tricks() {
        let origin = origin();
        let host = host();
        for url in [
            format!("{origin}/privacy/%2e%2e/api/auth/"),
            format!("{origin}/privacy/%2E%2E/"),
            format!("{origin}/privacy/.%2e/"),
            format!("{origin}/privacy/..%2fapi"),
            format!("{origin}/privacy/%2F%2F{OTHER}/"),
            format!("{origin}/privacy/he%00/"),
            format!("{origin}/%70rivacy/"),
            format!("{origin}%2Fprivacy/"),
            format!("https://{}/privacy/", host.replace('.', "%2E")),
            format!("{origin}/privacy/../api/auth/"),
            format!("{origin}/privacy/./"),
            format!("{origin}/privacy/.."),
            format!("{origin}/privacy/he/../../api/"),
            format!("{origin}/privacy/index.html"),
            format!("{origin}/privacy\\..\\api\\"),
            format!("{origin}\\privacy\\"),
            format!("{origin}/privacy/he\\"),
            // Whitespace, control characters and look-alike letters.
            format!(" {origin}/privacy/"),
            format!("{origin}/privacy/ "),
            format!("{origin}/privacy/\n"),
            format!("{origin}/privacy/\t/"),
            format!("{origin}/pri\u{0}vacy/"),
            format!("{origin}/privacy/h\u{0435}/"),
            format!("{origin}/privacy/\u{2215}{OTHER}/"),
            format!("{origin}/privacy/{}/", "a".repeat(MAX_URL_LEN)),
        ] {
            assert_refused(&url);
        }
    }

    #[test]
    fn refuses_other_paths_queries_and_fragments() {
        let origin = origin();
        for url in [
            origin.clone(),
            format!("{origin}/"),
            format!("{origin}/privacy"),
            format!("{origin}/delete-account"),
            format!("{origin}/privacyX/"),
            format!("{origin}/privacy-policy/"),
            format!("{origin}/delete-account-now/"),
            format!("{origin}/Privacy/"),
            format!("{origin}//privacy/"),
            format!("{origin}/privacy//"),
            format!("{origin}/privacy//{OTHER}/"),
            format!("{origin}/privacy/he//"),
            format!("{origin}/api/auth/delete-account"),
            format!("{origin}/api/privacy/"),
            format!("{origin}/index.html"),
            format!("{origin}/privacy/?next={OTHER}"),
            format!("{origin}/privacy/he/?x=1"),
            format!("{origin}/privacy/#top"),
            format!("{origin}/privacy/he/#top"),
            format!("{origin}/privacy/he;x/"),
        ] {
            assert_refused(&url);
        }
    }

    #[test]
    fn refuses_javascript_file_and_local_paths() {
        let host = host();
        for url in [
            "javascript:alert(1)".to_string(),
            "JavaScript:alert(document.cookie)".to_string(),
            format!("javascript://{host}/privacy/%0aalert(1)"),
            "file:///C:/Windows/System32/calc.exe".to_string(),
            format!("file://{host}/privacy/"),
            "file:C:/Windows/notepad.exe".to_string(),
            "C:\\Windows\\System32\\calc.exe".to_string(),
            "calc.exe".to_string(),
            format!("\\\\{host}\\privacy\\"),
            format!("\\\\{OTHER}\\share\\run.exe"),
            "shell:startup".to_string(),
            "/privacy/".to_string(),
            String::new(),
        ] {
            assert_refused(&url);
        }
    }

    #[test]
    fn shell_execute_answers_are_read_as_documented() {
        assert_eq!(shell_execute_outcome(33), Ok(()));
        assert_eq!(shell_execute_outcome(42), Ok(()));
        for code in [0, 2, 3, 5, 8, 11, 26, 27, 28, 29, 30, 31, 32, -1] {
            let error = shell_execute_outcome(code).expect_err("an error code");
            assert!(error.contains(&format!("ShellExecute error {code}")), "{error}");
        }
        assert!(shell_execute_outcome(31).unwrap_err().contains("no program is set to open web addresses"));
    }

    #[test]
    fn the_frontend_calls_this_command_for_the_same_pages() {
        // src/components/legal/PrivacyPolicyLink.tsx - the page that invokes the command.
        let frontend = include_str!("../../src/components/legal/PrivacyPolicyLink.tsx");
        assert!(frontend.contains("invoke('open_external_url', { url })"), "PrivacyPolicyLink.tsx invokes open_external_url");
        assert!(frontend.contains("page: 'privacy' | 'delete-account'"), "the same two legal pages");
        assert!(!frontend.contains("plugin:opener"), "the shell has no opener plugin");
        assert_eq!(LEGAL_PAGE_PREFIXES, ["/privacy/", "/delete-account/"]);
    }
}
