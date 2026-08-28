import rough from "roughjs/bin/rough";
import type { Drawable, Options } from "roughjs/bin/core";
import getStroke from "perfect-freehand";
import type { ExcaliElement, FreedrawElement, LinearElement } from "../types";
import { getElementBounds } from "../geometry";
import { resolveColor } from "../constants";
import type { ThemeName } from "../constants";

const generator = rough.generator();

const dashPattern = (el: ExcaliElement): number[] | undefined => {
  if (el.strokeStyle === "dashed") return [8, 8 + el.strokeWidth * 2];
  if (el.strokeStyle === "dotted") return [1.5, 6 + el.strokeWidth * 2];
  return undefined;
};

const roughOptions = (el: ExcaliElement, theme: ThemeName): Options => {
  const dash = dashPattern(el);
  const stroke = resolveColor(el.strokeColor, theme, "stroke");
  const bg = resolveColor(el.backgroundColor, theme, "background");
  return {
    seed: el.seed,
    stroke: stroke,
    strokeWidth: el.strokeWidth,
    roughness: el.roughness,
    fill: bg === "transparent" ? undefined : bg,
    fillStyle: el.fillStyle,
    fillWeight: el.strokeWidth / 2,
    hachureGap: el.strokeWidth * 4,
    disableMultiStroke: el.strokeStyle !== "solid",
    strokeLineDash: dash,
    // dashes should not be duplicated by rough's sketchy double-stroke
    preserveVertices: el.roughness === 0,
    curveFitting: 1,
  };
};

/** Corner radius used when an element's edges are "round". */
export const cornerRadius = (el: ExcaliElement) => {
  const size = Math.min(Math.abs(el.width), Math.abs(el.height));
  return Math.min(size * 0.25, 32);
};

const roundedRectPath = (w: number, h: number, r: number) => {
  const rr = Math.min(r, w / 2, h / 2);
  return [
    `M ${rr} 0`,
    `L ${w - rr} 0`,
    `Q ${w} 0 ${w} ${rr}`,
    `L ${w} ${h - rr}`,
    `Q ${w} ${h} ${w - rr} ${h}`,
    `L ${rr} ${h}`,
    `Q 0 ${h} 0 ${h - rr}`,
    `L 0 ${rr}`,
    `Q 0 0 ${rr} 0`,
  ].join(" ");
};

/**
 * Points a linear element actually renders through. Elbowed arrows get
 * orthogonal waypoints inserted between each pair of user points.
 *
 * Important: this must stay in sync with `getHitTestPoints()` in hitTest.ts
 * so that clicks land on the visible path.
 */
