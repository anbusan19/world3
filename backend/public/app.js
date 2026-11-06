import { cartoonStyle, STREETS } from './mapStyle.js';

// World3 Spots dashboard. Plain browser JavaScript, no build step.
// Flow: pick or add a spot -> drag its pin / type coordinates -> upload a .glb -> publish -> the app sees it.

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const THEMES = {
  coral: { frame: '#F9A98B', sky: '#FFE9D6', hill: '#F7C59F', hill2: '#F2A065', accent: '#D9481C' },
  sky: { frame: '#8FD3E4', sky: '#E6F7FB', hill: '#B7E4D3', hill2: '#6FBF9C', accent: '#0A6EA6' },
  sun: { frame: '#F4D35E', sky: '#FFF7D1', hill: '#F9D77E', hill2: '#EFA93A', accent: '#B45F06' },
  leaf: { frame: '#A6D16C', sky: '#EDF7DA', hill: '#8CC152', hill2: '#5F9E2F', accent: '#2F6B14' },
  ocean: { frame: '#3D8FD0', sky: '#D6EAF8', hill: '#7FB8E3', hill2: '#0265AD', accent: '#0B4F86' },
};
const THEME_NAMES = { coral: 'Coral', sky: 'Sky', sun: 'Sun', leaf: 'Leaf', ocean: 'Ocean' };
const ARTS = [['', 'None (use the model image)'], ['gateway', 'Gateway of India'], ['ethglobal', 'ETHGlobal Mumbai'], ['csmt', 'CSMT station'], ['ens', 'ENS logo'], ['arkiv', 'Arkiv logo'], ['world', 'World logo']];
const FIELDS = ['name', 'label', 'city', 'type', 'kind', 'lat', 'lng', 'captureRadiusM', 'approachRadiusM', 'heading', 'scale', 'heightOffsetM', 'theme', 'art', 'published', 'onArkiv', 'eventId', 'requiresFrom', 'requiresMin'];
const NUMBERS = new Set(['lat', 'lng', 'captureRadiusM', 'approachRadiusM', 'heading', 'scale', 'heightOffsetM']);
const DEFAULT_CENTER = [72.8347, 18.9322];

const state = { spots: [], sel: null, draft: null, placing: false, base: 'cartoon' };
let map;
const markers = new Map();
const dark = matchMedia('(prefers-color-scheme: dark)').matches;

/* ---------------------------------- helpers ---------------------------------- */

