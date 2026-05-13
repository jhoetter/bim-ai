import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const outDir = path.dirname(new URL(import.meta.url).pathname);
await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1200 } });

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function closeOnboardingIfPresent() {
  const skip = page.getByRole('button', { name: 'Skip tour' });
  if ((await skip.count()) > 0) {
    await skip
      .first()
      .click({ timeout: 2000 })
      .catch(() => {});
    await sleep(150);
  }
}

async function openFirst3dView() {
  const viewpointId = await page.evaluate(() => {
    const store = window.__bimStore?.getState?.();
    if (!store) return null;
    const rows = Object.values(store.elementsById ?? {});
    const first = rows.find((el) => el && el.kind === 'viewpoint');
    return first?.id ?? null;
  });
  if (!viewpointId) throw new Error('No viewpoint found in seeded store');

  const row = page.getByTestId(`left-rail-row-${viewpointId}`);
  if ((await row.count()) === 0) {
    const group = page.getByTestId('left-rail-row-3d-views');
    if ((await group.count()) > 0) {
      await group.first().click();
      await sleep(120);
    }
  }
  if ((await page.getByTestId(`left-rail-row-${viewpointId}`).count()) > 0) {
    await page.getByTestId(`left-rail-row-${viewpointId}`).first().click();
  } else if ((await page.getByTestId('primary-create-3d-view').count()) > 0) {
    await page.getByTestId('primary-create-3d-view').first().click();
  }
  if ((await page.getByTestId(`tab-activate-3d:${viewpointId}`).count()) > 0) {
    await page.getByTestId(`tab-activate-3d:${viewpointId}`).first().click();
  }
  try {
    await page.getByTestId('orbit-3d-viewport').waitFor({ timeout: 6000 });
    return;
  } catch {
    const any3dTab = page.locator('[data-testid^=\"tab-activate-3d:\"]');
    if ((await any3dTab.count()) > 0) {
      await any3dTab.first().click();
      await sleep(120);
    }
    if ((await page.getByTestId('primary-create-3d-view').count()) > 0) {
      await page.getByTestId('primary-create-3d-view').first().click();
    }
    await page.getByTestId('orbit-3d-viewport').waitFor({ timeout: 10000 });
  }
}

async function findHostedPreviewOnWall() {
  const viewport = page.getByTestId('orbit-3d-viewport');
  const box = await viewport.boundingBox();
  if (!box) throw new Error('3D viewport has no bounding box');

  for (let gy = 1; gy <= 6; gy += 1) {
    for (let gx = 1; gx <= 8; gx += 1) {
      const x = Math.round(box.x + (gx / 9) * box.width);
      const y = Math.round(box.y + (gy / 7) * box.height);
      await page.mouse.move(x, y);
      await sleep(60);
      const state = await page.evaluate(() => {
        const root = document.querySelector('[data-testid="orbit-3d-viewport"]');
        if (!root) return { valid: false, invalid: false, hasOutline: false };
        const hasValidStroke =
          root.querySelector('polygon[stroke*="accent"]') ||
          root.querySelector('line[stroke*="accent"]');
        const hasInvalidStroke =
          root.querySelector('polygon[stroke*="danger"]') ||
          root.querySelector('line[stroke*="danger"]');
        const hasOutline = !!root.querySelector('polygon');
        return {
          valid: !!hasValidStroke,
          invalid: !!hasInvalidStroke,
          hasOutline,
        };
      });
      if (state.valid && state.hasOutline) return { found: true, x, y, invalid: state.invalid };
    }
  }
  return { found: false, x: null, y: null, invalid: false };
}

await page.goto('http://127.0.0.1:2000/', { waitUntil: 'networkidle' });
await closeOnboardingIfPresent();
await openFirst3dView();

await page.getByTestId('ribbon-tab-create').click();
await page.getByTestId('ribbon-command-window').click();
const windowPreview = await findHostedPreviewOnWall();
await page.screenshot({
  path: path.join(outDir, '01-3d-window-host-preview-before-place.png'),
  fullPage: true,
});

await page.getByTestId('ribbon-command-column').click();
const vp = await page.getByTestId('orbit-3d-viewport').boundingBox();
if (vp) {
  await page.mouse.move(Math.round(vp.x + vp.width * 0.58), Math.round(vp.y + vp.height * 0.48));
  await sleep(120);
}
const columnHoverPreviewVisible = await page.evaluate(() => {
  const root = document.querySelector('[data-testid="orbit-3d-viewport"]');
  if (!root) return false;
  return !!root.querySelector('circle[fill="var(--color-accent)"]');
});
await page.screenshot({
  path: path.join(outDir, '02-3d-column-hover-preview.png'),
  fullPage: true,
});

await page.getByTestId('ribbon-tab-create').click();
await page.getByTestId('ribbon-command-beam').click();
await page.keyboard.press('Escape');
await sleep(150);
const selectPressed = await page.getByTestId('ribbon-command-select').getAttribute('aria-pressed');
const firstTabSelected = await page.getByTestId('ribbon-tab-create').getAttribute('aria-selected');
await page.screenshot({
  path: path.join(outDir, '03-escape-returns-select-first-group.png'),
  fullPage: true,
});

const summary = {
  capturedAt: new Date().toISOString(),
  url: 'http://127.0.0.1:2000/',
  windowPreview,
  columnHoverPreviewVisible,
  selectPressed,
  firstTabSelected,
};
await fs.writeFile(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));

await browser.close();
console.log(JSON.stringify(summary, null, 2));
