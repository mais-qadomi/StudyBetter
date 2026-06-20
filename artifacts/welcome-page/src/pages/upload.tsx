import { useState, useCallback, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { useLocation } from "wouter";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

const MAX_FILE_MB = 100;
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;
const DELAY_BETWEEN_PAGES_MS = 4000;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const C = {
  bg: "linear-gradient(135deg, #e8f4fb 0%, #fce4f0 50%, #e4f7ec 100%)",
  card: "#ffffff",
  cardBorder: "#d8eaf7",
  title: "#5a8fc7",
  backBtn: { bg: "#d0e8f8", border: "#a8d0f0", color: "#3a7abf" },
  drop: { border: "#a8d0f0", borderActive: "#f0a8c8", bg: "rgba(168,208,240,0.12)", bgActive: "rgba(240,168,200,0.12)" },
  dropText: "#6a9ec0",
  dropSub: "#a8c8e0",
  uploadBtn: { bg: "linear-gradient(135deg, #a8d8f0, #88bce8)", shadow: "rgba(136,188,232,0.45)" },
  fileName: "#8aa8c8",
  pageLabel: "#b8a8d0",
  textBox: { bg: "#f5fbff", border: "#c8e0f4", color: "#4a7a9b", label: "#b0c8e0" },
  loadingText: "#8ab8d8",
  errorText: "#e08898",
};

const S = {
  page: {
    minHeight: "100vh",
    background: C.bg,
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
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
  },
  title: {
    fontSize: "1.8rem",
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
    background: busy
      ? "rgba(176,140,232,0.35)"
      : "linear-gradient(135deg, #c8a8f0, #a880e8)",
    color: "#fff",
    border: "none",
    borderRadius: "14px",
    padding: "0.85rem 2rem",
    fontSize: "1rem",
    fontWeight: 700,
    cursor: busy ? "not-allowed" : "pointer",
    boxShadow: "0 6px 20px rgba(168,128,232,0.35)",
    marginBottom: "1.5rem",
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
    background: "#fff",
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

type PageResult = {
  translation: string | null;
  explanation: string;
  error: string;
};

function FormattedText({ text, color }: { text: string; color: string }) {
  const paragraphs = text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <div style={{ direction: "rtl" }}>
      {paragraphs.map((para, idx) => (
        <p key={idx} style={{
          margin: idx < paragraphs.length - 1 ? "0 0 0.75rem" : "0",
          fontSize: "0.88rem",
          lineHeight: 1.9,
          color,
        }}>
          {para}
        </p>
      ))}
    </div>
  );
}

async function callExplain(text: string): Promise<PageResult> {
  const res = await fetch("/api/explain", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  const data = await res.json() as { explanation?: string; translation?: string | null; error?: string };
  if (!res.ok) throw new Error(data.error ?? "خطأ غير معروف");
  return {
    translation: data.translation ?? null,
    explanation: data.explanation ?? "",
    error: "",
  };
}

function PageWithText({
  pageNumber, numPages, width,
  result, explaining,
  onTextReady, onExplain,
}: {
  pageNumber: number;
  numPages: number;
  width: number;
  result: PageResult | null;
  explaining: boolean;
  onTextReady: (pageNum: number, text: string) => void;
  onExplain: (pageNum: number) => void;
}) {
  const [text, setText] = useState<string>("");

  const handlePageLoad = useCallback(async (page: pdfjs.PDFPageProxy) => {
    try {
      const content = await page.getTextContent();
      const extracted = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      setText(extracted);
      onTextReady(pageNumber, extracted);
    } catch {
      const fallback = "تعذّر استخراج النص من هذه الصفحة.";
      setText(fallback);
      onTextReady(pageNumber, fallback);
    }
  }, [pageNumber, onTextReady]);

  return (
    <div style={S.pageCard}>
      <p style={S.pageLabel}>صفحة {pageNumber} من {numPages}</p>
      <Page
        pageNumber={pageNumber}
        width={width}
        renderTextLayer
        renderAnnotationLayer
        onLoadSuccess={handlePageLoad}
      />
      <div style={S.textBox}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
          <p style={{ ...S.textLabel, margin: 0 }}>النص المستخرج</p>
          <button
            onClick={() => onExplain(pageNumber)}
            disabled={!text || explaining}
            style={{
              background: explaining
                ? "rgba(200,168,240,0.4)"
                : "linear-gradient(135deg, #d0b8f0, #b89ce8)",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              padding: "0.35rem 0.9rem",
              fontSize: "0.8rem",
              fontWeight: 700,
              cursor: text && !explaining ? "pointer" : "not-allowed",
              boxShadow: "0 3px 12px rgba(176,140,232,0.35)",
              whiteSpace: "nowrap" as const,
            }}
          >
            {explaining ? "⏳ جاري الشرح…" : "✨ اشرح هذا المحتوى"}
          </button>
        </div>

        <textarea
          readOnly
          value={text || "جاري استخراج النص…"}
          style={S.textArea}
        />

        {result?.error && (
          <div style={{ marginTop: "0.8rem", padding: "0.9rem 1rem", background: "#fff0f0", border: "1px solid #f0c0c0", borderRadius: "8px" }}>
            <p style={{ ...S.textLabel, margin: "0 0 0.4rem", color: "#c06060" }}>خطأ</p>
            <p style={{ margin: 0, fontSize: "0.88rem", lineHeight: 1.8, color: "#c06060", direction: "rtl" }}>{result.error}</p>
          </div>
        )}

        {result?.translation && (
          <div style={{ marginTop: "0.8rem", padding: "0.9rem 1rem", background: "#f5f0ff", border: "1px solid #d0b8f0", borderRadius: "8px" }}>
            <p style={{ ...S.textLabel, margin: "0 0 0.6rem", color: "#8060c0" }}>🌐 الترجمة</p>
            <FormattedText text={result.translation} color="#4a3a7a" />
          </div>
        )}

        {result?.explanation && (
          <div style={{ marginTop: "0.8rem", padding: "0.9rem 1rem", background: "#f0f8ff", border: "1px solid #c0d8f0", borderRadius: "8px" }}>
            <p style={{ ...S.textLabel, margin: "0 0 0.6rem", color: "#5070c0" }}>🎓 الشرح الأكاديمي</p>
            <FormattedText text={result.explanation} color="#3a4a7a" />
          </div>
        )}
      </div>
    </div>
  );
}

export default function UploadPage() {
  const [, navigate] = useLocation();
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string>("");
  const [numPages, setNumPages] = useState<number>(0);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [pageTexts, setPageTexts] = useState<Record<number, string>>({});
  const [pageResults, setPageResults] = useState<Record<number, PageResult>>({});
  const [explaining, setExplaining] = useState<Set<number>>(new Set());
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null);

  const pageTextsRef = useRef<Record<number, string>>({});

  const loadFile = useCallback((f: File) => {
    if (!f.type.includes("pdf")) return;
    if (f.size > MAX_FILE_BYTES) {
      setFileError(
        `حجم الملف (${(f.size / 1024 / 1024).toFixed(1)} MB) يتجاوز الحد الأقصى المسموح به (${MAX_FILE_MB} MB). الرجاء اختيار ملف أصغر حجماً.`
      );
      return;
    }
    setFileError("");
    if (fileUrl) URL.revokeObjectURL(fileUrl);
    setFile(f);
    setNumPages(0);
    setPageTexts({});
    setPageResults({});
    setExplaining(new Set());
    setBulkProgress(null);
    pageTextsRef.current = {};
    setFileUrl(URL.createObjectURL(f));
  }, [fileUrl]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer.files[0];
    if (f) loadFile(f);
  }, [loadFile]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) loadFile(f);
  };

  const handleTextReady = useCallback((pageNum: number, text: string) => {
    pageTextsRef.current[pageNum] = text;
    setPageTexts(prev => ({ ...prev, [pageNum]: text }));
  }, []);

  const explainOnePage = useCallback(async (pageNum: number) => {
    const text = pageTextsRef.current[pageNum];
    if (!text) return;
    setExplaining(prev => new Set(prev).add(pageNum));
    try {
      const result = await callExplain(text);
      setPageResults(prev => ({ ...prev, [pageNum]: result }));
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
    setPageResults({});
    for (let i = 1; i <= numPages; i++) {
      setBulkProgress({ current: i, total: numPages });
      await explainOnePage(i);
      if (i < numPages) await sleep(DELAY_BETWEEN_PAGES_MS);
    }
    setBulkProgress(null);
  }, [bulkProgress, numPages, explainOnePage]);

  const pageWidth = Math.min(typeof window !== "undefined" ? window.innerWidth - 64 : 820, 820);
  const isBulkBusy = bulkProgress !== null;

  return (
    <div dir="rtl" style={S.page}>
      <div style={S.header}>
        <h1 style={S.title}>رفع ملف PDF</h1>
        <button style={S.backBtn} onClick={() => navigate("/")}>← الرئيسية</button>
      </div>

      <div
        style={S.dropZone(dragActive)}
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
      >
        <div style={S.uploadIcon}>📄</div>
        <p style={S.dropText}>اسحب ملف PDF هنا أو اضغط للاختيار</p>
        <p style={S.dropSub}>يدعم ملفات PDF فقط • الحد الأقصى: {MAX_FILE_MB} MB</p>
        <button style={S.uploadBtn} onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}>
          اختر ملفاً
        </button>
        {file && <p style={S.fileName}>📎 {file.name}</p>}
        <input ref={inputRef} type="file" accept="application/pdf" style={{ display: "none" }} onChange={onFileChange} />
      </div>

      {fileError && (
        <div style={{ width: "100%", maxWidth: "860px", marginBottom: "1.5rem", padding: "1rem 1.2rem", background: "#fff0f0", border: "1px solid #f0c0c0", borderRadius: "14px" }}>
          <p style={{ margin: 0, color: "#c05050", fontWeight: 600, fontSize: "0.95rem" }}>⚠️ {fileError}</p>
        </div>
      )}

      {fileUrl && numPages > 0 && (
        <>
          <button
            style={S.explainAllBtn(isBulkBusy)}
            onClick={handleExplainAll}
            disabled={isBulkBusy}
          >
            {isBulkBusy ? `⏳ جاري الشرح…` : "🚀 اشرح كل الصفحات"}
          </button>

          {bulkProgress && (
            <div style={S.progressBar}>
              <p style={{ margin: "0 0 0.5rem", fontSize: "0.9rem", color: "#7060c0", fontWeight: 700 }}>
                جاري شرح الصفحة {bulkProgress.current} من {bulkProgress.total}
              </p>
              <div style={{ background: "#e8d8f8", borderRadius: "8px", height: "10px", overflow: "hidden" }}>
                <div style={{
                  width: `${(bulkProgress.current / bulkProgress.total) * 100}%`,
                  background: "linear-gradient(90deg, #c8a8f0, #a880e8)",
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
            onLoadSuccess={({ numPages: n }) => setNumPages(n)}
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
                onTextReady={handleTextReady}
                onExplain={explainOnePage}
              />
            ))}
          </Document>
        </div>
      )}

      <style>{`
        .react-pdf__Page { background: transparent !important; }
        .react-pdf__Page canvas { display: block; }
      `}</style>
    </div>
  );
}
