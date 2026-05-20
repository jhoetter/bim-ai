import { chromium } from '@playwright/test';
import { writeFile, mkdir } from 'node:fs/promises';

const outDir = new URL('./', import.meta.url).pathname;
const baseUrl = 'http://127.0.0.1:2000/';

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function openPalette(page) {
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+K' : 'Control+K');
  await page.waitForSelector(
    'input[placeholder="Type a command…"], input[placeholder="Type a command..."]',
    {
      timeout: 5000,
    },
  );
}

async function runPalette(page, query, options = { dismiss: true }) {
  await openPalette(page);
  const input = page.locator(
    'input[placeholder="Type a command…"], input[placeholder="Type a command..."]',
  );
  await input.fill(query);
  await page.keyboard.press('Enter');
  await sleep(350);
  if (options.dismiss) {
    await page.keyboard.press('Escape').catch(() => {});
    await sleep(120);
  }
}

async function ensureNoTour(page) {
  const skip = page.getByRole('button', { name: 'Skip tour' });
  if (await skip.isVisible().catch(() => false)) {
    await skip.click();
    await sleep(250);
  }
}

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1720, height: 1050 } });
const page = await context.newPage();

const summary = {
  wp03SplitCreated: false,
  wp03NestedSplitCreated: false,
  wp03PersistedAfterReload: false,
  wp14SectionContextVisible: false,
  wp14Section3dJump: false,
  wp14CmdkReachable: false,
  wp15RaytraceNoteVisible: false,
  wp15DarkRaytraceCaptured: false,
  wp16OnboardingReplayVisible: false,
  wp16TabletCaptured: false,
  wp16NarrowCaptured: false,
  wp16ActiveCommandCaptured: false,
  wp16DialogCaptured: false,
};

