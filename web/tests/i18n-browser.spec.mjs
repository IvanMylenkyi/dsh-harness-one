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

test('localized modal, toast, empty status, and lint error stay reactive', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.route('**/api/**', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/graph/lint')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, issues: [{ level: 'error', message: 'Invalid graph' }] }),
      });
    }
    if (url.pathname.endsWith('/graph')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ nodes: [], edges: [] }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await page.goto('/');
  const language = page.locator('select[aria-label]').first();

  await page.getByRole('button', { name: 'More actions', exact: true }).click();
  await page.getByRole('menuitem', { name: /Reset to example/ }).click();
  await expect(page.locator('.modal-head strong')).toHaveText('Reset to example workflow');

  await language.selectOption('zh-CN');
  await expect(page.locator('.modal-head strong')).toHaveText('重置为示例工作流');
  await expect(page.getByRole('button', { name: '取消', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '重置', exact: true })).toBeVisible();
  await language.selectOption('en');
  await expect(page.locator('.modal-head strong')).toHaveText('Reset to example workflow');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();

  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('.toast')).toContainText('Saved draft');
  await language.selectOption('zh-CN');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.locator('.toast').last()).toContainText('已保存草稿');

  await page.evaluate(() => window.postMessage({ type: 'wf1-session', sessionId: 'browser-smoke' }, window.location.origin));
  await expect(page.getByRole('toolbar', { name: '画布快捷指令' })).toBeVisible();
  await page.getByRole('button', { name: /最近状态/ }).click();
  await expect(page.locator('.toast').last()).toContainText('还没有运行记录');

  await page.locator('button.tb-run-btn.btn-primary').click();
  await expect(page.locator('.lint-bar strong')).toHaveText('图检查（1）');
  await expect(page.locator('.lint-item.lint-error')).toHaveCount(1);
  await language.selectOption('en');
  await expect(page.locator('.lint-bar strong')).toHaveText('Graph check (1)');
  expect(pageErrors, `browser page errors: ${pageErrors.join('; ')}`).toEqual([]);
});
