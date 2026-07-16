export const ANNOTATION_TYPES = ["text", "image", "drawing", "shape", "ai_explanation"] as const;
export type AnnotationType = (typeof ANNOTATION_TYPES)[number];

export const SHAPE_TYPES = ["rectangle", "ellipse", "line", "arrow"] as const;
export type ShapeType = (typeof SHAPE_TYPES)[number];

export const DRAWING_TOOLS = ["pen", "highlighter", "eraser"] as const;
export type DrawingTool = (typeof DRAWING_TOOLS)[number];

export interface RelativeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface TextData extends RelativeRect {
  content: string;
  fontSize: number;
  color: string;
  fontFamily?: string;
}

export interface ImageData extends RelativeRect {
  imageBlobId: string;
}

export interface DrawingData {
  points: Point[];
  strokeColor: string;
  strokeWidth: number;
  tool: DrawingTool;
}

export interface ShapeData extends RelativeRect {
  shapeType: ShapeType;
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
}

export interface AiExplanationData extends RelativeRect {
  source: "ai";
  sourceText: string;
  content: string;
  fontSize: number;
  color: string;
  fontFamily?: string;
}

export type AnnotationData =
  | TextData
  | ImageData
  | DrawingData
  | ShapeData
  | AiExplanationData;

export interface AnnotationElement {
  id: string;
  fileId: string;
  pageNumber: number;
  type: AnnotationType;
  data: AnnotationData;
  zIndex: number;
  createdAt: number;
  updatedAt: number;
}

export interface AnnotationFile {
  fileId: string;
  pageCount: number;
  deletedPages: number[];
  createdAt: number;
  updatedAt: number;
}

export interface AnnotationImage {
  id: string;
  fileId: string;
  blob: Blob;
  mimeType: string;
}
