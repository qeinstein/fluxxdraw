import { nanoid } from "nanoid";
import { store } from "../store";
import { newInstance } from "../components-model";
import { measureText } from "../elements/text";
import { getElementBounds } from "../geometry";
import { track } from "../analytics";
import { LINE_HEIGHT, STROKE_WIDTHS } from "../constants";
import { PROVIDERS, type Glyph, type ServicePreset } from "./catalog";
import type {
  ComponentDefinition,
  ExcaliElement,
  GenericElement,
  LinearElement,
  TextElement,
} from "../types";

/**
 * Builds service nodes out of ordinary elements.
 *
 * A placed service is a component instance like any other, so it selects,
 * resizes, binds arrows, groups, undoes, exports and serialises through the
 * paths that already exist. Nothing here is a special case at render time.
 */

export const NODE_WIDTH = 156;
export const NODE_HEIGHT = 96;

const GLYPH_SIZE = 30;
const GLYPH_X = 16;
const GLYPH_Y = 16;

/** Shared element fields. Presets are styled by the catalog, not the toolbar. */
const base = (x: number, y: number, width: number, height: number, stroke: string) => ({
  id: nanoid(),
  x,
  y,
  width,
  height,
  angle: 0,
  // fixed so a given service always renders with the same hand-drawn wobble
  seed: 1,
  version: 1,
  groupIds: [],
  frameId: null,
  locked: false,
  isDeleted: false,
  link: null,
  strokeColor: stroke,
  textColor: stroke,
  backgroundColor: "transparent",
  fillStyle: "solid" as const,
  // a value the toolbar can actually show as selected, not a bespoke 1.25
  strokeWidth: STROKE_WIDTHS.thin,
  strokeStyle: "solid" as const,
  // Architect: architecture diagrams read better with crisp lines than wobbly
  // ones, and the sloppiness control is right there for anyone who disagrees
  roughness: 0,
  edges: "round" as const,
  opacity: 100,
});

const shape = (
  type: GenericElement["type"],
  x: number,
  y: number,
  width: number,
  height: number,
  stroke: string,
  background = "transparent",
): GenericElement => ({
  ...base(x, y, width, height, stroke),
  backgroundColor: background,
  type,
  boundText: null,
  boundArrows: [],
});

const line = (
  x: number,
  y: number,
  points: [number, number][],
  stroke: string,
): LinearElement => {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return {
    ...base(x, y, Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), stroke),
    type: "line",
    points,
    startArrowhead: "none",
    endArrowhead: "none",
    pathType: "straight",
    startBinding: null,
    endBinding: null,
    boundText: null,
    boundArrows: [],
  };
};

const label = (
  text: string,
  x: number,
  y: number,
  fontSize: number,
  stroke: string,
): TextElement => {
  const element: TextElement = {
    ...base(x, y, 0, 0, stroke),
    type: "text",
    text,
    fontSize,
    fontFamily: "hand",
    textAlign: "left",
    verticalAlign: "top",
    lineHeight: LINE_HEIGHT,
    containerId: null,
    roughness: 0,
  };
  const { width, height } = measureText([text], element);
  return { ...element, width, height };
};

/**
 * Category glyphs, drawn in a 30×30 box at the node's top-left.
 *
 * Deliberately crude: a few primitives each, in the same stroke language as the
 * rest of a FluxxDraw drawing. They say "database" or "queue" at a glance,
 * which is what a reader of an architecture diagram needs from an icon.
 */
