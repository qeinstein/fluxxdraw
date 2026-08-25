import { getElementBounds, getElementCenter } from "../geometry";
import {
  CURVE_TENSION,
  ELBOW_MIN_SEGMENT,
  ELBOW_PADDING,
} from "../constants";
import { intersectShapeEdge } from "./binding";
import type { ExcaliElement, LinearElement, PathType } from "../types";

/**
 * Arrow routing engine.
 *
 * Inspired by Miro's connector system: arrows stay attached, auto-route
 * sensibly based on the relative positions of the bound shapes, and support
 * straight / curved / elbow path types that the user can switch freely.
 */

// ---------------------------------------------------------------------------
// Connection-side selection
// ---------------------------------------------------------------------------

export type Side = "top" | "right" | "bottom" | "left";

/**
 * Which side of a shape a departing/arriving arrow should use, based on
 * where the other endpoint is. This is the "intelligent connection point"
 * logic — like Miro, we pick the most sensible side automatically.
 *
 *   A → B  ⇒  A[right] → B[left]
 *   A ↓ B  ⇒  A[bottom] → B[top]
 */
export const bestConnectionSide = (
  from: [number, number],
  to: [number, number],
): Side => {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? "right" : "left";
  }
  return dy >= 0 ? "bottom" : "top";
};

/** The complementary side — where the arrow arrives at the target. */
export const oppositeSide = (side: Side): Side => {
  switch (side) {
    case "top": return "bottom";
    case "bottom": return "top";
    case "left": return "right";
    case "right": return "left";
  }
};

/**
 * Normalized fixedPoint for the center of each side.
 * (0,0) = top-left, (1,1) = bottom-right of the shape's bounding box.
 */
export const sideToFixedPoint = (side: Side): [number, number] => {
  switch (side) {
    case "top": return [0.5, 0];
    case "bottom": return [0.5, 1];
    case "left": return [0, 0.5];
    case "right": return [1, 0.5];
  }
};

/**
 * Converts a fixedPoint [0..1, 0..1] on a shape to scene coordinates.
 */
export const fixedPointToScene = (
  shape: ExcaliElement,
  fixedPoint: [number, number],
): [number, number] => {
  const b = getElementBounds(shape);
  return [
    b.x1 + (b.x2 - b.x1) * fixedPoint[0],
    b.y1 + (b.y2 - b.y1) * fixedPoint[1],
  ];
};

/**
 * Direction vector pointing outward from a side, used as departure/arrival
 * tangent for routing.
 */
const sideDirection = (side: Side): [number, number] => {
  switch (side) {
    case "top": return [0, -1];
    case "bottom": return [0, 1];
    case "left": return [-1, 0];
    case "right": return [1, 0];
  }
};

// ---------------------------------------------------------------------------
// Straight routing
// ---------------------------------------------------------------------------

/**
 * Two-point route: just the start and end.
 */
export const generateStraightRoute = (
  start: [number, number],
  end: [number, number],
): [number, number][] => [start, end];

// ---------------------------------------------------------------------------
// Curved routing
// ---------------------------------------------------------------------------

/**
 * Generates a curved route with automatically placed control points that
 * produce a visually pleasing S-curve or C-curve depending on the relative
 * positions of the endpoints.
 *
 * The control points are placed along the departure/arrival tangent
 * directions so the curve leaves and enters the shapes smoothly.
 */
export const generateCurvedRoute = (
  start: [number, number],
  end: [number, number],
  startSide: Side,
  endSide: Side,
): [number, number][] => {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const dist = Math.hypot(dx, dy);
  const offset = Math.max(dist * CURVE_TENSION, ELBOW_MIN_SEGMENT);

  const [sdx, sdy] = sideDirection(startSide);
  const [edx, edy] = sideDirection(endSide);

  const cp1: [number, number] = [
    start[0] + sdx * offset,
    start[1] + sdy * offset,
  ];
  const cp2: [number, number] = [
    end[0] + edx * offset,
    end[1] + edy * offset,
  ];

  return [start, cp1, cp2, end];
};

