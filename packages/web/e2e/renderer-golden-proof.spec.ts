import { inflateSync } from 'node:zlib';

import { expect, test, type Page } from '@playwright/test';
import type { Element } from '@bim-ai/core';

import { collectRendererDiagnosticPacket } from '../src/viewport/collectRendererDiagnostics';

const MODEL_ID = '00000000-0000-4000-a000-00000024a001';
const GOLDEN_IDS = {
  wall: 'w24a-wall-host',
  door: 'w24a-door',
  window: 'w24a-window',
  wallOpening: 'w24a-wall-opening',
  floor: 'w24a-floor',
  slabOpening: 'w24a-slab-opening',
  roof: 'w24a-roof',
  roofOpening: 'w24a-roof-opening',
  stair: 'w24a-stair',
  railing: 'w24a-railing',
  room: 'w24a-room',
} as const;

const elementsById = {
  'w24a-level-0': {
    kind: 'level',
    id: 'w24a-level-0',
    name: 'Ground',
    elevationMm: 0,
  },
  'w24a-level-1': {
    kind: 'level',
    id: 'w24a-level-1',
    name: 'Upper',
    elevationMm: 3000,
  },
  'w24a-wall-type': {
    kind: 'wall_type',
    id: 'w24a-wall-type',
    name: 'W24-A layered wall',
    layers: [
      { function: 'finish', thicknessMm: 20, materialKey: 'white_render' },
      { function: 'structure', thicknessMm: 220, materialKey: 'concrete_smooth' },
      { function: 'finish', thicknessMm: 20, materialKey: 'render_terracotta' },
    ],
  },
  'w24a-floor-type': {
    kind: 'floor_type',
    id: 'w24a-floor-type',
    name: 'W24-A concrete slab',
    layers: [{ function: 'structure', thicknessMm: 260, materialKey: 'concrete_smooth' }],
  },
  'w24a-roof-type': {
    kind: 'roof_type',
    id: 'w24a-roof-type',
    name: 'W24-A terracotta roof',
    layers: [{ function: 'finish', thicknessMm: 180, materialKey: 'roof_tile_terracotta' }],
  },
  [GOLDEN_IDS.floor]: {
    kind: 'floor',
    id: GOLDEN_IDS.floor,
    name: 'Golden slab with stair opening',
    levelId: 'w24a-level-0',
    floorTypeId: 'w24a-floor-type',
    thicknessMm: 260,
    boundaryMm: [
      { xMm: -1200, yMm: -1200 },
      { xMm: 9000, yMm: -1200 },
      { xMm: 9000, yMm: 5800 },
      { xMm: -1200, yMm: 5800 },
    ],
    cutBy: [GOLDEN_IDS.slabOpening],
    graphicsOverride: { surfaceColorHex: '#6ca66b' },
  },
  [GOLDEN_IDS.slabOpening]: {
    kind: 'slab_opening',
    id: GOLDEN_IDS.slabOpening,
    name: 'Stair shaft',
    hostFloorId: GOLDEN_IDS.floor,
    boundaryMm: [
      { xMm: 4800, yMm: 400 },
      { xMm: 6900, yMm: 400 },
      { xMm: 6900, yMm: 2500 },
      { xMm: 4800, yMm: 2500 },
    ],
    isShaft: true,
  },
  [GOLDEN_IDS.wall]: {
    kind: 'wall',
    id: GOLDEN_IDS.wall,
    name: 'Golden hosted-cut wall',
    levelId: 'w24a-level-0',
    start: { xMm: 0, yMm: 0 },
    end: { xMm: 7600, yMm: 0 },
    thicknessMm: 260,
    heightMm: 3000,
    wallTypeId: 'w24a-wall-type',
    cutBy: [GOLDEN_IDS.door, GOLDEN_IDS.window, GOLDEN_IDS.wallOpening],
    graphicsOverride: { surfaceColorHex: '#d8d2bd' },
  },
  [GOLDEN_IDS.door]: {
    kind: 'door',
    id: GOLDEN_IDS.door,
    name: 'Golden swing door',
    wallId: GOLDEN_IDS.wall,
    levelId: 'w24a-level-0',
    alongT: 0.22,
    widthMm: 1000,
    overrideParams: { heightMm: 2200 },
    materialKey: 'asset_oak_plank_satin',
    materialSlots: {
      frame: 'asset_oak_plank_satin',
      panel: 'asset_oak_plank_satin',
      threshold: 'concrete_smooth',
      hardware: 'aluminium_dark_grey',
      glass: 'glass_clear',
    },
    operationType: 'swing_single',
  },
  [GOLDEN_IDS.window]: {
    kind: 'window',
    id: GOLDEN_IDS.window,
    name: 'Golden ribbon window',
    wallId: GOLDEN_IDS.wall,
    levelId: 'w24a-level-0',
    alongT: 0.52,
    widthMm: 1500,
    sillHeightMm: 900,
    heightMm: 1150,
    materialKey: 'aluminium_dark_grey',
    materialSlots: {
      frame: 'aluminium_dark_grey',
      sash: 'aluminium_dark_grey',
      glass: 'glass_clear',
      spacer: 'aluminium_dark_grey',
      hardware: 'aluminium_dark_grey',
      shading: 'white_render',
    },
    outlineKind: 'rectangle',
  },
  [GOLDEN_IDS.wallOpening]: {
    kind: 'wall_opening',
    id: GOLDEN_IDS.wallOpening,
    name: 'Service wall opening',
    hostWallId: GOLDEN_IDS.wall,
    alongTStart: 0.76,
    alongTEnd: 0.88,
    sillHeightMm: 350,
    headHeightMm: 2200,
  },
  [GOLDEN_IDS.roof]: {
    kind: 'roof',
    id: GOLDEN_IDS.roof,
    name: 'Golden asymmetric roof with court cut',
    referenceLevelId: 'w24a-level-1',
    roofTypeId: 'w24a-roof-type',
    materialKey: 'roof_tile_terracotta',
    roofGeometryMode: 'asymmetric_gable',
    ridgeAxis: 'z',
    slopeDeg: 24,
    ridgeOffsetTransverseMm: -700,
    eaveHeightLeftMm: 700,
    eaveHeightRightMm: 250,
    footprintMm: [
      { xMm: -700, yMm: -800 },
      { xMm: 8400, yMm: -800 },
      { xMm: 8400, yMm: 5200 },
      { xMm: -700, yMm: 5200 },
    ],
    graphicsOverride: { surfaceColorHex: '#9f3f2f' },
  },
  [GOLDEN_IDS.roofOpening]: {
    kind: 'roof_opening',
    id: GOLDEN_IDS.roofOpening,
    name: 'Roof terrace court',
    hostRoofId: GOLDEN_IDS.roof,
    boundaryMm: [
      { xMm: 6600, yMm: 900 },
      { xMm: 8400, yMm: 900 },
      { xMm: 8400, yMm: 3300 },
      { xMm: 6600, yMm: 3300 },
    ],
    props: {
      occupiedTerrace: true,
      roofOpeningRenderSupport: {
        cut: true,
        occupiedFloor: true,
        returns: true,
        guard: true,
        drainage: true,
        support: true,
        evidenceView: 'main_front_left',
      },
    },
  },
  [GOLDEN_IDS.stair]: {
    kind: 'stair',
    id: GOLDEN_IDS.stair,
    name: 'Golden straight stair',
    baseLevelId: 'w24a-level-0',
    topLevelId: 'w24a-level-1',
    runStartMm: { xMm: 5200, yMm: 2200 },
    runEndMm: { xMm: 5200, yMm: 200 },
    widthMm: 1000,
    riserMm: 176,
    treadMm: 280,
    shape: 'straight',
  },
  [GOLDEN_IDS.railing]: {
    kind: 'railing',
    id: GOLDEN_IDS.railing,
    name: 'Golden stair guard',
    hostedStairId: GOLDEN_IDS.stair,
    pathMm: [
      { xMm: 4700, yMm: 2200 },
      { xMm: 4700, yMm: 200 },
    ],
    guardHeightMm: 1050,
    balusterPattern: { rule: 'vertical', spacingMm: 125 },
    materialSlots: { topRail: 'aluminium_dark_grey', baluster: 'aluminium_dark_grey' },
  },
  [GOLDEN_IDS.room]: {
    kind: 'room',
    id: GOLDEN_IDS.room,
    name: 'Golden room overlay',
    levelId: 'w24a-level-0',
    roomFillOverrideHex: '#5b9bd5',
    outlineMm: [
      { xMm: 200, yMm: 500 },
      { xMm: 3800, yMm: 500 },
      { xMm: 3800, yMm: 3400 },
      { xMm: 200, yMm: 3400 },
    ],
  },
  main_front_left: {
    kind: 'viewpoint',
    id: 'main_front_left',
    name: 'Main front left',
    mode: 'orbit_3d',
    camera: {
      position: { xMm: 5500, yMm: -10200, zMm: 6600 },
      target: { xMm: 3600, yMm: 1600, zMm: 1850 },
      up: { xMm: 0, yMm: 0, zMm: 1 },
    },
    viewerShadowsEnabled: false,
    viewerAmbientOcclusionEnabled: false,
    viewerDepthCueEnabled: false,
    viewerSilhouetteEdgeWidth: 2,
  },
} satisfies Record<string, Element>;

