# R8 rules of Your Personal Diary (release builds: minifyEnabled + shrinkResources, app/build.gradle).
#
# Capacitor's library and the plugin AARs ship consumer rules of their own (plugins annotated with
# @CapacitorPlugin, their @PluginMethod methods, Cordova plugins). The rules below repeat what the
# app depends on, so that a plugin added by a later package as a LOCAL module of this project
# (WP-7 diary-files, WP-9 lock / biometric, WP-12 diary-mail) is kept even without consumer rules.

-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod

# Capacitor plugins are discovered and their methods invoked by reflection.
-keep @com.getcapacitor.annotation.CapacitorPlugin public class * {
    @com.getcapacitor.annotation.PermissionCallback <methods>;
    @com.getcapacitor.annotation.ActivityCallback <methods>;
    @com.getcapacitor.annotation.Permission <methods>;
    @com.getcapacitor.PluginMethod public <methods>;
}
-keep public class * extends com.getcapacitor.Plugin { *; }
-keep public class * extends com.getcapacitor.BridgeActivity { *; }

# The bridge itself (the WebView message channel, the plugin loader, the local web server).
-keep class com.getcapacitor.** { *; }
-dontwarn com.getcapacitor.**
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# The app's own classes: MainActivity and the local plugins of later packages. com.mydiary.app is the
# Java NAMESPACE (app/build.gradle appNamespace), not the application id (app.yourpersonaldiary).
-keep class com.mydiary.app.** { *; }

# Cordova compatibility layer shipped with Capacitor (no Cordova plugin is used; kept as Capacitor keeps it).
-keep public class * extends org.apache.cordova.* {
    public <methods>;
    public <fields>;
}
-dontwarn org.apache.cordova.**
