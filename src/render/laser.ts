import getStroke from "perfect-freehand";

export interface LaserPoint {
  x: number;
  y: number;
  time: number;
}

/**
 * Laser pointer trail, following the approach Excalidraw uses in its
 * `laser-pointer` package.
 *
 * The important part is that this is a *filled tapered polygon*, not a stroked
 * line. Stroking segments individually — even as one path — gives a uniform
 * ribbon with visible banding where semi-transparent caps overlap. Excalidraw
 * instead computes a per-point radius and fills the resulting outline, so the
 * trail is full width at the pointer and tapers smoothly to nothing at its
 * tail.
 *
 * Each point's radius is the smaller of two factors, both eased:
 *   - time: the point shrinks to nothing over DECAY_TIME
 *   - length: the oldest DECAY_LENGTH points taper away behind the head
 *
 * Source: excalidraw/packages/excalidraw/laserTrails.ts
 */

/** Excalidraw's easing: 1 - (1 - k)^4. */
const easeOut = (k: number) => 1 - Math.pow(1 - k, 4);

const DECAY_TIME = 1000;
const DECAY_LENGTH = 50;

/** Trail width in screen pixels, held constant regardless of zoom. */
const LASER_SIZE = 12;

/** Excalidraw's DEFAULT_LASER_COLOR. */
export const LASER_COLOR = "#ff0000";

export const drawLaserTrail = (
  ctx: CanvasRenderingContext2D,
  trail: LaserPoint[],
  zoom: number,
  now: number,
) => {
  const total = trail.length;
  if (total < 2) return;

  // perfect-freehand reads the third component as pressure, which with
  // thinning: 1 maps straight onto the radius — the same role Excalidraw's
  // sizeMapping plays.
  const inputs = trail.map((point, index) => {
    const age = Math.max(0, 1 - (now - point.time) / DECAY_TIME);
    const fromTail = total - 1 - index;
    const length = (DECAY_LENGTH - Math.min(DECAY_LENGTH, fromTail)) / DECAY_LENGTH;
    return [point.x, point.y, Math.min(easeOut(length), easeOut(age))];
  });

  const outline = getStroke(inputs, {
    size: LASER_SIZE / zoom,
    thinning: 1,
    smoothing: 0.5,
    streamline: 0.4,
    simulatePressure: false,
    // the head is the live pointer position, so it must not be capped off
    last: false,
  });

  if (outline.length < 3) return;

  const path = new Path2D();
  path.moveTo(outline[0][0], outline[0][1]);
  for (let i = 1; i < outline.length; i++) {
    const [x0, y0] = outline[i];
    const [x1, y1] = outline[(i + 1) % outline.length];
    // quadratic through the midpoints keeps the outline smooth
    path.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
  }
  path.closePath();

  ctx.save();
  ctx.fillStyle = LASER_COLOR;
  ctx.fill(path);
  ctx.restore();
};
