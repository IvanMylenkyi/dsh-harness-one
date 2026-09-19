import { expect, test } from '@playwright/test';

test('language selector switches the shell reactively in both directions', async ({ page }) => {
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.route('**/api/**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: '{}',
  }));
  await page.goto('/');
  const language = page.locator('select[aria-label]');

  await expect(language).toHaveValue('en');
  await expect(page.getByRole('button', { name: 'Canvas', exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page).toHaveTitle('Workflow One');

  await language.selectOption('zh-CN');
  await expect(language).toHaveValue('zh-CN');
  await expect(page.getByRole('button', { name: '画布', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '添加节点', exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  await expect(page).toHaveTitle('物业智能体工作流编排 MVP');

  await language.selectOption('en');
  await expect(language).toHaveValue('en');
  await expect(page.getByRole('button', { name: 'Canvas', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add node', exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page).toHaveTitle('Workflow One');
  expect(consoleErrors, `browser console errors: ${consoleErrors.join('; ')}`).toEqual([]);
  expect(pageErrors, `browser page errors: ${pageErrors.join('; ')}`).toEqual([]);
});
