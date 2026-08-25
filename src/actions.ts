import { nanoid } from "nanoid";
import { store } from "./store";
import { getBoundArrowPoints } from "./elements/binding";
import { rerouteArrow } from "./elements/arrowRouting";
import { duplicateElement } from "./elements/factory";
import { INSTANCE_OVERRIDE_KEYS } from "./components-model";
import { getCommonBounds, getElementBounds, getRotatedBounds } from "./geometry";
import { getLabelBox, getTextLines, measureText } from "./elements/text";
import { CONTAINER_PADDING } from "./constants";
import type {
  ExcaliElement,
  GenericElement,
  InstanceElement,
  LinearElement,
  TextElement,
} from "./types";

/** Re-runs binding math for every arrow attached to the given shapes. */
export const refreshBindings = (changedIds: string[]) => {
  const changed = new Set(changedIds);
  const byId = new Map(store.elements.map((el) => [el.id, el]));
  const arrowIds = store.elements
    .filter(
      (el): el is LinearElement =>
        (el.type === "arrow" || el.type === "line") &&
        !el.isDeleted &&
        ((el.startBinding !== null && changed.has(el.startBinding.elementId)) ||
          (el.endBinding !== null && changed.has(el.endBinding.elementId)) ||
          changed.has(el.id)),
    )
    .map((el) => el.id);
  if (arrowIds.length === 0) return;
  store.updateElements<LinearElement>(arrowIds, (arrow) => {
    // For curved/elbow arrows, regenerate the full route so the path
    // adapts to the new shape positions (L/Z/U routing, control points, etc.)
    if (arrow.pathType === "curved" || arrow.pathType === "elbow") {
      const points = rerouteArrow(arrow, byId);
      return points ? { points } : undefined;
    }
    // For straight arrows, just update the bound endpoints
    const points = getBoundArrowPoints(arrow, byId);
    return points ? { points } : undefined;
  });
};

/**
 * Grows a container to fit its bound label, and keeps standalone text elements
 * sized to their content.
 */
export const refreshTextLayout = (textIds: string[]) => {
  for (const id of textIds) {
    const text = store.getElement(id) as TextElement | null;
    if (!text || text.type !== "text") continue;
    const container = text.containerId ? store.getElement(text.containerId) : null;
    const lines = getTextLines(text, container);
    const { width, height } = measureText(lines, text);

    if (container) {
      const needed = height + CONTAINER_PADDING * 2;
      if (Math.abs(container.height) < needed) {
        store.updateElement(container.id, () => ({ height: needed }));
        refreshBindings([container.id]);
      }
      // Keep the label's own geometry in step with where it actually draws.
      // Its position is derived from the container at render time, but bounds
      // maths (selection, export, components) reads x/y directly, so leaving
      // them stale drags those boxes off to wherever the label was created.
      const box = getLabelBox(
        store.getElement(container.id) ?? container,
        width,
        height,
        text.verticalAlign,
      );
      store.updateElement<TextElement>(id, () => ({ width, height, x: box.x, y: box.y }));
    } else {
      store.updateElement<TextElement>(id, () => ({ width, height }));
    }
  }
};

export const moveElementsBy = (ids: string[], dx: number, dy: number) => {
  store.updateElements(ids, (el) => ({ x: el.x + dx, y: el.y + dy }));
  // bound labels ride along with their container
  const idSet = new Set(ids);
  const labelIds = store.elements
    .filter(
      (el): el is TextElement =>
        el.type === "text" && el.containerId !== null && idSet.has(el.containerId) && !idSet.has(el.id),
    )
    .map((el) => el.id);
  if (labelIds.length) store.updateElements(labelIds, (el) => ({ x: el.x + dx, y: el.y + dy }));

  // Break arrow bindings if the arrow is moving but its bound target isn't
  const arrowIds = ids.filter((id) => {
    const el = store.getElement(id);
    return el && (el.type === "arrow" || el.type === "line");
  });
  if (arrowIds.length > 0) {
    store.updateElements<LinearElement>(arrowIds, (arrow) => {
      let changed = false;
      let startBinding = arrow.startBinding;
      let endBinding = arrow.endBinding;
      
      if (startBinding && !idSet.has(startBinding.elementId)) {
        startBinding = null;
        changed = true;
      }
      if (endBinding && !idSet.has(endBinding.elementId)) {
        endBinding = null;
        changed = true;
      }
      return changed ? { startBinding, endBinding } : undefined;
    });
  }

  refreshBindings(ids);
};

// --- selection -------------------------------------------------------------

/**
 * A bound label is part of its container, not a thing you select on its own —
 * clicking the text inside a shape should select the shape.
 */
export const resolveSelectionTarget = (el: ExcaliElement): ExcaliElement => {
  if (el.type === "text" && el.containerId) {
    return store.getElement(el.containerId) ?? el;
  }
  return el;
};

