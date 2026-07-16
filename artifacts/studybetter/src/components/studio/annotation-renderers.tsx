import { Rect, Ellipse, Line, Arrow, Text, Group, Image as KonvaImage } from "react-konva";
import { useEffect, useState } from "react";
import type {
  AnnotationElement,
  TextData,
  ShapeData,
  DrawingData,
  AiExplanationData,
  ImageData,
} from "../../lib/annotation-types";
import { getImageBlobUrl } from "../../lib/annotationStorage";

// ── Coordinate helpers ──

function rx(val: number, w: number) { return val * w; }
function ry(val: number, h: number) { return val * h; }

// ── Text Renderer ──

export function TextRenderer({
  data, canvasWidth, canvasHeight,
}: {
  data: TextData; canvasWidth: number; canvasHeight: number;
}) {
  const x = rx(data.x, canvasWidth);
  const y = ry(data.y, canvasHeight);
  const w = rx(data.width, canvasWidth);
  const h = ry(data.height, canvasHeight);

  return (
    <Group x={x} y={y}>
      <Rect
        width={w}
        height={h}
        fill="rgba(255, 255, 255, 0.85)"
        cornerRadius={3}
        shadowColor="rgba(0,0,0,0.1)"
        shadowBlur={4}
        shadowOffsetY={1}
      />
      <Text
        text={data.content}
        fontSize={Math.max(10, data.fontSize * (canvasWidth / 800))}
        fontFamily={data.fontFamily || "IBM Plex Sans Arabic, sans-serif"}
        fill={data.color}
        width={w - 8}
        height={h - 4}
        x={4}
        y={2}
        ellipsis
        wrap="word"
      />
    </Group>
  );
}

// ── Shape Renderer ──

export function ShapeRenderer({
  data, canvasWidth, canvasHeight,
}: {
  data: ShapeData; canvasWidth: number; canvasHeight: number;
}) {
  const x = rx(data.x, canvasWidth);
  const y = ry(data.y, canvasHeight);
  const w = rx(data.width, canvasWidth);
  const h = ry(data.height, canvasHeight);
  const centerX = x + w / 2;
  const centerY = y + h / 2;

  if (data.shapeType === "rectangle" || data.shapeType === "line") {
    if (data.shapeType === "line") {
      return (
        <Line
          points={[x, y, x + w, y + h]}
          stroke={data.strokeColor}
          strokeWidth={data.strokeWidth}
          lineCap="round"
        />
      );
    }
    return (
      <Rect
        x={x}
        y={y}
        width={w}
        height={h}
        stroke={data.strokeColor}
        strokeWidth={data.strokeWidth}
        fill={data.fillColor === "transparent" ? undefined : data.fillColor}
        cornerRadius={2}
      />
    );
  }

  if (data.shapeType === "ellipse") {
    return (
      <Ellipse
        x={centerX}
        y={centerY}
        radiusX={w / 2}
        radiusY={h / 2}
        stroke={data.strokeColor}
        strokeWidth={data.strokeWidth}
        fill={data.fillColor === "transparent" ? undefined : data.fillColor}
      />
    );
  }

  if (data.shapeType === "arrow") {
    return (
      <Arrow
        points={[x, y, x + w, y + h]}
        stroke={data.strokeColor}
        strokeWidth={data.strokeWidth}
        fill={data.strokeColor}
        pointerLength={10}
        pointerWidth={8}
      />
    );
  }

  return null;
}

// ── Drawing Renderer ──

export function DrawingRenderer({
  data, canvasWidth, canvasHeight,
}: {
  data: DrawingData; canvasWidth: number; canvasHeight: number;
}) {
  const flatPoints: number[] = [];
  for (const pt of data.points) {
    flatPoints.push(rx(pt.x, canvasWidth), ry(pt.y, canvasHeight));
  }

  return (
    <Line
      points={flatPoints}
      stroke={data.strokeColor}
      strokeWidth={data.strokeWidth}
      lineCap="round"
      lineJoin="round"
      tension={0.5}
      globalCompositeOperation={
        data.tool === "eraser" ? "destination-out" : undefined
      }
    />
  );
}

