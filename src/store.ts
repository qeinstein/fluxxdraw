import * as Y from "yjs";
import { useSyncExternalStore } from "react";
import { DEFAULT_APP_STATE } from "./constants";
import { Timeline } from "./io/history";
import type {
  AppState,
  BinaryFile,
  ComponentDefinition,
  ExcaliElement,
} from "./types";
import type { Checkpoint } from "./io/history";
import { ydoc, yElements, yOrder, yFiles, yComponents } from "./io/collaboration";

const undoManager = new Y.UndoManager([yElements, yOrder], {
  captureTimeout: 500,
});

/**
 * Scene state lives outside React so the pointer handlers can mutate at
 * pointer-move rate without re-rendering the whole tree; components subscribe
 * to the slices they need.
 */
export class SceneStore {
  elements: ExcaliElement[] = [];
  files: Record<string, BinaryFile> = {};
  /** reusable component definitions, keyed by id */
  components: Record<string, ComponentDefinition> = {};
  appState: AppState = { ...DEFAULT_APP_STATE };

  private listeners = new Set<() => void>();
  /** durable, saved-to-file version history (distinct from undo/redo) */
  timeline = new Timeline();
  /** set while scrubbing, so checkpoints aren't recorded for preview states */
  previewing = false;
  private version = 0;

  constructor() {
    ydoc.on("update", () => {
      this.syncFromYjs();
    });
  }

