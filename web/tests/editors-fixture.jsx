import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nProvider, useI18n } from '../src/i18n/index.js';
import { AgentSchemaEditor } from '../src/AgentSchemaEditor.jsx';
import { RichDocEditor } from '../src/RichDocEditor.jsx';
import { TemplateModal } from '../src/templates.jsx';
import { normalizeVariableSchema } from '../src/variables.js';
import { VariableExplorer } from '../src/TemplateEditor.jsx';

const apiVariables = normalizeVariableSchema({ items: [
  { id: 'group:nodes', label: '上游节点', type: 'group', source: 'group', children: [] },
  { id: 'group:builtin', label: '运行上下文', type: 'group', source: 'group', children: [] },
  { id: 'group:global-variables', label: '实例变量', type: 'group', source: 'group', children: [] },
  { id: 'group:workflow-variables', label: '工作流变量', type: 'group', source: 'group', children: [] },
  { id: 'group:run-inputs', label: '运行输入', type: 'group', source: 'group', children: [] },
  { id: 'node:user-workflow', label: '运行日报', token: 'node["run-digest"].text', type: 'string', source: 'node', children: [] },
] });

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
      <VariableExplorer items={apiVariables.items} embedded onInsert={() => {}} />
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
