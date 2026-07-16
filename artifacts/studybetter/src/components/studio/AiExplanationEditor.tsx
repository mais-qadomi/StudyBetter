import { useState, useCallback } from "react";
import { Minus, Plus, Type, Palette, Trash2, X } from "lucide-react";
import { useAnnotationStore } from "../../stores/annotationStore";
import type { AiExplanationData } from "../../lib/annotation-types";

const COLOR_PRESETS = [
  { label: "بنفسجي", value: "#6d28d9", bg: "rgba(139, 92, 246, 0.12)" },
  { label: "أزرق", value: "#2563eb", bg: "rgba(37, 99, 235, 0.12)" },
  { label: "أخضر", value: "#16a34a", bg: "rgba(22, 163, 74, 0.12)" },
  { label: "برتقالي", value: "#ea580c", bg: "rgba(234, 88, 12, 0.12)" },
  { label: "أحمر", value: "#dc2626", bg: "rgba(220, 38, 38, 0.12)" },
  { label: "رمادي", value: "#4b5563", bg: "rgba(75, 85, 99, 0.12)" },
];

const FONT_SIZES = [8, 10, 11, 12, 14, 16, 18, 20];

export default function AiExplanationEditor() {
  const selectedElementId = useAnnotationStore((s) => s.selectedElementId);
  const elementsByPage = useAnnotationStore((s) => s.elementsByPage);
  const updateElement = useAnnotationStore((s) => s.updateElement);
  const deleteElement = useAnnotationStore((s) => s.deleteElement);
  const selectElement = useAnnotationStore((s) => s.selectElement);

  const [editingText, setEditingText] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [showColors, setShowColors] = useState(false);

  const selectedElement = selectedElementId
    ? Object.values(elementsByPage)
        .flat()
        .find((el) => el.id === selectedElementId && el.type === "ai_explanation")
    : null;

  const data = selectedElement?.data as AiExplanationData | undefined;

  const handleFontSize = useCallback(
    (delta: number) => {
      if (!selectedElement || !data) return;
      const newSize = Math.max(6, Math.min(28, data.fontSize + delta));
      updateElement(selectedElement.id, {
        data: { ...data, fontSize: newSize },
      });
    },
    [selectedElement, data, updateElement],
  );

  const handleColor = useCallback(
    (color: string) => {
      if (!selectedElement || !data) return;
      updateElement(selectedElement.id, {
        data: { ...data, color },
      });
      setShowColors(false);
    },
    [selectedElement, data, updateElement],
  );

  const handleFontFamily = useCallback(
    (fontFamily: string) => {
      if (!selectedElement || !data) return;
      updateElement(selectedElement.id, {
        data: { ...data, fontFamily },
      });
    },
    [selectedElement, data, updateElement],
  );

  const handleStartTextEdit = useCallback(() => {
    if (!data) return;
    setEditContent(data.content);
    setEditingText(true);
  }, [data]);

  const handleSaveText = useCallback(() => {
    if (!selectedElement || !data) return;
    updateElement(selectedElement.id, {
      data: { ...data, content: editContent },
    });
    setEditingText(false);
  }, [selectedElement, data, editContent, updateElement]);

  const handleDelete = useCallback(() => {
    if (!selectedElement) return;
    deleteElement(selectedElement.id);
    selectElement(null);
  }, [selectedElement, deleteElement, selectElement]);

  if (!selectedElement || !data) return null;

  return (
    <>
      {/* Floating toolbar */}
      <div style={panelStyle}>
        {/* Font size */}
        <div style={groupStyle}>
          <span style={labelStyle}>الحجم</span>
          <button style={smallBtnStyle} onClick={() => handleFontSize(-1)} title="تصغير">
            <Minus size={10} />
          </button>
          <span style={valueStyle}>{data.fontSize}</span>
          <button style={smallBtnStyle} onClick={() => handleFontSize(1)} title="تكبير">
            <Plus size={10} />
          </button>
        </div>

        <div style={dividerStyle} />

        {/* Color */}
        <div style={{ position: "relative" }}>
          <button
            style={{ ...smallBtnStyle, color: data.color || "#6d28d9" }}
            onClick={() => setShowColors((v) => !v)}
            title="اللون"
          >
            <Palette size={11} />
          </button>
          {showColors && (
            <div style={colorPopupStyle}>
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => handleColor(c.value)}
                  style={{
                    ...colorBtnStyle,
                    background: c.bg,
                    border: data.color === c.value ? `2px solid ${c.value}` : "2px solid transparent",
                  }}
                  title={c.label}
                >
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: c.value }} />
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={dividerStyle} />

        {/* Font family */}
        <div style={groupStyle}>
          <button
            style={{
              ...fontBtnStyle,
              fontFamily: "IBM Plex Sans Arabic, sans-serif",
              fontWeight: !data.fontFamily || data.fontFamily === "IBM Plex Sans Arabic, sans-serif" ? 700 : 400,
            }}
            onClick={() => handleFontFamily("IBM Plex Sans Arabic, sans-serif")}
            title="خط عربي"
          >
            ع
          </button>
          <button
            style={{
              ...fontBtnStyle,
              fontFamily: "Noto Naskh Arabic, serif",
              fontWeight: data.fontFamily === "Noto Naskh Arabic, serif" ? 700 : 400,
            }}
            onClick={() => handleFontFamily("Noto Naskh Arabic, serif")}
            title="Noto Naskh"
          >
            ن
          </button>
          <button
            style={{
              ...fontBtnStyle,
              fontFamily: "Amiri, serif",
              fontWeight: data.fontFamily === "Amiri, serif" ? 700 : 400,
            }}
            onClick={() => handleFontFamily("Amiri, serif")}
            title="Amiri"
          >
            أ
          </button>
        </div>

        <div style={dividerStyle} />

        {/* Edit text */}
        <button style={smallBtnStyle} onClick={handleStartTextEdit} title="تعديل النص">
          <Type size={11} />
        </button>

        {/* Delete */}
        <button
          style={{ ...smallBtnStyle, color: "var(--app-red)" }}
          onClick={handleDelete}
          title="حذف"
        >
          <Trash2 size={11} />
        </button>
      </div>

      {/* Text edit modal */}
      {editingText && (
        <>
          <div style={overlayStyle} onClick={() => setEditingText(false)} />
          <div style={modalStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontWeight: 600, fontSize: 14, fontFamily: "IBM Plex Sans Arabic, sans-serif" }}>
                تعديل الشرح
              </span>
              <button onClick={() => setEditingText(false)} style={closeBtnStyle}>
                <X size={16} />
              </button>
            </div>
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              style={textareaStyle}
              autoFocus
              dir="rtl"
            />
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button onClick={handleSaveText} style={saveBtnStyle}>حفظ</button>
              <button onClick={() => setEditingText(false)} style={cancelBtnStyle}>إلغاء</button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

// ── Styles ──

const panelStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 2,
  padding: "3px 6px",
  background: "var(--app-card)",
  border: "1px solid var(--app-border)",
  borderRadius: 8,
  boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
  fontFamily: "IBM Plex Sans Arabic, sans-serif",
  fontSize: 10,
  position: "fixed",
  bottom: 10,
  left: "50%",
  transform: "translateX(-50%)",
  zIndex: 9999,
};

const groupStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 1,
};

