import { useEffect, useMemo, useRef, useState } from 'react';
import { autocompletion, startCompletion } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { Annotation, EditorState, StateEffect, StateField } from '@codemirror/state';
import { json } from '@codemirror/lang-json';
import { Decoration, EditorView, MatchDecorator, ViewPlugin, keymap, placeholder as cmPlaceholder } from '@codemirror/view';
import { Braces, ChevronRight, Copy, Crosshair, Database, GripVertical, Play, Search, X } from 'lucide-react';
import {
  LEGACY_VARIABLE_MIMES,
  VARIABLE_MIME,
  canonicalToken,
  flattenVariables,
  renderTemplatePreview,
  validateTemplate,
  wrapToken,
} from './variables.js';
import { useI18n } from './i18n/index.js';

const externalSync = Annotation.define();
const setDiagnostics = StateEffect.define();
const diagnosticField = StateField.define({
  create: () => Decoration.none,
  update(value, transaction) {
    for (const effect of transaction.effects) {
      if (!effect.is(setDiagnostics)) continue;
      const marks = effect.value
        .filter((issue) => issue.to > issue.from)
        .map((issue) => Decoration.mark({
          class: issue.severity === 'warning' ? 'cm-template-warning' : 'cm-template-error',
          attributes: { title: issue.message },
        }).range(issue.from, issue.to));
      return Decoration.set(marks, true);
    }
    return value.map(transaction.changes);
  },
  provide: (field) => EditorView.decorations.from(field),
});

const templateMatcher = new MatchDecorator({
  regexp: /\{\{\s*([^{}]+?)\s*\}\}/g,
  decoration: (match) => Decoration.mark({
    class: /^(?:node\[["'][^"']+["']\]\.data|\$(?:trigger|upstream))/.test(match[1].trim())
      ? 'cm-template-token'
      : 'cm-template-token cm-template-legacy',
  }),
});

const templateHighlight = ViewPlugin.fromClass(class {
  constructor(view) { this.decorations = templateMatcher.createDeco(view); }
  update(update) { this.decorations = templateMatcher.updateDeco(update, this.decorations); }
}, { decorations: (plugin) => plugin.decorations });