// ---------------------------------------------------------------------------
// Elbow / orthogonal routing
// ---------------------------------------------------------------------------

/**
 * Generates an orthogonal (elbow) route between two points based on the
 * departure and arrival sides. Produces L, Z, U, or S-shaped routes
 * depending on the relative geometry.
 *
 * Unlike the old rigid H-then-V routing, this considers which sides the
 * arrow departs/arrives from and produces routes that look natural.
 */
export const generateElbowRoute = (
  start: [number, number],
  end: [number, number],
  startSide: Side,
  endSide: Side,
): [number, number][] => {
  const [sx, sy] = start;
  const [ex, ey] = end;
  const pad = ELBOW_PADDING;
  const minSeg = ELBOW_MIN_SEGMENT;

  // Same-axis, opposite directions (most common: right → left, bottom → top)
  if (startSide === oppositeSide(endSide)) {
    const horizontal = startSide === "right" || startSide === "left";
    if (horizontal) {
      // Z-shape or straight-through
      const midX = (sx + ex) / 2;
      // If they're far enough apart, a simple Z works
      if ((startSide === "right" && ex > sx + minSeg) ||
          (startSide === "left" && ex < sx - minSeg)) {
        return [start, [midX, sy], [midX, ey], end];
      }
      // U-shape: the target is behind the source
      const detourX = startSide === "right"
        ? Math.max(sx, ex) + pad * 2
        : Math.min(sx, ex) - pad * 2;
      const detourY = sy < ey ? Math.min(sy, ey) - pad : Math.max(sy, ey) + pad;
      return [start, [detourX, sy], [detourX, detourY], [ex + (endSide === "left" ? -pad : pad), detourY], [ex + (endSide === "left" ? -pad : pad), ey], end];
    } else {
      // Vertical Z/U
      const midY = (sy + ey) / 2;
      if ((startSide === "bottom" && ey > sy + minSeg) ||
          (startSide === "top" && ey < sy - minSeg)) {
        return [start, [sx, midY], [ex, midY], end];
      }
      const detourY = startSide === "bottom"
        ? Math.max(sy, ey) + pad * 2
        : Math.min(sy, ey) - pad * 2;
      const detourX = sx < ex ? Math.min(sx, ex) - pad : Math.max(sx, ex) + pad;
      return [start, [sx, detourY], [detourX, detourY], [detourX, ey + (endSide === "top" ? -pad : pad)], [ex, ey + (endSide === "top" ? -pad : pad)], end];
    }
  }

  // Same side (U-shape needed)
  if (startSide === endSide) {
    const [dx, dy] = sideDirection(startSide);
    const detour = pad * 2;
    const offsetX = dx * detour;
    const offsetY = dy * detour;
    if (dx !== 0) {
      // Both exit horizontally
      const outX = (dx > 0 ? Math.max(sx, ex) : Math.min(sx, ex)) + offsetX;
      return [start, [outX, sy], [outX, ey], end];
    } else {
      // Both exit vertically
      const outY = (dy > 0 ? Math.max(sy, ey) : Math.min(sy, ey)) + offsetY;
      return [start, [sx, outY], [ex, outY], end];
    }
  }

  // Adjacent/perpendicular sides — L-shape
  const horizontal = startSide === "right" || startSide === "left";
  if (horizontal) {
    // Depart horizontally, arrive vertically → corner at (ex, sy)
    return [start, [ex, sy], end];
  }
  // Depart vertically, arrive horizontally → corner at (sx, ey)
  return [start, [sx, ey], end];
};

// ---------------------------------------------------------------------------
// High-level routing dispatcher
// ---------------------------------------------------------------------------

/**
 * Generates a route for an arrow based on its `pathType` and the positions
 * of its bound shapes. If the arrow has no bindings, returns the existing
 * points unchanged.
 */
