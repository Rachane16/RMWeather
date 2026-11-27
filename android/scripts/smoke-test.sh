#!/usr/bin/env bash
set -euo pipefail
apk="$1"
mkdir -p android-smoke
# Disable the emulator's opportunistic DNS-over-TLS, which runner networks can block.
adb shell settings put global private_dns_mode off
adb shell settings delete global private_dns_specifier
if [ "${TEST_RELEASE_UPGRADE:-false}" = true ]; then
  previous="$(mktemp --suffix=.apk)"
  curl --fail --location --retry 2 --max-time 90 'https://github.com/Rachane16/RMWeather/releases/latest/download/RMWeather.apk' -o "$previous"
  adb install "$previous"
  rm -f "$previous"
fi
adb install -r "$apk"
adb shell dumpsys package io.github.rachane16.rmweather | grep -E 'versionCode=|versionName=' > android-smoke/installed-version.txt
adb shell pm grant io.github.rachane16.rmweather android.permission.ACCESS_COARSE_LOCATION
adb shell pm grant io.github.rachane16.rmweather android.permission.ACCESS_FINE_LOCATION
adb emu geo fix 100.5017 7.0068
adb logcat -c
adb shell am start -W -n io.github.rachane16.rmweather/.MainActivity
for attempt in $(seq 1 30); do
  adb shell uiautomator dump /sdcard/rmweather-ui.xml >/dev/null 2>&1 || true
  adb pull /sdcard/rmweather-ui.xml android-smoke/ui.xml >/dev/null 2>&1 || true
  if python3 -c 'import pathlib,sys; p=pathlib.Path("android-smoke/ui.xml"); s=p.read_text() if p.exists() else ""; sys.exit(0 if all(text in s for text in ["ภาพรวม","ชั้นข้อมูล","OpenStreetMap"]) else 1)'; then
    # The first native accessibility frame can precede the WebGL basemap.
    # Require the dynamically created map credit and allow tiles to render.
    sleep 8
    adb exec-out screencap -p > android-smoke/app.png
    adb logcat -d -s AndroidRuntime:E RMWeatherNetwork:W chromium:E > android-smoke/runtime.log
    if grep -q 'FATAL EXCEPTION' android-smoke/runtime.log; then exit 1; fi
    echo 'Signed APK installed and the live RMWeather map controls appeared.'
    exit 0
  fi
  sleep 2
done
adb exec-out screencap -p > android-smoke/app.png
adb logcat -d > android-smoke/runtime.log
echo 'RMWeather did not display its live map controls before the deadline.' >&2
exit 1
