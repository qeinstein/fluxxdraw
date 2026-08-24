import {
  FILE_SOURCE,
  FILE_VERSION,
  type AppState,
  type BinaryFile,
  type ExcaliElement,
  type SceneDocument,
} from "../types";

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
): SceneDocument => ({
  type: "excalidraw",
  version: FILE_VERSION,
  source: FILE_SOURCE,
  elements: elements.filter((el) => !el.isDeleted),
  files: collectUsedFiles(elements, files),
  appState: {
    viewBackgroundColor: appState.viewBackgroundColor,
    gridSize: appState.gridSize,
    theme: appState.theme,
  },
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
  if (raw.type !== "excalidraw") {
    throw new Error(`File is not a valid scene: unexpected type "${String(raw.type)}"`);
  }
  if (!Array.isArray(raw.elements)) throw new Error("File is missing an elements array");

  const appState = isPlainObject(raw.appState) ? raw.appState : {};
  const elements = (raw.elements as ExcaliElement[]).map((el) => ({
    ...el,
    // these were added after v1 files could have been written
    version: el.version ?? 1,
    groupIds: el.groupIds ?? [],
    frameId: el.frameId ?? null,
    locked: el.locked ?? false,
    isDeleted: el.isDeleted ?? false,
    link: el.link ?? null,
    angle: el.angle ?? 0,
  }));

  return {
    type: "excalidraw",
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
  };
};
