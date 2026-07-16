import { pdfjs } from "react-pdf";

export type PageType = "text" | "image" | "mixed";

export interface PageAnalysis {
  pageNumber: number;
  type: PageType;
  wordCount: number;
}

const TEXT_WORD_THRESHOLD = 15;
const MIN_TEXT_WORD_THRESHOLD = 3;

export async function classifyPage(
  page: pdfjs.PDFPageProxy,
  pageNumber: number,
): Promise<PageAnalysis> {
  const content = await page.getTextContent();
  const extracted = content.items
    .map((item) => ("str" in item ? item.str : ""))
    .join(" ");
  const wordCount = extracted.split(/\s+/).filter(Boolean).length;

  let type: PageType;
  if (wordCount >= TEXT_WORD_THRESHOLD) {
    type = "text";
  } else if (wordCount >= MIN_TEXT_WORD_THRESHOLD) {
    type = "mixed";
  } else {
    type = "image";
  }

  return { pageNumber, type, wordCount };
}

export function capturePageCanvas(wrapperEl: HTMLElement): string | null {
  try {
    const canvas = wrapperEl.querySelector("canvas");
    if (!canvas) return null;

    const MAX_DIMENSION = 1200;
    let width = canvas.width;
    let height = canvas.height;

    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }

    const offscreen = document.createElement("canvas");
    offscreen.width = width;
    offscreen.height = height;
    const ctx = offscreen.getContext("2d");
    if (!ctx) return canvas.toDataURL("image/jpeg", 0.6);
    ctx.drawImage(canvas, 0, 0, width, height);

    let dataUrl = offscreen.toDataURL("image/jpeg", 0.6);
    if (dataUrl.length > 4 * 1024 * 1024) {
      dataUrl = offscreen.toDataURL("image/jpeg", 0.3);
    }
    return dataUrl;
  } catch {
    return null;
  }
}