function completionSource(variableRef, t) {
  return (context) => {
    const expression = context.matchBefore(/\{\{[^{}\n]*/);
    const command = context.matchBefore(/\/(?:var|变量)(?:\s+[^{}\n]*)?/);
    if (!expression && !command) return null;

    const expressionText = expression?.text || '';
    const tokenOffset = expression ? expressionText.match(/^\{\{\s*/)?.[0].length || 2 : 0;
    const query = canonicalToken(expression
      ? expressionText.slice(tokenOffset)
      : command.text.replace(/^\/(?:var|变量)\s*/, '')).toLowerCase();
    let variables = flattenVariables(variableRef.current || []);
    if (query) {
      variables = variables.filter((item) => {
        const token = item.token.toLowerCase();
        return token.startsWith(query) || `${item.label} ${token}`.toLowerCase().includes(query);
      });
    }

    const from = expression ? expression.from + tokenOffset : command.from;
    return {
      from,
      filter: false,
      options: variables.slice(0, 120).map((item) => ({
        label: item.labelKey ? t(item.labelKey) : item.label,
        detail: item.type || 'unknown',
        info: item.descriptionKey ? t(item.descriptionKey, item.descriptionVariables) : (item.description || item.token),
        type: item.source === 'builtin' ? 'keyword' : 'variable',
        boost: item.hasValue ? 2 : 0,
        apply(view, _completion, applyFrom, to) {
          const hasClose = expression && view.state.sliceDoc(to, to + 2) === '}}';
          const insert = expression ? `${item.token}${hasClose ? '' : '}}'}` : wrapToken(item.token);
          view.dispatch({
            changes: { from: applyFrom, to, insert },
            selection: { anchor: applyFrom + insert.length },
          });
        },
      })),
    };
  };
}

function editorExtensions({ value, placeholder, variablesRef, onChangeRef, onCursor, singleLine, mode, minHeight, maxHeight, t }) {
  return [
    history(),
    keymap.of([...defaultKeymap, ...historyKeymap]),
    templateHighlight,
    diagnosticField,
    cmPlaceholder(placeholder),
    autocompletion({ override: [completionSource(variablesRef, t)], activateOnTyping: true, maxRenderedOptions: 80 }),
    ...(mode === 'json' ? [json()] : []),
    EditorView.lineWrapping,
    EditorView.theme({
      '&': { minHeight },
      '.cm-scroller': { minHeight: 'inherit', maxHeight, overflow: 'auto' },
    }),
    EditorView.updateListener.of((update) => {
      const syncedExternally = update.transactions.some((transaction) => transaction.annotation(externalSync));
      if (update.docChanged && !syncedExternally) onChangeRef.current?.(update.state.doc.toString());
      if (update.docChanged || update.selectionSet) onCursor?.(update);
    }),
    EditorView.domEventHandlers({
      keydown(event, view) {
        if (singleLine && event.key === 'Enter') {
          event.preventDefault();
          return true;
        }
        if (event.key === '{' && view.state.sliceDoc(Math.max(0, view.state.selection.main.head - 1), view.state.selection.main.head) === '{') {
          requestAnimationFrame(() => startCompletion(view));
        }
        stopCanvasShortcut(event);
        return false;
      },
      drop(event, view) {
        const transfer = event.dataTransfer;
        const raw = transfer?.getData(VARIABLE_MIME)
          || LEGACY_VARIABLE_MIMES.map((mime) => transfer?.getData(mime)).find(Boolean);
        if (!raw) return false;
        event.preventDefault();
        let token = raw;
        try { token = JSON.parse(raw).token || raw; } catch { /* plain token */ }
        insertIntoView(view, wrapToken(canonicalToken(token)), view.posAtCoords({ x: event.clientX, y: event.clientY }));
        return true;
      },
    }),
  ];
}

function stopCanvasShortcut(event) {
  const key = event.key.toLowerCase();
  const command = event.metaKey || event.ctrlKey;
  if (event.key === 'Escape' || event.key === 'Delete' || event.key === 'Backspace'
    || (command && ['z', 'y', 'd'].includes(key))) {
    event.stopPropagation();
  }
  return false;
}

export function TemplateEditor({
  value,
  onChange,
  variables = [],
  variableContext = {},
  variableFallback = false,
  variableMessage = '',
  label,
  hint,
  rows = 4,
  placeholder = '',
  compact = false,
  singleLine = false,
  mode = 'template',
  implicitUpstream = true,
}) {
  const { t } = useI18n();
  const hostRef = useRef(null);
  const viewRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const variablesRef = useRef(variables);
  const [issues, setIssues] = useState([]);
  const [activeToken, setActiveToken] = useState('');
  const [explorerOpen, setExplorerOpen] = useState(false);
  const [rendered, setRendered] = useState(null);
  const [rendering, setRendering] = useState(false);

  onChangeRef.current = onChange;
  variablesRef.current = variables;

  useEffect(() => {
    if (!hostRef.current) return undefined;
    const state = EditorState.create({
      doc: value || '',
      extensions: editorExtensions({
        value,
        placeholder,
        variablesRef,
        onChangeRef,
        singleLine,
        mode,
        t,
        minHeight: `${Math.max(36, rows * 22 + 18)}px`,
        maxHeight: compact ? '150px' : '260px',
        onCursor(update) {
          const position = update.state.selection.main.head;
          const line = update.state.doc.lineAt(position);
          const before = line.text.slice(0, position - line.from);
          const open = before.lastIndexOf('{{');
          const close = before.lastIndexOf('}}');
          setActiveToken(open > close ? before.slice(open + 2).trim() : '');
        },
      }),
    });
    const view = new EditorView({ state, parent: hostRef.current });
    viewRef.current = view;
    return () => {
      viewRef.current = null;
      view.destroy();
    };
  }, [compact, mode, placeholder, rows, singleLine, t]);

  useEffect(() => {
    const view = viewRef.current;
    const next = value || '';
    if (!view || view.state.doc.toString() === next) return;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: next },
      annotations: externalSync.of(true),
    });
  }, [value]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const result = await validateTemplate(value || '', { ...variableContext, variables }, controller.signal);
        setIssues(result.issues || []);
        viewRef.current?.dispatch({ effects: setDiagnostics.of(result.issues || []) });
      } catch (error) {
        if (error?.name !== 'AbortError') setIssues([]);
      }
    }, 280);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [value, variables, variableContext]);

  const insert = (token) => insertIntoView(viewRef.current, wrapToken(canonicalToken(token)));
  const jumpToIssue = () => {
    const issue = issues[0];
    const view = viewRef.current;
    if (!issue || !view) return;
    view.dispatch({ selection: { anchor: issue.from, head: issue.to }, scrollIntoView: true });
    view.focus();
  };
  const tryRender = async () => {
    setRendering(true);
    try { setRendered(await renderTemplatePreview(value || '', { ...variableContext, implicitUpstream })); }
    catch (error) { setRendered({ error: error.message || String(error) }); }
    finally { setRendering(false); }
  };

  const activeVariable = useMemo(() => {
    if (!activeToken) return null;
    return flattenVariables(variables).find((item) => item.token === activeToken || item.token.startsWith(activeToken));
  }, [activeToken, variables]);

  return (
    <div className={`tpl-editor ${compact ? 'tpl-editor-compact' : ''} ${singleLine ? 'tpl-editor-single-line' : ''}`}>
      {label && <div className="tpl-label"><span>{label}</span>{hint && <span className="sec-hint">{hint}</span>}</div>}
      <div ref={hostRef} className="tpl-cm" data-template-editor="true" />
      <div className="tpl-toolbar">
        <button type="button" className={`tpl-tool ${explorerOpen ? 'tpl-tool-on' : ''}`} onClick={() => setExplorerOpen(true)}>
          <Braces size={13} />{t('template.variableWorkbench')}
        </button>
        <span className={`tpl-health ${issues.length ? 'tpl-health-bad' : 'tpl-health-ok'}`}>
          {issues.length ? t('template.issueCount', { count: issues.length }) : t('template.valid')}
        </span>
        <span className="tpl-toolbar-spacer" />
        {issues.length > 0 && <button type="button" className="tpl-tool" onClick={jumpToIssue} title={t('template.jumpToFirstIssue')}><Crosshair size={13} />{t('template.locate')}</button>}
        <button type="button" className="tpl-tool" disabled={rendering} onClick={tryRender} title={t('template.tryRenderHint')}><Play size={13} />{rendering ? t('template.rendering') : t('template.tryRender')}</button>
      </div>
      {activeVariable && (
        <div className="tpl-active-info">
          <span className="tpl-active-label">{activeVariable.label}</span>
          <code>{activeVariable.token}</code>
          <span className="var-type">{activeVariable.type}</span>
        </div>
      )}
      {explorerOpen && (
        <VariableWorkbench
          title={label || t('template.defaultTitle')}
          value={value || ''}
          onChange={onChange}
          items={variables}
          fallback={variableFallback}
          message={variableMessage}
          variableContext={{ ...variableContext, implicitUpstream }}
          placeholder={placeholder}
          singleLine={singleLine}
          mode={mode}
          onClose={() => setExplorerOpen(false)}
        />
      )}
      {rendered && (
        <div className={`tpl-rendered ${rendered.error ? 'tpl-rendered-error' : ''}`}>
          <div className="tpl-rendered-head">
            <span>{t('template.renderedResult')}</span>
            <button type="button" className="btn-icon" aria-label={t('template.closeRendered')} onClick={() => setRendered(null)}><X size={14} /></button>
          </div>
          <pre>{rendered.error || rendered.text || t('template.emptyResult')}</pre>
          {rendered.note && <p>{rendered.note}</p>}
        </div>
      )}
    </div>
  );
}

