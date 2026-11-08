package com.mydiary.app.plugins;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.DocumentsContract;
import android.provider.OpenableColumns;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.HashMap;
import java.util.Map;
import org.json.JSONObject;

/**
 * Files between the WebView and Android (docs/ANDROID-PLAN.md, WP-7). JavaScript side:
 * mobile/plugins/diary-files/index.ts; the chunking logic: mobile/platform/files.ts.
 *
 * - "Save to device": ACTION_CREATE_DOCUMENT (Storage Access Framework) - the user picks the place,
 *   the app needs no storage permission, and writes through the content resolver.
 * - "Choose backup file": ACTION_OPEN_DOCUMENT - the chosen file is described (`openDocument`) and
 *   then read through `openRead` / `readChunk` like an opened file.
 * - "Open with Your Personal Diary": the VIEW intent of a .mpd file (manifest intent filters) is
 *   kept here until the UI takes it (`takeOpenedFile`), and announced with the `openFile` event
 *   when it arrives while the app runs (singleTask: onNewIntent). The file is then read through
 *   `openRead` / `readChunk`.
 *
 * Streams are opened once and addressed by a handle; each bridge call carries one base64 chunk, so
 * a multi-megabyte backup never crosses the bridge as a single string. Plugin methods run on
 * Capacitor's background handler thread, so the blocking I/O here never stalls the UI thread.
 * This class opens no network connection (scripts/check-no-network.mjs scans it).
 */
@CapacitorPlugin(name = "DiaryFiles")
public class DiaryFilesPlugin extends Plugin {

    private static final String DEFAULT_MIME = "application/octet-stream";
    /** Largest base64 chunk a single `readChunk` returns (bytes before encoding). */
    private static final int MAX_READ_BYTES = 4 * 1024 * 1024;

    private final Map<Integer, OutputStream> writers = new HashMap<>();
    private final Map<Integer, InputStream> readers = new HashMap<>();
    private final Map<Integer, Uri> writerUris = new HashMap<>();
    private int nextHandle = 1;

    /** The VIEW intent nobody took yet. */
    private JSObject pendingOpen;
    private int openSeq = 0;

    // ----------------------------------------------------------------------------------------
    // "Open with": the VIEW intent
    // ----------------------------------------------------------------------------------------

    @Override
    public void load() {
        Activity activity = getActivity();
        if (activity != null) {
            rememberViewIntent(activity.getIntent(), false);
        }
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        rememberViewIntent(intent, true);
    }

    private synchronized void rememberViewIntent(Intent intent, boolean announce) {
        if (intent == null || !Intent.ACTION_VIEW.equals(intent.getAction()) || intent.getData() == null) {
            return;
        }
        Uri uri = intent.getData();
        // Consumed: a recreated activity must not deliver the same file again.
        intent.setData(null);
        intent.setAction(Intent.ACTION_MAIN);

        JSObject file = describe(uri);
        file.put("seq", ++openSeq);
        pendingOpen = file;
        if (announce) {
            notifyListeners("openFile", file, false);
        }
    }

    @PluginMethod
    public void takeOpenedFile(PluginCall call) {
        JSObject result = new JSObject();
        synchronized (this) {
            result.put("file", pendingOpen == null ? JSONObject.NULL : pendingOpen);
            pendingOpen = null;
        }
        call.resolve(result);
    }

