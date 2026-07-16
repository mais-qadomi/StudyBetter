import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div dir="rtl" style={{
          minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center",
          padding: "2rem", fontFamily: "IBM Plex Sans Arabic, sans-serif",
        }}>
          <div style={{ textAlign: "center", maxWidth: "400px" }}>
            <AlertTriangle size={48} style={{ color: "var(--app-red)", marginBottom: "1rem" }} />
            <h2 style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--app-text)", margin: "0 0 0.5rem" }}>
              حدث خطأ غير متوقع
            </h2>
            <p style={{ fontSize: "0.9rem", color: "var(--app-muted)", margin: "0 0 1.5rem", lineHeight: 1.6 }}>
              حدث خطأ أثناء تحميل هذا الجزء. يمكنك المحاولة مرة أخرى أو العودة للرئيسية.
            </p>
            {this.state.error?.message && (
              <p style={{
                fontSize: "0.75rem", color: "var(--app-muted)", background: "var(--app-surface)",
                padding: "0.5rem 1rem", borderRadius: "8px", marginBottom: "1.5rem",
                fontFamily: "monospace", direction: "ltr", textAlign: "left",
              }}>
                {this.state.error.message}
              </p>
            )}
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
              <button
                onClick={this.handleReset}
                style={{
                  display: "inline-flex", alignItems: "center", gap: "0.5rem",
                  padding: "0.6rem 1.5rem", borderRadius: "10px", border: "1px solid var(--app-border)",
                  background: "var(--app-surface)", color: "var(--app-text)",
                  fontSize: "0.9rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                }}
              >
                <RefreshCw size={16} /> إعادة المحاولة
              </button>
              <a
                href="/"
                style={{
                  display: "inline-flex", alignItems: "center", gap: "0.5rem",
                  padding: "0.6rem 1.5rem", borderRadius: "10px", border: "none",
                  background: "var(--app-accent)", color: "#fff",
                  fontSize: "0.9rem", fontWeight: 700, cursor: "pointer",
                  textDecoration: "none", fontFamily: "inherit",
                }}
              >
                الرئيسية
              </a>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
