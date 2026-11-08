package com.mydiary.app.plugins;

import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.hardware.biometrics.BiometricManager;
import android.hardware.biometrics.BiometricPrompt;
import android.os.Build;
import android.os.CancellationSignal;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyPermanentlyInvalidatedException;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.KeyStore;
import java.util.concurrent.Executor;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import org.json.JSONObject;

/**
 * Biometric unlock of the lock screen (docs/ANDROID-PLAN.md, WP-9). JavaScript side:
 * mobile/plugins/diary-biometric/index.ts; the design and the core contract it waits for:
 * mobile/platform/biometric.ts.
 *
 * Security model: the only thing stored is the UNLOCK TOKEN the diary core issued (never the
 * password), AES-GCM encrypted with a key of the Android Keystore that
 *   - needs a biometric authentication for every single use (setUserAuthenticationRequired(true)
 *     with a validity of 0: the key works only inside the BiometricPrompt's CryptoObject),
 *   - is permanently invalidated when a fingerprint / face is enrolled or removed
 *     (setInvalidatedByBiometricEnrollment(true)), after which the setting turns itself off,
 *   - is hardware-backed where the phone has secure hardware.
 * The prompt is shown with a CryptoObject around the cipher: the token is decrypted by the system
 * only after a successful authentication - there is no yes/no result the JavaScript could forge.
 *
 * Android 9+ (API 28, framework BiometricPrompt; AUTH_BIOMETRIC_STRONG on Android 11+). On older
 * phones `isAvailable` answers `unsupported` and nothing else works - the password always does.
 * Requires android.permission.USE_BIOMETRIC. Opens no network connection.
 */
@CapacitorPlugin(name = "DiaryBiometric")
public class DiaryBiometricPlugin extends Plugin {

    static final String PREFS = "diary.biometric";
    static final String KEY_CIPHERTEXT = "token.ciphertext";
    static final String KEY_IV = "token.iv";
    static final String KEYSTORE = "AndroidKeyStore";
    static final String KEY_ALIAS = "com.mydiary.app.biometric-unlock";
    private static final String TRANSFORMATION = "AES/GCM/NoPadding";
    private static final int GCM_TAG_BITS = 128;

    // ----------------------------------------------------------------------------------------
    // Availability
    // ----------------------------------------------------------------------------------------

