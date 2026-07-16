import { describe, it, expect } from "vitest";
import {
  textItemsToSegments,
  computeBoundingBox,
  buildFullText,
  extractPageTextFromItems,
  groupSegmentsIntoParagraphs,
  findBestPlacement,
} from "../lib/pdf-text-extract";
import type { TextItem } from "pdfjs-dist/types/src/display/api";

function makeTextItem(overrides: Partial<TextItem> & { str: string }): TextItem {
  return {
    dir: "ltr",
    transform: [12, 0, 0, -12, 72, 720],
    width: 100,
    height: 12,
    ...overrides,
  } as TextItem;
}

describe("textItemsToSegments", () => {
  const pageWidth = 595;
  const pageHeight = 842;

  it("converts a single text item to a relative segment", () => {
    const items = [makeTextItem({ str: "Hello", transform: [10, 0, 0, -10, 50, 800] })];
    const segments = textItemsToSegments(items, pageWidth, pageHeight);

    expect(segments).toHaveLength(1);
    expect(segments[0].text).toBe("Hello");
    expect(segments[0].x).toBeCloseTo(50 / 595, 4);
    expect(segments[0].y).toBeCloseTo((842 - 800) / 842, 4);
    expect(segments[0].width).toBeCloseTo(100 / 595, 4);
    expect(segments[0].height).toBeGreaterThan(0);
  });

  it("skips empty string items", () => {
    const items = [
      makeTextItem({ str: "" }),
      makeTextItem({ str: "  " }),
      makeTextItem({ str: "Real text" }),
    ];
    const segments = textItemsToSegments(items, pageWidth, pageHeight);
    expect(segments).toHaveLength(1);
    expect(segments[0].text).toBe("Real text");
  });

  it("clamps values to [0, 1]", () => {
    const items = [makeTextItem({ str: "Edge", transform: [10, 0, 0, -10, -10, 900] })];
    const segments = textItemsToSegments(items, pageWidth, pageHeight);
    expect(segments[0].x).toBe(0);
    expect(segments[0].y).toBe(0);
  });
});

describe("computeBoundingBox", () => {
  it("returns zero bbox for empty segments", () => {
    expect(computeBoundingBox([])).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });

  it("computes bounding box covering all segments", () => {
    const segments = [
      { text: "A", x: 0.1, y: 0.2, width: 0.05, height: 0.02 },
      { text: "B", x: 0.3, y: 0.1, width: 0.1, height: 0.03 },
    ];
    const bbox = computeBoundingBox(segments);
    expect(bbox.x).toBeCloseTo(0.1);
    expect(bbox.y).toBeCloseTo(0.1);
    expect(bbox.width).toBeCloseTo(0.3);
    expect(bbox.height).toBeCloseTo(0.12);
  });
});

describe("buildFullText", () => {
  it("joins segment texts with spaces", () => {
    const segments = [
      { text: "مرحبا", x: 0, y: 0, width: 0.1, height: 0.01 },
      { text: "بالعالم", x: 0.1, y: 0, width: 0.1, height: 0.01 },
    ];
    expect(buildFullText(segments)).toBe("مرحبا بالعالم");
  });

  it("collapses whitespace", () => {
    const segments = [
      { text: "  a  ", x: 0, y: 0, width: 0.1, height: 0.01 },
      { text: " b ", x: 0.1, y: 0, width: 0.1, height: 0.01 },
    ];
    expect(buildFullText(segments)).toBe("a b");
  });
});

describe("extractPageTextFromItems", () => {
  it("returns complete PageTextContent", () => {
    const items = [
      makeTextItem({ str: "Line 1", transform: [10, 0, 0, -10, 72, 700] }),
      makeTextItem({ str: "Line 2", transform: [10, 0, 0, -10, 72, 650] }),
    ];
    const result = extractPageTextFromItems(items, 595, 842);

    expect(result.fullText).toBe("Line 1 Line 2");
    expect(result.segments).toHaveLength(2);
    expect(result.boundingBox.width).toBeGreaterThan(0);
    expect(result.boundingBox.height).toBeGreaterThan(0);
  });
});

describe("groupSegmentsIntoParagraphs", () => {
  it("returns empty for no segments", () => {
    expect(groupSegmentsIntoParagraphs([])).toEqual([]);
  });

  it("groups segments on the same line into one paragraph", () => {
    const segs = [
      { text: "Hello", x: 0.1, y: 0.2, width: 0.1, height: 0.02 },
      { text: "World", x: 0.25, y: 0.2, width: 0.1, height: 0.02 },
    ];
    const paras = groupSegmentsIntoParagraphs(segs);
    expect(paras).toHaveLength(1);
    expect(paras[0].text).toBe("Hello World");
  });

  it("groups close lines into one paragraph", () => {
    const segs = [
      { text: "Line1", x: 0.1, y: 0.2, width: 0.1, height: 0.02 },
      { text: "Line2", x: 0.1, y: 0.23, width: 0.1, height: 0.02 },
    ];
    const paras = groupSegmentsIntoParagraphs(segs);
    expect(paras).toHaveLength(1);
    expect(paras[0].text).toBe("Line1 Line2");
  });

  it("splits into separate paragraphs when gap is large", () => {
    const segs = [
      { text: "Para1", x: 0.1, y: 0.1, width: 0.1, height: 0.02 },
      { text: "Para2", x: 0.1, y: 0.5, width: 0.1, height: 0.02 },
    ];
    const paras = groupSegmentsIntoParagraphs(segs);
    expect(paras).toHaveLength(2);
    expect(paras[0].text).toBe("Para1");
    expect(paras[1].text).toBe("Para2");
  });

  it("computes correct bounding box for paragraph", () => {
    const segs = [
      { text: "A", x: 0.1, y: 0.2, width: 0.05, height: 0.02 },
      { text: "B", x: 0.2, y: 0.21, width: 0.05, height: 0.02 },
    ];
    const paras = groupSegmentsIntoParagraphs(segs);
    expect(paras[0].x).toBeCloseTo(0.1);
    expect(paras[0].y).toBeCloseTo(0.2);
    expect(paras[0].width).toBeCloseTo(0.15);
  });
});

describe("findBestPlacement", () => {
  it("places below when space is available", () => {
    const result = findBestPlacement(
      0.3, // paraBottom
      0.2, // paraTop
      0.9, // paraRight
      0.1, // paraLeft
      0.08, // explanationHeight
      [],   // occupiedZones
    );
    expect(result).not.toBeNull();
    expect(result!.y).toBeGreaterThan(0.3);
  });

  it("places above when below is occupied", () => {
    const occupied = [{ x: 0.1, y: 0.31, width: 0.8, height: 0.1 }];
    const result = findBestPlacement(
      0.3, 0.2, 0.9, 0.1, 0.08, occupied,
    );
    expect(result).not.toBeNull();
    expect(result!.y).toBeLessThan(0.2);
  });

  it("returns null when no space is available", () => {
    const occupied = [
      { x: 0, y: 0, width: 1, height: 0.25 },
      { x: 0, y: 0.25, width: 1, height: 0.75 },
    ];
    const result = findBestPlacement(
      0.25, 0.2, 0.9, 0.1, 0.08, occupied,
    );
    expect(result).toBeNull();
  });
});
