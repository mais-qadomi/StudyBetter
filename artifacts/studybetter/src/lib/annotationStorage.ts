import {
  ANNOTATION_TYPES,
  type AnnotationElement,
  type AnnotationFile,
  type AnnotationImage,
  type AnnotationType,
  type AnnotationData,
} from "./annotation-types";

const DB_NAME = "studybetter-annotations";
const DB_VERSION = 1;

const FILES_STORE = "annotationFiles";
const ELEMENTS_STORE = "annotationElements";
const IMAGES_STORE = "annotationImages";

let _db: IDBDatabase | null = null;

function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function promisifyTransaction(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function getDB(): Promise<IDBDatabase> {
  if (_db) return _db;

  _db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(FILES_STORE)) {
        db.createObjectStore(FILES_STORE, { keyPath: "fileId" });
      }
      if (!db.objectStoreNames.contains(ELEMENTS_STORE)) {
        const store = db.createObjectStore(ELEMENTS_STORE, { keyPath: "id" });
        store.createIndex("fileId", "fileId", { unique: false });
        store.createIndex("filePage", ["fileId", "pageNumber"], { unique: false });
      }
      if (!db.objectStoreNames.contains(IMAGES_STORE)) {
        db.createObjectStore(IMAGES_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return _db;
}

// Reset the cached DB connection (for testing)
export function resetDB(): void {
  _db = null;
}

// ── Raw helpers ──

async function dbGet<T>(storeName: string, key: IDBValidKey): Promise<T | undefined> {
  const db = await getDB();
  return promisifyRequest(db.transaction(storeName, "readonly").objectStore(storeName).get(key));
}

async function dbPut<T>(storeName: string, value: T): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(storeName, "readwrite");
  tx.objectStore(storeName).put(value);
  await promisifyTransaction(tx);
}

async function dbDelete(storeName: string, key: IDBValidKey): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(storeName, "readwrite");
  tx.objectStore(storeName).delete(key);
  await promisifyTransaction(tx);
}

async function dbGetAllFromIndex<T>(storeName: string, indexName: string, key: IDBValidKey | IDBKeyRange): Promise<T[]> {
  const db = await getDB();
  const tx = db.transaction(storeName, "readonly");
  const index = tx.objectStore(storeName).index(indexName);
  return promisifyRequest(index.getAll(key));
}

// ── Validation ──

function isValidAnnotationType(type: string): type is AnnotationType {
  return (ANNOTATION_TYPES as readonly string[]).includes(type);
}

function validateCoords(data: AnnotationData): void {
  if ("x" in data && "y" in data) {
    const { x, y, width, height } = data as { x: number; y: number; width: number; height: number };
    if (x < 0 || x > 1) throw new Error(`x must be in [0,1], got ${x}`);
    if (y < 0 || y > 1) throw new Error(`y must be in [0,1], got ${y}`);
    if (width < 0 || width > 1) throw new Error(`width must be in [0,1], got ${width}`);
    if (height < 0 || height > 1) throw new Error(`height must be in [0,1], got ${height}`);
  }
}

// ── Files ──

export async function getOrCreateAnnotationFile(
  fileId: string,
  pageCount: number,
): Promise<AnnotationFile> {
  const existing = await dbGet<AnnotationFile>(FILES_STORE, fileId);
  if (existing) return existing;
  const now = Date.now();
  const record: AnnotationFile = { fileId, pageCount, deletedPages: [], createdAt: now, updatedAt: now };
  await dbPut(FILES_STORE, record);
  return record;
}

export async function getAnnotationFile(fileId: string): Promise<AnnotationFile | null> {
  const record = await dbGet<AnnotationFile>(FILES_STORE, fileId);
  return record ?? null;
}

export async function updateDeletedPages(fileId: string, deletedPages: number[]): Promise<void> {
  const existing = await dbGet<AnnotationFile>(FILES_STORE, fileId);
  if (!existing) throw new Error(`AnnotationFile ${fileId} not found`);
  await dbPut(FILES_STORE, { ...existing, deletedPages, updatedAt: Date.now() });
}

