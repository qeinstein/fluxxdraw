import { useEffect, useRef, useState } from "react";
import { store, useScene } from "../store";
import { CANVAS_COLORS } from "../constants";

interface MenuProps {
  onOpen: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onExport: () => void;
  onReset: () => void;
  onHelp: () => void;
  currentFileName: string | null;
  dirty: boolean;
}

export const Menu = ({
  onOpen,
  onSave,
  onSaveAs,
  onExport,
  onReset,
  onHelp,
  currentFileName,
  dirty,
}: MenuProps) => {
  const scene = useScene();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const { appState } = scene;

  return (
    <div className="menu island" ref={ref}>
      <button className="menu-trigger" onClick={() => setOpen((v) => !v)} title="Menu">
        ☰
      </button>
      <span className="file-name" title={currentFileName ?? "Unsaved drawing"}>
        {currentFileName ?? "Untitled"}
        {dirty && <span className="dirty-dot" title="Unsaved changes" />}
      </span>

      {open && (
        <div className="menu-popover">
          <button onClick={() => { setOpen(false); onOpen(); }}>
            Open… <kbd>⌘O</kbd>
          </button>
          <button onClick={() => { setOpen(false); onSave(); }}>
            Save <kbd>⌘S</kbd>
          </button>
          <button onClick={() => { setOpen(false); onSaveAs(); }}>
            Save as… <kbd>⇧⌘S</kbd>
          </button>
          <button onClick={() => { setOpen(false); onExport(); }}>
            Export… <kbd>⇧⌘E</kbd>
          </button>
          <div className="menu-separator" />

          <label className="menu-row">
            <input
              type="checkbox"
              checked={appState.gridSize !== null}
              onChange={(e) => store.setAppState({ gridSize: e.target.checked ? 20 : null })}
            />
            Show grid
          </label>
          <label className="menu-row">
            <input
              type="checkbox"
              checked={appState.snapToObjects}
              onChange={(e) => store.setAppState({ snapToObjects: e.target.checked })}
            />
            Snap to objects
          </label>
          <label className="menu-row">
            <input
              type="checkbox"
              checked={appState.theme === "dark"}
              onChange={(e) =>
                store.setAppState({
                  theme: e.target.checked ? "dark" : "light",
                  viewBackgroundColor: e.target.checked ? "#121212" : "#ffffff",
                })
              }
            />
            Dark mode
          </label>

          <div className="menu-separator" />
          <div className="menu-label">Canvas background</div>
          <div className="swatches menu-swatches">
            {CANVAS_COLORS.map((color) => (
              <button
                key={color}
                className={`swatch ${appState.viewBackgroundColor === color ? "active" : ""}`}
                style={{ background: color }}
                onClick={() => store.setAppState({ viewBackgroundColor: color })}
              />
            ))}
            <input
              type="color"
              className="color-input"
              value={appState.viewBackgroundColor}
              onChange={(e) => store.setAppState({ viewBackgroundColor: e.target.value })}
            />
          </div>

          <div className="menu-separator" />
          <button onClick={() => { setOpen(false); onHelp(); }}>
            Keyboard shortcuts <kbd>?</kbd>
          </button>
          <button
            className="danger"
            onClick={() => {
              setOpen(false);
              onReset();
            }}
          >
            Reset canvas
          </button>
        </div>
      )}
    </div>
  );
};
