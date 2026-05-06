import { expect, test } from '@playwright/test';

/**
 * UI redesign visual regression baselines — spec §28 last row + §11–§17.
 *
 * One screenshot per redesigned chrome surface. The /redesign route
 * mounts the composed shell (TopBar / LeftRail / Inspector / StatusBar
 * / ToolPalette + Plan / Viewport canvas) so these snapshots cover the
 * §11–§17 surfaces in one go.
 *
 * Run with `pnpm exec playwright test --update-snapshots` from
 * `packages/web/` to (re)generate baselines locally.
 */

const VIEWPORT = { width: 1440, height: 900 };

test.describe('UI redesign — chrome baselines', () => {
  test.use({ viewport: VIEWPORT });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="app-shell"]');
  });

  test('app-shell light @ 1440 × 900', async ({ page }) => {
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'light');
    });
    await expect(page).toHaveScreenshot('app-shell-light.png', {
      fullPage: false,
      maxDiffPixelRatio: 0.07,
    });
  });

  test('app-shell dark @ 1440 × 900', async ({ page }) => {
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
    });
    await expect(page).toHaveScreenshot('app-shell-dark.png', {
      fullPage: false,
      maxDiffPixelRatio: 0.07,
    });
  });

  test('top-bar mode pills', async ({ page }) => {
    const topbar = page.getByTestId('topbar');
    await expect(topbar).toBeVisible();
    await expect(topbar).toHaveScreenshot('top-bar.png', {
      maxDiffPixelRatio: 0.05,
    });
  });

  test('left-rail Project Browser', async ({ page }) => {
    const rail = page.getByTestId('app-shell-left-rail');
    await expect(rail).toBeVisible();
    await expect(rail).toHaveScreenshot('left-rail.png', {
      maxDiffPixelRatio: 0.05,
    });
  });

  test('right-rail Inspector empty state', async ({ page }) => {
    const rail = page.getByTestId('inspector');
    await expect(rail).toBeVisible();
    await expect(rail).toHaveScreenshot('right-rail-empty.png', {
      maxDiffPixelRatio: 0.05,
    });
  });

  test('status-bar clusters', async ({ page }) => {
    const bar = page.getByTestId('status-bar');
    await expect(bar).toBeVisible();
    await expect(bar).toHaveScreenshot('status-bar.png', {
      maxDiffPixelRatio: 0.05,
    });
  });

  test('tool-palette plan mode', async ({ page }) => {
    const palette = page.getByTestId('tool-palette');
    await expect(palette).toBeVisible();
    await expect(palette).toHaveScreenshot('tool-palette.png', {
      maxDiffPixelRatio: 0.05,
    });
  });
});
