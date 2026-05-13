import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';

const outDir = new URL('./', import.meta.url);
const summary = {};

const browser = await chromium.launch({ headless: true });

try {
  // Phase A: default seeded app, verify tab clicks + create actions open tabs.
  const page = await browser.newPage({ viewport: { width: 1720, height: 1080 } });
  await page.addInitScript(() => {
    window.localStorage.setItem('bim.onboarding-completed', 'true');
    window.localStorage.removeItem('bim-ai:pane-layout-v1');
  });

  await page.goto('http://127.0.0.1:2000/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="workspace-header"]', { timeout: 30000 });
  await page.waitForSelector('[data-tab-id]', { timeout: 30000 });

  const tabIds = await page.locator('[data-tab-id]').evaluateAll((els) =>
    els.map((el) => el.getAttribute('data-tab-id')).filter(Boolean),
  );
  const modeByTabId = [];
  for (const tabId of tabIds) {
    await page.locator(`[data-testid="tab-activate-${tabId}"]`).click();
    await page.waitForTimeout(120);
    const modeVisible =
      (await page.locator('[data-testid="secondary-sidebar-plan"]').count()) > 0 ||
      (await page.locator('[data-testid="secondary-sidebar-3d"]').count()) > 0 ||
      (await page.locator('[data-testid="secondary-sidebar-sheet"]').count()) > 0 ||
      (await page.locator('[data-testid="secondary-sidebar-section"]').count()) > 0 ||
      (await page.locator('[data-testid="secondary-sidebar-schedule"]').count()) > 0 ||
      (await page.locator('[data-testid="secondary-sidebar-concept"]').count()) > 0;
    modeByTabId.push({ tabId, modeVisible });
  }
  summary.tabModeSwitchChecks = modeByTabId;
  summary.allTabClicksLoadMode = modeByTabId.every((row) => row.modeVisible);
  await page.screenshot({ path: new URL('01-tab-click-mode-switch.png', outDir).pathname, fullPage: true });

  const tabCountBefore = await page.locator('[data-tab-id]').count();
  await page.locator('[data-testid="primary-create-floor-plan"]').click();
  await page.waitForTimeout(700);
  const tabCountAfterFloor = await page.locator('[data-tab-id]').count();

  await page.locator('[data-testid="primary-create-sheet"]').click();
  await page.waitForTimeout(700);
  const tabCountAfterSheet = await page.locator('[data-tab-id]').count();

  summary.newViewCreatesTabs = tabCountAfterFloor > tabCountBefore && tabCountAfterSheet > tabCountAfterFloor;
  summary.tabCountBefore = tabCountBefore;
  summary.tabCountAfterFloor = tabCountAfterFloor;
  summary.tabCountAfterSheet = tabCountAfterSheet;
  await page.screenshot({ path: new URL('02-create-views-new-tabs.png', outDir).pathname, fullPage: true });

  await page.close();

  // Phase B: deterministic split layout with two tabs; verify pane-local tab strip + close.
  const splitPage = await browser.newPage({ viewport: { width: 1720, height: 1080 } });
  await splitPage.addInitScript(() => {
    window.localStorage.setItem('bim.onboarding-completed', 'true');
    window.localStorage.setItem(
      'bim-ai:tabs-v1',
      JSON.stringify({
        v: 1,
        tabs: [
          { id: 'plan:demo-pane-a', kind: 'plan', label: 'Demo plan A', targetId: 'hf-pv-ground' },
          { id: 'sheet:demo-pane-b', kind: 'sheet', label: 'Demo sheet B', targetId: 'hf-sheet-ga01' },
        ],
        activeId: 'sheet:demo-pane-b',
      }),
    );
    window.localStorage.setItem(
      'bim-ai:pane-layout-v1',
      JSON.stringify({
        v: 1,
        layout: {
          focusedLeafId: 'pane-right',
          root: {
            kind: 'split',
            id: 'pane-root',
            axis: 'horizontal',
            first: { kind: 'leaf', id: 'pane-left', tabId: 'plan:demo-pane-a' },
            second: { kind: 'leaf', id: 'pane-right', tabId: 'sheet:demo-pane-b' },
          },
        },
      }),
    );
  });

  await splitPage.goto('http://127.0.0.1:2000/', { waitUntil: 'domcontentloaded' });
  await splitPage.waitForSelector('[data-testid="canvas-pane-tabstrip-pane-left"]', {
    timeout: 30000,
  });
  await splitPage.waitForSelector('[data-testid="canvas-pane-tabstrip-pane-right"]', {
    timeout: 30000,
  });

  const paneTabStripCount = await splitPage.locator('[data-testid^="canvas-pane-tabstrip-"]').count();
  const paneCloseCount = await splitPage.locator('[data-testid^="canvas-pane-close-tab-"]').count();
  summary.paneTabStripCount = paneTabStripCount;
  summary.paneLocalTabChromeVisible = paneTabStripCount >= 2 && paneCloseCount >= 2;

  const tabsBeforePaneClose = await splitPage.locator('[data-tab-id]').count();
  await splitPage.locator('[data-testid^="canvas-pane-close-tab-"]').first().click();
  await splitPage.waitForTimeout(250);
  const tabsAfterPaneClose = await splitPage.locator('[data-tab-id]').count();
  summary.paneCloseRemovesTab = tabsAfterPaneClose < tabsBeforePaneClose;

  await splitPage.screenshot({
    path: new URL('03-pane-local-tabstrip-and-close.png', outDir).pathname,
    fullPage: true,
  });

  await splitPage.close();

  await fs.writeFile(new URL('summary.json', outDir), JSON.stringify(summary, null, 2));
} finally {
  await browser.close();
}
