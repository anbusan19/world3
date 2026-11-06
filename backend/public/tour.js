// A guided tour for sponsors (Shepherd.js): connect, add the network, get tGLM, make an ad, publish it.
// It starts by itself the first time someone opens the page, and any time from "Take the tour".
(() => {
  const SEEN = 'world3.sponsorTour.v1';
  const seen = () => { try { return localStorage.getItem(SEEN) === '1'; } catch { return false; } };
  const mark = () => { try { localStorage.setItem(SEEN, '1'); } catch { /* fine */ } };
  const $ = (s) => document.querySelector(s);
  const visible = (s) => { const e = $(s); return !!e && !e.hidden && e.offsetParent !== null; };

  function build() {
    const tour = new window.Shepherd.Tour({
      useModalOverlay: true,
      exitOnEsc: true,
      keyboardNavigation: true,
      defaultStepOptions: { cancelIcon: { enabled: true, label: 'Close the tour' }, scrollTo: { behavior: 'smooth', block: 'center' }, modalOverlayOpeningRadius: 18, modalOverlayOpeningPadding: 8, classes: 'w3-tour' },
    });
    const back = { text: 'Back', secondary: true, action: () => tour.back() };
    const next = { text: 'Next', action: () => tour.next() };
    const steps = [
      { id: 'welcome', title: 'Run an ad in about a minute', text: 'Your ad is shown on the “Stamp collected” screen right after a verified person captures a spot at the event. This quick tour shows each step. You can leave any time.', buttons: [{ text: 'Skip', secondary: true, action: () => tour.cancel() }, { text: 'Start', action: () => tour.next() }] },
      { id: 'setup', attach: '#easy', on: 'right', title: '1 · Set up your wallet', text: 'Press “Set me up in one click”. It connects MetaMask, adds the Arkiv testnet and sends you free test tGLM to pay the tiny network fee. No real money is involved.', buttons: [back, next] },
      { id: 'manual', attach: '#addNet', on: 'bottom', title: 'Or do it step by step', text: '“Add testnet to MetaMask” adds the network. “Get free tGLM” asks our faucet for tokens (one drip per wallet per day).', buttons: [back, next] },
      { id: 'approval', attach: '#s-create', on: 'top', title: '2 · Approval', text: 'The organizer must approve your wallet before your ad can show. In hackathon mode that happens automatically. Otherwise, copy your wallet address and send it to the organizer. A note appears here if you are waiting.', buttons: [back, next] },
      { id: 'spot', attach: '#spot', on: 'bottom', title: '3 · Pick a spot', text: 'Choose the place where your ad appears. People see it only after they capture that spot.', buttons: [back, next] },
      { id: 'words', attach: '#headline', on: 'bottom', title: 'Your name and headline', text: 'Keep it short: your brand name (40 characters) and one headline (60). The preview on the right updates as you type.', buttons: [back, next] },
      { id: 'image', attach: '.layout-prompt', on: 'top', title: '4 · Add a 16:9 picture', text: 'Use a 16:9 image or GIF (1280×720 is ideal, up to 100 KB). Keep logos and text inside the dashed box so nothing is trimmed on small phones. Your file shows below straight away, with a note if the shape is off.', buttons: [back, next] },
      { id: 'link', attach: '#url', on: 'top', title: 'Where it links', text: 'An https link people can open after tapping your ad.', buttons: [back, next] },
      { id: 'days', attach: '#days', on: 'top', title: 'How long it runs', text: 'Pick a number of days. Your ad always stops when the event ends, even if you choose longer.', buttons: [back, next] },
      { id: 'preview', attach: '#preview', on: 'left', title: 'What travelers see', text: 'This is your ad exactly as it appears in the app.', buttons: [back, next] },
      { id: 'publish', attach: '#publish', on: 'top', title: '5 · Publish', text: 'Press Publish and confirm in MetaMask. It writes a public record from your wallet, so only you can change or delete it.', buttons: [back, next] },
      { id: 'results', attach: '#s-list', on: 'top', title: '6 · Watch it work', text: 'Your campaigns appear here with live views and captures. Views count people who saw your ad after a verified capture, once each. No names or wallets of travelers are shown.', buttons: [back, { text: 'Done', action: () => tour.complete() }] },
    ];
    for (const s of steps) {
      const el = s.attach;
      tour.addStep({
        id: s.id, title: s.title, text: s.text, buttons: s.buttons,
        ...(el ? { attachTo: { element: el, on: s.on }, canClickTarget: true } : {}),
        // a part of the page that is not on screen (for example, hidden before connecting) is skipped, not shown as a floating box
        beforeShowPromise: () => new Promise((resolve) => { if (el && !visible(el)) { setTimeout(() => (tour.getCurrentStep()?.id === s.id ? tour.next() : null), 0); } resolve(); }),
      });
    }
    tour.on('complete', mark); tour.on('cancel', mark);
    return tour;
  }

  function start() { if (!window.Shepherd) return; try { window.__w3tour?.cancel(); } catch { /* none running */ } window.__w3tour = build(); window.__w3tour.start(); }

  function ready() {
    $('#tourBtn')?.addEventListener('click', start);
    if (!seen()) setTimeout(start, 900);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready); else ready();
})();
