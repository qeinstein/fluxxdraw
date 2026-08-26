import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { store, useScene } from "../store";
import { collab, type PeerPresence } from "../io/collaboration";
import {
  HANDLE_SIZE,
  HIT_THRESHOLD,
  LASER_FADE_MS,
  MAX_ZOOM,
  MIN_ZOOM,
  PALETTE,
  STICKY_COLOR_INDEX,
  STICKY_SIZE,
} from "../constants";
import {
  getCommonBounds,
  getElementBounds,
  getRotatedBounds,
  type Bounds,
} from "../geometry";
import { drawGrid, renderElements } from "../render/renderScene";
import { getElementAtPosition, hitTestElement } from "../elements/hitTest";
import {
  newEmbedElement,
  newFrameElement,
  newFreedrawElement,
  newGenericElement,
  newLinearElement,
  newTextElement,
} from "../elements/factory";
import { nanoid } from "nanoid";
import {
  CURSOR_FOR_HANDLE,
  computeRotation,
  getHandleAtPosition,
  getTransformHandles,
  resizeElements,
  type HandleName,
} from "../interaction/transform";
import { computeSnap, snapToGrid, type SnapGuide } from "../interaction/snapping";
import { drawLaserTrail, type LaserPoint } from "../render/laser";
import {
  defaultBinding,
  getBindableElementAt,
} from "../elements/binding";
import { rerouteArrow } from "../elements/arrowRouting";
import {
  duplicateSelection,
  expandSelectionToGroups,
  isContainer,
  moveElementsBy,
  reconcileFrameMembership,
  refreshBindings,
  refreshTextLayout,
  resolveSelectionTarget,
} from "../actions";
import type {
  EmbedElement,
  ExcaliElement,
  FreedrawElement,
  LinearElement,
  TextElement,
  Tool,
} from "../types";
import { promptForInput } from "../prompt";
import { followLink } from "../follow-link";
import {
  getArrowHandles,
  getHitSegmentIndex,
  hitTestArrowHandle,
  addControlPoint,
  deleteControlPoint,
} from "../elements/arrowEditor";
import { hitLinkBadge } from "../links";
import type { ContextMenuRequest } from "./ContextMenu";

type Mode =
  | "none"
  | "panning"
  | "drawing"
  | "drawing-linear"
  | "dragging"
  | "resizing"
  | "rotating"
  | "marquee"
  | "point-dragging"
  | "erasing"
  | "lasering";

interface PointerState {
  mode: Mode;
  /** scene coords where the gesture started */
  originX: number;
  originY: number;
  lastX: number;
  lastY: number;
  /** element being created or point-edited */
  activeId: string | null;
  handle: HandleName | null;
  lastCursorTime: number;
  /** clones captured at gesture start, used as the resize/rotate baseline */
  snapshot: ExcaliElement[];
  snapshotBounds: Bounds | null;
  pointIndex: number;
  marquee: Bounds | null;
  hasMoved: boolean;
  /** true while a multi-point line is being placed click-by-click */
  placingPoints: boolean;
  lastMoveX?: number;
  lastMoveY?: number;
}

const freshPointerState = (): PointerState => ({
  mode: "none",
  originX: 0,
  originY: 0,
  lastX: 0,
  lastY: 0,
  activeId: null,
  handle: null,
  lastCursorTime: 0,
  snapshot: [],
  snapshotBounds: null,
  pointIndex: -1,
  marquee: null,
  hasMoved: false,
  placingPoints: false,
  lastMoveX: 0,
  lastMoveY: 0,
});

const DRAWING_TOOLS: Tool[] = [
  "rectangle",
  "diamond",
  "ellipse",
  "arrow",
  "line",
  "freedraw",
  "frame",
];

interface PinchGesture {
  /** spread between the two pointers when the gesture began */
  distance: number;
  clientX: number;
  clientY: number;
  zoom: number;
  scrollX: number;
  scrollY: number;
}


interface CanvasProps {
  onDoubleClickText: (elementId: string) => void;
  onContextMenu: (request: ContextMenuRequest) => void;
  onLinkProblem: (message: string) => void;
  onRequestImage: () => void;
}

