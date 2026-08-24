import { store } from "../store";
import { FILE_EXTENSION } from "../constants";
import type { ExcaliElement } from "../types";
import { getFrameContents } from "../actions";
import { sceneToJson, serializeScene, collectUsedFiles } from "./serialize";
import {
  computeExportDimensions,
  exportToRasterBlob,
  type RasterFormat,
} from "./exportImage";
import { exportToSvgString } from "./exportSvg";
import { saveExport, type SaveResult } from "./fileSystem";

export type ExportFormat = RasterFormat | "svg" | "json";
export type ExportScope = "canvas" | "selection" | "frame";

export interface ExportSettings {
  format: ExportFormat;
  scope: ExportScope;
  frameId: string | null;
  /** plain multiplier, used when `resolutionPreset` is "scale" */
  scale: number;
  resolutionPreset: ResolutionPreset;
  padding: number;
  background: boolean;
  embedScene: boolean;
  quality: number;
  filename: string;
}

export type ResolutionPreset = "1x" | "2x" | "3x" | "4k" | "8k" | "custom";

/** Long-edge pixel targets for the fixed-resolution presets. */
export const PRESET_LONG_EDGE: Record<string, number | null> = {
  "1x": null,
  "2x": null,
  "3x": null,
  "4k": 3840,
  "8k": 7680,
  custom: null,
};

const PRESET_SCALE: Record<string, number> = { "1x": 1, "2x": 2, "3x": 3 };

export const resolveScaling = (settings: ExportSettings) => {
  const targetLongEdge = PRESET_LONG_EDGE[settings.resolutionPreset] ?? undefined;
  const scale =
    PRESET_SCALE[settings.resolutionPreset] ??
    (settings.resolutionPreset === "custom" ? settings.scale : 1);
  return { scale, targetLongEdge };
};

export const DEFAULT_EXPORT_SETTINGS: ExportSettings = {
  format: "png",
  scope: "canvas",
  frameId: null,
  scale: 2,
  resolutionPreset: "4k",
  padding: 24,
  background: true,
  embedScene: true,
  quality: 0.92,
  filename: "drawing",
};

/** Elements covered by the chosen scope. */
export const getExportElements = (settings: ExportSettings): ExcaliElement[] => {
  if (settings.scope === "selection") {
    const selected = store.getSelected();
    // pull in each container's label so exported shapes keep their text
    const ids = new Set(selected.map((el) => el.id));
    for (const el of selected) {
      if ("boundText" in el && el.boundText) ids.add(el.boundText);
    }
    return store.visibleElements.filter((el) => ids.has(el.id));
  }
  if (settings.scope === "frame" && settings.frameId) {
    return getFrameContents(settings.frameId);
  }
  return store.visibleElements;
};

const EXTENSION: Record<ExportFormat, string> = {
  png: "png",
  jpeg: "jpg",
  webp: "webp",
  svg: "svg",
  json: FILE_EXTENSION,
};

export const buildFilename = (settings: ExportSettings) => {
  const stem = settings.filename.trim() || "drawing";
  return `${stem}.${EXTENSION[settings.format]}`;
};

/** Pixel dimensions the current settings would produce, for the dialog preview. */
export const previewDimensions = (settings: ExportSettings) => {
  const elements = getExportElements(settings);
  if (elements.length === 0) return null;
  const { scale, targetLongEdge } = resolveScaling(settings);
  return computeExportDimensions(elements, {
    scale,
    padding: settings.padding,
    targetLongEdge,
  });
};

/** Produces the bytes for the current settings, without writing them anywhere. */
export const buildExportBlob = async (settings: ExportSettings): Promise<Blob> => {
  const elements = getExportElements(settings);
  if (elements.length === 0) throw new Error("Nothing to export");

  const files = collectUsedFiles(elements, store.files);
  // History describes the document as a whole, so it only rides along with a
  // full-canvas export — a cropped selection isn't what those checkpoints hold.
  const history = settings.scope === "canvas" ? store.timeline.checkpoints : undefined;
  const doc = serializeScene(elements, files, store.appState, history, store.components);
  const sceneJson = sceneToJson(doc);

  if (settings.format === "json") {
    return new Blob([sceneJson], { type: "application/json" });
  }

  const { scale, targetLongEdge } = resolveScaling(settings);

  if (settings.format === "svg") {
    const svg = await exportToSvgString({
      elements,
      files,
      padding: settings.padding,
      background: settings.background,
      backgroundColor: store.appState.viewBackgroundColor,
      embedScene: settings.embedScene,
      sceneJson,
      // SVG is resolution-independent, but the width/height attrs still scale
      scale: targetLongEdge
        ? (computeExportDimensions(elements, { scale, padding: settings.padding, targetLongEdge })
            .scale ?? 1)
        : scale,
    });
    return new Blob([svg], { type: "image/svg+xml" });
  }

  return exportToRasterBlob({
    elements,
    files,
    components: store.components,
    format: settings.format,
    scale,
    targetLongEdge,
    padding: settings.padding,
    background: settings.background,
    backgroundColor: store.appState.viewBackgroundColor,
    quality: settings.quality,
    embedScene: settings.embedScene,
    sceneJson,
  });
};

/** Builds and writes the export to the configured folder (or downloads it). */
export const runExport = async (settings: ExportSettings): Promise<SaveResult> => {
  const blob = await buildExportBlob(settings);
  return saveExport(blob, buildFilename(settings));
};

/** Copies the export to the clipboard as an image, where the browser allows it. */
export const copyExportToClipboard = async (settings: ExportSettings) => {
  if (!navigator.clipboard || !("write" in navigator.clipboard)) {
    throw new Error("This browser cannot write images to the clipboard");
  }
  if (settings.format === "json" || settings.format === "svg") {
    const blob = await buildExportBlob(settings);
    await navigator.clipboard.writeText(await blob.text());
    return;
  }
  // Safari and Chrome only reliably accept PNG on the clipboard
  const blob = await buildExportBlob({ ...settings, format: "png" });
  await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
};
