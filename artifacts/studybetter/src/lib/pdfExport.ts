import { PDFDocument, StandardFonts, rgb, type PDFPage } from "pdf-lib";
import { getAllAnnotations, getAnnotationFile } from "./annotationStorage";
import { getImageBlobUrl } from "./annotationStorage";
import { loadPdfFromIDB } from "./storage";
import type {
  AnnotationElement,
  TextData,
  AiExplanationData,
  DrawingData,
  ShapeData,
  ImageData,
} from "./annotation-types";

// ── Coordinate conversion ──

export function pdfX(relX: number, pageWidth: number): number {
  return relX * pageWidth;
}

export function pdfY(relY: number, pageHeight: number): number {
  return pageHeight - relY * pageHeight;
}

export function pdfWidth(relW: number, pageWidth: number): number {
  return relW * pageWidth;
}

export function pdfHeight(relH: number, pageHeight: number): number {
  return relH * pageHeight;
}

// ── Color parsing ──

function parseColor(hex: string): ReturnType<typeof rgb> {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16) / 255;
  const g = parseInt(h.substring(2, 4), 16) / 255;
  const b = parseInt(h.substring(4, 6), 16) / 255;
  return rgb(r, g, b);
}

function parseOpacity(hex: string): { color: ReturnType<typeof rgb>; opacity: number } {
  if (hex.length === 9) {
    const h = hex.substring(0, 7);
    const a = parseInt(hex.substring(7, 9), 16) / 255;
    return { color: parseColor(h), opacity: a };
  }
  return { color: parseColor(hex), opacity: 1 };
}

// ── Font loading ──

let _cachedFont: any = null;
let _fontLoadAttempted = false;

async function getArabicFont(doc: PDFDocument): Promise<any> {
  if (_cachedFont) return _cachedFont;
  if (_fontLoadAttempted) return null;
  _fontLoadAttempted = true;

  try {
    const res = await fetch(
      "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400&display=swap",
      { headers: { Accept: "text/css" } },
    );
    const css = await res.text();
    const urlMatch = css.match(/url\(([^)]+)\)/);
    if (!urlMatch) return null;

    let fontUrl = urlMatch[1];
    if (fontUrl.startsWith("//")) fontUrl = "https:" + fontUrl;

    const fontRes = await fetch(fontUrl);
    if (!fontRes.ok) return null;

    const contentType = fontRes.headers.get("content-type") ?? "";
    if (contentType.includes("woff") || contentType.includes("woff2")) {
      return null;
    }

    const buffer = await fontRes.arrayBuffer();
    _cachedFont = await doc.embedFont(new Uint8Array(buffer));
    return _cachedFont;
  } catch {
    return null;
  }
}

// ── Drawing helpers ──

async function drawTextAnnotation(
  page: PDFPage,
  el: AnnotationElement,
  font: any,
  fallbackFont: any,
) {
  const d = el.data as TextData;
  const w = page.getWidth();
  const h = page.getHeight();
  const x = pdfX(d.x, w);
  const y = pdfY(d.y + d.height, h);
  const fontSize = d.fontSize * (w / 800);
  const useFont = font ?? fallbackFont;
  const text = d.content.substring(0, 500);

  const { color, opacity } = parseOpacity(d.color);

  page.drawRectangle({
    x,
    y: pdfY(d.y + d.height, h),
    width: pdfWidth(d.width, w),
    height: pdfHeight(d.height, h),
    color: rgb(1, 1, 1),
    opacity: 0.85,
  });

  page.drawText(text, {
    x: x + 4,
    y: y + fontSize * 0.3,
    size: fontSize,
    font: useFont,
    color,
    opacity,
    maxWidth: pdfWidth(d.width, w) - 8,
  });
}