/** Expands an id set to include every member of any group it touches. */
export const expandSelectionToGroups = (ids: string[]): string[] => {
  const groupIds = new Set<string>();
  for (const id of ids) {
    const el = store.getElement(id);
    el?.groupIds.forEach((g) => groupIds.add(g));
  }
  if (groupIds.size === 0) return ids;
  const result = new Set(ids);
  for (const el of store.visibleElements) {
    if (el.groupIds.some((g) => groupIds.has(g))) result.add(el.id);
  }
  return [...result];
};

export const selectAll = () => {
  store.setAppState({
    selectedIds: store.visibleElements
      .filter((el) => !el.locked && !(el.type === "text" && el.containerId))
      .map((el) => el.id),
  });
};

// --- grouping --------------------------------------------------------------

export const groupSelection = () => {
  const selected = store.getSelected();
  if (selected.length < 2) return;
  const groupId = nanoid();
  store.mutate(() => {
    store.updateElements(
      selected.map((el) => el.id),
      (el) => ({ groupIds: [...el.groupIds, groupId] }),
    );
  });
};

export const ungroupSelection = () => {
  const selected = store.getSelected();
  if (selected.length === 0) return;
  store.mutate(() => {
    store.updateElements(
      selected.map((el) => el.id),
      (el) => ({ groupIds: el.groupIds.slice(0, -1) }),
    );
  });
};

// --- z-order ---------------------------------------------------------------

type ZAction = "back" | "backward" | "forward" | "front";

export const changeZOrder = (action: ZAction) => {
  const ids = new Set(store.appState.selectedIds);
  if (ids.size === 0) return;
  store.mutate(() => {
    const moving = store.elements.filter((el) => ids.has(el.id));
    const rest = store.elements.filter((el) => !ids.has(el.id));
    if (action === "back") {
      store.elements = [...moving, ...rest];
    } else if (action === "front") {
      store.elements = [...rest, ...moving];
    } else {
      const step = action === "forward" ? 1 : -1;
      const next = [...store.elements];
      const indices = next
        .map((el, i) => (ids.has(el.id) ? i : -1))
        .filter((i) => i >= 0);
      // walk from the leading edge so elements can't jump over each other
      const ordered = step > 0 ? indices.reverse() : indices;
      for (const i of ordered) {
        const j = i + step;
        if (j < 0 || j >= next.length || ids.has(next[j].id)) continue;
        [next[i], next[j]] = [next[j], next[i]];
      }
      store.elements = next;
    }
  });
};

// --- align & distribute ----------------------------------------------------

type AlignAxis = "left" | "center-x" | "right" | "top" | "center-y" | "bottom";

export const alignSelection = (axis: AlignAxis) => {
  const selected = store.getSelected();
  if (selected.length < 2) return;
  const outer = getCommonBounds(selected);
  store.mutate(() => {
    for (const el of selected) {
      const b = getRotatedBounds(el);
      let dx = 0;
      let dy = 0;
      switch (axis) {
        case "left":
          dx = outer.x1 - b.x1;
          break;
        case "right":
          dx = outer.x2 - b.x2;
          break;
        case "center-x":
          dx = (outer.x1 + outer.x2) / 2 - (b.x1 + b.x2) / 2;
          break;
        case "top":
          dy = outer.y1 - b.y1;
          break;
        case "bottom":
          dy = outer.y2 - b.y2;
          break;
        case "center-y":
          dy = (outer.y1 + outer.y2) / 2 - (b.y1 + b.y2) / 2;
          break;
      }
      if (dx || dy) moveElementsBy([el.id], dx, dy);
    }
  });
};

export const distributeSelection = (axis: "horizontal" | "vertical") => {
  const selected = store.getSelected();
  if (selected.length < 3) return;
  const horizontal = axis === "horizontal";
  const withBounds = selected
    .map((el) => ({ el, b: getRotatedBounds(el) }))
    .sort((a, b) => (horizontal ? a.b.x1 - b.b.x1 : a.b.y1 - b.b.y1));

  const first = withBounds[0].b;
  const last = withBounds[withBounds.length - 1].b;
  const span = horizontal ? last.x2 - first.x1 : last.y2 - first.y1;
  const totalSize = withBounds.reduce(
    (sum, { b }) => sum + (horizontal ? b.x2 - b.x1 : b.y2 - b.y1),
    0,
  );
  const gap = (span - totalSize) / (withBounds.length - 1);

  store.mutate(() => {
    let cursor = horizontal ? first.x1 : first.y1;
    for (const { el, b } of withBounds) {
      const size = horizontal ? b.x2 - b.x1 : b.y2 - b.y1;
      const delta = cursor - (horizontal ? b.x1 : b.y1);
      if (delta) moveElementsBy([el.id], horizontal ? delta : 0, horizontal ? 0 : delta);
      cursor += size + gap;
    }
  });
};