    /** Display name and size of a content / file URI (what the provider reports; nulls when it does not). */
    private JSObject describe(Uri uri) {
        String name = null;
        Long size = null;
        if (ContentResolver.SCHEME_CONTENT.equals(uri.getScheme())) {
            try (Cursor cursor = getContext().getContentResolver().query(uri, null, null, null, null)) {
                if (cursor != null && cursor.moveToFirst()) {
                    int nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                    int sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE);
                    if (nameIndex >= 0) {
                        name = cursor.getString(nameIndex);
                    }
                    if (sizeIndex >= 0 && !cursor.isNull(sizeIndex)) {
                        size = cursor.getLong(sizeIndex);
                    }
                }
            } catch (RuntimeException ignored) {
                // A provider that refuses the query: the name falls back to the path below.
            }
        }
        if (name == null || name.isEmpty()) {
            name = uri.getLastPathSegment();
            if (name != null && name.contains("/")) {
                name = name.substring(name.lastIndexOf('/') + 1);
            }
        }
        JSObject file = new JSObject();
        file.put("uri", uri.toString());
        file.put("name", name == null || name.isEmpty() ? "backup.mpd" : name);
        file.put("size", size == null ? JSONObject.NULL : size);
        return file;
    }

    // ----------------------------------------------------------------------------------------
    // "Save to device": ACTION_CREATE_DOCUMENT + a chunked write stream
    // ----------------------------------------------------------------------------------------

    @PluginMethod
    public void createDocument(PluginCall call) {
        String name = call.getString("name");
        if (name == null || name.isEmpty()) {
            call.reject("name is required");
            return;
        }
        String mime = call.getString("mime", DEFAULT_MIME);
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(mime == null || mime.isEmpty() ? DEFAULT_MIME : mime);
        intent.putExtra(Intent.EXTRA_TITLE, name);
        startActivityForResult(call, intent, "createDocumentResult");
    }

    @ActivityCallback
    private void createDocumentResult(PluginCall call, ActivityResult result) {
        if (call == null) {
            return;
        }
        JSObject out = new JSObject();
        Intent data = result.getData();
        if (result.getResultCode() != Activity.RESULT_OK || data == null || data.getData() == null) {
            out.put("uri", JSONObject.NULL);
        } else {
            out.put("uri", data.getData().toString());
        }
        call.resolve(out);
    }

    // ----------------------------------------------------------------------------------------
    // "Choose backup file": ACTION_OPEN_DOCUMENT (instead of the WebView's <input type="file">
    // chooser, which the JavaScript side cannot tell apart from leaving the app - WP-9 lock)
    // ----------------------------------------------------------------------------------------

    @PluginMethod
    public void openDocument(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        // Every type: the .mpd format has no registered MIME type, providers call it
        // application/octet-stream or nothing at all. The restore card inspects what was chosen.
        intent.setType("*/*");
        startActivityForResult(call, intent, "openDocumentResult");
    }

    @ActivityCallback
    private void openDocumentResult(PluginCall call, ActivityResult result) {
        if (call == null) {
            return;
        }
        JSObject out = new JSObject();
        Intent data = result.getData();
        if (result.getResultCode() != Activity.RESULT_OK || data == null || data.getData() == null) {
            out.put("file", JSONObject.NULL);
        } else {
            out.put("file", describe(data.getData()));
        }
        call.resolve(out);
    }

    @PluginMethod
    public void openWrite(PluginCall call) {
        String uriText = call.getString("uri");
        if (uriText == null) {
            call.reject("uri is required");
            return;
        }
        Uri uri = Uri.parse(uriText);
        try {
            // "wt": write + truncate, so a document chosen twice does not keep old bytes at its end.
            OutputStream stream = getContext().getContentResolver().openOutputStream(uri, "wt");
            if (stream == null) {
                call.reject("the document cannot be opened for writing");
                return;
            }
            int handle;
            synchronized (this) {
                handle = nextHandle++;
                writers.put(handle, stream);
                writerUris.put(handle, uri);
            }
            JSObject out = new JSObject();
            out.put("handle", handle);
            call.resolve(out);
        } catch (IOException | SecurityException | IllegalArgumentException e) {
            call.reject("the document cannot be opened for writing: " + e.getMessage());
        }
    }

    @PluginMethod
    public void writeChunk(PluginCall call) {
        Integer handle = call.getInt("handle");
        String data = call.getString("data");
        OutputStream stream = handle == null ? null : writers.get(handle);
        if (stream == null) {
            call.reject("unknown write handle");
            return;
        }
        if (data == null) {
            call.reject("data is required");
            return;
        }
        try {
            byte[] bytes = Base64.decode(data, Base64.NO_WRAP);
            stream.write(bytes);
            call.resolve();
        } catch (IOException | IllegalArgumentException e) {
            call.reject("write failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void closeWrite(PluginCall call) {
        Integer handle = call.getInt("handle");
        boolean abort = Boolean.TRUE.equals(call.getBoolean("abort", false));
        OutputStream stream;
        Uri uri;
        synchronized (this) {
            stream = handle == null ? null : writers.remove(handle);
            uri = handle == null ? null : writerUris.remove(handle);
        }
        if (stream == null) {
            call.reject("unknown write handle");
            return;
        }
        try {
            stream.flush();
            stream.close();
        } catch (IOException e) {
            if (!abort) {
                call.reject("close failed: " + e.getMessage());
                return;
            }
        }
        if (abort && uri != null && DocumentsContract.isDocumentUri(getContext(), uri)) {
            try {
                // Best effort: a half-written backup must not stay behind as a valid-looking file.
                DocumentsContract.deleteDocument(getContext().getContentResolver(), uri);
            } catch (Exception ignored) {
                // Some providers do not support deletion; the user sees an incomplete file then.
            }
        }
        call.resolve();
    }

    // ----------------------------------------------------------------------------------------
    // Reading an opened file in chunks
    // ----------------------------------------------------------------------------------------

    @PluginMethod
    public void openRead(PluginCall call) {
        String uriText = call.getString("uri");
        if (uriText == null) {
            call.reject("uri is required");
            return;
        }
        Uri uri = Uri.parse(uriText);
        try {
            InputStream stream = getContext().getContentResolver().openInputStream(uri);
            if (stream == null) {
                call.reject("the file cannot be opened for reading");
                return;
            }
            int handle;
            synchronized (this) {
                handle = nextHandle++;
                readers.put(handle, stream);
            }
            JSObject described = describe(uri);
            JSObject out = new JSObject();
            out.put("handle", handle);
            out.put("name", described.get("name"));
            out.put("size", described.get("size"));
            call.resolve(out);
        } catch (IOException | SecurityException | IllegalArgumentException | org.json.JSONException e) {
            call.reject("the file cannot be opened for reading: " + e.getMessage());
        }
    }

    @PluginMethod
    public void readChunk(PluginCall call) {
        Integer handle = call.getInt("handle");
        Integer length = call.getInt("length");
        InputStream stream = handle == null ? null : readers.get(handle);
        if (stream == null) {
            call.reject("unknown read handle");
            return;
        }
        int wanted = length == null || length <= 0 ? 768 * 1024 : Math.min(length, MAX_READ_BYTES);
        byte[] buffer = new byte[wanted];
        int filled = 0;
        boolean done = false;
        try {
            while (filled < wanted) {
                int n = stream.read(buffer, filled, wanted - filled);
                if (n < 0) {
                    done = true;
                    break;
                }
                filled += n;
            }
        } catch (IOException e) {
            call.reject("read failed: " + e.getMessage());
            return;
        }
        JSObject out = new JSObject();
        out.put("data", filled == 0 ? "" : Base64.encodeToString(buffer, 0, filled, Base64.NO_WRAP));
        out.put("done", done);
        call.resolve(out);
    }

    @PluginMethod
    public void closeRead(PluginCall call) {
        Integer handle = call.getInt("handle");
        InputStream stream;
        synchronized (this) {
            stream = handle == null ? null : readers.remove(handle);
        }
        if (stream != null) {
            try {
                stream.close();
            } catch (IOException ignored) {
                // Nothing left to do with a reader that failed to close.
            }
        }
        call.resolve();
    }
}
