import { HIT_THRESHOLD } from "../constants";
import {
  distanceToSegment,
  getElementBounds,
  hasPoints,
  toLocalSpace,
} from "../geometry";
import type { ExcaliElement, LinearElement } from "../types";

const isFilled = (el: ExcaliElement) =>
  "backgroundColor" in el && el.backgroundColor !== "transparent";

/** Distance from a point to an axis-aligned rectangle's outline (0 when on it). */
const distanceToRectOutline = (
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
) =>
  Math.min(
    distanceToSegment(px, py, x1, y1, x2, y1),
    distanceToSegment(px, py, x2, y1, x2, y2),
    distanceToSegment(px, py, x2, y2, x1, y2),
    distanceToSegment(px, py, x1, y2, x1, y1),
  );

/**
 * The points a linear element actually renders through. Elbowed arrows
 * get orthogonal waypoints; curved arrows may later get interpolated
 * samples. This must match what `getRenderPoints()` in shapes.ts produces
 * so clicks land on the visible path.
 */
const getHitTestPoints = (el: LinearElement): [number, number][] => {
  if (el.pathType !== "elbow" || el.points.length < 2) return el.points;
  // Reproduce the elbowed route inline so we don't create a circular import
  // with shapes.ts. The routing logic here mirrors getRenderPoints().
  const out: [number, number][] = [el.points[0]];
  for (let i = 0; i < el.points.length - 1; i++) {
    const [ax, ay] = el.points[i];
    const [bx, by] = el.points[i + 1];
    // route horizontally first, then vertically
    const mid: [number, number] = [bx, ay];
    if (Math.abs(bx - ax) > 0.5 && Math.abs(by - ay) > 0.5) out.push(mid);
    out.push([bx, by]);
  }
  return out;
};

/**
 * Whether a scene point hits an element. Filled shapes are hit anywhere inside;
 * unfilled ones only near their outline, matching Excalidraw's behaviour.
 */
export const hitTestElement = (
  el: ExcaliElement,
  sceneX: number,
  sceneY: number,
  threshold = HIT_THRESHOLD,
): boolean => {
  const [x, y] = toLocalSpace(el, sceneX, sceneY);
  const { x1, y1, x2, y2 } = getElementBounds(el);

  if (hasPoints(el)) {
    if (el.type === "freedraw") {
      // freehand strokes are dense, so proximity to any point is enough
      const pad = threshold + el.strokeWidth * 2;
      for (const [px, py] of el.points) {
        if (Math.hypot(el.x + px - x, el.y + py - y) <= pad) return true;
      }
      return false;
    }
    // For arrows and lines, test against the RENDERED path, not just the
    // raw user points. This fixes the bug where elbowed arrows couldn't
    // be clicked because hit testing checked the direct start→end line
    // while the rendered path went through orthogonal midpoints.
    const pts = getHitTestPoints(el as LinearElement);
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i];
      const [bx, by] = pts[i + 1];
      if (
        distanceToSegment(x, y, el.x + ax, el.y + ay, el.x + bx, el.y + by) <= threshold
      ) {
        return true;
      }
    }
    return false;
  }

  const inside = x >= x1 && x <= x2 && y >= y1 && y <= y2;

  switch (el.type) {
    case "text":
    case "image":
    case "embed":
    case "instance":
      return inside;
    case "frame":
      // frames are selected by their header/border, not their empty interior
      return distanceToRectOutline(x, y, x1, y1, x2, y2) <= threshold || isInFrameHeader(el, x, y);
    case "ellipse": {
      const cx = (x1 + x2) / 2;
      const cy = (y1 + y2) / 2;
      const rx = Math.max((x2 - x1) / 2, 1);
      const ry = Math.max((y2 - y1) / 2, 1);
      const norm = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      if (isFilled(el)) return norm <= 1;
      // ring test: scale the tolerance by the smaller radius
      const tol = threshold / Math.min(rx, ry);
      return Math.abs(Math.sqrt(norm) - 1) <= tol;
    }
    case "diamond": {
      const cx = (x1 + x2) / 2;
      const cy = (y1 + y2) / 2;
      const rx = Math.max((x2 - x1) / 2, 1);
      const ry = Math.max((y2 - y1) / 2, 1);
      const norm = Math.abs(x - cx) / rx + Math.abs(y - cy) / ry;
      if (isFilled(el)) return norm <= 1;
      const top: [number, number] = [cx, y1];
      const right: [number, number] = [x2, cy];
      const bottom: [number, number] = [cx, y2];
      const left: [number, number] = [x1, cy];
      return (
        Math.min(
          distanceToSegment(x, y, ...top, ...right),
          distanceToSegment(x, y, ...right, ...bottom),
          distanceToSegment(x, y, ...bottom, ...left),
          distanceToSegment(x, y, ...left, ...top),
        ) <= threshold
      );
    }
    case "rectangle":
    default:
      if (isFilled(el)) return inside;
      return distanceToRectOutline(x, y, x1, y1, x2, y2) <= threshold;
  }
};

export const FRAME_HEADER_HEIGHT = 22;

export const isInFrameHeader = (el: ExcaliElement, x: number, y: number) => {
  const { x1, y1, x2 } = getElementBounds(el);
  return x >= x1 && x <= x2 && y <= y1 && y >= y1 - FRAME_HEADER_HEIGHT;
};

/** Topmost element under the pointer, honouring z-order. */
export const getElementAtPosition = (
  elements: ExcaliElement[],
  x: number,
  y: number,
  threshold?: number,
): ExcaliElement | null => {
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i];
    if (el.isDeleted || el.locked) continue;
    if (hitTestElement(el, x, y, threshold)) return el;
  }
  return null;
};