    /** 'available' | 'none-enrolled' | 'no-hardware' | 'unsupported' | 'unavailable' */
    private String availability() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) {
            return "unsupported";
        }
        Context context = getContext();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            BiometricManager manager = context.getSystemService(BiometricManager.class);
            if (manager == null) {
                return "unavailable";
            }
            int result;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                result = manager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG);
            } else {
                result = manager.canAuthenticate();
            }
            switch (result) {
                case BiometricManager.BIOMETRIC_SUCCESS:
                    return "available";
                case BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED:
                    return "none-enrolled";
                case BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE:
                    return "no-hardware";
                default:
                    return "unavailable";
            }
        }
        // Android 9: no BiometricManager; the fingerprint feature flag is the best static answer.
        PackageManager pm = context.getPackageManager();
        return pm.hasSystemFeature(PackageManager.FEATURE_FINGERPRINT) ? "available" : "no-hardware";
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject out = new JSObject();
        out.put("status", availability());
        out.put("enrolled", prefs().contains(KEY_CIPHERTEXT));
        call.resolve(out);
    }

    // ----------------------------------------------------------------------------------------
    // Enroll: prompt (encrypt cipher) -> store ciphertext
    // ----------------------------------------------------------------------------------------

    @PluginMethod
    public void enroll(final PluginCall call) {
        final String token = call.getString("token");
        if (token == null || token.isEmpty()) {
            call.reject("token is required");
            return;
        }
        if (!"available".equals(availability())) {
            resolveEnroll(call, false, "unavailable");
            return;
        }
        final Cipher cipher;
        try {
            // A fresh key every time the setting is turned on: an old token can never come back.
            deleteKey();
            cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.ENCRYPT_MODE, createKey());
        } catch (GeneralSecurityException | RuntimeException e) {
            resolveEnroll(call, false, "failed");
            return;
        }
        showPrompt(call, cipher, new PromptListener() {
            @Override
            public void onSucceeded(Cipher authenticated) {
                try {
                    byte[] ciphertext = authenticated.doFinal(token.getBytes(StandardCharsets.UTF_8));
                    prefs()
                        .edit()
                        .putString(KEY_CIPHERTEXT, Base64.encodeToString(ciphertext, Base64.NO_WRAP))
                        .putString(KEY_IV, Base64.encodeToString(authenticated.getIV(), Base64.NO_WRAP))
                        .apply();
                    resolveEnroll(call, true, null);
                } catch (GeneralSecurityException | RuntimeException e) {
                    resolveEnroll(call, false, "failed");
                }
            }

            @Override
            public void onCancelled() {
                resolveEnroll(call, false, "cancelled");
            }

            @Override
            public void onFailed() {
                resolveEnroll(call, false, "failed");
            }
        });
    }

    private void resolveEnroll(PluginCall call, boolean ok, String reason) {
        JSObject out = new JSObject();
        out.put("ok", ok);
        if (reason != null) {
            out.put("reason", reason);
        }
        call.resolve(out);
    }

    // ----------------------------------------------------------------------------------------
    // Unlock: prompt (decrypt cipher) -> token
    // ----------------------------------------------------------------------------------------

    @PluginMethod
    public void unlock(final PluginCall call) {
        String ciphertextText = prefs().getString(KEY_CIPHERTEXT, null);
        String ivText = prefs().getString(KEY_IV, null);
        if (ciphertextText == null || ivText == null) {
            resolveUnlock(call, null, "not-enrolled");
            return;
        }
        if (!"available".equals(availability())) {
            resolveUnlock(call, null, "unavailable");
            return;
        }
        final byte[] ciphertext;
        final Cipher cipher;
        try {
            ciphertext = Base64.decode(ciphertextText, Base64.NO_WRAP);
            byte[] iv = Base64.decode(ivText, Base64.NO_WRAP);
            SecretKey key = loadKey();
            if (key == null) {
                clearStored();
                resolveUnlock(call, null, "invalidated");
                return;
            }
            cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(GCM_TAG_BITS, iv));
        } catch (KeyPermanentlyInvalidatedException e) {
            // A fingerprint / face was added or removed: the key is gone for good.
            clearStored();
            deleteKey();
            resolveUnlock(call, null, "invalidated");
            return;
        } catch (GeneralSecurityException | RuntimeException e) {
            resolveUnlock(call, null, "failed");
            return;
        }
        showPrompt(call, cipher, new PromptListener() {
            @Override
            public void onSucceeded(Cipher authenticated) {
                try {
                    byte[] plain = authenticated.doFinal(ciphertext);
                    resolveUnlock(call, new String(plain, StandardCharsets.UTF_8), null);
                } catch (GeneralSecurityException | RuntimeException e) {
                    resolveUnlock(call, null, "failed");
                }
            }

            @Override
            public void onCancelled() {
                resolveUnlock(call, null, "cancelled");
            }

            @Override
            public void onFailed() {
                resolveUnlock(call, null, "failed");
            }
        });
    }

    private void resolveUnlock(PluginCall call, String token, String reason) {
        JSObject out = new JSObject();
        out.put("token", token == null ? JSONObject.NULL : token);
        if (reason != null) {
            out.put("reason", reason);
        }
        call.resolve(out);
    }

    @PluginMethod
    public void clear(PluginCall call) {
        clearStored();
        deleteKey();
        call.resolve();
    }

    // ----------------------------------------------------------------------------------------
    // The prompt
    // ----------------------------------------------------------------------------------------

    private interface PromptListener {
        void onSucceeded(Cipher authenticated);

        void onCancelled();

        void onFailed();
    }

    private void showPrompt(final PluginCall call, final Cipher cipher, final PromptListener listener) {
        final Activity activity = getActivity();
        if (activity == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.P) {
            listener.onFailed();
            return;
        }
        final String title = call.getString("title", "Your Personal Diary");
        final String subtitle = call.getString("subtitle");
        final String negative = call.getString("negative", "Cancel");
        activity.runOnUiThread(() -> {
            try {
                final Executor executor = activity.getMainExecutor();
                BiometricPrompt.Builder builder = new BiometricPrompt.Builder(activity).setTitle(title);
                if (subtitle != null && !subtitle.isEmpty()) {
                    builder.setSubtitle(subtitle);
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    builder.setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG);
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    builder.setConfirmationRequired(false);
                }
                builder.setNegativeButton(negative, executor, (dialog, which) -> listener.onCancelled());
                BiometricPrompt prompt = builder.build();
                prompt.authenticate(
                    new BiometricPrompt.CryptoObject(cipher),
                    new CancellationSignal(),
                    executor,
                    new BiometricPrompt.AuthenticationCallback() {
                        @Override
                        public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                            BiometricPrompt.CryptoObject crypto = result.getCryptoObject();
                            Cipher authenticated = crypto == null ? null : crypto.getCipher();
                            if (authenticated == null) {
                                listener.onFailed();
                            } else {
                                listener.onSucceeded(authenticated);
                            }
                        }

                        @Override
                        public void onAuthenticationError(int errorCode, CharSequence errString) {
                            // The negative ("use password") button arrives through its click listener
                            // above, not as an error code (that constant exists in AndroidX only).
                            if (errorCode == BiometricPrompt.BIOMETRIC_ERROR_USER_CANCELED || errorCode == BiometricPrompt.BIOMETRIC_ERROR_CANCELED) {
                                listener.onCancelled();
                            } else {
                                listener.onFailed();
                            }
                        }
                    }
                );
            } catch (RuntimeException e) {
                listener.onFailed();
            }
        });
    }

    // ----------------------------------------------------------------------------------------
    // Keystore
    // ----------------------------------------------------------------------------------------

    private SecretKey createKey() throws GeneralSecurityException {
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE);
        KeyGenParameterSpec.Builder spec = new KeyGenParameterSpec.Builder(
            KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .setUserAuthenticationRequired(true)
            .setInvalidatedByBiometricEnrollment(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            // Every use needs a fresh biometric authentication (timeout 0), strong biometrics only.
            spec.setUserAuthenticationParameters(0, KeyProperties.AUTH_BIOMETRIC_STRONG);
        } else {
            spec.setUserAuthenticationValidityDurationSeconds(-1);
        }
        generator.init(spec.build());
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

    private void deleteKey() {
        try {
            KeyStore keyStore = KeyStore.getInstance(KEYSTORE);
            keyStore.load(null);
            if (keyStore.containsAlias(KEY_ALIAS)) {
                keyStore.deleteEntry(KEY_ALIAS);
            }
        } catch (GeneralSecurityException | java.io.IOException | RuntimeException ignored) {
            // A key that cannot be deleted is useless without its ciphertext anyway.
        }
    }

    private void clearStored() {
        prefs().edit().remove(KEY_CIPHERTEXT).remove(KEY_IV).apply();
    }

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }
}
