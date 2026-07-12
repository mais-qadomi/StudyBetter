import { Router, type IRouter } from "express";
import { db, bookmarksTable, projectsTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { randomUUID } from "crypto";

const router: IRouter = Router();

router.get("/bookmarks/:projectId", async (req, res) => {
  const { projectId } = req.params;
  try {
    const bookmarks = await db
      .select()
      .from(bookmarksTable)
      .where(eq(bookmarksTable.projectId, projectId))
      .orderBy(asc(bookmarksTable.order));
    res.json(bookmarks);
  } catch (err) {
    req.log.error({ err }, "GET /bookmarks/:projectId failed");
    res.status(500).json({ error: "database error" });
  }
});

router.post("/bookmarks", async (req, res) => {
  const { projectId, folderId, name, type, url, content } = req.body as {
    projectId: string;
    folderId?: string | null;
    name: string;
    type: "link" | "note";
    url?: string | null;
    content?: string | null;
  };
  if (!projectId || !name?.trim() || !type) {
    res.status(400).json({ error: "projectId, name, and type required" });
    return;
  }
  try {
    const last = await db
      .select()
      .from(bookmarksTable)
      .where(eq(bookmarksTable.projectId, projectId))
      .orderBy(asc(bookmarksTable.order));
    const maxOrder = last.length > 0 ? last[last.length - 1].order : -1;
    const [created] = await db
      .insert(bookmarksTable)
      .values({
        id: randomUUID(),
        projectId,
        folderId: folderId ?? null,
        name: name.trim(),
        type,
        url: url ?? null,
        content: content ?? null,
        order: maxOrder + 1,
      })
      .returning();
    res.json(created);
  } catch (err) {
    req.log.error({ err }, "POST /bookmarks failed");
    res.status(500).json({ error: "database error" });
  }
});

router.patch("/bookmarks/:id", async (req, res) => {
  const { id } = req.params;
  const { name, folderId, url, content } = req.body as {
    name?: string;
    folderId?: string | null;
    url?: string | null;
    content?: string | null;
  };
  try {
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name.trim();
    if (folderId !== undefined) updates.folderId = folderId;
    if (url !== undefined) updates.url = url;
    if (content !== undefined) updates.content = content;
    const [updated] = await db
      .update(bookmarksTable)
      .set(updates)
      .where(eq(bookmarksTable.id, id))
      .returning();
    if (!updated) { res.status(404).json({ error: "bookmark not found" }); return; }
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "PATCH /bookmarks/:id failed");
    res.status(500).json({ error: "database error" });
  }
});

router.delete("/bookmarks/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await db.delete(bookmarksTable).where(eq(bookmarksTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "DELETE /bookmarks/:id failed");
    res.status(500).json({ error: "database error" });
  }
});

export default router;
