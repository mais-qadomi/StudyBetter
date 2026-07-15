import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Play, X, Plus, ArrowRight, Target, Coffee, Leaf, BarChart3, ClipboardList, Sparkles, Settings, Pin, GripVertical, Clock } from "lucide-react";

type Task = { id: string; text: string; done: boolean; };
type DayFocus = { date: string; minutes: number; };

function getTodayKey() {
    return new Date().toISOString().slice(0, 10);
}

function getHijriDate() {
    try {
        return new Date().toLocaleDateString("ar-SA-u-ca-islamic", {
            day: "numeric", month: "long", year: "numeric",
        });
    } catch { return ""; }
}

function getArabicDate() {
    return new Date().toLocaleDateString("ar-EG", {
        weekday: "long", year: "numeric", month: "long", day: "numeric",
    });
}

function getMotivaion(todayMin: number, yesterdayMin: number): string {
    if (todayMin === 0) return "ابدأ أول جلسة تركيز اليوم — كل إنجاز يبدأ بخطوة! 💪";
    if (yesterdayMin === 0) return `رائع! أنجزتِ ${todayMin} دقيقة تركيز اليوم ✨`;
    const diff = todayMin - yesterdayMin;
    if (diff > 0) return `أحسنتِ! زدتِ تركيزك بـ ${diff} دقيقة عن أمس 🌟`;
    if (diff === 0) return `نفس مستوى أمس — حاولي تزيدي دقائق اليوم! 🎯`;
    return `أمس كان أفضل بـ ${Math.abs(diff)} دقيقة — لا بأس، اليوم فرصة جديدة! 🌱`;
}

