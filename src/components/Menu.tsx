import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { store, useScene } from "../store";
import { APP_NAME, PALETTE } from "../constants";
import { setTheme } from "../theme";
import { tidyUp } from "../layout";
import { Tooltip } from "./Tooltip";
import { IconClose, IconMenu } from "./icons";
import { useIsMobile } from "../hooks/useMediaQuery";
import { sc } from "../shortcuts";

interface MenuProps {
  onOpen: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onExport: () => void;
  onQuickSave: () => void;
  onReset: () => void;
  onHelp: () => void;
  onHistory: () => void;
  onPresent: () => void;
  onServices: () => void;
  onToggleText: () => void;
  currentFileName: string | null;
  dirty: boolean;
  onRename: (name: string) => void;
}

/** The browser emits this only after the installed app is eligible to install. */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export const Menu = ({
  onOpen,
  onSave,
  onSaveAs,
  onExport,
  onQuickSave,
  onReset,
  onHelp,
  onHistory,
  onPresent,
  onServices,
  onToggleText,
  currentFileName,
  dirty,
  onRename,
}: MenuProps) => {
  const scene = useScene();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  const { appState } = scene;
  const isDark = appState.theme === "dark";
  const run = (action: () => void) => () => {
    setOpen(false);
    action();
  };
  const install = async () => {
    const prompt = installPrompt;
    if (!prompt) return;
    setOpen(false);
    await prompt.prompt();
    await prompt.userChoice;
    setInstallPrompt(null);
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

      {/*
        * On a phone the bar has room for the trigger and nothing else, so the
        * document name moves inside the popover rather than being squeezed
        * against the Export button.
        */}
      {!isMobile && <FileName name={currentFileName} dirty={dirty} onRename={onRename} />}

      {open && (
        <aside className="menu-popover menu-sidebar" role="menu" aria-label="FluxxDraw menu">
          <header className="menu-sidebar-head">
            <div>
              <strong>{APP_NAME}</strong>
              <span>Your drawing stays on your device</span>
            </div>
            <button className="menu-sidebar-close" aria-label="Close menu" onClick={() => setOpen(false)}>
              <IconClose />
            </button>
          </header>

          {isMobile && (
            <div className="menu-file">
              <FileName name={currentFileName} dirty={dirty} onRename={onRename} />
            </div>
          )}

          <div className="menu-sidebar-content">
            <MenuSection label="File">
              <MenuItem label="Open…" shortcut={sc("open")} onClick={run(onOpen)} />
              <MenuItem label="Save" shortcut={sc("save")} onClick={run(onSave)} />
              <MenuItem label="Save as…" shortcut={sc("saveAs")} onClick={run(onSaveAs)} />
              <MenuItem label="Export…" shortcut={sc("export")} onClick={run(onExport)} />
              {isMobile && <MenuItem label="Quick save to export folder" onClick={run(onQuickSave)} />}
              {installPrompt && <MenuItem label="Install FluxxDraw" onClick={install} />}
            </MenuSection>

            <MenuSection label="Diagram">
              <MenuItem label="Version history…" shortcut={sc("history")} onClick={run(onHistory)} />
              <MenuItem label="Present frames" shortcut={sc("present")} onClick={run(onPresent)} />
              <MenuItem label="Service library…" shortcut={sc("services")} onClick={run(onServices)} />
              <MenuItem label="Tidy up layout" shortcut={sc("tidyUp")} onClick={run(() => tidyUp())} />
              <MenuItem label="Diagram as text" shortcut={sc("diagramText")} onClick={run(onToggleText)} />
            </MenuSection>

            <MenuSection label="Canvas">
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
            </MenuSection>
          </div>

          <footer className="menu-sidebar-footer">
            <MenuItem label="Keyboard shortcuts" shortcut="?" onClick={run(onHelp)} />
            <div className="menu-footer-links">
              <a href="https://github.com/qeinstein/fluxxdraw" target="_blank" rel="noreferrer">
                GitHub <span aria-hidden="true">↗</span>
              </a>
              <a
                href="https://github.com/qeinstein/fluxxdraw/blob/main/CHANGELOG.md"
                target="_blank"
                rel="noreferrer"
              >
                Changelog <span aria-hidden="true">↗</span>
              </a>
            </div>
            <MenuItem label="Reset canvas" onClick={run(onReset)} danger />
          </footer>
        </aside>
      )}
    </div>
  );
};

const MenuSection = ({ label, children }: { label: string; children: ReactNode }) => (
  <section className="menu-section">
    <h2>{label}</h2>
    <div className="menu-section-items">{children}</div>
  </section>
);

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
