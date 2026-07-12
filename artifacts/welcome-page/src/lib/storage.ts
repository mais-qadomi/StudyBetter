import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "pdf-reader-db";
const DB_VERSION = 1;
const PDF_STORE = "pdfs";
const SESSION_KEY = "pdf-session-id";

let _db: IDBPDatabase | null = null;

async function getIDB() {
  if (_db) return _db;
  _db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(PDF_STORE)) {
        db.createObjectStore(PDF_STORE);
      }
    },
  });
  return _db;
}

export function getOrCreateSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function clearSessionId() {
  localStorage.removeItem(SESSION_KEY);
}

export async function savePdfToIDB(sessionId: string, file: File): Promise<void> {
  const db = await getIDB();
  const buffer = await file.arrayBuffer();
  await db.put(PDF_STORE, buffer, sessionId);
}

export async function loadPdfFromIDB(sessionId: string): Promise<File | null> {
  try {
    const db = await getIDB();
    const buffer = await db.get(PDF_STORE, sessionId) as ArrayBuffer | undefined;
    if (!buffer) return null;
    const blob = new Blob([buffer], { type: "application/pdf" });
    return new File([blob], "restored.pdf", { type: "application/pdf" });
  } catch {
    return null;
  }
}

export async function deletePdfFromIDB(sessionId: string): Promise<void> {
  const db = await getIDB();
  await db.delete(PDF_STORE, sessionId);
}

export type StoredPageResult = {
  pageNumber: number;
  extractedText: string;
  translation: string | null;
  explanation: string | null;
};

export type StoredSession = {
  id: string;
  fileName: string;
  fileSize: number;
  numPages: number;
  projectId: string | null;
  folderId: string | null;
};

export async function apiGetSession(sessionId: string): Promise<{ session: StoredSession; pages: StoredPageResult[] } | null> {
  try {
    const res = await fetch(`/api/sessions/${sessionId}`);
    if (res.ok) {
      const data = await res.json() as { session: StoredSession; pages: StoredPageResult[] };
      lsSetSession(data.session, data.pages);
      return data;
    }
  } catch {}
  return lsGetSession(sessionId);
}

export async function apiSaveSession(sessionId: string, fileName: string, fileSize: number, numPages: number): Promise<void> {
  try {
    await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, fileName, fileSize, numPages }),
    });
  } catch {}
  lsSetSession({ id: sessionId, fileName, fileSize, numPages, projectId: null, folderId: null }, []);
}

