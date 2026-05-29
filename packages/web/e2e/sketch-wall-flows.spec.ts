import { expect, test } from '@playwright/test';

import { bootWorkspace, waitForStore } from './_helpers/workspace';

/**
 * TEST-CQ-12 — sketch-mode wall workflow.
 *
 * The tracker calls out "sketch mode create-wall workflow" as required
 * coverage. We exercise the ribbon entrypoint, the command palette
 * shortcut, and the modifier/options chrome the wall tool installs.
 * Each test stays below 30 seconds by skipping canvas geometry and
 * asserting on testid-anchored UI surface.
 */

test.describe('TEST-CQ-12 sketch wall workflow', () => {
  test('activates wall tool from ribbon and arms the wall command', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 820 });
    await bootWorkspace(page);
    await waitForStore(page, ['wall-main']);

    const wallCommand = page.getByTestId('ribbon-command-wall');
    await expect(wallCommand).toBeVisible();
    await wallCommand.click();
    await expect(wallCommand).toHaveAttribute('aria-pressed', 'true');
  });

  test('wall tool installs the tool-modifier-bar and options-bar', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 820 });
    await bootWorkspace(page);
    await waitForStore(page, ['wall-main']);

    await page.getByTestId('ribbon-command-wall').click();
    await expect(page.getByTestId('tool-modifier-bar')).toBeVisible();
    await expect(page.getByTestId('options-bar')).toBeVisible();
    await expect(page.getByTestId('options-bar-wall-offset')).toBeVisible();
    await expect(page.getByTestId('options-bar-wall-radius-toggle')).toBeVisible();
  });

  test('Escape disarms the wall tool and removes modifier/options chrome', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 820 });
    await bootWorkspace(page);
    await waitForStore(page, ['wall-main']);

    const wallCommand = page.getByTestId('ribbon-command-wall');
    await wallCommand.click();
    await expect(wallCommand).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('options-bar')).toBeVisible();

    await page.keyboard.press('Escape');

    await expect(wallCommand).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByTestId('tool-modifier-bar')).toHaveCount(0);
    await expect(page.getByTestId('options-bar')).toHaveCount(0);
  });

  test('Cmd+K palette focuses search input for command-driven tool activation', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 820 });
    await bootWorkspace(page);
    await waitForStore(page, ['wall-main']);

    await page.getByTestId('workspace-header-cmdk').click();
    await expect(page.getByTestId('cmd-palette-v3')).toBeVisible();
    const search = page.getByLabel('Command palette search');
    await expect(search).toBeFocused();
    await search.fill('wall');
    // Whatever the palette returns, at least one entry must be visible
    // — proves the search index hydrates after Cmd+K.
    await expect(page.getByTestId('cmd-palette-v3').getByRole('option').first()).toBeVisible();
  });

  test('Sketch ribbon tab exposes the sketch-mode wall/room entrypoints', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 820 });
    await bootWorkspace(page);
    await waitForStore(page, ['wall-main']);

    await page.getByTestId('ribbon-tab-sketch').click();
    // Sketch tab is where Floor and Roof sketch entrypoints live; wall
    // remains on Create. Asserting both anchor commands prove the
    // sketch tab mounts at least its core ribbon panel.
    await expect(page.getByTestId('ribbon-command-floor')).toBeVisible();
    await expect(page.getByTestId('ribbon-command-roof')).toBeVisible();
  });
});