function insertIntoView(view, text, position) {
  if (!view) return;
  const selection = view.state.selection.main;
  const from = position ?? selection.from;
  const to = position ?? selection.to;
  view.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + text.length }, scrollIntoView: true });
  view.focus();
}

function VariableWorkbench({
  title,
  value,
  onChange,
  items,
  fallback,
  message,
  variableContext,
  placeholder,
  singleLine,
  mode,
  onClose,
}) {
  const { t } = useI18n();
  const hostRef = useRef(null);
  const viewRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const variablesRef = useRef(items);
  const [preview, setPreview] = useState({ loading: true, text: '', missing: [], error: '' });
  const [issues, setIssues] = useState([]);

  onChangeRef.current = onChange;
  variablesRef.current = items;

  useEffect(() => {
    if (!hostRef.current) return undefined;
    const state = EditorState.create({
      doc: value || '',
      extensions: editorExtensions({
        value,
        placeholder,
        variablesRef,
        onChangeRef,
        singleLine,
        mode,
        t,
        minHeight: '420px',
        maxHeight: 'calc(82vh - 142px)',
      }),
    });
    const view = new EditorView({ state, parent: hostRef.current });
    viewRef.current = view;
    requestAnimationFrame(() => view.focus());
    return () => {
      viewRef.current = null;
      view.destroy();
    };
  }, [mode, placeholder, singleLine, t]);

  useEffect(() => {
    const view = viewRef.current;
    const next = value || '';
    if (!view || view.state.doc.toString() === next) return;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: next },
      annotations: externalSync.of(true),
    });
  }, [value]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setPreview((current) => ({ ...current, loading: true, error: '' }));
      try {
        const [validation, rendered] = await Promise.all([
          validateTemplate(value || '', { ...variableContext, variables: items }, controller.signal),
          renderTemplatePreview(value || '', variableContext, controller.signal),
        ]);
        if (controller.signal.aborted) return;
        const nextIssues = validation.issues || [];
        setIssues(nextIssues);
        viewRef.current?.dispatch({ effects: setDiagnostics.of(nextIssues) });
        setPreview({ loading: false, text: rendered.text || '', missing: rendered.missing || [], error: '' });
      } catch (error) {
        if (controller.signal.aborted || error?.name === 'AbortError') return;
        setPreview({ loading: false, text: '', missing: [], error: error.message || String(error) });
      }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [items, value, variableContext]);

  const insert = (token) => insertIntoView(viewRef.current, wrapToken(canonicalToken(token)));

  return (
    <div className="variable-workbench-mask" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="variable-workbench" role="dialog" aria-modal="true" aria-label={t('template.workbenchAria', { title })}>
        <header className="variable-workbench-head">
          <div>
            <strong>{title}</strong>
            <span>{t('template.workbenchSubtitle')}</span>
          </div>
          <button type="button" className="btn-icon" onClick={onClose} aria-label={t('template.closeWorkbench')}><X size={16} /></button>
        </header>
        <div className="variable-workbench-grid">
          <section className="variable-workbench-pane variable-workbench-vars">
            <VariableExplorer
              items={items}
              fallback={fallback}
              message={message}
              onInsert={insert}
              embedded
            />
          </section>
          <section className="variable-workbench-pane variable-workbench-editor">
            <div className="variable-pane-head">
              <strong>{t('template.edit')}</strong>
              <span>{issues.length ? t('template.issueCount', { count: issues.length }) : t('template.valid')}</span>
            </div>
            <div ref={hostRef} className="tpl-cm variable-workbench-cm" data-template-editor="true" />
            {issues.length > 0 && (
              <div className="variable-workbench-issues">
                {issues.slice(0, 4).map((issue, index) => <p key={`${issue.from}:${index}`}>{issue.message}</p>)}
              </div>
            )}
          </section>
          <section className="variable-workbench-pane variable-workbench-preview">
            <div className="variable-pane-head">
              <strong>{t('template.preview')}</strong>
              <span>{preview.loading ? t('template.updating') : preview.error ? t('status.error') : preview.missing.length ? t('template.missingValues') : t('template.live')}</span>
            </div>
            <div className={`variable-preview-body ${preview.error ? 'variable-preview-error' : ''}`}>
              {preview.loading && !preview.text && !preview.error ? (
                <div className="variable-preview-empty">{t('template.calculatingPreview')}</div>
              ) : (
                <pre>{preview.error || preview.text || t('template.emptyResult')}</pre>
              )}
            </div>
            {preview.missing.length > 0 && (
              <div className="variable-preview-missing">
                <strong>{t('template.missingVariables')}</strong>
                {preview.missing.map((token) => <code key={token}>{token}</code>)}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

export function VariableExplorer({ items, fallback, message, onInsert, onClose, embedded = false }) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(() => new Set(['group:nodes', 'group:builtin']));
  const visibleItems = useMemo(() => filterTree(items, query.trim().toLowerCase(), t), [items, query, t]);

  const toggle = (id) => setExpanded((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <div className={`var-explorer ${embedded ? 'var-explorer-embedded' : ''}`}>
      <div className="var-explorer-head">
        <div><strong>{t('template.variableTree')}</strong>{fallback && <span className="var-fallback">{t('template.localSchema')}</span>}</div>
        {!embedded && <button type="button" className="btn-icon" onClick={onClose} aria-label={t('template.closeVariableExplorer')}><X size={14} /></button>}
      </div>
      <label className="var-search">
        <Search size={13} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('template.variableSearch')} />
      </label>
      {message && <p className="var-message">{message}</p>}
      <div className="var-tree">
        {visibleItems.length === 0 && <div className="var-empty">{t('template.noVariables')}</div>}
        {visibleItems.map((item) => (
          <VariableRow key={item.id} item={item} depth={0} expanded={expanded} onToggle={toggle} onInsert={onInsert} forceOpen={Boolean(query)} />
        ))}
      </div>
      <div className="var-explorer-foot">{t('template.variableExplorerHint')} <code>{'{{'}</code> {t('template.variableCommands')}。</div>
    </div>
  );
}

function VariableRow({ item, depth, expanded, onToggle, onInsert, forceOpen }) {
  const { t } = useI18n();
  const hasChildren = item.children?.length > 0;
  const open = forceOpen || expanded.has(item.id);
  const insertable = Boolean(item.token);
  const label = item.labelKey ? t(item.labelKey) : item.label;
  const typeLabel = item.type === 'group' ? t('variables.type.group') : item.type;
  const preview = previewValue(item.recentValue);
  const copy = async (event) => {
    event.stopPropagation();
    await navigator.clipboard?.writeText(wrapToken(item.token));
  };
  const drag = (event) => {
    if (!insertable) return;
    const payload = JSON.stringify({ token: item.token, label: item.label, type: item.type });
    event.dataTransfer.setData(VARIABLE_MIME, payload);
    event.dataTransfer.setData('text/plain', wrapToken(item.token));
    event.dataTransfer.effectAllowed = 'copy';
  };
  return (
    <div className="var-branch">
      <div
        className={`var-row ${insertable ? 'var-row-insertable' : 'var-row-group'}`}
        style={{ '--var-depth': depth }}
        draggable={insertable}
        onDragStart={drag}
        onClick={() => insertable ? onInsert(item.token) : hasChildren && onToggle(item.id)}
        title={insertable ? item.token : label}
      >
        <button type="button" className="var-caret" aria-label={open ? t('template.collapseField') : t('template.expandField')} onClick={(event) => { event.stopPropagation(); if (hasChildren) onToggle(item.id); }}>
          {hasChildren ? <ChevronRight size={13} className={open ? 'var-caret-open' : ''} /> : <span />}
        </button>
        {insertable ? <GripVertical size={12} className="var-grip" /> : <Database size={12} className="var-group-icon" />}
        <div className="var-main">
          <div className="var-name-line"><span className="var-name">{label}</span>{item.type && <span className={`var-type type-${item.type}`}>{typeLabel}</span>}</div>
          {insertable && <code>{item.token}</code>}
          {(item.description || item.descriptionKey) && <span className="var-description">{item.descriptionKey ? t(item.descriptionKey, item.descriptionVariables) : item.description}</span>}
          {insertable && <span className={item.hasValue ? 'var-preview' : 'var-no-value'}>{item.hasValue ? preview : t('template.noRecentValue')}</span>}
        </div>
        {insertable && <button type="button" className="var-copy" onClick={copy} aria-label={t('template.copyVariable', { label: item.label })} title={t('template.copyVariableTitle')}><Copy size={13} /></button>}
      </div>
      {hasChildren && open && (
        <div className="var-children">
          {item.children.map((child) => <VariableRow key={child.id} item={child} depth={depth + 1} expanded={expanded} onToggle={onToggle} onInsert={onInsert} forceOpen={forceOpen} />)}
        </div>
      )}
    </div>
  );
}

function filterTree(items, query, t) {
  if (!query) return items;
  return items.map((item) => {
    const children = filterTree(item.children || [], query, t);
    const label = item.labelKey ? t(item.labelKey) : item.label;
    const self = `${label} ${item.token || ''} ${item.type || ''} ${previewValue(item.recentValue)}`.toLowerCase().includes(query);
    return self || children.length ? { ...item, children } : null;
  }).filter(Boolean);
}

function previewValue(value) {
  if (value === undefined) return '';
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return String(text).replace(/\s+/g, ' ').slice(0, 90);
}
