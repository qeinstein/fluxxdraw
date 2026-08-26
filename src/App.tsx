import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "./components/Canvas";
import { Toolbar } from "./components/Toolbar";
import { StylePanel, hasStyleControls } from "./components/StylePanel";
import { Menu } from "./components/Menu";
import { ZoomControls, zoomToElement } from "./components/ZoomControls";
import { ExportDialog } from "./components/ExportDialog";
import { TimelinePanel } from "./components/TimelinePanel";
import { parseCollaborationPath } from "./io/collaboration";
import { JoinDialog, CollaborationMenu } from "./components/CollaborationDialogs";
import { Presentation } from "./components/Presentation";
import { ComponentControls } from "./components/ComponentControls";
import { DiagramTextPanel } from "./components/DiagramTextPanel";
import { ContextMenu, type ContextMenuRequest } from "./components/ContextMenu";
import { Library } from "./components/Library";
import { CommandPalette } from "./components/CommandPalette";
import { Minimap } from "./components/Minimap";
import { SelectionToolbar } from "./components/SelectionToolbar";
import { WorkspacePanel } from "./components/WorkspacePanel";
import { CommentPins } from "./components/CommentPins";
import { ToolHint } from "./components/ToolHint";
import type { ComponentEditSession } from "./components-model";
import { InputDialog, type InputDialogRequest } from "./components/InputDialog";
import { cancelPrompt, setPromptHandler } from "./prompt";
import { TextEditor } from "./components/TextEditor";
import { Tooltip } from "./components/Tooltip";
import {
  IconClose,
  IconCommand,
  IconEye,
  IconEyeOff,
  IconSave,
  IconSliders,
  IconUndo,
  IconRedo,
  IconLibrary,
  IconMenu,
} from "./components/icons";
import { store, useScene } from "./store";
import { useKeyboardShortcuts } from "./hooks/useKeyboard";
import { MOBILE_QUERY, useIsMobile } from "./hooks/useMediaQuery";
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
import { loadFonts } from "./fonts";
import { track } from "./analytics";
import { linkedElementFromUrl } from "./links";
import { reconcileFrameMembership, refreshTextLayout } from "./actions";
import { newImageElement, syncFrameCounter } from "./elements/factory";
import { preloadFiles } from "./render/imageCache";
import { recordRecentDocument, recordRecoverySnapshot } from "./workspaceData";

import { APP_NAME, FILE_EXTENSION, PALETTE } from "./constants";
import { inferTheme } from "./theme";
import type { BinaryFile, SceneDocument } from "./types";
import { sc } from "./shortcuts";

const AUTOSAVE_KEY = "fluxxdraw:autosave";
const AUTOSAVE_DEBOUNCE_MS = 800;

