import { PALETTE } from "../constants";
import type { ThemeName } from "../constants";

/**
 * The diagram, expressed as plain data.
 *
 * Both the text panel and the canvas are views onto this. Keeping a canonical
 * form in the middle is what makes the two directions safe to run against each
 * other: a change is only written to the other side when the canonical spec
 * actually differs, which is what stops the two views from echoing edits back
 * and forth forever.
 */

export type NodeShape =
  | "rectangle"
  | "ellipse"
  | "diamond"
  | "sticky"
  | "triangle"
  | "hexagon"
  | "parallelogram"
  | "cylinder";
export type EdgeKind = "arrow" | "dashed" | "line";

import type {
  Arrowhead,
  Edges,
  FillStyle,
  FontFamily,
  PathType,
  StrokeStyle,
  TextAlign,
  VerticalAlign,
} from "../types";

export type PortName = "auto" | "north" | "east" | "south" | "west";

/** Optional visual properties accepted by rich declarations. */
export interface StyleSpec {
  strokeColor?: string;
  backgroundColor?: string;
  textColor?: string;
  fillStyle?: FillStyle;
  strokeWidth?: number;
  strokeStyle?: StrokeStyle;
  roughness?: number;
  edges?: Edges;
  opacity?: number;
  fontSize?: number;
  fontFamily?: FontFamily;
  textAlign?: TextAlign;
  verticalAlign?: VerticalAlign;
}

export interface GeometrySpec {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  angle?: number;
}

export interface NodeSpec extends GeometrySpec, StyleSpec {
  /** stable identifier, written by the user in the text */
  key: string;
  label: string;
  shape: NodeShape;
  /** named palette colour or hex; undefined means transparent */
  fill?: string;
  /** an installed component or built-in service id, e.g. `aws:s3` */
  component?: string;
  /** explicit frame key for rich declarations */
  frame?: string;
}

export interface EdgeSpec extends StyleSpec {
  from: string;
  to: string;
  label?: string;
  kind: EdgeKind;
  route?: PathType;
  startArrowhead?: Arrowhead;
  endArrowhead?: Arrowhead;
  startPort?: PortName;
  endPort?: PortName;
  /** Optional local points for a manually routed connector. */
  points?: [number, number][];
}

export interface TextSpec extends GeometrySpec, StyleSpec {
  key: string;
  text: string;
  frame?: string;
}

export interface FrameSpec extends GeometrySpec, StyleSpec {
  key: string;
  label: string;
}

export type PathSpecKind = "freehand" | "line";

export interface PathSpec extends GeometrySpec, StyleSpec {
  key: string;
  kind: PathSpecKind;
  points: [number, number][];
  pressures?: number[];
  closed?: boolean;
  frame?: string;
}

export interface DiagramSpec {
  nodes: NodeSpec[];
  edges: EdgeSpec[];
  /** Rich declarations are optional to keep the legacy AST source-compatible. */
  texts?: TextSpec[];
  frames?: FrameSpec[];
  paths?: PathSpec[];
  layout?: "down" | "right" | "grid" | "none";
  /** true when the source used the extended declaration syntax */
  rich?: boolean;
}

export const emptySpec = (): DiagramSpec => ({ nodes: [], edges: [] });

/** Colour words accepted in the text, resolved per theme. */
export const COLOR_WORDS = ["red", "green", "blue", "yellow", "grey"] as const;
export type ColorWord = (typeof COLOR_WORDS)[number];

/** Palette index for each colour word; index 0 is transparent/no fill. */
const COLOR_INDEX: Record<ColorWord, number> = {
  red: 1,
  green: 2,
  blue: 3,
  yellow: 4,
  grey: 0,
};

export const resolveFill = (fill: string | undefined, theme: ThemeName): string => {
  if (!fill) return "transparent";
  if (fill.startsWith("#")) return fill;
  const index = COLOR_INDEX[fill as ColorWord];
  if (index === undefined) return "transparent";
  return index === 0 ? "transparent" : PALETTE[theme].background[index];
};

/** Inverse of resolveFill, for turning a drawing back into text. */
export const describeFill = (color: string, theme: ThemeName): string | undefined => {
  if (!color || color === "transparent") return undefined;
  for (const word of COLOR_WORDS) {
    const index = COLOR_INDEX[word];
    if (index > 0 && PALETTE[theme].background[index] === color) return word;
  }
  // fall back to the literal value so a custom colour still round-trips
  return color;
};

export const edgeId = (edge: Pick<EdgeSpec, "from" | "to">) => `${edge.from}→${edge.to}`;

/**
 * Order-independent string form, used purely for equality checks. Two specs
 * with the same content compare equal regardless of how they were written.
 */
export const canonical = (spec: DiagramSpec): string => {
  const nodes = [...spec.nodes]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((n) => n);
  const edges = [...spec.edges]
    .sort((a, b) => edgeId(a).localeCompare(edgeId(b)))
    .map((e) => e);
  const texts = [...(spec.texts ?? [])].sort((a, b) => a.key.localeCompare(b.key));
  const frames = [...(spec.frames ?? [])].sort((a, b) => a.key.localeCompare(b.key));
  const paths = [...(spec.paths ?? [])].sort((a, b) => a.key.localeCompare(b.key));
  return JSON.stringify({ nodes, edges, texts, frames, paths, layout: spec.layout ?? "none", rich: spec.rich ?? false });
};

export const specsEqual = (a: DiagramSpec, b: DiagramSpec) => canonical(a) === canonical(b);
