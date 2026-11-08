package com.mydiary.app.plugins;

import android.app.Activity;
import android.app.KeyguardManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.hardware.biometrics.BiometricManager;
import android.hardware.biometrics.BiometricPrompt;
import android.os.Build;
import android.os.CancellationSignal;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.InvalidKeyException;
import java.security.KeyStore;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.Executor;
import java.util.regex.Pattern;
import javax.crypto.AEADBadTagException;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/**
 * The Android half of the automatic offline mode (docs/android-tasks/OFFLINE-DESIGN.md sections 5.1
 * and 5.7, WP-H10d). JavaScript side: mobile/plugins/diary-offline/index.ts; the engine's seams it
 * fills (OfflineKeyVault, DeviceUserCheck): mobile/platform/offline.ts. The outbox mirror needs no
 * code here - it is @capacitor/filesystem in Directory.Data.
 *
 * 1. The account offline key (AOK) at rest - wrapKey / unwrapKey / deleteKey. The AOK is generated
 *    and kept by the server; with "Remember me" the engine keeps a wrapped copy in its IndexedDB so
 *    that the app can open without a connection. Wrapping: AES-256-GCM with ONE non-exportable key of
 *    the Android Keystore, alias com.mydiary.app.offline.v1, WITHOUT user-authentication binding (it
 *    must work at app start, before any prompt). The account id is the GCM additional data
 *    ("ypd-offline-v1:" + userId), so a blob moved to another account never unwraps. The blob is
 *    base64 of: version byte 1, the 12-byte IV the Keystore chose, ciphertext and 16-byte tag.
 *    Nothing is stored here except the key itself and the set of account ids that hold a blob (so
 *    that removing one account's key never breaks another's: the alias is deleted with the last one).
 *    Protects against copies of the app's files and forensic images without the secure hardware; a
 *    rooted phone or code running as the app can use the key (the residual risk of section 5.1).
 *
 * 2. Offline unlock - canVerifyUser / verifyUser: the phone's own user check (screen lock PIN,
 *    pattern, password, or a strong biometric). Availability is KeyguardManager.isDeviceSecure().
 *    Android 11+ (API 30): BiometricPrompt with BIOMETRIC_STRONG | DEVICE_CREDENTIAL; Android 10:
 *    BiometricPrompt with setDeviceCredentialAllowed(true); Android 7-9 (API 24-28):
 *    KeyguardManager.createConfirmDeviceCredentialIntent. The answer is one word - "ok", "cancelled",
 *    "failed" or "unavailable" - and it unlocks only the local lock overlay over data already in
 *    memory (section 5.7); nothing derived from the password is stored anywhere.
 *
 * Requires android.permission.USE_BIOMETRIC (declared for DiaryBiometric already). Opens no network
 * connection.
 */
@CapacitorPlugin(name = "DiaryOffline")
public class DiaryOfflinePlugin extends Plugin {

    static final String KEYSTORE = "AndroidKeyStore";
    static final String KEY_ALIAS = "com.mydiary.app.offline.v1";
    static final String PREFS = "diary.offline";
    static final String PREF_WRAPPED_USERS = "wrapped.users";
    private static final String TRANSFORMATION = "AES/GCM/NoPadding";
    private static final String AAD_PREFIX = "ypd-offline-v1:";
    private static final byte BLOB_VERSION = 1;
    private static final int GCM_IV_BYTES = 12;
    private static final int GCM_TAG_BITS = 128;
    private static final int GCM_TAG_BYTES = GCM_TAG_BITS / 8;
    /** The AOK is 32 bytes; a generous bound against nonsense (the Windows commands use the same). */
    private static final int MAX_KEY_BYTES = 4096;
    private static final Pattern USER_ID = Pattern.compile("^u_[0-9a-f]{16}$");

    /** Error codes the JavaScript side maps (mobile/platform/offline.ts). */
    static final String ERR_INPUT = "INVALID_INPUT";
    static final String ERR_KEY_MISSING = "KEY_MISSING";
    static final String ERR_UNWRAP = "UNWRAP_FAILED";
    static final String ERR_KEYSTORE = "KEYSTORE_ERROR";

    static final String RESULT_OK = "ok";
    static final String RESULT_CANCELLED = "cancelled";
    static final String RESULT_FAILED = "failed";
    static final String RESULT_UNAVAILABLE = "unavailable";

