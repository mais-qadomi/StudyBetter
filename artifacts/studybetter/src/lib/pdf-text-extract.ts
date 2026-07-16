import type { TextItem } from "pdfjs-dist/types/src/display/api";

export interface TextSegment {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PageTextContent {
  fullText: string;
  segments: TextSegment[];
  boundingBox: { x: number; y: number; width: number; height: number };
}

export function textItemsToSegments(
  items: TextItem[],
  pageWidth: number,
  pageHeight: number,
): TextSegment[] {
  const segments: TextSegment[] = [];

  for (const item of items) {
    if (!("str" in item) || !item.str.trim()) continue;

    const [, , , , e, f] = item.transform;

    const x = e / pageWidth;
    const y = (pageHeight - f) / pageHeight;
    const width = item.width / pageWidth;
    const height = (item.height ?? Math.abs(item.transform[3])) / pageHeight;

    segments.push({
      text: item.str,
      x: Math.max(0, Math.min(1, x)),
      y: Math.max(0, Math.min(1, y)),
      width: Math.max(0, Math.min(1, width)),
      height: Math.max(0, Math.min(1, height)),
    });
  }

  return segments;
}

export function computeBoundingBox(segments: TextSegment[]): { x: number; y: number; width: number; height: number } {
  if (segments.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const s of segments) {
    if (s.x < minX) minX = s.x;
    if (s.y < minY) minY = s.y;
    const right = s.x + s.width;
    const bottom = s.y + s.height;
    if (right > maxX) maxX = right;
    if (bottom > maxY) maxY = bottom;
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export function buildFullText(segments: TextSegment[]): string {
  return segments
    .map((s) => s.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractPageTextFromItems(
  items: TextItem[],
  pageWidth: number,
  pageHeight: number,
): PageTextContent {
  const segments = textItemsToSegments(items, pageWidth, pageHeight);
  const fullText = buildFullText(segments);
  const boundingBox = computeBoundingBox(segments);

  return { fullText, segments, boundingBox };
}

// ── Paragraph grouping ──

export interface Paragraph {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  avgFontSize: number;
}

const LINE_Y_EPSILON = 0.008;
const PARAGRAPH_GAP_THRESHOLD = 0.018;

export function groupSegmentsIntoParagraphs(segments: TextSegment[]): Paragraph[] {
  if (segments.length === 0) return [];

  const sorted = [...segments].sort((a, b) => a.y - b.y || a.x - b.x);

  const lines: TextSegment[][] = [];
  let currentLine: TextSegment[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const seg = sorted[i];
    const lastInLine = currentLine[currentLine.length - 1];
    if (Math.abs(seg.y - lastInLine.y) < LINE_Y_EPSILON) {
      currentLine.push(seg);
    } else {
      lines.push(currentLine);
      currentLine = [seg];
    }
  }
  lines.push(currentLine);

  const paragraphs: Paragraph[] = [];
  let currentPara: TextSegment[][] = [lines[0]];

  for (let i = 1; i < lines.length; i++) {
    const prevLineBottom = Math.max(...currentPara[currentPara.length - 1].map((s) => s.y + s.height));
    const thisLineTop = lines[i][0].y;
    const gap = thisLineTop - prevLineBottom;

    if (gap < PARAGRAPH_GAP_THRESHOLD) {
      currentPara.push(lines[i]);
    } else {
      paragraphs.push(buildParagraph(currentPara));
      currentPara = [lines[i]];
    }
  }
  paragraphs.push(buildParagraph(currentPara));

  return paragraphs;
}

function buildParagraph(lineGroups: TextSegment[][]): Paragraph {
  const allSegs = lineGroups.flat();
  const text = allSegs
    .map((s) => s.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let totalH = 0;
  for (const s of allSegs) {
    if (s.x < minX) minX = s.x;
    if (s.y < minY) minY = s.y;
    const r = s.x + s.width;
    const b = s.y + s.height;
    if (r > maxX) maxX = r;
    if (b > maxY) maxY = b;
    totalH += s.height;
  }

  return {
    text,
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
    avgFontSize: totalH / allSegs.length,
  };
}

export function findBestPlacement(
  paraBottom: number,
  paraTop: number,
  paraRight: number,
  paraLeft: number,
  explanationHeight: number,
  occupiedZones: { y: number; height: number; x: number; width: number }[],
  pageWidth: number = 1,
): { x: number; y: number; width: number } | null {
  const MARGIN = 0.005;

  const fitsInGap = (y: number, h: number, x: number, w: number): boolean => {
    if (y < 0 || y + h > 1) return false;
    if (x < 0 || x + w > pageWidth) return false;
    for (const zone of occupiedZones) {
      const overlapX = x < zone.x + zone.width && x + w > zone.x;
      const overlapY = y < zone.y + zone.height && y + h > zone.y;
      if (overlapX && overlapY) return false;
    }
    return true;
  };

  // 1. Below: gap from paraBottom to next content (assume next para top or page bottom)
  const belowY = paraBottom + MARGIN;
  if (fitsInGap(belowY, explanationHeight, paraLeft, paraRight - paraLeft)) {
    return { x: paraLeft, y: belowY, width: paraRight - paraLeft };
  }

  // 2. Above: gap from previous content bottom to paraTop
  const aboveY = paraTop - explanationHeight - MARGIN;
  if (aboveY >= 0 && fitsInGap(aboveY, explanationHeight, paraLeft, paraRight - paraLeft)) {
    return { x: paraLeft, y: aboveY, width: paraRight - paraLeft };
  }

  // 3. Try below with smaller height (70%)
  const smallH = explanationHeight * 0.7;
  const smallBelowY = paraBottom + MARGIN;
  if (fitsInGap(smallBelowY, smallH, paraLeft, paraRight - paraLeft)) {
    return { x: paraLeft, y: smallBelowY, width: paraRight - paraLeft };
  }

  // 4. Try above with smaller height
  const smallAboveY = paraTop - smallH - MARGIN;
  if (smallAboveY >= 0 && fitsInGap(smallAboveY, smallH, paraLeft, paraRight - paraLeft)) {
    return { x: paraLeft, y: smallAboveY, width: paraRight - paraLeft };
  }

  return null;
}
