import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "../stores/authStore";
import { Eye, EyeOff, UserPlus, Check, X } from "lucide-react";

function getPasswordStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  if (score <= 1) return { score: 1, label: "ضعيفة", color: "var(--app-red)" };
  if (score <= 3) return { score: 2, label: "متوسطة", color: "var(--app-amber)" };
  return { score: 3, label: "قوية", color: "var(--app-green)" };
}

export default function RegisterPage() {
  const [, navigate] = useLocation();
  const { register, checkEmail, loading, providers, fetchProviders } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({});

  const params = new URLSearchParams(window.location.search);
  const redirectTo = params.get("from") || "/";
  const [emailStatus, setEmailStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");

  const emailTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const passwordStrength = getPasswordStrength(password);

  const checkEmailDebounced = useCallback((value: string) => {
    if (emailTimerRef.current) clearTimeout(emailTimerRef.current);
    if (!value.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setEmailStatus("idle");
      return;
    }
    setEmailStatus("checking");
    emailTimerRef.current = setTimeout(async () => {
      try {
        const available = await checkEmail(value);
        setEmailStatus(available ? "available" : "taken");
      } catch {
        setEmailStatus("idle");
      }
    }, 600);
  }, [checkEmail]);

  useEffect(() => {
    return () => { if (emailTimerRef.current) clearTimeout(emailTimerRef.current); };
  }, []);

  useEffect(() => { fetchProviders(); }, [fetchProviders]);

  const validateName = (v: string) => {
    if (!v.trim()) return "الاسم مطلوب";
    if (v.trim().length < 2) return "الاسم يجب أن يكون حرفين على الأقل";
    return undefined;
  };

  const validateEmail = (v: string) => {
    if (!v.trim()) return "البريد الإلكتروني مطلوب";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "البريد الإلكتروني غير صحيح";
    return undefined;
  };

  const validatePassword = (v: string) => {
    if (!v) return "كلمة المرور مطلوبة";
    if (v.length < 8) return "كلمة المرور يجب أن تكون 8 أحرف على الأقل";
    return undefined;
  };

  const validateConfirm = (v: string) => {
    if (!v) return "تأكيد كلمة المرور مطلوب";
    if (v !== password) return "كلمتا المرور غير متطابقتين";
    return undefined;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const errors = {
      name: validateName(name),
      email: validateEmail(email),
      password: validatePassword(password),
      confirm: validateConfirm(confirmPassword),
    };
    setFieldErrors(errors);
    if (Object.values(errors).some(Boolean)) return;

    if (!agreed) {
      setError("يجب الموافقة على الشروط وسياسة الخصوصية");
      return;
    }

    if (emailStatus === "taken") {
      setError("البريد الإلكتروني مستخدم بالفعل");
      return;
    }

    try {
      await register(name, email, password);
      navigate(redirectTo);
    } catch (err: any) {
      setError(err?.error || "حدث خطأ أثناء إنشاء الحساب");
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

  const strengthWidth = password ? `${(passwordStrength.score / 3) * 100}%` : "0%";

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
            <UserPlus size={22} color="var(--app-accent)" />
          </div>
          <h1 style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--app-text)", margin: 0 }}>
            إنشاء حساب جديد
          </h1>
          <p style={{ fontSize: "0.85rem", color: "var(--app-muted)", margin: "0.4rem 0 0" }}>
            أنشئ حسابك وابدأ رحلة التعلم
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

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--app-muted)", marginBottom: "0.3rem" }}>
              الاسم الكامل
            </label>
            <input
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); setFieldErrors(p => ({ ...p, name: undefined })); }}
              onBlur={() => setFieldErrors(p => ({ ...p, name: validateName(name) }))}
              placeholder="محمد أحمد"
              style={inputStyle(!!fieldErrors.name)}
              autoComplete="name"
            />
            {fieldErrors.name && <p style={{ fontSize: "0.78rem", color: "var(--app-danger)", margin: "0.2rem 0 0" }}>{fieldErrors.name}</p>}
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--app-muted)", marginBottom: "0.3rem" }}>
              البريد الإلكتروني
            </label>
            <div style={{ position: "relative" }}>
              <input
                type="email"
                value={email}
                onChange={e => {
                  setEmail(e.target.value);
                  setFieldErrors(p => ({ ...p, email: undefined }));
                  checkEmailDebounced(e.target.value);
                }}
                onBlur={() => setFieldErrors(p => ({ ...p, email: validateEmail(email) }))}
                placeholder="example@email.com"
                style={{
                  ...inputStyle(!!fieldErrors.email || emailStatus === "taken"),
                  paddingLeft: emailStatus === "available" || emailStatus === "taken" ? "2.2rem" : "1rem",
                }}
                autoComplete="email"
              />
              {emailStatus === "available" && (
                <Check size={16} color="var(--app-green)" style={{ position: "absolute", left: "0.7rem", top: "50%", transform: "translateY(-50%)" }} />
              )}
              {emailStatus === "taken" && (
                <X size={16} color="var(--app-red)" style={{ position: "absolute", left: "0.7rem", top: "50%", transform: "translateY(-50%)" }} />
              )}
            </div>
            {fieldErrors.email && <p style={{ fontSize: "0.78rem", color: "var(--app-danger)", margin: "0.2rem 0 0" }}>{fieldErrors.email}</p>}
            {emailStatus === "taken" && !fieldErrors.email && (
              <p style={{ fontSize: "0.78rem", color: "var(--app-danger)", margin: "0.2rem 0 0" }}>البريد الإلكتروني مستخدم بالفعل</p>
            )}
            {emailStatus === "checking" && (
              <p style={{ fontSize: "0.78rem", color: "var(--app-muted)", margin: "0.2rem 0 0" }}>جاري التحقق...</p>
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
                onChange={e => { setPassword(e.target.value); setFieldErrors(p => ({ ...p, password: undefined })); }}
                onBlur={() => setFieldErrors(p => ({ ...p, password: validatePassword(password) }))}
                placeholder="8 أحرف على الأقل"
                style={{ ...inputStyle(!!fieldErrors.password), paddingLeft: "2.5rem" }}
                autoComplete="new-password"
              />
              <button type="button" onClick={() => setShowPassword(s => !s)}
                style={{ position: "absolute", left: "0.7rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: "2px", color: "var(--app-muted)", display: "flex" }}>
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {password && (
              <div style={{ marginTop: "0.3rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.15rem" }}>
                  <div style={{ flex: 1, height: "4px", borderRadius: "2px", background: "var(--app-border)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: strengthWidth, background: passwordStrength.color, borderRadius: "2px", transition: "width 0.3s, background 0.3s" }} />
                  </div>
                  <span style={{ fontSize: "0.72rem", color: passwordStrength.color, fontWeight: 600, minWidth: "3rem", textAlign: "left" }}>{passwordStrength.label}</span>
                </div>
              </div>
            )}
            {fieldErrors.password && <p style={{ fontSize: "0.78rem", color: "var(--app-danger)", margin: "0.2rem 0 0" }}>{fieldErrors.password}</p>}
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--app-muted)", marginBottom: "0.3rem" }}>
              تأكيد كلمة المرور
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={e => { setConfirmPassword(e.target.value); setFieldErrors(p => ({ ...p, confirm: undefined })); }}
                onBlur={() => setFieldErrors(p => ({ ...p, confirm: validateConfirm(confirmPassword) }))}
                placeholder="أعد إدخال كلمة المرور"
                style={{ ...inputStyle(!!fieldErrors.confirm || (!!confirmPassword && confirmPassword !== password)), paddingLeft: "2.5rem" }}
                autoComplete="new-password"
              />
              <button type="button" onClick={() => setShowConfirm(s => !s)}
                style={{ position: "absolute", left: "0.7rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: "2px", color: "var(--app-muted)", display: "flex" }}>
                {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {fieldErrors.confirm && <p style={{ fontSize: "0.78rem", color: "var(--app-danger)", margin: "0.2rem 0 0" }}>{fieldErrors.confirm}</p>}
            {confirmPassword && confirmPassword === password && !fieldErrors.confirm && (
              <p style={{ fontSize: "0.78rem", color: "var(--app-green)", margin: "0.2rem 0 0" }}>المتطابقتان ✓</p>
            )}
          </div>

          <label style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", cursor: "pointer", fontSize: "0.8rem", color: "var(--app-muted)", lineHeight: 1.5 }}>
            <input
              type="checkbox"
              checked={agreed}
              onChange={e => { setAgreed(e.target.checked); setError(""); }}
              style={{ accentColor: "var(--app-accent)", marginTop: "2px", flexShrink: 0 }}
            />
            <span>
              أوافق على{" "}
              <a href="#" style={{ color: "var(--app-accent)", fontWeight: 600, textDecoration: "none" }}>الشروط والأحكام</a>
              {" "}و{" "}
              <a href="#" style={{ color: "var(--app-accent)", fontWeight: 600, textDecoration: "none" }}>سياسة الخصوصية</a>
            </span>
          </label>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%", padding: "0.7rem", borderRadius: "10px",
              border: "none", background: loading ? "var(--app-muted)" : "var(--app-accent)",
              color: "#fff", fontSize: "0.95rem", fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit",
              transition: "background 0.15s", marginTop: "0.25rem",
            }}
          >
            {loading ? "جاري الإنشاء..." : "إنشاء الحساب"}
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
              التسجيل بـ Google
            </a>
          </>
        )}

        <div style={{ textAlign: "center", marginTop: "1rem", fontSize: "0.85rem", color: "var(--app-muted)" }}>
          لديك حساب بالفعل؟{" "}
          <Link href="/login" style={{ color: "var(--app-accent)", fontWeight: 700, textDecoration: "none" }}>
            سجّل الدخول
          </Link>
        </div>
      </div>
    </div>
  );
}
