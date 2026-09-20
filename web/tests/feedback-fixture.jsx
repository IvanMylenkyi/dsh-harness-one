import React from 'react';
import { createRoot } from 'react-dom/client';
import { I18nProvider, useI18n } from '../src/i18n/index.js';
import { FeedbackDrawer } from '../src/docwall-feedback.jsx';

const doc = { name: 'report.md', nodeId: 'agent-1', kind: 'doc', downloadUrl: '/source' };
const feedback = {
  byArtifact: new Map(),
  pendingRevisions: new Map(),
  revisionErrors: new Map(),
  addComment: async () => {},
  deleteComment: async () => {},
  revise: async () => {},
  saveManual: async () => {},
};

function Fixture() {
  const { locale, setLocale } = useI18n();
  return (
    <>
      <select aria-label="fixture language" value={locale} onChange={(event) => setLocale(event.target.value)}>
        <option value="en">en</option>
        <option value="zh-CN">zh</option>
      </select>
      <FeedbackDrawer doc={doc} runId="run-1" feedback={feedback} onClose={() => {}} />
    </>
  );
}

createRoot(document.getElementById('root')).render(
  <I18nProvider>
    <Fixture />
  </I18nProvider>,
);
