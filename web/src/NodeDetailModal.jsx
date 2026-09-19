// 节点运行详情弹窗：点击运行日志的节点行打开。
// 数据来自 /wf1/api/node-detail —— 输入（模板渲染后）、输出全文、agent 过程轨迹
// （轮次 / 助手文本 / 每一次工具调用的参数与结果）。运行中的 agent 节点按 1.5s 轮询
// 实时轨迹（引擎 watchTick 折叠进内存 run），终态即停；完成节点仍读落盘快照。

import { useEffect, useRef, useState } from 'react';
import { Modal } from './ui.jsx';
import { apiUrl } from './api.js';
import { ArtifactLinks } from './ArtifactPreview.jsx';
import { nextPollDelayMs, shouldAutoSelectTrace } from './node-detail-polling.js';
import { UsageMeta } from './UsageMeta.jsx';
import { useI18n } from './i18n/index.js';

const ENTRY_ICON = { input: '↳', inject: '⊕', assistant: '✦', tool: '🔧', 'turn-end': '↩' };
const ENTRY_LABEL = { input: 'detail.input', inject: 'detail.inject', assistant: 'detail.assistant', tool: 'detail.toolCall', 'turn-end': 'detail.turnEnd' };
const STATUS_KEYS = {
  running: 'status.running', success: 'status.success', error: 'status.error',
  canceled: 'status.canceled', interrupted: 'status.interrupted', skipped: 'status.skipped',
  waiting: 'status.waiting', queued: 'status.queued', pending: 'status.queued',
};

function kv(rows) {
  return rows.filter(Boolean).join(' · ');
}

function detailText(value) {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  try { return JSON.stringify(value, null, 2); } catch { return String(value); }
}

