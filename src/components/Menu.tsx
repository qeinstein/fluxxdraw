import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { store, useScene } from "../store";
import { APP_NAME, PALETTE } from "../constants";
import { setTheme } from "../theme";
import { Tooltip } from "./Tooltip";
import {
  IconClose,
  IconMenu,
  IconFolder,
  IconSave,
  IconImage,
  IconInstall,
  IconHistory,
  IconServices,
  IconGrid,
  IconMagnet,
  IconMoon,
  IconSun,
  IconGithub,
  IconTrash,
  IconCheck,
} from "./icons";
import { useIsMobile } from "../hooks/useMediaQuery";
import { sc } from "../shortcuts";

interface MenuProps {
  onOpen: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onExport: () => void;
  onQuickSave: () => void;
  onReset: () => void;
  onHistory: () => void;
  onServices: () => void;
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
  onHistory,
  onServices,
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
            <MenuSection>
              <MenuItem icon={<IconFolder />} label="Open…" shortcut={sc("open")} onClick={run(onOpen)} />
              <MenuItem icon={<IconSave />} label="Save" shortcut={sc("save")} onClick={run(onSave)} />
              <MenuItem icon={<IconSave />} label="Save as…" shortcut={sc("saveAs")} onClick={run(onSaveAs)} />
              <MenuItem icon={<IconImage />} label="Export…" shortcut={sc("export")} onClick={run(onExport)} />
              {isMobile && <MenuItem icon={<IconSave />} label="Quick save to export folder" onClick={run(onQuickSave)} />}
              {installPrompt && <MenuItem icon={<IconInstall />} label="Install FluxxDraw" onClick={install} />}
            </MenuSection>

            <MenuSection>
              <MenuItem icon={<IconHistory />} label="Version history…" shortcut={sc("history")} onClick={run(onHistory)} />
              <MenuItem icon={<IconServices />} label="Service library…" shortcut={sc("services")} onClick={run(onServices)} />
            </MenuSection>

            <MenuSection>
              <MenuItem
                icon={isDark ? <IconSun /> : <IconMoon />}
                label={isDark ? "Light mode" : "Dark mode"}
                onClick={() => setTheme(isDark ? "light" : "dark")}
              />
              <MenuItem
                icon={appState.gridSize !== null ? <IconCheck /> : <IconGrid />}
                label="Show grid"
                onClick={() => store.setAppState({ gridSize: appState.gridSize !== null ? null : 20 })}
              />
              <MenuItem
                icon={appState.snapToObjects ? <IconCheck /> : <IconMagnet />}
                label="Snap to objects"
                onClick={() => store.setAppState({ snapToObjects: !appState.snapToObjects })}
              />
              <div className="menu-label" style={{ paddingLeft: "32px" }}>Canvas background</div>
              <div className="swatches menu-swatches" style={{ paddingLeft: "32px", paddingBottom: "12px" }}>
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
            <div className="menu-footer-links" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <a href="https://github.com/qeinstein/fluxxdraw" target="_blank" rel="noreferrer" style={{ display: 'flex', gap: '6px', alignItems: 'center', textDecoration: 'none' }}>
                <IconGithub /> GitHub
              </a>
            </div>
            <MenuItem icon={<IconTrash />} label="Reset canvas" onClick={run(onReset)} danger />
          </footer>
        </aside>
      )}
    </div>
  );
};

const MenuSection = ({ children }: { label?: string; children: ReactNode }) => (
  <section className="menu-section">
    <div className="menu-section-items">{children}</div>
  </section>
);

const MenuItem = ({
  icon,
  label,
  shortcut,
  onClick,
  danger,
}: {
  icon?: ReactNode;
  label: string;
  shortcut?: string;
  onClick: () => void;
  danger?: boolean;
}) => (
  <button className={`menu-item ${danger ? "danger" : ""}`} role="menuitem" onClick={onClick}>
    <div className="menu-item-content">
      {icon && <span className="menu-item-icon">{icon}</span>}
      <span>{label}</span>
    </div>
    {shortcut && <kbd>{shortcut}</kbd>}
  </button>
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
    <button className="file-meta" onClick={start} title="Rename">
      <span className="file-name">{name ?? "Untitled"}</span>
      <span className={`file-status ${dirty ? "is-dirty" : ""}`}>
        {dirty ? "Unsaved changes" : "Saved"}
      </span>
    </button>
  );
};
