import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { Search, X, FileText, Folder, FolderOpen } from "lucide-react";
import { apiGetProjects, apiGetProject } from "../lib/storage";

interface SearchResult {
  type: "project" | "session" | "folder";
  id: string;
  name: string;
  projectId?: string;
  projectName?: string;
}

export default function GlobalSearch() {
  const [, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
      setResults([]);
      setSelectedIdx(0);
    }
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setOpen(o => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    try {
      const projects = await apiGetProjects();
      const matched: SearchResult[] = [];
      const lq = q.toLowerCase();

      for (const p of projects) {
        if (p.name.toLowerCase().includes(lq)) {
          matched.push({ type: "project", id: p.id, name: p.name });
        }
        const data = await apiGetProject(p.id);
        if (!data) continue;
        for (const s of data.sessions) {
          if (s.fileName.toLowerCase().includes(lq)) {
            matched.push({ type: "session", id: s.id, name: s.fileName, projectId: p.id, projectName: p.name });
          }
        }
        for (const f of data.folders) {
          if (f.name.toLowerCase().includes(lq)) {
            matched.push({ type: "folder", id: f.id, name: f.name, projectId: p.id, projectName: p.name });
          }
        }
      }
      setResults(matched.slice(0, 12));
      setSelectedIdx(0);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => search(query), 250);
    return () => clearTimeout(t);
  }, [query, search]);

  const handleSelect = (r: SearchResult) => {
    setOpen(false);
    if (r.type === "session") navigate(`/files/${r.id}`);
    else if (r.type === "project") navigate("/projects");
    else if (r.type === "folder") navigate("/projects");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && results[selectedIdx]) { handleSelect(results[selectedIdx]); }
  };

  const iconFor = (type: string) => {
    if (type === "session") return <FileText size={15} style={{ color: "var(--app-accent)", flexShrink: 0 }} />;
    if (type === "folder") return <FolderOpen size={15} style={{ color: "var(--app-yellow)", flexShrink: 0 }} />;
    return <Folder size={15} style={{ color: "var(--app-green)", flexShrink: 0 }} />;
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          background: "var(--app-surface)", border: "1.5px solid var(--app-border)",
          borderRadius: "clamp(8px, 1.2vw, 10px)", padding: "clamp(0.3rem, 0.5vw, 0.4rem) clamp(0.6rem, 1vw, 0.9rem)",
          cursor: "pointer", fontSize: "clamp(0.75rem, 1.1vw, 0.85rem)",
          color: "var(--app-muted)", fontFamily: "inherit",
          display: "flex", alignItems: "center", gap: "6px",
          transition: "all 0.15s", whiteSpace: "nowrap",
        }}
      >
        <Search size={14} />
        <span className="hdr-label search-label">بحث</span>
        <kbd className="hdr-search-kbd" style={{
          fontSize: "0.65rem", padding: "1px 5px", borderRadius: "4px",
          background: "var(--app-border)", color: "var(--app-muted)",
          fontFamily: "monospace", lineHeight: "1.4",
        }}>⌘K</kbd>
      </button>

      {open && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          display: "flex", alignItems: "flex-start", justifyContent: "center",
          paddingTop: "15vh",
          background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)",
          animation: "confirm-fade-in 0.12s ease-out",
        }}>
          <div ref={panelRef} style={{
            background: "var(--app-card)", borderRadius: "16px",
            width: "90%", maxWidth: "500px",
            boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
            overflow: "hidden",
            animation: "confirm-slide-in 0.15s ease-out",
          }}>
            <div style={{
              display: "flex", alignItems: "center", gap: "0.75rem",
              padding: "0.85rem 1rem", borderBottom: "1px solid var(--app-border)",
            }}>
              <Search size={18} style={{ color: "var(--app-muted)", flexShrink: 0 }} />
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="ابحث عن ملف، مشروع، أو مجلد..."
                style={{
                  flex: 1, border: "none", outline: "none", background: "transparent",
                  fontSize: "0.95rem", color: "var(--app-text)", fontFamily: "inherit",
                }}
              />
              {query && (
                <button onClick={() => setQuery("")} style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--app-muted)", padding: "2px",
                }}>
                  <X size={16} />
                </button>
              )}
              <button onClick={() => setOpen(false)} style={{
                border: "none", cursor: "pointer",
                fontSize: "0.7rem", color: "var(--app-muted)", fontFamily: "monospace",
                padding: "2px 6px", borderRadius: "4px",
                background: "var(--app-border)",
              }}>ESC</button>
            </div>

            <div style={{ maxHeight: "320px", overflowY: "auto" }}>
              {loading && (
                <div style={{ padding: "1.5rem", textAlign: "center", color: "var(--app-muted)", fontSize: "0.85rem" }}>
                  جاري البحث...
                </div>
              )}
              {!loading && query && results.length === 0 && (
                <div style={{ padding: "1.5rem", textAlign: "center", color: "var(--app-muted)", fontSize: "0.85rem" }}>
                  لا توجد نتائج لـ "{query}"
                </div>
              )}
              {!loading && results.map((r, i) => (
                <button
                  key={`${r.type}-${r.id}`}
                  onClick={() => handleSelect(r)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: "0.75rem",
                    padding: "0.65rem 1rem", border: "none",
                    background: i === selectedIdx ? "var(--app-surface)" : "transparent",
                    cursor: "pointer", textAlign: "right", fontFamily: "inherit",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={() => setSelectedIdx(i)}
                >
                  {iconFor(r.type)}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--app-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.name}
                    </div>
                    {r.projectName && (
                      <div style={{ fontSize: "0.72rem", color: "var(--app-muted)" }}>{r.projectName}</div>
                    )}
                  </div>
                  <span style={{
                    fontSize: "0.65rem", padding: "2px 6px", borderRadius: "4px",
                    background: "var(--app-surface)", color: "var(--app-muted)",
                    flexShrink: 0,
                  }}>
                    {r.type === "session" ? "ملف" : r.type === "folder" ? "مجلد" : "مشروع"}
                  </span>
                </button>
              ))}
              {!query && (
                <div style={{ padding: "1.5rem", textAlign: "center", color: "var(--app-muted)", fontSize: "0.8rem" }}>
                  اكتب للبحث في ملفاتك ومشاريعك
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
