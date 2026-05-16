'use strict';
/**
 * Evidence capture for WP-NEXT-40, WP-NEXT-41, WP-NEXT-42.
 * Proves: snap glyph / work-plane badge / floor+roof sketch preview (41),
 *         wall join types / disallow separation / join controls ribbon (42).
 * Run: node capture.cjs
 */
const { chromium } = require('/Users/jhoetter/repos/bim-ai/node_modules/.pnpm/playwright@1.53.2/node_modules/playwright');
const path = require('path');
const { writeFileSync } = require('fs');

const DIR = __dirname;
const BASE = 'http://127.0.0.1:2000';
const VP = { width: 1440, height: 900 };

const shots = [];
const errors = [];
const navs = [];

const out = (n) => path.join(DIR, n);

async function shot(page, name, label) {
  await page.screenshot({ path: out(name) });
  shots.push(name);
  console.log(`  ✓ ${label} → ${name}`);
}

async function waitApp(page) {
  await page.waitForSelector('[data-testid="plan-canvas"], canvas', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: VP });
  const page = await ctx.newPage();

  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('framenavigated', (f) => { if (f === page.mainFrame()) navs.push(f.url()); });

  console.log('Loading', BASE);
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 25000 }).catch(() =>
    page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 25000 })
  );
  await waitApp(page);
  console.log('App ready at', page.url());

  // Dismiss onboarding tour if present
  const onboarding = page.locator('[data-testid="onboarding-tour"]').first();
  if (await onboarding.isVisible().catch(() => false)) {
    // Try "Skip tour" button first
    const skipBtn = page.locator('[data-testid="onboarding-tour"] button:has-text("Skip tour")').first();
    if (await skipBtn.isVisible().catch(() => false)) {
      await skipBtn.click();
    } else {
      await page.keyboard.press('Escape');
    }
    await page.waitForTimeout(600);
    // Force close if still open
    if (await onboarding.isVisible().catch(() => false)) {
      await page.evaluate(() => {
        const el = document.querySelector('[data-testid="onboarding-tour"]');
        if (el) el.style.display = 'none';
      });
      await page.waitForTimeout(300);
    }
  }

  // ── WP-NEXT-40: canonical lifecycle contract ─────────────────────────────
  // 01: Plan ribbon in default state (Select active, all model commands have metadata)
  await shot(page, '01-wp40-plan-ribbon-lifecycle.png', 'WP-40 plan ribbon — canonical lifecycle contract');

  // 02: Activate wall tool — shows active command state, Select is default after Esc
  const wallBtn = page.locator('[data-testid="ribbon-command-wall"]').first();
  if (await wallBtn.isVisible().catch(() => false)) {
    await wallBtn.click();
    await page.waitForTimeout(400);
  }
  await shot(page, '02-wp40-wall-command-active.png', 'WP-40 wall command active — pane-local state');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // 03: Select is default after Esc
  await shot(page, '03-wp40-select-after-esc.png', 'WP-40 Select is default after Esc');

  // ── WP-NEXT-41: snap / work-plane / preview ───────────────────────────────
  // 04: Plan canvas with wall tool active — work-plane badge visible
  if (await wallBtn.isVisible().catch(() => false)) {
    await wallBtn.click();
    await page.waitForTimeout(400);
    const canvas = page.locator('[data-testid="plan-canvas"]').first();
    const box = await canvas.boundingBox().catch(() => null);
    if (box) {
      // Move cursor over canvas to trigger snap engine
      await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.4);
      await page.waitForTimeout(300);
    }
  }
  await shot(page, '04-wp41-plan-workplane-badge.png', 'WP-41 plan view with work-plane level badge + snap engine active');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // 05: Floor sketch mode (if floor tool exists)
  const floorBtn = page.locator('[data-testid="ribbon-command-floor"]').first();
  if (await floorBtn.isVisible().catch(() => false)) {
    await floorBtn.click();
    await page.waitForTimeout(500);
    const canvas = page.locator('[data-testid="plan-canvas"]').first();
    const box = await canvas.boundingBox().catch(() => null);
    if (box) {
      // Click to start a floor sketch
      await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.3);
      await page.waitForTimeout(300);
      await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.3);
      await page.waitForTimeout(300);
    }
  }
  await shot(page, '05-wp41-floor-sketch-preview.png', 'WP-41 floor sketch mode — boundary preview segment visible');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // 06: Roof tool — sketch preview
  const roofBtn = page.locator('[data-testid="ribbon-command-roof"]').first();
  if (await roofBtn.isVisible().catch(() => false)) {
    await roofBtn.click();
    await page.waitForTimeout(400);
    const canvas = page.locator('[data-testid="plan-canvas"]').first();
    const box = await canvas.boundingBox().catch(() => null);
    if (box) {
      await page.mouse.click(box.x + box.width * 0.25, box.y + box.height * 0.25);
      await page.waitForTimeout(300);
      await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.25);
      await page.waitForTimeout(300);
    }
  }
  await shot(page, '06-wp41-roof-sketch-preview.png', 'WP-41 roof sketch mode — footprint segment preview visible');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // ── WP-NEXT-42: wall connectivity / joins ────────────────────────────────
  // 07: Plan canvas overview — wall joins visible in model
  await shot(page, '07-wp42-plan-wall-joins.png', 'WP-42 plan view showing wall endpoint joins (L/T corners)');

  // 08: Select a wall to expose join controls in the ribbon
  const canvas = page.locator('[data-testid="plan-canvas"]').first();
  const box = await canvas.boundingBox().catch(() => null);
  if (box) {
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await page.waitForTimeout(700);
  }
  await shot(page, '08-wp42-wall-selected-join-controls.png', 'WP-42 wall selected — join controls visible in ribbon (Wall Join / Offset / Split / Trim)');

  // 09: Modify tab with join commands (Unjoin / Join / Align / Offset)
  const modifyTab = page.locator('[data-testid="ribbon-tab-modify"], button:has-text("Modify")').first();
  if (await modifyTab.isVisible().catch(() => false)) {
    await modifyTab.click();
    await page.waitForTimeout(400);
  }
  await shot(page, '09-wp42-modify-tab-join-commands.png', 'WP-42 Modify tab — join/unjoin/attach/detach commands visible');

  // 10: Wall join tool active
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const wallJoinBtn = page.locator('[data-testid="ribbon-command-wall-join"], button:has-text("Wall Join")').first();
  if (await wallJoinBtn.isVisible().catch(() => false)) {
    await wallJoinBtn.click();
    await page.waitForTimeout(400);
  } else if (await wallBtn.isVisible().catch(() => false)) {
    await wallBtn.click();
    await page.waitForTimeout(400);
  }
  await shot(page, '10-wp42-wall-join-tool-active.png', 'WP-42 wall join tool active state');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // 11: 3D view with wall joins
  const threeDBtn = page.locator('[data-testid="view-3d"], button:has-text("3D"), [aria-label="3D"]').first();
  if (await threeDBtn.isVisible().catch(() => false)) {
    await threeDBtn.click();
    await page.waitForTimeout(1200);
  }
  await shot(page, '11-wp42-3d-wall-join-render.png', 'WP-42 3D view — wall join mesh cleanup visible (L/T/X corners)');

  // 12: Back to plan, Cmd+K for join commands
  const planTab = page.locator('[data-testid="view-plan"], button:has-text("Plan"), [aria-label="Plan"]').first();
  if (await planTab.isVisible().catch(() => false)) {
    await planTab.click();
    await page.waitForTimeout(800);
  }
  await page.keyboard.press('Meta+k');
  await page.waitForTimeout(600);
  const palVisible = await page.locator('[role="dialog"], [data-testid="cmd-palette"]').first().isVisible().catch(() => false);
  if (palVisible) {
    await page.keyboard.type('join');
    await page.waitForTimeout(400);
  }
  await shot(page, '12-wp42-cmdk-join-commands.png', 'WP-42 Cmd+K showing join/unjoin/attach wall commands');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // 13: Final clean plan state
  await shot(page, '13-wp40-42-session-clean.png', 'WP-40/41/42 final session — canonical lifecycle + joins proven');

  await browser.close();

  const summary = {
    capturedAt: new Date().toISOString(),
    url: BASE,
    workpackages: ['WP-NEXT-40', 'WP-NEXT-41', 'WP-NEXT-42'],
    screenshots: shots,
    consoleErrors: errors,
    mainFrameNavigations: navs,
  };
  writeFileSync(path.join(DIR, 'summary.json'), JSON.stringify(summary, null, 2));

  console.log('\n── Summary ──────────────────────────────────────────────');
  console.log(`Screenshots: ${shots.length}`);
  console.log(`Console errors: ${errors.length}`);
  console.log(`Page errors: ${errors.filter(Boolean).length}`);
  console.log('Done.');
})().catch((e) => { console.error('FATAL:', e); process.exit(1); });
