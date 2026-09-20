import { expect, test } from '@playwright/test';

test('feedback drawer chrome switches languages without translating document data', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto('/test-pages/feedback.html');

  const language = page.locator('select[aria-label]').first();
  await expect(page.getByRole('complementary', { name: 'Comments for report.md' })).toBeVisible();
  await expect(page.getByText('report.md')).toBeVisible();
  await expect(page.getByText('No comments yet. Add a request and AI can produce a revised draft.')).toBeVisible();
  await expect(page.getByText('Version chain')).toBeVisible();
  await expect(page.getByRole('button', { name: '✍ Edit directly', exact: true })).toBeVisible();

  await language.selectOption('zh-CN');
  await expect(page.getByRole('complementary', { name: 'report.md的评论' })).toBeVisible();
  await expect(page.getByText('report.md')).toBeVisible();
  await expect(page.getByText('还没有评论。写下修改建议，AI 可按评论重出修订稿。')).toBeVisible();
  await expect(page.getByText('版本链')).toBeVisible();
  await expect(page.getByRole('button', { name: '✍ 直接编辑', exact: true })).toBeVisible();
  expect(pageErrors, `browser page errors: ${pageErrors.join('; ')}`).toEqual([]);
});