    private static final String DEFAULT_TITLE = "Your Personal Diary";
    private static final int MAX_TEXT = 200;

    // ----------------------------------------------------------------------------------------
    // The account offline key
    // ----------------------------------------------------------------------------------------

    @PluginMethod
    public void wrapKey(PluginCall call) {
        String userId = call.getString("userId");
        if (!validUserId(userId)) {
            call.reject("invalid user id", ERR_INPUT);
            return;
        }
        byte[] key = decodeBase64(call.getString("key"));
        if (key == null || key.length == 0 || key.length > MAX_KEY_BYTES) {
            call.reject("invalid key", ERR_INPUT);
            return;
        }
        try {
            String blob = wrap(userId, key);
            JSObject out = new JSObject();
            out.put("blob", blob);
            call.resolve(out);
        } catch (GeneralSecurityException | RuntimeException e) {
            call.reject("the key could not be wrapped", ERR_KEYSTORE);
        } finally {
            Arrays.fill(key, (byte) 0);
        }
    }

    @PluginMethod
    public void unwrapKey(PluginCall call) {
        String userId = call.getString("userId");
        if (!validUserId(userId)) {
            call.reject("invalid user id", ERR_INPUT);
            return;
        }
        byte[] blob = decodeBase64(call.getString("blob"));
        if (blob == null || blob.length < 1 + GCM_IV_BYTES + GCM_TAG_BYTES + 1 || blob[0] != BLOB_VERSION) {
            call.reject("invalid key blob", ERR_INPUT);
            return;
        }
        byte[] plain = null;
        try {
            SecretKey secret = loadKey();
            if (secret == null) {
                call.reject("the device key is gone", ERR_KEY_MISSING);
                return;
            }
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.DECRYPT_MODE, secret, new GCMParameterSpec(GCM_TAG_BITS, blob, 1, GCM_IV_BYTES));
            cipher.updateAAD(aad(userId));
            plain = cipher.doFinal(blob, 1 + GCM_IV_BYTES, blob.length - 1 - GCM_IV_BYTES);
            JSObject out = new JSObject();
            out.put("key", Base64.encodeToString(plain, Base64.NO_WRAP));
            call.resolve(out);
        } catch (AEADBadTagException e) {
            // Another account's blob, a damaged blob, or one wrapped by an earlier device key.
            call.reject("the key blob does not unwrap", ERR_UNWRAP);
        } catch (GeneralSecurityException | RuntimeException e) {
            call.reject("the key could not be unwrapped", ERR_KEYSTORE);
        } finally {
            if (plain != null) {
                Arrays.fill(plain, (byte) 0);
            }
        }
    }

    @PluginMethod
    public void deleteKey(PluginCall call) {
        String userId = call.getString("userId");
        if (!validUserId(userId)) {
            call.reject("invalid user id", ERR_INPUT);
            return;
        }
        forget(userId);
        call.resolve();
    }

    private synchronized String wrap(String userId, byte[] key) throws GeneralSecurityException {
        Cipher cipher = Cipher.getInstance(TRANSFORMATION);
        SecretKey secret = loadKey();
        if (secret == null) {
            secret = createKey();
        }
        try {
            cipher.init(Cipher.ENCRYPT_MODE, secret);
        } catch (InvalidKeyException e) {
            // A key the Keystore can no longer use: replace it. Blobs of other accounts then stop
            // unwrapping - their AOK comes back from the server at the next sign-in, nothing is lost.
            deleteAlias();
            secret = createKey();
            cipher.init(Cipher.ENCRYPT_MODE, secret);
        }
        cipher.updateAAD(aad(userId));
        byte[] sealed = cipher.doFinal(key);
        byte[] iv = cipher.getIV();
        if (iv == null || iv.length != GCM_IV_BYTES) {
            throw new GeneralSecurityException("unexpected IV");
        }
        byte[] blob = new byte[1 + GCM_IV_BYTES + sealed.length];
        blob[0] = BLOB_VERSION;
        System.arraycopy(iv, 0, blob, 1, GCM_IV_BYTES);
        System.arraycopy(sealed, 0, blob, 1 + GCM_IV_BYTES, sealed.length);
        Set<String> users = wrappedUsers();
        if (users.add(userId)) {
            storeWrappedUsers(users);
        }
        return Base64.encodeToString(blob, Base64.NO_WRAP);
    }

    /** The account no longer holds a blob; the alias goes with the last account (a full wipe). */
    private synchronized void forget(String userId) {
        Set<String> users = wrappedUsers();
        users.remove(userId);
        storeWrappedUsers(users);
        if (users.isEmpty()) {
            deleteAlias();
        }
    }

    private static byte[] aad(String userId) {
        return (AAD_PREFIX + userId).getBytes(StandardCharsets.UTF_8);
    }

    private static boolean validUserId(String userId) {
        return userId != null && USER_ID.matcher(userId).matches();
    }

    private static byte[] decodeBase64(String text) {
        if (text == null || text.isEmpty()) {
            return null;
        }
        try {
            return Base64.decode(text, Base64.NO_WRAP);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private SecretKey createKey() throws GeneralSecurityException {
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE);
        KeyGenParameterSpec spec = new KeyGenParameterSpec.Builder(
            KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            // The Keystore picks every IV itself; no user authentication: the key works at app start.
            .setRandomizedEncryptionRequired(true)
            .setUserAuthenticationRequired(false)
            .build();
        generator.init(spec);
        return generator.generateKey();
    }

    private SecretKey loadKey() throws GeneralSecurityException {
        try {
            KeyStore keyStore = KeyStore.getInstance(KEYSTORE);
            keyStore.load(null);
            KeyStore.Entry entry = keyStore.getEntry(KEY_ALIAS, null);
            if (!(entry instanceof KeyStore.SecretKeyEntry)) {
                return null;
            }
            return ((KeyStore.SecretKeyEntry) entry).getSecretKey();
        } catch (java.io.IOException e) {
            throw new GeneralSecurityException(e);
        }
    }

    private void deleteAlias() {
        try {
            KeyStore keyStore = KeyStore.getInstance(KEYSTORE);
            keyStore.load(null);
            if (keyStore.containsAlias(KEY_ALIAS)) {
                keyStore.deleteEntry(KEY_ALIAS);
            }
        } catch (GeneralSecurityException | java.io.IOException | RuntimeException ignored) {
            // A key that cannot be deleted wraps nothing any more: no account holds a blob.
        }
    }

    private Set<String> wrappedUsers() {
        Set<String> stored = prefs().getStringSet(PREF_WRAPPED_USERS, null);
        // A copy: the set SharedPreferences returns must not be modified.
        return stored == null ? new HashSet<>() : new HashSet<>(stored);
    }

    private void storeWrappedUsers(Set<String> users) {
        prefs().edit().putStringSet(PREF_WRAPPED_USERS, users).commit();
    }

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    // ----------------------------------------------------------------------------------------
    // Offline unlock: the phone's own user check
    // ----------------------------------------------------------------------------------------

    private boolean deviceSecure() {
        KeyguardManager keyguard = getContext().getSystemService(KeyguardManager.class);
        return keyguard != null && keyguard.isDeviceSecure();
    }

    /** No UI: whether the phone has a screen lock the user check can ask for. */
    @PluginMethod
    public void canVerifyUser(PluginCall call) {
        JSObject out = new JSObject();
        boolean available;
        try {
            available = deviceSecure();
        } catch (RuntimeException e) {
            available = false;
        }
        out.put("available", available);
        call.resolve(out);
    }

    @PluginMethod
    public void verifyUser(final PluginCall call) {
        final Activity activity = getActivity();
        boolean secure;
        try {
            secure = deviceSecure();
        } catch (RuntimeException e) {
            secure = false;
        }
        if (activity == null || !secure) {
            resolveCheck(call, RESULT_UNAVAILABLE);
            return;
        }
        // One check at a time is the JavaScript side's job (mobile/platform/offline.ts shares the
        // promise of a check in progress); a second BiometricPrompt would cancel the first anyway.
        final String title = text(call.getString("title"), DEFAULT_TITLE);
        final String subtitle = text(call.getString("subtitle"), null);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            showPrompt(call, activity, title, subtitle);
        } else {
            confirmCredential(call, title, subtitle);
        }
    }

    /** Android 10+: BiometricPrompt that also offers the PIN / pattern / password. */
    @SuppressWarnings("deprecation") // setDeviceCredentialAllowed: the Android 10 way, replaced in 11
    private void showPrompt(final PluginCall call, final Activity activity, final String title, final String subtitle) {
        activity.runOnUiThread(() -> {
            try {
                final Executor executor = activity.getMainExecutor();
                BiometricPrompt.Builder builder = new BiometricPrompt.Builder(activity).setTitle(title);
                if (subtitle != null) {
                    builder.setSubtitle(subtitle);
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    builder.setAllowedAuthenticators(
                        BiometricManager.Authenticators.BIOMETRIC_STRONG | BiometricManager.Authenticators.DEVICE_CREDENTIAL
                    );
                } else {
                    builder.setDeviceCredentialAllowed(true);
                }
                builder.setConfirmationRequired(false);
                // No negative button: with the device credential allowed the system shows its own
                // "use PIN" choice, and a negative button is refused.
                BiometricPrompt prompt = builder.build();
                prompt.authenticate(
                    new CancellationSignal(),
                    executor,
                    new BiometricPrompt.AuthenticationCallback() {
                        @Override
                        public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                            resolveCheck(call, RESULT_OK);
                        }

                        @Override
                        public void onAuthenticationError(int errorCode, CharSequence errString) {
                            resolveCheck(call, promptError(errorCode));
                        }
                        // onAuthenticationFailed (a finger that did not match) is not final: the
                        // prompt stays open and the user tries again or cancels.
                    }
                );
            } catch (RuntimeException e) {
                resolveCheck(call, RESULT_FAILED);
            }
        });
    }

    /** The final error of a prompt as the seam's answer. */
    static String promptError(int errorCode) {
        switch (errorCode) {
            case BiometricPrompt.BIOMETRIC_ERROR_USER_CANCELED:
            case BiometricPrompt.BIOMETRIC_ERROR_CANCELED:
            case BiometricPrompt.BIOMETRIC_ERROR_TIMEOUT:
                return RESULT_CANCELLED;
            case BiometricPrompt.BIOMETRIC_ERROR_HW_UNAVAILABLE:
            case BiometricPrompt.BIOMETRIC_ERROR_HW_NOT_PRESENT:
            case BiometricPrompt.BIOMETRIC_ERROR_NO_BIOMETRICS:
            case BiometricPrompt.BIOMETRIC_ERROR_NO_DEVICE_CREDENTIAL:
            case BiometricPrompt.BIOMETRIC_ERROR_SECURITY_UPDATE_REQUIRED:
                return RESULT_UNAVAILABLE;
            default:
                // Lockouts after too many attempts, vendor and processing errors.
                return RESULT_FAILED;
        }
    }

    /** Android 7-9: the system's "confirm your PIN / pattern / password" screen. */
    @SuppressWarnings("deprecation")
    private void confirmCredential(PluginCall call, String title, String subtitle) {
        Intent intent;
        try {
            KeyguardManager keyguard = getContext().getSystemService(KeyguardManager.class);
            intent = keyguard == null ? null : keyguard.createConfirmDeviceCredentialIntent(title, subtitle);
        } catch (RuntimeException e) {
            intent = null;
        }
        if (intent == null) {
            resolveCheck(call, RESULT_UNAVAILABLE);
            return;
        }
        try {
            startActivityForResult(call, intent, "confirmCredentialResult");
        } catch (RuntimeException e) {
            resolveCheck(call, RESULT_FAILED);
        }
    }

    @ActivityCallback
    private void confirmCredentialResult(PluginCall call, ActivityResult result) {
        if (call == null) {
            return; // the app was recreated meanwhile: nobody waits for this answer any more
        }
        resolveCheck(call, result != null && result.getResultCode() == Activity.RESULT_OK ? RESULT_OK : RESULT_CANCELLED);
    }

    private void resolveCheck(PluginCall call, String result) {
        JSObject out = new JSObject();
        out.put("result", result);
        call.resolve(out);
    }

    /** A one-line prompt text: control characters dropped, trimmed, at most MAX_TEXT characters. */
    private static String text(String raw, String fallback) {
        if (raw == null) {
            return fallback;
        }
        StringBuilder out = new StringBuilder();
        for (int i = 0; i < raw.length() && out.length() < MAX_TEXT; i++) {
            char c = raw.charAt(i);
            if (!Character.isISOControl(c)) {
                out.append(c);
            }
        }
        String clean = out.toString().trim();
        return clean.isEmpty() ? fallback : clean;
    }
}
