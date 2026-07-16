import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { resetPassword } from "../lib/api";
import { Eye, EyeOff, Check, AlertTriangle } from "lucide-react";

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

export default function ResetPasswordPage() {
  const [, navigate] = useLocation();
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const passwordStrength = getPasswordStrength(newPassword);
  const strengthWidth = newPassword ? `${(passwordStrength.score / 3) * 100}%` : "0%";

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    if (t) setToken(t);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!token) {
      setError("توكن غير صالح");
      return;
    }
    if (!newPassword) {
      setError("كلمة المرور الجديدة مطلوبة");
      return;
    }
    if (newPassword.length < 8) {
      setError("كلمة المرور يجب أن تكون 8 أحرف على الأقل");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("كلمتا المرور غير متطابقتين");
      return;
    }

    setLoading(true);
    try {
      await resetPassword(token, newPassword);
      setSuccess(true);
    } catch (err: any) {
      setError(err?.error || "حدث خطأ، يرجى المحاولة لاحقاً");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
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
            تم تغيير كلمة المرور بنجاح
          </h1>
          <p style={{ fontSize: "0.9rem", color: "var(--app-muted)", margin: "0 0 1.5rem" }}>
            يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة
          </p>
          <button onClick={() => navigate("/login")}
            style={{
              width: "100%", padding: "0.7rem", borderRadius: "10px", border: "none",
              background: "var(--app-accent)", color: "#fff", fontSize: "0.95rem",
              fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
            }}>
            تسجيل الدخول
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
            <AlertTriangle size={22} color="var(--app-accent)" />
          </div>
          <h1 style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--app-text)", margin: 0 }}>
            إعادة تعيين كلمة المرور
          </h1>
          <p style={{ fontSize: "0.85rem", color: "var(--app-muted)", margin: "0.4rem 0 0" }}>
            أدخل كلمة المرور الجديدة
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

        {!token ? (
          <div style={{
            background: "var(--app-block-error-bg)", border: "1px solid var(--app-block-error-border)", borderRadius: "10px",
            padding: "1rem", textAlign: "center", fontSize: "0.9rem", color: "var(--app-block-error-text)",
          }}>
            توكن إعادة التعيين غير موجود أو غير صالح
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--app-muted)", marginBottom: "0.3rem" }}>
                كلمة المرور الجديدة
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={newPassword} onChange={e => setNewPassword(e.target.value)}
                  placeholder="8 أحرف على الأقل"
                  style={{
                    width: "100%", padding: "0.7rem 1rem", borderRadius: "10px",
                    border: "1.5px solid var(--app-border)", background: "var(--app-bg)",
                    color: "var(--app-text)", fontSize: "0.95rem", fontFamily: "inherit",
                    outline: "none", boxSizing: "border-box", paddingLeft: "2.5rem",
                  }}
                  autoComplete="new-password"
                />
                <button type="button" onClick={() => setShowPassword(s => !s)}
                  style={{ position: "absolute", left: "0.7rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: "2px", color: "var(--app-muted)", display: "flex" }}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {newPassword && (
                <div style={{ marginTop: "0.3rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <div style={{ flex: 1, height: "4px", borderRadius: "2px", background: "var(--app-border)", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: strengthWidth, background: passwordStrength.color, borderRadius: "2px", transition: "width 0.3s, background 0.3s" }} />
                    </div>
                    <span style={{ fontSize: "0.72rem", color: passwordStrength.color, fontWeight: 600, minWidth: "3rem" }}>{passwordStrength.label}</span>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--app-muted)", marginBottom: "0.3rem" }}>
                تأكيد كلمة المرور
              </label>
              <input
                type="password" value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="أعد إدخال كلمة المرور"
                style={{
                  width: "100%", padding: "0.7rem 1rem", borderRadius: "10px",
                  border: `1.5px solid ${confirmPassword && confirmPassword !== newPassword ? "var(--app-red)" : "var(--app-border)"}`,
                  background: "var(--app-bg)", color: "var(--app-text)",
                  fontSize: "0.95rem", fontFamily: "inherit", outline: "none", boxSizing: "border-box",
                }}
                autoComplete="new-password"
              />
              {confirmPassword && confirmPassword === newPassword && (
                <p style={{ fontSize: "0.78rem", color: "var(--app-green)", margin: "0.2rem 0 0" }}>المتطابقتان ✓</p>
              )}
            </div>

            <button type="submit" disabled={loading}
              style={{
                width: "100%", padding: "0.7rem", borderRadius: "10px", border: "none",
                background: loading ? "var(--app-muted)" : "var(--app-accent)",
                color: "#fff", fontSize: "0.95rem", fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit",
                transition: "background 0.15s", marginTop: "0.25rem",
              }}>
              {loading ? "جاري التغيير..." : "تغيير كلمة المرور"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
