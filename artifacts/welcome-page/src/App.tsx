import { Switch, Route, Link } from "wouter";
import UploadPage from "./pages/upload";
import FileHubPage from "./pages/file-hub";
import { useState, useEffect, useRef, createContext, useContext, useCallback } from "react";
import ProjectsPage from "./pages/projects";
import FileSidebar from "./components/FileSidebar";
import PomodoroTimer from "./components/PomodoroTimer";
import TaskList from "./components/TaskList";
import FocusChart from "./components/FocusChart";
import { Clock, FolderOpen, FileText, Brain, Layers, Sparkles, Moon, Sun } from "lucide-react";
import { motion } from "framer-motion";

export type Task = { id: string; text: string; done: boolean };
export type DayFocus = { date: string; minutes: number };

type ThemeCtx = { dark: boolean; toggleDark: () => void };
type AppState = {
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  activeTaskId: string | null;
  setActiveTaskId: React.Dispatch<React.SetStateAction<string | null>>;
  workMin: number; setWorkMin: React.Dispatch<React.SetStateAction<number>>;
  shortMin: number; setShortMin: React.Dispatch<React.SetStateAction<number>>;
  longMin: number; setLongMin: React.Dispatch<React.SetStateAction<number>>;
  mode: "work" | "short" | "long";
  setMode: React.Dispatch<React.SetStateAction<"work" | "short" | "long">>;
  seconds: number; setSeconds: React.Dispatch<React.SetStateAction<number>>;
  running: boolean; setRunning: React.Dispatch<React.SetStateAction<boolean>>;
  pomodoroCount: number; setPomodoroCount: React.Dispatch<React.SetStateAction<number>>;
  focusHistory: DayFocus[];
  todayFocusMin: number;
  addFocusMinutes: (mins: number) => void;
  intervalRef: React.MutableRefObject<ReturnType<typeof setInterval> | null>;
  focusSecondsRef: React.MutableRefObject<number>;
  sidebarOpen: boolean;
  setSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  dark: boolean;
  toggleDark: () => void;
  endTimeRef: React.MutableRefObject<number>;
  muted: boolean;
  setMuted: React.Dispatch<React.SetStateAction<boolean>>;
  playBell: () => void;
};

const AppCtx = createContext<AppState | null>(null);
export const useApp = () => useContext(AppCtx)!;

function getTodayKey() { return new Date().toISOString().slice(0, 10); }

function getHijriDate() {
  try { return new Date().toLocaleDateString("ar-SA-u-ca-islamic", { day: "numeric", month: "long", year: "numeric" }); }
  catch { return ""; }
}

