import { expect, test } from '@playwright/test';

test.describe('real backend proxy path', () => {
  test('browser fetch reaches FastAPI health through the Vite /api proxy', async ({ page }) => {
    await page.goto('/');

    const response = await page.evaluate(async () => {
      const res = await fetch('/api/health', { headers: { 'x-cq17-proxy-smoke': '1' } });
      return { status: res.status, body: await res.json() };
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'ok', service: 'bim-ai' });
  });
});