async function drawAiExplanation(
  page: PDFPage,
  el: AnnotationElement,
  font: any,
  fallbackFont: any,
) {
  const d = el.data as AiExplanationData;
  const w = page.getWidth();
  const h = page.getHeight();
  const fontSize = d.fontSize * (w / 800);
  const useFont = font ?? fallbackFont;
  const x = pdfX(d.x, w);
  const yStart = pdfY(d.y + d.height, h);

  page.drawRectangle({
    x,
    y: yStart,
    width: pdfWidth(d.width, w),
    height: pdfHeight(d.height, h),
    color: rgb(0.545, 0.361, 0.965),
    opacity: 0.08,
    borderColor: rgb(0.545, 0.361, 0.965),
    borderWidth: 1.5,
    borderRadius: 6,
  });

  const content = d.content;
  const maxWidth = pdfWidth(d.width, w) - 12;
  const lineHeight = fontSize * 1.4;
  const lines = wrapText(content, useFont, fontSize, maxWidth);
  let curY = yStart + pdfHeight(d.height, h) - fontSize - 4;

  for (const line of lines) {
    if (curY < yStart + 4) break;
    page.drawText(line, {
      x: x + 6,
      y: curY,
      size: fontSize,
      font: useFont,
      color: rgb(0.427, 0.157, 0.851),
      opacity: 1,
    });
    curY -= lineHeight;
  }
}

