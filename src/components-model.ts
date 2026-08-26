import { nanoid } from "nanoid";
import { store } from "./store";
import { duplicateElement } from "./elements/factory";
import { getCommonBounds } from "./geometry";
import { refreshBindings } from "./actions";
import type { ComponentDefinition, ExcaliElement, InstanceElement } from "./types";

/**
 * Components: edit the master, every placed copy follows.
 *
 * A definition stores its elements in local coordinates with the origin at
 * (0, 0). An instance is just a box pointing at a definition, so placing a
 * hundred copies costs a hundred small elements rather than a hundred full
 * subtrees — and one edit updates all of them.
 */

/** Re-bases elements so the group's top-left corner sits at the origin. */
const toLocalCoordinates = (elements: ExcaliElement[]) => {
  const bounds = getCommonBounds(elements);
  const local = elements.map((el) => ({
    ...structuredClone(el),
    x: el.x - bounds.x1,
    y: el.y - bounds.y1,
  }));
  return {
    elements: local,
    width: Math.max(bounds.x2 - bounds.x1, 1),
    height: Math.max(bounds.y2 - bounds.y1, 1),
  };
};

/**
 * Style keys an instance keeps as overrides. Opacity is absent on purpose: it
 * applies to the instance as a whole when drawing, so it stays a plain field.
 *
 * The panel reads through this and `applyStyleToSelection` writes through it,
 * which is what keeps the highlighted option and the applied value in step.
 */
export const INSTANCE_OVERRIDE_KEYS = [
  "strokeColor",
  "backgroundColor",
  "fillStyle",
  "strokeWidth",
  "strokeStyle",
  "roughness",
  "edges",
] as const;

/**
 * The value an instance is effectively drawing with.
 *
 * An override wins. Without one the master decides, so the answer is whatever
 * its elements agree on — and `undefined` when they disagree, the same "mixed"
 * signal a multi-selection gives, rather than a confident wrong highlight.
 */
export const instanceStyleValue = (el: InstanceElement, key: string): unknown => {
  if (key === "opacity") return el.opacity;
  const override = el.styleOverrides?.[key as keyof typeof el.styleOverrides];
  if (override !== undefined) return override;

  const definition = store.components[el.componentId];
  if (!definition) return undefined;
  /*
   * Text is left out of the vote: stroke width, sloppiness and edges say
   * nothing about a drawn glyph, so letting labels join in would report the
   * master as "mixed" and highlight nothing on a node that plainly has a look.
   */
  const drawn = definition.elements.filter((child) => child.type !== "text");
  const voters = drawn.length ? drawn : definition.elements;
  if (voters.length === 0) return undefined;
  const read = (child: ExcaliElement) => (child as unknown as Record<string, unknown>)[key];
  const first = read(voters[0]);
  return voters.every((child) => read(child) === first) ? first : undefined;
};

export const newInstance = (
  componentId: string,
  x: number,
  y: number,
  width: number,
  height: number,
): InstanceElement => ({
  id: nanoid(),
  type: "instance",
  componentId,
  styleOverrides: null,
  x,
  y,
  width,
  height,
  angle: 0,
  seed: Math.floor(Math.random() * 2 ** 31),
  version: 1,
  groupIds: [],
  frameId: null,
  locked: false,
  isDeleted: false,
  link: null,
  strokeColor: "#1e1e1e",
  backgroundColor: "transparent",
  fillStyle: "solid",
  strokeWidth: 1,
  strokeStyle: "solid",
  roughness: 0,
  edges: "sharp",
  opacity: 100,
});

/**
 * Turns the current selection into a component and replaces it with the first
 * instance. Returns the new definition, or null if nothing was selected.
 */
export const createComponentFromSelection = (name?: string): ComponentDefinition | null => {
  const selected = store.getSelected();
  if (selected.length === 0) return null;

  // bound labels have to travel with their containers
  const ids = new Set(selected.map((el) => el.id));
  for (const el of selected) {
    if ("boundText" in el && el.boundText) ids.add(el.boundText);
  }
  const members = store.visibleElements.filter((el) => ids.has(el.id));

  const bounds = getCommonBounds(members);
  const { elements, width, height } = toLocalCoordinates(members);

  let componentName: string = name?.trim() || "";
  if (!componentName) {
    const textEl = elements.find(el => el.type === "text" && "text" in el && typeof (el as any).text === "string" && (el as any).text.trim());
    if (textEl && "text" in textEl) {
      componentName = (textEl as any).text.slice(0, 20);
    } else {
      componentName = `Component ${Object.keys(store.components).length + 1}`;
    }
  }

  const definition: ComponentDefinition = {
    id: nanoid(),
    name: componentName,
    elements,
    width,
    height,
    version: 1,
  };

  store.mutate(() => {
    store.registerComponent(definition);
    store.deleteElements([...ids]);
    const instance = newInstance(definition.id, bounds.x1, bounds.y1, width, height);
    store.addElements(instance);
    store.appState = { ...store.appState, selectedIds: [instance.id] };
  });

  return definition;
};

