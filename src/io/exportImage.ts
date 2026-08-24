import type { BinaryFile, ExcaliElement } from "../types";
import { getCommonBounds } from "../geometry";
import { renderElements } from "../render/renderScene";
import { preloadFiles } from "../render/imageCache";
import { encodePngMetadata } from "./pngMetadata";

export type RasterFormat = "png" | "jpeg" | "webp";

export interface ExportImageOptions {
  elements: ExcaliElement[];
  files: Record<string, BinaryFile>;
  format: RasterFormat;
  /** multiplier applied to scene units; ignored when `targetLongEdge` is set */
  scale: number;
  /** scales the output so its longest side is exactly this many pixels (e.g. 3840 for 4K) */
  targetLongEdge?: number;
  padding: number;
  background: boolean;
  backgroundColor: string;
  /** JPEG/WebP quality, 0..1 */
  quality: number;
  /** embed the scene JSON so the image can be reopened for editing (PNG only) */
  embedScene: boolean;
  sceneJson?: string;
}

/** Browsers refuse to allocate canvases beyond roughly this many pixels per side. */
const MAX_CANVAS_DIMENSION = 16384;

export interface ExportDimensions {
  width: number;
  height: number;
  scale: number;
  clamped: boolean;
}

/**
 * Resolves the final pixel size for an export, honouring `targetLongEdge` and
 * clamping to what the browser can actually allocate.
 */
export const computeExportDimensions = (
  elements: ExcaliElement[],
  opts: Pick<ExportImageOptions, "scale" | "padding" | "targetLongEdge">,
): ExportDimensions => {
  const bounds = getCommonBounds(elements);
  const sceneWidth = Math.max(bounds.x2 - bounds.x1 + opts.padding * 2, 1);
  const sceneHeight = Math.max(bounds.y2 - bounds.y1 + opts.padding * 2, 1);

  let scale = opts.scale;
  if (opts.targetLongEdge) {
    scale = opts.targetLongEdge / Math.max(sceneWidth, sceneHeight);
  }

  let width = Math.ceil(sceneWidth * scale);
  let height = Math.ceil(sceneHeight * scale);
  let clamped = false;
  const longest = Math.max(width, height);
  if (longest > MAX_CANVAS_DIMENSION) {
    const factor = MAX_CANVAS_DIMENSION / longest;
    scale *= factor;
    width = Math.ceil(sceneWidth * scale);
    height = Math.ceil(sceneHeight * scale);
    clamped = true;
  }
  return { width, height, scale, clamped };
};

/** Renders the given elements into an offscreen canvas at export resolution. */
export const exportToCanvas = async (
  opts: Omit<ExportImageOptions, "format" | "quality" | "embedScene" | "sceneJson">,
): Promise<HTMLCanvasElement> => {
  const { elements, files, padding, background, backgroundColor } = opts;
  if (elements.length === 0) throw new Error("Nothing to export");

  await preloadFiles(files);

  const bounds = getCommonBounds(elements);
  const { width, height, scale } = computeExportDimensions(elements, opts);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  if (background) {
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);
  }

  ctx.save();
  ctx.scale(scale, scale);
  ctx.translate(-bounds.x1 + padding, -bounds.y1 + padding);
  renderElements(ctx, elements, {
    scrollX: 0,
    scrollY: 0,
    zoom: 1,
    scale,
    files,
    exporting: true,
  });
  ctx.restore();

  return canvas;
};

const canvasToBlob = (canvas: HTMLCanvasElement, format: RasterFormat, quality: number) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Canvas encoding failed"))),
      `image/${format}`,
      format === "png" ? undefined : quality,
    );
  });

export const exportToRasterBlob = async (opts: ExportImageOptions): Promise<Blob> => {
  // JPEG has no alpha channel, so it always needs a filled background
  const background = opts.format === "jpeg" ? true : opts.background;
  const canvas = await exportToCanvas({ ...opts, background });
  const blob = await canvasToBlob(canvas, opts.format, opts.quality);

  if (opts.format === "png" && opts.embedScene && opts.sceneJson) {
    return encodePngMetadata(blob, opts.sceneJson);
  }
  return blob;
};
