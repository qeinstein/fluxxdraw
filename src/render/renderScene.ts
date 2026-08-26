import rough from "roughjs/bin/rough";
import type { RoughCanvas } from "roughjs/bin/canvas";
import type {
  BinaryFile,
  ComponentDefinition,
  ExcaliElement,
  TextElement,
} from "../types";
import { getElementCenter } from "../geometry";
import {
  baselineOffset,
  fontString,
  getLabelBox,
  getTextLines,
  measureText,
} from "../elements/text";
import { freedrawPath, getDrawables } from "./shapes";
import { getImage } from "./imageCache";
import { FRAME_HEADER_HEIGHT } from "../elements/hitTest";
import { linkBadgeBox } from "../links";
import { resolveColor, type ThemeName } from "../constants";

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
  /**
   * Ids allowed to show their link badge this frame — selected or hovered,
   * same as Excalidraw. A badge on every linked element regardless of
   * attention would be clutter on a diagram with more than a couple of links.
   */
  linkBadgeIds?: ReadonlySet<string>;
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
  theme: ThemeName,
) => {
  const lines = getTextLines(el, container);
  const lineHeightPx = el.fontSize * el.lineHeight;
  ctx.font = fontString(el);
  ctx.fillStyle = resolveColor(el.strokeColor, theme, "stroke");
  ctx.textBaseline = "alphabetic";

  const { width: textWidth, height: textHeight } = measureText(lines, el);
  let originX = el.x;
  let originY = el.y;
  let boxWidth = el.width;

  if (container) {
    const box = getLabelBox(container, textWidth, textHeight, el.verticalAlign);
    originX = box.x;
    originY = box.y;
    boxWidth = box.width;
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

/** Domain, for the embed card's title line. */
export const embedDomain = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\//, "").split("/")[0];
  }
};

const roundRectPath = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) => {
  const radius = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
};

