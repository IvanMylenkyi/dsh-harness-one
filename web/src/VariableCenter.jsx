import { useEffect, useMemo, useState } from 'react';
import {
  Braces, Check, ChevronRight, CircleAlert, Copy, Database, FileInput, Globe2, Plus, RefreshCw, Save, Trash2,
} from 'lucide-react';
import { Modal, useToast } from './ui.jsx';
import { useI18n } from './i18n/index.js';
import {
  createGlobalVariable,
  deleteGlobalVariable,
  draftToVariable,
  EMPTY_GLOBAL_VARIABLE_DRAFT,
  GLOBAL_VARIABLE_TYPES,
  GlobalVariableApiError,
  loadGlobalVariables,
  updateGlobalVariable,
  variableToDraft,
  variableToken,
} from './global-variables.js';

const SCOPE_META = {
  global: { labelKey: 'variables.scope.global', hintKey: 'variables.scope.globalHint', icon: Globe2 },
  workflow: { labelKey: 'variables.scope.workflow', hintKey: 'variables.scope.workflowHint', icon: Braces },
  input: { labelKey: 'variables.scope.input', hintKey: 'variables.scope.inputHint', icon: FileInput },
};
const TYPE_KEYS = { string: 'variables.type.string', number: 'variables.type.number', boolean: 'variables.type.boolean', json: 'variables.type.json', 'string[]': 'variables.type.stringArray' };

