import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { DocumentPreviewDialog } from 'dsh-ccpg-document-preview/react';
import 'dsh-ccpg-document-preview/styles.css';

const documents = {
  markdown: { name: 'report.md', mimeType: 'text/markdown', previewUrl: '/fixtures/report.md', downloadUrl: '/fixtures/report.md' },
  pdf: { name: 'report.pdf', mimeType: 'application/pdf', previewUrl: '/fixtures/report.pdf', downloadUrl: '/fixtures/report.pdf' },
  sheet: { name: 'report.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', previewUrl: '/fixtures/report.xlsx', downloadUrl: '/fixtures/report.xlsx' },
  pptx: { name: 'report.pptx', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', previewUrl: '/fixtures/report.pptx', downloadUrl: '/fixtures/report.pptx' },
};

function Fixture() {
  const [locale, setLocale] = useState('en');
  const [kind, setKind] = useState(() => new URLSearchParams(window.location.search).get('kind') || 'markdown');
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  return <>
    <label>Fixture language <select aria-label="Fixture language" value={locale} onChange={(event) => setLocale(event.target.value)}><option value="en">English</option><option value="zh-CN">简体中文</option></select></label>
    <label>Fixture renderer <select aria-label="Fixture renderer" value={kind} onChange={(event) => setKind(event.target.value)}><option value="markdown">Markdown</option><option value="pdf">PDF</option><option value="sheet">Spreadsheet</option><option value="pptx">PowerPoint</option></select></label>
    <DocumentPreviewDialog document={documents[kind]} />
  </>;
}

createRoot(document.getElementById('root')).render(<Fixture />);
