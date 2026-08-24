import type { ReactNode } from "react";
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
  IconLockClosed,
  IconLockOpen,
  IconRectangle,
  IconSelection,
  IconText,
} from "./icons";
import type { Tool } from "../types";

interface ToolSpec {
  tool: Tool;
  label: string;
  shortcut: string;
  icon: ReactNode;
}

/** Order and shortcuts mirror the conventions people already know. */
const TOOLS: ToolSpec[] = [
  { tool: "hand", label: "Pan", shortcut: "H", icon: <IconHand /> },
  { tool: "selection", label: "Select", shortcut: "1", icon: <IconSelection /> },
  { tool: "rectangle", label: "Rectangle", shortcut: "2", icon: <IconRectangle /> },
  { tool: "diamond", label: "Diamond", shortcut: "3", icon: <IconDiamond /> },
  { tool: "ellipse", label: "Ellipse", shortcut: "4", icon: <IconEllipse /> },
  { tool: "arrow", label: "Arrow", shortcut: "5", icon: <IconArrow /> },
  { tool: "line", label: "Line", shortcut: "6", icon: <IconLine /> },
  { tool: "freedraw", label: "Draw", shortcut: "7", icon: <IconDraw /> },
  { tool: "text", label: "Text", shortcut: "8", icon: <IconText /> },
  { tool: "image", label: "Image", shortcut: "9", icon: <IconImage /> },
  { tool: "frame", label: "Frame", shortcut: "F", icon: <IconFrame /> },
  { tool: "embed", label: "Embed a link", shortcut: "", icon: <IconEmbed /> },
  { tool: "eraser", label: "Eraser", shortcut: "0", icon: <IconEraser /> },
  { tool: "laser", label: "Laser pointer", shortcut: "K", icon: <IconLaser /> },
];

export const Toolbar = () => {
  const scene = useScene();
  const { tool, toolLocked } = scene.appState;

  return (
    <div className="toolbar island" role="toolbar" aria-label="Tools">
      <Tooltip
        label={toolLocked ? "Tool stays selected" : "Tool resets after drawing"}
        shortcut="Q"
      >
        <button
          className={`tool-button ${toolLocked ? "is-locked" : ""}`}
          aria-pressed={toolLocked}
          aria-label="Keep the selected tool active"
          onClick={() => store.setAppState({ toolLocked: !toolLocked })}
        >
          {toolLocked ? <IconLockClosed /> : <IconLockOpen />}
        </button>
      </Tooltip>

      <span className="toolbar-divider" />

      {TOOLS.map((spec) => (
        <Tooltip key={spec.tool} label={spec.label} shortcut={spec.shortcut || undefined}>
          <button
            className={`tool-button ${tool === spec.tool ? "active" : ""}`}
            aria-pressed={tool === spec.tool}
            aria-label={spec.label}
            onClick={() => store.setAppState({ tool: spec.tool, selectedIds: [] })}
          >
            {spec.icon}
            {spec.shortcut && <span className="tool-shortcut">{spec.shortcut}</span>}
          </button>
        </Tooltip>
      ))}
    </div>
  );
};
