import { randomBytes, createHash } from "crypto";
import { mkdir, readFile, writeFile, unlink, access } from "fs/promises";
import { join } from "path";

const DATA_DIR = join(process.cwd(), "data", "shared");
const PDF_DIR = join(DATA_DIR, "pdfs");
const META_PATH = join(DATA_DIR, "meta.json");

const DEFAULT_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

export interface SharedLink {
  token: string;
  fileName: string;
  fileSize: number;
  sessionId: string;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  tokenHash: string;
}

let metaCache: Record<string, SharedLink> | null = null;

async function ensureDirs(): Promise<void> {
  await mkdir(PDF_DIR, { recursive: true });
}

async function loadMeta(): Promise<Record<string, SharedLink>> {
  if (metaCache) return metaCache;
  try {
    const raw = await readFile(META_PATH, "utf-8");
    metaCache = JSON.parse(raw) as Record<string, SharedLink>;
  } catch {
    metaCache = {};
  }
  return metaCache;
}

async function saveMeta(meta: Record<string, SharedLink>): Promise<void> {
  metaCache = meta;
  await writeFile(META_PATH, JSON.stringify(meta, null, 2), "utf-8");
}

function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function getMaxFileSize(): number {
  return MAX_FILE_SIZE;
}

export async function createShare(
  fileName: string,
  fileSize: number,
  sessionId: string,
  fileBuffer: Buffer,
): Promise<{ token: string; expiresAt: string }> {
  await ensureDirs();
  const meta = await loadMeta();

  const token = generateToken();
  const tokenHash = hashToken(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + DEFAULT_EXPIRY_MS);

  const entry: SharedLink = {
    token,
    fileName,
    fileSize,
    sessionId,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    revokedAt: null,
    tokenHash,
  };

  meta[tokenHash] = entry;
  await saveMeta(meta);

  const filePath = join(PDF_DIR, `${tokenHash}.pdf`);
  await writeFile(filePath, fileBuffer);

  return { token, expiresAt: expiresAt.toISOString() };
}

export async function getShare(
  token: string,
): Promise<{ filePath: string; fileName: string } | null> {
  const meta = await loadMeta();
  const tokenHash = hashToken(token);
  const entry = meta[tokenHash];

  if (!entry) return null;
  if (entry.revokedAt) return null;
  if (new Date(entry.expiresAt) < new Date()) return null;

  const filePath = join(PDF_DIR, `${tokenHash}.pdf`);
  try {
    await access(filePath);
  } catch {
    return null;
  }

  return { filePath, fileName: entry.fileName };
}

export async function revokeShare(
  token: string,
): Promise<boolean> {
  const meta = await loadMeta();
  const tokenHash = hashToken(token);
  const entry = meta[tokenHash];

  if (!entry) return false;
  if (entry.revokedAt) return true;

  entry.revokedAt = new Date().toISOString();
  await saveMeta(meta);

  // Remove PDF file
  const filePath = join(PDF_DIR, `${tokenHash}.pdf`);
  try {
    await unlink(filePath);
  } catch {
    // File already gone, ignore
  }

  return true;
}

export async function getShareInfo(
  token: string,
): Promise<Omit<SharedLink, "tokenHash"> | null> {
  const meta = await loadMeta();
  const tokenHash = hashToken(token);
  const entry = meta[tokenHash];

  if (!entry) return null;

  const { tokenHash: _, ...rest } = entry;
  return rest;
}
