// 工作流列表页：管理工作流，并提供运行状态、启动、取消和运行详情入口。

import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Eye, Play, Square, Upload } from 'lucide-react';
import { apiUrl } from './api.js';
import { createWorkflowDocument } from './workflow-serialization.js';
import { workflowCards } from './workflow-list-state.js';
import { RunWorkflowModal } from './RunWorkflowModal.jsx';
import { useToast, PromptModal, ConfirmModal } from './ui.jsx';
import { useI18n } from './i18n/index.js';

const STATUS_KEY = { running: 'status.running', success: 'status.success', error: 'status.error', canceled: 'status.canceled', interrupted: 'status.interrupted' };
const STATUS_CLASS = { running: 'running', success: 'success', error: 'error', canceled: 'canceled', interrupted: 'error' };

function runTime(run, t, formatDateTime, formatDuration) {
  if (!run?.startedAt) return '';
  if (run.live) return `${t('workflow.startedAt')} ${formatDateTime(run.startedAt)}`;
  if (run.durationMs != null) return formatDuration(run.durationMs);
  return formatDateTime(run.startedAt);
}

function errorText(error, t) {
  return error?.i18nKey ? t(error.i18nKey, error.i18nVariables) : String(error?.message || error || '');
}

export function WorkflowList({ currentId, onOpen, onNew, runs = [], onStartRun, onCancelRun, onInspectRun, onRefresh }) {
  const { formatDateTime, formatDuration, t } = useI18n();
  const toast = useToast();
  const [list, setList] = useState([]);
  const [busy, setBusy] = useState(false);
  const [rowBusy, setRowBusy] = useState({});
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState(null);
  const [runWorkflow, setRunWorkflow] = useState(null);
  const importRef = useRef(null);

  const load = async () => {
    try {
      const res = await fetch(apiUrl('/workflows'));
      if (!res.ok) throw new Error(`${t('workflow.loadFailed')} (HTTP ${res.status})`);
      const data = await res.json();
      setList(data.workflows || []);
    } catch (error) { toast(errorText(error, t) || t('workflow.loadFailed'), 'error'); }
  };
  useEffect(() => { load(); }, []);

  const cards = useMemo(() => workflowCards(list, runs), [list, runs]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cards;
    return cards.filter((wf) => wf.name.toLowerCase().includes(q) || wf.id.toLowerCase().includes(q));
  }, [cards, query]);

  const refresh = () => { load(); onRefresh?.(); };
  const setActionBusy = (key, value) => setRowBusy((current) => ({ ...current, [key]: value }));

  const openRun = async (wf) => {
    setActionBusy(`${wf.id}:run`, true);
    try {
      const res = await fetch(apiUrl(`/workflows/detail?id=${encodeURIComponent(wf.id)}`));
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('workflow.readFailed'));
      setRunWorkflow(data);
    } catch (error) { toast(errorText(error, t) || t('workflow.readFailed'), 'error'); }
    finally { setActionBusy(`${wf.id}:run`, false); }
  };

  const start = async (input) => {
    if (!runWorkflow) return;
    await onStartRun?.(runWorkflow, input);
    refresh();
  };

  const askCancel = (wf, run) => setModal({ type: 'confirm', title: t('workflow.cancelRunTitle'), message: t('workflow.cancelRunMessage', { workflow: wf.name, runId: run.runId, time: runTime(run, t, formatDateTime, formatDuration) }), danger: true, confirmText: t('workflow.cancelRunConfirm'), onConfirm: async () => {
    setModal(null);
    const key = `${wf.id}:${run.runId}`;
    setActionBusy(key, true);
    try { await onCancelRun?.(run.runId); refresh(); }
    catch (error) { toast(errorText(error, t) || t('workflow.cancelFailed'), 'error'); }
    finally { setActionBusy(key, false); }
  } });

  const createNew = () => setModal({ type: 'prompt', title: t('workflow.new'), initial: t('workflow.defaultName'), confirmText: t('action.new'), onConfirm: async (name) => {
    setModal(null); setBusy(true);
    try {
      const res = await fetch(apiUrl('/workflows'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, ...createWorkflowDocument() }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('workflow.createFailed'));
      refresh(); onNew?.(data);
    } catch (error) { toast(errorText(error, t) || t('workflow.createFailed'), 'error'); }
    finally { setBusy(false); }
  } });

  const rename = (wf) => setModal({ type: 'prompt', title: t('workflow.rename'), initial: wf.name, confirmText: t('workflow.renameAction'), onConfirm: async (name) => {
    setModal(null);
    const res = await fetch(apiUrl(`/workflows/detail?id=${encodeURIComponent(wf.id)}`), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
    if (!res.ok) toast(t('workflow.renameFailed'), 'error'); else refresh();
  } });

  const remove = (wf) => setModal({ type: 'confirm', title: t('workflow.delete'), message: t('workflow.deleteMessage', { workflow: wf.name }), danger: true, confirmText: t('action.delete'), onConfirm: async () => {
    setModal(null);
    const res = await fetch(apiUrl(`/workflows/detail?id=${encodeURIComponent(wf.id)}`), { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) toast(data.error || t('workflow.deleteFailed'), 'error'); else { toast(t('workflow.deleted', { workflow: wf.name }), 'warn'); refresh(); }
  } });

  const duplicate = async (wf) => {
    const res = await fetch(apiUrl('/workflows'), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: wf.id }) });
    if (res.ok) { toast(t('workflow.duplicated'), 'success'); refresh(); } else toast(t('workflow.duplicateFailed'), 'error');
  };

  const exportWf = async (wf) => {
    setBusy(true);
    try {
      const res = await fetch(apiUrl(`/workflows/transfer?id=${encodeURIComponent(wf.id)}`));
      if (!res.ok) { const out = await res.json().catch(() => ({})); throw new Error(out.error || `${t('workflow.requestFailed')} (HTTP ${res.status})`); }
      if (!res.headers.get('content-type')?.includes('application/json')) throw new Error(t('workflow.invalidServiceJson'));
      const url = URL.createObjectURL(await res.blob()); const a = document.createElement('a'); a.href = url; a.download = `${wf.name}.workflow-one.json`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 0);
      toast(t('workflow.exported', { workflow: wf.name }), 'success');
    } catch (error) { toast(`${t('workflow.exportFailed')}: ${errorText(error, t)}`, 'error'); }
    finally { setBusy(false); }
  };

  const importWf = async (e) => {
    const file = e.target.files?.[0]; e.target.value = ''; if (!file) return;
    setBusy(true);
    try {
      const text = await file.text(); let data; try { data = JSON.parse(text); } catch { throw new Error(t('workflow.invalidFileJson')); }
      const res = await fetch(apiUrl('/workflows/transfer'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      const out = await res.json(); if (!res.ok) throw new Error(out.error || t('workflow.importFailed'));
      toast(t('workflow.imported', { workflow: out.name, warnings: out.warnings ? ` (${out.warnings} ${t('workflow.warnings')})` : '' }), 'success'); refresh(); await onOpen?.(out);
    } catch (error) { toast(`${t('workflow.importFailed')}: ${errorText(error, t)}`, 'error'); }
    finally { setBusy(false); }
  };

  return (
    <div className="wf-list-page">
      <div className="wf-list-head"><h3>{t('workflow.mine')} <span className="sec-hint">{t('workflow.count', { count: list.length })}</span></h3><input className="wf-search" placeholder={t('workflow.search')} value={query} onChange={(e) => setQuery(e.target.value)} /><button className="btn btn-sm" disabled={busy} onClick={() => importRef.current?.click()}><Upload size={14} aria-hidden="true" />{t('workflow.import')}</button><input ref={importRef} type="file" accept=".json" style={{ display: 'none' }} onChange={importWf} /><button className="btn btn-primary btn-sm" disabled={busy} onClick={createNew}>＋ {t('workflow.new')}</button></div>
      {list.length === 0 && <p className="panel-empty">{t('workflow.emptyHint')}</p>}
      {list.length > 0 && filtered.length === 0 && <p className="panel-empty">{t('workflow.noMatch', { query })}</p>}
      <div className="wf-cards">{filtered.map((wf) => <div key={wf.id} className={`wf-card ${wf.id === currentId ? 'wf-card-current' : ''}`}>
        <div className="wf-card-main" onClick={() => onOpen(wf)} title={t('workflow.open')}><div className="wf-card-name">{wf.name}</div><div className="wf-card-meta">🤖 {t('workflow.cardMeta', { agents: wf.agentCount, nodes: wf.nodeCount })} <span className="sec-hint"> · {formatDateTime(wf.updatedAt)}</span></div></div>
        <div className="wf-card-runtime">
          {wf.liveRuns?.length ? <>{wf.liveRuns.map((run) => <div className="wf-live-run" key={run.runId}><span className="wf-run-status running">{t('workflow.live')} · {run.progress?.done ?? 0}/{run.progress?.total ?? wf.nodeCount}</span><span className="wf-run-current">{run.currentNodes?.map((node) => node.label).join('、') || t('workflow.preparing')}</span><span className="wf-run-time">{runTime(run, t, formatDateTime, formatDuration)}</span><button className="btn-icon" title={t('workflow.viewRun')} aria-label={t('workflow.viewRunId', { runId: run.runId })} disabled={rowBusy[`${wf.id}:${run.runId}`]} onClick={() => onInspectRun?.(wf, run.runId)}><Eye size={14} /></button><button className="btn-icon wf-cancel-btn" title={t('workflow.cancelRun')} aria-label={t('workflow.cancelRunId', { runId: run.runId })} disabled={rowBusy[`${wf.id}:${run.runId}`]} onClick={() => askCancel(wf, run)}><Square size={13} /></button></div>)}</> : <div className="wf-run-empty">{wf.lastRun ? <><span className={`wf-run-status ${STATUS_CLASS[wf.lastRun.status] || ''}`}>{t(STATUS_KEY[wf.lastRun.status] || 'run.statusUnknown', { status: wf.lastRun.status })}</span><span className="wf-run-time">{runTime(wf.lastRun, t, formatDateTime, formatDuration)}</span><button className="btn-icon" title={t('workflow.viewRecent')} aria-label={t('workflow.viewRecent')} onClick={() => onInspectRun?.(wf, wf.lastRun.runId)}><Eye size={14} /></button></> : <span className="sec-hint">{t('workflow.notRun')}</span>}</div>}
        </div>
        <div className="wf-card-actions"><button className="btn btn-primary btn-sm" disabled={rowBusy[`${wf.id}:run`]} onClick={() => openRun(wf)}><Play size={13} />{t('action.run')}</button><button className="btn-icon" title={t('workflow.openShort')} onClick={() => onOpen(wf)}>↗</button><button className="btn-icon" title={t('workflow.duplicate')} onClick={() => duplicate(wf)}>⧉</button><button className="btn-icon" title={t('workflow.export')} aria-label={t('workflow.exportAria', { workflow: wf.name })} disabled={busy} onClick={() => exportWf(wf)}><Download size={15} aria-hidden="true" /></button><button className="btn-icon" title={t('workflow.renameAction')} onClick={() => rename(wf)}>✏️</button><button className="btn-icon" title={t('action.delete')} onClick={() => remove(wf)}>🗑</button></div>
      </div>)}</div>
      {modal?.type === 'prompt' && <PromptModal title={modal.title} initial={modal.initial} confirmText={modal.confirmText} onCancel={() => setModal(null)} onConfirm={modal.onConfirm} />}
      {modal?.type === 'confirm' && <ConfirmModal title={modal.title} message={modal.message} danger={modal.danger} confirmText={modal.confirmText} onCancel={() => setModal(null)} onConfirm={modal.onConfirm} />}
      {runWorkflow && <RunWorkflowModal workflow={runWorkflow} onClose={() => setRunWorkflow(null)} onStart={start} />}
    </div>
  );
}
