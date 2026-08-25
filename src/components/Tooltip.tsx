import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface TooltipProps {
  label: string;
  /** rendered in a dimmer weight after the label, e.g. a keyboard shortcut */
  shortcut?: string;
  placement?: "top" | "bottom" | "right";
  children: ReactNode;
}

const OPEN_DELAY_MS = 150;
const GAP = 10;

/**
 * A quiet, delayed tooltip. It only appears after a deliberate hover, and
 * renders in a portal so toolbar overflow can't clip it.
 *
 * Touch is excluded on purpose. A tap fires pointerenter and focus just like a
 * mouse does, but no pointerleave ever follows, so a tooltip opened by a thumb
 * hangs around over the UI until something else is tapped.
 */
export const Tooltip = ({ label, shortcut, placement = "bottom", children }: TooltipProps) => {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | undefined>(undefined);

  const show = () => {
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      const rect = wrapperRef.current?.getBoundingClientRect();
      if (!rect) return;
      if (placement === "right") {
        setPosition({ x: rect.right + GAP, y: rect.top + rect.height / 2 });
      } else if (placement === "top") {
        setPosition({ x: rect.left + rect.width / 2, y: rect.top - GAP });
      } else {
        setPosition({ x: rect.left + rect.width / 2, y: rect.bottom + GAP });
      }
    }, OPEN_DELAY_MS);
  };

  /**
   * Nudges the tooltip back inside the viewport. A label on a button at the
   * right edge would otherwise be half off-screen — the anchor is centred
   * under it, with no regard for where the window ends.
   */
  useLayoutEffect(() => {
    const tip = tipRef.current;
    if (!position || !tip) return;
    const { width } = tip.getBoundingClientRect();
    // top/bottom are centred on the anchor by a CSS transform; right is not
    const visibleLeft = placement === "right" ? position.x : position.x - width / 2;
    const maxLeft = Math.max(GAP, window.innerWidth - GAP - width);
    const shift = Math.min(Math.max(visibleLeft, GAP), maxLeft) - visibleLeft;
    if (Math.abs(shift) > 0.5) setPosition({ ...position, x: position.x + shift });
  }, [position, placement]);

  const hide = () => {
    window.clearTimeout(timerRef.current);
    setPosition(null);
  };

  return (
    <>
      <span
        ref={wrapperRef}
        className="tooltip-anchor"
        onPointerEnter={(event) => {
          if (event.pointerType === "mouse") show();
        }}
        onPointerLeave={hide}
        // hiding on press keeps the tooltip from lingering over a click
        onPointerDown={hide}
        // only keyboard focus should explain a control; a tap already acted on it
        onFocus={(event) => {
          if ((event.target as HTMLElement).matches?.(":focus-visible")) show();
        }}
        onBlur={hide}
      >
        {children}
      </span>
      {position &&
        createPortal(
          <div
            ref={tipRef}
            className={`tooltip tooltip--${placement}`}
            style={{ left: position.x, top: position.y }}
            role="tooltip"
          >
            {label}
            {shortcut && <span className="tooltip-shortcut">{shortcut}</span>}
          </div>,
          document.body,
        )}
    </>
  );
};
