import { expect, test } from '@playwright/test';

test('completed ResultPanel events render localized duration without page errors', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/test-pages/result-panel.html');
  await expect(page.locator('.result-step-pill-success')).toHaveText('Success');
  await expect(page.getByRole('button', { name: 'Completed step Success' })).toBeVisible();
  await expect(page.getByText('Duration 1.5 s', { exact: true })).toBeVisible();
  expect(pageErrors, `browser page errors: ${pageErrors.join('; ')}`).toEqual([]);
});
