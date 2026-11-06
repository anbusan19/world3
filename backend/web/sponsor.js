import { compressImage } from '../public/compress.js';
// The advertiser page. Everything that costs money or changes a campaign is signed by the sponsor's own wallet; this page and the
// wrld3 server never hold a key. Source for public/sponsor.bundle.js (build: npm run build:web).
import { ExpirationTime, createWalletClient } from '@arkiv-network/sdk';
import { rabdi } from '@arkiv-network/sdk/chains';
import { custom, isAddress } from 'viem';
import { CampaignError, CampaignSchema, LIMITS, campaignValues } from '../src/campaign.js';

const CHAIN_ID = 7794095n;
const CHAIN_HEX = '0x76edaf';
const $ = (s) => document.querySelector(s);
const KEY_STORE = 'world3.sponsor.rpcKey';

const S = { provider: null, account: null, wallet: null, info: null, image: null, campaigns: [], busy: false, onRabdi: false, timer: null };

// ---- small helpers --------------------------------------------------------------------------------------------------
const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const date = (sec) => new Date(Number(sec) * 1000).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
function node(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) { if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v); }
  for (const kid of kids.flat()) e.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  return e;
}
const say = (el, text, tone = '') => { el.textContent = text; el.className = `msg ${tone}`.trim(); };
// Wallet and chain errors can carry URLs (with an access key inside). Only fixed messages are ever shown.
function friendly(e) {
  if (e instanceof CampaignError) return e.message;
  const text = String(e?.shortMessage ?? e?.message ?? '');
  if (e?.code === 4001 || /reject|denied|declin/i.test(text)) return 'You declined the request in your wallet.';
  if (/insufficient|funds/i.test(text)) return 'Your wallet does not have enough tGLM for the gas. Get some at the faucet.';
  if (/EntityMutation|gas|revert/i.test(text)) return 'Arkiv rejected the transaction. Larger images need more gas; try a smaller image (under 60 KB), and check you are on the Rabdi network with a little tGLM.';
  return 'Arkiv did not accept that. Check your wallet is on the Rabdi network and has tGLM, then try again.';
}
async function getJson(path) {
  const res = await fetch(path, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

// ---- wallet ---------------------------------------------------------------------------------------------------------
function chainFor() {
  const key = ($('#rpcKey').value || '').trim();
  return rabdi({ accessKey: key });
}

async function connect() {
  const provider = window.ethereum;
  if (!provider) return say($('#connMsg'), 'No browser wallet found. Install MetaMask, then reload this page.', 'bad');
  say($('#connMsg'), 'Waiting for your wallet…');
  try {
    localStorage.setItem(KEY_STORE, ($('#rpcKey').value || '').trim());
  } catch { /* storage can be blocked; the key then lasts for this page view only */ }
  try {
    const chain = chainFor();
    const addresses = await provider.request({ method: 'eth_requestAccounts' });
    const account = addresses?.[0];
    if (!account || !isAddress(account)) throw new Error('no account');
    try {
      await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN_HEX }] });
    } catch (e) {
      if (e?.code !== 4902) throw e;
      await provider.request({ method: 'wallet_addEthereumChain', params: [{ chainId: CHAIN_HEX, chainName: 'Arkiv Rabdi Testnet', nativeCurrency: chain.nativeCurrency, rpcUrls: [chain.rpcUrls.default.http[0]], blockExplorerUrls: [chain.blockExplorers.default.url] }] });
      await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN_HEX }] });
    }
    S.provider = provider;
    watch(provider);
    await adopt(account, chain);
    say($('#connMsg'), 'Connected.', 'ok');
  } catch (e) {
    say($('#connMsg'), friendly(e), 'bad');
  }
}

