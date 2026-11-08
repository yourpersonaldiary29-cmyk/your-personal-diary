; Your Personal Diary - NSIS installer hooks (tauri.conf.json: bundle.windows.nsis.installerHooks).
; Keep this file plain ASCII without a BOM.
;
; Tauri includes this file near the top of its installer.nsi, before the languages are loaded.
; The !defines below are therefore seen by MUI_LANGDLL_DISPLAY in .onInit, and the macros are
; expanded later inside the install / uninstall sections, where the ${LANG_*} ids exist.

; Show the language selector on every run of the installer. Without this, NSIS skips the dialog
; once a previous install remembered a language in the registry (HKCU\Software\AVI\Your Personal
; Diary, "Installer Language"), so a reinstall could never pick another language. The remembered
; language is still pre-selected.
!define MUI_LANGDLL_ALWAYSSHOW

; List all 20 languages whatever the Windows ANSI code page is (by default the selector hides
; languages whose code page differs from the system one; this installer is Unicode).
!define MUI_LANGDLL_ALLLANGUAGES

; The published app is a thin client of the Your Personal Diary server (docs/android-tasks/
; HOSTED-IMPL.md items 8 and 10): this installer holds the shell only. Earlier versions also
; installed a local server next to it - the Node.js runtime as diary-server.exe (externalBin) and
; the server files under server\ (bundle.resources). Installing this version over such an
; installation without uninstalling it first (the default "Add/Reinstall" choice when the version
; number is the same) would leave those files behind for good, because this version's uninstaller
; does not know them. Remove exactly the files the old installer put there - only when its sidecar
; is present, and never a whole folder: anything else found in server\ stays, and so does server\.
!macro MPD_REMOVE_LEGACY_SERVER
  ${If} ${FileExists} "$INSTDIR\diary-server.exe"
  ${OrIf} ${FileExists} "$INSTDIR\server\server.cjs"
    Delete "$INSTDIR\server\server.cjs"
    Delete "$INSTDIR\server\sql-wasm.wasm"
    Delete "$INSTDIR\server\.keep"
    Delete "$INSTDIR\server\fonts\*.ttf"
    Delete "$INSTDIR\server\fonts\LICENSE-DejaVu.txt"
    Delete "$INSTDIR\server\fonts\OFL-*.txt"
    RMDir "$INSTDIR\server\fonts"
    Delete "$INSTDIR\server\pdfkit-data\*.afm"
    Delete "$INSTDIR\server\pdfkit-data\*.icc"
    RMDir "$INSTDIR\server\pdfkit-data"
    Delete "$INSTDIR\server\ui\assets\*.js"
    Delete "$INSTDIR\server\ui\assets\*.css"
    RMDir "$INSTDIR\server\ui\assets"
    Delete "$INSTDIR\server\ui\icons\pwa-*.png"
    RMDir "$INSTDIR\server\ui\icons"
    Delete "$INSTDIR\server\ui\index.html"
    Delete "$INSTDIR\server\ui\favicon.svg"
    Delete "$INSTDIR\server\ui\manifest.webmanifest"
    RMDir "$INSTDIR\server\ui"
    RMDir "$INSTDIR\server"
    ; Last, so that a run interrupted above still recognises the old installation next time.
    Delete "$INSTDIR\diary-server.exe"
  ${EndIf}
!macroend

; After the files are installed: remove the local server of an earlier version (see above), then
; remember the language chosen in the installer as a UI locale code (shared/i18n/locales.ts) in
; $INSTDIR\install-locale.txt. The desktop shell reads it through the get_install_locale command
; (src-tauri/src/lib.rs) and the UI applies it once to the device language
; (src/i18n/install-locale.ts). Accounts keep their own language.
!macro NSIS_HOOK_POSTINSTALL
  !insertmacro MPD_REMOVE_LEGACY_SERVER
  Push $0
  Push $1
  StrCpy $0 "en"
  ${If} $LANGUAGE = ${LANG_HEBREW}
    StrCpy $0 "he"
  ${ElseIf} $LANGUAGE = ${LANG_SIMPCHINESE}
    StrCpy $0 "zh"
  ${ElseIf} $LANGUAGE = ${LANG_SPANISH}
    StrCpy $0 "es"
  ${ElseIf} $LANGUAGE = ${LANG_POLISH}
    StrCpy $0 "pl"
  ${ElseIf} $LANGUAGE = ${LANG_RUSSIAN}
    StrCpy $0 "ru"
  ${ElseIf} $LANGUAGE = ${LANG_FRENCH}
    StrCpy $0 "fr"
  ${ElseIf} $LANGUAGE = ${LANG_ARABIC}
    StrCpy $0 "ar"
  ${ElseIf} $LANGUAGE = ${LANG_JAPANESE}
    StrCpy $0 "ja"
  ${ElseIf} $LANGUAGE = ${LANG_TURKISH}
    StrCpy $0 "tr"
  ${ElseIf} $LANGUAGE = ${LANG_CZECH}
    StrCpy $0 "cs"
  ${ElseIf} $LANGUAGE = ${LANG_HUNGARIAN}
    StrCpy $0 "hu"
  ${ElseIf} $LANGUAGE = ${LANG_BULGARIAN}
    StrCpy $0 "bg"
  ${ElseIf} $LANGUAGE = ${LANG_GREEK}
    StrCpy $0 "el"
  ${ElseIf} $LANGUAGE = ${LANG_PORTUGUESE}
    StrCpy $0 "pt"
  ${ElseIf} $LANGUAGE = ${LANG_GERMAN}
    StrCpy $0 "de"
  ${ElseIf} $LANGUAGE = ${LANG_ROMANIAN}
    StrCpy $0 "ro"
  ${ElseIf} $LANGUAGE = ${LANG_ITALIAN}
    StrCpy $0 "it"
  ${ElseIf} $LANGUAGE = ${LANG_THAI}
    StrCpy $0 "th"
  ${ElseIf} $LANGUAGE = ${LANG_HINDI}
    StrCpy $0 "hi"
  ${ElseIf} $LANGUAGE = ${LANG_ENGLISH}
    StrCpy $0 "en"
  ${EndIf}
  ClearErrors
  FileOpen $1 "$INSTDIR\install-locale.txt" w
  ${IfNot} ${Errors}
    FileWrite $1 "$0"
    FileClose $1
  ${EndIf}
  Pop $1
  Pop $0
!macroend

; After the uninstaller removed the program files: remove the language file and any leftover local
; server of an earlier version too, then the (now empty) install folder that Tauri's own RMDir could
; not remove while those files were still there.
!macro NSIS_HOOK_POSTUNINSTALL
  !insertmacro MPD_REMOVE_LEGACY_SERVER
  Delete "$INSTDIR\install-locale.txt"
  RMDir "$INSTDIR"
!macroend
