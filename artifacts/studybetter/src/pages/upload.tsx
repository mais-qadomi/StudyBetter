import { useState, useCallback, useRef, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { useRoute, useLocation } from "wouter";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import {
  getOrCreateSessionId,
  savePdfToIDB,
  loadPdfFromIDB,
  deletePdfFromIDB,
  clearSessionId,
  apiGetSession,
  apiSaveSession,
  apiSavePage,
  apiDeleteSession,
  apiGetProjects,
  apiGetProject,
  apiAssignSessionToProject,
  apiAssignSessionToFolder,
  cacheSessionInProject,
  type StoredPageResult,
  type StoredSession,
  type Project,
  type Folder,
} from "../lib/storage";
import { callExplain, type PageResultUI } from "../lib/explain";
import { classifyPage, capturePageCanvas, type PageType } from "../lib/pdf-page-analyzer";
import { Folder as FolderIcon, FolderOpen as FolderOpenIcon, ChevronLeft, Loader2, Trash2, CheckCircle, Rocket, AlertTriangle, FileUp, Paperclip, Globe, GraduationCap, RefreshCw, Sparkles, ArrowRight, Lightbulb, StickyNote, TriangleAlert, Zap, Image } from "lucide-react";
import { useApp } from "../App";
import { useToast } from "../stores/toastStore";
import { DragOverlay } from "../components/DragOverlay";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

const MAX_FILE_MB = 100;
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;
const DELAY_BETWEEN_PAGES_MS = 6000;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const C = {
  bg: "var(--app-bg-page-alt)",
  card: "var(--app-card)",
  cardBorder: "var(--app-card-border)",
  title: "var(--app-primary)",
  backBtn: { bg: "var(--app-accent-bg)", border: "var(--app-accent-light)", color: "var(--app-primary)" },
  drop: { border: "var(--app-primary-light)", borderActive: "var(--app-primary-light)", bg: "var(--app-accent-bg)", bgActive: "var(--app-accent-bg)" },
  dropText: "var(--app-primary)",
  dropSub: "var(--app-muted)",
  uploadBtn: { bg: "linear-gradient(135deg, var(--app-primary-light), var(--app-primary))", shadow: "rgba(99,102,241,0.45)" },
  fileName: "var(--app-text)",
  pageLabel: "var(--app-accent)",
  textBox: { bg: "var(--app-primary-bg-light)", border: "var(--app-card-border)", color: "var(--app-text)", label: "var(--app-muted)" },
  loadingText: "var(--app-primary)",
  errorText: "var(--app-red)",
  accent: "var(--app-accent)",
  accentBg: "var(--app-accent-bg)",
  accentLight: "var(--app-accent-light)",
  text: "var(--app-text)",
  muted: "var(--app-muted)",
};
const S = {
  page: {
    minHeight: "100vh",
    background: C.bg,
    fontFamily: "'Segoe UI', Tahoma, sans-serif",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    padding: "2rem 1rem",
    boxSizing: "border-box" as const,
  },
  header: {
    width: "100%",
    maxWidth: "860px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "1rem",
    flexWrap: "wrap" as const,
    gap: "0.5rem",
  },
  title: {
    fontSize: "clamp(1.2rem, 4vw, 1.8rem)",
    fontWeight: 800,
    color: C.title,
    margin: 0,
    textShadow: "0 2px 12px rgba(100,160,220,0.25)",
  },
  backBtn: {
    background: C.backBtn.bg,
    border: `1px solid ${C.backBtn.border}`,
    color: C.backBtn.color,
    borderRadius: "10px",
    padding: "0.5rem 1.2rem",
    fontSize: "0.9rem",
    cursor: "pointer",
    fontWeight: 600,
  },
  explainAllBtn: (busy: boolean) => ({
    width: "100%",
    maxWidth: "860px",
    background: busy ? "rgba(176,140,232,0.35)" : "linear-gradient(135deg, #c8a8f0, #a880e8)",
    color: "#fff",
    border: "none",
    borderRadius: "14px",
    padding: "0.85rem 2rem",
    fontSize: "1rem",
    fontWeight: 700,
    cursor: busy ? "not-allowed" : "pointer",
    boxShadow: "0 6px 20px rgba(168,128,232,0.35)",
    marginBottom: "1rem",
    transition: "opacity 0.2s",
  }),
  progressBar: {
    width: "100%",
    maxWidth: "860px",
    marginBottom: "1.5rem",
    background: "rgba(255,255,255,0.7)",
    borderRadius: "12px",
    padding: "0.8rem 1.2rem",
    border: "1px solid #d8c8f0",
    boxShadow: "0 2px 10px rgba(168,128,232,0.15)",
    textAlign: "center" as const,
  },
  dropZone: (active: boolean) => ({
    width: "100%",
    maxWidth: "860px",
    border: `2px dashed ${active ? C.drop.borderActive : C.drop.border}`,
    borderRadius: "20px",
    padding: "3rem 2rem",
    textAlign: "center" as const,
    background: active ? C.drop.bgActive : C.drop.bg,
    cursor: "pointer",
    transition: "all 0.2s ease",
    marginBottom: "1.5rem",
    boxShadow: "0 4px 20px rgba(168,208,240,0.2)",
  }),
  uploadIcon: { fontSize: "3rem", marginBottom: "1rem" },
  dropText: { color: C.dropText, fontSize: "1.1rem", marginBottom: "0.5rem", fontWeight: 600 },
  dropSub: { color: C.dropSub, fontSize: "0.85rem" },
  uploadBtn: {
    background: C.uploadBtn.bg,
    color: "#fff",
    border: "none",
    borderRadius: "12px",
    padding: "0.75rem 2rem",
    fontSize: "1rem",
    fontWeight: 700,
    cursor: "pointer",
    marginTop: "1rem",
    boxShadow: `0 6px 20px ${C.uploadBtn.shadow}`,
  },
  fileName: { color: C.fileName, fontSize: "0.9rem", marginTop: "0.75rem" },
  pagesWrapper: {
    width: "100%",
    maxWidth: "860px",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: "2rem",
  },
  pageCard: {
    background: C.card,
    border: `1px solid ${C.cardBorder}`,
    borderRadius: "20px",
    overflow: "hidden",
    boxShadow: "0 8px 30px rgba(168,200,240,0.25)",
    width: "100%",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
  },
  pageLabel: {
    color: C.pageLabel,
    fontSize: "0.78rem",
    padding: "0.6rem 0 0.4rem",
    letterSpacing: "1px",
    fontWeight: 600,
  },
  textBox: {
    width: "100%",
    boxSizing: "border-box" as const,
    padding: "1rem 1.2rem",
    background: C.textBox.bg,
    borderTop: `1px solid ${C.textBox.border}`,
  },
  textLabel: {
    fontSize: "0.72rem",
    color: C.textBox.label,
    fontWeight: 700,
    letterSpacing: "1px",
    marginBottom: "0.5rem",
  },
  textArea: {
    width: "100%",
    boxSizing: "border-box" as const,
    minHeight: "80px",
    padding: "0.6rem 0.8rem",
    background: "var(--app-card)",
    border: `1px solid ${C.textBox.border}`,
    borderRadius: "8px",
    fontSize: "0.82rem",
    color: C.textBox.color,
    lineHeight: 1.6,
    resize: "vertical" as const,
    fontFamily: "inherit",
    direction: "auto" as never,
  },
  loadingText: { color: C.loadingText, fontSize: "1rem", marginTop: "3rem" },
};

function parseInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\[EN\].*?\[\/EN\]|\[EX\].*?\[\/EX\])/gs);
  return parts.map((part, i) => {
    const enMatch = /\[EN\](.*?)\[\/EN\]/s.exec(part);
    if (enMatch) return (
      <span key={i} style={{
        background: "var(--app-content-en-bg)", color: "var(--app-content-en-text)",
        borderRadius: "5px", padding: "1px 7px",
        fontSize: "0.82rem", fontWeight: 600,
        direction: "ltr", display: "inline-block",
        margin: "0 2px",
      }}>{enMatch[1].trim()}</span>
    );
    const exMatch = /\[EX\](.*?)\[\/EX\]/s.exec(part);
    if (exMatch) return (
      <span key={i} style={{
        background: "var(--app-content-example-bg)", color: "var(--app-content-example-text)",
        borderRadius: "6px", padding: "2px 8px",
        fontSize: "0.82rem", fontStyle: "italic",
        display: "inline",
      }}><Lightbulb size={14} style={{ display: "inline", verticalAlign: "middle" }} /> {exMatch[1].trim()}</span>
    );
    return <span key={i}>{part}</span>;
  });
}