const drawEmbedElement = (
  ctx: CanvasRenderingContext2D,
  el: ExcaliElement,
  theme: "light" | "dark",
) => {
  if (el.type !== "embed") return;
  const dark = theme === "dark";
  const w = Math.abs(el.width);
  const h = Math.abs(el.height);
  const x = Math.min(el.x, el.x + el.width);
  const y = Math.min(el.y, el.y + el.height);

  ctx.save();
  roundRectPath(ctx, x, y, w, h, 10);
  ctx.fillStyle = dark ? "#22222a" : "#f6f7f9";
  ctx.fill();
  ctx.strokeStyle = dark ? "#3c3c48" : "#d7d7de";
  ctx.lineWidth = 1;
  ctx.stroke();

  // header strip carrying the domain
  ctx.save();
  ctx.clip();
  ctx.fillStyle = dark ? "#2b2b35" : "#eceef2";
  ctx.fillRect(x, y, w, Math.min(34, h));
  ctx.restore();

  const domain = embedDomain(el.url);
  ctx.fillStyle = dark ? "#e6e6ee" : "#2a2a33";
  ctx.font = "600 13px system-ui, -apple-system, sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillText(domain.slice(0, 42), x + 12, y + 17, Math.max(w - 70, 20));

  ctx.fillStyle = dark ? "#8b87f5" : "#5b57d1";
  ctx.font = "600 11px system-ui, -apple-system, sans-serif";
  ctx.fillText("OPEN ↗", x + w - 58, y + 17);

  if (h > 48) {
    ctx.fillStyle = dark ? "#9c9caa" : "#6b6b76";
    ctx.font = "12px system-ui, -apple-system, sans-serif";
    const path = el.url.replace(/^https?:\/\//, "");
    ctx.fillText(path.slice(0, 60), x + 12, y + 52, Math.max(w - 24, 20));
  }
  ctx.restore();
};

const drawFrameChrome = (ctx: CanvasRenderingContext2D, el: ExcaliElement, config: RenderConfig) => {
  if (el.type !== "frame" || config.exporting) return;
  ctx.save();
  ctx.fillStyle = "#868e96";
  ctx.font = "12px system-ui, sans-serif";
  ctx.fillText(el.name, el.x, el.y - FRAME_HEADER_HEIGHT / 2);
  ctx.restore();
};


/**
 * The chain badge on a linked element, at its top-right corner.
 *
 * Drawn at a constant size on screen rather than in scene units, so it stays
 * clickable when zoomed out and doesn't balloon when zoomed in. Skipped when
 * exporting: it's an affordance, not part of the drawing.
 */
const drawLinkBadge = (
  ctx: CanvasRenderingContext2D,
  el: ExcaliElement,
  config: RenderConfig,
) => {
  const { x, y, size } = linkBadgeBox(el, config.zoom);
  const dark = config.theme === "dark";
  const r = size * 0.28;

  ctx.save();
  ctx.globalAlpha = 1;
  roundRectPath(ctx, x, y, size, size, r);
  ctx.fillStyle = dark ? "#2c2a52" : "#ecebfb";
  ctx.fill();
  ctx.strokeStyle = dark ? "#8b87f5" : "#5b57d1";
  ctx.lineWidth = size * 0.07;
  ctx.stroke();

  // two interlocking links, scaled off the badge
  const cx = x + size / 2;
  const cy = y + size / 2;
  const arm = size * 0.17;
  ctx.lineCap = "round";
  ctx.lineWidth = size * 0.1;
  ctx.beginPath();
  ctx.moveTo(cx - arm * 1.5, cy + arm * 0.5);
  ctx.lineTo(cx - arm * 0.2, cy - arm * 0.8);
  ctx.moveTo(cx + arm * 0.2, cy + arm * 0.8);
  ctx.lineTo(cx + arm * 1.5, cy - arm * 0.5);
  ctx.moveTo(cx - arm * 0.7, cy + arm * 0.1);
  ctx.lineTo(cx + arm * 0.7, cy - arm * 0.1);
  ctx.stroke();
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
    drawFrameChrome(ctx, el, config);
  }

  // a linked element needs somewhere to click that isn't "select me"
  if (el.link && !config.exporting && config.linkBadgeIds?.has(el.id)) {
    drawLinkBadge(ctx, el, config);
  }

  switch (el.type) {
    case "text":
      drawTextElement(
        ctx,
        el,
        el.containerId ? (elementsById.get(el.containerId) ?? null) : null,
        config.theme ?? "light"
      );
      break;
    case "image":
      drawImageElement(ctx, el);
      break;
    case "embed":
      drawEmbedElement(ctx, el, config.theme ?? "light");
      break;
    case "instance": {
      const definition = config.components?.[el.componentId];
      if (definition) {
        ctx.save();
        ctx.translate(el.x, el.y);
        // stretch the master to whatever box this instance occupies
        ctx.scale(el.width / definition.width, el.height / definition.height);
        /*
         * Instance-level style wins over the master's. Opacity is deliberately
         * excluded: it is already applied to the instance as a whole above, and
         * applying it again per child would dim twice over.
         */
        const overrides = el.styleOverrides;
        const children = overrides
          ? definition.elements.map((child) => ({ ...child, ...overrides }))
          : definition.elements;
        const innerById = new Map(children.map((child) => [child.id, child]));
        for (const child of children) {
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
        ctx.fillStyle = resolveColor(el.strokeColor, config.theme ?? "light", "stroke");
        ctx.fill(new Path2D(path));
        ctx.restore();
      }
      break;
    }
    default: {
      const rc = getRoughCanvas(ctx);
      ctx.save();
      if (el.type === "sticky" && !config.exporting) {
        ctx.shadowColor = config.theme === "dark" ? "rgba(0,0,0,.34)" : "rgba(25,25,38,.16)";
        ctx.shadowBlur = 12 / Math.max(config.zoom, 0.25);
        ctx.shadowOffsetY = 5 / Math.max(config.zoom, 0.25);
      }
      // arrows/lines keep their points relative to x/y, as do shapes at 0,0
      ctx.translate(el.x, el.y);
      for (const drawable of getDrawables(el, config.theme ?? "light")) rc.draw(drawable);
      if (el.type === "sticky") {
        ctx.shadowColor = "transparent";
        ctx.globalAlpha = Math.min(ctx.globalAlpha, 0.09);
        ctx.fillStyle = config.theme === "dark" ? "#ffffff" : "#342f1f";
        const width = Math.max(Math.abs(el.width), 1);
        const height = Math.max(Math.abs(el.height), 1);
        for (let index = 0; index < 14; index++) {
          const x = ((index * 47 + 19) % 97) / 100 * width;
          const y = ((index * 31 + 11) % 89) / 100 * height;
          ctx.fillRect(x, y, 0.7, 0.7);
        }
      }
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
