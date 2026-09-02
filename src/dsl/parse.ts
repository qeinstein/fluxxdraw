import {
  emptySpec,
  type DiagramSpec,
  type EdgeKind,
  type EdgeSpec,
  type FrameSpec,
  type NodeShape,
  type NodeSpec,
  type PathSpec,
  type PortName,
  type StyleSpec,
  type TextSpec,
} from "./spec";
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

/**
 * Parser for the diagram text.
 *
 * The original compact line syntax remains valid. Rich declarations add
 * geometry, all canvas styling, frames, loose text, paths, ports and
 * component instances without turning the language into executable code:
 *
 *   node api "API Gateway" shape=rounded at=120,100 size=180x90 fill=#e8f1ff
 *   edge api -> db "queries" route=elbow from=east to=west end=triangle
 *   frame clients "Clients" at=40,60 size=300x240
 *   text title "Checkout" at=120,20 size=28 font=normal
 *   path sketch points="0,0 20,30 50,5" stroke=#ef4444 width=3
 *
 * Rich input is deliberately declarative and forgiving. A partially typed
 * line reports a local issue and never executes arbitrary code.
 */

export interface ParseIssue {
  /** 1-based, to line up with what the editor shows */
  line: number;
  message: string;
}

export interface ParseResult {
  spec: DiagramSpec;
  issues: ParseIssue[];
}

const SHAPE_WORDS: Record<string, { shape: NodeShape; edges?: Edges }> = {
  rectangle: { shape: "rectangle" },
  rect: { shape: "rectangle" },
  box: { shape: "rectangle" },
  rounded: { shape: "rectangle", edges: "round" },
  round: { shape: "rectangle", edges: "round" },
  sticky: { shape: "sticky" },
  note: { shape: "sticky" },
  ellipse: { shape: "ellipse" },
  circle: { shape: "ellipse" },
  oval: { shape: "ellipse" },
  diamond: { shape: "diamond" },
  rhombus: { shape: "diamond" },
  decision: { shape: "diamond" },
  triangle: { shape: "triangle" },
  hexagon: { shape: "hexagon" },
  octagon: { shape: "hexagon" },
  parallelogram: { shape: "parallelogram" },
  input: { shape: "parallelogram" },
  cylinder: { shape: "cylinder" },
  database: { shape: "cylinder" },
};

const EDGE_PATTERN = /^(.+?)\s*(-->|->|--)\s*(.+?)$/;
const KEY_PATTERN = /^[A-Za-z_][\w-]*$/;

const EDGE_KINDS: Record<string, EdgeKind> = {
  "->": "arrow",
  "-->": "dashed",
  "--": "line",
};

const ARROWHEADS = new Set<Arrowhead>([
  "none",
  "arrow",
  "triangle",
  "triangle-outline",
  "bar",
  "dot",
]);
const PORTS = new Set<PortName>(["auto", "north", "east", "south", "west"]);
const FILL_STYLES = new Set<FillStyle>(["hachure", "cross-hatch", "solid", "zigzag"]);
const STROKE_STYLES = new Set<StrokeStyle>(["solid", "dashed", "dotted"]);
const FONTS = new Set<FontFamily>(["hand", "casual", "marker", "neat", "normal", "code"]);
const TEXT_ALIGNS = new Set<TextAlign>(["left", "center", "right"]);
const VERTICAL_ALIGNS = new Set<VerticalAlign>(["top", "middle", "bottom"]);

const addIssue = (issues: ParseIssue[], line: number, message: string) => {
  issues.push({ line, message });
};

/** Removes comments while preserving # and // inside quoted values. */
const stripInlineComment = (source: string): string => {
  let quote: string | null = null;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quote) {
      if (char === quote && source[i - 1] !== "\\") quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    const startsComment =
      (char === "#" || (char === "/" && source[i + 1] === "/")) &&
      (i === 0 || /\s/.test(source[i - 1]));
    if (startsComment) return source.slice(0, i).trimEnd();
  }
  return source;
};

