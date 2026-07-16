import { FileUp } from "lucide-react";

export function DragOverlay({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9998,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexDirection: "column", gap: "1rem",
        background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)",
        animation: "confirm-fade-in 0.15s ease-out",
        pointerEvents: "none",
      }}
    >
      <div style={{
        width: "80px", height: "80px", borderRadius: "20px",
        background: "var(--app-accent)", display: "flex",
        alignItems: "center", justifyContent: "center",
        animation: "drag-bounce 0.6s ease-in-out infinite alternate",
      }}>
        <FileUp size={36} color="#fff" />
      </div>
      <p style={{
        color: "#fff", fontSize: "1.2rem", fontWeight: 700,
        fontFamily: "IBM Plex Sans Arabic, sans-serif",
        textShadow: "0 2px 8px rgba(0,0,0,0.3)",
      }}>
        أفلت الملف هنا
      </p>
      <p style={{
        color: "rgba(255,255,255,0.7)", fontSize: "0.85rem",
        fontFamily: "IBM Plex Sans Arabic, sans-serif",
      }}>
        ملفات PDF فقط
      </p>
      <style>{`
        @keyframes drag-bounce { from { transform: translateY(0); } to { transform: translateY(-8px); } }
      `}</style>
    </div>
  );
}
