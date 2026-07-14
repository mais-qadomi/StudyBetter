import { Router, type IRouter } from "express";
import { db, foldersTable, sessionsTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { randomUUID } from "crypto";

const router: IRouter = Router();

// ===== FOLDERS =====

// إنشاء مجلد
router.post("/folders", async (req, res) => {
  const { name, projectId, parentFolderId } = req.body as {
    name: string;
    projectId: string;
    parentFolderId?: string | null;
  };
  if (!name?.trim() || !projectId) {
    res.status(400).json({ error: "name and projectId required" });
    return;
  }
  try {
    const allFolders = await db
      .select()
      .from(foldersTable)
      .where(eq(foldersTable.projectId, projectId))
      .orderBy(asc(foldersTable.order));
    const maxOrder = allFolders.length > 0 ? allFolders[allFolders.length - 1].order : -1;
    const [created] = await db
      .insert(foldersTable)
      .values({ id: randomUUID(), name: name.trim(), projectId, parentFolderId: parentFolderId ?? null, order: maxOrder + 1 })
      .returning();
    res.json(created);
  } catch (err) {
    req.log.error({ err }, "POST /folders failed");
    res.status(500).json({ error: "database error" });
  }
});

// تعديل اسم مجلد
router.patch("/folders/:id", async (req, res) => {
  const { id } = req.params;
  const { name } = req.body as { name?: string };
  try {
    const [updated] = await db
      .update(foldersTable)
      .set({ ...(name && { name: name.trim() }) })
      .where(eq(foldersTable.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "folder not found" });
      return;
    }
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "PATCH /folders/:id failed");
    res.status(500).json({ error: "database error" });
  }
});

// حذف مجلد
router.delete("/folders/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await db.delete(foldersTable).where(eq(foldersTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "DELETE /folders/:id failed");
    res.status(500).json({ error: "database error" });
  }
});

// إعادة ترتيب المجلدات
router.patch("/folders/reorder", async (req, res) => {
  const { folderIds } = req.body as { folderIds: string[] };
  if (!Array.isArray(folderIds)) {
    res.status(400).json({ error: "folderIds array required" });
    return;
  }
  try {
    for (let i = 0; i < folderIds.length; i++) {
      await db
        .update(foldersTable)
        .set({ order: i })
        .where(eq(foldersTable.id, folderIds[i]));
    }
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "PATCH /folders/reorder failed");
    res.status(500).json({ error: "database error" });
  }
});

// نقل ملف لمجلد (أو إزالته من مجلد)
router.patch("/sessions/:id/folder", async (req, res) => {
  const { id } = req.params;
  const { folderId } = req.body as { folderId: string | null };
  try {
    const [updated] = await db
      .update(sessionsTable)
      .set({ folderId: folderId ?? null })
      .where(eq(sessionsTable.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "session not found" });
      return;
    }
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "PATCH /sessions/:id/folder failed");
    res.status(500).json({ error: "database error" });
  }
});

export default router;