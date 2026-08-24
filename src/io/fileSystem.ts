import { idbDelete, idbGet, idbSet } from "./idb";

/**
 * Everything to do with getting bytes onto the user's disk.
 *
 * Chromium browsers get the real thing: the user picks an export folder once,
 * we persist the directory handle in IndexedDB, and every later export writes
 * straight into it. Firefox and Safari have no File System Access API, so they
 * fall back to ordinary downloads.
 */

const EXPORT_DIR_KEY = "export-directory-handle";

type PermissionMode = "read" | "readwrite";

interface HandleWithPermissions extends FileSystemHandle {
  queryPermission?: (opts: { mode: PermissionMode }) => Promise<PermissionState>;
  requestPermission?: (opts: { mode: PermissionMode }) => Promise<PermissionState>;
}

export const supportsDirectoryPicker = () =>
  typeof window !== "undefined" && "showDirectoryPicker" in window;

export const supportsFilePicker = () =>
  typeof window !== "undefined" && "showSaveFilePicker" in window;

/**
 * Confirms we may still write to a stored handle. Browsers drop the grant
 * between sessions, and re-requesting needs a user gesture — hence
 * `interactive`, which callers set only when responding to a click.
 */
export const ensurePermission = async (
  handle: FileSystemHandle,
  mode: PermissionMode,
  interactive: boolean,
): Promise<boolean> => {
  const h = handle as HandleWithPermissions;
  if (!h.queryPermission) return true;
  if ((await h.queryPermission({ mode })) === "granted") return true;
  if (!interactive || !h.requestPermission) return false;
  return (await h.requestPermission({ mode })) === "granted";
};

export const getStoredExportDirectory = async (): Promise<FileSystemDirectoryHandle | null> => {
  try {
    return (await idbGet<FileSystemDirectoryHandle>(EXPORT_DIR_KEY)) ?? null;
  } catch {
    return null;
  }
};

/** Prompts for an export folder and remembers it for future sessions. */
export const pickExportDirectory = async (): Promise<FileSystemDirectoryHandle | null> => {
  if (!supportsDirectoryPicker()) return null;
  try {
    const handle = await window.showDirectoryPicker!({
      id: "fluxxdraw-exports",
      mode: "readwrite",
      startIn: "documents",
    });
    await idbSet(EXPORT_DIR_KEY, handle);
    return handle;
  } catch (error) {
    // the user dismissing the picker is not an error worth surfacing
    if ((error as DOMException)?.name === "AbortError") return null;
    throw error;
  }
};

export const clearExportDirectory = async () => {
  await idbDelete(EXPORT_DIR_KEY);
};

/** Adds ` (2)`, ` (3)`… until the name is free, so exports never clobber. */
const uniqueName = async (dir: FileSystemDirectoryHandle, filename: string) => {
  const dot = filename.lastIndexOf(".");
  const stem = dot === -1 ? filename : filename.slice(0, dot);
  const ext = dot === -1 ? "" : filename.slice(dot);
  let candidate = filename;
  for (let n = 2; n < 1000; n++) {
    try {
      await dir.getFileHandle(candidate);
      candidate = `${stem} (${n})${ext}`;
    } catch {
      return candidate; // getFileHandle throws NotFoundError => name is free
    }
  }
  return `${stem}-${Date.now()}${ext}`;
};

export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // revoke on the next tick so the download has definitely started
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export interface SaveResult {
  filename: string;
  /** where the bytes ended up, for the confirmation toast */
  destination: "directory" | "download" | "file";
  directoryName?: string;
}

export const writeToDirectory = async (
  dir: FileSystemDirectoryHandle,
  filename: string,
  blob: Blob,
): Promise<SaveResult> => {
  const name = await uniqueName(dir, filename);
  const fileHandle = await dir.getFileHandle(name, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
  return { filename: name, destination: "directory", directoryName: dir.name };
};

/**
 * Saves a blob to the configured export folder, falling back to a download
 * when there is no folder, no permission, or no API support.
 */
export const saveExport = async (blob: Blob, filename: string): Promise<SaveResult> => {
  const dir = await getStoredExportDirectory();
  if (dir && (await ensurePermission(dir, "readwrite", false))) {
    try {
      return await writeToDirectory(dir, filename, blob);
    } catch (error) {
      console.warn("Falling back to download; writing to the export folder failed", error);
    }
  }
  downloadBlob(blob, filename);
  return { filename, destination: "download" };
};

export interface PickerType {
  description: string;
  accept: Record<string, string[]>;
}

/** "Save as…" dialog; returns the handle so the document can be re-saved later. */
export const saveWithPicker = async (
  blob: Blob,
  suggestedName: string,
  types: PickerType[],
): Promise<{ handle: FileSystemFileHandle; result: SaveResult } | null> => {
  if (!supportsFilePicker()) {
    downloadBlob(blob, suggestedName);
    return null;
  }
  try {
    const handle = await window.showSaveFilePicker!({ suggestedName, types });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return {
      handle,
      result: { filename: handle.name, destination: "file" },
    };
  } catch (error) {
    if ((error as DOMException)?.name === "AbortError") return null;
    throw error;
  }
};

/** Overwrites a file the user previously chose, for plain Cmd+S saves. */
export const writeToFileHandle = async (
  handle: FileSystemFileHandle,
  blob: Blob,
): Promise<SaveResult | null> => {
  if (!(await ensurePermission(handle, "readwrite", false))) return null;
  const writable = await handle.createWritable();
  await writable.write(blob);
  await writable.close();
  return { filename: handle.name, destination: "file" };
};

const OPEN_TYPES: PickerType[] = [
  {
    description: "Drawings and exported images",
    accept: {
      "application/json": [".fluxx", ".excalidraw", ".excali", ".json"],
      "image/png": [".png"],
      "image/svg+xml": [".svg"],
    },
  },
];

/** Opens the system file picker; returns both the File and its handle. */
export const openWithPicker = async (): Promise<{
  file: File;
  handle: FileSystemFileHandle | null;
} | null> => {
  if ("showOpenFilePicker" in window) {
    try {
      const [handle] = await window.showOpenFilePicker!({
        types: OPEN_TYPES,
        multiple: false,
      });
      return { file: await handle.getFile(), handle };
    } catch (error) {
      if ((error as DOMException)?.name === "AbortError") return null;
      throw error;
    }
  }
  // fallback: a hidden <input type="file">
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".fluxx,.excalidraw,.excali,.json,.png,.svg";
    input.onchange = () => {
      const file = input.files?.[0];
      resolve(file ? { file, handle: null } : null);
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
};
