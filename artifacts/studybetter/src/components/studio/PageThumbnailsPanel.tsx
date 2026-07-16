import { useState, useRef, useEffect, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import {
  Trash2, RotateCcw, ChevronDown, ChevronLeft,
  PanelRightOpen, PanelRightClose,
} from "lucide-react";
import { useAnnotationStore } from "../../stores/annotationStore";
import { getAnnotationFile } from "../../lib/annotationStorage";
import { useConfirm } from "../ConfirmDialog";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

const THUMB_WIDTH = 110;
const CONFIRM_MSG = "سيُستثنى من التصدير النهائي، الملف الأصلي يبقى محفوظاً";

interface PageThumbnailsPanelProps {
  fileId: string;
  fileUrl: string;
  numPages: number;
  currentPage: number;
  onNavigate: (page: number) => void;
}

function ThumbnailItem({
  fileId,
  pageNumber,
  isActive,
  isDeleted,
  onNavigate,
  onDelete,
  onRestore,
  canDelete,
}: {
  fileId: string;
  pageNumber: number;
  isActive: boolean;
  isDeleted: boolean;
  onNavigate: () => void;
  onDelete: () => void;
  onRestore: () => void;
  canDelete: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const { confirm } = useConfirm();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); io.disconnect(); } },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (await confirm({ message: CONFIRM_MSG })) onDelete();
  };

  const handleRestore = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRestore();
  };

  return (
    <div
      ref={ref}
      onClick={isDeleted ? undefined : onNavigate}
      style={{
        ...thumbItemStyle,
        border: isActive && !isDeleted ? "2px solid var(--app-accent)" : "2px solid transparent",
        opacity: isDeleted ? 0.45 : 1,
        cursor: isDeleted ? "default" : "pointer",
      }}
    >
      <div style={thumbPageNumStyle}>{pageNumber}</div>
      <div style={thumbCanvasWrap}>
        {visible && (
          <Page
            pageNumber={pageNumber}
            width={THUMB_WIDTH}
            renderTextLayer={false}
            renderAnnotationLayer={false}
            loading={<div style={{ ...thumbCanvasWrap, background: "var(--app-border)", borderRadius: 4 }} />}
          />
        )}
      </div>
      <div style={thumbActionsStyle}>
        {isDeleted ? (
          <button onClick={handleRestore} style={thumbActionBtnStyle} title="استرجاع الصفحة">
            <RotateCcw size={13} />
          </button>
        ) : (
          <button
            onClick={handleDelete}
            style={{ ...thumbActionBtnStyle, color: "var(--app-red)" }}
            title="حذف الصفحة"
            disabled={!canDelete}
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

export default function PageThumbnailsPanel({
  fileId,
  fileUrl,
  numPages,
  currentPage,
  onNavigate,
}: PageThumbnailsPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [deletedExpanded, setDeletedExpanded] = useState(false);

  const deletedPages = useAnnotationStore((s) => s.deletedPages);
  const deletePage = useAnnotationStore((s) => s.deletePage);
  const restorePage = useAnnotationStore((s) => s.restorePage);
  const loadDeletedPages = useAnnotationStore((s) => s.loadDeletedPages);

  useEffect(() => {
    loadDeletedPages();
  }, [fileId, loadDeletedPages]);

  const activePages: number[] = [];
  const deleted: number[] = [];
  for (let p = 1; p <= numPages; p++) {
    if (deletedPages.includes(p)) deleted.push(p);
    else activePages.push(p);
  }
  const canDelete = activePages.length > 1;

  const handleDelete = useCallback(async (page: number) => {
    try { await deletePage(page); } catch { /* user sees error via confirm */ }
  }, [deletePage]);

  const handleRestore = useCallback(async (page: number) => {
    try { await restorePage(page); } catch { /* silently fail */ }
  }, [restorePage]);

  if (collapsed) {
    return (
      <button onClick={() => setCollapsed(false)} style={expandBtnStyle} title="إظهار المصغرات">
        <PanelRightOpen size={18} />
      </button>
    );
  }

  return (
    <div style={panelStyle}>
      <div style={panelHeaderStyle}>
        <span style={{ fontWeight: 600, fontSize: 13 }}>الصفحات</span>
        <button onClick={() => setCollapsed(true)} style={collapseBtnStyle} title="إخفاء المصغرات">
          <PanelRightClose size={16} />
        </button>
      </div>

      <Document file={fileUrl}>
        {/* Active pages */}
        <div style={thumbListStyle}>
          {activePages.map((pg) => (
            <ThumbnailItem
              key={pg}
              fileId={fileId}
              pageNumber={pg}
              isActive={pg === currentPage}
              isDeleted={false}
              onNavigate={() => onNavigate(pg)}
              onDelete={() => handleDelete(pg)}
              onRestore={() => handleRestore(pg)}
              canDelete={canDelete}
            />
          ))}
        </div>

        {/* Deleted pages section */}
        {deleted.length > 0 && (
          <div style={deletedSectionStyle}>
            <button
              onClick={() => setDeletedExpanded((v) => !v)}
              style={deletedToggleStyle}
            >
              <span>صفحات محذوفة ({deleted.length})</span>
              {deletedExpanded ? <ChevronDown size={14} /> : <ChevronLeft size={14} />}
            </button>
            {deletedExpanded && (
              <div style={thumbListStyle}>
                {deleted.map((pg) => (
                  <ThumbnailItem
                    key={pg}
                    fileId={fileId}
                    pageNumber={pg}
                    isActive={false}
                    isDeleted={true}
                    onNavigate={() => {}}
                    onDelete={() => {}}
                    onRestore={() => handleRestore(pg)}
                    canDelete={false}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </Document>
    </div>
  );
}

// ── Styles ──

const panelStyle: React.CSSProperties = {
  width: 160,
  background: "var(--app-card)",
  borderRight: "1px solid var(--app-border)",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  flexShrink: 0,
};

const panelHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "8px 10px",
  borderBottom: "1px solid var(--app-border)",
  fontFamily: "IBM Plex Sans Arabic, sans-serif",
};

const thumbListStyle: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: 6,
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const thumbItemStyle: React.CSSProperties = {
  position: "relative",
  borderRadius: 6,
  overflow: "hidden",
  background: "var(--app-bg)",
  transition: "border .12s",
};

const thumbPageNumStyle: React.CSSProperties = {
  position: "absolute",
  top: 2,
  left: 4,
  fontSize: 10,
  fontWeight: 700,
  color: "var(--app-muted)",
  background: "rgba(255,255,255,0.8)",
  borderRadius: 3,
  padding: "1px 4px",
  zIndex: 1,
};

const thumbCanvasWrap: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
  padding: "4px 0",
  minHeight: THUMB_WIDTH * 1.414 + 8,
};

const thumbActionsStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
  padding: "2px 0 4px",
};

const thumbActionBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 24,
  height: 24,
  borderRadius: 4,
  border: "none",
  background: "transparent",
  color: "var(--app-muted)",
  cursor: "pointer",
};

const deletedSectionStyle: React.CSSProperties = {
  borderTop: "1px solid var(--app-border)",
};

const deletedToggleStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  width: "100%",
  padding: "8px 10px",
  border: "none",
  background: "transparent",
  color: "var(--app-text)",
  fontFamily: "IBM Plex Sans Arabic, sans-serif",
  fontSize: 12,
  cursor: "pointer",
};

const expandBtnStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 36,
  background: "var(--app-card)",
  borderRight: "1px solid var(--app-border)",
  border: "none",
  borderLeft: "1px solid var(--app-border)",
  color: "var(--app-text)",
  cursor: "pointer",
  flexShrink: 0,
  alignSelf: "stretch",
};

const collapseBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 24,
  height: 24,
  borderRadius: 4,
  border: "none",
  background: "transparent",
  color: "var(--app-muted)",
  cursor: "pointer",
};