async function api(method, url, body, headers = {}) {
  const raw = body instanceof Blob;
  const res = await fetch(url, {
    method,
    headers: { 'x-requested-with': 'world3-dashboard', ...(body !== undefined && !raw ? { 'content-type': 'application/json' } : {}), ...headers },
    body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.issues = data.issues;
    throw err;
  }
  return data;
}

function toast(msg, kind = '') {
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = msg;
  $('#toasts').append(el);
  setTimeout(() => el.remove(), kind === 'bad' ? 6000 : 2600);
}

const saved = () => state.spots.find((s) => s.id === state.sel) ?? null;
const pick = (s) => ({ ...Object.fromEntries(FIELDS.map((k) => [k, s[k] ?? (k === 'art' ? '' : k === 'city' ? '' : s[k])])), eventId: s.eventId ?? 'ethmumbai', requiresFrom: s.requires?.from?.join(', ') ?? '', requiresMin: s.requires?.min ?? '' });
const norm = (d) => JSON.stringify(FIELDS.map((k) => (NUMBERS.has(k) && d[k] !== '' ? Number(d[k]) : d[k])));
const isDirty = () => !!state.draft && !!saved() && norm(state.draft) !== norm(pick(saved()));

function validate(d) {
  const e = {};
  const n = (k, min, max, msg) => {
    const v = d[k];
    if (v === '' || !Number.isFinite(Number(v)) || Number(v) < min || Number(v) > max) e[k] = msg;
  };
  if (d.name.trim().length < 2 || d.name.trim().length > 60) e.name = 'Give it a name between 2 and 60 characters.';
  if (!/^[A-Za-z0-9 ]{2,14}$/.test(d.label.trim())) e.label = '2 to 14 letters or numbers, like GATEWAY.';
  n('lat', -90, 90, 'Latitude must be between -90 and 90.');
  n('lng', -180, 180, 'Longitude must be between -180 and 180.');
  n('captureRadiusM', 5, 200, 'Between 5 and 200 m.');
  n('approachRadiusM', 20, 500, 'Between 20 and 500 m.');
  n('heading', 0, 360, 'Between 0 and 360.');
  n('scale', 0.05, 20, 'Between 0.05 and 20.');
  n('heightOffsetM', -5, 50, 'Between -5 and 50 m.');
  if (!e.captureRadiusM && !e.approachRadiusM && Number(d.approachRadiusM) <= Number(d.captureRadiusM)) e.approachRadiusM = 'Must be bigger than the capture radius.';
  return e;
}

// the same notched outline the app draws, so the preview is the real stamp shape
function perforated(w, h, r) {
  const nx = Math.max(4, Math.round(w / (r * 4.2)));
  const ny = Math.max(4, Math.round(h / (r * 4.2)));
  const px = w / nx, py = h / ny;
  let d = 'M0 0';
  for (let i = 0; i < nx; i++) { const c = (i + 0.5) * px; d += ` L${c - r} 0 A${r} ${r} 0 0 0 ${c + r} 0`; }
  d += ` L${w} 0`;
  for (let j = 0; j < ny; j++) { const c = (j + 0.5) * py; d += ` L${w} ${c - r} A${r} ${r} 0 0 0 ${w} ${c + r}`; }
  d += ` L${w} ${h}`;
  for (let i = nx - 1; i >= 0; i--) { const c = (i + 0.5) * px; d += ` L${c + r} ${h} A${r} ${r} 0 0 0 ${c - r} ${h}`; }
  d += ` L0 ${h}`;
  for (let j = ny - 1; j >= 0; j--) { const c = (j + 0.5) * py; d += ` L0 ${c + r} A${r} ${r} 0 0 0 0 ${c - r}`; }
  return `${d} Z`;
}

function stampSvg(d, id, imageUrl, w = 132) {
  const t = THEMES[d.theme] ?? THEMES.coral;
  const h = Math.round(w / 0.82);
  const r = Math.max(1.8, w * 0.026);
  const pad = Math.max(4, w * 0.05);
  const labelH = w * 0.17;
  const sw = w - 2 * pad, sh = h - 2 * pad - labelH;
  const clip = `c${Math.random().toString(36).slice(2, 8)}`;
  const art = imageUrl
    ? `<image href="${esc(imageUrl)}" x="${pad}" y="${pad}" width="${sw}" height="${sh}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clip})"/>`
    : `<g clip-path="url(#${clip})"><circle cx="${pad + sw * 0.75}" cy="${pad + sh * 0.25}" r="${sw * 0.12}" fill="#F26B21"/><ellipse cx="${pad + sw * 0.28}" cy="${pad + sh * 1.02}" rx="${sw * 0.55}" ry="${sh * 0.34}" fill="${t.hill}"/><ellipse cx="${pad + sw * 0.82}" cy="${pad + sh * 1.08}" rx="${sw * 0.55}" ry="${sh * 0.38}" fill="${t.hill2}"/></g>`;
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Stamp preview">
    <path d="${perforated(w, h, r)}" fill="${t.frame}"/>
    <defs><clipPath id="${clip}"><rect x="${pad}" y="${pad}" width="${sw}" height="${sh}" rx="3"/></clipPath></defs>
    <rect x="${pad}" y="${pad}" width="${sw}" height="${sh}" rx="3" fill="${t.sky}"/>${art}
    <rect x="${pad}" y="${pad}" width="${sw}" height="${sh}" rx="3" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="1.5"/>
    <text x="${w / 2}" y="${h - pad - labelH * 0.26}" text-anchor="middle" font-family="Plus Jakarta Sans, sans-serif" font-weight="800" font-size="${w * 0.092}" letter-spacing="1" fill="${t.accent}">${esc((d.label || '').toUpperCase())}</text>
    <rect x="${pad + 5}" y="${pad + 5}" width="${w * 0.17}" height="${w * 0.1}" rx="5" fill="#0B0B0F"/>
    <text x="${pad + 5 + w * 0.085}" y="${pad + 5 + w * 0.073}" text-anchor="middle" font-family="Plus Jakarta Sans, sans-serif" font-weight="700" font-size="${w * 0.06}" fill="#fff">${esc(id)}</text>
  </svg>`;
}

function circle(lng, lat, r, n = 72) {
  const dLat = r / 111320, dLng = r / (111320 * Math.cos((lat * Math.PI) / 180));
  const ring = Array.from({ length: n + 1 }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return [lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)];
  });
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } };
}

const imageUrl = (s) => (s?.image ? `/files/images/${s.image.file}` : null);
const fmt = (n, d = 1) => Number(n).toFixed(d).replace(/\.0+$/, '');

/* ------------------------------------ map ------------------------------------ */

function initMap() {
  map = new maplibregl.Map({ container: 'map', style: cartoonStyle(dark), center: DEFAULT_CENTER, zoom: 12, attributionControl: { compact: true } });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
  // the page layout settles after the map is created, so keep the map's size in step with its container
  new ResizeObserver(() => map.resize()).observe(map.getContainer());
  map.on('style.load', ensureRadii);
  map.on('click', (e) => {
    if (!state.placing) return;
    setPlacing(false);
    createAt(e.lngLat.lng, e.lngLat.lat);
  });
}

function ensureRadii() {
  if (!map.getSource('radii')) {
    map.addSource('radii', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addLayer({ id: 'radii-approach', type: 'line', source: 'radii', filter: ['==', ['get', 'k'], 'approach'], paint: { 'line-color': '#0265AD', 'line-width': 2.5, 'line-dasharray': [2, 2] } });
    map.addLayer({ id: 'radii-capture-fill', type: 'fill', source: 'radii', filter: ['==', ['get', 'k'], 'capture'], paint: { 'fill-color': '#A6D16C', 'fill-opacity': 0.35 } });
    map.addLayer({ id: 'radii-capture', type: 'line', source: 'radii', filter: ['==', ['get', 'k'], 'capture'], paint: { 'line-color': '#4F8A1E', 'line-width': 2.5 } });
  }
  updateRadii();
}

function updateRadii() {
  const src = map?.getSource('radii');
  if (!src) return;
  const d = state.draft;
  const ok = d && Number.isFinite(Number(d.lat)) && Number.isFinite(Number(d.lng)) && d.lat !== '' && d.lng !== '';
  const features = [];
  if (ok) {
    const cap = Number(d.captureRadiusM), app = Number(d.approachRadiusM);
    if (Number.isFinite(app) && app > 0) features.push({ ...circle(+d.lng, +d.lat, app), properties: { k: 'approach' } });
    if (Number.isFinite(cap) && cap > 0) features.push({ ...circle(+d.lng, +d.lat, cap), properties: { k: 'capture' } });
  }
  src.setData({ type: 'FeatureCollection', features });
}

function syncMarkers() {
  const ids = new Set(state.spots.map((s) => s.id));
  for (const [id, m] of markers) if (!ids.has(id)) { m.remove(); markers.delete(id); }
  for (const s of state.spots) {
    const view = s.id === state.sel && state.draft ? state.draft : s;
    const theme = THEMES[view.theme] ?? THEMES.coral;
    let m = markers.get(s.id);
    if (!m) {
      const el = document.createElement('div');
      el.addEventListener('click', (ev) => { ev.stopPropagation(); select(s.id); });
      m = new maplibregl.Marker({ element: el, anchor: 'center' });
      m.on('dragend', () => {
        if (state.sel !== s.id || !state.draft) return;
        const ll = m.getLngLat();
        state.draft.lat = +ll.lat.toFixed(6);
        state.draft.lng = +ll.lng.toFixed(6);
        for (const f of ['lat', 'lng']) { const i = $(`[data-f="${f}"]`); if (i) i.value = state.draft[f]; }
        afterEdit('pin');
      });
      markers.set(s.id, m);
    }
    const el = m.getElement();
    el.className = `pin${s.published ? '' : ' draft'}${s.id === state.sel ? ' sel' : ''}`;
    el.style.background = theme.frame;
    el.textContent = s.id;
    el.title = `${s.name}${s.published ? '' : ' (draft)'}`;
    const lat = Number(view.lat), lng = Number(view.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) m.setLngLat([lng, lat]).addTo(map);
    m.setDraggable(s.id === state.sel);
  }
}

function setPlacing(on) {
  state.placing = on;
  $('#map').classList.toggle('placing', on);
  const hint = $('#hint');
  hint.hidden = !on;
  hint.innerHTML = on ? 'Click the map to drop the pin <button type="button" id="atCentre">or add at the map centre</button>' : '';
  $('#new').textContent = on ? 'Cancel' : '+ New spot';
}

/* ------------------------------------ list ------------------------------------ */

function renderKpis() {
  const el = $('#kpis'); if (!el) return;
  const n = state.spots.length, pub = state.spots.filter((s) => s.published).length;
  const tiles = [[n, 'spots', ''], [pub, 'published', 'green'], [n - pub, 'drafts', ''], [state.spots.filter((s) => s.model).length, 'with a 3D model', ''], [state.spots.filter((s) => s.arkivInfo).length, 'on Arkiv', ''], [state.spots.filter((s) => s.chain?.status && !s.chain.status.closed).length, 'on chain', 'green']];
  el.innerHTML = tiles.map(([v, l, c]) => `<div class="kpi ${c}"><b data-to="${v}">${v}</b><span>${l}</span></div>`).join('');
  if (!renderKpis.done && !matchMedia('(prefers-reduced-motion: reduce)').matches) { // count up once, the first time
    renderKpis.done = true;
    el.querySelectorAll('b').forEach((b) => { const to = Number(b.dataset.to); const t0 = performance.now(); const tick = (t) => { const k = Math.min(1, (t - t0) / 900); b.textContent = Math.round(to * (1 - (1 - k) ** 3)); if (k < 1) requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
  }
}

function renderList() {
  renderKpis();
  const ul = $('#spots');
  if (!state.spots.length) {
    ul.innerHTML = '<li style="cursor:default;color:var(--muted)">No spots yet. Click “New spot”, then click the map.</li>';
    return;
  }
  ul.innerHTML = state.spots
    .map((s) => {
      const v = s.id === state.sel && state.draft ? { ...s, ...state.draft } : s;
      const t = THEMES[v.theme] ?? THEMES.coral;
      return `<li data-id="${s.id}" class="${s.id === state.sel ? 'sel' : ''}">
        <div class="dot" style="background:${t.frame}">${s.id}</div>
        <div><div class="name">${esc(v.name)}</div>
        <div class="sub"><span class="tag ${s.published ? 'pub' : ''}">${s.published ? 'Published' : 'Draft'}</span>
        <span class="tag">${v.kind === 'anchor' ? 'QR anchor' : 'Outdoor'}</span>
        ${s.model ? '<span class="tag model">3D model</span>' : '<span class="tag">No model</span>'}${s.chain?.status && !s.chain.status.closed ? '<span class="tag chain">On chain</span>' : ''}</div></div></li>`;
    })
    .join('');
}

/* ----------------------------------- editor ----------------------------------- */

function field(label, f, type, extra = '', hint = '') {
  return `<label class="field" data-w="${f}"><span>${label}${hint ? ` <small>${hint}</small>` : ''}</span>
    <input data-f="${f}" type="${type}" ${extra} value="${esc(state.draft[f])}"><div class="err" data-e="${f}"></div></label>`;
}
function seg(f, options) {
  return `<div class="seg2" data-seg="${f}">${options.map(([v, b, small]) => `<button type="button" data-v="${v}" class="${state.draft[f] === v ? 'on' : ''}"><b>${b}</b><small>${small}</small></button>`).join('')}</div>`;
}

function renderEditor() {
  const ed = $('#editor');
  const spot = saved();
  if (!spot || !state.draft) {
    ed.innerHTML = `<div class="empty"><div class="big">📍</div><h3>Pick a spot, or add one</h3>
      <p>Select a spot on the map or in the list to edit it. To add a new one, click “New spot” and then click where it should be on the map.</p></div>`;
    return;
  }
  const d = state.draft;
  ed.innerHTML = `
    <div class="ehead">
      <div class="stampbox" data-stamp="head"></div>
      <div style="flex:1;min-width:0"><span class="id">SPOT ${spot.id}</span><h3 data-title></h3>
        <label class="sw" style="margin-top:8px"><span class="switch"><input type="checkbox" data-f="published" ${d.published ? 'checked' : ''}><i></i></span><span data-pubtext></span></label>
        <label class="sw" style="margin-top:6px"><span class="switch"><input type="checkbox" data-f="onArkiv" ${d.onArkiv ? 'checked' : ''}><i></i></span><span>List on Arkiv (public: name and a rounded location, about 100 m)</span></label>
        <div class="fine" data-arkivtext style="margin-top:4px"></div>
        <div class="fine" data-chaintext style="margin-top:4px"></div></div>
    </div>
    <div class="scroll">
      <div class="sec"><h4>Basics</h4>
        ${field('Name', 'name', 'text', 'maxlength="60"')}
        <div class="row">${field('Stamp label', 'label', 'text', 'maxlength="14"', '(on the stamp)')}${field('City', 'city', 'text', 'maxlength="40"')}</div>
        <div class="field"><span>Type</span>${seg('type', [['LANDMARK', 'Landmark', 'A place anyone can visit'], ['EVENT', 'Event', 'A venue or happening']])}</div>
        <div class="field"><span>How it is verified</span>${seg('kind', [['geospatial', 'Outdoor', 'Camera + GPS fix at the place'], ['anchor', 'QR anchor', 'Scan a code at the venue'], ['quest', 'Quest', 'Claimed anywhere once its other stamps are collected']])}</div>
        <label class="field"><span>Event <small>(when it opens and closes)</small></span><select data-f="eventId">${(state.events ?? [{ id: 'ethmumbai', name: 'ETHGlobal Mumbai' }]).map((e) => `<option value="${esc(e.id)}" ${d.eventId === e.id ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}</select></label>
        <div class="row">${field('Quest needs spots', 'requiresFrom', 'text', 'placeholder="e.g. 67, 68, 69"', '(ids, optional)')}${field('How many', 'requiresMin', 'number', 'min="1"')}</div>
      </div>

      <div class="sec"><h4>Location</h4>
        <div class="row">${field('Latitude', 'lat', 'number', 'step="0.00001"')}${field('Longitude', 'lng', 'number', 'step="0.00001"')}</div>
        <div class="actions" style="margin:-2px 0 10px"><button type="button" class="btn sm" data-act="centre">Move pin to map centre</button><small style="color:var(--muted)">or drag the pin on the map</small></div>
        <div class="row">${field('Capture radius', 'captureRadiusM', 'number', 'step="1"', '(m)')}${field('Approach radius', 'approachRadiusM', 'number', 'step="5"', '(m)')}</div>
        <p class="fine" style="padding:0;margin:-4px 0 0">Green is where the capture button works. The dashed line is where the model starts to appear.</p>
      </div>

      <div class="sec"><h4>3D model</h4>
        <div id="model"></div>
        <div class="row" style="margin-top:12px">${field('Scale', 'scale', 'number', 'step="0.05"', '(1 = as exported)')}${field('Heading', 'heading', 'number', 'step="5"', '(° from north)')}</div>
        ${field('Height offset', 'heightOffsetM', 'number', 'step="0.1"', '(m above the ground)')}
        <p class="fine" style="padding:0;margin:-4px 0 0" id="realsize"></p>
      </div>

      <div class="sec"><h4>Stamp</h4>
        <div class="field"><span>Colour</span><div class="swatches" data-seg="theme">${Object.keys(THEMES).map((k) => `<button type="button" data-v="${k}" title="${THEME_NAMES[k]}" class="${d.theme === k ? 'on' : ''}" style="background:${THEMES[k].frame}"></button>`).join('')}</div></div>
        <label class="field"><span>Illustration already in the app <small>(optional)</small></span>
          <select data-f="art">${ARTS.map(([v, n]) => `<option value="${v}" ${d.art === v ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <div id="stampImg"></div>
      </div>
    </div>
    <div class="efoot">
      <span class="dirty" id="dirty"></span>
      <button type="button" class="btn danger" data-act="delete">Delete</button>
      <button type="button" class="btn" data-act="revert">Revert</button>
      <button type="button" class="btn primary" data-act="save" id="saveBtn">Save</button>
    </div>`;
  renderModel();
  refreshDerived();
}

// everything on screen that depends on the draft but must not rebuild the inputs (that would steal focus)
function refreshDerived() {
  const d = state.draft, spot = saved();
  if (!d || !spot) return;
  const errs = validate(d);
  for (const el of document.querySelectorAll('[data-e]')) {
    el.textContent = errs[el.dataset.e] ?? '';
    el.closest('.field')?.classList.toggle('bad', !!errs[el.dataset.e]);
  }
  const title = $('[data-title]'); if (title) title.textContent = d.name || 'Untitled spot';
  const ch = $('[data-chaintext]');
  if (ch) {
    const c = spot.chain;
    ch.replaceChildren();
    if (!c) ch.textContent = 'Stamp contract: not configured on this server.';
    else if (c.pending) ch.textContent = 'Registering on Sepolia…';
    else if (c.error) ch.textContent = `Not on chain yet: ${c.error}. Saving again retries.`;
    else if (c.status && !c.status.closed) { ch.append('On Sepolia: anyone can see this stamp and mint it. '); if (c.txUrl) { const a = document.createElement('a'); a.href = c.txUrl; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = 'registration ↗'; ch.append(a); } }
    else if (c.status?.closed) ch.textContent = 'Closed on chain: no new stamps.';
    else ch.textContent = spot.published ? 'Waiting to be registered on Sepolia…' : 'Registered on Sepolia when you publish it.';
  }
  const ak = $('[data-arkivtext]');
  if (ak) {
    const a = spot.arkivInfo;
    ak.textContent = !spot.arkivEnabled ? 'Arkiv is not set up on this server.' : a ? `On Arkiv: entity ${a.entityKey.slice(0, 10)}…${a.entityKey.slice(-6)}, expires ${a.expiresOn}.` : d.onArkiv && !d.published ? 'Publish the spot first; Arkiv only lists published spots.' : d.onArkiv ? 'Save to put it on Arkiv.' : 'Not on Arkiv.';
  }
  const pub = $('[data-pubtext]'); if (pub) pub.textContent = d.published ? 'Published: the app can see it' : 'Draft: only you can see it';
  const head = $('[data-stamp="head"]'); if (head) head.innerHTML = stampSvg(d, spot.id, imageUrl(spot), 96);
  renderStampImage();
  const dirty = isDirty();
  const hasErr = Object.keys(errs).length > 0;
  const btn = $('#saveBtn'); if (btn) btn.disabled = !dirty || hasErr || state.busy;
  const rev = $('[data-act="revert"]'); if (rev) rev.disabled = !dirty;
  const note = $('#dirty'); if (note) note.textContent = hasErr ? 'Fix the highlighted fields' : dirty ? 'Unsaved changes' : '';
  const size = spot.model?.stats?.bbox?.size;
  const rs = $('#realsize');
  if (rs) {
    const k = Number(d.scale);
    rs.textContent = size && Number.isFinite(k) ? `Real size in the world: ${size.map((v) => fmt(v * k, 1)).join(' × ')} m (width × height × depth) at this scale.` : spot.model ? '' : 'Upload a model to see its real size here.';
  }
}

function afterEdit(f) {
  if (['lat', 'lng', 'theme', 'published', 'name'].includes(f) || f === 'pin') syncMarkers();
  if (['lat', 'lng', 'captureRadiusM', 'approachRadiusM', 'pin'].includes(f)) updateRadii();
  renderList();
  refreshDerived();
}

function renderStampImage() {
  const box = $('#stampImg'), spot = saved();
  if (!box || !spot) return;
  box.innerHTML = `<div class="stampbox">${stampSvg(state.draft, spot.id, imageUrl(spot), 132)}</div>
    ${spot.image ? `<div class="thumb"><img src="${esc(imageUrl(spot))}" alt=""><div><b>Stamp image</b><div class="actions" style="margin-top:4px"><button type="button" class="btn sm danger" data-act="remove-image">Remove image</button></div></div></div>`
      : `<p class="fine" style="padding:0;text-align:center">${spot.model ? 'Turn the model to a good angle, then use “Use this view as the stamp image”.' : 'No stamp image yet. Upload a model, then capture a view of it.'}</p>`}`;
}

/* ----------------------------------- model ----------------------------------- */

function renderModel(busy = '') {
  const box = $('#model'), spot = saved();
  if (!box || !spot) return;
  if (busy) {
    box.innerHTML = `<div class="drop"><b><span class="spin"></span>${esc(busy)}</b>This can take a few seconds for big files.</div>`;
    return;
  }
  if (!spot.model) {
    box.innerHTML = `<div class="drop" id="drop"><b>Drop your .glb file here</b>One file per spot, ideally 2 to 5 MB, with the base at ground level.
      <div><button type="button" class="btn sm" data-act="pick-model">Choose a file</button></div></div>`;
    return;
  }
  const m = spot.model, st = m.stats, bb = st.bbox;
  box.innerHTML = `<model-viewer id="mv" src="/files/models/${esc(m.file)}" alt="3D model of ${esc(spot.name)}" camera-controls auto-rotate shadow-intensity="1" exposure="1.1" interaction-prompt="none" crossorigin="anonymous"></model-viewer>
    <div class="stats">
      <div><span>File</span><b>${esc(m.originalName || m.file)}</b></div>
      <div><span>Size on disk</span><b>${fmt(m.bytes / 1048576, 2)} MB</b></div>
      <div><span>Dimensions</span><b>${bb ? bb.size.map((v) => fmt(v, 1)).join(' × ') + ' m' : 'unknown'}</b></div>
      <div><span>Triangles</span><b>${st.triangles.toLocaleString('en-US')}</b></div>
      <div><span>Materials / textures</span><b>${st.materials} / ${st.textures}</b></div>
      <div><span>Compressed</span><b>${st.compressed ? 'Yes' : 'No'}</b></div>
    </div>
    ${m.warnings?.length ? m.warnings.map((w) => `<div class="warn">${esc(w)}</div>`).join('') : '<div class="warn ok">Looks good: a sensible size, weight and ground level.</div>'}
    <div class="actions">
      <button type="button" class="btn sm green" data-act="snap">Use this view as the stamp image</button>
      <button type="button" class="btn sm" data-act="pick-model">Replace file</button>
      <button type="button" class="btn sm danger" data-act="remove-model">Remove</button>
    </div>`;
}

async function uploadModel(file) {
  const spot = saved();
  if (!spot || !file) return;
  if (!/\.glb$/i.test(file.name)) return toast('That is not a .glb file. Export your model as a single binary .glb.', 'bad');
  renderModel(`Checking ${file.name}…`);
  try {
    const { spot: next } = await api('PUT', `/api/spots/${spot.id}/model`, file, { 'content-type': 'application/octet-stream', 'x-filename': file.name });
    replaceSaved(next);
    toast(next.model.warnings.length ? 'Model added, with a few things to check' : 'Model added');
  } catch (e) {
    toast(e.message, 'bad');
  }
  renderModel();
  renderList();
  refreshDerived();
}

async function snapshot() {
  const spot = saved(), mv = $('#mv');
  if (!spot || !mv) return;
  try {
    await customElements.whenDefined('model-viewer');
    const blob = await mv.toBlob({ mimeType: 'image/png', idealAspect: true });
    const { spot: next } = await api('PUT', `/api/spots/${spot.id}/image`, blob, { 'content-type': 'image/png' });
    replaceSaved(next);
    toast('Stamp image saved');
    refreshDerived();
  } catch (e) {
    toast(`Could not capture the view: ${e.message}`, 'bad');
  }
}

/* ------------------------------ saving and selecting ------------------------------ */

// take the server's copy of a spot without touching what the person is still typing
function replaceSaved(next) {
  const i = state.spots.findIndex((s) => s.id === next.id);
  if (i >= 0) state.spots[i] = next;
}

function select(id) {
  if (id === state.sel) return;
  if (isDirty() && !confirm('You have unsaved changes on this spot. Discard them?')) return;
  state.sel = id;
  state.draft = id ? pick(saved()) : null;
  history.replaceState(null, '', id ? `#${id}` : location.pathname);
  renderEditor();
  renderList();
  syncMarkers();
  updateRadii();
  const s = saved();
  if (s && map) map.flyTo({ center: [s.lng, s.lat], zoom: Math.max(map.getZoom(), 15.8), duration: 700 });
}

async function save() {
  const spot = saved();
  if (!spot || state.busy) return;
  const errs = validate(state.draft);
  if (Object.keys(errs).length) return refreshDerived();
  state.busy = true;
  refreshDerived();
  try {
    const d = state.draft;
    const body = { ...d, name: d.name.trim(), label: d.label.trim().toUpperCase(), city: d.city.trim(), art: d.art || null };
    for (const k of NUMBERS) body[k] = Number(body[k]);
    body.requires = d.requiresFrom.trim() ? { from: d.requiresFrom.split(/[ ,]+/).filter(Boolean), min: Number(d.requiresMin) || 1 } : null;
    delete body.requiresFrom; delete body.requiresMin;
    const { spot: next, arkivError } = await api('PUT', `/api/spots/${spot.id}`, body);
    replaceSaved(next);
    state.draft = pick(next);
    toast(arkivError ? `Saved, but Arkiv said: ${arkivError}` : 'Saved');
    renderEditor();
    renderList();
    syncMarkers();
    updateRadii();
  } catch (e) {
    toast(e.message, 'bad');
    for (const i of e.issues ?? []) {
      const el = document.querySelector(`[data-e="${i.field}"]`);
      if (el) { el.textContent = i.message; el.closest('.field')?.classList.add('bad'); }
    }
  } finally {
    state.busy = false;
    refreshDerived();
  }
}

async function createAt(lng, lat) {
  try {
    const { spot } = await api('POST', '/api/spots', { name: 'New spot', lat: +lat.toFixed(6), lng: +lng.toFixed(6) });
    state.spots.push(spot);
    state.sel = null;
    state.draft = null;
    select(spot.id);
    toast('Spot added as a draft. Give it a name.');
    const name = $('[data-f="name"]');
    name?.focus();
    name?.select();
    pingStatus();
  } catch (e) {
    toast(e.message, 'bad');
  }
}

async function removeSpot() {
  const spot = saved();
  if (!spot || !confirm(`Delete “${spot.name}” and its files? This cannot be undone.`)) return;
  try {
    await api('DELETE', `/api/spots/${spot.id}`);
    state.spots = state.spots.filter((s) => s.id !== spot.id);
    state.sel = null;
    state.draft = null;
    history.replaceState(null, '', location.pathname);
    renderEditor();
    renderList();
    syncMarkers();
    updateRadii();
    toast('Spot deleted');
    pingStatus();
  } catch (e) {
    toast(e.message, 'bad');
  }
}

/* ------------------------------------ events ------------------------------------ */

function bindEvents() {
  const ed = $('#editor');

  ed.addEventListener('input', (e) => {
    const el = e.target.closest('[data-f]');
    if (!el || !state.draft) return;
    const f = el.dataset.f;
    state.draft[f] = el.type === 'checkbox' ? el.checked : NUMBERS.has(f) ? (el.value === '' ? '' : Number(el.value)) : el.value;
    afterEdit(f);
  });
  ed.addEventListener('change', (e) => {
    if (e.target.matches('input[type="file"]')) uploadModel(e.target.files[0]);
    const el = e.target.closest('select[data-f]');
    if (el) { state.draft[el.dataset.f] = el.value; afterEdit(el.dataset.f); }
  });
  ed.addEventListener('click', (e) => {
    const segBtn = e.target.closest('[data-seg] button');
    if (segBtn && state.draft) {
      const group = segBtn.closest('[data-seg]');
      state.draft[group.dataset.seg] = segBtn.dataset.v;
      group.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === segBtn));
      afterEdit(group.dataset.seg);
      return;
    }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act) return;
    if (act === 'save') save();
    else if (act === 'revert') { state.draft = pick(saved()); renderEditor(); renderList(); syncMarkers(); updateRadii(); }
    else if (act === 'delete') removeSpot();
    else if (act === 'centre') {
      const c = map.getCenter();
      state.draft.lat = +c.lat.toFixed(6);
      state.draft.lng = +c.lng.toFixed(6);
      for (const f of ['lat', 'lng']) $(`[data-f="${f}"]`).value = state.draft[f];
      afterEdit('pin');
    }
    else if (act === 'pick-model') {
      const input = Object.assign(document.createElement('input'), { type: 'file', accept: '.glb,model/gltf-binary' });
      input.addEventListener('change', () => uploadModel(input.files[0]));
      input.click();
    }
    else if (act === 'remove-model') {
      if (!confirm('Remove this model from the spot?')) return;
      api('DELETE', `/api/spots/${state.sel}/model`).then(({ spot }) => { replaceSaved(spot); renderModel(); renderList(); refreshDerived(); toast('Model removed'); }).catch((err) => toast(err.message, 'bad'));
    }
    else if (act === 'snap') snapshot();
    else if (act === 'remove-image') {
      api('DELETE', `/api/spots/${state.sel}/image`).then(({ spot }) => { replaceSaved(spot); refreshDerived(); syncMarkers(); }).catch((err) => toast(err.message, 'bad'));
    }
  });
  // drag a .glb file onto the drop zone
  ed.addEventListener('dragover', (e) => { const z = e.target.closest('.drop'); if (z) { e.preventDefault(); z.classList.add('over'); } });
  ed.addEventListener('dragleave', (e) => e.target.closest('.drop')?.classList.remove('over'));
  ed.addEventListener('drop', (e) => {
    const z = e.target.closest('.drop');
    if (!z) return;
    e.preventDefault();
    z.classList.remove('over');
    uploadModel(e.dataTransfer.files[0]);
  });

  $('#spots').addEventListener('click', (e) => {
    const li = e.target.closest('li[data-id]');
    if (li) select(li.dataset.id);
  });
  $('#new').addEventListener('click', () => setPlacing(!state.placing));
  $('#hint').addEventListener('click', (e) => {
    if (e.target.id !== 'atCentre') return;
    const c = map.getCenter();
    setPlacing(false);
    createAt(c.lng, c.lat);
  });
  $('#basemap').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || b.dataset.v === state.base) return;
    state.base = b.dataset.v;
    $('#basemap').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    map.setStyle(state.base === 'cartoon' ? cartoonStyle(dark) : STREETS);
  });
  $('#find').addEventListener('submit', (e) => {
    e.preventDefault();
    const m = $('#findInput').value.match(/(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)/);
    if (!m) return toast('Type or paste coordinates like 18.922, 72.8347', 'bad');
    const [lat, lng] = [Number(m[1]), Number(m[2])];
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return toast('Those coordinates are out of range. Latitude comes first.', 'bad');
    map.flyTo({ center: [lng, lat], zoom: 16, duration: 900 });
  });
  $('#locate').addEventListener('click', () => {
    if (!navigator.geolocation) return toast('Your browser cannot share your location.', 'bad');
    navigator.geolocation.getCurrentPosition((p) => map.flyTo({ center: [p.coords.longitude, p.coords.latitude], zoom: 16 }), () => toast('Could not get your location.', 'bad'), { timeout: 8000 });
  });

  addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
    if (e.key === 'Escape' && state.placing) setPlacing(false);
  });
  addEventListener('beforeunload', (e) => { if (isDirty()) { e.preventDefault(); e.returnValue = ''; } });
}

