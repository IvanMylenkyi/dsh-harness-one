import React from 'react';
import { createRoot } from 'react-dom/client';
import { I18nProvider, useI18n } from '../src/i18n/index.js';
import { DocWallView } from '../src/DocWallView.jsx';
import { NodeDetailModal } from '../src/NodeDetailModal.jsx';

const runResults = {
  runId: 'recovery-smoke-run',
  workflowName: 'Audit workflow',
  status: 'success',
  finalFiles: [{ id: 'final-1', nodeId: 'out-1', nodeLabel: 'Output node', name: 'report.md', content: '# Report', downloadUrl: '/report.md' }],
  links: [{ nodeLabel: 'Source node', url: 'https://example.test/source' }],
  nodeTimeline: [
    { nodeId: 'agent-1', nodeLabel: 'Review node', nodeType: 'agent', status: 'success', durationMs: 1500 },
    { nodeId: 'out-1', nodeLabel: 'Output node', nodeType: 'output', status: 'success' },
  ],
};

function Fixture() {
  const { locale, setLocale } = useI18n();
  return (
    <>
      <select aria-label="fixture language" value={locale} onChange={(event) => setLocale(event.target.value)}>
        <option value="en">en</option>
        <option value="zh-CN">zh</option>
      </select>
      <DocWallView runResults={runResults} inspectedRunId={runResults.runId} />
      <NodeDetailModal runId={runResults.runId} nodeId="agent-1" onClose={() => {}} />
    </>
  );
}

createRoot(document.getElementById('root')).render(
  <I18nProvider>
    <Fixture />
  </I18nProvider>,
);
