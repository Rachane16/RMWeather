# RMWeather for Android

Native Android WebView application, using the existing RMWeather icon and logo.
Package: `io.github.rachane16.rmweather`. Android 7.0/API 24 and later.

The app opens `https://rachane16.github.io/RMWeather/?app=android`, so website updates appear without reinstalling the APK. An internet connection and an up-to-date Android System WebView are required. Location access is optional; declining it preserves the website's fallback map. Only the owned HTTPS origin can receive location grants. External HTTPS links open in the browser; embedded weather and CCTV pages remain embedded. No JavaScript-to-native bridge, file access, cleartext traffic, certificate bypass or debug signing fallback is enabled in a release.

Android back first closes a visible RMWeather window, then navigates WebView history or exits. Native offline recovery, keyboard/system-bar insets and fullscreen video are supported.

## Build

Install JDK 17, Android platform 36 and build tools 35.0.0. The official Gradle 8.13 wrapper and distribution checksums are pinned.

```sh
./gradlew testDebugUnitTest lintRelease assembleDebug
```

For release builds, configure these environment variables outside source control:

- `RMWEATHER_KEYSTORE_PATH`: absolute path to the persistent PKCS12 keystore
- `RMWEATHER_STORE_PASSWORD`
- `RMWEATHER_KEY_PASSWORD`
- `RMWEATHER_KEY_ALIAS`
- `RMWEATHER_BUILD_NUMBER`: monotonically increasing integer, used for Android updates

```sh
./gradlew assembleRelease
```

Never generate a new signing key for routine updates. APKs signed by a different key cannot update the installed app directly.

## Automatic signed APK

`.github/workflows/android.yml` builds on Android source changes to main, pull requests, or manual dispatch. Pull requests run unit tests, lint and a debug-device smoke test without release secrets. Main/manual builds decode the release key from encrypted repository secrets, build a signed APK, verify its signature and package identity, and install/launch it in an Android 15 emulator before publication.

The release key uses repository secrets `RMWEATHER_ANDROID_KEYSTORE_B64`, `RMWEATHER_ANDROID_STORE_PASSWORD`, `RMWEATHER_ANDROID_KEY_PASSWORD` and `RMWEATHER_ANDROID_KEY_ALIAS`. The runner copy is removed after the build. Keep an independent private backup of the key and passwords.

Successful signed builds publish `RMWeather.apk`, its SHA-256 checksum and certificate report in a versioned GitHub Release. Download from the latest release:

[RMWeather.apk](https://github.com/Rachane16/RMWeather/releases/latest/download/RMWeather.apk)

On Android, open the APK and allow installation from the browser/file app when Android prompts. Future APK updates must keep the same package, release key and a higher version code. This is direct APK distribution; it does not publish the app to Google Play.

Android may apply additional installation/developer-verification steps depending on the device, installer and region. No Android Developer Console registration is performed by this project. See the [official installation and verification guidance](https://developer.android.com/developer-verification). The automated device test validates APK installation with ADB and live startup; it does not certify Play registration or every manufacturer's installer.
