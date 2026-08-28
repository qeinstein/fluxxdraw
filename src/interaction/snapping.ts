import { SNAP_THRESHOLD } from "../constants";
import { getRotatedBounds, type Bounds } from "../geometry";
import type { ExcaliElement } from "../types";

export interface SnapGuide {
  /** guides are always axis-aligned segments in scene coordinates */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface SnapResult {
  dx: number;
  dy: number;
  guides: SnapGuide[];
}

const edgesOf = (b: Bounds) => ({
  x: [b.x1, (b.x1 + b.x2) / 2, b.x2],
  y: [b.y1, (b.y1 + b.y2) / 2, b.y2],
});

/**
 * Nudges a dragged box so its edges/centres line up with nearby elements.
 * Returns the correction to apply plus the guides to draw.
 */
export const computeSnap = (
  moving: Bounds,
  others: ExcaliElement[],
  zoom: number,
): SnapResult => {
  const threshold = SNAP_THRESHOLD / zoom;
  const movingEdges = edgesOf(moving);

  let bestX: { delta: number; guide: SnapGuide } | null = null;
  let bestY: { delta: number; guide: SnapGuide } | null = null;

  for (const other of others) {
    const ob = getRotatedBounds(other);
    const otherEdges = edgesOf(ob);

    for (const mx of movingEdges.x) {
      for (const ox of otherEdges.x) {
        const delta = ox - mx;
        if (Number.isNaN(delta) || Math.abs(delta) > threshold) continue;
        if (bestX && Math.abs(delta) >= Math.abs(bestX.delta)) continue;
        bestX = {
          delta,
          guide: {
            x1: ox,
            y1: Math.min(moving.y1, ob.y1),
            x2: ox,
            y2: Math.max(moving.y2, ob.y2),
          },
        };
      }
    }

    for (const my of movingEdges.y) {
      for (const oy of otherEdges.y) {
        const delta = oy - my;
        if (Number.isNaN(delta) || Math.abs(delta) > threshold) continue;
        if (bestY && Math.abs(delta) >= Math.abs(bestY.delta)) continue;
        bestY = {
          delta,
          guide: {
            x1: Math.min(moving.x1, ob.x1),
            y1: oy,
            x2: Math.max(moving.x2, ob.x2),
            y2: oy,
          },
        };
      }
    }
  }

  const guides: SnapGuide[] = [];
  if (bestX) guides.push(bestX.guide);
  if (bestY) guides.push(bestY.guide);
  return { dx: bestX?.delta ?? 0, dy: bestY?.delta ?? 0, guides };
};

export const snapToGrid = (value: number, gridSize: number | null) =>
  gridSize ? Math.round(value / gridSize) * gridSize : value;
