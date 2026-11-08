package com.mydiary.app;

import android.os.Bundle;
import android.util.TypedValue;
import com.getcapacitor.BridgeActivity;
import com.mydiary.app.plugins.DiaryBiometricPlugin;
import com.mydiary.app.plugins.DiaryFilesPlugin;
import com.mydiary.app.plugins.DiaryOfflinePlugin;
import com.mydiary.app.plugins.DiaryPrivacyScreenPlugin;

/**
 * The single activity of Your Personal Diary: Capacitor's BridgeActivity hosts the WebView that runs
 * the web UI and, inside it, the diary core worker (docs/ANDROID-PLAN.md).
 *
 * Plugins written for this app (com.mydiary.app.plugins; the JavaScript side is in mobile/plugins)
 * are registered here, BEFORE super.onCreate(). Today: WP-7 DiaryFiles, WP-9 DiaryPrivacyScreen and
 * DiaryBiometric, WP-H10d DiaryOffline (offline key in the Keystore, offline unlock); WP-12 adds
 * diary-mail the same way.
 *
 * Plugins from npm packages (@capacitor/filesystem, ...) need no code here: `npx cap sync android`
 * lists them in assets/capacitor.plugins.json and the bridge loads them.
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(DiaryFilesPlugin.class);
        registerPlugin(DiaryPrivacyScreenPlugin.class);
        registerPlugin(DiaryBiometricPlugin.class);
        registerPlugin(DiaryOfflinePlugin.class);
        super.onCreate(savedInstanceState);
        matchWebViewBackgroundToTheme();
    }

    /**
     * Until the page paints, the WebView shows its own background (white by default). Give it the
     * window background of the current theme (light or dark, colors.xml) so the hand-over from the
     * launch splash to the web splash of index.html has no flash in dark mode.
     */
    private void matchWebViewBackgroundToTheme() {
        if (bridge == null || bridge.getWebView() == null) {
            return;
        }
        TypedValue value = new TypedValue();
        boolean resolved = getTheme().resolveAttribute(android.R.attr.windowBackground, value, true);
        if (resolved && value.type >= TypedValue.TYPE_FIRST_COLOR_INT && value.type <= TypedValue.TYPE_LAST_COLOR_INT) {
            bridge.getWebView().setBackgroundColor(value.data);
        }
    }
}
