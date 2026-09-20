import { expect, test } from '@playwright/test';

test('DocWall recovery boundaries and server errors keep data stable across locales', async ({ page }) => {
  await page.route('**/api/comments**', async (route) => route.fulfill({ json: { comments: [], revisions: [] } }));
  await page.route('**/api/node-detail**', async (route) => route.fulfill({ json: { error: 'Server supplied failure' } }));
  await page.goto('/test-pages/boundaries.html');
  const language = page.getByRole('combobox', { name: 'fixture language' });
  const scenario = (name) => page.getByRole('button', { name, exact: true });

  await expect(page.getByText('Run a workflow once to see process documents here.')).toBeVisible();
  await language.selectOption('zh-CN');
  await expect(page.getByText('运行一次工作流后，过程文稿会铺在这里。')).toBeVisible();

  await scenario('loading').click();
  await expect(page.getByText('正在加载文稿…')).toBeVisible();
  await language.selectOption('en');
  await expect(page.getByText('Loading documents…')).toBeVisible();

  await scenario('error').click();
  await expect(page.getByText('Server load failure')).toBeVisible();
  await language.selectOption('zh-CN');
  await expect(page.getByText('Server load failure')).toBeVisible();
  await expect(page.getByRole('button', { name: '重试', exact: true })).toBeVisible();

  await scenario('live').click();
  await expect(page.getByText('实时输出')).toBeVisible();
  await expect(page.getByText('Live preview from server')).toBeVisible();
  await language.selectOption('en');
  await expect(page.getByText('Live output')).toBeVisible();

  await scenario('server-error').click();
  await expect(page.getByText('Server supplied failure')).toBeVisible();
  await language.selectOption('zh-CN');
  await expect(page.getByText('Server supplied failure')).toBeVisible();
  await expect(page.locator('.modal-foot').getByRole('button', { name: '关闭', exact: true })).toBeVisible();
});
