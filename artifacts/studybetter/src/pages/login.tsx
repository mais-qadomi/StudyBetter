import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "../stores/authStore";
import { Eye, EyeOff, LogIn } from "lucide-react";

export default function LoginPage() {
  const [, navigate] = useLocation();
  const { login, loading, providers, fetchProviders } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  const params = new URLSearchParams(window.location.search);
  const redirectTo = params.get("from") || "/";

  useEffect(() => { fetchProviders(); }, [fetchProviders]);

  const validateEmail = (v: string) => {
    if (!v.trim()) return "البريد الإلكتروني مطلوب";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "البريد الإلكتروني غير صحيح";
    return undefined;
  };

  const validatePassword = (v: string) => {
    if (!v) return "كلمة المرور مطلوبة";
    return undefined;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const emailErr = validateEmail(email);
    const passErr = validatePassword(password);
    setFieldErrors({ email: emailErr, password: passErr });
    if (emailErr || passErr) return;

    try {
      await login(email, password, rememberMe);
      navigate(redirectTo);
    } catch (err: any) {
      if (err?.status === 423) {
        setError(err.error || "الحساب مقفل مؤقتاً");
      } else {
        setError(err?.error || "البريد الإلكتروني أو كلمة المرور غير صحيحة");
      }
    }
  };

  const inputStyle = (hasError?: boolean): React.CSSProperties => ({
    width: "100%",
    padding: "0.7rem 1rem",
    borderRadius: "10px",
    border: `1.5px solid ${hasError ? "var(--app-red)" : "var(--app-border)"}`,
    background: "var(--app-bg)",
    color: "var(--app-text)",
    fontSize: "0.95rem",
    fontFamily: "inherit",
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.15s",
  });

  return (
    <div dir="rtl" style={{
      minHeight: "100vh",
      background: "var(--app-bg-page)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "1rem",
    }}>
      <div style={{
        width: "100%",
        maxWidth: "420px",
        background: "var(--app-card)",
        border: "1.5px solid var(--app-border)",
        borderRadius: "16px",
        padding: "2rem 2rem 1.5rem",
        boxShadow: "var(--app-shadow)",
      }}>
        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <div style={{
            width: "48px", height: "48px", borderRadius: "14px",
            background: "var(--app-accent-bg)", border: "1.5px solid var(--app-accent-light)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 0.75rem",
          }}>
            <LogIn size={22} color="var(--app-accent)" />
          </div>
          <h1 style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--app-text)", margin: 0 }}>
            تسجيل الدخول
          </h1>
          <p style={{ fontSize: "0.85rem", color: "var(--app-muted)", margin: "0.4rem 0 0" }}>
            أدخل بياناتك للوصول لحسابك
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
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setFieldErrors(p => ({ ...p, email: undefined })); setError(""); }}
              onBlur={() => setFieldErrors(p => ({ ...p, email: validateEmail(email) }))}
              placeholder="example@email.com"
              style={inputStyle(!!fieldErrors.email)}
              autoComplete="email"
            />
            {fieldErrors.email && (
              <p style={{ fontSize: "0.78rem", color: "var(--app-danger)", margin: "0.25rem 0 0" }}>{fieldErrors.email}</p>
            )}
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--app-muted)", marginBottom: "0.3rem" }}>
              كلمة المرور
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={e => { setPassword(e.target.value); setFieldErrors(p => ({ ...p, password: undefined })); setError(""); }}
                onBlur={() => setFieldErrors(p => ({ ...p, password: validatePassword(password) }))}
                placeholder="••••••••"
                style={{ ...inputStyle(!!fieldErrors.password), paddingLeft: "2.5rem" }}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(s => !s)}
                style={{
                  position: "absolute", left: "0.7rem", top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer", padding: "2px",
                  color: "var(--app-muted)", display: "flex",
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {fieldErrors.password && (
              <p style={{ fontSize: "0.78rem", color: "var(--app-danger)", margin: "0.25rem 0 0" }}>{fieldErrors.password}</p>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer", fontSize: "0.82rem", color: "var(--app-muted)" }}>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
                style={{ accentColor: "var(--app-accent)" }}
              />
              تذكرني
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%", padding: "0.7rem", borderRadius: "10px",
              border: "none", background: loading ? "var(--app-muted)" : "var(--app-accent)",
              color: "#fff", fontSize: "0.95rem", fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit",
              transition: "background 0.15s",
            }}
          >
            {loading ? "جاري التحقق..." : "دخول"}
          </button>
        </form>

        {providers.google && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: "0.8rem", margin: "1.2rem 0 0.8rem" }}>
              <div style={{ flex: 1, height: "1px", background: "var(--app-border)" }} />
              <span style={{ fontSize: "0.78rem", color: "var(--app-muted)", whiteSpace: "nowrap" }}>أو</span>
              <div style={{ flex: 1, height: "1px", background: "var(--app-border)" }} />
            </div>

            <a href={`${import.meta.env.VITE_API_URL || "/api"}/auth/google`}
              style={{
                width: "100%", padding: "0.65rem", borderRadius: "10px",
                border: "1.5px solid var(--app-border)", background: "var(--app-bg)",
                color: "var(--app-text)", fontSize: "0.9rem", fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit", display: "flex",
                alignItems: "center", justifyContent: "center", gap: "0.5rem",
                textDecoration: "none", transition: "border-color 0.15s",
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--app-accent)")}
              onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--app-border)")}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              تسجيل الدخول بـ Google
            </a>
          </>
        )}

        <div style={{ textAlign: "center", marginTop: "1rem", fontSize: "0.85rem", color: "var(--app-muted)" }}>
          ليس لديك حساب؟{" "}
          <Link href="/register" style={{ color: "var(--app-accent)", fontWeight: 700, textDecoration: "none" }}>
            أنشئ حساباً جديداً
          </Link>
        </div>

        <div style={{ textAlign: "center", marginTop: "0.6rem", fontSize: "0.78rem" }}>
          <Link href="/forgot-password" style={{ color: "var(--app-muted)", textDecoration: "none" }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--app-accent)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--app-muted)")}>
            نسيت كلمة المرور؟
          </Link>
        </div>
      </div>
    </div>
  );
}