export const Canvas = ({
  onDoubleClickText,
  onRequestImage,
  onContextMenu,
  onLinkProblem,
}: CanvasProps) => {
  // subscribing keeps the component in sync with store-driven UI state
  const scene = useScene();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<PointerState>(freshPointerState());
  const pendingLibraryItemsRef = useRef<any[] | null>(null);
  /** every pointer currently down, so two-finger gestures can be detected */
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const gestureRef = useRef<PinchGesture | null>(null);
  /**
   * The element whose link badge should show right now because the pointer is
   * over it, Excalidraw-style — a badge on every linked element at once would
   * be clutter on a diagram with more than a couple of links. Read every frame
   * by the RAF loop below rather than through React state, the same pattern
   * `updateCursor` already uses for hover-driven visuals.
   */
  const hoveredLinkIdRef = useRef<string | null>(null);
  const hoveredElementIdRef = useRef<string | null>(null);
  /** pending long-press timer, the touch equivalent of a right-click */
  const longPressRef = useRef<number | null>(null);
  const guidesRef = useRef<SnapGuide[]>([]);
  const laserRef = useRef<LaserPoint[]>([]);
  const spaceHeldRef = useRef(false);
  const frameRef = useRef<number>(0);
  const sizeRef = useRef({ width: 0, height: 0 });

  // --- coordinate helpers --------------------------------------------------

  const toScene = useCallback((clientX: number, clientY: number): [number, number] => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const { scrollX, scrollY, zoom } = store.appState;
    return [
      (clientX - rect.left) / zoom - scrollX,
      (clientY - rect.top) / zoom - scrollY,
    ];
  }, []);

  const placeLibraryItems = useCallback((items: any[], sceneX: number, sceneY: number) => {
    if (items.length === 0) return;
    const minX = Math.min(...items.map((el) => el.x ?? 0));
    const minY = Math.min(...items.map((el) => el.y ?? 0));
    const maxX = Math.max(...items.map((el) => (el.x ?? 0) + (el.width ?? 0)));
    const maxY = Math.max(...items.map((el) => (el.y ?? 0) + (el.height ?? 0)));
    const idMap = new Map<string, string>();
    items.forEach((el) => idMap.set(el.id, nanoid()));
    const placed = items.map((el) => ({
      ...el,
      id: idMap.get(el.id)!,
      groupIds: el.groupIds?.map((id: string) => idMap.get(id) ?? id) ?? [],
      boundElements: el.boundElements?.map((bound: { id: string }) => ({
        ...bound,
        id: idMap.get(bound.id) ?? bound.id,
      })) ?? [],
      frameId: el.frameId ? idMap.get(el.frameId) ?? null : null,
      x: (el.x ?? 0) - minX + sceneX - (maxX - minX) / 2,
      y: (el.y ?? 0) - minY + sceneY - (maxY - minY) / 2,
    }));
    store.mutate(() => {
      store.addElements(...placed);
      store.appState = { ...store.appState, selectedIds: placed.map((el) => el.id), tool: "selection" };
    });
  }, []);

  useEffect(() => {
    const queueLibraryPlacement = (event: Event) => {
      pendingLibraryItemsRef.current = (event as CustomEvent<any[]>).detail;
      if (canvasRef.current) canvasRef.current.style.cursor = "copy";
    };
    window.addEventListener("fluxxdraw:place-library", queueLibraryPlacement);
    return () => window.removeEventListener("fluxxdraw:place-library", queueLibraryPlacement);
  }, []);

  // --- rendering -----------------------------------------------------------

  const drawOverlay = useCallback((ctx: CanvasRenderingContext2D, zoom: number) => {
    const state = store.appState;
    const selected = store.getSelected();
    const pointer = pointerRef.current;
    const lineWidth = 1 / zoom;

    const hoveredId = hoveredElementIdRef.current;
    if (hoveredId && !state.selectedIds.includes(hoveredId)) {
      const el = store.getElement(hoveredId);
      if (el && !el.locked) {
        ctx.save();
        ctx.strokeStyle = "rgba(105, 101, 219, 0.4)";
        ctx.lineWidth = lineWidth * 2;
        const b = getRotatedBounds(el);
        ctx.strokeRect(b.x1 - 2, b.y1 - 2, (b.x2 - b.x1) + 4, (b.y2 - b.y1) + 4);
        ctx.restore();
      }
    }

    // marquee
    if (pointer.marquee) {
      const m = pointer.marquee;
      ctx.save();
      ctx.strokeStyle = "#6965db";
      ctx.fillStyle = "rgba(105, 101, 219, 0.08)";
      ctx.lineWidth = lineWidth;
      ctx.fillRect(m.x1, m.y1, m.x2 - m.x1, m.y2 - m.y1);
      ctx.strokeRect(m.x1, m.y1, m.x2 - m.x1, m.y2 - m.y1);
      ctx.restore();
    }

    // snap guides
    if (guidesRef.current.length) {
      ctx.save();
      ctx.strokeStyle = "#ff6b6b";
      ctx.lineWidth = lineWidth;
      ctx.setLineDash([4 / zoom, 4 / zoom]);
      for (const g of guidesRef.current) {
        ctx.beginPath();
        ctx.moveTo(g.x1, g.y1);
        ctx.lineTo(g.x2, g.y2);
        ctx.stroke();
      }
      ctx.restore();
    }

    if (selected.length > 0 && !state.editingTextId) {
      ctx.save();
      ctx.strokeStyle = "#6965db";
      ctx.lineWidth = lineWidth;

      // per-element outlines when several are selected
      if (selected.length > 1) {
        ctx.setLineDash([4 / zoom, 4 / zoom]);
        for (const el of selected) {
          const b = getRotatedBounds(el);
          ctx.strokeRect(b.x1, b.y1, b.x2 - b.x1, b.y2 - b.y1);
        }
        ctx.setLineDash([]);
      }

      const single = selected.length === 1 ? selected[0] : null;
      const bounds = single
        ? getElementBounds(single)
        : getCommonBounds(selected);
      const angle = single?.angle ?? 0;
      const cx = (bounds.x1 + bounds.x2) / 2;
      const cy = (bounds.y1 + bounds.y2) / 2;

      ctx.save();
      if (angle) {
        ctx.translate(cx, cy);
        ctx.rotate(angle);
        ctx.translate(-cx, -cy);
      }
      ctx.strokeRect(bounds.x1, bounds.y1, bounds.x2 - bounds.x1, bounds.y2 - bounds.y1);
      ctx.restore();

      if (!selected.every((el) => el.locked)) {
        const handles = getTransformHandles(bounds, angle, zoom);
        const size = HANDLE_SIZE / zoom;
        ctx.fillStyle = "#ffffff";
        for (const handle of handles) {
          ctx.beginPath();
          if (handle.name === "rotate") {
            ctx.arc(handle.x, handle.y, size / 2, 0, Math.PI * 2);
          } else {
            ctx.rect(handle.x - size / 2, handle.y - size / 2, size, size);
          }
          ctx.fill();
          ctx.stroke();
        }
      }

      // endpoint handles for a single linear element
      if (single && (single.type === "arrow" || single.type === "line")) {
        const isEditing = state.editingArrowId === single.id;
        // If not in editing mode, just draw simple endpoints
        const pts = single.points;
        const size = HANDLE_SIZE / zoom;
        if (!isEditing) {
          ctx.fillStyle = "#ffffff";
          for (const [px, py] of pts) {
            ctx.beginPath();
            ctx.arc(single.x + px, single.y + py, size / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          }
        } else {
          // Editing mode: draw blue/white/ghost handles
          const handles = getArrowHandles(single, zoom);
          for (const handle of handles) {
            ctx.beginPath();
            if (handle.type === "add") {
              // ghost add handle
              ctx.fillStyle = "rgba(105, 101, 219, 0.2)";
              ctx.strokeStyle = "rgba(105, 101, 219, 0.5)";
              const addSize = 6 / zoom;
              ctx.arc(handle.x, handle.y, addSize / 2, 0, Math.PI * 2);
            } else {
              // endpoint (blue) or midpoint (white)
              ctx.fillStyle = handle.type === "endpoint" ? "#6965db" : "#ffffff";
              ctx.strokeStyle = handle.type === "endpoint" ? "#ffffff" : "#6965db";
              ctx.lineWidth = 1.5 / zoom;
              ctx.arc(handle.x, handle.y, size / 2, 0, Math.PI * 2);
            }
            ctx.fill();
            ctx.stroke();
          }
        }
      }
      ctx.restore();
    }

    // laser trail
    const now = performance.now();
    const trail = laserRef.current.filter((p) => now - p.time < LASER_FADE_MS);
    laserRef.current = trail;
    if (trail.length > 1) drawLaserTrail(ctx, trail, zoom, now);

    // multiplayer cursors
    if (collab.state !== "LOCAL") {
      const peers = collab.getPeers();
      for (const [, peer] of peers.entries()) {
        if (peer.cursor) {
          const { x, y } = peer.cursor;
          
          ctx.save();
          ctx.translate(x, y);
          // Scale cursor inversely so it stays the same size regardless of zoom
          ctx.scale(1 / zoom, 1 / zoom);
          
          // Draw cursor pointer (Figma-style arrow)
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(5.6, 15.6);
          ctx.lineTo(8.2, 11.2);
          ctx.lineTo(13.6, 14.8);
          ctx.lineTo(15.4, 12.0);
          ctx.lineTo(10.0, 8.4);
          ctx.lineTo(14.8, 6.2);
          ctx.closePath();
          
          ctx.fillStyle = peer.color || "#000";
          ctx.fill();
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // Draw name tag
          const name = peer.name || "Anonymous";
          const displayName = name.length > 15 ? name.slice(0, 15) + "…" : name;
          
          ctx.font = "bold 11px Inter, system-ui, sans-serif";
          const metrics = ctx.measureText(displayName);
          const width = metrics.width + 12;
          const height = 20;
          
          ctx.fillStyle = peer.color || "#000";
          ctx.fillRect(14, 18, width, height);
          
          ctx.fillStyle = "#fff";
          ctx.fillText(displayName, 20, 32);
          
          ctx.restore();
        }
      }
    }
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height } = sizeRef.current;
    const state = store.appState;
    const dpr = window.devicePixelRatio || 1;

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = state.viewBackgroundColor;
    ctx.fillRect(0, 0, width, height);

    if (state.gridSize) {
      drawGrid(ctx, state.gridSize, width, height, {
        scrollX: state.scrollX,
        scrollY: state.scrollY,
        zoom: state.zoom,
        scale: dpr,
        files: store.files,
        theme: state.theme,
        components: store.components,
      });
    }

    ctx.scale(state.zoom, state.zoom);
    ctx.translate(state.scrollX, state.scrollY);

    // the element being edited as text is drawn by the textarea overlay instead
    const hidden = state.editingTextId;
    const elements = hidden
      ? store.elements.filter((el) => el.id !== hidden)
      : store.elements;

    const linkBadgeIds = new Set(state.selectedIds);
    if (hoveredLinkIdRef.current) linkBadgeIds.add(hoveredLinkIdRef.current);

    renderElements(ctx, elements, {
      scrollX: state.scrollX,
      scrollY: state.scrollY,
      zoom: state.zoom,
      scale: dpr,
      files: store.files,
      theme: state.theme,
      components: store.components,
      linkBadgeIds,
    });

    drawOverlay(ctx, state.zoom);
    ctx.restore();
  }, [drawOverlay]);

  // continuous redraw keeps the laser trail fading and drags smooth
  useEffect(() => {
    const loop = () => {
      draw();
      frameRef.current = requestAnimationFrame(loop);
    };
    frameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameRef.current);
  }, [draw]);

  // --- sizing --------------------------------------------------------------

  useLayoutEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      sizeRef.current = { width: rect.width, height: rect.height };
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      draw();
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    window.addEventListener("resize", resize);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, [draw]);

  // --- multi-touch pinch & pan ---------------------------------------------

  /** Midpoint and spread of the two active pointers, in client space. */
  const readTouchPair = (): { x: number; y: number; distance: number } | null => {
    const points = [...pointersRef.current.values()];
    if (points.length < 2) return null;
    const [a, b] = points;
    return {
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
      distance: Math.max(Math.hypot(a.x - b.x, a.y - b.y), 1),
    };
  };

  /**
   * A second finger turns whatever was happening into a canvas gesture, so
   * back out any element that the first finger had started drawing.
   */
  const abortActiveInteraction = () => {
    const pointer = pointerRef.current;
    let removedDraft = false;
    if (
      (pointer.mode === "drawing" || pointer.mode === "drawing-linear") &&
      pointer.activeId
    ) {
      store.deleteElements([pointer.activeId]);
      removedDraft = true;
      // A cancelled draw must not leave its beginHistory() baseline active.
      store.cancelHistory();
    } else if (pointer.mode !== "none") {
      // Preserve a completed move/erase if the browser takes focus mid-gesture.
      store.commit();
    }
    pointerRef.current = freshPointerState();
    guidesRef.current = [];
    if (removedDraft) store.emit();
  };

  const cancelLongPress = () => {
    if (longPressRef.current === null) return;
    window.clearTimeout(longPressRef.current);
    longPressRef.current = null;
  };

  /** Releases stale captures after a tool switch or when the browser loses focus. */
  const clearTransientInput = () => {
    cancelLongPress();
    const canvas = canvasRef.current;
    if (canvas) {
      for (const pointerId of pointersRef.current.keys()) {
        try {
          if (canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
        } catch {
          // A browser can cancel a pointer before React receives pointercancel.
        }
      }
      canvas.style.cursor = "default";
    }
    pointersRef.current.clear();
    gestureRef.current = null;
    pointerRef.current = freshPointerState();
    guidesRef.current = [];
    hoveredLinkIdRef.current = null;
  };

  // Changing tools must always start a new interaction cleanly. In particular,
  // this recovers from a missed pointercancel instead of requiring a refresh.
  useLayoutEffect(() => {
    abortActiveInteraction();
    clearTransientInput();
  }, [scene.appState.tool]);

  useEffect(() => {
    const recover = () => {
      abortActiveInteraction();
      clearTransientInput();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") recover();
    };
    window.addEventListener("blur", recover);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("blur", recover);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  const beginPinch = () => {
    const pair = readTouchPair();
    if (!pair) return;
    abortActiveInteraction();
    const state = store.appState;
    gestureRef.current = {
      distance: pair.distance,
      clientX: pair.x,
      clientY: pair.y,
      zoom: state.zoom,
      scrollX: state.scrollX,
      scrollY: state.scrollY,
    };
  };

  /** Zooms around the pinch centre while panning with it. */
  const applyPinch = () => {
    const gesture = gestureRef.current;
    const pair = readTouchPair();
    if (!gesture || !pair) return;

    const rect = canvasRef.current!.getBoundingClientRect();
    const zoom = Math.min(
      MAX_ZOOM,
      Math.max(MIN_ZOOM, (gesture.zoom * pair.distance) / gesture.distance),
    );

    // keep the scene point under the original pinch centre pinned there
    const anchorX = gesture.clientX - rect.left;
    const anchorY = gesture.clientY - rect.top;
    const sceneX = anchorX / gesture.zoom - gesture.scrollX;
    const sceneY = anchorY / gesture.zoom - gesture.scrollY;

    const currentX = pair.x - rect.left;
    const currentY = pair.y - rect.top;

    store.setAppState({
      zoom,
      scrollX: currentX / zoom - sceneX,
      scrollY: currentY / zoom - sceneY,
    });
  };

  // --- gesture start -------------------------------------------------------

  const startDrawing = (tool: Tool, x: number, y: number) => {
    const state = store.appState;
    const gx = snapToGrid(x, state.gridSize);
    const gy = snapToGrid(y, state.gridSize);
    const pointer = pointerRef.current;
    store.beginHistory();

    if (tool === "freedraw") {
      const el = newFreedrawElement(state, x, y);
      store.addElements(el);
      pointer.mode = "drawing";
      pointer.activeId = el.id;
      return;
    }
    if (tool === "arrow" || tool === "line") {
      const el = newLinearElement(tool, state, gx, gy);
      const bindTarget =
        tool === "arrow" ? getBindableElementAt(store.visibleElements, x, y) : null;
      if (bindTarget) el.startBinding = defaultBinding(bindTarget.id, bindTarget, [x, y]);
      el.points = [
        [0, 0],
        [0, 0],
      ];
      store.addElements(el);
      pointer.mode = "drawing-linear";
      pointer.activeId = el.id;
      return;
    }
    if (tool === "frame") {
      const el = newFrameElement(state, gx, gy);
      store.addElements(el);
      pointer.mode = "drawing";
      pointer.activeId = el.id;
      return;
    }
    const el = newGenericElement(tool as "rectangle" | "diamond" | "ellipse", state, gx, gy);
    store.addElements(el);
    pointer.mode = "drawing";
    pointer.activeId = el.id;
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.button === 2) return; // context menu handled separately
    if (store.appState.viewMode) {
      event.preventDefault();
      return;
    }
    if (pendingLibraryItemsRef.current) {
      event.preventDefault();
      const items = pendingLibraryItemsRef.current;
      pendingLibraryItemsRef.current = null;
      const [sceneX, sceneY] = toScene(event.clientX, event.clientY);
      placeLibraryItems(items, sceneX, sceneY);
      canvasRef.current!.style.cursor = "default";
      return;
    }
    const canvas = canvasRef.current!;
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      // A browser can cancel a touch between pointerdown and capture.
    }

    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointersRef.current.size >= 2) {
      cancelLongPress();
      beginPinch();
      return;
    }

    /*
     * Touch has no right-click, so holding still for a moment opens the menu —
     * but only while selecting. With a drawing tool a long press is the start
     * of a slow, deliberate stroke, and treating it as a menu request threw the
     * stroke away: you'd press, hesitate, and get a menu instead of a line.
     */
    const activeTool = store.appState.tool;
    if (event.pointerType === "touch" && (activeTool === "selection" || activeTool === "hand")) {
      const { clientX, clientY } = event;
      longPressRef.current = window.setTimeout(() => {
        longPressRef.current = null;
        abortActiveInteraction();
        openContextMenu(clientX, clientY);
      }, 500);
    }

    const [x, y] = toScene(event.clientX, event.clientY);
    const pointer = pointerRef.current;
    const state = store.appState;

    if (state.editingTextId) {
      const textId = state.editingTextId;
      store.setAppState({ editingTextId: null });
      const el = store.getElement(textId) as TextElement | null;
      if (el && el.text.trim() === "") {
        store.deleteElements([textId]);
        if (el.containerId) {
          store.updateElement(el.containerId, () => ({ boundText: null }));
        }
      }
    }

    pointer.originX = x;
    pointer.originY = y;
    pointer.lastX = x;
    pointer.lastY = y;
    pointer.hasMoved = false;
    pointer.marquee = null;

    // finish a multi-point line that's mid-placement
    if (pointer.placingPoints && pointer.activeId) {
      const el = store.getElement(pointer.activeId) as LinearElement | null;
      if (el) {
        const last = el.points[el.points.length - 1];
        const prev = el.points[el.points.length - 2];
        // clicking the same spot twice ends the line
        if (prev && Math.hypot(last[0] - prev[0], last[1] - prev[1]) < 4) {
          finishLinearPlacement();
          return;
        }
        store.updateElement<LinearElement>(el.id, (cur) => ({
          points: [...cur.points, [x - cur.x, y - cur.y]],
        }));
        store.emit();
      }
      return;
    }

    const panning =
      event.button === 1 || spaceHeldRef.current || state.tool === "hand";
    if (panning) {
      pointer.mode = "panning";
      return;
    }

    if (state.tool === "laser") {
      pointer.mode = "lasering";
      laserRef.current.push({ x, y, time: performance.now() });
      return;
    }

    if (state.tool === "eraser") {
      pointer.mode = "erasing";
      store.beginHistory();
      eraseAt(x, y);
      return;
    }

    if (state.tool === "image") {
      onRequestImage();
      return;
    }

    if (state.tool === "sticky") {
      /*
       * One click drops a note and puts the caret in it — the point of a sticky
       * is to type, not to size a box first. It's an ordinary filled rectangle
       * with a centred label, so everything else about it already works.
       */
      event.preventDefault();
      store.beginHistory();
      const sticky = newGenericElement("sticky", state, x - STICKY_SIZE / 2, y - STICKY_SIZE / 2);
      sticky.width = STICKY_SIZE;
      sticky.height = STICKY_SIZE;
      sticky.backgroundColor = PALETTE[state.theme].background[STICKY_COLOR_INDEX];
      sticky.strokeColor = "transparent";
      sticky.fillStyle = "solid";
      sticky.edges = "round";
      store.addElements(sticky);
      store.setAppState({ selectedIds: [sticky.id], tool: "selection" });
      const label = ensureBoundText(sticky.id);
      store.updateElement<TextElement>(label, () => ({
        textAlign: "center",
        verticalAlign: "middle",
      }));
      onDoubleClickText(label);
      return;
    }

    if (state.tool === "text") {
      // keep the browser from moving focus to the canvas as we open the editor
      event.preventDefault();
      store.beginHistory();
      const target = getElementAtPosition(store.visibleElements, x, y) ?? getContainerAt(x, y);
      if (target && isContainer(target)) {
        onDoubleClickText(ensureBoundText(target.id));
      } else {
        const el = newTextElement(state, x, y);
        store.addElements(el);
        store.setAppState({ selectedIds: [el.id], tool: "selection" });
        onDoubleClickText(el.id);
      }
      return;
    }

    if (state.tool === "embed") {
      promptForInput({
        title: "Embed a link",
        label: "URL",
        placeholder: "https://example.com",
        confirmLabel: "Add link",
        hint: "The link appears as a card you can click to open.",
        validate: (value) => (normaliseUrl(value) ? null : "That doesn't look like a URL."),
      }).then((value) => {
        const url = value && normaliseUrl(value);
        if (!url) {
          store.setAppState({ tool: "selection" });
          return;
        }
        store.mutate(() => {
          const el = newEmbedElement(store.appState, x, y, url);
          el.width = 420;
          el.height = 180;
          store.addElements(el);
          store.appState = { ...store.appState, selectedIds: [el.id], tool: "selection" };
        });
      });
      return;
    }

    if (DRAWING_TOOLS.includes(state.tool)) {
      startDrawing(state.tool, x, y);
      return;
    }

    // --- selection tool ---

    /*
     * The link badge is tested first, and only among elements it's currently
     * shown for — selected or hovered, the same set the renderer just drew it
     * for. It sits just above the top-right corner, next door to the resize
     * handle, and a handle that swallowed the click would leave the badge
     * decorative.
     */
    const visibleLinkIds = new Set(state.selectedIds);
    if (hoveredLinkIdRef.current) visibleLinkIds.add(hoveredLinkIdRef.current);
    const badge = hitLinkBadge(x, y, state.zoom, visibleLinkIds);
    if (badge) {
      const problem = followLink(badge.link!);
      if (problem) onLinkProblem(problem);
      return;
    }

    const selected = store.getSelected();

    if (selected.length > 0 && !selected.every((el) => el.locked)) {
      const single = selected.length === 1 ? selected[0] : null;
      const bounds = single ? getElementBounds(single) : getCommonBounds(selected);
      const angle = single?.angle ?? 0;
      const handles = getTransformHandles(bounds, angle, state.zoom);
      const handle = getHandleAtPosition(handles, x, y, state.zoom);

      if (handle) {
        store.beginHistory();
        pointer.snapshot = selected.map((el) => structuredClone(el));
        pointer.snapshotBounds = bounds;
        pointer.handle = handle;
        pointer.mode = handle === "rotate" ? "rotating" : "resizing";
        return;
      }

      // dragging an individual point of a single linear element
      if (single && (single.type === "arrow" || single.type === "line")) {
        const isEditing = state.editingArrowId === single.id;
        if (!isEditing) {
          // just test endpoints
          const radius = (HANDLE_SIZE + 4) / state.zoom;
          const index = single.points.findIndex(
            ([px, py]) => Math.hypot(single.x + px - x, single.y + py - y) <= radius,
          );
          if (index !== -1) {
            store.beginHistory();
            pointer.mode = "point-dragging";
            pointer.activeId = single.id;
            pointer.pointIndex = index;
            return;
          }
        } else {
          // testing the complex handles
          const handles = getArrowHandles(single, state.zoom);
          const handleHit = hitTestArrowHandle(handles, x, y, state.zoom);
          if (handleHit) {
            store.beginHistory();
            pointer.mode = "point-dragging";
            pointer.activeId = single.id;
            
            if (handleHit.type === "add") {
              // Add a new point right now, and start dragging the newly created point
              store.updateElement<LinearElement>(single.id, (arrow) => ({
                points: addControlPoint(arrow, handleHit.index, x, y),
                // if it was an auto-routed curve/elbow, breaking it manually makes it straight
                pathType: arrow.pathType !== "straight" ? "straight" : arrow.pathType,
              }));
              pointer.pointIndex = handleHit.index + 1;
            } else {
              pointer.pointIndex = handleHit.index;
              store.setAppState({ editingPointIndex: handleHit.index });
            }
            return;
          }
        }
      }
    }

    const rawHit = getElementAtPosition(store.visibleElements, x, y, HIT_THRESHOLD / state.zoom);
    const hit = rawHit ? resolveSelectionTarget(rawHit) : null;

    if (hit?.type === "embed" && state.selectedIds.includes(hit.id)) {
      // second click on a selected card follows the link
      openEmbed(hit as EmbedElement);
      return;
    }

    if (hit) {
      const alreadySelected = state.selectedIds.includes(hit.id);
      let nextIds: string[];
      if (event.shiftKey) {
        nextIds = alreadySelected
          ? state.selectedIds.filter((id) => id !== hit.id)
          : expandSelectionToGroups([...state.selectedIds, hit.id]);
      } else if (alreadySelected) {
        nextIds = state.selectedIds;
      } else {
        nextIds = expandSelectionToGroups([hit.id]);
      }
      store.setAppState({ selectedIds: nextIds });

      if (!hit.locked && nextIds.length > 0) {
        store.beginHistory();
        // alt-drag duplicates, matching the usual whiteboard convention
        if (event.altKey) duplicateSelection(0, 0);
        pointer.mode = "dragging";
        pointer.snapshot = store.getSelected().map((el) => structuredClone(el));
      }
      return;
    }

    if (!event.shiftKey) store.setAppState({ selectedIds: [] });
    pointer.mode = "marquee";
    pointer.marquee = { x1: x, y1: y, x2: x, y2: y };
  };

  // --- gesture move --------------------------------------------------------

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (pointersRef.current.has(event.pointerId)) {
      pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }
    if (gestureRef.current) {
      applyPinch();
      return;
    }

    const pointer = pointerRef.current;
    const state = store.appState;
    const [x, y] = toScene(event.clientX, event.clientY);

    // Throttle cursor broadcast slightly to avoid flooding awareness
    if (performance.now() - (pointerRef.current as any).lastCursorTime > 50) {
      collab.updatePresence({ cursor: { x, y } });
      (pointerRef.current as any).lastCursorTime = performance.now();
    }

    if (pointer.mode === "none" && !pointer.placingPoints) {
      updateCursor(x, y);
      return;
    }

    const dx = x - pointer.originX;
    const dy = y - pointer.originY;
    if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) pointer.hasMoved = true;
    // a finger that has travelled is drawing or panning, not long-pressing
    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) cancelLongPress();

    switch (pointer.mode) {
      case "panning": {
        store.setAppState({
          scrollX: state.scrollX + (x - pointer.lastX),
          scrollY: state.scrollY + (y - pointer.lastY),
        });
        // scroll changed, so recompute where the pointer now sits
        const [nx, ny] = toScene(event.clientX, event.clientY);
        pointer.lastX = nx;
        pointer.lastY = ny;
        return;
      }

      case "lasering":
        laserRef.current.push({ x, y, time: performance.now() });
        return;

      case "erasing":
        eraseAt(x, y);
        return;

      case "drawing": {
        const el = store.getElement(pointer.activeId!);
        if (!el) return;
        if (el.type === "freedraw") {
          const fx = x - el.x;
          const fy = y - el.y;
          const lastPoint = (el as FreedrawElement).points[(el as FreedrawElement).points.length - 1];
          if (!lastPoint || Math.hypot(fx - lastPoint[0], fy - lastPoint[1]) >= 2) {
            store.updateElement<FreedrawElement>(el.id, (cur) => ({
              points: [...cur.points, [fx, fy]],
              pressures: [...cur.pressures, event.pressure || 0.5],
            }));
          }
        } else {
          let width = x - pointer.originX;
          let height = y - pointer.originY;
          if (event.shiftKey) {
            // square/circle constraint
            const size = Math.max(Math.abs(width), Math.abs(height));
            width = Math.sign(width) * size;
            height = Math.sign(height) * size;
          }
          const gx = snapToGrid(pointer.originX + width, state.gridSize);
          const gy = snapToGrid(pointer.originY + height, state.gridSize);
          store.updateElement(el.id, (cur) => ({
            width: gx - cur.x,
            height: gy - cur.y,
          }));
        }
        store.emit();
        return;
      }

      case "drawing-linear": {
        const el = store.getElement(pointer.activeId!) as LinearElement | null;
        if (!el) return;
        let px = x - el.x;
        let py = y - el.y;
        if (event.shiftKey) {
          // snap the segment to 15° increments
          const angle = Math.atan2(py, px);
          const step = Math.PI / 12;
          const snapped = Math.round(angle / step) * step;
          const len = Math.hypot(px, py);
          px = Math.cos(snapped) * len;
          py = Math.sin(snapped) * len;
        }
        store.updateElement<LinearElement>(el.id, (cur) => {
          let points = [...cur.points];
          points[points.length - 1] = [px, py];

          if (cur.pathType === "elbow" || cur.pathType === "curved") {
            const byId = new Map(store.elements.map((e) => [e.id, e]));
            const routed = rerouteArrow({ ...cur, points }, byId);
            if (routed) points = routed;
          }

          return { points };
        });
        store.emit();
        return;
      }

      case "point-dragging": {
        const el = store.getElement(pointer.activeId!) as LinearElement | null;
        if (!el) return;
        store.updateElement<LinearElement>(el.id, (cur) => {
          let points = cur.points.map((p) => [...p] as [number, number]);
          let px = x - cur.x;
          let py = y - cur.y;

          if (event.shiftKey) {
            // snap relative to adjacent point
            const adjacentIndex = pointer.pointIndex > 0 ? pointer.pointIndex - 1 : pointer.pointIndex + 1;
            if (adjacentIndex >= 0 && adjacentIndex < points.length) {
              const [ax, ay] = points[adjacentIndex];
              const dx = px - ax;
              const dy = py - ay;
              const angle = Math.atan2(dy, dx);
              const step = Math.PI / 12; // 15 degrees
              const snapped = Math.round(angle / step) * step;
              const len = Math.hypot(dx, dy);
              px = ax + Math.cos(snapped) * len;
              py = ay + Math.sin(snapped) * len;
            }
          }

          points[pointer.pointIndex] = [px, py];

          if (cur.pathType === "elbow" || cur.pathType === "curved") {
            const byId = new Map(store.elements.map((e) => [e.id, e]));
            const routed = rerouteArrow({ ...cur, points }, byId);
            if (routed) {
              points = routed;
              if (pointer.pointIndex === cur.points.length - 1) {
                pointer.pointIndex = points.length - 1;
              }
            }
          }

          return { points };
        });
        store.emit();
        return;
      }

      case "dragging": {
        let moveX = dx;
        let moveY = dy;
        guidesRef.current = [];

        const ids = pointer.snapshot.map((el) => el.id);

        if (state.gridSize) {
          moveX = snapToGrid(pointer.snapshot[0].x + moveX, state.gridSize) - pointer.snapshot[0].x;
          moveY = snapToGrid(pointer.snapshot[0].y + moveY, state.gridSize) - pointer.snapshot[0].y;
        } else if (state.snapToObjects && !event.metaKey && !event.ctrlKey) {
          const movingBounds = getCommonBounds(pointer.snapshot);
          const shifted: Bounds = {
            x1: movingBounds.x1 + moveX,
            y1: movingBounds.y1 + moveY,
            x2: movingBounds.x2 + moveX,
            y2: movingBounds.y2 + moveY,
          };
          const idSet = new Set(ids);
          const others = store.visibleElements.filter(
            (el) => !idSet.has(el.id) && el.type !== "frame",
          );
          const snap = computeSnap(shifted, others, state.zoom);
          moveX += snap.dx;
          moveY += snap.dy;
          guidesRef.current = snap.guides;
        }

        const incrementalDx = moveX - (pointer.lastMoveX ?? 0);
        const incrementalDy = moveY - (pointer.lastMoveY ?? 0);
        pointer.lastMoveX = moveX;
        pointer.lastMoveY = moveY;

        moveElementsBy(ids, incrementalDx, incrementalDy);
        store.emit();
        return;
      }

      case "resizing": {
        const results = resizeElements(
          pointer.snapshot,
          pointer.handle!,
          x,
          y,
          event.shiftKey,
        );
        for (const { id, patch } of results) {
          // the patch is built per element type, so the union widens here
          store.updateElement(id, () => patch as never);
        }
        const textIds = results
          .map((r) => r.id)
          .filter((id) => store.getElement(id)?.type === "text");
        // containers changed size, so labels need to re-wrap
        const containerLabelIds = results
          .map((r) => store.getElement(r.id))
          .filter((el): el is ExcaliElement => !!el && "boundText" in el && !!el.boundText)
          .map((el) => (el as { boundText: string }).boundText);
        refreshTextLayout([...textIds, ...containerLabelIds]);
        refreshBindings(results.map((r) => r.id));
        store.emit();
        return;
      }

      case "rotating": {
        const bounds = pointer.snapshotBounds!;
        const angle = computeRotation(bounds, x, y, event.shiftKey);
        store.updateElements(
          pointer.snapshot.map((el) => el.id),
          () => ({ angle }),
        );
        store.emit();
        return;
      }

      case "marquee": {
        pointer.marquee = {
          x1: Math.min(pointer.originX, x),
          y1: Math.min(pointer.originY, y),
          x2: Math.max(pointer.originX, x),
          y2: Math.max(pointer.originY, y),
        };
        const box = pointer.marquee;
        const hits = store.visibleElements.filter((el) => {
          if (el.locked) return false;
          if (el.type === "text" && el.containerId) return false;
          const b = getRotatedBounds(el);
          return b.x1 >= box.x1 && b.y1 >= box.y1 && b.x2 <= box.x2 && b.y2 <= box.y2;
        });
        store.setAppState({ selectedIds: expandSelectionToGroups(hits.map((el) => el.id)) });
        return;
      }
    }
  };

  // --- gesture end ---------------------------------------------------------

  const finishLinearPlacement = () => {
    const pointer = pointerRef.current;
    const el = store.getElement(pointer.activeId!) as LinearElement | null;
    pointer.placingPoints = false;
    if (el) {
      // drop the trailing preview point
      if (el.points.length > 2) {
        store.updateElement<LinearElement>(el.id, (cur) => ({
          points: cur.points.slice(0, -1),
        }));
      }
      normalizeLinear(el.id);
      store.setAppState({ selectedIds: [el.id] });
    }
    store.commit();
    resetTool();
    pointer.activeId = null;
    store.emit();
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    cancelLongPress();
    pointersRef.current.delete(event.pointerId);
    if (gestureRef.current) {
      // lifting one finger of a pinch ends the gesture rather than resuming a draw
      if (pointersRef.current.size < 2) gestureRef.current = null;
      else beginPinch();
      return;
    }

    const pointer = pointerRef.current;
    const [x, y] = toScene(event.clientX, event.clientY);
    const mode = pointer.mode;

    guidesRef.current = [];

    switch (mode) {
      case "drawing": {
        const el = store.getElement(pointer.activeId!);
        if (el) {
          if (el.type === "freedraw") {
            normalizeFreedraw(el.id);
          } else if (Math.abs(el.width) < 4 && Math.abs(el.height) < 4) {
            // a click without a drag creates a default-sized shape
            store.updateElement(el.id, () => ({ width: 120, height: 80 }));
          }
          store.setAppState({ selectedIds: [el.id] });
          if (el.type === "frame") reconcileFrameMembership();
        }
        store.commit();
        resetTool();
        break;
      }

      case "drawing-linear": {
        const el = store.getElement(pointer.activeId!) as LinearElement | null;
        if (el) {
          const [lx, ly] = el.points[el.points.length - 1];
          if (Math.hypot(lx, ly) < 4) {
            // click without drag => start multi-point placement
            pointer.placingPoints = true;
            store.updateElement<LinearElement>(el.id, (cur) => ({
              points: [...cur.points, [lx, ly]],
            }));
            store.emit();
            return;
          }
          if (el.type === "arrow") bindArrowEnd(el.id, x, y);
          normalizeLinear(el.id);
          store.setAppState({ selectedIds: [el.id] });
        }
        store.commit();
        resetTool();
        break;
      }

      case "point-dragging": {
        const el = store.getElement(pointer.activeId!) as LinearElement | null;
        if (el && el.type === "arrow") {
          const isEnd = pointer.pointIndex === el.points.length - 1;
          const isStart = pointer.pointIndex === 0;
          if (isEnd) bindArrowEnd(el.id, x, y);
          else if (isStart) bindArrowStart(el.id, x, y);
        }
        store.commit();
        break;
      }

      case "dragging":
        reconcileFrameMembership();
        store.commit();
        break;

      case "resizing":
      case "rotating":
        refreshBindings(pointer.snapshot.map((el) => el.id));
        reconcileFrameMembership();
        store.commit();
        break;

      case "erasing":
        store.commit();
        break;
    }

    const keepActive = pointer.placingPoints;
    const activeId = pointer.activeId;
    pointerRef.current = freshPointerState();
    if (keepActive) {
      pointerRef.current.placingPoints = true;
      pointerRef.current.activeId = activeId;
    }
    store.emit();
  };

  // --- helpers -------------------------------------------------------------

  const resetTool = () => {
    if (store.appState.tool !== "selection") {
      store.setAppState({ tool: "selection" });
    }
  };

  /** Re-bases a linear element so x/y sit at its first point. */
  const normalizeLinear = (id: string) => {
    const el = store.getElement(id) as LinearElement | null;
    if (!el || el.points.length === 0) return;
    const [ox, oy] = el.points[0];
    const points = el.points.map(([px, py]) => [px - ox, py - oy] as [number, number]);
    const xs = points.map((p) => p[0]);
    const ys = points.map((p) => p[1]);
    store.updateElement<LinearElement>(id, () => ({
      x: el.x + ox,
      y: el.y + oy,
      points,
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys),
    }));
  };

  const normalizeFreedraw = (id: string) => {
    const el = store.getElement(id) as FreedrawElement | null;
    if (!el || el.points.length === 0) return;
    const xs = el.points.map((p) => p[0]);
    const ys = el.points.map((p) => p[1]);
    store.updateElement<FreedrawElement>(id, () => ({
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys),
    }));
  };

  const bindArrowEnd = (arrowId: string, x: number, y: number) => {
    const target = getBindableElementAt(store.visibleElements, x, y, arrowId);
    store.updateElement<LinearElement>(arrowId, () => ({
      endBinding: target ? defaultBinding(target.id, target, [x, y]) : null,
    }));
    refreshBindings([arrowId]);
  };

  const bindArrowStart = (arrowId: string, x: number, y: number) => {
    const target = getBindableElementAt(store.visibleElements, x, y, arrowId);
    store.updateElement<LinearElement>(arrowId, () => ({
      startBinding: target ? defaultBinding(target.id, target, [x, y]) : null,
    }));
    refreshBindings([arrowId]);
  };

  const eraseAt = (x: number, y: number) => {
    const threshold = HIT_THRESHOLD / store.appState.zoom;
    const victims = store.visibleElements.filter(
      (el) => !el.locked && hitTestElement(el, x, y, threshold),
    );
    if (victims.length === 0) return;
    store.deleteElements(victims.map((el) => el.id));
    store.emit();
  };

  /** Returns the id of a container's label, creating one if needed. */
  const ensureBoundText = (containerId: string): string => {
    const container = store.getElement(containerId);
    if (container && "boundText" in container && container.boundText) {
      return container.boundText;
    }
    const b = getElementBounds(container!);
    const text = newTextElement(store.appState, b.x1, b.y1, containerId);
    store.addElements(text);
    store.updateElement(containerId, () => ({ boundText: text.id }));
    return text.id;
  };

  /**
   * Topmost container whose box surrounds the point. Double-clicking anywhere
   * inside a shape should label it, even when the shape has no fill and so
   * wouldn't register as a normal hit.
   */
  const getContainerAt = (x: number, y: number) => {
    for (let i = store.visibleElements.length - 1; i >= 0; i--) {
      const el = store.visibleElements[i];
      if (el.locked || !isContainer(el)) continue;
      const b = getElementBounds(el);
      if (x >= b.x1 && x <= b.x2 && y >= b.y1 && y <= b.y2) return el;
    }
    return null;
  };

  /**
   * Opens the action menu for whatever is under the pointer. Right-click and
   * long-press both land here.
   *
   * Clicking a shape that isn't selected selects it first, the way every other
   * canvas app behaves — acting on an invisible selection is never what the
   * user meant.
   */
  const openContextMenu = (clientX: number, clientY: number) => {
    const [x, y] = toScene(clientX, clientY);
    const hit = getElementAtPosition(store.visibleElements, x, y) ?? getContainerAt(x, y);

    if (hit) {
      const target = resolveSelectionTarget(hit);
      const ids = expandSelectionToGroups([target.id]);
      if (!ids.every((id) => store.appState.selectedIds.includes(id))) {
        store.setAppState({ selectedIds: ids, tool: "selection" });
      }
    } else {
      store.setAppState({ selectedIds: [] });
    }

    /*
     * Locked elements are invisible to hit testing, so without this a locked
     * shape can't be reached at all: it can't be selected, so no panel or
     * shortcut applies to it, and the menu would offer canvas actions over the
     * top of it. Offering "Unlock" here is the way back.
     */
    const lockedUnder = hit
      ? null
      : [...store.visibleElements].reverse().find((el) => {
          if (!el.locked) return false;
          const b = getElementBounds(el);
          return x >= b.x1 && x <= b.x2 && y >= b.y1 && y <= b.y2;
        });

    onContextMenu({
      x: clientX,
      y: clientY,
      onEditLabel:
        hit && isContainer(hit) ? () => onDoubleClickText(ensureBoundText(hit.id)) : null,
      onUnlock: lockedUnder
        ? () => {
            store.mutate(() => {
              store.updateElement(lockedUnder.id, () => ({ locked: false }));
              store.appState = { ...store.appState, selectedIds: [lockedUnder.id] };
            });
          }
        : null,
    });
  };

  const handleDoubleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (store.appState.viewMode) return;
    const [x, y] = toScene(event.clientX, event.clientY);
    const hit = getElementAtPosition(store.visibleElements, x, y) ?? getContainerAt(x, y);

    store.beginHistory();
    if (!hit) {
      const el = newTextElement(store.appState, x, y);
      store.addElements(el);
      store.setAppState({ selectedIds: [el.id] });
      onDoubleClickText(el.id);
      return;
    }
    if (hit.type === "text") {
      onDoubleClickText(hit.id);
      return;
    }
    if (hit.type === "embed") {
      const embed = hit as EmbedElement;
      promptForInput({
        title: "Edit link",
        label: "URL",
        initialValue: embed.url,
        confirmLabel: "Update",
        validate: (value) => (normaliseUrl(value) ? null : "That doesn't look like a URL."),
      }).then((value) => {
        const url = value && normaliseUrl(value);
        if (!url) return;
        store.mutate(() => store.updateElement<EmbedElement>(embed.id, () => ({ url })));
      });
      return;
    }
    if (isContainer(hit) || hit.type === "arrow" || hit.type === "line") {
      if (hit.type === "arrow" || hit.type === "line") {
        const el = hit as LinearElement;
        const isEditing = store.appState.editingArrowId === el.id;
        if (isEditing) {
          const handles = getArrowHandles(el, store.appState.zoom);
          const handle = hitTestArrowHandle(handles, x, y, store.appState.zoom);
          if (handle && handle.type === "midpoint") {
            // Delete control point
            const newPoints = deleteControlPoint(el, handle.index);
            if (newPoints) {
              store.updateElement<LinearElement>(el.id, () => ({ points: newPoints }));
              store.commit();
              store.emit();
            }
            return;
          }
        }

        const hitSegment = getHitSegmentIndex(el, x, y, store.appState.zoom);
        if (hitSegment !== null) {
          const newPoints = addControlPoint(el, hitSegment, x, y);
          store.updateElement<LinearElement>(el.id, () => ({ points: newPoints }));
          store.appState = { ...store.appState, editingArrowId: el.id };
          store.commit();
          store.emit();
          return;
        }
        
        // Otherwise try to edit the bound text (fallback)
        onDoubleClickText(ensureBoundText(hit.id));
        return;
      }
      onDoubleClickText(ensureBoundText(hit.id));
    }
  };

  const updateCursor = (x: number, y: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const state = store.appState;

    if (spaceHeldRef.current || state.tool === "hand") {
      canvas.style.cursor = "grab";
      return;
    }
    if (state.tool === "eraser") {
      canvas.style.cursor = "cell";
      return;
    }
    if (state.tool === "text") {
      canvas.style.cursor = "text";
      return;
    }
    if (state.tool !== "selection") {
      canvas.style.cursor = "crosshair";
      return;
    }

    const selected = store.getSelected();
    if (selected.length > 0) {
      const single = selected.length === 1 ? selected[0] : null;
      const bounds = single ? getElementBounds(single) : getCommonBounds(selected);
      const handles = getTransformHandles(bounds, single?.angle ?? 0, state.zoom);
      const handle = getHandleAtPosition(handles, x, y, state.zoom);
      if (handle) {
        canvas.style.cursor = CURSOR_FOR_HANDLE[handle];
        return;
      }
    }

    // hovering the badge of an already-visible link: a pointer cursor invites the click
    const visibleLinkIds = new Set(state.selectedIds);
    if (hoveredLinkIdRef.current) visibleLinkIds.add(hoveredLinkIdRef.current);
    if (hitLinkBadge(x, y, state.zoom, visibleLinkIds)) {
      canvas.style.cursor = "pointer";
      return;
    }

    const hit = getElementAtPosition(store.visibleElements, x, y, HIT_THRESHOLD / state.zoom);
    // hovering a linked element's body reveals its badge, same discoverability as Excalidraw
    hoveredLinkIdRef.current = hit?.link ? hit.id : null;
    hoveredElementIdRef.current = hit ? hit.id : null;
    canvas.style.cursor = hit ? "move" : "default";
  };

  // --- wheel: zoom & scroll ------------------------------------------------

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const state = store.appState;

      if (event.ctrlKey || event.metaKey) {
        const rect = canvas.getBoundingClientRect();
        const cursorX = event.clientX - rect.left;
        const cursorY = event.clientY - rect.top;
        const sceneX = cursorX / state.zoom - state.scrollX;
        const sceneY = cursorY / state.zoom - state.scrollY;

        // Clamp before scaling: trackpads emit many tiny deltas (fine control)
        // while a mouse wheel emits one big notch, which would otherwise jump
        // several hundred percent in a single tick.
        const step = Math.max(-60, Math.min(60, event.deltaY));
        const factor = Math.exp(-step / 300);
        const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, state.zoom * factor));
        // keep the point under the cursor pinned while zooming
        store.setAppState({
          zoom,
          scrollX: cursorX / zoom - sceneX,
          scrollY: cursorY / zoom - sceneY,
        });
        return;
      }

      store.setAppState({
        scrollX: state.scrollX - event.deltaX / state.zoom,
        scrollY: state.scrollY - event.deltaY / state.zoom,
      });
    };

    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, []);

  // --- space-to-pan --------------------------------------------------------

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Space" && !isTypingTarget(event.target)) {
        spaceHeldRef.current = true;
        if (canvasRef.current) canvasRef.current.style.cursor = "grab";
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        spaceHeldRef.current = false;
        if (canvasRef.current) canvasRef.current.style.cursor = "default";
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  // escape cancels an in-progress multi-point line
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && pointerRef.current.placingPoints) {
        finishLinearPlacement();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  return (
    <div 
      ref={containerRef} 
      className="canvas-container"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("application/vnd.fluxxdraw.library+json")) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }
      }}
      onDrop={(e) => {
        const data = e.dataTransfer.getData("application/vnd.fluxxdraw.library+json");
        if (data) {
          e.preventDefault();
          const items = JSON.parse(data);
          const { scrollX, scrollY, zoom } = store.appState;
          
          const rect = containerRef.current?.getBoundingClientRect();
          if (!rect) return;
          
          const sceneX = (e.clientX - rect.left) / zoom - scrollX;
          const sceneY = (e.clientY - rect.top) / zoom - scrollY;

          placeLibraryItems(items, sceneX, sceneY);
        }
      }}
    >
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        onContextMenu={(event) => {
          event.preventDefault();
          openContextMenu(event.clientX, event.clientY);
        }}
      />
      <RemoteCursors />
    </div>
  );
};

