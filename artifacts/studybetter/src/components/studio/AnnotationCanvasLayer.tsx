import { Stage, Layer } from "react-konva";
import { AnnotationRenderer } from "./annotation-renderers";
import type { AnnotationElement } from "../../lib/annotation-types";

interface AnnotationCanvasLayerProps {
  annotations: AnnotationElement[];
  width: number;
  height: number;
}

export default function AnnotationCanvasLayer({
  annotations,
  width,
  height,
}: AnnotationCanvasLayerProps) {
  if (width <= 0 || height <= 0) return null;

  const sorted = [...annotations].sort((a, b) => a.zIndex - b.zIndex);

  return (
    <Stage
      width={width}
      height={height}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        pointerEvents: "none",
      }}
    >
      <Layer listening={false}>
        {sorted.map((el) => (
          <AnnotationRenderer
            key={el.id}
            element={el}
            canvasWidth={width}
            canvasHeight={height}
          />
        ))}
      </Layer>
    </Stage>
  );
}
