import { useState, useCallback, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { useLocation } from "wouter";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

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
    marginBottom: "2rem",
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
    marginBottom: "2rem",
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

function PageWithText({ pageNumber, numPages, width }: { pageNumber: number; numPages: number; width: number }) {
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
    } catch {
      setText("تعذّر استخراج النص من هذه الصفحة.");
    }
  }, []);

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
        <p style={S.textLabel}>النص المستخرج</p>
        <textarea
          readOnly
          value={text || "جاري استخراج النص…"}
          style={S.textArea}
        />
      </div>
    </div>
  );
}

export default function UploadPage() {
  const [, navigate] = useLocation();
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadFile = useCallback((f: File) => {
    if (!f.type.includes("pdf")) return;
    if (fileUrl) URL.revokeObjectURL(fileUrl);
    setFile(f);
    setNumPages(0);
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

  const pageWidth = Math.min(typeof window !== "undefined" ? window.innerWidth - 64 : 820, 820);

  return (
    <div dir="rtl" style={S.page}>
      <div style={S.header}>
        <h1 style={S.title}>رفع ملف PDF</h1>
        <button style={S.backBtn} onClick={() => navigate("/")}>
          ← الرئيسية
        </button>
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
        <p style={S.dropSub}>يدعم ملفات PDF فقط</p>
        <button
          style={S.uploadBtn}
          onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
        >
          اختر ملفاً
        </button>
        {file && <p style={S.fileName}>📎 {file.name}</p>}
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          style={{ display: "none" }}
          onChange={onFileChange}
        />
      </div>

      {fileUrl && (
        <div style={S.pagesWrapper}>
          <Document
            file={fileUrl}
            onLoadSuccess={({ numPages }) => setNumPages(numPages)}
            loading={<p style={S.loadingText}>جاري تحميل الملف…</p>}
            error={<p style={{ ...S.loadingText, color: C.errorText }}>تعذّر تحميل الملف.</p>}
          >
            {Array.from({ length: numPages }, (_, i) => (
              <PageWithText
                key={i}
                pageNumber={i + 1}
                numPages={numPages}
                width={pageWidth}
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
