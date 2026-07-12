import { useState } from "react";
import { Plus, Check, X, GripVertical, ListChecks } from "lucide-react";

export interface Task {
  id: string;
  text: string;
  done: boolean;
}

interface Props {
  tasks: Task[];
  activeTaskId: string | null;
  onSetTasks: (tasks: Task[]) => void;
  onSetActiveTaskId: (id: string | null) => void;
  onDragTaskStart?: (idx: number) => void;
  onDragTaskEnd?: () => void;
}

export default function TaskList({ tasks, activeTaskId, onSetTasks, onSetActiveTaskId, onDragTaskStart, onDragTaskEnd }: Props) {
  const [newTask, setNewTask] = useState("");
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const addTask = () => {
    if (!newTask.trim()) return;
    onSetTasks([...tasks, { id: crypto.randomUUID(), text: newTask.trim(), done: false }]);
    setNewTask("");
  };

  const toggleTask = (id: string) => onSetTasks(tasks.map(t => t.id === id ? { ...t, done: !t.done } : t));
  const deleteTask = (id: string) => {
    onSetTasks(tasks.filter(t => t.id !== id));
    if (activeTaskId === id) onSetActiveTaskId(null);
  };

  const handleDragStart = (idx: number) => {
    setDragIdx(idx);
    onDragTaskStart?.(idx);
  };
  const handleDragEnd = () => {
    setDragIdx(null);
    onDragTaskEnd?.();
  };
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    const arr = [...tasks];
    const [item] = arr.splice(dragIdx, 1);
    arr.splice(idx, 0, item);
    onSetTasks(arr);
    setDragIdx(idx);
  };

  return (
    <div style={{
      background: "var(--app-card)", borderRadius: "20px", padding: "1.5rem",
      boxShadow: "var(--app-shadow)",
      border: "1.5px solid var(--app-border)",
      direction: "rtl",
    }}>
      <p style={{ margin: "0 0 0.5rem", fontSize: "0.85rem", fontWeight: 600, color: "var(--app-muted)", textAlign: "center", fontStyle: "italic" }}>
        دوّنْ خُطاكَ فإنَّ الحلمَ يتبعُها • وما النجاحاتُ إلا جمعُ ما كُتِبا
      </p>

      <h2 style={{ margin: "0 0 1rem", fontSize: "1.1rem", fontWeight: 700, color: "var(--app-text)", display: "flex", alignItems: "center", gap: "6px" }}>
        <ListChecks size={20} color="var(--app-primary)" /> قائمة المهام
      </h2>

      {/* Add task input */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        <input
          value={newTask} onChange={e => setNewTask(e.target.value)}
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
          background: "linear-gradient(135deg, #4a9ee0, #2878c8)", color: "#fff",
          border: "none", borderRadius: "10px", padding: "0.6rem 1rem",
          fontSize: "1rem", cursor: "pointer", fontWeight: 700,
          display: "flex", alignItems: "center", gap: "4px",
          fontFamily: "inherit",
        }}>
          <Plus size={18} />
        </button>
      </div>

      {/* Task list */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "380px", overflowY: "auto" }}>
        {tasks.length === 0 && (
          <div style={{ textAlign: "center", color: "var(--app-muted-light)", fontSize: "0.9rem", margin: "2rem 0", padding: "1rem" }}>
            <ListChecks size={40} style={{ margin: "0 auto 0.5rem", opacity: 0.3 }} />
            لا توجد مهام بعد
          </div>
        )}
        {tasks.map((task, idx) => (
          <div key={task.id} draggable
            onDragStart={() => handleDragStart(idx)}
            onDragOver={e => handleDragOver(e, idx)}
            onDragEnd={handleDragEnd}
            style={{
              display: "flex", alignItems: "center", gap: "0.7rem",
              padding: "0.7rem 0.9rem", borderRadius: "12px",
              background: activeTaskId === task.id ? "var(--app-primary-bg)" : "var(--app-bg)",
              border: `1.5px solid ${activeTaskId === task.id ? "var(--app-primary)" : "var(--app-border)"}`,
              cursor: "grab", transition: "all 0.15s",
              opacity: task.done ? 0.55 : 1,
            }}
          >
            <GripVertical size={16} color="var(--app-muted-light)" style={{ cursor: "grab" }} />
            <button
              onClick={() => toggleTask(task.id)}
              style={{
                width: "20px", height: "20px", borderRadius: "6px",
                border: `2px solid ${task.done ? "var(--app-primary)" : "var(--app-muted-light)"}`,
                background: task.done ? "var(--app-primary)" : "transparent",
                cursor: "pointer", display: "flex", alignItems: "center",
                justifyContent: "center", padding: 0, transition: "all 0.15s",
              }}
            >
              {task.done && <Check size={12} color="#fff" strokeWidth={3} />}
            </button>
            <span style={{
              flex: 1, fontSize: "0.95rem", color: "var(--app-text)",
              textDecoration: task.done ? "line-through" : "none",
              fontWeight: activeTaskId === task.id ? 700 : 400,
            }}>
              {task.text}
            </span>
            {activeTaskId === task.id && (
              <span style={{ fontSize: "0.7rem", color: "var(--app-primary)", fontWeight: 700, background: "var(--app-primary-bg)", padding: "0.15rem 0.5rem", borderRadius: "6px" }}>
                نشطة
              </span>
            )}
            <button onClick={() => deleteTask(task.id)}
              style={{
                background: "none", border: "none", color: "var(--app-muted-light)",
                cursor: "pointer", fontSize: "0.9rem", padding: "4px",
                borderRadius: "6px", display: "flex",
              }}>
              <X size={16} />
            </button>
          </div>
        ))}
      </div>

      {tasks.length > 0 && (
        <p style={{ margin: "0.8rem 0 0", fontSize: "0.78rem", color: "var(--app-muted)", textAlign: "center" }}>
          اسحبي المهمة وضعيها على البومودورو لتحديدها 👈
        </p>
      )}
    </div>
  );
}
