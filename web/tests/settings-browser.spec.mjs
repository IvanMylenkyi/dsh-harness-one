import { expect, test } from '@playwright/test';

async function mockSettingsApi(page) {
  await page.route('**/api/schedule/preview', async (route) => {
    await route.fulfill({ json: { times: ['2026-09-21T09:00:00.000Z', '2026-09-22T09:00:00.000Z'] } });
  });
  await page.route('**/api/schedule', async (route) => {
    await route.fulfill({ json: { schedules: [{ key: 'inspection', workflowName: 'Inspection workflow', cron: '0 9 * * *', nextAt: '2026-09-21T09:00:00.000Z', timezone: 'UTC', enabled: true, fireCount: 1 }] } });
  });
  await page.route('**/api/workflows', async (route) => {
    await route.fulfill({ json: { workflows: [{ id: 'wf-1', name: 'Inspection workflow' }] } });
  });
  await page.route('**/api/global-variables', async (route) => {
    await route.fulfill({ json: { version: 1, revision: 3, variables: [{ id: 'var-1', key: 'inspection_window', label: 'Inspection window', type: 'number', value: 15 }] } });
  });
}

test('schedule and variable panels switch language without translating data', async ({ page }) => {
  await mockSettingsApi(page);
  await page.goto('/test-pages/settings.html');
  const language = page.getByRole('combobox', { name: 'fixture language' });

  await expect(page.locator('.modal-box')).toContainText('Schedules');
  await expect(page.getByText('Daily at 09:00')).toBeVisible();
  await expect(page.getByText('Inspection workflow')).toBeVisible();

  await language.selectOption('zh-CN');
  await expect(page.locator('.modal-box')).toContainText('定时任务');
  await expect(page.getByText('每天 09:00')).toBeVisible();
  await expect(page.getByText('Inspection workflow')).toBeVisible();

  await page.getByRole('button', { name: '变量与输入', exact: true }).click();
  await expect(page.locator('.modal-box')).toContainText('变量与输入');
  await expect(page.getByText('Inspection window')).toBeVisible();
  await page.getByRole('button', { name: /工作流变量/ }).click();
  await expect(page.getByText(/当前只读/)).toBeVisible();

  await language.selectOption('en');
  await expect(page.locator('.modal-box')).toContainText('Variables and inputs');
  await expect(page.getByText(/is read-only/)).toBeVisible();
  await page.getByRole('button', { name: /Instance variables/ }).click();
  await expect(page.getByText('Inspection window')).toBeVisible();
});
