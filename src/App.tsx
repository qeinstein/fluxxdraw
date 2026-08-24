import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "./components/Canvas";
import { Toolbar } from "./components/Toolbar";
import { StylePanel } from "./components/StylePanel";
import { Menu } from "./components/Menu";
import { ZoomControls } from "./components/ZoomControls";
import { ExportDialog } from "./components/ExportDialog";
import { HelpDialog } from "./components/HelpDialog";
import { TextEditor } from "./components/TextEditor";
import { Tooltip } from "./components/Tooltip";
import { IconRedo, IconUndo } from "./components/icons";
import { store, useScene } from "./store";
import { useKeyboardShortcuts } from "./hooks/useKeyboard";
import { readFile } from "./io/openScene";
import { sceneToJson, serializeScene } from "./io/serialize";
import {
  getStoredExportDirectory,
  openWithPicker,
  saveExport,
  saveWithPicker,
  writeToFileHandle,
} from "./io/fileSystem";
import { loadPreferences, savePreferences, type Preferences } from "./io/preferences";
import { consumeLaunchFiles, registerServiceWorker } from "./io/launchHandler";
import { newImageElement, syncFrameCounter } from "./elements/factory";
import { preloadFiles } from "./render/imageCache";
import { reconcileFrameMembership } from "./actions";
import { APP_NAME, FILE_EXTENSION } from "./constants";
import { inferTheme } from "./theme";
import type { BinaryFile, SceneDocument } from "./types";

const AUTOSAVE_KEY = "fluxxdraw:autosave";
const AUTOSAVE_DEBOUNCE_MS = 800;

