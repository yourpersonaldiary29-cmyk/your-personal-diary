// Your Personal Diary - the iOS side of the local Capacitor plugin `DiaryFiles`.
//
// STATUS: DRAFT, NEVER COMPILED. Written on Windows (docs/APPLE-PLAN.md WP-A2), where no Swift
// compiler and no iOS SDK exist. The first Mac build compiles, reviews and tests it (WP-I2,
// scripts/ios/README.he.md). Every UIKit behaviour this file relies on is listed at the end of
// this header as a check for a real iPhone.
//
// JavaScript contract: mobile/plugins/diary-files/index.ts; the chunking and the order of the
// calls: mobile/platform/files.ts (`saveToDeviceIos`, `pickFile`, `readOpenedFile`,
// `watchOpenedFiles`). Android side: android/app/src/main/java/com/mydiary/app/plugins/DiaryFilesPlugin.java.
//
// - "Save to device". iOS has no "save as" dialog for a file that does not exist yet, so the order
//   differs from Android: `createDocument` makes an empty temporary file inside the app
//   (tmp/diary-export/<uuid>/<name>) and answers its file URL at once; the chunks are appended to
//   it; `closeWrite` presents the export sheet (UIDocumentPickerViewController, forExporting, as a
//   copy) and resolves when it is gone - `cancelled: true` when the user dismissed it. The temporary
//   file is deleted in every outcome. `abort` deletes it without showing anything.
// - "Choose backup file": the open sheet over every data file, as a copy (the system puts the copy
//   in the app's own temporary inbox, so no security-scoped access outlives the call). The chosen
//   file is described and then read through `openRead` / `readChunk`; the copy is deleted when the
//   read stream is closed.
// - "Open with Your Personal Diary": the file URL arrives through Capacitor's open-URL notification
//   (the scene delegate of the generated project forwards it); it is kept until the UI takes it
//   (`takeOpenedFile`) and announced with the `openFile` event, numbered with `seq` like the
//   Android intent. With LSSupportsOpeningDocumentsInPlace = NO (scripts/ios/README.he.md) the
//   system hands over a COPY in Documents/Inbox; it is deleted when its read stream is closed, and
//   copies an earlier run left behind are removed shortly after start - a backup file must not sit
//   in Documents, which iCloud and computer backups copy.
//
// What may be read or written: only what this plugin handed out. `openWrite` accepts the URIs of
// `createDocument`, `openRead` the URIs of the open sheet and of "open with" - nothing else, so the
// page cannot use these calls to reach other files of the app.
//
// Streams are opened once and addressed by a handle; each call carries one base64 chunk. Plugin
// methods arrive on a background queue, UIKit runs on the main one: shared state is guarded by a
// lock, the two "dialog in progress" fields belong to the main thread.
//
// Checks for the Mac (WP-I2): the export sheet appears above the web view on iPhone and iPad;
// didPickDocumentsAt fires after the copy exists; swiping the sheet down counts as cancelled exactly
// once; a 10 MB backup saves and restores byte for byte; a .mpd opened from Files and from Mail
// reaches the Restore card on a cold start and while the app runs; no copy stays in Documents/Inbox
// or tmp afterwards; `lock when I leave` does not fire under either sheet (they are presented
// inside the app - mobile/platform/lifecycle.ts relies on it).
//
// Opens no network connection (mobile/test/ios-prep.test.ts scans this file).

import Capacitor
import Foundation
import UIKit
import UniformTypeIdentifiers