function wrapText(text: string, font: any, fontSize: number, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const test = current ? current + " " + word : word;
    const width = font.widthOfTextAtSize(test, fontSize);
    if (width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

function drawDrawing(
  page: PDFPage,
  el: AnnotationElement,
) {
  const d = el.data as DrawingData;
  const w = page.getWidth();
  const h = page.getHeight();
  const { color, opacity } = parseOpacity(d.strokeColor);

  for (let i = 0; i < d.points.length - 1; i++) {
    const p1 = d.points[i];
    const p2 = d.points[i + 1];
    page.drawLine({
      start: { x: pdfX(p1.x, w), y: pdfY(p1.y, h) },
      end: { x: pdfX(p2.x, w), y: pdfY(p2.y, h) },
      thickness: d.strokeWidth,
      color,
      opacity,
    });
  }
}

function drawShape(
  page: PDFPage,
  el: AnnotationElement,
) {
  const d = el.data as ShapeData;
  const w = page.getWidth();
  const h = page.getHeight();
  const x = pdfX(d.x, w);
  const y = pdfY(d.y + d.height, h);
  const shapeW = pdfWidth(d.width, w);
  const shapeH = pdfHeight(d.height, h);
  const { color: strokeColor } = parseOpacity(d.strokeColor);
  const fillColor = d.fillColor === "transparent" ? undefined : parseColor(d.fillColor);

  if (d.shapeType === "rectangle") {
    page.drawRectangle({
      x, y, width: shapeW, height: shapeH,
      borderColor: strokeColor,
      borderWidth: d.strokeWidth,
      color: fillColor,
    });
  } else if (d.shapeType === "ellipse") {
    page.drawEllipse({
      x: x + shapeW / 2,
      y: y + shapeH / 2,
      xScale: shapeW / 2,
      yScale: shapeH / 2,
      borderColor: strokeColor,
      borderWidth: d.strokeWidth,
      color: fillColor,
    });
  } else if (d.shapeType === "line") {
    page.drawLine({
      start: { x, y },
      end: { x: x + shapeW, y: y + shapeH },
      thickness: d.strokeWidth,
      color: strokeColor,
    });
  } else if (d.shapeType === "arrow") {
    page.drawLine({
      start: { x, y },
      end: { x: x + shapeW, y: y + shapeH },
      thickness: d.strokeWidth,
      color: strokeColor,
    });
    const angle = Math.atan2(shapeH, shapeW);
    const headLen = 10;
    page.drawLine({
      start: { x: x + shapeW, y: y + shapeH },
      end: {
        x: x + shapeW - headLen * Math.cos(angle - Math.PI / 6),
        y: y + shapeH - headLen * Math.sin(angle - Math.PI / 6),
      },
      thickness: d.strokeWidth,
      color: strokeColor,
    });
    page.drawLine({
      start: { x: x + shapeW, y: y + shapeH },
      end: {
        x: x + shapeW - headLen * Math.cos(angle + Math.PI / 6),
        y: y + shapeH - headLen * Math.sin(angle + Math.PI / 6),
      },
      thickness: d.strokeWidth,
      color: strokeColor,
    });
  }
}

async function drawImage(
  page: PDFPage,
  el: AnnotationElement,
  doc: PDFDocument,
) {
  const d = el.data as ImageData;
  const w = page.getWidth();
  const h = page.getHeight();

  try {
    const blobUrl = await getImageBlobUrl(d.imageBlobId);
    if (!blobUrl) {
      console.warn(`Image blob not found for ${d.imageBlobId}, skipping`);
      return;
    }

    const res = await fetch(blobUrl);
    const buffer = await res.arrayBuffer();
    URL.revokeObjectURL(blobUrl);

    let embeddedImage: any;
    if (el.data && "mimeType" in el.data) {
      const mime = (el.data as any).mimeType;
      if (mime?.includes("png")) {
        embeddedImage = await doc.embedPng(new Uint8Array(buffer));
      } else {
        embeddedImage = await doc.embedJpg(new Uint8Array(buffer));
      }
    } else {
      embeddedImage = await doc.embedJpg(new Uint8Array(buffer));
    }

    page.drawImage(embeddedImage, {
      x: pdfX(d.x, w),
      y: pdfY(d.y + d.height, h),
      width: pdfWidth(d.width, w),
      height: pdfHeight(d.height, h),
    });
  } catch (err) {
    console.warn(`Failed to draw image annotation ${el.id}:`, err);
  }
}

// ── Output name sanitization ──

export function sanitizeFileName(name: string): string {
  let sanitized = name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_");
  sanitized = sanitized.replace(/_+/g, "_").replace(/^_+|_+$/g, "");
  if (!sanitized) sanitized = "annotated";
  if (!sanitized.endsWith(".pdf")) sanitized += ".pdf";
  if (sanitized.length > 150) sanitized = sanitized.substring(0, 146) + ".pdf";
  return sanitized;
}

// ── Main export ──

export interface ExportOptions {
  selectedPages?: number[];
  outputName: string;
}

export async function exportAnnotatedPdf(
  fileId: string,
  options: ExportOptions,
  onProgress?: (msg: string) => void,
): Promise<Blob> {
  onProgress?.("جاري تحميل الملف الأصلي...");

  const sourceFile = await loadPdfFromIDB(fileId);
  if (!sourceFile) throw new Error("الملف الأصلي غير موجود");

  const sourceBuffer = await sourceFile.arrayBuffer();
  const srcDoc = await PDFDocument.load(sourceBuffer);

  const record = await getAnnotationFile(fileId);
  const deletedPages = record?.deletedPages ?? [];

  const allAnnotations = await getAllAnnotations(fileId);

  const totalPages = srcDoc.getPageCount();
  let pagesToInclude = options.selectedPages
    ?? Array.from({ length: totalPages }, (_, i) => i + 1);
  pagesToInclude = pagesToInclude.filter((p) => !deletedPages.includes(p));

  if (pagesToInclude.length === 0) {
    throw new Error("اختر صفحة واحدة على الأقل للتصدير");
  }

  onProgress?.("جاري إنشاء الملف...");

  const outDoc = await PDFDocument.create();
  const font = await getArabicFont(outDoc);
  const fallbackFont = await outDoc.embedFont(StandardFonts.Helvetica);

  const copiedPages = await outDoc.copyPages(srcDoc, pagesToInclude.map((p) => p - 1));

  for (let i = 0; i < copiedPages.length; i++) {
    const outPage = copiedPages[i];
    const origPageNum = pagesToInclude[i];
    const pageAnnotations = (allAnnotations[origPageNum] ?? [])
      .sort((a, b) => a.zIndex - b.zIndex);

    onProgress?.(`جاري رسم الصفحة ${origPageNum} (${i + 1}/${pagesToInclude.length})...`);

    for (const el of pageAnnotations) {
      switch (el.type) {
        case "text":
          await drawTextAnnotation(outPage, el, font, fallbackFont);
          break;
        case "ai_explanation":
          await drawAiExplanation(outPage, el, font, fallbackFont);
          break;
        case "drawing":
          drawDrawing(outPage, el);
          break;
        case "shape":
          drawShape(outPage, el);
          break;
        case "image":
          await drawImage(outPage, el, outDoc);
          break;
      }
    }

    outPage.addOutgoingLink(outPage);
  }

  onProgress?.("جاري الحفظ...");
  const pdfBytes = await outDoc.save();
  return new Blob([pdfBytes], { type: "application/pdf" });
}

// ── Download trigger ──

export function triggerDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = sanitizeFileName(fileName);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
