// Rebuilds landing/migrated (the app as it runs inside the landing page's phone frames) from the real React Native source.
//   npm run sync-app
// Everything in ../src and ../App.js is copied and adjusted for the web (react-native-web): the phone frame's size instead of the
// window's, the fonts the page loads, demo data instead of the server. A few files are web-only forks and are left alone:
//   useLocation.js (a fixed place), screens/ArCamera.js (the landing's scene), phoneSize.js.
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..', '..'); const out = path.join(here, '..', 'migrated');
const KEEP = new Set(['useLocation.js', 'screens/ArCamera.js', 'phoneSize.js']); // web-only forks
const SKIP = new Set(['ArModel.js', 'ModelView.js']); // native 3D, not used on the web
const walk = (d, base = d) => readdirSync(d).flatMap((f) => { const p = path.join(d, f); return statSync(p).isDirectory() ? walk(p, base) : [path.relative(base, p)]; });

function adapt(rel, text) {
  let s = text;
  // the phone frame's width and height, not the browser window's
  if (/useWindowDimensions/.test(s)) {
    s = s.replace(/\buseWindowDimensions\b,?\s*/g, (m, off) => (s.slice(0, off).includes('from \'react-native\'') ? m : m));
    s = s.replace(/import \{([^}]*)\} from 'react-native';/, (m, names) => `import {${names.split(',').map((x) => x.trim()).filter((x) => x && x !== 'useWindowDimensions').join(', ').replace(/^/, ' ')} } from 'react-native';`);
    const depth = rel === 'App.js' ? './src' : path.relative(path.dirname(rel), '.') || '.';
    s = s.replace(/^(import [^\n]*\n)/m, `$1import { usePhoneSize as useWindowDimensions } from '${rel === 'App.js' ? './src/phoneSize' : (depth === '.' ? './phoneSize' : `${depth}/phoneSize`)}';\n`);
  }
  s = s.replace(/require\('(?:\.\.?\/)+assets\/stamplogo-dark\.png'\)/g, "({ uri: '/stamplogo-dark.png' })");
  s = s.replace(/require\('(?:\.\.?\/)+assets\/logo\.png'\)/g, "({ uri: '/app-logo.png' })");
  if (rel === 'Onboarding.js') { s = s.replace('const SLIDES = [', 'export const SLIDES = ['); s = s.replace('function Art({ slide }) {', 'export function Art({ slide }) {'); } // the landing page draws the slides by themselves
  if (rel === 'theme.js') {
    s = s.replace("const system = useColorScheme();", "const system = 'light'; // the landing page always shows the light theme");
    // the page loads Plus Jakarta Sans 500, 700 and 800 only
    s = s.replace(/export const F = \{[\s\S]*?\};/, "export const F = { reg: 'PlusJakartaSans_500Medium', med: 'PlusJakartaSans_500Medium', semi: 'PlusJakartaSans_700Bold', bold: 'PlusJakartaSans_800ExtraBold', black: 'PlusJakartaSans_800ExtraBold', mono: 'ui-monospace, SFMono-Regular, Menlo, monospace' };");
  }
  if (rel === 'spots.js') {
    s = s.replace("export async function refreshSpots(force = false) {", "export async function refreshSpots(force = false) {\n  if (typeof window !== 'undefined') return force ? -1 : false; // the landing page shows the bundled spots and never calls a server");
    s = s.replace("let eventList = [];", "let eventList = [{ id: 'ethmumbai', name: 'ETHGlobal Mumbai', blurb: '', theme: 'sky', startsAt: null, endsAt: new Date(Date.now() + 26 * 3600e3).toISOString(), status: 'live', over: false }];");
  }
  if (rel === 'App.js') {
    s = s.replace("export default function App() {", "export default function App({ startPhase = 'app' }) {");
    s = s.replace("<AppInner />", "<AppInner startPhase={startPhase} />");
    s = s.replace("function AppInner() {", "function AppInner({ startPhase }) {");
    s = s.replace("useState('onboarding')", "useState(startPhase)");
    s = s.replace(/import \{\s*useFonts,[\s\S]*?\} from '@expo-google-fonts\/plus-jakarta-sans';\n/, "import { useFonts } from '@expo-google-fonts/plus-jakarta-sans';\n");
    s = s.replace("import { GeistMono_500Medium } from '@expo-google-fonts/geist-mono';\n", "");
    s = s.replace(/const \[fontsLoaded\] = useFonts\([^\n]*\);/, "const [fontsLoaded] = [true]; // the page loads its own fonts");
  }
  return s;
}

const files = [...walk(path.join(root, 'src')).map((f) => ({ rel: f, from: path.join(root, 'src', f), to: path.join(out, 'src', f) })), { rel: 'App.js', from: path.join(root, 'App.js'), to: path.join(out, 'App.js') }];
let n = 0;
for (const f of files) {
  if (KEEP.has(f.rel) || SKIP.has(f.rel)) continue;
  mkdirSync(path.dirname(f.to), { recursive: true });
  if (f.rel === 'world.js') { copyFileSync(path.join(here, '..', 'shims', 'world.web.js'), f.to); n++; continue; }
  if (/\.(png|jpg|svg|ttf)$/.test(f.rel)) { copyFileSync(f.from, f.to); n++; continue; }
  writeFileSync(f.to, adapt(f.rel, readFileSync(f.from, 'utf8'))); n++;
}
// images the app needs
mkdirSync(path.join(out, 'assets'), { recursive: true });
cpSync(path.join(root, 'assets'), path.join(out, 'assets'), { recursive: true }); // includes assets/pins
console.log(`synced ${n} files from the app into landing/migrated`);
