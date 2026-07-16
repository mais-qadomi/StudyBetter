import { Router, type IRouter } from "express";
import { db, foldersTable, sessionsTable, projectsTable } from "@workspace/db";
import { eq, and, asc } from "drizzle-orm";
import { randomUUID } from "crypto";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

router.use(requireAuth);

// Helper: verify project belongs to user
async function assertUserProject(userId: string, projectId: string): Promise<boolean> {
  const project = await db.query.projectsTable.findFirst({
    where: and(eq(projectsTable.id, projectId), eq(projectsTable.userId, userId)),
    columns: { id: true },
  });
  return !!project;
}

// Helper: verify folder belongs to user (via project ownership)
async function assertUserFolder(userId: string, folderId: string): Promise<{ valid: boolean; folder?: typeof foldersTable.$inferSelect }> {
  const folder = await db.query.foldersTable.findFirst({
    where: eq(foldersTable.id, folderId),
  });
  if (!folder) return { valid: false };
  const valid = await assertUserProject(userId, folder.projectId);
  return { valid, folder };
}

// Helper: verify session belongs to user
async function assertUserSession(userId: string, sessionId: string): Promise<boolean> {
  const session = await db.query.sessionsTable.findFirst({
    where: and(eq(sessionsTable.id, sessionId), eq(sessionsTable.userId, userId)),
    columns: { id: true },
  });
  return !!session;
}

// Create folder
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
  if (!(await assertUserProject(req.user!.id, projectId))) {
    res.status(404).json({ error: "project not found" });
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

// Rename folder
router.patch("/folders/:id", async (req, res) => {
  const { id } = req.params;
  const { name, parentFolderId } = req.body as { name?: string; parentFolderId?: string | null };
  const { valid } = await assertUserFolder(req.user!.id, id);
  if (!valid) {
    res.status(404).json({ error: "folder not found" });
    return;
  }
  try {
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name.trim();
    if (parentFolderId !== undefined) updates.parentFolderId = parentFolderId;
    const [updated] = await db
      .update(foldersTable)
      .set(updates)
      .where(eq(foldersTable.id, id))
      .returning();
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "PATCH /folders/:id failed");
    res.status(500).json({ error: "database error" });
  }
});

// Delete folder
router.delete("/folders/:id", async (req, res) => {
  const { id } = req.params;
  const { valid } = await assertUserFolder(req.user!.id, id);
  if (!valid) {
    res.status(404).json({ error: "folder not found" });
    return;
  }
  try {
    await db.delete(foldersTable).where(eq(foldersTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "DELETE /folders/:id failed");
    res.status(500).json({ error: "database error" });
  }
});

// Reorder folders
router.patch("/folders/reorder", async (req, res) => {
  const { folderIds } = req.body as { folderIds: string[] };
  if (!Array.isArray(folderIds)) {
    res.status(400).json({ error: "folderIds array required" });
    return;
  }
  try {
    for (let i = 0; i < folderIds.length; i++) {
      const { valid } = await assertUserFolder(req.user!.id, folderIds[i]);
      if (!valid) {
        res.status(404).json({ error: `folder ${folderIds[i]} not found` });
        return;
      }
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

// Move session to folder
router.patch("/sessions/:id/folder", async (req, res) => {
  const { id } = req.params;
  const { folderId } = req.body as { folderId: string | null };
  if (!(await assertUserSession(req.user!.id, id))) {
    res.status(404).json({ error: "session not found" });
    return;
  }
  try {
    const [updated] = await db
      .update(sessionsTable)
      .set({ folderId: folderId ?? null })
      .where(eq(sessionsTable.id, id))
      .returning();
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "PATCH /sessions/:id/folder failed");
    res.status(500).json({ error: "database error" });
  }
});

export default router;
