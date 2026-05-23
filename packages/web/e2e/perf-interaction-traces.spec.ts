/**
 * PERF-M03: browser-side interaction perf traces.
 *
 * Captures rough wall-clock samples for the canonical interaction
 * scenarios called out in the tracker (orbit, pan, place window/door,
 * draw wall, plan hover). The samples are written to
 * spec/generated/perf-interaction-traces.json so they can be diffed
 * commit-over-commit.
 *
 * The spec is opt-in to keep CI fast — run with PLAYWRIGHT_PERF=1.
 * Without that flag, the spec is skipped so the default CI lane stays
 * unaffected.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const OUT_PATH = path.join(REPO_ROOT, 'spec', 'generated', 'perf-interaction-traces.json');
const ENABLED = process.env.PLAYWRIGHT_PERF === '1';

test.describe('PERF-M03: interaction perf traces', () => {
  test.skip(!ENABLED, 'set PLAYWRIGHT_PERF=1 to enable');

  test('collects pan, plan-hover, place-window samples', async ({ page }) => {
    const samples: Array<{ scenario: string; durationMs: number; samples: number }> = [];

    await page.goto('/');
    await page.locator('canvas').first().waitFor({ state: 'visible', timeout: 30_000 });

    async function timeScenario(
      scenario: string,
      action: () => Promise<void>,
      iterations: number,
    ): Promise<void> {
      const start = Date.now();
      for (let i = 0; i < iterations; i++) await action();
      const elapsed = Date.now() - start;
      samples.push({ scenario, durationMs: elapsed, samples: iterations });
    }

    await timeScenario(
      'plan-hover',
      async () => {
        await page.mouse.move(400 + Math.random() * 200, 400 + Math.random() * 200);
      },
      120,
    );

    await timeScenario(
      'pan',
      async () => {
        await page.mouse.move(500, 500);
        await page.mouse.down({ button: 'middle' });
        await page.mouse.move(560, 540);
        await page.mouse.up({ button: 'middle' });
      },
      20,
    );

    // place-window / draw-wall / orbit / place-door require a known model +
    // tool state to fully exercise the placement path; capture them via
    // best-effort pointer sequences here so the regression file has a row
    // per scenario even on a thin fixture. Once a model-loader fixture
    // exists, the inner actions can be swapped for real tool activation.
    await timeScenario(
      'place-window-hover-only',
      async () => {
        await page.mouse.move(600 + Math.random() * 50, 600 + Math.random() * 50);
      },
      40,
    );

    // place-door — same shape as place-window-hover-only but distinct
    // coordinate band so any future ghost-render diff is comparable.
    await timeScenario(
      'place-door-hover-only',
      async () => {
        await page.mouse.move(450 + Math.random() * 50, 500 + Math.random() * 50);
      },
      40,
    );

    // orbit — right-button drag in the 3D viewport produces an orbit
    // rotation event sequence. The viewport scheduler exits idle while
    // dragging so this exercises the demand-driven render loop too
    // (PERF-I02). Coordinates centre the drag in the canvas viewport.
    await timeScenario(
      'orbit',
      async () => {
        await page.mouse.move(700, 400);
        await page.mouse.down({ button: 'right' });
        await page.mouse.move(720 + Math.random() * 40, 420 + Math.random() * 40);
        await page.mouse.up({ button: 'right' });
      },
      20,
    );

    // draw-wall — without a model loader fixture, we approximate the
    // wall tool's pointermove path by exercising the snap-hover path
    // (which is the dominant per-frame cost) plus a click-drag-release
    // sequence so the snap engine + draft state get touched.
    await timeScenario(
      'draw-wall',
      async () => {
        const x = 500 + Math.random() * 50;
        const y = 500 + Math.random() * 50;
        await page.mouse.move(x, y);
        await page.mouse.down({ button: 'left' });
        await page.mouse.move(x + 100, y + 100);
        await page.mouse.up({ button: 'left' });
      },
      20,
    );

    await fs.mkdir(path.dirname(OUT_PATH), { recursive: true });
    await fs.writeFile(
      OUT_PATH,
      JSON.stringify(
        {
          schemaVersion: 'perf-interaction-traces.v1',
          capturedAt: new Date().toISOString(),
          samples,
        },
        null,
        2,
      ) + '\n',
      'utf8',
    );

    // Sanity-only: each scenario should produce some duration > 0.
    for (const sample of samples) {
      expect(sample.durationMs).toBeGreaterThan(0);
    }
  });
});
