import React from 'react';
import { createRoot } from 'react-dom/client';
import { I18nProvider } from '../src/i18n/index.js';
import ResultPanel from '../src/ResultPanel.jsx';

const runDetail = {
  runId: 'browser-smoke-run',
  workflowName: 'Completed-step smoke test',
  status: 'success',
  graph: { nodes: [{ id: 'agent-1', type: 'agent', data: { label: 'Completed step' } }], edges: [] },
  nodeStates: {
    'agent-1': { status: 'success', startedAt: '2026-09-20T10:00:00.000Z', durationMs: 1500 },
  },
};

const events = [{
  id: 'completed-step',
  status: 'success',
  nodeId: 'agent-1',
  nodeLabel: 'Completed step',
  startedAt: '2026-09-20T10:00:00.000Z',
  durationMs: 1500,
}];

createRoot(document.getElementById('root')).render(
  <I18nProvider>
    <ResultPanel runDetail={runDetail} results={{}} events={events} status={{ status: 'success' }} />
  </I18nProvider>,
);
