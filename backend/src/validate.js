// Checks what the dashboard sends before it touches the database. Returns { value, errors }: `value` only has the
// fields that were valid, `errors` is a list of { field, message } the dashboard can show next to the input.

export const TYPES = ['LANDMARK', 'EVENT'];
export const KINDS = ['geospatial', 'anchor'];
export const THEMES = ['coral', 'sky', 'sun', 'leaf', 'ocean'];
export const ARTS = ['gateway', 'ethglobal', 'csmt']; // illustrations bundled inside the app
export const ICONS = ['business', 'ticket', 'train', 'location', 'flag', 'home', 'boat', 'flame', 'triangle', 'radio', 'time', 'person', 'grid', 'git-branch'];

const num = (v) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN);

export const DEFAULTS = {
  city: '',
  type: 'LANDMARK',
  kind: 'geospatial',
  captureRadiusM: 20,
  approachRadiusM: 100,
  heading: 0,
  scale: 1,
  heightOffsetM: 0,
  theme: 'coral',
  art: null,
  icon: 'location',
  published: false,
  onArkiv: false,
};

export function defaultLabel(name) {
  return (name.split(/\s+/)[0] || 'SPOT').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12) || 'SPOT';
}

export function validateSpot(input, { partial = false } = {}) {
  const errors = [];
  const value = {};
  const body = input && typeof input === 'object' ? input : {};
  const has = (k) => body[k] !== undefined;
  const bad = (field, message) => errors.push({ field, message });

  if (has('name') || !partial) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (name.length < 2 || name.length > 60) bad('name', 'Give it a name between 2 and 60 characters.');
    else value.name = name;
  }
  if (has('label')) {
    const label = typeof body.label === 'string' ? body.label.trim().toUpperCase() : '';
    if (!/^[A-Z0-9 ]{2,14}$/.test(label)) bad('label', 'The stamp label is 2 to 14 letters or numbers, like GATEWAY.');
    else value.label = label;
  }
  if (has('city')) {
    if (typeof body.city !== 'string' || body.city.length > 40) bad('city', 'City must be text of at most 40 characters.');
    else value.city = body.city.trim();
  }
  const oneOf = (field, list, nice) => {
    if (has(field)) {
      if (!list.includes(body[field])) bad(field, `${nice} must be one of: ${list.join(', ')}.`);
      else value[field] = body[field];
    }
  };
  oneOf('type', TYPES, 'Type');
  oneOf('kind', KINDS, 'Kind');
  oneOf('theme', THEMES, 'Colour');
  oneOf('icon', ICONS, 'Icon');
  if (has('art')) {
    if (body.art !== null && !ARTS.includes(body.art)) bad('art', `Bundled art must be empty or one of: ${ARTS.join(', ')}.`);
    else value.art = body.art;
  }

  const ranged = (field, min, max, nice, unit = '') => {
    if (!has(field)) return;
    const n = num(body[field]);
    if (!Number.isFinite(n) || n < min || n > max) bad(field, `${nice} must be a number from ${min} to ${max}${unit}.`);
    else value[field] = n;
  };
  if (has('lat') || !partial) {
    const n = num(body.lat);
    if (!Number.isFinite(n) || n < -90 || n > 90) bad('lat', 'Latitude must be between -90 and 90.');
    else value.lat = +n.toFixed(7);
  }
  if (has('lng') || !partial) {
    const n = num(body.lng);
    if (!Number.isFinite(n) || n < -180 || n > 180) bad('lng', 'Longitude must be between -180 and 180.');
    else value.lng = +n.toFixed(7);
  }
  ranged('captureRadiusM', 5, 200, 'Capture radius', ' m');
  ranged('approachRadiusM', 20, 500, 'Approach radius', ' m');
  ranged('heading', 0, 360, 'Heading', ' degrees');
  ranged('scale', 0.05, 20, 'Scale');
  ranged('heightOffsetM', -5, 50, 'Height offset', ' m');

  if (has('onArkiv')) {
    if (typeof body.onArkiv !== 'boolean') bad('onArkiv', 'Publish on Arkiv must be true or false.');
    else value.onArkiv = body.onArkiv;
  }
  if (has('published')) {
    if (typeof body.published !== 'boolean') bad('published', 'Published must be true or false.');
    else value.published = body.published;
  }

  const cap = value.captureRadiusM ?? (partial ? undefined : DEFAULTS.captureRadiusM);
  const app = value.approachRadiusM ?? (partial ? undefined : DEFAULTS.approachRadiusM);
  if (cap !== undefined && app !== undefined && app <= cap) bad('approachRadiusM', 'The approach radius must be bigger than the capture radius.');

  return { value, errors };
}