export default function App() {
  const scene = useScene();
  const [prefs, setPrefs] = useState<Preferences>(() => loadPreferences());
  const [exportOpen, setExportOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const fileHandleRef = useRef<FileSystemFileHandle | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const lastSavedVersion = useRef(0);

  /**
   * Derived rather than stored: the scene version already tells us whether
   * there are unsaved changes. Keeping it as state meant a setState on every
   * single store emit, which React counts as a nested update and which
   * stuttered fast typing.
   */
  const dirty = scene.getVersion() !== lastSavedVersion.current;
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast((current) => (current === message ? null : current)), 3200);
  }, []);

  // --- preferences ---------------------------------------------------------

  const updatePrefs = useCallback((patch: Partial<Preferences>) => {
    setPrefs((current) => {
      const next = { ...current, ...patch };
      savePreferences(next);
      return next;
    });
  }, []);

  // apply saved view preferences and reconnect the export folder on first load
  useEffect(() => {
    store.setAppState({
      viewBackgroundColor: prefs.viewBackgroundColor,
      theme: prefs.theme,
      gridSize: prefs.gridSize,
      snapToObjects: prefs.snapToObjects,
    });
    getStoredExportDirectory().then((dir) => {
      if (dir && dir.name !== prefs.exportDirectoryName) {
        updatePrefs({ exportDirectoryName: dir.name });
      }
    });
    // intentionally first-mount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // mirror view settings back into preferences when they change in the UI
  useEffect(() => {
    const { viewBackgroundColor, theme, gridSize, snapToObjects } = scene.appState;
    if (
      viewBackgroundColor !== prefs.viewBackgroundColor ||
      theme !== prefs.theme ||
      gridSize !== prefs.gridSize ||
      snapToObjects !== prefs.snapToObjects
    ) {
      updatePrefs({ viewBackgroundColor, theme, gridSize, snapToObjects });
    }
  }, [scene.appState, prefs, updatePrefs]);

  useEffect(() => {
    document.documentElement.dataset.theme = scene.appState.theme;
  }, [scene.appState.theme]);

  // --- autosave (crash recovery only; the real copy is the user's file) ----

  const currentDocument = useCallback(
    (): SceneDocument =>
      serializeScene(store.elements, store.files, store.appState, store.timeline.checkpoints),
    [],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(AUTOSAVE_KEY, sceneToJson(currentDocument()));
      } catch {
        // scenes with big images can exceed the quota; the user's files are authoritative
      }
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [scene.getVersion(), currentDocument]);

  // restore the last session so a refresh doesn't lose work
  useEffect(() => {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return;
    try {
      const doc = JSON.parse(raw) as SceneDocument;
      if (!doc.elements?.length) return;
      store.loadScene(doc.elements, doc.files ?? {}, doc.appState, doc.history);
      syncFrameCounter(doc.elements);
      preloadFiles(doc.files ?? {});
    } catch {
      localStorage.removeItem(AUTOSAVE_KEY);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (dirtyRef.current && store.elements.length > 0) event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  // --- opening -------------------------------------------------------------

  const applyOpenResult = useCallback(
    async (file: File, handle: FileSystemFileHandle | null) => {
      const result = await readFile(file);

      if (result.kind === "scene") {
        // files from other tools may not record a theme, so infer one
        const theme = inferTheme(result.doc.appState.viewBackgroundColor);
        store.loadScene(
          result.doc.elements,
          result.doc.files,
          { ...result.doc.appState, theme },
          result.doc.history,
        );
        syncFrameCounter(result.doc.elements);
        await preloadFiles(result.doc.files);
        fileHandleRef.current = handle;
        setFileName(handle?.name ?? file.name);
        lastSavedVersion.current = store.getVersion();
        store.emit();
        showToast(`Opened ${file.name}`);
        return;
      }

      insertImage(result.file, result.width, result.height);
      showToast(`Placed ${file.name}`);
    },
    [showToast],
  );

  const insertImage = (file: BinaryFile, naturalWidth: number, naturalHeight: number) => {
    // scale large images down so they land at a sane size on the canvas
    const maxSide = 480;
    const factor = Math.min(1, maxSide / Math.max(naturalWidth, naturalHeight));
    const width = naturalWidth * factor;
    const height = naturalHeight * factor;

    const container = document.querySelector(".canvas-container");
    const rect = container?.getBoundingClientRect();
    const { scrollX, scrollY, zoom } = store.appState;
    const centreX = rect ? rect.width / (2 * zoom) - scrollX : 0;
    const centreY = rect ? rect.height / (2 * zoom) - scrollY : 0;

    store.mutate(() => {
      store.addFile(file);
      const element = newImageElement(
        store.appState,
        centreX - width / 2,
        centreY - height / 2,
        file.id,
        width,
        height,
      );
      store.addElements(element);
      store.appState = { ...store.appState, selectedIds: [element.id], tool: "selection" };
    });
    preloadFiles({ [file.id]: file });
  };

  const handleOpen = useCallback(async () => {
    try {
      const picked = await openWithPicker();
      if (!picked) return;
      await applyOpenResult(picked.file, picked.handle);
    } catch (error) {
      showToast(`Could not open the file: ${(error as Error).message}`);
    }
  }, [applyOpenResult, showToast]);

  // Files double-clicked in the OS arrive here, once the app is installed.
  useEffect(() => {
    registerServiceWorker();
    consumeLaunchFiles((file, handle) => {
      applyOpenResult(file, handle).catch((error) =>
        showToast(`Could not open ${file.name}: ${(error as Error).message}`),
      );
    });
    // the launch queue only accepts one consumer, so register on mount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- saving --------------------------------------------------------------

  const handleSaveAs = useCallback(async () => {
    const blob = new Blob([sceneToJson(currentDocument())], { type: "application/json" });
    const suggested = `${(fileName ?? "drawing").replace(/\.[^.]+$/, "")}.${FILE_EXTENSION}`;
    try {
      const saved = await saveWithPicker(blob, suggested, [
        {
          description: "Drawing",
          accept: { "application/json": [`.${FILE_EXTENSION}`, ".excalidraw", ".json"] },
        },
      ]);
      if (!saved) {
        // no picker support: the blob was downloaded instead
        showToast(`Downloaded ${suggested}`);
        return;
      }
      fileHandleRef.current = saved.handle;
      setFileName(saved.handle.name);
      lastSavedVersion.current = store.getVersion();
      showToast(`Saved ${saved.handle.name}`);
    } catch (error) {
      showToast(`Save failed: ${(error as Error).message}`);
    }
  }, [currentDocument, fileName, showToast]);

  const handleSave = useCallback(async () => {
    const handle = fileHandleRef.current;
    if (!handle) {
      await handleSaveAs();
      return;
    }
    const blob = new Blob([sceneToJson(currentDocument())], { type: "application/json" });
    try {
      const result = await writeToFileHandle(handle, blob);
      if (!result) {
        // the permission grant lapsed, so fall back to a fresh picker
        await handleSaveAs();
        return;
      }
      lastSavedVersion.current = store.getVersion();
      showToast(`Saved ${result.filename}`);
    } catch (error) {
      showToast(`Save failed: ${(error as Error).message}`);
    }
  }, [currentDocument, handleSaveAs, showToast]);

  /** Quick export straight into the configured folder, bypassing the dialog. */
  const quickExportJson = useCallback(async () => {
    const blob = new Blob([sceneToJson(currentDocument())], { type: "application/json" });
    const result = await saveExport(blob, `${prefs.exportSettings.filename || "drawing"}.${FILE_EXTENSION}`);
    showToast(
      result.destination === "directory"
        ? `Saved ${result.filename} to ${result.directoryName}`
        : `Downloaded ${result.filename}`,
    );
  }, [currentDocument, prefs.exportSettings.filename, showToast]);

  // --- drag & drop, paste --------------------------------------------------

  useEffect(() => {
    const onDrop = async (event: DragEvent) => {
      event.preventDefault();
      const file = event.dataTransfer?.files?.[0];
      if (!file) return;
      try {
        await applyOpenResult(file, null);
      } catch (error) {
        showToast(`Could not open that file: ${(error as Error).message}`);
      }
    };
    const onDragOver = (event: DragEvent) => event.preventDefault();

    window.addEventListener("drop", onDrop);
    window.addEventListener("dragover", onDragOver);
    return () => {
      window.removeEventListener("drop", onDrop);
      window.removeEventListener("dragover", onDragOver);
    };
  }, [applyOpenResult, showToast]);

  useEffect(() => {
    const onPaste = async (event: ClipboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "TEXTAREA" || target.tagName === "INPUT")) return;

      const imageItem = Array.from(event.clipboardData?.items ?? []).find((item) =>
        item.type.startsWith("image/"),
      );
      if (imageItem) {
        const blob = imageItem.getAsFile();
        if (blob) {
          event.preventDefault();
          await applyOpenResult(new File([blob], "pasted-image.png", { type: blob.type }), null);
        }
        return;
      }

      const text = event.clipboardData?.getData("text/plain");
      if (text?.trim().startsWith("{")) {
        try {
          const file = new File([text], `pasted.${FILE_EXTENSION}`, { type: "application/json" });
          await applyOpenResult(file, null);
          event.preventDefault();
        } catch {
          // not a scene; let the paste fall through
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [applyOpenResult]);

  // --- keyboard ------------------------------------------------------------

  const keyboardHandlers = useMemo(
    () => ({
      onOpen: handleOpen,
      onSave: handleSave,
      onSaveAs: handleSaveAs,
      onExport: () => setExportOpen(true),
      onHelp: () => setHelpOpen(true),
      onEscape: () => {
        setExportOpen(false);
        setHelpOpen(false);
      },
    }),
    [handleOpen, handleSave, handleSaveAs],
  );
  useKeyboardShortcuts(keyboardHandlers);

  // --- render --------------------------------------------------------------

  const editingTextId = scene.appState.editingTextId;

  return (
    <div className={`app theme-${scene.appState.theme}`}>
      <Canvas
        onDoubleClickText={(id) => store.setAppState({ editingTextId: id })}
        onRequestImage={() => imageInputRef.current?.click()}
      />

      {editingTextId && (
        <TextEditor
          elementId={editingTextId}
          onDone={() => {
            store.setAppState({ editingTextId: null, tool: "selection" });
            reconcileFrameMembership();
          }}
        />
      )}

      <div className="ui-layer">
        <div className="top-left">
          <Menu
            onOpen={handleOpen}
            onSave={handleSave}
            onSaveAs={handleSaveAs}
            onExport={() => setExportOpen(true)}
            onReset={() => {
              if (!window.confirm(`Clear the ${APP_NAME} canvas? This can't be undone.`)) return;
              store.resetScene();
              fileHandleRef.current = null;
              setFileName(null);
              localStorage.removeItem(AUTOSAVE_KEY);
            }}
            onHelp={() => setHelpOpen(true)}
            currentFileName={fileName}
            dirty={dirty}
          />
          <StylePanel />
        </div>

        <div className="top-centre">
          <Toolbar />
        </div>

        <div className="top-right">
          <Tooltip
            label={`Save a .${FILE_EXTENSION} copy to your export folder`}
            placement="bottom"
          >
            <button className="island ghost-button" onClick={quickExportJson}>
              Quick save
            </button>
          </Tooltip>
          <Tooltip label="Export as an image or file" shortcut="⇧⌘E" placement="bottom">
            <button className="island export-button" onClick={() => setExportOpen(true)}>
              Export
            </button>
          </Tooltip>
        </div>

        <div className="bottom-left">
          <ZoomControls />
          <div className="island history-controls">
            <Tooltip label="Undo" shortcut="⌘Z" placement="top">
              <button aria-label="Undo" onClick={() => store.undo()} disabled={!scene.canUndo()}>
                <IconUndo />
              </button>
            </Tooltip>
            <Tooltip label="Redo" shortcut="⇧⌘Z" placement="top">
              <button aria-label="Redo" onClick={() => store.redo()} disabled={!scene.canRedo()}>
                <IconRedo />
              </button>
            </Tooltip>
          </div>
        </div>
      </div>

      {exportOpen && (
        <ExportDialog
          settings={prefs.exportSettings}
          onChange={(exportSettings) => updatePrefs({ exportSettings })}
          onClose={() => setExportOpen(false)}
          directoryName={prefs.exportDirectoryName}
          onDirectoryChange={(exportDirectoryName) => updatePrefs({ exportDirectoryName })}
        />
      )}

      {helpOpen && <HelpDialog onClose={() => setHelpOpen(false)} />}

      {toast && <div className="toast">{toast}</div>}

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          try {
            await applyOpenResult(file, null);
          } catch (error) {
            showToast(`Could not read that image: ${(error as Error).message}`);
          }
        }}
      />
    </div>
  );
}
