import { create } from "zustand";
import {
  addAnnotationElement as dbAdd,
  updateAnnotationElement as dbUpdate,
  deleteAnnotationElement as dbDelete,
  getAllAnnotations,
  getAnnotationFile,
  deletePageLocally as dbDeletePage,
  restorePageLocally as dbRestorePage,
  saveImageBlob as dbSaveImageBlob,
  deleteImageBlob as dbDeleteImageBlob,
} from "../lib/annotationStorage";
import { callExplain } from "../lib/explain";
import { getExtractedText, getExtractedSegments } from "../lib/pdfTextCache";
import { groupSegmentsIntoParagraphs, findBestPlacement } from "../lib/pdf-text-extract";
import type {
  AnnotationElement,
  AnnotationType,
  AnnotationData,
  ShapeType,
  Point,
  AiExplanationData,
} from "../lib/annotation-types";

// ── Types ──

export type Tool =
  | "select"
  | "text"
  | "image"
  | "pen"
  | "highlighter"
  | "eraser"
  | "shape";

interface HistoryEntry {
  elementsByPage: Record<number, AnnotationElement[]>;
}

interface SaveIndicator {
  status: "idle" | "saving" | "saved";
  timeoutId?: ReturnType<typeof setTimeout>;
}

interface AnnotationState {
  fileId: string | null;

  // Tool state
  selectedTool: Tool;
  selectedShapeType: ShapeType;
  selectedElementId: string | null;

  // Elements
  elementsByPage: Record<number, AnnotationElement[]>;

  // History
  history: HistoryEntry[];
  historyIndex: number;
  maxHistory: number;

  // Save indicator
  saveIndicator: SaveIndicator;

  // Explain state
  explainingPages: Set<number>;
  explainErrors: Record<number, string>;

  // Deleted pages
  deletedPages: number[];

  // Actions
  setFileId: (fileId: string) => void;
  loadAll: () => Promise<void>;
  setTool: (tool: Tool) => void;
  setShapeType: (shapeType: ShapeType) => void;
  selectElement: (id: string | null) => void;

  addElement: (
    pageNumber: number,
    type: AnnotationType,
    data: AnnotationData,
    zIndex?: number,
  ) => Promise<AnnotationElement>;
  updateElement: (
    id: string,
    partial: Partial<Pick<AnnotationElement, "data" | "zIndex" | "pageNumber">>,
  ) => Promise<void>;
  deleteElement: (id: string) => Promise<void>;
  deleteElementsByPage: (pageNumber: number) => Promise<void>;

  saveImage: (blob: Blob, mimeType: string) => Promise<string>;
  deleteImage: (imageBlobId: string) => Promise<void>;

  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // Replace all elements for a page (used by interaction layer for batch updates)
  setPageElements: (pageNumber: number, elements: AnnotationElement[]) => void;

  // Auto-explain
  explainPage: (pageNumber: number, fileId: string, numPages: number) => Promise<void>;
  explainAllPages: (fileId: string, numPages: number) => Promise<void>;

  // Page management
  deletePage: (pageNumber: number) => Promise<void>;
  restorePage: (pageNumber: number) => Promise<void>;
  loadDeletedPages: () => Promise<void>;
}

// ── Helpers ──

function clonePages(
  pages: Record<number, AnnotationElement[]>,
): Record<number, AnnotationElement[]> {
  const out: Record<number, AnnotationElement[]> = {};
  for (const [k, v] of Object.entries(pages)) {
    out[Number(k)] = [...v];
  }
  return out;
}

function pushHistory(
  state: AnnotationState,
  newPages: Record<number, AnnotationElement[]>,
): Partial<AnnotationState> {
  const snapshot: HistoryEntry = { elementsByPage: clonePages(state.elementsByPage) };
  const newHistory = state.history.slice(0, state.historyIndex + 1);
  newHistory.push(snapshot);
  if (newHistory.length > state.maxHistory) newHistory.shift();
  return {
    elementsByPage: newPages,
    history: newHistory,
    historyIndex: newHistory.length - 1,
  };
}

function showSaved(get: () => AnnotationState, set: (s: Partial<AnnotationState> | ((s: AnnotationState) => Partial<AnnotationState>)) => void) {
  const prev = get().saveIndicator;
  if (prev.timeoutId) clearTimeout(prev.timeoutId);
  set({ saveIndicator: { status: "saving" } });
  const tid = setTimeout(() => {
    set({ saveIndicator: { status: "saved" } });
    const tid2 = setTimeout(() => {
      set({ saveIndicator: { status: "idle" } });
    }, 2000);
    const s = get();
    if (s.saveIndicator.timeoutId) clearTimeout(s.saveIndicator.timeoutId);
    set({ saveIndicator: { status: "saved", timeoutId: tid2 } });
  }, 300);
  set({ saveIndicator: { status: "saving", timeoutId: tid } } as any);
}

