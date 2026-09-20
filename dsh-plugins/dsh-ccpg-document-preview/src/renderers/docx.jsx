import { useEffect, useRef, useState } from 'react';
import { loadPreviewArrayBuffer, previewErrorMessage } from '../index.js';

export default function DocxRenderer({ document, locale, t }) {
  const containerRef = useRef(null);
  const [status, setStatus] = useState({ loading: true, error: null });

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    const root = containerRef.current;
    setStatus({ loading: true, error: null });
    Promise.all([import('docx-preview'), loadPreviewArrayBuffer(document.previewUrl, { signal: controller.signal })])
      .then(([docx, data]) => {
        if (!root || cancelled) return;
        root.replaceChildren();
        return docx.renderAsync(data, root, root, {
          breakPages: true, className: 'dsh-docx', ignoreLastRenderedPageBreak: false,
          inWrapper: true, useBase64URL: true, renderAltChunks: false, renderComments: false,
        });
      }).catch((reason) => {
        if (!cancelled && reason?.name !== 'AbortError') setStatus({ loading: false, error: reason });
      }).finally(() => {
        if (!cancelled) setStatus((current) => ({ ...current, loading: false }));
      });
    return () => {
      cancelled = true;
      controller.abort();
      root?.replaceChildren();
    };
  }, [document.previewUrl]);

  return <div className="dsh-doc-preview-scroll dsh-doc-preview-docx">
    {status.loading && <div className="dsh-doc-preview-message">{t('docx.loading')}</div>}
    {status.error && <div className="dsh-doc-preview-message is-error">{previewErrorMessage(status.error, locale)}</div>}
    <div ref={containerRef} className="dsh-doc-preview-docx-body" />
  </div>;
}
