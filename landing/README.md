# wrld3 landing page

Next.js (App Router). Light mode only, flat pastel colour, no gradients, with hand-drawn nature shapes
(`components/Nature.js`). Typography is the app's: Plus Jakarta Sans 500 / 700 / 800.

```
npm install
npm run dev -- -p 3100   # http://localhost:3100
npm run build && npm start
```

## The app runs inside the page

`migrated/` is a copy of the app's own source (`App.js` and `src/`: screens, stamps, onboarding art, theme). It runs in the
browser through react-native-web. Native-only modules have web stand-ins in `shims/` (wired up in `next.config.mjs`):

| Native module | Web stand-in |
| --- | --- |
| `@maplibre/maplibre-react-native` | `shims/maplibre.js` (maplibre-gl, same cartoon style) |
| `@expo/vector-icons` | `shims/vector-icons.js` (same Ionicons glyphs) |
| `expo-camera` | a flat park scene in `shims/noop-modules.js` |
| haptics, secure-store, status bar, … | no-ops |

Landing-only edits inside `migrated/`: fixed demo GPS position (`useLocation.js`), no feed fetch (`spots.js`),
no AR model (`ArCamera.js` shows the distance-driven scene instead), the stamp sky gradients flattened, and the capture
screen's banded dark fades removed. Re-copy from `../src` to pick up app changes, then re-apply those edits.

The copy of the logo files is in `public/`; the fonts the app loads are in `public/fonts/`.
