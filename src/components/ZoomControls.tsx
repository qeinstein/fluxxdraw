import { store, useScene } from "../store";
import { MAX_ZOOM, MIN_ZOOM } from "../constants";
import { getCommonBounds } from "../geometry";

/** Fits the given elements (or everything) into the viewport. */
export const zoomToFit = (target: "all" | "selection" = "all") => {
  const elements =
    target === "selection" && store.appState.selectedIds.length > 0
      ? store.getSelected()
      : store.visibleElements;
  if (elements.length === 0) return;

  const container = document.querySelector(".canvas-container");
  if (!container) return;
  const rect = container.getBoundingClientRect();

  const bounds = getCommonBounds(elements);
  const padding = 80;
  const width = Math.max(bounds.x2 - bounds.x1, 1);
  const height = Math.max(bounds.y2 - bounds.y1, 1);
  const zoom = Math.min(
    MAX_ZOOM,
    Math.max(
      MIN_ZOOM,
      Math.min((rect.width - padding) / width, (rect.height - padding) / height),
    ),
  );

  store.setAppState({
    zoom,
    scrollX: rect.width / (2 * zoom) - (bounds.x1 + bounds.x2) / 2,
    scrollY: rect.height / (2 * zoom) - (bounds.y1 + bounds.y2) / 2,
  });
};

/** Zooms about the viewport centre so the view doesn't jump. */
export const setZoom = (nextZoom: number) => {
  const container = document.querySelector(".canvas-container");
  if (!container) return;
  const rect = container.getBoundingClientRect();
  const { zoom, scrollX, scrollY } = store.appState;
  const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom));

  const centreX = rect.width / 2;
  const centreY = rect.height / 2;
  const sceneX = centreX / zoom - scrollX;
  const sceneY = centreY / zoom - scrollY;

  store.setAppState({
    zoom: clamped,
    scrollX: centreX / clamped - sceneX,
    scrollY: centreY / clamped - sceneY,
  });
};

export const ZoomControls = () => {
  const scene = useScene();
  const { zoom } = scene.appState;

  return (
    <div className="zoom-controls island">
      <button onClick={() => setZoom(zoom / 1.2)} title="Zoom out (⌘−)">
        −
      </button>
      <button
        className="zoom-value"
        onClick={() => setZoom(1)}
        title="Reset zoom to 100%"
      >
        {Math.round(zoom * 100)}%
      </button>
      <button onClick={() => setZoom(zoom * 1.2)} title="Zoom in (⌘+)">
        +
      </button>
      <div className="toolbar-divider vertical" />
      <button onClick={() => zoomToFit("all")} title="Zoom to fit (⇧1)">
        ⤢
      </button>
    </div>
  );
};