// ---- testnet setup: add the network to the wallet, and get free test tGLM from the organizer's faucet ------------------
async function addNetwork() {
  const provider = window.ethereum;
  if (!provider) { say($('#netMsg'), 'No browser wallet found. Install MetaMask, then reload this page.', 'bad'); return false; }
  const chain = chainFor();
  try {
    try {
      await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN_HEX }] });
    } catch (e) {
      if (e?.code !== 4902 && e?.code !== -32603) throw e;
      await provider.request({ method: 'wallet_addEthereumChain', params: [{ chainId: CHAIN_HEX, chainName: 'Arkiv Rabdi Testnet', nativeCurrency: chain.nativeCurrency, rpcUrls: [chain.rpcUrls.default.http[0]], blockExplorerUrls: [chain.blockExplorers.default.url] }] });
      await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN_HEX }] });
    }
    say($('#netMsg'), 'Arkiv testnet added and selected.', 'ok');
    if (S.account) await adopt(S.account, chain);
    return true;
  } catch (e) {
    say($('#netMsg'), friendly(e), 'bad');
    return false;
  }
}

async function getTglm() {
  if (!S.account) { await connect(); if (!S.account) return false; }
  const btn = $('#faucet'); btn.disabled = true;
  say($('#netMsg'), 'Sending you test tGLM…');
  try {
    const res = await fetch('/api/v1/faucet', { method: 'POST', headers: { 'content-type': 'application/json', 'x-requested-with': 'wrld3-dashboard' }, body: JSON.stringify({ address: S.account }) });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) { say($('#netMsg'), out.error ?? out.message ?? 'The faucet said no.', 'bad'); return false; }
    say($('#netMsg'), `Sent ${out.amount}. It lands in a few seconds.`, 'ok');
    for (let i = 0; i < 4; i += 1) { await new Promise((r) => setTimeout(r, 2500)); await showAccount(); }
    validate();
    return true;
  } catch {
    say($('#netMsg'), 'Could not reach the faucet.', 'bad');
    return false;
  } finally { btn.disabled = false; }
}

async function easySetup() {
  const b = $('#easy'); b.disabled = true;
  try {
    if (!S.account) await connect(); // adds and selects the network too
    if (!S.account) return;
    if (!S.onRabdi && !(await addNetwork())) return;
    let bal = 0n;
    try { bal = BigInt(await S.provider.request({ method: 'eth_getBalance', params: [S.account, 'latest'] })); } catch { /* the faucet decides */ }
    if (bal < 10n ** 16n) await getTglm();
    else say($('#netMsg'), 'You are all set: wallet connected, network added, tGLM in your account.', 'ok');
  } finally { b.disabled = false; }
}

// ads end with the event: no campaign can be set to run past it
const eventEndSec = () => (S.info?.event?.endsAt ? Math.floor(Date.parse(S.info.event.endsAt) / 1000) : null);
function showEvent() {
  const e = S.info?.event; const note = $('#eventNote'); if (!note) return;
  if (!e?.endsAt) { note.hidden = true; return; }
  note.hidden = false;
  note.textContent = e.over ? `${e.name} has ended, so new campaigns cannot run.` : `Ads end with ${e.name}: ${new Date(e.endsAt).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}. Your campaign stops then, even if you choose more days.`;
  note.className = `fine ${e.over ? 'bad' : ''}`;
}

async function adopt(account, chain = chainFor()) {
  S.account = account;
  S.onRabdi = BigInt(await S.provider.request({ method: 'eth_chainId' })) === CHAIN_ID;
  S.wallet = S.onRabdi ? createWalletClient({ chain, account, transport: custom(S.provider) }) : null;
  $('#connect').textContent = 'Reconnect';
  $('#connectTop').hidden = true;
  await showAccount();
  await refreshInfo();
  await refreshCampaigns();
  clearInterval(S.timer);
  S.timer = setInterval(refreshCampaigns, 15000);
  validate();
}

