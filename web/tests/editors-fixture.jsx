import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nProvider, useI18n } from '../src/i18n/index.js';
import { AgentSchemaEditor } from '../src/AgentSchemaEditor.jsx';
import { RichDocEditor } from '../src/RichDocEditor.jsx';
import { TemplateModal } from '../src/templates.jsx';

function Fixture() {
  const { locale, setLocale } = useI18n();
  const [schema, setSchema] = useState({ type: 'object', properties: {}, required: [] });
  const [mode, setMode] = useState('structured');
  const [appliedTemplate, setAppliedTemplate] = useState(null);
  return (
    <div>
      <select aria-label="fixture language" value={locale} onChange={(event) => setLocale(event.target.value)}>
        <option value="en">en</option>
        <option value="zh-CN">zh</option>
      </select>
      <AgentSchemaEditor mode={mode} value={schema} onModeChange={setMode} onChange={setSchema} />
      <RichDocEditor initialMarkdown="# Draft" onChange={() => {}} />
      <TemplateModal onClose={() => {}} onApply={setAppliedTemplate} />
      <pre data-testid="applied-template">{appliedTemplate ? JSON.stringify(appliedTemplate.graph) : ''}</pre>
    </div>
  );
}

createRoot(document.getElementById('root')).render(
  <I18nProvider>
    <Fixture />
  </I18nProvider>,
);
