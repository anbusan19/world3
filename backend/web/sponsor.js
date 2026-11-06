// The advertiser page. Everything that costs money or changes a campaign is signed by the sponsor's own wallet; this page and the
// World3 server never hold a key. Source for public/sponsor.bundle.js (build: npm run build:web).
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
async function txParams() {
  // explicit gas and the network's current gas price: Rabdi writes must not be left to the wallet's own estimate
  return { gas: 1_000_000n, gasPrice: BigInt(await S.provider.request({ method: 'eth_gasPrice' })) };
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
    alt: $('#alt').value || $('#headline').value, startsAt: now, endsAt: now + days * 86400, creative: S.image?.bytes ?? new Uint8Array(0),
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
  const shown = S.image && !problem ? '' : (S.image || $('#sponsor').value || $('#headline').value || $('#url').value) ? problem : '';
  $('#problem').textContent = shown;
  const can = !problem && !!S.wallet && S.onRabdi && !S.busy;
  $('#publish').disabled = !can;
  if (!S.wallet && !problem) $('#problem').textContent = 'Connect your wallet to publish.';
  else if (S.account && !S.onRabdi) $('#problem').textContent = 'Switch your wallet to the Arkiv Rabdi network.';
}

async function chooseImage(file) {
  if (S.image?.url) URL.revokeObjectURL(S.image.url);
  S.image = null;
  const img = node('img', { alt: '' });
  if (file) {
    if (file.size > LIMITS.creativeBytes) { $('#problem').textContent = `That image is ${Math.round(file.size / 1024)} KB; the limit is ${LIMITS.creativeBytes / 1024} KB.`; }
    else {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const url = URL.createObjectURL(new Blob([bytes], { type: file.type }));
      S.image = { bytes, url };
      img.src = url;
    }
  }
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
    const res = await S.wallet.createEntity(CampaignSchema, values, { expiration: ExpirationTime.fromDays(days + 7) }, await txParams());
    say(out, 'Published.', 'ok');
    result.hidden = false;
    result.replaceChildren(node('b', {}, 'Your campaign is on Arkiv.'), node('br'), 'Entity ', node('code', {}, res.entityKey), node('br'),
      S.info?.approved ? 'Your wallet is approved, so it should appear in the app within a minute.' : 'Next step: send the organizer your wallet address so they can approve it. It is shown in step 2.');
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
  $('#image').addEventListener('change', (e) => chooseImage(e.target.files?.[0]));
  refreshInfo().then(validate).catch(() => { $('#problem').textContent = 'Could not reach the World3 server.'; });
  validate(); renderCampaigns();
}
init();
