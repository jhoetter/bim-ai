import { expect, test } from '@playwright/test';

import { bootWorkspace, waitForStore } from './_helpers/workspace';

/**
 * TEST-CQ-12 — advisor / drift surface coverage.
 *
 * The advisor footer entry and grouped dialog gate the
 * "advisory issue surfaces in the inspector" loop. We seed two
 * synthetic violations against the canonical wall/sheet pair, open the
 * dialog from the status-bar entry, and assert the grouping toggle
 * works and Close dismisses the dialog cleanly.
 */

const SEEDED_VIOLATIONS = [
  {
    ruleId: 'physical_hard_clash',
    severity: 'error',
    message: 'TEST-CQ-12 advisor seed: hard clash regression.',
    elementIds: ['wall-main'],
    blocking: true,
    discipline: 'architecture',
  },
  {
    ruleId: 'schedule_sheet_viewport_missing',
    severity: 'warning',
    message: 'TEST-CQ-12 advisor seed: schedule sheet viewport missing.',
    elementIds: ['sheet-a101'],
    discipline: 'architecture',
  },
];

test.describe('TEST-CQ-12 advisor flows', () => {
  test('advisor entry tooltip surfaces counts when violations exist', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 820 });
    await bootWorkspace(page, { extraViolations: SEEDED_VIOLATIONS });
    await waitForStore(page, ['wall-main']);

    const entry = page.getByTestId('status-bar-advisor-entry');
    await expect(entry).toBeVisible();
    await expect(entry).toHaveAttribute(
      'title',
      /Advisor:\s+\d+\s+errors?,\s+\d+\s+warnings?,\s+\d+\s+info/i,
    );
  });

  test('opens advisor dialog from status-bar and dismisses cleanly', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 820 });
    await bootWorkspace(page, { extraViolations: SEEDED_VIOLATIONS });
    await waitForStore(page, ['wall-main']);

    await page.getByTestId('status-bar-advisor-entry').click();
    const dialog = page.getByTestId('advisor-dialog');
    await expect(dialog).toBeVisible();
    await page.getByTestId('advisor-dialog-close').click();
    await expect(page.getByTestId('advisor-dialog')).toHaveCount(0);
  });

  test('advisor group-by toggle keeps dialog mounted', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 820 });
    await bootWorkspace(page, { extraViolations: SEEDED_VIOLATIONS });
    await waitForStore(page, ['wall-main']);

    await page.getByTestId('status-bar-advisor-entry').click();
    const dialog = page.getByTestId('advisor-dialog');
    await expect(dialog).toBeVisible();
    await page.getByTestId('advisor-group-by').selectOption('category');
    await expect(dialog).toBeVisible();
    await page.getByTestId('advisor-group-by').selectOption('view');
    await expect(dialog).toBeVisible();
  });
});