function getArabicDate() {
  return new Date().toLocaleDateString("ar-EG", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

function getMotivation(todayMin: number, yesterdayMin: number): string {
  if (todayMin === 0) return "ابدأ أول جلسة تركيز اليوم — كل إنجاز يبدأ بخطوة! 💪";
  if (yesterdayMin === 0) return `رائع! أنجزتِ ${todayMin} دقيقة تركيز اليوم ✨`;
  const diff = todayMin - yesterdayMin;
  if (diff > 0) return `أحسنتِ! زدتِ تركيزك بـ ${diff} دقيقة عن أمس 🌟`;
  if (diff === 0) return `نفس مستوى أمس — حاولي تزيدي دقائق اليوم! 🎯`;
  return `أمس كان أفضل بـ ${Math.abs(diff)} دقيقة — لا بأس، اليوم فرصة جديدة! 🌱`;
}

// ── Header ──────────────────
function GlobalHeader() {
  const { todayFocusMin, seconds, running, mode, setSidebarOpen, dark, toggleDark } = useApp();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const mins = String(Math.floor(seconds / 60)).padStart(2, "0");
  const secs = String(seconds % 60).padStart(2, "0");
  const modeColor = mode === "work" ? "var(--app-work)" : mode === "short" ? "var(--app-short)" : "var(--app-long)";
  const timeStr = now.toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" });

  return (
    <div style={{
      position: "sticky", top: 0, zIndex: 100,
      background: "var(--app-card)", backdropFilter: "blur(10px)",
      borderBottom: "1.5px solid var(--app-border)", padding: "0.6rem 1.5rem",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      gap: "0.5rem",
    }}>
      <button onClick={() => setSidebarOpen(o => !o)}
        style={{
          background: "var(--app-accent-bg)", border: "1.5px solid var(--app-accent-light)",
          borderRadius: "10px", padding: "0.4rem 0.8rem",
          cursor: "pointer", fontSize: "0.9rem", fontWeight: 700,
          color: "var(--app-accent)", fontFamily: "inherit",
          display: "flex", alignItems: "center", gap: "5px",
          transition: "all 0.15s", whiteSpace: "nowrap",
        }}>
        <FolderOpen size={16} /> ملفاتي
      </button>
      <button onClick={toggleDark}
        style={{
          background: "none", border: "1.5px solid var(--app-border)",
          borderRadius: "10px", padding: "0.4rem 0.7rem",
          cursor: "pointer", fontSize: "0.9rem",
          color: "var(--app-muted)", fontFamily: "inherit",
          display: "flex", alignItems: "center",
          transition: "all 0.15s",
        }}>
        {dark ? <Sun size={16} /> : <Moon size={16} />}
      </button>

      <div style={{ textAlign: "center", flex: 1 }}>
        <div style={{ fontSize: "clamp(1.5rem, 2.8vw, 2.2rem)", fontWeight: 800, color: "var(--app-text)", letterSpacing: "2px", fontFamily: "monospace" }}>{timeStr}</div>
        <div style={{ fontSize: "clamp(0.8rem, 1.3vw, 1rem)", color: "var(--app-muted)", fontWeight: 600 }}>{getArabicDate()}</div>
        <div style={{ fontSize: "clamp(0.72rem, 1vw, 0.85rem)", color: "var(--app-muted-light)" }}>{getHijriDate()}</div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "clamp(0.75rem, 1.5vw, 1.5rem)" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "clamp(0.78rem, 1.1vw, 0.9rem)", color: "var(--app-muted)", fontWeight: 700, marginBottom: "2px", display: "flex", alignItems: "center", gap: "4px" }}>
            <Clock size={14} /> {running ? "جاري التركيز" : "البومودورو"}
          </div>
          <div style={{ fontSize: "clamp(1.3rem, 2.2vw, 1.8rem)", fontWeight: 800, color: running ? modeColor : "var(--app-muted-light)", fontFamily: "monospace", letterSpacing: "2px" }}>
            {mins}:{secs}
          </div>
        </div>
        <div style={{ textAlign: "left" }}>
          <div style={{ fontSize: "clamp(0.78rem, 1.1vw, 0.9rem)", color: "var(--app-muted)", fontWeight: 700 }}>تركيز اليوم</div>
          <div style={{ fontSize: "clamp(1.2rem, 2vw, 1.6rem)", fontWeight: 800, color: "var(--app-primary)" }}>{todayFocusMin} د</div>
        </div>
      </div>
    </div>
  );
}

