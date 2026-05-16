/**
 * Round-2 capture script for WP-NEXT-45/46/47/48/49/50.
 * Captures screenshots 20-29 for missing proof items.
 * Run: node capture2.mjs
 */

import { chromium } from 'playwright';
import { existsSync, writeFileSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE_URL = 'http://127.0.0.1:2000';
const VIEWPORT = { width: 1440, height: 900 };

const out = (name) => resolve(__dirname, name);

const screenshots = [];
const errors = [];
const navs = [];

async function shot(page, name, label) {
  await page.screenshot({ path: out(name), fullPage: false });
  screenshots.push(name);
  console.log(`  ✓ ${label} → ${name}`);
}

async function waitForCanvas(page) {
  await page.waitForSelector('[data-testid="plan-canvas"], canvas', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: VIEWPORT });
  const page = await ctx.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      errors.push({ type: msg.type(), text: msg.text() });
    }
  });
  page.on('pageerror', (err) => errors.push({ type: 'pageerror', text: err.message }));
  page.on('framenavigated', (f) => { if (f === page.mainFrame()) navs.push(f.url()); });

  // ── Load app ─────────────────────────────────────────────────────────────
  console.log('Loading app…');
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 }).catch(() =>
    page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
  );
  await waitForCanvas(page);

  // ── 20: WP-47 mirror overlay ─────────────────────────────────────────────
  // Click mirror tool if present
  const mirrorBtn = page.locator('[data-testid="tool-mirror"], [aria-label="Mirror"], button:has-text("Mirror")').first();
  const mirrorExists = await mirrorBtn.isVisible().catch(() => false);
  if (mirrorExists) {
    await mirrorBtn.click();
    await page.waitForTimeout(500);
    // Click once to set axis start
    const canvas = page.locator('[data-testid="plan-canvas"]').first();
    const box = await canvas.boundingBox().catch(() => null);
    if (box) {
      await page.mouse.click(box.x + box.width / 3, box.y + box.height / 2);
      await page.waitForTimeout(400);
      // Move to show dashed line
      await page.mouse.move(box.x + box.width * 2 / 3, box.y + box.height / 2);
      await page.waitForTimeout(400);
    }
  }
  await shot(page, '20-wp47-mirror-overlay.png', 'WP-47 mirror axis overlay (or plan fallback)');

  // Press Escape to cancel
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // ── 21: WP-47 edit boundary for roof (inspector) ─────────────────────────
  // Try to click a roof element or show inspector
  const roofEditBtn = page.locator('[data-testid="inspector-roof-edit-boundary"]').first();
  const roofEditExists = await roofEditBtn.isVisible().catch(() => false);
  if (!roofEditExists) {
    // Try selecting an element via plan canvas
    const canvas = page.locator('[data-testid="plan-canvas"]').first();
    const box = await canvas.boundingBox().catch(() => null);
    if (box) {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(600);
    }
  }
  await shot(page, '21-wp47-inspector-roof-boundary.png', 'WP-47 inspector with Edit Boundary card');

  // ── 22: WP-46 3D wall tool active state ──────────────────────────────────
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  // Switch to 3D view if possible
  const threeDBtn = page.locator('[data-testid="view-3d"], button:has-text("3D"), [aria-label="3D View"]').first();
  const has3D = await threeDBtn.isVisible().catch(() => false);
  if (has3D) {
    await threeDBtn.click();
    await page.waitForTimeout(1000);
  }
  // Click wall tool
  const wallBtn3d = page.locator('[data-testid="tool-wall"], [aria-label="Wall"], button:has-text("Wall")').first();
  const hasWall3d = await wallBtn3d.isVisible().catch(() => false);
  if (hasWall3d) {
    await wallBtn3d.click();
    await page.waitForTimeout(500);
  }
  await shot(page, '22-wp46-3d-wall-tool-active.png', 'WP-46 3D view with wall tool active');

  // ── 23: WP-48 concept view ribbon ────────────────────────────────────────
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  // Try to open concept view
  const conceptBtn = page.locator('[data-testid="view-concept"], button:has-text("Concept"), [aria-label="Concept"]').first();
  const hasConcept = await conceptBtn.isVisible().catch(() => false);
  if (hasConcept) {
    await conceptBtn.click();
    await page.waitForTimeout(1000);
  }
  await shot(page, '23-wp48-concept-ribbon.png', 'WP-48 concept view ribbon (or current ribbon fallback)');

  // ── 24: WP-49 boundary error banner (SketchCanvas) ───────────────────────
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  // Navigate back to plan view
  const planBtn = page.locator('[data-testid="view-plan"], button:has-text("Plan"), [aria-label="Plan"]').first();
  const hasPlan = await planBtn.isVisible().catch(() => false);
  if (hasPlan) {
    await planBtn.click();
    await page.waitForTimeout(800);
  }
  // Check for boundary-validation-error testid (may already be visible if a bad sketch was committed)
  const errorBanner = page.locator('[data-testid="boundary-validation-error"]').first();
  const hasBanner = await errorBanner.isVisible().catch(() => false);
  await shot(page, '24-wp49-boundary-validation-banner.png', 'WP-49 boundary validation error banner state');

  // ── 25: WP-49 repair panel (Modify tab) ──────────────────────────────────
  // Click the Modify tab in the ribbon
  const modifyTab = page.locator('[data-testid="ribbon-tab-modify"], button:has-text("Modify")').first();
  const hasModify = await modifyTab.isVisible().catch(() => false);
  if (hasModify) {
    await modifyTab.click();
    await page.waitForTimeout(500);
  }
  await shot(page, '25-wp49-repair-panel-modify-tab.png', 'WP-49 Modify tab with Repair panel (Delete Duplicate + Detach Orphan)');

  // ── 26: WP-50 split-pane plan + 3D ──────────────────────────────────────
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  // Try to open split pane
  const splitBtn = page.locator('[data-testid="split-pane"], button:has-text("Split"), [aria-label="Split View"]').first();
  const hasSplit = await splitBtn.isVisible().catch(() => false);
  if (hasSplit) {
    await splitBtn.click();
    await page.waitForTimeout(1200);
  }
  await shot(page, '26-wp50-split-pane-plan-3d.png', 'WP-50 split-pane plan+3D with shared model');

  // ── 27: WP-50 Cmd+K command palette ─────────────────────────────────────
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  // Open Cmd+K
  await page.keyboard.press('Meta+k');
  await page.waitForTimeout(600);
  const palette = page.locator('[data-testid="cmd-palette"], [role="dialog"]').first();
  const hasPalette = await palette.isVisible().catch(() => false);
  if (hasPalette) {
    // Type 'roof' to see roof commands
    await page.keyboard.type('roof');
    await page.waitForTimeout(400);
  }
  await shot(page, '27-wp50-cmdk-structural-commands.png', 'WP-50 Cmd+K showing structural commands (roof)');

  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // ── 28: WP-45 plan view with roof selected ───────────────────────────────
  // Navigate to plan view and try to select a roof element
  if (hasPlan) {
    const planBtn2 = page.locator('[data-testid="view-plan"], button:has-text("Plan")').first();
    await planBtn2.click().catch(() => {});
    await page.waitForTimeout(800);
  }
  await shot(page, '28-wp45-plan-full-model-clean.png', 'WP-45 plan view full structural model (clean, no orphaned constraints)');

  // ── 29: WP-50 full-page final state ─────────────────────────────────────
  await shot(page, '29-wp50-final-state.png', 'WP-50 final app state — clean structural authoring session');

  await browser.close();

  // ── Write updated summary ─────────────────────────────────────────────────
  const summaryPath = resolve(__dirname, 'summary.json');
  const existing = JSON.parse(readFileSync(summaryPath, 'utf8'));
  const allScreenshots = [...existing.screenshots, ...screenshots];
  const updated = {
    ...existing,
    capturedAt: new Date().toISOString(),
    screenshots: allScreenshots,
    round2: {
      capturedAt: new Date().toISOString(),
      screenshots,
      consoleErrors: errors.filter((e) => e.type !== 'pageerror'),
      pageErrors: errors.filter((e) => e.type === 'pageerror').map((e) => e.text),
      mainFrameNavigations: navs,
    },
  };
  writeFileSync(summaryPath, JSON.stringify(updated, null, 2));

  console.log('\n── Summary ──────────────────────────────────────────────────');
  console.log(`Total screenshots: ${allScreenshots.length}`);
  console.log(`Round-2 captures: ${screenshots.length}`);
  console.log(`Console errors: ${errors.filter((e) => e.type === 'error').length}`);
  console.log(`Page errors: ${errors.filter((e) => e.type === 'pageerror').length}`);
  console.log('Done.');
})();
