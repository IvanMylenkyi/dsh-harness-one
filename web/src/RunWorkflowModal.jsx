import { useMemo, useState } from 'react';
import { Modal } from './ui.jsx';
import { fieldKey, initialRunInputValues, RunInputValidationError, schemaFields, serializeRunInputValues } from './workflow-run-inputs.js';
import { useI18n } from './i18n/index.js';

function displayValue(value, type) {
  if (value === undefined || value === null) return '';
  if (type === 'object' || type === 'json' || type === 'array') return JSON.stringify(value, null, 2);
  if (type === 'string[]') return Array.isArray(value) ? value.join('\n') : String(value);
  return String(value);
}

export function RunWorkflowModal({ workflow, onClose, onStart }) {
  const { t } = useI18n();
  const fields = useMemo(() => schemaFields(workflow?.inputSchema), [workflow]);
  const [triggerInput, setTriggerInput] = useState('');
  const [values, setValues] = useState(() => initialRunInputValues(workflow?.inputSchema));
  const [rawJson, setRawJson] = useState('{}');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const setField = (field, value) => setValues((current) => ({ ...current, [fieldKey(field)]: value }));
  const submit = async () => {
    let runInputs;
    try {
      if (fields.length) runInputs = serializeRunInputValues(workflow.inputSchema, values);
      else {
        runInputs = rawJson.trim() ? JSON.parse(rawJson) : {};
        if (!runInputs || typeof runInputs !== 'object' || Array.isArray(runInputs)) throw new Error(t('validation.objectRequired'));
      }
    } catch (e) {
      setError(e instanceof RunInputValidationError
        ? e.errors.map((item) => t(item.i18nKey, item.variables)).join('; ')
        : e.message || t('run.invalidParams'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onStart({ triggerInput, runInputs });
      onClose();
    } catch (e) {
      setError(e.message || t('run.startFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={t('run.startTitle', { workflow: workflow?.name || t('workflow.default') })} onClose={busy ? undefined : onClose} className="run-workflow-modal" footer={(
      <>
        <button className="btn" disabled={busy} onClick={onClose}>{t('action.cancel')}</button>
        <button className="btn btn-primary" disabled={busy} onClick={submit}>{busy ? t('run.starting') : `▶ ${t('action.run')}`}</button>
      </>
    )}>
      <div className="run-workflow-form">
        <p className="modal-message">{t('count.nodes', { count: workflow?.nodeCount ?? workflow?.graph?.nodes?.length ?? 0 })} · {t('run.currentCanvasUnchanged')}</p>
        <label className="run-workflow-field"><span>{t('run.triggerInput')} <em>{t('run.optional')}</em></span><textarea rows={3} value={triggerInput} onChange={(e) => setTriggerInput(e.target.value)} placeholder={t('run.inputPlaceholder')} /></label>
        {fields.length > 0 ? fields.map((field) => {
          const key = fieldKey(field);
          const type = String(field.type || 'string').toLowerCase();
          const value = values[key];
          const label = field.label || key;
          if (Array.isArray(field.enum)) return <label className="run-workflow-field" key={key}><span>{label}{field.required && <b> *</b>}</span><select value={value ?? ''} onChange={(e) => setField(field, e.target.value)}><option value="">{t('run.select')}</option>{field.enum.map((item) => <option key={item} value={item}>{item}</option>)}</select>{field.description && <small>{field.description}</small>}</label>;
          if (type === 'boolean') return <label className="run-workflow-check" key={key}><input type="checkbox" checked={value === true || value === 'true'} onChange={(e) => setField(field, e.target.checked)} /><span>{label}{field.required && <b> *</b>}</span>{field.description && <small>{field.description}</small>}</label>;
          const complex = type === 'object' || type === 'json' || type === 'array';
          return <label className="run-workflow-field" key={key}><span>{label}{field.required && <b> *</b>}</span>{complex || type === 'string[]' ? <textarea rows={complex ? 5 : 3} value={displayValue(value, type)} onChange={(e) => setField(field, e.target.value)} placeholder={complex ? 'JSON' : t('run.eachLine')} /> : <input type={type === 'number' ? 'number' : 'text'} value={displayValue(value, type)} onChange={(e) => setField(field, e.target.value)} />}{field.description && <small>{field.description}</small>}</label>;
        }) : <label className="run-workflow-field"><span>{t('run.parameters')} <em>JSON, {t('run.optional').toLowerCase()}</em></span><textarea className="run-workflow-json" rows={8} value={rawJson} onChange={(e) => setRawJson(e.target.value)} placeholder={'{\n  "key": "value"\n}'} /></label>}
        {error && <div className="run-workflow-error">{error}</div>}
      </div>
    </Modal>
  );
}