const snapshot = {
  modelId: MODEL_ID,
  revision: 24,
  elements: elementsById,
  violations: [],
};

test.describe('Wave 24-A renderer golden proof', () => {
  test('feature-status packet covers hosted cuts, 3D fidelity classes, lenses, and proxies', () => {
    const packet = collectRendererDiagnosticPacket({
      elementsById,
      generatedAtIso: '2026-05-19T00:00:00.000Z',
      modelRevision: snapshot.revision,
      viewId: 'main_front_left',
      rendererBuild: 'playwright-w24a',
      gitHead: 'local-w24a',
      csgEnabled: true,
      lensMode: 'structure',
      visibleElementIds: Object.keys(elementsById),
      budgetsMs: { sceneRebuild: 12, renderFrame: 9 },
      evidence: {
        source: 'test',
        agentWave: 'W24-A',
        details: {
          pixelProof: true,
          featureStatusProof: true,
          representativeGoldenSeed: true,
        },
      },
    });

    expect(packet.format).toBe('rendererDiagnosticPacket_v1');
    expect(packet.supportMatrixDigest).toMatch(/^rsm-/);

    const statuses = new Map(
      packet.elementRenderStatuses?.map((status) => [status.elementId, status]),
    );
    expect(statuses.get(GOLDEN_IDS.wall)?.geometry).toMatchObject({
      feature: 'wall-geometry',
      state: 'supported',
      implementation: 'native',
    });
    expect(statuses.get(GOLDEN_IDS.door)?.geometry).toMatchObject({
      feature: 'hosted-opening-cut',
      state: 'partial',
      implementation: 'analytic-cut',
    });
    expect(statuses.get(GOLDEN_IDS.window)?.family.proxyFallback).toBe(false);
    expect(statuses.get(GOLDEN_IDS.wallOpening)?.geometry.feature).toBe('hosted-opening-cut');
    expect(statuses.get(GOLDEN_IDS.roof)?.geometry).toMatchObject({
      feature: 'roof-geometry',
      state: 'partial',
      implementation: 'native',
    });
    expect(statuses.get(GOLDEN_IDS.roofOpening)?.geometry).toMatchObject({
      feature: 'roof-opening-cut',
      state: 'partial',
    });
    expect(statuses.get(GOLDEN_IDS.slabOpening)?.geometry).toMatchObject({
      feature: 'slab-opening-cut',
      state: 'partial',
    });
    expect(statuses.get(GOLDEN_IDS.stair)?.geometry).toMatchObject({
      feature: 'stair-geometry',
      state: 'partial',
    });
    expect(statuses.get(GOLDEN_IDS.railing)?.geometry).toMatchObject({
      feature: 'railing-geometry',
      state: 'partial',
    });
    expect(statuses.get(GOLDEN_IDS.room)?.geometry).toMatchObject({
      feature: 'room-visualization',
      state: 'supported',
      implementation: 'diagnostic-overlay',
    });
    expect(statuses.get(GOLDEN_IDS.floor)?.material).toMatchObject({
      state: 'resolved',
      materialKey: 'concrete_smooth',
    });
    expect(statuses.get(GOLDEN_IDS.wall)?.lens.visibility).toBe('ghost');
    expect(statuses.get(GOLDEN_IDS.floor)?.lens.visibility).toBe('foreground');

    expect(packet.diagnostics.filter((diagnostic) => diagnostic.severity === 'error')).toEqual([]);
    expect(
      packet.diagnostics.filter((diagnostic) =>
        diagnostic.code.startsWith('renderer.hosted_opening.detached_proxy'),
      ),
    ).toEqual([]);
    expect(
      [...statuses.values()].filter(
        (status) => status.family.proxyFallback || status.asset.proxyFallback,
      ),
    ).toEqual([]);
  });

  test('live 3D viewport renders nonblank framed pixels with critical feature colors', async ({
    page,
  }) => {
    await routeGoldenModel(page);
    await page.goto('/');
    await page.waitForSelector('[data-testid="app-shell"]', { timeout: 30_000 });

    const viewport = page.getByTestId('orbit-3d-viewport');
    await expect(viewport).toBeVisible({ timeout: 15_000 });

    const canvas = page.getByTestId('orbit-3d-canvas');
    await expect(canvas).toBeVisible({ timeout: 15_000 });
    await canvas.evaluate((el) => el.getBoundingClientRect().width > 100);
    await page.waitForTimeout(1_500);
    await viewport.click({ position: { x: 80, y: 80 } });
    await page.keyboard.press('f');
    await page.waitForTimeout(1_500);

    const png = await canvas.screenshot();
    const proof = analyzePng(png);

    expect(proof.width).toBeGreaterThanOrEqual(320);
    expect(proof.height).toBeGreaterThanOrEqual(240);
    expect(proof.nonBackgroundRatio).toBeGreaterThan(0.035);
    expect(proof.nonBackgroundRatio).toBeLessThan(0.72);
    expect(proof.coverage.minX).toBeGreaterThan(4);
    expect(proof.coverage.minY).toBeGreaterThan(4);
    expect(proof.coverage.maxX).toBeLessThan(proof.width - 4);
    expect(proof.coverage.maxY).toBeLessThan(proof.height - 4);
    expect(proof.coverage.width / proof.width).toBeGreaterThan(0.16);
    expect(proof.coverage.height / proof.height).toBeGreaterThan(0.18);
    expect(proof.buckets.warmRoof).toBeGreaterThan(120);
    expect(proof.buckets.neutralWallSlab).toBeGreaterThan(500);
    expect(proof.buckets.blueRoom).toBeGreaterThan(20);
    expect(proof.buckets.darkFramesAndRails).toBeGreaterThan(45);
    expect(proof.distinctRgbBuckets).toBeGreaterThan(28);
  });
});

