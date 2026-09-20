import { apiUrl } from './api.js';

export const VARIABLE_MIME = 'application/x-workflow-template-variable';
export const LEGACY_VARIABLE_MIMES = ['application/x-workflow-variable'];

const BUILTINS = [
  {
    id: 'builtin:$trigger',
    labelKey: 'variables.builtin.trigger',
    token: '$trigger',
    type: 'string',
    descriptionKey: 'variables.builtin.triggerHint',
    source: 'builtin',
  },
  {
    id: 'builtin:$upstream',
    labelKey: 'variables.builtin.upstream',
    token: '$upstream',
    type: 'string',
    descriptionKey: 'variables.builtin.upstreamHint',
    source: 'builtin',
  },
];

export function tokenForNode(nodeId, path = []) {
  const root = `node[${JSON.stringify(String(nodeId))}].data`;
  return [root, ...path.map(pathSegment)].join('');
}

function pathSegment(part) {
  if (typeof part === 'number' && Number.isInteger(part) && part >= 0) return `[${part}]`;
  const value = String(part);
  return /^[A-Za-z_$][\w$]*$/.test(value) ? `.${value}` : `[${JSON.stringify(value)}]`;
}

export function canonicalToken(value) {
  return String(value || '').trim().replace(/^\{\{\s*/, '').replace(/\s*\}\}$/, '').trim();
}

export function wrapToken(token) {
  return `{{${canonicalToken(token)}}}`;
}

export function normalizeVariableItem(raw, parent = {}) {
  const token = canonicalToken(raw.token || raw.canonical || raw.expression || raw.path || parent.token || '');
  const rawChildren = raw.children || raw.fields || raw.properties || [];
  const children = Array.isArray(rawChildren)
    ? rawChildren
    : Object.entries(rawChildren).map(([name, value]) => ({ name, ...(value || {}) }));
  return {
    id: raw.id || token || `${parent.id || 'variable'}:${raw.name || raw.label || 'field'}`,
    label: raw.label || raw.name || token || '',
    labelKey: raw.labelKey,
    token,
    type: raw.type || raw.valueType || inferType(raw.value ?? raw.recentValue),
    description: raw.description || raw.hint || '',
    descriptionKey: raw.descriptionKey,
    descriptionVariables: raw.descriptionVariables,
    recentValue: raw.recentValue ?? raw.lastValue ?? raw.value,
    hasValue: raw.hasValue ?? raw.available ?? (raw.recentValue ?? raw.lastValue ?? raw.value) !== undefined,
    source: raw.source || parent.source || 'node',
    nodeId: raw.nodeId || parent.nodeId,
    children: children.map((child) => normalizeVariableItem(child, {
      id: raw.id || parent.id,
      token,
      source: raw.source || parent.source,
      nodeId: raw.nodeId || parent.nodeId,
    })),
  };
}

export function normalizeVariableSchema(payload) {
  const source = payload?.variables || payload?.groups || payload?.items || payload?.schema || [];
  const items = Array.isArray(source)
    ? source.map((item) => normalizeVariableItem(item))
    : Object.entries(source || {}).map(([label, value]) => normalizeVariableItem({ label, ...value }));
  return {
    items,
    fallback: Boolean(payload?.fallback),
    message: payload?.message || payload?.note || '',
  };
}

