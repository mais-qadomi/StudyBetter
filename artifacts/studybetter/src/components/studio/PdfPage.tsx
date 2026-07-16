import { useRef, useEffect, useState, useCallback } from "react";
import { Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import AnnotationInteraction from "./AnnotationInteraction";
import { useAnnotationStore } from "../../stores/annotationStore";
import { storeExtractedText } from "../../lib/pdfTextCache";
import { extractPageTextFromItems } from "../../lib/pdf-text-extract";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

interface PdfPageProps {
  fileId: string;
  pageNumber: number;
  width: number;
  onHeightMeasured: (pageNumber: number, height: number) => void;
}

export default function PdfPage({
  fileId,
  pageNumber,
  width,
  onHeightMeasured,
}: PdfPageProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [displaySize, setDisplaySize] = useState<{ w: number; h: number } | null>(null);

  const handlePageLoadSuccess = useCallback(
    async (page: any) => {
      const viewport = page.getViewport({ scale: 1 });
      const h = (viewport.height / viewport.width) * width;
      onHeightMeasured(pageNumber, h);

      // Extract text and cache it for auto-explain
      try {
        const content = await page.getTextContent();
        const items = content.items.filter(
          (item: any) => "str" in item && item.str.trim(),
        );
        const viewport = page.getViewport({ scale: 1 });
        const { fullText, segments } = extractPageTextFromItems(
          items as any,
          viewport.width,
          viewport.height,
        );
        if (fullText) {
          storeExtractedText(fileId, pageNumber, fullText, segments);
        }
      } catch {
        // Text extraction failure is non-fatal
      }
    },
    [pageNumber, width, onHeightMeasured, fileId],
  );

  const handleRenderSuccess = useCallback(() => {
    if (!wrapperRef.current) return;
    const canvas = wrapperRef.current.querySelector("canvas");
    if (canvas) {
      setDisplaySize({
        w: canvas.offsetWidth,
        h: canvas.offsetHeight,
      });
    }
  }, []);

  return (
    <div
      ref={wrapperRef}
      style={{
        position: "relative",
        width,
        margin: "0 auto",
      }}
    >
      <Page
        pageNumber={pageNumber}
        width={width}
        renderTextLayer
        renderAnnotationLayer={false}
        onLoadSuccess={handlePageLoadSuccess}
        onRenderSuccess={handleRenderSuccess}
        loading={
          <div
            style={{
              width,
              height: width * 1.414,
              background: "var(--app-border)",
              borderRadius: 4,
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          />
        }
        error={
          <div
            style={{
              width,
              height: width * 1.414,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--app-accent-bg)",
              borderRadius: 4,
              color: "var(--app-red)",
              fontFamily: "IBM Plex Sans Arabic, sans-serif",
            }}
          >
            فشل تحميل الصفحة {pageNumber}
          </div>
        }
      />
      {displaySize && (
        <AnnotationInteraction
          fileId={fileId}
          pageNumber={pageNumber}
          width={displaySize.w}
          height={displaySize.h}
        />
      )}
      <style>{`
        .react-pdf__Page { background: transparent !important; }
        .react-pdf__Page canvas { display: block; }
        @keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:.7} }
      `}</style>
    </div>
  );
}
