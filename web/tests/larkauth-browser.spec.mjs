import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const bundlePath = fileURLToPath(new URL('../../dsh-plugins/dsh-ccpg-larkauth/lib/client.js', import.meta.url));

test('Lark auth states switch English → zh-CN → English', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  const bundle = await readFile(bundlePath, 'utf8');
  await page.route('**/larkauth-bundle.js', (route) => route.fulfill({ status: 200, contentType: 'text/javascript', body: bundle }));
  await page.goto('/test-pages/larkauth.html');

  await expect(page.getByText('lark-cli is not installed on this machine.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Install lark-cli automatically', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
  await expect(page.getByText(/Token auto-renewal:/)).toBeVisible();

  const language = page.getByLabel('Fixture language');
  await language.selectOption('zh-CN');
  await expect(page.getByText('本机未安装 lark-cli（飞书官方 CLI）。', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '自动安装 lark-cli', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '退出登录', exact: true })).toBeVisible();
  await expect(page.getByText(/凭证自动续期：当前至/)).toBeVisible();

  await language.selectOption('en');
  await expect(page.getByText('lark-cli is not installed on this machine.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Install lark-cli automatically', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  expect(pageErrors, `browser page errors: ${pageErrors.join('; ')}`).toEqual([]);
});