export default function TasksPage() {
    const [, navigate] = useLocation();

    const [tasks, setTasks] = useState<Task[]>(() => {
        try { return JSON.parse(localStorage.getItem("tasks") ?? "[]") as Task[]; }
        catch { return []; }
    });
    const [newTask, setNewTask] = useState("");
    const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
    const [dragIdx, setDragIdx] = useState<number | null>(null);

    const [workMin, setWorkMin] = useState(() => Number(localStorage.getItem("workMin") ?? 25));
    const [shortMin, setShortMin] = useState(() => Number(localStorage.getItem("shortMin") ?? 5));
    const [longMin, setLongMin] = useState(() => Number(localStorage.getItem("longMin") ?? 15));
    const [showSettings, setShowSettings] = useState(false);
    const [tempWork, setTempWork] = useState(workMin);
    const [tempShort, setTempShort] = useState(shortMin);
    const [tempLong, setTempLong] = useState(longMin);

    const [mode, setMode] = useState<"work" | "short" | "long">("work");
    const [seconds, setSeconds] = useState(workMin * 60);
    const [running, setRunning] = useState(false);
    const [pomodoroCount, setPomodoroCount] = useState(0);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const [focusHistory, setFocusHistory] = useState<DayFocus[]>(() => {
        try { return JSON.parse(localStorage.getItem("focusHistory") ?? "[]") as DayFocus[]; }
        catch { return []; }
    });
    const focusSecondsRef = useRef(0);
    const [todayFocusMin, setTodayFocusMin] = useState(() => {
        try {
            const h = JSON.parse(localStorage.getItem("focusHistory") ?? "[]") as DayFocus[];
            return h.find(d => d.date === getTodayKey())?.minutes ?? 0;
        } catch { return 0; }
    });

    const [now, setNow] = useState(new Date());
    useEffect(() => {
        const t = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(t);
    }, []);

    useEffect(() => { localStorage.setItem("tasks", JSON.stringify(tasks)); }, [tasks]);
    useEffect(() => { localStorage.setItem("workMin", String(workMin)); }, [workMin]);
    useEffect(() => { localStorage.setItem("shortMin", String(shortMin)); }, [shortMin]);
    useEffect(() => { localStorage.setItem("longMin", String(longMin)); }, [longMin]);
    useEffect(() => { localStorage.setItem("focusHistory", JSON.stringify(focusHistory)); }, [focusHistory]);

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

    useEffect(() => {
        if (running && mode === "work") {
            intervalRef.current = setInterval(() => {
                focusSecondsRef.current += 1;
                if (focusSecondsRef.current % 60 === 0) {
                    addFocusMinutes(1);
                }
                setSeconds(s => {
                    if (s <= 1) {
                        clearInterval(intervalRef.current!);
                        setRunning(false);
                        const next = pomodoroCount + 1;
                        setPomodoroCount(next);
                        setMode(next % 4 === 0 ? "long" : "short");
                        setSeconds((next % 4 === 0 ? longMin : shortMin) * 60);
                        return 0;
                    }
                    return s - 1;
                });
            }, 1000);
        } else if (running && mode !== "work") {
            intervalRef.current = setInterval(() => {
                setSeconds(s => {
                    if (s <= 1) {
                        clearInterval(intervalRef.current!);
                        setRunning(false);
                        setMode("work");
                        setSeconds(workMin * 60);
                        return 0;
                    }
                    return s - 1;
                });
            }, 1000);
        } else {
            if (intervalRef.current) clearInterval(intervalRef.current);
        }
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [running, mode, pomodoroCount, workMin, shortMin, longMin]);

    const setTimerMode = (m: "work" | "short" | "long") => {
        setRunning(false);
        setMode(m);
        setSeconds((m === "work" ? workMin : m === "short" ? shortMin : longMin) * 60);
    };

    const saveSettings = () => {
        setWorkMin(tempWork); setShortMin(tempShort); setLongMin(tempLong);
        setRunning(false); setMode("work"); setSeconds(tempWork * 60);
        setShowSettings(false);
    };

    const addTask = () => {
        if (!newTask.trim()) return;
        setTasks(prev => [...prev, { id: crypto.randomUUID(), text: newTask.trim(), done: false }]);
        setNewTask("");
    };
    const toggleTask = (id: string) => setTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
    const deleteTask = (id: string) => { setTasks(prev => prev.filter(t => t.id !== id)); if (activeTaskId === id) setActiveTaskId(null); };

    const activeTask = tasks.find(t => t.id === activeTaskId);
    const mins = String(Math.floor(seconds / 60)).padStart(2, "0");
    const secs = String(seconds % 60).padStart(2, "0");
    const modeColor = mode === "work" ? "var(--app-work)" : mode === "short" ? "var(--app-short)" : "var(--app-long)";
    const modeLabel = mode === "work" ? <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>وقت التركيز <Target size={14} /></span> : mode === "short" ? <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>استراحة قصيرة <Coffee size={14} /></span> : <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>استراحة طويلة <Leaf size={14} /></span>;

    const handleDragStart = (idx: number) => setDragIdx(idx);
    const handleDragOver = (e: React.DragEvent, idx: number) => {
        e.preventDefault();
        if (dragIdx === null || dragIdx === idx) return;
        setTasks(prev => { const arr = [...prev]; const [m] = arr.splice(dragIdx, 1); arr.splice(idx, 0, m); return arr; });
        setDragIdx(idx);
    };

    const todayKey = getTodayKey();
    const last7 = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(); d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        const found = focusHistory.find(f => f.date === key);
        return { key, minutes: found?.minutes ?? 0, label: d.toLocaleDateString("ar", { weekday: "short" }) };
    });
    const yesterdayKey = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); })();
    const yesterdayMin = focusHistory.find(d => d.date === yesterdayKey)?.minutes ?? 0;
    const maxMin = Math.max(...last7.map(d => d.minutes), 1);
    const motivation = getMotivaion(todayFocusMin, yesterdayMin);

    const timeStr = now.toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" });

    return (
        <div dir="rtl" style={{
            minHeight: "100vh",
            background: "var(--app-bg-page)",
            fontFamily: "'Segoe UI', Tahoma, sans-serif",
            boxSizing: "border-box",
        }}>
            {/* Sticky Header */}
            <div style={{
                position: "sticky", top: 0, zIndex: 100,
                background: "var(--app-card)", backdropFilter: "blur(10px)",
                borderBottom: "1.5px solid var(--app-border)",
                padding: "0.6rem 1.5rem",
                display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
                <button onClick={() => navigate("/")} style={{
                    background: "var(--app-accent-bg)", border: "1px solid var(--app-accent-light)", color: "var(--app-accent)",
                    borderRadius: "10px", padding: "0.4rem 1rem", fontSize: "0.85rem",
                    cursor: "pointer", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "6px",
                }}><ArrowRight size={18} /> الرئيسية</button>

                <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--app-text)", letterSpacing: "2px", fontFamily: "monospace" }}>
                        {timeStr}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--app-muted)", fontWeight: 600 }}>{getArabicDate()}</div>
                    <div style={{ fontSize: "0.7rem", color: "var(--app-muted-light)" }}>{getHijriDate()}</div>
                </div>

                <div style={{ textAlign: "left" }}>
                    <div style={{ fontSize: "0.8rem", color: "var(--app-muted)", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "6px" }}>
                        <Clock size={14} /> تركيز اليوم
                    </div>
                    <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--app-primary)" }}>
                        {todayFocusMin} دقيقة
                    </div>
                </div>
            </div>

            {/* Motivation Bar */}
            <div style={{
                background: "var(--app-card)", borderBottom: "1px solid var(--app-border)",
                padding: "0.5rem 1.5rem", textAlign: "center",
                fontSize: "0.85rem", color: "var(--app-muted)", fontWeight: 600,
            }}>
                {motivation}
            </div>

            <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "1.5rem 1rem" }}>

                {/* Focus Chart */}
                <div style={{
                    background: "var(--app-card)", borderRadius: "20px", padding: "1.2rem 1.5rem",
                    boxShadow: "var(--app-shadow)", border: "1.5px solid var(--app-border)",
                    marginBottom: "1.5rem",
                }}>
                    <p style={{ margin: "0 0 0.8rem", fontSize: "0.9rem", fontWeight: 700, color: "var(--app-text)" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}><BarChart3 size={16} /> تركيزك</span> خلال آخر 7 أيام
                    </p>
                    <div style={{ display: "flex", alignItems: "flex-end", gap: "0.5rem", height: "80px" }}>
                        {last7.map(d => (
                            <div key={d.key} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                                <div style={{ fontSize: "0.65rem", color: "var(--app-muted)" }}>{d.minutes > 0 ? d.minutes : ""}</div>
                                <div style={{
                                    width: "100%", borderRadius: "6px 6px 0 0",
                                    height: `${Math.max((d.minutes / maxMin) * 60, d.minutes > 0 ? 4 : 2)}px`,
                                    background: d.key === todayKey
                                        ? "linear-gradient(180deg, var(--app-primary-light), var(--app-primary))"
                                        : "linear-gradient(180deg, var(--app-border), var(--app-muted-light))",
                                    transition: "height 0.3s",
                                }} />
                                <div style={{ fontSize: "0.65rem", color: d.key === todayKey ? "var(--app-primary)" : "var(--app-muted)", fontWeight: d.key === todayKey ? 700 : 400 }}>
                                    {d.label}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>

                    {/* To Do List */}
                    <div style={{ background: "var(--app-card)", borderRadius: "20px", padding: "1.5rem", boxShadow: "var(--app-shadow)", border: "1.5px solid var(--app-border)" }}>
                        <h2 style={{ margin: "0 0 1rem", fontSize: "1.1rem", fontWeight: 700, color: "var(--app-text)", display: "inline-flex", alignItems: "center", gap: "6px" }}><ClipboardList size={16} /> قائمة المهام</h2>
                        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
                            <input
                                value={newTask}
                                onChange={e => setNewTask(e.target.value)}
                                onKeyDown={e => e.key === "Enter" && addTask()}
                                placeholder="أضف مهمة جديدة..."
                                style={{
                                    flex: 1, padding: "0.6rem 0.9rem", borderRadius: "10px",
                                    border: "1.5px solid var(--app-border)", fontSize: "0.9rem",
                                    fontFamily: "inherit", outline: "none", direction: "rtl",
                                    color: "var(--app-text)", background: "var(--app-card)",
                                }}
                            />
                            <button onClick={addTask} style={{
                                background: "linear-gradient(135deg, var(--app-primary-light), var(--app-primary))",
                                color: "#fff", border: "none", borderRadius: "10px",
                                padding: "0.6rem 1rem", fontSize: "1rem", cursor: "pointer", fontWeight: 700,
                                display: "inline-flex", alignItems: "center", justifyContent: "center",
                            }}><Plus size={18} /></button>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "380px", overflowY: "auto" }}>
                            {tasks.length === 0 && (
                                <p style={{ textAlign: "center", color: "var(--app-muted)", fontSize: "0.9rem", margin: "2rem 0" }}><span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>لا توجد مهام بعد <Sparkles size={16} /></span></p>
                            )}
                            {tasks.map((task, idx) => (
                                <div
                                    key={task.id}
                                    draggable
                                    onDragStart={() => handleDragStart(idx)}
                                    onDragOver={e => handleDragOver(e, idx)}
                                    onDragEnd={() => setDragIdx(null)}
                                    onClick={() => setActiveTaskId(task.id === activeTaskId ? null : task.id)}
                                    style={{
                                        display: "flex", alignItems: "center", gap: "0.7rem",
                                        padding: "0.7rem 0.9rem", borderRadius: "12px",
                                        background: activeTaskId === task.id ? "var(--app-primary-bg)" : "var(--app-bg)",
                                        border: `1.5px solid ${activeTaskId === task.id ? "var(--app-primary)" : "var(--app-border)"}`,
                                        cursor: "pointer", transition: "all 0.15s",
                                        opacity: task.done ? 0.55 : 1,
                                    }}
                                >
                                    <span style={{ color: "var(--app-muted-light)", cursor: "grab", fontSize: "0.9rem", display: "inline-flex", alignItems: "center" }}><GripVertical size={16} /></span>
                                    <input
                                        type="checkbox" checked={task.done}
                                        onChange={e => { e.stopPropagation(); toggleTask(task.id); }}
                                        style={{ width: "16px", height: "16px", cursor: "pointer", accentColor: "var(--app-primary)" }}
                                    />
                                    <span style={{ flex: 1, fontSize: "0.9rem", color: "var(--app-text)", textDecoration: task.done ? "line-through" : "none" }}>
                                        {task.text}
                                    </span>
                                    {activeTaskId === task.id && <span style={{ fontSize: "0.7rem", color: "var(--app-primary)", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "4px" }}><Play size={14} /> نشطة</span>}
                                    <button onClick={e => { e.stopPropagation(); deleteTask(task.id); }}
                                        style={{ background: "none", border: "none", color: "var(--app-red)", cursor: "pointer", fontSize: "0.85rem", display: "inline-flex", alignItems: "center" }}><X size={16} /></button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Pomodoro */}
                    <div style={{ background: "var(--app-card)", borderRadius: "20px", padding: "1.5rem", boxShadow: "var(--app-shadow)", border: "1.5px solid var(--app-border)", display: "flex", flexDirection: "column", alignItems: "center" }}>
                        <div style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                            <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "var(--app-text)", display: "inline-flex", alignItems: "center", gap: "6px" }}><Clock size={16} /> بومودورو</h2>
                            <button onClick={() => { setShowSettings(s => !s); setTempWork(workMin); setTempShort(shortMin); setTempLong(longMin); }}
                                style={{ background: "var(--app-bg)", border: "1px solid var(--app-border)", borderRadius: "8px", padding: "0.3rem 0.7rem", fontSize: "0.8rem", cursor: "pointer", color: "var(--app-muted)", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                                <Settings size={16} /> إعدادات
                            </button>
                        </div>

                        {/* Settings Panel */}
                        {showSettings && (
                            <div style={{ width: "100%", background: "var(--app-bg)", border: "1.5px solid var(--app-border)", borderRadius: "12px", padding: "1rem", marginBottom: "1rem" }}>
                                {[
                                    { label: "وقت التركيز (دقيقة)", val: tempWork, set: setTempWork },
                                    { label: "استراحة قصيرة (دقيقة)", val: tempShort, set: setTempShort },
                                    { label: "استراحة طويلة (دقيقة)", val: tempLong, set: setTempLong },
                                ].map(({ label, val, set }) => (
                                    <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
                                        <span style={{ fontSize: "0.82rem", color: "var(--app-muted)" }}>{label}</span>
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                            <button onClick={() => set(v => Math.max(1, v - 1))} style={{ width: "24px", height: "24px", borderRadius: "6px", border: "1px solid var(--app-border)", background: "var(--app-card)", cursor: "pointer", fontWeight: 700, color: "var(--app-text)" }}>−</button>
                                            <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--app-text)", minWidth: "24px", textAlign: "center" }}>{val}</span>
                                            <button onClick={() => set(v => Math.min(99, v + 1))} style={{ width: "24px", height: "24px", borderRadius: "6px", border: "1px solid var(--app-border)", background: "var(--app-card)", cursor: "pointer", fontWeight: 700, color: "var(--app-text)" }}>+</button>
                                        </div>
                                    </div>
                                ))}
                                <button onClick={saveSettings} style={{
                                    width: "100%", background: "linear-gradient(135deg, var(--app-primary-light), var(--app-primary))",
                                    color: "#fff", border: "none", borderRadius: "8px", padding: "0.5rem",
                                    fontSize: "0.85rem", cursor: "pointer", fontWeight: 700, marginTop: "0.3rem",
                                }}>حفظ</button>
                            </div>
                        )}

                        {/* Active Task */}
                        <div style={{
                            background: activeTask ? "var(--app-primary-bg)" : "var(--app-bg)",
                            border: `1.5px solid ${activeTask ? "var(--app-primary)" : "var(--app-border)"}`,
                            borderRadius: "10px", padding: "0.5rem 1rem",
                            fontSize: "0.85rem", color: activeTask ? "var(--app-text)" : "var(--app-muted)",
                            fontWeight: 600, marginBottom: "1rem", textAlign: "center", width: "100%", boxSizing: "border-box",
                        }}>
                            {activeTask ? <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}><Pin size={14} /> {activeTask.text}</span> : "اختاري مهمة من القائمة"}
                        </div>

                        {/* Mode Buttons */}
                        <div style={{ display: "flex", gap: "0.4rem", marginBottom: "1rem" }}>
                            {[{ key: "work", label: "تركيز" }, { key: "short", label: "قصيرة" }, { key: "long", label: "طويلة" }].map(m => (
                                <button key={m.key} onClick={() => setTimerMode(m.key as "work" | "short" | "long")} style={{
                                    background: mode === m.key ? modeColor : "var(--app-bg)",
                                    color: mode === m.key ? "#fff" : "var(--app-muted)",
                                    border: "none", borderRadius: "8px", padding: "0.35rem 0.7rem",
                                    fontSize: "0.78rem", cursor: "pointer", fontWeight: 600,
                                }}>{m.label}</button>
                            ))}
                        </div>

                        {/* Timer */}
                        <div style={{ fontSize: "5rem", fontWeight: 800, color: modeColor, letterSpacing: "4px", lineHeight: 1, marginBottom: "0.3rem", fontFamily: "monospace" }}>
                            {mins}:{secs}
                        </div>
                        <p style={{ margin: "0 0 1rem", fontSize: "0.82rem", color: "var(--app-muted)", fontWeight: 600 }}>{modeLabel} • جلسة {pomodoroCount + 1}</p>

                        {/* Controls */}
                        <div style={{ display: "flex", gap: "0.75rem" }}>
                            <button onClick={() => setRunning(r => !r)} style={{
                                background: running ? "linear-gradient(135deg, var(--app-red), var(--app-danger))" : "linear-gradient(135deg, var(--app-primary-light), var(--app-primary))",
                                color: "#fff", border: "none", borderRadius: "12px",
                                padding: "0.7rem 1.8rem", fontSize: "1rem", cursor: "pointer", fontWeight: 700,
                                boxShadow: "0 4px 15px rgba(40,120,200,0.3)",
                            }}>{running ? "⏸ إيقاف" : <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}><Play size={16} /> ابدأ</span>}</button>
                            <button onClick={() => { setRunning(false); setSeconds((mode === "work" ? workMin : mode === "short" ? shortMin : longMin) * 60); }}
                                style={{ background: "var(--app-bg)", color: "var(--app-muted)", border: "1.5px solid var(--app-border)", borderRadius: "12px", padding: "0.7rem 1rem", fontSize: "1rem", cursor: "pointer", fontWeight: 700 }}>↺</button>
                        </div>

                        {/* Dots */}
                        <div style={{ display: "flex", gap: "0.4rem", marginTop: "1.2rem" }}>
                            {Array.from({ length: 4 }, (_, i) => (
                                <div key={i} style={{ width: "12px", height: "12px", borderRadius: "50%", background: i < pomodoroCount % 4 ? modeColor : "var(--app-border)" }} />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}