export async function apiSavePage(
  sessionId: string,
  pageNumber: number,
  data: { extractedText?: string; translation?: string | null; explanation?: string }
): Promise<void> {
  try {
    await fetch(`/api/sessions/${sessionId}/pages/${pageNumber}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  } catch {}
  lsSetPageResult(sessionId, pageNumber, { pageNumber, extractedText: data.extractedText ?? "", translation: data.translation ?? null, explanation: data.explanation ?? null });
}

export async function apiDeleteSession(sessionId: string): Promise<void> {
  try {
    await fetch(`/api/sessions/${sessionId}`, { method: "DELETE" });
  } catch {}
  const sessionsKey = "wp-sessions-v2";
  const sessions = JSON.parse(localStorage.getItem(sessionsKey) || "{}");
  delete sessions[sessionId];
  localStorage.setItem(sessionsKey, JSON.stringify(sessions));
  localStorage.removeItem("wp-session-pages-" + sessionId);
}
// ===== LOCALSTORAGE FALLBACK for Projects / Folders / Bookmarks =====

const LS_PROJECTS_KEY = "wp-projects-v2";
const LS_PROJECT_CACHE_PREFIX = "wp-project-cache-";

function lsGetProjects(): Project[] {
  try { return JSON.parse(localStorage.getItem(LS_PROJECTS_KEY) || "[]"); } catch { return []; }
}
function lsSetProjects(list: Project[]) {
  localStorage.setItem(LS_PROJECTS_KEY, JSON.stringify(list));
}
function lsGetProjectCache(id: string): { folders: Folder[]; sessions: StoredSession[]; bookmarks: Bookmark[] } | null {
  try {
    const raw = localStorage.getItem(LS_PROJECT_CACHE_PREFIX + id);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function lsSetProjectCache(id: string, data: { folders: Folder[]; sessions: StoredSession[]; bookmarks: Bookmark[] }) {
  localStorage.setItem(LS_PROJECT_CACHE_PREFIX + id, JSON.stringify(data));
}
function lsRemoveProjectCache(id: string) {
  localStorage.removeItem(LS_PROJECT_CACHE_PREFIX + id);
}
function lsRemoveAllProjectCaches() {
  const prefix = LS_PROJECT_CACHE_PREFIX;
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (key?.startsWith(prefix)) localStorage.removeItem(key);
  }
}

const SESSIONS_KEY = "wp-sessions-v2";

function lsSetSession(session: StoredSession, pages: StoredPageResult[]) {
  const all = JSON.parse(localStorage.getItem(SESSIONS_KEY) || "{}");
  all[session.id] = { session, pages };
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(all));
}

function lsGetSession(sessionId: string): { session: StoredSession; pages: StoredPageResult[] } | null {
  try {
    const all = JSON.parse(localStorage.getItem(SESSIONS_KEY) || "{}");
    const entry = all[sessionId];
    if (!entry) return null;
    const pagesKey = "wp-session-pages-" + sessionId;
    const savedPages = JSON.parse(localStorage.getItem(pagesKey) || "[]");
    return { session: entry.session, pages: savedPages };
  } catch { return null; }
}

function lsSetPageResult(sessionId: string, pageNumber: number, result: StoredPageResult) {
  const pagesKey = "wp-session-pages-" + sessionId;
  const pages: StoredPageResult[] = JSON.parse(localStorage.getItem(pagesKey) || "[]");
  const idx = pages.findIndex(p => p.pageNumber === pageNumber);
  if (idx >= 0) pages[idx] = result;
  else pages.push(result);
  localStorage.setItem(pagesKey, JSON.stringify(pages));
}

export function cacheSessionInProject(projectId: string | null, session: StoredSession) {
  if (!projectId) return;
  let cache = lsGetProjectCache(projectId);
  if (!cache) cache = { folders: [], sessions: [], bookmarks: [] };
  cache.sessions = cache.sessions.filter(s => s.id !== session.id);
  cache.sessions.push(session);
  lsSetProjectCache(projectId, cache);
}

// ===== PROJECTS API =====

export type Project = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function apiGetProjects(): Promise<Project[]> {
  try {
    const res = await fetch("/api/projects");
    if (res.ok) {
      const data = await res.json() as Project[];
      lsSetProjects(data);
      return data;
    }
  } catch {}
  return lsGetProjects();
}

export async function apiCreateProject(name: string, description?: string): Promise<Project | null> {
  try {
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description }),
    });
    if (res.ok) {
      const created = await res.json() as Project;
      const list = lsGetProjects();
      list.push(created);
      lsSetProjects(list);
      return created;
    }
  } catch {}
  const fallback: Project = {
    id: crypto.randomUUID(),
    name,
    description: description ?? null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const list = lsGetProjects();
  list.push(fallback);
  lsSetProjects(list);
  return fallback;
}

export async function apiDeleteProject(id: string): Promise<void> {
  try {
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
  } catch {}
  const list = lsGetProjects().filter(p => p.id !== id);
  lsSetProjects(list);
  lsRemoveProjectCache(id);
}

export async function apiRenameProject(id: string, name: string): Promise<void> {
  try {
    await fetch(`/api/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
  } catch {}
  const list = lsGetProjects().map(p => p.id === id ? { ...p, name: name.trim(), updatedAt: new Date().toISOString() } : p);
  lsSetProjects(list);
}

export async function apiGetProject(id: string): Promise<{ project: Project; sessions: StoredSession[]; folders: Folder[] } | null> {
  try {
    const res = await fetch(`/api/projects/${id}`);
    if (res.ok) {
      const data = await res.json() as { project: Project; sessions: StoredSession[]; folders: Folder[] };
      const existingBookmarks = lsGetProjectCache(id)?.bookmarks ?? [];
      lsSetProjectCache(id, { folders: data.folders, sessions: data.sessions, bookmarks: existingBookmarks });
      return data;
    }
  } catch {}
  const project = lsGetProjects().find(p => p.id === id) ?? null;
  if (!project) return null;
  const cache = lsGetProjectCache(id);
  return { project, sessions: cache?.sessions ?? [], folders: cache?.folders ?? [] };
}

export async function apiAssignSessionToProject(sessionId: string, projectId: string | null): Promise<void> {
  try {
    await fetch(`/api/sessions/${sessionId}/project`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId }),
    });
  } catch {}
}

// ===== FOLDERS API =====

export type Folder = {
  id: string;
  name: string;
  projectId: string;
  parentFolderId: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
};

export async function apiCreateFolder(name: string, projectId: string, parentFolderId?: string | null): Promise<Folder | null> {
  try {
    const res = await fetch("/api/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, projectId, parentFolderId }),
    });
    if (res.ok) {
      const created = await res.json() as Folder;
      let cache = lsGetProjectCache(projectId);
      if (!cache) cache = { folders: [], sessions: [], bookmarks: [] };
      cache.folders.push(created);
      lsSetProjectCache(projectId, cache);
      return created;
    }
  } catch {}
  const fallback: Folder = {
    id: crypto.randomUUID(),
    name,
    projectId,
    parentFolderId: parentFolderId ?? null,
    order: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  let cache = lsGetProjectCache(projectId);
  if (!cache) {
    cache = { folders: [], sessions: [], bookmarks: [] };
  }
  cache.folders.push(fallback);
  lsSetProjectCache(projectId, cache);

  return fallback;
}

