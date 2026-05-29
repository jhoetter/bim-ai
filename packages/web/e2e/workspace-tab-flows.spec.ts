import { expect, test } from '@playwright/test';

import { bootWorkspace, waitForStore } from './_helpers/workspace';

/**
 * TEST-CQ-12 — general workspace coverage.
 *
 * Round-trips and shell affordances around the composition tab strip,
 * primary-rail collapse, command palette, and the workspace header
 * chrome. Each spec focuses on a narrow assertion to stay well under
 * the 30s/spec budget.
 */

test.describe('TEST-CQ-12 workspace shell flows', () => {
  test('composition bar mounts the default composition and add button', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await bootWorkspace(page);
    await waitForStore(page, ['wall-main']);

    await expect(page.getByTestId('composition-bar')).toBeVisible();
    await expect(page.getByTestId('composition-add-button')).toBeVisible();
    const tabs = page.locator('[data-testid^="composition-tab-"]');
    expect(await tabs.count()).toBeGreaterThanOrEqual(1);
    await expect(tabs.first()).toBeVisible();
  });

  test('clicking the composition add button creates a second composition tab', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await bootWorkspace(page);
    await waitForStore(page, ['wall-main']);

    const initialCount = await page.locator('[data-testid^="composition-tab-"]').count();
    await page.getByTestId('composition-add-button').click();
    await expect
      .poll(async () => page.locator('[data-testid^="composition-tab-"]').count())
      .toBe(initialCount + 1);
  });

  test('primary sidebar can be dragged to zero width and revealed again', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 820 });
    await bootWorkspace(page);
    await waitForStore(page, ['wall-main']);

    const handle = page.getByTestId('app-shell-primary-resize-handle');
    const box = await handle.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + 12);
    await page.mouse.down();
    await page.mouse.move(0, box!.y + 12);
    await page.mouse.up();

    await expect(page.getByTestId('app-shell')).toHaveAttribute('data-primary-hidden', 'true');
    await expect(page.getByTestId('app-shell-primary-reveal')).toBeVisible();
    await page.getByTestId('app-shell-primary-reveal').click();
    await expect(page.getByTestId('app-shell')).toHaveAttribute('data-primary-hidden', 'false');
  });

  test('Ctrl+K opens the command palette with focused search input', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 820 });
    await bootWorkspace(page);
    await waitForStore(page, ['wall-main']);

    await page.keyboard.press('Control+K');
    await expect(page.getByRole('dialog', { name: 'Command palette' })).toBeVisible();
    await expect(page.getByLabel('Command palette search')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('cmd-palette-v3')).toHaveCount(0);
  });

  test('workspace header exposes share and Cmd+K controls', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 820 });
    await bootWorkspace(page);
    await waitForStore(page, ['wall-main']);

    await expect(page.getByTestId('workspace-header')).toBeVisible();
    await expect(page.getByTestId('workspace-header-share')).toBeVisible();
    await expect(page.getByTestId('workspace-header-cmdk')).toBeVisible();
    await expect(page.getByTestId('workspace-header-participants')).toBeVisible();
  });

  test('status bar surfaces advisor and activity entries', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 820 });
    await bootWorkspace(page);
    await waitForStore(page, ['wall-main']);

    await expect(page.getByTestId('status-bar')).toBeVisible();
    await expect(page.getByTestId('status-bar-advisor-entry')).toBeVisible();
    await expect(page.getByTestId('status-bar-activity-entry')).toBeVisible();
  });

  test('left rail surfaces a row for every seeded view target', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 820 });
    await bootWorkspace(page);
    await waitForStore(page, ['pv-ground', 'vp-main', 'sec-south', 'sheet-a101', 'sched-doors']);

    for (const id of ['pv-ground', 'vp-main', 'sec-south', 'sheet-a101', 'sched-doors']) {
      await expect(page.getByTestId(`left-rail-row-${id}`)).toBeVisible();
    }
  });
});
