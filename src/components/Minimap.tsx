import { useCallback, useEffect, useRef, useState } from "react";
import { store, useScene } from "../store";
import { getCommonBounds } from "../geometry";
import { IconMinimap } from "./icons";
import { Tooltip } from "./Tooltip";

const MINIMAP_WIDTH = 190;
const MINIMAP_HEIGHT = 120;
const PADDING = 40;

export const Minimap = () => {
  const scene = useScene();
  const [isOpen, setIsOpen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDraggingRef = useRef(false);

  const elements = scene.visibleElements;
  const { zoom, scrollX, scrollY, theme } = scene.appState;

  // Calculate bounding box of all elements
  const bounds = elements.length > 0 ? getCommonBounds(elements) : null;

  // Compute minimap transform
  const getMinimapTransform = useCallback(() => {
    if (!bounds) return null;
    const container = document.querySelector(".canvas-container");
    const containerW = container?.clientWidth || window.innerWidth;
    const containerH = container?.clientHeight || window.innerHeight;

    // Viewport bounds in scene coordinates
    const vpX1 = -scrollX;
    const vpY1 = -scrollY;
    const vpX2 = -scrollX + containerW / zoom;
    const vpY2 = -scrollY + containerH / zoom;

    // Combined bounds of elements + current viewport
    const minX = Math.min(bounds.x1 - PADDING, vpX1);
    const minY = Math.min(bounds.y1 - PADDING, vpY1);
    const maxX = Math.max(bounds.x2 + PADDING, vpX2);
    const maxY = Math.max(bounds.y2 + PADDING, vpY2);

    const worldW = Math.max(maxX - minX, 100);
    const worldH = Math.max(maxY - minY, 100);

    const scale = Math.min(MINIMAP_WIDTH / worldW, MINIMAP_HEIGHT / worldH);
    const offsetX = (MINIMAP_WIDTH - worldW * scale) / 2;
    const offsetY = (MINIMAP_HEIGHT - worldH * scale) / 2;

    return {
      minX,
      minY,
      worldW,
      worldH,
      scale,
      offsetX,
      offsetY,
      vpX1,
      vpY1,
      vpX2,
      vpY2,
      containerW,
      containerH,
    };
  }, [bounds, scrollX, scrollY, zoom]);

  // Render miniature shapes to canvas
  useEffect(() => {
    if (!isOpen) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = MINIMAP_WIDTH * dpr;
    canvas.height = MINIMAP_HEIGHT * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT);

    const tf = getMinimapTransform();
    if (!tf) return;

    const { minX, minY, scale, offsetX, offsetY, vpX1, vpY1, vpX2, vpY2 } = tf;

    const toMiniX = (sx: number) => offsetX + (sx - minX) * scale;
    const toMiniY = (sy: number) => offsetY + (sy - minY) * scale;

    const isDark = theme === "dark";
    ctx.fillStyle = isDark ? "rgba(255, 255, 255, 0.22)" : "rgba(22, 22, 26, 0.32)";
    ctx.strokeStyle = isDark ? "rgba(255, 255, 255, 0.38)" : "rgba(22, 22, 26, 0.48)";
    ctx.lineWidth = 1;

    // Draw elements simplified
    for (const el of elements) {
      if (el.isDeleted) continue;
      const x = toMiniX(el.x);
      const y = toMiniY(el.y);
      const w = el.width * scale;
      const h = el.height * scale;

      ctx.save();
      if (el.width < 3 || el.height < 3 || el.type === "line" || el.type === "arrow") {
        const x2 = toMiniX(el.x + Math.max(el.width, 8));
        const y2 = toMiniY(el.y + Math.max(el.height, 6));
        ctx.strokeStyle = isDark ? "rgba(255, 255, 255, 0.5)" : "rgba(22, 22, 26, 0.58)";
        ctx.beginPath();
        ctx.moveTo(Math.min(x, x2), Math.min(y, y2));
        ctx.lineTo(Math.max(x, x2), Math.max(y, y2));
        ctx.stroke();
      } else {
        ctx.strokeStyle = isDark ? "rgba(255, 255, 255, 0.42)" : "rgba(22, 22, 26, 0.44)";
        roundRect(ctx, x, y, w, h, Math.min(4, Math.max(1.5, w * 0.08)));
        ctx.stroke();
      }
      ctx.restore();
    }

    // Draw Viewport Rect
    const vx = toMiniX(vpX1);
    const vy = toMiniY(vpY1);
    const vw = (vpX2 - vpX1) * scale;
    const vh = (vpY2 - vpY1) * scale;

    ctx.fillStyle = isDark ? "rgba(99, 102, 241, 0.15)" : "rgba(79, 70, 229, 0.12)";
    ctx.fillRect(vx, vy, vw, vh);
    ctx.strokeStyle = isDark ? "rgba(129, 140, 248, 0.85)" : "rgba(79, 70, 229, 0.85)";
    ctx.lineWidth = 1.25;
    ctx.strokeRect(vx, vy, vw, vh);
  }, [isOpen, elements, theme, getMinimapTransform]);

  function roundRect(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
  ) {
    const r = Math.max(0, Math.min(radius, width / 2, height / 2));
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + width, y, x + width, y + height, r);
    context.arcTo(x + width, y + height, x, y + height, r);
    context.arcTo(x, y + height, x, y, r);
    context.arcTo(x, y, x + width, y, r);
    context.closePath();
  }

  const handlePointerAction = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const tf = getMinimapTransform();
    if (!tf) return;

    const { minX, minY, scale, offsetX, offsetY, containerW, containerH } = tf;
    const sceneTargetX = minX + (mx - offsetX) / scale;
    const sceneTargetY = minY + (my - offsetY) / scale;

    // Center viewport at (sceneTargetX, sceneTargetY)
    store.setAppState({
      scrollX: containerW / (2 * zoom) - sceneTargetX,
      scrollY: containerH / (2 * zoom) - sceneTargetY,
    });
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    handlePointerAction(e);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isDraggingRef.current) {
      handlePointerAction(e);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  return (
    <div className="minimap-container">
      {isOpen && (
        <div className="minimap-panel island">
          <canvas
            ref={canvasRef}
            className="minimap-canvas"
            style={{ width: MINIMAP_WIDTH, height: MINIMAP_HEIGHT, cursor: "crosshair", display: "block" }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          />
        </div>
      )}
      <Tooltip label={isOpen ? "Hide minimap" : "Show minimap"} placement="top">
        <button
          className={`minimap-toggle-button floating-help-button ${isOpen ? "active" : ""}`}
          aria-label="Toggle minimap"
          onClick={() => setIsOpen(!isOpen)}
          style={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <IconMinimap />
        </button>
      </Tooltip>
    </div>
  );
};
