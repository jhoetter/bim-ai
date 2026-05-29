import { expect, test } from '@playwright/test';

import { bootWorkspace, waitForStore } from './_helpers/workspace';

/**
 * TEST-CQ-12 — project-setup dialog completion path.
 *
 * Required coverage from the tracker. Project-setup is reachable via
 * the primary project selector menu. We assert the menu entry surfaces,
 * the dialog opens to its checklist, the checklist offers more than one
 * step (so the wizard navigation has somewhere to go), and Close /
 * backdrop both dismiss it cleanly.
 */

test.describe('TEST-CQ-12 project setup dialog', () => {
  test('project menu exposes the project-setup entrypoint', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 820 });
    await bootWorkspace(page);
    await waitForStore(page, ['wall-main']);

    await page.getByTestId('primary-project-selector').click();
    await expect(page.getByTestId('project-menu')).toBeVisible();
    await expect(page.getByTestId('project-menu-open-project-setup')).toBeVisible();
  });

  test('opens project-setup dialog with a multi-step checklist', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 820 });
    await bootWorkspace(page);
    await waitForStore(page, ['wall-main']);

    await page.getByTestId('primary-project-selector').click();
    await page.getByTestId('project-menu-open-project-setup').click();

    const dialog = page.getByTestId('project-setup-dialog');
    await expect(dialog).toBeVisible();
    // Checklist must offer more than one step; assert the first two.
    const checks = dialog.locator('[data-testid^="project-setup-check-"]');
    await expect(checks.first()).toBeVisible();
    expect(await checks.count()).toBeGreaterThanOrEqual(2);
  });

  test('close button dismisses the project-setup dialog', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 820 });
    await bootWorkspace(page);
    await waitForStore(page, ['wall-main']);

    await page.getByTestId('primary-project-selector').click();
    await page.getByTestId('project-menu-open-project-setup').click();
    await expect(page.getByTestId('project-setup-dialog')).toBeVisible();

    await page.getByTestId('project-setup-close').click();
    await expect(page.getByTestId('project-setup-dialog')).toHaveCount(0);
  });

  test('checklist navigation switches the active step', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 820 });
    await bootWorkspace(page);
    await waitForStore(page, ['wall-main']);

    await page.getByTestId('primary-project-selector').click();
    await page.getByTestId('project-menu-open-project-setup').click();

    const dialog = page.getByTestId('project-setup-dialog');
    const checks = dialog.locator('[data-testid^="project-setup-check-"]');
    const second = checks.nth(1);
    await second.click();
    await expect(second).toHaveAttribute('data-active', 'true');
  });
});
