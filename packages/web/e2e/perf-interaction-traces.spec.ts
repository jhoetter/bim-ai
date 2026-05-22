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

    // place-window / draw-wall require a known model + tool state to
    // exercise; capture them via best-effort hover-equivalent for now,
    // and the spec serialises whatever it got so the regression file
    // exists even on a thin fixture.
    await timeScenario(
      'place-window-hover-only',
      async () => {
        await page.mouse.move(600 + Math.random() * 50, 600 + Math.random() * 50);
      },
      40,
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
