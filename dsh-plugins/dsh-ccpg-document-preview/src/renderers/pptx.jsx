import { useEffect, useRef, useState } from 'react';
import { Minus, Plus, Presentation } from 'lucide-react';
import PptxWorker from '@file-viewer/pptx/worker/pptx.worker.js?worker&inline';
import { loadPreviewArrayBuffer, previewErrorMessage } from '../index.js';

export default function PptxRenderer({ document, locale, t }) {
  const containerRef = useRef(null);
  const [status, setStatus] = useState({ loading: true, error: null });
  const [viewerState, setViewerState] = useState({ viewer: null, zoom: 100, slides: 0, warnings: 0 });

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    let viewer;
    const root = containerRef.current;
    setStatus({ loading: true, error: null });
    setViewerState({ viewer: null, zoom: 100, slides: 0, warnings: 0 });
    Promise.all([
      import('@file-viewer/pptx'), import('@file-viewer/pptx/styles.css'),
      loadPreviewArrayBuffer(document.previewUrl, { signal: controller.signal }),
    ]).then(async ([pptx, _styles, data]) => {
      if (!root || cancelled) return;
      root.replaceChildren();
      let warningCount = 0;
      viewer = await pptx.PptxViewer.open(data, root, {
        fitMode: 'contain', zoomPercent: 100,
        workerFactory: () => new PptxWorker(),
        onWarning: () => { warningCount += 1; },
      });
      if (!cancelled) setViewerState({ viewer, zoom: viewer.zoomPercent, slides: viewer.slideCount, warnings: warningCount });
    }).catch((reason) => {
      if (!cancelled && reason?.name !== 'AbortError') setStatus({ loading: false, error: reason });
    }).finally(() => {
      if (!cancelled) setStatus((current) => ({ ...current, loading: false }));
    });
    return () => {
      cancelled = true;
      controller.abort();
      viewer?.destroy();
      root?.replaceChildren();
    };
  }, [document.previewUrl]);

  const setZoom = async (zoom) => {
    const next = Math.max(50, Math.min(200, zoom));
    await viewerState.viewer?.setZoom(next);
    setViewerState((current) => ({ ...current, zoom: next }));
  };

  return <div className="dsh-doc-preview-renderer">
    <div className="dsh-doc-preview-renderer-tools" aria-label={t('pptx.controls')}>
      <button type="button" disabled={!viewerState.viewer || viewerState.zoom <= 50} onClick={() => setZoom(viewerState.zoom - 10)} title={t('pptx.zoomOut')} aria-label={t('pptx.zoomOut')}><Minus aria-hidden="true" /></button>
      <span>{viewerState.zoom}%</span>
      <button type="button" disabled={!viewerState.viewer || viewerState.zoom >= 200} onClick={() => setZoom(viewerState.zoom + 10)} title={t('pptx.zoomIn')} aria-label={t('pptx.zoomIn')}><Plus aria-hidden="true" /></button>
      <button type="button" disabled={!viewerState.viewer} onClick={() => viewerState.viewer?.enterPresentation()} title={t('pptx.present')} aria-label={t('pptx.present')}><Presentation aria-hidden="true" /></button>
      {viewerState.slides > 0 && <span>{t('pptx.slides', { count: viewerState.slides })}</span>}
      {viewerState.warnings > 0 && <span className="is-warning">{t('pptx.warning')}</span>}
    </div>
    <div className="dsh-doc-preview-scroll dsh-doc-preview-pptx">
      {status.loading && <div className="dsh-doc-preview-message">{t('pptx.loading')}</div>}
      {status.error && <div className="dsh-doc-preview-message is-error">{previewErrorMessage(status.error, locale)}</div>}
      <div ref={containerRef} className="dsh-doc-preview-pptx-body" />
    </div>
  </div>;
}
