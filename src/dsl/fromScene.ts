import { store } from "../store";
import { describeFill, emptySpec, type DiagramSpec, type EdgeKind, type NodeShape } from "./spec";
import type { ExcaliElement, LinearElement, TextElement } from "../types";

/**
 * Reads the diagram back out of the canvas.
 *
 * Only the diagram-shaped part of a drawing is representable as text: boxes,
 * ellipses, diamonds and the connectors between them. Freehand strokes,
 * images, frames and loose text have no textual form, so they are ignored here
 * and left completely untouched on the canvas.
 */

const SHAPE_FOR_TYPE: Partial<Record<ExcaliElement["type"], NodeShape>> = {
  rectangle: "rectangle",
  ellipse: "ellipse",
  diamond: "diamond",
};

/** Turns a label into a usable identifier, e.g. "API Gateway" -> "api_gateway". */
export const slugify = (input: string, fallback: string): string => {
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^(\d)/, "n$1");
  return slug || fallback;
};

const labelOf = (el: ExcaliElement): string => {
  if (!("boundText" in el) || !el.boundText) return "";
  const text = store.getElement(el.boundText) as TextElement | null;
  return text?.text.replace(/\n/g, " ").trim() ?? "";
};

const edgeKindOf = (arrow: LinearElement): EdgeKind => {
  if (arrow.type === "line") return "line";
  return arrow.strokeStyle === "dashed" ? "dashed" : "arrow";
};

export interface SceneSpec {
  spec: DiagramSpec;
  /** element id for each node key, so edits can be applied in place */
  keyToElementId: Map<string, string>;
  /** how many elements on the canvas can't be represented as text */
  untranslatable: number;
}

export const specFromScene = (): SceneSpec => {
  const spec = emptySpec();
  const keyToElementId = new Map<string, string>();
  const elementIdToKey = new Map<string, string>();
  const theme = store.appState.theme;
  const used = new Set<string>();

  const shapes = store.visibleElements.filter((el) => SHAPE_FOR_TYPE[el.type]);

  for (const shape of shapes) {
    const label = labelOf(shape);
    // a key the user already wrote wins, so hand-authored names survive
    let key = shape.dslKey ?? slugify(label, "node");
    if (used.has(key)) {
      let suffix = 2;
      while (used.has(`${key}_${suffix}`)) suffix++;
      key = `${key}_${suffix}`;
    }
    used.add(key);
    keyToElementId.set(key, shape.id);
    elementIdToKey.set(shape.id, key);

    spec.nodes.push({
      key,
      label: label || key,
      shape: SHAPE_FOR_TYPE[shape.type]!,
      fill: describeFill(shape.backgroundColor, theme),
    });
  }

  for (const el of store.visibleElements) {
    if (el.type !== "arrow" && el.type !== "line") continue;
    const arrow = el as LinearElement;
    const from = arrow.startBinding && elementIdToKey.get(arrow.startBinding.elementId);
    const to = arrow.endBinding && elementIdToKey.get(arrow.endBinding.elementId);
    // an unbound connector isn't a relationship, so it has no textual form
    if (!from || !to || from === to) continue;
    if (spec.edges.some((e) => e.from === from && e.to === to)) continue;
    spec.edges.push({
      from,
      to,
      kind: edgeKindOf(arrow),
      label: labelOf(arrow) || undefined,
    });
  }

  const representable = new Set(shapes.map((s) => s.id));
  const untranslatable = store.visibleElements.filter(
    (el) =>
      !representable.has(el.id) &&
      el.type !== "arrow" &&
      el.type !== "line" &&
      !(el.type === "text" && el.containerId),
  ).length;

  return { spec, keyToElementId, untranslatable };
};

/** Renders a spec back into the text form the parser accepts. */
export const specToText = (spec: DiagramSpec): string => {
  const lines: string[] = [];

  for (const node of spec.nodes) {
    let line = node.key;
    if (node.label && node.label !== node.key) line += `: ${node.label}`;
    if (node.shape !== "rectangle") line += ` [${node.shape}]`;
    if (node.fill) line += ` {${node.fill}}`;
    lines.push(line);
  }

  if (spec.nodes.length && spec.edges.length) lines.push("");

  const operator: Record<EdgeKind, string> = {
    arrow: "->",
    dashed: "-->",
    line: "--",
  };
  for (const edge of spec.edges) {
    let line = `${edge.from} ${operator[edge.kind]} ${edge.to}`;
    if (edge.label) line += `: ${edge.label}`;
    lines.push(line);
  }

  return lines.join("\n");
};
