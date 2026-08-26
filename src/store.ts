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
import { deleteCommentsForElements } from "./workspaceData";

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

  ydoc!: Y.Doc;
  yElements!: Y.Map<any>;
  yOrder!: Y.Array<string>;
  yFiles!: Y.Map<any>;
  yComponents!: Y.Map<any>;
  undoManager!: Y.UndoManager;
  private ydocUpdateHandler = () => this.syncFromYjs();

  constructor() {
    // bindYdoc must be called to initialize the store's backing CRDT
  }

  bindYdoc(ydoc: Y.Doc) {
    if (this.ydoc) {
      this.ydoc.off("update", this.ydocUpdateHandler);
      if (this.undoManager) this.undoManager.destroy();
    }
    
    this.ydoc = ydoc;
    this.yElements = ydoc.getMap<any>("elements");
    this.yOrder = ydoc.getArray<string>("order");
    this.yFiles = ydoc.getMap<any>("files");
    this.yComponents = ydoc.getMap<any>("components");
    
    this.undoManager = new Y.UndoManager([this.yElements, this.yOrder], {
      captureTimeout: 500,
      trackedOrigins: new Set(["local"]),
    });
    
    this.ydoc.on("update", this.ydocUpdateHandler);
    this.syncFromYjs();
  }

  private syncFromYjs() {
    if (!this.ydoc) return;
    const nextElements: ExcaliElement[] = [];
    this.yOrder.forEach((id) => {
      const el = this.yElements.get(id);
      if (el) nextElements.push(el);
    });
    this.elements = nextElements;

    const nextFiles: Record<string, BinaryFile> = {};
    for (const key of this.yFiles.keys()) {
      const file = this.yFiles.get(key);
      if (file) nextFiles[key] = file;
    }
    this.files = nextFiles;

    const nextComponents: Record<string, ComponentDefinition> = {};
    for (const key of this.yComponents.keys()) {
      const comp = this.yComponents.get(key);
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
    if (this.undoManager) this.undoManager.stopCapturing();
  }

  commit() {
    if (this.undoManager) this.undoManager.stopCapturing();
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
    if (this.ydoc) {
      this.ydoc.transact(() => {
        fn();
      }, "local");
    }
    this.commit();
  }

  undo() {
    if (this.undoManager) this.undoManager.undo();
    this.appState = { ...this.appState, editingTextId: null };
  }

  redo() {
    if (this.undoManager) this.undoManager.redo();
    this.appState = { ...this.appState, editingTextId: null };
  }

  canUndo = () => this.undoManager?.undoStack.length > 0;
  canRedo = () => this.undoManager?.redoStack.length > 0;

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
      this.yElements.set(el.id, el);
      this.yOrder.push([el.id]);
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
    
    for (const id of idSet) {
      const el = this.yElements.get(id);
      if (el) {
        const patch = fn(el as T);
        const next = { ...el, ...(patch ?? {}), version: el.version + 1 } as ExcaliElement;
        updated.push(next);
        this.yElements.set(el.id, next);
      }
    }
    return updated;
  }

  updateElement<T extends ExcaliElement>(id: string, fn: (el: T) => Partial<T> | void) {
    return this.updateElements<T>([id], fn)[0] ?? null;
  }

  /** Soft-deletes so history and bindings can still reference the elements. */
  deleteElements(ids: string[]) {
    const idSet = new Set(ids);
    for (const id of idSet) {
      const el = this.yElements.get(id);
      if (el) {
        this.yElements.set(el.id, { ...el, isDeleted: true, version: el.version + 1 });
      }
    }
    this.appState = {
      ...this.appState,
      selectedIds: this.appState.selectedIds.filter((id) => !idSet.has(id)),
    };
    // Clean up any canvas comments attached to the deleted elements
    deleteCommentsForElements(ids);
  }

  addFile(file: BinaryFile) {
    this.files = { ...this.files, [file.id]: file };
    this.yFiles.set(file.id, file);
  }

  registerComponent(def: ComponentDefinition) {
    this.components = { ...this.components, [def.id]: def };
    this.yComponents.set(def.id, def);
  }

  /** Replaces the whole scene, e.g. after opening a file. */
  loadScene(
    elements: ExcaliElement[],
    files: Record<string, BinaryFile>,
    appStatePatch: Partial<AppState> = {},
    checkpoints?: Checkpoint[],
    components: Record<string, ComponentDefinition> = {},
  ) {
    if (this.undoManager) this.undoManager.clear();
    this.previewing = false;
    if (checkpoints?.length) {
      this.timeline.load(checkpoints);
    } else {
      this.timeline.reset();
      this.timeline.record(elements, Date.now(), "Opened");
    }
    
    if (this.ydoc) {
      this.ydoc.transact(() => {
        // Clear current state
        const currentKeys = Array.from(this.yElements.keys());
        currentKeys.forEach(k => this.yElements.delete(k));
        this.yOrder.delete(0, this.yOrder.length);
        
        const fileKeys = Array.from(this.yFiles.keys());
        fileKeys.forEach(k => this.yFiles.delete(k));
        
        const compKeys = Array.from(this.yComponents.keys());
        compKeys.forEach(k => this.yComponents.delete(k));
        
        // Load new state
        elements.forEach(el => {
          this.yElements.set(el.id, el);
          this.yOrder.push([el.id]);
        });
        Object.values(files).forEach(f => this.yFiles.set(f.id, f));
        Object.values(components).forEach(c => this.yComponents.set(c.id, c));
      }, "local");
    }

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

  /** Publishes the current local scene as the initial state of a new room. */
  publishScene() {
    const elements = [...this.elements];
    const files = Object.values(this.files);
    const components = Object.values(this.components);

    if (this.ydoc) {
      this.ydoc.transact(() => {
        this.yOrder.delete(0, this.yOrder.length);
        elements.forEach((element) => {
          this.yElements.set(element.id, element);
          this.yOrder.push([element.id]);
        });
        files.forEach((file) => {
          this.yFiles.set(file.id, file);
        });
        components.forEach((definition) => {
          this.yComponents.set(definition.id, definition);
        });
      }, "local");
    }
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
