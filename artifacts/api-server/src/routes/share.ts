import { Router, type IRouter } from "express";
import multer from "multer";
import {
  createShare,
  getShare,
  revokeShare,
  getShareInfo,
  getMaxFileSize,
} from "../lib/share-store";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: getMaxFileSize() },
  fileFilter(_req, file, cb) {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"));
    }
  },
});

// In-memory rate limiter for GET /share/:token
const downloadHits = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;

function isRateLimited(token: string): boolean {
  const now = Date.now();
  const hit = downloadHits.get(token);

  if (!hit || now > hit.resetAt) {
    downloadHits.set(token, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  hit.count++;
  return hit.count > RATE_LIMIT_MAX;
}

// POST /api/share — create a share link (requires auth)
router.post("/share", requireAuth, upload.single("pdf"), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No PDF file uploaded" });
      return;
    }

    const sessionId = (req.body?.sessionId as string) || "anonymous";

    const { token, expiresAt } = await createShare(
      req.file.originalname,
      req.file.size,
      sessionId,
      req.file.buffer,
    );

    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const shareUrl = `${baseUrl}/api/share/${token}`;

    res.json({
      token,
      shareUrl,
      expiresAt,
      fileName: req.file.originalname,
    });
  } catch (err: any) {
    if (err?.message === "Only PDF files are allowed") {
      res.status(400).json({ error: "Only PDF files are allowed" });
      return;
    }
    req.log.error({ err }, "POST /share failed");
    res.status(500).json({ error: "Failed to create share link" });
  }
});

// GET /api/share/:token — download a shared PDF (public)
router.get("/share/:token", async (req, res) => {
  const token = String(req.params.token);

  if (isRateLimited(token)) {
    res.status(429).json({ error: "Too many requests. Try again later." });
    return;
  }

  try {
    const result = await getShare(token);

    if (!result) {
      res.status(404).json({ error: "Share link not found or expired" });
      return;
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(result.fileName)}"`,
    );

    const { readFile } = await import("fs/promises");
    const fileBuffer = await readFile(result.filePath);
    res.send(fileBuffer);
  } catch (err) {
    req.log.error({ err }, "GET /share/:token failed");
    res.status(500).json({ error: "Failed to retrieve shared file" });
  }
});

// POST /api/share/:token/revoke — revoke a share link (requires auth)
router.post("/share/:token/revoke", requireAuth, async (req, res) => {
  const token = String(req.params.token);

  try {
    const info = await getShareInfo(token);

    if (!info) {
      res.status(404).json({ error: "Share link not found" });
      return;
    }

    if (info.revokedAt) {
      res.json({ message: "Already revoked", revokedAt: info.revokedAt });
      return;
    }

    await revokeShare(token);
    res.json({ message: "Share link revoked successfully" });
  } catch (err) {
    req.log.error({ err }, "POST /share/:token/revoke failed");
    res.status(500).json({ error: "Failed to revoke share link" });
  }
});

export default router;
