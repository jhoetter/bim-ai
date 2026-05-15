/**
 * GeoMapPicker — interactive Leaflet map for picking a georeference anchor.
 *
 * - Click anywhere on the map to set the anchor (lat/lon).
 * - A dashed circle shows the context radius.
 * - Address search box geocodes via Nominatim (no API key needed).
 * - Radius selector changes the circle live.
 * - onChange fires whenever the anchor or radius changes.
 */
import { useEffect, useRef, useState, type JSX } from 'react';
import type * as L from 'leaflet';

export type GeoAnchor = {
  lat: number;
  lon: number;
  contextRadiusM: number;
};

type Props = {
  value: GeoAnchor;
  onChange: (next: GeoAnchor) => void;
};

const RADIUS_OPTIONS = [100, 300, 500, 1000] as const;

const OSM_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export function GeoMapPicker({ value, onChange }: Props): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);

  const [searchDraft, setSearchDraft] = useState('');
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchError, setSearchError] = useState('');

  // Keep a ref so leaflet callbacks always read latest value without re-creating handlers.
  const valueRef = useRef(value);
  valueRef.current = value;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Mount leaflet once.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    let map: L.Map;
    let marker: L.Marker;
    let circle: L.Circle;

    import('leaflet').then((LMod) => {
      const Leaflet = LMod.default ?? LMod;

      // Fix broken default icon paths when bundled with Vite.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (Leaflet.Icon.Default.prototype as any)._getIconUrl;
      Leaflet.Icon.Default.mergeOptions({
        iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href,
        iconUrl: new URL('leaflet/dist/images/marker-icon.png', import.meta.url).href,
        shadowUrl: new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).href,
      });

      const { lat, lon, contextRadiusM } = valueRef.current;

      map = Leaflet.map(container, { zoomControl: true }).setView([lat, lon], 14);

      Leaflet.tileLayer(OSM_TILE_URL, {
        attribution: OSM_ATTRIBUTION,
        maxZoom: 19,
      }).addTo(map);

      marker = Leaflet.marker([lat, lon], { draggable: true }).addTo(map);

      circle = Leaflet.circle([lat, lon], {
        radius: contextRadiusM,
        color: '#fb923c',
        fillColor: '#fb923c',
        fillOpacity: 0.08,
        weight: 1.5,
        dashArray: '6 4',
      }).addTo(map);

      function applyLatLon(newLat: number, newLon: number) {
        const latlng = Leaflet.latLng(newLat, newLon);
        marker.setLatLng(latlng);
        circle.setLatLng(latlng);
        onChangeRef.current({
          lat: newLat,
          lon: newLon,
          contextRadiusM: valueRef.current.contextRadiusM,
        });
      }

      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        applyLatLon(pos.lat, pos.lng);
      });

      map.on('click', (e: L.LeafletMouseEvent) => {
        applyLatLon(e.latlng.lat, e.latlng.lng);
      });

      mapRef.current = map;
      markerRef.current = marker;
      circleRef.current = circle;
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync external value changes (e.g. address search result) into the map.
  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    const circle = circleRef.current;
    if (!map || !marker || !circle) return;
    const latlng = { lat: value.lat, lng: value.lon };
    marker.setLatLng(latlng);
    circle.setLatLng(latlng);
    circle.setRadius(value.contextRadiusM);
    map.panTo(latlng);
  }, [value.lat, value.lon, value.contextRadiusM]);

  async function handleSearch() {
    const q = searchDraft.trim();
    if (!q) return;
    setSearchBusy(true);
    setSearchError('');
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`,
        { headers: { 'Accept-Language': 'en' } },
      );
      const results = (await res.json()) as Array<{ lat: string; lon: string }>;
      const first = results[0];
      if (!first) {
        setSearchError('No results — try a more specific address.');
        return;
      }
      onChange({
        lat: parseFloat(first.lat),
        lon: parseFloat(first.lon),
        contextRadiusM: value.contextRadiusM,
      });
      mapRef.current?.setView([parseFloat(first.lat), parseFloat(first.lon)], 15);
    } catch {
      setSearchError('Search failed. Check your connection.');
    } finally {
      setSearchBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Address search */}
      <div className="flex gap-1.5">
        <input
          className="flex-1 rounded border border-border bg-surface px-2 py-1.5 text-[11px] text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
          type="text"
          placeholder="Search address…"
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleSearch();
          }}
        />
        <button
          type="button"
          className="rounded border border-border bg-surface px-3 py-1.5 text-[11px] text-muted hover:border-accent hover:text-accent disabled:opacity-40"
          disabled={searchBusy || !searchDraft.trim()}
          onClick={() => void handleSearch()}
        >
          {searchBusy ? '…' : 'Find'}
        </button>
      </div>
      {searchError ? <p className="text-[10px] text-danger">{searchError}</p> : null}

      {/* Map */}
      <div
        ref={containerRef}
        className="h-56 w-full overflow-hidden rounded border border-border"
        style={{ zIndex: 0 }}
      />

      {/* Coords read-out + radius picker */}
      <div className="flex items-center gap-3 text-[10px] text-muted">
        <span className="font-mono">
          {value.lat.toFixed(5)}, {value.lon.toFixed(5)}
        </span>
        <span className="ml-auto">Context radius</span>
        <select
          className="h-6 rounded border border-border bg-surface px-1.5 text-[10px] text-foreground"
          value={String(value.contextRadiusM)}
          onChange={(e) => onChange({ ...value, contextRadiusM: Number(e.target.value) })}
        >
          {RADIUS_OPTIONS.map((r) => (
            <option key={r} value={String(r)}>
              {r} m
            </option>
          ))}
        </select>
      </div>

      <p className="text-[10px] text-muted">
        Click the map or drag the marker to set the site anchor. The orange circle shows what
        neighbourhood geometry will load in the 3D viewer (buildings, roads, trees, water).
      </p>
    </div>
  );
}