@objc(DiaryFilesPlugin)
public class DiaryFilesPlugin: CAPPlugin, CAPBridgedPlugin, UIDocumentPickerDelegate, UIAdaptivePresentationControllerDelegate {
    public let identifier = "DiaryFilesPlugin"
    public let jsName = "DiaryFiles"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "createDocument", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openDocument", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openWrite", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "writeChunk", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "closeWrite", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "takeOpenedFile", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openRead", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "readChunk", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "closeRead", returnType: CAPPluginReturnPromise)
    ]

    /// Bytes per `readChunk` when the caller names none (the size mobile/platform/files.ts uses).
    static let defaultReadBytes = 768 * 1024
    /// Largest chunk a single `readChunk` returns (bytes before encoding), as on Android.
    static let maxReadBytes = 4 * 1024 * 1024
    static let exportFolderName = "diary-export"
    static let fallbackName = "backup.mpd"
    /// How long after start the copies an earlier run left in Documents/Inbox are removed.
    static let inboxSweepDelay: TimeInterval = 30

    private struct Writer {
        let handle: FileHandle
        let file: URL
    }

    private struct Reader {
        let handle: FileHandle
        let file: URL
        let scoped: Bool
    }

    private let lock = NSLock()
    private var nextHandle = 1
    private var writers: [Int: Writer] = [:]
    private var readers: [Int: Reader] = [:]
    /// The temporary files of `createDocument`, by the URI it answered.
    private var exports: [String: URL] = [:]
    /// The files the system handed over (open sheet, "open with"), by the URI answered.
    private var readable: [String: URL] = [:]
    /// The "open with" file nobody took yet, and the counter of the deliveries.
    private var pendingOpen: [String: Any]?
    private var openSeq = 0

    /// Main thread: the sheet that is open now - at most one of the two.
    private var exportInProgress: (call: CAPPluginCall, file: URL)?
    private var pickInProgress: CAPPluginCall?
    /// Main thread: what Documents/Inbox held when the plugin loaded.
    private var inboxAtLoad: [URL] = []
    private var openObserver: NSObjectProtocol?

    override public func load() {
        openObserver = NotificationCenter.default.addObserver(forName: Notification.Name.capacitorOpenURL, object: nil, queue: OperationQueue.main) { [weak self] notification in
            self?.rememberOpenedFile(notification)
        }
        // An export nobody finished (the app was closed under the sheet).
        try? FileManager.default.removeItem(at: DiaryFilesPlugin.exportFolder())
        inboxAtLoad = DiaryFilesPlugin.inboxFiles()
        DispatchQueue.main.asyncAfter(deadline: .now() + DiaryFilesPlugin.inboxSweepDelay) { [weak self] in
            self?.sweepInbox()
        }
    }

    deinit {
        if let observer = openObserver {
            NotificationCenter.default.removeObserver(observer)
        }
    }

    // ---------------------------------------------------------------------------------------
    // "Open with": the open-URL notification of Capacitor
    // ---------------------------------------------------------------------------------------

    /// Main thread. A cold start delivers its file here too, after the first screen appeared.
    private func rememberOpenedFile(_ notification: Notification) {
        // The payload Capacitor posts: ["url": NSURL, "options": ...] (as its own App plugin reads it).
        guard let object = notification.object as? [String: Any?], let opened = object["url"] as? NSURL else {
            return
        }
        let url = opened as URL
        // A file, not a link: custom URL schemes and web links are none of this plugin's business.
        guard url.isFileURL else {
            return
        }
        var file = DiaryFilesPlugin.describe(url)
        lock.lock()
        openSeq += 1
        file["seq"] = openSeq
        pendingOpen = file
        readable[url.absoluteString] = url
        lock.unlock()
        notifyListeners("openFile", data: file)
    }

    @objc func takeOpenedFile(_ call: CAPPluginCall) {
        lock.lock()
        let file = pendingOpen
        pendingOpen = nil
        lock.unlock()
        if let file = file {
            call.resolve(["file": file])
        } else {
            call.resolve(["file": NSNull()])
        }
    }

    /// Main thread, once per run: removes the Inbox copies that were there at start and that this
    /// run did not hand to the UI. The file a cold start was opened with is in that listing too,
    /// but it was delivered (and so registered in `readable`) long before this runs.
    private func sweepInbox() {
        lock.lock()
        let delivered = Set(readable.values.map { DiaryFilesPlugin.comparablePath($0) })
        lock.unlock()
        for file in inboxAtLoad where !delivered.contains(DiaryFilesPlugin.comparablePath(file)) {
            try? FileManager.default.removeItem(at: file)
        }
        inboxAtLoad = []
    }

    // ---------------------------------------------------------------------------------------
    // "Save to device": a temporary file, a chunked write stream, the export sheet at the end
    // ---------------------------------------------------------------------------------------

    @objc func createDocument(_ call: CAPPluginCall) {
        guard let rawName = call.getString("name"), !rawName.isEmpty else {
            call.reject("name is required")
            return
        }
        // `mime` is Android's: iOS derives the type from the file name.
        let folder = DiaryFilesPlugin.exportFolder().appendingPathComponent(UUID().uuidString, isDirectory: true)
        let file = folder.appendingPathComponent(DiaryFilesPlugin.safeFileName(rawName), isDirectory: false)
        do {
            try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true, attributes: nil)
            guard FileManager.default.createFile(atPath: file.path, contents: nil, attributes: nil) else {
                throw CocoaError(.fileWriteUnknown)
            }
        } catch {
            // The contract's "nothing to write to": the caller reports a cancelled save.
            call.resolve(["uri": NSNull()])
            return
        }
        lock.lock()
        exports[file.absoluteString] = file
        lock.unlock()
        call.resolve(["uri": file.absoluteString])
    }

    @objc func openWrite(_ call: CAPPluginCall) {
        guard let uri = call.getString("uri") else {
            call.reject("uri is required")
            return
        }
        lock.lock()
        let known = exports[uri]
        lock.unlock()
        guard let file = known else {
            call.reject("the document cannot be opened for writing")
            return
        }
        do {
            let handle = try FileHandle(forWritingTo: file)
            // Truncated, so a document opened twice does not keep old bytes at its end.
            try handle.truncate(atOffset: 0)
            lock.lock()
            let id = nextHandle
            nextHandle += 1
            writers[id] = Writer(handle: handle, file: file)
            lock.unlock()
            call.resolve(["handle": id])
        } catch {
            call.reject("the document cannot be opened for writing: \(error.localizedDescription)")
        }
    }

    @objc func writeChunk(_ call: CAPPluginCall) {
        lock.lock()
        let known = call.getInt("handle").flatMap { writers[$0] }
        lock.unlock()
        guard let writer = known else {
            call.reject("unknown write handle")
            return
        }
        guard let text = call.getString("data"), let bytes = Data(base64Encoded: text) else {
            call.reject("data is required")
            return
        }
        do {
            try writer.handle.write(contentsOf: bytes)
            call.resolve()
        } catch {
            call.reject("write failed: \(error.localizedDescription)")
        }
    }

    @objc func closeWrite(_ call: CAPPluginCall) {
        let abort = call.getBool("abort", false)
        lock.lock()
        let known = call.getInt("handle").flatMap { writers.removeValue(forKey: $0) }
        lock.unlock()
        guard let writer = known else {
            call.reject("unknown write handle")
            return
        }
        do {
            try writer.handle.close()
        } catch {
            discardExport(writer.file)
            if abort {
                call.resolve()
            } else {
                call.reject("close failed: \(error.localizedDescription)")
            }
            return
        }
        if abort {
            // A half-written backup must not stay behind as a valid-looking file.
            discardExport(writer.file)
            call.resolve()
            return
        }
        DispatchQueue.main.async { [weak self] in
            self?.presentExport(of: writer.file, for: call)
        }
    }

    /// Main thread.
    private func presentExport(of file: URL, for call: CAPPluginCall) {
        guard exportInProgress == nil, pickInProgress == nil, let presenter = topViewController() else {
            discardExport(file)
            call.reject("the save dialog cannot be shown now")
            return
        }
        let sheet = UIDocumentPickerViewController(forExporting: [file], asCopy: true)
        sheet.delegate = self
        sheet.presentationController?.delegate = self
        exportInProgress = (call, file)
        presenter.present(sheet, animated: true, completion: nil)
    }

    private func discardExport(_ file: URL) {
        lock.lock()
        exports.removeValue(forKey: file.absoluteString)
        lock.unlock()
        // The file and its <uuid> folder.
        try? FileManager.default.removeItem(at: file.deletingLastPathComponent())
    }

    // ---------------------------------------------------------------------------------------
    // "Choose backup file": the open sheet (instead of the web view's <input type="file">, whose
    // chooser the JavaScript side cannot tell apart from leaving the app on Android)
    // ---------------------------------------------------------------------------------------

    @objc func openDocument(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let plugin = self else {
                return
            }
            guard plugin.exportInProgress == nil, plugin.pickInProgress == nil, let presenter = plugin.topViewController() else {
                call.reject("the open dialog cannot be shown now")
                return
            }
            // Every flat file: the .mpd format has no registered type, the Restore card inspects what was chosen.
            let sheet = UIDocumentPickerViewController(forOpeningContentTypes: [UTType.data], asCopy: true)
            sheet.allowsMultipleSelection = false
            sheet.delegate = plugin
            sheet.presentationController?.delegate = plugin
            plugin.pickInProgress = call
            presenter.present(sheet, animated: true, completion: nil)
        }
    }

    // UIDocumentPickerDelegate - main thread.

    public func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        if let export = exportInProgress {
            exportInProgress = nil
            discardExport(export.file)
            export.call.resolve(["cancelled": false])
            return
        }
        guard let call = pickInProgress else {
            return
        }
        pickInProgress = nil
        guard let url = urls.first else {
            call.resolve(["file": NSNull()])
            return
        }
        lock.lock()
        readable[url.absoluteString] = url
        lock.unlock()
        call.resolve(["file": DiaryFilesPlugin.describe(url)])
    }

    public func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        finishCancelled()
    }

    // UIAdaptivePresentationControllerDelegate - main thread: the sheet swiped down.

    public func presentationControllerDidDismiss(_ presentationController: UIPresentationController) {
        finishCancelled()
    }

    /// Main thread. Safe to call twice: whatever was waiting is answered once.
    private func finishCancelled() {
        if let export = exportInProgress {
            exportInProgress = nil
            discardExport(export.file)
            export.call.resolve(["cancelled": true])
        }
        if let call = pickInProgress {
            pickInProgress = nil
            call.resolve(["file": NSNull()])
        }
    }

    /// Main thread: the controller a sheet is presented from (above anything already presented).
    private func topViewController() -> UIViewController? {
        var top = bridge?.viewController
        while let presented = top?.presentedViewController {
            top = presented
        }
        return top
    }

    // ---------------------------------------------------------------------------------------
    // Reading a file the system handed over, in chunks
    // ---------------------------------------------------------------------------------------

    @objc func openRead(_ call: CAPPluginCall) {
        guard let uri = call.getString("uri") else {
            call.reject("uri is required")
            return
        }
        lock.lock()
        let known = readable[uri]
        lock.unlock()
        guard let file = known else {
            call.reject("the file cannot be opened for reading")
            return
        }
        // False for the copies this plugin normally gets; true for a file opened in place.
        let scoped = file.startAccessingSecurityScopedResource()
        do {
            let handle = try FileHandle(forReadingFrom: file)
            lock.lock()
            let id = nextHandle
            nextHandle += 1
            readers[id] = Reader(handle: handle, file: file, scoped: scoped)
            lock.unlock()
            call.resolve(["handle": id, "name": DiaryFilesPlugin.displayName(file), "size": DiaryFilesPlugin.sizeValue(file)])
        } catch {
            if scoped {
                file.stopAccessingSecurityScopedResource()
            }
            call.reject("the file cannot be opened for reading: \(error.localizedDescription)")
        }
    }

    @objc func readChunk(_ call: CAPPluginCall) {
        lock.lock()
        let known = call.getInt("handle").flatMap { readers[$0] }
        lock.unlock()
        guard let reader = known else {
            call.reject("unknown read handle")
            return
        }
        let asked = call.getInt("length") ?? 0
        let wanted = asked <= 0 ? DiaryFilesPlugin.defaultReadBytes : min(asked, DiaryFilesPlugin.maxReadBytes)
        var buffer = Data()
        var done = false
        do {
            while buffer.count < wanted {
                guard let part = try reader.handle.read(upToCount: wanted - buffer.count), !part.isEmpty else {
                    done = true
                    break
                }
                buffer.append(part)
            }
        } catch {
            call.reject("read failed: \(error.localizedDescription)")
            return
        }
        // `done` once the end was reached; the last chunk may be empty (as on Android).
        call.resolve(["data": buffer.base64EncodedString(), "done": done])
    }

    @objc func closeRead(_ call: CAPPluginCall) {
        lock.lock()
        let known = call.getInt("handle").flatMap { readers.removeValue(forKey: $0) }
        lock.unlock()
        if let reader = known {
            try? reader.handle.close()
            if reader.scoped {
                reader.file.stopAccessingSecurityScopedResource()
            }
            // The copy the system made for this app was read: it must not stay behind. A file
            // outside the app's own temporary / Inbox folders is the user's and is never touched.
            if DiaryFilesPlugin.isDisposableCopy(reader.file) {
                try? FileManager.default.removeItem(at: reader.file)
                lock.lock()
                readable.removeValue(forKey: reader.file.absoluteString)
                lock.unlock()
            }
        }
        call.resolve()
    }

    // ---------------------------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------------------------

    static func exportFolder() -> URL {
        return FileManager.default.temporaryDirectory.appendingPathComponent(exportFolderName, isDirectory: true)
    }

    static func inboxFolder() -> URL? {
        return FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first?.appendingPathComponent("Inbox", isDirectory: true)
    }

    static func inboxFiles() -> [URL] {
        guard let inbox = inboxFolder() else {
            return []
        }
        return (try? FileManager.default.contentsOfDirectory(at: inbox, includingPropertiesForKeys: nil, options: [])) ?? []
    }

    /// One spelling per file: /private/var/... and /var/... are the same place on iOS.
    static func comparablePath(_ url: URL) -> String {
        return url.standardizedFileURL.resolvingSymlinksInPath().path
    }

    /// True for a file inside the app's temporary folder or Documents/Inbox - a copy the system
    /// (or this plugin) made for the app, which the app may delete.
    static func isDisposableCopy(_ url: URL) -> Bool {
        let path = comparablePath(url)
        var roots = [FileManager.default.temporaryDirectory]
        if let inbox = inboxFolder() {
            roots.append(inbox)
        }
        for root in roots {
            let prefix = comparablePath(root)
            if path.hasPrefix(prefix.hasSuffix("/") ? prefix : prefix + "/") {
                return true
            }
        }
        return false
    }

    static func displayName(_ url: URL) -> String {
        let name = url.lastPathComponent
        return name.isEmpty ? fallbackName : name
    }

    /// The size in bytes, or null when the system does not report it.
    static func sizeValue(_ url: URL) -> Any {
        if let size = (try? url.resourceValues(forKeys: [.fileSizeKey]))?.fileSize {
            return size
        }
        return NSNull()
    }

    /// `PickedFile` of the contract: uri, name, size.
    static func describe(_ url: URL) -> [String: Any] {
        return ["uri": url.absoluteString, "name": displayName(url), "size": sizeValue(url)]
    }

    /// The name of the temporary file - what the export sheet offers as the file's name. Path
    /// separators and control characters are replaced; a name that is nothing but dots becomes "file".
    static func safeFileName(_ raw: String) -> String {
        var kept = String.UnicodeScalarView()
        for scalar in raw.unicodeScalars {
            if scalar == "/" || scalar == ":" || scalar.value < 0x20 || (scalar.value >= 0x7F && scalar.value <= 0x9F) {
                kept.append("_")
            } else {
                kept.append(scalar)
            }
        }
        var name = String(kept).trimmingCharacters(in: .whitespacesAndNewlines)
        while name.hasPrefix(".") {
            name.removeFirst()
        }
        return name.isEmpty ? "file" : name
    }
}
