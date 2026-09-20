import { useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from './i18n/index.js';

export const DEFAULT_AGENT_SCHEMA = {
  type: 'object',
  properties: {
    result: { type: 'string' },
  },
  required: ['result'],
  additionalProperties: false,
};

const FIELD_TYPES = [
  ['string', 'schema.type.string'],
  ['number', 'schema.type.number'],
  ['boolean', 'schema.type.boolean'],
  ['object', 'schema.type.object'],
  ['array', 'schema.type.array'],
  ['enum', 'schema.type.enum'],
];

export function AgentSchemaEditor({ mode = 'text', value, onModeChange, onChange }) {
  const { t } = useI18n();
  const schema = useMemo(() => normalizeSchema(value), [value]);
  const [editorMode, setEditorMode] = useState('visual');
  const [jsonText, setJsonText] = useState(() => JSON.stringify(schema, null, 2));
  const [jsonError, setJsonError] = useState('');
  const emittedSchemaRef = useRef(null);

  useEffect(() => {
    if (emittedSchemaRef.current === value) {
      emittedSchemaRef.current = null;
      return;
    }
    setJsonText(JSON.stringify(schema, null, 2));
    setJsonError('');
  }, [schema, value]);

  const emitChange = (next) => {
    emittedSchemaRef.current = next;
    onChange?.(next);
  };
  const updateSchema = (next) => {
    setJsonText(JSON.stringify(next, null, 2));
    setJsonError('');
    emitChange(next);
  };
  const updateJson = (text) => {
    setJsonText(text);
    try {
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(t('schema.invalidObject'));
      setJsonError('');
      emitChange(parsed);
    } catch {
      setJsonError('schema.invalidJson');
    }
  };

  return (
    <div className="agent-schema-editor">
      <label className="field">
        <span className="field-label">{t('schema.outputMode')}</span>
        <select value={mode} onChange={(event) => onModeChange?.(event.target.value)}>
          <option value="text">{t('schema.outputText')}</option>
          <option value="structured">{t('schema.outputStructured')}</option>
        </select>
      </label>

      {mode === 'structured' && <div className="schema-config">
      <div className="schema-mode-tabs" role="tablist" aria-label={t('schema.editorMode')}>
        <button type="button" role="tab" aria-selected={editorMode === 'visual'}
          className={editorMode === 'visual' ? 'schema-tab schema-tab-on' : 'schema-tab'}
          onClick={() => setEditorMode('visual')}>{t('schema.visual')}</button>
        <button type="button" role="tab" aria-selected={editorMode === 'json'}
          className={editorMode === 'json' ? 'schema-tab schema-tab-on' : 'schema-tab'}
          onClick={() => setEditorMode('json')}>{t('schema.advancedJson')}</button>
      </div>

      {editorMode === 'visual' ? (
        <ObjectFields schema={schema} onChange={updateSchema} root />
      ) : (
        <div className="schema-json-editor">
          <textarea rows={14} spellCheck="false" value={jsonText} onChange={(event) => updateJson(event.target.value)} />
          {jsonError && <p className="panel-error">{t('schema.invalidJsonMessage', { message: t(jsonError) })}</p>}
        </div>
      )}
      </div>}
    </div>
  );
}

function ObjectFields({ schema, onChange, root = false }) {
  const { t } = useI18n();
  const properties = schema.properties || {};
  const required = new Set(schema.required || []);
  const entries = Object.entries(properties);

  const updateField = (oldName, nextName, nextField, isRequired) => {
    const nextProperties = {};
    for (const [name, field] of entries) {
      if (name === oldName) nextProperties[nextName] = nextField;
      else nextProperties[name] = field;
    }
    const nextRequired = [...required].filter((name) => name !== oldName);
    if (isRequired && nextName) nextRequired.push(nextName);
    onChange({
      ...schema,
      type: 'object',
      properties: nextProperties,
      required: [...new Set(nextRequired)],
      additionalProperties: false,
    });
  };

  const addField = () => {
    const name = uniqueFieldName(properties, 'field');
    onChange({
      ...schema,
      type: 'object',
      properties: { ...properties, [name]: { type: 'string' } },
      required: schema.required || [],
      additionalProperties: false,
    });
  };

  const removeField = (name) => {
    const nextProperties = { ...properties };
    delete nextProperties[name];
    onChange({
      ...schema,
      properties: nextProperties,
      required: [...required].filter((item) => item !== name),
    });
  };

  return (
    <div className={root ? 'schema-object schema-root' : 'schema-object'}>
      {entries.length === 0 && <p className="sec-hint">{t('schema.emptyFields')}</p>}
      {entries.map(([name, field]) => (
        <SchemaField key={name} name={name} schema={field} required={required.has(name)}
          onChange={(nextName, nextField, nextRequired) => updateField(name, nextName, nextField, nextRequired)}
          onRemove={() => removeField(name)} />
      ))}
      <button type="button" className="btn btn-sm schema-add" onClick={addField}>+ {t('schema.addField')}</button>
    </div>
  );
}

function SchemaField({ name, schema, required, onChange, onRemove }) {
  const { t } = useI18n();
  const [nameDraft, setNameDraft] = useState(name);
  const displayType = schema.enum ? 'enum' : schema.type || 'string';
  const itemType = schema.items?.enum ? 'enum' : schema.items?.type || 'string';
  const emit = (patch) => onChange(name, { ...schema, ...patch }, required);
  const commitName = () => {
    const nextName = nameDraft.trim() || name;
    setNameDraft(nextName);
    if (nextName !== name) onChange(nextName, schema, required);
  };

  const changeType = (type) => {
    let next;
    if (type === 'enum') next = { type: 'string', enum: ['option_a', 'option_b'] };
    else if (type === 'object') next = { type: 'object', properties: {}, required: [], additionalProperties: false };
    else if (type === 'array') next = { type: 'array', items: { type: 'string' } };
    else next = { type };
    if (schema.description) next.description = schema.description;
    onChange(name, next, required);
  };

  const changeArrayItemType = (type) => {
    let items;
    if (type === 'enum') items = { type: 'string', enum: ['option_a', 'option_b'] };
    else if (type === 'object') items = { type: 'object', properties: {}, required: [], additionalProperties: false };
    else items = { type };
    emit({ items });
  };

  return (
    <div className="schema-field-row">
      <div className="schema-field-main">
        <input aria-label={t('schema.fieldName')} value={nameDraft} onChange={(event) => setNameDraft(event.target.value)}
          onBlur={commitName} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} />
        <select aria-label={t('schema.fieldType', { name })} value={displayType} onChange={(event) => changeType(event.target.value)}>
          {FIELD_TYPES.map(([type, labelKey]) => <option key={type} value={type}>{t(labelKey)}</option>)}
        </select>
        <label className="schema-required">
          <input type="checkbox" checked={required} onChange={(event) => onChange(name, schema, event.target.checked)} />
          <span>{t('schema.required')}</span>
        </label>
        <button type="button" className="btn-icon schema-remove" title={t('schema.deleteField')} aria-label={t('schema.deleteFieldNamed', { name })} onClick={onRemove}>×</button>
      </div>
      <input className="schema-description" aria-label={t('schema.fieldDescription', { name })} placeholder={t('schema.descriptionPlaceholder')}
        value={schema.description || ''} onChange={(event) => emit({ description: event.target.value || undefined })} />

      {displayType === 'enum' && (
        <input aria-label={t('schema.enumValues', { name })} placeholder={t('schema.enumPlaceholder')}
          value={(schema.enum || []).join(', ')}
          onChange={(event) => emit({ type: 'string', enum: splitEnum(event.target.value) })} />
      )}

      {displayType === 'object' && (
        <ObjectFields schema={schema} onChange={(next) => onChange(name, next, required)} />
      )}

      {displayType === 'array' && (
        <div className="schema-array-items">
          <span className="field-label">{t('schema.arrayItems')}</span>
          <select value={itemType} onChange={(event) => changeArrayItemType(event.target.value)}>
            {FIELD_TYPES.filter(([type]) => type !== 'array').map(([type, labelKey]) => <option key={type} value={type}>{t(labelKey)}</option>)}
          </select>
          {itemType === 'enum' && (
            <input aria-label={t('schema.enumValues', { name })} placeholder={t('schema.enumPlaceholder')} value={(schema.items?.enum || []).join(', ')}
              onChange={(event) => emit({ items: { type: 'string', enum: splitEnum(event.target.value) } })} />
          )}
          {itemType === 'object' && (
            <ObjectFields schema={schema.items || { type: 'object' }}
              onChange={(items) => emit({ items })} />
          )}
        </div>
      )}
    </div>
  );
}

function normalizeSchema(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch { /* 使用默认 Schema */ }
  }
  return DEFAULT_AGENT_SCHEMA;
}

function uniqueFieldName(properties, prefix) {
  let index = Object.keys(properties).length + 1;
  let name = `${prefix}_${index}`;
  while (properties[name]) {
    index += 1;
    name = `${prefix}_${index}`;
  }
  return name;
}

function splitEnum(value) {
  return [...new Set(value.split(',').map((item) => item.trim()).filter(Boolean))];
}
