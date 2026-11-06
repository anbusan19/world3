# wrld3 spots dashboard

A local dashboard for pinning 3D models (.glb) to real-world locations, plus the small server the app reads them from. No dependencies, Node 20+.

```
cd backend
npm start          # dashboard at http://127.0.0.1:3000
npm test           # 18 tests (GLB parsing, API, security)
npm run sample     # regenerates samples/sample-arch.glb to try the uploader
```

Data lives in `backend/data/` (git-ignored): `spots.json`, `models/`, `images/`.

## How it works

1. **New spot** (or click a spot), then click the map or paste `lat, lng` to place the pin. Drag the pin to fine-tune.
2. Set the name, stamp label, type (landmark/event), how it is verified (outdoor GPS or QR anchor), and two radii: **capture** (the button works) and **approach** (the model starts to appear).
3. Drop a `.glb` onto the 3D model box. It is checked and previewed, and the size, triangle count and warnings are shown. "Use this view as the stamp image" saves a snapshot as the stamp art.
4. Flip **Published** to let the app see it. Drafts are only visible in the dashboard. Save with the button or Cmd/Ctrl+S.

## Model requirements

- One self-contained `.glb`, up to 30 MB (aim for 2-5 MB, under 150k triangles).
- Real-world scale in metres, Y up, base sitting at Y = 0. Use scale, heading and height offset to adjust.
- Draco/meshopt compression and big textures are flagged as warnings.

## App feed

`GET /api/v1/spots` returns published spots only (with ETag and CORS). Model and image files are served from `/files/models/<sha>.glb` and `/files/images/...` with immutable caching. Phone access over USB: `adb reverse tcp:3000 tcp:3000`.

## Security notes

- No login. The server binds to `127.0.0.1` and only accepts loopback Host headers. Do not expose it (HOST=0.0.0.0 prints a warning) until auth is added.
- Write requests need a same-origin request and the `X-Requested-With: wrld3-dashboard` header.
- The feed currently exposes exact coordinates. The product spec wants only coarse locations before a user is close, so that needs to change before a real release.

## Not done yet

The app does not read this feed yet (it still uses `src/spots.js`) and cannot render .glb files.