// --- clipboard-ish ---------------------------------------------------------

export const duplicateSelection = (dx = 10, dy = 10) => {
  const selected = store.getSelected();
  if (selected.length === 0) return;
  store.mutate(() => {
    const idMap = new Map<string, string>();
    const copies = selected.map((el) => {
      const copy = duplicateElement(el, dx, dy);
      idMap.set(el.id, copy.id);
      return copy;
    });
    // rewire intra-selection references so copies point at copies
    for (const copy of copies) {
      if ("boundText" in copy && copy.boundText) {
        copy.boundText = idMap.get(copy.boundText) ?? null;
      }
      if (copy.type === "text" && copy.containerId) {
        copy.containerId = idMap.get(copy.containerId) ?? null;
      }
      if (copy.type === "arrow" || copy.type === "line") {
        const rebind = (b: LinearElement["startBinding"]) =>
          b && idMap.has(b.elementId) ? { ...b, elementId: idMap.get(b.elementId)! } : null;
        copy.startBinding = rebind(copy.startBinding);
        copy.endBinding = rebind(copy.endBinding);
      }
    }
    store.addElements(...copies);
    store.appState = { ...store.appState, selectedIds: copies.map((c) => c.id) };
  });
};

export const deleteSelection = () => {
  const selected = store.getSelected();
  if (selected.length === 0) return;
  const ids = selected.map((el) => el.id);
  // bound labels die with their container
  for (const el of selected) {
    if ("boundText" in el && el.boundText) ids.push(el.boundText);
  }
  store.mutate(() => store.deleteElements(ids));
};

export const toggleLockSelection = () => {
  const selected = store.getSelected();
  if (selected.length === 0) return;
  const lock = !selected.every((el) => el.locked);
  store.mutate(() => {
    store.updateElements(
      selected.map((el) => el.id),
      () => ({ locked: lock }),
    );
  });
};

/** Applies a style patch to the selection and remembers it for new elements. */
export const applyStyleToSelection = (patch: Record<string, unknown>) => {
  store.setStyle(patch as never);
  const selected = store.getSelected();
  if (selected.length === 0) return;
  const ids = selected.map((el) => el.id);
  // style changes should also reach labels inside the selected containers
  for (const el of selected) {
    if ("boundText" in el && el.boundText) ids.push(el.boundText);
  }
  // opacity already applies to an instance as a whole; the rest has to be
  // handed to its children at render time
  const { opacity, ...rest } = patch;
  const overridable = Object.fromEntries(
    Object.entries(rest).filter(([key]) =>
      (INSTANCE_OVERRIDE_KEYS as readonly string[]).includes(key),
    ),
  );

  store.mutate(() => {
    for (const id of ids) {
      const element = store.getElement(id);
      if (element?.type === "instance") {
        store.updateElement<InstanceElement>(id, (current) => ({
          ...(opacity === undefined ? {} : { opacity: opacity as number }),
          styleOverrides: Object.keys(overridable).length
            ? { ...current.styleOverrides, ...overridable }
            : current.styleOverrides,
        }));
      } else {
        store.updateElement(id, () => ({ ...patch }) as never);
      }
    }
    const textIds = ids.filter((id) => store.getElement(id)?.type === "text");
    if (textIds.length) refreshTextLayout(textIds);
  });
};

// --- frames ----------------------------------------------------------------

/** Reassigns frame membership based on which elements sit inside which frame. */
export const reconcileFrameMembership = () => {
  const frames = store.visibleElements.filter((el) => el.type === "frame");
  if (frames.length === 0) return;
  const updates: { id: string; frameId: string | null }[] = [];
  for (const el of store.visibleElements) {
    if (el.type === "frame") continue;
    const b = getElementBounds(el);
    const cx = (b.x1 + b.x2) / 2;
    const cy = (b.y1 + b.y2) / 2;
    // topmost frame whose box contains the element's centre wins
    let owner: string | null = null;
    for (const frame of frames) {
      const fb = getElementBounds(frame);
      if (cx >= fb.x1 && cx <= fb.x2 && cy >= fb.y1 && cy <= fb.y2) owner = frame.id;
    }
    if (owner !== el.frameId) updates.push({ id: el.id, frameId: owner });
  }
  for (const { id, frameId } of updates) store.updateElement(id, () => ({ frameId }));
};

/** Elements belonging to a frame, plus the frame itself. */
export const getFrameContents = (frameId: string): ExcaliElement[] => {
  const frame = store.getElement(frameId);
  if (!frame) return [];
  return [frame, ...store.visibleElements.filter((el) => el.frameId === frameId)];
};

export const isContainer = (el: ExcaliElement): el is GenericElement =>
  el.type === "rectangle" || el.type === "diamond" || el.type === "ellipse" || el.type === "sticky";
