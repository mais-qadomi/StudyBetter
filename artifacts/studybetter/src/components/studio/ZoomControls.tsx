import {
  ZoomIn, ZoomOut, Maximize, ChevronLeft, ChevronRight,
} from "lucide-react";

interface ZoomControlsProps {
  zoomPercent: number;
  currentPage: number;
  numPages: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitWidth: () => void;
  onPrevPage: () => void;
  onNextPage: () => void;
}

const btn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 34,
  height: 34,
  borderRadius: 8,
  border: "1px solid var(--app-border)",
  background: "var(--app-bg)",
  color: "var(--app-text)",
  cursor: "pointer",
  fontSize: 13,
  transition: "background .15s",
};

const btnHover = "var(--app-accent-bg)";

export default function ZoomControls({
  zoomPercent,
  currentPage,
  numPages,
  onZoomIn,
  onZoomOut,
  onFitWidth,
  onPrevPage,
  onNextPage,
}: ZoomControlsProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        fontFamily: "IBM Plex Sans Arabic, sans-serif",
        fontSize: 13,
        color: "var(--app-text)",
      }}
    >
      {/* Page navigation */}
      <button
        style={btn}
        disabled={currentPage <= 1}
        onClick={onPrevPage}
        title="الصفحة السابقة"
      >
        <ChevronLeft size={16} />
      </button>
      <span style={{ minWidth: 70, textAlign: "center", direction: "ltr" }}>
        {currentPage} / {numPages}
      </span>
      <button
        style={btn}
        disabled={currentPage >= numPages}
        onClick={onNextPage}
        title="الصفحة التالية"
      >
        <ChevronRight size={16} />
      </button>

      {/* Separator */}
      <div style={{ width: 1, height: 20, background: "var(--app-border)", margin: "0 4px" }} />

      {/* Zoom controls */}
      <button style={btn} onClick={onZoomOut} title="تصغير">
        <ZoomOut size={16} />
      </button>
      <span style={{ minWidth: 48, textAlign: "center", direction: "ltr" }}>
        {Math.round(zoomPercent)}%
      </span>
      <button style={btn} onClick={onZoomIn} title="تكبير">
        <ZoomIn size={16} />
      </button>
      <button style={btn} onClick={onFitWidth} title="ملء العرض">
        <Maximize size={16} />
      </button>
    </div>
  );
}
