import { useEffect, useRef, useState, type ReactNode } from "react";
import { store, useScene } from "../store";
import { Tooltip } from "./Tooltip";
import {
  IconArrow,
  IconDiamond,
  IconDraw,
  IconEllipse,
  IconEmbed,
  IconEraser,
  IconFrame,
  IconHand,
  IconImage,
  IconLaser,
  IconLine,
  IconMore,
  IconRectangle,
  IconSelection,
  IconSticky,
  IconText,
} from "./icons";
import { useIsMobile } from "../hooks/useMediaQuery";
import type { Tool } from "../types";

interface ToolSpec {
  tool: Tool;
  label: string;
  shortcut: string;
  icon: ReactNode;
}

/** The tools reached constantly; these stay on the bar. */
const PRIMARY_TOOLS: ToolSpec[] = [
  { tool: "hand", label: "Pan", shortcut: "H", icon: <IconHand /> },
  { tool: "selection", label: "Select", shortcut: "1", icon: <IconSelection /> },
  { tool: "rectangle", label: "Rectangle", shortcut: "2", icon: <IconRectangle /> },
  { tool: "diamond", label: "Diamond", shortcut: "3", icon: <IconDiamond /> },
  { tool: "ellipse", label: "Ellipse", shortcut: "4", icon: <IconEllipse /> },
  { tool: "arrow", label: "Arrow", shortcut: "5", icon: <IconArrow /> },
  { tool: "freedraw", label: "Draw", shortcut: "6", icon: <IconDraw /> },
  { tool: "line", label: "Line", shortcut: "7", icon: <IconLine /> },
  { tool: "text", label: "Text", shortcut: "8", icon: <IconText /> },
  { tool: "eraser", label: "Eraser", shortcut: "0", icon: <IconEraser /> },
  { tool: "sticky", label: "Sticky note", shortcut: "N", icon: <IconSticky /> },
];

/** Occasional tools, tucked behind the overflow button. */
const SECONDARY_TOOLS: ToolSpec[] = [
  { tool: "image", label: "Image", shortcut: "9", icon: <IconImage /> },
  { tool: "frame", label: "Frame", shortcut: "F", icon: <IconFrame /> },
  { tool: "embed", label: "Embed a link", shortcut: "", icon: <IconEmbed /> },
  { tool: "laser", label: "Laser pointer", shortcut: "K", icon: <IconLaser /> },
];

/**
 * Phone screens can't hold the full bar without turning it into a scroll
 * hunt, so only the drawing essentials stay out; the rest fall into overflow.
 */
const MOBILE_PRIMARY: Tool[] = [
  "selection",
  "rectangle",
  "ellipse",
  "arrow",
  "freedraw",
  "text",
  "eraser",
  "sticky",
];

interface ToolbarProps {
  onImage?: () => void;
}

export const Toolbar = ({ onImage }: ToolbarProps = {}) => {
  const scene = useScene();
  const isMobile = useIsMobile();
  const { tool } = scene.appState;
  const [overflowOpen, setOverflowOpen] = useState(false);
  const overflowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!overflowOpen) return;
    const onDown = (event: PointerEvent) => {
      if (overflowRef.current && !overflowRef.current.contains(event.target as Node)) {
        setOverflowOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOverflowOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [overflowOpen]);

  const pick = (next: Tool) => {
    if (next === "image" && onImage) {
      onImage();
    } else {
      store.setAppState({ tool: next, selectedIds: [] });
    }
    setOverflowOpen(false);
  };

  const ToolButton = ({ spec }: { spec: ToolSpec }) => (
    <Tooltip label={spec.label} shortcut={spec.shortcut || undefined}>
      <button
        className={`tool-button ${tool === spec.tool ? "active" : ""}`}
        aria-pressed={tool === spec.tool}
        aria-label={spec.label}
        onClick={() => pick(spec.tool)}
      >
        {spec.icon}
        {spec.shortcut && <span className="tool-shortcut">{spec.shortcut}</span>}
      </button>
    </Tooltip>
  );

  const primary = isMobile
    ? PRIMARY_TOOLS.filter((spec) => MOBILE_PRIMARY.includes(spec.tool))
    : PRIMARY_TOOLS;
  const secondary = isMobile
    ? [...PRIMARY_TOOLS.filter((spec) => !MOBILE_PRIMARY.includes(spec.tool)), ...SECONDARY_TOOLS]
    : SECONDARY_TOOLS;
  const secondaryActive = secondary.some((spec) => spec.tool === tool);

  return (
    <div className="toolbar island" role="toolbar" aria-label="Tools">
      {primary.map((spec) => (
        <ToolButton key={spec.tool} spec={spec} />
      ))}

      <span className="toolbar-divider" />

      <div className="toolbar-overflow" ref={overflowRef}>
        <Tooltip label="More tools">
          <button
            className={`tool-button ${overflowOpen || secondaryActive ? "active" : ""}`}
            aria-label="More tools"
            aria-expanded={overflowOpen}
            onClick={() => setOverflowOpen((v) => !v)}
          >
            <IconMore />
          </button>
        </Tooltip>

        {overflowOpen && (
          <div className="overflow-popover" role="menu">
            {secondary.map((spec) => (
              <button
                key={spec.tool}
                className={`overflow-item ${tool === spec.tool ? "active" : ""}`}
                role="menuitem"
                onClick={() => pick(spec.tool)}
              >
                {spec.icon}
                <span>{spec.label}</span>
                {spec.shortcut && <kbd>{spec.shortcut}</kbd>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