/* ------------------------------------ event clock ------------------------------------ */

let eventInfo = null;
function renderEvent() {
  const chip = $('#eventChip'); if (!chip || !eventInfo) return;
  const e = eventInfo; const ms = e.endsAt ? Date.parse(e.endsAt) - Date.now() : null;
  chip.classList.toggle('over', ms != null && ms <= 0);
  if (ms == null) chip.textContent = 'No end time set';
  else if (ms <= 0) chip.textContent = `${e.name} is over · spots hidden`;
  else {
    const m = Math.floor(ms / 60000); const d = Math.floor(m / 1440); const h = Math.floor((m % 1440) / 60);
    chip.textContent = `Ends in ${d ? `${d} d ` : ''}${h || d ? `${h} h` : `${m} min`} · ${new Date(e.endsAt).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })}`;
  }
}
async function loadEvent() { try { eventInfo = await api('GET', '/api/event'); renderEvent(); } catch { /* the chip just stays as it was */ } }
function wireEvent() {
  const form = $('#eventForm'); if (!form) return;
  $('#eventChip').addEventListener('click', () => {
    form.hidden = !form.hidden; $('#eventChip').setAttribute('aria-expanded', String(!form.hidden));
    if (!form.hidden && eventInfo?.endsAt) { const d = new Date(eventInfo.endsAt); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); $('#eventEnd').value = d.toISOString().slice(0, 16); }
  });
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    try { eventInfo = await api('PUT', '/api/event', { endsAt: new Date($('#eventEnd').value).toISOString() }); renderEvent(); form.hidden = true; toast('Event end time saved.'); } catch (e) { toast(e.message, 'bad'); }
  });
  $('#eventClear').addEventListener('click', async () => {
    try { eventInfo = await api('PUT', '/api/event', { endsAt: null }); renderEvent(); form.hidden = true; toast('The event has no end time now.'); } catch (e) { toast(e.message, 'bad'); }
  });
  loadEvent(); setInterval(renderEvent, 30000); setInterval(loadEvent, 60000);
}