export default function App() {
  const scene = useScene();
  const [prefs, setPrefs] = useState<Preferences>(() => loadPreferences());
  const [exportOpen, setExportOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryDocked, setLibraryDocked] = useState(() => localStorage.getItem("fluxx_library_docked") === "true");

  const [presenting, setPresenting] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [promptRequest, setPromptRequest] = useState<InputDialogRequest | null>(null);
  const [textPanelOpen, setTextPanelOpen] = useState(false);
  const [componentSession, setComponentSession] = useState<{
    session: ComponentEditSession;
    instanceId: string;
  } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [styleSheetOpen, setStyleSheetOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuRequest | null>(null);
  const isMobile = useIsMobile();

  const [isJoinDialogOpen, setIsJoinDialogOpen] = useState(false);
  const [collabRoom, setCollabRoom] = useState<{ room: string } | null>(null);

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

  /** Phones only have room for one docked panel at a time. */
  const openPanel = useCallback(
    (panel: "history" | "text" | null) => {
      const solo = window.matchMedia(MOBILE_QUERY).matches;
      setHistoryOpen(panel === "history" ? true : solo ? false : (v) => v);
      setTextPanelOpen(panel === "text" ? true : solo ? false : (v) => v);
    },
    [],
  );

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

  const openExportDialog = useCallback(() => {
    setExportOpen(true);
  }, []);

  // apply saved view preferences and reconnect the export folder on first load
  useEffect(() => {
    store.setAppState({
      viewBackgroundColor: prefs.viewBackgroundColor,
      theme: prefs.theme,
      currentStyle: {
        ...store.appState.currentStyle,
        strokeColor: PALETTE[prefs.theme].stroke[0],
      },
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

  // Text is measured against real font metrics, so anything laid out before
  // the webfonts arrive needs re-measuring once they do.
  useEffect(() => {
    let cancelled = false;
    loadFonts().then(() => {
      if (cancelled) return;
      const textIds = store.elements
        .filter((el) => el.type === "text")
        .map((el) => el.id);
      if (textIds.length) refreshTextLayout(textIds);
      store.emit();
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // --- autosave (crash recovery only; the real copy is the user's file) ----

  const currentDocument = useCallback(
    (): SceneDocument =>
      serializeScene(
        store.elements,
        store.files,
        store.appState,
        store.timeline.checkpoints,
        store.components,
      ),
    [],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(AUTOSAVE_KEY, sceneToJson(currentDocument()));
        recordRecoverySnapshot(fileName ?? "Untitled.fluxx", currentDocument());
      } catch {
        // scenes with big images can exceed the quota; the user's files are authoritative
      }
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [scene.getVersion(), currentDocument, fileName]);

  // restore the last session so a refresh doesn't lose work
  useEffect(() => {
    const collabPath = parseCollaborationPath();
    if (collabPath) {
      setCollabRoom(collabPath);
      setIsJoinDialogOpen(true);
      return;
    }

    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return;
    try {
      const doc = JSON.parse(raw) as SceneDocument;
      store.loadScene(doc.elements ?? [], doc.files ?? {}, doc.appState, doc.history, doc.components);
      if (doc.elements?.length) {
        syncFrameCounter(doc.elements);
      }
      preloadFiles(doc.files ?? {});
    } catch {
      localStorage.removeItem(AUTOSAVE_KEY);
    }
    const requestedViewMode = new URLSearchParams(window.location.search).get("viewMode");
    if (requestedViewMode !== null) {
      store.setAppState({ viewMode: requestedViewMode !== "0" && requestedViewMode !== "false" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
   * A link someone was sent lands here: once the scene is on screen, jump to
   * the element it names. Runs after restore, so the element exists by then.
   */
  useEffect(() => {
    const jump = (target: string | null) => {
      if (!target) return;
      if (!zoomToElement(target)) {
        showToast("That link points at something that isn't in this drawing.");
      }
    };

    // on load, once the restored scene is on screen
    const timer = window.setTimeout(() => jump(linkedElementFromUrl()), 120);
    /*
     * And on later changes: pasting a link into the address bar of an open tab
     * only moves the fragment, which doesn't reload anything, so without this
     * the link would appear to do nothing.
     */
    const onHashChange = () => jump(linkedElementFromUrl());
    window.addEventListener("hashchange", onHashChange);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("hashchange", onHashChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (dirtyRef.current && store.elements.length > 0) event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // prevent saving via browser default
      if (e.key.toLowerCase() === "s" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        quickExportJson();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!(event.target as Element).closest('.top-right-more-menu')) {
        setMoreMenuOpen(false);
      }
    };
    if (moreMenuOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [moreMenuOpen]);

  useEffect(() => {
    const handleAlert = (e: Event) => {
      setAlertMessage((e as CustomEvent<string>).detail);
    };
    window.addEventListener("fluxxdraw:alert", handleAlert);
    return () => window.removeEventListener("fluxxdraw:alert", handleAlert);
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
          result.doc.components,
        );
        syncFrameCounter(result.doc.elements);
        await preloadFiles(result.doc.files);
        fileHandleRef.current = handle;
        setFileName(handle?.name ?? file.name);
        recordRecentDocument(handle?.name ?? file.name, result.doc);
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

  /**
   * Renames the document. The extension is kept (or added), and the name is
   * also used as the default for exports so both stay in step.
   */
  const renameDocument = useCallback(
    (next: string) => {
      const stem = next.replace(/\.[^.]+$/, "").trim();
      if (!stem) return;
      const extension = fileName?.match(/\.[^.]+$/)?.[0] ?? `.${FILE_EXTENSION}`;
      setFileName(`${stem}${extension}`);
      updatePrefs({
        exportSettings: { ...prefs.exportSettings, filename: stem },
      });
      // the handle still points at the old file, so Save must ask again
      fileHandleRef.current = null;
    },
    [fileName, prefs.exportSettings, updatePrefs],
  );

  const handleOpen = useCallback(async () => {
    try {
      const picked = await openWithPicker();
      if (!picked) return;
      await applyOpenResult(picked.file, picked.handle);
    } catch (error) {
      showToast(`Could not open the file: ${(error as Error).message}`);
    }
  }, [applyOpenResult, showToast]);

  // route in-app prompts (embed URLs, component names) through the dialog
  useEffect(() => {
    setPromptHandler(setPromptRequest);
    return () => setPromptHandler(null);
  }, []);

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
      recordRecentDocument(saved.handle.name, currentDocument());
      recordRecoverySnapshot(saved.handle.name, currentDocument(), true);
      lastSavedVersion.current = store.getVersion();
      store.timeline.labelLatest(`Saved ${saved.handle.name}`);
      showToast(`Saved ${saved.handle.name}`);
    } catch (error) {
      showToast(`Save failed: ${(error as Error).message}`);
    }
  }, [currentDocument, fileName, showToast]);

  const handleSave = useCallback(async () => {
    track("save");
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
      recordRecentDocument(result.filename, currentDocument());
      recordRecoverySnapshot(result.filename, currentDocument(), true);
      store.timeline.labelLatest(`Saved ${result.filename}`);
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
    return () => {
      window.removeEventListener("paste", onPaste);
    };
  }, [applyOpenResult]);

  // --- keyboard ------------------------------------------------------------

  const onRequestImage = useCallback(() => imageInputRef.current?.click(), []);

  const keyboardHandlers = useMemo(
    () => ({
      onOpen: handleOpen,
      onSave: handleSave,
      onSaveAs: handleSaveAs,
      onExport: openExportDialog,
      onHelp: () => setCommandOpen(true),
      onHistory: () => openPanel("history"),
      onImage: onRequestImage,
      onEscape: () => {
        setExportOpen(false);
        setHistoryOpen(false);
        setStyleSheetOpen(false);
        setContextMenu(null);
        setCommandOpen(false);
        if (!libraryDocked) setLibraryOpen(false);
      },
      onPresent: () => {
        track("present");
        setPresenting(true);
      },
      onServices: () => setLibraryOpen(true),
      onToggleText: () => {
        track("text");
        return textPanelOpen ? openPanel(null) : openPanel("text");
      },
      onToggleCommandPalette: () => setCommandOpen((open) => !open),
      onToggleViewMode: () => store.setAppState({ viewMode: !store.appState.viewMode }),
    }),
    [handleOpen, handleSave, handleSaveAs, libraryDocked, onRequestImage, openPanel, textPanelOpen],
  );
  useKeyboardShortcuts(keyboardHandlers);

  // --- render --------------------------------------------------------------

  const editingTextId = scene.appState.editingTextId;

  const componentControls = (
    <ComponentControls
      session={componentSession?.session ?? null}
      editingInstanceId={componentSession?.instanceId ?? null}
      onSessionChange={(session, instanceId) =>
        setComponentSession(session && instanceId ? { session, instanceId } : null)
      }
    />
  );

  /**
   * On mobile the style controls live in a sheet. An active component edit
   * session has to keep it open, otherwise there is no way back out of it.
   */
  const styleAvailable = hasStyleControls(scene.getSelected(), scene.appState.tool);
  const sheetOpen = isMobile && (styleSheetOpen || componentSession !== null);

  return (
    <div className={`app theme-${scene.appState.theme}${scene.appState.viewMode ? " is-view-mode" : ""}`}>
      <Canvas
        onDoubleClickText={(id) => store.setAppState({ editingTextId: id })}
        onRequestImage={() => imageInputRef.current?.click()}
        onContextMenu={setContextMenu}
        onLinkProblem={showToast}
      />

      {editingTextId && (
        <TextEditor
          /*
           * Keyed so switching straight from one text to another gets a fresh
           * editor: without it React reuses the instance and its stale draft.
           */
          key={editingTextId}
          elementId={editingTextId}
          onDone={() => {
            store.setAppState({ editingTextId: null, tool: "selection" });
            reconcileFrameMembership();
          }}
        />
      )}

      <div className={`ui-layer${isMobile ? " is-mobile" : ""}${libraryOpen && libraryDocked && !isMobile ? " has-docked-library" : ""}`}>
        <div className="top-left" style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
          <Menu
            onOpen={handleOpen}
            onSave={handleSave}
            onSaveAs={handleSaveAs}
            onExport={openExportDialog}
            onQuickSave={quickExportJson}
            onReset={() => setResetConfirmOpen(true)}
            onHistory={() => openPanel("history")}
            onServices={() => setLibraryOpen(true)}
            onWorkspace={() => setWorkspaceOpen(true)}
            currentFileName={fileName}
            dirty={dirty}
            onRename={renameDocument}
          />
          {!isMobile && (
            <>
              <StylePanel />
              {componentControls}
            </>
          )}
        </div>

        <div className="top-centre">
          <Toolbar onImage={onRequestImage} />
          <ToolHint tool={scene.appState.tool} />
          {scene.appState.viewMode && <div className="view-mode-banner">View-only</div>}
        </div>

        {!isMobile && <SelectionToolbar />}
        {!isMobile && <CommentPins />}

        <div className="top-right">
          <div className="island top-right-actions" style={{ display: 'flex', alignItems: 'center' }}>
            <CollaborationMenu />
            
            <Tooltip label="Export as an image or file" shortcut={sc("export")} placement="bottom">
              <button className="export-button" onClick={openExportDialog}>
                Export
              </button>
            </Tooltip>

            <div className="top-right-more-menu" style={{ position: 'relative' }}>
              <button
                className={`icon-button ${moreMenuOpen ? "active" : ""}`}
                aria-label="More options"
                onClick={() => setMoreMenuOpen(!moreMenuOpen)}
              >
                <IconMenu />
              </button>

              {moreMenuOpen && (
                <div
                  className="collab-popover"
                  style={{
                    position: 'absolute', top: '100%', right: '0', marginTop: '8px',
                    background: 'var(--surface)', border: '1px solid var(--line)',
                    borderRadius: 'var(--radius-md)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    width: '220px', zIndex: 100, padding: '6px 0', display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <button
                    className="menu-item"
                    onClick={() => { setMoreMenuOpen(false); quickExportJson(); }}
                    style={{ textAlign: 'left', padding: '8px 16px', background: 'transparent', border: 'none', width: '100%', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <IconSave /> Save to file
                  </button>
                  <button
                    className="menu-item"
                    onClick={() => { setMoreMenuOpen(false); store.setAppState({ viewMode: !scene.appState.viewMode }); }}
                    style={{ textAlign: 'left', padding: '8px 16px', background: 'transparent', border: 'none', width: '100%', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    {scene.appState.viewMode ? <IconEyeOff /> : <IconEye />}
                    {scene.appState.viewMode ? "Exit view-only mode" : "View-only mode"}
                  </button>
                  <button
                    className="menu-item"
                    onClick={() => { setMoreMenuOpen(false); setLibraryOpen(!libraryOpen); }}
                    style={{ textAlign: 'left', padding: '8px 16px', background: 'transparent', border: 'none', width: '100%', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <IconLibrary /> Library
                  </button>
                  <button
                    className="menu-item"
                    onClick={() => { setMoreMenuOpen(false); setCommandOpen(true); }}
                    style={{ textAlign: 'left', padding: '8px 16px', background: 'transparent', border: 'none', width: '100%', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <IconCommand /> Command Palette
                  </button>
                </div>
              )}
            </div>

            {isMobile && (
              <button
                className={`tool-button sheet-toggle ${sheetOpen ? "active" : ""} ${
                  styleAvailable ? "has-options" : ""
                }`}
                aria-label={sheetOpen ? "Hide style options" : "Show style options"}
                aria-expanded={sheetOpen}
                onClick={() => setStyleSheetOpen((v) => !v)}
              >
                <IconSliders />
              </button>
            )}
          </div>
        </div>

        <div className="bottom-left">
          <ZoomControls />
          <div className="island history-controls">
            <Tooltip label="Undo" shortcut={sc("undo")} placement="top">
              <button aria-label="Undo" onClick={() => store.undo()} disabled={!scene.canUndo()}>
                <IconUndo />
              </button>
            </Tooltip>
            <Tooltip label="Redo" shortcut={sc("redo")} placement="top">
              <button aria-label="Redo" onClick={() => store.redo()} disabled={!scene.canRedo()}>
                <IconRedo />
              </button>
            </Tooltip>
          </div>
        </div>

        {isMobile && sheetOpen && (
          <div className="mobile-sheet" role="dialog" aria-label="Style options">
            <div className="mobile-sheet-head">
              <span>Style</span>
              <button
                className="icon-button"
                aria-label="Close style options"
                onClick={() => setStyleSheetOpen(false)}
              >
                <IconClose />
              </button>
            </div>
            <div className="mobile-sheet-body">
              <StylePanel />
              {componentControls}
            </div>
          </div>
        )}

        {!isMobile && <Minimap />}
      </div>

      <CommandPalette
        isOpen={commandOpen}
        onClose={() => setCommandOpen(false)}
        onOpenExport={openExportDialog}
        onOpenLibrary={() => setLibraryOpen(true)}
        onTogglePresentation={() => setPresenting(true)}
      />

      {resetConfirmOpen && (
        <div className="dialog-backdrop" onClick={() => setResetConfirmOpen(false)}>
          <div className="dialog compact" onClick={(e) => e.stopPropagation()}>
            <header>
              <h2>Clear canvas</h2>
              <button className="icon-button" aria-label="Close" onClick={() => setResetConfirmOpen(false)}>
                <IconClose />
              </button>
            </header>
            <div className="dialog-body">
              <p>Are you sure you want to clear the {APP_NAME} canvas? This cannot be undone.</p>
            </div>
            <footer>
              <div style={{ flex: 1 }} />
              <button className="ghost-button" onClick={() => setResetConfirmOpen(false)}>
                Cancel
              </button>
              <button
                className="export-button danger"
                style={{ background: "var(--danger)", color: "var(--surface)" }}
                onClick={() => {
                  store.resetScene();
                  fileHandleRef.current = null;
                  setFileName(null);
                  localStorage.removeItem(AUTOSAVE_KEY);
                  setResetConfirmOpen(false);
                }}
              >
                Clear canvas
              </button>
            </footer>
          </div>
        </div>
      )}

      {alertMessage && (
        <div className="dialog-backdrop" onClick={() => setAlertMessage(null)}>
          <div className="dialog compact" onClick={(e) => e.stopPropagation()}>
            <header>
              <h2>Notice</h2>
              <button className="icon-button" aria-label="Close" onClick={() => setAlertMessage(null)}>
                <IconClose />
              </button>
            </header>
            <div className="dialog-body">
              <p>{alertMessage}</p>
            </div>
            <footer>
              <div style={{ flex: 1 }} />
              <button className="primary" onClick={() => setAlertMessage(null)}>
                OK
              </button>
            </footer>
          </div>
        </div>
      )}

      {isJoinDialogOpen && collabRoom && (
        <JoinDialog 
          room={collabRoom.room} 
          onJoin={() => {
            setCollabRoom(null);
            setIsJoinDialogOpen(false);
          }}
          onCancel={() => {
            setCollabRoom(null);
            window.history.replaceState(null, "", window.location.pathname.replace(/\/session\/[A-Za-z0-9]+/, ''));
            setIsJoinDialogOpen(false);
          }}
        />
      )}
      
      {exportOpen && (
        <ExportDialog
          settings={prefs.exportSettings}
          onChange={(exportSettings) => updatePrefs({ exportSettings })}
          onClose={() => setExportOpen(false)}
          directoryName={prefs.exportDirectoryName}
          onDirectoryChange={(exportDirectoryName) => updatePrefs({ exportDirectoryName })}
        />
      )}

      {libraryOpen && <Library 
        onClose={() => setLibraryOpen(false)} 
        docked={libraryDocked}
        onDockToggle={() => {
          const next = !libraryDocked;
          setLibraryDocked(next);
          localStorage.setItem("fluxx_library_docked", next.toString());
        }}
      />}

      {workspaceOpen && (
        <WorkspacePanel
          onClose={() => setWorkspaceOpen(false)}
          onBrowse={handleOpen}
          onOpen={(document, name) => {
            store.loadScene(document.elements, document.files ?? {}, document.appState, document.history, document.components);
            syncFrameCounter(document.elements);
            preloadFiles(document.files ?? {});
            setFileName(name);
            lastSavedVersion.current = store.getVersion();
            setWorkspaceOpen(false);
            showToast(`Restored ${name}`);
          }}
        />
      )}


      {promptRequest && (
        <InputDialog
          request={promptRequest}
          onClose={() => {
            cancelPrompt();
            setPromptRequest(null);
          }}
        />
      )}

      {historyOpen && <TimelinePanel onClose={() => setHistoryOpen(false)} />}

      {presenting && <Presentation onExit={() => setPresenting(false)} />}

      {textPanelOpen && <DiagramTextPanel onClose={() => setTextPanelOpen(false)} />}

      {contextMenu && (
        <ContextMenu
          request={contextMenu}
          onClose={() => setContextMenu(null)}
          onExport={openExportDialog}
          onPresent={() => setPresenting(true)}
          onServices={() => setLibraryOpen(true)}
          onToast={showToast}
        />
      )}

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
