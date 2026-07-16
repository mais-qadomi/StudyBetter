import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { Document, pdfjs } from "react-pdf";
import PdfPage from "./PdfPage";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

interface PdfCanvasViewerProps {
  fileId: string;
  fileUrl: string;
  numPages: number;
  deletedPages: number[];
  pageWidth: number;
  onCurrentPageChange: (page: number) => void;
  scrollToPage: number | null;
}

const PAGE_GAP = 12;
const BUFFER = 1;

export default function PdfCanvasViewer({
  fileId,
  fileUrl,
  numPages,
  deletedPages,
  pageWidth,
  onCurrentPageChange,
  scrollToPage,
}: PdfCanvasViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pageHeightsRef = useRef<Map<number, number>>(new Map());
  const pageTopRef = useRef<Map<number, number>>(new Map());
  const [visibleRange, setVisibleRange] = useState<[number, number]>([1, Math.min(3, numPages)]);
  const [, forceRender] = useState(0);

  const estimatedHeight = useMemo(() => pageWidth * 1.414, [pageWidth]);

  const deletedSet = useMemo(() => new Set(deletedPages), [deletedPages]);

  const recalculatePositions = useCallback(() => {
    const map = pageHeightsRef.current;
    let top = 0;
    for (let i = 1; i <= numPages; i++) {
      if (deletedSet.has(i)) continue;
      pageTopRef.current.set(i, top);
      top += (map.get(i) ?? estimatedHeight) + PAGE_GAP;
    }
  }, [numPages, estimatedHeight, deletedSet]);

  const handleHeightMeasured = useCallback((pageNumber: number, height: number) => {
    const prev = pageHeightsRef.current.get(pageNumber);
    if (prev !== undefined && Math.abs(prev - height) < 1) return;
    pageHeightsRef.current.set(pageNumber, height);
    recalculatePositions();
    forceRender((n) => n + 1);
  }, [recalculatePositions]);

  useEffect(() => {
    recalculatePositions();
  }, [numPages, recalculatePositions]);

  // Scroll-based visibility calculation
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const calculate = () => {
      const scrollTop = container.scrollTop;
      const viewportHeight = container.clientHeight;
      const tops = pageTopRef.current;
      const heights = pageHeightsRef.current;

      let firstVisible = 1;
      let lastVisible = 1;

      for (let i = 1; i <= numPages; i++) {
        const top = tops.get(i) ?? (i - 1) * (estimatedHeight + PAGE_GAP);
        const h = heights.get(i) ?? estimatedHeight;
        if (top + h > scrollTop) {
          firstVisible = i;
          break;
        }
      }

      for (let i = firstVisible; i <= numPages; i++) {
        const top = tops.get(i) ?? (i - 1) * (estimatedHeight + PAGE_GAP);
        lastVisible = i;
        if (top > scrollTop + viewportHeight) break;
      }

      const range: [number, number] = [
        Math.max(1, firstVisible - BUFFER),
        Math.min(numPages, lastVisible + BUFFER),
      ];
      setVisibleRange((prev) =>
        prev[0] === range[0] && prev[1] === range[1] ? prev : range,
      );

      // Update current page for header display
      let current = 1;
      for (let i = numPages; i >= 1; i--) {
        const top = tops.get(i) ?? (i - 1) * (estimatedHeight + PAGE_GAP);
        if (scrollTop >= top - 50) {
          current = i;
          break;
        }
      }
      onCurrentPageChange(current);
    };

    calculate();
    container.addEventListener("scroll", calculate, { passive: true });
    const ro = new ResizeObserver(calculate);
    ro.observe(container);
    return () => {
      container.removeEventListener("scroll", calculate);
      ro.disconnect();
    };
  }, [numPages, estimatedHeight, onCurrentPageChange]);

  // Scroll to specific page
  useEffect(() => {
    if (scrollToPage == null || scrollToPage < 1 || scrollToPage > numPages) return;
    const container = containerRef.current;
    if (!container) return;
    const top = pageTopRef.current.get(scrollToPage);
    if (top != null) {
      container.scrollTo({ top, behavior: "smooth" });
    }
  }, [scrollToPage, numPages]);

  // Recalculate on zoom (pageWidth change)
  useEffect(() => {
    recalculatePositions();
    forceRender((n) => n + 1);
  }, [pageWidth, recalculatePositions]);

  // Total scroll height
  const totalHeight = useMemo(() => {
    const tops = pageTopRef.current;
    const heights = pageHeightsRef.current;
    // Find the last non-deleted page
    let lastPage = numPages;
    while (lastPage >= 1 && deletedSet.has(lastPage)) lastPage--;
    if (lastPage < 1) return 0;
    const lastTop = tops.get(lastPage);
    const lastHeight = heights.get(lastPage) ?? estimatedHeight;
    if (lastTop != null) return lastTop + lastHeight + PAGE_GAP;
    return (lastPage) * (estimatedHeight + PAGE_GAP);
  }, [numPages, estimatedHeight, visibleRange, deletedSet]);

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        overflowY: "auto",
        overflowX: "hidden",
        background: "var(--app-bg)",
      }}
    >
      <div style={{ height: totalHeight, position: "relative" }}>
        <Document file={fileUrl}>
          {Array.from({ length: numPages }, (_, i) => {
            const pg = i + 1;
            if (deletedSet.has(pg)) return null;
            const top = pageTopRef.current.get(pg) ?? i * (estimatedHeight + PAGE_GAP);
            const isVisible = pg >= visibleRange[0] && pg <= visibleRange[1];
            const h = pageHeightsRef.current.get(pg) ?? estimatedHeight;

            return (
              <div
                key={pg}
                style={{
                  position: "absolute",
                  top,
                  left: 0,
                  right: 0,
                  height: h,
                }}
              >
                {isVisible ? (
                  <PdfPage
                    fileId={fileId}
                    pageNumber={pg}
                    width={pageWidth}
                    onHeightMeasured={handleHeightMeasured}
                  />
                ) : null}
              </div>
            );
          })}
        </Document>
      </div>
    </div>
  );
}
