PACKAGE IOS-I2 - the iPhone app with the REAL Xcode on the owner's Mac (replaces the deferred IOS-I1, which assumed no Xcode). Work over SSH exactly as docs/apple-tasks/ENV-FINAL.md says (Mac section; the Mac is the owner's personal computer).

STATE (2026-11-11): the owner upgraded the Mac to macOS Tahoe and installed Xcode himself. There is still no ios/ folder. scripts/ios/README.he.md holds the one-time steps. mobile/ios-app/* and mobile/plugins/*/ios/*.swift are the files prepared on Windows. mobile/test/ios-prep.test.ts un-skips its "generated iOS project" describe as soon as ios/App/App.xcodeproj/project.pbxproj exists - it is the acceptance test on the PC. The iOS app is a thin client of the production server https://yourpersonaldiary.fly.dev, the same as Android.

STEP 1 - PRECONDITIONS (read-only checks on the Mac). STOP and report, changing nothing, if any of these fails:
- sw_vers shows 26.x.
- xcode-select -p is /Applications/Xcode.app/Contents/Developer. If it still points to the CommandLineTools, switching needs sudo, which only the owner may run: "sudo xcode-select -s /Applications/Xcode.app/Contents/Developer".
- xcodebuild -version prints a version.
- xcodebuild -checkFirstLaunchStatus exits 0. Otherwise the owner opens Xcode once and accepts the license.
- xcrun simctl list runtimes lists an iOS runtime. Otherwise the owner downloads the iOS platform in Xcode > Settings > Components.
- df -h / shows at least 25 GB free.
- node, npm and cargo are found with the PATH line of ENV-FINAL. Start the caffeinate guard.

STEP 2 - SYNC. Run bash scripts/mac/sync-to-mac.sh on the PC. The PC tree is the truth. The sync excludes /ios, so the Mac's ios/ is created on the Mac and copied back in step 7.

STEP 3 - THE PROJECT. On the Mac:
- Run npm run mobile:build.
- Run npx cap add ios with the default Swift Package Manager. Never use CocoaPods, never install anything (no gems, no brew, no pods).
- Run npx cap sync ios.
- Keep the logs: ~/Developer/ios-add.log and ~/Developer/ios-sync.log.

STEP 4 - THE ONE-TIME EDITS of scripts/ios/README.he.md, steps 5.1-5.4:
- The view controller.
- The Info.plist additions from mobile/ios-app/InfoAdditions.plist. Merge them with PlistBuddy or plutil, never by concatenating XML.
- PrivacyInfo.xcprivacy. Add the Health and Fitness collected-data entries named in appstore/policy/app-privacy.md (linked true, tracking false, purpose App Functionality): edit mobile/ios-app/PrivacyInfo.xcprivacy on the PC first, then sync.
- The six Swift files in the App target.
  - Inspect project.pbxproj. If the App folder is a file-system-synchronized group (PBXFileSystemSynchronizedRootGroup, Xcode 16+), copying the files into the folder is enough.
  - Otherwise use only a text method that the README documents and that the ios-prep test accepts.
  - Never use the Xcode GUI.
- Deployment target 16.0 (the README's command).
- TARGETED_DEVICE_FAMILY = 1 (iPhone only).
- ITSAppUsesNonExemptEncryption = false.
- CFBundleLocalizations for the 20 languages, if the README lists it.
- The App Store icon: appstore/icon/AppIcon-1024.png into Assets.xcassets/AppIcon.appiconset, under the file name its Contents.json gives the 1024x1024 entry. Check it with node scripts/appstore/check-screenshots.mjs on the PC after step 7.

STEP 5 - BUILD FOR THE SIMULATOR (no signing):
    xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build
- Log the build to ~/Developer/ios-build-sim.log.
- A compile error in a prepared Swift file is fixed on the PC (mobile/plugins/*/ios, mobile/ios-app), then you sync again. The two copies must stay identical.
- Record the warnings that matter (missing files, deprecated APIs used by our code).

STEP 6 - RUN IT HEADLESS IN THE SIMULATOR:
- Commands: xcrun simctl boot <an iPhone device of the installed runtime>, xcrun simctl install booted <the .app>, xcrun simctl launch booted app.yourpersonaldiary. Never "open -a Simulator" and no other GUI.
- Wait about 10 s, then take xcrun simctl io booted screenshot of the first screen (the sign-in screen). Take the offline screen too if the README describes how.
- Do NOT register or sign in. The app talks to the PRODUCTION server, and a test account there would be real data.
- Afterwards run xcrun simctl shutdown all. Remove the screenshots from /tmp after copying them to the PC folder C:\Users\AVI\Projects\mpd-probe\ios-i2\.

STEP 7 - BACK TO THE PC:
- Copy ios/ to the PC with tar over ssh from Git Bash, never through PowerShell. Excluded: ios/App/App/public, Pods, DerivedData and build, as in .gitignore.
- Compare a file list + md5 on both sides: the trees must be identical.
- On the PC run:
  - npm run mobile:test (the ios-prep tests must pass);
  - npm run mobile:typecheck;
  - node scripts/check-no-network.mjs (it scans ios/App/App);
  - node --test "scripts/**/*.test.mjs".

STEP 8 - DOCUMENTATION:
- scripts/ios/README.he.md gets a dated status block at the top, in Hebrew, for the owner:
  - what exists in ios/ now;
  - what is still left: signing with his Apple ID in Xcode (Signing & Capabilities > Team);
  - running on his own iPhone with the exact clicks;
  - Archive and upload.
- docs/APPLE-PLAN.md gets a one- or two-sentence status line under WP-I1.

RULES:
- Never sign with a real identity and never create certificates.
- No sudo. Never touch "/Applications/Your Personal Diary.app", the login keychain, ~/Library/WebKit/app.yourpersonaldiary.mac or ~/Library/Application Support/app.yourpersonaldiary.mac.
- No GUI apps and no dialogs.
- ios/ never contains secrets or real data.
- Clean /tmp/ios-* and report the disk use before and after.
- If at any point the owner's involvement would be needed (license, Apple ID, a dialog), stop and report instead.
- Only read-only git on the PC; the main session commits.

VERIFIER (PC + read-only on the Mac, edits nothing):
- Read the report and the ios/ tree on the PC.
- Run npm run mobile:test and the scripts tests.
- Check Info.plist with a plist parser:
  - the keys of InfoAdditions.plist appear exactly once;
  - ITSAppUsesNonExemptEncryption is false;
  - NSFaceIDUsageDescription is present.
- Check project.pbxproj: IPHONEOS_DEPLOYMENT_TARGET = 16.0 wherever the README's grep expects it, TARGETED_DEVICE_FAMILY = 1, the six Swift files part of the App target (or of a synchronized group).
- The Swift files are byte-identical to mobile/plugins/*/ios and mobile/ios-app.
- PrivacyInfo.xcprivacy matches appstore/policy/app-privacy.md.
- No Podfile.
- No file in ios/ names a host other than the fixed server.
- The simulator build log ends with "BUILD SUCCEEDED".
- The screenshot shows the sign-in screen, not an error page.
- Findings with evidence.

FIXER: applies the findings (on the PC first, then sync), re-runs the affected checks on the Mac and the PC, reports.
