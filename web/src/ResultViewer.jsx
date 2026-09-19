import { useState } from 'react';
import { Download, ExternalLink, Eye, FileText, Link2, Maximize2, PackageOpen } from 'lucide-react';
import { ArtifactNameLink, ArtifactPreviewButton } from './ArtifactPreview.jsx';
import { apiUrl } from './api.js';
import { useI18n } from './i18n/index.js';
import MarkdownDocument from './MarkdownDocument.jsx';
import { Modal } from './ui.jsx';

function fileArtifact(file) {
  if (file.url || file.downloadUrl || file.previewUrl) {
    return { ...file, downloadUrl: file.downloadUrl || file.url };
  }
  if (!file.nodeLabel || !file.path) return null;
  const base = apiUrl(`/artifact?node=${encodeURIComponent(file.nodeLabel)}&file=${encodeURIComponent(file.path)}`);
  return { ...file, previewUrl: `${base}&preview=1`, downloadUrl: base };
}

function FileList({ files }) {
  const { t } = useI18n();
  return (
    <div className="result-file-list">
      {files.map((file) => {
        const artifact = fileArtifact(file);
        if (!artifact) return (
          <div className="result-file result-file-disabled" key={file.id || file.path} title={t('result.fileUnavailable')}>
            <span className="result-file-name">{file.name}</span>
          </div>
        );
        return (
          <div className="result-file" key={file.id || `${file.nodeId || file.nodeLabel || ''}:${file.path}`}>
            <ArtifactNameLink artifact={artifact} className="result-file-name" />
            {file.nodeLabel && <span className="result-file-source">{file.nodeLabel}</span>}
            <ArtifactPreviewButton artifact={artifact} className="result-file-action">
              <Eye size={14} aria-hidden="true" />
            </ArtifactPreviewButton>
            <a className="result-file-action" href={artifact.downloadUrl} download title={t('result.downloadFile', { name: file.name })} aria-label={t('result.downloadFile', { name: file.name })}>
              <Download size={14} aria-hidden="true" />
            </a>
          </div>
        );
      })}
    </div>
  );
}

function LinkList({ links }) {
  return (
    <div className="result-link-list">
      {links.map((link) => (
        <a className="result-link" href={link.url} target="_blank" rel="noopener noreferrer" key={link.url}>
          <span>{link.label || link.url}</span>
          <ExternalLink size={13} aria-hidden="true" />
        </a>
      ))}
    </div>
  );
}

export function ResultViewer({
  title,
  coreText = '',
  files = [],
  links = [],
  artifacts = files,
  emptyText,
  legacyInferred = false,
}) {
  const { t } = useI18n();
  const displayTitle = title || t('result.finalOutput');
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="result-viewer">
      {files.length > 0 && (
        <section className="result-block result-deliverables">
          <div className="result-section-head">
            <PackageOpen size={15} />
            <h4>{t('result.files')}</h4>
            <span className="result-count">{files.length}</span>
          </div>
          <FileList files={files} />
        </section>
      )}

      <section className="result-block result-core">
        <div className="result-section-head">
          <FileText size={15} />
          <h4>{displayTitle}</h4>
          {legacyInferred && <span className="result-legacy-badge">{t('result.legacyInferred')}</span>}
          {coreText && (
            <button className="btn-icon result-expand-btn" title={t('result.expandPreview')} aria-label={t('result.expandPreview')} onClick={() => setExpanded(true)}>
              <Maximize2 size={14} />
            </button>
          )}
        </div>
        {coreText ? (
          <article className="result-markdown markdown-preview">
            <MarkdownDocument content={coreText} files={artifacts} />
          </article>
        ) : files.length === 0 ? <p className="result-empty result-final-empty">{emptyText || t('result.noSuccessfulOutput')}</p> : null}
      </section>
      {expanded && (
        <Modal title={displayTitle} className="result-expand-modal" onClose={() => setExpanded(false)}>
          <article className="result-markdown markdown-preview result-expand-body">
            <MarkdownDocument content={coreText} files={artifacts} />
          </article>
        </Modal>
      )}

      {links.length > 0 && (
        <section className="result-block">
          <div className="result-section-head">
            <Link2 size={15} />
            <h4>{t('result.links')}</h4>
            <span className="result-count">{links.length}</span>
          </div>
          <LinkList links={links} />
        </section>
      )}
    </div>
  );
}

export function ProcessArtifacts({ results = [], files = [], artifacts = files }) {
  const { t } = useI18n();
  const textResults = results.filter((row) => row.output);
  if (!textResults.length && !files.length) return null;
  return (
    <details className="result-process-artifacts">
      <summary>
        <span>{t('result.processOutput')}</span>
        <span>{textResults.length + files.length}</span>
      </summary>
      <div className="result-process-artifacts-body">
        {textResults.map((row) => (
          <details className="result-process-output" key={row.nodeId}>
            <summary>{row.nodeLabel}</summary>
            <article className="result-markdown markdown-preview">
              <MarkdownDocument content={row.output} files={artifacts} />
            </article>
          </details>
        ))}
        {files.length > 0 && (
          <section className="result-block">
            <div className="result-section-head">
              <FileText size={15} />
              <h4>{t('result.processFiles')}</h4>
              <span className="result-count">{files.length}</span>
            </div>
            <FileList files={files} />
          </section>
        )}
      </div>
    </details>
  );
}

export default ResultViewer;