async function showAccount() {
  const chip = $('#chip');
  chip.hidden = false;
  if (!S.onRabdi) { chip.textContent = 'Switch your wallet to Arkiv Rabdi'; chip.className = 'chip bad'; return; }
  let bal = '';
  try { bal = `${(Number(BigInt(await S.provider.request({ method: 'eth_getBalance', params: [S.account, 'latest'] })) / 10n ** 12n) / 1e6).toFixed(4)} tGLM`; } catch { /* balance is only a courtesy */ }
  chip.textContent = `${short(S.account)}${bal ? ` · ${bal}` : ''}`;
  chip.className = 'chip';
}

// the wallet can change under us; recheck, never carry stale state forward
function watch(provider) {
  if (watch.done) return;
  watch.done = true;
  provider.on?.('accountsChanged', (a) => { if (!a?.[0]) reset(); else adopt(a[0]).catch(reset); });
  provider.on?.('chainChanged', () => { if (S.account) adopt(S.account).catch(reset); });
  provider.on?.('disconnect', reset);
}
function reset() {
  clearInterval(S.timer);
  Object.assign(S, { account: null, wallet: null, campaigns: [], onRabdi: false });
  $('#chip').hidden = true; $('#connectTop').hidden = false; $('#connect').textContent = 'Connect wallet';
  $('#s-approval').hidden = true; renderCampaigns(); validate();
  say($('#connMsg'), 'Disconnected.');
}

// ---- server facts ---------------------------------------------------------------------------------------------------
async function refreshInfo() {
  S.info = await getJson(`/api/v1/sponsors/info${S.account ? `?address=${S.account}` : ''}`);
  showEvent();
  const sel = $('#spot');
  const keep = sel.value;
  sel.replaceChildren(...S.info.spots.map((s) => node('option', { value: s.id }, `${s.name}${s.city ? ` · ${s.city}` : ''}`)));
  if ([...sel.options].some((o) => o.value === keep)) sel.value = keep;
  const approval = $('#s-approval');
  approval.hidden = !S.account;
  if (S.account) {
    $('#addr').textContent = S.account;
    $('#approvalText').textContent = S.info.approved
      ? 'Your wallet is approved. Your campaigns can be shown in the app.'
      : 'Your wallet is not approved yet. You can still publish; the app shows your campaign once the organizer approves this wallet. Send them this address:';
    $('#copy').hidden = !!S.info.approved;
    $('#addr').hidden = !!S.info.approved;
  }
}

async function refreshCampaigns() {
  if (!S.account) return;
  try { S.campaigns = (await getJson(`/api/v1/sponsors/campaigns?owner=${S.account}`)).campaigns; } catch { /* keep what we have; try again next round */ }
  renderCampaigns();
}

function statusOf(c) {
  const now = Date.now() / 1000;
  if (c.status === 'paused') return ['Paused', ''];
  if (Number(c.endsAt) <= now) return ['Ended', ''];
  if (c.shown) return ['Live', 'live'];
  if (Number(c.startsAt) > now) return ['Scheduled', ''];
  if (c.reason) return [/approve/.test(c.reason) ? 'Waiting for approval' : 'Not shown', 'warn', c.reason];
  return ['Checking…', ''];
}

function renderCampaigns() {
  const rows = $('#rows');
  const table = $('#table');
  $('#listEmpty').hidden = !!S.campaigns.length;
  $('#listEmpty').textContent = S.account ? 'No campaigns from this wallet yet. Create one above.' : 'Connect your wallet to see your campaigns.';
  table.hidden = !S.campaigns.length;
  const spotName = (id) => S.info?.spots.find((s) => s.id === id)?.name ?? `Spot ${id}`;
  rows.replaceChildren(...S.campaigns.map((c) => {
    const [label, tone, why] = statusOf(c);
    const paused = c.status === 'paused';
    const act = (text, fn, cls = '') => node('button', { class: `btn small ${cls}`, type: 'button', onclick: fn, disabled: S.busy || !S.wallet }, text);
    return node('tr', {},
      node('td', {}, node('b', {}, c.headline), node('span', { class: 'sub' }, c.sponsor)),
      node('td', {}, spotName(c.spotId)),
      node('td', {}, node('span', { class: `pill ${tone}` }, label), why ? node('span', { class: 'sub' }, why) : ''),
      node('td', {}, `${date(c.startsAt)} → ${date(c.endsAt)}`),
      node('td', { class: 'num' }, c.impressions ?? 0),
      node('td', { class: 'num' }, c.captures ?? '–'),
      node('td', {}, node('div', { class: 'actions' },
        act(paused ? 'Resume' : 'Pause', () => change(c, paused ? 'resume' : 'pause')),
        act('Delete', (ev) => confirmDelete(ev.currentTarget, c), 'danger'))));
  }));
}