/* ------------------------------------- boot ------------------------------------- */

async function pingStatus() {
  const el = $('#status');
  try {
    const { spots } = await api('GET', '/api/health');
    el.className = 'status ok';
    el.lastElementChild.textContent = `Server online · ${spots} spot${spots === 1 ? '' : 's'}`;
  } catch {
    el.className = 'status bad';
    el.lastElementChild.textContent = 'Server not reachable';
  }
}

async function boot() {
  initMap();
  bindEvents();
  renderEditor();
  try {
    state.spots = (await api('GET', '/api/spots')).spots;
    try { state.events = (await api('GET', '/api/events')).events; } catch { /* the select falls back to the main event */ }
  } catch (e) {
    toast(`Could not load spots: ${e.message}`, 'bad');
  }
  renderList();
  const start = () => {
    map.resize();
    syncMarkers();
    if (state.spots.length) {
      const b = new maplibregl.LngLatBounds();
      state.spots.forEach((s) => b.extend([s.lng, s.lat]));
      map.fitBounds(b, { padding: 90, maxZoom: 13, duration: 0 });
    }
    const id = location.hash.slice(1);
    if (id && state.spots.some((s) => s.id === id)) select(id);
  };
  map.loaded() ? start() : map.once('load', start);
  pingStatus();
  setInterval(pingStatus, 15000);
}

wireEvent();
boot();
