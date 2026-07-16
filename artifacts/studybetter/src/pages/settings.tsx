import { useState, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "../stores/authStore";
import { useToast } from "../stores/toastStore";
import { ArrowRight, User, Shield, Trash2, Eye, EyeOff, Camera, Check, AlertTriangle } from "lucide-react";

function getAvatarColor(name: string): string {
  return `hsl(${name.charCodeAt(0) * 37 % 360}, 55%, 55%)`;
}

export default function SettingsPage() {
  const [, navigate] = useLocation();
  const { user, updateProfile, changePassword, deleteAccount, logout } = useAuth();
  const toast = useToast();

  // Profile state
  const [name, setName] = useState(user?.name || "");
  const [savingProfile, setSavingProfile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Password state
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  // Delete state
  const [deletePw, setDeletePw] = useState("");
  const [showDeletePw, setShowDeletePw] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!user) return null;

  const avatarColor = getAvatarColor(user.name);
  const avatarInitial = user.name?.charAt(0) || "؟";

  const handleSaveProfile = async () => {
    if (!name.trim() || name.trim() === user.name) {
      toast.addToast("لا يوجد تغييرات", "info");
      return;
    }
    setSavingProfile(true);
    try {
      await updateProfile({ name: name.trim() });
      toast.addToast("تم تحديث الملف الشخصي", "success");
    } catch (err: any) {
      toast.addToast(err?.error || "فشل التحديث", "error");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPw || !newPw || !confirmPw) {
      toast.addToast("جميع الحقول مطلوبة", "error");
      return;
    }
    if (newPw.length < 8) {
      toast.addToast("كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل", "error");
      return;
    }
    if (newPw !== confirmPw) {
      toast.addToast("كلمتا المرور غير متطابقتين", "error");
      return;
    }
    if (currentPw === newPw) {
      toast.addToast("كلمة المرور الجديدة مختلفة عن الحالية", "error");
      return;
    }
    setSavingPw(true);
    try {
      await changePassword(currentPw, newPw);
      toast.addToast("تم تغيير كلمة المرور بنجاح", "success");
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    } catch (err: any) {
      toast.addToast(err?.error || "فشل تغيير كلمة المرور", "error");
    } finally {
      setSavingPw(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletePw) {
      toast.addToast("كلمة المرور مطلوبة", "error");
      return;
    }
    setDeleting(true);
    try {
      await deleteAccount(deletePw);
      navigate("/login");
    } catch (err: any) {
      toast.addToast(err?.error || "فشل حذف الحساب", "error");
    } finally {
      setDeleting(false);
    }
  };

  const sectionStyle: React.CSSProperties = {
    background: "var(--app-card)", border: "1.5px solid var(--app-border)", borderRadius: "16px",
    padding: "1.5rem", marginBottom: "1.2rem",
  };

  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--app-muted)",
    marginBottom: "0.35rem",
  };

  const inputStyle = (hasError = false): React.CSSProperties => ({
    width: "100%", padding: "0.65rem 0.8rem", borderRadius: "10px",
    border: `1.5px solid ${hasError ? "var(--app-red)" : "var(--app-border)"}`,
    background: "var(--app-bg)", color: "var(--app-text)",
    fontSize: "0.9rem", fontFamily: "inherit", outline: "none", boxSizing: "border-box" as const,
  });

  const btnPrimary: React.CSSProperties = {
    padding: "0.6rem 1.2rem", borderRadius: "10px", border: "none",
    background: "var(--app-accent)", color: "#fff", fontSize: "0.85rem",
    fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
  };

  const btnDanger: React.CSSProperties = {
    ...btnPrimary, background: "var(--app-red, #dc2626)",
  };

  const btnDisabled: React.CSSProperties = {
    ...btnPrimary, background: "var(--app-muted)", cursor: "not-allowed",
  };

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto", padding: "1.5rem 1rem 3rem" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1.5rem" }}>
        <Link href="/" style={{ color: "var(--app-muted)", display: "flex", padding: "4px" }}>
          <ArrowRight size={20} />
        </Link>
        <h1 style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--app-text)", margin: 0 }}>
          الإعدادات
        </h1>
      </div>

      {/* Profile Section */}
      <div style={sectionStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
          <User size={18} color="var(--app-accent)" />
          <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--app-text)", margin: 0 }}>
            الملف الشخصي
          </h2>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
          <div style={{ position: "relative" }}>
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt="" style={{ width: "72px", height: "72px", borderRadius: "50%", objectFit: "cover" }} />
            ) : (
              <div style={{
                width: "72px", height: "72px", borderRadius: "50%", background: avatarColor,
                color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "1.8rem", fontWeight: 700,
              }}>
                {avatarInitial}
              </div>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                position: "absolute", bottom: 0, right: 0, width: "26px", height: "26px",
                borderRadius: "50%", background: "var(--app-accent)", color: "#fff",
                border: "2px solid var(--app-card)", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <Camera size={13} />
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = async () => {
                  try {
                    await updateProfile({ avatarUrl: reader.result as string });
                  } catch {}
                };
                reader.readAsDataURL(file);
              }}
            />
          </div>
          <div>
            <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--app-text)" }}>{user.name}</div>
            <div style={{ fontSize: "0.82rem", color: "var(--app-muted)", direction: "ltr" }}>{user.email}</div>
          </div>
        </div>

        <div style={{ marginBottom: "0.8rem" }}>
          <label style={labelStyle}>الاسم</label>
          <input
            type="text" value={name} onChange={e => setName(e.target.value)}
            style={inputStyle()} placeholder="اسمك"
          />
        </div>

        <button
          onClick={handleSaveProfile}
          disabled={savingProfile || !name.trim() || name.trim() === user.name}
          style={savingProfile || !name.trim() || name.trim() === user.name ? btnDisabled : btnPrimary}
        >
          {savingProfile ? "جاري الحفظ..." : "حفظ التغييرات"}
        </button>
      </div>

      {/* Security Section */}
      <div style={sectionStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
          <Shield size={18} color="var(--app-accent)" />
          <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--app-text)", margin: 0 }}>
            الأمان
          </h2>
        </div>

        <div style={{ marginBottom: "0.8rem" }}>
          <label style={labelStyle}>كلمة المرور الحالية</label>
          <div style={{ position: "relative" }}>
            <input
              type={showCurrentPw ? "text" : "password"}
              value={currentPw} onChange={e => setCurrentPw(e.target.value)}
              style={{ ...inputStyle(), paddingLeft: "2.5rem" }} placeholder="••••••••"
            />
            <button onClick={() => setShowCurrentPw(!showCurrentPw)}
              style={{ position: "absolute", left: "0.5rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--app-muted)", display: "flex", padding: "4px" }}>
              {showCurrentPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div style={{ marginBottom: "0.8rem" }}>
          <label style={labelStyle}>كلمة المرور الجديدة</label>
          <div style={{ position: "relative" }}>
            <input
              type={showNewPw ? "text" : "password"}
              value={newPw} onChange={e => setNewPw(e.target.value)}
              style={{ ...inputStyle(), paddingLeft: "2.5rem" }} placeholder="8 أحرف على الأقل"
            />
            <button onClick={() => setShowNewPw(!showNewPw)}
              style={{ position: "absolute", left: "0.5rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--app-muted)", display: "flex", padding: "4px" }}>
              {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div style={{ marginBottom: "0.8rem" }}>
          <label style={labelStyle}>تأكيد كلمة المرور الجديدة</label>
          <input
            type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
            style={inputStyle()} placeholder="أعد إدخال كلمة المرور الجديدة"
          />
        </div>

        <button
          onClick={handleChangePassword}
          disabled={savingPw || !currentPw || !newPw || !confirmPw}
          style={savingPw || !currentPw || !newPw || !confirmPw ? btnDisabled : btnPrimary}
        >
          {savingPw ? "جاري التغيير..." : "تغيير كلمة المرور"}
        </button>
      </div>

      {/* Danger Zone */}
      <div style={{ ...sectionStyle, border: "1.5px solid var(--app-red-light, #fecaca)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
          <Trash2 size={18} color="var(--app-red)" />
          <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--app-red)", margin: 0 }}>
            حذف الحساب
          </h2>
        </div>

        <div style={{
          padding: "0.8rem", borderRadius: "10px", background: "var(--app-danger-bg, #fef2f2)",
          border: "1px solid var(--app-red-light, #fecaca)", marginBottom: "1rem", fontSize: "0.85rem", color: "var(--app-danger-text, #991b1b)",
        }}>
          <AlertTriangle size={15} style={{ verticalAlign: "middle", marginLeft: 4 }} />
          هذا الإجراء لا رجعة فيه. سيتم حذف جميع بياناتك نهائياً (المشاريع، الجلسات، الملفات).
        </div>

        <div style={{ marginBottom: "0.8rem" }}>
          <label style={labelStyle}>أدخل كلمة المرور للتأكيد</label>
          <div style={{ position: "relative" }}>
            <input
              type={showDeletePw ? "text" : "password"}
              value={deletePw} onChange={e => setDeletePw(e.target.value)}
              style={{ ...inputStyle(), paddingLeft: "2.5rem" }} placeholder="••••••••"
            />
            <button onClick={() => setShowDeletePw(!showDeletePw)}
              style={{ position: "absolute", left: "0.5rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--app-muted)", display: "flex", padding: "4px" }}>
              {showDeletePw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {!confirmDelete ? (
          <button onClick={() => deletePw && setConfirmDelete(true)} disabled={!deletePw}
            style={!deletePw ? { ...btnDanger, background: "var(--app-muted)", cursor: "not-allowed" } : btnDanger}>
            حذف الحساب
          </button>
        ) : (
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button onClick={() => setConfirmDelete(false)}
              style={{ ...btnPrimary, background: "var(--app-bg)", color: "var(--app-text)", border: "1.5px solid var(--app-border)" }}>
              إلغاء
            </button>
            <button onClick={handleDeleteAccount} disabled={deleting}
              style={deleting ? { ...btnDanger, opacity: 0.7 } : btnDanger}>
              {deleting ? "جاري الحذف..." : "نعم، حذف الحساب نهائياً"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
