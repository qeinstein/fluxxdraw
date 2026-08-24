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

export type NodeShape = "rectangle" | "ellipse" | "diamond";
export type EdgeKind = "arrow" | "dashed" | "line";

export interface NodeSpec {
  /** stable identifier, written by the user in the text */
  key: string;
  label: string;
  shape: NodeShape;
  /** named palette colour or hex; undefined means transparent */
  fill?: string;
}

export interface EdgeSpec {
  from: string;
  to: string;
  label?: string;
  kind: EdgeKind;
}

export interface DiagramSpec {
  nodes: NodeSpec[];
  edges: EdgeSpec[];
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
    .map((n) => `${n.key}|${n.label}|${n.shape}|${n.fill ?? ""}`);
  const edges = [...spec.edges]
    .sort((a, b) => edgeId(a).localeCompare(edgeId(b)))
    .map((e) => `${e.from}|${e.to}|${e.kind}|${e.label ?? ""}`);
  return JSON.stringify({ nodes, edges });
};

export const specsEqual = (a: DiagramSpec, b: DiagramSpec) => canonical(a) === canonical(b);
