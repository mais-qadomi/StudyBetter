import { ReactNode } from "react";
import { Redirect, useLocation } from "wouter";
import { useAuth } from "../stores/authStore";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, initialized } = useAuth();
  const [location] = useLocation();

  if (!initialized) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--app-bg-page)" }}>
        <div style={{ textAlign: "center", color: "var(--app-muted)" }}>
          <div style={{ width: "40px", height: "40px", border: "3px solid var(--app-border)", borderTopColor: "var(--app-accent)", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 1rem" }} />
          <p style={{ fontSize: "0.9rem" }}>جاري التحميل...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Redirect to={`/login?from=${encodeURIComponent(location)}`} />;
  }

  return <>{children}</>;
}

export function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const { user, initialized } = useAuth();

  if (!initialized) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--app-bg-page)" }}>
        <div style={{ textAlign: "center", color: "var(--app-muted)" }}>
          <div style={{ width: "40px", height: "40px", border: "3px solid var(--app-border)", borderTopColor: "var(--app-accent)", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 1rem" }} />
          <p style={{ fontSize: "0.9rem" }}>جاري التحميل...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  if (user) {
    return <Redirect to="/" />;
  }

  return <>{children}</>;
}
