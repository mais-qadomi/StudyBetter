import { useRef, useState } from "react";
import {
  MousePointer2, Type, Image, Pen, Highlighter, Eraser,
  Square, Circle, Minus, ArrowRight,
  Undo2, Redo2, Trash2, Sparkles, Loader2 as Loader2Icon, Download, Share2, Copy, Check,
} from "lucide-react";
import { useAnnotationStore, type Tool } from "../../stores/annotationStore";
import type { ShapeType } from "../../lib/annotation-types";
import { exportAnnotatedPdf, triggerDownload, sanitizeFileName } from "../../lib/pdfExport";
import { createShareLink, type ShareResult } from "../../lib/share";

const SHAPE_OPTIONS: { type: ShapeType; icon: React.ReactNode; label: string }[] = [
  { type: "rectangle", icon: <Square size={16} />, label: "مستطيل" },
  { type: "ellipse", icon: <Circle size={16} />, label: "دائرة" },
  { type: "line", icon: <Minus size={16} />, label: "خط" },
  { type: "arrow", icon: <ArrowRight size={16} />, label: "سهم" },
];

const TOOLS: { id: Tool; icon: React.ReactNode; label: string; shortcut?: string }[] = [
  { id: "select", icon: <MousePointer2 size={18} />, label: "تحديد", shortcut: "V" },
  { id: "text", icon: <Type size={18} />, label: "نص", shortcut: "T" },
  { id: "image", icon: <Image size={18} />, label: "صورة", shortcut: "I" },
  { id: "pen", icon: <Pen size={18} />, label: "قلم", shortcut: "P" },
  { id: "highlighter", icon: <Highlighter size={18} />, label: "تمييز", shortcut: "H" },
  { id: "eraser", icon: <Eraser size={18} />, label: "ممحاة", shortcut: "E" },
  { id: "shape", icon: <Square size={18} />, label: "شكل", shortcut: "S" },
];

interface AnnotationToolbarProps {
  fileId: string;
  numPages: number;
  currentPage: number;
  deletedPages?: number[];
  sessionName?: string;
}