export async function apiRenameFolder(id: string, name: string): Promise<void> {
  try {
    await fetch(`/api/folders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
  } catch {}
}

export async function apiDeleteFolder(id: string): Promise<void> {
  try {
    await fetch(`/api/folders/${id}`, { method: "DELETE" });
  } catch {}
}

export async function apiAssignSessionToFolder(sessionId: string, folderId: string | null): Promise<void> {
  try {
    await fetch(`/api/sessions/${sessionId}/folder`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folderId }),
    });
  } catch {}
}

export async function apiReorderFolders(folderIds: string[]): Promise<void> {
  try {
    await fetch("/api/folders/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folderIds }),
    });
  } catch {}
}

// ===== BOOKMARKS API (links + notes) =====

export type Bookmark = {
  id: string;
  projectId: string;
  folderId: string | null;
  name: string;
  type: "link" | "note";
  url: string | null;
  content: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
};

export async function apiGetBookmarks(projectId: string): Promise<Bookmark[]> {
  try {
    const res = await fetch(`/api/bookmarks/${projectId}`);
    if (res.ok) {
      const data = await res.json() as Bookmark[];
      const cache = lsGetProjectCache(projectId);
      if (cache) {
        cache.bookmarks = data;
        lsSetProjectCache(projectId, cache);
      }
      return data;
    }
  } catch {}
  return lsGetProjectCache(projectId)?.bookmarks ?? [];
}

export async function apiCreateBookmark(data: {
  projectId: string;
  folderId?: string | null;
  name: string;
  type: "link" | "note";
  url?: string | null;
  content?: string | null;
}): Promise<Bookmark | null> {
  try {
    const res = await fetch("/api/bookmarks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const created = await res.json() as Bookmark;
      let cache = lsGetProjectCache(data.projectId);
      if (!cache) cache = { folders: [], sessions: [], bookmarks: [] };
      cache.bookmarks.push(created);
      lsSetProjectCache(data.projectId, cache);
      return created;
    }
  } catch {}
  const fallback: Bookmark = {
    id: crypto.randomUUID(),
    projectId: data.projectId,
    folderId: data.folderId ?? null,
    name: data.name,
    type: data.type,
    url: data.url ?? null,
    content: data.content ?? null,
    order: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  let cache = lsGetProjectCache(data.projectId);
  if (!cache) cache = { folders: [], sessions: [], bookmarks: [] };
  cache.bookmarks.push(fallback);
  lsSetProjectCache(data.projectId, cache);
  return fallback;
}

export async function apiUpdateBookmark(id: string, data: { name?: string; folderId?: string | null; url?: string | null; content?: string | null }): Promise<void> {
  try {
    await fetch(`/api/bookmarks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  } catch {}
}

export async function apiDeleteBookmark(id: string): Promise<void> {
  try {
    await fetch(`/api/bookmarks/${id}`, { method: "DELETE" });
  } catch {}
}

// ===== FILES / FEATURES API =====

export type FeatureResultData = {
  id: string;
  fileId: string;
  featureType: string;
  status: "processing" | "completed" | "failed";
  resultData: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FeaturesResponse = {
  file: StoredSession;
  results: FeatureResultData[];
  availableFeatures: {
    type: string;
    status: "live" | "coming_soon";
    alreadyApplied: boolean;
  }[];
};

const LS_FEATURES_PREFIX = "wp-file-features-";

export async function apiGetFileFeatures(fileId: string): Promise<FeaturesResponse | null> {
  try {
    const res = await fetch(`/api/files/${fileId}/features`);
    if (res.ok) {
      const data = await res.json() as FeaturesResponse;
      localStorage.setItem(LS_FEATURES_PREFIX + fileId, JSON.stringify(data));
      return data;
    }
  } catch {}
  const session = lsGetSession(fileId);
  if (!session) return null;
  const cached = localStorage.getItem(LS_FEATURES_PREFIX + fileId);
  if (cached) {
    try { return JSON.parse(cached) as FeaturesResponse; } catch {}
  }
  return {
    file: session.session,
    results: [],
    availableFeatures: [
      { type: "explanation", status: "live", alreadyApplied: false },
      { type: "summary", status: "live", alreadyApplied: false },
      { type: "quiz", status: "live", alreadyApplied: false },
      { type: "flashcards", status: "live", alreadyApplied: false },
      { type: "translation", status: "live", alreadyApplied: false },
    ],
  };
}

export async function apiApplyFeature(fileId: string, featureType: string, text: string): Promise<FeatureResultData | null> {
  try {
    const res = await fetch(`/api/files/${fileId}/features/${featureType}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (res.ok) return res.json() as Promise<FeatureResultData>;
  } catch {}
  return null;
}