export async function describeVariables(context, signal) {
  const payload = {
    graph: context.graph,
    targetNodeId: context.targetNodeId,
    runId: context.runId || undefined,
    workflowId: context.workflowId || undefined,
    outputs: context.outputs,
    structuredOutputs: context.structuredOutputs,
    nodeStates: context.nodeStates,
    triggerInput: context.triggerInput,
    runInputs: context.runInputs,
    workflowVariables: context.workflowVariables,
    inputSchema: context.inputSchema,
  };
  try {
    const res = await fetch(apiUrl('/variables/describe'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return normalizeVariableSchema(await res.json());
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    return buildFallbackSchema(context, error);
  }
}

export async function validateTemplate(template, context, signal) {
  const body = {
    template,
    graph: context.graph,
    targetNodeId: context.targetNodeId,
    runId: context.runId || undefined,
    workflowId: context.workflowId || undefined,
    triggerInput: context.triggerInput,
    runInputs: context.runInputs,
    workflowVariables: context.workflowVariables,
    inputSchema: context.inputSchema,
  };
  try {
    const res = await fetch(apiUrl('/template/validate'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return normalizeValidation(data);
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    return validateTemplateLocally(template, context.variables || []);
  }
}

export async function renderTemplatePreview(template, context, signal) {
  const body = {
    template,
    graph: context.graph,
    targetNodeId: context.targetNodeId,
    nodeId: context.targetNodeId,
    runId: context.runId || undefined,
    workflowId: context.workflowId || undefined,
    outputs: context.outputs,
    structuredOutputs: context.structuredOutputs,
    nodeStates: context.nodeStates,
    triggerInput: context.triggerInput,
    runInputs: context.runInputs,
    workflowVariables: context.workflowVariables,
    inputSchema: context.inputSchema,
    implicitUpstream: context.implicitUpstream,
  };
  const query = context.runId ? `?run=${encodeURIComponent(context.runId)}` : '';
  const res = await fetch(apiUrl(`/template/render${query}`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) throw new Error(data.error || `HTTP ${res.status}`);
  return {
    text: data.text ?? data.rendered ?? '',
    missing: data.missing || [],
    note: data.note || '',
  };
}

export function flattenVariables(items) {
  const flat = [];
  const visit = (item) => {
    if (item.token) flat.push(item);
    item.children?.forEach(visit);
  };
  items.forEach(visit);
  return flat;
}

export function buildFallbackSchema({ graph, targetNodeId, upstreamNodes = [], upstreamPreviews = {} }, error) {
  const graphNodes = new Map((graph?.nodes || []).map((node) => [node.id, node]));
  const incomingIds = new Set((graph?.edges || []).filter((edge) => edge.target === targetNodeId).map((edge) => edge.source));
  const sources = upstreamNodes.length
    ? upstreamNodes
    : [...incomingIds].map((id) => ({ id, label: graphNodes.get(id)?.data?.label || id }));
  const nodeItems = sources.map((source) => {
    const rawValue = upstreamPreviews[source.id] ?? upstreamPreviews[source.label];
    const parsedValue = parseRecentValue(rawValue);
    const baseToken = tokenForNode(source.id);
    return normalizeVariableItem({
      id: `node:${source.id}`,
      nodeId: source.id,
      label: source.label || source.id,
      token: '',
      type: inferType(parsedValue ?? rawValue),
      recentValue: rawValue,
      hasValue: rawValue !== undefined && rawValue !== '',
      descriptionKey: 'variables.nodeOutputDescription',
      descriptionVariables: { node: source.id },
      source: 'node',
      children: buildValueFields(parsedValue, baseToken, source.id, 0),
    });
  });
  const builtinItems = BUILTINS.map((item) => normalizeVariableItem(item));
  return {
    items: [
      { id: 'group:nodes', labelKey: 'variables.group.upstreamNodes', source: 'group', children: nodeItems },
      { id: 'group:builtin', labelKey: 'variables.group.runtimeContext', source: 'group', children: builtinItems },
    ],
    fallback: true,
    messageKey: error ? 'variables.fallbackMessage' : '',
    messageVariables: error ? { error: error.message || String(error) } : {},
  };
}

function buildValueFields(value, baseToken, nodeId, depth = 0, state = { count: 0, maxDepth: 20, maxItems: 400 }) {
  if (depth >= state.maxDepth || state.count >= state.maxItems || value == null || typeof value !== 'object') return [];
  const entries = Array.isArray(value)
    ? value.slice(0, 24).map((item, index) => [index, item])
    : Object.entries(value).slice(0, 80);
  const children = [];
  for (const [key, child] of entries) {
    if (state.count >= state.maxItems) break;
    state.count += 1;
    const token = `${baseToken}${pathSegment(key)}`;
    children.push({
      id: `${nodeId}:${token}`,
      nodeId,
      label: String(key),
      token,
      type: inferType(child),
      recentValue: child,
      hasValue: true,
      source: 'node',
      children: buildValueFields(child, token, nodeId, depth + 1, state),
    });
  }
  return children;
}

function parseRecentValue(value) {
  if (value == null || typeof value !== 'string') return value;
  const text = value.trim();
  if (!text) return undefined;
  try { return JSON.parse(text); } catch { /* continue */ }
  const start = Math.min(...[text.indexOf('{'), text.indexOf('[')].filter((index) => index >= 0));
  if (!Number.isFinite(start)) return undefined;
  try { return JSON.parse(text.slice(start)); } catch { return undefined; }
}

function normalizeValidation(data) {
  const issues = data.issues || data.errors || [];
  return {
    ok: data.ok ?? issues.length === 0,
    issues: issues.map((issue) => {
      const from = issue.from ?? issue.start ?? 0;
      const token = canonicalToken(issue.token || issue.expression || '');
      return {
        from,
        to: issue.to ?? issue.end ?? (token ? from + wrapToken(token).length : from + 1),
        severity: ['warn', 'warning'].includes(issue.severity || issue.level) ? 'warning' : (issue.severity || issue.level || 'error'),
        message: issue.message || issue.error || String(issue),
        token,
      };
    }),
  };
}

export function validateTemplateLocally(template, variables) {
  const known = new Set(flattenVariables(variables).map((item) => item.token));
  const issues = [];
  const text = String(template || '');
  const re = /\{\{\s*([^{}]+?)\s*\}\}/g;
  let match;
  while ((match = re.exec(text)) !== null) {
    const token = match[1].trim();
    if (!isKnownToken(token, known)) {
      issues.push({
        from: match.index,
        to: match.index + match[0].length,
        severity: 'error',
        messageKey: 'variables.missingToken',
        messageVariables: { token },
        token,
      });
    }
  }
  const opens = (text.match(/\{\{/g) || []).length;
  const closes = (text.match(/\}\}/g) || []).length;
  if (opens !== closes) issues.push({
    from: Math.max(0, text.lastIndexOf('{{')),
    to: text.length,
    severity: 'error',
    messageKey: 'variables.unclosedExpression',
  });
  return { ok: issues.length === 0, issues };
}

function isKnownToken(token, known) {
  if (known.has(token)) return true;
  if (token === '$trigger' || token === '$upstream') return true;
  const root = token.match(/^node\[(["'])(.*?)\1\]\.data/);
  if (root && [...known].some((item) => item.startsWith(`node[${JSON.stringify(root[2])}].data`))) return true;
  return [...known].some((item) => isScopedToken(item) && isTokenDescendant(token, item));
}

function isScopedToken(token) {
  return /^(?:vars\.(?:global|workflow)|inputs)\[/.test(token);
}

function isTokenDescendant(token, parent) {
  return Boolean(parent && token.startsWith(parent) && ['.', '['].includes(token[parent.length]));
}

export function inferType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (value === undefined) return 'unknown';
  return typeof value === 'object' ? 'object' : typeof value;
}
