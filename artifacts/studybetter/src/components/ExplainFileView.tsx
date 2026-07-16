import { useState, useCallback, useRef, useEffect } from "react";
import { Lightbulb, ChevronLeft, Loader2, RefreshCw, Sparkles, Globe, GraduationCap, CheckCircle, Rocket, StickyNote, TriangleAlert, Zap, Image } from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { callExplain, type PageResultUI } from "../lib/explain";
import { classifyPage, capturePageCanvas, type PageType } from "../lib/pdf-page-analyzer";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

function parseInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\[EN\].*?\[\/EN\]|\[EX\].*?\[\/EX\])/gs);
  return parts.map((part, i) => {
    const enMatch = /\[EN\](.*?)\[\/EN\]/s.exec(part);
    if (enMatch) return (
      <span key={i} style={{ background: "var(--app-accent-bg)", color: "var(--app-accent)", borderRadius: "5px", padding: "1px 7px", fontSize: "0.82rem", fontWeight: 600, direction: "ltr", display: "inline-block", margin: "0 2px" }}>{enMatch[1].trim()}</span>
    );
    const exMatch = /\[EX\](.*?)\[\/EX\]/s.exec(part);
    if (exMatch) return (
      <span key={i} style={{ background: "var(--app-primary-bg-light)", color: "var(--app-muted)", borderRadius: "6px", padding: "2px 8px", fontSize: "0.82rem", fontStyle: "italic", display: "inline" }}><> <Lightbulb size={14} style={{ display: "inline", verticalAlign: "middle" }} /> {exMatch[1].trim()}</></span>
    );
    return <span key={i}>{part}</span>;
  });
}

function FormattedText({ text }: { text: string }) {
  const cleaned = text.replace(/[^\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFFa-zA-Z0-9\s\[\]\/\.\,\:\;\!\?\(\)\-\/\+\=\%\*\n📌⚡🔹💡📝]/g, "");
  const blocks = cleaned.split(/(\[H\].*?\[\/H\]|\[NOTE\].*?\[\/NOTE\]|\[PIN\].*?\[\/PIN\]|\[SUM\].*?\[\/SUM\])/gs);
  return (
    <div style={{ direction: "rtl", fontFamily: "'Segoe UI', Tahoma, sans-serif" }}>
      {blocks.map((block, idx) => {
        const hMatch = /\[H\](.*?)\[\/H\]/s.exec(block);
        if (hMatch) return (
          <div key={idx} style={{ display: "flex", alignItems: "center", gap: "8px", margin: "1.2rem 0 0.6rem", paddingBottom: "0.5rem", borderBottom: "1.5px solid var(--app-border)" }}>
            <div style={{ width: "26px", height: "26px", borderRadius: "50%", background: "var(--app-accent)", color: "#fff", fontSize: "0.75rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><ChevronLeft size={16} /></div>
            <p style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "var(--app-accent)" }}>{parseInline(hMatch[1].trim())}</p>
          </div>
        );
        const noteMatch = /\[NOTE\](.*?)\[\/NOTE\]/s.exec(block);
        if (noteMatch) return (
          <div key={idx} style={{ background: "var(--app-accent-bg)", border: "0.5px solid var(--app-accent-light)", borderRadius: "10px", padding: "0.7rem 1rem", margin: "0.6rem 0", fontSize: "0.85rem", color: "var(--app-accent)", lineHeight: 1.8 }}>
            <strong style={{ color: "var(--app-accent)", display: "inline-flex", alignItems: "center", gap: "4px" }}><StickyNote size={16} /> ملاحظة: </strong>{parseInline(noteMatch[1].trim())}
          </div>
        );
        const pinMatch = /\[PIN\](.*?)\[\/PIN\]/s.exec(block);
        if (pinMatch) return (
          <div key={idx} style={{ background: "var(--app-content-exam-bg)", borderRight: "3px solid var(--app-content-exam-border)", borderRadius: "0 10px 10px 0", padding: "0.7rem 1rem", margin: "0.6rem 0", fontSize: "0.85rem", color: "var(--app-content-exam-text)", lineHeight: 1.8 }}>
            <strong style={{ color: "var(--app-content-exam-strong)", display: "inline-flex", alignItems: "center", gap: "4px" }}><TriangleAlert size={16} /> تنبيه امتحان: </strong>{parseInline(pinMatch[1].trim())}
          </div>
        );
        const sumMatch = /\[SUM\](.*?)\[\/SUM\]/s.exec(block);
        if (sumMatch) return (
          <div key={idx} style={{ background: "var(--app-accent-bg)", border: "0.5px solid var(--app-accent-light)", borderRadius: "12px", padding: "1rem 1.2rem", margin: "1rem 0" }}>
            <p style={{ margin: "0 0 0.6rem", fontSize: "0.9rem", fontWeight: 700, color: "var(--app-accent)", display: "flex", alignItems: "center", gap: "6px" }}><Zap size={18} /> ملخص سريع</p>
            {sumMatch[1].trim().split(/\n|•|\*/).filter(s => s.trim()).map((item, i) => (
              <div key={i} style={{ display: "flex", gap: "8px", marginBottom: "0.3rem", fontSize: "0.84rem", color: "var(--app-accent)" }}>
                <span style={{ color: "var(--app-accent-light)", flexShrink: 0 }}><ChevronLeft size={14} style={{ verticalAlign: "middle" }} /></span>
                <span>{parseInline(item.trim())}</span>
              </div>
            ))}
          </div>
        );
        if (!block.trim()) return null;
        return <p key={idx} style={{ margin: "0 0 0.6rem", fontSize: "0.88rem", lineHeight: 1.9, color: "var(--app-text)" }}>{parseInline(block)}</p>;
      })}
    </div>
  );
}

