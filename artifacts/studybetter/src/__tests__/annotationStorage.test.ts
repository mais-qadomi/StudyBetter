import { describe, it, expect, beforeEach } from "vitest";
import {
  getOrCreateAnnotationFile,
  getAnnotationFile,
  updateDeletedPages,
  deletePageLocally,
  restorePageLocally,
  getAnnotationsForPage,
  getAllAnnotations,
  addAnnotationElement,
  updateAnnotationElement,
  deleteAnnotationElement,
  saveImageBlob,
  getImageBlobUrl,
  deleteImageBlob,
  resetDB,
} from "../lib/annotationStorage";
import type { TextData, ShapeData } from "../lib/annotation-types";

beforeEach(() => {
  resetDB();
  // Create a fresh IDBFactory so each test starts with a clean database
  globalThis.indexedDB = new globalThis.IDBFactory();
});

describe("AnnotationFile CRUD", () => {
  const fileId = "test-file-1";

  it("creates a new annotation file", async () => {
    const file = await getOrCreateAnnotationFile(fileId, 10);
    expect(file.fileId).toBe(fileId);
    expect(file.pageCount).toBe(10);
    expect(file.deletedPages).toEqual([]);
    expect(file.createdAt).toBeTypeOf("number");
  });

  it("returns existing file on second call", async () => {
    const first = await getOrCreateAnnotationFile(fileId, 10);
    const second = await getOrCreateAnnotationFile(fileId, 20);
    expect(second.fileId).toBe(first.fileId);
    expect(second.pageCount).toBe(first.pageCount);
  });

  it("gets annotation file by id", async () => {
    await getOrCreateAnnotationFile(fileId, 5);
    const found = await getAnnotationFile(fileId);
    expect(found).not.toBeNull();
    expect(found!.fileId).toBe(fileId);
  });

  it("returns null for non-existent file", async () => {
    const result = await getAnnotationFile("non-existent");
    expect(result).toBeNull();
  });

  it("updates deleted pages", async () => {
    await getOrCreateAnnotationFile(fileId, 10);
    await updateDeletedPages(fileId, [2, 5]);
    const file = await getAnnotationFile(fileId);
    expect(file!.deletedPages).toEqual([2, 5]);
  });

  it("throws when updating deleted pages for non-existent file", async () => {
    await expect(updateDeletedPages("no-such", [1])).rejects.toThrow();
  });

  it("deletePageLocally adds page to deletedPages", async () => {
    await getOrCreateAnnotationFile(fileId, 10);
    await deletePageLocally(fileId, 3);
    const file = await getAnnotationFile(fileId);
    expect(file!.deletedPages).toEqual([3]);
  });

  it("deletePageLocally prevents duplicate entries", async () => {
    await getOrCreateAnnotationFile(fileId, 10);
    await deletePageLocally(fileId, 2);
    await deletePageLocally(fileId, 2);
    const file = await getAnnotationFile(fileId);
    expect(file!.deletedPages).toEqual([2]);
  });

  it("deletePageLocally prevents deleting last active page", async () => {
    await getOrCreateAnnotationFile("small-file", 1);
    await expect(deletePageLocally("small-file", 1)).rejects.toThrow("لا يمكن حذف آخر صفحة متبقية");
  });

  it("deletePageLocally throws for out-of-range page", async () => {
    await getOrCreateAnnotationFile(fileId, 10);
    await expect(deletePageLocally(fileId, 99)).rejects.toThrow("out of range");
    await expect(deletePageLocally(fileId, 0)).rejects.toThrow("out of range");
  });

  it("deletePageLocally throws for non-existent file", async () => {
    await expect(deletePageLocally("no-such", 1)).rejects.toThrow();
  });

  it("restorePageLocally removes page from deletedPages", async () => {
    await getOrCreateAnnotationFile(fileId, 10);
    await deletePageLocally(fileId, 2);
    await deletePageLocally(fileId, 5);
    await restorePageLocally(fileId, 2);
    const file = await getAnnotationFile(fileId);
    expect(file!.deletedPages).toEqual([5]);
  });

  it("restorePageLocally is idempotent for non-deleted page", async () => {
    await getOrCreateAnnotationFile(fileId, 10);
    await restorePageLocally(fileId, 3);
    const file = await getAnnotationFile(fileId);
    expect(file!.deletedPages).toEqual([]);
  });

  it("restorePageLocally throws for non-existent file", async () => {
    await expect(restorePageLocally("no-such", 1)).rejects.toThrow();
  });
});

