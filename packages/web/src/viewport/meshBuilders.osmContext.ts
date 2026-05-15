import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type {
  OsmBuilding,
  OsmFeature,
  OsmGreen,
  OsmRoad,
  OsmTree,
  OsmWater,
} from '../osm/fetchOverpass';

// ── Performance guard ────────────────────────────────────────────────────────

/** Hard cap: stop adding geometry once the merged face count exceeds this. */
const MAX_FACES = 5_000;

// ── Coordinate helpers ───────────────────────────────────────────────────────

/** Convert a list of {xMm, yMm} points to THREE.Vector2 for use in a Shape.
 *  Matches the bim-ai convention: xMm→x, -yMm→y, then rotateX(-PI/2) to lay flat. */
function toVec2(pts: Array<{ xMm: number; yMm: number }>): THREE.Vector2[] {
  return pts.map((p) => new THREE.Vector2(p.xMm / 1000, -p.yMm / 1000));
}

// ── Buildings ────────────────────────────────────────────────────────────────

export function makeOsmBuildingsGroup(buildings: OsmBuilding[]): THREE.Group {
  const group = new THREE.Group();
  group.userData.osmLayer = 'buildings';

  const geoms: THREE.BufferGeometry[] = [];
  let faceCount = 0;

  for (const b of buildings) {
    if (b.footprintMm.length < 3) continue;
    if (faceCount >= MAX_FACES) break;

    const shape = new THREE.Shape(toVec2(b.footprintMm));
    const heightM = b.heightMm / 1000;
    const geom = new THREE.ExtrudeGeometry(shape, { depth: heightM, bevelEnabled: false });
    geom.rotateX(-Math.PI / 2);

    faceCount += geom.index ? geom.index.count / 3 : (geom.attributes['position']?.count ?? 0) / 3;
    geoms.push(geom);
  }

  if (geoms.length === 0) return group;

  const merged = mergeGeometries(geoms, false);
  geoms.forEach((g) => g.dispose());
  if (!merged) return group;

  const mesh = new THREE.Mesh(
    merged,
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x9ca3af),
      roughness: 0.9,
      metalness: 0.0,
      transparent: false,
    }),
  );
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.userData.osmNonPickable = true;
  group.add(mesh);
  return group;
}

// ── Roads ────────────────────────────────────────────────────────────────────

function buildRoadQuadStrip(
  centreline: Array<{ xMm: number; yMm: number }>,
  widthMm: number,
): THREE.BufferGeometry | null {
  if (centreline.length < 2) return null;
  const halfW = widthMm / 2 / 1000;

  const positions: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i < centreline.length - 1; i++) {
    const a = centreline[i]!;
    const b = centreline[i + 1]!;
    const ax = a.xMm / 1000;
    const az = -a.yMm / 1000;
    const bx = b.xMm / 1000;
    const bz = -b.yMm / 1000;

    const dx = bx - ax;
    const dz = bz - az;
    const len = Math.sqrt(dx * dx + dz * dz);
    if (len < 1e-6) continue;

    const nx = (-dz / len) * halfW;
    const nz = (dx / len) * halfW;

    const base = positions.length / 3;
    // 4 verts: left-start, right-start, left-end, right-end (Y=0 for flat)
    positions.push(ax + nx, 0, az + nz);
    positions.push(ax - nx, 0, az - nz);
    positions.push(bx + nx, 0, bz + nz);
    positions.push(bx - nx, 0, bz - nz);

    indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
  }

  if (positions.length === 0) return null;

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

export function makeOsmRoadsGroup(roads: OsmRoad[]): THREE.Group {
  const group = new THREE.Group();
  group.userData.osmLayer = 'roads';

  const geoms: THREE.BufferGeometry[] = [];
  let faceCount = 0;

  for (const road of roads) {
    if (faceCount >= MAX_FACES) break;
    const geom = buildRoadQuadStrip(road.centreline, road.widthMm);
    if (!geom) continue;
    faceCount += (geom.index?.count ?? 0) / 3;
    geoms.push(geom);
  }

  if (geoms.length === 0) return group;

  const merged = mergeGeometries(geoms, false);
  geoms.forEach((g) => g.dispose());
  if (!merged) return group;

  const mesh = new THREE.Mesh(
    merged,
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x4b5563),
      roughness: 0.95,
      metalness: 0.0,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
  );
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.userData.osmNonPickable = true;
  group.add(mesh);
  return group;
}

// ── Trees ────────────────────────────────────────────────────────────────────

