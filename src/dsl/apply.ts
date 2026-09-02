import { store } from "../store";
import { refreshBindings, refreshTextLayout } from "../actions";
import { newFreedrawElement, newFrameElement, newGenericElement, newLinearElement, newTextElement } from "../elements/factory";
import { defaultBinding } from "../elements/binding";
import { getCommonBounds } from "../geometry";
import { tidyUp, type LayoutDirection } from "../layout";
import { findService } from "../presets/catalog";
import { serviceDefinition } from "../presets/build";
import { newInstance } from "../components-model";
import { resolveFill, type DiagramSpec, type EdgeSpec, type FrameSpec, type NodeSpec, type PathSpec, type StyleSpec, type TextSpec } from "./spec";
import { specFromScene } from "./fromScene";
import type { ExcaliElement, GenericElement, InstanceElement, LinearElement, TextElement } from "../types";

/**
 * Applies a parsed diagram to the canvas as a minimal set of changes.
 *
 * Compact source continues to manage only diagram nodes and relationships.
 * Rich source additionally manages frames, loose text and paths, while
 * preserving unrelated hand-drawn content. Stable `dslKey`s make every
 * declaration editable in place instead of rebuilding the whole scene.
 */

const DEFAULT_WIDTH = 180;
const DEFAULT_HEIGHT = 90;
const NEW_NODE_GAP = 40;
const NODE_TYPES = new Set<GenericElement["type"]>([
  "rectangle",
  "ellipse",
  "diamond",
  "sticky",
  "triangle",
  "hexagon",
  "parallelogram",
  "cylinder",
]);

type NodeElement = GenericElement | InstanceElement;

const isNodeElement = (el: ExcaliElement): el is NodeElement =>
  NODE_TYPES.has(el.type as GenericElement["type"]) || el.type === "instance";

/** Reads an element created earlier in the same Yjs transaction as well. */
const readElement = (id: string | undefined): ExcaliElement | null =>
  id ? (store.getElement(id) ?? store.yElements.get(id) ?? null) : null;

const resolveBackground = (value: string | undefined, theme: "light" | "dark") =>
  value === undefined ? undefined : resolveFill(value, theme);

const stylePatch = (style: StyleSpec, theme: "light" | "dark"): Partial<ExcaliElement> => {
  const patch: Record<string, unknown> = {};
  const keys: (keyof StyleSpec)[] = [
    "strokeColor",
    "textColor",
    "fillStyle",
    "strokeWidth",
    "strokeStyle",
    "roughness",
    "edges",
    "opacity",
    "fontSize",
    "fontFamily",
    "textAlign",
    "verticalAlign",
  ];
  for (const key of keys) {
    if (style[key] !== undefined) patch[key] = style[key];
  }
  if (style.backgroundColor !== undefined) {
    patch.backgroundColor = resolveBackground(style.backgroundColor, theme);
  }
  return patch as Partial<ExcaliElement>;
};

const geometryPatch = (item: { x?: number; y?: number; width?: number; height?: number; angle?: number }) => {
  const patch: Record<string, number> = {};
  for (const key of ["x", "y", "width", "height", "angle"] as const) {
    if (item[key] !== undefined) patch[key] = item[key]!;
  }
  return patch;
};

/** Sets or replaces a shape's bound label. */
const setLabel = (containerId: string, label: string) => {
  const container = (store.getElement(containerId) ?? store.yElements.get(containerId)) as GenericElement | null;
  if (!container || !("boundText" in container)) return;

  const existingId = container.boundText;
  const existing = existingId
    ? ((store.getElement(existingId) ?? store.yElements.get(existingId)) as TextElement | null)
    : null;

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
  const existing = store.visibleElements.filter(isNodeElement);
  if (existing.length === 0) return { x: 120 + index * (DEFAULT_WIDTH + NEW_NODE_GAP), y: 120 };
  const bounds = getCommonBounds(existing);
  return { x: bounds.x1 + index * (DEFAULT_WIDTH + NEW_NODE_GAP), y: bounds.y2 + 80 };
};

const pointForPort = (element: ExcaliElement, port: EdgeSpec["startPort"]): [number, number] | null => {
  if (!port || port === "auto") return null;
  const points = {
    north: [element.x + element.width / 2, element.y] as [number, number],
    east: [element.x + element.width, element.y + element.height / 2] as [number, number],
    south: [element.x + element.width / 2, element.y + element.height] as [number, number],
    west: [element.x, element.y + element.height / 2] as [number, number],
  };
  return points[port];
};

