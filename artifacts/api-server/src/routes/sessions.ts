import { Router, type IRouter } from "express";
import { db, sessionsTable, pageResultsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router: IRouter = Router();

router.get("/sessions/:id", async (req, res) => {
  const { id } = req.params;
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
});

router.post("/sessions", async (req, res) => {
  const { sessionId, fileName, fileSize, numPages } = req.body as {
    sessionId: string;
    fileName: string;
    fileSize: number;
    numPages: number;
  };
  if (!sessionId || !fileName) {
    res.status(400).json({ error: "sessionId and fileName required" });
    return;
  }
  const existing = await db.query.sessionsTable.findFirst({
    where: eq(sessionsTable.id, sessionId),
  });
  if (existing) {
    const [updated] = await db
      .update(sessionsTable)
      .set({ fileName, fileSize, numPages })
      .where(eq(sessionsTable.id, sessionId))
      .returning();
    res.json(updated);
    return;
  }
  const [created] = await db
    .insert(sessionsTable)
    .values({ id: sessionId, fileName, fileSize, numPages })
    .returning();
  res.json(created);
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
});

router.delete("/sessions/:id", async (req, res) => {
  const { id } = req.params;
  await db.delete(sessionsTable).where(eq(sessionsTable.id, id));
  res.json({ ok: true });
});

export default router;
