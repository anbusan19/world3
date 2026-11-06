# Install wrld3 (Android)

## What you need
- An **Android phone**, Android 8 (API 26) or newer, with **ARCore** support (check at <https://developers.google.com/ar/devices>).
- **Camera, precise location, and internet** (the app asks for camera and location on first use; both are needed to capture a stamp).
- A **verified World ID** in the World App, to prove you are one human. Without it you can browse, but not capture.
- A **wrld3 server** to talk to. The app looks for one at `http://127.0.0.1:3000` unless the build was made with a server baked in
  (see below). For the event, use the address the organizers give you: Profile, Settings, Developer, Server.
- Optional: Sepolia test ETH is **not** needed. Minting is relayed for you, and the contract is on the Sepolia testnet.

## Install
1. On the phone, download `wrld3.apk` from the latest [release](../../releases/latest).
2. Open it. Android asks to allow installs from your browser or file manager ("Install unknown apps"). Allow it for that app only.
3. Tap Install, then Open. If Play Protect warns about an unrecognised app, choose "Install anyway": the APK is signed by us
   but is not on the Play Store. Compare the signing certificate against the SHA-256 in the release notes if you want to check it.
4. Allow location (precise) and camera when asked.

## First run
Sign in with World ID, pick a name, then walk to a spot on the map. Within about 20 m the capture button lights up.

## Run your own server (organizers, developers)
- Node.js 22 or newer.
- `cd backend && npm install && npm start` serves the app feed and the organizer dashboard on port 3000. Copy `backend/.env.example`
  to `backend/.env` and fill in the keys (World ID, Arkiv, Sepolia relayer and signer). Never commit it.
- Put it behind a stable https address (see [hosting.md](hosting.md)), then build the app pointing at it:

```
EXPO_PUBLIC_SERVERS="Main|https://api.your-domain" scripts/build-apk.sh
```

- For a phone on a USB cable with the server on your computer: `adb reverse tcp:3000 tcp:3000` makes the default address work.

## Build the APK yourself
Needs Node 22+, JDK 17, and the Android SDK (platform 35 and build-tools). Then:

```
npm install
scripts/build-apk.sh        # writes dist/wrld3.apk
```

Releases are signed with a private keystore at `~/.wrld3/` (`signing.env` holds its path and password). Without it the script
falls back to the debug key, which is fine for testing but cannot update an app that was installed from a differently signed APK.
Keep the keystore safe: losing it means future versions cannot be installed over this one.
