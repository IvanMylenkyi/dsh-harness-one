import { useEffect, useMemo, useRef, useState } from 'react';
import { Archive, Check, ChevronRight, Clock3, FolderDown, History, LoaderCircle, RefreshCw, Timer, X } from 'lucide-react';
import { apiUrl } from './api.js';
import { useI18n } from './i18n/index.js';
import {
  adaptRunResults,
  getArtifactIds,
  getRunId,
  isRunResultsReady,
  loadRunResults,
  RUN_ARTIFACT_SAVE_PATH,
  saveRunArtifacts,
} from './result-adapter.js';
import { deriveRunViewState, RESULT_TABS } from './run-view-state.js';
import ResultViewer, { ProcessArtifacts } from './ResultViewer.jsx';
import { UsageMeta } from './UsageMeta.jsx';
import './result-panel.css';

function formatTime(value, locale) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString(locale, { hour12: false });
}

const STEP_STATUS_META = {
  success: { statusKey: 'status.success', tone: 'success' },
  running: { statusKey: 'status.running', tone: 'running' },
  waiting: { statusKey: 'status.waiting', tone: 'waiting' },
  queued: { statusKey: 'status.queued', tone: 'pending' },
  pending: { statusKey: 'status.queued', tone: 'pending' },
  skipped: { statusKey: 'status.skipped', tone: 'skipped' },
  canceled: { statusKey: 'status.canceled', tone: 'danger' },
  error: { statusKey: 'status.error', tone: 'danger' },
};

function stepStatusMeta(status) {
  return STEP_STATUS_META[status] || { statusKey: null, statusLabel: status || '', tone: 'pending' };
}

function useElapsedClock(startedAt, active) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  if (!startedAt) return '';
  if (!active) return '';
  const sec = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  const mm = Math.floor(sec / 60);
  const ss = String(sec % 60).padStart(2, '0');
  return mm ? `${mm}:${ss}` : `0:${ss}`;
}

function ProcessStep({ event, index, runId, onFocusNode, onOpenNodeDetail }) {
  const { locale, t, formatDuration } = useI18n();
  const meta = stepStatusMeta(event.status);
  // running 节点也可打开：详情弹窗对运行中 agent 轮询实时轨迹（issue #52）
  const canOpenDetail = Boolean(event.nodeId && runId && event.status !== 'queued');
  const openDetail = canOpenDetail ? () => onOpenNodeDetail?.(runId, event.nodeId) : undefined;
  const startClock = formatTime(event.startedAt, locale);
  const liveElapsed = useElapsedClock(event.startedAt, event.status === 'running');
  const duration = event.status === 'running' ? liveElapsed : formatDuration(event.durationMs);
  return (
    <li
      className={`result-step result-step-${meta.tone}${canOpenDetail ? ' result-step-clickable' : ''}`}
      key={event.id}
      onClick={openDetail}
      onKeyDown={openDetail ? (e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(); }
      } : undefined}
      tabIndex={openDetail ? 0 : undefined}
      role={openDetail ? 'button' : undefined}
    >
      <span className="result-step-num" aria-hidden="true">
        {event.status === 'running' ? <LoaderCircle size={13} className="result-spin" /> : index + 1}
      </span>
      <div className="result-step-card">
        <div className="result-step-head">
          <button className="result-node-link" onClick={(e) => { e.stopPropagation(); onFocusNode?.(event.nodeId); }}>
            {event.nodeLabel || event.nodeId}
          </button>
          <span className={`result-step-pill result-step-pill-${meta.tone}`}>{meta.statusKey ? t(meta.statusKey) : meta.statusLabel}</span>
        </div>
        {(startClock || duration || event.usage) && (
          <div className="result-step-meta">
            {startClock && <span><Clock3 size={11} />{t('result.startTime', { time: startClock })}</span>}
            {duration && <span className={event.status === 'running' ? 'result-step-elapsed' : ''}><Timer size={11} />{t(event.status === 'running' ? 'result.runningDuration' : 'result.duration', { duration })}</span>}
            {event.usage && <UsageMeta usage={event.usage} />}
          </div>
        )}
        {event.error && <p className="result-step-text">{event.error}</p>}
        {canOpenDetail && <span className="result-detail-link">{t('result.details')} <ChevronRight size={12} /></span>}
      </div>
    </li>
  );
}

