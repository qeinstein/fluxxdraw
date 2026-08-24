import { useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface TooltipProps {
  label: string;
  /** rendered in a dimmer weight after the label, e.g. a keyboard shortcut */
  shortcut?: string;
  placement?: "top" | "bottom" | "right";
  children: ReactNode;
}

const OPEN_DELAY_MS = 380;
const GAP = 10;

/**
 * A quiet, delayed tooltip. It only appears after a deliberate hover, and
 * renders in a portal so toolbar overflow can't clip it.
 */
export const Tooltip = ({ label, shortcut, placement = "bottom", children }: TooltipProps) => {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const wrapperRef = useRef<HTMLSpanElement>(null);
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

  const hide = () => {
    window.clearTimeout(timerRef.current);
    setPosition(null);
  };

  return (
    <>
      <span
        ref={wrapperRef}
        className="tooltip-anchor"
        onPointerEnter={show}
        onPointerLeave={hide}
        // hiding on press keeps the tooltip from lingering over a click
        onPointerDown={hide}
        onFocus={show}
        onBlur={hide}
      >
        {children}
      </span>
      {position &&
        createPortal(
          <div
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