// ── Home ───────────────────────
function HomePage() {
  const {
    tasks, setTasks, activeTaskId, setActiveTaskId,
    workMin, setWorkMin, shortMin, setShortMin, longMin, setLongMin,
    mode, setMode, seconds, setSeconds, running, setRunning,
    pomodoroCount, setPomodoroCount, focusHistory, todayFocusMin,
    addFocusMinutes, intervalRef, focusSecondsRef, endTimeRef,
    muted, setMuted, playBell,
  } = useApp();

  const [pomoDragOver, setPomoDragOver] = useState(false);
  const draggedTaskId = useRef<string | null>(null);
  const lastFocusAddRef = useRef<number>(0);

  useEffect(() => {
    if (running) {
      const totalSecs = mode === "work" ? workMin : mode === "short" ? shortMin : longMin;
      endTimeRef.current = Date.now() + totalSecs * 60 * 1000;
      if (mode === "work") lastFocusAddRef.current = Date.now();
      intervalRef.current = setInterval(() => {
        if (mode === "work") {
          const now = Date.now();
          if (now - lastFocusAddRef.current >= 60000) {
            addFocusMinutes(1);
            lastFocusAddRef.current = now;
          }
        }
        const remaining = Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000));
        setSeconds(remaining);
        if (remaining <= 0) {
          clearInterval(intervalRef.current!);
          setRunning(false);
          endTimeRef.current = 0;
          playBell();
          if (mode === "work") {
            const next = pomodoroCount + 1;
            setPomodoroCount(next);
            setMode(next % 4 === 0 ? "long" : "short");
            setSeconds((next % 4 === 0 ? longMin : shortMin) * 60);
          } else {
            setMode("work");
            setSeconds(workMin * 60);
          }
        }
      }, 200);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, mode, pomodoroCount, workMin, shortMin, longMin]);

  const setTimerMode = (m: "work" | "short" | "long") => {
    setRunning(false); setMode(m); endTimeRef.current = 0;
    setSeconds((m === "work" ? workMin : m === "short" ? shortMin : longMin) * 60);
  };

  const saveSettings = (w: number, s: number, l: number) => {
    setWorkMin(w); setShortMin(s); setLongMin(l);
    setRunning(false); setMode("work"); setSeconds(w * 60); endTimeRef.current = 0;
  };

  const handlePomoDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setPomoDragOver(false);
    if (draggedTaskId.current) {
      setActiveTaskId(draggedTaskId.current);
      draggedTaskId.current = null;
    }
  };

  const activeTask = tasks.find(t => t.id === activeTaskId);

  const todayKey = getTodayKey();
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().slice(0, 10);
    const found = focusHistory.find(f => f.date === key);
    return { key, minutes: found?.minutes ?? 0, label: d.toLocaleDateString("ar", { weekday: "short" }), isToday: key === todayKey };
  });
  const yesterdayKey = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); })();
  const yesterdayMin = focusHistory.find(d => d.date === yesterdayKey)?.minutes ?? 0;
  const motivation = getMotivation(todayFocusMin, yesterdayMin);

  return (
    <div dir="rtl" style={{
      minHeight: "100vh",
      background: "var(--app-bg-page)",
      fontFamily: "'Segoe UI', Tahoma, sans-serif",
      display: "flex", flexDirection: "column",
    }}>
      <div style={{
        background: "var(--app-card)", borderBottom: "1px solid var(--app-border)",
        padding: "0.6rem 1.5rem", textAlign: "center",
        fontSize: "clamp(0.85rem, 1.2vw, 1rem)", color: "var(--app-muted)", fontWeight: 600,
      }}>{motivation}</div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} style={{ flex: 1, maxWidth: "1400px", margin: "0 auto", padding: "clamp(1rem, 2vw, 2rem) clamp(0.75rem, 3vw, 2rem)", display: "flex", flexDirection: "column", gap: "clamp(1rem, 2vw, 2rem)", width: "100%", boxSizing: "border-box" }}>

        {/* Welcome */}
        <div style={{ background: "var(--app-card)", border: "1.5px solid var(--app-border)", borderRadius: "20px", padding: "2rem 3rem", textAlign: "center", boxShadow: "var(--app-shadow)" }}>
          <p style={{ fontSize: "clamp(1.1rem, 1.6vw, 1.4rem)", fontWeight: 700, color: "var(--app-text)", lineHeight: 2, margin: "0 auto", maxWidth: "65ch" }}>
            يا طالبَ العلم، النسخةُ التي تحلم أن تصبحها أعينك على بنائها هنا، فاستبشر خيرًا وأقبِل.
          </p>
        </div>

        {/* Chart */}
        <FocusChart data={last7} />

        {/* Tasks + Pomodoro */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
          <TaskList
            tasks={tasks}
            activeTaskId={activeTaskId}
            onSetTasks={setTasks}
            onSetActiveTaskId={setActiveTaskId}
            onDragTaskStart={(idx) => { draggedTaskId.current = tasks[idx]?.id ?? null; }}
            onDragTaskEnd={() => { draggedTaskId.current = null; }}
          />
          <PomodoroTimer
            workMin={workMin} shortMin={shortMin} longMin={longMin}
            mode={mode} seconds={seconds} running={running}
            pomodoroCount={pomodoroCount}
            activeTask={activeTask ?? null}
            pomoDragOver={pomoDragOver}
            muted={muted} onToggleMute={() => setMuted(m => !m)}
            onSetMode={setTimerMode}
            onSetRunning={setRunning}
            onReset={() => { setRunning(false); setSeconds((mode === "work" ? workMin : mode === "short" ? shortMin : longMin) * 60); endTimeRef.current = 0; }}
            onSaveSettings={saveSettings}
            onDrop={handlePomoDrop}
            onDragOver={(e) => { e.preventDefault(); setPomoDragOver(true); }}
            onDragLeave={() => setPomoDragOver(false)}
          />
        </div>

        {/* Feature cards */}
        <div style={{ background: "var(--app-card)", border: "1.5px solid var(--app-border)", borderRadius: "20px", padding: "2rem 3rem", boxShadow: "var(--app-shadow)", marginBottom: "2rem" }}>
          <p style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--app-text)", margin: "0 0 1.2rem", textAlign: "center" }}>بشو حاب تبلش؟</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
            <Link to="/upload" style={{ display: "block", background: "linear-gradient(135deg, var(--app-primary-light), var(--app-primary))", color: "#fff", borderRadius: "14px", padding: "0.9rem 1.5rem", fontSize: "1.05rem", fontWeight: 700, textDecoration: "none", textAlign: "center", boxShadow: "0 6px 20px var(--app-primary)", transition: "opacity 0.2s" }}
              onMouseEnter={e => (e.currentTarget.style.opacity = "0.88")}
              onMouseLeave={e => (e.currentTarget.style.opacity = "1")}>
              <FileText size={20} style={{ verticalAlign: "middle" }} /> شرح ملف
            </Link>
            {[{ icon: Brain, label: "توليد أسئلة (Quiz)" }, { icon: Layers, label: "بطاقات مراجعة (Flashcards)" }, { icon: Sparkles, label: "ملخص ذكي" }].map(({ icon: Icon, label }) => (
              <div key={label} style={{ background: "var(--app-bg)", border: "1.5px solid var(--app-border)", borderRadius: "14px", padding: "0.9rem 1.5rem", fontSize: "1.05rem", fontWeight: 600, color: "var(--app-muted-light)", textAlign: "center", cursor: "default", userSelect: "none" }}>
                <Icon size={20} style={{ verticalAlign: "middle" }} /> {label}
                <span style={{ fontSize: "0.75rem", marginRight: "0.5rem", background: "var(--app-accent-bg)", color: "var(--app-muted)", padding: "0.15rem 0.5rem", borderRadius: "6px", fontWeight: 700 }}>قريبًا</span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ── App ─────────────────────────
function App() {
  const [tasks, setTasks] = useState<Task[]>(() => {
    try { return JSON.parse(localStorage.getItem("tasks") ?? "[]") as Task[]; }
    catch { return []; }
  });
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [workMin, setWorkMin] = useState(() => Number(localStorage.getItem("workMin") ?? 25));
  const [shortMin, setShortMin] = useState(() => Number(localStorage.getItem("shortMin") ?? 5));
  const [longMin, setLongMin] = useState(() => Number(localStorage.getItem("longMin") ?? 15));
  const [mode, setMode] = useState<"work" | "short" | "long">(() => {
    try { return (JSON.parse(localStorage.getItem("pomo") ?? "{}") as { mode?: "work" | "short" | "long" }).mode ?? "work"; } catch { return "work"; }
  });
  const [seconds, setSeconds] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("pomo") ?? "{}") as { startedAt?: number; running?: boolean };
      if (saved.running && saved.startedAt) {
        const totalMs = Number(localStorage.getItem("workMin") ?? 25) * 60 * 1000;
        const elapsed = Date.now() - saved.startedAt;
        const remaining = Math.max(0, Math.ceil((totalMs - elapsed) / 1000));
        return remaining;
      }
    } catch {}
    return Number(localStorage.getItem("workMin") ?? 25) * 60;
  });
  const [running, setRunning] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("pomo") ?? "{}") as { startedAt?: number; running?: boolean };
      if (saved.running && saved.startedAt) {
        const totalMs = Number(localStorage.getItem("workMin") ?? 25) * 60 * 1000;
        return Date.now() - saved.startedAt < totalMs;
      }
      return false;
    } catch { return false; }
  });
  const [startedAt, setStartedAt] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("pomo") ?? "{}") as { startedAt?: number };
      return saved.startedAt ?? 0;
    } catch { return 0; }
  });
  const [pomodoroCount, setPomodoroCount] = useState(() => {
    try { return (JSON.parse(localStorage.getItem("pomo") ?? "{}") as { pomodoroCount?: number }).pomodoroCount ?? 0; } catch { return 0; }
  });
  const [muted, setMuted] = useState(() => localStorage.getItem("pomoMuted") === "true");
  const playBell = useCallback(() => {
    if (muted) return;
    try {
      const ctx = new AudioContext();
      const g = ctx.createGain();
      g.connect(ctx.destination);
      const o1 = ctx.createOscillator();
      o1.type = "sine";
      o1.frequency.value = 880;
      o1.connect(g);
      g.gain.setValueAtTime(0.35, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
      o1.start(ctx.currentTime);
      o1.stop(ctx.currentTime + 0.8);
      const g2 = ctx.createGain();
      g2.connect(ctx.destination);
      const o2 = ctx.createOscillator();
      o2.type = "sine";
      o2.frequency.value = 1318.5;
      o2.connect(g2);
      g2.gain.setValueAtTime(0.25, ctx.currentTime + 0.15);
      g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.9);
      o2.start(ctx.currentTime + 0.15);
      o2.stop(ctx.currentTime + 0.9);
    } catch {}
  }, [muted]);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const endTimeRef = useRef(0);
  useEffect(() => {
    try { const saved = JSON.parse(localStorage.getItem("pomo") ?? "{}") as { endTime?: number }; if (saved.endTime) endTimeRef.current = saved.endTime; } catch {}
  }, []);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const focusSecondsRef = useRef(0);

  const [focusHistory, setFocusHistory] = useState<DayFocus[]>(() => {
    try { return JSON.parse(localStorage.getItem("focusHistory") ?? "[]") as DayFocus[]; }
    catch { return []; }
  });
  const [todayFocusMin, setTodayFocusMin] = useState(() => {
    try {
      const h = JSON.parse(localStorage.getItem("focusHistory") ?? "[]") as DayFocus[];
      return h.find(d => d.date === getTodayKey())?.minutes ?? 0;
    } catch { return 0; }
  });

  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem("dark");
    if (saved !== null) return saved === "true";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });
  const toggleDark = useCallback(() => setDark(prev => !prev), []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("dark", String(dark));
  }, [dark]);

  useEffect(() => { localStorage.setItem("pomoMuted", String(muted)); }, [muted]);

  useEffect(() => { localStorage.setItem("tasks", JSON.stringify(tasks)); }, [tasks]);
  useEffect(() => { localStorage.setItem("workMin", String(workMin)); }, [workMin]);
  useEffect(() => { localStorage.setItem("shortMin", String(shortMin)); }, [shortMin]);
  useEffect(() => { localStorage.setItem("longMin", String(longMin)); }, [longMin]);
  useEffect(() => { localStorage.setItem("focusHistory", JSON.stringify(focusHistory)); }, [focusHistory]);
  useEffect(() => { localStorage.setItem("pomo", JSON.stringify({ mode, endTime: endTimeRef.current, running, pomodoroCount })); }, [mode, running, pomodoroCount, endTimeRef]);

  const addFocusMinutes = (mins: number) => {
    const today = getTodayKey();
    setFocusHistory(prev => {
      const existing = prev.find(d => d.date === today);
      const updated = existing
        ? prev.map(d => d.date === today ? { ...d, minutes: d.minutes + mins } : d)
        : [...prev, { date: today, minutes: mins }];
      return updated.slice(-30);
    });
    setTodayFocusMin(m => m + mins);
  };

  return (
    <AppCtx.Provider value={{
      tasks, setTasks, activeTaskId, setActiveTaskId,
      workMin, setWorkMin, shortMin, setShortMin, longMin, setLongMin,
      mode, setMode, seconds, setSeconds, running, setRunning,
      pomodoroCount, setPomodoroCount, focusHistory, todayFocusMin,
      addFocusMinutes, intervalRef, focusSecondsRef, sidebarOpen, setSidebarOpen,
      dark, toggleDark, endTimeRef, muted, setMuted, playBell,
    }}>
      <GlobalHeader />
      <Switch>
        <Route path="/upload/:sessionId?" component={UploadPage} />
        <Route path="/files/:fileId" component={FileHubPage} />
        <Route path="/" component={HomePage} />
        <Route path="/projects" component={ProjectsPage} />
      </Switch>
      <FileSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </AppCtx.Provider>
  );
}

export default App;