function RemoteCursors() {
  const scene = useScene();
  const { zoom, scrollX, scrollY } = scene.appState;
  const [peers, setPeers] = useState<Map<number, PeerPresence>>(new Map());

  useEffect(() => {
    if (!collab.provider) return;
    
    const updatePeers = () => setPeers(new Map(collab.getPeers()));
    
    collab.provider.awareness.on("change", updatePeers);
    updatePeers();
    return () => {
      if (collab.provider) collab.provider.awareness.off("change", updatePeers);
    }
  }, []);

  return (
    <div className="remote-cursors" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'hidden' }}>
      {Array.from(peers.values()).map((peer, i) => {
        if (!peer.cursor) return null;
        
        // Transform scene coords to screen coords
        const screenX = (peer.cursor.x + scrollX) * zoom;
        const screenY = (peer.cursor.y + scrollY) * zoom;
        
        return (
          <div key={i} style={{ 
            position: 'absolute', 
            left: screenX, 
            top: screenY, 
            transform: 'translate(0, 0)',
            transition: 'transform 0.1s linear, left 0.1s linear, top 0.1s linear',
            zIndex: 100
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill={peer.color} style={{ filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.2))' }}>
              <path d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.42c.45 0 .67-.54.35-.85L6.35 2.85a.5.5 0 0 0-.85.35Z" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
            <div style={{
              backgroundColor: peer.color,
              color: 'white',
              fontSize: '12px',
              fontWeight: 'bold',
              padding: '2px 6px',
              borderRadius: '4px',
              marginTop: '4px',
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              {peer.name}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const isTypingTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.isContentEditable);

/**
 * Accepts bare hostnames by assuming https, and rejects anything that isn't
 * plausibly a web address.
 *
 * `new URL()` alone is too permissive here: it happily reads "not a url at all"
 * as the host "not" with the rest as a path, so the hostname is checked
 * explicitly rather than trusting the parse to fail.
 */
const normaliseUrl = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed || /\s/.test(trimmed)) return null;

  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    const host = url.hostname;
    // a real host is either dotted, or a bare name we recognise locally
    const dotted = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(host);
    const local = host === "localhost" || /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
    if (!dotted && !local) return null;
    return url.toString();
  } catch {
    return null;
  }
};

/** Opens an embedded link in a new tab, without handing it opener access. */
const openEmbed = (el: EmbedElement) => {
  window.open(el.url, "_blank", "noopener,noreferrer");
};
