// The app's server calls, replaced by a demo for the landing page: nothing leaves the browser, and everything succeeds the way it
// would for a signed-in person. (The real file is src/world.js; scripts/sync-app.mjs puts this one in its place.)
export class CaptureFailure extends Error {
  constructor(kind, message) { super(message); this.kind = kind; }
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
export async function loadSession() { return null; }
export async function signInWithWorldId({ onStage = () => {} } = {}) { onStage(0); await wait(500); onStage(1); await wait(500); return { id: 'demo' }; }
export async function signOut() {}
export async function getRecoveryCode() { return 'DEMO-CODE-ONLY-NOT-REAL'; }
export async function restoreAccount() { return { id: 'demo' }; }
export async function captureWithWorldId({ onStage = () => {} } = {}) { onStage(0); await wait(600); onStage(1); await wait(700); onStage(2); await wait(500); return { id: 'demo' }; }
export async function fetchAd() { return null; }
export function reportImpression() {}
const DEMO = { status: 'ready', name: 'a7k2.wrld3.eth', label: 'a7k2', path: '/p/a7k2', url: null, published: true, stamps: 3 };
export async function getPassport() { return { passport: DEMO, parent: 'wrld3.eth' }; }
export async function startPassport() { return { passport: DEMO, parent: 'wrld3.eth' }; }
export async function checkPassportName(label) { return { ok: /^[a-z0-9-]{3,20}$/.test(String(label)), reason: 'Use 3 to 20 letters, numbers or dashes.' }; }
export async function setPassportPublic(flag) { return { passport: { ...DEMO, published: !!flag }, parent: 'wrld3.eth' }; }
export async function fetchMyCaptures() { return []; }
const ago = (m) => new Date(Date.now() - m * 60000).toISOString();
export async function fetchExplorer({ limit = 10, q = '' } = {}) {
  const items = [
    { spotId: '02', spot: 'ETHGlobal Mumbai', city: 'Mumbai', theme: 'sky', who: '0x9B27…7337', at: ago(4) },
    { spotId: '01', spot: 'Gateway of India', city: 'Mumbai', theme: 'coral', who: '0x1000…CBd0', at: ago(19) },
    { spotId: '03', spot: 'Chhatrapati Shivaji Terminus', city: 'Mumbai', theme: 'sun', who: '0x4Ae1…90c2', at: ago(47) },
  ].filter((e) => !q || `${e.spot} ${e.who}`.toLowerCase().includes(String(q).toLowerCase()));
  return { total: items.length, items: items.slice(0, limit), spots: [] };
}
export function explorerUrl() { return null; }
export async function shareStamp() { return 'sheet'; }