export const generateRoute = (
  pathType: PathType,
  startScene: [number, number],
  endScene: [number, number],
  startShape: ExcaliElement | null,
  endShape: ExcaliElement | null,
): [number, number][] => {
  const startCenter = startShape ? getElementCenter(startShape) : startScene;
  const endCenter = endShape ? getElementCenter(endShape) : endScene;

  const startSide = bestConnectionSide(startCenter, endCenter);
  const endSide = bestConnectionSide(endCenter, startCenter);

  switch (pathType) {
    case "curved":
      return generateCurvedRoute(startScene, endScene, startSide, endSide);
    case "elbow":
      return generateElbowRoute(startScene, endScene, startSide, endSide);
    case "straight":
    default:
      return generateStraightRoute(startScene, endScene);
  }
};

/**
 * Re-routes an existing arrow so its intermediate points match the current
 * positions of its bound shapes. Called by `refreshBindings()` whenever a
 * connected shape moves.
 *
 * For straight arrows with user-placed intermediate points, only the
 * endpoints are updated — the intermediate points stay where the user put
 * them. For curved/elbow arrows that the user hasn't manually edited (only
 * 2 points or auto-generated), the full route is regenerated.
 */
export const rerouteArrow = (
  arrow: LinearElement,
  byId: Map<string, ExcaliElement>,
): [number, number][] | null => {
  const startShape = arrow.startBinding
    ? byId.get(arrow.startBinding.elementId) ?? null
    : null;
  const endShape = arrow.endBinding
    ? byId.get(arrow.endBinding.elementId) ?? null
    : null;

  if (!startShape && !endShape) return null;

  // Compute where the endpoints should be in scene coordinates
  const toScene = (p: [number, number]): [number, number] => [
    arrow.x + p[0],
    arrow.y + p[1],
  ];
  const toLocal = (p: [number, number]): [number, number] => [
    p[0] - arrow.x,
    p[1] - arrow.y,
  ];

  const points = arrow.points.map((p) => [...p] as [number, number]);
  if (points.length < 2) return null;

  // For arrows with user-added intermediate points (>2 points),
  // only update the bound endpoints and leave the middle alone.
  if (points.length > 2) {
    if (startShape && arrow.startBinding && !startShape.isDeleted) {
      const [tx, ty] = toScene(points[1]);
      const [ex, ey] = intersectShapeEdge(startShape, tx, ty, arrow.startBinding.gap);
      points[0] = [ex - arrow.x, ey - arrow.y];
    }
    if (endShape && arrow.endBinding && !endShape.isDeleted) {
      const [tx, ty] = toScene(points[points.length - 2]);
      const [ex, ey] = intersectShapeEdge(endShape, tx, ty, arrow.endBinding.gap);
      points[points.length - 1] = [ex - arrow.x, ey - arrow.y];
    }
    return points;
  }

  // For curved/elbow, regenerate the full route from the bound shape positions
  const startSceneRaw: [number, number] = startShape
    ? getElementCenter(startShape)
    : toScene(points[0]);
  const endSceneRaw: [number, number] = endShape
    ? getElementCenter(endShape)
    : toScene(points[points.length - 1]);

  const route = generateRoute(
    arrow.pathType,
    startSceneRaw,
    endSceneRaw,
    startShape,
    endShape,
  );

  // Now intersect the endpoints with the shape edges so they land on the
  // perimeter rather than the center
  if (startShape && arrow.startBinding && !startShape.isDeleted && route.length >= 2) {
    const target = route[1];
    const [ex, ey] = intersectShapeEdge(startShape, target[0], target[1], arrow.startBinding.gap);
    route[0] = [ex, ey];
  }
  if (endShape && arrow.endBinding && !endShape.isDeleted && route.length >= 2) {
    const target = route[route.length - 2];
    const [ex, ey] = intersectShapeEdge(endShape, target[0], target[1], arrow.endBinding.gap);
    route[route.length - 1] = [ex, ey];
  }

  // Convert back to local coordinates (relative to arrow.x, arrow.y)
  // The arrow's origin is its first point, so we re-base everything.
  return route.map((p) => toLocal(p));
};
