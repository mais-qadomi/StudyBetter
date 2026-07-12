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
    return canvas.toDataURL("image/jpeg", 0.8);
  } catch {
    return null;
  }
}