function PageWithText({
  pageNumber, numPages, width,
  result, explaining, savedText,
  onTextReady, onExplain,
}: {
  pageNumber: number; numPages: number; width: number;
  result: PageResultUI | null; explaining: boolean;
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
    <div style={{ background: "var(--app-card)", border: "1px solid var(--app-border)", borderRadius: "20px", overflow: "hidden", boxShadow: "var(--app-shadow)", width: "100%" }}>
      <p style={{ color: "var(--app-muted)", fontSize: "0.78rem", padding: "0.6rem 0 0.4rem", textAlign: "center", letterSpacing: "1px", fontWeight: 600, margin: 0 }}>
        صفحة {pageNumber} من {numPages}
        {pageType === "image" && <span style={{ marginRight: "8px", background: "var(--app-accent-bg)", color: "var(--app-accent)", padding: "1px 6px", borderRadius: "4px", fontSize: "0.7rem", fontWeight: 700 }}><Image size={12} style={{ verticalAlign: "middle" }} /> صورة</span>}
        {pageType === "mixed" && <span style={{ marginRight: "8px", background: "var(--app-accent-bg)", color: "var(--app-accent)", padding: "1px 6px", borderRadius: "4px", fontSize: "0.7rem", fontWeight: 700 }}><Image size={12} style={{ verticalAlign: "middle" }} /> مختلط</span>}
      </p>
      <div ref={pageWrapperRef}><Page pageNumber={pageNumber} width={width} renderTextLayer renderAnnotationLayer onLoadSuccess={handlePageLoad} onRenderSuccess={handleRenderSuccess} /></div>
      <div style={{ width: "100%", boxSizing: "border-box", padding: "1rem 1.2rem", background: "var(--app-primary-bg-light)", borderTop: "1px solid var(--app-border)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
          <p style={{ margin: 0, fontSize: "0.72rem", color: "var(--app-muted)", fontWeight: 700, letterSpacing: "1px" }}>النص المستخرج</p>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {result?.explanation && !explaining && <span style={{ fontSize: "0.72rem", color: "var(--app-green)", fontWeight: 700 }}><CheckCircle size={14} style={{ verticalAlign: "middle" }} /> محفوظ</span>}
            <button onClick={() => {
              if (!imageDataRef.current && pageWrapperRef.current) imageDataRef.current = capturePageCanvas(pageWrapperRef.current);
              onExplain(pageNumber, imageDataRef.current ?? undefined);
            }} disabled={!displayText && !isVision || explaining}
              style={{
                background: explaining ? "var(--app-primary-bg)" : "linear-gradient(135deg, var(--app-accent-light), var(--app-accent))",
                color: "#fff", border: "none", borderRadius: "8px", padding: "0.35rem 0.9rem",
                fontSize: "0.8rem", fontWeight: 700,
                cursor: !displayText && !isVision || explaining ? "not-allowed" : "pointer",
                boxShadow: "0 3px 12px rgba(99,102,241,0.35)", whiteSpace: "nowrap", fontFamily: "inherit",
              }}
            >{explaining ? <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}><Loader2 size={16} /> جاري الشرح…</span> : result?.explanation ? <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}><RefreshCw size={16} /> أعد الشرح</span> : <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}><Sparkles size={16} /> {isVision ? "اشرح بالصورة" : "اشرح هذا المحتوى"}</span>}</button>
          </div>
        </div>
        <textarea readOnly value={displayText || (isVision ? "(هذه الصفحة تحتوي على صور — سيتم تحليلها كصورة)" : "جاري استخراج النص…")}
          style={{ width: "100%", boxSizing: "border-box", minHeight: "80px", padding: "0.6rem 0.8rem", background: "var(--app-card)", border: "1px solid var(--app-border)", borderRadius: "8px", fontSize: "0.82rem", color: "var(--app-text)", lineHeight: 1.6, resize: "vertical", fontFamily: "inherit", direction: "auto" as never }}
        />
        {result?.error && (
            <div style={{ marginTop: "0.8rem", padding: "0.9rem 1rem", background: "var(--app-error-bg)", border: "1px solid var(--app-error-border)", borderRadius: "8px" }}>
            <p style={{ margin: "0 0 0.4rem", fontSize: "0.72rem", color: "var(--app-error-text)", fontWeight: 700 }}>خطأ</p>
            <p style={{ margin: 0, fontSize: "0.88rem", lineHeight: 1.8, color: "var(--app-error-text)", direction: "rtl" }}>{result.error}</p>
          </div>
        )}
        {result?.translation && (
          <div style={{ marginTop: "0.8rem", padding: "0.9rem 1rem", background: "var(--app-accent-bg)", border: "1px solid var(--app-accent-light)", borderRadius: "8px" }}>
            <p style={{ margin: "0 0 0.6rem", fontSize: "0.72rem", color: "var(--app-accent)", fontWeight: 700 }}><Globe size={14} style={{ verticalAlign: "middle" }} /> الترجمة</p>
            <FormattedText text={result.translation} />
          </div>
        )}
        {result?.explanation && (
          <div style={{ marginTop: "0.8rem", padding: "0.9rem 1rem", background: "var(--app-primary-bg-light)", border: "1px solid var(--app-border)", borderRadius: "8px" }}>
            <p style={{ margin: "0 0 0.6rem", fontSize: "0.72rem", color: "var(--app-muted)", fontWeight: 700 }}><GraduationCap size={14} style={{ verticalAlign: "middle" }} /> الشرح الأكاديمي</p>
            <FormattedText text={result.explanation} />
          </div>
        )}
      </div>
    </div>
  );
}