const labelStyle: React.CSSProperties = {
  fontSize: 9,
  color: "var(--app-muted)",
  fontWeight: 600,
};

const valueStyle: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  color: "var(--app-text)",
  minWidth: 14,
  textAlign: "center",
};

const smallBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 20,
  height: 20,
  borderRadius: 4,
  border: "1px solid var(--app-border)",
  background: "transparent",
  color: "var(--app-text)",
  cursor: "pointer",
};

const fontBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 20,
  height: 20,
  borderRadius: 4,
  border: "1px solid var(--app-border)",
  background: "transparent",
  color: "var(--app-text)",
  cursor: "pointer",
  fontSize: 10,
};

const dividerStyle: React.CSSProperties = {
  width: 1,
  height: 14,
  background: "var(--app-border)",
  margin: "0 1px",
};

const colorPopupStyle: React.CSSProperties = {
  position: "absolute",
  bottom: "100%",
  left: "50%",
  transform: "translateX(-50%)",
  marginBottom: 4,
  display: "flex",
  gap: 2,
  padding: "4px 5px",
  background: "var(--app-card)",
  border: "1px solid var(--app-border)",
  borderRadius: 6,
  boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
  zIndex: 60,
};

const colorBtnStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 20,
  height: 20,
  borderRadius: "50%",
  border: "2px solid transparent",
  cursor: "pointer",
  padding: 0,
};

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.4)",
  zIndex: 2000,
};

const modalStyle: React.CSSProperties = {
  position: "fixed",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  background: "var(--app-card)",
  border: "1px solid var(--app-border)",
  borderRadius: 10,
  padding: 14,
  zIndex: 2001,
  minWidth: 300,
  maxWidth: 420,
  boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
  fontFamily: "IBM Plex Sans Arabic, sans-serif",
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 120,
  padding: "8px 10px",
  borderRadius: 6,
  border: "1px solid var(--app-border)",
  background: "var(--app-bg)",
  color: "var(--app-text)",
  fontSize: 13,
  fontFamily: "IBM Plex Sans Arabic, sans-serif",
  lineHeight: 1.7,
  resize: "vertical",
  direction: "rtl",
  outline: "none",
};

const saveBtnStyle: React.CSSProperties = {
  flex: 1,
  padding: "6px 0",
  borderRadius: 6,
  border: "none",
  background: "var(--app-accent)",
  color: "#fff",
  fontFamily: "IBM Plex Sans Arabic, sans-serif",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};

const cancelBtnStyle: React.CSSProperties = {
  flex: 1,
  padding: "6px 0",
  borderRadius: 6,
  border: "1px solid var(--app-border)",
  background: "transparent",
  color: "var(--app-text)",
  fontFamily: "IBM Plex Sans Arabic, sans-serif",
  fontSize: 12,
  cursor: "pointer",
};

const closeBtnStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 22,
  height: 22,
  borderRadius: 4,
  border: "none",
  background: "transparent",
  color: "var(--app-muted)",
  cursor: "pointer",
};
