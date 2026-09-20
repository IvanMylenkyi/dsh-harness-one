import { expect, test } from '@playwright/test';

async function choose(page, label, value) {
  await page.getByLabel(label).selectOption(value);
}

test('document preview chrome switches English → zh-CN → English', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto('/test-pages/document-preview.html');

  await expect(page.getByRole('heading')).toHaveCount(0);
  await expect(page.getByText('Document preview', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close preview' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Download original file' })).toBeVisible();

  await choose(page, 'Fixture language', 'zh-CN');
  await expect(page.getByText('文档预览', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '关闭预览' })).toBeVisible();
  await expect(page.getByRole('link', { name: '下载原文件' })).toBeVisible();

  await choose(page, 'Fixture language', 'en');
  await expect(page.getByText('Document preview', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close preview' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  expect(pageErrors, `browser page errors: ${pageErrors.join('; ')}`).toEqual([]);
});

test('document preview exposes English PDF, spreadsheet, and PPTX controls', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto('/test-pages/document-preview.html?kind=pdf');

  await choose(page, 'Fixture renderer', 'pdf');
  await expect(page.getByLabel('PDF viewer controls')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Zoom out' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Rotate clockwise' })).toBeVisible();

  await page.goto('/test-pages/document-preview.html?kind=sheet');
  await expect(page.getByRole('tablist', { name: 'Worksheets' })).toBeAttached();
  await expect(page.getByPlaceholder('Search')).toHaveAttribute('placeholder', 'Search');
  await expect(page.getByRole('button', { name: 'Previous page' })).toBeAttached();

  await page.goto('/test-pages/document-preview.html?kind=pptx');
  await expect(page.getByLabel('PPTX viewer controls')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start presentation' })).toBeVisible();
  expect(pageErrors, `browser page errors: ${pageErrors.join('; ')}`).toEqual([]);
});