interface ExplanationInput {
  content: string;
  sourceText: string;
  x: number;
  y: number;
  width: number;
  height: number;
  avgFontSize: number;
}

async function replaceExplanation(
  fileId: string,
  pageNumber: number,
  get: () => AnnotationState,
  set: (s: Partial<AnnotationState> | ((s: AnnotationState) => Partial<AnnotationState>)) => void,
  inputs: ExplanationInput[],
) {
  const { elementsByPage } = get();
  const existing = elementsByPage[pageNumber] ?? [];
  const oldAiIds = existing
    .filter((el) => el.type === "ai_explanation")
    .map((el) => el.id);
  for (const id of oldAiIds) {
    await dbDelete(id);
  }
  const cleaned = existing.filter((el) => el.type !== "ai_explanation");

  const newElements: AnnotationElement[] = [];
  for (const input of inputs) {
    const explanationFontSize = Math.max(9, Math.min(16, Math.round(input.avgFontSize * 600)));
    const data: AiExplanationData = {
      source: "ai",
      sourceText: input.sourceText,
      content: input.content,
      fontSize: explanationFontSize,
      color: "#6d28d9",
      x: input.x,
      y: input.y,
      width: input.width,
      height: input.height,
    };
    const el = await dbAdd(fileId, pageNumber, "ai_explanation", data, 900);
    newElements.push(el);
  }

  set((s) => ({
    elementsByPage: { ...s.elementsByPage, [pageNumber]: [...cleaned, ...newElements] },
  }));
  showSaved(get, set);
}

// ── Store ──