// ── AI Explanation Renderer ──

export function AiExplanationRenderer({
  data, canvasWidth, canvasHeight,
}: {
  data: AiExplanationData; canvasWidth: number; canvasHeight: number;
}) {
  const x = rx(data.x, canvasWidth);
  const y = ry(data.y, canvasHeight);
  const w = rx(data.width, canvasWidth);
  const h = ry(data.height, canvasHeight);

  return (
    <Group x={x} y={y}>
      <Rect
        width={w}
        height={h}
        fill="rgba(139, 92, 246, 0.08)"
        stroke="#8b5cf6"
        strokeWidth={1.5}
        cornerRadius={6}
        shadowColor="rgba(139, 92, 246, 0.15)"
        shadowBlur={6}
        shadowOffsetY={2}
      />
      <Text
        text={data.content}
        fontSize={Math.max(10, data.fontSize * (canvasWidth / 800))}
        fontFamily={data.fontFamily || "IBM Plex Sans Arabic, sans-serif"}
        fill={data.color || "#6d28d9"}
        width={w - 12}
        height={h - 8}
        x={6}
        y={4}
        ellipsis
        wrap="word"
      />
    </Group>
  );
}

// ── Image Renderer ──

export function ImageRenderer({
  data, canvasWidth, canvasHeight,
}: {
  data: ImageData; canvasWidth: number; canvasHeight: number;
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    let revokeUrl: string | null = null;
    (async () => {
      const url = await getImageBlobUrl(data.imageBlobId);
      if (cancelled || !url) return;
      revokeUrl = url;
      const image = new window.Image();
      image.onload = () => { if (!cancelled) setImg(image); };
      image.src = url;
    })();
    return () => {
      cancelled = true;
      if (revokeUrl) URL.revokeObjectURL(revokeUrl);
    };
  }, [data.imageBlobId]);

  if (!img) return null;

  const x = rx(data.x, canvasWidth);
  const y = ry(data.y, canvasHeight);
  const w = rx(data.width, canvasWidth);
  const h = ry(data.height, canvasHeight);

  return <KonvaImage image={img} x={x} y={y} width={w} height={h} />;
}

// ── Dispatcher ──

export function AnnotationRenderer({
  element, canvasWidth, canvasHeight, tool, onSelect, onDragEnd,
}: {
  element: AnnotationElement;
  canvasWidth: number;
  canvasHeight: number;
  tool?: string;
  onSelect?: (id: string) => void;
  onDragEnd?: (id: string, x: number, y: number) => void;
}) {
  const props = { canvasWidth, canvasHeight };

  const isSelect = tool === "select";
  const onClick = onSelect ? () => onSelect(element.id) : undefined;
  const handleDragEnd = onDragEnd
    ? (e: any) => {
        const node = e.target;
        onDragEnd(element.id, node.x(), node.y());
      }
    : undefined;

  let inner: React.ReactNode;
  switch (element.type) {
    case "text":
      inner = <TextRenderer data={element.data as TextData} {...props} />;
      break;
    case "shape":
      inner = <ShapeRenderer data={element.data as ShapeData} {...props} />;
      break;
    case "drawing":
      inner = <DrawingRenderer data={element.data as DrawingData} {...props} />;
      break;
    case "ai_explanation":
      inner = <AiExplanationRenderer data={element.data as AiExplanationData} {...props} />;
      break;
    case "image":
      inner = <ImageRenderer data={element.data as ImageData} {...props} />;
      break;
    default:
      return null;
  }

  return (
    <Group
      id={element.id}
      draggable={isSelect}
      onClick={onClick}
      onTap={onClick}
      onDragEnd={handleDragEnd}
    >
      {inner}
    </Group>
  );
}