/** Splits a rich declaration into whitespace-separated, quote-aware tokens. */
const tokenize = (source: string): string[] => {
  const tokens: string[] = [];
  let current = "";
  let quote: string | null = null;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quote) {
      if (char === quote && source[i - 1] !== "\\") {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
    } else if (/\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
    } else {
      current += char;
    }
  }
  if (current) tokens.push(current);
  return tokens;
};

const parseOptions = (tokens: string[]): Map<string, string> => {
  const options = new Map<string, string>();
  for (const token of tokens) {
    const match = token.match(/^([A-Za-z][\w-]*)\s*[=:](.*)$/);
    if (match) {
      options.set(match[1].toLowerCase(), match[2].trim());
    } else if (token.toLowerCase() === "closed") {
      options.set("closed", "true");
    } else if (token.toLowerCase() === "dashed" || token.toLowerCase() === "dotted") {
      options.set("stroke", token.toLowerCase());
    }
  }
  return options;
};

const asNumber = (value: string | undefined): number | undefined => {
  if (value === undefined || value.trim() === "") return undefined;
  const number = Number(value.replace(/px$/i, ""));
  return Number.isFinite(number) ? number : undefined;
};

const asPair = (value: string | undefined): [number, number] | undefined => {
  if (!value) return undefined;
  const parts = value.replace(/[()]/g, "").split(/[x,]/i).map((part) => Number(part));
  return parts.length === 2 && parts.every(Number.isFinite) ? [parts[0], parts[1]] : undefined;
};

const asPoints = (value: string | undefined): [number, number][] | undefined => {
  if (!value) return undefined;
  const points = value
    .split(/[;\s]+/)
    .filter(Boolean)
    .map((point) => asPair(point));
  return points.length >= 2 && points.every((point): point is [number, number] => Boolean(point))
    ? points
    : undefined;
};

const parseAngle = (value: string | undefined): number | undefined => {
  if (!value) return undefined;
  const raw = value.trim().toLowerCase();
  const numeric = asNumber(raw);
  if (numeric === undefined) return undefined;
  return raw.endsWith("deg") ? (numeric * Math.PI) / 180 : numeric;
};

const parseShape = (value: string | undefined) => {
  if (!value) return undefined;
  return SHAPE_WORDS[value.trim().toLowerCase()];
};

const styleFromOptions = (options: Map<string, string>, widthIsStroke = false): StyleSpec => {
  const style: StyleSpec = {};
  const stroke = options.get("stroke");
  if (stroke && !STROKE_STYLES.has(stroke as StrokeStyle)) style.strokeColor = stroke;
  if (stroke && STROKE_STYLES.has(stroke as StrokeStyle)) style.strokeStyle = stroke as StrokeStyle;

  const styleValues: [keyof StyleSpec, string, (value: string) => unknown][] = [
    ["strokeColor", "strokecolor", (value) => value],
    ["backgroundColor", "background", (value) => value],
    ["backgroundColor", "backgroundcolor", (value) => value],
    ["textColor", "text", (value) => value],
    ["textColor", "textcolor", (value) => value],
    ["fillStyle", "fillstyle", (value) => FILL_STYLES.has(value as FillStyle) ? value as FillStyle : undefined],
    ["strokeStyle", "strokestyle", (value) => STROKE_STYLES.has(value as StrokeStyle) ? value as StrokeStyle : undefined],
    ["strokeWidth", "width-stroke", asNumber],
    ["roughness", "roughness", asNumber],
    ["opacity", "opacity", asNumber],
    ["fontSize", "size-text", asNumber],
    ["fontSize", "fontsize", asNumber],
    ["fontFamily", "font", (value) => FONTS.has(value as FontFamily) ? value as FontFamily : undefined],
    ["textAlign", "align", (value) => TEXT_ALIGNS.has(value as TextAlign) ? value as TextAlign : undefined],
    ["verticalAlign", "valign", (value) => VERTICAL_ALIGNS.has(value as VerticalAlign) ? value as VerticalAlign : undefined],
    ["edges", "edges", (value) => value === "round" || value === "sharp" ? value as Edges : undefined],
  ];
  for (const [property, key, convert] of styleValues) {
    const value = options.get(key);
    if (value === undefined) continue;
    const converted = convert(value);
    if (converted !== undefined) (style[property] as unknown) = converted;
  }
  if (options.has("color")) style.textColor = options.get("color");
  if (options.has("strokewidth")) style.strokeWidth = asNumber(options.get("strokewidth"));
  if (style.fontSize === undefined) {
    const textSize = asNumber(options.get("size"));
    if (textSize !== undefined) style.fontSize = textSize;
  }
  if (widthIsStroke && style.strokeWidth === undefined) {
    const lineWidth = asNumber(options.get("width"));
    if (lineWidth !== undefined) style.strokeWidth = lineWidth;
  }
  return style;
};

