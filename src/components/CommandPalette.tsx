import { useEffect, useMemo, useRef, useState } from "react";
import { store, useScene } from "../store";
import type { Tool } from "../types";
import {
  alignSelection,
  copyStyle,
  deleteSelection,
  distributeSelection,
  duplicateSelection,
  groupSelection,
  pasteStyle,
  tidyUpSelection,
  toggleLockSelection,
  ungroupSelection,
} from "../actions";
import { setZoom, zoomToFit } from "./ZoomControls";
import { sc } from "../shortcuts";

export interface CommandItem {
  id: string;
  title: string;
  category: "Tools" | "Edit & Selection" | "Layout & Arrange" | "View & Canvas" | "File & Export";
  shortcut?: string;
  keywords?: string[];
  action: () => void;
}

export const CommandPalette = ({
  isOpen,
  onClose,
  onOpenExport,
  onOpenHelp,
  onOpenLibrary,
  onTogglePresentation,
}: {
  isOpen: boolean;
  onClose: () => void;
  onOpenExport?: () => void;
  onOpenHelp?: () => void;
  onOpenLibrary?: () => void;
  onTogglePresentation?: () => void;
}) => {
  const scene = useScene();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const setTool = (tool: Tool) => {
    store.setAppState({ tool });
  };

  const commands: CommandItem[] = useMemo(() => {
    const list: CommandItem[] = [
      // Tools
      { id: "tool-selection", title: "Selection Tool", category: "Tools", shortcut: "V / 1", keywords: ["select", "pointer", "arrow", "cursor"], action: () => setTool("selection") },
      { id: "tool-rectangle", title: "Rectangle Tool", category: "Tools", shortcut: "R / 2", keywords: ["box", "square", "shape"], action: () => setTool("rectangle") },
      { id: "tool-diamond", title: "Diamond Tool", category: "Tools", shortcut: "D / 3", keywords: ["rhombus", "decision", "flowchart"], action: () => setTool("diamond") },
      { id: "tool-ellipse", title: "Ellipse Tool", category: "Tools", shortcut: "O / 4", keywords: ["circle", "oval", "round"], action: () => setTool("ellipse") },
      { id: "tool-arrow", title: "Arrow Tool", category: "Tools", shortcut: "A / 5", keywords: ["connector", "line", "flow"], action: () => setTool("arrow") },
      { id: "tool-line", title: "Line Tool", category: "Tools", shortcut: "L / 6", keywords: ["stroke", "straight"], action: () => setTool("line") },
      { id: "tool-freedraw", title: "Draw (Freedraw)", category: "Tools", shortcut: "P / 7", keywords: ["pen", "pencil", "sketch", "hand"], action: () => setTool("freedraw") },
      { id: "tool-text", title: "Text Tool", category: "Tools", shortcut: "T / 8", keywords: ["type", "font", "label"], action: () => setTool("text") },
      { id: "tool-frame", title: "Frame Tool", category: "Tools", shortcut: "F", keywords: ["container", "artboard", "section", "slide"], action: () => setTool("frame") },
      { id: "tool-eraser", title: "Eraser Tool", category: "Tools", shortcut: "E / 0", keywords: ["delete", "remove", "clear"], action: () => setTool("eraser") },
      { id: "tool-laser", title: "Laser Pointer", category: "Tools", shortcut: "K", keywords: ["present", "highlight", "spotlight"], action: () => setTool("laser") },
      { id: "tool-hand", title: "Hand (Pan Tool)", category: "Tools", shortcut: "H / Space", keywords: ["drag", "move canvas", "scroll"], action: () => setTool("hand") },

      // Edit & Selection
      { id: "edit-undo", title: "Undo", category: "Edit & Selection", shortcut: sc("undo"), action: () => store.undo() },
      { id: "edit-redo", title: "Redo", category: "Edit & Selection", shortcut: sc("redo"), action: () => store.redo() },
      { id: "edit-duplicate", title: "Duplicate Selection", category: "Edit & Selection", shortcut: sc("duplicate"), action: () => duplicateSelection() },
      { id: "edit-delete", title: "Delete Selection", category: "Edit & Selection", shortcut: "Del / Backspace", action: () => deleteSelection() },
      { id: "edit-copy-style", title: "Copy Style (Format Painter)", category: "Edit & Selection", shortcut: sc("copyStyle"), keywords: ["style", "color", "stroke"], action: () => copyStyle() },
      { id: "edit-paste-style", title: "Paste Style", category: "Edit & Selection", shortcut: sc("pasteStyle"), keywords: ["style", "apply"], action: () => pasteStyle() },
      { id: "edit-group", title: "Group Selection", category: "Edit & Selection", shortcut: sc("group"), action: () => groupSelection() },
      { id: "edit-ungroup", title: "Ungroup Selection", category: "Edit & Selection", shortcut: sc("ungroup"), action: () => ungroupSelection() },
      { id: "edit-lock", title: "Toggle Lock / Unlock", category: "Edit & Selection", shortcut: sc("lock"), action: () => toggleLockSelection() },

      // Layout & Arrange
      { id: "layout-tidy", title: "Tidy Up Selection", category: "Layout & Arrange", keywords: ["clean", "auto layout", "align and distribute", "smart"], action: () => tidyUpSelection() },
      { id: "layout-align-left", title: "Align Left", category: "Layout & Arrange", action: () => alignSelection("left") },
      { id: "layout-align-center-x", title: "Align Center (Horizontal)", category: "Layout & Arrange", action: () => alignSelection("center-x") },
      { id: "layout-align-right", title: "Align Right", category: "Layout & Arrange", action: () => alignSelection("right") },
      { id: "layout-align-top", title: "Align Top", category: "Layout & Arrange", action: () => alignSelection("top") },
      { id: "layout-align-center-y", title: "Align Center (Vertical)", category: "Layout & Arrange", action: () => alignSelection("center-y") },
      { id: "layout-align-bottom", title: "Align Bottom", category: "Layout & Arrange", action: () => alignSelection("bottom") },
      { id: "layout-distribute-h", title: "Distribute Horizontally", category: "Layout & Arrange", action: () => distributeSelection("horizontal") },
      { id: "layout-distribute-v", title: "Distribute Vertically", category: "Layout & Arrange", action: () => distributeSelection("vertical") },

      // View & Canvas
      { id: "view-zoom-fit", title: "Zoom to Fit (All Elements)", category: "View & Canvas", shortcut: sc("zoomToFit"), action: () => zoomToFit("all") },
      { id: "view-zoom-reset", title: "Reset Zoom to 100%", category: "View & Canvas", shortcut: sc("zoomReset"), action: () => setZoom(1) },
      { id: "view-theme-toggle", title: `Switch to ${scene.appState.theme === "dark" ? "Light" : "Dark"} Mode`, category: "View & Canvas", keywords: ["theme", "color", "dark", "light", "appearance"], action: () => store.setAppState({ theme: scene.appState.theme === "dark" ? "light" : "dark" }) },
      {
        id: "view-grid-toggle",
        title: `Toggle Grid (${scene.appState.gridSize === null ? "Enable" : "Disable"})`,
        category: "View & Canvas",
        keywords: ["snap", "grid", "lines"],
        action: () => store.setAppState({ gridSize: scene.appState.gridSize === null ? 20 : null }),
      },
      { id: "view-presentation", title: "Presentation Mode", category: "View & Canvas", shortcut: "P", keywords: ["slides", "present", "fullscreen"], action: () => onTogglePresentation?.() },
      { id: "view-viewmode-toggle", title: scene.appState.viewMode ? "Exit View-Only (Read-Only) Mode" : "Enter View-Only (Read-Only) Mode", category: "View & Canvas", keywords: ["read only", "lock canvas", "view mode"], action: () => store.setAppState({ viewMode: !scene.appState.viewMode }) },

      // File & Export
      { id: "file-export", title: "Export Image / File (PNG, SVG, .fluxx)", category: "File & Export", shortcut: sc("export"), keywords: ["save", "download", "png", "svg", "json", "share"], action: () => onOpenExport?.() },
      { id: "file-library", title: "Open Component Library", category: "File & Export", keywords: ["library", "icons", "cloud", "aws", "templates"], action: () => onOpenLibrary?.() },
      { id: "file-help", title: "Keyboard Shortcuts & Help", category: "File & Export", shortcut: "?", action: () => onOpenHelp?.() },
    ];
    return list;
  }, [scene.appState.theme, scene.appState.gridSize, scene.appState.viewMode, onOpenExport, onOpenHelp, onOpenLibrary, onTogglePresentation]);

  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands;
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    return commands.filter((cmd) => {
      const matchTitle = terms.every((t) => cmd.title.toLowerCase().includes(t));
      const matchCat = terms.every((t) => cmd.category.toLowerCase().includes(t));
      const matchKeywords = cmd.keywords?.some((k) => terms.every((t) => k.toLowerCase().includes(t)));
      return matchTitle || matchCat || matchKeywords;
    });
  }, [commands, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
    }
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredCommands.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % Math.max(1, filteredCommands.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = filteredCommands[selectedIndex];
      if (target) {
        target.action();
        onClose();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="command-palette-backdrop" onClick={onClose}>
      <div
        className="command-palette island"
        role="dialog"
        aria-label="Command Palette"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="command-palette-header">
          <input
            ref={inputRef}
            type="text"
            className="command-palette-input"
            placeholder="Type a command or search actions… (e.g. Rectangle, Export, Tidy)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="command-palette-list">
          {filteredCommands.length === 0 ? (
            <div className="command-palette-empty">No commands matching "{query}"</div>
          ) : (
            filteredCommands.map((cmd, idx) => (
              <div
                key={cmd.id}
                className={`command-palette-item ${idx === selectedIndex ? "active" : ""}`}
                onClick={() => {
                  cmd.action();
                  onClose();
                }}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                <div className="command-item-left">
                  <span className="command-item-category">{cmd.category}</span>
                  <span className="command-item-title">{cmd.title}</span>
                </div>
                {cmd.shortcut && <kbd className="command-item-shortcut">{cmd.shortcut}</kbd>}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
