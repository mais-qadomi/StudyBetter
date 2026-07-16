import type { TextSegment } from "./pdf-text-extract";

interface CacheEntry {
  text: string;
  segments: TextSegment[];
}

const cache = new Map<string, CacheEntry>();

export function storeExtractedText(
  fileId: string,
  pageNumber: number,
  text: string,
  segments: TextSegment[] = [],
): void {
  cache.set(`${fileId}:${pageNumber}`, { text, segments });
}

export function getExtractedText(fileId: string, pageNumber: number): string {
  return cache.get(`${fileId}:${pageNumber}`)?.text ?? "";
}

export function getExtractedSegments(fileId: string, pageNumber: number): TextSegment[] {
  return cache.get(`${fileId}:${pageNumber}`)?.segments ?? [];
}

export function getAllExtractedTexts(fileId: string, pageCount: number): Record<number, string> {
  const out: Record<number, string> = {};
  for (let p = 1; p <= pageCount; p++) {
    const entry = cache.get(`${fileId}:${p}`);
    if (entry) out[p] = entry.text;
  }
  return out;
}

export function clearExtractedTexts(fileId: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(`${fileId}:`)) cache.delete(key);
  }
}