export const getRenderPoints = (el: LinearElement): [number, number][] => {
  if (el.pathType !== "elbow" || el.points.length < 2) return el.points;
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
 * Geometry for one arrowhead: the tip plus the two barb points (and, for
 * closed heads, whether the shape should be filled).
 */
export const getArrowheadShape = (
  el: LinearElement,
  position: "start" | "end",
): { path: [number, number][]; closed: boolean; filled: boolean; circle?: number } | null => {
  const pts = getRenderPoints(el);
  if (pts.length < 2) return null;
  const type = position === "start" ? el.startArrowhead : el.endArrowhead;
  if (type === "none") return null;

  const [tipX, tipY] = position === "start" ? pts[0] : pts[pts.length - 1];
  const [prevX, prevY] = position === "start" ? pts[1] : pts[pts.length - 2];
  const angle = Math.atan2(tipY - prevY, tipX - prevX);
  const size = Math.max(12, 8 + el.strokeWidth * 4);

  if (type === "dot") return { path: [[tipX, tipY]], closed: false, filled: true, circle: size / 3 };

  if (type === "bar") {
    const perp = angle + Math.PI / 2;
    const half = size / 2;
    return {
      path: [
        [tipX + Math.cos(perp) * half, tipY + Math.sin(perp) * half],
        [tipX - Math.cos(perp) * half, tipY - Math.sin(perp) * half],
      ],
      closed: false,
      filled: false,
    };
  }

  const spread = type === "arrow" ? Math.PI / 7 : Math.PI / 9;
  const a: [number, number] = [
    tipX - Math.cos(angle - spread) * size,
    tipY - Math.sin(angle - spread) * size,
  ];
  const b: [number, number] = [
    tipX - Math.cos(angle + spread) * size,
    tipY - Math.sin(angle + spread) * size,
  ];

  if (type === "arrow") return { path: [a, [tipX, tipY], b], closed: false, filled: false };
  return {
    path: [[tipX, tipY], a, b],
    closed: true,
    filled: type === "triangle",
  };
};

/** SVG path data for a freehand stroke, usable by both canvas and SVG backends. */
export const freedrawPath = (el: FreedrawElement): string => {
  const inputPoints = el.points.map(([x, y], i) => [x, y, el.pressures[i] ?? 0.5]);
  const stroke = getStroke(inputPoints, {
    size: el.strokeWidth * 2.5 + 2,
    thinning: 0.6,
    smoothing: 0.65,
    streamline: 0.6,
    easing: (t) => Math.sin((t * Math.PI) / 2),
    simulatePressure: el.pressures.every((p) => p === 0.5),
    last: true,
  });
  if (stroke.length === 0) return "";
  const d = stroke.reduce((acc, [x0, y0], i) => {
    const [x1, y1] = stroke[(i + 1) % stroke.length];
    acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
    return acc;
  }, [] as number[]);
  let path = `M ${d[0]} ${d[1]} Q`;
  // step in complete quadratic segments; a trailing partial one would emit NaN
  for (let i = 2; i + 3 < d.length; i += 4) {
    path += ` ${d[i]} ${d[i + 1]} ${d[i + 2]} ${d[i + 3]}`;
  }
  return `${path} Z`;
};

/**
 * Rough.js drawables for an element, in the element's own local coordinates
 * (translate by x/y before drawing). Text, images and embeds are drawn by the
 * backends directly and produce no drawables.
 */
const buildDrawables = (el: ExcaliElement, theme: ThemeName): Drawable[] => {
  const opts = roughOptions(el, theme);
  const w = el.width;
  const h = el.height;

  switch (el.type) {
    case "rectangle": {
      if (el.edges === "round" && Math.min(Math.abs(w), Math.abs(h)) > 8) {
        return [generator.path(roundedRectPath(w, h, cornerRadius(el)), opts)];
      }
      return [generator.rectangle(0, 0, w, h, opts)];
    }
    case "sticky": {
      const fold = Math.min(24, Math.abs(w) * 0.2, Math.abs(h) * 0.2);
      const signX = w >= 0 ? 1 : -1;
      const signY = h >= 0 ? 1 : -1;
      
      // We draw the body of the sticky note, missing the top-right corner
      const pts: [number, number][] = [
        [0, 0],
        [w - (fold * signX), 0],
        [w, fold * signY],
        [w, h],
        [0, h]
      ];
      
      const body = generator.polygon(pts, opts);
      
      // Draw the folded corner crease at top right
      const foldCrease = generator.linearPath([
        [w - (fold * signX), 0],
        [w - (fold * signX), fold * signY],
        [w, fold * signY]
      ], { ...opts, stroke: "rgba(0,0,0,0.15)", strokeWidth: 1.5 });
      
      return [body, foldCrease];
    }
    case "frame": {
      if (el.edges === "round" && Math.min(Math.abs(w), Math.abs(h)) > 8) {
        return [generator.path(roundedRectPath(w, h, cornerRadius(el)), opts)];
      }
      return [generator.rectangle(0, 0, w, h, opts)];
    }
    case "ellipse":
      return [generator.ellipse(w / 2, h / 2, w, h, opts)];
    case "diamond": {
      const pts: [number, number][] = [
        [w / 2, 0],
        [w, h / 2],
        [w / 2, h],
        [0, h / 2],
      ];
      return [generator.polygon(pts, opts)];
    }
    case "arrow":
    case "line": {
      const pts = getRenderPoints(el as LinearElement);
      if (pts.length < 2) return [];
      const out: Drawable[] = [];
      const shouldCurve = (el.edges === "round" || (el as LinearElement).pathType === "curved") && (el as LinearElement).pathType !== "elbow";
      const isClosed =
        el.type === "line" &&
        pts.length > 2 &&
        Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 8;

      if (isClosed) {
        out.push(generator.polygon(pts, opts));
      } else if (shouldCurve) {
        out.push(generator.curve(pts, { ...opts, fill: undefined }));
      } else if ((el as LinearElement).pathType === "elbow" && pts.length > 2) {
        // Render elbow arrow with rounded corners
        const radius = 8; // ELBOW_CORNER_RADIUS
        let d = `M ${pts[0][0]} ${pts[0][1]}`;
        for (let i = 1; i < pts.length - 1; i++) {
          const prev = pts[i - 1];
          const curr = pts[i];
          const next = pts[i + 1];
          // vectors
          const dx1 = curr[0] - prev[0];
          const dy1 = curr[1] - prev[1];
          const len1 = Math.hypot(dx1, dy1);
          const dx2 = next[0] - curr[0];
          const dy2 = next[1] - curr[1];
          const len2 = Math.hypot(dx2, dy2);
          
          if (len1 < 1e-6 || len2 < 1e-6) continue;
          
          const r = Math.min(radius, len1 / 2, len2 / 2);
          const p1x = curr[0] - (dx1 / len1) * r;
          const p1y = curr[1] - (dy1 / len1) * r;
          const p2x = curr[0] + (dx2 / len2) * r;
          const p2y = curr[1] + (dy2 / len2) * r;
          
          d += ` L ${p1x} ${p1y} Q ${curr[0]} ${curr[1]} ${p2x} ${p2y}`;
        }
        d += ` L ${pts[pts.length - 1][0]} ${pts[pts.length - 1][1]}`;
        out.push(generator.path(d, { ...opts, fill: undefined }));
      } else {
        out.push(generator.linearPath(pts, { ...opts, fill: undefined }));
      }

      if (el.type === "arrow") {
        for (const pos of ["start", "end"] as const) {
          const head = getArrowheadShape(el as LinearElement, pos);
          if (!head) continue;
          const stroke = resolveColor(el.strokeColor, theme, "stroke");
          const headOpts: Options = {
            ...opts,
            fill: head.filled ? stroke : undefined,
            fillStyle: "solid",
            strokeLineDash: undefined,
          };
          if (head.circle) {
            out.push(
              generator.circle(head.path[0][0], head.path[0][1], head.circle * 2, {
                ...headOpts,
                fill: stroke,
              }),
            );
          } else if (head.closed) {
            out.push(generator.polygon(head.path, headOpts));
          } else {
            out.push(generator.linearPath(head.path, { ...headOpts, fill: undefined }));
          }
        }
      }
      return out;
    }
    default:
      return [];
  }
};

const cache = new WeakMap<ExcaliElement, { version: number; theme: ThemeName; drawables: Drawable[] }>();

/** Cached per element identity + version + theme so re-renders stay cheap. */
export const getDrawables = (el: ExcaliElement, theme: ThemeName): Drawable[] => {
  const hit = cache.get(el);
  if (hit && hit.version === el.version && hit.theme === theme) return hit.drawables;
  const drawables = buildDrawables(el, theme);
  cache.set(el, { version: el.version, theme, drawables });
  return drawables;
};

export { generator };

/** Bounds padded by half the stroke width, so exports don't clip thick outlines. */
export const getPaddedBounds = (el: ExcaliElement) => {
  const b = getElementBounds(el);
  const pad = el.strokeWidth * 2 + 2;
  return { x1: b.x1 - pad, y1: b.y1 - pad, x2: b.x2 + pad, y2: b.y2 + pad };
};