export default function AnnotationToolbar({ fileId, numPages, currentPage, deletedPages = [], sessionName }: AnnotationToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showExplainMenu, setShowExplainMenu] = useState(false);

  const tool = useAnnotationStore((s) => s.selectedTool);
  const shapeType = useAnnotationStore((s) => s.selectedShapeType);
  const setTool = useAnnotationStore((s) => s.setTool);
  const setShapeType = useAnnotationStore((s) => s.setShapeType);
  const undo = useAnnotationStore((s) => s.undo);
  const redo = useAnnotationStore((s) => s.redo);
  const canUndo = useAnnotationStore((s) => s.canUndo);
  const canRedo = useAnnotationStore((s) => s.canRedo);
  const selectedElementId = useAnnotationStore((s) => s.selectedElementId);
  const deleteElement = useAnnotationStore((s) => s.deleteElement);
  const saveIndicator = useAnnotationStore((s) => s.saveIndicator);
  const explainingPages = useAnnotationStore((s) => s.explainingPages);
  const explainErrors = useAnnotationStore((s) => s.explainErrors);
  const explainPage = useAnnotationStore((s) => s.explainPage);
  const explainAllPages = useAnnotationStore((s) => s.explainAllPages);

  const isExplaining = explainingPages.size > 0;
  const currentPageError = explainErrors[currentPage];
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState("");

  // Share state
  const [sharing, setSharing] = useState(false);
  const [shareResult, setShareResult] = useState<ShareResult | null>(null);
  const [shareError, setShareError] = useState("");
  const [copied, setCopied] = useState(false);

  const outputName = sessionName ?? "annotated.pdf";

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    window.dispatchEvent(
      new CustomEvent("annotation:paste-image", {
        detail: { blob: file, mimeType: file.type },
      }),
    );
    e.target.value = "";
  };

  const handleDelete = () => {
    if (selectedElementId) {
      deleteElement(selectedElementId);
    }
  };

  const handleExplainPage = () => {
    setShowExplainMenu(false);
    explainPage(currentPage, fileId, numPages);
  };

  const handleExplainAll = () => {
    setShowExplainMenu(false);
    explainAllPages(fileId, numPages);
  };

  const handleExport = async () => {
    if (exporting) return;
    const activePages = numPages - (deletedPages?.length ?? 0);
    if (activePages === 0) {
      setExportMsg("اختر صفحة واحدة على الأقل");
      setTimeout(() => setExportMsg(""), 3000);
      return;
    }
    setExporting(true);
    try {
      const blob = await exportAnnotatedPdf(
        fileId,
        { outputName },
        (msg) => setExportMsg(msg),
      );
      triggerDownload(blob, outputName);
      setExportMsg("تم التصدير بنجاح");
      setTimeout(() => setExportMsg(""), 3000);
    } catch (err: any) {
      setExportMsg(err?.message ?? "فشل التصدير");
      setTimeout(() => setExportMsg(""), 4000);
    } finally {
      setExporting(false);
    }
  };

  const handleShare = async () => {
    if (sharing) return;
    const activePages = numPages - (deletedPages?.length ?? 0);
    if (activePages === 0) {
      setShareError("اختر صفحة واحدة على الأقل");
      setTimeout(() => setShareError(""), 3000);
      return;
    }
    setSharing(true);
    setShareError("");
    setShareResult(null);
    try {
      const blob = await exportAnnotatedPdf(
        fileId,
        { outputName },
        (msg) => setShareError(msg),
      );
      const result = await createShareLink(blob, outputName, fileId);
      setShareResult(result);
    } catch (err: any) {
      setShareError(err?.message ?? "فشل إنشاء رابط المشاركة");
      setTimeout(() => setShareError(""), 4000);
    } finally {
      setSharing(false);
    }
  };

  const handleCopyLink = async () => {
    if (!shareResult) return;
    try {
      await navigator.clipboard.writeText(shareResult.shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select text
      const input = document.createElement("input");
      input.value = shareResult.shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const closeShareDialog = () => {
    setShareResult(null);
    setShareError("");
  };

  return (
    <div style={toolbarStyle}>
      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} } .spin { animation: spin 1s linear infinite; }`}</style>
      {/* Tools */}
      <div style={groupStyle}>
        {TOOLS.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              if (t.id === "image") {
                fileInputRef.current?.click();
              } else {
                setTool(t.id);
              }
            }}
            style={{
              ...toolBtnStyle,
              ...(tool === t.id ? activeToolStyle : {}),
            }}
            title={`${t.label}${t.shortcut ? ` (${t.shortcut})` : ""}`}
          >
            {t.icon}
          </button>
        ))}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleImageUpload}
        />
      </div>

      {/* Shape sub-toolbar */}
      {tool === "shape" && (
        <>
          <div style={separatorStyle} />
          <div style={groupStyle}>
            {SHAPE_OPTIONS.map((s) => (
              <button
                key={s.type}
                onClick={() => setShapeType(s.type)}
                style={{
                  ...toolBtnStyle,
                  ...(shapeType === s.type ? activeToolStyle : {}),
                }}
                title={s.label}
              >
                {s.icon}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Separator */}
      <div style={separatorStyle} />

      {/* Undo/Redo + Delete */}
      <div style={groupStyle}>
        <button
          style={{ ...toolBtnStyle, opacity: canUndo() ? 1 : 0.35 }}
          onClick={undo}
          disabled={!canUndo()}
          title="تراجع (Ctrl+Z)"
        >
          <Undo2 size={18} />
        </button>
        <button
          style={{ ...toolBtnStyle, opacity: canRedo() ? 1 : 0.35 }}
          onClick={redo}
          disabled={!canRedo()}
          title="إعادة (Ctrl+Shift+Z)"
        >
          <Redo2 size={18} />
        </button>
        <button
          style={{
            ...toolBtnStyle,
            opacity: selectedElementId ? 1 : 0.35,
            color: selectedElementId ? "var(--app-red)" : undefined,
          }}
          onClick={handleDelete}
          disabled={!selectedElementId}
          title="حذف (Delete)"
        >
          <Trash2 size={18} />
        </button>
      </div>

      {/* Separator */}
      <div style={separatorStyle} />

      {/* Auto Explain */}
      <div style={{ position: "relative" }}>
        <button
          style={{
            ...toolBtnStyle,
            width: "auto",
            padding: "0 10px",
            gap: 4,
            color: isExplaining ? "var(--app-accent)" : "#8b5cf6",
            opacity: isExplaining ? 0.7 : 1,
          }}
          onClick={() => {
            if (!isExplaining) setShowExplainMenu((v) => !v);
          }}
          disabled={isExplaining}
          title="شرح تلقائي بالذكاء الاصطناعي"
        >
          {isExplaining ? (
            <Loader2Icon size={16} className="spin" />
          ) : (
            <Sparkles size={16} />
          )}
          <span style={{ fontSize: 12, fontFamily: "IBM Plex Sans Arabic, sans-serif" }}>شرح تلقائي</span>
        </button>
        {showExplainMenu && (
          <div style={dropdownStyle}>
            <button style={dropdownItemStyle} onClick={handleExplainPage}>
              شرح الصفحة الحالية
            </button>
            <button style={dropdownItemStyle} onClick={handleExplainAll}>
              شرح كل الصفحات
            </button>
          </div>
        )}
      </div>
      {showExplainMenu && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 999 }}
          onClick={() => setShowExplainMenu(false)}
        />
      )}
      {currentPageError && (
        <div style={{ fontSize: 11, color: "var(--app-red)", maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {currentPageError}
        </div>
      )}

      {/* Separator */}
      <div style={separatorStyle} />

      {/* Export */}
      <button
        style={{
          ...toolBtnStyle,
          width: "auto",
          padding: "0 10px",
          gap: 4,
          color: exporting ? "var(--app-accent)" : "var(--app-green)",
          opacity: exporting ? 0.7 : 1,
        }}
        onClick={handleExport}
        disabled={exporting || sharing}
        title="تصدير PDF"
      >
        {exporting ? <Loader2Icon size={16} className="spin" /> : <Download size={16} />}
        <span style={{ fontSize: 12, fontFamily: "IBM Plex Sans Arabic, sans-serif" }}>تصدير</span>
      </button>
      {exportMsg && (
        <div style={{ fontSize: 11, color: "var(--app-muted)", maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {exportMsg}
        </div>
      )}

      {/* Separator */}
      <div style={separatorStyle} />

      {/* Share */}
      <button
        style={{
          ...toolBtnStyle,
          width: "auto",
          padding: "0 10px",
          gap: 4,
          color: sharing ? "var(--app-accent)" : "#06b6d4",
          opacity: sharing ? 0.7 : 1,
        }}
        onClick={handleShare}
        disabled={sharing || exporting}
        title="مشاركة برابط"
      >
        {sharing ? <Loader2Icon size={16} className="spin" /> : <Share2 size={16} />}
        <span style={{ fontSize: 12, fontFamily: "IBM Plex Sans Arabic, sans-serif" }}>مشاركة</span>
      </button>
      {shareError && (
        <div style={{ fontSize: 11, color: "var(--app-red)", maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {shareError}
        </div>
      )}

      {/* Save indicator */}
      {saveIndicator.status !== "idle" && (
        <div style={saveIndicatorStyle}>
          {saveIndicator.status === "saving" ? (
            <span style={{ color: "var(--app-muted)" }}>جاري الحفظ...</span>
          ) : (
            <span style={{ color: "var(--app-green)" }}>تم الحفظ ✓</span>
          )}
        </div>
      )}

      {/* Share Dialog Overlay */}
      {shareResult && (
        <>
          <div style={overlayStyle} onClick={closeShareDialog} />
          <div style={dialogStyle}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, fontFamily: "IBM Plex Sans Arabic, sans-serif" }}>
              رابط المشاركة
            </div>
            <div style={{ fontSize: 12, color: "var(--app-muted)", marginBottom: 8, fontFamily: "IBM Plex Sans Arabic, sans-serif" }}>
              صالح لمدة 7 أيام — {shareResult.fileName}
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                readOnly
                value={shareResult.shareUrl}
                style={linkInputStyle}
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <button
                onClick={handleCopyLink}
                style={{
                  ...copyBtnStyle,
                  background: copied ? "var(--app-green)" : "var(--app-accent)",
                }}
                title="نسخ الرابط"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
            <button onClick={closeShareDialog} style={closeBtnStyle}>
              إغلاق
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Styles ──

const toolbarStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 4,
  padding: "6px 12px",
  background: "var(--app-card)",
  borderBottom: "1px solid var(--app-border)",
  fontFamily: "IBM Plex Sans Arabic, sans-serif",
  fontSize: 13,
  flexShrink: 0,
  flexWrap: "wrap",
};

const groupStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 2,
};

const separatorStyle: React.CSSProperties = {
  width: 1,
  height: 24,
  background: "var(--app-border)",
  margin: "0 4px",
};

const toolBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 34,
  height: 34,
  borderRadius: 8,
  border: "1px solid transparent",
  background: "transparent",
  color: "var(--app-text)",
  cursor: "pointer",
  transition: "all .12s",
};

const activeToolStyle: React.CSSProperties = {
  background: "var(--app-accent-bg)",
  border: "1px solid var(--app-accent)",
  color: "var(--app-accent)",
};

const saveIndicatorStyle: React.CSSProperties = {
  marginLeft: "auto",
  fontSize: 12,
  whiteSpace: "nowrap",
};

const dropdownStyle: React.CSSProperties = {
  position: "absolute",
  top: "100%",
  left: 0,
  marginTop: 4,
  background: "var(--app-card)",
  border: "1px solid var(--app-border)",
  borderRadius: 8,
  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
  zIndex: 1000,
  overflow: "hidden",
  minWidth: 160,
};

const dropdownItemStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: "8px 14px",
  border: "none",
  background: "transparent",
  color: "var(--app-text)",
  fontFamily: "IBM Plex Sans Arabic, sans-serif",
  fontSize: 13,
  textAlign: "right",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.4)",
  zIndex: 2000,
};

const dialogStyle: React.CSSProperties = {
  position: "fixed",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  background: "var(--app-card)",
  border: "1px solid var(--app-border)",
  borderRadius: 12,
  padding: 20,
  zIndex: 2001,
  minWidth: 380,
  maxWidth: 480,
  boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
  fontFamily: "IBM Plex Sans Arabic, sans-serif",
};

const linkInputStyle: React.CSSProperties = {
  flex: 1,
  padding: "6px 10px",
  borderRadius: 6,
  border: "1px solid var(--app-border)",
  background: "var(--app-bg)",
  color: "var(--app-text)",
  fontSize: 12,
  fontFamily: "monospace",
  direction: "ltr",
  textAlign: "left",
};

const copyBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 32,
  height: 32,
  borderRadius: 6,
  border: "none",
  color: "#fff",
  cursor: "pointer",
  transition: "background .15s",
};

const closeBtnStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  marginTop: 12,
  padding: "8px 0",
  borderRadius: 6,
  border: "1px solid var(--app-border)",
  background: "transparent",
  color: "var(--app-text)",
  fontFamily: "IBM Plex Sans Arabic, sans-serif",
  fontSize: 13,
  cursor: "pointer",
};
