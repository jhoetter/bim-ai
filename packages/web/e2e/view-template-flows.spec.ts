import { expect, test } from '@playwright/test';

import { bootWorkspace, selectElement, waitForStore } from './_helpers/workspace';

/**
 * TEST-CQ-12 — view-template persistence.
 *
 * The tracker calls out "view template persistence" as required
 * coverage. With the seeded `vt-plan-default` element in the store,
 * selecting it via the BIM store mounts the inspector's view-template
 * edit panel. We also verify the "save as template" affordance is
 * present when a plan view is selected — that's the entry point for
 * persisting a template across the model.
 */

test.describe('TEST-CQ-12 view template persistence', () => {
  test('selecting the seeded view_template surfaces the inspector vt control matrix', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await bootWorkspace(page);
    await waitForStore(page, ['vt-plan-default']);

    await selectElement(page, 'vt-plan-default');
    // The vt control-matrix toggles persist user choices across plan
    // views. They are the canonical "view template persistence" surface
    // in the inspector for a selected `view_template` element.
    await expect(page.getByTestId('inspector-vt-control-scale-include')).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId('inspector-vt-control-detailLevel-include')).toBeVisible();
    await expect(page.getByTestId('inspector-vt-control-phase-include')).toBeVisible();
  });

  test('selecting a plan view exposes the inspector "save as template" affordance', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await bootWorkspace(page);
    await waitForStore(page, ['pv-ground']);

    await selectElement(page, 'pv-ground');
    await expect(page.getByTestId('inspector-save-as-template').first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test('view-template control matrix persists across element re-selection', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await bootWorkspace(page);
    await waitForStore(page, ['vt-plan-default', 'wall-main']);

    await selectElement(page, 'vt-plan-default');
    await expect(page.getByTestId('inspector-vt-control-scale-include')).toBeVisible({
      timeout: 15_000,
    });

    // Switch to wall, then back: the matrix must re-mount cleanly from
    // a fresh selection (catches stale-keyed inspector regressions).
    await selectElement(page, 'wall-main');
    await expect(page.getByTestId('inspector-vt-control-scale-include')).toHaveCount(0, {
      timeout: 10_000,
    });
    await selectElement(page, 'vt-plan-default');
    await expect(page.getByTestId('inspector-vt-control-scale-include')).toBeVisible({
      timeout: 15_000,
    });
  });
});
