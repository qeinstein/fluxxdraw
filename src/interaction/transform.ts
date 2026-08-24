import { HANDLE_SIZE, ROTATE_HANDLE_OFFSET } from "../constants";
import { getCommonBounds, rotate, type Bounds } from "../geometry";
import type { ExcaliElement, FreedrawElement, LinearElement, TextElement } from "../types";

export type HandleName =
  | "nw"
  | "n"
  | "ne"
  | "e"
  | "se"
  | "s"
  | "sw"
  | "w"
  | "rotate";

export interface TransformHandle {
  name: HandleName;
  /** centre of the handle in scene coordinates, already rotated */
  x: number;
  y: number;
}

const CORNER_ONLY_MIN = 24;

/**
 * Handle positions for a selection. `angle` is non-zero only when a single
 * rotated element is selected; multi-selections use an axis-aligned box.
 */
export const getTransformHandles = (
  bounds: Bounds,
  angle: number,
  zoom: number,
): TransformHandle[] => {
  const { x1, y1, x2, y2 } = bounds;
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;
  const width = x2 - x1;
  const height = y2 - y1;

  const spec: [HandleName, number, number][] = [
    ["nw", x1, y1],
    ["ne", x2, y1],
    ["se", x2, y2],
    ["sw", x1, y2],
    ["rotate", cx, y1 - ROTATE_HANDLE_OFFSET / zoom],
  ];
  // edge handles only fit once the box is big enough to be unambiguous
  if (width * zoom > CORNER_ONLY_MIN) {
    spec.push(["n", cx, y1], ["s", cx, y2]);
  }
  if (height * zoom > CORNER_ONLY_MIN) {
    spec.push(["w", x1, cy], ["e", x2, cy]);
  }

  return spec.map(([name, x, y]) => {
    const [rx, ry] = angle ? rotate(x, y, cx, cy, angle) : [x, y];
    return { name, x: rx, y: ry };
  });
};

export const getHandleAtPosition = (
  handles: TransformHandle[],
  x: number,
  y: number,
  zoom: number,
): HandleName | null => {
  const radius = (HANDLE_SIZE / 2 + 4) / zoom;
  for (const handle of handles) {
    if (Math.abs(handle.x - x) <= radius && Math.abs(handle.y - y) <= radius) {
      return handle.name;
    }
  }
  return null;
};

export const CURSOR_FOR_HANDLE: Record<HandleName, string> = {
  nw: "nwse-resize",
  se: "nwse-resize",
  ne: "nesw-resize",
  sw: "nesw-resize",
  n: "ns-resize",
  s: "ns-resize",
  e: "ew-resize",
  w: "ew-resize",
  rotate: "grab",
};

/** New bounds after dragging `handle` to (px, py), before any constraints. */
const resolveBounds = (
  initial: Bounds,
  handle: HandleName,
  px: number,
  py: number,
): Bounds => {
  const next = { ...initial };
  if (handle.includes("w")) next.x1 = px;
  if (handle.includes("e")) next.x2 = px;
  if (handle.includes("n")) next.y1 = py;
  if (handle.includes("s")) next.y2 = py;
  return next;
};

/** Keeps the drag proportional to the original aspect ratio. */
const constrainAspect = (initial: Bounds, next: Bounds, handle: HandleName): Bounds => {
  const initialWidth = initial.x2 - initial.x1;
  const initialHeight = initial.y2 - initial.y1;
  if (initialWidth === 0 || initialHeight === 0) return next;
  const ratio = initialWidth / initialHeight;

  const width = next.x2 - next.x1;
  const height = next.y2 - next.y1;
  // drive the smaller-change axis from the larger one
  const useWidth = Math.abs(width / ratio) > Math.abs(height);
  const out = { ...next };
  if (useWidth) {
    const newHeight = width / ratio;
    if (handle.includes("n")) out.y1 = out.y2 - newHeight;
    else out.y2 = out.y1 + newHeight;
  } else {
    const newWidth = height * ratio;
    if (handle.includes("w")) out.x1 = out.x2 - newWidth;
    else out.x2 = out.x1 + newWidth;
  }
  return out;
};

export interface ResizeResult {
  id: string;
  patch: Partial<ExcaliElement>;
}