const geometryFromOptions = (options: Map<string, string>, includeNamedWidth = true) => {
  const geometry: { x?: number; y?: number; width?: number; height?: number; angle?: number } = {};
  const at = asPair(options.get("at"));
  const size = asPair(options.get("size"));
  const x = asNumber(options.get("x"));
  const y = asNumber(options.get("y"));
  const width = asNumber(options.get("w") ?? (includeNamedWidth ? options.get("width") : undefined));
  const height = asNumber(options.get("h") ?? (includeNamedWidth ? options.get("height") : undefined));
  if (at) [geometry.x, geometry.y] = at;
  if (size) [geometry.width, geometry.height] = size;
  if (x !== undefined) geometry.x = x;
  if (y !== undefined) geometry.y = y;
  if (width !== undefined) geometry.width = width;
  if (height !== undefined) geometry.height = height;
  const angle = parseAngle(options.get("angle") ?? options.get("rotate"));
  if (angle !== undefined) geometry.angle = angle;
  return geometry;
};

const validateKey = (key: string, issues: ParseIssue[], line: number) => {
  if (!KEY_PATTERN.test(key)) {
    addIssue(issues, line, `"${key}" is not a valid name — use letters, digits, - or _`);
    return false;
  }
  return true;
};

/** Pulls a trailing `[shape]` and `{colour}` off the end of a compact line. */
const extractModifiers = (input: string) => {
  let text = input.trim();
  let shape: NodeShape | undefined;
  let edges: Edges | undefined;
  let fill: string | undefined;
  let unknownShape: string | undefined;
  let route: PathType | undefined;

  // repeat so the modifiers can appear in any order
  for (let pass = 0; pass < 4; pass++) {
    const colour = text.match(/\{([^}]*)\}\s*$/);
    if (colour) {
      fill = colour[1].trim().toLowerCase() || undefined;
      text = text.slice(0, colour.index).trim();
      continue;
    }
    const shaped = text.match(/\[([^\]]*)\]\s*$/);
    if (shaped) {
      const word = shaped[1].trim().toLowerCase();
      const parsed = parseShape(word);
      if (parsed) {
        shape = parsed.shape;
        edges = parsed.edges;
      } else {
        unknownShape = word;
      }
      text = text.slice(0, shaped.index).trim();
      continue;
    }
    const routed = text.match(/\(([^)]*)\)\s*$/);
    if (routed) {
      const word = routed[1].trim().toLowerCase();
      if (word === "straight" || word === "curved" || word === "elbow") route = word;
      text = text.slice(0, routed.index).trim();
      continue;
    }
    break;
  }

  return { label: text, shape, fill, route, edges, unknownShape };
};

