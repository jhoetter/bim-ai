import { wgs84ToMm } from './project';

// ── OSM feature types ────────────────────────────────────────────────────────

export type OsmBuilding = {
  type: 'building';
  footprintMm: Array<{ xMm: number; yMm: number }>;
  heightMm: number;
};

export type OsmRoad = {
  type: 'road';
  centreline: Array<{ xMm: number; yMm: number }>;
  widthMm: number;
};

export type OsmTree = {
  type: 'tree';
  positionMm: { xMm: number; yMm: number };
};

export type OsmWater = {
  type: 'water';
  footprintMm: Array<{ xMm: number; yMm: number }>;
};

export type OsmGreen = {
  type: 'green';
  footprintMm: Array<{ xMm: number; yMm: number }>;
};

export type OsmFeature = OsmBuilding | OsmRoad | OsmTree | OsmWater | OsmGreen;

// ── Road width by OSM highway class ─────────────────────────────────────────

const ROAD_WIDTH_MM: Record<string, number> = {
  motorway: 14_000,
  trunk: 12_000,
  primary: 12_000,
  secondary: 10_000,
  tertiary: 8_000,
  unclassified: 6_000,
  residential: 6_000,
  service: 4_000,
  living_street: 4_000,
  pedestrian: 4_000,
  footway: 2_000,
  path: 1_500,
  cycleway: 2_000,
  track: 3_000,
};

function roadWidthMm(highwayTag: string): number {
  return ROAD_WIDTH_MM[highwayTag] ?? 5_000;
}

// ── Overpass API ─────────────────────────────────────────────────────────────

const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter';

function buildQuery(lat: number, lon: number, radiusM: number): string {
  const r = Math.min(radiusM, 1000);
  return `[out:json][timeout:25];
(
  way["building"](around:${r},${lat},${lon});
  way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|service|living_street|pedestrian|footway|path|cycleway|track)$"](around:${r},${lat},${lon});
  node["natural"="tree"](around:${r},${lat},${lon});
  way["natural"~"^(water|wood)$"](around:${r},${lat},${lon});
  way["landuse"~"^(grass|park|meadow|forest|recreation_ground|village_green)$"](around:${r},${lat},${lon});
);
out geom;`;
}

function cacheKey(lat: number, lon: number, radiusM: number): string {
  return `osm:${lat.toFixed(4)}:${lon.toFixed(4)}:${radiusM}`;
}

// ── Raw Overpass types (subset we use) ──────────────────────────────────────

type OverpassNode = {
  type: 'node';
  id: number;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
};

type OverpassWay = {
  type: 'way';
  id: number;
  tags?: Record<string, string>;
  geometry: Array<{ lat: number; lon: number }>;
};

type OverpassElement = OverpassNode | OverpassWay;

// ── Parser ───────────────────────────────────────────────────────────────────

function parseElements(
  elements: OverpassElement[],
  anchorLat: number,
  anchorLon: number,
): OsmFeature[] {
  const features: OsmFeature[] = [];

  for (const el of elements) {
    if (el.type === 'node') {
      if (el.tags?.['natural'] === 'tree') {
        features.push({
          type: 'tree',
          positionMm: wgs84ToMm(el.lat, el.lon, anchorLat, anchorLon),
        });
      }
      continue;
    }

    if (el.type === 'way') {
      const geom = el.geometry;
      if (!geom || geom.length < 2) continue;
      const pts = geom.map((g) => wgs84ToMm(g.lat, g.lon, anchorLat, anchorLon));
      const tags = el.tags ?? {};

      if (tags['building']) {
        const levelsStr = tags['building:levels'];
        const heightStr = tags['height'];
        let heightMm = 9_000;
        if (heightStr) {
          heightMm = parseFloat(heightStr) * 1000;
        } else if (levelsStr) {
          heightMm = parseFloat(levelsStr) * 3_000;
        }
        if (!isFinite(heightMm) || heightMm <= 0) heightMm = 9_000;
        heightMm = Math.min(heightMm, 300_000);
        features.push({ type: 'building', footprintMm: pts, heightMm });
        continue;
      }

      if (tags['highway']) {
        features.push({
          type: 'road',
          centreline: pts,
          widthMm: roadWidthMm(tags['highway']),
        });
        continue;
      }

      if (tags['natural'] === 'water' || tags['natural'] === 'wood') {
        const featureType = tags['natural'] === 'water' ? 'water' : 'green';
        features.push({ type: featureType, footprintMm: pts });
        continue;
      }

      if (tags['landuse']) {
        features.push({ type: 'green', footprintMm: pts });
        continue;
      }
    }
  }

  return features;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch OSM features around a lat/lon anchor within `radiusM` metres.
 * Results are cached in sessionStorage for the duration of the browser session.
 */
export async function fetchOsmContext(
  anchorLat: number,
  anchorLon: number,
  radiusM: number,
): Promise<OsmFeature[]> {
  const key = cacheKey(anchorLat, anchorLon, radiusM);

  const cached = sessionStorage.getItem(key);
  if (cached) {
    try {
      return JSON.parse(cached) as OsmFeature[];
    } catch {
      sessionStorage.removeItem(key);
    }
  }

  const query = buildQuery(anchorLat, anchorLon, radiusM);
  const res = await fetch(OVERPASS_ENDPOINT, {
    method: 'POST',
    body: query,
    headers: { 'Content-Type': 'text/plain' },
  });

  if (!res.ok) {
    throw new Error(`Overpass API error: ${res.status} ${res.statusText}`);
  }

  const json = (await res.json()) as { elements: OverpassElement[] };
  const features = parseElements(json.elements ?? [], anchorLat, anchorLon);

  try {
    sessionStorage.setItem(key, JSON.stringify(features));
  } catch {
    // Storage quota exceeded — skip caching silently.
  }

  return features;
}
