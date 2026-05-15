import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const outDir = scriptDir;
const baseUrl = 'http://127.0.0.1:2000/#theme=light';
const apiBase = 'http://127.0.0.1:8500/api';
const modelId = '9bb9a145-d9ce-5a2f-a748-bb5be3301b30';

await fs.mkdir(outDir, { recursive: true });

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${await res.text()}`);
  return res.json();
}

const pickPrefix = `wp43-pick-${Date.now().toString(36)}`;
const pickWalls = [
  {
    id: `${pickPrefix}-south`,
    name: 'WP43 picked-wall proof south',
    start: { xMm: -22000, yMm: 7000 },
    end: { xMm: -14000, yMm: 7000 },
  },
  {
    id: `${pickPrefix}-east`,
    name: 'WP43 picked-wall proof east',
    start: { xMm: -14000, yMm: 7000 },
    end: { xMm: -14000, yMm: 14000 },
  },
  {
    id: `${pickPrefix}-north`,
    name: 'WP43 picked-wall proof north',
    start: { xMm: -14000, yMm: 14000 },
    end: { xMm: -22000, yMm: 14000 },
  },
  {
    id: `${pickPrefix}-west`,
    name: 'WP43 picked-wall proof west',
    start: { xMm: -22000, yMm: 14000 },
    end: { xMm: -22000, yMm: 7000 },
  },
];

await postJson(`${apiBase}/models/${modelId}/commands/bundle`, {
  userId: 'wp43-playwright',
  clientOpId: `${pickPrefix}-walls`,
  commands: pickWalls.map((w) => ({
    type: 'createWall',
    id: w.id,
    name: w.name,
    levelId: 'hf-lvl-ground',
    start: w.start,
    end: w.end,
    thicknessMm: 200,
    heightMm: 3000,
    wallTypeId: 'hf-wt-interior',
  })),
});

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1920, height: 1200 } });
await context.addInitScript(() => {
  localStorage.setItem('bim.onboarding-completed', 'true');
  localStorage.removeItem('bim-ai:pane-layout-v1');
  localStorage.setItem(
    'bim-ai:tabs-v1',
    JSON.stringify({
      v: 1,
      tabs: [
        {
          id: 'plan:hf-lvl-ground-plan',
          kind: 'plan',
          targetId: 'hf-lvl-ground-plan',
          label: 'Plan · Ground Floor',
        },
      ],
      activeId: 'plan:hf-lvl-ground-plan',
    }),
  );
});
const page = await context.newPage();
const consoleWarningsAndErrors = [];
const pageErrors = [];
const mainFrameNavigations = [];
page.on('console', (msg) => {
  if (msg.type() === 'warning' || msg.type() === 'error') {
    const text = msg.text();
    if (!text.includes('favicon.ico')) consoleWarningsAndErrors.push({ type: msg.type(), text });
  }
});
page.on('pageerror', (err) => pageErrors.push(err.message));
page.on('framenavigated', (frame) => {
  if (frame === page.mainFrame()) mainFrameNavigations.push(frame.url());
});

async function boot() {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(800);
  if ((await page.getByText('Skip tour').count()) > 0) {
    await page.getByText('Skip tour').click();
    await page.waitForTimeout(200);
  }
  await page.getByTestId('primary-project-selector').waitFor({ state: 'visible', timeout: 15000 });
  const activeProject = await page.getByTestId('primary-project-selector').innerText();
  if (!activeProject.includes('target-house-3')) {
    await page.getByTestId('primary-project-selector').click();
    await page
      .getByTestId('project-menu-seed-target-house-3')
      .waitFor({ state: 'visible', timeout: 10000 });
    await page.getByTestId('project-menu-seed-target-house-3').click();
    await page
      .getByTestId('primary-project-selector')
      .filter({ hasText: /target-house-3/ })
      .waitFor({ state: 'visible', timeout: 15000 });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(800);
  }
  await page.getByTestId('plan-canvas').waitFor({ state: 'visible', timeout: 15000 });
  await page.getByTestId('ribbon-tab-sketch').click();
  await page.getByTestId('ribbon-command-floor').waitFor({ state: 'visible', timeout: 5000 });
}

function parseCoords(text) {
  const match = /X\s+(-?\d+(?:\.\d+)?)\s*m\s+Y\s+(-?\d+(?:\.\d+)?)\s*m/i.exec(text);
  if (!match) throw new Error(`Unable to parse cursor coordinates: ${text}`);
  return { xMm: Number(match[1]) * 1000, yMm: Number(match[2]) * 1000 };
}

async function coordAt(x, y) {
  await page.mouse.move(x, y);
  await page.waitForTimeout(80);
  return parseCoords(await page.getByLabel('Cursor coordinates').innerText());
}

async function modelToScreenFactory() {
  const canvas = await page.getByTestId('plan-canvas').boundingBox();
  if (!canvas) throw new Error('No plan canvas bbox');
  const originScreen = { x: canvas.x + canvas.width * 0.5, y: canvas.y + canvas.height * 0.52 };
  const xAxisScreen = { x: originScreen.x + 320, y: originScreen.y };
  const yAxisScreen = { x: originScreen.x, y: originScreen.y + 320 };
  const originPoint = await coordAt(originScreen.x, originScreen.y);
  const xAxisPoint = await coordAt(xAxisScreen.x, xAxisScreen.y);
  const yAxisPoint = await coordAt(yAxisScreen.x, yAxisScreen.y);
  const xBasis = {
    xMm: xAxisPoint.xMm - originPoint.xMm,
    yMm: xAxisPoint.yMm - originPoint.yMm,
  };
  const yBasis = {
    xMm: yAxisPoint.xMm - originPoint.xMm,
    yMm: yAxisPoint.yMm - originPoint.yMm,
  };
  const det = xBasis.xMm * yBasis.yMm - yBasis.xMm * xBasis.yMm;
  if (Math.abs(det) < 1e-6) {
    throw new Error(`Unable to solve plan coordinate transform; determinant ${det}`);
  }
  return {
    samples: { originScreen, xAxisScreen, yAxisScreen, originPoint, xAxisPoint, yAxisPoint },
    point: (pt) => ({
      x:
        originScreen.x +
        320 *
          (((pt.xMm - originPoint.xMm) * yBasis.yMm - yBasis.xMm * (pt.yMm - originPoint.yMm)) /
            det),
      y:
        originScreen.y +
        320 *
          ((xBasis.xMm * (pt.yMm - originPoint.yMm) - (pt.xMm - originPoint.xMm) * xBasis.yMm) /
            det),
    }),
  };
}

function midpoint(a, b) {
  return { xMm: (a.xMm + b.xMm) / 2, yMm: (a.yMm + b.yMm) / 2 };
}

async function startFloorSketch() {
  await page.getByTestId('ribbon-tab-sketch').click();
  await page.getByTestId('ribbon-command-floor').click();
  await page.getByTestId('sketch-canvas').waitFor({ state: 'visible', timeout: 8000 });
  await page.getByTestId('sketch-status').waitFor({ state: 'visible', timeout: 8000 });
  await page.waitForTimeout(250);
}

async function cancelSketch() {
  if ((await page.getByTestId('sketch-cancel').count()) > 0) {
    await page.getByTestId('sketch-cancel').click();
    await page
      .getByTestId('sketch-canvas')
      .waitFor({ state: 'detached', timeout: 8000 })
      .catch(() => {});
    await page.waitForTimeout(250);
  }
}

async function clickSketchModelPoint(toScreen, pt, delay = 275) {
  const screen = toScreen.point(pt);
  await page.mouse.click(screen.x, screen.y);
  await page.waitForTimeout(delay);
  return screen;
}

async function setRectangleTool() {
  await page
    .getByTestId('sketch-toolbar')
    .getByRole('button', { name: /Rectangle/ })
    .click();
  await page.waitForTimeout(100);
}

async function setPickTool() {
  await page.getByTestId('sketch-tool-pick').click();
  await page.waitForTimeout(100);
}

async function sketchIssueTexts() {
  const rows = await page.locator('[data-testid^="sketch-issue-"]').allTextContents();
  return rows.map((row) => row.replace(/^\s*•\s*/, '').trim());
}

async function statusText() {
  return (await page.getByTestId('sketch-status').innerText()).replace(/\s+/g, ' ').trim();
}

async function lineCount() {
  return page.locator('[data-testid^="sketch-line-"]').count();
}

async function pickWallDiagnostics() {
  const overlay = page.getByTestId('sketch-canvas');
  const ids = ((await overlay.getAttribute('data-pick-wall-ids')) ?? '')
    .split(/\s+/)
    .filter(Boolean);
  const count = Number((await overlay.getAttribute('data-pick-wall-count')) ?? ids.length);
  return {
    count,
    proofWallIdsPresent: pickWalls.map((wall) => ({ id: wall.id, present: ids.includes(wall.id) })),
  };
}

async function pickWallAt(label, expectedWallId, base) {
  const offsets = [[0, 0]];
  for (let radius = 4; radius <= 80; radius += 4) {
    offsets.push([0, radius], [radius, 0], [0, -radius], [-radius, 0]);
  }
  const seenHoverIds = new Map();
  const before = await lineCount();
  for (const [dx, dy] of offsets) {
    const x = Math.round(base.x + dx);
    const y = Math.round(base.y + dy);
    await page.mouse.move(x, y);
    await page.waitForTimeout(35);
    const hover = page.getByTestId('sketch-pick-hover');
    if ((await hover.count()) > 0) {
      const hoveredWallId = await hover.first().getAttribute('data-wall-id');
      if (hoveredWallId) {
        seenHoverIds.set(hoveredWallId, (seenHoverIds.get(hoveredWallId) ?? 0) + 1);
      }
    }
    await page.mouse.click(x, y);
    await page.waitForTimeout(350);
    const after = await lineCount();
    if (after > before)
      return { label, picked: true, before, after, x, y, seenHoverIds: [...seenHoverIds] };
    if (after < before) {
      await page.mouse.click(x, y);
      await page.waitForTimeout(350);
    }
  }
  return {
    label,
    picked: false,
    before,
    after: await lineCount(),
    x: base.x,
    y: base.y,
    seenHoverIds: [...seenHoverIds],
  };
}

async function screenshot(name) {
  await page.screenshot({ path: path.join(outDir, name), fullPage: true });
}

await boot();
const initialNavigationCount = mainFrameNavigations.length;

// Invalid open loop: three sides, visible reasons, Finish disabled.
let toScreen = await modelToScreenFactory();
await startFloorSketch();
await clickSketchModelPoint(toScreen, { xMm: -12000, yMm: 0 });
await clickSketchModelPoint(toScreen, { xMm: -6000, yMm: 0 });
await clickSketchModelPoint(toScreen, { xMm: -6000, yMm: 5000 });
await clickSketchModelPoint(toScreen, { xMm: -12000, yMm: 5000 });
await page.waitForTimeout(500);
const invalidLoop = {
  status: await statusText(),
  finishDisabled: await page.getByTestId('sketch-finish').isDisabled(),
  issues: await sketchIssueTexts(),
};
await screenshot('01-invalid-open-loop-finish-disabled.png');
await cancelSketch();

// Duplicate/reversed edge: the same edge drawn in reverse must be rejected.
toScreen = await modelToScreenFactory();
await startFloorSketch();
await clickSketchModelPoint(toScreen, { xMm: -12000, yMm: 7000 });
await clickSketchModelPoint(toScreen, { xMm: -6000, yMm: 7000 });
await clickSketchModelPoint(toScreen, { xMm: -12000, yMm: 7000 });
await page.waitForTimeout(500);
const duplicateEdge = {
  status: await statusText(),
  finishDisabled: await page.getByTestId('sketch-finish').isDisabled(),
  issues: await sketchIssueTexts(),
};
await screenshot('02-duplicate-reversed-edge-validation.png');
await cancelSketch();

// Existing floor overlap: closed rectangle inside the seeded ground slab.
toScreen = await modelToScreenFactory();
await startFloorSketch();
await setRectangleTool();
await clickSketchModelPoint(toScreen, { xMm: 2000, yMm: 1000 });
await clickSketchModelPoint(toScreen, { xMm: 10000, yMm: 6000 });
await page.waitForTimeout(700);
const overlap = {
  status: await statusText(),
  finishDisabled: await page.getByTestId('sketch-finish').isDisabled(),
  issues: await sketchIssueTexts(),
};
await screenshot('03-existing-floor-overlap-validation.png');
await cancelSketch();

// Drawn-boundary floor: valid loop outside the seeded slab, then post-commit floor selection.
toScreen = await modelToScreenFactory();
await startFloorSketch();
await setRectangleTool();
await clickSketchModelPoint(toScreen, { xMm: -32000, yMm: 7000 });
await clickSketchModelPoint(toScreen, { xMm: -24000, yMm: 14000 });
await page.waitForTimeout(700);
const drawnReady = {
  status: await statusText(),
  finishDisabled: await page.getByTestId('sketch-finish').isDisabled(),
  issues: await sketchIssueTexts(),
};
await screenshot('04-drawn-boundary-ready-to-finish.png');
await page.getByTestId('sketch-finish').click();
await page
  .getByTestId('sketch-canvas')
  .waitFor({ state: 'detached', timeout: 10000 })
  .catch(() => {});
await page
  .getByTestId('inspector-floor-edit-boundary')
  .waitFor({ state: 'visible', timeout: 10000 });
await page.waitForTimeout(800);
const drawnPostCommit = {
  editBoundaryVisible: (await page.getByTestId('inspector-floor-edit-boundary').count()) > 0,
  selectedRailText: (await page.getByTestId('workspace-secondary-sidebar').innerText()).slice(
    0,
    700,
  ),
};
await screenshot('05-drawn-boundary-floor-selected-edit-boundary.png');

// Pick Walls: four command-created isolated walls, picked in the real sketch UI, then finished.
toScreen = await modelToScreenFactory();
await startFloorSketch();
await setPickTool();
await page.waitForTimeout(150);
const pickDiagnosticsBefore = await pickWallDiagnostics();
const pickAttempts = [];
pickAttempts.push(
  await pickWallAt(
    'south',
    pickWalls[0].id,
    toScreen.point(midpoint(pickWalls[0].start, pickWalls[0].end)),
  ),
);
pickAttempts.push(
  await pickWallAt(
    'east',
    pickWalls[1].id,
    toScreen.point(midpoint(pickWalls[1].start, pickWalls[1].end)),
  ),
);
pickAttempts.push(
  await pickWallAt(
    'north',
    pickWalls[2].id,
    toScreen.point(midpoint(pickWalls[2].start, pickWalls[2].end)),
  ),
);
pickAttempts.push(
  await pickWallAt(
    'west',
    pickWalls[3].id,
    toScreen.point(midpoint(pickWalls[3].start, pickWalls[3].end)),
  ),
);
await page.waitForTimeout(800);
const pickedReady = {
  status: await statusText(),
  finishDisabled: await page.getByTestId('sketch-finish').isDisabled(),
  issues: await sketchIssueTexts(),
  lineCount: await lineCount(),
  diagnosticsBefore: pickDiagnosticsBefore,
  pickAttempts,
};
await screenshot('06-picked-walls-ready-to-finish.png');
if (!pickedReady.finishDisabled) {
  await page.getByTestId('sketch-finish').click();
  await page
    .getByTestId('sketch-canvas')
    .waitFor({ state: 'detached', timeout: 10000 })
    .catch(() => {});
  await page
    .getByTestId('inspector-floor-edit-boundary')
    .waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForTimeout(800);
}
const pickedPostCommit = {
  editBoundaryVisible: (await page.getByTestId('inspector-floor-edit-boundary').count()) > 0,
  selectedRailText: (await page.getByTestId('workspace-secondary-sidebar').innerText()).slice(
    0,
    700,
  ),
};
await screenshot('07-picked-wall-floor-selected-edit-boundary.png');

await page.getByTestId('ribbon-tab-sketch').click();
await page.getByTestId('ribbon-command-floor').waitFor({ state: 'visible', timeout: 5000 });
const commandReachability = {
  ribbonFloorVisible: (await page.getByTestId('ribbon-command-floor').count()) > 0,
};
await page.keyboard.press(process.platform === 'darwin' ? 'Meta+K' : 'Control+K');
await page.waitForTimeout(300);
commandReachability.paletteVisible = (await page.getByTestId('cmd-palette-v3').count()) > 0;
commandReachability.paletteText = commandReachability.paletteVisible
  ? (await page.getByTestId('cmd-palette-v3').innerText()).slice(0, 500)
  : '';
await screenshot('08-cmd-k-floor-command-reachability.png');

const summary = {
  capturedAt: new Date().toISOString(),
  url: baseUrl,
  model: `target-house-3:${modelId}`,
  setup: {
    pickWallIds: pickWalls.map((wall) => wall.id),
  },
  invalidLoop,
  duplicateEdge,
  overlap,
  pickedReady,
  pickedPostCommit,
  drawnReady,
  drawnPostCommit,
  commandReachability,
  navigation: {
    mainFrameNavigations,
    mainFrameNavigationsAfterInitial: mainFrameNavigations.slice(initialNavigationCount),
    hashOrDocumentNavigationsAfterInitial: Math.max(
      0,
      mainFrameNavigations.length - initialNavigationCount,
    ),
  },
  consoleWarningsAndErrors,
  pageErrors,
  screenshots: [
    '01-invalid-open-loop-finish-disabled.png',
    '02-duplicate-reversed-edge-validation.png',
    '03-existing-floor-overlap-validation.png',
    '04-drawn-boundary-ready-to-finish.png',
    '05-drawn-boundary-floor-selected-edit-boundary.png',
    '06-picked-walls-ready-to-finish.png',
    '07-picked-wall-floor-selected-edit-boundary.png',
    '08-cmd-k-floor-command-reachability.png',
  ],
};

await fs.writeFile(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
await browser.close();
