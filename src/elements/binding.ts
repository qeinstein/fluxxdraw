import { BINDING_DISTANCE, BINDING_GAP } from "../constants";
import { getElementBounds, getElementCenter } from "../geometry";
import type { ExcaliElement, LinearElement, Binding } from "../types";
import { hitTestElement } from "./hitTest";
import {
  bestConnectionSide,
  sideToFixedPoint,
  fixedPointToScene,
} from "./arrowRouting";

/*
 * Instances are bindable too: a placed component — a cloud service node, say —
 * is a box on the canvas like any other, and an architecture diagram is mostly
 * arrows between them.
 */
const BINDABLE = new Set([
  "rectangle",
  "diamond",
  "ellipse",
  "image",
  "text",
  "frame",
  "instance",
]);

export const isBindable = (el: ExcaliElement) => BINDABLE.has(el.type) && !el.isDeleted;

/**
 * Shape an arrow endpoint at (x, y) should bind to: the topmost bindable
 * element under or near the pointer.
 */
export const getBindableElementAt = (
  elements: ExcaliElement[],
  x: number,
  y: number,
  excludeId?: string,
): ExcaliElement | null => {
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i];
    if (el.id === excludeId || !isBindable(el)) continue;
    if (hitTestElement(el, x, y, BINDING_DISTANCE)) return el;
  }
  return null;
};

/**
 * Point where the ray from a shape's centre toward `(tx, ty)` leaves the
 * shape's outline, pushed out by `gap`.
 */
export const intersectShapeEdge = (
  shape: ExcaliElement,
  tx: number,
  ty: number,
  gap: number,
): [number, number] => {
  const [cx, cy] = getElementCenter(shape);
  const b = getElementBounds(shape);
  const rx = Math.max((b.x2 - b.x1) / 2, 1);
  const ry = Math.max((b.y2 - b.y1) / 2, 1);
  let dx = tx - cx;
  let dy = ty - cy;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return [cx, cy];
  dx /= len;
  dy /= len;

  let t: number;
  if (shape.type === "ellipse") {
    t = 1 / Math.hypot(dx / rx, dy / ry);
  } else if (shape.type === "diamond") {
    t = 1 / (Math.abs(dx) / rx + Math.abs(dy) / ry);
  } else {
    // rectangle-ish: nearest of the vertical/horizontal slab intersections
    const tX = Math.abs(dx) > 1e-6 ? rx / Math.abs(dx) : Infinity;
    const tY = Math.abs(dy) > 1e-6 ? ry / Math.abs(dy) : Infinity;
    t = Math.min(tX, tY);
  }
  const edge = t + gap;
  // never overshoot the target point itself
  const clamped = Math.min(edge, len);
  return [cx + dx * clamped, cy + dy * clamped];
};

/**
 * Computes the scene-space position of a bound endpoint, taking
 * `fixedPoint` into account when available.
 *
 * If the binding has a `fixedPoint`, the arrow attaches at that proportional
 * position on the shape's perimeter (pushed out by `gap`). Otherwise falls
 * back to the centre-ray intersection used before.
 */
export const boundEndpointPosition = (
  binding: Binding,
  shape: ExcaliElement,
  targetScene: [number, number],
): [number, number] => {
  if (binding.fixedPoint) {
    // fixedPoint is [0..1, 0..1] on the bounding box. We compute the
    // world position and push it outward by gap along the normal.
    const pt = fixedPointToScene(shape, binding.fixedPoint);
    const [cx, cy] = getElementCenter(shape);
    const dx = pt[0] - cx;
    const dy = pt[1] - cy;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) return pt;
    return [
      pt[0] + (dx / len) * binding.gap,
      pt[1] + (dy / len) * binding.gap,
    ];
  }
  return intersectShapeEdge(shape, targetScene[0], targetScene[1], binding.gap);
};

/**
 * Recomputes an arrow's bound endpoints so they stay attached to their shapes.
 * Returns the new points, or null when the arrow has no bindings.
 */
export const getBoundArrowPoints = (
  arrow: LinearElement,
  byId: Map<string, ExcaliElement>,
): [number, number][] | null => {
  if (!arrow.startBinding && !arrow.endBinding) return null;
  const points = arrow.points.map((p) => [...p] as [number, number]);
  if (points.length < 2) return null;

  const toScene = (p: [number, number]): [number, number] => [arrow.x + p[0], arrow.y + p[1]];

  if (arrow.startBinding) {
    const shape = byId.get(arrow.startBinding.elementId);
    if (shape && !shape.isDeleted) {
      const target = toScene(points[1]);
      const [ex, ey] = boundEndpointPosition(arrow.startBinding, shape, target);
      points[0] = [ex - arrow.x, ey - arrow.y];
    }
  }
  if (arrow.endBinding) {
    const shape = byId.get(arrow.endBinding.elementId);
    if (shape && !shape.isDeleted) {
      const target = toScene(points[points.length - 2]);
      const [ex, ey] = boundEndpointPosition(arrow.endBinding, shape, target);
      points[points.length - 1] = [ex - arrow.x, ey - arrow.y];
    }
  }
  return points;
};

/**
 * Creates a default binding, choosing the best connection side automatically
 * based on where the other end of the arrow is. This produces Miro-style
 * intelligent attachment points.
 */
export const defaultBinding = (
  elementId: string,
  shape?: ExcaliElement | null,
  otherEndScene?: [number, number] | null,
): Binding => {
  let fixedPoint: [number, number] | undefined;
  if (shape && otherEndScene) {
    const center = getElementCenter(shape);
    const side = bestConnectionSide(center, otherEndScene);
    fixedPoint = sideToFixedPoint(side);
  }
  return {
    elementId,
    focus: 0,
    gap: BINDING_GAP,
    ...(fixedPoint ? { fixedPoint } : {}),
  };
};
