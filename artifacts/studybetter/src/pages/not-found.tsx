import { Link } from "wouter";
import { Home, ArrowRight } from "lucide-react";

export default function NotFoundPage() {
  return (
    <div dir="rtl" style={{
      minHeight: "100vh", background: "var(--app-bg-page)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem",
    }}>
      <div style={{ textAlign: "center" }}>
        <div style={{
          fontSize: "clamp(4rem, 10vw, 8rem)", fontWeight: 900,
          color: "var(--app-accent)", lineHeight: 1, marginBottom: "0.5rem",
          opacity: 0.15,
        }}>
          404
        </div>
        <h1 style={{
          fontSize: "clamp(1.2rem, 3vw, 1.8rem)", fontWeight: 800,
          color: "var(--app-text)", margin: "0 0 0.5rem",
        }}>
          الصفحة غير موجودة
        </h1>
        <p style={{
          fontSize: "clamp(0.85rem, 1.5vw, 1rem)", color: "var(--app-muted)",
          margin: "0 0 2rem", maxWidth: "30ch", marginInline: "auto",
        }}>
          يبدو أن الرابط الذي وصلت إليه غير صحيح أو تم نقله
        </p>
        <Link href="/" style={{
          display: "inline-flex", alignItems: "center", gap: "0.5rem",
          padding: "0.7rem 1.5rem", borderRadius: "12px", border: "none",
          background: "var(--app-accent)", color: "#fff",
          fontSize: "0.95rem", fontWeight: 700, textDecoration: "none",
          fontFamily: "inherit", transition: "opacity 0.2s",
        }}
          onMouseEnter={e => (e.currentTarget.style.opacity = "0.88")}
          onMouseLeave={e => (e.currentTarget.style.opacity = "1")}>
          <Home size={18} /> العودة للرئيسية
        </Link>
      </div>
    </div>
  );
}
