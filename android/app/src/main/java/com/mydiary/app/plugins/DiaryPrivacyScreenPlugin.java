package com.mydiary.app.plugins;

import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.view.Window;
import android.view.WindowManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * "Hide content in recent apps and block screenshots" (docs/ANDROID-PLAN.md, WP-9): FLAG_SECURE on
 * the activity window. JavaScript side: mobile/plugins/diary-privacy-screen/index.ts.
 *
 * The setting is stored here (SharedPreferences, default ON) and applied in `load()`, which runs
 * while the activity is created - before the WebView shows anything - so the recent-apps snapshot
 * is blank from the very first frame, not only once JavaScript has started.
 */
@CapacitorPlugin(name = "DiaryPrivacyScreen")
public class DiaryPrivacyScreenPlugin extends Plugin {

    static final String PREFS = "diary.privacy-screen";
    static final String KEY_ENABLED = "enabled";

    @Override
    public void load() {
        apply(isEnabled());
    }

    @PluginMethod
    public void setEnabled(PluginCall call) {
        Boolean enabled = call.getBoolean("enabled");
        if (enabled == null) {
            call.reject("enabled is required");
            return;
        }
        prefs().edit().putBoolean(KEY_ENABLED, enabled).apply();
        apply(enabled);
        call.resolve();
    }

    @PluginMethod
    public void isEnabled(PluginCall call) {
        JSObject out = new JSObject();
        out.put("enabled", isEnabled());
        call.resolve(out);
    }

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private boolean isEnabled() {
        return prefs().getBoolean(KEY_ENABLED, true);
    }

    private void apply(final boolean enabled) {
        final Activity activity = getActivity();
        if (activity == null) {
            return;
        }
        activity.runOnUiThread(() -> {
            Window window = activity.getWindow();
            if (window == null) {
                return;
            }
            if (enabled) {
                window.setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);
            } else {
                window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
            }
        });
    }
}