describe("AnnotationElement CRUD", () => {
  const fileId = "test-file-2";

  const textData: TextData = {
    x: 0.1,
    y: 0.2,
    width: 0.3,
    height: 0.05,
    content: "Hello world",
    fontSize: 14,
    color: "#000000",
  };

  const shapeData: ShapeData = {
    x: 0.5,
    y: 0.5,
    width: 0.2,
    height: 0.1,
    shapeType: "rectangle",
    strokeColor: "#ff0000",
    fillColor: "transparent",
    strokeWidth: 2,
  };

  beforeEach(async () => {
    await getOrCreateAnnotationFile(fileId, 5);
  });

  it("adds an annotation element", async () => {
    const el = await addAnnotationElement(fileId, 1, "text", textData);
    expect(el.id).toBeTypeOf("string");
    expect(el.fileId).toBe(fileId);
    expect(el.pageNumber).toBe(1);
    expect(el.type).toBe("text");
    expect(el.data).toEqual(textData);
    expect(el.zIndex).toBe(0);
  });

  it("adds with custom zIndex", async () => {
    const el = await addAnnotationElement(fileId, 1, "shape", shapeData, 5);
    expect(el.zIndex).toBe(5);
  });

  it("throws on invalid type", async () => {
    await expect(
      addAnnotationElement(fileId, 1, "invalid" as any, textData),
    ).rejects.toThrow("Invalid annotation type");
  });

  it("throws on out-of-range coordinates", async () => {
    const bad = { ...textData, x: 1.5 };
    await expect(
      addAnnotationElement(fileId, 1, "text", bad),
    ).rejects.toThrow("x must be in [0,1]");
  });

  it("gets annotations for a specific page sorted by zIndex", async () => {
    await addAnnotationElement(fileId, 1, "text", textData, 10);
    await addAnnotationElement(fileId, 1, "shape", shapeData, 2);
    await addAnnotationElement(fileId, 2, "text", textData, 1);

    const page1 = await getAnnotationsForPage(fileId, 1);
    expect(page1).toHaveLength(2);
    expect(page1[0].zIndex).toBe(2);
    expect(page1[1].zIndex).toBe(10);

    const page2 = await getAnnotationsForPage(fileId, 2);
    expect(page2).toHaveLength(1);
  });

  it("gets all annotations grouped by page", async () => {
    await addAnnotationElement(fileId, 1, "text", textData);
    await addAnnotationElement(fileId, 1, "shape", shapeData);
    await addAnnotationElement(fileId, 3, "text", textData);

    const all = await getAllAnnotations(fileId);
    expect(Object.keys(all)).toHaveLength(2);
    expect(all[1]).toHaveLength(2);
    expect(all[3]).toHaveLength(1);
  });

  it("updates an annotation element", async () => {
    const el = await addAnnotationElement(fileId, 1, "text", textData);
    const updated = await updateAnnotationElement(el.id, {
      data: { ...textData, content: "Updated" },
    });
    expect(updated.data).toMatchObject({ content: "Updated" });
    expect(updated.updatedAt).toBeGreaterThanOrEqual(el.updatedAt);
  });

  it("throws on update of non-existent element", async () => {
    await expect(
      updateAnnotationElement("no-such", { zIndex: 5 }),
    ).rejects.toThrow();
  });

  it("deletes an annotation element", async () => {
    const el = await addAnnotationElement(fileId, 1, "text", textData);
    await deleteAnnotationElement(el.id);
    const page = await getAnnotationsForPage(fileId, 1);
    expect(page).toHaveLength(0);
  });
});

describe("Image Blob Storage", () => {
  const fileId = "test-file-3";

  it("saves and retrieves an image blob", async () => {
    const blob = new Blob(["fake image data"], { type: "image/png" });
    const id = await saveImageBlob(fileId, blob, "image/png");
    expect(id).toBeTypeOf("string");

    const url = await getImageBlobUrl(id);
    expect(url).not.toBeNull();
    expect(url!.startsWith("blob:")).toBe(true);

    URL.revokeObjectURL(url!);
  });

  it("returns null for non-existent image", async () => {
    const url = await getImageBlobUrl("non-existent");
    expect(url).toBeNull();
  });

  it("deletes an image blob", async () => {
    const blob = new Blob(["data"], { type: "image/jpeg" });
    const id = await saveImageBlob(fileId, blob, "image/jpeg");
    await deleteImageBlob(id);
    const url = await getImageBlobUrl(id);
    expect(url).toBeNull();
  });
});
