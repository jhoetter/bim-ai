import { expect, test } from '@playwright/test';

/**
 * UI redesign visual regression baselines — spec §28 last row + §11–§17.
 *
 * One screenshot per redesigned chrome surface. Each test currently
 * targets the existing Workspace until the redesigned components are
 * adopted; the snapshots will refresh once each WP's surface is wired
 * in. Setting the test as `test.fixme` keeps the harness wired but
 * flags it as not-yet-baselined per the spec's deferred-evidence note.
 */

const SURFACES = [
  { id: 'app-shell', label: '§8 App shell — full chrome at 1440 × 900' },
  { id: 'top-bar', label: '§11 TopBar — left + center mode pills + right' },
  { id: 'left-rail', label: '§12 Project Browser tree' },
  { id: 'right-rail', label: '§13 Inspector tabs + numeric field' },
  { id: 'status-bar', label: '§17 StatusBar clusters' },
  { id: 'tool-palette', label: '§16 Top-floating tool palette' },
  { id: 'plan-canvas', label: '§14 Plan canvas drafting' },
  { id: '3d-viewport', label: '§15 3D viewport + ViewCube' },
];

test.describe('UI redesign visual baselines (§28 last row)', () => {
  for (const surface of SURFACES) {
    // eslint-disable-next-line playwright/no-skipped-test
    test.fixme(`${surface.id} — ${surface.label}`, // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async ({ page }) => {
      // Placeholder — real assertion lands once each WP-UI-A* surface
      // is composed inside Workspace.tsx (post-Phase adoption sweep).
      await page.goto('/');
      await expect(page.locator('body')).toBeVisible();
      await expect(page).toHaveScreenshot(`${surface.id}.png`, {
        fullPage: false,
        maxDiffPixelRatio: 0.05,
      });
    });
  }
});