export function VariableCenter({ onClose, workflowVariables = [], inputSchema = { fields: [] }, onGlobalChanged }) {
  const toast = useToast();
  const { t } = useI18n();
  const [scope, setScope] = useState('global');
  const [document, setDocument] = useState({ version: 1, revision: 0, variables: [] });
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(EMPTY_GLOBAL_VARIABLE_DRAFT);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = async ({ preserveSelection = true } = {}) => {
    setLoading(true);
    setError('');
    try {
      const next = await loadGlobalVariables();
      setDocument(next);
      const selected = preserveSelection ? next.variables.find((item) => item.id === selectedId) : null;
      const fallback = selected || next.variables[0] || null;
      setSelectedId(fallback?.id || null);
      setCreating(false);
      setDraft(fallback ? variableToDraft(fallback) : EMPTY_GLOBAL_VARIABLE_DRAFT);
    } catch (loadError) {
      setError(loadError.message || t('variables.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load({ preserveSelection: false }); }, []);

  const globalItems = document.variables || [];
  const workflowItems = Array.isArray(workflowVariables) ? workflowVariables : [];
  const inputItems = Array.isArray(inputSchema?.fields) ? inputSchema.fields : [];
  const selected = globalItems.find((item) => item.id === selectedId) || null;
  const visibleItems = scope === 'global' ? globalItems : scope === 'workflow' ? workflowItems : inputItems;

  const counts = useMemo(() => ({
    global: globalItems.length,
    workflow: workflowItems.length,
    input: inputItems.length,
  }), [globalItems.length, inputItems.length, workflowItems.length]);

  const pickGlobal = (item) => {
    setCreating(false);
    setSelectedId(item.id);
    setDraft(variableToDraft(item));
    setError('');
  };

  const beginCreate = () => {
    setScope('global');
    setCreating(true);
    setSelectedId(null);
    setDraft(EMPTY_GLOBAL_VARIABLE_DRAFT);
    setError('');
  };

  const handleConflict = async (requestError) => {
    if (!(requestError instanceof GlobalVariableApiError) || requestError.code !== 'revision-conflict') return false;
    toast(t('variables.conflict'), 'warn');
    await load({ preserveSelection: true });
    return true;
  };

  const saveGlobal = async () => {
    let variable;
    try { variable = draftToVariable(draft); }
    catch (validationError) { setError(validationError.message); return; }
    setBusy(true);
    setError('');
    try {
      const result = creating
        ? await createGlobalVariable(variable, document.revision)
        : await updateGlobalVariable(selected.id, variable, document.revision);
      setDocument({ version: result.version, revision: result.revision, variables: result.variables });
      setSelectedId(result.variable.id);
      setCreating(false);
      setDraft(variableToDraft(result.variable));
      toast(creating ? t('variables.created', { label: result.variable.label || result.variable.key }) : t('variables.saved'), 'success');
      onGlobalChanged?.(result.revision);
    } catch (requestError) {
      if (!(await handleConflict(requestError))) setError(requestError.message || t('variables.saveFailed'));
    } finally {
      setBusy(false);
    }
  };

  const removeGlobal = async () => {
    if (!selected) return;
    setBusy(true);
    setError('');
    try {
      const result = await deleteGlobalVariable(selected.id, document.revision);
      const next = result.variables[0] || null;
      setDocument({ version: result.version, revision: result.revision, variables: result.variables });
      setSelectedId(next?.id || null);
      setDraft(next ? variableToDraft(next) : EMPTY_GLOBAL_VARIABLE_DRAFT);
      toast(t('variables.deleted', { label: selected.label || selected.key }), 'warn');
      onGlobalChanged?.(result.revision);
    } catch (requestError) {
      if (!(await handleConflict(requestError))) setError(requestError.message || t('variables.deleteFailed'));
    } finally {
      setBusy(false);
    }
  };

  const copyToken = async (token) => {
    try {
      await navigator.clipboard.writeText(`{{${token}}}`);
      setCopied(token);
      setTimeout(() => setCopied(''), 1200);
    } catch { toast(t('variables.copyFailed'), 'error'); }
  };

  return (
    <>
    <Modal title={t('variables.title')} onClose={onClose} className="variable-center-modal">
      <div className="variable-center">
        <aside className="vc-scopes" aria-label={t('variables.scopeLabel')}>
          <div className="vc-scope-title">{t('variables.scopeLabel')}</div>
          {Object.entries(SCOPE_META).map(([key, meta]) => {
            const Icon = meta.icon;
            return (
              <button key={key} className={`vc-scope ${scope === key ? 'vc-scope-on' : ''}`} onClick={() => { setScope(key); setError(''); }}>
                <Icon size={16} />
                <span><strong>{t(meta.labelKey)}</strong><small>{t(meta.hintKey)}</small></span>
                <b>{counts[key]}</b>
              </button>
            );
          })}
          <div className="vc-scope-note">
            <Database size={15} />
            <span>{t('variables.sensitiveHint')}</span>
          </div>
        </aside>

        <section className="vc-list-pane">
          <header className="vc-pane-head">
            <div><strong>{t(SCOPE_META[scope].labelKey)}</strong><span>{t('variables.itemCount', { count: visibleItems.length })}</span></div>
            {scope === 'global' && (
              <button className="btn btn-primary btn-sm" onClick={beginCreate}><Plus size={14} /> {t('action.new')}</button>
            )}
          </header>
          <div className="vc-list">
            {loading && <div className="vc-empty"><RefreshCw size={18} className="vc-spin" />{t('status.loading')}</div>}
            {!loading && visibleItems.length === 0 && (
              <div className="vc-empty">
                <Database size={24} />
                <strong>{t(scope === 'global' ? 'variables.emptyGlobal' : 'variables.emptyScope')}</strong>
                <span>{t(scope === 'global' ? 'variables.emptyGlobalHint' : 'variables.emptyScopeHint')}</span>
                {scope === 'global' && <button className="btn btn-sm" onClick={beginCreate}><Plus size={14} /> {t('variables.createFirst')}</button>}
              </div>
            )}
            {!loading && visibleItems.map((item) => {
              const token = variableToken(item.key, scope);
              const active = scope === 'global' && !creating && selectedId === item.id;
              return (
                <div key={item.id || item.key} className={`vc-variable-row ${active ? 'vc-variable-on' : ''}`}>
                  <button type="button" className="vc-variable-select" onClick={() => scope === 'global' && pickGlobal(item)}>
                    <span className="vc-variable-type">{item.type || 'any'}</span>
                    <span className="vc-variable-main">
                      <strong>{item.label || item.key}</strong>
                      <code>{token}</code>
                    </span>
                    {item.required && <span className="vc-required">{t('node.required')}</span>}
                    {scope === 'global' && <ChevronRight size={14} className="vc-row-arrow" />}
                  </button>
                  <button type="button" className="btn-icon vc-copy" aria-label={t('variables.copyLabel', { label: item.label || item.key })} title={t('variables.copyReference')}
                    onClick={() => copyToken(token)}>
                    {copied === token ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
              );
            })}
          </div>
          {scope === 'global' && (
            <footer className="vc-list-foot">
              <span>{t('variables.revision', { revision: document.revision })}</span>
              <button className="btn-icon" title={t('action.refresh')} aria-label={t('action.refresh')} disabled={loading} onClick={() => load({ preserveSelection: true })}>
                <RefreshCw size={14} />
              </button>
            </footer>
          )}
        </section>

        <section className="vc-editor-pane">
          {scope !== 'global' ? (
            <div className="vc-readonly">
              <CircleAlert size={26} />
              <strong>{t(SCOPE_META[scope].labelKey)}{t('variables.readOnly')}</strong>
              <p>{t(scope === 'workflow' ? 'variables.workflowReadOnlyHint' : 'variables.inputReadOnlyHint')}</p>
            </div>
          ) : (!creating && !selected) ? (
            <div className="vc-readonly"><Database size={26} /><strong>{t('variables.selectOrCreate')}</strong><p>{t('variables.selectOrCreateHint')}</p></div>
          ) : (
            <GlobalVariableForm draft={draft} setDraft={setDraft} creating={creating} busy={busy} error={error}
              token={draft.key ? variableToken(draft.key) : ''} onSave={saveGlobal} onDelete={() => setConfirmDelete(true)} />
          )}
        </section>
      </div>
    </Modal>
    {confirmDelete && selected && (
      <Modal title={t('variables.deleteTitle')} onClose={() => setConfirmDelete(false)} className="vc-confirm-modal" footer={(
        <>
          <button className="btn" onClick={() => setConfirmDelete(false)}>{t('action.cancel')}</button>
          <button className="btn btn-danger" disabled={busy} onClick={async () => { setConfirmDelete(false); await removeGlobal(); }}>{t('variables.delete')}</button>
        </>
      )}>
        <p className="modal-message">{t('variables.deleteConfirm', { label: selected.label || selected.key })}</p>
      </Modal>
    )}
    </>
  );
}

function GlobalVariableForm({ draft, setDraft, creating, busy, error, token, onSave, onDelete }) {
  const { t } = useI18n();
  const set = (patch) => setDraft((current) => ({ ...current, ...patch }));
  return (
    <div className="vc-form">
      <header className="vc-form-head">
        <div><strong>{t(creating ? 'variables.newGlobal' : 'variables.editGlobal')}</strong><span>{t('variables.nonSensitive')}</span></div>
        {!creating && <button className="btn-icon vc-delete" title={t('variables.delete')} aria-label={t('variables.delete')} disabled={busy} onClick={onDelete}><Trash2 size={16} /></button>}
      </header>
      <div className="vc-form-body">
        <label className="vc-field"><span>Key <em>{t(creating ? 'variables.stableReference' : 'variables.lockedReference')}</em></span><input autoFocus={creating} disabled={!creating} value={draft.key} onChange={(e) => set({ key: e.target.value.trim() })} placeholder="emergency_sla_minutes" /></label>
        <label className="vc-field"><span>{t('variables.displayName')}</span><input value={draft.label} onChange={(e) => set({ label: e.target.value })} placeholder={t('variables.displayNamePlaceholder')} /></label>
        <label className="vc-field"><span>{t('variables.type')}</span><select value={draft.type} onChange={(e) => set({ type: e.target.value, valueText: e.target.value === 'boolean' ? 'false' : '' })}>
          {GLOBAL_VARIABLE_TYPES.map((item) => <option key={item.value} value={item.value}>{t(TYPE_KEYS[item.value] || 'variables.type.unknown')} · {item.value}</option>)}
        </select></label>
        <ValueEditor draft={draft} set={set} />
        <label className="vc-field"><span>{t('variables.description')} <em>{t('node.optional')}</em></span><textarea rows={3} value={draft.description} onChange={(e) => set({ description: e.target.value })} placeholder={t('variables.descriptionPlaceholder')} /></label>
        <div className="vc-token-preview"><span>{t('variables.templateReference')}</span><code>{token ? `{{${token}}}` : t('variables.fillKey')}</code></div>
        {error && <div className="vc-form-error"><CircleAlert size={14} />{error}</div>}
      </div>
      <footer className="vc-form-foot"><button className="btn btn-primary" disabled={busy} onClick={onSave}><Save size={15} />{busy ? t('status.saving') : t('variables.save')}</button></footer>
    </div>
  );
}

function ValueEditor({ draft, set }) {
  const { t } = useI18n();
  if (draft.type === 'boolean') {
    return <label className="vc-field"><span>{t('variables.value')}</span><select value={draft.valueText} onChange={(e) => set({ valueText: e.target.value })}><option value="false">false</option><option value="true">true</option></select></label>;
  }
  if (draft.type === 'json') {
    return <label className="vc-field"><span>{t('variables.value')} <em>JSON</em></span><textarea className="vc-code-input" rows={9} value={draft.valueText} onChange={(e) => set({ valueText: e.target.value })} placeholder={'{\n  "enabled": true\n}'} /></label>;
  }
  if (draft.type === 'string[]') {
    return <label className="vc-field"><span>{t('variables.value')} <em>{t('variables.onePerLine')}</em></span><textarea rows={7} value={draft.valueText} onChange={(e) => set({ valueText: e.target.value })} placeholder={'item-a\nitem-b'} /></label>;
  }
  return <label className="vc-field"><span>{t('variables.value')}</span><input type={draft.type === 'number' ? 'number' : 'text'} value={draft.valueText} onChange={(e) => set({ valueText: e.target.value })} placeholder={draft.type === 'number' ? '15' : t('variables.valuePlaceholder')} /></label>;
}
