import { nanoid } from "nanoid";
import type { BinaryFile, SceneDocument } from "../types";
import { parseSceneDocument } from "./serialize";
import { decodePngMetadata } from "./pngMetadata";
import { extractSvgScene } from "./exportSvg";

export type OpenResult =
  | { kind: "scene"; doc: SceneDocument }
  | { kind: "image"; file: BinaryFile; width: number; height: number };

const readAsText = (file: Blob) => file.text();

const readAsDataURL = (file: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const probeImageSize = (dataURL: string) =>
  new Promise<{ width: number; height: number }>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("Could not read image dimensions"));
    img.src = dataURL;
  });

const asImageResult = async (blob: Blob, mimeType: string): Promise<OpenResult> => {
  const dataURL = await readAsDataURL(blob);
  const { width, height } = await probeImageSize(dataURL);
  return {
    kind: "image",
    file: { id: nanoid(), mimeType, dataURL, created: Date.now() },
    width,
    height,
  };
};

/**
 * Works out what a file is and how to bring it in.
 *
 * PNGs and SVGs exported with an embedded scene reopen as fully editable
 * drawings; anything else that is an image is placed on the canvas instead.
 */
export const readFile = async (file: File): Promise<OpenResult> => {
  const name = file.name.toLowerCase();
  const isJson =
    name.endsWith(".json") || name.endsWith(".excali") || name.endsWith(".excalidraw");

  if (isJson || file.type === "application/json") {
    const text = await readAsText(file);
    return { kind: "scene", doc: parseSceneDocument(JSON.parse(text)) };
  }

  if (name.endsWith(".png") || file.type === "image/png") {
    const embedded = await decodePngMetadata(file);
    if (embedded) {
      try {
        return { kind: "scene", doc: parseSceneDocument(JSON.parse(embedded)) };
      } catch {
        // corrupt metadata shouldn't block using the PNG as a plain image
      }
    }
    return asImageResult(file, "image/png");
  }

  if (name.endsWith(".svg") || file.type === "image/svg+xml") {
    const text = await readAsText(file);
    const embedded = extractSvgScene(text);
    if (embedded) {
      try {
        return { kind: "scene", doc: parseSceneDocument(JSON.parse(embedded)) };
      } catch {
        // fall through to treating it as artwork
      }
    }
    return asImageResult(file, "image/svg+xml");
  }

  if (file.type.startsWith("image/")) return asImageResult(file, file.type);

  throw new Error(`Unsupported file type: ${file.type || file.name}`);
};