function FormattedText({ text }: { text: string }) {
  const cleaned = text.replace(/[^\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFFa-zA-Z0-9\s\[\]\/\.\,\:\;\!\?\(\)\-\/\+\=\%\*\n📌⚡🔹💡📝]/g, "");
  const blocks = cleaned.split(/(\[H\].*?\[\/H\]|\[NOTE\].*?\[\/NOTE\]|\[PIN\].*?\[\/PIN\]|\[SUM\].*?\[\/SUM\])/gs); return (
    <div style={{ direction: "rtl", fontFamily: "'Segoe UI', Tahoma, sans-serif" }}>
      {blocks.map((block, idx) => {
        const hMatch = /\[H\](.*?)\[\/H\]/s.exec(block);
        if (hMatch) return (
          <div key={idx} style={{
            display: "flex", alignItems: "center", gap: "8px",
            margin: "1.2rem 0 0.6rem",
            paddingBottom: "0.5rem",
            borderBottom: "1.5px solid var(--app-content-heading-border)",
          }}>
            <div style={{
              width: "26px", height: "26px", borderRadius: "50%",
              background: "var(--app-content-heading-bg)", color: "#fff",
              fontSize: "0.75rem", fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}><ChevronLeft size={16} /></div>
            <p style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "var(--app-content-heading-text)" }}>
              {parseInline(hMatch[1].trim())}
            </p>
          </div>
        );

        const noteMatch = /\[NOTE\](.*?)\[\/NOTE\]/s.exec(block);
        if (noteMatch) return (
          <div key={idx} style={{
            background: "var(--app-content-note-bg)", border: "0.5px solid var(--app-content-note-border)",
            borderRadius: "10px", padding: "0.7rem 1rem",
            margin: "0.6rem 0", fontSize: "0.85rem",
            color: "var(--app-content-note-text)", lineHeight: 1.8,
          }}>
            <strong style={{ color: "var(--app-content-note-strong)", display: "inline-flex", alignItems: "center", gap: "4px" }}><StickyNote size={16} /> ملاحظة: </strong>
            {parseInline(noteMatch[1].trim())}
          </div>
        );

        const pinMatch = /\[PIN\](.*?)\[\/PIN\]/s.exec(block);
        if (pinMatch) return (
          <div key={idx} style={{
            background: "var(--app-content-exam-bg)",
            borderRight: "3px solid var(--app-content-exam-border)",
            borderRadius: "0 10px 10px 0",
            padding: "0.7rem 1rem",
            margin: "0.6rem 0", fontSize: "0.85rem",
            color: "var(--app-content-exam-text)", lineHeight: 1.8,
          }}>
            <strong style={{ color: "var(--app-content-exam-strong)", display: "inline-flex", alignItems: "center", gap: "4px" }}><TriangleAlert size={16} /> تنبيه امتحان: </strong>
            {parseInline(pinMatch[1].trim())}
          </div>
        );

        const sumMatch = /\[SUM\](.*?)\[\/SUM\]/s.exec(block);
        if (sumMatch) return (
          <div key={idx} style={{
            background: "var(--app-content-summary-bg)", border: "0.5px solid var(--app-content-summary-border)",
            borderRadius: "12px", padding: "1rem 1.2rem",
            margin: "1rem 0",
          }}>
            <p style={{ margin: "0 0 0.6rem", fontSize: "0.9rem", fontWeight: 700, color: "var(--app-content-summary-text)", display: "flex", alignItems: "center", gap: "6px" }}><Zap size={18} /> ملخص سريع</p>
            {sumMatch[1].trim().split(/\n|•|\*/).filter(s => s.trim()).map((item, i) => (
              <div key={i} style={{ display: "flex", gap: "8px", marginBottom: "0.3rem", fontSize: "0.84rem", color: "var(--app-content-summary-item)" }}>
                <span style={{ color: "var(--app-content-summary-bullet)", flexShrink: 0 }}>▸</span>
                <span>{parseInline(item.trim())}</span>
              </div>
            ))}
          </div>
        );

        if (!block.trim()) return null;
        return (
          <p key={idx} style={{ margin: "0 0 0.6rem", fontSize: "0.88rem", lineHeight: 1.9, color: "var(--app-content-paragraph)" }}>
            {parseInline(block)}
          </p>
        );
      })}
    </div>
  );
}