function ProcessView({ events, runId, onFocusNode, onOpenNodeDetail, runStartedAt, runDurationMs, running }) {
  const { t, formatDuration } = useI18n();
  const elapsed = useElapsedClock(runStartedAt, Boolean(running));
  if (!events.length) return <p className="result-empty">{t('result.emptyProcess')}</p>;
  return (
    <ol className="result-steps">
      {(elapsed || runDurationMs != null) && (
        <li className="result-step result-step-total" aria-label={t('result.totalDuration')}>
          <span className="result-step-num result-total-num"><Timer size={12} /></span>
          <div className="result-step-card result-total-card">
            <span className="result-total-label">{t('result.totalDuration')}</span>
            <span className="result-total-time">{elapsed || formatDuration(runDurationMs)}</span>
          </div>
        </li>
      )}
      {events.map((event, index) => (
        <ProcessStep key={event.id} event={event} index={index} runId={runId} onFocusNode={onFocusNode} onOpenNodeDetail={onOpenNodeDetail} />
      ))}
    </ol>
  );
}

function IssuesView({ issues, runId, onFocusNode, onOpenNodeDetail }) {
  const { t } = useI18n();
  if (!issues.length) return (
    <div className="result-ok-state"><Check size={18} /><span>{t('result.noIssues')}</span></div>
  );
  return (
    <div className="result-issues">
      {issues.map((issue) => (
        <div className={`result-issue result-issue-${issue.status}`} key={issue.id}>
          <div className="result-issue-title">
            <span>{issue.nodeLabel || issue.nodeId || t('result.runIssue')}</span>
            {issue.nodeId && <button onClick={() => onFocusNode?.(issue.nodeId)}>{t('result.focusNode')}</button>}
          </div>
          <p>{issue.message}</p>
          {issue.nodeId && runId && (
            <button className="result-detail-link" onClick={() => onOpenNodeDetail?.(runId, issue.nodeId)}>
              {t('result.details')} <ChevronRight size={12} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

export function ResultPanel({
  runDetail,
  results,
  events = [],
  status,
  triggerInput = '',
  onTriggerChange,
  onOpenHistory,
  onClose,
  onFocusNode,
  onOpenNodeDetail,
  sessionId = '',
  resultsReadyToken,
  canSaveToWorkspace = false,
  className = '',
}) {
  const { locale, t, formatDuration } = useI18n();
  const runId = getRunId(runDetail, status, results);
  const [activeTab, setActiveTab] = useState('process');
  const [remoteResults, setRemoteResults] = useState(undefined);
  const [selectedOutputId, setSelectedOutputId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [savedNames, setSavedNames] = useState([]);
  const [childDetail, setChildDetail] = useState(null);
  const [childLoading, setChildLoading] = useState(false);
  const childRequestRef = useRef(null);
  const initialReadyTokenRef = useRef(resultsReadyToken);
  const readyTokenRunRef = useRef(runId);
  const observedStatus = status?.running
    ? 'running'
    : (status?.last || status?.status || runDetail?.status);
  const runEnded = isRunResultsReady({ runId, status: observedStatus }, true);

  const loadResults = async (signal, waitUntilReady = false) => {
    if (!runId) return;
    setLoading(true);
    setLoadError('');
    try {
      const data = await loadRunResults(
        apiUrl(`/run-results?id=${encodeURIComponent(runId)}`),
        { signal, waitUntilReady },
      );
      setRemoteResults(data);
    } catch (error) {
      if (error?.name !== 'AbortError') setLoadError(error?.message || String(error));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    childRequestRef.current?.abort?.();
    childRequestRef.current = null;
    setRemoteResults(undefined);
    setSelectedOutputId(null);
    setActiveTab('process');
    setSaveError('');
    setSavedNames([]);
    setChildDetail(null);
    setChildLoading(false);
  }, [runId, results]);

  useEffect(() => () => childRequestRef.current?.abort?.(), []);

  useEffect(() => {
    if (!runId || results !== undefined) return undefined;
    const controller = new AbortController();
    loadResults(controller.signal, runEnded);
    return () => controller.abort();
  }, [runId, results, runEnded]);

  useEffect(() => {
    if (readyTokenRunRef.current !== runId) {
      readyTokenRunRef.current = runId;
      initialReadyTokenRef.current = resultsReadyToken;
      return undefined;
    }
    if (resultsReadyToken === initialReadyTokenRef.current) return undefined;
    if (!runId || results !== undefined || resultsReadyToken === undefined) return undefined;
    const controller = new AbortController();
    loadResults(controller.signal, true);
    return () => controller.abort();
  }, [resultsReadyToken, runId, results]);

  const source = results !== undefined ? results : remoteResults;
  const model = useMemo(
    () => adaptRunResults(source || {}, { runDetail, events, status, triggerInput }),
    [source, runDetail, events, status, triggerInput],
  );
  const successfulOutputs = model.outputResults.filter((row) => row.status === 'success' && row.output);
  const selectedOutput = successfulOutputs.find((row) => row.nodeId === selectedOutputId) || successfulOutputs[0] || null;
  const selectedLinks = selectedOutput
    ? model.links.filter((link) => !link.nodeId || link.nodeId === selectedOutput.nodeId)
    : model.links;
  const selectedFiles = selectedOutput
    ? model.finalFiles.filter((file) => !file.nodeId || file.nodeId === selectedOutput.nodeId)
    : model.finalFiles;
  const viewState = deriveRunViewState(model, activeTab);
  const resultsReady = isRunResultsReady(model, source !== undefined);
  const finalArtifactIds = getArtifactIds(model.finalFiles);
  const canSave = Boolean(canSaveToWorkspace && sessionId && resultsReady && finalArtifactIds.length);

  const saveToWorkspace = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    setSaveError('');
    setSavedNames([]);
    try {
      const data = await saveRunArtifacts(apiUrl(RUN_ARTIFACT_SAVE_PATH), {
        runId: model.runId,
        artifactIds: finalArtifactIds,
        sessionId,
      });
      setSavedNames(data.names);
    } catch (error) {
      setSaveError(error?.message || String(error));
    } finally {
      setSaving(false);
    }
  };

  const refresh = () => {
    if (!runId) return;
    const controller = new AbortController();
    loadResults(controller.signal, runEnded);
  };

  const openChildDetail = async (childRunId) => {
    if (!childRunId || childLoading) return;
    childRequestRef.current?.abort?.();
    const controller = new AbortController();
    childRequestRef.current = controller;
    const requestedRunId = runId;
    setChildLoading(true);
    try {
      const response = await fetch(apiUrl(`/runs/detail?id=${encodeURIComponent(childRunId)}`), { signal: controller.signal });
      const detail = await response.json();
      if (!response.ok) throw new Error(detail.error || t('result.childUnavailable'));
      if (childRequestRef.current !== controller || requestedRunId !== runId) return;
      setChildDetail(detail);
    } catch (error) {
      if (error?.name !== 'AbortError' && childRequestRef.current === controller && requestedRunId === runId) {
        setLoadError(error.message || String(error));
      }
    } finally {
      if (childRequestRef.current === controller) {
        childRequestRef.current = null;
        setChildLoading(false);
      }
    }
  };

  return (
    <aside className={`panel result-panel ${className}`.trim()} aria-label={t('result.panelLabel')}>
      <header className="result-panel-head">
        <div className="result-title-wrap">
          <span className={`result-status result-status-${viewState.status.tone}`}>{viewState.status.statusKey ? t(viewState.status.statusKey) : viewState.status.statusLabel}</span>
          <strong>{model.workflowName}</strong>
          {model.startedAt && <span className="result-run-time"><Clock3 size={12} />{formatTime(model.startedAt, locale)}</span>}
          {model.runId && model.usageTotal && (
            <span className="result-run-usage" title={t('usage.title')}>
              <UsageMeta usage={model.usageTotal} />
            </span>
          )}
        </div>
        <div className="result-head-actions">
          <button className="btn-icon" title={t('result.refresh')} aria-label={t('result.refresh')} onClick={refresh} disabled={!runId || loading}><RefreshCw size={15} className={loading ? 'result-spin' : ''} /></button>
          <button className="btn-icon" title={t('result.history')} aria-label={t('result.history')} onClick={onOpenHistory}><History size={15} /></button>
          {onClose && <button className="btn-icon" title={t('result.close')} aria-label={t('result.close')} onClick={onClose}><X size={16} /></button>}
        </div>
      </header>

      <div className="result-trigger">
        <label htmlFor="result-trigger-input">{t('result.triggerInput')}</label>
        <textarea id="result-trigger-input" rows={3} value={triggerInput} onChange={(event) => onTriggerChange?.(event.target.value)} placeholder={t('result.triggerPlaceholder')} readOnly={!onTriggerChange} />
      </div>

      <div className="result-tabs" role="tablist" aria-label={t('result.view')}>
        {RESULT_TABS.map((tab) => (
          <button type="button" role="tab" aria-selected={activeTab === tab.id} className={activeTab === tab.id ? 'result-tab-on' : ''}
            onClick={() => setActiveTab(tab.id)} key={tab.id}>
            {t(tab.labelKey)}{viewState.counts[tab.id] > 0 && <span>{viewState.counts[tab.id]}</span>}
          </button>
        ))}
      </div>

      <div className="result-panel-body">
        {loadError && <div className="result-load-error"><span>{loadError}</span><button onClick={refresh}>{t('result.retry')}</button></div>}
        {activeTab === 'result' && model.runId && !resultsReady && !loadError && (
          <div className="result-loading"><LoaderCircle className="result-spin" size={17} />{t('result.organizing')}</div>
        )}
        {!loading && !model.runId && <p className="result-empty result-empty-run">{t('result.noRun')}</p>}

        {model.runId && activeTab === 'result' && resultsReady && (
          <>
            <div className="result-save-area">
              <button className="btn btn-primary result-save-button" onClick={saveToWorkspace} disabled={!canSave || saving}>
                {saving ? <LoaderCircle size={15} className="result-spin" /> : savedNames.length ? <Check size={15} /> : <FolderDown size={15} />}
                {saving ? t('result.saving') : savedNames.length ? t('result.savedToWorkspace') : t('result.save')}
              </button>
              {!canSaveToWorkspace && <span className="result-save-hint">{t('result.connectWorkspace')}</span>}
              {canSaveToWorkspace && !sessionId && <span className="result-save-hint">{t('result.workspaceNotReady')}</span>}
              {canSaveToWorkspace && finalArtifactIds.length === 0 && <span className="result-save-hint">{t('result.noFiles')}</span>}
              {savedNames.length > 0 && <span className="result-save-success">{t('result.savedFiles', { count: savedNames.length })}</span>}
              {saveError && <span className="result-save-error">{saveError}</span>}
              {viewState.canExport && (
                <a className="result-zip-action" href={apiUrl(`/runs/export?id=${encodeURIComponent(model.runId)}`)} download>
                  <Archive size={13} />{t('result.downloadZip')}
                </a>
              )}
            </div>
            {model.summary && <p className="result-summary">{model.summary}</p>}
            {Array.isArray(runDetail?.children) && runDetail.children.length > 0 && (
              <div className="result-child-runs" aria-label={t('result.childRuns')}>
                <div className="result-child-head"><strong>{t('result.childRuns')}</strong><span>{t('result.childRunCount', { count: runDetail.children.length })}</span></div>
                {runDetail.children.map((child) => (
                  <button type="button" className="result-child-row" key={child.runId} onClick={() => openChildDetail(child.runId)}>
                    <span>{child.workflowName || child.workflowId || child.runId}</span>
                    <span className={`result-step-pill result-step-pill-${child.status === 'success' ? 'success' : child.status === 'running' ? 'running' : 'danger'}`}>{child.status}</span>
                    <ChevronRight size={13} />
                  </button>
                ))}
              </div>
            )}
            {childDetail && (
              <div className="result-child-detail">
                <div className="result-child-head"><strong>{t('result.childDetails')}</strong><button type="button" className="btn btn-sm" onClick={() => setChildDetail(null)}>{t('result.returnToParent')}</button></div>
                <p>{childDetail.workflowName || childDetail.workflowId || childDetail.runId} · {childDetail.status}</p>
                <p className="result-child-meta">runId: {childDetail.runId} · {t('result.parentNode', { node: childDetail.parentNodeId || t('result.unknown') })}</p>
                {childDetail.children?.length > 0 && <p className="result-child-meta">{t('result.childRunLevel', { count: childDetail.children.length })}</p>}
                <pre className="result-child-output">{Object.values(childDetail.outputs || {}).filter(Boolean).at(-1) || t('result.noOutput')}</pre>
              </div>
            )}
            {model.input && <details className="result-input-snapshot"><summary>{t('result.runInputSnapshot')}</summary><pre>{model.input}</pre></details>}
            {successfulOutputs.length > 1 && (
              <div className="result-output-selector" role="tablist" aria-label={t('result.finalOutputNode')}>
                {successfulOutputs.map((row) => (
                  <button key={row.nodeId} role="tab" aria-selected={selectedOutput?.nodeId === row.nodeId}
                    className={selectedOutput?.nodeId === row.nodeId ? 'result-output-on' : ''}
                    onClick={() => setSelectedOutputId(row.nodeId)}>{row.nodeLabel}</button>
                ))}
              </div>
            )}
            {model.finalStatus === 'partial' && <button className="result-partial" onClick={() => setActiveTab('issues')}>{t('result.partialOutput')}</button>}
            <ResultViewer
              coreText={selectedOutput?.output || ''}
              files={selectedFiles}
              links={selectedLinks}
              artifacts={model.files}
              legacyInferred={Boolean(selectedOutput?.legacyInferred)}
              emptyText={t('result.noSuccessfulOutput')}
            />
            <ProcessArtifacts results={model.processResults} files={model.processFiles} artifacts={model.files} />
          </>
        )}
        {model.runId && activeTab === 'process' && (
          <ProcessView
            events={model.nodeTimeline}
            runId={model.runId}
            onFocusNode={onFocusNode}
            onOpenNodeDetail={onOpenNodeDetail}
            runStartedAt={viewState.isRunning ? model.startedAt : undefined}
            runDurationMs={viewState.isRunning ? undefined : model.durationMs}
            running={viewState.isRunning}
          />
        )}
        {model.runId && activeTab === 'issues' && <IssuesView issues={model.issues} runId={model.runId} onFocusNode={onFocusNode} onOpenNodeDetail={onOpenNodeDetail} />}
      </div>
    </aside>
  );
}

export default ResultPanel;
