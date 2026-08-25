import {
  COMPATIBLE_DOCUMENT_TYPES,
  DOCUMENT_TYPE,
  FILE_SOURCE,
  FILE_VERSION,
  type AppState,
  type BinaryFile,
  type ExcaliElement,
  type SceneDocument,
} from "../types";
import type { Checkpoint } from "./history";
import type { ComponentDefinition } from "../types";

/** Files actually referenced by the given elements, so exports stay lean. */
export const collectUsedFiles = (
  elements: ExcaliElement[],
  files: Record<string, BinaryFile>,
): Record<string, BinaryFile> => {
  const used: Record<string, BinaryFile> = {};
  for (const el of elements) {
    if (el.type === "image" && files[el.fileId]) used[el.fileId] = files[el.fileId];
  }
  return used;
};

export const serializeScene = (
  elements: ExcaliElement[],
  files: Record<string, BinaryFile>,
  appState: Pick<AppState, "viewBackgroundColor" | "gridSize" | "theme">,
  history?: Checkpoint[],
  components?: Record<string, ComponentDefinition>,
): SceneDocument => ({
  type: DOCUMENT_TYPE,
  version: FILE_VERSION,
  source: FILE_SOURCE,
  elements: elements.filter((el) => !el.isDeleted),
  files: collectUsedFiles(elements, files),
  appState: {
    viewBackgroundColor: appState.viewBackgroundColor,
    gridSize: appState.gridSize,
    theme: appState.theme,
  },
  ...(history?.length ? { history } : {}),
  ...(components && Object.keys(components).length ? { components } : {}),
});

export const sceneToJson = (doc: SceneDocument) => JSON.stringify(doc, null, 2);

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Validates and normalises a parsed document. Missing optional fields are
 * filled in so older or hand-edited files still open.
 */
export const parseSceneDocument = (raw: unknown): SceneDocument => {
  if (!isPlainObject(raw)) throw new Error("File is not a valid scene: expected an object");
  // Excalidraw documents share our shape, so they open here too
  if (typeof raw.type !== "string" || !COMPATIBLE_DOCUMENT_TYPES.includes(raw.type)) {
    throw new Error(`File is not a valid scene: unexpected type "${String(raw.type)}"`);
  }
  if (!Array.isArray(raw.elements)) throw new Error("File is missing an elements array");

  const appState = isPlainObject(raw.appState) ? raw.appState : {};
  const rawElements = raw.elements as Record<string, unknown>[];
  const elements = (rawElements as unknown as ExcaliElement[]).map((el) => {
    const patched: Record<string, unknown> = {
      ...el,
      // these were added after v1 files could have been written
      version: el.version ?? 1,
      groupIds: el.groupIds ?? [],
      frameId: el.frameId ?? null,
      locked: el.locked ?? false,
      isDeleted: el.isDeleted ?? false,
      link: el.link ?? null,
      angle: el.angle ?? 0,
    };
    // Migrate elbowed boolean → pathType enum
    if (el.type === "arrow" || el.type === "line") {
      if (!("pathType" in patched) || patched.pathType === undefined) {
        patched.pathType = (patched as Record<string, unknown>).elbowed ? "elbow" : "straight";
      }
      delete (patched as Record<string, unknown>).elbowed;
    }
    return patched as unknown as ExcaliElement;
  });

  // Validate binding references — stale bindings pointing at missing elements
  // get cleaned up so they don't cause ghost connections.
  const elementIds = new Set(elements.map((el) => el.id));
  for (const el of elements) {
    if (el.type === "arrow" || el.type === "line") {
      const arrow = el as import("../types").LinearElement;
      if (arrow.startBinding && !elementIds.has(arrow.startBinding.elementId)) {
        (arrow as unknown as Record<string, unknown>).startBinding = null;
      }
      if (arrow.endBinding && !elementIds.has(arrow.endBinding.elementId)) {
        (arrow as unknown as Record<string, unknown>).endBinding = null;
      }
    }
  }

  return {
    type: DOCUMENT_TYPE,
    version: typeof raw.version === "number" ? raw.version : FILE_VERSION,
    source: typeof raw.source === "string" ? raw.source : "unknown",
    elements,
    files: isPlainObject(raw.files) ? (raw.files as Record<string, BinaryFile>) : {},
    appState: {
      viewBackgroundColor:
        typeof appState.viewBackgroundColor === "string" ? appState.viewBackgroundColor : "#ffffff",
      gridSize: typeof appState.gridSize === "number" ? appState.gridSize : null,
      theme: appState.theme === "dark" ? "dark" : "light",
    },
    ...(Array.isArray(raw.history) ? { history: raw.history as Checkpoint[] } : {}),
    ...(isPlainObject(raw.components)
      ? { components: raw.components as Record<string, ComponentDefinition> }
      : {}),
  };
};
