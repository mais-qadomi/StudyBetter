import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRoute, useLocation } from "wouter";
import {
  loadPdfFromIDB,
  apiGetSession,
  type StoredSession,
} from "../lib/storage";
import PdfCanvasViewer from "../components/studio/PdfCanvasViewer";
import ZoomControls from "../components/studio/ZoomControls";
import AnnotationToolbar from "../components/studio/AnnotationToolbar";
import AiExplanationEditor from "../components/studio/AiExplanationEditor";
import PageThumbnailsPanel from "../components/studio/PageThumbnailsPanel";
import { useAnnotationStore } from "../stores/annotationStore";
import { ArrowRight, Loader2, AlertTriangle, Undo2, Redo2, Check } from "lucide-react";

const ZOOM_STEP = 0.25;
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 4;

export default function StudioPage() {
  const [, params] = useRoute("/files/:fileId/studio");
  const [, navigate] = useLocation();
  const fileId = params?.fileId;

  const [file, setFile] = useState<File | null>(null);
  const [session, setSession] = useState<StoredSession | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fileUrl = useMemo(() => (file ? URL.createObjectURL(file) : ""), [file]);
  useEffect(() => {
    return () => { if (fileUrl) URL.revokeObjectURL(fileUrl); };
  }, [fileUrl]);

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [fitToWidth, setFitToWidth] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [scrollToPage, setScrollToPage] = useState<number | null>(null);
  const [showThumbnails, setShowThumbnails] = useState(true);
  const [savedIndicator, setSavedIndicator] = useState(false);

  const baseWidth = containerWidth > 0 ? containerWidth - (showThumbnails ? 148 : 16) : 600;

  // Show saved indicator briefly when annotations change
  const elementsByPage = useAnnotationStore((s) => s.elementsByPage);
  const elementCount = Object.values(elementsByPage).reduce((sum, arr) => sum + arr.length, 0);
  useEffect(() => {
    if (!loading && elementCount > 0) {
      setSavedIndicator(true);
      const t = setTimeout(() => setSavedIndicator(false), 2000);
      return () => { clearTimeout(t); };
    }
    return undefined;
  }, [elementCount, loading]);
  const pageWidth = Math.round(baseWidth * zoomLevel);
  const zoomPercent = fitToWidth ? 100 : zoomLevel * 100;

  // Store
  const setFileId = useAnnotationStore((s) => s.setFileId);
  const loadAll = useAnnotationStore((s) => s.loadAll);
  const undo = useAnnotationStore((s) => s.undo);
  const redo = useAnnotationStore((s) => s.redo);
  const canUndo = useAnnotationStore((s) => s.canUndo);
  const canRedo = useAnnotationStore((s) => s.canRedo);
  const selectedElementId = useAnnotationStore((s) => s.selectedElementId);
  const deleteElement = useAnnotationStore((s) => s.deleteElement);
  const setTool = useAnnotationStore((s) => s.setTool);
  const deletedPages = useAnnotationStore((s) => s.deletedPages);

  // Load file from IndexedDB
  useEffect(() => {
    if (!fileId) { navigate("/", { replace: true }); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      const data = await apiGetSession(fileId);
      if (cancelled) return;
      if (!data) { setError("الملف غير موجود"); setLoading(false); return; }
      setSession(data.session);
      setNumPages(data.session.numPages);

      const pdfFile = await loadPdfFromIDB(fileId);
      if (cancelled) return;
      if (!pdfFile) { setError("الملف غير موجود في التخزين المحلي"); setLoading(false); return; }
      setFile(pdfFile);

      // Initialize annotation store
      setFileId(fileId);
      await loadAll();

      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [fileId, navigate, setFileId, loadAll]);

  // Container width tracking
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width);
    });
    ro.observe(el);
    setContainerWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // Fit-to-width on container resize
  useEffect(() => {
    if (fitToWidth && containerWidth > 0) {
      setZoomLevel(1);
    }
  }, [containerWidth, fitToWidth]);

  const handleZoomIn = useCallback(() => {
    setFitToWidth(false);
    setZoomLevel((z) => Math.min(ZOOM_MAX, z + ZOOM_STEP));
  }, []);

  const handleZoomOut = useCallback(() => {
    setFitToWidth(false);
    setZoomLevel((z) => Math.max(ZOOM_MIN, z - ZOOM_STEP));
  }, []);

  const handleFitWidth = useCallback(() => {
    setFitToWidth(true);
    setZoomLevel(1);
  }, []);

  const handlePrevPage = useCallback(() => {
    const target = Math.max(1, currentPage - 1);
    setScrollToPage(target);
  }, [currentPage]);

  const handleNextPage = useCallback(() => {
    const target = Math.min(numPages, currentPage + 1);
    setScrollToPage(target);
  }, [currentPage, numPages]);

  const handleNavigateToPage = useCallback((page: number) => {
    setScrollToPage(page);
  }, []);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
      if (isInput) return;

      // Zoom
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "=" || e.key === "+") { e.preventDefault(); handleZoomIn(); return; }
        if (e.key === "-") { e.preventDefault(); handleZoomOut(); return; }
        if (e.key === "0") { e.preventDefault(); handleFitWidth(); return; }
        if (e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); return; }
        if (e.key === "z" && e.shiftKey) { e.preventDefault(); redo(); return; }
        if (e.key === "Z") { e.preventDefault(); redo(); return; }
      }

      // Delete
      if ((e.key === "Delete" || e.key === "Backspace") && selectedElementId) {
        e.preventDefault();
        deleteElement(selectedElementId);
        return;
      }

      // Tool shortcuts
      const toolMap: Record<string, string> = {
        v: "select", t: "text", i: "image", p: "pen",
        h: "highlighter", e: "eraser", s: "shape",
      };
      if (!e.ctrlKey && !e.metaKey && !e.altKey && toolMap[e.key]) {
        setTool(toolMap[e.key] as any);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleZoomIn, handleZoomOut, handleFitWidth, undo, redo, selectedElementId, deleteElement, setTool]);

  // ── Loading state ──
  if (loading) {
    return (
      <div style={centerStyle}>
        <Loader2 size={40} style={{ color: "var(--app-accent)", animation: "spin 1s linear infinite" }} />
        <p style={{ color: "var(--app-muted)", fontFamily: "IBM Plex Sans Arabic, sans-serif", marginTop: 12 }}>
          جاري تحميل الملف...
        </p>
      </div>
    );
  }

  // ── Error state ──
  if (error) {
    return (
      <div style={centerStyle}>
        <AlertTriangle size={40} style={{ color: "var(--app-red)" }} />
        <p style={{ color: "var(--app-red)", fontFamily: "IBM Plex Sans Arabic, sans-serif", marginTop: 12, fontSize: 16 }}>
          {error}
        </p>
        <button
          onClick={() => navigate(`/files/${fileId}`)}
          style={backBtnStyle}
        >
          العودة
        </button>
      </div>
    );
  }

  // ── Main render ──
  return (
    <div
      ref={containerRef}
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100dvh",
        background: "var(--app-bg)",
        fontFamily: "IBM Plex Sans Arabic, sans-serif",
      }}
    >
      {/* Header */}
      <div style={headerStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={() => navigate(`/files/${fileId}`)}
            style={backBtnStyle}
            title="العودة لملف"
          >
            <ArrowRight size={18} />
          </button>
          <span style={{ color: "var(--app-text)", fontWeight: 600, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "clamp(100px, 20vw, 250px)" }}>
            {session?.fileName ?? "استوديو التعليقات"}
          </span>
          {savedIndicator && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.7rem", color: "var(--app-green)", fontWeight: 600, opacity: 0.8 }}>
              <Check size={12} /> محفوظ
            </span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {/* Undo/Redo buttons */}
          <button
            onClick={undo}
            disabled={!canUndo()}
            style={{ ...backBtnStyle, opacity: canUndo() ? 1 : 0.35, cursor: canUndo() ? "pointer" : "not-allowed" }}
            title="تراجع (Ctrl+Z)"
          >
            <Undo2 size={16} />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo()}
            style={{ ...backBtnStyle, opacity: canRedo() ? 1 : 0.35, cursor: canRedo() ? "pointer" : "not-allowed" }}
            title="إعادة (Ctrl+Shift+Z)"
          >
            <Redo2 size={16} />
          </button>

          {/* Thumbnails toggle (mobile) */}
          <button
            onClick={() => setShowThumbnails(v => !v)}
            style={{ ...backBtnStyle, display: "none" }}
            className="studio-thumb-toggle"
            title="إظهار/إخفاء المصغرات"
          >
            <span style={{ fontSize: 12, fontWeight: 700 }}>📑</span>
          </button>

          <ZoomControls
            zoomPercent={zoomPercent}
            currentPage={currentPage}
            numPages={numPages}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onFitWidth={handleFitWidth}
            onPrevPage={handlePrevPage}
            onNextPage={handleNextPage}
          />
        </div>
      </div>

      {/* Annotation toolbar */}
      <AnnotationToolbar
        fileId={fileId!}
        numPages={numPages}
        currentPage={currentPage}
        deletedPages={deletedPages}
        sessionName={session?.fileName}
      />

      <AiExplanationEditor />

      {/* Main content: thumbnails panel + viewer */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {showThumbnails && (
          <PageThumbnailsPanel
            fileId={fileId!}
            fileUrl={fileUrl}
            numPages={numPages}
            currentPage={currentPage}
            onNavigate={handleNavigateToPage}
          />
        )}

        {/* Viewer */}
        {file && numPages > 0 && (
          <PdfCanvasViewer
            fileId={fileId!}
            fileUrl={fileUrl}
            numPages={numPages}
            deletedPages={deletedPages}
            pageWidth={pageWidth}
            onCurrentPageChange={setCurrentPage}
            scrollToPage={scrollToPage}
          />
        )}
      </div>

      <style>{`
        @media (max-width: 768px) {
          .studio-thumb-toggle { display: flex !important; }
        }
      `}</style>
    </div>
  );
}

const centerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  height: "100dvh",
  background: "var(--app-bg)",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "8px 16px",
  borderBottom: "1px solid var(--app-border)",
  background: "var(--app-bg)",
  flexShrink: 0,
  gap: 12,
};

const backBtnStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 34,
  height: 34,
  borderRadius: 8,
  border: "1px solid var(--app-border)",
  background: "transparent",
  color: "var(--app-text)",
  cursor: "pointer",
};
