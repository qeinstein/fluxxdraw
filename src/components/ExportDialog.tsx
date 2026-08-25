import { useEffect, useMemo, useState, useRef } from "react";
import { useScene } from "../store";
import {
  buildFilename,
  copyExportToClipboard,
  getExportElements,
  previewDimensions,
  runExport,
  type ExportFormat,
  type ExportScope,
  type ExportSettings,
  type ResolutionPreset,
} from "../io/exportController";
import { exportToCanvas } from "../io/exportImage";
import { collectUsedFiles } from "../io/serialize";
import { store } from "../store";
import { ExportDestination } from "./ExportDestination";
import { Tooltip } from "./Tooltip";
import { IconClose } from "./icons";

interface ExportDialogProps {
  settings: ExportSettings;
  onChange: (settings: ExportSettings) => void;
  onClose: () => void;
  directoryName: string | null;
  onDirectoryChange: (name: string | null) => void;
}

const FORMATS: { value: ExportFormat; label: string; hint: string }[] = [
  { value: "png", label: "PNG", hint: "Lossless. Can carry the scene for re-editing." },
  { value: "jpeg", label: "JPEG", hint: "Smaller, lossy, no transparency." },
  { value: "webp", label: "WebP", hint: "Smaller than PNG at similar quality." },
  { value: "svg", label: "SVG", hint: "Vector. Can carry the scene for re-editing." },
  { value: "json", label: ".fluxx", hint: "The editable source file itself." },
];

const RESOLUTIONS: { value: ResolutionPreset; label: string }[] = [
  { value: "1x", label: "1×" },
  { value: "2x", label: "2×" },
  { value: "3x", label: "3×" },
  { value: "4k", label: "4K" },
  { value: "8k", label: "8K" },
  { value: "custom", label: "Custom" },
];

