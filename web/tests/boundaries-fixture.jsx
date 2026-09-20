import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nProvider, useI18n } from '../src/i18n/index.js';
import { DocWallView } from '../src/DocWallView.jsx';
import { NodeDetailModal } from '../src/NodeDetailModal.jsx';

const liveRun = {
  runId: 'boundary-live-run',
  workflowName: 'Live workflow',
  status: 'running',
  nodeTimeline: [{ nodeId: 'live-node', nodeLabel: 'Live node', nodeType: 'agent', status: 'running' }],
};

function Fixture() {
  const { locale, setLocale } = useI18n();
  const [mode, setMode] = useState('empty');
  return (
    <>
      <select aria-label="fixture language" value={locale} onChange={(event) => setLocale(event.target.value)}>
        <option value="en">en</option>
        <option value="zh-CN">zh</option>
      </select>
      <nav aria-label="boundary scenarios">
        {['empty', 'loading', 'error', 'live', 'server-error'].map((next) => (
          <button key={next} type="button" onClick={() => setMode(next)}>{next}</button>
        ))}
      </nav>
      <DocWallView
        runResults={mode === 'live' ? liveRun : {}}
        progressByNode={mode === 'live' ? { 'live-node': { preview: 'Live preview from server', turns: 2 } } : {}}
        loading={mode === 'loading'}
        loadError={mode === 'error' ? 'Server load failure' : ''}
        onRetry={() => setMode('empty')}
      />
      {mode === 'server-error' && <NodeDetailModal runId="boundary-run" nodeId="error-node" onClose={() => setMode('empty')} />}
    </>
  );
}

createRoot(document.getElementById('root')).render(
  <I18nProvider>
    <Fixture />
  </I18nProvider>,
);
