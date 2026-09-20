const URL_PATTERN = /https?:\/\/[^\s<>()\[\]"']+/gi;

export const RUN_ARTIFACT_SAVE_PATH = '/run-artifacts/save';

function i18nError(i18nKey, i18nVariables = {}) {
  const error = new Error(i18nKey);
  error.i18nKey = i18nKey;
  error.i18nVariables = i18nVariables;
  return error;
}

const asArray = (value) => value == null ? [] : (Array.isArray(value) ? value : [value]);
const asObject = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const first = (...values) => values.find((value) => value !== undefined && value !== null && value !== '');

function textOf(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object' && 'value' in value) return textOf(value.value);
  try { return JSON.stringify(value, null, 2); } catch { return String(value); }
}

function uniqueBy(items, keyOf) {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyOf(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function basename(value) {
  return String(value || '').split(/[\\/]/).filter(Boolean).at(-1) || String(value || '');
}

function graphNodes(runDetail) {
  return asArray(runDetail?.graph?.nodes);
}

function nodeMap(runDetail) {
  return new Map(graphNodes(runDetail).map((node) => [node.id, node]));
}

function nodeType(node) {
  return node?.type || node?.data?.nodeType || null;
}

function isRuntimeNode(value) {
  return first(value?.nodeType, value?.type, nodeType(value)) !== 'note';
}

function stableNodeOrder(runDetail) {
  const nodes = graphNodes(runDetail).filter(isRuntimeNode);
  if (!nodes.length) {
    const ids = [...new Set([
      ...asArray(runDetail?.nodeOrder),
      ...Object.keys(asObject(runDetail?.nodeStates)),
      ...Object.keys(asObject(runDetail?.outputs)),
    ])];
    return ids.map((id) => ({ id, type: null, data: { label: id } }));
  }
  const index = new Map(nodes.map((node, position) => [node.id, position]));
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const incoming = new Map(nodes.map((node) => [node.id, 0]));
  const outgoing = new Map(nodes.map((node) => [node.id, []]));
  for (const edge of asArray(runDetail?.graph?.edges)) {
    if (!byId.has(edge.source) || !byId.has(edge.target)) continue;
    outgoing.get(edge.source).push(edge.target);
    incoming.set(edge.target, incoming.get(edge.target) + 1);
  }
  const ready = nodes.filter((node) => incoming.get(node.id) === 0).sort((a, b) => index.get(a.id) - index.get(b.id));
  const ordered = [];
  while (ready.length) {
    const node = ready.shift();
    ordered.push(node);
    for (const target of outgoing.get(node.id)) {
      incoming.set(target, incoming.get(target) - 1);
      if (incoming.get(target) === 0) {
        ready.push(byId.get(target));
        ready.sort((a, b) => index.get(a.id) - index.get(b.id));
      }
    }
  }
  if (ordered.length !== nodes.length) {
    const seen = new Set(ordered.map((node) => node.id));
    ordered.push(...nodes.filter((node) => !seen.has(node.id)));
  }
  return ordered;
}

function normalizeFile(file, fallback = {}) {
  if (typeof file === 'string') {
    return { name: basename(file), path: file, ...fallback };
  }
  const value = asObject(file);
  const path = first(value.path, value.relativePath, value.file, value.filename, value.name, value.key);
  if (!path) return null;
  return {
    id: first(value.id, value.artifactId),
    name: basename(first(value.name, value.filename, path)),
    path: String(path),
    url: first(value.url, value.href, value.downloadUrl),
    downloadUrl: first(value.downloadUrl, value.url, value.href),
    previewUrl: value.previewUrl,
    nodeId: first(value.nodeId, fallback.nodeId),
    nodeLabel: first(value.nodeLabel, value.node, fallback.nodeLabel),
    size: value.size,
    mimeType: first(value.mimeType, value.mediaType, value.contentType),
    finishedAt: first(value.finishedAt, fallback.finishedAt), // 文稿墙新卡高亮
  };
}

export function getArtifactIds(files = []) {
  return [...new Set(asArray(files).map((file) => (
    typeof file === 'string' || typeof file === 'number' ? file : first(file?.id, file?.artifactId)
  )).filter(Boolean).map(String))];
}

export function buildArtifactSavePayload({ runId, artifactIds, files, sessionId } = {}) {
  return {
    runId: String(runId || ''),
    artifactIds: getArtifactIds(artifactIds || files),
    sessionId: String(sessionId || ''),
  };
}

export async function saveRunArtifacts(url, payload, fetchImpl = globalThis.fetch) {
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildArtifactSavePayload(payload)),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok !== true) throw (data.error ? new Error(data.error) : i18nError('result.saveArtifactsFailed', { status: response.status }));
  return {
    ...data,
    savedCount: Number(data.savedCount) || 0,
    names: savedArtifactNames(data.names),
  };
}

export function savedArtifactNames(names = []) {
  return [...new Set(asArray(names).map(basename).filter(Boolean))];
}

export function isRunResultsReady(model, hasLoadedResults = true) {
  if (!hasLoadedResults || !model?.runId) return false;
  return !['idle', 'queued', 'pending', 'running', 'waiting'].includes(model.status);
}

export async function loadRunResults(url, { signal, waitUntilReady = false } = {}, fetchImpl = globalThis.fetch) {
  const attempts = waitUntilReady ? 32 : 8;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, Math.min(250 * attempt, 1000)));
    const response = await fetchImpl(url, { signal });
    const data = await response.json().catch(() => ({}));
    if (response.ok && (!waitUntilReady || isRunResultsReady(data, true))) return data;
    if (response.ok || response.status === 404) {
      if (attempt < attempts - 1) continue;
      if (data.error) throw new Error(data.error);
      throw i18nError(waitUntilReady ? 'result.organizingTimeout' : 'result.runRecordMissing');
    }
    throw (data.error ? new Error(data.error) : i18nError('result.loadFailed', { status: response.status }));
  }
  throw i18nError('result.loadFailed', { status: 0 });
}

