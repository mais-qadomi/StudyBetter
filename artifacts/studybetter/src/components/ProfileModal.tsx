import { useState, useRef } from "react";
import { useAuth } from "../stores/authStore";
import { X, Camera, User } from "lucide-react";

function getAvatarColor(name: string): string {
  return `hsl(${name.charCodeAt(0) * 37 % 360}, 55%, 55%)`;
}

interface ProfileModalProps {
  open: boolean;
  onClose: () => void;
}

export default function ProfileModal({ open, onClose }: ProfileModalProps) {
  const { user, updateProfile } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!open || !user) return null;

  const avatarColor = getAvatarColor(user.name);
  const avatarInitial = user.name?.charAt(0) || "؟";

  const handleSave = async () => {
    if (!name.trim() || name.trim() === user.name) {
      onClose();
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await updateProfile({ name: name.trim() });
      setMessage({ type: "success", text: "تم تحديث الملف الشخصي" });
      setTimeout(() => onClose(), 800);
    } catch (err: any) {
      setMessage({ type: "error", text: err?.error || "فشل التحديث" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)",
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "var(--app-card)", border: "1.5px solid var(--app-border)",
          borderRadius: "16px", padding: "1.5rem", width: "100%", maxWidth: "380px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)", position: "relative",
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: "absolute", top: "0.7rem", left: "0.7rem",
            background: "none", border: "none", cursor: "pointer",
            color: "var(--app-muted)", display: "flex", padding: "4px",
          }}
        >
          <X size={18} />
        </button>

        <div style={{ textAlign: "center", marginBottom: "1.2rem" }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--app-text)", margin: 0 }}>
            الملف الشخصي
          </h2>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem", marginBottom: "1.2rem" }}>
          <div style={{ position: "relative" }}>
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt="" style={{ width: "72px", height: "72px", borderRadius: "50%", objectFit: "cover" }} />
            ) : (
              <div style={{
                width: "72px", height: "72px", borderRadius: "50%",
                background: avatarColor, color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "1.8rem", fontWeight: 700,
              }}>
                {avatarInitial}
              </div>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                position: "absolute", bottom: 0, right: 0,
                width: "24px", height: "24px", borderRadius: "50%",
                background: "var(--app-accent)", color: "#fff",
                border: "2px solid var(--app-card)", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <Camera size={12} />
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = async () => {
                  const dataUrl = reader.result as string;
                  try {
                    await updateProfile({ avatarUrl: dataUrl });
                  } catch {}
                };
                reader.readAsDataURL(file);
              }}
            />
          </div>
          <div style={{ fontSize: "0.8rem", color: "var(--app-muted)" }}>{user.email}</div>
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--app-muted)", marginBottom: "0.3rem" }}>
            الاسم
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            style={{
              width: "100%", padding: "0.65rem 0.8rem", borderRadius: "10px",
              border: "1.5px solid var(--app-border)", background: "var(--app-bg)",
              color: "var(--app-text)", fontSize: "0.9rem", fontFamily: "inherit",
              outline: "none", boxSizing: "border-box",
            }}
          />
        </div>

        {message && (
          <div style={{
            padding: "0.5rem 0.7rem", borderRadius: "8px", marginBottom: "0.8rem",
            fontSize: "0.82rem", textAlign: "center",
            background: message.type === "success" ? "var(--app-success-bg, #f0fdf4)" : "var(--app-error-bg)",
            color: message.type === "success" ? "var(--app-success)" : "var(--app-danger)",
            border: `1px solid ${message.type === "success" ? "var(--app-success-border, #bbf7d0)" : "var(--app-error-border)"}`,
          }}>
            {message.text}
          </div>
        )}

        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: "0.6rem", borderRadius: "10px",
              border: "1.5px solid var(--app-border)", background: "var(--app-bg)",
              color: "var(--app-text)", fontSize: "0.85rem", fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit",
            }}
          >
            إلغاء
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            style={{
              flex: 1, padding: "0.6rem", borderRadius: "10px",
              border: "none", background: saving || !name.trim() ? "var(--app-muted)" : "var(--app-accent)",
              color: "#fff", fontSize: "0.85rem", fontWeight: 700,
              cursor: saving || !name.trim() ? "not-allowed" : "pointer", fontFamily: "inherit",
            }}
          >
            {saving ? "جاري الحفظ..." : "حفظ"}
          </button>
        </div>
      </div>
    </div>
  );
}