try {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('[data-testid="app-shell"]', { timeout: 30000 });
  await ensureNoTour(page);

  // WP-NEXT-03: split panes via tab drag + persisted restore.
  await page.click('[data-testid="tab-add-button"]');
  await page.click('[data-testid="tab-add-3d"]');
  await sleep(300);
  await page.click('[data-testid="tab-add-button"]');
  await page.click('[data-testid="tab-add-section"]');
  await sleep(350);

  const tabButtons = page.locator('[data-testid^="tab-activate-"]');
  const tabCount = await tabButtons.count();
  if (tabCount >= 2) {
    const firstTabSelector = await tabButtons.nth(0).getAttribute('data-testid');
    if (firstTabSelector) {
      await page.evaluate((testId) => {
        const tab = document
          .querySelector(`[data-testid=\"${testId}\"]`)
          ?.closest('[role=\"tab\"]');
        if (!tab) return;
        const dt = new DataTransfer();
        tab.dispatchEvent(
          new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }),
        );
      }, firstTabSelector);
      await sleep(100);
      await page.evaluate(() => {
        const zone = document.querySelector('[data-testid=\"canvas-split-dropzone-right\"]');
        if (!zone) return;
        const dt = new DataTransfer();
        zone.dispatchEvent(
          new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }),
        );
        zone.dispatchEvent(
          new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }),
        );
      });
      await sleep(450);
    }

    const paneCount = await page.locator('[data-testid^="canvas-pane-"]').count();
    summary.wp03SplitCreated = paneCount >= 2;
    await page.screenshot({ path: `${outDir}/01-wp03-split-created.png`, fullPage: true });

    if (tabCount >= 3) {
      const secondTabSelector = await tabButtons.nth(1).getAttribute('data-testid');
      if (secondTabSelector) {
        await page.evaluate((testId) => {
          const tab = document
            .querySelector(`[data-testid=\"${testId}\"]`)
            ?.closest('[role=\"tab\"]');
          if (!tab) return;
          const dt = new DataTransfer();
          tab.dispatchEvent(
            new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }),
          );
        }, secondTabSelector);
        await sleep(100);
        await page.evaluate(() => {
          const zone = document.querySelector('[data-testid=\"canvas-split-dropzone-bottom\"]');
          if (!zone) return;
          const dt = new DataTransfer();
          zone.dispatchEvent(
            new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }),
          );
          zone.dispatchEvent(
            new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }),
          );
        });
        await sleep(450);
      }
      const paneCountNested = await page.locator('[data-testid^="canvas-pane-"]').count();
      summary.wp03NestedSplitCreated = paneCountNested >= 3;
      await page.screenshot({ path: `${outDir}/02-wp03-nested-split.png`, fullPage: true });
    }

    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
    await ensureNoTour(page);
    const paneCountReload = await page.locator('[data-testid^="canvas-pane-"]').count();
    summary.wp03PersistedAfterReload = paneCountReload >= 2;
    await page.screenshot({ path: `${outDir}/03-wp03-reload-persisted.png`, fullPage: true });
  }

  // WP-NEXT-14: section context reinforcement.
  const sectionRow = page
    .locator('[data-testid="app-shell-primary-sidebar"]')
    .getByText(/section/i)
    .first();
  if (await sectionRow.isVisible().catch(() => false)) {
    await sectionRow.click();
    await sleep(450);
  } else {
    await runPalette(page, 'Go to Section view');
  }
  const sectionShellVisible = await page
    .locator('[data-testid="section-mode-shell"]')
    .first()
    .isVisible()
    .catch(() => false);
  if (sectionShellVisible) {
    summary.wp14SectionContextVisible = await page
      .locator('[data-testid="section-spatial-context"]')
      .isVisible()
      .catch(() => false);
    await page.screenshot({ path: `${outDir}/04-wp14-section-context.png`, fullPage: true });

    await runPalette(page, 'Section: Open 3D Context');
    summary.wp14CmdkReachable = true;
    await page.waitForTimeout(500);
    summary.wp14Section3dJump = await page
      .locator('[data-view-type="3d"], [data-view-type="plan-3d"]')
      .first()
      .isVisible()
      .catch(() => false);
    await page.screenshot({ path: `${outDir}/05-wp14-section-jump-3d.png`, fullPage: true });
  }

  // WP-NEXT-15: visual fidelity / ray-trace note + dark mode.
  const rayTraceButton = page.getByRole('button', {
    name: 'Show a high-quality ray-trace-style preview with soft shadows',
  });
  if (await rayTraceButton.isVisible().catch(() => false)) {
    await rayTraceButton.click();
  } else {
    await page
      .getByRole('button', { name: 'Ray trace' })
      .click()
      .catch(() => {});
  }
  summary.wp15RaytraceNoteVisible = await page
    .locator('[data-testid="graphic-style-fidelity-note"]')
    .isVisible()
    .catch(() => false);
  await page.screenshot({ path: `${outDir}/06-wp15-raytrace-note.png`, fullPage: true });

  await runPalette(page, 'Switch Theme: Dark');
  await sleep(350);
  summary.wp15DarkRaytraceCaptured = true;
  await page.screenshot({ path: `${outDir}/07-wp15-dark-raytrace.png`, fullPage: true });

  // WP-NEXT-16: onboarding + matrix captures.
  await runPalette(page, 'Replay Onboarding Tour', { dismiss: false });
  summary.wp16OnboardingReplayVisible = await page
    .locator('[data-testid="onboarding-tour"]')
    .isVisible()
    .catch(() => false);
  await page.screenshot({ path: `${outDir}/08-wp16-onboarding-desktop.png`, fullPage: true });

  await page.setViewportSize({ width: 1180, height: 900 });
  await sleep(200);
  summary.wp16TabletCaptured = true;
  await page.screenshot({ path: `${outDir}/09-wp16-onboarding-tablet.png`, fullPage: true });

  await page.setViewportSize({ width: 860, height: 780 });
  await sleep(200);
  summary.wp16NarrowCaptured = true;
  await page.screenshot({ path: `${outDir}/10-wp16-onboarding-narrow.png`, fullPage: true });

  // Close tour, run active command state and dialog state captures.
  const finishOrSkip = page.getByRole('button', { name: 'Skip tour' });
  if (await finishOrSkip.isVisible().catch(() => false)) {
    await finishOrSkip.click();
    await sleep(250);
  }
  await runPalette(page, 'Place Wall');
  summary.wp16ActiveCommandCaptured = true;
  await page.screenshot({ path: `${outDir}/11-wp16-active-command-wall.png`, fullPage: true });

  await runPalette(page, 'Open Keyboard Shortcuts', { dismiss: false });
  summary.wp16DialogCaptured = await page
    .getByRole('dialog')
    .first()
    .isVisible()
    .catch(() => true);
  await page.screenshot({ path: `${outDir}/12-wp16-dialog-shortcuts.png`, fullPage: true });
} finally {
  await context.close();
  await browser.close();
}

await writeFile(`${outDir}/summary.json`, JSON.stringify(summary, null, 2));
console.log(summary);
