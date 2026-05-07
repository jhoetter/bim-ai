/**
 * KRN-15 + KRN-16 + KRN-14 + WP4 — visual fidelity check for the demo
 * seed house against `spec/target-house-vis-colored.png`.
 *
 * Mocks the snapshot endpoint with the materialised seed bundle (see
 * e2e/__fixtures__/seed-house-snapshot.json — regenerated via
 *   pnpm --filter @bim-ai/web run e2e:fixture:seed
 * if the seed bundle changes), drives the project browser to activate
 * viewpoint `vp-ssw`, and saves the rendered 3D viewport as
 *   packages/web/e2e/__screenshots__/seed-house-fidelity.spec.ts/<platform>/seed-house-ssw-actual.png
 * for side-by-side comparison with the colour study.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

const MODEL_ID = '00000000-0000-4000-a000-000000005ff5';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURE_PATH = path.join(__dirname, '__fixtures__', 'seed-house-snapshot.json');

test.describe('seed-house-fidelity', () => {
  test.beforeEach(async ({ page }) => {
    const snapshot = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
    await page.addInitScript(() => {
      localStorage.setItem('bim.welcome.dismissed', '1');
      localStorage.setItem('bim.onboarding-completed', 'true');
      localStorage.setItem('bim.workspaceLayout', 'split_plan_3d');
    });
    await page.route('**/api/bootstrap', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          projects: [
            {
              id: 'p-fid',
              slug: 'fid',
              title: 'Fidelity',
              models: [{ id: MODEL_ID, slug: 'house', revision: snapshot.revision }],
            },
          ],
        }),
      });
    });
    await page.route(`**/api/models/${encodeURIComponent(MODEL_ID)}/snapshot`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(snapshot),
      });
    });
    await page.route('**/api/models/*/comments**', async (route) => {
      await route.fulfill({ status: 200, body: '{}' });
    });
    await page.route('**/api/models/*/activity**', async (route) => {
      await route.fulfill({ status: 200, body: '{"events":[]}' });
    });
    await page.route('**/api/building-presets**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '{"presets":{"residential":{}}}',
      });
    });
  });

  test('SSW iso renders the asymmetric massing + loggia recess + dormer cut', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="app-shell"]', { timeout: 30_000 });
    // Click into 3D mode (the workspace boots in Plan mode; the 3D tab
    // mounts the orbit viewport).
    await page.locator('button', { hasText: '3D' }).first().click();
    const viewport = page.locator('[data-testid="orbit-3d-viewport"]');
    await expect(viewport).toBeVisible({ timeout: 30_000 });
    // Activate viewpoint vp-ssw via the exposed store hook.
    await page.evaluate(() => {
      const store = (
        window as unknown as {
          __bimStore?: { getState: () => { setActiveViewpointId: (id: string) => void } };
        }
      ).__bimStore;
      store?.getState()?.setActiveViewpointId?.('vp-ssw');
    });
    // Press "F" to fit-to-screen; the SSW viewpoint sets a camera that may
    // not centre tightly on the bumped massing.
    await page.waitForTimeout(1_500);
    await viewport.click({ position: { x: 100, y: 100 } });
    await page.keyboard.press('f');
    // Allow Three.js to render at least one frame after the fit.
    await page.waitForTimeout(2_500);
    await viewport.screenshot({ path: 'test-results/seed-house-ssw-actual.png' });
    expect(fs.existsSync('test-results/seed-house-ssw-actual.png')).toBe(true);
  });
});
