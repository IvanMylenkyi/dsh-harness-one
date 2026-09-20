import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const bundlePath = fileURLToPath(new URL('../../dsh-plugins/dsh-ccpg-canvasui/lib/client.js', import.meta.url));

test('canvas host cards and settings switch English → zh-CN → English', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  const bundle = await readFile(bundlePath, 'utf8');
  await page.route('**/canvasui-bundle.js', (route) => route.fulfill({ status: 200, contentType: 'text/javascript', body: bundle }));
  await page.route('**/wf1/api/llm-config', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ providers: [] }) }));
  await page.route('**/wf1/api/agent-defaults', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, defaults: {}, effective: null }) }));
  await page.goto('/test-pages/canvasui.html');

  await expect(page.getByText('Applied', { exact: true })).toBeVisible();
  await expect(page.getByText('Delete 1 node', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Apply', exact: true })).toBeVisible();
  await expect(page.getByText('No model channels are available; configure dsh settings first.', { exact: true })).toBeVisible();

  const language = page.getByLabel('Fixture language');
  await language.selectOption('zh-CN');
  await expect(page.getByText('已应用', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '应用', exact: true })).toBeVisible();
  await expect(page.getByText('还没有可用的模型渠道，请先在 dsh 设置里完成配置。', { exact: true })).toBeVisible();

  await language.selectOption('en');
  await expect(page.getByText('Applied', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Apply', exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  expect(pageErrors, `browser page errors: ${pageErrors.join('; ')}`).toEqual([]);
});
