import { Router, type IRouter } from "express";
import { db, sessionsTable, pageResultsTable, featureResultsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { randomUUID } from "crypto";

const router: IRouter = Router();

const LIVE_FEATURES = ["explanation"];
const COMING_SOON = ["summary", "quiz", "flashcards", "translation"];

router.get("/files/:fileId/features", async (req, res) => {
  const { fileId } = req.params;
  try {
    const file = await db.query.sessionsTable.findFirst({
      where: eq(sessionsTable.id, fileId),
    });
    if (!file) {
      res.status(404).json({ error: "file not found" });
      return;
    }

    const results = await db
      .select()
      .from(featureResultsTable)
      .where(eq(featureResultsTable.fileId, fileId))
      .orderBy(desc(featureResultsTable.createdAt));

    const appliedTypes = new Set(results.map(r => r.featureType));
    const availableFeatures = [
      ...LIVE_FEATURES.map(t => ({ type: t, status: "live" as const, alreadyApplied: appliedTypes.has(t) })),
      ...COMING_SOON.map(t => ({ type: t, status: "coming_soon" as const, alreadyApplied: appliedTypes.has(t) })),
    ];

    res.json({ file, results, availableFeatures });
  } catch (err) {
    req.log.error({ err }, "GET /files/:fileId/features failed");
    res.status(500).json({ error: "database error" });
  }
});

router.post("/files/:fileId/features/:featureType", async (req, res) => {
  const { fileId, featureType } = req.params;
  const { text } = req.body as { text?: string };

  if (!text || !text.trim()) {
    res.status(400).json({ error: "text is required" });
    return;
  }

  if (!LIVE_FEATURES.includes(featureType)) {
    res.status(400).json({ error: "feature type is not available" });
    return;
  }

  try {
    const file = await db.query.sessionsTable.findFirst({
      where: eq(sessionsTable.id, fileId),
    });
    if (!file) {
      res.status(404).json({ error: "file not found" });
      return;
    }

    const id = randomUUID();
    const [created] = await db
      .insert(featureResultsTable)
      .values({ id, fileId, featureType, status: "processing" })
      .returning();

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      await db.update(featureResultsTable)
        .set({ status: "failed", resultData: JSON.stringify({ error: "GROQ_API_KEY not configured" }) })
        .where(eq(featureResultsTable.id, id));
      res.status(500).json({ error: "GROQ_API_KEY not configured" });
      return;
    }

    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            {
              role: "system",
              content: "You are a brilliant professor. Explain the given text in deep Arabic with English terms preserved. Respond in JSON: { \"explanation\": \"...\" }",
            },
            { role: "user", content: text },
          ],
          max_tokens: 3000,
          temperature: 0.4,
        }),
      });

      if (!response.ok) {
        throw new Error(`Groq API error: ${response.status}`);
      }

      const data = await response.json() as { choices?: { message?: { content?: string } }[] };
      const raw = data.choices?.[0]?.message?.content ?? "{}";
      let parsed: { explanation?: string };
      try {
        const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
        const jsonMatch = /\{[\s\S]*\}/.exec(cleaned);
        parsed = JSON.parse(jsonMatch ? jsonMatch[0] : cleaned);
      } catch {
        parsed = { explanation: raw };
      }

      const [updated] = await db
        .update(featureResultsTable)
        .set({ status: "completed", resultData: JSON.stringify(parsed) })
        .where(eq(featureResultsTable.id, id))
        .returning();

      res.json(updated);
    } catch (err) {
      await db.update(featureResultsTable)
        .set({ status: "failed", resultData: JSON.stringify({ error: String(err) }) })
        .where(eq(featureResultsTable.id, id));
      const [failed] = await db.select().from(featureResultsTable).where(eq(featureResultsTable.id, id)).limit(1);
      res.status(502).json(failed);
    }
  } catch (err) {
    req.log.error({ err }, "POST /files/:fileId/features/:featureType failed");
    res.status(500).json({ error: "database error" });
  }
});

export default router;
