import { useEffect, useRef, useState } from 'react';
import { Minus, Plus, RotateCcw } from 'lucide-react';
import PdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker&inline';
import { loadPreviewArrayBuffer, previewErrorMessage } from '../index.js';

let workerConfigured = false;

export default function PdfRenderer({ document, locale, t }) {
  const containerRef = useRef(null);
  const [status, setStatus] = useState({ loading: true, error: null });
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    let task;
    setStatus({ loading: true, error: null });

    async function render() {
      const pdfjs = await import('pdfjs-dist');
      if (!workerConfigured) {
        const worker = new PdfWorker();
        pdfjs.GlobalWorkerOptions.workerPort = worker;
        workerConfigured = true;
      }
      const data = await loadPreviewArrayBuffer(document.previewUrl, { signal: controller.signal });
      task = pdfjs.getDocument({ data });
      const pdf = await task.promise;
      const root = containerRef.current;
      if (!root || cancelled) return;
      root.replaceChildren();
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        if (cancelled) return;
        const page = await pdf.getPage(pageNumber);
        const unscaled = page.getViewport({ scale: 1, rotation });
        const maxWidth = Math.max(320, Math.min(root.clientWidth - 32, 1440));
        const viewport = page.getViewport({ scale: (maxWidth / unscaled.width) * scale, rotation });
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        const canvas = window.document.createElement('canvas');
        canvas.className = 'dsh-doc-preview-pdf-page';
        canvas.width = Math.floor(viewport.width * pixelRatio);
        canvas.height = Math.floor(viewport.height * pixelRatio);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        root.appendChild(canvas);
        await page.render({
          canvasContext: canvas.getContext('2d'), viewport,
          transform: pixelRatio === 1 ? undefined : [pixelRatio, 0, 0, pixelRatio, 0, 0],
        }).promise;
        page.cleanup();
      }
    }

    render().catch((reason) => {
      if (!cancelled && reason?.name !== 'AbortError') setStatus({ loading: false, error: reason });
    }).finally(() => {
      if (!cancelled) setStatus((current) => ({ ...current, loading: false }));
    });
    return () => {
      cancelled = true;
      controller.abort();
      task?.destroy();
      containerRef.current?.replaceChildren();
    };
  }, [document.previewUrl, rotation, scale]);

  return <div className="dsh-doc-preview-renderer">
    <div className="dsh-doc-preview-renderer-tools" aria-label={t('pdf.controls')}>
      <button type="button" onClick={() => setScale((value) => Math.max(.5, value - .25))} disabled={scale <= .5} title={t('pdf.zoomOut')} aria-label={t('pdf.zoomOut')}><Minus aria-hidden="true" /></button>
      <span>{Math.round(scale * 100)}%</span>
      <button type="button" onClick={() => setScale((value) => Math.min(2, value + .25))} disabled={scale >= 2} title={t('pdf.zoomIn')} aria-label={t('pdf.zoomIn')}><Plus aria-hidden="true" /></button>
      <button type="button" onClick={() => setRotation((value) => (value + 90) % 360)} title={t('pdf.rotate')} aria-label={t('pdf.rotate')}><RotateCcw className="is-clockwise" aria-hidden="true" /></button>
    </div>
    <div className="dsh-doc-preview-scroll dsh-doc-preview-pdf">
      {status.loading && <div className="dsh-doc-preview-message">{t('pdf.loading')}</div>}
      {status.error && <div className="dsh-doc-preview-message is-error">{previewErrorMessage(status.error, locale)}</div>}
      <div ref={containerRef} className="dsh-doc-preview-pdf-pages" />
    </div>
  </div>;
}
