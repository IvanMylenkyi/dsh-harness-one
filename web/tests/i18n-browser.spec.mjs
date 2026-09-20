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
  await page.evaluate(() => window.postMessage({ type: 'wf1-theme', theme: 'dark' }, window.location.origin));
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.evaluate(() => window.postMessage({ type: 'wf1-command-result', ok: true, text: 'run inspection' }, window.location.origin));
  await expect(page.locator('.toast').last()).toContainText('Sent to conversation: run inspection');
  await language.selectOption('zh-CN');
  await page.evaluate(() => window.postMessage({ type: 'wf1-theme', theme: 'light' }, window.location.origin));
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.evaluate(() => window.postMessage({ type: 'wf1-command-result', ok: true, text: 'run inspection' }, window.location.origin));
  await expect(page.locator('.toast').last()).toContainText('已发送到对话：run inspection');
  expect(pageErrors, `browser page errors: ${pageErrors.join('; ')}`).toEqual([]);
});

test('embedded host completes ready/session handshake', async ({ page }) => {
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const body = url.pathname.endsWith('/graph') ? { nodes: [], edges: [] } : {};
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto('/test-pages/host.html');
  await expect(page.locator('#host-state')).toHaveText('ready');
  const frame = page.frameLocator('#canvas');
  await expect(frame.locator('html')).toHaveAttribute('lang', 'en');
  await page.locator('#canvas').evaluate((iframe) => iframe.contentWindow.postMessage({ type: 'wf1-theme', theme: 'dark' }, window.location.origin));
  await expect(frame.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('embedded host routes open-run and resolves a pending patch confirmation', async ({ page }) => {
  await page.addInitScript(() => {
    const patch = { version: 1, workflowId: null, patch: [{ op: 'updateNode', id: 'missing-node', data: { label: 'Server node' } }] };
    window.EventSource = class FakeEventSource {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSED = 2;
      constructor(url) {
        this.url = url;
        this.readyState = FakeEventSource.CONNECTING;
        this.listeners = new Map();
        setTimeout(() => {
          this.readyState = FakeEventSource.OPEN;
          this.emit('open', {});
          this.emit('assistant-patch', { data: JSON.stringify(patch) });
        }, 0);
      }
      addEventListener(type, listener) { this.listeners.set(type, listener); }
      removeEventListener(type, listener) { if (this.listeners.get(type) === listener) this.listeners.delete(type); }
      emit(type, event) { this.listeners.get(type)?.(event); }
      close() { this.readyState = FakeEventSource.CLOSED; }
    };
  });
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const body = url.pathname.endsWith('/graph') ? { nodes: [], edges: [] } : {};
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.route('**/api/runs/detail?id=open-run', async (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ runId: 'open-run', status: 'success', graph: { nodes: [], edges: [] }, nodeStates: {} }),
  }));
  const detailRequest = page.waitForRequest((request) => request.url().includes('/api/runs/detail?id=open-run'));
  await page.goto('/test-pages/host.html');
  const frame = page.locator('#canvas');
  await expect(page.locator('#host-state')).toContainText('patch:discarded', { timeout: 10_000 });
  await frame.evaluate((iframe) => iframe.contentWindow.postMessage({ type: 'wf1-open-run', runId: 'open-run' }, window.location.origin));
  await detailRequest;
});

test('embedded document wall reloads after an SSE reconnect', async ({ page }) => {
  await page.addInitScript(() => {
    const realNow = Date.now.bind(Date);
    window.EventSource = class ReconnectEventSource {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSED = 2;
      constructor(url) {
        this.url = url;
        this.readyState = ReconnectEventSource.CONNECTING;
        this.listeners = new Map();
        setTimeout(() => this.emitOpen(), 0);
        setTimeout(() => {
          Date.now = () => realNow() + 12_000;
          this.emitOpen();
        }, 2_500);
      }
      addEventListener(type, listener) { this.listeners.set(type, listener); }
      removeEventListener(type, listener) { if (this.listeners.get(type) === listener) this.listeners.delete(type); }
      emitOpen() { this.readyState = ReconnectEventSource.OPEN; this.listeners.get('open')?.({}); }
      close() { this.readyState = ReconnectEventSource.CLOSED; }
    };
  });
  let resultLoads = 0;
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    let body = {};
    if (url.pathname.endsWith('/graph')) body = { nodes: [], edges: [] };
    else if (url.pathname.endsWith('/runs') && route.request().method() === 'GET') {
      body = { runs: [{ runId: 'live-doc-run', status: 'success', startedAt: '2026-09-20T10:00:00.000Z', workflowName: 'Recovered workflow' }] };
    } else if (url.pathname.endsWith('/runs/detail')) {
      body = { runId: 'live-doc-run', status: 'success', graph: { nodes: [], edges: [] }, nodeStates: {} };
    } else if (url.pathname.endsWith('/run-results')) {
      resultLoads += 1;
      body = { runId: 'live-doc-run', workflowName: 'Recovered workflow', status: 'success', finalFiles: [], processFiles: [], nodeTimeline: [] };
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto('/test-pages/host.html');
  const frame = page.frameLocator('#canvas');
  await expect(page.locator('#host-state')).toHaveText('ready');
  await frame.getByRole('button', { name: 'Documents', exact: true }).click();
  await expect(frame.getByText('Recovered workflow')).toBeVisible();
  await expect.poll(() => resultLoads, { timeout: 10_000 }).toBeGreaterThan(1);
});
