import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { useConfirm } from "./ConfirmDialog";
import {
  apiGetProjects,
  apiGetProject,
  apiCreateProject,
  apiDeleteProject,
  apiRenameProject,
  apiCreateFolder,
  apiRenameFolder,
  apiDeleteFolder,
  apiMoveFolder,
  apiDeleteSession,
  apiRenameSession,
  apiAssignSessionToFolder,
  apiGetBookmarks,
  apiCreateBookmark,
  apiDeleteBookmark,
  apiUpdateBookmark,
  type Project,
  type StoredSession,
  type Folder,
  type Bookmark,
} from "../lib/storage";

type ProjectCache = Record<string, { folders: Folder[]; sessions: StoredSession[]; bookmarks: Bookmark[] }>;

interface FileSidebarProps {
  open: boolean;
  onClose: () => void;
}

export default function FileSidebar({ open, onClose }: FileSidebarProps) {
  const [, navigate] = useLocation();
  const { confirm } = useConfirm();
  const [projects, setProjects] = useState<Project[]>([]);
  const [cache, setCache] = useState<ProjectCache>({});
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState<{ projectId: string; parentId: string | null } | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [editingItem, setEditingItem] = useState<{ id: string; type: "project" | "folder" | "session" | "bookmark"; name: string } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; id: string; type: "project" | "folder" | "session" | "bookmark" } | null>(null);
  const [loadingProjects, setLoadingProjects] = useState<Set<string>>(new Set());
  const [initialLoading, setInitialLoading] = useState(false);
  const [dragSession, setDragSession] = useState<{ id: string; sourceFolderId: string | null; sourceProjectId: string } | null>(null);
  const [dragFolder, setDragFolder] = useState<{ id: string; sourceParentFolderId: string | null; sourceProjectId: string } | null>(null);
  const [dragOverProjectId, setDragOverProjectId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [showAddMenu, setShowAddMenu] = useState<{ projectId: string; folderId: string | null } | null>(null);
  const [creatingLink, setCreatingLink] = useState<{ projectId: string; folderId: string | null } | null>(null);
  const [creatingNote, setCreatingNote] = useState<{ projectId: string; folderId: string | null } | null>(null);
  const [newLinkName, setNewLinkName] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [newNoteName, setNewNoteName] = useState("");
  const [newNoteContent, setNewNoteContent] = useState("");

  const newProjectRef = useRef<HTMLInputElement>(null);
  const newFolderRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) { void loadProjects(); }
  }, [open]);

  useEffect(() => {
    if (creatingProject) newProjectRef.current?.focus();
  }, [creatingProject]);

  useEffect(() => {
    if (creatingFolder) newFolderRef.current?.focus();
  }, [creatingFolder]);

  useEffect(() => {
    if (editingItem) editInputRef.current?.focus();
  }, [editingItem]);

  useEffect(() => {
    const handler = () => { setContextMenu(null); setShowAddMenu(null); };
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, []);

  useEffect(() => {
    if (!open) {
      setContextMenu(null); setCreatingProject(false); setCreatingFolder(null);
      setEditingItem(null); setDragSession(null); setDragFolder(null); setShowAddMenu(null);
      setCreatingLink(null); setCreatingNote(null);
    }
  }, [open]);

  async function loadProjects() {
    setInitialLoading(true);
    const list = await apiGetProjects();
    setProjects(list);
    setInitialLoading(false);
  }

  async function loadProjectData(projectId: string) {
    if (cache[projectId]) return;
    setLoadingProjects(prev => new Set(prev).add(projectId));
    const [data, bookmarks] = await Promise.all([
      apiGetProject(projectId),
      apiGetBookmarks(projectId),
    ]);
    if (data) {
      setCache(prev => ({ ...prev, [projectId]: { folders: data.folders, sessions: data.sessions, bookmarks } }));
    }
    setLoadingProjects(prev => { const s = new Set(prev); s.delete(projectId); return s; });
  }

  function getFolders(projectId: string): Folder[] {
    return (cache[projectId]?.folders ?? []).slice().sort((a, b) => a.order - b.order);
  }

  function getChildFolders(projectId: string, parentId: string | null): Folder[] {
    return getFolders(projectId).filter(f => f.parentFolderId === parentId);
  }

  function getSessions(projectId: string, folderId: string | null): StoredSession[] {
    return (cache[projectId]?.sessions ?? []).filter(s => s.folderId === folderId);
  }

  function getBookmarks(projectId: string, folderId: string | null): Bookmark[] {
    return (cache[projectId]?.bookmarks ?? []).filter(b => b.folderId === folderId);
  }

  function matchesSearch(name: string): boolean {
    if (!searchQuery.trim()) return true;
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  }

  function anyChildMatches(projectId: string, folderId: string | null): boolean {
    if (searchQuery.trim()) {
      const sessions = getSessions(projectId, folderId);
      if (sessions.some(s => matchesSearch(s.fileName))) return true;
      const bookmarks = getBookmarks(projectId, folderId);
      if (bookmarks.some(b => matchesSearch(b.name))) return true;
      const childFolders = getChildFolders(projectId, folderId);
      for (const cf of childFolders) {
        if (matchesSearch(cf.name)) return true;
        if (anyChildMatches(projectId, cf.id)) return true;
      }
    }
    return false;
  }

  function isExpanded(id: string): boolean {
    if (searchQuery.trim()) return true;
    return expandedProjects.has(id) || expandedFolders.has(id);
  }

  const toggleProject = useCallback(async (projectId: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) { next.delete(projectId); return next; }
      next.add(projectId);
      return next;
    });
    if (!cache[projectId]) await loadProjectData(projectId);
  }, [cache]);

  const toggleFolder = useCallback((folderId: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) { next.delete(folderId); return next; }
      next.add(folderId);
      return next;
    });
  }, []);

  async function handleCreateProject() {
    if (!newProjectName.trim()) return;
    const created = await apiCreateProject(newProjectName.trim());
    if (created) {
      setProjects(prev => [...prev, created]);
      setNewProjectName(""); setCreatingProject(false);
      setExpandedProjects(prev => new Set(prev).add(created.id));
      await loadProjectData(created.id);
    }
  }

  async function handleCreateFolder() {
    if (!creatingFolder || !newFolderName.trim()) return;
    const created = await apiCreateFolder(newFolderName.trim(), creatingFolder.projectId, creatingFolder.parentId);
    if (created) {
      const data = await apiGetProject(creatingFolder.projectId);
      if (data) setCache(prev => ({ ...prev, [creatingFolder.projectId]: { ...prev[creatingFolder.projectId], folders: data.folders } }));
      const pid = creatingFolder.parentId;
      setNewFolderName(""); setCreatingFolder(null);
      if (pid) setExpandedFolders(prev => new Set(prev).add(pid));
    }
  }

  async function handleAddLink() {
    if (!creatingLink || !newLinkName.trim() || !newLinkUrl.trim()) return;
    const created = await apiCreateBookmark({
      projectId: creatingLink.projectId,
      folderId: creatingLink.folderId,
      name: newLinkName.trim(),
      type: "link",
      url: newLinkUrl.trim(),
    });
    if (created) {
      setCache(prev => ({
        ...prev,
        [creatingLink.projectId]: {
          ...prev[creatingLink.projectId],
          bookmarks: [...(prev[creatingLink.projectId]?.bookmarks ?? []), created],
        },
      }));
      setNewLinkName(""); setNewLinkUrl(""); setCreatingLink(null);
    }
  }

  async function handleAddNote() {
    if (!creatingNote || !newNoteName.trim() || !newNoteContent.trim()) return;
    const created = await apiCreateBookmark({
      projectId: creatingNote.projectId,
      folderId: creatingNote.folderId,
      name: newNoteName.trim(),
      type: "note",
      content: newNoteContent.trim(),
    });
    if (created) {
      setCache(prev => ({
        ...prev,
        [creatingNote.projectId]: {
          ...prev[creatingNote.projectId],
          bookmarks: [...(prev[creatingNote.projectId]?.bookmarks ?? []), created],
        },
      }));
      setNewNoteName(""); setNewNoteContent(""); setCreatingNote(null);
    }
  }

  async function handleDeleteBookmark(id: string, projectId: string) {
    if (!await confirm({ message: "حذف العنصر؟", danger: true })) return;
    await apiDeleteBookmark(id);
    setCache(prev => ({
      ...prev,
      [projectId]: {
        ...prev[projectId],
        bookmarks: prev[projectId].bookmarks.filter(b => b.id !== id),
      },
    }));
  }

  async function handleRename() {
    if (!editingItem || !editingItem.name.trim()) { setEditingItem(null); return; }
    try {
      if (editingItem.type === "project") {
        await apiRenameProject(editingItem.id, editingItem.name.trim());
        setProjects(prev => prev.map(p => p.id === editingItem.id ? { ...p, name: editingItem.name.trim() } : p));
      } else if (editingItem.type === "folder") {
        await apiRenameFolder(editingItem.id, editingItem.name.trim());
        for (const pid of Object.keys(cache)) {
          const folders = cache[pid]?.folders;
          if (folders?.some(f => f.id === editingItem.id)) {
            const data = await apiGetProject(pid);
            if (data) setCache(prev => ({ ...prev, [pid]: { ...prev[pid], folders: data.folders } }));
            break;
          }
        }
      } else if (editingItem.type === "bookmark") {
        await apiUpdateBookmark(editingItem.id, { name: editingItem.name.trim() });
        for (const pid of Object.keys(cache)) {
          const bookmarks = cache[pid]?.bookmarks;
          if (bookmarks?.some(b => b.id === editingItem.id)) {
            setCache(prev => ({
              ...prev,
              [pid]: {
                ...prev[pid],
                bookmarks: prev[pid].bookmarks.map(b => b.id === editingItem.id ? { ...b, name: editingItem.name.trim() } : b),
              },
            }));
            break;
          }
        }
      } else {
        await apiRenameSession(editingItem.id, editingItem.name.trim());
        for (const pid of Object.keys(cache)) {
          const sessions = cache[pid]?.sessions;
          if (sessions?.some(s => s.id === editingItem.id)) {
            setCache(prev => ({
              ...prev,
              [pid]: {
                ...prev[pid],
                sessions: prev[pid].sessions.map(s => s.id === editingItem.id ? { ...s, fileName: editingItem.name.trim() } : s),
              },
            }));
            break;
          }
        }
      }
    } catch { }
    setEditingItem(null);
  }

  async function handleDelete(id: string, type: "project" | "folder" | "session", projectId?: string) {
    setContextMenu(null);
    if (type === "project") {
      if (!await confirm({ message: "حذف المشروع؟ كل الملفات والمجلدات الداخلية رح تُحذف.", danger: true })) return;
      await apiDeleteProject(id);
      setProjects(prev => prev.filter(p => p.id !== id));
      setCache(prev => { const c = { ...prev }; delete c[id]; return c; });
    } else if (type === "folder") {
      if (!await confirm({ message: "حذف المجلد؟ الملفات اللي جواه بتضل موجودة بدون مجلد.", danger: true })) return;
      await apiDeleteFolder(id);
      if (projectId) {
        const data = await apiGetProject(projectId);
        if (data) setCache(prev => ({ ...prev, [projectId]: { ...prev[projectId], folders: data.folders } }));
      }
    } else {
      if (!await confirm({ message: "حذف الملف؟", danger: true })) return;
      await apiDeleteSession(id);
      for (const pid of Object.keys(cache)) {
        const s = cache[pid]?.sessions;
        if (s?.some(x => x.id === id)) {
          setCache(prev => ({ ...prev, [pid]: { ...prev[pid], sessions: prev[pid].sessions.filter(x => x.id !== id) } }));
          break;
        }
      }
    }
  }

  async function handleDrop(targetProjectId: string, targetFolderId: string | null) {
    if (!dragSession) return;
    try {
      await apiAssignSessionToFolder(dragSession.id, targetFolderId);
      setCache(prev => {
        const c = { ...prev };
        for (const pid of Object.keys(c)) {
          c[pid] = {
            ...c[pid],
            sessions: c[pid].sessions.map(s => s.id === dragSession.id ? { ...s, folderId: targetFolderId } : s),
          };
        }
        return c;
      });
    } catch { }
    setDragSession(null); setDragOverProjectId(null); setDragOverFolderId(null);
  }

  async function handleDropFolder(targetProjectId: string, targetFolderId: string | null) {
    if (!dragFolder) return;
    if (dragFolder.id === targetFolderId) { setDragFolder(null); setDragOverProjectId(null); setDragOverFolderId(null); return; }
    try {
      await apiMoveFolder(dragFolder.id, targetFolderId);
      const data = await apiGetProject(targetProjectId);
      if (data) setCache(prev => ({ ...prev, [targetProjectId]: { ...prev[targetProjectId], folders: data.folders } }));
      if (dragFolder.sourceProjectId !== targetProjectId) {
        const srcData = await apiGetProject(dragFolder.sourceProjectId);
        if (srcData) setCache(prev => ({ ...prev, [dragFolder.sourceProjectId]: { ...prev[dragFolder.sourceProjectId], folders: srcData.folders } }));
      }
    } catch { }
    setDragFolder(null); setDragOverProjectId(null); setDragOverFolderId(null);
  }

  // ── Styles ──
  const overlayStyle: React.CSSProperties = {
    position: "fixed", inset: 0, zIndex: 200,
    background: "rgba(0,0,0,0.2)",
    visibility: open ? "visible" : "hidden",
    opacity: open ? 1 : 0,
    transition: "opacity 0.2s, visibility 0.2s",
  };

  const panelStyle: React.CSSProperties = {
    position: "fixed", top: 0, left: 0, bottom: 0, width: "380px",
    background: "var(--app-card)", zIndex: 201,
    boxShadow: "var(--app-shadow)",
    display: "flex", flexDirection: "column",
    transform: open ? "translateX(0)" : "translateX(-100%)",
    transition: "transform 0.25s ease",
    borderLeft: "1px solid " + "var(--app-border)",
    fontFamily: "'Segoe UI', system-ui, sans-serif",
  };

  const headerStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "1rem 1.2rem",
    borderBottom: "1px solid " + "var(--app-border)",
  };

  const btnIcon: React.CSSProperties = {
    background: "none", border: "none", cursor: "pointer",
    fontSize: "1.35rem", color: "var(--app-text)", padding: "6px 10px",
    borderRadius: "8px", display: "flex", alignItems: "center",
    fontFamily: "inherit",
  };

  const treeStyle: React.CSSProperties = {
    flex: 1, overflowY: "auto", padding: "0.3rem 0",
  };

  const rowStyle = (depth: number, isSelected: boolean, isDragOver?: boolean): React.CSSProperties => ({
    display: "flex", alignItems: "center", gap: "8px",
    padding: "0.55rem 0.7rem", borderRadius: "8px",
    margin: "3px 0.5rem", cursor: "pointer",
    background: isDragOver ? "var(--app-accent-bg)" : isSelected ? "var(--app-accent-bg)" + "80" : "transparent",
    border: isDragOver ? "2px dashed " + "var(--app-accent-light)" : "2px solid transparent",
    transition: "background 0.1s",
  });

  const nodeNameStyle: React.CSSProperties = {
    flex: 1, fontSize: "1.1rem", color: "var(--app-text)",
    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
  };

  const iconStyle = (size = "1.4rem"): React.CSSProperties => ({
    flexShrink: 0, fontSize: size, lineHeight: 1, width: "30px", textAlign: "center",
  });

  const contextMenuStyle: React.CSSProperties = {
    position: "fixed", zIndex: 300, background: "var(--app-card)",
    border: "1px solid " + "var(--app-border)", borderRadius: "8px",
    boxShadow: "var(--app-shadow)", minWidth: "200px", overflow: "hidden",
  };

  const contextItemStyle: React.CSSProperties = {
    padding: "0.7rem 1.2rem", fontSize: "1rem", cursor: "pointer",
    color: "var(--app-text)", border: "none", background: "none",
    width: "100%", textAlign: "right", fontFamily: "inherit",
  };

  const addMenuStyle: React.CSSProperties = {
    position: "absolute", zIndex: 250, background: "var(--app-card)",
    border: "1px solid " + "var(--app-border)", borderRadius: "8px",
    boxShadow: "var(--app-shadow)", minWidth: "210px", overflow: "hidden",
    top: "100%", left: "0", marginTop: "2px",
  };

  function renderSession(s: StoredSession, projectId: string, depth: number) {
    if (!matchesSearch(s.fileName)) return null;
    const isDragOver = dragOverFolderId === null && dragOverProjectId === projectId && dragSession !== null;
    return (
      <div key={s.id}
        draggable={editingItem?.id !== s.id}
        onDragStart={() => setDragSession({ id: s.id, sourceFolderId: s.folderId, sourceProjectId: projectId })}
        onDragEnd={() => { setDragSession(null); setDragOverProjectId(null); setDragOverFolderId(null); }}
        onDrop={(e) => { e.preventDefault(); void handleDrop(projectId, null); }}
        onDragOver={(e) => { e.preventDefault(); setDragOverProjectId(projectId); setDragOverFolderId(null); }}
        onDragLeave={() => { setDragOverProjectId(null); }}
        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY, id: s.id, type: "session" }); }}
        onClick={() => { if (editingItem?.id !== s.id) { navigate("/files/" + s.id); onClose(); } }}
        style={{
          ...rowStyle(depth, false, isDragOver),
          opacity: dragSession?.id === s.id ? 0.4 : 1,
          marginRight: (depth * 1.2) + "rem",
        }}
        onMouseOver={e => { if (!isDragOver) e.currentTarget.style.background = "var(--app-muted-light)"; }}
        onMouseOut={e => { if (!isDragOver) e.currentTarget.style.background = "transparent"; }}
      >
        <span style={iconStyle()}>📄</span>
        {editingItem?.id === s.id ? (
          <input ref={editInputRef} value={editingItem.name}
            onChange={e => setEditingItem({ ...editingItem, name: e.target.value })}
            onKeyDown={e => { if (e.key === "Enter") void handleRename(); if (e.key === "Escape") setEditingItem(null); }}
            onBlur={() => void handleRename()}
            onClick={e => e.stopPropagation()}
            style={{ flex: 1, fontSize: "1rem", padding: "0.3rem 0.5rem", borderRadius: "6px", border: "1px solid " + "var(--app-accent)", outline: "none", fontFamily: "inherit", background: "var(--app-card)", color: "var(--app-text)" }}
          />
        ) : (
          <span onDoubleClick={() => setEditingItem({ id: s.id, type: "session", name: s.fileName })}
            style={nodeNameStyle}>
            {s.fileName}
          </span>
        )}
      </div>
    );
  }

  function renderBookmark(b: Bookmark, projectId: string, depth: number) {
    if (!matchesSearch(b.name)) return null;
    return (
      <div key={b.id}
        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY, id: b.id, type: "bookmark" }); }}
        onClick={() => {
          if (b.type === "link" && b.url) window.open(b.url, "_blank", "noopener");
        }}
        style={{
          ...rowStyle(depth, false),
          marginRight: (depth * 1.2) + "rem",
        }}
        onMouseOver={e => e.currentTarget.style.background = "var(--app-muted-light)"}
        onMouseOut={e => e.currentTarget.style.background = "transparent"}
      >
        <span style={iconStyle()}>{b.type === "link" ? "🔗" : "📝"}</span>
        <span style={nodeNameStyle}>{b.name}</span>
        {b.type === "note" && <span style={{ fontSize: "1rem", color: "var(--app-muted)" }}>📌</span>}
      </div>
    );
  }

  function renderFolder(f: Folder, projectId: string, depth: number) {
    const children = getChildFolders(projectId, f.id);
    const sessions = getSessions(projectId, f.id);
    const bookmarks = getBookmarks(projectId, f.id);
    const hasChildren = children.length > 0 || sessions.length > 0 || bookmarks.length > 0;
    const expanded = isExpanded(f.id);
    const isDragOver = dragOverFolderId === f.id;
    const show = !searchQuery.trim() || matchesSearch(f.name) || anyChildMatches(projectId, f.id);

    if (!show) return null;

    return (
      <div key={f.id} style={{ position: "relative" }}>
        <div
          draggable
          onDragStart={(e) => { e.stopPropagation(); setDragFolder({ id: f.id, sourceParentFolderId: f.parentFolderId, sourceProjectId: projectId }); }}
          onDragEnd={() => { setDragFolder(null); setDragOverProjectId(null); setDragOverFolderId(null); }}
          onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY, id: f.id, type: "folder" }); }}
          onClick={() => toggleFolder(f.id)}
          onDrop={(e) => { e.preventDefault(); e.stopPropagation(); if (dragSession) void handleDrop(projectId, f.id); else if (dragFolder) void handleDropFolder(projectId, f.id); }}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverProjectId(projectId); setDragOverFolderId(f.id); }}
          onDragLeave={() => setDragOverFolderId(null)}
          style={{
            ...rowStyle(depth, false, isDragOver),
            marginRight: (depth * 1.2) + "rem",
          }}
          onMouseOver={e => { if (!isDragOver) e.currentTarget.style.background = "var(--app-muted-light)"; }}
          onMouseOut={e => { if (!isDragOver) e.currentTarget.style.background = "transparent"; }}
        >
          {editingItem?.id === f.id ? (
            <input ref={editInputRef} value={editingItem.name}
              onChange={e => setEditingItem({ ...editingItem, name: e.target.value })}
              onKeyDown={e => { if (e.key === "Enter") void handleRename(); if (e.key === "Escape") setEditingItem(null); }}
              onBlur={() => void handleRename()}
              onClick={e => e.stopPropagation()}
              style={{ flex: 1, fontSize: "1rem", padding: "0.3rem 0.5rem", borderRadius: "6px", border: "1px solid " + "var(--app-accent)", outline: "none", fontFamily: "inherit", background: "var(--app-card)", color: "var(--app-text)" }}
            />
          ) : (
            <>
              <span
                onClick={(e) => { e.stopPropagation(); toggleFolder(f.id); }}
                style={{ ...iconStyle("1.05rem"), color: "var(--app-muted)", cursor: "pointer", transition: "transform 0.15s", transform: expanded ? "rotate(90deg)" : "" }}
              >
                {hasChildren ? "▸" : "•"}
              </span>
              <span style={iconStyle()}>{expanded ? "📂" : "📁"}</span>
              <span onDoubleClick={() => setEditingItem({ id: f.id, type: "folder", name: f.name })}
                style={nodeNameStyle}>
                {f.name}
              </span>
              <div style={{ position: "relative" }}>
                <button onClick={(e) => { e.stopPropagation(); setShowAddMenu(p => p?.projectId === projectId && p?.folderId === f.id ? null : { projectId, folderId: f.id }); }}
                  style={{ ...btnIcon, fontSize: "1.1rem", color: "var(--app-muted)", padding: "4px 8px" }}>+</button>
                {showAddMenu?.projectId === projectId && showAddMenu?.folderId === f.id && (
                  <div ref={addMenuRef} style={addMenuStyle} onClick={e => e.stopPropagation()}>
                    <button style={contextItemStyle}
                      onMouseOver={e => e.currentTarget.style.background = "var(--app-muted-light)"}
                      onMouseOut={e => e.currentTarget.style.background = "none"}
                      onClick={() => { setShowAddMenu(null); navigate("/upload?projectId=" + projectId + "&folderId=" + f.id); onClose(); }}>📄 رفع ملف</button>
                    <button style={contextItemStyle}
                      onMouseOver={e => e.currentTarget.style.background = "var(--app-muted-light)"}
                      onMouseOut={e => e.currentTarget.style.background = "none"}
                      onClick={() => { setShowAddMenu(null); setCreatingLink({ projectId, folderId: f.id }); setNewLinkName(""); setNewLinkUrl(""); }}>🔗 إضافة رابط</button>
                    <button style={contextItemStyle}
                      onMouseOver={e => e.currentTarget.style.background = "var(--app-muted-light)"}
                      onMouseOut={e => e.currentTarget.style.background = "none"}
                      onClick={() => { setShowAddMenu(null); setCreatingNote({ projectId, folderId: f.id }); setNewNoteName(""); setNewNoteContent(""); }}>📝 إضافة نص</button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
        {creatingFolder?.parentId === f.id && (
          <div style={{ marginRight: ((depth + 1) * 1.2 + 0.5) + "rem", padding: "0.3rem 0.5rem" }}>
            <input ref={newFolderRef} value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") void handleCreateFolder(); if (e.key === "Escape") { setCreatingFolder(null); setNewFolderName(""); } }}
              placeholder="اسم المجلد"
              style={{ width: "100%", padding: "0.4rem 0.6rem", borderRadius: "6px", border: "1px solid " + "var(--app-border)", fontSize: "1rem", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
            />
          </div>
        )}
        {creatingLink?.projectId === projectId && creatingLink?.folderId === f.id && (
          <div style={{ marginRight: ((depth + 1) * 1.2 + 0.5) + "rem", padding: "0.3rem 0.5rem", display: "flex", flexDirection: "column", gap: "0.3rem" }}>
            <input value={newLinkName} onChange={e => setNewLinkName(e.target.value)}
              placeholder="اسم الرابط"
              onKeyDown={e => e.key === "Enter" && void handleAddLink()}
              style={{ width: "100%", padding: "0.35rem 0.6rem", borderRadius: "6px", border: "1px solid " + "var(--app-accent)", fontSize: "1rem", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
            <input value={newLinkUrl} onChange={e => setNewLinkUrl(e.target.value)}
              placeholder="https://..." dir="ltr"
              onKeyDown={e => e.key === "Enter" && void handleAddLink()}
              style={{ width: "100%", padding: "0.35rem 0.6rem", borderRadius: "6px", border: "1px solid " + "var(--app-border)", fontSize: "1rem", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
            <div style={{ display: "flex", gap: "0.3rem" }}>
              <button onClick={handleAddLink} style={{ ...btnIcon, fontSize: "0.95rem", color: "#fff", background: "var(--app-accent)", padding: "0.3rem 0.7rem", borderRadius: "6px" }}>حفظ</button>
              <button onClick={() => setCreatingLink(null)} style={{ ...btnIcon, fontSize: "0.95rem", color: "var(--app-muted)", padding: "0.3rem 0.7rem" }}>إلغاء</button>
            </div>
          </div>
        )}
        {creatingNote?.projectId === projectId && creatingNote?.folderId === f.id && (
          <div style={{ marginRight: ((depth + 1) * 1.2 + 0.5) + "rem", padding: "0.3rem 0.5rem", display: "flex", flexDirection: "column", gap: "0.3rem" }}>
            <input value={newNoteName} onChange={e => setNewNoteName(e.target.value)}
              placeholder="عنوان الملاحظة"
              style={{ width: "100%", padding: "0.35rem 0.6rem", borderRadius: "6px", border: "1px solid " + "var(--app-accent)", fontSize: "1rem", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
            <textarea value={newNoteContent} onChange={e => setNewNoteContent(e.target.value)}
              placeholder="محتوى الملاحظة..." rows={3}
              style={{ width: "100%", padding: "0.35rem 0.6rem", borderRadius: "6px", border: "1px solid " + "var(--app-border)", fontSize: "1rem", outline: "none", fontFamily: "inherit", boxSizing: "border-box", resize: "vertical" }} />
            <div style={{ display: "flex", gap: "0.3rem" }}>
              <button onClick={handleAddNote} style={{ ...btnIcon, fontSize: "0.95rem", color: "#fff", background: "var(--app-accent)", padding: "0.3rem 0.7rem", borderRadius: "6px" }}>حفظ</button>
              <button onClick={() => setCreatingNote(null)} style={{ ...btnIcon, fontSize: "0.95rem", color: "var(--app-muted)", padding: "0.3rem 0.7rem" }}>إلغاء</button>
            </div>
          </div>
        )}
        {expanded && (
          <>
            {children.map(ch => renderFolder(ch, projectId, depth + 1))}
            {sessions.map(s => renderSession(s, projectId, depth + 1))}
            {bookmarks.map(b => renderBookmark(b, projectId, depth + 1))}
          </>
        )}
      </div>
    );
  }

  function renderProject(p: Project) {
    const expanded = isExpanded(p.id);
    const loading = loadingProjects.has(p.id);
    const isDragOver = dragOverProjectId === p.id && dragOverFolderId === null;
    const rootSessions = getSessions(p.id, null);
    const rootBookmarks = getBookmarks(p.id, null);
    const rootFolders = getChildFolders(p.id, null);

    return (
      <div key={p.id}>
        <div
          onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY, id: p.id, type: "project" }); }}
          onDrop={(e) => { e.preventDefault(); void handleDrop(p.id, null); }}
          onDragOver={(e) => { e.preventDefault(); setDragOverProjectId(p.id); setDragOverFolderId(null); }}
          onDragLeave={() => setDragOverProjectId(null)}
          style={{
            ...rowStyle(0, false, isDragOver),
            fontWeight: 600, color: "var(--app-text)",
          }}
          onMouseOver={e => { if (!isDragOver) e.currentTarget.style.background = "var(--app-muted-light)"; }}
          onMouseOut={e => { if (!isDragOver) e.currentTarget.style.background = "transparent"; }}
        >
          {editingItem?.id === p.id ? (
            <input ref={editInputRef} value={editingItem.name}
              onChange={e => setEditingItem({ ...editingItem, name: e.target.value })}
              onKeyDown={e => { if (e.key === "Enter") void handleRename(); if (e.key === "Escape") setEditingItem(null); }}
              onBlur={() => void handleRename()}
              onClick={e => e.stopPropagation()}
              style={{ flex: 1, fontSize: "1rem", padding: "0.3rem 0.5rem", borderRadius: "6px", border: "1px solid " + "var(--app-accent)", outline: "none", fontFamily: "inherit", background: "var(--app-card)", color: "var(--app-text)" }}
            />
          ) : (
            <>
              <span
                onClick={(e) => { e.stopPropagation(); void toggleProject(p.id); }}
                style={{ ...iconStyle("1.05rem"), color: "var(--app-muted)", cursor: "pointer", transition: "transform 0.15s", transform: expanded ? "rotate(90deg)" : "" }}
              >
                ▸
              </span>
              <span style={iconStyle()}>📁</span>
              <span onDoubleClick={() => setEditingItem({ id: p.id, type: "project", name: p.name })}
                style={nodeNameStyle}>
                {p.name}
              </span>
              {loading && <span style={{ fontSize: "1.1rem", color: "var(--app-muted)" }}>⏳</span>}
              <div style={{ position: "relative" }}>
                <button onClick={(e) => { e.stopPropagation(); setShowAddMenu(prev => { if (prev && prev.projectId === p.id && prev.folderId === null) return null; return { projectId: p.id, folderId: null }; }); }}
                  style={{ ...btnIcon, fontSize: "1.1rem", color: "var(--app-muted)", padding: "4px 8px" }}>+</button>
                {showAddMenu?.projectId === p.id && showAddMenu?.folderId === null && (
                  <div ref={addMenuRef} style={addMenuStyle} onClick={e => e.stopPropagation()}>
                    <button style={contextItemStyle}
                      onMouseOver={e => e.currentTarget.style.background = "var(--app-muted-light)"}
                      onMouseOut={e => e.currentTarget.style.background = "none"}
                      onClick={() => { setShowAddMenu(null); setCreatingFolder({ projectId: p.id, parentId: null }); setNewFolderName(""); }}>📁 مجلد جديد</button>
                    <button style={contextItemStyle}
                      onMouseOver={e => e.currentTarget.style.background = "var(--app-muted-light)"}
                      onMouseOut={e => e.currentTarget.style.background = "none"}
                      onClick={() => { setShowAddMenu(null); navigate("/upload?projectId=" + p.id); onClose(); }}>📄 رفع ملف</button>
                    <button style={contextItemStyle}
                      onMouseOver={e => e.currentTarget.style.background = "var(--app-muted-light)"}
                      onMouseOut={e => e.currentTarget.style.background = "none"}
                      onClick={() => { setShowAddMenu(null); setCreatingLink({ projectId: p.id, folderId: null }); setNewLinkName(""); setNewLinkUrl(""); }}>🔗 إضافة رابط</button>
                    <button style={contextItemStyle}
                      onMouseOver={e => e.currentTarget.style.background = "var(--app-muted-light)"}
                      onMouseOut={e => e.currentTarget.style.background = "none"}
                      onClick={() => { setShowAddMenu(null); setCreatingNote({ projectId: p.id, folderId: null }); setNewNoteName(""); setNewNoteContent(""); }}>📝 إضافة نص</button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
        {creatingFolder?.projectId === p.id && creatingFolder?.parentId === null && (
          <div style={{ marginRight: "1.2rem", padding: "0.3rem 0.5rem" }}>
            <input ref={newFolderRef} value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") void handleCreateFolder(); if (e.key === "Escape") { setCreatingFolder(null); setNewFolderName(""); } }}
              placeholder="اسم المجلد"
              style={{ width: "100%", padding: "0.4rem 0.6rem", borderRadius: "6px", border: "1px solid " + "var(--app-border)", fontSize: "1rem", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
            />
          </div>
        )}
        {creatingLink?.projectId === p.id && creatingLink?.folderId === null && (
          <div style={{ marginRight: "1.2rem", padding: "0.3rem 0.5rem", display: "flex", flexDirection: "column", gap: "0.3rem" }}>
            <input value={newLinkName} onChange={e => setNewLinkName(e.target.value)}
              placeholder="اسم الرابط"
              onKeyDown={e => e.key === "Enter" && void handleAddLink()}
              style={{ width: "100%", padding: "0.35rem 0.6rem", borderRadius: "6px", border: "1px solid " + "var(--app-accent)", fontSize: "1rem", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
            <input value={newLinkUrl} onChange={e => setNewLinkUrl(e.target.value)}
              placeholder="https://..." dir="ltr"
              onKeyDown={e => e.key === "Enter" && void handleAddLink()}
              style={{ width: "100%", padding: "0.35rem 0.6rem", borderRadius: "6px", border: "1px solid " + "var(--app-border)", fontSize: "1rem", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
            <div style={{ display: "flex", gap: "0.3rem" }}>
              <button onClick={handleAddLink} style={{ ...btnIcon, fontSize: "0.95rem", color: "#fff", background: "var(--app-accent)", padding: "0.3rem 0.7rem", borderRadius: "6px" }}>حفظ</button>
              <button onClick={() => setCreatingLink(null)} style={{ ...btnIcon, fontSize: "0.95rem", color: "var(--app-muted)", padding: "0.3rem 0.7rem" }}>إلغاء</button>
            </div>
          </div>
        )}
        {creatingNote?.projectId === p.id && creatingNote?.folderId === null && (
          <div style={{ marginRight: "1.2rem", padding: "0.3rem 0.5rem", display: "flex", flexDirection: "column", gap: "0.3rem" }}>
            <input value={newNoteName} onChange={e => setNewNoteName(e.target.value)}
              placeholder="عنوان الملاحظة"
              style={{ width: "100%", padding: "0.35rem 0.6rem", borderRadius: "6px", border: "1px solid " + "var(--app-accent)", fontSize: "1rem", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
            <textarea value={newNoteContent} onChange={e => setNewNoteContent(e.target.value)}
              placeholder="محتوى الملاحظة..." rows={3}
              style={{ width: "100%", padding: "0.35rem 0.6rem", borderRadius: "6px", border: "1px solid " + "var(--app-border)", fontSize: "1rem", outline: "none", fontFamily: "inherit", boxSizing: "border-box", resize: "vertical" }} />
            <div style={{ display: "flex", gap: "0.3rem" }}>
              <button onClick={handleAddNote} style={{ ...btnIcon, fontSize: "0.95rem", color: "#fff", background: "var(--app-accent)", padding: "0.3rem 0.7rem", borderRadius: "6px" }}>حفظ</button>
              <button onClick={() => setCreatingNote(null)} style={{ ...btnIcon, fontSize: "0.95rem", color: "var(--app-muted)", padding: "0.3rem 0.7rem" }}>إلغاء</button>
            </div>
          </div>
        )}
        {expanded && (
          <>
            {rootFolders.map(f => renderFolder(f, p.id, 1))}
            {rootSessions.map(s => renderSession(s, p.id, 1))}
            {rootBookmarks.map(b => renderBookmark(b, p.id, 1))}
            {!loading && cache[p.id] && rootFolders.length === 0 && rootSessions.length === 0 && rootBookmarks.length === 0 && (
              <p style={{ margin: "0.3rem 2.5rem", fontSize: "1rem", color: "var(--app-muted)" }}>فارغ</p>
            )}
          </>
        )}
      </div>
    );
  }

  const filteredProjects = projects.filter(p => !searchQuery.trim() || matchesSearch(p.name) || anyChildMatches(p.id, null));

  return (
    <>
      <div style={overlayStyle} onClick={onClose} />
      <div style={panelStyle} onClick={() => { setContextMenu(null); setShowAddMenu(null); }} dir="rtl">
        <div style={headerStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "1.5rem" }}>📁</span>
            <span style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--app-text)" }}>الملفات</span>
          </div>
          <div style={{ display: "flex", gap: "2px" }}>
            <button onClick={() => setCreatingProject(true)}
              style={{ ...btnIcon, fontWeight: 700 }} title="مشروع جديد">+</button>
            <button onClick={onClose} style={{ ...btnIcon, color: "var(--app-muted)" }} title="إغلاق">✕</button>
          </div>
        </div>

        <div style={{ padding: "0.6rem 1rem" }}>
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="🔍 بحث..."
            style={{ width: "100%", padding: "0.7rem 0.9rem", borderRadius: "8px", border: "1px solid " + "var(--app-border)", fontSize: "1rem", outline: "none", fontFamily: "inherit", boxSizing: "border-box", direction: "rtl" }}
          />
        </div>

        {creatingProject && (
          <div style={{ padding: "0.4rem 1rem" }}>
            <input ref={newProjectRef} value={newProjectName}
              onChange={e => setNewProjectName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") void handleCreateProject(); if (e.key === "Escape") { setCreatingProject(false); setNewProjectName(""); } }}
              placeholder="اسم المشروع"
              style={{ width: "100%", padding: "0.5rem 0.8rem", borderRadius: "6px", border: "1px solid " + "var(--app-accent)", fontSize: "1rem", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
            />
          </div>
        )}

        <div style={treeStyle}>
          {initialLoading ? (
            <p style={{ textAlign: "center", color: "var(--app-muted)", fontSize: "1rem", padding: "2rem 1rem", margin: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
              <span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>⏳</span> جاري التحميل...
            </p>
          ) : filteredProjects.length === 0 ? (
            <p style={{ textAlign: "center", color: "var(--app-muted)", fontSize: "1rem", padding: "2rem 1rem", margin: 0 }}>
              {searchQuery.trim() ? "لا نتائج" : "ما عندك مشاريع إلى الآن"}
            </p>
          ) : (
            filteredProjects.map(p => renderProject(p))
          )}
        </div>

        {contextMenu && (
          <div style={{ ...contextMenuStyle, top: contextMenu.y, left: contextMenu.x }}
            onClick={e => e.stopPropagation()}>
            <button style={contextItemStyle}
              onMouseOver={e => e.currentTarget.style.background = "var(--app-muted-light)"}
              onMouseOut={e => e.currentTarget.style.background = "none"}
              onClick={() => {
                const ctx = contextMenu;
                const item = ctx.type === "project"
                  ? projects.find(p => p.id === ctx.id)
                  : ctx.type === "folder"
                  ? (() => {
                    const pid = projects.find(p => cache[p.id]?.folders.some((f: Folder) => f.id === ctx.id))?.id;
                    return pid ? getFolders(pid).find(f => f.id === ctx.id) : undefined;
                  })()
                  : ctx.type === "bookmark"
                  ? (() => {
                    const found = Object.entries(cache).find(([, v]) => v.bookmarks.some(b => b.id === ctx.id));
                    return found ? found[1].bookmarks.find(b => b.id === ctx.id) : undefined;
                  })()
                  : (() => {
                    const found = Object.entries(cache).find(([, v]) => v.sessions.some(s => s.id === ctx.id));
                    return found ? found[1].sessions.find(s => s.id === ctx.id) : undefined;
                  })();
                if (item) setEditingItem({ id: ctx.id, type: ctx.type, name: "name" in item ? item.name : "fileName" in item ? (item as StoredSession).fileName : "" });
                setContextMenu(null);
              }}>
              ✏️ إعادة تسمية
            </button>
            <button style={contextItemStyle}
              onMouseOver={e => e.currentTarget.style.background = "var(--app-muted-light)"}
              onMouseOut={e => e.currentTarget.style.background = "none"}
              onClick={() => {
                const ctx = contextMenu;
                setContextMenu(null);
                if (ctx.type === "project") void handleDelete(ctx.id, "project");
                else if (ctx.type === "folder") {
                  const found = Object.entries(cache).find(([, v]) => v.folders.some(f => f.id === ctx.id));
                  void handleDelete(ctx.id, "folder", found?.[0]);
                } else if (ctx.type === "bookmark") {
                  const found = Object.entries(cache).find(([, v]) => v.bookmarks.some(b => b.id === ctx.id));
                  if (found) void handleDeleteBookmark(ctx.id, found[0]);
                } else {
                  const found = Object.entries(cache).find(([, v]) => v.sessions.some(s => s.id === ctx.id));
                  if (found) void handleDelete(ctx.id, "session", found[0]);
                }
              }}>
              🗑 حذف
            </button>
          </div>
        )}
      </div>
    </>
  );
}
