import { store } from "./store";
import { moveElementsBy, refreshBindings } from "./actions";
import { getCommonBounds, getElementBounds } from "./geometry";
import type { ExcaliElement, LinearElement } from "./types";

/**
 * "Tidy up": lay a hand-drawn diagram out properly without losing the
 * hand-drawn look.
 *
 * Shapes connected by bound arrows form a graph, which is laid out in layers
 * (a lightweight Sugiyama: longest-path layering, barycentre ordering to cut
 * crossings, then coordinate assignment). Shapes with no connections are
 * arranged on a tidy grid below. Arrows re-route themselves afterwards because
 * they are bound to the shapes.
 */

const NODE_GAP = 60;
const LAYER_GAP = 110;
const ORDERING_PASSES = 4;

export type LayoutDirection = "down" | "right";

interface Edge {
  from: string;
  to: string;
}

interface Graph {
  nodes: ExcaliElement[];
  edges: Edge[];
}

/** Shapes plus the arrow-bound relationships between them. */
const buildGraph = (elements: ExcaliElement[]): Graph => {
  const laidOut = elements.filter(
    (el) =>
      !el.locked &&
      el.type !== "frame" &&
      el.type !== "arrow" &&
      el.type !== "line" &&
      // a bound label is positioned by its container
      !(el.type === "text" && el.containerId),
  );
  const ids = new Set(laidOut.map((el) => el.id));

  const edges: Edge[] = [];
  for (const el of elements) {
    if (el.type !== "arrow") continue;
    const arrow = el as LinearElement;
    const from = arrow.startBinding?.elementId;
    const to = arrow.endBinding?.elementId;
    if (from && to && from !== to && ids.has(from) && ids.has(to)) {
      edges.push({ from, to });
    }
  }
  return { nodes: laidOut, edges };
};

/**
 * Longest-path layering. Cycles can't extend a path indefinitely because each
 * node is only relaxed a bounded number of times.
 */
const assignLayers = (graph: Graph): Map<string, number> => {
  const layer = new Map(graph.nodes.map((node) => [node.id, 0]));
  const limit = graph.nodes.length + 1;

  for (let pass = 0; pass < limit; pass++) {
    let moved = false;
    for (const edge of graph.edges) {
      const next = (layer.get(edge.from) ?? 0) + 1;
      if (next > (layer.get(edge.to) ?? 0)) {
        layer.set(edge.to, next);
        moved = true;
      }
    }
    if (!moved) break;
  }
  return layer;
};

/** Barycentre ordering: pull each node towards the average of its neighbours. */
const orderWithinLayers = (
  graph: Graph,
  layers: Map<string, number>,
): Map<number, string[]> => {
  const byLayer = new Map<number, string[]>();
  for (const node of graph.nodes) {
    const index = layers.get(node.id) ?? 0;
    if (!byLayer.has(index)) byLayer.set(index, []);
    byLayer.get(index)!.push(node.id);
  }

  const predecessors = new Map<string, string[]>();
  const successors = new Map<string, string[]>();
  for (const edge of graph.edges) {
    if (!predecessors.has(edge.to)) predecessors.set(edge.to, []);
    predecessors.get(edge.to)!.push(edge.from);
    if (!successors.has(edge.from)) successors.set(edge.from, []);
    successors.get(edge.from)!.push(edge.to);
  }

  const indices = [...byLayer.keys()].sort((a, b) => a - b);

  for (let pass = 0; pass < ORDERING_PASSES; pass++) {
    // alternate sweep direction so both ends of each edge get a say
    const sweep = pass % 2 === 0 ? indices : [...indices].reverse();
    const neighbours = pass % 2 === 0 ? predecessors : successors;

    for (const index of sweep) {
      const position = new Map<string, number>();
      const reference = byLayer.get(index + (pass % 2 === 0 ? -1 : 1)) ?? [];
      reference.forEach((id, i) => position.set(id, i));

      const current = byLayer.get(index)!;
      const barycentre = new Map<string, number>();
      current.forEach((id, i) => {
        const related = (neighbours.get(id) ?? []).filter((n) => position.has(n));
        barycentre.set(
          id,
          related.length
            ? related.reduce((sum, n) => sum + position.get(n)!, 0) / related.length
            : i,
        );
      });
      current.sort((a, b) => barycentre.get(a)! - barycentre.get(b)!);
    }
  }

  return byLayer;
};