// ---- writes (each one is signed in the sponsor's wallet) ----------------------------------------------------------
// Gas grows with the image: Arkiv charges per stored byte (measured: 20 KB ~0.9M gas, 60 KB ~2.6M, 95 KB ~4.1M at 1 gwei, so a full
// 100 KB ad costs about 0.005 tGLM). A fixed 1M limit made every image above ~25 KB fail, so size the limit to the payload.
// Only gas USED is paid; the limit just has to be high enough. Pause, resume and delete get a roomy fixed limit.
export const gasForCreative = (bytes) => 400_000n + 48n * BigInt(bytes);
async function txParams(creativeBytes) {
  const gas = creativeBytes != null ? gasForCreative(creativeBytes) : 5_000_000n;
  return { gas, gasPrice: BigInt(await S.provider.request({ method: 'eth_gasPrice' })) };
}
async function ready() {
  if (!S.provider || !S.wallet) throw new Error('not connected');
  const now = await S.provider.request({ method: 'eth_accounts' });
  if (now?.[0]?.toLowerCase() !== S.account.toLowerCase()) throw new Error('account changed');
  if (BigInt(await S.provider.request({ method: 'eth_chainId' })) !== CHAIN_ID) throw new Error('wrong network');
}

async function change(c, what) {
  S.busy = true; renderCampaigns();
  try {
    await ready();
    await S.wallet.patchEntity(CampaignSchema, c.key, { set: { status: what === 'pause' ? 'paused' : 'active' } }, await txParams());
    await refreshCampaigns();
  } catch (e) { alert(friendly(e)); } finally { S.busy = false; renderCampaigns(); }
}
function confirmDelete(btn, c) {
  if (btn.dataset.sure) return remove(c);
  btn.dataset.sure = '1'; btn.textContent = 'Really delete?';
  setTimeout(() => { if (btn.isConnected) { delete btn.dataset.sure; btn.textContent = 'Delete'; } }, 4000);
}
async function remove(c) {
  S.busy = true; renderCampaigns();
  try {
    await ready();
    await S.wallet.deleteEntity({ entityKey: c.key }, await txParams());
    await refreshCampaigns();
  } catch (e) { alert(friendly(e)); } finally { S.busy = false; renderCampaigns(); }
}

// ---- the form -------------------------------------------------------------------------------------------------------
function draft(days = Number($('#days').value)) {
  const now = Math.floor(Date.now() / 1000);
  return {
    eventSlug: S.info?.eventSlug ?? 'ethglobal-mumbai-2026', spotId: $('#spot').value, sponsor: $('#sponsor').value, headline: $('#headline').value, clickUrl: $('#url').value,
    alt: $('#alt').value || $('#headline').value, startsAt: now, endsAt: Math.min(now + days * 86400, eventEndSec() ?? Infinity), creative: S.image?.bytes ?? new Uint8Array(0),
  };
}