export const parseDiagram = (source: string): ParseResult => {
  const spec = emptySpec();
  const issues: ParseIssue[] = [];
  const byKey = new Map<string, NodeSpec>();
  const frameKeys = new Set<string>();

  const beginRich = () => {
    if (spec.rich) return;
    spec.rich = true;
    spec.texts = [];
    spec.frames = [];
    spec.paths = [];
  };

  const ensureNode = (key: string): NodeSpec => {
    const existing = byKey.get(key);
    if (existing) return existing;
    const node: NodeSpec = { key, label: key, shape: "rectangle" };
    byKey.set(key, node);
    spec.nodes.push(node);
    return node;
  };

  const addEdge = (edge: EdgeSpec, line: number) => {
    ensureNode(edge.from);
    ensureNode(edge.to);
    const duplicate = spec.edges.find((candidate) => candidate.from === edge.from && candidate.to === edge.to);
    if (duplicate) {
      addIssue(issues, line, `${edge.from} → ${edge.to} is already connected`);
      return;
    }
    spec.edges.push(edge);
  };

  const addRichNode = (raw: string, line: number) => {
    beginRich();
    const match = raw.match(/^node\s+([^\s:]+)(?::\s*|\s+)?(.*)$/i);
    if (!match) {
      addIssue(issues, line, "A node needs a name, for example: node api \"API Gateway\"");
      return;
    }
    const [, key, rest] = match;
    if (!validateKey(key, issues, line)) return;
    const tokens = tokenize(rest);
    const firstOption = tokens.findIndex((token) => /^[A-Za-z][\w-]*\s*[=:]/.test(token));
    const rawLabel = (firstOption === -1 ? tokens : tokens.slice(0, firstOption)).join(" ");
    const options = parseOptions(firstOption === -1 ? [] : tokens.slice(firstOption));
    const shape = parseShape(options.get("shape"));
    if (options.has("shape") && !shape) {
      addIssue(issues, line, `Unknown shape "${options.get("shape")}"`);
      return;
    }
    const node = ensureNode(key);
    if (rawLabel) node.label = rawLabel;
    if (shape) {
      node.shape = shape.shape;
      if (shape.edges) node.edges = shape.edges;
    }
    const fill = options.get("fill");
    if (fill !== undefined) node.fill = fill;
    Object.assign(node, geometryFromOptions(options), styleFromOptions(options));
    if (shape?.edges && !node.edges) node.edges = shape.edges;
    if (options.has("component")) node.component = options.get("component");
    if (options.has("frame")) node.frame = options.get("frame");
  };

  const addRichEdge = (raw: string, line: number) => {
    beginRich();
    const match = raw.match(/^edge\s+([^\s]+)\s*(-->|->|--)\s*([^\s:]+)(?::\s*|\s+)?(.*)$/i);
    if (!match) {
      addIssue(issues, line, "An edge needs two node names, for example: edge api -> db \"queries\"");
      return;
    }
    const [, from, operator, to, rest] = match;
    if (!validateKey(from, issues, line) || !validateKey(to, issues, line)) return;
    const tokens = tokenize(rest);
    const firstOption = tokens.findIndex((token) => /^[A-Za-z][\w-]*\s*[=:]/.test(token));
    const rawLabel = (firstOption === -1 ? tokens : tokens.slice(0, firstOption)).join(" ");
    const options = parseOptions(firstOption === -1 ? [] : tokens.slice(firstOption));
    const edge: EdgeSpec = {
      from,
      to,
      kind: EDGE_KINDS[operator],
      label: rawLabel || undefined,
    };
    const route = options.get("route");
    if (route === "straight" || route === "curved" || route === "elbow" || route === "orthogonal") {
      edge.route = route === "orthogonal" ? "elbow" : route;
    } else if (route) {
      addIssue(issues, line, `Unknown route "${route}" — try straight, curved or elbow`);
    }
    const kind = options.get("kind");
    if (kind === "arrow" || kind === "dashed" || kind === "line") edge.kind = kind;
    if (options.has("stroke") && STROKE_STYLES.has(options.get("stroke") as StrokeStyle)) {
      const stroke = options.get("stroke") as StrokeStyle;
      if (stroke === "dashed") edge.kind = "dashed";
      edge.strokeStyle = stroke;
    }
    const start = options.get("start");
    const end = options.get("end");
    if (start && ARROWHEADS.has(start as Arrowhead)) edge.startArrowhead = start as Arrowhead;
    if (end && ARROWHEADS.has(end as Arrowhead)) edge.endArrowhead = end as Arrowhead;
    const fromPort = options.get("from") ?? options.get("startport");
    const toPort = options.get("to") ?? options.get("endport");
    if (fromPort && PORTS.has(fromPort as PortName)) edge.startPort = fromPort as PortName;
    if (toPort && PORTS.has(toPort as PortName)) edge.endPort = toPort as PortName;
    const points = asPoints(options.get("points") ?? options.get("via"));
    if (points) edge.points = points;
    Object.assign(edge, styleFromOptions(options, true));
    addEdge(edge, line);
  };

  const addRichFrame = (raw: string, line: number) => {
    beginRich();
    const match = raw.match(/^frame\s+([^\s:]+)(?::\s*|\s+)?(.*)$/i);
    if (!match) {
      addIssue(issues, line, "A frame needs a name, for example: frame clients \"Clients\"");
      return;
    }
    const [, key, rest] = match;
    if (!validateKey(key, issues, line)) return;
    const tokens = tokenize(rest);
    const firstOption = tokens.findIndex((token) => /^[A-Za-z][\w-]*\s*[=:]/.test(token));
    const rawLabel = (firstOption === -1 ? tokens : tokens.slice(0, firstOption)).join(" ");
    const options = parseOptions(firstOption === -1 ? [] : tokens.slice(firstOption));
    const frame: FrameSpec = {
      key,
      label: rawLabel || key,
      ...geometryFromOptions(options),
      ...styleFromOptions(options),
    };
    if (!spec.frames) spec.frames = [];
    spec.frames.push(frame);
    frameKeys.add(key);
  };

  const addRichText = (raw: string, line: number) => {
    beginRich();
    const match = raw.match(/^text\s+([^\s:]+)(?::\s*|\s+)?(.*)$/i);
    if (!match) {
      addIssue(issues, line, "A text element needs a name, for example: text title \"Checkout\"");
      return;
    }
    const [, key, rest] = match;
    if (!validateKey(key, issues, line)) return;
    const tokens = tokenize(rest);
    const firstOption = tokens.findIndex((token) => /^[A-Za-z][\w-]*\s*[=:]/.test(token));
    const text = (firstOption === -1 ? tokens : tokens.slice(0, firstOption)).join(" ");
    const options = parseOptions(firstOption === -1 ? [] : tokens.slice(firstOption));
    if (!text) {
      addIssue(issues, line, "A text element needs quoted content");
      return;
    }
    const item: TextSpec = {
      key,
      text,
      ...geometryFromOptions(options),
      ...styleFromOptions(options),
    };
    if (options.has("frame")) item.frame = options.get("frame");
    if (!spec.texts) spec.texts = [];
    spec.texts.push(item);
  };

  const addRichPath = (raw: string, line: number) => {
    beginRich();
    const match = raw.match(/^(?:path|draw)\s+([^\s:]+)(?::\s*|\s+)?(.*)$/i);
    if (!match) {
      addIssue(issues, line, "A path needs a name, for example: path sketch points=\"0,0 20,20\"");
      return;
    }
    const [, key, rest] = match;
    if (!validateKey(key, issues, line)) return;
    const tokens = tokenize(rest);
    const options = parseOptions(tokens);
    const points = asPoints(options.get("points"));
    if (!points) {
      addIssue(issues, line, "A path needs at least two points, for example points=\"0,0 20,20\"");
      return;
    }
    const pressureValues = options.get("pressures")
      ?.split(/[;,\s]+/)
      .filter(Boolean)
      .map((value) => Number(value));
    const item: PathSpec = {
      key,
      kind: options.get("kind") === "line" ? "line" : "freehand",
      points,
      pressures: pressureValues?.every(Number.isFinite) ? pressureValues : undefined,
      closed: options.get("closed") === "true",
      ...geometryFromOptions(options, false),
      ...styleFromOptions(options, true),
    };
    if (options.has("frame")) item.frame = options.get("frame");
    if (!spec.paths) spec.paths = [];
    spec.paths.push(item);
  };

  source.split("\n").forEach((raw, index) => {
    const line = index + 1;
    const text = stripInlineComment(raw).trim();
    if (!text) return;

    if (/^layout(?:\s+|\s*[:=])/.test(text.toLowerCase())) {
      beginRich();
      const value = text.replace(/^layout(?:\s+|\s*[:=])/i, "").trim().toLowerCase();
      if (value === "down" || value === "right" || value === "grid" || value === "none") spec.layout = value;
      else addIssue(issues, line, `Unknown layout "${value}" — try down, right, grid or none`);
      return;
    }
    if (/^node\b/i.test(text)) return addRichNode(text, line);
    if (/^edge\b/i.test(text)) return addRichEdge(text, line);
    if (/^frame\b/i.test(text)) return addRichFrame(text, line);
    if (/^text\b/i.test(text)) return addRichText(text, line);
    if (/^(?:path|draw)\b/i.test(text)) return addRichPath(text, line);

    const edge = text.match(EDGE_PATTERN);
    if (edge) {
      const [, leftRaw, operator, rightRaw] = edge;
      // the label rides on the right-hand side, after a colon
      const colon = rightRaw.indexOf(":");
      const right = (colon === -1 ? rightRaw : rightRaw.slice(0, colon)).trim();
      const labelRaw = colon === -1 ? "" : rightRaw.slice(colon + 1);
      const modifiers = extractModifiers(labelRaw);
      const label = modifiers.label || undefined;
      const left = leftRaw.trim();

      if (!validateKey(left, issues, line)) return;
      if (modifiers.unknownShape) {
        addIssue(issues, line, `"${modifiers.unknownShape}" is not a known shape`);
        return;
      }
      if (!validateKey(right, issues, line)) return;

      const edgeSpec: EdgeSpec = {
        from: left,
        to: right,
        kind: EDGE_KINDS[operator] ?? "arrow",
        label,
        route: modifiers.route,
      };
      addEdge(edgeSpec, line);
      return;
    }

    // otherwise it's a compact node declaration
    const colon = text.indexOf(":");
    const key = (colon === -1 ? text : text.slice(0, colon)).trim();
    const rest = colon === -1 ? "" : text.slice(colon + 1);

    const { label, shape, fill, unknownShape, edges } = extractModifiers(rest);

    // a bare word with modifiers is still a declaration: `db [ellipse]`
    const bareModifiers = colon === -1 ? extractModifiers(text) : null;
    const finalKey = bareModifiers ? bareModifiers.label : key;

    if (!validateKey(finalKey, issues, line)) return;
    if (unknownShape || bareModifiers?.unknownShape) {
      addIssue(
        issues,
        line,
        `Unknown shape "${unknownShape ?? bareModifiers?.unknownShape}" — try rectangle, ellipse, diamond, triangle or cylinder`,
      );
    }

    const node = ensureNode(finalKey);
    const resolvedShape = shape ?? bareModifiers?.shape;
    const resolvedFill = fill ?? bareModifiers?.fill;
    const resolvedEdges = edges ?? bareModifiers?.edges;
    if (colon !== -1 && label) node.label = label;
    if (resolvedShape) node.shape = resolvedShape;
    if (resolvedEdges) node.edges = resolvedEdges;
    if (resolvedFill) node.fill = resolvedFill;
  });

  // References are checked after the whole file so declaration order is free.
  for (const node of spec.nodes) {
    if (node.frame && !frameKeys.has(node.frame)) {
      addIssue(issues, 1, `Node "${node.key}" references unknown frame "${node.frame}"`);
    }
  }
  for (const text of spec.texts ?? []) {
    if (text.frame && !frameKeys.has(text.frame)) {
      addIssue(issues, 1, `Text "${text.key}" references unknown frame "${text.frame}"`);
    }
  }
  for (const path of spec.paths ?? []) {
    if (path.frame && !frameKeys.has(path.frame)) {
      addIssue(issues, 1, `Path "${path.key}" references unknown frame "${path.frame}"`);
    }
  }

  return { spec, issues };
};
