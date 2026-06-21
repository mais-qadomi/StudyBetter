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
};

export async function apiGetSession(sessionId: string): Promise<{ session: StoredSession; pages: StoredPageResult[] } | null> {
  const res = await fetch(`/api/sessions/${sessionId}`);
  if (!res.ok) return null;
  return res.json() as Promise<{ session: StoredSession; pages: StoredPageResult[] }>;
}

export async function apiSaveSession(sessionId: string, fileName: string, fileSize: number, numPages: number): Promise<void> {
  await fetch("/api/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, fileName, fileSize, numPages }),
  });
}

export async function apiSavePage(
  sessionId: string,
  pageNumber: number,
  data: { extractedText?: string; translation?: string | null; explanation?: string }
): Promise<void> {
  await fetch(`/api/sessions/${sessionId}/pages/${pageNumber}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function apiDeleteSession(sessionId: string): Promise<void> {
  await fetch(`/api/sessions/${sessionId}`, { method: "DELETE" });
}
