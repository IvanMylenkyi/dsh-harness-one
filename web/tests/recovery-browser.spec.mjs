import { expect, test } from '@playwright/test';

test('document wall and node detail keep data stable while chrome switches language', async ({ page }) => {
  const nodeDetail = {
    status: 'success',
    label: 'Review node',
    input: 'user supplied input',
    output: 'model output',
    state: { durationMs: 1500, chars: 42, turns: 1, model: 'fixture-model' },
    trace: { entries: [{ kind: 'assistant', text: 'trace text' }] },
  };
  await page.route('**/api/comments**', async (route) => route.fulfill({ json: { comments: [], revisions: [] } }));
  await page.route('**/api/node-detail**', async (route) => route.fulfill({ json: nodeDetail }));
  await page.goto('/test-pages/recovery.html');

  const language = page.getByRole('combobox', { name: 'fixture language' });
  await expect(page.getByText('Audit workflow')).toBeVisible();
  await page.getByRole('button', { name: /Results/ }).click();
  await expect(page.getByText('Source node link')).toBeVisible();
  await expect(page.getByText('Node details · Review node')).toBeVisible();
  await expect(page.getByText('Process', { exact: true })).toBeVisible();

  await language.selectOption('zh-CN');
  await expect(page.getByText('成果', { exact: true })).toBeVisible();
  await expect(page.getByText('Source node 链接')).toBeVisible();
  await expect(page.getByText('节点详情 · Review node')).toBeVisible();
  await expect(page.getByText('执行过程', { exact: true })).toBeVisible();
  await expect(page.getByText('model output')).toHaveCount(0);

  await page.getByRole('button', { name: '输入 / 输出', exact: true }).click();
  await expect(page.getByText('model output')).toBeVisible();
});
