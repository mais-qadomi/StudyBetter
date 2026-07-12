import { useState, useEffect, useRef } from "react";
import { Timer, Settings, Play, Pause, RotateCcw, Coffee, Brain, Moon, GripVertical } from "lucide-react";

type Mode = "work" | "short" | "long";

interface Props {
  workMin: number;
  shortMin: number;
  longMin: number;
  mode: Mode;
  seconds: number;
  running: boolean;
  pomodoroCount: number;
  activeTask: { id: string; text: string } | null;
  pomoDragOver: boolean;
  muted: boolean;
  onToggleMute: () => void;
  onSetMode: (m: Mode) => void;
  onSetRunning: (r: boolean) => void;
  onReset: () => void;
  onSaveSettings: (w: number, s: number, l: number) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
}

const MODE_META: Record<Mode, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  work: { label: "وقت التركيز", icon: <Brain size={16} />, color: "var(--app-work)", bg: "var(--app-primary-bg)" },
  short: { label: "استراحة قصيرة", icon: <Coffee size={16} />, color: "var(--app-short)", bg: "var(--app-primary-bg)" },
  long: { label: "استراحة طويلة", icon: <Moon size={16} />, color: "var(--app-long)", bg: "var(--app-accent-bg)" },
};

export default function PomodoroTimer({
  workMin, shortMin, longMin, mode, seconds, running, pomodoroCount,
  activeTask, pomoDragOver, muted, onToggleMute,
  onSetMode, onSetRunning, onReset, onSaveSettings,
  onDrop, onDragOver, onDragLeave,
}: Props) {
  const [showSettings, setShowSettings] = useState(false);
  const [tempWork, setTempWork] = useState(workMin);
  const [tempShort, setTempShort] = useState(shortMin);
  const [tempLong, setTempLong] = useState(longMin);
  const ringRef = useRef<SVGCircleElement>(null);

  const meta = MODE_META[mode];
  const totalSecs = (mode === "work" ? workMin : mode === "short" ? shortMin : longMin) * 60;
  const progress = totalSecs > 0 ? (totalSecs - seconds) / totalSecs : 0;
  const circumference = 2 * Math.PI * 90;

  const mins = String(Math.floor(seconds / 60)).padStart(2, "0");
  const secs = String(seconds % 60).padStart(2, "0");

  useEffect(() => {
    setTempWork(workMin); setTempShort(shortMin); setTempLong(longMin);
  }, [workMin, shortMin, longMin]);

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={{
        background: pomoDragOver ? "var(--app-primary-bg-light)" : "var(--app-card)",
        borderRadius: "20px", padding: "1.5rem",
        boxShadow: "var(--app-shadow)",
        border: pomoDragOver ? "2px dashed var(--app-primary)" : "1.5px solid var(--app-border)",
        display: "flex", flexDirection: "column", alignItems: "center",
        transition: "all 0.2s",
        direction: "rtl",
      }}
    >
      {/* Header */}
      <div style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
        <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "var(--app-text)", display: "flex", alignItems: "center", gap: "6px" }}>
          <Timer size={20} color="var(--app-primary)" /> بومودورو
        </h2>
        <button onClick={() => { setShowSettings(s => !s); setTempWork(workMin); setTempShort(shortMin); setTempLong(longMin); }}
          style={{ background: "var(--app-bg)", border: "1px solid var(--app-border)", borderRadius: "8px", padding: "0.3rem 0.7rem", fontSize: "0.8rem", cursor: "pointer", color: "var(--app-muted)", display: "flex", alignItems: "center", gap: "4px", fontFamily: "inherit" }}>
          <Settings size={14} /> إعدادات
        </button>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div style={{ width: "100%", background: "var(--app-bg)", border: "1.5px solid var(--app-border)", borderRadius: "12px", padding: "1rem", marginBottom: "1rem" }}>
          {[
            { label: "وقت التركيز (دقيقة)", val: tempWork, set: setTempWork },
            { label: "استراحة قصيرة (دقيقة)", val: tempShort, set: setTempShort },
            { label: "استراحة طويلة (دقيقة)", val: tempLong, set: setTempLong },
          ].map(({ label, val, set }) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
              <span style={{ fontSize: "0.85rem", color: "var(--app-muted)" }}>{label}</span>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <button onClick={() => set(v => Math.max(1, v - 1))} style={{ width: "24px", height: "24px", borderRadius: "6px", border: "1px solid var(--app-border)", background: "var(--app-card)", cursor: "pointer", fontWeight: 700, color: "var(--app-muted)" }}>−</button>
                <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--app-text)", minWidth: "24px", textAlign: "center" }}>{val}</span>
                <button onClick={() => set(v => Math.min(99, v + 1))} style={{ width: "24px", height: "24px", borderRadius: "6px", border: "1px solid var(--app-border)", background: "var(--app-card)", cursor: "pointer", fontWeight: 700, color: "var(--app-muted)" }}>+</button>
              </div>
            </div>
          ))}
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.3rem" }}>
              <button onClick={onToggleMute}
                style={{
                  flex: 1, background: muted ? "var(--app-bg)" : "linear-gradient(135deg, var(--app-primary-light), var(--app-primary))",
                  color: muted ? "var(--app-muted)" : "#fff",
                  border: muted ? "1.5px solid var(--app-border)" : "none",
                  borderRadius: "8px", padding: "0.5rem",
                  fontSize: "0.85rem", cursor: "pointer", fontWeight: 700, fontFamily: "inherit",
                }}>
                {muted ? "🔇 صوت مكتوم" : "🔔 صوت نشط"}
              </button>
              <button onClick={() => { onSaveSettings(tempWork, tempShort, tempLong); setShowSettings(false); }}
                style={{
                  flex: 1, background: "linear-gradient(135deg, var(--app-primary-light), var(--app-primary))",
                  color: "#fff", border: "none", borderRadius: "8px", padding: "0.5rem",
                  fontSize: "0.85rem", cursor: "pointer", fontWeight: 700, fontFamily: "inherit",
                }}>حفظ</button>
            </div>
        </div>
      )}

      {/* Active task / Drop zone */}
      <div style={{
        background: activeTask ? "var(--app-primary-bg)" : pomoDragOver ? "var(--app-primary-bg-light)" : "var(--app-bg)",
        border: `1.5px solid ${activeTask ? "var(--app-primary)" : pomoDragOver ? "var(--app-primary-light)" : "var(--app-border)"}`,
        borderRadius: "10px", padding: "0.5rem 1rem",
        fontSize: "0.85rem", color: activeTask ? "var(--app-text)" : "var(--app-muted-light)",
        fontWeight: 600, marginBottom: "1rem", textAlign: "center", width: "100%", boxSizing: "border-box",
        display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
      }}>
        {activeTask ? (
          <><GripVertical size={14} /> {activeTask.text}</>
        ) : pomoDragOver ? (
          "أفلتي هنا لتحديد المهمة ✋"
        ) : (
          "اسحبي مهمة وضعيها هنا"
        )}
      </div>

      {/* Mode tabs */}
      <div style={{ display: "flex", gap: "0.4rem", marginBottom: "1rem" }}>
        {([["work", "تركيز"], ["short", "قصيرة"], ["long", "طويلة"]] as [Mode, string][]).map(([key, label]) => (
          <button key={key} onClick={() => onSetMode(key)}
            style={{
              background: mode === key ? meta.color : "var(--app-bg)",
              color: mode === key ? "#fff" : "var(--app-muted)",
              border: "none", borderRadius: "8px", padding: "0.35rem 0.8rem",
              fontSize: "0.8rem", cursor: "pointer", fontWeight: 600,
              display: "flex", alignItems: "center", gap: "4px",
              transition: "all 0.15s", fontFamily: "inherit",
            }}>
            {MODE_META[key].icon} {label}
          </button>
        ))}
      </div>

      {/* SVG Progress Ring + Timer */}
      <div style={{ position: "relative", width: "220px", height: "220px", marginBottom: "0.3rem" }}>
        <svg width="220" height="220" viewBox="0 0 220 220" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="110" cy="110" r="90" fill="none" stroke="var(--app-border)" strokeWidth="8" />
          <circle
            ref={ringRef}
            cx="110" cy="110" r="90" fill="none"
            stroke={meta.color} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress)}
            style={{ transition: "stroke-dashoffset 0.5s ease" }}
          />
        </svg>
        <div style={{
          position: "absolute", inset: 0, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
        }}>
          <div style={{ fontSize: "3.2rem", fontWeight: 800, color: meta.color, letterSpacing: "4px", lineHeight: 1, fontFamily: "monospace" }}>
            {mins}:{secs}
          </div>
          <div style={{ marginTop: "4px", fontSize: "0.82rem", color: "var(--app-muted)", fontWeight: 600 }}>
            {meta.label} • جلسة {pomodoroCount + 1}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
        <button onClick={() => onSetRunning(!running)}
          style={{
            background: running ? "linear-gradient(135deg, var(--app-red), #dc2626)" : "linear-gradient(135deg, var(--app-primary-light), var(--app-primary))",
            color: "#fff", border: "none", borderRadius: "12px",
            padding: "0.7rem 1.8rem", fontSize: "1rem", cursor: "pointer",
            fontWeight: 700, boxShadow: running ? "0 4px 15px rgba(239,68,68,0.3)" : "0 4px 15px rgba(40,120,200,0.3)",
            display: "flex", alignItems: "center", gap: "6px",
            transition: "all 0.15s", fontFamily: "inherit",
          }}>
          {running ? <Pause size={18} /> : <Play size={18} />}
          {running ? "إيقاف" : "ابدأ"}
        </button>
        <button onClick={onReset}
          style={{
            background: "var(--app-bg)", color: "var(--app-muted)",
            border: "1.5px solid var(--app-border)", borderRadius: "12px",
            padding: "0.7rem 1rem", fontSize: "1rem", cursor: "pointer",
            fontWeight: 700, display: "flex", alignItems: "center", gap: "4px",
            fontFamily: "inherit",
          }}>
          <RotateCcw size={18} /> إعادة
        </button>
      </div>

      {/* Progress dots */}
      <div style={{ display: "flex", gap: "0.4rem", marginTop: "1.2rem" }}>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} style={{
            width: "12px", height: "12px", borderRadius: "50%",
            background: i < pomodoroCount % 4 ? meta.color : "var(--app-border)",
            transition: "background 0.3s",
          }} />
        ))}
      </div>
    </div>
  );
}
