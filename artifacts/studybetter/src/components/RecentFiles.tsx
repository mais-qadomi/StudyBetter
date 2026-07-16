import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { FileText, Clock, ArrowLeft } from "lucide-react";
import { apiGetProjects, apiGetProject, type StoredSession } from "../lib/storage";

interface RecentFile extends StoredSession {
  projectName?: string;
}

export default function RecentFiles() {
  const [, navigate] = useLocation();
  const [files, setFiles] = useState<RecentFile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const projects = await apiGetProjects();
        const all: RecentFile[] = [];
        for (const p of projects.slice(0, 5)) {
          const data = await apiGetProject(p.id);
          if (!data) continue;
          for (const s of data.sessions) {
            all.push({ ...s, projectName: p.name });
          }
        }
        if (!cancelled) setFiles(all.slice(0, 5));
      } catch {}
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading || files.length === 0) return null;

  return (
    <div style={{
      background: "var(--app-card)", border: "1.5px solid var(--app-border)",
      borderRadius: "clamp(14px, 2.5vw, 20px)", padding: "clamp(0.8rem, 1.5vw, 1.2rem)",
      boxShadow: "var(--app-shadow)",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
        <h3 style={{ margin: 0, fontSize: "clamp(0.85rem, 1.2vw, 1rem)", fontWeight: 700, color: "var(--app-text)", display: "flex", alignItems: "center", gap: "6px" }}>
          <Clock size={16} /> آخر الملفات
        </h3>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
        {files.map(f => (
          <button
            key={f.id}
            onClick={() => navigate(`/files/${f.id}`)}
            style={{
              display: "flex", alignItems: "center", gap: "0.75rem",
              padding: "0.6rem 0.8rem", borderRadius: "10px",
              border: "1px solid var(--app-border)", background: "var(--app-bg)",
              cursor: "pointer", textAlign: "right", fontFamily: "inherit",
              transition: "all 0.15s", width: "100%",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--app-accent)"; e.currentTarget.style.background = "var(--app-accent-bg)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--app-border)"; e.currentTarget.style.background = "var(--app-bg)"; }}
          >
            <FileText size={16} style={{ color: "var(--app-accent)", flexShrink: 0 }} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--app-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {f.fileName}
              </div>
              {f.projectName && (
                <div style={{ fontSize: "0.7rem", color: "var(--app-muted)" }}>{f.projectName}</div>
              )}
            </div>
            <span style={{ fontSize: "0.7rem", color: "var(--app-muted)", flexShrink: 0 }}>
              {f.numPages} صفحة
            </span>
            <ArrowLeft size={14} style={{ color: "var(--app-muted)", flexShrink: 0 }} />
          </button>
        ))}
      </div>
    </div>
  );
}