const MIN_SIZE = 1;

/**
 * Scales a snapshot of elements so their common bounds match the box produced
 * by dragging `handle` to the pointer. Works for single and multi-selection.
 */
export const resizeElements = (
  snapshot: ExcaliElement[],
  handle: HandleName,
  pointerX: number,
  pointerY: number,
  keepAspect: boolean,
): ResizeResult[] => {
  if (snapshot.length === 0 || handle === "rotate") return [];

  const single = snapshot.length === 1 ? snapshot[0] : null;
  const angle = single?.angle ?? 0;
  const initial = single
    ? {
        x1: Math.min(single.x, single.x + single.width),
        y1: Math.min(single.y, single.y + single.height),
        x2: Math.max(single.x, single.x + single.width),
        y2: Math.max(single.y, single.y + single.height),
      }
    : getCommonBounds(snapshot);

  // resize a rotated element in its own frame, so handles track the pointer
  let localX = pointerX;
  let localY = pointerY;
  if (angle) {
    const cx = (initial.x1 + initial.x2) / 2;
    const cy = (initial.y1 + initial.y2) / 2;
    [localX, localY] = rotate(pointerX, pointerY, cx, cy, -angle);
  }

  let next = resolveBounds(initial, handle, localX, localY);
  const forceAspect = keepAspect || snapshot.some((el) => el.type === "image");
  if (forceAspect && handle.length === 2) next = constrainAspect(initial, next, handle);

  const initialWidth = initial.x2 - initial.x1;
  const initialHeight = initial.y2 - initial.y1;
  let scaleX = initialWidth === 0 ? 1 : (next.x2 - next.x1) / initialWidth;
  let scaleY = initialHeight === 0 ? 1 : (next.y2 - next.y1) / initialHeight;

  // don't let a selection collapse to nothing or flip unexpectedly on edges
  if (!Number.isFinite(scaleX) || Math.abs(scaleX) < 1e-6) scaleX = 1e-6;
  if (!Number.isFinite(scaleY) || Math.abs(scaleY) < 1e-6) scaleY = 1e-6;

  const anchorX = handle.includes("w") ? next.x2 : next.x1;
  const originX = handle.includes("w") ? initial.x2 : initial.x1;
  const anchorY = handle.includes("n") ? next.y2 : next.y1;
  const originY = handle.includes("n") ? initial.y2 : initial.y1;

  const mapX = (x: number) => anchorX + (x - originX) * scaleX;
  const mapY = (y: number) => anchorY + (y - originY) * scaleY;

  return snapshot.map((el) => {
    const patch: Record<string, unknown> = {
      x: mapX(el.x),
      y: mapY(el.y),
      width: Math.abs(el.width * scaleX) < MIN_SIZE ? MIN_SIZE : el.width * scaleX,
      height: Math.abs(el.height * scaleY) < MIN_SIZE ? MIN_SIZE : el.height * scaleY,
    };

    if (el.type === "arrow" || el.type === "line" || el.type === "freedraw") {
      const pts = (el as LinearElement | FreedrawElement).points;
      patch.points = pts.map(([px, py]) => [px * scaleX, py * scaleY]);
    }
    if (el.type === "text") {
      // scale the type size with the box rather than stretching glyphs
      const factor = Math.abs(scaleY);
      patch.fontSize = Math.max(6, (el as TextElement).fontSize * factor);
    }
    return { id: el.id, patch: patch as Partial<ExcaliElement> };
  });
};

/** Angle from a selection's centre to the pointer, snapped when shift is held. */
export const computeRotation = (
  bounds: Bounds,
  pointerX: number,
  pointerY: number,
  snap: boolean,
): number => {
  const cx = (bounds.x1 + bounds.x2) / 2;
  const cy = (bounds.y1 + bounds.y2) / 2;
  // the rotate handle sits above the box, so offset by a quarter turn
  let angle = Math.atan2(pointerY - cy, pointerX - cx) + Math.PI / 2;
  if (snap) {
    const step = Math.PI / 12; // 15°
    angle = Math.round(angle / step) * step;
  }
  const twoPi = Math.PI * 2;
  return ((angle % twoPi) + twoPi) % twoPi;
};