function normalizeLink(link) {
  if (typeof link === 'string') return { url: link, label: link };
  const value = asObject(link);
  const url = first(value.url, value.href, value.link);
  return url ? {
    url: String(url),
    label: first(value.label, value.title, value.name, url),
    nodeId: value.nodeId,
    nodeLabel: value.nodeLabel,
  } : null;
}

// 技术输出文件（调试/错误转储）不进「过程文件」展示列表；
// 仍保留在 files/产物索引里——正文行内引用可点、ZIP 导出完整。
const TECHNICAL_ARTIFACT_PATTERNS = [/^fetch_err[^/]*\.json$/i];

export function isTechnicalArtifact(file) {
  const name = String(file?.name || file?.path || '').split('/').filter(Boolean).at(-1) || '';
  return TECHNICAL_ARTIFACT_PATTERNS.some((pattern) => pattern.test(name));
}

function normalizeResultRow(row, nodes, runDetail) {
  const value = asObject(row);
  const nodeId = first(value.nodeId, value.id);
  const node = nodes.get(nodeId);
  const state = asObject(runDetail?.nodeStates?.[nodeId]);
  return {
    nodeId,
    nodeLabel: first(value.nodeLabel, value.label, node?.data?.label, nodeId),
    nodeType: first(value.nodeType, value.type, nodeType(node)),
    status: first(value.status, state.status, 'pending'),
    output: value.output == null ? null : textOf(value.output),
    structuredOutput: first(value.structuredOutput, runDetail?.structuredOutputs?.[nodeId], null),
    error: first(value.error, state.error, state.toleratedError),
    durationMs: first(value.durationMs, state.durationMs),
    startedAt: first(value.startedAt, state.startedAt),
    legacyInferred: Boolean(value.legacyInferred),
    usage: first(value.usage, state.usage) || null,
    model: first(value.model, state.model) || null,
  };
}