export function makeOsmTreesGroup(trees: OsmTree[]): THREE.Group {
  const group = new THREE.Group();
  group.userData.osmLayer = 'trees';

  if (trees.length === 0) return group;

  const positions: number[] = [];
  for (const t of trees) {
    positions.push(t.positionMm.xMm / 1000, 0, -t.positionMm.yMm / 1000);
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

  const points = new THREE.Points(
    geom,
    new THREE.PointsMaterial({
      color: new THREE.Color(0x86efac),
      size: 2.5,
      sizeAttenuation: true,
    }),
  );
  points.userData.osmNonPickable = true;
  group.add(points);
  return group;
}

// ── Water ────────────────────────────────────────────────────────────────────

function buildFlatPolygon(
  footprint: Array<{ xMm: number; yMm: number }>,
  yOffset: number,
): THREE.BufferGeometry | null {
  if (footprint.length < 3) return null;
  const shape = new THREE.Shape(toVec2(footprint));
  const geom = new THREE.ShapeGeometry(shape);
  geom.rotateX(-Math.PI / 2);
  geom.translate(0, yOffset, 0);
  return geom;
}

export function makeOsmWaterGroup(water: OsmWater[]): THREE.Group {
  const group = new THREE.Group();
  group.userData.osmLayer = 'water';

  const geoms: THREE.BufferGeometry[] = [];
  let faceCount = 0;

  for (const w of water) {
    if (faceCount >= MAX_FACES) break;
    const geom = buildFlatPolygon(w.footprintMm, -0.01);
    if (!geom) continue;
    faceCount += (geom.attributes['position']?.count ?? 0) / 3;
    geoms.push(geom);
  }

  if (geoms.length === 0) return group;

  const merged = mergeGeometries(geoms, false);
  geoms.forEach((g) => g.dispose());
  if (!merged) return group;

  const mesh = new THREE.Mesh(
    merged,
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x93c5fd),
      roughness: 0.2,
      metalness: 0.1,
      transparent: true,
      opacity: 0.5,
    }),
  );
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.userData.osmNonPickable = true;
  group.add(mesh);
  return group;
}

// ── Green areas ──────────────────────────────────────────────────────────────

export function makeOsmGreenGroup(green: OsmGreen[]): THREE.Group {
  const group = new THREE.Group();
  group.userData.osmLayer = 'green';

  const geoms: THREE.BufferGeometry[] = [];
  let faceCount = 0;

  for (const g of green) {
    if (faceCount >= MAX_FACES) break;
    const geom = buildFlatPolygon(g.footprintMm, -0.005);
    if (!geom) continue;
    faceCount += (geom.attributes['position']?.count ?? 0) / 3;
    geoms.push(geom);
  }

  if (geoms.length === 0) return group;

  const merged = mergeGeometries(geoms, false);
  geoms.forEach((g) => g.dispose());
  if (!merged) return group;

  const mesh = new THREE.Mesh(
    merged,
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xbbf7d0),
      roughness: 0.95,
      metalness: 0.0,
      transparent: true,
      opacity: 0.4,
    }),
  );
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.userData.osmNonPickable = true;
  group.add(mesh);
  return group;
}

// ── Composite builder ────────────────────────────────────────────────────────

export type OsmLayerName = 'buildings' | 'roads' | 'trees' | 'water' | 'green';

/**
 * Build a complete OSM context THREE.Group from a flat feature array.
 * Pass `hiddenLayers` to suppress individual layers.
 */
export function makeOsmContextGroup(
  features: OsmFeature[],
  hiddenLayers: ReadonlySet<OsmLayerName> = new Set(),
): THREE.Group {
  const root = new THREE.Group();
  root.userData.osmContextGroup = true;

  const buildings = features.filter((f): f is OsmBuilding => f.type === 'building');
  const roads = features.filter((f): f is OsmRoad => f.type === 'road');
  const trees = features.filter((f): f is OsmTree => f.type === 'tree');
  const water = features.filter((f): f is OsmWater => f.type === 'water');
  const green = features.filter((f): f is OsmGreen => f.type === 'green');

  const buildingsGroup = makeOsmBuildingsGroup(buildings);
  buildingsGroup.visible = !hiddenLayers.has('buildings');
  root.add(buildingsGroup);

  const roadsGroup = makeOsmRoadsGroup(roads);
  roadsGroup.visible = !hiddenLayers.has('roads');
  root.add(roadsGroup);

  const treesGroup = makeOsmTreesGroup(trees);
  treesGroup.visible = !hiddenLayers.has('trees');
  root.add(treesGroup);

  const waterGroup = makeOsmWaterGroup(water);
  waterGroup.visible = !hiddenLayers.has('water');
  root.add(waterGroup);

  const greenGroup = makeOsmGreenGroup(green);
  greenGroup.visible = !hiddenLayers.has('green');
  root.add(greenGroup);

  return root;
}