export const useAnnotationStore = create<AnnotationState>((set, get) => ({
  fileId: null,

  selectedTool: "select",
  selectedShapeType: "rectangle",
  selectedElementId: null,

  elementsByPage: {},

  history: [],
  historyIndex: -1,
  maxHistory: 50,

  saveIndicator: { status: "idle" },

  explainingPages: new Set(),
  explainErrors: {},

  deletedPages: [],

  setFileId: (fileId) => {
    set({
      fileId,
      elementsByPage: {},
      history: [],
      historyIndex: -1,
      selectedElementId: null,
      explainingPages: new Set(),
      explainErrors: {},
      deletedPages: [],
    });
  },

  loadAll: async () => {
    const { fileId } = get();
    if (!fileId) return;
    const all = await getAllAnnotations(fileId);
    const pages: Record<number, AnnotationElement[]> = {};
    for (const [k, v] of Object.entries(all)) {
      pages[Number(k)] = v;
    }
    set({ elementsByPage: pages });
  },

  setTool: (tool) => set({ selectedTool: tool, selectedElementId: null }),
  setShapeType: (shapeType) => set({ selectedShapeType: shapeType }),
  selectElement: (id) => set({ selectedElementId: id }),

  addElement: async (pageNumber, type, data, zIndex = 0) => {
    const { fileId, elementsByPage } = get();
    if (!fileId) throw new Error("No fileId set");

    const element = await dbAdd(fileId, pageNumber, type, data, zIndex);

    const pageEls = [...(elementsByPage[pageNumber] ?? []), element];
    const newPages = { ...elementsByPage, [pageNumber]: pageEls };

    set(pushHistory(get(), newPages));
    showSaved(get, set);
    return element;
  },

  updateElement: async (id, partial) => {
    const { elementsByPage } = get();
    const updated = await dbUpdate(id, partial);

    const newPages = clonePages(elementsByPage);
    for (const pn of Object.keys(newPages)) {
      const idx = newPages[Number(pn)].findIndex((e) => e.id === id);
      if (idx !== -1) {
        newPages[Number(pn)] = [...newPages[Number(pn)]];
        newPages[Number(pn)][idx] = updated;
        break;
      }
    }

    set(pushHistory(get(), newPages));
    showSaved(get, set);
  },

  deleteElement: async (id) => {
    const { elementsByPage } = get();
    await dbDelete(id);

    const newPages = clonePages(elementsByPage);
    for (const pn of Object.keys(newPages)) {
      const filtered = newPages[Number(pn)].filter((e) => e.id !== id);
      if (filtered.length !== newPages[Number(pn)].length) {
        newPages[Number(pn)] = filtered;
      }
    }

    set(pushHistory(get(), newPages));
    showSaved(get, set);
  },

  deleteElementsByPage: async (pageNumber) => {
    const { elementsByPage } = get();
    const els = elementsByPage[pageNumber] ?? [];
    for (const el of els) {
      await dbDelete(el.id);
    }

    const newPages = { ...elementsByPage, [pageNumber]: [] };
    set(pushHistory(get(), newPages));
    showSaved(get, set);
  },

  saveImage: async (blob, mimeType) => {
    const { fileId } = get();
    if (!fileId) throw new Error("No fileId set");
    return dbSaveImageBlob(fileId, blob, mimeType);
  },

  deleteImage: async (imageBlobId) => {
    await dbDeleteImageBlob(imageBlobId);
  },

  undo: () => {
    const { history, historyIndex, elementsByPage } = get();
    if (historyIndex < 0) return;

    const entry = history[historyIndex];
    const redoSnapshot: HistoryEntry = { elementsByPage: clonePages(elementsByPage) };

    const newHistory = [...history];
    newHistory.splice(historyIndex + 1, 0, redoSnapshot);
    if (newHistory.length > get().maxHistory) newHistory.shift();

    // Re-apply the undone operations to IndexedDB
    const oldPages = entry.elementsByPage;
    const newPages = clonePages(oldPages);
    syncToIDB(get().fileId, newPages);

    set({
      elementsByPage: oldPages,
      history: newHistory,
      historyIndex: historyIndex - 1,
      selectedElementId: null,
    });
    showSaved(get, set);
  },

  redo: () => {
    const { history, historyIndex, elementsByPage } = get();
    if (historyIndex >= history.length - 2) return;

    const nextEntry = history[historyIndex + 2];
    if (!nextEntry) return;

    const redoSnapshot: HistoryEntry = { elementsByPage: clonePages(elementsByPage) };
    const newHistory = [...history];
    newHistory[historyIndex + 1] = redoSnapshot;

    syncToIDB(get().fileId, nextEntry.elementsByPage);

    set({
      elementsByPage: clonePages(nextEntry.elementsByPage),
      history: newHistory,
      historyIndex: historyIndex + 1,
      selectedElementId: null,
    });
    showSaved(get, set);
  },

  canUndo: () => get().historyIndex >= 0,
  canRedo: () => {
    const { history, historyIndex } = get();
    return historyIndex < history.length - 2;
  },

  setPageElements: (pageNumber, elements) => {
    const { elementsByPage } = get();
    set({ elementsByPage: { ...elementsByPage, [pageNumber]: elements } });
  },

  // ── Auto-explain ──

  explainPage: async (pageNumber, fileId, numPages) => {
    if (pageNumber < 1 || pageNumber > numPages) return;

    const segments = getExtractedSegments(fileId, pageNumber);
    if (segments.length === 0) {
      const text = getExtractedText(fileId, pageNumber);
      if (!text.trim()) {
        set((s) => ({
          explainErrors: { ...s.explainErrors, [pageNumber]: "لم يُستخرج نص من هذه الصفحة" },
        }));
        return;
      }
    }

    // Mark as explaining
    set((s) => {
      const next = new Set(s.explainingPages);
      next.add(pageNumber);
      return { explainingPages: next, explainErrors: { ...s.explainErrors, [pageNumber]: "" } };
    });

    try {
      const paragraphs = groupSegmentsIntoParagraphs(segments);

      if (paragraphs.length === 0) {
        const text = getExtractedText(fileId, pageNumber);
        if (!text.trim()) {
          set((s) => ({
            explainErrors: { ...s.explainErrors, [pageNumber]: "لم يُستخرج نص من هذه الصفحة" },
          }));
          return;
        }
        // Fallback: explain as single block
        const result = await callExplain(text);
        if (result.error) {
          set((s) => ({
            explainErrors: { ...s.explainErrors, [pageNumber]: result.error },
          }));
          return;
        }
        await replaceExplanation(fileId, pageNumber, get, set, [{
          content: result.explanation,
          sourceText: text.slice(0, 500),
          x: 0.02, y: 0.02, width: 0.96, height: 0.15, avgFontSize: 0.025,
        }]);
        return;
      }

      // Delete old ai_explanations on this page (replace mode)
      const { elementsByPage } = get();
      const existing = elementsByPage[pageNumber] ?? [];
      const oldAiIds = existing
        .filter((el) => el.type === "ai_explanation")
        .map((el) => el.id);
      for (const id of oldAiIds) {
        await dbDelete(id);
      }
      const cleaned = existing.filter((el) => el.type !== "ai_explanation");

      // Collect occupied zones from non-AI elements
      const occupiedZones: { x: number; y: number; width: number; height: number }[] = [];
      for (const el of cleaned) {
        const d = el.data as any;
        if (d.x != null && d.y != null && d.width != null && d.height != null) {
          occupiedZones.push({ x: d.x, y: d.y, width: d.width, height: d.height });
        }
      }

      // Explain each paragraph
      const newElements: AnnotationElement[] = [];
      for (const para of paragraphs) {
        if (!para.text.trim()) continue;

        try {
          const result = await callExplain(para.text);
          if (result.error || !result.explanation) continue;

          const explanationHeight = Math.min(0.12, Math.max(0.03, result.explanation.length / 3000));

          const placement = findBestPlacement(
            para.y + para.height,
            para.y,
            para.x + para.width,
            para.x,
            explanationHeight,
            occupiedZones,
          );

          if (!placement) continue;

          // Mark this zone as occupied
          occupiedZones.push({
            x: placement.x,
            y: placement.y,
            width: placement.width,
            height: explanationHeight,
          });

          const explanationFontSize = Math.max(9, Math.min(16, Math.round(para.avgFontSize * 600)));

          const explanationData: AiExplanationData = {
            source: "ai",
            sourceText: para.text.slice(0, 500),
            content: result.explanation,
            fontSize: explanationFontSize,
            color: "#6d28d9",
            x: placement.x,
            y: placement.y,
            width: placement.width,
            height: explanationHeight,
          };

          const element = await dbAdd(fileId, pageNumber, "ai_explanation", explanationData, 900);
          newElements.push(element);
        } catch {
          // Per-paragraph failure is non-fatal, continue with others
        }
      }

      if (newElements.length === 0 && paragraphs.length > 0) {
        set((s) => ({
          explainErrors: { ...s.explainErrors, [pageNumber]: "فشل توليد الشرح لهذه الصفحة" },
        }));
        return;
      }

      const newPageEls = [...cleaned, ...newElements];
      set((s) => ({
        elementsByPage: { ...s.elementsByPage, [pageNumber]: newPageEls },
      }));
      showSaved(get, set);
    } catch (err: any) {
      set((s) => ({
        explainErrors: {
          ...s.explainErrors,
          [pageNumber]: err?.message ?? "فشل في توليد الشرح",
        },
      }));
    } finally {
      set((s) => {
        const next = new Set(s.explainingPages);
        next.delete(pageNumber);
        return { explainingPages: next };
      });
    }
  },

  explainAllPages: async (fileId, numPages) => {
    const DELAY_MS = 2000;
    for (let p = 1; p <= numPages; p++) {
      const state = get();
      if (state.explainingPages.size > 0) continue;
      await state.explainPage(p, fileId, numPages);
      if (p < numPages) {
        await new Promise((r) => setTimeout(r, DELAY_MS));
      }
    }
  },

  // ── Page management ──

  loadDeletedPages: async () => {
    const { fileId } = get();
    if (!fileId) return;
    const record = await getAnnotationFile(fileId);
    set({ deletedPages: record?.deletedPages ?? [] });
  },

  deletePage: async (pageNumber) => {
    const { fileId } = get();
    if (!fileId) throw new Error("No fileId set");
    await dbDeletePage(fileId, pageNumber);
    const record = await getAnnotationFile(fileId);
    set({ deletedPages: record?.deletedPages ?? [] });
  },

  restorePage: async (pageNumber) => {
    const { fileId } = get();
    if (!fileId) throw new Error("No fileId set");
    await dbRestorePage(fileId, pageNumber);
    const record = await getAnnotationFile(fileId);
    set({ deletedPages: record?.deletedPages ?? [] });
  },
}));

// ── Sync helper: reconcile store state with IndexedDB ──

async function syncToIDB(
  fileId: string | null,
  targetPages: Record<number, AnnotationElement[]>,
) {
  if (!fileId) return;
  const current = await getAllAnnotations(fileId);
  const currentIds = new Set(Object.values(current).flat().map((e) => e.id));
  const targetIds = new Set(Object.values(targetPages).flat().map((e) => e.id));

  // Delete elements that are in current but not in target
  for (const id of currentIds) {
    if (!targetIds.has(id)) {
      await dbDelete(id);
    }
  }

  // Put all target elements
  for (const els of Object.values(targetPages)) {
    for (const el of els) {
      await dbPutElement(el);
    }
  }
}

async function dbPutElement(el: AnnotationElement) {
  const db = await getIDB();
  const tx = db.transaction("annotationElements", "readwrite");
  tx.objectStore("annotationElements").put(el);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function getIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("studybetter-annotations", 1);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