function fallbackRows(runDetail) {
  const nodes = nodeMap(runDetail);
  const outputs = asObject(runDetail.outputs);
  return stableNodeOrder(runDetail).map((node) => normalizeResultRow({
    nodeId: node.id,
    nodeType: nodeType(node),
    status: runDetail.nodeStates?.[node.id]?.status,
    output: Object.prototype.hasOwnProperty.call(outputs, node.id) ? outputs[node.id] : null,
  }, nodes, runDetail));
}

function timelineText(row) {
  if (row.error) return { message: row.error };
  if (row.status === 'success') return { messageKey: 'result.nodeCompleted' };
  if (row.status === 'running') return { messageKey: 'result.nodeRunning' };
  if (row.status === 'queued' || row.status === 'pending') return { messageKey: 'result.nodeQueued' };
  if (row.status === 'waiting') return { messageKey: 'result.nodeWaiting' };
  if (row.status === 'skipped') return { messageKey: 'result.nodeSkipped' };
  if (row.status === 'canceled') return { messageKey: 'result.nodeCanceled' };
  return { messageKey: 'result.nodeStatus', messageVariables: { status: row.status } };
}

// usage 四元组求和：输入列是未命中缓存部分（总输入读取 = input + cacheRead，
// cache 单价与全价不同，不得直接乘单价算钱）；无任一 usage 时返回 null（≠ 0）
export function sumUsageTotal(rowsOrTotal) {
  if (!Array.isArray(rowsOrTotal)) {
    const total = asObject(rowsOrTotal);
    return total.inputTokens !== undefined ? {
      inputTokens: Number(total.inputTokens) || 0,
      outputTokens: Number(total.outputTokens) || 0,
      cacheReadTokens: Number(total.cacheReadTokens) || 0,
      cacheWriteTokens: Number(total.cacheWriteTokens) || 0,
    } : null;
  }
  let has = false;
  const total = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
  for (const row of rowsOrTotal) {
    const u = asObject(row?.usage ?? row);
    if (u.inputTokens === undefined) continue;
    has = true;
    total.inputTokens += Number(u.inputTokens) || 0;
    total.outputTokens += Number(u.outputTokens) || 0;
    total.cacheReadTokens += Number(u.cacheReadTokens) || 0;
    total.cacheWriteTokens += Number(u.cacheWriteTokens) || 0;
  }
  return has ? total : null;
}

// 面向普通用户的耗时文案：毫秒不直接暴露，统一换算成秒/分
export function formatDuration(durationMs) {
  if (durationMs == null || Number.isNaN(Number(durationMs))) return null;
  const ms = Number(durationMs);
  if (ms < 1000) return { key: 'duration.lessThanSecond' };
  const seconds = ms / 1000;
  if (seconds < 60) return seconds < 10
    ? { key: 'duration.secondsDecimal', variables: { count: seconds.toFixed(1) } }
    : { key: 'duration.seconds', variables: { count: Math.round(seconds) } };
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return rest
    ? { key: 'duration.minutesSeconds', variables: { minutes, seconds: rest } }
    : { key: 'duration.minutes', variables: { minutes } };
}

//  HH:MM:SS 时钟格式，用于「开始时间」
export function formatClock(value, locale = 'en') {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(locale, { hour12: false });
}

export function normalizeRunEvent(event, index = 0) {
  const value = asObject(event);
  const status = first(value.status, value.state, value.level === 'error' ? 'error' : undefined, 'info');
  const kind = first(value.kind, value.type, value.event, value.nodeId ? 'node' : 'run');
  return {
    id: first(value.id, `${value.t || value.timestamp || 'event'}-${index}`),
    time: first(value.t, value.time, value.timestamp, value.createdAt),
    kind,
    status,
    nodeId: first(value.nodeId, value.node?.id),
    nodeLabel: first(value.nodeLabel, value.label, value.node?.label),
    startedAt: value.startedAt,
    durationMs: value.durationMs,
    text: textOf(first(value.text, value.message, value.error, value.detail, value.summary)),
    meta: first(value.meta, value.durationMs != null ? formatDuration(value.durationMs) : undefined),
    raw: event,
  };
}