function PageWithText({
  pageNumber, numPages, width,
  result, explaining, savedText,
  onTextReady, onExplain,
}: {
  pageNumber: number;
  numPages: number;
  width: number;
  result: PageResultUI | null;
  explaining: boolean;
  savedText: string;
  onTextReady: (pageNum: number, text: string, pageType?: PageType, imageDataUrl?: string) => void;
  onExplain: (pageNum: number, imageDataUrl?: string) => void;
}) {
  const [text, setText] = useState<string>(savedText);
  const [pageType, setPageType] = useState<PageType | null>(null);
  const imageDataRef = useRef<string | null>(null);
  const pageWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (savedText && !text) setText(savedText);
  }, [savedText]);

  const handlePageLoad = useCallback(async (page: pdfjs.PDFPageProxy) => {
    try {
      const analysis = await classifyPage(page, pageNumber);
      setPageType(analysis.type);
      const content = await page.getTextContent();
      const extracted = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .replace(/[^\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFFa-zA-Z0-9\s\.\,\:\;\!\?\(\)\-\/\+\=\%\@\#\$\&\*\[\]\{\}\"\'\\n]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      setText(extracted);
      onTextReady(pageNumber, extracted, analysis.type, undefined);
    } catch {
      const fallback = "تعذّر استخراج النص من هذه الصفحة.";
      setText(fallback);
      setPageType("image");
      onTextReady(pageNumber, fallback, "image", undefined);
    }
  }, [pageNumber, onTextReady]);

  const handleRenderSuccess = useCallback(() => {
    if (pageWrapperRef.current) {
      imageDataRef.current = capturePageCanvas(pageWrapperRef.current);
    }
  }, []);

  const displayText = text || savedText;
  const isVision = pageType === "image" || pageType === "mixed";

  return (
    <div style={S.pageCard}>
      <p style={S.pageLabel}>
        صفحة {pageNumber} من {numPages}
        {pageType === "image" && <span style={{ marginRight: "8px", background: "var(--app-accent-bg)", color: "var(--app-accent)", padding: "1px 6px", borderRadius: "4px", fontSize: "0.7rem", fontWeight: 700 }}><Image size={12} style={{ verticalAlign: "middle" }} /> صورة</span>}
        {pageType === "mixed" && <span style={{ marginRight: "8px", background: "var(--app-accent-bg)", color: "var(--app-accent)", padding: "1px 6px", borderRadius: "4px", fontSize: "0.7rem", fontWeight: 700 }}><Image size={12} style={{ verticalAlign: "middle" }} /> مختلط</span>}
      </p>
      <div ref={pageWrapperRef}>
        <Page
          pageNumber={pageNumber}
          width={width}
          renderTextLayer
          renderAnnotationLayer
          onLoadSuccess={handlePageLoad}
          onRenderSuccess={handleRenderSuccess}
        />
      </div>
      <div style={S.textBox}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
          <p style={{ ...S.textLabel, margin: 0 }}>النص المستخرج</p>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {result?.explanation && !explaining && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "0.72rem", color: "var(--app-green)", fontWeight: 700 }}><CheckCircle size={14} /> محفوظ</span>
            )}
            <button
              onClick={() => {
                if (!imageDataRef.current && pageWrapperRef.current) imageDataRef.current = capturePageCanvas(pageWrapperRef.current);
                onExplain(pageNumber, imageDataRef.current ?? undefined);
              }}
              disabled={(!displayText && !isVision) || explaining}
              style={{
                background: explaining
                  ? "var(--app-accent-bg)"
                  : "linear-gradient(135deg, var(--app-accent-light), var(--app-accent))",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                padding: "0.35rem 0.9rem",
                fontSize: "0.8rem",
                fontWeight: 700,
                cursor: (!displayText && !isVision) || explaining ? "not-allowed" : "pointer",
                boxShadow: "0 3px 12px rgba(99,102,241,0.35)",
                whiteSpace: "nowrap" as const,
              }}
            >
              {explaining ? <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> جاري الشرح…</span> : result?.explanation ? <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}><RefreshCw size={14} /> أعد الشرح</span> : <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}><Sparkles size={14} /> {isVision ? "اشرح بالصورة" : "اشرح هذا المحتوى"}</span>}
            </button>
          </div>
        </div>

        <textarea
          readOnly
          value={displayText || (isVision ? "(هذه الصفحة تحتوي على صور — سيتم تحليلها كصورة)" : "جاري استخراج النص…")}
          style={S.textArea}
        />

        {result?.error && (
          <div style={{ marginTop: "0.8rem", padding: "0.9rem 1rem", background: "var(--app-error-bg)", border: "1px solid var(--app-error-border)", borderRadius: "8px" }}>
            <p style={{ ...S.textLabel, margin: "0 0 0.4rem", color: "var(--app-error-text)" }}>خطأ</p>
            <p style={{ margin: 0, fontSize: "0.88rem", lineHeight: 1.8, color: "var(--app-error-text)", direction: "rtl" }}>{result.error}</p>
          </div>
        )}

        {result?.translation && (
          <div style={{ marginTop: "0.8rem", padding: "0.9rem 1rem", background: "var(--app-content-summary-bg)", border: "1px solid var(--app-content-summary-border)", borderRadius: "8px" }}>
            <p style={{ ...S.textLabel, margin: "0 0 0.6rem", color: "var(--app-content-summary-text)", display: "flex", alignItems: "center", gap: "6px" }}><Globe size={14} /> الترجمة</p>
            <FormattedText text={result.translation} />
          </div>
        )}

        {result?.explanation && (
          <div style={{ marginTop: "0.8rem", padding: "0.9rem 1rem", background: "var(--app-content-example-bg)", border: "1px solid var(--app-content-example-border)", borderRadius: "8px" }}>
            <p style={{ ...S.textLabel, margin: "0 0 0.6rem", color: "var(--app-content-example-text)", display: "flex", alignItems: "center", gap: "6px" }}><GraduationCap size={14} /> الشرح الأكاديمي</p>
            <FormattedText text={result.explanation} />
          </div>
        )}
      </div>
    </div>
  );
}

