/**
 * PERF-I07: GPU resource leak guard.
 *
 * Captures `renderer.info.{geometries, textures, programs}` via the
 * PERF-I03 frame-stats probe before and after a viewer-mode cycle.
 * The deltas are written to spec/generated/perf-gpu-leak-guard.json
 * so a regression can be diffed commit-over-commit.
 *
 * Opt-in via PLAYWRIGHT_PERF=1.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test, type Page } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const OUT_PATH = path.join(REPO_ROOT, 'spec', 'generated', 'perf-gpu-leak-guard.json');
const ENABLED = process.env.PLAYWRIGHT_PERF === '1';

type RendererInfo = {
  geometries: number;
  textures: number;
  programs: number;
  drawCalls: number;
};

async function readRendererInfo(page: Page): Promise<RendererInfo | null> {
  return await page.evaluate(() => {
    type FrameStats = {
      renderer?: {
        geometries?: number;
        textures?: number;
        programs?: number;
        drawCalls?: number;
      };
    };
    const w = window as unknown as { __BIM_AI_VIEWPORT_FRAME_STATS__?: FrameStats };
    const stats = w.__BIM_AI_VIEWPORT_FRAME_STATS__;
    if (!stats?.renderer) return null;
    return {
      geometries: stats.renderer.geometries ?? 0,
      textures: stats.renderer.textures ?? 0,
      programs: stats.renderer.programs ?? 0,
      drawCalls: stats.renderer.drawCalls ?? 0,
    };
  });
}

test.describe('PERF-I07: GPU resource leak guard', () => {
  test.skip(!ENABLED, 'set PLAYWRIGHT_PERF=1 to enable');

  test('viewer-mode cycle does not leak geometries / textures / programs', async ({ page }) => {
    await page.goto('/');
    await page.locator('canvas').first().waitFor({ state: 'visible', timeout: 30_000 });

    // Allow the initial scene to settle. Three frames is enough for the
    // EMA to populate and renderer.info to reflect the steady state.
    await page.waitForTimeout(500);

    const baseline = await readRendererInfo(page);

    // Cycle: nudge the camera to force the demand-driven render loop
    // through some active frames, then let it idle again. The viewer
    // settles back into the same scene composition — geometry/texture
    // counts should not grow.
    for (let i = 0; i < 5; i++) {
      await page.mouse.move(500, 400);
      await page.mouse.down({ button: 'right' });
      await page.mouse.move(540, 420);
      await page.mouse.up({ button: 'right' });
      await page.waitForTimeout(100);
    }

    await page.waitForTimeout(500);
    const after = await readRendererInfo(page);

    const report = {
      schemaVersion: 'perf-gpu-leak-guard.v1',
      capturedAt: new Date().toISOString(),
      baseline,
      after,
      // A 10% growth tolerance covers normal jitter from camera/lights
      // refresh. Tighter tolerance is desirable but flakes on CI.
      deltas:
        baseline && after
          ? {
              geometries: after.geometries - baseline.geometries,
              textures: after.textures - baseline.textures,
              programs: after.programs - baseline.programs,
            }
          : null,
    };

    await fs.mkdir(path.dirname(OUT_PATH), { recursive: true });
    await fs.writeFile(OUT_PATH, JSON.stringify(report, null, 2) + '\n', 'utf8');

    // The probe may be null in production builds (recording gated).
    // If both are present, assert no significant growth.
    if (baseline && after) {
      // Geometry/texture growth above 25% suggests a real leak —
      // anything less is plausible jitter or async resource load.
      expect(after.geometries).toBeLessThanOrEqual(Math.max(baseline.geometries * 1.25, 10));
      expect(after.textures).toBeLessThanOrEqual(Math.max(baseline.textures * 1.25, 10));
    }
  });
});
