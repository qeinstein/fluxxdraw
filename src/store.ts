import { useSyncExternalStore } from "react";
import { DEFAULT_APP_STATE } from "./constants";
import { Timeline } from "./io/history";
import type { AppState, BinaryFile, ExcaliElement } from "./types";
import type { Checkpoint } from "./io/history";

interface Snapshot {
  elements: ExcaliElement[];
  selectedIds: string[];
}

const HISTORY_LIMIT = 200;

/**
 * Scene state lives outside React so the pointer handlers can mutate at
 * pointer-move rate without re-rendering the whole tree; components subscribe
 * to the slices they need.
 */
class SceneStore {
  elements: ExcaliElement[] = [];
  files: Record<string, BinaryFile> = {};
  appState: AppState = structuredClone(DEFAULT_APP_STATE);

  private undoStack: Snapshot[] = [];
  private redoStack: Snapshot[] = [];
  private listeners = new Set<() => void>();
  /** durable, saved-to-file version history (distinct from undo/redo) */
  timeline = new Timeline();
  /** set while scrubbing, so checkpoints aren't recorded for preview states */
  previewing = false;
  private version = 0;
  /** snapshot taken when the current interaction began */
  private pendingBase: Snapshot | null = null;

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

  private snapshot(): Snapshot {
    return { elements: this.elements, selectedIds: this.appState.selectedIds };
  }

  /**
   * Marks the start of an undoable interaction. Call before a drag/edit
   * begins, then `commit()` once it ends.
   */
  beginHistory() {
    if (!this.pendingBase) this.pendingBase = this.snapshot();
  }

  /** Pushes the interaction that began at `beginHistory` onto the undo stack. */
  commit() {
    if (!this.pendingBase) return;
    if (this.pendingBase.elements === this.elements) {
      this.pendingBase = null;
      return; // nothing actually changed
    }
    this.undoStack.push(this.pendingBase);
    if (this.undoStack.length > HISTORY_LIMIT) this.undoStack.shift();
    this.redoStack = [];
    this.pendingBase = null;
    this.recordCheckpoint();
  }

  /** Appends to the durable timeline; coalesces rapid edits internally. */
  recordCheckpoint(label?: string) {
    if (this.previewing) return;
    this.timeline.record(this.elements, Date.now(), label);
  }

  /** Convenience for one-shot changes that should be undoable as a unit. */
  mutate(fn: () => void) {
    this.beginHistory();
    fn();
    this.commit();
    this.emit();
  }

  undo() {
    const prev = this.undoStack.pop();
    if (!prev) return;
    this.redoStack.push(this.snapshot());
    this.elements = prev.elements;
    this.appState = { ...this.appState, selectedIds: prev.selectedIds, editingTextId: null };
    this.emit();
  }

  redo() {
    const next = this.redoStack.pop();
    if (!next) return;
    this.undoStack.push(this.snapshot());
    this.elements = next.elements;
    this.appState = { ...this.appState, selectedIds: next.selectedIds, editingTextId: null };
    this.emit();
  }

  canUndo = () => this.undoStack.length > 0;
  canRedo = () => this.redoStack.length > 0;

  setAppState(patch: Partial<AppState>) {
    this.appState = { ...this.appState, ...patch };
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
    this.elements = [...this.elements, ...elements];
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
    this.elements = this.elements.map((el) => {
      if (!idSet.has(el.id)) return el;
      const patch = fn(el as T);
      const next = { ...el, ...(patch ?? {}), version: el.version + 1 } as ExcaliElement;
      updated.push(next);
      return next;
    });
    return updated;
  }

  updateElement<T extends ExcaliElement>(id: string, fn: (el: T) => Partial<T> | void) {
    return this.updateElements<T>([id], fn)[0] ?? null;
  }

  /** Soft-deletes so history and bindings can still reference the elements. */
  deleteElements(ids: string[]) {
    const idSet = new Set(ids);
    this.elements = this.elements.map((el) =>
      idSet.has(el.id) ? { ...el, isDeleted: true, version: el.version + 1 } : el,
    );
    this.appState = {
      ...this.appState,
      selectedIds: this.appState.selectedIds.filter((id) => !idSet.has(id)),
    };
  }

  addFile(file: BinaryFile) {
    this.files = { ...this.files, [file.id]: file };
  }

  /** Replaces the whole scene, e.g. after opening a file. */
  loadScene(
    elements: ExcaliElement[],
    files: Record<string, BinaryFile>,
    appStatePatch: Partial<AppState> = {},
    checkpoints?: Checkpoint[],
  ) {
    this.undoStack = [];
    this.redoStack = [];
    this.pendingBase = null;
    this.previewing = false;
    if (checkpoints?.length) {
      this.timeline.load(checkpoints);
    } else {
      this.timeline.reset();
      this.timeline.record(elements, Date.now(), "Opened");
    }
    this.elements = elements;
    this.files = files;
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
