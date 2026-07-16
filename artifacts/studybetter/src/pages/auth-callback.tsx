import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "../stores/authStore";
import { setToken } from "../lib/api";

export default function AuthCallbackPage() {
  const [, navigate] = useLocation();
  const { fetchMe } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const error = params.get("error");

    if (error) {
      navigate("/login?error=" + error);
      return;
    }

    if (token) {
      setToken(token);
      fetchMe().then(() => navigate("/")).catch(() => navigate("/login"));
    } else {
      navigate("/login");
    }
  }, []);

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--app-bg-page)", color: "var(--app-text)",
    }}>
      <p style={{ fontSize: "1rem", fontWeight: 600 }}>جاري التسجيل...</p>
    </div>
  );
}