async function routeGoldenModel(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('bim.welcome.dismissed', '1');
    localStorage.setItem('bim.onboarding-completed', 'true');
    localStorage.setItem('bim.workspaceLayout', 'split_plan_3d');
    localStorage.setItem('bim.viewer.background', 'white');
  });

  await page.route('**/api/bootstrap', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        projects: [
          {
            id: 'p-w24a',
            slug: 'w24a',
            title: 'W24-A Golden',
            seedLibrary: true,
            models: [{ id: MODEL_ID, slug: 'renderer-golden', revision: snapshot.revision }],
          },
        ],
      }),
    });
  });
  await page.route(`**/api/models/${encodeURIComponent(MODEL_ID)}/snapshot**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(snapshot),
    });
  });
  await page.route('**/api/models/*/comments', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await page.route('**/api/models/*/activity', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"events":[]}' });
  });
  await page.route('**/api/building-presets', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '{"presets":{"residential":{}}}',
    });
  });
}

function analyzePng(buffer: Buffer): {
  width: number;
  height: number;
  nonBackgroundRatio: number;
  coverage: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    height: number;
  };
  buckets: {
    warmRoof: number;
    neutralWallSlab: number;
    blueRoom: number;
    darkFramesAndRails: number;
  };
  distinctRgbBuckets: number;
} {
  const png = decodePngRgba(buffer);
  const corner = sampleCornerBackground(png);
  const buckets = {
    warmRoof: 0,
    neutralWallSlab: 0,
    blueRoom: 0,
    darkFramesAndRails: 0,
  };
  const distinct = new Set<string>();
  let minX = png.width;
  let minY = png.height;
  let maxX = 0;
  let maxY = 0;
  let nonBackground = 0;

  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const offset = (y * png.width + x) * 4;
      const r = png.data[offset]!;
      const g = png.data[offset + 1]!;
      const b = png.data[offset + 2]!;
      const distance = Math.abs(r - corner.r) + Math.abs(g - corner.g) + Math.abs(b - corner.b);
      if (distance <= 34 || !isLikelySceneFeaturePixel(r, g, b)) continue;
      nonBackground += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      distinct.add(`${r >> 4}:${g >> 4}:${b >> 4}`);

      if (r > 95 && r > g * 1.12 && g >= 35 && g < 120 && b < 105) buckets.warmRoof += 1;
      if (
        r >= 82 &&
        r <= 190 &&
        g >= 82 &&
        g <= 190 &&
        b >= 70 &&
        b <= 190 &&
        maxChannelDelta(r, g, b) <= 64
      ) {
        buckets.neutralWallSlab += 1;
      }
      if (b > 115 && b > r * 1.08 && b > g * 0.92) buckets.blueRoom += 1;
      if (r < 95 && g < 105 && b < 115) buckets.darkFramesAndRails += 1;
    }
  }

  return {
    width: png.width,
    height: png.height,
    nonBackgroundRatio: nonBackground / (png.width * png.height),
    coverage: {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    },
    buckets,
    distinctRgbBuckets: distinct.size,
  };
}

function maxChannelDelta(r: number, g: number, b: number): number {
  return Math.max(Math.abs(r - g), Math.abs(r - b), Math.abs(g - b));
}

function isLikelySceneFeaturePixel(r: number, g: number, b: number): boolean {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const saturation = max - min;
  const brightNeutralBackground = r > 184 && g > 184 && b > 184 && saturation < 52;
  const brightSkyBackground = b > 158 && g > 132 && r > 92 && b >= r + 18 && b >= g - 8;
  if (brightNeutralBackground || brightSkyBackground) return false;
  return r < 210 || g < 210 || b < 210;
}

function sampleCornerBackground(png: { width: number; height: number; data: Uint8Array }) {
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;
  const cornerSize = Math.min(12, png.width, png.height);
  for (let y = 0; y < cornerSize; y += 1) {
    for (let x = 0; x < cornerSize; x += 1) {
      const offset = (y * png.width + x) * 4;
      r += png.data[offset]!;
      g += png.data[offset + 1]!;
      b += png.data[offset + 2]!;
      count += 1;
    }
  }
  return { r: r / count, g: g / count, b: b / count };
}

function decodePngRgba(buffer: Buffer): { width: number; height: number; data: Uint8Array } {
  if (buffer.toString('ascii', 1, 4) !== 'PNG') throw new Error('Expected PNG buffer.');
  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  const idatChunks: Buffer[] = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const chunk = buffer.subarray(dataStart, dataEnd);
    if (type === 'IHDR') {
      width = chunk.readUInt32BE(0);
      height = chunk.readUInt32BE(4);
      colorType = chunk[9]!;
      if (chunk[8] !== 8 || (colorType !== 6 && colorType !== 2)) {
        throw new Error(`Unsupported PNG format: bitDepth=${chunk[8]} colorType=${colorType}`);
      }
    } else if (type === 'IDAT') {
      idatChunks.push(chunk);
    } else if (type === 'IEND') {
      break;
    }
    offset = dataEnd + 4;
  }

  const raw = inflateSync(Buffer.concat(idatChunks));
  const channels = colorType === 6 ? 4 : 3;
  const stride = width * channels;
  const data = new Uint8Array(width * height * 4);
  let rawOffset = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[rawOffset]!;
    rawOffset += 1;
    const row = raw.subarray(rawOffset, rawOffset + stride);
    rawOffset += stride;
    const decodedRow = new Uint8Array(stride);
    const previousRow =
      y > 0 ? data.subarray((y - 1) * width * 4, y * width * 4) : new Uint8Array(0);
    for (let x = 0; x < stride; x += 1) {
      const left = x >= channels ? decodedRow[x - channels]! : 0;
      const up = y > 0 ? previousRow[Math.floor(x / channels) * 4 + (x % channels)]! : 0;
      const upLeft =
        y > 0 && x >= channels
          ? previousRow[Math.floor((x - channels) / channels) * 4 + ((x - channels) % channels)]!
          : 0;
      const value = row[x]!;
      decodedRow[x] = unfilterByte(filter, value, left, up, upLeft);
    }
    for (let x = 0; x < width; x += 1) {
      const src = x * channels;
      const dst = (y * width + x) * 4;
      data[dst] = decodedRow[src]!;
      data[dst + 1] = decodedRow[src + 1]!;
      data[dst + 2] = decodedRow[src + 2]!;
      data[dst + 3] = channels === 4 ? decodedRow[src + 3]! : 255;
    }
  }

  return { width, height, data };
}

function unfilterByte(filter: number, value: number, left: number, up: number, upLeft: number) {
  if (filter === 0) return value;
  if (filter === 1) return (value + left) & 0xff;
  if (filter === 2) return (value + up) & 0xff;
  if (filter === 3) return (value + Math.floor((left + up) / 2)) & 0xff;
  if (filter === 4) return (value + paeth(left, up, upLeft)) & 0xff;
  throw new Error(`Unsupported PNG filter ${filter}`);
}

function paeth(left: number, up: number, upLeft: number) {
  const p = left + up - upLeft;
  const pa = Math.abs(p - left);
  const pb = Math.abs(p - up);
  const pc = Math.abs(p - upLeft);
  if (pa <= pb && pa <= pc) return left;
  if (pb <= pc) return up;
  return upLeft;
}