/** Places another copy of a definition on the canvas. */
export const placeInstance = (componentId: string, x: number, y: number) => {
  const definition = store.components[componentId];
  if (!definition) return null;
  let placed: InstanceElement | null = null;
  store.mutate(() => {
    placed = newInstance(componentId, x, y, definition.width, definition.height);
    store.addElements(placed);
    store.appState = { ...store.appState, selectedIds: [placed.id] };
  });
  return placed;
};

/** Expands an instance back into ordinary, independently editable elements. */
export const detachInstance = (instanceId: string) => {
  const instance = store.getElement(instanceId) as InstanceElement | null;
  if (!instance || instance.type !== "instance") return;
  const definition = store.components[instance.componentId];
  if (!definition) return;

  const scaleX = instance.width / definition.width;
  const scaleY = instance.height / definition.height;

  store.mutate(() => {
    const idMap = new Map<string, string>();
    const copies = definition.elements.map((el) => {
      const copy = duplicateElement(el);
      idMap.set(el.id, copy.id);
      copy.x = instance.x + el.x * scaleX;
      copy.y = instance.y + el.y * scaleY;
      copy.width = el.width * scaleX;
      copy.height = el.height * scaleY;
      if ("points" in copy && Array.isArray(copy.points)) {
        copy.points = (copy.points as [number, number][]).map(([px, py]) => [
          px * scaleX,
          py * scaleY,
        ]);
      }
      return copy;
    });
    // rewire internal references so the detached copy is self-contained
    for (const copy of copies) {
      if ("boundText" in copy && copy.boundText) {
        copy.boundText = idMap.get(copy.boundText) ?? null;
      }
      if (copy.type === "text" && copy.containerId) {
        copy.containerId = idMap.get(copy.containerId) ?? null;
      }
      if (copy.type === "arrow" || copy.type === "line") {
        const rebind = (b: { elementId: string } | null) =>
          b && idMap.has(b.elementId)
            ? { ...b, elementId: idMap.get(b.elementId)! }
            : null;
        copy.startBinding = rebind(copy.startBinding) as typeof copy.startBinding;
        copy.endBinding = rebind(copy.endBinding) as typeof copy.endBinding;
      }
    }
    store.deleteElements([instanceId]);
    store.addElements(...copies);
    store.appState = { ...store.appState, selectedIds: copies.map((c) => c.id) };
  });
};

export interface ComponentEditSession {
  componentId: string;
  /** ids of the temporary elements placed on canvas for editing */
  elementIds: string[];
  /** where the elements were placed, so they can be re-based on save */
  originX: number;
  originY: number;
}

/**
 * Opens a component for editing by dropping its contents onto the canvas as
 * ordinary elements. Committing folds them back into the definition, which
 * updates every instance at once.
 */
export const beginComponentEdit = (instanceId: string): ComponentEditSession | null => {
  const instance = store.getElement(instanceId) as InstanceElement | null;
  if (!instance || instance.type !== "instance") return null;
  const definition = store.components[instance.componentId];
  if (!definition) return null;

  const elementIds: string[] = [];
  store.mutate(() => {
    const copies = definition.elements.map((el) => {
      const copy = duplicateElement(el);
      copy.x = instance.x + el.x;
      copy.y = instance.y + el.y;
      elementIds.push(copy.id);
      return copy;
    });
    // hide the instance while its master is on the canvas, to avoid a double image
    store.updateElement(instanceId, () => ({ opacity: 0 }));
    store.addElements(...copies);
    store.appState = { ...store.appState, selectedIds: elementIds };
  });

  return {
    componentId: instance.componentId,
    elementIds,
    originX: instance.x,
    originY: instance.y,
  };
};

/** Folds an edit session back into the definition and refreshes every instance. */
export const commitComponentEdit = (session: ComponentEditSession, instanceId: string) => {
  const edited = store.visibleElements.filter((el) => session.elementIds.includes(el.id));
  if (edited.length === 0) {
    cancelComponentEdit(session, instanceId);
    return;
  }

  const { elements, width, height } = toLocalCoordinates(edited);
  const previous = store.components[session.componentId];

  store.mutate(() => {
    store.registerComponent({
      ...previous,
      elements,
      width,
      height,
      version: (previous?.version ?? 1) + 1,
    });
    store.deleteElements(session.elementIds);
    store.updateElement(instanceId, () => ({ opacity: 100 }));

    // every instance of this component adopts the new intrinsic size
    const instanceIds = store.visibleElements
      .filter(
        (el): el is InstanceElement =>
          el.type === "instance" && el.componentId === session.componentId,
      )
      .map((el) => el.id);
    store.updateElements(instanceIds, () => ({ width, height }));
    refreshBindings(instanceIds);
    store.appState = { ...store.appState, selectedIds: [instanceId] };
  });
};

/** Abandons an edit session, leaving the definition untouched. */
export const cancelComponentEdit = (
  session: ComponentEditSession,
  instanceId: string,
) => {
  store.mutate(() => {
    store.deleteElements(session.elementIds);
    store.updateElement(instanceId, () => ({ opacity: 100 }));
    store.appState = { ...store.appState, selectedIds: [instanceId] };
  });
};

export const countInstances = (componentId: string) =>
  store.visibleElements.filter(
    (el) => el.type === "instance" && el.componentId === componentId,
  ).length;
