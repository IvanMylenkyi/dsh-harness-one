import React from 'react';
import { createRoot } from 'react-dom/client';
import { ReactFlowProvider } from '@xyflow/react';
import App from './App.jsx';
import { ToastProvider } from './ui.jsx';
import { I18nProvider } from './i18n/index.js';
import '@xyflow/react/dist/style.css';
import './styles.css';

createRoot(document.getElementById('root')).render(
    <React.StrictMode>
    <I18nProvider>
      <ReactFlowProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </ReactFlowProvider>
    </I18nProvider>
  </React.StrictMode>
);
