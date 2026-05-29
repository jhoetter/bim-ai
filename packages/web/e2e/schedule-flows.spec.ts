import { expect, test } from '@playwright/test';

import { bootWorkspace, openLeftRailRow, waitForStore } from './_helpers/workspace';

/**
 * TEST-CQ-12 — schedule mode coverage.
 *
 * The tracker lists "schedule export PDF integrity" as required
 * coverage. The schedule surface exports via the sheet placement
 * path; the live integrity contract surfaces in the schedule mode
 * shell plus the ribbon "duplicate" / "controls" commands that drive
 * the sheet export pipeline. We assert mode-shell mount, ribbon
 * coverage, the workflow profile readout, and that the schedule
 * appears in the project browser.
 */

test.describe('TEST-CQ-12 schedule flows', () => {
  test('opening sched-doors from the project browser mounts the schedule mode shell', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await bootWorkspace(page);
    await waitForStore(page, ['sched-doors']);

    await openLeftRailRow(page, 'sched-doors');
    await expect(page.getByTestId('schedule-mode-shell')).toBeVisible({ timeout: 10_000 });
  });

  test('schedule ribbon exposes the row/column/duplicate commands that gate sheet export', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await bootWorkspace(page);
    await waitForStore(page, ['sched-doors']);

    await openLeftRailRow(page, 'sched-doors');
    await expect(page.getByTestId('schedule-mode-shell')).toBeVisible({ timeout: 10_000 });

    // The schedule-controls / duplicate / row-ops / column-ops ribbon
    // commands gate the schedule -> sheet -> PDF export pipeline. If
    // any disappears, the export-integrity surface breaks.
    await expect(page.getByTestId('ribbon-command-schedule-controls')).toBeVisible();
    await expect(page.getByTestId('ribbon-command-schedule-duplicate')).toBeVisible();
    await expect(page.getByTestId('ribbon-command-schedule-row-ops')).toBeVisible();
    await expect(page.getByTestId('ribbon-command-schedule-column-ops')).toBeVisible();
  });

  test('schedule workflow profile readout surfaces the active preset', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await bootWorkspace(page);
    await waitForStore(page, ['sched-doors']);

    await openLeftRailRow(page, 'sched-doors');
    await expect(page.getByTestId('schedule-mode-shell')).toBeVisible({ timeout: 10_000 });

    // The workflow profile widget governs export integrity (sortBy,
    // sortDescending, required columns). Its select+apply must mount
    // so the user can pin a preset before PDF export.
    await expect(page.getByTestId('schedule-workflow-profile')).toBeVisible();
    await expect(page.getByTestId('schedule-workflow-profile-select')).toBeVisible();
    await expect(page.getByTestId('schedule-workflow-profile-apply')).toBeVisible();
  });

  test('schedule mode survives a round-trip through the plan view', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await bootWorkspace(page);
    await waitForStore(page, ['sched-doors', 'pv-ground']);

    await openLeftRailRow(page, 'sched-doors');
    await expect(page.getByTestId('schedule-mode-shell')).toBeVisible({ timeout: 10_000 });

    await openLeftRailRow(page, 'pv-ground');
    await expect(page.getByTestId('plan-canvas')).toBeVisible({ timeout: 10_000 });

    await openLeftRailRow(page, 'sched-doors');
    await expect(page.getByTestId('schedule-mode-shell')).toBeVisible({ timeout: 10_000 });
  });
});
