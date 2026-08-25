import {
  emptySpec,
  type DiagramSpec,
  type EdgeKind,
  type EdgeSpec,
  type NodeShape,
  type NodeSpec,
} from "./spec";

/**
 * Parser for the diagram text.
 *
 * The grammar is line-based and deliberately forgiving, because this is a
 * panel you type into live — a half-finished line should describe what's
 * wrong, not throw the whole diagram away.
 *
 *   # a comment
 *   api: API Gateway              a node, label after the colon
 *   db: Postgres [ellipse]        a shape
 *   cache: Redis [diamond] {blue} a fill colour
 *   api -> db: queries            an arrow, label after the colon
 *   api --> cache                 a dashed arrow
 *   db -- cache                   a plain line
 *
 * Nodes referenced by an edge but never declared are created implicitly.
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

const SHAPE_WORDS: Record<string, NodeShape> = {
  rectangle: "rectangle",
  rect: "rectangle",
  box: "rectangle",
  ellipse: "ellipse",
  circle: "ellipse",
  oval: "ellipse",
  diamond: "diamond",
  rhombus: "diamond",
};

const EDGE_PATTERN = /^(.+?)\s*(-->|->|--)\s*(.+?)$/;
const KEY_PATTERN = /^[A-Za-z_][\w-]*$/;

const EDGE_KINDS: Record<string, EdgeKind> = {
  "->": "arrow",
  "-->": "dashed",
  "--": "line",
};

/** Pulls a trailing `[shape]` and `{colour}` off the end of a label. */
const extractModifiers = (input: string) => {
  let text = input.trim();
  let shape: NodeShape | undefined;
  let fill: string | undefined;
  let unknownShape: string | undefined;
  let route: import("../types").PathType | undefined;

  // repeat so the modifiers can appear in any order
  for (let pass = 0; pass < 3; pass++) {
    const colour = text.match(/\{([^}]*)\}\s*$/);
    if (colour) {
      fill = colour[1].trim().toLowerCase() || undefined;
      text = text.slice(0, colour.index).trim();
      continue;
    }
    const shaped = text.match(/\[([^\]]*)\]\s*$/);
    if (shaped) {
      const word = shaped[1].trim().toLowerCase();
      if (SHAPE_WORDS[word]) shape = SHAPE_WORDS[word];
      else unknownShape = word;
      text = text.slice(0, shaped.index).trim();
      continue;
    }
    const routed = text.match(/\(([^)]*)\)\s*$/);
    if (routed) {
      const word = routed[1].trim().toLowerCase();
      if (word === "straight" || word === "curved" || word === "elbow") {
        route = word;
      }
      text = text.slice(0, routed.index).trim();
      continue;
    }
    break;
  }

  return { label: text, shape, fill, route, unknownShape };
};

export const parseDiagram = (source: string): ParseResult => {
  const spec = emptySpec();
  const issues: ParseIssue[] = [];
  const byKey = new Map<string, NodeSpec>();

  /** Nodes may be declared explicitly or implied by an edge. */
  const ensureNode = (key: string): NodeSpec => {
    const existing = byKey.get(key);
    if (existing) return existing;
    const node: NodeSpec = { key, label: key, shape: "rectangle" };
    byKey.set(key, node);
    spec.nodes.push(node);
    return node;
  };

  source.split("\n").forEach((raw, index) => {
    const line = index + 1;
    const text = raw.trim();
    if (!text || text.startsWith("#") || text.startsWith("//")) return;

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

      if (!KEY_PATTERN.test(left)) {
        issues.push({ line, message: `"${left}" is not a valid name` });
        return;
      }
      if (modifiers.unknownShape) {
        issues.push({ line, message: `"${modifiers.unknownShape}" is not a known shape` });
        return;
      }
      if (!KEY_PATTERN.test(right)) {
        issues.push({ line, message: `"${right}" is not a valid name` });
        return;
      }

      ensureNode(left);
      ensureNode(right);
      const duplicate = spec.edges.find((e) => e.from === left && e.to === right);
      if (duplicate) {
        issues.push({ line, message: `${left} → ${right} is already connected` });
        return;
      }
      spec.edges.push({
        from: left,
        to: right,
        kind: EDGE_KINDS[operator] ?? "arrow",
        label,
        route: modifiers.route,
      } satisfies EdgeSpec);
      return;
    }

    // otherwise it's a node declaration
    const colon = text.indexOf(":");
    const key = (colon === -1 ? text : text.slice(0, colon)).trim();
    const rest = colon === -1 ? "" : text.slice(colon + 1);

    const { label, shape, fill, unknownShape } = extractModifiers(rest);

    // a bare word with modifiers is still a declaration: `db [ellipse]`
    const bareModifiers = colon === -1 ? extractModifiers(text) : null;
    const finalKey = bareModifiers ? bareModifiers.label : key;

    if (!KEY_PATTERN.test(finalKey)) {
      issues.push({
        line,
        message: `"${finalKey}" is not a valid name — use letters, digits, - or _`,
      });
      return;
    }
    if (unknownShape || bareModifiers?.unknownShape) {
      issues.push({
        line,
        message: `Unknown shape "${unknownShape ?? bareModifiers?.unknownShape}" — try rectangle, ellipse or diamond`,
      });
    }

    const node = ensureNode(finalKey);
    const resolvedShape = shape ?? bareModifiers?.shape;
    const resolvedFill = fill ?? bareModifiers?.fill;
    if (colon !== -1 && label) node.label = label;
    if (resolvedShape) node.shape = resolvedShape;
    if (resolvedFill) node.fill = resolvedFill;
  });

  return { spec, issues };
};