function TraceEntry({ en, i }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  if (en.kind === 'turn-end') {
    return <div className="trace-row trace-turn">{t(ENTRY_LABEL['turn-end'], { turn: i, reason: en.reason || 'done' })}</div>;
  }
  if (en.kind === 'input' || en.kind === 'inject') {
    return (
      <div className={`trace-row trace-${en.kind}`}>
        <span className="trace-tag">{t(ENTRY_LABEL[en.kind])}</span>
        <pre className="trace-text">{en.text}</pre>
      </div>
    );
  }
  if (en.kind === 'assistant') {
    return (
      <div className="trace-row trace-assistant">
        <span className="trace-tag">{ENTRY_ICON.assistant} {t(ENTRY_LABEL.assistant)}</span>
        <pre className="trace-text">{en.text}</pre>
        {en.usage && (
          <span className="trace-usage" title={t('detail.usageHelp')}>
            {en.usage.outputTokens ? `↑${en.usage.outputTokens}` : ''}
            {en.usage.inputTokens ? ` ↓${en.usage.inputTokens}` : ''}
            {en.usage.cacheReadTokens ? ` ⇦${en.usage.cacheReadTokens}` : ''}
            {en.usage.cacheWriteTokens ? ` ⇨${en.usage.cacheWriteTokens}` : ''}
          </span>
        )}
      </div>
    );
  }
  // tool：参数 / 结果可展开（默认收起，长内容不刷屏）
  const args = (() => { try { return JSON.stringify(JSON.parse(en.args), null, 2); } catch { return en.args; } })();
  return (
    <div className={`trace-row trace-tool ${en.result?.ok === false ? 'trace-tool-err' : ''}`}>
      <button type="button" className="trace-tool-head" onClick={() => setOpen((v) => !v)}>
        <span className="trace-caret">{open ? '▾' : '▸'}</span>
        <span className="trace-tool-name">{en.name}</span>
        {en.turn != null && <span className="trace-usage">{t('status.roundsCount', { count: en.turn })}</span>}
        {en.result ? (
          <span className={`trace-tool-flag ${en.result.ok ? '' : 'flag-err'}`}>{en.result.ok ? '✓' : '✗'}</span>
        ) : <span className="trace-tool-flag">…</span>}
        {en.result?.text && <span className="trace-tool-brief">{en.result.text.replace(/\s+/g, ' ').slice(0, 80)}</span>}
      </button>
      {open && (
        <div className="trace-tool-body">
          <div className="trace-block">
            <span className="trace-block-label">{t('detail.parameters')}</span>
            <pre className="trace-text">{args || t('detail.empty')}</pre>
          </div>
          {en.result && (
            <div className="trace-block">
              <span className="trace-block-label">{t('detail.result')}{en.result.ok === false ? `（${t('status.error')}）` : ''}</span>
              <pre className="trace-text">{en.result.text || t('detail.empty')}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function NodeDetailModal({ runId, nodeId, onClose }) {
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [tab, setTab] = useState('trace');
  const firstLoadRef = useRef(true);
  const userTabRef = useRef(false);
  const pickTab = (next) => { userTabRef.current = true; setTab(next); };

  useEffect(() => {
    let alive = true;
    let timer = null;
    const load = () => {
      fetch(apiUrl(`/node-detail?run=${encodeURIComponent(runId)}&node=${encodeURIComponent(nodeId)}`))
        .then((r) => r.json())
        .then((d) => {
          if (!alive) return;
          if (d.error) { setErr(d.error); return; }
          const first = firstLoadRef.current;
          firstLoadRef.current = false;
          if (shouldAutoSelectTrace(d, first, userTabRef.current)) setTab('trace');
          setData(d);
          setErr(null);
          // running 节点持续轮询（引擎侧 2s 折叠一次轨迹），终态即停
          const delay = nextPollDelayMs(d.status);
          if (delay) timer = setTimeout(load, delay);
        })
        .catch((e) => { if (alive) setErr(String(e)); });
    };
    load();
    return () => { alive = false; if (timer) clearTimeout(timer); };
  }, [runId, nodeId]);

  const trace = data?.trace;
  const toolCount = trace?.entries?.filter((e) => e.kind === 'tool').length ?? 0;

  return (
    <Modal title={t('detail.modalTitle', { label: data?.label || nodeId })} onClose={onClose} footer={
      <button className="btn" onClick={onClose}>{t('action.close')}</button>
    }>
      {err && <p className="panel-error">{err}</p>}
      {!data && !err && <p className="panel-empty">{t('status.loading')}</p>}
      {data && (
        <>
          <div className="detail-meta">
            <span className={`log-status dot-${data.status}`}>{STATUS_KEYS[data.status] ? t(STATUS_KEYS[data.status]) : data.status}</span>
            {data.status === 'running' && <span className="detail-live">{t('detail.liveTracking')}</span>}
            {data.state?.durationMs != null && <span>{(data.state.durationMs / 1000).toFixed(1)}s</span>}
            {data.state?.chars != null && <span>{t('status.charsCount', { count: data.state.chars })}</span>}
            {data.state?.turns != null && <span>{t('status.roundsCount', { count: data.state.turns })}</span>}
            {toolCount > 0 && <span>{t('detail.toolCallsCount', { count: toolCount })}</span>}
            {data.state?.model && <span>{data.state.model}</span>}
            <UsageMeta usage={data.state?.usage} />
            {data.state?.toleratedError && <span className="detail-tol">{t('detail.continuedAfterFailure', { error: data.state.toleratedError })}</span>}
          </div>

          <div className="detail-tabs">
            {trace && <button className={`log-filter ${tab === 'trace' ? 'log-filter-on' : ''}`} onClick={() => pickTab('trace')}>{t('detail.process')}</button>}
            <button className={`log-filter ${tab === 'io' ? 'log-filter-on' : ''}`} onClick={() => pickTab('io')}>{t('detail.inputOutput')}</button>
          </div>

          {tab === 'io' && (
            <div className="detail-io">
              {data.input != null && (
                <div className="detail-io-block">
                  <span className="trace-block-label">{data.nodeType === 'input' ? t('detail.runInput') : t('detail.renderedInput')}</span>
                  <pre className="trace-text">{detailText(data.input) || t('detail.empty')}</pre>
                </div>
              )}
              <div className="detail-io-block">
                <span className="trace-block-label">{t('detail.fullOutput')}</span>
                <pre className="trace-text">{data.output || t('detail.empty')}</pre>
              </div>
              {data.state?.error && (
                <div className="detail-io-block">
                  <span className="trace-block-label">{t('status.error')}</span>
                  <pre className="trace-text panel-error">{data.state.error}</pre>
                </div>
              )}
            </div>
          )}

          {tab === 'trace' && trace && (
            <div className="detail-trace">
              {trace.entries?.map((en, i) => <TraceEntry key={i} en={en} i={i} />)}
              {(!trace.entries || trace.entries.length === 0) && (
                <p className="panel-empty">{t('detail.noTrace')}</p>
              )}
              {data.state?.artifacts?.length > 0 && (
                <div className="detail-io-block">
                  <span className="trace-block-label">{t('detail.workspaceArtifacts')}</span>
                  <ArtifactLinks
                    nodeLabel={data.label || nodeId}
                    runId={runId}
                    nodeId={nodeId}
                    artifacts={data.state.artifacts}
                  />
                </div>
              )}
            </div>
          )}
          {tab === 'trace' && !trace && (
            <p className="panel-empty">{t('detail.noTraceArchived')}</p>
          )}
        </>
      )}
    </Modal>
  );
}
