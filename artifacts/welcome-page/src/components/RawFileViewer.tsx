import { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { ArrowLeft, ArrowRight, FileX } from "lucide-react";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

interface RawFileViewerProps {
  file: File;
  numPages: number;
  onNumPages: (n: number) => void;
}

export default function RawFileViewer({ file, numPages, onNumPages }: RawFileViewerProps) {
  const [pageNumber, setPageNumber] = useState(1);

  const isPdf = file.type === "application/pdf";

  if (isPdf) {
    return (
      <div style={{ width: "100%", maxWidth: "860px" }}>
        <Document
          file={file}
          onLoadSuccess={({ numPages: n }) => { if (!numPages) onNumPages(n); }}
          loading={<div style={{ textAlign: "center", padding: "2rem", color: "var(--app-muted)" }}>جاري تحميل الملف...</div>}
          error={<div style={{ textAlign: "center", padding: "2rem", color: "var(--app-red)" }}>تعذّر تحميل الملف</div>}
        >
          {numPages > 0 && (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "1rem", marginBottom: "0.75rem" }}>
                <button
                  onClick={() => setPageNumber(p => Math.max(1, p - 1))}
                  disabled={pageNumber <= 1}
                  style={{ padding: "0.3rem 1rem", borderRadius: "6px", border: "1px solid var(--app-border)", background: "var(--app-card)", cursor: "pointer", fontSize: "0.9rem", fontFamily: "inherit", fontWeight: 600, color: pageNumber <= 1 ? "var(--app-muted-light)" : "var(--app-text)" }}
                ><ArrowLeft size={16} /> السابق</button>
                <span style={{ fontSize: "0.9rem", color: "var(--app-muted)", fontWeight: 600 }}>
                  صفحة {pageNumber} من {numPages}
                </span>
                <button
                  onClick={() => setPageNumber(p => Math.min(numPages, p + 1))}
                  disabled={pageNumber >= numPages}
                  style={{ padding: "0.3rem 1rem", borderRadius: "6px", border: "1px solid var(--app-border)", background: "var(--app-card)", cursor: "pointer", fontSize: "0.9rem", fontFamily: "inherit", fontWeight: 600, color: pageNumber >= numPages ? "var(--app-muted-light)" : "var(--app-text)" }}
                >التالي <ArrowRight size={16} /></button>
              </div>
              <div style={{ display: "flex", justifyContent: "center" }}>
                <Page pageNumber={pageNumber} width={600} />
              </div>
            </>
          )}
        </Document>
      </div>
    );
  }

  return (
    <div style={{ textAlign: "center", padding: "3rem 1rem", background: "var(--app-bg)", borderRadius: "16px", border: "1px dashed var(--app-border)", maxWidth: "500px", width: "100%" }}>
      <div style={{ fontSize: "3rem", marginBottom: "1rem" }}><FileX size={48} /></div>
      <p style={{ fontSize: "1rem", color: "var(--app-muted)", fontWeight: 600 }}>لا تتوفر معاينة مباشرة لهذا النوع من الملفات</p>
      <p style={{ fontSize: "0.85rem", color: "var(--app-muted-light)" }}>{file.name}</p>
    </div>
  );
}
