import { useEffect, useRef, useState, type JSX } from 'react';
import type * as L from 'leaflet';

export type GeoAnchor = {
  lat: number;
  lon: number;
  bboxNorth: number;
  bboxSouth: number;
  bboxEast: number;
  bboxWest: number;
};

type Props = {
  value: GeoAnchor;
  onChange: (next: GeoAnchor) => void;
};

const OSM_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

// Outer ring covers the whole world — used as the mask background.
const OUTER_RING: [number, number][] = [
  [-90, -180],
  [-90, 180],
  [90, 180],
  [90, -180],
];

function innerRing(s: number, w: number, n: number, e: number): [number, number][] {
  return [
    [s, w],
    [n, w],
    [n, e],
    [s, e],
  ];
}

/** Expand a centre point into a symmetric bbox of ~radiusM metres half-width. */
function defaultBbox(lat: number, lon: number, radiusM = 300): Omit<GeoAnchor, 'lat' | 'lon'> {
  const dLat = radiusM / 111_319.5;
  const dLon = radiusM / (111_319.5 * Math.cos((lat * Math.PI) / 180));
  return {
    bboxNorth: lat + dLat,
    bboxSouth: lat - dLat,
    bboxEast: lon + dLon,
    bboxWest: lon - dLon,
  };
}

type Suggestion = { lat: string; lon: string; display_name: string };

