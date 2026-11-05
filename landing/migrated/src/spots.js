// coord is [longitude, latitude]. The two landmarks are real; the ETHGlobal event spot is a PLACEHOLDER
// (Bandra Kurla Complex) until the actual venue is confirmed.
// kind: 'geospatial' = outdoor landmark checked with the camera-based location fix; 'anchor' = scan a QR at the venue.
const BUNDLED = [
  { id: '01', name: 'Gateway of India', label: 'GATEWAY', art: 'gateway', city: 'Mumbai', type: 'LANDMARK', kind: 'geospatial', coord: [72.8347, 18.922], tint: '#F9C9B0', theme: 'coral', icon: 'business' },
  { id: '02', name: 'ETHGlobal Mumbai', label: 'ETHGLOBAL', art: 'ethglobal', city: 'Mumbai', type: 'EVENT', kind: 'anchor', coord: [72.8697, 19.0653], tint: '#BFE3EC', theme: 'sky', icon: 'ticket' },
  { id: '03', name: 'Chhatrapati Shivaji Terminus', label: 'CSMT', art: 'csmt', city: 'Mumbai', type: 'LANDMARK', kind: 'geospatial', coord: [72.8355, 18.9398], tint: '#F6E27A', theme: 'sun', icon: 'train' },
];

// The list the app uses. Starts as the bundled spots and is replaced IN PLACE by the dashboard feed
// (backend/), so every screen that imports `spots` sees the update on its next render.
export const spots = [...BUNDLED];

// Where the app fetches spots from. Default: the Mac over USB (`adb reverse tcp:3000 tcp:3000`). For testing away from
// the cable, run `npm run share` in backend/ and paste the https URL it prints into Profile > Settings > Spot server
// (saved on the phone). EXPO_PUBLIC_FEED_URL sets the default at build time.
const DEFAULT_BASE = process.env.EXPO_PUBLIC_FEED_URL || 'http://127.0.0.1:3000';
const BASE_KEY = 'world3.feedBase';
let feedBase = DEFAULT_BASE;
export const getFeedBase = () => feedBase;
export const normaliseBase = (v) => {
  let t = String(v ?? '').trim().replace(/\/+$/, '').replace(/\/api\/v1\/spots$/, '');
  if (!t) return DEFAULT_BASE;
  if (!/^https?:\/\//i.test(t)) t = 'https://' + t;
  return t;
};
export async function loadFeedBase() {}
export async function setFeedBase(v) { return String(v); }
const TINTS = { coral: '#F9C9B0', sky: '#BFE3EC', sun: '#F6E27A', leaf: '#CFE8A8', ocean: '#9CC8EA' };

function fromFeed(f) {
  return {
    id: f.id, name: f.name, label: f.label, art: f.art, city: f.city,
    type: String(f.type).toUpperCase(), kind: f.kind, coord: f.coord,
    tint: TINTS[f.theme] ?? TINTS.coral, theme: f.theme, icon: f.icon,
    captureM: f.captureRadiusM, approachM: f.approachRadiusM,
    model: f.model ? { ...f.model, url: feedBase + f.model.url } : null,
  };
}

// Returns true when the list changed. On any failure the current list stays (offline = bundled spots).
// `force` skips the unchanged check and returns the number of spots fetched (or -1 on failure), for the settings test.
// Landing page: the spots are the bundled ones, nothing is fetched.
export async function refreshSpots(force = false) { return force ? spots.length : false; }

export const NEAR_METERS = 1500; // "Near" badge in lists (browsing only)
export const APPROACH_M = 100; // README: model appears, dimmed and locked
export const CAPTURE_M = 20; // README: capture zone

// 'far' | 'approaching' | 'zone', from a distance in metres (null = no GPS yet).
export function spotState(dist, spot) {
  if (dist == null) return 'far';
  if (dist <= (spot?.captureM ?? CAPTURE_M)) return 'zone';
  if (dist <= (spot?.approachM ?? APPROACH_M)) return 'approaching';
  return 'far';
}

export const shortName = (s) => s.label;