export function getRunId(runDetail, status, results) {
  return first(
    results?.runId, results?.id, results?.run?.runId, results?.run?.id,
    runDetail?.runId, runDetail?.id, status?.runId, status?.id,
  ) || null;
}

export function adaptRunResults(payload, context = {}) {
  const source = asObject(payload);
  const runDetail = asObject(context.runDetail || source.runDetail || source.run || source.detail);
  const result = asObject(source.result || source.results);
  const nodes = nodeMap(runDetail);
  const runId = getRunId(runDetail, context.status, source);
  const fallback = fallbackRows(runDetail);

  const explicitRows = asArray(source.results).map((row) => normalizeResultRow(row, nodes, runDetail)).filter(isRuntimeNode);
  const baseRows = explicitRows.length ? explicitRows : fallback;
  const outputResults = asArray(source.outputResults).length
    ? source.outputResults.map((row) => normalizeResultRow(row, nodes, runDetail)).filter(isRuntimeNode)
    : baseRows.filter((row) => row.nodeType === 'output');
  let effectiveOutputs = outputResults;
  let finalStatus = source.finalStatus;
  if (!effectiveOutputs.length) {
    const inferred = [...baseRows].reverse().find((row) => row.status === 'success' && row.output);
    if (inferred) effectiveOutputs = [{ ...inferred, legacyInferred: true }];
    finalStatus ||= inferred ? 'legacy-inferred' : 'unavailable';
  } else if (!finalStatus) {
    const successful = effectiveOutputs.filter((row) => row.status === 'success' && row.output);
    finalStatus = successful.length === effectiveOutputs.length ? 'available' : successful.length ? 'partial' : 'unavailable';
  }
  const processResults = asArray(source.processResults).length
    ? source.processResults.map((row) => normalizeResultRow(row, nodes, runDetail)).filter(isRuntimeNode)
    : baseRows.filter((row) => row.nodeType !== 'output');

  const explicitFiles = [...asArray(source.files), ...asArray(source.artifacts), ...asArray(result.files), ...asArray(result.artifacts)]
    .map((file) => normalizeFile(file)).filter(Boolean);
  const stateFiles = Object.entries(asObject(runDetail.nodeStates)).flatMap(([nodeId, state]) => {
    const nodeLabel = nodes.get(nodeId)?.data?.label || nodeId;
    return asArray(state?.artifacts).map((file) => normalizeFile(file, {
      nodeId, nodeLabel, finishedAt: runDetail.finishedAt || null, // 新卡高亮：节点产物继承运行完成时间
    })).filter(Boolean);
  });
  const allFiles = uniqueBy([...explicitFiles, ...stateFiles], (file) => `${file.nodeId || file.nodeLabel || ''}:${file.path}`);
  const explicitFinalFiles = asArray(source.finalArtifacts).map((file) => normalizeFile(file)).filter(Boolean);
  const explicitProcessFiles = asArray(source.processArtifacts).map((file) => normalizeFile(file)).filter(Boolean);
  const outputIds = new Set(effectiveOutputs.map((row) => row.nodeId));
  const finalFiles = explicitFinalFiles.length ? explicitFinalFiles : allFiles.filter((file) => outputIds.has(file.nodeId));
  const processFiles = (explicitProcessFiles.length ? explicitProcessFiles : allFiles.filter((file) => !outputIds.has(file.nodeId)))
    .filter((file) => !isTechnicalArtifact(file));

  const selectedOutput = effectiveOutputs.find((row) => row.status === 'success' && row.output) || null;
  const coreText = textOf(first(source.coreText, source.primaryText, source.primaryResult?.output, selectedOutput?.output));
  const extractedLinks = (coreText.match(URL_PATTERN) || []).map(normalizeLink).filter(Boolean);
  const links = uniqueBy([
    ...asArray(source.links).map(normalizeLink),
    ...asArray(result.links).map(normalizeLink),
    ...extractedLinks,
  ].filter(Boolean), (link) => link.url);

  const liveByNode = new Map(asArray(context.events).filter((event) => event?.nodeId).map((event) => [event.nodeId, normalizeRunEvent(event)]));
  const sourceTimeline = asArray(source.nodeTimeline).length
    ? source.nodeTimeline.map((row) => normalizeResultRow(row, nodes, runDetail)).filter(isRuntimeNode)
    : fallback;
  const nodeTimeline = sourceTimeline.map((row) => {
    const live = liveByNode.get(row.nodeId);
    // live 事件是此刻真实状态（detail 是启动快照/竞态残影）；startedAt/durationMs 供过程 tab 显示开始时间与已运行时长
    const merged = live
      ? {
        ...row,
        status: live.status || row.status,
        error: live.text || row.error,
        startedAt: live.startedAt || row.startedAt,
        durationMs: live.status === 'running' ? undefined : first(live.durationMs, row.durationMs),
      }
      : row;
    const timeline = timelineText(merged);
    return {
      ...merged,
      id: `node:${row.nodeId}`,
      kind: 'node',
      text: timeline.message || '',
      textKey: timeline.messageKey,
      textVariables: timeline.messageVariables,
      meta: merged.durationMs != null ? formatDuration(merged.durationMs) : undefined,
    };
  });
  const runEvents = [
    ...asArray(context.events), ...asArray(source.events), ...asArray(source.process),
    ...asArray(result.events), ...asArray(result.process),
  ].filter((event) => !event?.nodeId).map(normalizeRunEvent);

  const explicitIssues = [...asArray(source.issues), ...asArray(source.problems), ...asArray(source.errors), ...asArray(result.issues), ...asArray(result.problems)];
  const stateIssues = Object.entries(asObject(runDetail.nodeStates))
    .filter(([, state]) => state?.error || ['error', 'canceled'].includes(state?.status))
    .map(([nodeId, state]) => ({
      nodeId,
      nodeLabel: nodes.get(nodeId)?.data?.label || nodeId,
      status: state.status || 'error',
      ...(state.error
        ? { message: state.error }
        : { messageKey: state.status === 'canceled' ? 'result.nodeCanceled' : 'result.nodeFailed' }),
    }));
  const issues = [...explicitIssues, ...stateIssues].map((issue, index) => {
    if (typeof issue === 'string') return { id: `issue-${index}`, status: 'error', message: issue };
    const value = asObject(issue);
    return {
      id: first(value.id, `issue-${index}`),
      status: first(value.status, value.level, 'error'),
      nodeId: value.nodeId,
      nodeLabel: first(value.nodeLabel, value.label),
      ...(value.messageKey
        ? { messageKey: value.messageKey, messageVariables: value.messageVariables }
        : { message: textOf(first(value.message, value.text, value.error, value.detail, value)) }),
    };
  });

  const workflowName = first(source.workflowName, source.run?.workflowName, runDetail.workflowName);
  return {
    runId,
    status: first(source.status, source.run?.status, runDetail.status, context.status?.last, context.status?.status, context.status?.running ? 'running' : undefined, 'idle'),
    workflowName: workflowName || '',
    workflowNameKey: workflowName ? undefined : 'result.currentRun',
    startedAt: first(source.startedAt, source.run?.startedAt, runDetail.startedAt),
    durationMs: first(source.durationMs, source.run?.durationMs, runDetail.durationMs),
    summary: textOf(first(source.summary, result.summary, source.description, result.description)),
    finalStatus,
    // 运行级用量合计：后端 usageTotal 优先，旧响应无此字段时从节点行兜底求和；
    // 全部节点都无 usage 时为 null（渲染「无记录」，不是 0）
    usageTotal: sumUsageTotal(result.usageTotal || source.usageTotal) || sumUsageTotal(nodeTimeline) || null,
    outputResults: effectiveOutputs,
    processResults,
    coreText,
    finalFiles,
    processFiles,
    files: allFiles,
    links,
    input: textOf(first(source.input, source.inputs?.triggerInput, result.input, result.inputs?.triggerInput, runDetail.triggerInput, context.triggerInput)),
    nodeTimeline,
    runEvents,
    events: nodeTimeline,
    issues,
    raw: payload,
  };
}