export const ExportDialog = ({
  settings,
  onChange,
  onClose,
  directoryName,
  onDirectoryChange,
}: ExportDialogProps) => {
  const scene = useScene();
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const frames = scene.visibleElements.filter((el) => el.type === "frame");
  const hasSelection = scene.appState.selectedIds.length > 0;

  const patch = (next: Partial<ExportSettings>) => onChange({ ...settings, ...next });

  // a scope can become invalid, e.g. after the selection is cleared
  useEffect(() => {
    if (settings.scope === "selection" && !hasSelection) patch({ scope: "canvas" });
    if (settings.scope === "frame" && frames.length === 0) patch({ scope: "canvas" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSelection, frames.length]);

  const dimensions = useMemo(() => {
    try {
      return previewDimensions(settings);
    } catch {
      return null;
    }
    // recompute whenever the scene or settings change
  }, [settings, scene.getVersion()]);

  const elementCount = getExportElements(settings).length;
  const isRaster = settings.format === "png" || settings.format === "jpeg" || settings.format === "webp";
  const canEmbed = settings.format === "png" || settings.format === "svg";

  const doExport = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const result = await runExport(settings);
      setStatus(
        result.destination === "directory"
          ? `Saved ${result.filename} to ${result.directoryName}`
          : `Downloaded ${result.filename}`,
      );
    } catch (error) {
      setStatus(`Export failed: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const doCopy = async () => {
    setBusy(true);
    setStatus(null);
    try {
      await copyExportToClipboard(settings);
      setStatus("Copied to clipboard");
    } catch (error) {
      setStatus(`Copy failed: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog export-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 900, width: "90vw" }}>
        <header>
          <h2>Export</h2>
          <Tooltip label="Close" shortcut="Esc" placement="top">
            <button className="icon-button" aria-label="Close" onClick={onClose}>
              <IconClose />
            </button>
          </Tooltip>
        </header>

        <div className="dialog-body" style={{ display: "flex", gap: 24, flexDirection: "row" }}>
          <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", minHeight: 300, background: "var(--surface-sunken)", borderRadius: 8, overflow: "hidden" }}>
            <ExportPreview settings={settings} />
          </div>
          
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, overflowY: "auto", maxHeight: "60vh" }}>
          <Field label="What to export">
            <div className="segmented">
              {(["canvas", "selection", "frame"] as ExportScope[]).map((scope) => (
                <button
                  key={scope}
                  className={settings.scope === scope ? "active" : ""}
                  disabled={
                    (scope === "selection" && !hasSelection) ||
                    (scope === "frame" && frames.length === 0)
                  }
                  onClick={() =>
                    patch({
                      scope,
                      frameId:
                        scope === "frame"
                          ? settings.frameId ?? frames[0]?.id ?? null
                          : settings.frameId,
                    })
                  }
                >
                  {scope === "canvas" ? "Whole canvas" : scope === "selection" ? "Selection" : "Frame"}
                </button>
              ))}
            </div>
            {settings.scope === "frame" && (
              <select
                value={settings.frameId ?? frames[0]?.id ?? ""}
                onChange={(e) => patch({ frameId: e.target.value })}
              >
                {frames.map((frame) => (
                  <option key={frame.id} value={frame.id}>
                    {frame.type === "frame" ? frame.name : frame.id}
                  </option>
                ))}
              </select>
            )}
            <p className="hint">{elementCount} element{elementCount === 1 ? "" : "s"}</p>
          </Field>

          <Field label="Format">
            <div className="segmented">
              {FORMATS.map((format) => (
                <button
                  key={format.value}
                  className={settings.format === format.value ? "active" : ""}
                  onClick={() => patch({ format: format.value })}
                >
                  {format.label}
                </button>
              ))}
            </div>
            <p className="hint">{FORMATS.find((f) => f.value === settings.format)?.hint}</p>
          </Field>

          {settings.format !== "json" && (
            <Field label="Resolution">
              <div className="segmented">
                {RESOLUTIONS.map((preset) => (
                  <button
                    key={preset.value}
                    className={settings.resolutionPreset === preset.value ? "active" : ""}
                    onClick={() => patch({ resolutionPreset: preset.value })}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              {settings.resolutionPreset === "custom" && (
                <label className="inline">
                  Scale
                  <input
                    type="number"
                    min={0.1}
                    max={20}
                    step={0.1}
                    value={settings.scale}
                    onChange={(e) => patch({ scale: Number(e.target.value) || 1 })}
                  />
                  ×
                </label>
              )}
              {dimensions && (
                <p className="hint">
                  Output: <strong>{dimensions.width} × {dimensions.height}</strong> px
                  {dimensions.clamped && " (clamped to the browser's canvas limit)"}
                </p>
              )}
            </Field>
          )}

          {settings.format !== "json" && (
            <Field label="Options">
              <div className="segmented" style={{ marginBottom: 12 }}>
                {(["auto", "light", "dark"] as const).map((theme) => (
                  <button
                    key={theme}
                    className={settings.theme === theme ? "active" : ""}
                    onClick={() => patch({ theme })}
                  >
                    {theme === "auto" ? "Auto Theme" : theme === "light" ? "Light" : "Dark"}
                  </button>
                ))}
              </div>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={settings.background}
                  disabled={settings.format === "jpeg"}
                  onChange={(e) => patch({ background: e.target.checked })}
                />
                Include background
                {settings.format === "jpeg" && <span className="hint"> (JPEG has no transparency)</span>}
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={settings.embedScene && canEmbed}
                  disabled={!canEmbed}
                  onChange={(e) => patch({ embedScene: e.target.checked })}
                />
                Embed scene so the file reopens as an editable drawing
                {!canEmbed && <span className="hint"> (PNG and SVG only)</span>}
              </label>
              <label className="inline">
                Padding
                <input
                  type="number"
                  min={0}
                  max={400}
                  value={settings.padding}
                  onChange={(e) => patch({ padding: Number(e.target.value) || 0 })}
                />
                px
              </label>
              {isRaster && settings.format !== "png" && (
                <label className="inline">
                  Quality
                  <input
                    type="range"
                    min={0.3}
                    max={1}
                    step={0.01}
                    value={settings.quality}
                    onChange={(e) => patch({ quality: Number(e.target.value) })}
                  />
                  {Math.round(settings.quality * 100)}%
                </label>
              )}
            </Field>
          )}

          <Field label="File name">
            <div className="inline">
              <input
                type="text"
                value={settings.filename}
                onChange={(e) => patch({ filename: e.target.value })}
                placeholder="drawing"
              />
              <span className="hint">{buildFilename(settings)}</span>
            </div>
          </Field>

          <Field label="Save to">
            <ExportDestination
              directoryName={directoryName}
              onDirectoryChange={onDirectoryChange}
            />
          </Field>
          </div>
        </div>

        <footer>
          {status && <span className="status">{status}</span>}
          <div className="spacer" />
          <button onClick={doCopy} disabled={busy || elementCount === 0}>
            Copy to clipboard
          </button>
          <button className="primary" onClick={doExport} disabled={busy || elementCount === 0}>
            {busy ? "Exporting…" : "Export"}
          </button>
        </footer>
      </div>
    </div>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="field">
    <div className="field-label">{label}</div>
    <div className="field-body">{children}</div>
  </div>
);

const ExportPreview = ({ settings }: { settings: ExportSettings }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const renderPreview = async () => {
      setLoading(true);
      setError(null);
      try {
        const elements = getExportElements(settings);
        if (elements.length === 0) {
          if (containerRef.current) containerRef.current.innerHTML = "";
          return;
        }

        const files = collectUsedFiles(elements, store.files);
        const theme = settings.theme === "auto" ? store.appState.theme : settings.theme;
        const isDark = theme === "dark";
        const backgroundColor = settings.background ? (isDark ? "#121212" : "#ffffff") : "transparent";

        const canvas = await exportToCanvas({
          elements,
          files,
          components: store.components,
          scale: 1, // Will be overridden by targetLongEdge
          targetLongEdge: 600, // Fixed small size for preview
          padding: settings.padding,
          background: settings.background,
          backgroundColor,
          theme,
        });

        if (active && containerRef.current) {
          containerRef.current.innerHTML = "";
          canvas.style.maxWidth = "100%";
          canvas.style.maxHeight = "100%";
          canvas.style.objectFit = "contain";
          canvas.style.borderRadius = "4px";
          // If background is transparent, show a checkerboard so white/black elements are visible
          if (!settings.background) {
            containerRef.current.style.backgroundImage = 'url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMUlEQVQ4T2NkYGAQYcAP3uCTZhw1gGGYhAGBZIA/ENF5gEDAwEAiM9LwGIUDAyMDIwMAu18EAcyM2zAAAAAASUVORK5CYII=")';
          } else {
            containerRef.current.style.backgroundImage = 'none';
          }
          containerRef.current.appendChild(canvas);
        }
      } catch (err) {
        if (active) setError((err as Error).message);
      } finally {
        if (active) setLoading(false);
      }
    };
    renderPreview();
    return () => { active = false; };
  }, [settings, store.appState.theme]);

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", justifyContent: "center", alignItems: "center", position: "relative" }}>
      {error && <div style={{ color: "var(--danger)", padding: 20 }}>{error}</div>}
      <div ref={containerRef} style={{ width: "100%", height: "100%", display: "flex", justifyContent: "center", alignItems: "center", padding: 16 }} />
      {loading && <div style={{ position: "absolute", bottom: 8, right: 8, fontSize: 11, color: "var(--fg-subtle)" }}>Updating...</div>}
    </div>
  );
};
