// 试运行弹窗：手填/编辑假输入（默认取各上游最近运行输出，可禁用单个上游）、
// 进行中显示流式轮次与预览；结果与最近几次对比。
import { useEffect, useRef, useState } from 'react';
import { apiUrl } from './api.js';
import { parseJsonResponseText } from './json-response.js';
import { trialRequestUrls } from './trial-request.js';
import { Modal, useToast } from './ui.jsx';
import { useI18n } from './i18n/index.js';

function errorText(error, t) {
  return error?.i18nKey ? t(error.i18nKey, error.i18nVariables) : String(error?.message || error || '');
}

function canRetryResponse(error) {
  return ['test.htmlResponse', 'test.emptyResponse'].includes(error?.i18nKey)
    || /HTTP 404|Failed to fetch|Load failed/i.test(error?.message || '');
}

export function TestRunModal({ node, upstreamNodes, upstreamPreviews, workflowId, workflowVariables, inputSchema, runInputs, triggerInput, onClose, onResult }) {
  const toast = useToast();
  const { locale, t } = useI18n();
  // 每个上游：{ enabled, text }——text 默认 = 最近运行输出或示例占位
  const [inputs, setInputs] = useState(() => {
    const init = {};
    for (const u of upstreamNodes) {
      const prev = upstreamPreviews[u.id] ?? upstreamPreviews[u.label] ?? u.output;
      init[u.id] = { enabled: true, text: prev != null ? String(prev) : '' };
    }
    return init;
  });
  const [trigger, setTrigger] = useState(triggerInput || '');
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(null); // { turns, preview }
  const [result, setResult] = useState(null); // { ok, output, error, at, meta }
  const [history, setHistory] = useState([]); // 最近几次试运行结果
  const [showDiff, setShowDiff] = useState(false);
  const esRef = useRef(null);
  const requestAbortRef = useRef(null);

  const hasUpstream = upstreamNodes.length > 0;

  // 流式进度：监听 agent-progress（runId 匹配 test_ 前缀即试运行）
  useEffect(() => {
    if (!running) return undefined;
    const es = new EventSource(apiUrl('/events'));
    esRef.current = es;
    es.addEventListener('agent-progress', (e) => {
      const p = JSON.parse(e.data);
      if (p.runId?.startsWith('test_')) setProgress(p);
    });
    return () => { es.close(); esRef.current = null; };
  }, [running]);

  useEffect(() => () => requestAbortRef.current?.abort(), []);

  const close = () => {
    requestAbortRef.current?.abort();
    onClose();
  };

  const run = async () => {
    setRunning(true);
    setProgress(null);
    setResult(null);
    const upstreamOutputs = {};
    const upstreamStructuredOutputs = {};
    const upstreamLabels = {};
    for (const u of upstreamNodes) {
      const st = inputs[u.id];
      if (!st?.enabled) continue;
      upstreamOutputs[u.id] = st.text;
      upstreamLabels[u.id] = u.label;
      if (u.structuredOutput !== undefined && st.text === String(u.output ?? '')) {
        upstreamStructuredOutputs[u.id] = u.structuredOutput;
      } else {
        const parsed = parseStructuredInput(st.text);
        if (parsed !== undefined) upstreamStructuredOutputs[u.id] = {
          version: 1,
          type: 'json',
          mediaType: 'application/json',
          value: parsed,
        };
      }
    }
    try {
      const url = apiUrl('/node/test');
      const controller = new AbortController();
      requestAbortRef.current = controller;
      const request = {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({
          node: { id: node.id, type: node.data.nodeType, data: stripRuntime(node.data) },
          upstreamOutputs, upstreamStructuredOutputs, upstreamLabels,
          workflowId,
          workflowVariables,
          inputSchema,
          runInputs,
          triggerInput: trigger,
        }),
      };
      const d = await fetchTrialJson(url, request);
      const r = { ...d, at: new Date().toLocaleTimeString(locale, { hour12: false }) };
      setResult(r);
      setHistory((h) => [r, ...h].slice(0, 5));
      if (d.ok) toast(t('test.completed'), 'success');
      else toast(t('test.failed', { error: d.error }), 'error');
      onResult?.(d);
    } catch (e) {
      if (e.name !== 'AbortError') {
        const message = errorText(e, t);
        setResult({ ok: false, error: message, at: new Date().toLocaleTimeString(locale, { hour12: false }) });
        toast(t('test.failed', { error: message }), 'error');
      }
    } finally {
      requestAbortRef.current = null;
      setRunning(false);
    }
  };

  return (
    <Modal
      title={t('test.modalTitle', { label: node.data.label || node.id })}
      onClose={close}
      footer={(
        <>
          <button className="btn" onClick={close}>{t('action.close')}</button>
          <button className="btn btn-primary" disabled={running} onClick={run}>
            {running ? t('run.running') : `▶ ${t('action.execute')}`}
          </button>
        </>
      )}
    >
      {/* 上游假输入 */}
      {hasUpstream && (
        <div className="test-inputs">
          <div className="test-sec-title">{t('test.upstreamInput')}{running ? '' : `（${t('test.editable')}）`}</div>
          {upstreamNodes.map((u) => (
            <div key={u.id} className={`test-input-row ${inputs[u.id]?.enabled ? '' : 'test-input-off'}`}>
              <label className="test-input-head">
                <input
                  type="checkbox"
                  checked={inputs[u.id]?.enabled ?? true}
                  onChange={(e) => setInputs((s) => ({ ...s, [u.id]: { ...s[u.id], enabled: e.target.checked } }))}
                />
                <span className="test-input-name">{`{{${u.label}}}`}</span>
                {upstreamPreviews[u.label] != null && <span className="test-from">{t('test.fromLastRun')}</span>}
              </label>
              <textarea
                rows={3}
                value={inputs[u.id]?.text || ''}
                placeholder={t('test.mockOutputPlaceholder')}
                onChange={(e) => setInputs((s) => ({ ...s, [u.id]: { ...s[u.id], text: e.target.value } }))}
              />
            </div>
          ))}
          <div className="test-input-row">
            <div className="test-input-head"><span className="test-input-name">{'{{$trigger}}'}</span></div>
            <textarea rows={2} value={trigger} placeholder={t('test.triggerPlaceholder')}
              onChange={(e) => setTrigger(e.target.value)} />
          </div>
        </div>
      )}

      {/* 流式进度 */}
      {running && progress && (
        <div className="test-progress">
          <div className="test-sec-title">{t('test.progress', { turns: progress.turns || '?' })}</div>
          {progress.preview && <pre>{String(progress.preview).slice(-400)}</pre>}
        </div>
      )}

      {/* 本次结果 */}
      {result && (
        <div className={`test-result ${result.ok ? '' : 'test-result-err'}`}>
          <div className="test-sec-title">
            {result.ok ? t('test.result', { at: result.at }) : t('test.failedAt', { at: result.at })}
            {result.ok && result.turns ? ` · ${t('status.roundsCount', { count: result.turns })}` : ''}
            {result.ok && result.model ? ` · ${result.model}` : ''}
          </div>
          <pre>{result.ok ? result.output : result.error}</pre>
          {result.ok && result.input !== undefined && (
            <details className="test-structured">
              <summary>{t('test.parsedJsonInput')}</summary>
              <pre>{JSON.stringify(result.input, null, 2)}</pre>
            </details>
          )}
          {result.ok && result.structuredOutput?.type === 'json' && (
            <details className="test-structured" open>
              <summary>{t('test.structuredPreview')}</summary>
              <pre>{JSON.stringify(result.structuredOutput.value, null, 2)}</pre>
            </details>
          )}
          {result.ok && result.artifacts?.length > 0 && (
            <details className="test-structured" open>
              <summary>{t('test.workspaceArtifacts', { count: result.artifacts.length })}</summary>
              <ul className="test-artifact-list">
                {result.artifacts.map((artifact) => <li key={artifact}>{artifact}</li>)}
              </ul>
            </details>
          )}
        </div>
      )}

      {/* 历史 */}
      {history.length > 1 && (
        <div className="test-history">
          <button className="btn btn-sm" onClick={() => setShowDiff((v) => !v)}>
            {showDiff ? t('test.collapse') : t('test.compareRecent', { count: history.length })}
          </button>
          {showDiff && (
            <div className="test-hist-list">
              {history.map((h, i) => (
                <div key={i} className={`test-hist-item ${h.ok ? '' : 'test-result-err'}`}>
                  <div className="test-hist-meta">{h.at} {h.ok ? '✓' : '✕'} {h.turns ? t('status.roundsCount', { count: h.turns }) : ''}</div>
                  <pre>{String(h.ok ? h.output : h.error).slice(0, 600)}</pre>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

async function fetchTrialJson(url, request) {
  let lastError;
  const urls = trialRequestUrls(url);

  for (let index = 0; index < urls.length; index += 1) {
    const candidate = urls[index];
    try {
      const response = await fetch(candidate, request);
      const text = await response.text();
      const data = parseJsonResponseText(text, {
        status: response.status,
        contentType: response.headers.get('content-type') || '',
        url: candidate,
      });
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      return data;
    } catch (error) {
      lastError = error;
      const canUseAlternate = index < urls.length - 1 && canRetryResponse(error);
      if (canUseAlternate) continue;
      if (index === urls.length - 1 && canRetryResponse(error)) {
        await new Promise((resolve) => setTimeout(resolve, 350));
        try {
          const response = await fetch(candidate, request);
          const text = await response.text();
          const data = parseJsonResponseText(text, {
            status: response.status,
            contentType: response.headers.get('content-type') || '',
            url: candidate,
          });
          if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
          return data;
        } catch (retryError) {
          lastError = retryError;
        }
      }
      throw lastError;
    }
  }
  throw lastError;
}

function parseStructuredInput(value) {
  const text = String(value ?? '').trim();
  if (!text || (!text.startsWith('{') && !text.startsWith('['))) return undefined;
  try { return JSON.parse(text); } catch { return undefined; }
}

function stripRuntime(data) {
  const {
    runStatus, runOutput, runError, runChars, runtimeStructuredOutput,
    livePreview, artifacts, sessionId, durationMs, runtimeModel, test, ...rest
  } = data;
  return rest;
}