export async function deletePageLocally(fileId: string, pageNumber: number): Promise<void> {
  const existing = await dbGet<AnnotationFile>(FILES_STORE, fileId);
  if (!existing) throw new Error(`AnnotationFile ${fileId} not found`);
  if (pageNumber < 1 || pageNumber > existing.pageCount) {
    throw new Error(`Page number ${pageNumber} is out of range [1, ${existing.pageCount}]`);
  }
  const activePages = existing.pageCount - existing.deletedPages.length;
  if (activePages <= 1) {
    throw new Error("لا يمكن حذف آخر صفحة متبقية");
  }
  if (existing.deletedPages.includes(pageNumber)) {
    return;
  }
  const updated = [...existing.deletedPages, pageNumber].sort((a, b) => a - b);
  await dbPut(FILES_STORE, { ...existing, deletedPages: updated, updatedAt: Date.now() });
}

export async function restorePageLocally(fileId: string, pageNumber: number): Promise<void> {
  const existing = await dbGet<AnnotationFile>(FILES_STORE, fileId);
  if (!existing) throw new Error(`AnnotationFile ${fileId} not found`);
  if (!existing.deletedPages.includes(pageNumber)) {
    return;
  }
  const updated = existing.deletedPages.filter((p) => p !== pageNumber);
  await dbPut(FILES_STORE, { ...existing, deletedPages: updated, updatedAt: Date.now() });
}

// ── Elements ──

export async function getAnnotationsForPage(
  fileId: string,
  pageNumber: number,
): Promise<AnnotationElement[]> {
  const all = await dbGetAllFromIndex<AnnotationElement>(ELEMENTS_STORE, "filePage", [fileId, pageNumber]);
  return all.sort((a, b) => a.zIndex - b.zIndex);
}

export async function getAllAnnotations(
  fileId: string,
): Promise<Record<number, AnnotationElement[]>> {
  const all = await dbGetAllFromIndex<AnnotationElement>(ELEMENTS_STORE, "fileId", fileId);
  const grouped: Record<number, AnnotationElement[]> = {};
  for (const el of all) {
    if (!grouped[el.pageNumber]) grouped[el.pageNumber] = [];
    grouped[el.pageNumber].push(el);
  }
  for (const pn of Object.keys(grouped)) {
    grouped[Number(pn)].sort((a, b) => a.zIndex - b.zIndex);
  }
  return grouped;
}

export async function addAnnotationElement(
  fileId: string,
  pageNumber: number,
  type: AnnotationType,
  data: AnnotationData,
  zIndex = 0,
): Promise<AnnotationElement> {
  if (!isValidAnnotationType(type)) throw new Error(`Invalid annotation type: ${type}`);
  validateCoords(data);
  const now = Date.now();
  const element: AnnotationElement = {
    id: crypto.randomUUID(),
    fileId,
    pageNumber,
    type,
    data,
    zIndex,
    createdAt: now,
    updatedAt: now,
  };
  await dbPut(ELEMENTS_STORE, element);
  return element;
}

export async function updateAnnotationElement(
  id: string,
  partial: Partial<Pick<AnnotationElement, "data" | "zIndex" | "pageNumber">>,
): Promise<AnnotationElement> {
  const existing = await dbGet<AnnotationElement>(ELEMENTS_STORE, id);
  if (!existing) throw new Error(`AnnotationElement ${id} not found`);
  if (partial.data) validateCoords(partial.data);
  const updated = { ...existing, ...partial, updatedAt: Date.now() };
  await dbPut(ELEMENTS_STORE, updated);
  return updated;
}

export async function deleteAnnotationElement(id: string): Promise<void> {
  await dbDelete(ELEMENTS_STORE, id);
}

// ── Images ──

export async function saveImageBlob(
  fileId: string,
  blob: Blob,
  mimeType: string,
): Promise<string> {
  const id = crypto.randomUUID();
  const record: AnnotationImage = { id, fileId, blob, mimeType };
  await dbPut(IMAGES_STORE, record);
  return id;
}

export async function getImageBlobUrl(imageBlobId: string): Promise<string | null> {
  const record = await dbGet<AnnotationImage>(IMAGES_STORE, imageBlobId);
  if (!record) return null;
  return URL.createObjectURL(record.blob);
}

export async function deleteImageBlob(imageBlobId: string): Promise<void> {
  await dbDelete(IMAGES_STORE, imageBlobId);
}
