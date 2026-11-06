// The same cartoon map the phone app draws (green land, blue water, peach buildings), so a pin placed here sits on
// the map exactly as users will see it. Data: OpenFreeMap vector tiles. No text layers, like the app.
const PALETTES = {
  light: { land: '#D8EDB0', grass: '#B9DE86', wood: '#8CC152', park: '#A6D16C', water: '#0265AD', building: '#F9C9B0', buildingEdge: '#F2A98A', road: '#FFFFFF', roadEdge: '#9CC46A', highway: '#F6E27A', highwayEdge: '#E0B93A' },
  dark: { land: '#27382B', grass: '#2F4631', wood: '#2A4A2E', park: '#35553A', water: '#0A3D6B', building: '#5B403A', buildingEdge: '#7A5249', road: '#454C5A', roadEdge: '#20262F', highway: '#8C7A3A', highwayEdge: '#4F4520' },
};
const SRC = 'openmaptiles';
const cls = (list) => ['match', ['get', 'class'], list, true, false];
const width = (a, b, c) => ['interpolate', ['exponential', 1.5], ['zoom'], 8, a, 14, b, 18, c];
const road = (name, list, color, edge, w) => [
  { id: `${name}-casing`, type: 'line', source: SRC, 'source-layer': 'transportation', filter: cls(list), layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': edge, 'line-width': width(w[0] + 1, w[1] + 3, w[2] + 5) } },
  { id: `${name}-fill`, type: 'line', source: SRC, 'source-layer': 'transportation', filter: cls(list), layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': color, 'line-width': width(w[0], w[1], w[2]) } },
];

export function cartoonStyle(dark) {
  const P = dark ? PALETTES.dark : PALETTES.light;
  return {
    version: 8,
    name: 'wrld3 Cartoon',
    sources: { [SRC]: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' } },
    layers: [
      { id: 'land', type: 'background', paint: { 'background-color': P.land } },
      { id: 'landcover', type: 'fill', source: SRC, 'source-layer': 'landcover', paint: { 'fill-color': ['match', ['get', 'class'], ['wood', 'forest'], P.wood, 'grass', P.grass, P.land] } },
      { id: 'park', type: 'fill', source: SRC, 'source-layer': 'park', paint: { 'fill-color': P.park } },
      { id: 'water', type: 'fill', source: SRC, 'source-layer': 'water', paint: { 'fill-color': P.water } },
      { id: 'waterway', type: 'line', source: SRC, 'source-layer': 'waterway', paint: { 'line-color': P.water, 'line-width': width(1, 3, 6) } },
      { id: 'building', type: 'fill', source: SRC, 'source-layer': 'building', minzoom: 13, paint: { 'fill-color': P.building, 'fill-outline-color': P.buildingEdge } },
      ...road('minor', ['secondary', 'tertiary', 'minor', 'service'], P.road, P.roadEdge, [0.6, 3, 10]),
      ...road('major', ['motorway', 'trunk', 'primary'], P.highway, P.highwayEdge, [1, 5, 14]),
    ],
  };
}
export const STREETS = 'https://tiles.openfreemap.org/styles/liberty';
