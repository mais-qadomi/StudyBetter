import { useState } from "react";
import { Link, useLocation } from "wouter";
import { forgotPassword } from "../lib/api";
import { ArrowRight, Mail, Check } from "lucide-react";

export default function ForgotPasswordPage() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim()) {
      setError("البريد الإلكتروني مطلوب");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("البريد الإلكتروني غير صحيح");
      return;
    }

    setLoading(true);
    try {
      await forgotPassword(email);
      setSent(true);
    } catch (err: any) {
      setError(err?.error || "حدث خطأ، يرجى المحاولة لاحقاً");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div dir="rtl" style={{
        minHeight: "100vh", background: "var(--app-bg-page)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem",
      }}>
        <div style={{
          width: "100%", maxWidth: "420px", background: "var(--app-card)",
          border: "1.5px solid var(--app-border)", borderRadius: "16px",
          padding: "2rem", boxShadow: "var(--app-shadow)", textAlign: "center",
        }}>
          <div style={{
            width: "48px", height: "48px", borderRadius: "50%",
            background: "var(--app-block-success-bg)", border: "1.5px solid var(--app-block-success-border)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 1rem",
          }}>
            <Check size={24} color="var(--app-success)" />
          </div>
          <h1 style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--app-text)", margin: "0 0 0.5rem" }}>
            تم إرسال الرابط
          </h1>
          <p style={{ fontSize: "0.9rem", color: "var(--app-muted)", margin: "0 0 1.5rem", lineHeight: 1.6 }}>
            إذا كان البريد <strong style={{ color: "var(--app-text)" }}>{email}</strong> مسجّلاً، ستصل رسالة إعادة تعيين كلمة المرور.
            <br />
            <span style={{ fontSize: "0.8rem" }}>تحقق من صندوق البريد الوارد أو Spam</span>
          </p>
          <button onClick={() => navigate("/login")}
            style={{
              width: "100%", padding: "0.7rem", borderRadius: "10px", border: "none",
              background: "var(--app-accent)", color: "#fff", fontSize: "0.95rem",
              fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
            }}>
            العودة لتسجيل الدخول
          </button>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" style={{
      minHeight: "100vh", background: "var(--app-bg-page)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem",
    }}>
      <div style={{
        width: "100%", maxWidth: "420px", background: "var(--app-card)",
        border: "1.5px solid var(--app-border)", borderRadius: "16px",
        padding: "2rem 2rem 1.5rem", boxShadow: "var(--app-shadow)",
      }}>
        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <div style={{
            width: "48px", height: "48px", borderRadius: "14px",
            background: "var(--app-accent-bg)", border: "1.5px solid var(--app-accent-light)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 0.75rem",
          }}>
            <Mail size={22} color="var(--app-accent)" />
          </div>
          <h1 style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--app-text)", margin: 0 }}>
            نسيت كلمة المرور؟
          </h1>
          <p style={{ fontSize: "0.85rem", color: "var(--app-muted)", margin: "0.4rem 0 0" }}>
            أدخل بريدك الإلكتروني وسنرسل لك رابط إعادة التعيين
          </p>
        </div>

        {error && (
          <div style={{
            background: "var(--app-block-error-bg)", border: "1px solid var(--app-block-error-border)", borderRadius: "10px",
            padding: "0.6rem 0.8rem", marginBottom: "1rem",
            fontSize: "0.85rem", color: "var(--app-block-error-text)", textAlign: "center",
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--app-muted)", marginBottom: "0.3rem" }}>
              البريد الإلكتروني
            </label>
            <input
              type="email" value={email}
              onChange={e => { setEmail(e.target.value); setError(""); }}
              placeholder="example@email.com"
              style={{
                width: "100%", padding: "0.7rem 1rem", borderRadius: "10px",
                border: "1.5px solid var(--app-border)", background: "var(--app-bg)",
                color: "var(--app-text)", fontSize: "0.95rem", fontFamily: "inherit",
                outline: "none", boxSizing: "border-box",
              }}
              autoComplete="email"
            />
          </div>

          <button type="submit" disabled={loading}
            style={{
              width: "100%", padding: "0.7rem", borderRadius: "10px", border: "none",
              background: loading ? "var(--app-muted)" : "var(--app-accent)",
              color: "#fff", fontSize: "0.95rem", fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit",
              transition: "background 0.15s",
            }}>
            {loading ? "جاري الإرسال..." : "إرسال رابط إعادة التعيين"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: "1.2rem", fontSize: "0.85rem", color: "var(--app-muted)" }}>
          <Link href="/login" style={{ color: "var(--app-accent)", fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
            <ArrowRight size={14} /> العودة لتسجيل الدخول
          </Link>
        </div>
      </div>
    </div>
  );
}
