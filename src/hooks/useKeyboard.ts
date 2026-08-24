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
} from "../actions";
import { setZoom, zoomToFit } from "../components/ZoomControls";
import { tidyUp } from "../layout";
import type { Tool } from "../types";

const TOOL_KEYS: Record<string, Tool> = {
  "1": "selection",
  v: "selection",
  "2": "rectangle",
  r: "rectangle",
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
  onEscape: () => void;
}

export const useKeyboardShortcuts = (handlers: KeyboardHandlers) => {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      const mod = event.metaKey || event.ctrlKey;
      const key = event.key;
      const lower = key.toLowerCase();

      if (key === "Escape") {
        handlers.onEscape();
        store.setAppState({ selectedIds: [], tool: "selection" });
        return;
      }

      if (mod) {
        switch (lower) {
          case "z":
            event.preventDefault();
            if (event.shiftKey) store.redo();
            else store.undo();
            return;
          case "y":
            event.preventDefault();
            store.redo();
            return;
          case "a":
            event.preventDefault();
            selectAll();
            return;
          case "d":
            event.preventDefault();
            duplicateSelection();
            return;
          case "g":
            event.preventDefault();
            if (event.shiftKey) ungroupSelection();
            else groupSelection();
            return;
          case "l":
            if (event.shiftKey) {
              event.preventDefault();
              toggleLockSelection();
            }
            return;
          case "h":
            event.preventDefault();
            handlers.onHistory();
            return;
          case "p":
            if (event.shiftKey) {
              event.preventDefault();
              handlers.onPresent();
            }
            return;
          case "t":
            if (event.shiftKey) {
              event.preventDefault();
              tidyUp();
            }
            return;
          case "o":
            event.preventDefault();
            handlers.onOpen();
            return;
          case "s":
            event.preventDefault();
            if (event.shiftKey) handlers.onSaveAs();
            else handlers.onSave();
            return;
          case "e":
            if (event.shiftKey) {
              event.preventDefault();
              handlers.onExport();
            }
            return;
          case "]":
            event.preventDefault();
            changeZOrder(event.shiftKey ? "forward" : "front");
            return;
          case "[":
            event.preventDefault();
            changeZOrder(event.shiftKey ? "backward" : "back");
            return;
          case "=":
          case "+":
            event.preventDefault();
            setZoom(store.appState.zoom * 1.2);
            return;
          case "-":
            event.preventDefault();
            setZoom(store.appState.zoom / 1.2);
            return;
          case "0":
            event.preventDefault();
            setZoom(1);
            return;
        }
        return;
      }

      if (key === "Delete" || key === "Backspace") {
        event.preventDefault();
        deleteSelection();
        return;
      }

      if (key.startsWith("Arrow")) {
        const ids = store.appState.selectedIds;
        if (ids.length === 0) return;
        event.preventDefault();
        const step = event.shiftKey ? 20 : store.appState.gridSize ?? 1;
        const dx = key === "ArrowLeft" ? -step : key === "ArrowRight" ? step : 0;
        const dy = key === "ArrowUp" ? -step : key === "ArrowDown" ? step : 0;
        store.mutate(() => moveElementsBy(ids, dx, dy));
        return;
      }

      if (key === "?" || (event.shiftKey && key === "/")) {
        event.preventDefault();
        handlers.onHelp();
        return;
      }

      if (event.shiftKey && key === "!") {
        // Shift+1 fits everything on screen
        event.preventDefault();
        zoomToFit("all");
        return;
      }

      if (lower === "q") {
        store.setAppState({ toolLocked: !store.appState.toolLocked });
        return;
      }

      const tool = TOOL_KEYS[lower];
      if (tool && !event.shiftKey) {
        event.preventDefault();
        store.setAppState({ tool, selectedIds: tool === "selection" ? store.appState.selectedIds : [] });
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handlers]);
};
