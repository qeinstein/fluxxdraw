import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { store, useScene } from "../store";
import {
  changeZOrder,
  deleteSelection,
  duplicateSelection,
  groupSelection,
  selectAll,
  toggleLockSelection,
  ungroupSelection,
} from "../actions";
import { setZoom, zoomToFit } from "./ZoomControls";
import { tidyUp } from "../layout";
import { sc } from "../shortcuts";

export interface ContextMenuRequest {
  /** viewport coordinates of the click or long-press */
  x: number;
  y: number;
  /** present when the thing under the cursor can carry a label */
  onEditLabel: (() => void) | null;
  /** present when a locked element sits under the cursor */
  onUnlock: (() => void) | null;
}

interface ContextMenuProps {
  request: ContextMenuRequest;
  onClose: () => void;
  onExport: () => void;
  onPresent: () => void;
  onServices: () => void;
}

type Item =
  | { kind: "separator" }
  | {
      kind: "item";
      label: string;
      shortcut?: string;
      danger?: boolean;
      run: () => void;
    };

const GAP = 6;

/**
 * The right-click / long-press menu.
 *
 * Contents depend on what's under the cursor: actions for the selection when
 * there is one, canvas-wide actions when there isn't. Every entry maps to
 * something already reachable by keyboard or panel — this is a shortcut to
 * them, not a second implementation.
 */
export const ContextMenu = ({
  request,
  onClose,
  onExport,
  onPresent,
  onServices,
}: ContextMenuProps) => {
  const scene = useScene();
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: request.x, y: request.y });

  const selected = scene.getSelected();
  const { gridSize, snapToObjects } = scene.appState;

  // Flip the menu back inside the viewport when it would hang off an edge.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    setPosition({
      x: Math.max(GAP, Math.min(request.x, window.innerWidth - width - GAP)),
      y: Math.max(GAP, Math.min(request.y, window.innerHeight - height - GAP)),
    });
  }, [request.x, request.y]);

  useEffect(() => {
    const onDown = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    // capture, so Escape closes the menu before the canvas clears the selection
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("wheel", onClose, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("wheel", onClose);
    };
  }, [onClose]);

  const run = (action: () => void) => () => {
    onClose();
    action();
  };

  const hasSelection = selected.length > 0;
  const grouped = selected.some((el) => el.groupIds.length > 0);
  const allLocked = hasSelection && selected.every((el) => el.locked);

  const items: Item[] = hasSelection
    ? [
        { kind: "item", label: "Duplicate", shortcut: sc("duplicate"), run: run(() => duplicateSelection()) },
        ...(request.onEditLabel
          ? [
              {
                kind: "item" as const,
                label: "Edit label",
                shortcut: "Double-click",
                run: run(request.onEditLabel),
              },
            ]
          : []),
        { kind: "separator" },
        { kind: "item", label: "Bring to front", shortcut: sc("bringToFront"), run: run(() => changeZOrder("front")) },
        { kind: "item", label: "Send to back", shortcut: sc("sendToBack"), run: run(() => changeZOrder("back")) },
        { kind: "separator" },
        ...(selected.length > 1
          ? [
              {
                kind: "item" as const,
                label: "Group",
                shortcut: sc("group"),
                run: run(groupSelection),
              },
            ]
          : []),
        ...(grouped
          ? [
              {
                kind: "item" as const,
                label: "Ungroup",
                shortcut: sc("ungroup"),
                run: run(ungroupSelection),
              },
            ]
          : []),
        {
          kind: "item",
          label: allLocked ? "Unlock" : "Lock",
          shortcut: sc("lock"),
          run: run(toggleLockSelection),
        },
        { kind: "separator" },
        { kind: "item", label: "Export…", shortcut: sc("export"), run: run(onExport) },
        { kind: "separator" },
        {
          kind: "item",
          label: "Delete",
          shortcut: "Delete",
          danger: true,
          run: run(deleteSelection),
        },
      ]
    : [
        // a locked element can't be selected, so this is the only route back
        ...(request.onUnlock
          ? [
              {
                kind: "item" as const,
                label: "Unlock this",
                shortcut: sc("lock"),
                run: run(request.onUnlock),
              },
              { kind: "separator" as const },
            ]
          : []),
        { kind: "item", label: "Add a service…", shortcut: sc("services"), run: run(onServices) },
        { kind: "separator" },
        { kind: "item", label: "Select all", shortcut: sc("selectAll"), run: run(selectAll) },
        { kind: "item", label: "Tidy up layout", shortcut: sc("tidyUp"), run: run(() => tidyUp()) },
        { kind: "separator" },
        { kind: "item", label: "Zoom to fit", shortcut: sc("zoomToFit"), run: run(() => zoomToFit("all")) },
        { kind: "item", label: "Reset zoom to 100%", shortcut: sc("zoomReset"), run: run(() => setZoom(1)) },
        { kind: "separator" },
        {
          kind: "item",
          label: gridSize === null ? "Show grid" : "Hide grid",
          run: run(() => store.setAppState({ gridSize: gridSize === null ? 20 : null })),
        },
        {
          kind: "item",
          label: snapToObjects ? "Turn off object snapping" : "Snap to objects",
          run: run(() => store.setAppState({ snapToObjects: !snapToObjects })),
        },
        { kind: "separator" },
        { kind: "item", label: "Present frames", shortcut: sc("present"), run: run(onPresent) },
        { kind: "item", label: "Export…", shortcut: sc("export"), run: run(onExport) },
      ];

  return (
    <div
      ref={ref}
      className="context-menu"
      role="menu"
      style={{ left: position.x, top: position.y }}
      // the canvas must not treat clicks in here as canvas clicks
      onPointerDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
    >
      {items.map((item, index) =>
        item.kind === "separator" ? (
          <span className="context-separator" key={`sep-${index}`} />
        ) : (
          <button
            key={item.label}
            className={`context-item ${item.danger ? "danger" : ""}`}
            role="menuitem"
            onClick={item.run}
          >
            <span>{item.label}</span>
            {item.shortcut && <kbd>{item.shortcut}</kbd>}
          </button>
        ),
      )}
    </div>
  );
};
