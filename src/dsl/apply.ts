import { store } from "../store";
import { refreshBindings, refreshTextLayout } from "../actions";
import { newGenericElement, newLinearElement, newTextElement } from "../elements/factory";
import { defaultBinding } from "../elements/binding";
import { getCommonBounds } from "../geometry";
import { tidyUp } from "../layout";
import { resolveFill, type DiagramSpec, type EdgeSpec, type NodeSpec } from "./spec";
import { specFromScene } from "./fromScene";
import type { GenericElement, LinearElement, TextElement } from "../types";

/**
 * Applies a parsed diagram to the canvas as a minimal set of changes.
 *
 * This is a diff, not a rebuild: shapes that already exist keep their
 * positions, their hand-drawn seed and anything else the text doesn't describe.
 * Only what the text actually changed is touched, so typing in the panel never
 * silently rearranges a diagram you have already laid out by hand.
 *
 * Anything the text cannot express — freehand strokes, images, frames, loose
 * text — is left strictly alone.
 */

const DEFAULT_WIDTH = 180;
const DEFAULT_HEIGHT = 90;
const NEW_NODE_GAP = 40;

export interface ApplyResult {
  created: number;
  updated: number;
  removed: number;
  /** true when the layout was run because the diagram was created from text */
  laidOut: boolean;
}

/** Sets or replaces a shape's bound label. */
const setLabel = (containerId: string, label: string) => {
  const container = store.getElement(containerId) as GenericElement | null;
  if (!container) return;

  const existingId = container.boundText;
  const existing = existingId ? (store.getElement(existingId) as TextElement | null) : null;

  if (!label) {
    if (existing) {
      store.deleteElements([existing.id]);
      store.updateElement(containerId, () => ({ boundText: null }));
    }
    return;
  }

  if (existing) {
    if (existing.text !== label) {
      store.updateElement<TextElement>(existing.id, () => ({ text: label }));
      refreshTextLayout([existing.id]);
    }
    return;
  }

  const text = newTextElement(store.appState, container.x, container.y, containerId);
  text.text = label;
  store.addElements(text);
  store.updateElement(containerId, () => ({ boundText: text.id }));
  refreshTextLayout([text.id]);
};

/** Where to drop a node the text just introduced. */
const placementFor = (index: number) => {
  const existing = store.visibleElements.filter(
    (el) => el.type === "rectangle" || el.type === "ellipse" || el.type === "diamond",
  );
  if (existing.length === 0) {
    return { x: 120 + index * (DEFAULT_WIDTH + NEW_NODE_GAP), y: 120 };
  }
  const bounds = getCommonBounds(existing);
  // stack new arrivals in a row beneath what's already there
  return {
    x: bounds.x1 + index * (DEFAULT_WIDTH + NEW_NODE_GAP),
    y: bounds.y2 + 80,
  };
};

