'use client';
import { createContext, forwardRef, useContext, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// A small web version of the parts of @maplibre/maplibre-react-native that the app uses
// (Map, Camera, ViewAnnotation, GeoJSONSource, Layer), built on maplibre-gl.
const MapCtx = createContext({ map: null, ready: false });
const SrcCtx = createContext(null);

export function Map({ mapStyle, children, onRegionDidChange, attribution = true }) {
  const el = useRef(null);
  const [state, setState] = useState({ map: null, ready: false });
  const cb = useRef(onRegionDidChange);
  cb.current = onRegionDidChange;
  useEffect(() => {
    const map = new maplibregl.Map({ container: el.current, style: mapStyle, center: [0, 0], zoom: 1, attributionControl: false, pitchWithRotate: false, dragRotate: false, maxPitch: 0 });
    map.touchZoomRotate.disableRotation();
    if (attribution !== false) map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
    map.on('moveend', (e) => cb.current?.({ nativeEvent: { userInteraction: !!e.originalEvent, center: map.getCenter().toArray() } }));
    map.once('load', () => setState({ map, ready: true }));
    setState({ map, ready: false });
    return () => map.remove();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div ref={el} style={{ position: 'absolute', inset: 0 }} />
      <MapCtx.Provider value={state}>{children}</MapCtx.Provider>
    </div>
  );
}

export const Camera = forwardRef(function Camera({ initialViewState, minZoom, maxZoom }, ref) {
  const { map } = useContext(MapCtx);
  useEffect(() => {
    if (!map) return;
    if (minZoom != null) map.setMinZoom(minZoom);
    if (maxZoom != null) map.setMaxZoom(maxZoom);
    if (initialViewState) map.jumpTo({ center: initialViewState.center, zoom: initialViewState.zoom });
  }, [map]); // eslint-disable-line react-hooks/exhaustive-deps
  useImperativeHandle(ref, () => ({
    flyTo: ({ center, zoom, duration }) => map?.flyTo({ center, zoom, duration }),
    easeTo: ({ center, zoom, duration }) => map?.easeTo({ center, zoom, duration, easing: (t) => t }),
  }), [map]);
  return null;
});

export function ViewAnnotation({ lngLat, children, onPress }) {
  const { map } = useContext(MapCtx);
  const [el] = useState(() => (typeof document === 'undefined' ? null : document.createElement('div')));
  const marker = useRef(null);
  useEffect(() => {
    if (!map || !el) return undefined;
    marker.current = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat(lngLat).addTo(map);
    return () => marker.current?.remove();
  }, [map]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { marker.current?.setLngLat(lngLat); }, [lngLat]);
  useEffect(() => {
    if (!el || !onPress) return undefined;
    el.style.cursor = 'pointer';
    el.addEventListener('click', onPress);
    return () => el.removeEventListener('click', onPress);
  }, [el, onPress]);
  return el ? createPortal(children, el) : null;
}

export function GeoJSONSource({ id, data, children }) {
  const { map, ready } = useContext(MapCtx);
  const [added, setAdded] = useState(false);
  useEffect(() => {
    if (!map || !ready) return undefined;
    map.addSource(id, { type: 'geojson', data });
    setAdded(true);
    return () => { try { (map.getStyle()?.layers ?? []).filter((l) => l.source === id).forEach((l) => map.removeLayer(l.id)); map.removeSource(id); } catch {} };
  }, [map, ready, id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (added) map.getSource(id)?.setData(data); }, [data, added]); // eslint-disable-line react-hooks/exhaustive-deps
  return added ? <SrcCtx.Provider value={id}>{children}</SrcCtx.Provider> : null;
}

export function Layer({ id, type, layout, paint, filter }) {
  const { map } = useContext(MapCtx);
  const source = useContext(SrcCtx);
  useEffect(() => {
    if (!map || !source) return;
    map.addLayer({ id, type, source, layout, paint, ...(filter ? { filter } : {}) });
  }, [map, source]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
