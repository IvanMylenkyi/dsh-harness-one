export const RESULT_TABS = Object.freeze([
  { id: 'process', labelKey: 'run.process' },
  { id: 'result', labelKey: 'run.results' },
  { id: 'issues', labelKey: 'run.issues' },
]);

const STATUS_META = {
  idle: { statusKey: 'run.notRun', tone: 'neutral' },
  queued: { statusKey: 'status.queued', tone: 'neutral' },
  running: { statusKey: 'status.running', tone: 'running' },
  waiting: { statusKey: 'status.waiting', tone: 'waiting' },
  success: { statusKey: 'status.success', tone: 'success' },
  error: { statusKey: 'run.failed', tone: 'danger' },
  canceled: { statusKey: 'status.canceled', tone: 'neutral' },
  interrupted: { statusKey: 'status.interrupted', tone: 'danger' },
};

export function getRunStatusMeta(status) {
  return STATUS_META[status] || { statusKey: null, statusLabel: status || '', tone: 'neutral' };
}

export function deriveRunViewState(model, activeTab = 'process') {
  const safe = model || {};
  const successfulOutputs = (safe.outputResults || []).filter((row) => row.status === 'success' && row.output);
  const counts = {
    result: successfulOutputs.length + (safe.finalFiles?.length || 0) + (safe.links?.length || 0),
    process: safe.nodeTimeline?.length || 0,
    issues: safe.issues?.length || 0,
  };
  const normalizedTab = RESULT_TABS.some((tab) => tab.id === activeTab) ? activeTab : 'process';
  return {
    activeTab: normalizedTab,
    counts,
    hasRun: Boolean(safe.runId),
    canExport: Boolean(safe.runId && (counts.result || safe.processFiles?.length || safe.processResults?.length)),
    isRunning: safe.status === 'running',
    isEmpty: counts.result + counts.process + counts.issues === 0,
    status: getRunStatusMeta(safe.status),
  };
}
