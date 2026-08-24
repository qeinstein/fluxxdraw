import rough from "roughjs/bin/rough";
import type { RoughCanvas } from "roughjs/bin/canvas";
import type {
  BinaryFile,
  ComponentDefinition,
  ExcaliElement,
  TextElement,
} from "../types";
import { getElementBounds, getElementCenter } from "../geometry";
import { baselineOffset, fontString, getTextLines, measureText } from "../elements/text";
import { CONTAINER_PADDING } from "../constants";
import { freedrawPath, getDrawables } from "./shapes";
import { getImage } from "./imageCache";
import { FRAME_HEADER_HEIGHT } from "../elements/hitTest";

export interface RenderConfig {
  scrollX: number;
  scrollY: number;
  zoom: number;
  /** device pixel ratio or export scale multiplier */
  scale: number;
  files: Record<string, BinaryFile>;
  /** definitions backing any instance elements in the scene */
  components?: Record<string, ComponentDefinition>;
  /** set while exporting so interactive-only affordances are skipped */
  exporting?: boolean;
  theme?: "light" | "dark";
}

const roughCanvases = new WeakMap<CanvasRenderingContext2D, RoughCanvas>();

const getRoughCanvas = (ctx: CanvasRenderingContext2D) => {
  let rc = roughCanvases.get(ctx);
  if (!rc) {
    rc = rough.canvas(ctx.canvas);
    roughCanvases.set(ctx, rc);
  }
  return rc;
};

export const drawGrid = (
  ctx: CanvasRenderingContext2D,
  gridSize: number,
  width: number,
  height: number,
  config: RenderConfig,
) => {
  const { scrollX, scrollY, zoom } = config;
  const step = gridSize * zoom;
  if (step < 4) return; // too dense to be useful
  ctx.save();
  // the grid has to read as a faint tint over whichever canvas colour is set
  ctx.strokeStyle =
    config.theme === "dark" ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  const offsetX = (scrollX * zoom) % step;
  const offsetY = (scrollY * zoom) % step;
  for (let x = offsetX; x < width; x += step) {
    ctx.moveTo(Math.round(x) + 0.5, 0);
    ctx.lineTo(Math.round(x) + 0.5, height);
  }
  for (let y = offsetY; y < height; y += step) {
    ctx.moveTo(0, Math.round(y) + 0.5);
    ctx.lineTo(width, Math.round(y) + 0.5);
  }
  ctx.stroke();
  ctx.restore();
};

const drawTextElement = (
  ctx: CanvasRenderingContext2D,
  el: TextElement,
  container: ExcaliElement | null,
) => {
  const lines = getTextLines(el, container);
  const lineHeightPx = el.fontSize * el.lineHeight;
  ctx.font = fontString(el);
  ctx.fillStyle = el.strokeColor;
  ctx.textBaseline = "alphabetic";

  const { height: textHeight } = measureText(lines, el);
  let originX = el.x;
  let originY = el.y;
  let boxWidth = el.width;

  if (container) {
    const cb = getElementBounds(container);
    boxWidth = cb.x2 - cb.x1 - CONTAINER_PADDING * 2;
    originX = cb.x1 + CONTAINER_PADDING;
    const boxHeight = cb.y2 - cb.y1;
    originY =
      el.verticalAlign === "middle"
        ? cb.y1 + (boxHeight - textHeight) / 2
        : el.verticalAlign === "bottom"
          ? cb.y2 - textHeight - CONTAINER_PADDING
          : cb.y1 + CONTAINER_PADDING;
  }

  const baseline = baselineOffset(el);
  lines.forEach((line, i) => {
    const metrics = ctx.measureText(line);
    let x = originX;
    if (el.textAlign === "center") x = originX + (boxWidth - metrics.width) / 2;
    else if (el.textAlign === "right") x = originX + boxWidth - metrics.width;
    ctx.fillText(line, x, originY + i * lineHeightPx + baseline);
  });
};

const drawImageElement = (ctx: CanvasRenderingContext2D, el: ExcaliElement) => {
  if (el.type !== "image") return;
  const img = getImage(el.fileId);
  if (!img) {
    // placeholder while the bitmap decodes
    ctx.save();
    ctx.strokeStyle = "#bbb";
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(el.x, el.y, el.width, el.height);
    ctx.restore();
    return;
  }
  const crop = el.crop;
  if (crop) {
    ctx.drawImage(
      img,
      crop.x * img.naturalWidth,
      crop.y * img.naturalHeight,
      crop.w * img.naturalWidth,
      crop.h * img.naturalHeight,
      el.x,
      el.y,
      el.width,
      el.height,
    );
  } else {
    ctx.drawImage(img, el.x, el.y, el.width, el.height);
  }
};

