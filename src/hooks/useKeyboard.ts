import { useEffect } from "react";
import { store } from "../store";
import {
  changeZOrder,
  deleteSelection,
  duplicateSelection,
  groupSelection,
  moveElementsBy,
  selectAll,
  toggleLockSelection,
  ungroupSelection,
  copyStyle,
  pasteStyle,
} from "../actions";
import { setZoom, zoomToFit } from "../components/ZoomControls";
import { tidyUp } from "../layout";
import { SHORTCUTS, matches, type ShortcutId } from "../shortcuts";
import type { Tool } from "../types";

const TOOL_KEYS: Record<string, Tool> = {
  "1": "selection",
  v: "selection",
  "2": "rectangle",
  r: "rectangle",
  s: "rectangle",
  n: "sticky",
  "3": "diamond",
  d: "diamond",
  "4": "ellipse",
  o: "ellipse",
  "5": "arrow",
  a: "arrow",
  "6": "line",
  l: "line",
  "7": "freedraw",
  p: "freedraw",
  "8": "text",
  t: "text",
  "9": "image",
  f: "frame",
  "0": "eraser",
  e: "eraser",
  k: "laser",
  h: "hand",
};

const isTypingTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.isContentEditable);

export interface KeyboardHandlers {
  onOpen: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onExport: () => void;
  onHelp: () => void;
  onHistory: () => void;
  onPresent: () => void;
  onToggleText: () => void;
  onServices: () => void;
  onImage: () => void;
  onEscape: () => void;
  onToggleCommandPalette?: () => void;
  onToggleViewMode?: () => void;
}

export const useKeyboardShortcuts = (handlers: KeyboardHandlers) => {
  useEffect(() => {
    /**
     * Actions keyed by shortcut id, so the combo that runs each one is the
     * same string the menus and help sheet display. Order matters only in
     * that the first match wins, and no two combos overlap.
     */
    const actions: Partial<Record<ShortcutId, () => void>> = {
      undo: () => store.undo(),
      redo: () => store.redo(),
      redoAlt: () => store.redo(),
      selectAll,
      duplicate: () => duplicateSelection(),
      copyStyle: copyStyle,
      pasteStyle: pasteStyle,
      group: groupSelection,
      ungroup: ungroupSelection,
      lock: toggleLockSelection,
      bringToFront: () => changeZOrder("front"),
      bringForward: () => changeZOrder("forward"),
      sendToBack: () => changeZOrder("back"),
      sendBackward: () => changeZOrder("backward"),
      open: handlers.onOpen,
      save: handlers.onSave,
      saveAs: handlers.onSaveAs,
      export: handlers.onExport,
      diagramText: handlers.onToggleText,
      history: handlers.onHistory,
      present: handlers.onPresent,
      tidyUp: () => tidyUp(),
      services: handlers.onServices,
      zoomIn: () => setZoom(store.appState.zoom * 1.2),
      zoomInAlt: () => setZoom(store.appState.zoom * 1.2),
      zoomOut: () => setZoom(store.appState.zoom / 1.2),
      zoomReset: () => setZoom(1),
      zoomToFit: () => zoomToFit("all"),
      commandPalette: handlers.onToggleCommandPalette,
      viewMode: handlers.onToggleViewMode,
      help: handlers.onHelp,
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;

      if (event.key === "Escape") {
        handlers.onEscape();
        store.setAppState({ selectedIds: [], tool: "selection" });
        return;
      }

      for (const [id, run] of Object.entries(actions)) {
        if (!matches(event, SHORTCUTS[id as ShortcutId])) continue;
        // Claim the key before the browser acts on it (⌘D bookmarks, ⌘O opens
        // a file picker, ⌘S saves the page).
        event.preventDefault();
        run();
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        deleteSelection();
        return;
      }

      if (event.key.startsWith("Arrow")) {
        const ids = store.appState.selectedIds;
        if (ids.length === 0) return;
        event.preventDefault();
        const step = event.shiftKey ? 20 : store.appState.gridSize ?? 1;
        const dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
        const dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
        store.mutate(() => moveElementsBy(ids, dx, dy));
        return;
      }

      // Tool letters are unmodified single presses; Shift and Ctrl combos above
      // have already had their turn.
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      const tool = TOOL_KEYS[event.key.toLowerCase()];
      if (tool) {
        event.preventDefault();
        if (tool === "image") {
          handlers.onImage();
        } else {
          store.setAppState({
            tool,
            selectedIds: tool === "selection" ? store.appState.selectedIds : [],
          });
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handlers]);
};
