import { store } from "../store";
import { describeFill, emptySpec, type DiagramSpec, type EdgeKind, type NodeShape, type PortName } from "./spec";
import type { ExcaliElement, GenericElement, InstanceElement, LinearElement, TextElement } from "../types";

/**
 * Reads the diagram back out of the canvas.
 *
 * Elements created by the text compiler carry a `dslKey`, so the rich form can
 * round-trip geometry, styling, frames and paths without turning every
 * hand-drawn stroke into noisy source text. Unmanaged freehand work remains
 * protected and is reported as before.
 */

const SHAPE_FOR_TYPE: Partial<Record<ExcaliElement["type"], NodeShape>> = {
  rectangle: "rectangle",
  ellipse: "ellipse",
  diamond: "diamond",
  sticky: "sticky",
  triangle: "triangle",
  hexagon: "hexagon",
  parallelogram: "parallelogram",
  cylinder: "cylinder",
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

type NodeElement = GenericElement | InstanceElement;

const isNode = (el: ExcaliElement): el is NodeElement =>
  Boolean(SHAPE_FOR_TYPE[el.type]) || el.type === "instance";

const nodeLabel = (el: NodeElement) => {
  const bound = labelOf(el);
  if (bound) return bound;
  if (el.type !== "instance") return "";
  const definition = store.components[el.componentId];
  const label = definition?.elements.find(
    (child): child is TextElement => child.type === "text" && Boolean(child.text.trim()),
  );
  return label?.text.trim() || definition?.name || el.componentId;
};

const isClose = (a: number, b: number) => Math.abs(a - b) < 0.08;

const portOf = (el: LinearElement, binding: LinearElement["startBinding"]): PortName | undefined => {
  if (!binding?.fixedPoint) return undefined;
  const [x, y] = binding.fixedPoint;
  if (isClose(x, 0.5) && isClose(y, 0)) return "north";
  if (isClose(x, 1) && isClose(y, 0.5)) return "east";
  if (isClose(x, 0.5) && isClose(y, 1)) return "south";
  if (isClose(x, 0) && isClose(y, 0.5)) return "west";
  void el;
  return "auto";
};

const addGeometry = (el: ExcaliElement, managed: boolean) => managed
  ? { x: el.x, y: el.y, width: el.width, height: el.height, ...(el.angle ? { angle: el.angle } : {}) }
  : {};

const addStyle = (el: ExcaliElement, managed: boolean) => managed
  ? {
      strokeColor: el.strokeColor,
      backgroundColor: el.backgroundColor,
      textColor: el.textColor,
      fillStyle: el.fillStyle,
      strokeWidth: el.strokeWidth,
      strokeStyle: el.strokeStyle,
      roughness: el.roughness,
      edges: el.edges,
      opacity: el.opacity,
    }
  : {};

export interface SceneSpec {
  spec: DiagramSpec;
  /** element id for each node key, so edits can be applied in place */
  keyToElementId: Map<string, string>;
  frameKeyToElementId: Map<string, string>;
  textKeyToElementId: Map<string, string>;
  pathKeyToElementId: Map<string, string>;
  /** how many elements on the canvas can't be represented as text */
  untranslatable: number;
}

export const specFromScene = (): SceneSpec => {
  const spec = emptySpec();
  const keyToElementId = new Map<string, string>();
  const frameKeyToElementId = new Map<string, string>();
  const textKeyToElementId = new Map<string, string>();
  const pathKeyToElementId = new Map<string, string>();
  const elementIdToKey = new Map<string, string>();
  const theme = store.appState.theme;
  const used = new Set<string>();
  const frameIdToKey = new Map(
    store.visibleElements
      .filter((el) => el.type === "frame" && Boolean(el.dslKey))
      .map((el) => [el.id, el.dslKey!] as const),
  );

  const uniqueKey = (requested: string, fallback: string) => {
    let key = requested || fallback;
    if (used.has(key)) {
      let suffix = 2;
      while (used.has(`${key}_${suffix}`)) suffix++;
      key = `${key}_${suffix}`;
    }
    used.add(key);
    return key;
  };

  const shapes = store.visibleElements.filter(isNode);

  for (const shape of shapes) {
    // a key the user already wrote wins, so hand-authored names survive
    const managed = Boolean(shape.dslKey);
    const key = uniqueKey(shape.dslKey ?? slugify(nodeLabel(shape), "node"), "node");
    keyToElementId.set(key, shape.id);
    elementIdToKey.set(shape.id, key);

    const frame = shape.frameId ? frameIdToKey.get(shape.frameId) : undefined;
    spec.nodes.push({
      key,
      label: nodeLabel(shape) || key,
      shape: shape.type === "instance" ? "rectangle" : SHAPE_FOR_TYPE[shape.type]!,
      fill: shape.type === "instance" ? undefined : describeFill(shape.backgroundColor, theme),
      ...(shape.type === "instance" ? { component: shape.componentId } : {}),
      ...addGeometry(shape, managed),
      ...addStyle(shape, managed),
      ...(frame ? { frame } : {}),
    });
  }

  for (const el of store.visibleElements) {
    if (el.type !== "arrow" && el.type !== "line") continue;
    const arrow = el as LinearElement;
    const from = arrow.startBinding && elementIdToKey.get(arrow.startBinding.elementId);
    const to = arrow.endBinding && elementIdToKey.get(arrow.endBinding.elementId);
    // an unbound connector is a free line, handled as a path below
    if (from && to && from !== to) {
      if (spec.edges.some((e) => e.from === from && e.to === to)) continue;
      const managed = Boolean(arrow.dslKey);
      spec.edges.push({
        from,
        to,
        kind: edgeKindOf(arrow),
        label: labelOf(arrow) || undefined,
        route: arrow.pathType !== "straight" ? arrow.pathType : undefined,
        ...(managed ? {
          startArrowhead: arrow.startArrowhead,
          endArrowhead: arrow.endArrowhead,
          startPort: portOf(arrow, arrow.startBinding),
          endPort: portOf(arrow, arrow.endBinding),
          points: arrow.points,
          ...addStyle(arrow, true),
        } : {}),
      });
      continue;
    }
    if (arrow.dslKey) {
      const key = uniqueKey(arrow.dslKey, "line");
      pathKeyToElementId.set(key, arrow.id);
      if (!spec.paths) spec.paths = [];
      const frame = arrow.frameId ? frameIdToKey.get(arrow.frameId) : undefined;
      spec.paths.push({
        key,
        kind: "line",
        points: arrow.points,
        x: arrow.x,
        y: arrow.y,
        closed: arrow.points.length > 2 && arrow.points[0][0] === arrow.points.at(-1)![0] && arrow.points[0][1] === arrow.points.at(-1)![1],
        ...addStyle(arrow, true),
        ...(frame ? { frame } : {}),
      });
    }
  }

  for (const el of store.visibleElements) {
    if (el.type === "frame" && el.dslKey) {
      const key = uniqueKey(el.dslKey, "frame");
      frameKeyToElementId.set(key, el.id);
      if (!spec.frames) spec.frames = [];
      spec.frames.push({
        key,
        label: el.name,
        x: el.x,
        y: el.y,
        width: el.width,
        height: el.height,
        ...addStyle(el, true),
      });
    }
    if (el.type === "text" && !el.containerId && el.dslKey) {
      const key = uniqueKey(el.dslKey, "text");
      textKeyToElementId.set(key, el.id);
      if (!spec.texts) spec.texts = [];
      const frame = el.frameId ? frameIdToKey.get(el.frameId) : undefined;
      spec.texts.push({
        key,
        text: el.text,
        x: el.x,
        y: el.y,
        width: el.width,
        height: el.height,
        fontSize: el.fontSize,
        fontFamily: el.fontFamily,
        textAlign: el.textAlign,
        verticalAlign: el.verticalAlign,
        ...addStyle(el, true),
        ...(frame ? { frame } : {}),
      });
    }
    if (el.type === "freedraw" && el.dslKey) {
      const key = uniqueKey(el.dslKey, "path");
      pathKeyToElementId.set(key, el.id);
      if (!spec.paths) spec.paths = [];
      const frame = el.frameId ? frameIdToKey.get(el.frameId) : undefined;
      spec.paths.push({
        key,
        kind: "freehand",
        points: el.points,
        pressures: el.pressures,
        x: el.x,
        y: el.y,
        ...addStyle(el, true),
        ...(frame ? { frame } : {}),
      });
    }
  }

  const representable = new Set([
    ...shapes.map((shape) => shape.id),
    ...[...frameKeyToElementId.values()],
    ...[...textKeyToElementId.values()],
    ...[...pathKeyToElementId.values()],
  ]);
  const connectorIds = new Set(
    store.visibleElements
      .filter((el) => (el.type === "arrow" || el.type === "line") && el.startBinding && el.endBinding)
      .map((el) => el.id),
  );
  const boundLabelIds = new Set(
    store.visibleElements
      .filter((el) => "boundText" in el && el.boundText)
      .map((el) => (el as { boundText: string }).boundText),
  );
  const untranslatable = store.visibleElements.filter(
    (el) => !representable.has(el.id) && !connectorIds.has(el.id) && !boundLabelIds.has(el.id),
  ).length;

  if (shapes.some((shape) => Boolean(shape.dslKey)) || (spec.frames?.length ?? 0) > 0 || (spec.texts?.length ?? 0) > 0 || (spec.paths?.length ?? 0) > 0) {
    spec.rich = true;
  }

  return {
    spec,
    keyToElementId,
    frameKeyToElementId,
    textKeyToElementId,
    pathKeyToElementId,
    untranslatable,
  };
};

const quote = (value: string) => `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

const styleText = (item: Record<string, unknown>) => {
  const parts: string[] = [];
  const aliases: [string, string][] = [
    ["strokeColor", "stroke"],
    ["textColor", "textColor"],
    ["fillStyle", "fillStyle"],
    ["strokeWidth", "strokeWidth"],
    ["strokeStyle", "strokeStyle"],
    ["roughness", "roughness"],
    ["edges", "edges"],
    ["opacity", "opacity"],
    ["fontSize", "fontSize"],
    ["fontFamily", "font"],
    ["textAlign", "align"],
    ["verticalAlign", "valign"],
  ];
  for (const [property, alias] of aliases) {
    if (item[property] !== undefined) parts.push(`${alias}=${String(item[property])}`);
  }
  return parts;
};

const geometryText = (item: Record<string, unknown>) => {
  const parts: string[] = [];
  if (typeof item.x === "number" && typeof item.y === "number") parts.push(`at=${item.x},${item.y}`);
  if (typeof item.width === "number" && typeof item.height === "number") parts.push(`size=${item.width}x${item.height}`);
  if (typeof item.angle === "number" && item.angle !== 0) parts.push(`angle=${item.angle}`);
  return parts;
};

/** Renders a spec back into the text form the parser accepts. */
export const specToText = (spec: DiagramSpec): string => {
  const lines: string[] = [];
  const rich = (item: Record<string, unknown>) =>
    Object.keys(item).some((key) => ["x", "y", "width", "height", "component", "frame", "strokeColor", "backgroundColor", "textColor", "fillStyle", "strokeWidth", "strokeStyle", "roughness", "edges", "opacity", "fontSize", "fontFamily", "textAlign", "verticalAlign"].includes(key));

  if (spec.layout) lines.push(`layout ${spec.layout}`, "");
  for (const node of spec.nodes) {
    if (!rich(node as unknown as Record<string, unknown>) && !node.component) {
      let line = node.key;
      if (node.label && node.label !== node.key) line += `: ${node.label}`;
      if (node.shape !== "rectangle") line += ` [${node.shape}]`;
      if (node.fill) line += ` {${node.fill}}`;
      lines.push(line);
      continue;
    }
    const parts = [`node ${node.key}`, quote(node.label)];
    if (node.shape !== "rectangle" || node.edges === "round") {
      parts.push(`shape=${node.edges === "round" && node.shape === "rectangle" ? "rounded" : node.shape}`);
    }
    if (node.fill) parts.push(`fill=${node.fill}`);
    parts.push(...geometryText(node as unknown as Record<string, unknown>), ...styleText(node as unknown as Record<string, unknown>));
    if (node.component) parts.push(`component=${node.component}`);
    if (node.frame) parts.push(`frame=${node.frame}`);
    lines.push(parts.join(" "));
  }

  if (spec.nodes.length && (spec.edges.length || spec.frames?.length || spec.texts?.length || spec.paths?.length)) lines.push("");
  const operator: Record<EdgeKind, string> = { arrow: "->", dashed: "-->", line: "--" };
  for (const edge of spec.edges) {
    const richEdge = rich(edge as unknown as Record<string, unknown>) || edge.points || edge.startArrowhead || edge.endArrowhead || edge.startPort || edge.endPort;
    if (!richEdge) {
      let line = `${edge.from} ${operator[edge.kind]} ${edge.to}`;
      if (edge.label) line += `: ${edge.label}`;
      if (edge.route) line += ` (${edge.route})`;
      lines.push(line);
      continue;
    }
    const parts = [`edge ${edge.from} ${operator[edge.kind]} ${edge.to}`];
    if (edge.label) parts.push(quote(edge.label));
    if (edge.route) parts.push(`route=${edge.route}`);
    if (edge.startArrowhead) parts.push(`start=${edge.startArrowhead}`);
    if (edge.endArrowhead) parts.push(`end=${edge.endArrowhead}`);
    if (edge.startPort) parts.push(`from=${edge.startPort}`);
    if (edge.endPort) parts.push(`to=${edge.endPort}`);
    if (edge.points) parts.push(`points=${quote(edge.points.map(([x, y]) => `${x},${y}`).join(" "))}`);
    parts.push(...styleText(edge as unknown as Record<string, unknown>));
    lines.push(parts.join(" "));
  }
  for (const frame of spec.frames ?? []) {
    const parts = [`frame ${frame.key}`, quote(frame.label), ...geometryText(frame as unknown as Record<string, unknown>), ...styleText(frame as unknown as Record<string, unknown>)];
    lines.push(parts.join(" "));
  }
  for (const text of spec.texts ?? []) {
    const parts = [`text ${text.key}`, quote(text.text), ...geometryText(text as unknown as Record<string, unknown>), ...styleText(text as unknown as Record<string, unknown>)];
    if (text.frame) parts.push(`frame=${text.frame}`);
    lines.push(parts.join(" "));
  }
  for (const path of spec.paths ?? []) {
    const parts = [
      `path ${path.key}`,
      `kind=${path.kind}`,
      `points=${quote(path.points.map(([x, y]) => `${x},${y}`).join(" "))}`,
      ...(path.closed ? ["closed"] : []),
      ...geometryText(path as unknown as Record<string, unknown>),
      ...styleText(path as unknown as Record<string, unknown>),
    ];
    if (path.frame) parts.push(`frame=${path.frame}`);
    lines.push(parts.join(" "));
  }

  return lines.join("\n");
};
