import { useCallback, useEffect, useRef, useState } from "react";
import { store, useScene } from "../store";
import { getFrameContents } from "../actions";
import { renderElements } from "../render/renderScene";
import { getElementBounds } from "../geometry";
import { preloadFiles } from "../render/imageCache";
import { LASER_FADE_MS } from "../constants";
import type { FrameElement } from "../types";

interface PresentationProps {
  onExit: () => void;
}

interface LaserPoint {
  x: number;
  y: number;
  time: number;
}

/** Frames, in canvas order, are the slides. */
export const getSlides = (): FrameElement[] =>
  store.visibleElements.filter((el): el is FrameElement => el.type === "frame");

/**
 * Full-screen presentation over the drawing's frames.
 *
 * Each frame is a slide, letter-boxed to fit the screen. It renders through
 * the same pipeline as the canvas, so a slide looks exactly like what was
 * drawn. The laser pointer stays available for talking over a diagram.
 */
export const Presentation = ({ onExit }: PresentationProps) => {
  const scene = useScene();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const laserRef = useRef<LaserPoint[]>([]);
  const frameRef = useRef(0);
  const [index, setIndex] = useState(0);
  const [laserOn, setLaserOn] = useState(false);

  const slides = getSlides();
  const slide = slides[index];
  const total = slides.length;

  const go = useCallback(
    (next: number) => setIndex(Math.max(0, Math.min(next, total - 1))),
    [total],
  );

  useEffect(() => {
    preloadFiles(store.files);
  }, []);

  // keyboard: advance, retreat, jump, exit
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case "ArrowRight":
        case "ArrowDown":
        case " ":
        case "PageDown":
          event.preventDefault();
          go(index + 1);
          break;
        case "ArrowLeft":
        case "ArrowUp":
        case "PageUp":
          event.preventDefault();
          go(index - 1);
          break;
        case "Home":
          event.preventDefault();
          go(0);
          break;
        case "End":
          event.preventDefault();
          go(total - 1);
          break;
        case "Escape":
          event.preventDefault();
          onExit();
          break;
        case "l":
        case "L":
          setLaserOn((v) => !v);
          break;
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [index, total, go, onExit]);

  // leaving the browser's fullscreen should leave the presentation too
  useEffect(() => {
    const element = document.documentElement;
    element.requestFullscreen?.().catch(() => undefined);
    const onChange = () => {
      if (!document.fullscreenElement) onExit();
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => undefined);
    };
  }, [onExit]);

  // render loop: draw the current slide, letter-boxed
  useEffect(() => {
    const draw = () => {
      frameRef.current = requestAnimationFrame(draw);
      const canvas = canvasRef.current;
      if (!canvas || !slide) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      // track both axes; a window resize can change only one of them
      if (
        canvas.width !== Math.floor(width * dpr) ||
        canvas.height !== Math.floor(height * dpr)
      ) {
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = store.appState.viewBackgroundColor;
      ctx.fillRect(0, 0, width, height);

      const bounds = getElementBounds(slide);
      const slideWidth = Math.max(bounds.x2 - bounds.x1, 1);
      const slideHeight = Math.max(bounds.y2 - bounds.y1, 1);
      // contain, with a small margin so nothing touches the screen edge
      const zoom = Math.min(width / slideWidth, height / slideHeight) * 0.94;

      ctx.save();
      ctx.translate(
        (width - slideWidth * zoom) / 2,
        (height - slideHeight * zoom) / 2,
      );
      ctx.scale(zoom, zoom);
      ctx.translate(-bounds.x1, -bounds.y1);

      // clip to the frame so neighbouring slides never bleed in
      ctx.beginPath();
      ctx.rect(bounds.x1, bounds.y1, slideWidth, slideHeight);
      ctx.clip();

      const contents = getFrameContents(slide.id).filter((el) => el.type !== "frame");
      renderElements(ctx, contents, {
        scrollX: 0,
        scrollY: 0,
        zoom,
        scale: dpr,
        files: store.files,
        theme: store.appState.theme,
        exporting: true,
      });

      // laser trail, in screen space over the slide
      const now = performance.now();
      const trail = laserRef.current.filter((p) => now - p.time < LASER_FADE_MS);
      laserRef.current = trail;
      if (trail.length > 1) {
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        for (let i = 1; i < trail.length; i++) {
          const age = (now - trail[i].time) / LASER_FADE_MS;
          ctx.globalAlpha = Math.max(0, 1 - age);
          ctx.strokeStyle = "#f03e3e";
          ctx.lineWidth = (5 * (1 - age * 0.5)) / zoom;
          ctx.beginPath();
          ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
          ctx.lineTo(trail[i].x, trail[i].y);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    };

    frameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameRef.current);
    // redraw against the latest scene as well as the current slide
  }, [slide, scene.getVersion()]);

  /** Converts a screen point into the slide's own coordinates, for the laser. */
  const toSlideSpace = (clientX: number, clientY: number): [number, number] | null => {
    const canvas = canvasRef.current;
    if (!canvas || !slide) return null;
    const rect = canvas.getBoundingClientRect();
    const bounds = getElementBounds(slide);
    const slideWidth = Math.max(bounds.x2 - bounds.x1, 1);
    const slideHeight = Math.max(bounds.y2 - bounds.y1, 1);
    const zoom = Math.min(rect.width / slideWidth, rect.height / slideHeight) * 0.94;
    const offsetX = (rect.width - slideWidth * zoom) / 2;
    const offsetY = (rect.height - slideHeight * zoom) / 2;
    return [
      (clientX - rect.left - offsetX) / zoom + bounds.x1,
      (clientY - rect.top - offsetY) / zoom + bounds.y1,
    ];
  };

  if (total === 0) {
    return (
      <div className="presentation empty">
        <div className="presentation-empty-card island">
          <h2>No slides yet</h2>
          <p className="hint">
            Presentation mode turns frames into slides. Draw a frame (<kbd>F</kbd>) around
            anything you want to present, then start again.
          </p>
          <button className="primary" onClick={onExit}>
            Back to the canvas
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="presentation"
      onPointerMove={(event) => {
        if (!laserOn) return;
        const point = toSlideSpace(event.clientX, event.clientY);
        if (point) laserRef.current.push({ x: point[0], y: point[1], time: performance.now() });
      }}
    >
      <canvas ref={canvasRef} className="presentation-canvas" />

      {/* click zones: left third goes back, the rest advances */}
      <button
        className="presentation-zone prev"
        aria-label="Previous slide"
        onClick={() => go(index - 1)}
      />
      <button
        className="presentation-zone next"
        aria-label="Next slide"
        onClick={() => go(index + 1)}
      />

      <div className="presentation-bar">
        <button onClick={() => go(index - 1)} disabled={index === 0}>
          ‹
        </button>
        <span className="presentation-count">
          {index + 1} / {total}
        </span>
        <button onClick={() => go(index + 1)} disabled={index === total - 1}>
          ›
        </button>
        <span className="toolbar-divider" />
        <span className="presentation-name">{slide?.name}</span>
        <span className="toolbar-divider" />
        <button
          className={laserOn ? "active" : ""}
          onClick={() => setLaserOn((v) => !v)}
          title="Laser pointer (L)"
        >
          Laser
        </button>
        <button onClick={onExit} title="Exit (Esc)">
          Exit
        </button>
      </div>
    </div>
  );
};
