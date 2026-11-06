// The one header every organizer page shares: brand, the three sections as tabs, and the quiet links on the right.
// Pages only say which one they are: <header class="top" data-page="spots|events|sponsors">. Anything else already in the header
// (the event chip and the server status on the Spots page) stays where it is.
(() => {
  const header = document.querySelector('header.top[data-page]');
  if (!header) return;
  const page = header.dataset.page;
  const tabs = [['spots', '/', 'Spots'], ['events', '/events.html', 'Events'], ['sponsors', '/sponsors.html', 'Sponsors']];
  const nav = document.createElement('nav');
  nav.className = 'dnav';
  nav.setAttribute('aria-label', 'Organizer sections');
  for (const [key, href, label] of tabs) {
    const a = document.createElement('a');
    a.href = href; a.textContent = label;
    if (key === page) a.setAttribute('aria-current', 'page');
    nav.append(a);
  }
  const brand = header.querySelector('.brand');
  brand.after(nav);
  const links = document.createElement('div');
  links.className = 'dlinks';
  for (const [href, label] of [['/sponsor.html', 'Advertiser page'], ['/api/v1/spots', 'App feed']]) {
    const a = document.createElement('a');
    a.href = href; a.target = '_blank'; a.rel = 'noopener'; a.textContent = label;
    links.append(a);
  }
  header.append(links);
})();