export const applySpecToScene = (spec: DiagramSpec): ApplyResult => {
  const before = specFromScene();
  const theme = store.appState.theme;

  let created = 0;
  let updated = 0;
  let removed = 0;
  const createdKeys: string[] = [];

  store.mutate(() => {
    const keyToId = new Map(before.keyToElementId);

    // --- nodes ------------------------------------------------------------
    const wanted = new Set(spec.nodes.map((n) => n.key));

    // drop shapes whose declaration disappeared from the text
    for (const [key, id] of before.keyToElementId) {
      if (wanted.has(key)) continue;
      const element = store.getElement(id);
      if (!element) continue;
      const ids = [id];
      if ("boundText" in element && element.boundText) ids.push(element.boundText);

      // A connector to a node that no longer exists is not a relationship any
      // more, just a dangling line, so it goes with the node it pointed at.
      for (const other of store.visibleElements) {
        if (other.type !== "arrow" && other.type !== "line") continue;
        const arrow = other as LinearElement;
        const touches =
          arrow.startBinding?.elementId === id || arrow.endBinding?.elementId === id;
        if (!touches) continue;
        ids.push(arrow.id);
        if (arrow.boundText) ids.push(arrow.boundText);
      }

      store.deleteElements(ids);
      keyToId.delete(key);
      removed++;
    }

    spec.nodes.forEach((node: NodeSpec, index) => {
      const existingId = keyToId.get(node.key);
      const fill = resolveFill(node.fill, theme);

      if (!existingId) {
        const { x, y } = placementFor(createdKeys.length + index * 0);
        const element = newGenericElement(node.shape, store.appState, x, y);
        element.width = DEFAULT_WIDTH;
        element.height = DEFAULT_HEIGHT;
        element.backgroundColor = fill;
        element.dslKey = node.key;
        store.addElements(element);
        keyToId.set(node.key, element.id);
        setLabel(element.id, node.label);
        createdKeys.push(node.key);
        created++;
        return;
      }

      const element = store.getElement(existingId) as GenericElement | null;
      if (!element) return;
      let changed = false;

      // changing shape in place keeps position, size and connections
      if (element.type !== node.shape) {
        store.updateElement(existingId, () => ({ type: node.shape }) as never);
        changed = true;
      }
      if (element.backgroundColor !== fill) {
        store.updateElement(existingId, () => ({ backgroundColor: fill }));
        changed = true;
      }
      if (element.dslKey !== node.key) {
        store.updateElement(existingId, () => ({ dslKey: node.key }));
      }

      const currentLabel = element.boundText
        ? ((store.getElement(element.boundText) as TextElement | null)?.text ?? "")
        : "";
      const nextLabel = node.label === node.key ? currentLabel || node.label : node.label;
      if (currentLabel !== nextLabel) {
        setLabel(existingId, nextLabel);
        changed = true;
      }
      if (changed) updated++;
    });

    // --- edges ------------------------------------------------------------
    const existingArrows = new Map<string, LinearElement>();
    for (const el of store.visibleElements) {
      if (el.type !== "arrow" && el.type !== "line") continue;
      const arrow = el as LinearElement;
      if (!arrow.startBinding || !arrow.endBinding) continue;
      const from = [...keyToId].find(([, id]) => id === arrow.startBinding!.elementId)?.[0];
      const to = [...keyToId].find(([, id]) => id === arrow.endBinding!.elementId)?.[0];
      if (from && to) existingArrows.set(`${from}→${to}`, arrow);
    }

    const wantedEdges = new Set(spec.edges.map((e) => `${e.from}→${e.to}`));
    for (const [id, arrow] of existingArrows) {
      if (wantedEdges.has(id)) continue;
      const ids = [arrow.id];
      if (arrow.boundText) ids.push(arrow.boundText);
      store.deleteElements(ids);
      removed++;
    }

    for (const edge of spec.edges as EdgeSpec[]) {
      const fromId = keyToId.get(edge.from);
      const toId = keyToId.get(edge.to);
      if (!fromId || !toId) continue;

      const wantsArrow = edge.kind !== "line";
      const wantsDashed = edge.kind === "dashed";
      const existing = existingArrows.get(`${edge.from}→${edge.to}`);

      if (!existing) {
        const source = store.getElement(fromId)!;
        const arrow = newLinearElement(
          wantsArrow ? "arrow" : "line",
          store.appState,
          source.x + source.width / 2,
          source.y + source.height / 2,
        );
        arrow.points = [
          [0, 0],
          [60, 60],
        ];
        arrow.strokeStyle = wantsDashed ? "dashed" : "solid";
        if (edge.route) arrow.pathType = edge.route;
        arrow.startBinding = defaultBinding(fromId);
        arrow.endBinding = defaultBinding(toId);
        arrow.dslKey = `${edge.from}→${edge.to}`;
        store.addElements(arrow);
        if (edge.label) {
          const text = newTextElement(store.appState, arrow.x, arrow.y, arrow.id);
          text.text = edge.label;
          store.addElements(text);
          store.updateElement(arrow.id, () => ({ boundText: text.id }));
          refreshTextLayout([text.id]);
        }
        created++;
        continue;
      }

      let changed = false;
      const style = wantsDashed ? "dashed" : "solid";
      if (existing.strokeStyle !== style) {
        store.updateElement(existing.id, () => ({ strokeStyle: style }));
        changed = true;
      }
      if (edge.route && existing.pathType !== edge.route) {
        store.updateElement<import("../types").LinearElement>(existing.id, () => ({ pathType: edge.route }));
        changed = true;
      }
      const currentLabel = existing.boundText
        ? ((store.getElement(existing.boundText) as TextElement | null)?.text ?? "")
        : "";
      if ((edge.label ?? "") !== currentLabel) {
        if (edge.label) {
          if (existing.boundText) {
            store.updateElement<TextElement>(existing.boundText, () => ({
              text: edge.label!,
            }));
            refreshTextLayout([existing.boundText]);
          } else {
            const text = newTextElement(store.appState, existing.x, existing.y, existing.id);
            text.text = edge.label;
            store.addElements(text);
            store.updateElement(existing.id, () => ({ boundText: text.id }));
            refreshTextLayout([text.id]);
          }
        } else if (existing.boundText) {
          store.deleteElements([existing.boundText]);
          store.updateElement(existing.id, () => ({ boundText: null }));
        }
        changed = true;
      }
      if (changed) updated++;
    }

    refreshBindings([...keyToId.values()]);
  });

  // A diagram that came entirely from text has no hand-placed layout worth
  // preserving, so lay it out properly rather than leaving a row of boxes.
  const shapes = store.visibleElements.filter(
    (el) => el.type === "rectangle" || el.type === "ellipse" || el.type === "diamond",
  );
  const allFromText = shapes.length > 0 && shapes.every((el) => el.dslKey);
  const laidOut = created > 0 && allFromText;
  if (laidOut) {
    store.setAppState({ selectedIds: [] });
    tidyUp();
  }

  return { created, updated, removed, laidOut };
};
