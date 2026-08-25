import { distance } from "../geometry";
import type { ExcaliElement, LinearElement } from "../types";
import { rerouteArrow } from "./arrowRouting";

export type HandleType = "endpoint" | "midpoint" | "add";

export interface ArrowHandle {
  index: number;
  x: number;
  y: number;
  type: HandleType;
}

const HANDLE_SIZE = 8;
const ADD_HANDLE_SIZE = 6;

/**
 * Gets all interactive handles for an arrow.
 * Like Miro:
 * - Endpoints (blue dots) for binding/resizing
 * - Midpoints (white dots) for adjusting curvature/elbows
 * - Add handles (ghost dots) between points for adding new bends
 */
export const getArrowHandles = (
  arrow: LinearElement,
  _zoom: number,
): ArrowHandle[] => {
  const handles: ArrowHandle[] = [];
  const points = arrow.points;

  if (points.length < 2) return handles;

  for (let i = 0; i < points.length; i++) {
    const [px, py] = points[i];
    handles.push({
      index: i,
      x: arrow.x + px,
      y: arrow.y + py,
      type: i === 0 || i === points.length - 1 ? "endpoint" : "midpoint",
    });
  }

  // "Add" handles at segment midpoints
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, ay] = points[i];
    const [bx, by] = points[i + 1];
    handles.push({
      index: i,
      x: arrow.x + (ax + bx) / 2,
      y: arrow.y + (ay + by) / 2,
      type: "add",
    });
  }

  return handles;
};

/**
 * Hit tests an arrow's handles to see if the user clicked one.
 */
export const hitTestArrowHandle = (
  handles: ArrowHandle[],
  sceneX: number,
  sceneY: number,
  zoom: number,
): ArrowHandle | null => {
  const threshold = (HANDLE_SIZE / 2 + 4) / zoom;
  for (let i = handles.length - 1; i >= 0; i--) {
    const handle = handles[i];
    const dist = distance(handle.x, handle.y, sceneX, sceneY);
    const hitRadius = handle.type === "add" ? (ADD_HANDLE_SIZE / 2 + 4) / zoom : threshold;
    if (dist <= hitRadius) return handle;
  }
  return null;
};

/**
 * Inserts a new control point in the middle of a segment.
 */
export const addControlPoint = (
  arrow: LinearElement,
  afterIndex: number,
  sceneX: number,
  sceneY: number,
): [number, number][] => {
  const points = [...arrow.points];
  points.splice(afterIndex + 1, 0, [sceneX - arrow.x, sceneY - arrow.y]);
  return points;
};

/**
 * Removes a control point. The arrow must have at least 2 points.
 * Double-clicking a point (Miro-style) triggers this.
 */
export const deleteControlPoint = (
  arrow: LinearElement,
  index: number,
): [number, number][] | null => {
  if (arrow.points.length <= 2 || index === 0 || index === arrow.points.length - 1) {
    return null;
  }
  const points = [...arrow.points];
  points.splice(index, 1);
  return points;
};

/**
 * Resets an arrow's route to the auto-generated layout.
 */
export const resetRoute = (
  arrow: LinearElement,
  byId: Map<string, ExcaliElement>,
): [number, number][] | null => {
  // We can just call rerouteArrow. For straight arrows with >2 points,
  // we first need to drop the extra points so it fully regenerates.
  if (arrow.pathType === "straight" && arrow.points.length > 2) {
    const fresh: LinearElement = {
      ...arrow,
      points: [arrow.points[0], arrow.points[arrow.points.length - 1]],
    };
    return rerouteArrow(fresh, byId) || fresh.points;
  }
  return rerouteArrow(arrow, byId);
};
