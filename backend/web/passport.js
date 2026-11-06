// The public passport page. It asks ENS (ENSv2 on Sepolia) directly from the visitor's browser: the stamps are the text record
// `world3.stamps` on the passport's own resolver. Our server only supplies the names and art of the spots, never the stamps.
import { createPublicClient, http, keccak256, parseAbi, stringToBytes } from 'viem';
import { normalize } from 'viem/ens';
import { sepolia } from 'viem/chains';

const PARENT = 'wrld3.eth';
const KEY = 'world3.stamps';
const UNIVERSAL_RESOLVER = '0xeEeEEEeE14D718C2B47D9923Deab1335E144EeEe'; // ENSv2 Universal Resolver (Sepolia)
const RPC = 'https://ethereum-sepolia-rpc.publicnode.com';
// The registry that holds passport subnames (deployed by backend/scripts/ens-setup.mjs; also in backend/data/ens.json). ENS answers with a
// fallback resolver even for names that do not exist, so whether a passport exists is asked of the registry itself: status 2 = registered.
const USER_REGISTRY = '0x0845e0ceecB3cF0E57535ef959B3341e2bDAdC38';
const registryAbi = parseAbi(['function getStatus(uint256 labelHash) view returns (uint8)']);
const TINT = { coral: '#F9C9B0', sky: '#BFE3EC', sun: '#F6E27A', leaf: '#CFE8A8', ocean: '#9CC8EA' };
const ICON = { business: '🏛️', ticket: '🎟️', train: '🚆', location: '📍', flag: '🚩', home: '🏠', boat: '⛵', flame: '🔥', triangle: '🔺', radio: '📻', time: '⏳', person: '🧍', grid: '▦', 'git-branch': '🔀' };
const $ = (s) => document.querySelector(s);
const el = (tag, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids.map((k) => (k instanceof Node ? k : document.createTextNode(String(k))))); return e; };

// /p/<label> (the share link) or ?name=<label>
function labelFromUrl() {
  const m = location.pathname.match(/^\/p\/([a-z0-9-]{1,32})\/?$/i);
  const q = new URLSearchParams(location.search).get('name');
  return (m?.[1] ?? q ?? '').toLowerCase().replace(new RegExp(`\\.${PARENT.replace('.', '\\.')}$`), '');
}
const validLabel = (l) => /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/.test(l);

// "05,06" -> ["05","06"]; anything odd is dropped, and the list is capped, so a hostile record cannot flood the page
export function parseStamps(value) {
  return [...new Set(String(value ?? '').split(',').map((s) => s.trim()).filter((s) => /^[A-Za-z0-9]{1,8}$/.test(s)))].slice(0, 200);
}

async function loadSpots() {
  try { return (await (await fetch('/api/v1/spots', { cache: 'no-store' })).json()).spots ?? []; } catch { return []; }
}

function renderStamps(ids, spots) {
  const grid = $('#stamps');
  grid.replaceChildren(...ids.map((id) => {
    const s = spots.find((x) => x.id === id);
    if (!s) return el('div', { className: 'stamp unknown' }, el('span', { className: 'no' }, id), el('span', { className: 'art' }, '✦'), el('span', { className: 'lbl' }, `SPOT ${id}`), el('span', { className: 'sub' }, 'No longer listed'));
    const card = el('div', { className: 'stamp' }, el('span', { className: 'no' }, s.id), el('span', { className: 'art', ariaHidden: 'true' }, ICON[s.icon] ?? '📍'), el('span', { className: 'lbl' }, s.label ?? s.name), el('span', { className: 'sub' }, [s.name, s.city].filter(Boolean).join(' · ')));
    card.style.setProperty('--tint', TINT[s.theme] ?? TINT.coral);
    card.title = s.name;
    return card;
  }));
}

async function show(label) {
  $('#lookup').hidden = true;
  $('#view').hidden = false;
  const full = `${label}.${PARENT}`;
  document.title = `${full} · wrld3 passport`;
  $('#name').textContent = full;
  $('#vName').textContent = full;
  $('#vApp').href = `https://sepolia.app.ens.domains/${full}`;
  $('#intro').textContent = 'Reading from ENS…';
  $('#snippet').textContent = `import { createPublicClient, http } from 'viem'\nimport { sepolia } from 'viem/chains'\n\nconst client = createPublicClient({ chain: sepolia, transport: http() })\nawait client.getEnsText({\n  name: '${full}',\n  key: '${KEY}',\n  universalResolverAddress: '${UNIVERSAL_RESOLVER}',\n})`;
  const client = createPublicClient({ chain: sepolia, transport: http(RPC) });
  const common = { name: normalize(full), universalResolverAddress: UNIVERSAL_RESOLVER };
  let value = null, resolver = null, exists = false, failed = false;
  try {
    const status = await client.readContract({ address: USER_REGISTRY, abi: registryAbi, functionName: 'getStatus', args: [BigInt(keccak256(stringToBytes(label)))] });
    exists = Number(status) === 2;
    if (exists) [value, resolver] = await Promise.all([client.getEnsText({ ...common, key: KEY }).catch(() => null), client.getEnsResolver(common).catch(() => null)]);
  } catch { failed = true; }
  const ids = parseStamps(value);
  const spots = await loadSpots();
  $('#vResolver').textContent = resolver ?? '–';
  $('#vValue').textContent = value ?? '(not set)';
  $('#chips').replaceChildren(el('span', { className: 'chip' }, `${ids.length} stamp${ids.length === 1 ? '' : 's'}`), el('span', { className: 'chip' }, 'Read live from ENS'), el('span', { className: 'chip' }, 'Non-transferable'));
  const empty = $('#empty');
  if (failed || !exists) {
    $('#intro').textContent = failed ? 'Could not reach ENS just now. Please try again.' : 'There is no passport with this name yet.';
    $('#chips').replaceChildren();
    empty.hidden = false; empty.textContent = failed ? 'The ENS network did not answer. Reload to try again.' : `${full} has not been created, or its owner has not published anything.`;
    renderStamps([], spots);
    return;
  }
  $('#intro').textContent = ids.length ? 'Places this traveler has been, each captured as a verified human standing there.' : 'This passport exists, but no stamps are published on it yet.';
  empty.hidden = ids.length > 0; empty.textContent = 'No stamps published yet.';
  renderStamps(ids, spots);
}

function init() {
  const label = labelFromUrl();
  if (label && validLabel(label)) return show(label);
  $('#lookup').hidden = false;
  if (label) { $('#lookupMsg').textContent = 'Passport names use letters, numbers and dashes.'; $('#lookupMsg').className = 'msg bad'; }
  $('#form').addEventListener('submit', (e) => {
    e.preventDefault();
    const l = $('#label').value.trim().toLowerCase().replace(/\.wrld3\.eth$/, '');
    if (!validLabel(l)) { $('#lookupMsg').textContent = 'Passport names use letters, numbers and dashes.'; $('#lookupMsg').className = 'msg bad'; return; }
    location.href = `/p/${l}`;
  });
}
$('#copy')?.addEventListener('click', async () => { try { await navigator.clipboard.writeText($('#snippet').textContent); $('#copy').textContent = 'Copied'; setTimeout(() => ($('#copy').textContent = 'Copy code'), 1500); } catch { /* the code is on screen */ } });
init();