export interface TidyResult {
  moved: number;
  laidOutGraph: boolean;
}

/**
 * Lays out the selection, or the whole canvas when nothing is selected.
 * Returns how many elements moved so the caller can report it.
 */
export const tidyUp = (direction: LayoutDirection = "down"): TidyResult => {
  const scope = store.appState.selectedIds.length > 1
    ? store.getSelected()
    : store.visibleElements;
  if (scope.length < 2) return { moved: 0, laidOutGraph: false };

  const graph = buildGraph(scope);
  if (graph.nodes.length < 2) return { moved: 0, laidOutGraph: false };

  const anchor = getCommonBounds(graph.nodes);
  const layers = assignLayers(graph);
  const ordered = orderWithinLayers(graph, layers);

  const connected = new Set(graph.edges.flatMap((e) => [e.from, e.to]));
  const sizeOf = (id: string) => {
    const el = graph.nodes.find((n) => n.id === id)!;
    const b = getElementBounds(el);
    return { el, width: b.x2 - b.x1, height: b.y2 - b.y1, bounds: b };
  };

  const targets = new Map<string, { x: number; y: number }>();
  const vertical = direction === "down";

  // depth = layer axis, breadth = ordering axis within a layer
  let depth = vertical ? anchor.y1 : anchor.x1;
  const layerIndices = [...ordered.keys()].sort((a, b) => a - b);

  for (const index of layerIndices) {
    const row = ordered.get(index)!.filter((id) => connected.has(id));
    if (row.length === 0) continue;

    const sizes = row.map(sizeOf);
    const layerThickness = Math.max(
      ...sizes.map((s) => (vertical ? s.height : s.width)),
    );
    const totalBreadth =
      sizes.reduce((sum, s) => sum + (vertical ? s.width : s.height), 0) +
      NODE_GAP * (sizes.length - 1);

    // centre each layer on the original centre line, so the diagram stays put
    const centre = vertical
      ? (anchor.x1 + anchor.x2) / 2
      : (anchor.y1 + anchor.y2) / 2;
    let breadth = centre - totalBreadth / 2;

    for (const size of sizes) {
      const span = vertical ? size.width : size.height;
      const cross = depth + (layerThickness - (vertical ? size.height : size.width)) / 2;
      targets.set(size.el.id, {
        x: vertical ? breadth : cross,
        y: vertical ? cross : breadth,
      });
      breadth += span + NODE_GAP;
    }
    depth += layerThickness + LAYER_GAP;
  }

  // unconnected shapes go on a tidy grid underneath the graph
  const loose = graph.nodes.filter((node) => !connected.has(node.id));
  if (loose.length) {
    const columns = Math.max(1, Math.ceil(Math.sqrt(loose.length)));
    const cellWidth =
      Math.max(...loose.map((el) => getElementBounds(el).x2 - getElementBounds(el).x1)) +
      NODE_GAP;
    const cellHeight =
      Math.max(...loose.map((el) => getElementBounds(el).y2 - getElementBounds(el).y1)) +
      NODE_GAP;
    const startY = vertical ? depth : anchor.y2 + LAYER_GAP;
    loose.forEach((el, i) => {
      targets.set(el.id, {
        x: anchor.x1 + (i % columns) * cellWidth,
        y: startY + Math.floor(i / columns) * cellHeight,
      });
    });
  }

  let moved = 0;
  store.mutate(() => {
    for (const [id, target] of targets) {
      const el = store.getElement(id);
      if (!el) continue;
      const b = getElementBounds(el);
      const dx = target.x - b.x1;
      const dy = target.y - b.y1;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
      moveElementsBy([id], dx, dy);
      moved++;
    }
    // arrows are bound, so this pulls every connector back onto its shapes
    refreshBindings([...targets.keys()]);
  });

  return { moved, laidOutGraph: connected.size > 0 };
};