interface ExplainFileViewProps {
  file: File;
  numPages: number;
  sessionId: string;
  pageTexts: Record<number, string>;
  pageResults: Record<number, PageResultUI>;
  explaining: Set<number>;
  bulkProgress: { current: number; total: number } | null;
  onNumPages: (n: number) => void;
  onTextReady: (pageNum: number, text: string, pageType?: PageType, imageDataUrl?: string) => void;
  onExplain: (pageNum: number, imageDataUrl?: string) => Promise<void>;
  onExplainAll: () => void;
}

export default function ExplainFileView({
  file, numPages,
  pageTexts, pageResults, explaining, bulkProgress,
  onNumPages, onTextReady, onExplain, onExplainAll,
}: ExplainFileViewProps) {
  const fileUrlRef = useRef<string | null>(null);
  const [fileUrl, setFileUrl] = useState<string>(() => {
    const url = URL.createObjectURL(file);
    fileUrlRef.current = url;
    return url;
  });

  useEffect(() => {
    const oldUrl = fileUrlRef.current;
    if (oldUrl) URL.revokeObjectURL(oldUrl);
    const url = URL.createObjectURL(file);
    fileUrlRef.current = url;
    setFileUrl(url);
    return () => { if (fileUrlRef.current) URL.revokeObjectURL(fileUrlRef.current); };
  }, [file]);

  const pageWidth = Math.min(typeof window !== "undefined" ? window.innerWidth - 100 : 820, 820);

  const explainedCount = Object.values(pageResults).filter(r => r.explanation).length;
  const pendingPages = numPages > 0
    ? Array.from({ length: numPages }, (_, i) => i + 1).filter(i => !pageResults[i]?.explanation).length
    : 0;
  const isBulkBusy = bulkProgress !== null;

  return (
    <div style={{ width: "100%", maxWidth: "860px" }}>
      {numPages > 0 && (
        <>
          <button onClick={onExplainAll} disabled={isBulkBusy || pendingPages === 0}
            style={{
              width: "100%", background: isBulkBusy ? "var(--app-accent-bg)" : "linear-gradient(135deg, var(--app-accent-light), var(--app-accent))",
              color: "#fff", border: "none", borderRadius: "14px", padding: "0.85rem 2rem",
              fontSize: "1rem", fontWeight: 700, cursor: isBulkBusy || pendingPages === 0 ? "not-allowed" : "pointer",
              boxShadow: "0 6px 20px rgba(99,102,241,0.35)", marginBottom: "1rem", fontFamily: "inherit",
            }}
          >
            {isBulkBusy
              ? <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}><Loader2 size={18} /> جاري الشرح…</span>
              : pendingPages === 0
                ? <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}><CheckCircle size={18} /> جميع الصفحات مشروحة</span>
                : <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}><Rocket size={18} /> اشرح كل الصفحات {pendingPages < numPages ? `(${pendingPages} متبقية)` : ""}</span>}
          </button>
          {bulkProgress && (
            <div style={{ width: "100%", marginBottom: "1.5rem", background: "var(--app-card)", borderRadius: "12px", padding: "0.8rem 1.2rem", border: "1px solid var(--app-border)" }}>
              <p style={{ margin: "0 0 0.5rem", fontSize: "0.9rem", color: "var(--app-accent)", fontWeight: 700 }}>
                جاري شرح الصفحة {bulkProgress.current} من {bulkProgress.total}
              </p>
              <div style={{ background: "var(--app-accent-bg)", borderRadius: "8px", height: "10px", overflow: "hidden" }}>
                <div style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%`, background: "linear-gradient(90deg, var(--app-accent-light), var(--app-accent))", height: "100%", borderRadius: "8px", transition: "width 0.4s ease" }} />
              </div>
            </div>
          )}
        </>
      )}
      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "2rem" }}>
        <Document
          file={fileUrl}
          onLoadSuccess={({ numPages: n }) => onNumPages(n)}
          loading={<p style={{ textAlign: "center", color: "var(--app-primary)", fontSize: "1rem" }}>جاري تحميل الملف…</p>}
          error={<p style={{ textAlign: "center", color: "var(--app-red)", fontSize: "1rem" }}>تعذّر تحميل الملف.</p>}
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
              onTextReady={onTextReady}
              onExplain={onExplain}
            />
          ))}
        </Document>
      </div>
      <style>{`.react-pdf__Page { background: transparent !important; } .react-pdf__Page canvas { display: block; }`}</style>
    </div>
  );
}

export type { PageResultUI };
