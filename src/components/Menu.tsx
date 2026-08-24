import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { store, useScene } from "../store";
import { APP_NAME, PALETTE } from "../constants";
import { setTheme } from "../theme";
import { tidyUp } from "../layout";
import { Tooltip } from "./Tooltip";
import { IconMenu } from "./icons";

interface MenuProps {
  onOpen: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onExport: () => void;
  onReset: () => void;
  onHelp: () => void;
  onHistory: () => void;
  onPresent: () => void;
  onToggleText: () => void;
  currentFileName: string | null;
  dirty: boolean;
  onRename: (name: string) => void;
}

export const Menu = ({
  onOpen,
  onSave,
  onSaveAs,
  onExport,
  onReset,
  onHelp,
  onHistory,
  onPresent,
  onToggleText,
  currentFileName,
  dirty,
  onRename,
}: MenuProps) => {
  const scene = useScene();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const { appState } = scene;
  const isDark = appState.theme === "dark";
  const run = (action: () => void) => () => {
    setOpen(false);
    action();
  };

  return (
    <div className="menu island" ref={ref}>
      <Tooltip label="Menu" placement="bottom">
        <button
          className={`menu-trigger ${open ? "active" : ""}`}
          aria-label="Menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <IconMenu />
        </button>
      </Tooltip>

      <FileName
        name={currentFileName}
        dirty={dirty}
        onRename={onRename}
      />

      {open && (
        <div className="menu-popover" role="menu">
          <MenuItem label="Open…" shortcut="⌘O" onClick={run(onOpen)} />
          <MenuItem label="Save" shortcut="⌘S" onClick={run(onSave)} />
          <MenuItem label="Save as…" shortcut="⇧⌘S" onClick={run(onSaveAs)} />
          <MenuItem label="Export…" shortcut="⇧⌘E" onClick={run(onExport)} />

          <MenuItem label="Version history…" shortcut="⌘H" onClick={run(onHistory)} />
          <MenuItem label="Present frames" shortcut="⇧⌘P" onClick={run(onPresent)} />
          <MenuItem label="Tidy up layout" shortcut="⇧⌘T" onClick={run(() => tidyUp())} />
          <MenuItem label="Diagram as text" shortcut="⌘/" onClick={run(onToggleText)} />

          <div className="menu-separator" />

          <MenuToggle
            label="Dark mode"
            checked={isDark}
            onChange={(next) => setTheme(next ? "dark" : "light")}
          />
          <MenuToggle
            label="Show grid"
            checked={appState.gridSize !== null}
            onChange={(next) => store.setAppState({ gridSize: next ? 20 : null })}
          />
          <MenuToggle
            label="Snap to objects"
            checked={appState.snapToObjects}
            onChange={(next) => store.setAppState({ snapToObjects: next })}
          />

          <div className="menu-separator" />
          <div className="menu-label">Canvas background</div>
          <div className="swatches menu-swatches">
            {PALETTE[appState.theme].canvas.map((color) => (
              <Tooltip key={color} label={color}>
                <button
                  className={`swatch ${appState.viewBackgroundColor === color ? "active" : ""}`}
                  style={{ background: color }}
                  aria-label={color}
                  onClick={() => store.setAppState({ viewBackgroundColor: color })}
                />
              </Tooltip>
            ))}
            <span className="swatch-divider" />
            <span className="swatch custom-swatch" style={{ background: appState.viewBackgroundColor }}>
              <input
                type="color"
                aria-label="Custom canvas colour"
                value={appState.viewBackgroundColor}
                onChange={(e) => store.setAppState({ viewBackgroundColor: e.target.value })}
              />
            </span>
          </div>

          <div className="menu-separator" />
          <MenuItem label="Keyboard shortcuts" shortcut="?" onClick={run(onHelp)} />
          <MenuItem label="Reset canvas" onClick={run(onReset)} danger />
        </div>
      )}
    </div>
  );
};

const MenuItem = ({
  label,
  shortcut,
  onClick,
  danger,
}: {
  label: string;
  shortcut?: string;
  onClick: () => void;
  danger?: boolean;
}) => (
  <button className={`menu-item ${danger ? "danger" : ""}`} role="menuitem" onClick={onClick}>
    <span>{label}</span>
    {shortcut && <kbd>{shortcut}</kbd>}
  </button>
);

const MenuToggle = ({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) => (
  <label className="menu-item menu-toggle">
    <span>{label}</span>
    <input
      type="checkbox"
      role="switch"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
    />
    <span className="switch" aria-hidden="true" />
  </label>
);

/** The document title, editable in place — click it and type. */
const FileName = ({
  name,
  dirty,
  onRename,
}: {
  name: string | null;
  dirty: boolean;
  onRename: (next: string) => void;
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useLayoutEffect(() => {
    if (!editing) return;
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    // select the stem, leaving any extension out of the way
    const dot = input.value.lastIndexOf(".");
    input.setSelectionRange(0, dot > 0 ? dot : input.value.length);
  }, [editing]);

  const start = () => {
    setDraft(name ?? "Untitled");
    setEditing(true);
  };

  const commit = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== name) onRename(trimmed);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="file-name-input"
        value={draft}
        aria-label="Drawing name"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            setEditing(false);
          }
        }}
      />
    );
  }

  return (
    <button className="file-meta" onClick={start} title={`Rename this ${APP_NAME} drawing`}>
      <span className="file-name">{name ?? "Untitled"}</span>
      <span className={`file-status ${dirty ? "is-dirty" : ""}`}>
        {dirty ? "Unsaved changes" : "Saved"}
      </span>
    </button>
  );
};