const glyphElements = (glyph: Glyph, accent: string): ExcaliElement[] => {
  const x = GLYPH_X;
  const y = GLYPH_Y;
  const s = GLYPH_SIZE;

  switch (glyph) {
    case "compute":
      // a chip: body plus pins
      return [
        shape("rectangle", x + 5, y + 5, s - 10, s - 10, accent),
        line(x, y + 10, [[0, 0], [5, 0]], accent),
        line(x, y + 19, [[0, 0], [5, 0]], accent),
        line(x + s - 5, y + 10, [[0, 0], [5, 0]], accent),
        line(x + s - 5, y + 19, [[0, 0], [5, 0]], accent),
      ];
    case "function":
      // a lightning bolt
      return [
        line(x + 8, y + 2, [[6, 0], [0, 13], [7, 13], [1, 26], [12, 10], [5, 10], [10, 0]], accent),
      ];
    case "container":
      // stacked boxes
      return [
        shape("rectangle", x + 2, y + 4, s - 4, 7, accent),
        shape("rectangle", x + 2, y + 13, s - 4, 7, accent),
        shape("rectangle", x + 2, y + 22, s - 4, 7, accent),
      ];
    case "storage":
      // a cylinder
      return [
        shape("ellipse", x + 3, y + 3, s - 6, 8, accent),
        line(x + 3, y + 7, [[0, 0], [0, 16]], accent),
        line(x + s - 3, y + 7, [[0, 0], [0, 16]], accent),
        shape("ellipse", x + 3, y + 19, s - 6, 8, accent),
      ];
    case "database":
      // a cylinder with a mid band, to read as a stack of records
      return [
        shape("ellipse", x + 3, y + 2, s - 6, 7, accent),
        shape("ellipse", x + 3, y + 11, s - 6, 7, accent),
        line(x + 3, y + 5, [[0, 0], [0, 18]], accent),
        line(x + s - 3, y + 5, [[0, 0], [0, 18]], accent),
        shape("ellipse", x + 3, y + 20, s - 6, 7, accent),
      ];
    case "network":
      // a globe: circle plus meridians
      return [
        shape("ellipse", x + 2, y + 2, s - 4, s - 4, accent),
        shape("ellipse", x + 10, y + 2, s - 20, s - 4, accent),
        line(x + 2, y + s / 2, [[0, 0], [s - 4, 0]], accent),
      ];
    case "cdn":
      // a hub with spokes
      return [
        shape("ellipse", x + 10, y + 10, 10, 10, accent),
        line(x + 3, y + 4, [[0, 0], [8, 7]], accent),
        line(x + s - 3, y + 4, [[0, 0], [-8, 7]], accent),
        line(x + 3, y + s - 4, [[0, 0], [8, -7]], accent),
        line(x + s - 3, y + s - 4, [[0, 0], [-8, -7]], accent),
      ];
    case "queue":
      // messages waiting in line
      return [
        shape("rectangle", x + 1, y + 8, 8, 14, accent),
        shape("rectangle", x + 11, y + 8, 8, 14, accent),
        shape("rectangle", x + 21, y + 8, 8, 14, accent),
      ];
    case "analytics":
      // a bar chart
      return [
        line(x + 2, y + s - 4, [[0, 0], [s - 4, 0]], accent),
        shape("rectangle", x + 4, y + 17, 6, 9, accent),
        shape("rectangle", x + 12, y + 10, 6, 16, accent),
        shape("rectangle", x + 20, y + 4, 6, 22, accent),
      ];
    case "security":
      // a padlock
      return [
        shape("rectangle", x + 5, y + 13, s - 10, 14, accent),
        shape("ellipse", x + 9, y + 3, 12, 16, accent),
      ];
    case "ai":
      // a node with connections
      return [
        shape("ellipse", x + 9, y + 9, 12, 12, accent),
        line(x + 2, y + 3, [[0, 0], [8, 7]], accent),
        line(x + 2, y + s - 3, [[0, 0], [8, -7]], accent),
        line(x + s - 2, y + 15, [[0, 0], [-8, 0]], accent),
        shape("ellipse", x + 1, y + 1, 4, 4, accent),
        shape("ellipse", x + 1, y + s - 5, 4, 4, accent),
        shape("ellipse", x + s - 5, y + 13, 4, 4, accent),
      ];
  }
};

/**
 * Just the glyph, boxed at the origin — for showing a service in the picker.
 *
 * Reuses the same geometry the canvas draws rather than a parallel set of
 * preview icons, so what you pick is literally what you get.
 */
export const glyphPreview = (glyph: Glyph, accent: string) => ({
  elements: glyphElements(glyph, accent).map((el) => ({
    ...el,
    x: el.x - GLYPH_X,
    y: el.y - GLYPH_Y,
  })),
  size: GLYPH_SIZE,
});

/**
 * The elements of one service node, in local coordinates with the origin at
 * (0, 0) — the shape a `ComponentDefinition` expects.
 */
export const serviceElements = (preset: ServicePreset): ExcaliElement[] => {
  const { accent, name: providerName } = PROVIDERS[preset.provider];

  return [
    shape("rectangle", 0, 0, NODE_WIDTH, NODE_HEIGHT, accent, "transparent"),
    ...glyphElements(preset.glyph, accent),
    label(preset.name, GLYPH_X, 53, 16, accent),
    label(`${providerName} · ${preset.category}`, GLYPH_X, 72, 11, accent),
  ];
};

/** The definition for a service, built on demand and cached in the document. */
export const serviceDefinition = (preset: ServicePreset): ComponentDefinition => ({
  id: preset.id,
  name: preset.name,
  elements: serviceElements(preset),
  width: NODE_WIDTH,
  height: NODE_HEIGHT,
  version: 1,
});

const STEP = 26;

/**
 * First spot at or after (x, y) whose node box hits nothing already on the
 * canvas, searched diagonally.
 *
 * Without this, picking two services in a row drops the second exactly on top
 * of the first and it looks like nothing happened.
 */
const freeSpot = (x: number, y: number): [number, number] => {
  const clashes = (px: number, py: number) =>
    store.visibleElements.some((el) => {
      const b = getElementBounds(el);
      return (
        px < b.x2 && px + NODE_WIDTH > b.x1 && py < b.y2 && py + NODE_HEIGHT > b.y1
      );
    });

  for (let i = 0; i < 60; i++) {
    const ox = x + i * STEP;
    const oy = y + i * STEP;
    if (!clashes(ox, oy)) return [ox, oy];
  }
  return [x, y];
};

/**
 * Places a service on the canvas.
 *
 * The definition is registered on first use, so a document only carries the
 * services it actually contains — and carries them in full, which is what lets
 * the file open anywhere.
 */
export const placeService = (preset: ServicePreset, atX: number, atY: number) => {
  track("place", preset.id);
  const [x, y] = freeSpot(atX, atY);
  store.mutate(() => {
    if (!store.components[preset.id]) {
      store.registerComponent(serviceDefinition(preset));
    }
    const instance = newInstance(preset.id, x, y, NODE_WIDTH, NODE_HEIGHT);
    store.addElements(instance);
    store.appState = { ...store.appState, selectedIds: [instance.id], tool: "selection" };
  });
};