const bindingFor = (id: string, port: EdgeSpec["startPort"], shape: ExcaliElement | null) => {
  const point = shape && pointForPort(shape, port);
  return point && shape ? defaultBinding(id, shape, point) : defaultBinding(id);
};

const idsForNode = (id: string) => {
  const element = store.getElement(id);
  if (!element) return [];
  const ids = [id];
  if ("boundText" in element && element.boundText) ids.push(element.boundText);
  for (const other of store.visibleElements) {
    if (other.type !== "arrow" && other.type !== "line") continue;
    const arrow = other as LinearElement;
    if (arrow.startBinding?.elementId !== id && arrow.endBinding?.elementId !== id) continue;
    ids.push(arrow.id);
    if (arrow.boundText) ids.push(arrow.boundText);
  }
  return ids;
};

const applyNodeStyle = (node: NodeSpec, theme: "light" | "dark") => {
  const patch: Record<string, unknown> = {
    ...geometryPatch(node),
    ...stylePatch(node, theme),
  };
  if (node.backgroundColor === undefined && node.fill !== undefined) {
    patch.backgroundColor = resolveFill(node.fill, theme);
  } else if (node.backgroundColor === undefined && node.fill === undefined) {
    patch.backgroundColor = "transparent";
  }
  return patch;
};

const ensureComponent = (componentId: string) => {
  if (store.components[componentId]) return store.components[componentId];
  const preset = findService(componentId);
  if (!preset) return null;
  const definition = serviceDefinition(preset);
  store.registerComponent(definition);
  return definition;
};

const createNode = (node: NodeSpec, index: number, theme: "light" | "dark") => {
  const placement = placementFor(index);
  if (node.component && ensureComponent(node.component)) {
    const definition = store.components[node.component];
    const instance = newInstance(
      node.component,
      node.x ?? placement.x,
      node.y ?? placement.y,
      node.width ?? definition.width,
      node.height ?? definition.height,
    );
    instance.dslKey = node.key;
    const overrides = stylePatch(node, theme);
    Object.assign(instance, geometryPatch(node), overrides);
    instance.styleOverrides = Object.keys(overrides).length ? overrides : null;
    store.addElements(instance);
    return { element: instance, created: true };
  }
  const element = newGenericElement(node.shape, store.appState, node.x ?? placement.x, node.y ?? placement.y);
  element.width = node.width ?? DEFAULT_WIDTH;
  element.height = node.height ?? DEFAULT_HEIGHT;
  element.dslKey = node.key;
  Object.assign(element, applyNodeStyle(node, theme));
  store.addElements(element);
  setLabel(element.id, node.label);
  return { element, created: true };
};

const deleteManaged = (id: string) => {
  if (readElement(id)) store.deleteElements([id]);
};

const applyFrame = (frame: FrameSpec, id: string | undefined, theme: "light" | "dark") => {
  if (!id) {
    const created = newFrameElement(store.appState, frame.x ?? 80, frame.y ?? 80);
    created.width = frame.width ?? 360;
    created.height = frame.height ?? 260;
    created.name = frame.label;
    created.dslKey = frame.key;
    Object.assign(created, geometryPatch(frame), stylePatch(frame, theme));
    store.addElements(created);
    return created;
  }
  const existing = readElement(id);
  if (!existing || existing.type !== "frame") return null;
  store.updateElement(id, () => ({
    name: frame.label,
    ...geometryPatch(frame),
    ...stylePatch(frame, theme),
  }) as never);
  return readElement(id);
};

const textPatch = (text: TextSpec, theme: "light" | "dark") => ({
  ...geometryPatch(text),
  ...stylePatch(text, theme),
});

const applyText = (text: TextSpec, id: string | undefined, theme: "light" | "dark") => {
  if (!id) {
    const created = newTextElement(store.appState, text.x ?? 120, text.y ?? 120);
    created.text = text.text;
    created.dslKey = text.key;
    Object.assign(created, textPatch(text, theme));
    store.addElements(created);
    refreshTextLayout([created.id]);
    if (text.width !== undefined || text.height !== undefined) store.updateElement(created.id, () => geometryPatch(text));
    return created;
  }
  const existing = readElement(id);
  if (!existing || existing.type !== "text") return null;
  store.updateElement<TextElement>(id, () => ({ text: text.text, ...textPatch(text, theme) }) as never);
  refreshTextLayout([id]);
  if (text.width !== undefined || text.height !== undefined) store.updateElement(id, () => geometryPatch(text));
  return readElement(id);
};

