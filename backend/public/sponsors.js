// Organizer page: approve or remove sponsor wallets, and see campaign numbers. Text is only ever set with textContent.
const H = { 'x-requested-with': 'world3-dashboard', 'content-type': 'application/json' };
const $ = (s) => document.querySelector(s);
const el = (t, props = {}, ...kids) => { const e = Object.assign(document.createElement(t), props); e.append(...kids.map((k) => (k instanceof Node ? k : document.createTextNode(String(k))))); return e; };
const say = (text, tone = '') => { $('#msg').textContent = text; $('#msg').className = `msg ${tone}`; };

async function api(method, path, body) {
  const res = await fetch(path, { method, headers: H, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

async function load() {
  const { sponsors, organizer, open } = await api('GET', '/api/sponsors');
  $('#open').checked = !!open;
  $('#org').textContent = organizer ?? 'Arkiv is not set up';
  $('#empty').hidden = sponsors.length > 0;
  $('#table').hidden = sponsors.length === 0;
  $('#rows').replaceChildren(...sponsors.map((s) => el('tr', {},
    el('td', {}, el('code', { textContent: s.address })),
    el('td', {}, s.name || (s.source === 'env' ? '(from environment)' : '')),
    el('td', { className: 'num' }, s.campaigns ?? '–'),
    el('td', {}, s.source === 'env' ? '' : el('button', { className: 'btn small danger', type: 'button', onclick: () => remove(s.address) }, 'Remove')))));
  try {
    const { campaigns, rejected } = await (await fetch('/api/v1/ads/stats', { cache: 'no-store' })).json();
    $('#noStats').hidden = campaigns.length > 0;
    $('#stats').hidden = campaigns.length === 0;
    $('#statRows').replaceChildren(...campaigns.map((c) => el('tr', {}, el('td', {}, c.sponsor), el('td', {}, c.headline), el('td', {}, c.spotId), el('td', { className: 'num' }, c.impressions), el('td', { className: 'num' }, c.captures))));
    $('#rejected').textContent = rejected.length ? `${rejected.length} campaign(s) were read but not shown: ${rejected.map((r) => r.reason).join('; ')}.` : '';
  } catch { /* stats are optional */ }
}

async function remove(address) {
  try { await api('DELETE', `/api/sponsors/${address}`); say('Removed. Their ads stop being eligible straight away.', 'ok'); await load(); } catch (e) { say(e.message, 'bad'); }
}

$('#add').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  try {
    await api('POST', '/api/sponsors', { address: $('#address').value.trim(), name: $('#name').value });
    $('#address').value = ''; $('#name').value = '';
    say('Approved. Their campaigns can be shown right away.', 'ok');
    await load();
  } catch (e) { say(e.message, 'bad'); }
});
load().catch((e) => say(e.message, 'bad'));
setInterval(() => load().catch(() => {}), 20000);

$('#open').addEventListener('change', async (ev) => {
  try { const r = await api('PUT', '/api/sponsors/open', { open: ev.target.checked }); say(r.open ? 'Hackathon mode is on: new wallets are approved automatically.' : 'Hackathon mode is off: only wallets you approve can run ads.', 'ok'); }
  catch (e) { ev.target.checked = !ev.target.checked; say(e.message, 'bad'); }
});
