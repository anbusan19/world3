// Cartoon map style for MapLibre, painted in the World3 logo palette.
// Data: OpenFreeMap vector tiles (OpenMapTiles schema, no API key). Credit "OpenFreeMap / OpenMapTiles /
// OpenStreetMap" is shown by the map's attribution control and must stay visible.
// No text layers on purpose: labels would need a glyph server, and the app draws its own chunky labels.

// Light is the logo palette. Dark keeps the same personality (green land, blue water, warm buildings) but sinks the
// brightness so the map does not glare against a dark UI.
export const PALETTES = {
  light: {
    land: '#D8EDB0',
    grass: '#B9DE86',
    wood: '#8CC152',
    park: '#A6D16C',
    water: '#0265AD',
    building: '#F9C9B0',
    buildingEdge: '#F2A98A',
    road: '#FFFFFF',
    roadEdge: '#9CC46A',
    highway: '#F6E27A',
    highwayEdge: '#E0B93A',
  },
  dark: {
    land: '#27382B',
    grass: '#2F4631',
    wood: '#2A4A2E',
    park: '#35553A',
    water: '#0A3D6B',
    building: '#5B403A',
    buildingEdge: '#7A5249',
    road: '#454C5A',
    roadEdge: '#20262F',
    highway: '#8C7A3A',
    highwayEdge: '#4F4520',
  },
};
export const PALETTE = PALETTES.light; // the globe always uses the bright palette

const SRC = 'openmaptiles';
const MAJOR = ['motorway', 'trunk', 'primary'];
const MINOR = ['secondary', 'tertiary', 'minor', 'service'];
const isClass = (classes) => ['match', ['get', 'class'], classes, true, false];

const zoomWidth = (a, b, c) => ['interpolate', ['exponential', 1.5], ['zoom'], 8, a, 14, b, 18, c];

const roadLayers = (name, classes, color, edge, w) => [
  {
    id: `${name}-casing`,
    type: 'line',
    source: SRC,
    'source-layer': 'transportation',
    filter: isClass(classes),
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': edge, 'line-width': zoomWidth(w[0] + 1, w[1] + 3, w[2] + 5) },
  },
  {
    id: `${name}-fill`,
    type: 'line',
    source: SRC,
    'source-layer': 'transportation',
    filter: isClass(classes),
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': color, 'line-width': zoomWidth(w[0], w[1], w[2]) },
  },
];

function buildCartoon(PALETTE) {
  return {
  version: 8,
  name: 'World3 Cartoon',
  sources: {
    [SRC]: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' },
  },
  layers: [
    { id: 'land', type: 'background', paint: { 'background-color': PALETTE.land } },
    {
      id: 'landcover',
      type: 'fill',
      source: SRC,
      'source-layer': 'landcover',
      paint: {
        'fill-color': ['match', ['get', 'class'], ['wood', 'forest'], PALETTE.wood, 'grass', PALETTE.grass, PALETTE.land],
      },
    },
    { id: 'park', type: 'fill', source: SRC, 'source-layer': 'park', paint: { 'fill-color': PALETTE.park } },
    { id: 'water', type: 'fill', source: SRC, 'source-layer': 'water', paint: { 'fill-color': PALETTE.water } },
    {
      id: 'waterway',
      type: 'line',
      source: SRC,
      'source-layer': 'waterway',
      paint: { 'line-color': PALETTE.water, 'line-width': zoomWidth(1, 3, 6) },
    },
    {
      id: 'building',
      type: 'fill',
      source: SRC,
      'source-layer': 'building',
      minzoom: 13,
      paint: { 'fill-color': PALETTE.building, 'fill-outline-color': PALETTE.buildingEdge },
    },
    ...roadLayers('minor', MINOR, PALETTE.road, PALETTE.roadEdge, [0.6, 3, 10]),
    ...roadLayers('major', MAJOR, PALETTE.highway, PALETTE.highwayEdge, [1, 5, 14]),
  ],
  };
}

export const cartoonStyle = buildCartoon(PALETTES.light);
const darkCartoonStyle = buildCartoon(PALETTES.dark);
// The same object every time for a given theme, so the map does not reload its style on re-render.
export const getCartoonStyle = (dark) => (dark ? darkCartoonStyle : cartoonStyle);

// ---- Globe variant -----------------------------------------------------------------------------------------
// Same cartoon palette, drawn on a 3D globe (MapLibre "globe" projection). At world scale the land is the logo
// green, deserts are sand, polar ice is white, and country borders are thin white lines.
export const globeStyle = {
  ...cartoonStyle,
  name: 'World3 Globe',
  projection: { type: 'globe' },
  layers: [
    ...cartoonStyle.layers
      .map((l) => {
        if (l.id === 'land') return { ...l, paint: { 'background-color': PALETTE.park } };
        if (l.id === 'landcover') {
          return {
            ...l,
            paint: {
              'fill-color': ['match', ['get', 'class'], ['wood', 'forest'], PALETTE.wood, 'grass', '#B9DE86', 'sand', '#F6E27A', 'ice', '#FFFFFF', PALETTE.park],
            },
          };
        }
        return l;
      })
      .reduce((acc, l) => {
        acc.push(l);
        // borders go just above the water so coastlines stay clean
        if (l.id === 'waterway') {
          acc.push({
            id: 'borders',
            type: 'line',
            source: SRC,
            'source-layer': 'boundary',
            filter: ['==', ['get', 'admin_level'], 2],
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': '#FFFFFF', 'line-opacity': 0.85, 'line-width': ['interpolate', ['linear'], ['zoom'], 0, 0.8, 6, 2.2] },
          });
        }
        return acc;
      }, []),
  ],
};
