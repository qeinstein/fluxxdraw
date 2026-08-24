import type { ExcaliElement, LinearElement, FreedrawElement } from "./types";

export interface Bounds {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export const rotate = (
  x: number,
  y: number,
  cx: number,
  cy: number,
  angle: number,
): [number, number] => {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = x - cx;
  const dy = y - cy;
  return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos];
};

export const hasPoints = (
  el: ExcaliElement,
): el is LinearElement | FreedrawElement =>
  el.type === "arrow" || el.type === "line" || el.type === "freedraw";

/** Axis-aligned bounds ignoring rotation, in scene coordinates. */
export const getElementBounds = (el: ExcaliElement): Bounds => {
  if (hasPoints(el) && el.points.length > 0) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const [px, py] of el.points) {
      minX = Math.min(minX, px);
      minY = Math.min(minY, py);
      maxX = Math.max(maxX, px);
      maxY = Math.max(maxY, py);
    }
    return { x1: el.x + minX, y1: el.y + minY, x2: el.x + maxX, y2: el.y + maxY };
  }
  const x1 = Math.min(el.x, el.x + el.width);
  const y1 = Math.min(el.y, el.y + el.height);
  return { x1, y1, x2: x1 + Math.abs(el.width), y2: y1 + Math.abs(el.height) };
};

export const getElementCenter = (el: ExcaliElement): [number, number] => {
  const b = getElementBounds(el);
  return [(b.x1 + b.x2) / 2, (b.y1 + b.y2) / 2];
};

/** Bounds of a rotated element, i.e. the box that contains all four rotated corners. */
export const getRotatedBounds = (el: ExcaliElement): Bounds => {
  const b = getElementBounds(el);
  if (!el.angle) return b;
  const cx = (b.x1 + b.x2) / 2;
  const cy = (b.y1 + b.y2) / 2;
  const corners: [number, number][] = [
    [b.x1, b.y1],
    [b.x2, b.y1],
    [b.x2, b.y2],
    [b.x1, b.y2],
  ].map(([x, y]) => rotate(x, y, cx, cy, el.angle));
  const xs = corners.map((c) => c[0]);
  const ys = corners.map((c) => c[1]);
  return { x1: Math.min(...xs), y1: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) };
};

export const getCommonBounds = (elements: ExcaliElement[]): Bounds => {
  if (elements.length === 0) return { x1: 0, y1: 0, x2: 0, y2: 0 };
  let x1 = Infinity;
  let y1 = Infinity;
  let x2 = -Infinity;
  let y2 = -Infinity;
  for (const el of elements) {
    const b = getRotatedBounds(el);
    x1 = Math.min(x1, b.x1);
    y1 = Math.min(y1, b.y1);
    x2 = Math.max(x2, b.x2);
    y2 = Math.max(y2, b.y2);
  }
  return { x1, y1, x2, y2 };
};

export const distance = (ax: number, ay: number, bx: number, by: number) =>
  Math.hypot(ax - bx, ay - by);

/** Shortest distance from a point to the segment ab. */
export const distanceToSegment = (
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number => {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return distance(px, py, ax, ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return distance(px, py, ax + t * dx, ay + t * dy);
};

export const boundsOverlap = (a: Bounds, b: Bounds) =>
  a.x1 <= b.x2 && a.x2 >= b.x1 && a.y1 <= b.y2 && a.y2 >= b.y1;

export const boundsContain = (outer: Bounds, inner: Bounds) =>
  outer.x1 <= inner.x1 && outer.y1 <= inner.y1 && outer.x2 >= inner.x2 && outer.y2 >= inner.y2;

/**
 * Convert a scene point into an element's own unrotated coordinate space, so
 * hit tests and resizing can ignore rotation.
 */
export const toLocalSpace = (
  el: ExcaliElement,
  x: number,
  y: number,
): [number, number] => {
  const [cx, cy] = getElementCenter(el);
  return rotate(x, y, cx, cy, -el.angle);
};
