import { useState, useCallback, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { useLocation } from "wouter";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

const S = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
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
    color: "#ffffff",
    margin: 0,
    textShadow: "0 0 30px rgba(99,179,237,0.4)",
  },
  backBtn: {
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.15)",
    color: "#bee3f8",
    borderRadius: "10px",
    padding: "0.5rem 1.2rem",
    fontSize: "0.9rem",
    cursor: "pointer",
    transition: "background 0.2s",
  },
  dropZone: (active: boolean) => ({
    width: "100%",
    maxWidth: "860px",
    border: `2px dashed ${active ? "#63b3ed" : "rgba(255,255,255,0.2)"}`,
    borderRadius: "20px",
    padding: "3rem 2rem",
    textAlign: "center" as const,
    background: active ? "rgba(99,179,237,0.08)" : "rgba(255,255,255,0.04)",
    cursor: "pointer",
    transition: "all 0.2s ease",
    marginBottom: "2rem",
  }),
  uploadIcon: {
    fontSize: "3rem",
    marginBottom: "1rem",
  },
  dropText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: "1.1rem",
    marginBottom: "0.5rem",
  },
  dropSub: {
    color: "rgba(255,255,255,0.35)",
    fontSize: "0.85rem",
  },
  uploadBtn: {
    background: "linear-gradient(135deg, #63b3ed, #4299e1)",
    color: "#fff",
    border: "none",
    borderRadius: "12px",
    padding: "0.75rem 2rem",
    fontSize: "1rem",
    fontWeight: 700,
    cursor: "pointer",
    marginTop: "1rem",
    boxShadow: "0 6px 20px rgba(66,153,225,0.4)",
  },
  fileName: {
    color: "#bee3f8",
    fontSize: "0.9rem",
    marginTop: "0.75rem",
    opacity: 0.8,
  },
  pagesWrapper: {
    width: "100%",
    maxWidth: "860px",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: "1.5rem",
  },
  pageCard: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "16px",
    overflow: "hidden",
    boxShadow: "0 12px 36px rgba(0,0,0,0.4)",
    width: "100%",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
  },
  pageLabel: {
    color: "rgba(255,255,255,0.4)",
    fontSize: "0.78rem",
    padding: "0.5rem 0",
    letterSpacing: "1px",
  },
  loadingText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: "1rem",
    marginTop: "3rem",
  },
};

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
            error={<p style={{ ...S.loadingText, color: "#fc8181" }}>تعذّر تحميل الملف.</p>}
          >
            {Array.from({ length: numPages }, (_, i) => (
              <div key={i} style={S.pageCard}>
                <p style={S.pageLabel}>صفحة {i + 1} من {numPages}</p>
                <Page
                  pageNumber={i + 1}
                  width={Math.min(window.innerWidth - 64, 820)}
                  renderTextLayer
                  renderAnnotationLayer
                />
              </div>
            ))}
          </Document>
        </div>
      )}

      <style>{`
        .react-pdf__Page { background: transparent !important; }
        .react-pdf__Page canvas { border-radius: 0 0 12px 12px; }
      `}</style>
    </div>
  );
}
