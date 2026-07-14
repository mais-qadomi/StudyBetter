import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { Folder as FolderIcon, FolderOpen, FileText, Plus, X, ChevronLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import {
    apiGetProjects,
    apiCreateProject,
    apiDeleteProject,
    apiGetProject,
    apiCreateFolder,
    apiDeleteFolder,
    apiAssignSessionToFolder,
    apiReorderFolders,
    type Project,
    type StoredSession,
    type Folder,
} from "../lib/storage";

const C = {
    bg: "var(--app-bg-alt)",
    cardBg: "var(--app-card)",
    cardBorder: "var(--app-border)",
    accent: "var(--app-accent)",
    accentLight: "var(--app-accent-light)",
    accentBg: "var(--app-accent-bg)",
    title: "var(--app-text)",
    text: "var(--app-text)",
    muted: "var(--app-muted)",
    green: "var(--app-green)",
    red: "var(--app-red)",
    folderIcon: "var(--app-icon-folder)",
    fileIcon: "var(--app-icon-file)",
    shadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
    shadowLg: "0 4px 6px rgba(0,0,0,0.05), 0 10px 15px rgba(0,0,0,0.05)",
};

type ProjectData = {
    project: Project;
    sessions: StoredSession[];
    folders: Folder[];
};

export default function ProjectsPage() {
    const [, navigate] = useLocation();
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [newName, setNewName] = useState("");
    const [newDesc, setNewDesc] = useState("");
    const [creating, setCreating] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [selectedData, setSelectedData] = useState<ProjectData | null>(null);
    const [loadingProject, setLoadingProject] = useState(false);
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
    const [activeNewFolder, setActiveNewFolder] = useState<string | null>(null);
    const [newFolderName, setNewFolderName] = useState("");
    const [dragFolder, setDragFolder] = useState<string | null>(null);
    const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);
    const [dragSession, setDragSession] = useState<{ id: string; folderId: string | null } | null>(null);
    const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);
    const newFolderRef = useRef<HTMLInputElement>(null);
    const ROOT_KEY = "__root__";

    useEffect(() => { void loadProjects(); }, []);

    async function loadProjects() {
        setLoading(true);
        const data = await apiGetProjects();
        setProjects(data);
        setLoading(false);
    }

    async function handleCreate() {
        if (!newName.trim()) return;
        setCreating(true);
        const created = await apiCreateProject(newName.trim(), newDesc.trim() || undefined);
        if (created) {
            setProjects(p => [...p, created]);
            setNewName(""); setNewDesc(""); setShowForm(false);
        }
        setCreating(false);
    }

    async function handleDeleteProject(id: string) {
        if (!confirm("تأكيد حذف المشروع؟")) return;
        await apiDeleteProject(id);
        setProjects(p => p.filter(x => x.id !== id));
        if (selectedData?.project.id === id) setSelectedData(null);
    }

    async function openProject(project: Project) {
        setLoadingProject(true);
        setSelectedData(null);
        const data = await apiGetProject(project.id) as ProjectData | null;
        if (data) {
            const sorted = (data.folders ?? []).sort((a, b) => a.order - b.order);
            setSelectedData({ ...data, folders: sorted });
            setExpandedFolders(new Set(sorted.filter(f => !f.parentFolderId).map(f => f.id)));
        }
        setLoadingProject(false);
    }

    function sortedFolders(list: Folder[]): Folder[] {
        return [...list].sort((a, b) => a.order - b.order);
    }

    function getRootFolders(): Folder[] {
        return sortedFolders(selectedData?.folders ?? []).filter(f => !f.parentFolderId);
    }

    function getChildFolders(parentId: string): Folder[] {
        return sortedFolders(selectedData?.folders ?? []).filter(f => f.parentFolderId === parentId);
    }

    function getSessionsInFolder(folderId: string | null): StoredSession[] {
        return (selectedData?.sessions ?? []).filter(s => s.folderId === folderId);
    }

    function hasSubFolders(folderId: string): boolean {
        return (selectedData?.folders ?? []).some(f => f.parentFolderId === folderId);
    }

    const toggleFolder = useCallback((id: string) => {
        setExpandedFolders(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    }, []);

    async function handleCreateFolder(name: string, parentId: string | null) {
        if (!selectedData || !name.trim()) return;
        try {
            const created = await apiCreateFolder(name.trim(), selectedData.project.id, parentId);
            if (created) {
                setSelectedData(prev => prev ? {
                    ...prev,
                    folders: sortedFolders([...(prev.folders ?? []), created]),
                } : prev);
                setExpandedFolders(prev => {
                    const n = new Set(prev); n.add(created.id);
                    if (parentId) n.add(parentId); return n;
                });
            } else {
                alert("فشل إنشاء المجلد — تأكدي من إعادة تشغيل السيرفر");
            }
        } catch (e) {
            alert("خطأ: " + (e instanceof Error ? e.message : "غير معروف"));
        }
    }

    async function handleDeleteFolder(id: string) {
        if (!confirm("حذف المجلد؟ الملفات تفضل موجودة.")) return;
        await apiDeleteFolder(id);
        setSelectedData(prev => prev ? { ...prev, folders: sortedFolders(prev.folders.filter(f => f.id !== id)) } : prev);
    }

    async function moveSession(sessionId: string, folderId: string | null) {
        try {
            await apiAssignSessionToFolder(sessionId, folderId);
            setSelectedData(prev => prev ? {
                ...prev,
                sessions: prev.sessions.map(s => s.id === sessionId ? { ...s, folderId } : s),
            } : prev);
        } catch {
            // ignore API errors — state stays consistent
        }
    }

    async function moveFolder(folderId: string, newParentId: string | null) {
        const f = selectedData?.folders.find(x => x.id === folderId);
        if (!f) return;
        await apiCreateFolder(f.name, f.projectId, newParentId);
        await apiDeleteFolder(folderId);
        const data = await apiGetProject(f.projectId) as ProjectData | null;
        if (data) {
            setSelectedData(prev => prev ? { ...prev, folders: sortedFolders(data.folders) } : prev);
        }
    }

    async function reorderFolders(folderIds: string[]) {
        await apiReorderFolders(folderIds);
        const data = selectedData;
        if (data) {
            const updated = await apiGetProject(data.project.id) as ProjectData | null;
            if (updated) {
                setSelectedData(prev => prev ? { ...prev, folders: sortedFolders(updated.folders) } : prev);
            }
        }
    }

    // === Drag & Drop for folders (reorder) ===
    const handleFolderDragStart = useCallback((id: string) => {
        setDragFolder(id);
    }, []);

    const handleFolderDragOver = useCallback((e: React.DragEvent, id: string) => {
        e.preventDefault(); e.stopPropagation();
        setDragOverFolder(id);
    }, []);

    const handleFolderDragLeave = useCallback(() => {
        setDragOverFolder(null);
    }, []);

    const handleFolderDrop = useCallback(async (e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        setDragOverFolder(null);
        setDragOverTarget(null);
        if (dragFolder && dragFolder !== targetId) {
            const folderIds = sortedFolders(selectedData?.folders ?? []).filter(f => !f.parentFolderId).map(f => f.id);
            const fromIdx = folderIds.indexOf(dragFolder);
            const toIdx = folderIds.indexOf(targetId);
            if (fromIdx !== -1 && toIdx !== -1) {
                folderIds.splice(fromIdx, 1);
                folderIds.splice(toIdx, 0, dragFolder);
                await reorderFolders(folderIds);
            }
        } else if (dragSession) {
            await moveSession(dragSession.id, targetId);
        }
        setDragFolder(null);
        setDragSession(null);
    }, [dragFolder, dragSession, selectedData]);

    // === Drag & Drop for sessions ===
    const handleSessionDragStart = useCallback((id: string, folderId: string | null) => {
        setDragSession({ id, folderId });
    }, []);

    const handleSessionDrop = useCallback(async (e: React.DragEvent, targetFolderId: string | null) => {
        e.preventDefault();
        setDragOverTarget(null);
        try {
            if (dragSession) {
                await moveSession(dragSession.id, targetFolderId);
            }
        } finally {
            setDragSession(null);
        }
    }, [dragSession]);

    // === Styles ===
    const pageStyle: React.CSSProperties = {
        minHeight: "100vh", background: C.bg,
        fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
        padding: "2rem 1rem", boxSizing: "border-box", color: C.text,
    };

    const cardStyle: React.CSSProperties = {
        background: C.cardBg, border: "1px solid " + C.cardBorder,
        borderRadius: "14px", boxShadow: C.shadow,
    };

    function BtnPrimary({ children, onClick, small }: { children: React.ReactNode; onClick: () => void; small?: boolean }) {
        return (
            <button onClick={onClick} style={{
                background: C.accent, color: "#fff", border: "none",
                borderRadius: "8px", padding: small ? "0.35rem 0.8rem" : "0.45rem 1rem",
                fontSize: small ? "0.78rem" : "0.85rem", cursor: "pointer",
                fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "5px",
                transition: "all 0.15s",
            }}
                onMouseOver={e => { e.currentTarget.style.background = "var(--app-accent-hover)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                onMouseOut={e => { e.currentTarget.style.background = C.accent; e.currentTarget.style.transform = ""; }}
            >{children}</button>
        );
    }

    function BtnGhost({ children, onClick, color }: { children: React.ReactNode; onClick: () => void; color?: string }) {
        return (
            <button onClick={onClick} style={{
                background: "transparent", border: "1px solid " + C.cardBorder,
                color: color || C.text, borderRadius: "8px",
                padding: "0.35rem 0.8rem", fontSize: "0.78rem", cursor: "pointer",
                fontWeight: 500, display: "inline-flex", alignItems: "center", gap: "4px",
                transition: "all 0.15s",
            }}
                onMouseOver={e => { e.currentTarget.style.background = C.accentBg; }}
                onMouseOut={e => { e.currentTarget.style.background = "transparent"; }}
            >{children}</button>
        );
    }

    function FolderRow({ folder, depth }: { folder: Folder; depth: number }) {
        const expanded = expandedFolders.has(folder.id);
        const children = getChildFolders(folder.id);
        const sessions = getSessionsInFolder(folder.id);
        const isDragOver = dragOverTarget === folder.id;
        const isDragging = dragFolder === folder.id;

        return (
            <div>
                <div
                    draggable
                    onDragStart={() => handleFolderDragStart(folder.id)}
                    onDragOver={e => handleFolderDragOver(e, folder.id)}
                    onDragLeave={handleFolderDragLeave}
                    onDrop={e => void handleFolderDrop(e, folder.id)}
                    style={{
                        display: "flex", alignItems: "center", gap: "6px",
                        padding: "0.45rem 0.7rem", borderRadius: "8px",
                        marginRight: (depth * 1.4) + "rem",
                        background: isDragOver ? C.accentBg : isDragging ? C.accentBg + "80" : expanded ? C.accentBg + "40" : "transparent",
                        border: isDragOver ? "2px dashed " + C.accentLight : "2px solid transparent",
                        cursor: "grab", opacity: isDragging ? 0.5 : 1,
                        transition: "all 0.15s",
                    }}
                    onMouseOver={e => { if (!isDragging && !isDragOver) e.currentTarget.style.background = "var(--app-bg-alt)"; }}
                    onMouseOut={e => { if (!isDragging && !isDragOver && !expanded) e.currentTarget.style.background = "transparent"; if (!isDragging && !isDragOver && expanded) e.currentTarget.style.background = C.accentBg + "40"; }}
                    onDragEnd={() => setDragFolder(null)}
                >
                    <span onClick={(e) => { e.stopPropagation(); toggleFolder(folder.id); }}
                        style={{ width: "18px", flexShrink: 0, textAlign: "center", color: C.muted, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                        {(children.length > 0 || sessions.length > 0) ? <ChevronLeft size={18} style={{ transform: expanded ? "rotate(90deg)" : "", transition: "transform 0.15s" }} /> : "•"}
                    </span>
                    <span style={{ flexShrink: 0, fontSize: "1.1rem", lineHeight: 1, display: "inline-flex", alignItems: "center" }}>{expanded ? <FolderOpen size={18} /> : <FolderIcon size={18} />}</span>
                    <span style={{ flex: 1, fontSize: "0.85rem", fontWeight: 600, color: C.title }}>{folder.name}</span>
                    <span style={{ fontSize: "0.7rem", color: C.muted, background: "var(--app-bg-alt)", padding: "1px 8px", borderRadius: "8px" }}>
                        {sessions.length}
                    </span>
                    <BtnGhost onClick={() => { setActiveNewFolder(folder.id); setNewFolderName(""); setTimeout(() => newFolderRef.current?.focus(), 50); }}><Plus size={18} /></BtnGhost>
                    <BtnGhost onClick={() => void handleDeleteFolder(folder.id)} color={C.red}><X size={18} /></BtnGhost>
                </div>

                {activeNewFolder === folder.id && (
                    <div style={{ marginRight: ((depth + 1) * 1.4) + "rem", marginTop: "4px", marginBottom: "4px", padding: "0 0.5rem" }}>
                        <input ref={newFolderRef} value={newFolderName}
                            onChange={e => setNewFolderName(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === "Enter" && newFolderName.trim()) { void handleCreateFolder(newFolderName.trim(), folder.id); setNewFolderName(""); setActiveNewFolder(null); }
                                if (e.key === "Escape") { setActiveNewFolder(null); setNewFolderName(""); }
                            }}
                            placeholder="اسم المجلد"
                            style={{ width: "100%", padding: "0.35rem 0.6rem", borderRadius: "6px", border: "1px solid " + C.cardBorder, fontSize: "0.8rem", outline: "none", fontFamily: "inherit", background: C.cardBg, color: C.text, boxSizing: "border-box" }}
                        />
                    </div>
                )}

                {expanded && (
                    <div>
                        {sessions.map(s => (
                            <div key={s.id} draggable
                                onDragStart={() => handleSessionDragStart(s.id, folder.id)}
                                onDragOver={e => { e.preventDefault(); setDragOverTarget(folder.id); }}
                                onDragLeave={() => setDragOverTarget(null)}
                                onDrop={e => void handleSessionDrop(e, folder.id)}
                                onDragEnd={() => { setDragSession(null); setDragOverTarget(null); }}
                                onClick={() => navigate("/upload/" + s.id)}
                                style={{
                                    display: "flex", alignItems: "center", gap: "6px", cursor: "pointer",
                                    padding: "0.35rem 0.7rem", borderRadius: "6px",
                                    marginRight: ((depth + 1) * 1.4) + "rem",
                                    opacity: dragSession?.id === s.id ? 0.4 : 1,
                                    transition: "background 0.15s",
                                }}
                                onMouseOver={e => e.currentTarget.style.background = "var(--app-bg-alt)"}
                                onMouseOut={e => e.currentTarget.style.background = "transparent"}
                            >
                                <span style={{ width: "18px", flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center" }}><FileText size={18} /></span>
                                <span style={{ flex: 1, fontSize: "0.82rem", color: C.text }}>{s.fileName}</span>
                                <span style={{ fontSize: "0.68rem", color: C.muted, background: "var(--app-bg-alt)", padding: "1px 6px", borderRadius: "6px" }}>{s.numPages} ص</span>
                                <select value={folder.id} onChange={e => { e.stopPropagation(); void moveSession(s.id, e.target.value || null); }}
                                    onClick={e => e.stopPropagation()}
                                    style={{ fontSize: "0.68rem", padding: "1px 4px", border: "1px solid " + C.cardBorder, borderRadius: "4px", background: C.cardBg, color: C.muted, outline: "none" }}>
                                    <option value="">جذر</option>
                                    {sortedFolders(selectedData?.folders ?? []).map(f => (
                                        <option key={f.id} value={f.id}>{f.name}</option>
                                    ))}
                                </select>
                            </div>
                        ))}
                        {children.map(ch => <FolderRow key={ch.id} folder={ch} depth={depth + 1} />)}
                    </div>
                )}
            </div>
        );
    }

    const rootFolders = getRootFolders();
    const rootSessions = getSessionsInFolder(null);

    return (
        <div dir="rtl" style={pageStyle}>
            <div style={{ maxWidth: "900px", margin: "0 auto" }}>
                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
                    <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700, color: C.title }}>
                        {selectedData ? <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}><FolderIcon size={22} /> {selectedData.project.name}</span> : <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}><FolderIcon size={22} /> مشاريعي</span>}
                    </h1>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                        {selectedData && <BtnGhost onClick={() => setSelectedData(null)}><span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}><ArrowRight size={18} /> رجوع</span></BtnGhost>}
                        <BtnPrimary onClick={() => setShowForm(s => !s)}><span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}><Plus size={18} /> مشروع جديد</span></BtnPrimary>
                        <BtnGhost onClick={() => navigate("/")}>الرئيسية</BtnGhost>
                    </div>
                </div>

                {/* Create form */}
                {showForm && !selectedData && (
                    <div style={{ ...cardStyle, padding: "1.5rem", marginBottom: "1.5rem" }}>
                        <h3 style={{ margin: "0 0 1rem", fontSize: "1rem", fontWeight: 600, color: C.title }}>إنشاء مشروع جديد</h3>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                            <input value={newName} onChange={e => setNewName(e.target.value)}
                                onKeyDown={e => e.key === "Enter" && void handleCreate()}
                                placeholder="اسم المشروع"
                                style={{ padding: "0.6rem 1rem", borderRadius: "8px", border: "1px solid " + C.cardBorder, fontSize: "0.85rem", fontFamily: "inherit", outline: "none", direction: "rtl" }} />
                            <input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="وصف اختياري"
                                style={{ padding: "0.6rem 1rem", borderRadius: "8px", border: "1px solid " + C.cardBorder, fontSize: "0.85rem", fontFamily: "inherit", outline: "none", direction: "rtl" }} />
                            <div style={{ display: "flex", gap: "0.5rem" }}>
                                <BtnPrimary onClick={() => void handleCreate()}>{creating ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} إنشاء</BtnPrimary>
                                <BtnGhost onClick={() => setShowForm(false)}>إلغاء</BtnGhost>
                            </div>
                        </div>
                    </div>
                )}

                {/* Project detail */}
                {selectedData ? (
                    <div style={cardStyle}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1rem 1.2rem", borderBottom: "1px solid " + C.cardBorder }}>
                            <div>
                                {selectedData.project.description && <p style={{ margin: 0, fontSize: "0.82rem", color: C.muted }}>{selectedData.project.description}</p>}
                                <p style={{ margin: "0.15rem 0 0", fontSize: "0.75rem", color: C.muted }}>
                                    {(selectedData.folders ?? []).length} مجلد • {(selectedData.sessions ?? []).length} ملف
                                </p>
                            </div>
                            <div style={{ display: "flex", gap: "0.4rem" }}>
                                <BtnPrimary onClick={() => { setActiveNewFolder(ROOT_KEY); setNewFolderName(""); setTimeout(() => newFolderRef.current?.focus(), 50); }} small><span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}><Plus size={18} /> مجلد</span></BtnPrimary>
                                <BtnPrimary onClick={() => navigate("/upload?projectId=" + selectedData.project.id)} small><span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}><Plus size={18} /> رفع ملف</span></BtnPrimary>
                                <BtnGhost onClick={() => void handleDeleteProject(selectedData.project.id)} color={C.red}>حذف</BtnGhost>
                            </div>
                        </div>

                        {/* Root folder input */}
                        {activeNewFolder === ROOT_KEY && (
                            <div style={{ padding: "0.8rem 1.2rem", borderBottom: "1px solid " + C.cardBorder }}>
                                <input ref={newFolderRef} value={newFolderName}
                                    onChange={e => setNewFolderName(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === "Enter" && newFolderName.trim()) { void handleCreateFolder(newFolderName.trim(), null); setNewFolderName(""); setActiveNewFolder(null); }
                                        if (e.key === "Escape") { setActiveNewFolder(null); setNewFolderName(""); }
                                    }}
                                    placeholder="اسم المجلد الجديد"
                                    style={{ width: "100%", padding: "0.4rem 0.7rem", borderRadius: "6px", border: "1px solid " + C.cardBorder, fontSize: "0.82rem", outline: "none", fontFamily: "inherit", background: C.cardBg, color: C.text, boxSizing: "border-box" }}
                                />
                            </div>
                        )}

                        {/* Content */}
                        {loadingProject ? (
                            <p style={{ textAlign: "center", color: C.muted, padding: "2rem", margin: 0 }}><span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}><Loader2 size={16} className="animate-spin" /> جاري التحميل…</span></p>
                        ) : rootFolders.length === 0 && rootSessions.length === 0 ? (
                            <div style={{ textAlign: "center", padding: "2.5rem 1rem" }}>
                                <p style={{ fontSize: "2rem", margin: "0 0 0.5rem", opacity: 0.3, display: "inline-flex", alignItems: "center", justifyContent: "center", width: "100%" }}><FolderOpen size={48} /></p>
                                <p style={{ color: C.muted, fontSize: "0.85rem", margin: 0 }}>لا يوجد ملفات أو مجلدات</p>
                            </div>
                        ) : (
                            <div style={{ padding: "0.5rem 0" }}>
                                {/* Root sessions */}
                                <div onDragOver={e => { e.preventDefault(); setDragOverTarget(null); }}
                                    onDrop={e => void handleSessionDrop(e, null)}
                                    style={{ border: dragOverTarget === null && dragSession ? "2px dashed " + C.accentLight : "2px solid transparent", borderRadius: "8px", minHeight: "10px", transition: "all 0.15s" }}>
                                    {rootSessions.map(s => (
                                        <div key={s.id} draggable
                                            onDragStart={() => handleSessionDragStart(s.id, null)}
                                            onDragOver={e => { e.preventDefault(); setDragOverTarget(null); }}
                                            onDragLeave={() => setDragOverTarget(null)}
                                            onDrop={e => void handleSessionDrop(e, null)}
                                            onDragEnd={() => { setDragSession(null); setDragOverTarget(null); }}
                                            onClick={() => navigate("/upload/" + s.id)}
                                            style={{
                                                display: "flex", alignItems: "center", gap: "6px", cursor: "pointer",
                                                padding: "0.35rem 0.7rem", borderRadius: "6px",
                                                marginRight: "0.5rem",
                                                opacity: dragSession?.id === s.id ? 0.4 : 1,
                                                transition: "background 0.15s",
                                            }}
                                            onMouseOver={e => e.currentTarget.style.background = "var(--app-bg-alt)"}
                                            onMouseOut={e => e.currentTarget.style.background = "transparent"}
                                        >
                                            <span style={{ width: "18px", flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center" }}><FileText size={18} /></span>
                                            <span style={{ flex: 1, fontSize: "0.82rem", color: C.text }}>{s.fileName}</span>
                                            <span style={{ fontSize: "0.68rem", color: C.muted, background: "var(--app-bg-alt)", padding: "1px 6px", borderRadius: "6px" }}>{s.numPages} ص</span>
                                            <select value="" onChange={e => { e.stopPropagation(); void moveSession(s.id, e.target.value || null); }}
                                                onClick={e => e.stopPropagation()}
                                                style={{ fontSize: "0.68rem", padding: "1px 4px", border: "1px solid " + C.cardBorder, borderRadius: "4px", background: C.cardBg, color: C.muted, outline: "none" }}>
                                                <option value="">جذر</option>
                                                {sortedFolders(selectedData?.folders ?? []).map(f => (
                                                    <option key={f.id} value={f.id}>{f.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    ))}
                                </div>
                                {rootFolders.map(f => <FolderRow key={f.id} folder={f} depth={0} />)}
                            </div>
                        )}
                    </div>
                ) : (
                    /* Project list */
                    loading ? (
                        <p style={{ textAlign: "center", color: C.muted, padding: "3rem" }}><span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}><Loader2 size={16} className="animate-spin" /> جاري التحميل…</span></p>
                    ) : projects.length === 0 ? (
                        <div style={{ ...cardStyle, textAlign: "center", padding: "3rem" }}>
                            <p style={{ fontSize: "2.5rem", margin: "0 0 0.5rem", opacity: 0.3, display: "inline-flex", alignItems: "center", justifyContent: "center", width: "100%" }}><FolderOpen size={60} /></p>
                            <p style={{ color: C.muted, fontSize: "0.95rem", margin: 0 }}>ما عندك مشاريع إلى الآن — ابدئي بإنشاء أول مشروع!</p>
                        </div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                            {projects.map(p => (
                                <div key={p.id} onClick={() => void openProject(p)}
                                    style={{
                                        ...cardStyle, padding: "1rem 1.2rem", cursor: "pointer",
                                        transition: "all 0.15s",
                                    }}
                                    onMouseOver={e => { e.currentTarget.style.borderColor = C.accentLight; e.currentTarget.style.boxShadow = C.shadowLg; }}
                                    onMouseOut={e => { e.currentTarget.style.borderColor = C.cardBorder; e.currentTarget.style.boxShadow = C.shadow; }}
                                >
                                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                        <span style={{ fontSize: "1.2rem", display: "inline-flex", alignItems: "center" }}><FolderIcon size={20} /></span>
                                        <div style={{ flex: 1 }}>
                                            <p style={{ margin: 0, fontSize: "0.95rem", fontWeight: 600, color: C.title }}>{p.name}</p>
                                            {p.description && <p style={{ margin: "0.1rem 0 0", fontSize: "0.8rem", color: C.muted }}>{p.description}</p>}
                                            <p style={{ margin: "0.15rem 0 0", fontSize: "0.7rem", color: C.muted + "99" }}>
                                                {new Date(p.createdAt).toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" })}
                                            </p>
                                        </div>
                                        <BtnGhost onClick={() => void handleDeleteProject(p.id)} color={C.red}>حذف</BtnGhost>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                )}
            </div>
        </div>
    );
}