const pathBounds = (points: [number, number][]) => {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  return { width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
};

const samePoint = (a: [number, number] | undefined, b: [number, number] | undefined) =>
  Boolean(a && b && a[0] === b[0] && a[1] === b[1]);

const applyPath = (path: PathSpec, id: string | undefined, theme: "light" | "dark") => {
  if (!id) {
    const bounds = pathBounds(path.points);
    const created = path.kind === "freehand"
      ? newFreedrawElement(store.appState, path.x ?? 120, path.y ?? 120)
      : newLinearElement("line", store.appState, path.x ?? 120, path.y ?? 120);
    created.points = path.closed && path.kind === "line" && !samePoint(path.points[0], path.points.at(-1))
      ? [...path.points, path.points[0]]
      : path.points;
    if (created.type === "freedraw") created.pressures = path.pressures ?? path.points.map(() => 0.5);
    created.width = path.width ?? bounds.width;
    created.height = path.height ?? bounds.height;
    created.dslKey = path.key;
    Object.assign(created, geometryPatch(path), stylePatch(path, theme));
    store.addElements(created);
    return created;
  }
  const existing = readElement(id);
  if (!existing || (existing.type !== "freedraw" && existing.type !== "line")) return null;
  const expectedType = path.kind === "freehand" ? "freedraw" : "line";
  if (existing.type !== expectedType) {
    store.deleteElements([existing.id]);
    return applyPath(path, undefined, theme);
  }
  const points = path.closed && path.kind === "line" && !samePoint(path.points[0], path.points.at(-1))
    ? [...path.points, path.points[0]]
    : path.points;
  store.updateElement(id, () => ({
    type: path.kind === "freehand" ? "freedraw" : "line",
    points,
    ...(path.kind === "freehand" ? { pressures: path.pressures ?? points.map(() => 0.5) } : {}),
    ...geometryPatch(path),
    ...stylePatch(path, theme),
  }) as never);
  return readElement(id);
};

const portBindings = (edge: EdgeSpec, from: ExcaliElement, to: ExcaliElement) => ({
  startBinding: bindingFor(from.id, edge.startPort, from),
  endBinding: bindingFor(to.id, edge.endPort, to),
});

const applyEdge = (
  edge: EdgeSpec,
  existing: LinearElement | undefined,
  from: ExcaliElement,
  to: ExcaliElement,
  theme: "light" | "dark",
) => {
  const wantsArrow = edge.kind !== "line";
  const wantsDashed = edge.kind === "dashed";
  const start = [from.x + from.width / 2, from.y + from.height / 2];
  const end = [to.x + to.width / 2, to.y + to.height / 2];
  const points = edge.points ?? [[0, 0], [end[0] - start[0], end[1] - start[1]]] as [number, number][];
  const patch = {
    type: wantsArrow ? "arrow" : "line",
    points,
    strokeStyle: edge.strokeStyle ?? (wantsDashed ? "dashed" : "solid"),
    pathType: edge.route ?? "straight",
    startArrowhead: wantsArrow ? (edge.startArrowhead ?? "none") : "none",
    endArrowhead: wantsArrow ? (edge.endArrowhead ?? "arrow") : "none",
    ...portBindings(edge, from, to),
    ...stylePatch(edge, theme),
  };

  if (!existing) {
    const arrow = newLinearElement(wantsArrow ? "arrow" : "line", store.appState, start[0], start[1]);
    Object.assign(arrow, patch, { dslKey: `${edge.from}→${edge.to}` });
    store.addElements(arrow);
    if (edge.label) {
      const text = newTextElement(store.appState, arrow.x, arrow.y, arrow.id);
      text.text = edge.label;
      store.addElements(text);
      store.updateElement(arrow.id, () => ({ boundText: text.id }));
      refreshTextLayout([text.id]);
    }
    return arrow;
  }

  const currentLabel = existing.boundText
    ? (((store.getElement(existing.boundText) ?? store.yElements.get(existing.boundText)) as TextElement | null)?.text ?? "")
    : "";
  store.updateElement(existing.id, () => ({ ...patch, dslKey: existing.dslKey ?? `${edge.from}→${edge.to}` }) as never);
  if (currentLabel !== (edge.label ?? "")) {
    if (edge.label) {
      if (existing.boundText) {
        store.updateElement<TextElement>(existing.boundText, () => ({ text: edge.label! }));
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
  }
  return readElement(existing.id);
};

const layoutGrid = () => {
  const nodes = store.visibleElements.filter(isNodeElement).filter((node) => node.dslKey && !node.locked);
  if (nodes.length < 2) return false;
  const columns = Math.max(1, Math.ceil(Math.sqrt(nodes.length)));
  const origin = getCommonBounds(nodes);
  const gap = 60;
  const cellWidth = Math.max(...nodes.map((node) => node.width)) + gap;
  const cellHeight = Math.max(...nodes.map((node) => node.height)) + gap;
  store.mutate(() => {
    nodes.forEach((node, index) => store.updateElement(node.id, () => ({
      x: origin.x1 + (index % columns) * cellWidth,
      y: origin.y1 + Math.floor(index / columns) * cellHeight,
    })));
  });
  refreshBindings(nodes.map((node) => node.id));
  return true;
};

export interface ApplyResult {
  created: number;
  updated: number;
  removed: number;
  /** true when the layout was run because the diagram was created from text */
  laidOut: boolean;
}

export const applySpecToScene = (spec: DiagramSpec): ApplyResult => {
  const before = specFromScene();
  const theme = store.appState.theme;
  let created = 0;
  let updated = 0;
  let removed = 0;
  const createdKeys: string[] = [];
  const managedRich = Boolean(spec.rich);

  store.mutate(() => {
    const keyToId = new Map(before.keyToElementId);
    const frameKeyToId = new Map(before.frameKeyToElementId);
    const textKeyToId = new Map(before.textKeyToElementId);
    const pathKeyToId = new Map(before.pathKeyToElementId);

    // Rich frames are created first so nodes can refer to them regardless of
    // declaration order.
    if (managedRich) {
      const wantedFrames = new Set((spec.frames ?? []).map((frame) => frame.key));
      for (const [key, id] of frameKeyToId) {
        if (!wantedFrames.has(key)) {
          deleteManaged(id);
          removed++;
        }
      }
      for (const frame of spec.frames ?? []) {
        const existing = applyFrame(frame, frameKeyToId.get(frame.key), theme);
        if (!frameKeyToId.has(frame.key)) {
          if (existing) created++;
          if (existing) frameKeyToId.set(frame.key, existing.id);
        } else if (existing) updated++;
      }
    }

    // --- nodes ------------------------------------------------------------
    const wanted = new Set(spec.nodes.map((node) => node.key));
    for (const [key, id] of before.keyToElementId) {
      if (wanted.has(key)) continue;
      const ids = idsForNode(id);
      if (ids.length) {
        store.deleteElements(ids);
        removed++;
      }
      keyToId.delete(key);
    }

    spec.nodes.forEach((node) => {
      const existingId = keyToId.get(node.key);
      if (!existingId) {
        const result = createNode(node, createdKeys.length, theme);
        keyToId.set(node.key, result.element.id);
        createdKeys.push(node.key);
        created++;
        return;
      }
      const element = store.getElement(existingId);
      if (!element) return;
      let changed = false;
      if (isNodeElement(element)) {
        if (element.type === "instance") {
          if (node.component && element.componentId !== node.component) {
            const definition = ensureComponent(node.component);
            if (definition) {
              const overrides = stylePatch(node, theme);
              store.updateElement(existingId, () => ({
                componentId: node.component!,
                width: node.width ?? definition.width,
                height: node.height ?? definition.height,
                ...geometryPatch(node),
                ...overrides,
                styleOverrides: Object.keys(overrides).length ? overrides : null,
              }) as never);
              changed = true;
            }
          } else {
            const overrides = stylePatch(node, theme);
            store.updateElement(existingId, () => ({
              ...geometryPatch(node),
              ...overrides,
              styleOverrides: Object.keys(overrides).length ? overrides : null,
            }) as never);
            changed = Object.keys(overrides).length > 0 || Object.keys(geometryPatch(node)).length > 0;
          }
        } else if (node.component && ensureComponent(node.component)) {
          // Preserve the element id (and therefore existing arrow bindings)
          // while replacing a generic node with a reusable component instance.
          if (element.boundText) store.deleteElements([element.boundText]);
          const definition = store.components[node.component];
          const overrides = stylePatch(node, theme);
          store.updateElement(existingId, () => ({
            type: "instance",
            componentId: node.component!,
            styleOverrides: Object.keys(overrides).length ? overrides : null,
            width: node.width ?? definition.width,
            height: node.height ?? definition.height,
            ...geometryPatch(node),
            ...overrides,
          }) as never);
          changed = true;
        } else if (element.type !== node.shape && !node.component) {
          store.updateElement(existingId, () => ({ type: node.shape }) as never);
          changed = true;
        }
        const patch = applyNodeStyle(node, theme);
        for (const [key, value] of Object.entries(patch)) {
          if ((element as unknown as Record<string, unknown>)[key] !== value) changed = true;
        }
        if (Object.keys(patch).length) store.updateElement(existingId, () => patch as never);
        const currentLabel = element.type !== "instance" && element.boundText
          ? (((store.getElement(element.boundText) ?? store.yElements.get(element.boundText)) as TextElement | null)?.text ?? "")
          : "";
        const nextLabel = node.label === node.key ? currentLabel || node.label : node.label;
        if (currentLabel !== nextLabel) {
          setLabel(existingId, nextLabel);
          changed = true;
        }
      }
      if (element.dslKey !== node.key) store.updateElement(existingId, () => ({ dslKey: node.key }));
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
    const wantedEdges = new Set(spec.edges.map((edge) => `${edge.from}→${edge.to}`));
    for (const [key, arrow] of existingArrows) {
      if (wantedEdges.has(key)) continue;
      const ids = [arrow.id];
      if (arrow.boundText) ids.push(arrow.boundText);
      store.deleteElements(ids);
      removed++;
    }
    for (const edge of spec.edges) {
      const from = readElement(keyToId.get(edge.from));
      const to = readElement(keyToId.get(edge.to));
      if (!from || !to) continue;
      const result = applyEdge(edge, existingArrows.get(`${edge.from}→${edge.to}`), from, to, theme);
      if (result) {
        const wasExisting = Boolean(existingArrows.get(`${edge.from}→${edge.to}`));
        if (wasExisting) updated++;
        else created++;
      }
    }

    if (managedRich) {
      // --- loose text -----------------------------------------------------
      const wantedTexts = new Set((spec.texts ?? []).map((text) => text.key));
      for (const [key, id] of textKeyToId) {
        if (!wantedTexts.has(key)) {
          deleteManaged(id);
          removed++;
        }
      }
      for (const text of spec.texts ?? []) {
        const result = applyText(text, textKeyToId.get(text.key), theme);
        if (!textKeyToId.has(text.key)) {
          if (result) created++;
          if (result) textKeyToId.set(text.key, result.id);
        } else if (result) updated++;
      }

      // --- freehand and unbound line paths -------------------------------
      const wantedPaths = new Set((spec.paths ?? []).map((path) => path.key));
      for (const [key, id] of pathKeyToId) {
        if (!wantedPaths.has(key)) {
          deleteManaged(id);
          removed++;
        }
      }
      for (const path of spec.paths ?? []) {
        const previousId = pathKeyToId.get(path.key);
        const result = applyPath(path, previousId, theme);
        if (!pathKeyToId.has(path.key)) {
          if (result) created++;
          if (result) pathKeyToId.set(path.key, result.id);
        } else if (result) {
          if (previousId !== result.id) {
            removed++;
            created++;
            pathKeyToId.set(path.key, result.id);
          } else {
            updated++;
          }
        }
      }

      // Explicit frame ownership wins over inferred membership.
      for (const node of spec.nodes) {
        if (!node.frame) continue;
        const id = keyToId.get(node.key);
        const frameId = frameKeyToId.get(node.frame);
        if (id && frameId) store.updateElement(id, () => ({ frameId }));
      }
      for (const text of spec.texts ?? []) {
        if (!text.frame) continue;
        const id = textKeyToId.get(text.key);
        const frameId = frameKeyToId.get(text.frame);
        if (id && frameId) store.updateElement(id, () => ({ frameId }));
      }
      for (const path of spec.paths ?? []) {
        if (!path.frame) continue;
        const id = pathKeyToId.get(path.key);
        const frameId = frameKeyToId.get(path.frame);
        if (id && frameId) store.updateElement(id, () => ({ frameId }));
      }
    }

  });

  // The store's array view refreshes after the Yjs transaction; recalculate
  // bound endpoints against that current view, not the transaction snapshot.
  refreshBindings([...before.keyToElementId.values(), ...store.visibleElements.filter(isNodeElement).map((node) => node.id)]);

  const nodes = store.visibleElements.filter(isNodeElement);
  const hasExplicitGeometry = spec.nodes.some((node) => node.x !== undefined || node.y !== undefined);
  let laidOut = false;
  if (spec.layout === "grid") {
    laidOut = layoutGrid();
  } else if (spec.layout === "right" || spec.layout === "down") {
    laidOut = tidyUp(spec.layout as LayoutDirection).moved > 0;
  } else if (!hasExplicitGeometry && created > 0 && nodes.length > 1 && nodes.every((el) => el.dslKey)) {
    laidOut = tidyUp("down").moved > 0;
  }
  if (laidOut) store.setAppState({ selectedIds: [] });

  return { created, updated, removed, laidOut };
};
