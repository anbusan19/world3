#!/usr/bin/env bash
# Builds the signed release APK -> dist/wrld3.apk
#   scripts/build-apk.sh                      # uses ~/.wrld3/signing.env if present (else the debug key)
#   EXPO_PUBLIC_SERVERS="Main|https://api.example.com" scripts/build-apk.sh   # bake in a server
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f "$HOME/.wrld3/signing.env" ] && { set -a; . "$HOME/.wrld3/signing.env"; set +a; }
[ -d android ] || npx expo prebuild --platform android --no-install
# Gradle does not notice a changed EXPO_PUBLIC_* value, so throw away the cached JS bundle and rebuild it
rm -rf android/app/build/generated/assets android/app/build/intermediates/assets android/app/build/generated/res/createBundleReleaseJsAndAssets android/app/build/intermediates/merged_assets/release 2>/dev/null || true
(cd android && ./gradlew :app:createBundleReleaseJsAndAssets --rerun-tasks -q >/dev/null 2>&1 || true; ./gradlew assembleRelease -x lint)
mkdir -p dist && cp android/app/build/outputs/apk/release/app-release.apk dist/wrld3.apk
echo "built dist/wrld3.apk ($(du -h dist/wrld3.apk | cut -f1))"