  private syncFromYjs() {
    const nextElements: ExcaliElement[] = [];
    yOrder.forEach((id) => {
      const el = yElements.get(id);
      if (el) nextElements.push(el);
    });
    this.elements = nextElements;

    const nextFiles: Record<string, BinaryFile> = {};
    for (const key of yFiles.keys()) {
      const file = yFiles.get(key);
      if (file) nextFiles[key] = file;
    }
    this.files = nextFiles;

    const nextComponents: Record<string, ComponentDefinition> = {};
    for (const key of yComponents.keys()) {
      const comp = yComponents.get(key);
      if (comp) nextComponents[key] = comp;
    }
    this.components = nextComponents;

    this.emit();
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getVersion = () => this.version;

  /** Notifies subscribers; call after any mutation. */
  emit() {
    this.version++;
    for (const listener of this.listeners) listener();
  }

  beginHistory() {
    // Yjs UndoManager automatically handles capturing edits, 
    // but we can explicitly stop capturing if needed.
    undoManager.stopCapturing();
  }

  commit() {
    undoManager.stopCapturing();
    this.recordCheckpoint();
  }

  cancelHistory() {
    // Yjs doesn't easily cancel a live transaction after it's in the doc,
    // usually we'd just undo it, but for simplicity we rely on the caller to undo if cancelled.
  }

  recordCheckpoint(label?: string) {
    if (this.previewing) return;
    this.timeline.record(this.elements, Date.now(), label);
  }

  mutate(fn: () => void) {
    this.beginHistory();
    ydoc.transact(() => {
      fn();
    }, "local");
    this.commit();
  }

  undo() {
    undoManager.undo();
    this.appState = { ...this.appState, editingTextId: null };
  }

  redo() {
    undoManager.redo();
    this.appState = { ...this.appState, editingTextId: null };
  }

  canUndo = () => undoManager.undoStack.length > 0;
  canRedo = () => undoManager.redoStack.length > 0;

  setAppState(patch: Partial<AppState>) {
    let nextState = { ...this.appState, ...patch };
    
    // Automatically enter/exit arrow editing mode based on selection
    if ("selectedIds" in patch) {
      if (nextState.selectedIds.length === 1) {
        const selected = this.getElement(nextState.selectedIds[0]);
        if (selected && (selected.type === "arrow" || selected.type === "line")) {
          nextState.editingArrowId = selected.id;
        } else {
          nextState.editingArrowId = null;
        }
      } else {
        nextState.editingArrowId = null;
      }
    }
    
    this.appState = nextState;
    this.emit();
  }

  setStyle(patch: Partial<AppState["currentStyle"]>) {
    this.appState = {
      ...this.appState,
      currentStyle: { ...this.appState.currentStyle, ...patch },
    };
    this.emit();
  }

  getElement(id: string) {
    return this.elements.find((el) => el.id === id) ?? null;
  }

  getSelected(): ExcaliElement[] {
    const ids = new Set(this.appState.selectedIds);
    return this.elements.filter((el) => ids.has(el.id) && !el.isDeleted);
  }

  addElements(...elements: ExcaliElement[]) {
    elements.forEach(el => {
      yElements.set(el.id, el);
      yOrder.push([el.id]);
    });
  }

  /**
   * Replaces elements by id with the result of `fn`, bumping their version so
   * the render cache invalidates. Returns the updated elements.
   */
  updateElements<T extends ExcaliElement>(
    ids: string[],
    fn: (el: T) => Partial<T> | void,
  ): ExcaliElement[] {
    const idSet = new Set(ids);
    const updated: ExcaliElement[] = [];
    
    // We iterate over this.elements (which is synced from Yjs)
    this.elements.forEach((el) => {
      if (!idSet.has(el.id)) return;
      const patch = fn(el as T);
      const next = { ...el, ...(patch ?? {}), version: el.version + 1 } as ExcaliElement;
      updated.push(next);
      yElements.set(el.id, next);
    });
    return updated;
  }

  updateElement<T extends ExcaliElement>(id: string, fn: (el: T) => Partial<T> | void) {
    return this.updateElements<T>([id], fn)[0] ?? null;
  }

  /** Soft-deletes so history and bindings can still reference the elements. */
  deleteElements(ids: string[]) {
    const idSet = new Set(ids);
    this.elements.forEach((el) => {
      if (idSet.has(el.id)) {
        yElements.set(el.id, { ...el, isDeleted: true, version: el.version + 1 });
      }
    });
    this.appState = {
      ...this.appState,
      selectedIds: this.appState.selectedIds.filter((id) => !idSet.has(id)),
    };
  }

  addFile(file: BinaryFile) {
    this.files = { ...this.files, [file.id]: file };
    yFiles.set(file.id, file);
  }

  registerComponent(def: ComponentDefinition) {
    this.components = { ...this.components, [def.id]: def };
    yComponents.set(def.id, def);
  }

  /** Replaces the whole scene, e.g. after opening a file. */
  loadScene(
    elements: ExcaliElement[],
    files: Record<string, BinaryFile>,
    appStatePatch: Partial<AppState> = {},
    checkpoints?: Checkpoint[],
    components: Record<string, ComponentDefinition> = {},
  ) {
    undoManager.clear();
    this.previewing = false;
    if (checkpoints?.length) {
      this.timeline.load(checkpoints);
    } else {
      this.timeline.reset();
      this.timeline.record(elements, Date.now(), "Opened");
    }
    
    ydoc.transact(() => {
      // Clear current state
      const currentKeys = Array.from(yElements.keys());
      currentKeys.forEach(k => yElements.delete(k));
      yOrder.delete(0, yOrder.length);
      
      const fileKeys = Array.from(yFiles.keys());
      fileKeys.forEach(k => yFiles.delete(k));
      
      const compKeys = Array.from(yComponents.keys());
      compKeys.forEach(k => yComponents.delete(k));
      
      // Load new state
      elements.forEach(el => {
        yElements.set(el.id, el);
        yOrder.push([el.id]);
      });
      Object.values(files).forEach(f => yFiles.set(f.id, f));
      Object.values(components).forEach(c => yComponents.set(c.id, c));
    }, "local");

    this.files = files;
    this.components = components;
    this.appState = {
      ...this.appState,
      ...appStatePatch,
      selectedIds: [],
      editingTextId: null,
    };
    this.emit();
  }

  resetScene() {
    this.loadScene([], {}, { scrollX: 0, scrollY: 0, zoom: 1 });
  }

  /** Live (non-deleted) elements, in z-order. */
  get visibleElements() {
    return this.elements.filter((el) => !el.isDeleted);
  }
}

export const store = new SceneStore();

/** Re-renders the calling component whenever the scene changes. */
export const useScene = () => {
  useSyncExternalStore(store.subscribe, store.getVersion);
  return store;
};

if (typeof window !== "undefined") {
  // handy for debugging in the console
  (window as unknown as { __scene: SceneStore }).__scene = store;
}
