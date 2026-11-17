import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { useText } from "../../shared/i18n/HomeLocale.tsx";

/** Render private PDFs without relying on the browser's embedded PDF viewer. */
export default function PdfPreview({ url, title }: { url: string; title: string }) {
  return <PdfDocument key={url} url={url} title={title} />;
}

function PdfDocument({ url, title }: { url: string; title: string }) {
  const tr = useText();
  const container = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [width, setWidth] = useState(0);
  const [loadFailed, setLoadFailed] = useState(false);
  const [rendered, setRendered] = useState<{ page: number; width: number; failed: boolean } | null>(null);
  const current = rendered?.page === page && rendered.width === width;
  const failed = loadFailed || (current && rendered.failed);
  const loading = !failed && (!document || !current);

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(container.current!);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let task: ReturnType<typeof import("pdfjs-dist").getDocument> | undefined;
    async function load() {
      try {
        const [pdfjs, response] = await Promise.all([
          import("pdfjs-dist"),
          fetch(url, { signal: controller.signal, credentials: "same-origin" }),
        ]);
        if (!response.ok) throw new Error("PDF request failed");
        const data = await response.arrayBuffer();
        if (controller.signal.aborted) return;
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
        task = pdfjs.getDocument({ data, useSystemFonts: true, useWasm: false });
        task.onPassword = () => {
          if (!controller.signal.aborted) setLoadFailed(true);
          void task?.destroy();
        };
        const next = await task.promise;
        if (!controller.signal.aborted) setDocument(next);
      } catch {
        if (!controller.signal.aborted) {
          setLoadFailed(true);
        }
      }
    }
    void load();
    return () => {
      controller.abort();
      void task?.destroy();
    };
  }, [url]);

  useEffect(() => {
    if (!document || !width) return;
    let cancelled = false;
    let render: RenderTask | undefined;
    async function draw() {
      try {
        const pdfPage = await document!.getPage(page);
        if (cancelled) return;
        const element = canvas.current!;
        const scale = width / pdfPage.getViewport({ scale: 1 }).width;
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        const viewport = pdfPage.getViewport({ scale: scale * ratio });
        element.width = Math.ceil(viewport.width);
        element.height = Math.ceil(viewport.height);
        render = pdfPage.render({ canvas: element, viewport });
        await render.promise;
        if (!cancelled) setRendered({ page, width, failed: false });
      } catch {
        if (!cancelled) {
          setRendered({ page, width, failed: true });
        }
      }
    }
    void draw();
    return () => {
      cancelled = true;
      render?.cancel();
    };
  }, [document, page, width]);

  return (
    <section className="pdf-reader" aria-label={title} aria-busy={loading}>
      <div className="pdf-reader-pages" ref={container}>
        {loading && <p role="status">{tr("Chargement du document…")}</p>}
        {failed && <p role="alert">{tr("Aperçu indisponible. Vous pouvez télécharger le document.")}</p>}
        <canvas ref={canvas} role="img" aria-label={title} hidden={loading || failed} />
      </div>
      {document && document.numPages > 1 && (
        <div className="pdf-reader-controls">
          <button type="button" className="button outline" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>
            {tr("Page précédente")}
          </button>
          <span aria-live="polite">{page} / {document.numPages}</span>
          <button type="button" className="button outline" disabled={page >= document.numPages || loading} onClick={() => setPage(page + 1)}>
            {tr("Page suivante")}
          </button>
        </div>
      )}
    </section>
  );
}