export function GeoMapPicker({ value, onChange }: Props): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const rectRef = useRef<L.Rectangle | null>(null);
  const maskRef = useRef<L.Polygon | null>(null);
  const previewRef = useRef<L.Rectangle | null>(null);

  const [searchDraft, setSearchDraft] = useState('');
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [drawMode, setDrawMode] = useState(false);
  const drawModeRef = useRef(false);
  const drawStartRef = useRef<{ lat: number; lng: number } | null>(null);

  const valueRef = useRef(value);
  valueRef.current = value;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Mount Leaflet once.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    let map: L.Map;
    let rect: L.Rectangle;
    let mask: L.Polygon;

    import('leaflet').then((LMod) => {
      const Leaflet = LMod.default ?? LMod;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (Leaflet.Icon.Default.prototype as any)._getIconUrl;
      Leaflet.Icon.Default.mergeOptions({
        iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href,
        iconUrl: new URL('leaflet/dist/images/marker-icon.png', import.meta.url).href,
        shadowUrl: new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).href,
      });

      const { lat, lon, bboxNorth, bboxSouth, bboxEast, bboxWest } = valueRef.current;

      map = Leaflet.map(container, {
        zoomControl: true,
        attributionControl: false,
      }).setView([lat, lon], 14);

      Leaflet.tileLayer(OSM_TILE_URL, { maxZoom: 19 }).addTo(map);

      // Dim mask — covers everything outside the bbox.
      mask = Leaflet.polygon(
        [OUTER_RING, innerRing(bboxSouth, bboxWest, bboxNorth, bboxEast)] as L.LatLngExpression[][],
        {
          color: 'transparent',
          fillColor: '#000',
          fillOpacity: 0.35,
          stroke: false,
          interactive: false,
        },
      ).addTo(map);

      // Orange rectangle — the selected bbox.
      rect = Leaflet.rectangle(
        [[bboxSouth, bboxWest] as L.LatLngTuple, [bboxNorth, bboxEast] as L.LatLngTuple],
        {
          color: '#fb923c',
          fillColor: '#fb923c',
          fillOpacity: 0.05,
          weight: 2,
          dashArray: '6 4',
          interactive: false,
        },
      ).addTo(map);

      function applyBbox(s: number, w: number, n: number, e: number) {
        const bounds = [
          [s, w],
          [n, e],
        ] as L.LatLngBoundsExpression;
        rect.setBounds(bounds);
        mask.setLatLngs([OUTER_RING, innerRing(s, w, n, e)] as L.LatLngExpression[][]);
      }

      // ── Draw mode events ──────────────────────────────────────────────────────

      map.on('mousedown', (e: L.LeafletMouseEvent) => {
        if (!drawModeRef.current) return;
        e.originalEvent.preventDefault();
        drawStartRef.current = { lat: e.latlng.lat, lng: e.latlng.lng };

        if (!previewRef.current) {
          previewRef.current = Leaflet.rectangle(
            [
              [e.latlng.lat, e.latlng.lng] as L.LatLngTuple,
              [e.latlng.lat, e.latlng.lng] as L.LatLngTuple,
            ],
            {
              color: '#3b82f6',
              fillColor: '#3b82f6',
              fillOpacity: 0.15,
              weight: 2,
              dashArray: '4 3',
              interactive: false,
            },
          ).addTo(map);
        }
      });

      map.on('mousemove', (e: L.LeafletMouseEvent) => {
        if (!drawModeRef.current || !drawStartRef.current || !previewRef.current) return;
        const s = drawStartRef.current;
        previewRef.current.setBounds([
          [Math.min(s.lat, e.latlng.lat), Math.min(s.lng, e.latlng.lng)],
          [Math.max(s.lat, e.latlng.lat), Math.max(s.lng, e.latlng.lng)],
        ] as L.LatLngBoundsExpression);
      });

      map.on('mouseup', (e: L.LeafletMouseEvent) => {
        if (!drawModeRef.current || !drawStartRef.current) return;
        const s = drawStartRef.current;
        drawStartRef.current = null;

        if (previewRef.current) {
          map.removeLayer(previewRef.current);
          previewRef.current = null;
        }

        let north = Math.max(s.lat, e.latlng.lat);
        let south = Math.min(s.lat, e.latlng.lat);
        let east = Math.max(s.lng, e.latlng.lng);
        let west = Math.min(s.lng, e.latlng.lng);

        if (north - south < 0.001 || east - west < 0.001) {
          const cLat = (north + south) / 2;
          const cLon = (east + west) / 2;
          const b = defaultBbox(cLat, cLon);
          north = b.bboxNorth;
          south = b.bboxSouth;
          east = b.bboxEast;
          west = b.bboxWest;
        }

        applyBbox(south, west, north, east);

        drawModeRef.current = false;
        setDrawMode(false);
        map.dragging.enable();
        map.getContainer().style.cursor = '';

        onChangeRef.current({
          lat: (north + south) / 2,
          lon: (east + west) / 2,
          bboxNorth: north,
          bboxSouth: south,
          bboxEast: east,
          bboxWest: west,
        });
      });

      // ── Normal click: shift bbox keeping same dimensions ──────────────────────

      map.on('click', (e: L.LeafletMouseEvent) => {
        if (drawModeRef.current) return;
        const { lat: cLat, lng: cLon } = e.latlng;
        const cur = valueRef.current;
        const halfLat = (cur.bboxNorth - cur.bboxSouth) / 2;
        const halfLon = (cur.bboxEast - cur.bboxWest) / 2;
        const next: GeoAnchor = {
          lat: cLat,
          lon: cLon,
          bboxNorth: cLat + halfLat,
          bboxSouth: cLat - halfLat,
          bboxEast: cLon + halfLon,
          bboxWest: cLon - halfLon,
        };
        applyBbox(next.bboxSouth, next.bboxWest, next.bboxNorth, next.bboxEast);
        onChangeRef.current(next);
      });

      mapRef.current = map;
      rectRef.current = rect;
      maskRef.current = mask;
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      rectRef.current = null;
      maskRef.current = null;
      previewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync external value (e.g. address search result) into the map.
  useEffect(() => {
    const map = mapRef.current;
    const rect = rectRef.current;
    const mask = maskRef.current;
    if (!map || !rect || !mask) return;
    const { bboxSouth, bboxWest, bboxNorth, bboxEast } = value;
    rect.setBounds([
      [bboxSouth, bboxWest],
      [bboxNorth, bboxEast],
    ] as L.LatLngBoundsExpression);
    mask.setLatLngs([
      OUTER_RING,
      innerRing(bboxSouth, bboxWest, bboxNorth, bboxEast),
    ] as L.LatLngExpression[][]);
    map.panTo([value.lat, value.lon]);
  }, [value.lat, value.lon, value.bboxNorth, value.bboxSouth, value.bboxEast, value.bboxWest]);

  // ── Draw mode toggle ────────────────────────────────────────────────────────

  function toggleDrawMode() {
    const map = mapRef.current;
    if (!map) return;
    const next = !drawMode;
    drawModeRef.current = next;
    setDrawMode(next);
    if (next) {
      map.dragging.disable();
      map.getContainer().style.cursor = 'crosshair';
    } else {
      drawStartRef.current = null;
      if (previewRef.current) {
        map.removeLayer(previewRef.current);
        previewRef.current = null;
      }
      map.dragging.enable();
      map.getContainer().style.cursor = '';
    }
  }

  // ── Address autocomplete ────────────────────────────────────────────────────

  function handleSearchInput(q: string) {
    setSearchDraft(q);
    setSearchError('');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    debounceRef.current = setTimeout(() => void fetchSuggestions(q), 300);
  }

  async function fetchSuggestions(q: string) {
    setSearchBusy(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5`,
        { headers: { 'Accept-Language': 'en' } },
      );
      const results = (await res.json()) as Suggestion[];
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
      if (results.length === 0) setSearchError('No results — try a more specific address.');
    } catch {
      setSearchError('Search failed. Check your connection.');
    } finally {
      setSearchBusy(false);
    }
  }

  function pickSuggestion(s: Suggestion) {
    const lat = parseFloat(s.lat);
    const lon = parseFloat(s.lon);
    setSearchDraft(s.display_name);
    setSuggestions([]);
    setShowSuggestions(false);
    setSearchError('');
    const bbox = defaultBbox(lat, lon);
    onChange({ lat, lon, ...bbox });
    mapRef.current?.setView([lat, lon], 15);
  }

  function handleSearchKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      if (suggestions[0]) pickSuggestion(suggestions[0]);
      else void fetchSuggestions(searchDraft);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  }

  // ── Derived display values ──────────────────────────────────────────────────

  const widthKm = (
    ((value.bboxEast - value.bboxWest) * 111_319.5 * Math.cos((value.lat * Math.PI) / 180)) /
    1000
  ).toFixed(2);
  const heightKm = (((value.bboxNorth - value.bboxSouth) * 111_319.5) / 1000).toFixed(2);

  return (
    <div className="flex flex-col gap-2">
      {/* Address search with autocomplete */}
      <div
        className="relative"
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) setShowSuggestions(false);
        }}
      >
        <div className="flex gap-1.5">
          <input
            className="flex-1 rounded border border-border bg-surface px-2 py-1.5 text-[11px] text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
            type="text"
            placeholder="Search address…"
            value={searchDraft}
            autoComplete="off"
            onChange={(e) => handleSearchInput(e.target.value)}
            onFocus={() => {
              if (suggestions.length > 0) setShowSuggestions(true);
            }}
            onKeyDown={handleSearchKeyDown}
          />
          <button
            type="button"
            className="rounded border border-border bg-surface px-3 py-1.5 text-[11px] text-muted hover:border-accent hover:text-accent disabled:opacity-40"
            disabled={searchBusy || !searchDraft.trim()}
            onClick={() => {
              if (suggestions[0]) pickSuggestion(suggestions[0]);
              else void fetchSuggestions(searchDraft);
            }}
          >
            {searchBusy ? '…' : 'Find'}
          </button>
        </div>
        {showSuggestions && suggestions.length > 0 ? (
          <ul className="absolute left-0 right-0 top-full z-50 mt-0.5 max-h-48 overflow-auto rounded border border-border bg-surface shadow-lg">
            {suggestions.map((s, i) => (
              <li key={i}>
                <button
                  type="button"
                  className="w-full px-2 py-1.5 text-left text-[11px] text-foreground hover:bg-accent/10 focus:bg-accent/10 focus:outline-none"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pickSuggestion(s);
                  }}
                >
                  {s.display_name}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {searchError ? <p className="text-[10px] text-danger">{searchError}</p> : null}

      {/* Map + draw toggle */}
      <div className="relative">
        <div
          ref={containerRef}
          className="h-64 w-full overflow-hidden rounded border border-border"
          style={{ zIndex: 0 }}
        />
        <button
          type="button"
          className={`absolute right-2 top-2 z-[400] rounded border px-2 py-1 text-[11px] shadow ${
            drawMode
              ? 'border-accent bg-accent text-white'
              : 'border-border bg-white/90 text-foreground hover:border-accent hover:text-accent'
          }`}
          onClick={toggleDrawMode}
        >
          {drawMode ? 'Cancel' : 'Draw area'}
        </button>
        {drawMode ? (
          <div className="pointer-events-none absolute bottom-2 left-2 z-[400] rounded border border-border bg-black/60 px-2 py-1 text-[10px] text-white">
            Drag to draw the context rectangle
          </div>
        ) : null}
      </div>

      {/* Coords + dimensions */}
      <div className="flex items-center gap-3 text-[10px] text-muted">
        <span className="font-mono">
          {value.lat.toFixed(5)}, {value.lon.toFixed(5)}
        </span>
        <span className="ml-auto font-mono">
          {widthKm} × {heightKm} km
        </span>
      </div>

      <p className="text-[10px] text-muted">
        Click the map to move the context area, or use "Draw area" to drag a custom rectangle. Hit
        Save to load the OSM data in the 3D viewer.
      </p>
    </div>
  );
}
