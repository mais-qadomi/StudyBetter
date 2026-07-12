import { Router, type IRouter } from "express";
import { db, sessionsTable, pageResultsTable, projectsTable, foldersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";

const router: IRouter = Router();

// ===== SESSIONS =====

router.get("/sessions/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const session = await db.query.sessionsTable.findFirst({
      where: eq(sessionsTable.id, id),
    });
    if (!session) {
      res.status(404).json({ error: "session not found" });
      return;
    }
    const pages = await db
      .select()
      .from(pageResultsTable)
      .where(eq(pageResultsTable.sessionId, id))
      .orderBy(pageResultsTable.pageNumber);
    res.json({ session, pages });
  } catch (err) {
    req.log.error({ err }, "GET /sessions/:id failed");
    res.status(500).json({ error: "database error" });
  }
});

router.post("/sessions", async (req, res) => {
  const { sessionId, fileName, fileSize, numPages, projectId } = req.body as {
    sessionId: string;
    fileName: string;
    fileSize: number;
    numPages: number;
    projectId?: string;
  };
  if (!sessionId || !fileName) {
    res.status(400).json({ error: "sessionId and fileName required" });
    return;
  }
  try {
    const existing = await db.query.sessionsTable.findFirst({
      where: eq(sessionsTable.id, sessionId),
    });
    if (existing) {
      const [updated] = await db
        .update(sessionsTable)
        .set({ fileName, fileSize, numPages, ...(projectId !== undefined && { projectId }) })
        .where(eq(sessionsTable.id, sessionId))
        .returning();
      res.json(updated);
      return;
    }
    const [created] = await db
      .insert(sessionsTable)
      .values({ id: sessionId, fileName, fileSize, numPages, projectId: projectId ?? null })
      .returning();
    res.json(created);
  } catch (err) {
    req.log.error({ err }, "POST /sessions failed");
    res.status(500).json({ error: "database error" });
  }
});

router.put("/sessions/:id/pages/:pageNum", async (req, res) => {
  const { id, pageNum } = req.params;
  const { extractedText, translation, explanation } = req.body as {
    extractedText?: string;
    translation?: string | null;
    explanation?: string;
  };
  const pageNumber = parseInt(pageNum, 10);
  if (isNaN(pageNumber)) {
    res.status(400).json({ error: "invalid page number" });
    return;
  }
  try {
    const sessionExists = await db.query.sessionsTable.findFirst({
      where: eq(sessionsTable.id, id),
    });
    if (!sessionExists) {
      res.status(404).json({ error: "session not found" });
      return;
    }
    const existing = await db.query.pageResultsTable.findFirst({
      where: and(
        eq(pageResultsTable.sessionId, id),
        eq(pageResultsTable.pageNumber, pageNumber)
      ),
    });
    if (existing) {
      const [updated] = await db
        .update(pageResultsTable)
        .set({
          ...(extractedText !== undefined && { extractedText }),
          ...(translation !== undefined && { translation }),
          ...(explanation !== undefined && { explanation }),
        })
        .where(
          and(
            eq(pageResultsTable.sessionId, id),
            eq(pageResultsTable.pageNumber, pageNumber)
          )
        )
        .returning();
      res.json(updated);
      return;
    }
    const [created] = await db
      .insert(pageResultsTable)
      .values({
        sessionId: id,
        pageNumber,
        extractedText: extractedText ?? "",
        translation: translation ?? null,
        explanation: explanation ?? null,
      })
      .returning();
    res.json(created);
  } catch (err) {
    req.log.error({ err }, "PUT /sessions/:id/pages/:pageNum failed");
    res.status(500).json({ error: "database error" });
  }
});

router.delete("/sessions/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await db.delete(sessionsTable).where(eq(sessionsTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "DELETE /sessions/:id failed");
    res.status(500).json({ error: "database error" });
  }
});

router.patch("/sessions/:id/project", async (req, res) => {
  const { id } = req.params;
  const { projectId } = req.body as { projectId: string | null };
  try {
    const [updated] = await db
      .update(sessionsTable)
      .set({ projectId: projectId ?? null })
      .where(eq(sessionsTable.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "session not found" });
      return;
    }
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "PATCH /sessions/:id/project failed");
    res.status(500).json({ error: "database error" });
  }
});

// ===== PROJECTS =====

router.get("/projects", async (req, res) => {
  try {
    const projects = await db.select().from(projectsTable).orderBy(projectsTable.createdAt);
    res.json(projects);
  } catch (err) {
    req.log.error({ err }, "GET /projects failed");
    res.status(500).json({ error: "database error" });
  }
});

router.get("/projects/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const [project] = await db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.id, id))
      .limit(1);
    if (!project) {
      res.status(404).json({ error: "project not found" });
      return;
    }
    const sessions = await db
      .select()
      .from(sessionsTable)
      .where(eq(sessionsTable.projectId, id))
      .orderBy(sessionsTable.createdAt);
    const folders = await db
      .select()
      .from(foldersTable)
      .where(eq(foldersTable.projectId, id))
      .orderBy(foldersTable.createdAt);
    res.json({ project, sessions, folders });
  } catch (err) {
    req.log.error({ err }, "GET /projects/:id failed");
    res.status(500).json({ error: "database error" });
  }
});

router.post("/projects", async (req, res) => {
  const { name, description } = req.body as { name: string; description?: string };
  if (!name?.trim()) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  try {
    const [created] = await db
      .insert(projectsTable)
      .values({ id: randomUUID(), name: name.trim(), description: description?.trim() })
      .returning();
    res.json(created);
  } catch (err) {
    req.log.error({ err }, "POST /projects failed");
    res.status(500).json({ error: "database error" });
  }
});

router.patch("/projects/:id", async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body as { name?: string; description?: string };
  try {
    const [updated] = await db
      .update(projectsTable)
      .set({
        ...(name && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() }),
      })
      .where(eq(projectsTable.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "project not found" });
      return;
    }
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "PATCH /projects/:id failed");
    res.status(500).json({ error: "database error" });
  }
});

router.delete("/projects/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await db.delete(projectsTable).where(eq(projectsTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "DELETE /projects/:id failed");
    res.status(500).json({ error: "database error" });
  }
});

export default router;