import { describe, it, expect } from "vitest";
import { pdfX, pdfY, pdfWidth, pdfHeight, sanitizeFileName } from "../lib/pdfExport";

describe("PDF coordinate conversion", () => {
  const pageWidth = 595;
  const pageHeight = 842;

  it("pdfX converts relative x to PDF x", () => {
    expect(pdfX(0, pageWidth)).toBe(0);
    expect(pdfX(0.5, pageWidth)).toBeCloseTo(297.5);
    expect(pdfX(1, pageWidth)).toBe(pageWidth);
  });

  it("pdfY flips relative y to PDF y (origin at bottom)", () => {
    expect(pdfY(0, pageHeight)).toBe(pageHeight);
    expect(pdfY(0.5, pageHeight)).toBeCloseTo(421);
    expect(pdfY(1, pageHeight)).toBe(0);
  });

  it("pdfWidth converts relative width", () => {
    expect(pdfWidth(0.5, pageWidth)).toBeCloseTo(297.5);
    expect(pdfWidth(1, pageWidth)).toBe(pageWidth);
  });

  it("pdfHeight converts relative height", () => {
    expect(pdfHeight(0.5, pageHeight)).toBeCloseTo(421);
    expect(pdfHeight(1, pageHeight)).toBe(pageHeight);
  });

  it("coordinate round-trip preserves positions", () => {
    const relX = 0.3;
    const relY = 0.7;
    const absX = pdfX(relX, pageWidth);
    const absY = pdfY(relY, pageHeight);
    expect(absX / pageWidth).toBeCloseTo(relX);
    expect(1 - absY / pageHeight).toBeCloseTo(relY);
  });

  it("top-left corner maps to (0, pageHeight) in PDF", () => {
    expect(pdfX(0, pageWidth)).toBe(0);
    expect(pdfY(0, pageHeight)).toBe(pageHeight);
  });

  it("bottom-right corner maps to (pageWidth, 0) in PDF", () => {
    expect(pdfX(1, pageWidth)).toBe(pageWidth);
    expect(pdfY(1, pageHeight)).toBe(0);
  });
});

describe("sanitizeFileName", () => {
  it("removes invalid characters", () => {
    expect(sanitizeFileName('file<>:"/\\|?*.pdf')).toBe("file_.pdf");
  });

  it("adds .pdf extension if missing", () => {
    expect(sanitizeFileName("myfile")).toBe("myfile.pdf");
  });

  it("does not double .pdf", () => {
    expect(sanitizeFileName("myfile.pdf")).toBe("myfile.pdf");
  });

  it("truncates long names to 150 chars", () => {
    const long = "a".repeat(200);
    const result = sanitizeFileName(long);
    expect(result.length).toBeLessThanOrEqual(150);
    expect(result.endsWith(".pdf")).toBe(true);
  });

  it("replaces empty result with default", () => {
    expect(sanitizeFileName("")).toBe("annotated.pdf");
  });

  it("replaces control characters", () => {
    expect(sanitizeFileName("file\x00name.pdf")).toBe("file_name.pdf");
  });

  it("collapses multiple underscores", () => {
    expect(sanitizeFileName("a___b.pdf")).toBe("a_b.pdf");
  });
});