function ProjectTree({
  projects, selectedProjectId, selectedFolderId,
  expandedProjects, projectFolders, loadingFolders,
  onToggleProject, onSelectProject, onSelectFolder,
}: {
  projects: Project[];
  selectedProjectId: string;
  selectedFolderId: string;
  expandedProjects: Set<string>;
  projectFolders: Record<string, Folder[]>;
  loadingFolders: Set<string>;
  onToggleProject: (id: string) => void;
  onSelectProject: (id: string) => void;
  onSelectFolder: (projectId: string, folderId: string) => void;
}) {
  const treeStyle: React.CSSProperties = {
    width: "100%", maxWidth: "860px", marginBottom: "1rem",
  };
  const headerStyle: React.CSSProperties = {
    fontSize: "0.9rem", fontWeight: 700, color: C.title,
    display: "block", marginBottom: "0.5rem",
  };
  const projectBtnStyle = (active: boolean): React.CSSProperties => ({
    display: "flex", alignItems: "center", gap: "6px",
    width: "100%", padding: "0.5rem 0.8rem",
    border: active ? "2px solid " + C.accent : "1.5px solid var(--app-card-border)",
    borderRadius: "8px", background: active ? C.accentBg : "var(--app-card)",
    cursor: "pointer", fontSize: "0.85rem", fontFamily: "inherit",
    fontWeight: active ? 700 : 500, color: C.title,
    textAlign: "right", transition: "all 0.12s",
    boxSizing: "border-box" as const,
  });
  const folderBtnStyle = (active: boolean, depth: number): React.CSSProperties => ({
    display: "flex", alignItems: "center", gap: "5px",
    width: "100%", padding: "0.35rem 0.7rem",
    marginRight: (depth * 1.5) + "rem",
    border: active ? "2px solid " + C.accentLight : "none",
    borderRadius: "6px", background: active ? C.accentBg : "transparent",
    cursor: "pointer", fontSize: "0.8rem", fontFamily: "inherit",
    fontWeight: active ? 600 : 400, color: active ? C.accent : C.text,
    textAlign: "right", transition: "all 0.12s",
    boxSizing: "border-box" as const,
  });
  const expandBtn: React.CSSProperties = {
    background: "none", border: "none", cursor: "pointer",
    fontSize: "0.7rem", color: C.muted, padding: "0 4px",
    fontFamily: "inherit",
  };

  return (
    <div style={treeStyle}>
      <span style={{ ...headerStyle, display: "inline-flex", alignItems: "center", gap: "6px" }}><FolderIcon size={18} /> اختاري مشروعاً (اختياري)</span>
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <button
          onClick={() => onSelectProject("")}
          style={projectBtnStyle(selectedProjectId === "" && selectedFolderId === "")}
        >
          <FolderOpenIcon size={18} />
          <span>— بدون مشروع —</span>
        </button>
        {projects.map(p => {
          const isExpanded = expandedProjects.has(p.id);
          const folders = projectFolders[p.id];
          const isLoading = loadingFolders.has(p.id);
          const hasFolders = folders && folders.length > 0;
          const projectSelected = selectedProjectId === p.id && !selectedFolderId;
          return (
            <div key={p.id}>
              <div style={{ display: "flex", alignItems: "center", gap: "2px" }}>
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleProject(p.id); }}
                  style={{
                    ...expandBtn,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <ChevronLeft size={18} style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s" }} />
                </button>
                <button
                  onClick={() => onSelectProject(p.id)}
                  style={{ ...projectBtnStyle(projectSelected), border: projectSelected ? "2px solid " + C.accent : "1.5px solid var(--app-card-border)" }}
                  onMouseOver={e => { if (!projectSelected) e.currentTarget.style.borderColor = C.accentLight; }}
                  onMouseOut={e => { if (!projectSelected) e.currentTarget.style.borderColor = "var(--app-card-border)"; }}
                >
                  <FolderIcon size={18} />
                  <span>{p.name}</span>
                  {hasFolders && <span style={{ fontSize: "0.68rem", color: C.muted, background: "var(--app-bg)", padding: "0 6px", borderRadius: "6px" }}>{folders.length}</span>}
                  {isLoading && <Loader2 size={14} style={{ animation: "spin 1s linear infinite", color: C.muted }} />}
                </button>
              </div>
              {isExpanded && (
                <div style={{ marginTop: "3px" }}>
                  {isLoading && !folders && (
                    <p style={{ margin: "0.2rem 1.5rem", fontSize: "0.75rem", color: C.muted, display: "flex", alignItems: "center", gap: "6px" }}><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> جاري تحميل المجلدات…</p>
                  )}
                  {!isLoading && folders && folders.length === 0 && (
                    <p style={{ margin: "0.2rem 1.5rem", fontSize: "0.75rem", color: C.muted }}>لا توجد مجلدات</p>
                  )}
                  {hasFolders && folders
                    .sort((a, b) => a.order - b.order)
                    .map(f => (
                      <button
                        key={f.id}
                        onClick={() => onSelectFolder(p.id, f.id)}
                        style={folderBtnStyle(selectedFolderId === f.id, 1)}
                        onMouseOver={e => { if (selectedFolderId !== f.id) e.currentTarget.style.background = C.accentBg + "60"; }}
                        onMouseOut={e => { if (selectedFolderId !== f.id) e.currentTarget.style.background = "transparent"; }}
                      >
                        <FolderOpenIcon size={16} />
                        <span>{f.name}</span>
                      </button>
                    ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function UploadPage() {
  const [, navigate] = useLocation();
  const [, params] = useRoute("/upload/:sessionId?");
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [selectedFolderId, setSelectedFolderId] = useState<string>("");
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [projectFolders, setProjectFolders] = useState<Record<string, Folder[]>>({});
  const [loadingFolders, setLoadingFolders] = useState<Set<string>>(new Set());
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string>("");
  const [numPages, setNumPages] = useState<number>(0);
  const [dragActive, setDragActive] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const sessionIdRef = useRef<string>("");

  const [pageTexts, setPageTexts] = useState<Record<number, string>>({});
  const [pageResults, setPageResults] = useState<Record<number, PageResultUI>>({});
  const [explaining, setExplaining] = useState<Set<number>>(new Set());
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null);

  const pageTextsRef = useRef<Record<number, string>>({});
  const pageTypesRef = useRef<Record<number, "text" | "image" | "mixed">>({});
  useEffect(() => {
    void apiGetProjects().then(list => {
      setProjects(list);
      const urlProjectId = new URLSearchParams(window.location.search).get("projectId");
      const urlFolderId = new URLSearchParams(window.location.search).get("folderId");
      if (urlProjectId && list.some(p => p.id === urlProjectId)) {
        setSelectedProjectId(urlProjectId);
      }
      if (urlFolderId) setSelectedFolderId(urlFolderId);
    });
  }, []);
  useEffect(() => {
    const restore = async () => {
      try {
        const sessionId = params?.sessionId || getOrCreateSessionId();
        sessionIdRef.current = sessionId;
        const data = await apiGetSession(sessionId);
        if (!data) { setRestoring(false); return; }

        const pdfFile = await loadPdfFromIDB(sessionId);
        if (!pdfFile) { setRestoring(false); return; }

        const texts: Record<number, string> = {};
        const results: Record<number, PageResultUI> = {};
        for (const p of data.pages) {
          if (p.extractedText) texts[p.pageNumber] = p.extractedText;
          if (p.explanation) {
            results[p.pageNumber] = {
              translation: p.translation ?? null,
              explanation: p.explanation,
              error: "",
            };
          }
        }
        pageTextsRef.current = texts;
        setPageTexts(texts);
        setPageResults(results);
        setFile(new File([pdfFile], data.session.fileName, { type: "application/pdf" }));
        setNumPages(data.session.numPages);
        setSelectedProjectId(data.session.projectId ?? "");
        const url = URL.createObjectURL(pdfFile);
        setFileUrl(url);
      } catch {
        /* ignore restoration errors */
      } finally {
        setRestoring(false);
      }
    };
    void restore();
  }, []);

  const toggleProject = useCallback(async (projectId: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
        return next;
      }
      next.add(projectId);
      return next;
    });
    if (!projectFolders[projectId]) {
      setLoadingFolders(prev => new Set(prev).add(projectId));
      const data = await apiGetProject(projectId);
      if (data) {
        setProjectFolders(prev => ({ ...prev, [projectId]: data.folders }));
      }
      setLoadingFolders(prev => { const n = new Set(prev); n.delete(projectId); return n; });
    }
  }, [projectFolders]);

  const handleSelectProject = useCallback((projectId: string) => {
    setSelectedProjectId(projectId);
    setSelectedFolderId("");
  }, []);

  const handleSelectFolder = useCallback((projectId: string, folderId: string) => {
    setSelectedProjectId(projectId);
    setSelectedFolderId(folderId);
  }, []);

  const { setSidebarOpen } = useApp();
  const addToast = useToast(s => s.addToast);

  const loadFile = useCallback(async (f: File) => {
    if (!f.type.includes("pdf")) {
      addToast("يرجى اختيار ملف PDF فقط", "error");
      return;
    }
    if (f.size > MAX_FILE_BYTES) {
      setFileError(`حجم الملف (${(f.size / 1024 / 1024).toFixed(1)} MB) يتجاوز الحد الأقصى المسموح به (${MAX_FILE_MB} MB). الرجاء اختيار ملف أصغر حجماً.`);
      addToast(`حجم الملف يتجاوز ${MAX_FILE_MB} MB`, "error");
      return;
    }
    setFileError("");
    if (fileUrl) URL.revokeObjectURL(fileUrl);
    const url = URL.createObjectURL(f);
    setFileUrl(url);
    setFile(f);
    setNumPages(0);
    setPageTexts({});
    setPageResults({});
    setExplaining(new Set());
    setBulkProgress(null);
    pageTextsRef.current = {};

    const sessionId = params?.sessionId || crypto.randomUUID();
    sessionIdRef.current = sessionId;
    await savePdfToIDB(sessionId, f);
    await apiSaveSession(sessionId, f.name, f.size, 0);
    if (selectedProjectId) {
      await apiAssignSessionToProject(sessionId, selectedProjectId);
    }
    if (selectedFolderId) {
      await apiAssignSessionToFolder(sessionId, selectedFolderId);
    }
    const session: StoredSession = {
      id: sessionId,
      fileName: f.name,
      fileSize: f.size,
      numPages: 0,
      projectId: selectedProjectId || null,
      folderId: selectedFolderId || null,
    };
    cacheSessionInProject(selectedProjectId, session);
    setSidebarOpen(true);
    navigate("/");
  }, [fileUrl, selectedProjectId, selectedFolderId, navigate, setSidebarOpen]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer.files[0];
    if (f) void loadFile(f);
  }, [loadFile]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) void loadFile(f);
  };

  const handleNumPages = useCallback(async (n: number) => {
    setNumPages(n);
    const sid = sessionIdRef.current;
    if (sid) {
      const f = file;
      if (f) await apiSaveSession(sid, f.name, f.size, n);
    }
  }, [file]);

  const handleTextReady = useCallback((pageNum: number, text: string, pageType?: "text" | "image" | "mixed") => {
    pageTextsRef.current[pageNum] = text;
    setPageTexts(prev => ({ ...prev, [pageNum]: text }));
    if (pageType) pageTypesRef.current[pageNum] = pageType;
    const sid = sessionIdRef.current;
    if (sid) {
      void apiSavePage(sid, pageNum, { extractedText: text });
    }
  }, []);

  const waitForPageText = useCallback(async (pageNum: number, maxWaitMs = 12000): Promise<string | null> => {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      const t = pageTextsRef.current[pageNum];
      if (t) return t;
      await sleep(400);
    }
    return null;
  }, []);

  const explainOnePage = useCallback(async (pageNum: number, imageDataUrl?: string) => {
    const text = pageTextsRef.current[pageNum] ?? "";
    if (!text && !imageDataUrl) {
      setPageResults(prev => ({
        ...prev,
        [pageNum]: { translation: null, explanation: "", error: "لم يُستخرج نص من هذه الصفحة. قد تكون الصفحة صورة فقط." },
      }));
      return;
    }
    setExplaining(prev => new Set(prev).add(pageNum));
    try {
      const result = await callExplain(text, imageDataUrl ? [imageDataUrl] : undefined);
      setPageResults(prev => ({ ...prev, [pageNum]: result }));
      const sid = sessionIdRef.current;
      if (sid) {
        void apiSavePage(sid, pageNum, {
          translation: result.translation ?? undefined,
          explanation: result.explanation,
        });
      }
    } catch (err: unknown) {
      setPageResults(prev => ({
        ...prev,
        [pageNum]: { translation: null, explanation: "", error: err instanceof Error ? err.message : "فشل الاتصال بالسيرفر" },
      }));
    } finally {
      setExplaining(prev => { const s = new Set(prev); s.delete(pageNum); return s; });
    }
  }, []);

  const handleExplainAll = useCallback(async () => {
    if (bulkProgress || numPages === 0) return;
    const toProcess: number[] = [];
    for (let i = 1; i <= numPages; i++) {
      if (!pageResults[i]?.explanation) toProcess.push(i);
    }
    if (toProcess.length === 0) return;
    const imagePages = toProcess.filter(pn => {
      const t = pageTypesRef.current[pn];
      const text = pageTextsRef.current[pn] ?? "";
      return (t === "image" || t === "mixed" || !text.trim()) && t !== "text";
    });
    const textPages = toProcess.filter(pn => !imagePages.includes(pn));
    for (let idx = 0; idx < textPages.length; idx++) {
      const pageNum = textPages[idx];
      setBulkProgress({ current: idx + 1, total: textPages.length });
      await explainOnePage(pageNum);
      if (idx < textPages.length - 1) await sleep(DELAY_BETWEEN_PAGES_MS);
    }
    setBulkProgress(null);
  }, [bulkProgress, numPages, pageResults, explainOnePage]);

  const handleReset = useCallback(async () => {
    const sid = sessionIdRef.current;
    if (sid) {
      await apiDeleteSession(sid);
      await deletePdfFromIDB(sid);
      clearSessionId();
      sessionIdRef.current = getOrCreateSessionId();
    }
    if (fileUrl) URL.revokeObjectURL(fileUrl);
    setFile(null);
    setFileUrl(null);
    setNumPages(0);
    setPageTexts({});
    setPageResults({});
    setExplaining(new Set());
    setBulkProgress(null);
    pageTextsRef.current = {};
  }, [fileUrl]);

  const [pageWidth, setPageWidth] = useState(() => Math.min(typeof window !== "undefined" ? window.innerWidth - 64 : 820, 820));
  useEffect(() => {
    const handler = () => setPageWidth(Math.min(window.innerWidth - 64, 820));
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  const isBulkBusy = bulkProgress !== null;
  const explainedCount = Object.values(pageResults).filter(r => r.explanation).length;
  const hasAnyResults = explainedCount > 0;
  const pendingPages = numPages > 0
    ? Array.from({ length: numPages }, (_, i) => i + 1).filter(i => !pageResults[i]?.explanation).length
    : 0;

  const [pageDragActive, setPageDragActive] = useState(false);
  const dragCounterRef = useRef(0);

  if (restoring) {
    return (
      <div dir="rtl" style={{ ...S.page, justifyContent: "center" }}>
        <p style={{ ...S.loadingText, display: "inline-flex", alignItems: "center", gap: "8px" }}><Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} /> جاري استعادة جلستك السابقة…</p>
      </div>
    );
  }

  const handlePageDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current++;
    if (e.dataTransfer.types.includes("Files")) setPageDragActive(true);
  }, []);

  const handlePageDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) setPageDragActive(false);
  }, []);

  const handlePageDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handlePageDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setPageDragActive(false);
    const f = e.dataTransfer.files[0];
    if (f) void loadFile(f);
  }, [loadFile]);

  return (
    <div dir="rtl" style={S.page}
      onDragEnter={handlePageDragEnter}
      onDragLeave={handlePageDragLeave}
      onDragOver={handlePageDragOver}
      onDrop={handlePageDrop}
    >
      <div style={S.header}>
        <h1 style={S.title}>رفع ملف PDF</h1>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {file && (
            <button
              style={{ ...S.backBtn, background: "var(--app-error-bg)", border: "1px solid var(--app-error-border)", color: "var(--app-error-text)" }}
              onClick={() => void handleReset()}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}><Trash2 size={16} /><span className="upload-btn-text"> مسح وبدء من جديد</span></span>
            </button>
          )}
          <button style={S.backBtn} onClick={() => navigate("/")}><span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}><ArrowRight size={16} /><span className="upload-btn-text"> الرئيسية</span></span></button>
        </div>
      </div>
      {!file && projects.length > 0 && (
        <ProjectTree
          projects={projects}
          selectedProjectId={selectedProjectId}
          selectedFolderId={selectedFolderId}
          expandedProjects={expandedProjects}
          projectFolders={projectFolders}
          loadingFolders={loadingFolders}
          onToggleProject={toggleProject}
          onSelectProject={handleSelectProject}
          onSelectFolder={handleSelectFolder}
        />
      )}
      {!file && (
        <div
          style={S.dropZone(dragActive)}
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
        >
          <FileUp size={48} style={{ display: "block", margin: "0 auto 1rem" }} />
          <p style={S.dropText}>اسحب ملف PDF هنا أو اضغط للاختيار</p>
          <p style={S.dropSub}>يدعم ملفات PDF فقط • الحد الأقصى: {MAX_FILE_MB} MB</p>
          <button style={S.uploadBtn} onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}>
            اختر ملفاً
          </button>
          <input ref={inputRef} type="file" accept="application/pdf" style={{ display: "none" }} onChange={onFileChange} />
        </div>
      )}

      {file && (
        <div style={{
          width: "100%",
          maxWidth: "860px",
          marginBottom: "1rem",
          padding: "0.75rem 1.2rem",
          background: "rgba(255,255,255,0.75)",
          border: "1px solid #c8e0f4",
          borderRadius: "12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap" as const,
          gap: "0.5rem",
        }}>
          <p style={{ margin: 0, color: C.fileName, fontWeight: 600, fontSize: "0.9rem", display: "flex", alignItems: "center", gap: "6px" }}>
            <Paperclip size={16} /> {file.name}
          </p>
          <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
            {projects.length > 0 && (
              <ProjectTree
                projects={projects}
                selectedProjectId={selectedProjectId}
                selectedFolderId={selectedFolderId}
                expandedProjects={expandedProjects}
                projectFolders={projectFolders}
                loadingFolders={loadingFolders}
                onToggleProject={toggleProject}
                onSelectProject={(pid) => {
                  handleSelectProject(pid);
                  void apiAssignSessionToProject(sessionIdRef.current, pid || null);
                  void apiAssignSessionToFolder(sessionIdRef.current, null);
                }}
                onSelectFolder={(pid, fid) => {
                  handleSelectFolder(pid, fid);
                  void apiAssignSessionToProject(sessionIdRef.current, pid);
                  void apiAssignSessionToFolder(sessionIdRef.current, fid);
                }}
              />
            )}
            {hasAnyResults && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "0.8rem", color: "var(--app-green)", fontWeight: 700 }}>
                <CheckCircle size={16} /> {explainedCount} من {numPages} صفحة محفوظة
              </span>
            )}
            <button
              style={{
                ...S.backBtn,
                fontSize: "0.82rem",
                padding: "0.3rem 0.9rem",
                background: "var(--app-accent-bg)",
              }}
              onClick={() => inputRef.current?.click()}
            >
              تغيير الملف
            </button>
            <input ref={inputRef} type="file" accept="application/pdf" style={{ display: "none" }} onChange={onFileChange} />
          </div>
        </div>
      )}

      {fileError && (
        <div style={{ width: "100%", maxWidth: "860px", marginBottom: "1.5rem", padding: "1rem 1.2rem", background: "var(--app-error-bg)", border: "1px solid var(--app-error-border)", borderRadius: "14px" }}>
          <p style={{ margin: 0, color: "var(--app-error-text)", fontWeight: 600, fontSize: "0.95rem", display: "flex", alignItems: "center", gap: "6px" }}><AlertTriangle size={16} /> {fileError}</p>
        </div>
      )}

      {fileUrl && numPages > 0 && (
        <>
          <button
            style={S.explainAllBtn(isBulkBusy)}
            onClick={() => void handleExplainAll()}
            disabled={isBulkBusy || pendingPages === 0}
          >
            {isBulkBusy
              ? <span style={{ display: "inline-flex", alignItems: "center", gap: "8px", justifyContent: "center" }}><Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} /> جاري الشرح…</span>
              : pendingPages === 0
                ? <span style={{ display: "inline-flex", alignItems: "center", gap: "8px", justifyContent: "center" }}><CheckCircle size={18} /> جميع الصفحات مشروحة</span>
                : <span style={{ display: "inline-flex", alignItems: "center", gap: "8px", justifyContent: "center" }}><Rocket size={18} /> اشرح كل الصفحات {pendingPages < numPages ? `(${pendingPages} متبقية)` : ""}</span>}
          </button>

          {bulkProgress && (
            <div style={S.progressBar}>
              <p style={{ margin: "0 0 0.5rem", fontSize: "0.9rem", color: "var(--app-content-summary-text)", fontWeight: 700 }}>
                جاري شرح الصفحة {bulkProgress.current} من {bulkProgress.total}
              </p>
              <div style={{ background: "var(--app-accent-bg)", borderRadius: "8px", height: "10px", overflow: "hidden" }}>
                <div style={{
                  width: `${(bulkProgress.current / bulkProgress.total) * 100}%`,
                  background: "linear-gradient(90deg, var(--app-accent-light), var(--app-accent))",
                  height: "100%",
                  borderRadius: "8px",
                  transition: "width 0.4s ease",
                }} />
              </div>
            </div>
          )}
        </>
      )}

      {fileUrl && (
        <div style={S.pagesWrapper}>
          <Document
            file={fileUrl}
            onLoadSuccess={({ numPages: n }) => void handleNumPages(n)}
            loading={<p style={S.loadingText}>جاري تحميل الملف…</p>}
            error={<p style={{ ...S.loadingText, color: C.errorText }}>تعذّر تحميل الملف.</p>}
          >
            {Array.from({ length: numPages }, (_, i) => (
              <PageWithText
                key={i}
                pageNumber={i + 1}
                numPages={numPages}
                width={pageWidth}
                result={pageResults[i + 1] ?? null}
                explaining={explaining.has(i + 1)}
                savedText={pageTexts[i + 1] ?? ""}
                onTextReady={handleTextReady}
                onExplain={explainOnePage}
              />
            ))}
          </Document>
        </div>
      )}

      <DragOverlay visible={pageDragActive} />
      <style>{`
        .react-pdf__Page { background: transparent !important; }
        .react-pdf__Page canvas { display: block; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @media (max-width: 480px) {
          .upload-btn-text { display: none; }
        }
      `}</style>
    </div>
  );
}
