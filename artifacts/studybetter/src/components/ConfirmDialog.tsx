import { useState, useEffect, createContext, useContext, useCallback, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface ConfirmState {
  open: boolean;
  message: string;
  title: string;
  confirmText: string;
  cancelText: string;
  danger: boolean;
  resolve: (value: boolean) => void;
}

interface ConfirmContextValue {
  confirm: (opts?: {
    message?: string;
    title?: string;
    confirmText?: string;
    cancelText?: string;
    danger?: boolean;
  }) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfirmState | null>(null);

  const confirm = useCallback((opts?: {
    message?: string;
    title?: string;
    confirmText?: string;
    cancelText?: string;
    danger?: boolean;
  }): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({
        open: true,
        message: opts?.message ?? "هل أنت متأكد؟",
        title: opts?.title ?? "تأكيد",
        confirmText: opts?.confirmText ?? "تأكيد",
        cancelText: opts?.cancelText ?? "إلغاء",
        danger: opts?.danger ?? false,
        resolve,
      });
    });
  }, []);

  const handleClose = (value: boolean) => {
    state?.resolve(value);
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {state?.open && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)",
            animation: "confirm-fade-in 0.15s ease-out",
          }}
          onClick={() => handleClose(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--app-card)", borderRadius: "16px",
              padding: "1.5rem", maxWidth: "380px", width: "90%",
              boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
              animation: "confirm-slide-in 0.2s ease-out",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
              <div style={{
                width: "36px", height: "36px", borderRadius: "10px",
                background: state.danger ? "var(--app-error-bg)" : "var(--app-accent-bg)",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <AlertTriangle size={18} style={{ color: state.danger ? "var(--app-red)" : "var(--app-accent)" }} />
              </div>
              <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "var(--app-text)" }}>
                {state.title}
              </h3>
            </div>
            <p style={{ margin: "0 0 1.25rem", fontSize: "0.9rem", color: "var(--app-muted)", lineHeight: 1.6 }}>
              {state.message}
            </p>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-start" }}>
              <button
                onClick={() => handleClose(true)}
                style={{
                  padding: "0.5rem 1.25rem", borderRadius: "10px", border: "none",
                  background: state.danger ? "var(--app-red)" : "var(--app-accent)",
                  color: "#fff", fontSize: "0.85rem", fontWeight: 700,
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >
                {state.confirmText}
              </button>
              <button
                onClick={() => handleClose(false)}
                style={{
                  padding: "0.5rem 1.25rem", borderRadius: "10px",
                  border: "1px solid var(--app-border)", background: "transparent",
                  color: "var(--app-text)", fontSize: "0.85rem", fontWeight: 600,
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >
                {state.cancelText}
              </button>
            </div>
          </div>
        </div>
      )}
      <style>{`
        @keyframes confirm-fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes confirm-slide-in { from { transform: translateY(12px) scale(0.96); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }
      `}</style>
    </ConfirmContext.Provider>
  );
}
