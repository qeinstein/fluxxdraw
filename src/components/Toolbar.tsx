import { store, useScene } from "../store";
import type { Tool } from "../types";

interface ToolSpec {
  tool: Tool;
  label: string;
  shortcut: string;
  icon: string;
}

/** Order and shortcuts mirror the conventions people already know. */
export const TOOLS: ToolSpec[] = [
  { tool: "hand", label: "Hand (pan)", shortcut: "H", icon: "✋" },
  { tool: "selection", label: "Selection", shortcut: "1", icon: "▭̶" },
  { tool: "rectangle", label: "Rectangle", shortcut: "2", icon: "▭" },
  { tool: "diamond", label: "Diamond", shortcut: "3", icon: "◇" },
  { tool: "ellipse", label: "Ellipse", shortcut: "4", icon: "◯" },
  { tool: "arrow", label: "Arrow", shortcut: "5", icon: "↗" },
  { tool: "line", label: "Line", shortcut: "6", icon: "╱" },
  { tool: "freedraw", label: "Draw", shortcut: "7", icon: "✎" },
  { tool: "text", label: "Text", shortcut: "8", icon: "A" },
  { tool: "image", label: "Image", shortcut: "9", icon: "🖼" },
  { tool: "frame", label: "Frame", shortcut: "F", icon: "⛶" },
  { tool: "embed", label: "Embed", shortcut: "", icon: "🔗" },
  { tool: "eraser", label: "Eraser", shortcut: "0", icon: "⌫" },
  { tool: "laser", label: "Laser pointer", shortcut: "K", icon: "🔦" },
];

export const Toolbar = () => {
  const scene = useScene();
  const { tool, toolLocked } = scene.appState;

  return (
    <div className="toolbar island">
      <button
        className={`tool-button lock ${toolLocked ? "active" : ""}`}
        title="Keep the selected tool active after drawing (Q)"
        onClick={() => store.setAppState({ toolLocked: !toolLocked })}
      >
        {toolLocked ? "🔒" : "🔓"}
      </button>
      <div className="toolbar-divider" />
      {TOOLS.map((spec) => (
        <button
          key={spec.tool}
          className={`tool-button ${tool === spec.tool ? "active" : ""}`}
          title={spec.shortcut ? `${spec.label} — ${spec.shortcut}` : spec.label}
          onClick={() => store.setAppState({ tool: spec.tool, selectedIds: [] })}
        >
          <span className="tool-icon">{spec.icon}</span>
          {spec.shortcut && <span className="tool-shortcut">{spec.shortcut}</span>}
        </button>
      ))}
    </div>
  );
};
