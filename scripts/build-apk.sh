#!/usr/bin/env bash
# Builds the signed release APK -> dist/wrld3.apk
#   scripts/build-apk.sh                      # uses ~/.wrld3/signing.env if present (else the debug key)
#   EXPO_PUBLIC_SERVERS="Main|https://api.example.com" scripts/build-apk.sh   # bake in a server
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f "$HOME/.wrld3/signing.env" ] && { set -a; . "$HOME/.wrld3/signing.env"; set +a; }
[ -d android ] || npx expo prebuild --platform android --no-install
(cd android && ./gradlew assembleRelease -x lint)
mkdir -p dist && cp android/app/build/outputs/apk/release/app-release.apk dist/wrld3.apk
echo "built dist/wrld3.apk ($(du -h dist/wrld3.apk | cut -f1))"
