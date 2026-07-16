import { useToast } from "../stores/toastStore";
import { CheckCircle, XCircle, Info, X } from "lucide-react";

const icons = {
  success: <CheckCircle size={18} />,
  error: <XCircle size={18} />,
  info: <Info size={18} />,
};

const colors = {
  success: { bg: "#f0fdf4", border: "#bbf7d0", text: "#16a34a" },
  error: { bg: "#fef2f2", border: "#fecaca", text: "#dc2626" },
  info: { bg: "#eff6ff", border: "#bfdbfe", text: "#2563eb" },
};

export default function ToastContainer() {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div style={{
      position: "fixed", bottom: "1rem", left: "50%", transform: "translateX(-50%)",
      zIndex: 9999, display: "flex", flexDirection: "column", gap: "0.5rem",
      maxWidth: "400px", width: "calc(100% - 2rem)",
    }}>
      {toasts.map((toast) => {
        const c = colors[toast.type];
        return (
          <div key={toast.id} style={{
            display: "flex", alignItems: "center", gap: "0.6rem",
            padding: "0.7rem 1rem", borderRadius: "12px",
            background: c.bg, border: `1px solid ${c.border}`,
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            animation: "toastSlideIn 0.3s ease-out",
          }}>
            <span style={{ color: c.text, flexShrink: 0, display: "flex" }}>{icons[toast.type]}</span>
            <span style={{ flex: 1, fontSize: "0.88rem", fontWeight: 600, color: c.text, lineHeight: 1.4 }}>
              {toast.message}
            </span>
            <button onClick={() => removeToast(toast.id)}
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: c.text, padding: "2px", flexShrink: 0, display: "flex", opacity: 0.7,
              }}>
              <X size={16} />
            </button>
          </div>
        );
      })}
      <style>{`
        @keyframes toastSlideIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
