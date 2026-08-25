import type { Tool } from "../types";

const HINTS: Partial<Record<Tool, string>> = {
  selection: "Click to select · Drag to marquee-select",
  rectangle: "Click and drag to draw",
  diamond: "Click and drag to draw",
  ellipse: "Click and drag to draw",
  arrow: "Click to start · Click to add points · Double-click or Escape to finish",
  line: "Click to start · Click to add points · Double-click or Escape to finish",
  freedraw: "Click and drag to draw freely",
  text: "Click to place text",
  sticky: "Click to place a sticky note",
  eraser: "Click on elements to erase",
  frame: "Click and drag to create a frame",
  hand: "Click and drag to pan the canvas",
  image: "Click to place an image",
  laser: "Click and drag to point",
};

export const ToolHint = ({ tool }: { tool: Tool }) => {
  const hint = HINTS[tool];
  if (!hint || tool === "selection") return null;

  return (
    <div className="tool-hint">
      {hint}
    </div>
  );
};
