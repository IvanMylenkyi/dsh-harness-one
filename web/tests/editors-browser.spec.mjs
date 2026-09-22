import { expect, test } from '@playwright/test';

test('schema, rich document, and template chrome switch English and Chinese reactively', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto('/test-pages/editors.html');

  const language = page.getByRole('combobox', { name: 'fixture language' });
  await expect(page.getByText('Start from a template')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Apply template', exact: true })).toBeVisible();
  await expect(page.getByText('Output mode')).toBeVisible();
  await expect(page.getByRole('toolbar', { name: 'Formatting toolbar' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Insert table', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Apply template', exact: true }).click();
  await expect(page.getByTestId('applied-template')).toContainText('Service ticket details');
  await expect(page.getByTestId('applied-template')).toContainText('Organize service ticket');
  await expect(page.getByTestId('applied-template')).not.toContainText(/[\u3400-\u9fff]/);

  await language.selectOption('zh-CN');
  await expect(page.getByText('从模板开始')).toBeVisible();
  await expect(page.getByRole('button', { name: '应用模板', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '应用模板', exact: true }).click();
  await expect(page.getByTestId('applied-template')).toContainText('报修信息');
  await expect(page.getByTestId('applied-template')).toContainText('整理工单');
  await expect(page.getByText('输出模式')).toBeVisible();
  await expect(page.getByRole('toolbar', { name: '格式工具条' })).toBeVisible();
  await expect(page.getByRole('button', { name: '插入表格', exact: true })).toBeVisible();

  await language.selectOption('en');
  await expect(page.getByText('Start from a template')).toBeVisible();
  await expect(page.getByText('Output mode')).toBeVisible();
  await page.getByRole('button', { name: 'Apply template', exact: true }).click();
  await expect(page.getByTestId('applied-template')).toContainText('Service ticket details');
  expect(pageErrors, `browser page errors: ${pageErrors.join('; ')}`).toEqual([]);
});

test('schema editor exposes localized empty and invalid JSON states', async ({ page }) => {
  await page.goto('/test-pages/editors.html');
  await expect(page.getByText('No fields yet. Add fields to require the model to return JSON with this shape.')).toBeVisible();
  await page.getByRole('tab', { name: 'Advanced JSON', exact: true }).click();
  await page.locator('textarea').fill('{');
  await expect(page.getByText('Invalid JSON: Invalid JSON')).toBeVisible();

  await page.getByRole('combobox', { name: 'fixture language' }).selectOption('zh-CN');
  await expect(page.getByText('JSON 无效：JSON 无效')).toBeVisible();
  await expect(page.getByRole('tab', { name: '高级 JSON', exact: true })).toBeVisible();
});
