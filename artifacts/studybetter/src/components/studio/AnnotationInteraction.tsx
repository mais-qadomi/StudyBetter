import { useRef, useState, useCallback, useEffect } from "react";
import { Stage, Layer, Line, Rect, Ellipse, Arrow, Transformer } from "react-konva";
import { useAnnotationStore, type Tool } from "../../stores/annotationStore";
import type {
  Point,
  DrawingData,
  ShapeData,
  TextData,
  ImageData,
} from "../../lib/annotation-types";
import { AnnotationRenderer } from "./annotation-renderers";

interface Props {
  fileId: string;
  pageNumber: number;
  width: number;
  height: number;
}

export default function AnnotationInteraction({
  fileId,
  pageNumber,
  width,
  height,
}: Props) {
  const stageRef = useRef<any>(null);
  const transformerRef = useRef<any>(null);

  const tool = useAnnotationStore((s) => s.selectedTool);
  const shapeType = useAnnotationStore((s) => s.selectedShapeType);
  const elementsByPage = useAnnotationStore((s) => s.elementsByPage);
  const selectedElementId = useAnnotationStore((s) => s.selectedElementId);
  const addElement = useAnnotationStore((s) => s.addElement);
  const updateElement = useAnnotationStore((s) => s.updateElement);
  const deleteElement = useAnnotationStore((s) => s.deleteElement);
  const selectElement = useAnnotationStore((s) => s.selectElement);
  const setPageElements = useAnnotationStore((s) => s.setPageElements);
  const loadAll = useAnnotationStore((s) => s.loadAll);
  const fileIdFromStore = useAnnotationStore((s) => s.fileId);

  const elements = elementsByPage[pageNumber] ?? [];

  // Interaction state
  const [drawingPoints, setDrawingPoints] = useState<Point[]>([]);
  const [dragStart, setDragStart] = useState<Point | null>(null);
  const [dragCurrent, setDragCurrent] = useState<Point | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [textEditPos, setTextEditPos] = useState<{ x: number; y: number } | null>(null);

  // Load annotations when page becomes visible
  useEffect(() => {
    if (fileIdFromStore && elements.length === 0) {
      loadAll();
    }
  }, [fileIdFromStore, pageNumber]);

  // Transformer attachment
  useEffect(() => {
    if (!transformerRef.current || !stageRef.current) return;
    const stage = stageRef.current;
    if (selectedElementId && tool === "select") {
      const node = stage.findOne(`#${selectedElementId}`);
      if (node) {
        transformerRef.current.nodes([node]);
        transformerRef.current.getLayer()?.batchDraw();
      }
    } else {
      transformerRef.current.nodes([]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [selectedElementId, tool, elements]);

  // ── Coordinate helpers ──

  const getPointerPos = useCallback((): Point | null => {
    const stage = stageRef.current;
    if (!stage) return null;
    const pos = stage.getPointerPosition();
    if (!pos) return null;
    return { x: pos.x / width, y: pos.y / height };
  }, [width, height]);

  const getPixelPos = useCallback((): Point | null => {
    const stage = stageRef.current;
    if (!stage) return null;
    const pos = stage.getPointerPosition();
    if (!pos) return null;
    return { x: pos.x, y: pos.y };
  }, []);

  // ── Event handlers ──

  const handlePointerDown = useCallback((e: any) => {
    const stage = e.target.getStage();
    const pos = getPointerPos();
    if (!pos) return;

    const clickedOnEmpty = e.target === stage || e.target.name?.() === "background";

    if (tool === "select") {
      if (clickedOnEmpty) {
        selectElement(null);
      }
      return;
    }

    if (tool === "text") {
      if (clickedOnEmpty) {
        const pixelPos = getPixelPos();
        if (pixelPos) setTextEditPos(pixelPos);
      }
      return;
    }

    if (tool === "pen" || tool === "highlighter") {
      setIsDrawing(true);
      setDrawingPoints([pos]);
      return;
    }

    if (tool === "eraser") {
      setIsDrawing(true);
      // Check for collision with existing elements
      checkEraserCollision(pos);
      return;
    }

    if (tool === "shape" || tool === "image") {
      setIsDrawing(true);
      setDragStart(pos);
      setDragCurrent(pos);
      return;
    }
  }, [tool, shapeType, getPointerPos, getPixelPos, selectElement]);

  const handlePointerMove = useCallback((e: any) => {
    if (!isDrawing) return;
    const pos = getPointerPos();
    if (!pos) return;

    if (tool === "pen" || tool === "highlighter") {
      setDrawingPoints((prev) => [...prev, pos]);
      return;
    }

    if (tool === "eraser") {
      checkEraserCollision(pos);
      return;
    }

    if (tool === "shape" || tool === "image") {
      setDragCurrent(pos);
      return;
    }
  }, [isDrawing, tool, getPointerPos]);

  const handlePointerUp = useCallback(() => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (tool === "pen" || tool === "highlighter") {
      if (drawingPoints.length >= 2) {
        addElement(pageNumber, "drawing", {
          points: drawingPoints,
          strokeColor: tool === "highlighter" ? "rgba(255, 230, 0, 0.4)" : "#000000",
          strokeWidth: tool === "highlighter" ? 12 : 2,
          tool: tool,
        } as DrawingData);
      }
      setDrawingPoints([]);
      return;
    }

    if (tool === "shape" && dragStart && dragCurrent) {
      const x = Math.min(dragStart.x, dragCurrent.x);
      const y = Math.min(dragStart.y, dragCurrent.y);
      const w = Math.abs(dragCurrent.x - dragStart.x);
      const h = Math.abs(dragCurrent.y - dragStart.y);
      if (w > 0.005 || h > 0.005) {
        addElement(pageNumber, "shape", {
          x, y, width: w, height: h,
          shapeType,
          strokeColor: "#000000",
          fillColor: "transparent",
          strokeWidth: 2,
        } as ShapeData);
      }
      setDragStart(null);
      setDragCurrent(null);
      return;
    }

    if (tool === "image" && dragStart && dragCurrent) {
      // The image paste/upload is handled separately via the custom event
      setDragStart(null);
      setDragCurrent(null);
      return;
    }
  }, [isDrawing, tool, drawingPoints, dragStart, dragCurrent, shapeType, pageNumber, addElement]);

  // ── Eraser collision ──

  const checkEraserCollision = useCallback((pos: Point) => {
    const hitRadius = 0.02;
    for (const el of elements) {
      if (el.type === "drawing" || el.type === "shape") {
        const data = el.data as any;
        if ("x" in data) {
          // Rect-based element
          if (
            pos.x >= data.x - hitRadius &&
            pos.x <= data.x + data.width + hitRadius &&
            pos.y >= data.y - hitRadius &&
            pos.y <= data.y + data.height + hitRadius
          ) {
            deleteElement(el.id);
            return;
          }
        } else if ("points" in data) {
          // Drawing - check proximity to any point
          for (const pt of data.points) {
            const dx = pos.x - pt.x;
            const dy = pos.y - pt.y;
            if (Math.sqrt(dx * dx + dy * dy) < hitRadius) {
              deleteElement(el.id);
              return;
            }
          }
        }
      }
    }
  }, [elements, deleteElement]);

  // ── Text tool: HTML textarea overlay ──

  const handleTextSubmit = useCallback((content: string) => {
    if (content.trim() && textEditPos) {
      addElement(pageNumber, "text", {
        x: textEditPos.x / width,
        y: textEditPos.y / height,
        width: 0.25,
        height: 0.05,
        content: content.trim(),
        fontSize: 14,
        color: "#000000",
      } as TextData);
    }
    setTextEditPos(null);
  }, [textEditPos, pageNumber, width, height, addElement]);

  // ── Image paste handler ──

  useEffect(() => {
    const handler = async (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail?.blob) return;
      const blob: Blob = detail.blob;
      const mimeType: string = detail.mimeType || blob.type || "image/png";

      const { saveImage, addElement: add } = useAnnotationStore.getState();
      const imageBlobId = await saveImage(blob, mimeType);

      // Default position at center of page
      add(pageNumber, "image", {
        x: 0.3,
        y: 0.3,
        width: 0.4,
        height: 0.3,
        imageBlobId,
      } as ImageData);
    };
    window.addEventListener("annotation:paste-image", handler);
    return () => window.removeEventListener("annotation:paste-image", handler);
  }, [pageNumber]);

  // ── Clipboard paste ──

  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      if (tool !== "image") return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const blob = item.getAsFile();
          if (blob) {
            window.dispatchEvent(
              new CustomEvent("annotation:paste-image", {
                detail: { blob, mimeType: blob.type },
              }),
            );
          }
          break;
        }
      }
    };
    window.addEventListener("paste", handler);
    return () => window.removeEventListener("paste", handler);
  }, [tool]);

  // ── Render helpers ──

  const renderTemporaryLine = () => {
    if (!isDrawing || (tool !== "pen" && tool !== "highlighter")) return null;
    if (drawingPoints.length < 2) return null;
    const flat: number[] = [];
    for (const pt of drawingPoints) {
      flat.push(pt.x * width, pt.y * height);
    }
    return (
      <Line
        points={flat}
        stroke={tool === "highlighter" ? "rgba(255, 230, 0, 0.4)" : "#000000"}
        strokeWidth={tool === "highlighter" ? 12 : 2}
        lineCap="round"
        lineJoin="round"
        tension={0.5}
        listening={false}
      />
    );
  };

  const renderTemporaryShape = () => {
    if (!isDrawing || tool !== "shape" || !dragStart || !dragCurrent) return null;
    const x = Math.min(dragStart.x, dragCurrent.x) * width;
    const y = Math.min(dragStart.y, dragCurrent.y) * height;
    const w = Math.abs(dragCurrent.x - dragStart.x) * width;
    const h = Math.abs(dragCurrent.y - dragStart.y) * height;

    if (shapeType === "rectangle") {
      return <Rect x={x} y={y} width={w} height={h} stroke="#000000" strokeWidth={2} dash={[5, 3]} listening={false} />;
    }
    if (shapeType === "ellipse") {
      return <Ellipse x={x + w / 2} y={y + h / 2} radiusX={w / 2} radiusY={h / 2} stroke="#000000" strokeWidth={2} dash={[5, 3]} listening={false} />;
    }
    if (shapeType === "line") {
      return <Line points={[x, y, x + w, y + h]} stroke="#000000" strokeWidth={2} dash={[5, 3]} listening={false} />;
    }
    if (shapeType === "arrow") {
      return <Arrow points={[x, y, x + w, y + h]} stroke="#000000" strokeWidth={2} fill="#000000" pointerLength={10} pointerWidth={8} dash={[5, 3]} listening={false} />;
    }
    return null;
  };

  const renderEraserCursor = () => {
    if (tool !== "eraser" || !isDrawing) return null;
    const pos = getPixelPos();
    if (!pos) return null;
    return (
      <Rect
        x={pos.x - 10}
        y={pos.y - 10}
        width={20}
        height={20}
        stroke="#ff0000"
        strokeWidth={1.5}
        cornerRadius={3}
        listening={false}
      />
    );
  };

  // Determine cursor
  const cursorMap: Record<Tool, string> = {
    select: "default",
    text: "text",
    image: "crosshair",
    pen: "crosshair",
    highlighter: "crosshair",
    eraser: "crosshair",
    shape: "crosshair",
  };

  return (
    <>
      <Stage
        ref={stageRef}
        width={width}
        height={height}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          cursor: cursorMap[tool],
        }}
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerUp}
      >
        <Layer name="background" />
        <Layer>
          {elements.map((el) => (
            <AnnotationRenderer
              key={el.id}
              element={el}
              canvasWidth={width}
              canvasHeight={height}
              tool={tool}
              onSelect={(id) => selectElement(id)}
              onDragEnd={(id, px, py) => {
                const el = elements.find((e) => e.id === id);
                if (el && "x" in el.data) {
                  updateElement(id, {
                    data: { ...el.data as any, x: px / width, y: py / height },
                  });
                }
              }}
            />
          ))}
          {renderTemporaryLine()}
          {renderTemporaryShape()}
          {renderEraserCursor()}
          <Transformer
            ref={transformerRef}
            rotateEnabled={false}
            borderStroke="#2563eb"
            borderStrokeWidth={1.5}
            anchorSize={8}
            anchorCornerRadius={2}
            enabledAnchors={[
              "top-left", "top-right", "bottom-left", "bottom-right",
              "middle-left", "middle-right", "top-center", "bottom-center",
            ]}
            boundBoxFunc={(oldBox: any, newBox: any) => {
              if (newBox.width < 10 || newBox.height < 10) return oldBox;
              return newBox;
            }}
            onTransformEnd={() => {
              const node = transformerRef.current?.nodes()?.[0];
              if (!node) return;
              const id = node.id();
              const scaleX = node.scaleX();
              const scaleY = node.scaleY();
              node.scaleX(1);
              node.scaleY(1);
              const newX = node.x() / width;
              const newY = node.y() / height;
              const newW = (node.width() * scaleX) / width;
              const newH = (node.height() * scaleY) / height;
              // Clamp to [0,1]
              const cx = Math.max(0, Math.min(1, newX));
              const cy = Math.max(0, Math.min(1, newY));
              const cw = Math.max(0.01, Math.min(1 - cx, newW));
              const ch = Math.max(0.01, Math.min(1 - cy, newH));
              const el = elements.find((e) => e.id === id);
              if (el && "x" in el.data) {
                updateElement(id, {
                  data: { ...el.data as any, x: cx, y: cy, width: cw, height: ch },
                });
              }
            }}
          />
        </Layer>
      </Stage>

      {/* Text editing overlay */}
      {textEditPos && (
        <textarea
          autoFocus
          style={{
            position: "absolute",
            left: textEditPos.x,
            top: textEditPos.y,
            width: width * 0.25,
            minHeight: 30,
            fontSize: 14,
            fontFamily: "IBM Plex Sans Arabic, sans-serif",
            color: "#000000",
            background: "rgba(255,255,255,0.92)",
            border: "1.5px solid #2563eb",
            borderRadius: 4,
            padding: "4px 6px",
            outline: "none",
            resize: "both",
            zIndex: 100,
            direction: "rtl",
          }}
          onBlur={(e) => handleTextSubmit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setTextEditPos(null);
            }
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleTextSubmit(e.currentTarget.value);
            }
          }}
        />
      )}
    </>
  );
}