const drawEmbedElement = (ctx: CanvasRenderingContext2D, el: ExcaliElement) => {
  if (el.type !== "embed") return;
  ctx.save();
  ctx.fillStyle = "#f1f3f5";
  ctx.fillRect(el.x, el.y, el.width, el.height);
  ctx.strokeStyle = "#adb5bd";
  ctx.lineWidth = 1;
  ctx.strokeRect(el.x, el.y, el.width, el.height);
  ctx.fillStyle = "#495057";
  ctx.font = "13px system-ui, sans-serif";
  const label = el.url.replace(/^https?:\/\//, "").slice(0, 48);
  ctx.fillText(label, el.x + 10, el.y + 22);
  ctx.restore();
};

const drawFrameChrome = (ctx: CanvasRenderingContext2D, el: ExcaliElement) => {
  if (el.type !== "frame") return;
  ctx.save();
  ctx.fillStyle = "#868e96";
  ctx.font = "12px system-ui, sans-serif";
  ctx.fillText(el.name, el.x, el.y - FRAME_HEADER_HEIGHT / 2);
  ctx.restore();
};

/** Draws one element, including rotation and opacity, in scene coordinates. */
export const renderElement = (
  ctx: CanvasRenderingContext2D,
  el: ExcaliElement,
  elementsById: Map<string, ExcaliElement>,
  config: RenderConfig,
) => {
  if (el.isDeleted) return;
  ctx.save();
  ctx.globalAlpha = el.opacity / 100;

  if (el.angle) {
    const [cx, cy] = getElementCenter(el);
    ctx.translate(cx, cy);
    ctx.rotate(el.angle);
    ctx.translate(-cx, -cy);
  }

  // frames clip whatever their children overflow
  if (el.type === "frame") {
    drawFrameChrome(ctx, el);
  }

  switch (el.type) {
    case "text":
      drawTextElement(ctx, el, el.containerId ? (elementsById.get(el.containerId) ?? null) : null);
      break;
    case "image":
      drawImageElement(ctx, el);
      break;
    case "embed":
      drawEmbedElement(ctx, el);
      break;
    case "instance": {
      const definition = config.components?.[el.componentId];
      if (definition) {
        ctx.save();
        ctx.translate(el.x, el.y);
        // stretch the master to whatever box this instance occupies
        ctx.scale(el.width / definition.width, el.height / definition.height);
        const innerById = new Map(definition.elements.map((child) => [child.id, child]));
        for (const child of definition.elements) {
          renderElement(ctx, child, innerById, config);
        }
        ctx.restore();
      } else {
        // a missing definition should be visible, not silently blank
        ctx.save();
        ctx.strokeStyle = "#e03131";
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(el.x, el.y, el.width, el.height);
        ctx.restore();
      }
      break;
    }
    case "freedraw": {
      const path = freedrawPath(el);
      if (path) {
        ctx.save();
        ctx.translate(el.x, el.y);
        ctx.fillStyle = el.strokeColor;
        ctx.fill(new Path2D(path));
        ctx.restore();
      }
      break;
    }
    default: {
      const rc = getRoughCanvas(ctx);
      ctx.save();
      // arrows/lines keep their points relative to x/y, as do shapes at 0,0
      ctx.translate(el.x, el.y);
      for (const drawable of getDrawables(el)) rc.draw(drawable);
      ctx.restore();
    }
  }
  ctx.restore();
};

export interface SceneRenderInput {
  elements: ExcaliElement[];
  config: RenderConfig;
}

/**
 * Renders elements into an already-transformed context. Callers set up the
 * scroll/zoom transform, which lets export reuse this with a different scale.
 */
export const renderElements = (
  ctx: CanvasRenderingContext2D,
  elements: ExcaliElement[],
  config: RenderConfig,
) => {
  void config;
  const byId = new Map(elements.map((el) => [el.id, el]));
  const visible = elements.filter((el) => !el.isDeleted);
  // frames render beneath their children so labels and shapes stay on top
  const frames = visible.filter((el) => el.type === "frame");
  const rest = visible.filter((el) => el.type !== "frame");
  for (const el of frames) renderElement(ctx, el, byId, config);
  for (const el of rest) renderElement(ctx, el, byId, config);
};