function validate() {
  for (const el of document.querySelectorAll('.count')) { const i = $(`#${el.dataset.for}`); el.textContent = `${i.value.length}/${i.maxLength}`; }
  $('#pvSponsor').textContent = $('#sponsor').value || 'Your name';
  $('#pvHead').textContent = $('#headline').value || 'Your headline';
  let problem = '';
  if (!S.image) problem = 'Choose an image.';
  else {
    try { campaignValues(draft()); } catch (e) { problem = e instanceof CampaignError ? e.message : 'Check the form.'; }
  }
  if (!$('#sponsor').value && !problem) problem = 'Your name is required.';
  if (!problem && S.info?.event?.over) problem = 'The event has ended, so new campaigns cannot run.';
  const shown = S.image && !problem ? '' : (S.image || $('#sponsor').value || $('#headline').value || $('#url').value) ? problem : '';
  $('#problem').textContent = shown;
  const can = !problem && !!S.wallet && S.onRabdi && !S.busy;
  $('#publish').disabled = !can;
  if (!S.wallet && !problem) $('#problem').textContent = 'Connect your wallet to publish.';
  else if (S.account && !S.onRabdi) $('#problem').textContent = 'Switch your wallet to the Arkiv Rabdi network.';
}

// Ads show in a small card, so there is no reason to store more: every picture is shrunk to about 40 KB (the limit is 100 KB).
// Smaller means a cheaper, faster write and a quicker load in the app.
const AD_TARGET_BYTES = 40 * 1024; const AD_MAX_SIDE = 960;
async function chooseImage(picked) {
  if (S.image?.url) URL.revokeObjectURL(S.image.url);
  S.image = null;
  let file = picked; let note = '';
  if (picked) {
    try { // shrink anything over the limit (or too large) so nobody needs a separate compressor
      $('#dropInfo').textContent = 'Checking the image…';
      const out = await compressImage(picked, { maxBytes: AD_TARGET_BYTES, maxSide: AD_MAX_SIDE });
      if (out.changed) {
        file = new File([out.blob], picked.name.replace(/\.[^.]+$/, '') + (out.blob.type === 'image/webp' ? '.webp' : '.jpg'), { type: out.blob.type });
        note = ` · compressed from ${Math.round(picked.size / 1024)} KB`;
      }
    } catch (e) { file = picked; note = ''; $('#problem').textContent = e.message; }
  }
  const img = node('img', { alt: '' });
  const thumb = $('#dropThumb'); const info = $('#dropInfo');
  info.className = '';
  if (file) {
    if (file.size > LIMITS.creativeBytes) {
      $('#problem').textContent = `That image is ${Math.round(file.size / 1024)} KB; the limit is ${LIMITS.creativeBytes / 1024} KB.`;
      info.textContent = `${Math.round(file.size / 1024)} KB: too big`; info.className = 'warn';
    } else {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const url = URL.createObjectURL(new Blob([bytes], { type: file.type }));
      S.image = { bytes, url };
      img.src = url;
      // read the real size so we can say whether it fits the 16:9 card
      await new Promise((r) => { const probe = new Image(); probe.onload = () => { S.image.w = probe.naturalWidth; S.image.h = probe.naturalHeight; r(); }; probe.onerror = r; probe.src = url; });
      const { w, h } = S.image;
      const ratio = w && h ? w / h : 0;
      const ok = Math.abs(ratio - 16 / 9) < 0.06;
      info.textContent = w ? `${w}×${h} · ${Math.round(file.size / 1024)} KB${note} · ${ok ? 'fits 16:9' : `ratio ${ratio.toFixed(2)}:1, 16:9 is best`}` : `${Math.round(file.size / 1024)} KB`;
      info.className = ok ? 'ok' : 'warn';
    }
    $('#dropName').textContent = file.name;
  } else { $('#dropName').textContent = 'Choose or drop a file'; info.textContent = 'Nothing chosen yet'; }
  thumb.replaceChildren(S.image ? node('img', { alt: '', src: S.image.url }) : document.createTextNode('+'));
  $('#pvImg').replaceChildren(S.image ? img : node('span', {}, 'Your image'));
  validate();
}

