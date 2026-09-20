import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nProvider, useI18n } from '../src/i18n/index.js';
import { ToastProvider } from '../src/ui.jsx';
import { ScheduleCenter } from '../src/ScheduleCenter.jsx';
import { VariableCenter } from '../src/VariableCenter.jsx';

function Fixture() {
  const { locale, setLocale, t } = useI18n();
  const [panel, setPanel] = useState('schedule');
  const toast = (text) => { const node = document.createElement('div'); node.textContent = text; node.dataset.fixtureToast = 'true'; document.body.appendChild(node); };
  return (
    <>
      <select aria-label="fixture language" value={locale} onChange={(event) => setLocale(event.target.value)}>
        <option value="en">en</option>
        <option value="zh-CN">zh</option>
      </select>
      <button type="button" onClick={() => setPanel('schedule')}>{t('menu.schedules')}</button>
      <button type="button" onClick={() => setPanel('variables')}>{t('menu.variables')}</button>
      {panel === 'schedule' && <ScheduleCenter onClose={() => {}} toast={toast} />}
      {panel === 'variables' && <VariableCenter onClose={() => {}} workflowVariables={[{ key: 'approval', label: 'Approval', type: 'string', required: true }]} inputSchema={{ fields: [{ key: 'request', label: 'Request', type: 'string', required: true }] }} />}
    </>
  );
}

createRoot(document.getElementById('root')).render(
  <I18nProvider>
    <ToastProvider>
      <Fixture />
    </ToastProvider>
  </I18nProvider>,
);
