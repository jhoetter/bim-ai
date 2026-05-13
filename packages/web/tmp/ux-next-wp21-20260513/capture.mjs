import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const outDir = path.resolve('tmp/ux-next-wp21-20260513');
await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 2048, height: 1365 } });

const baseUrl = 'http://127.0.0.1:2000/';

async function seedTabsAndPanes() {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.setItem('bim.onboarding-completed', 'true');
    localStorage.setItem(
      'bim-ai:tabs-v1',
      JSON.stringify({
        v: 1,
        tabs: [
          {
            id: 'plan:hf-lvl-ground',
            kind: 'plan',
            label: 'Ground Floor — Plan',
            targetId: 'hf-lvl-ground',
          },
          {
            id: '3d:vp-main-iso',
            kind: '3d',
            label: 'Main front-left axonometric',
            targetId: 'vp-main-iso',
          },
          { id: 'sheet:ga01', kind: 'sheet', label: 'GA-01 General arrangement', targetId: 'ga01' },
        ],
        activeId: '3d:vp-main-iso',
      }),
    );
    localStorage.setItem(
      'bim-ai:pane-layout-v1',
      JSON.stringify({
        v: 1,
        layout: {
          focusedLeafId: 'pane-right',
          root: {
            kind: 'split',
            id: 'pane-root',
            axis: 'horizontal',
            first: { kind: 'leaf', id: 'pane-left', tabId: '3d:vp-main-iso' },
            second: { kind: 'leaf', id: 'pane-right', tabId: 'plan:hf-lvl-ground' },
          },
        },
      }),
    );
  });
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
}

async function captureTabStates() {
  await seedTabsAndPanes();
  const tabBar = page.getByTestId('view-tabs');
  await tabBar.scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(outDir, '01-tab-clarity-states.png'), fullPage: true });

  const summary = {
    activeBadgeVisible: await page.getByTestId('tab-badge-active-3d:vp-main-iso').isVisible(),
    focusedBadgeVisible: await page.getByTestId('tab-badge-focused-plan:hf-lvl-ground').isVisible(),
    shownBadgeVisible: await page.getByTestId('tab-badge-shown-plan:hf-lvl-ground').isVisible(),
  };
  return summary;
}

async function captureEmptyPaneState() {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.setItem('bim.onboarding-completed', 'true');
    localStorage.setItem(
      'bim-ai:tabs-v1',
      JSON.stringify({
        v: 1,
        tabs: [
          {
            id: 'plan:hf-lvl-ground',
            kind: 'plan',
            label: 'Ground Floor — Plan',
            targetId: 'hf-lvl-ground',
          },
        ],
        activeId: 'plan:hf-lvl-ground',
      }),
    );
    localStorage.setItem(
      'bim-ai:pane-layout-v1',
      JSON.stringify({
        v: 1,
        layout: {
          focusedLeafId: 'pane-main',
          root: { kind: 'leaf', id: 'pane-main', tabId: 'plan:hf-lvl-ground' },
        },
      }),
    );
  });
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('tab-close-plan:hf-lvl-ground').click();
  await page.waitForTimeout(80);
  await page.screenshot({
    path: path.join(outDir, '02-no-tabs-real-empty-state.png'),
    fullPage: true,
  });

  return {
    emptyPaneMessagePresent: (await page.getByText('No view open in this pane').count()) > 0,
    paneEmptyStateCount: await page.locator('[data-testid^="canvas-pane-empty-"]').count(),
  };
}

const tabState = await captureTabStates();
const emptyState = await captureEmptyPaneState();

await fs.writeFile(
  path.join(outDir, 'summary.json'),
  JSON.stringify(
    {
      ...tabState,
      ...emptyState,
    },
    null,
    2,
  ),
);

await browser.close();