async function publish(ev) {
  ev.preventDefault();
  if (S.busy) return;
  S.busy = true; validate();
  const out = $('#pubMsg'); const result = $('#result');
  result.hidden = true;
  try {
    say(out, 'Checking…');
    const days = Number($('#days').value);
    const values = campaignValues(draft(days));
    await ready();
    say(out, 'Confirm in your wallet…');
    // the entity outlives the campaign by a week
    const res = await S.wallet.createEntity(CampaignSchema, values, { expiration: ExpirationTime.fromDays(days + 7) }, await txParams(values.creative.length));
    say(out, 'Published.', 'ok');
    result.hidden = false;
    const card = `${location.origin}/share/ad/${res.entityKey}`;
    const post = `https://x.com/intent/post?text=${encodeURIComponent(`We're live on WRLD³ at ${S.info?.event?.name ?? 'the event'}: ${$('#sponsor').value}. ${$('#headline').value}`)}&url=${encodeURIComponent(card)}`;
    const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
    result.replaceChildren(node('b', {}, 'Your campaign is on Arkiv.'), node('br'), 'Entity ', node('code', {}, res.entityKey), node('br'),
      S.info?.approved ? 'Your wallet is approved, so it should appear in the app within a minute.' : 'Next step: send the organizer your wallet address so they can approve it. It is shown in step 2.',
      node('div', { className: 'sharebox' },
        node('img', { src: `${card}.png`, alt: 'Your share card', width: 600, height: 315, onerror: (e) => { e.target.replaceWith(node('p', { className: 'fine' }, 'The share card appears once your campaign is approved and live (about a minute). Reload this page then.')); } }),
        node('div', { className: 'row' },
          node('a', { className: 'btn green', href: post, target: '_blank', rel: 'noopener noreferrer' }, 'Share on X'),
          node('a', { className: 'btn', href: `${card}.png`, download: 'wrld3-live.png' }, 'Download the image')),
        local ? node('p', { className: 'fine' }, 'Open this page from the public link (not localhost) so X can fetch the picture.') : node('p', { className: 'fine' }, 'X shows this picture with your post.')));
    await refreshCampaigns();
  } catch (e) {
    say(out, friendly(e), 'bad');
  } finally { S.busy = false; validate(); }
}

// ---- wire up --------------------------------------------------------------------------------------------------------
function init() {
  $('#maxKb').textContent = String(LIMITS.creativeBytes / 1024);
  try { $('#rpcKey').value = localStorage.getItem(KEY_STORE) ?? ''; } catch { /* storage blocked */ }
  $('#connect').addEventListener('click', connect);
  $('#connectTop').addEventListener('click', connect);
  $('#copy').addEventListener('click', async () => { try { await navigator.clipboard.writeText(S.account); $('#copy').textContent = 'Copied'; setTimeout(() => ($('#copy').textContent = 'Copy address'), 1500); } catch { /* the address is on screen to copy by hand */ } });
  $('#form').addEventListener('submit', publish);
  for (const id of ['spot', 'sponsor', 'headline', 'url', 'alt', 'days']) $(`#${id}`).addEventListener('input', validate);
  $('#addNet').addEventListener('click', addNetwork);
  $('#faucet').addEventListener('click', getTglm);
  $('#easy').addEventListener('click', easySetup);
  fetch('/api/v1/faucet/info').then((r) => r.json()).then((f) => { if (f.enabled) { $('#faucet').hidden = false; $('#faucet').textContent = `Get free ${f.token} (${f.amount})`; } }).catch(() => {});
  $('#image').addEventListener('change', (e) => chooseImage(e.target.files?.[0]));
  const drop = $('#drop');
  ['dragover', 'dragenter'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', (e) => { const f = e.dataTransfer?.files?.[0]; if (f) chooseImage(f); });
  refreshInfo().then(validate).catch(() => { $('#problem').textContent = 'Could not reach the wrld3 server.'; });
  validate(); renderCampaigns();
}
init();
