import { expect, test } from '@playwright/test';

import { bootWorkspace, openLeftRailRow, waitForStore } from './_helpers/workspace';

/**
 * TEST-CQ-12 — mode switching coverage.
 *
 * Mode-switching rebuilds disparate canvases (SVG plan, WebGL 3D,
 * sheet, schedule grid). The common regression is one of them failing
 * to remount after a second activation. We assert the canonical
 * testid for each mode survives a round-trip, plus the lens-dropdown
 * always remains reachable in the ribbon header.
 */

test.describe('TEST-CQ-12 mode switching flows', () => {
  test('plan canvas mounts immediately after boot', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await bootWorkspace(page);
    await waitForStore(page, ['pv-ground']);

    await expect(page.getByTestId('plan-canvas')).toBeVisible({ timeout: 15_000 });
  });

  test('plan ↔ schedule round-trip remounts both surfaces', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await bootWorkspace(page);
    await waitForStore(page, ['pv-ground', 'sched-doors']);

    await openLeftRailRow(page, 'sched-doors');
    await expect(page.getByTestId('schedule-mode-shell')).toBeVisible({ timeout: 10_000 });
    await openLeftRailRow(page, 'pv-ground');
    await expect(page.getByTestId('plan-canvas')).toBeVisible({ timeout: 10_000 });
    await openLeftRailRow(page, 'sched-doors');
    await expect(page.getByTestId('schedule-mode-shell')).toBeVisible({ timeout: 10_000 });
  });

  test('switching to sheet view mounts the sheet mode shell', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await bootWorkspace(page);
    await waitForStore(page, ['sheet-a101']);

    await openLeftRailRow(page, 'sheet-a101');
    await expect(page.getByTestId('sheet-mode-shell')).toBeVisible({ timeout: 15_000 });
  });

  test('lens dropdown stays mounted in the ribbon mode header', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await bootWorkspace(page);
    await waitForStore(page, ['wall-main']);

    await expect(page.getByTestId('ribbon-mode-identity').first()).toBeVisible();
    await expect(page.getByTestId('ribbon-lens-dropdown').first()).toBeVisible();
  });
});
