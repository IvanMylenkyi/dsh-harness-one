// Univer Viewer 渲染器：.univer 文件内嵌 dsh-univer-office 的 Viewer 页面。
// 纯 URL 集成——不 import univer-office 的任何值，只拼它的 Gateway URL；
// 协议三步：/univer-api/status 发现 Gateway → /wf1/api/univer/resolve 换绝对路径
// → Gateway /uf/<key>/worktrees 选 worktree 后 iframe 打开。
// 纯函数（fileKey/pickWorktree/resolveEndpoint）在 ../univer-core.js，单测直覆盖。
import { useEffect, useMemo, useState } from 'react';
import { fileKeyOf, pickWorktree, resolveEndpointOf } from '../univer-core.js';
import { previewErrorMessage } from '../index.js';

async function fetchJson(url, options = {}) {
  const res = await fetch(url, { credentials: 'same-origin', ...options });
  if (!res.ok) {
    const error = new Error(`HTTP ${res.status}`);
    error.status = res.status;
    throw error;
  }
  return res.json();
}

async function buildViewerUrl(resolveUrl, signal) {
  const resolved = await fetchJson(resolveUrl, { signal });
  // Gateway 随 dsh 重启即停：先显式拉起（幂等，运行中 reused=true），再查地址；
  // 端口被占会逐次递增，所以每次现查不缓存。
  const started = await fetchJson('/univer-api/gateway/start', { method: 'POST', signal });
  const gateway = String(started?.gateway || '').replace(/\/$/, '');
  if (!gateway) {
    const error = new Error('Univer gateway failed');
    error.code = 'univer-gateway-failed';
    throw error;
  }
  const fileKey = fileKeyOf(resolved.file);
  if (!fileKey) {
    const error = new Error('Univer file path encoding failed');
    error.code = 'univer-path-failed';
    throw error;
  }
  const listing = await fetchJson(`${gateway}/uf/${fileKey}/worktrees`, { signal });
  const worktree = pickWorktree(listing?.worktrees);
  const params = new URLSearchParams({ file: fileKey, mode: 'embedded' });
  if (worktree) params.set('worktree', worktree);
  return `${gateway}/?${params.toString()}`;
}

export default function UniverRenderer({ document, locale, t }) {
  const resolveUrl = useMemo(() => resolveEndpointOf(document.downloadUrl), [document.downloadUrl]);
  const [state, setState] = useState({ loading: true, error: null, url: '' });

  useEffect(() => {
    if (!resolveUrl) {
      setState({ loading: false, error: { key: 'univer.missingArtifact' }, url: '' });
      return undefined;
    }
    const controller = new AbortController();
    setState({ loading: true, error: null, url: '' });
    buildViewerUrl(resolveUrl, controller.signal).then((url) => {
      if (!controller.signal.aborted) setState({ loading: false, error: null, url });
    }).catch((reason) => {
      if (controller.signal.aborted || reason?.name === 'AbortError') return;
      const missing = reason?.status === 404;
      setState({
        loading: false,
        error: missing
          ? { key: 'univer.missingPlugin' }
          : { reason },
        url: '',
      });
    });
    return () => controller.abort();
  }, [resolveUrl]);

  if (state.loading) return <div className="dsh-doc-preview-message">{t('univer.loading')}</div>;
  if (state.error) {
    const message = state.error.key
      ? t(state.error.key)
      : t('univer.unavailable', { message: previewErrorMessage(state.error.reason, locale) });
    return <div className="dsh-doc-preview-message is-error">{message}</div>;
  }
  return <iframe className="dsh-doc-preview-frame" src={state.url} title={t('preview.filePreview', { name: document.name })} />;
}
